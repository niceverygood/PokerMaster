// Vercel Serverless Function - OpenRouter API 프록시
// 환경변수 OPENROUTER_API_KEY를 서버에서 사용 → 클라이언트에 키 노출 X
//
// Vercel 환경변수 설정:
//   Vercel 대시보드 → Project Settings → Environment Variables
//   Name: OPENROUTER_API_KEY
//   Value: sk-or-v1-...

module.exports = async (req, res) => {
  // CORS (같은 도메인에서만 호출되지만 안전하게)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: '서버에 OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드에서 설정하세요.'
    });
  }

  try {
    // req.body는 Vercel이 자동 파싱해주지만 경우에 따라 string일 수 있음
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (!body || !body.messages) {
      return res.status(400).json({ error: 'messages 필드가 필요합니다' });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'https://pokermaster.vercel.app',
        'X-Title': 'PokerMaster Coach'
      },
      body: JSON.stringify({
        model: body.model || 'anthropic/claude-3.5-haiku',
        messages: body.messages,
        max_tokens: body.max_tokens || 500,
        temperature: body.temperature ?? 0.4
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `OpenRouter ${response.status}`
      });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: '프록시 오류: ' + e.message });
  }
};
