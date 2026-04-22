// AI 실시간 코치 — OpenRouter API
// 키는 localStorage에만 저장 (코드/저장소에 포함되지 않음)

const AI_KEY_STORAGE = 'pokermaster_ai_key';
const AI_MODEL_STORAGE = 'pokermaster_ai_model';
const DEFAULT_AI_MODEL = 'anthropic/claude-3.5-haiku';

const AI_SYSTEM_PROMPT = `당신은 No-Limit Texas Hold'em 토너먼트 전문 코치입니다.
한국어로 간결하고 실용적인 답변을 해주세요.

원칙:
- 핵심만. 기본 답변은 2~4문장, 길어도 한 화면 이내.
- EV, 팟 오즈, 에퀴티, 레인지, ICM 같은 용어는 자연스럽게 사용하되 초보도 이해할 수 있게 풀어서.
- 추천 액션이 있다면 근거(에쿼티/폴드에쿼티/포지션/상대 레인지 등)를 함께 제시.
- 장황한 서론 금지. 바로 요점부터.
- 사용자 핸드나 보드 상황이 주어지면 구체적으로 분석.`;

let aiChatMessages = []; // [{role:'user'|'assistant', content}]
let aiChatOpen = false;
let aiBusy = false;

function getAIKey() {
  // 우선순위: localStorage → config.local.js (window.POKERMASTER_CONFIG)
  const ls = localStorage.getItem(AI_KEY_STORAGE);
  if (ls) return ls;
  if (typeof window !== 'undefined' && window.POKERMASTER_CONFIG?.OPENROUTER_API_KEY) {
    return window.POKERMASTER_CONFIG.OPENROUTER_API_KEY;
  }
  return '';
}
function setAIKey(k) { localStorage.setItem(AI_KEY_STORAGE, k.trim()); }
function getAIModel() {
  const ls = localStorage.getItem(AI_MODEL_STORAGE);
  if (ls) return ls;
  if (typeof window !== 'undefined' && window.POKERMASTER_CONFIG?.DEFAULT_MODEL) {
    return window.POKERMASTER_CONFIG.DEFAULT_MODEL;
  }
  return DEFAULT_AI_MODEL;
}
function setAIModel(m) { localStorage.setItem(AI_MODEL_STORAGE, m); }
function clearAIKey() {
  localStorage.removeItem(AI_KEY_STORAGE);
  aiChatMessages = [];
  renderAIChat();
}

// 현재 게임 상황을 프롬프트용 텍스트로 변환
function buildGameContext() {
  if (!tournament || !tournament.currentHand) {
    return '현재 진행 중인 핸드가 없습니다.';
  }
  const hand = tournament.currentHand;
  const hero = hand.playerStates.find(p => p.isHuman);
  if (!hero) return '';

  const suitChar = ['s', 'h', 'd', 'c'];
  const handStr = handToString(hero.hole[0], hero.hole[1]);
  const holeText = hero.hole.map(c => c.rankStr + c.suitSym).join(' ');
  const boardText = hand.board.length ? hand.board.map(c => c.rankStr + c.suitSym).join(' ') : '(없음)';
  const pot = hand.playerStates.reduce((s, p) => s + p.totalBet, 0);
  const toCall = hand.currentBet - hero.bet;

  const lines = [];
  lines.push('[핸드 스냅샷]');
  lines.push(`- 토너먼트 핸드 #${hand.number}, 블라인드 ${hand.sb}/${hand.bb}`);
  lines.push(`- 스트리트: ${streetName(hand.street)}`);
  lines.push(`- 내 포지션: ${hero.position}`);
  lines.push(`- 내 스택: ${hero.stack} (${(hero.stack / hand.bb).toFixed(1)}BB)`);
  lines.push(`- 내 핸드: ${holeText} [${handStr}]`);
  lines.push(`- 보드: ${boardText}`);
  lines.push(`- 팟: ${pot}, 이번 스트리트 최고베팅: ${hand.currentBet}, 내 금액: ${hero.bet}`);
  if (toCall > 0) lines.push(`- 콜 필요: ${toCall} (팟오즈 필요승률 ${((toCall / (pot + toCall)) * 100).toFixed(1)}%)`);

  lines.push('\n[다른 플레이어]');
  for (const p of hand.playerStates) {
    if (p.isHuman) continue;
    const status = p.folded ? '폴드' : (p.allIn ? '올인' : '활성');
    const last = p.lastAction ? ` · 최근 ${actionPillText(p.lastAction)}` : '';
    lines.push(`- ${p.name} (${p.position}): 스택 ${p.stack}(${(p.stack / hand.bb).toFixed(1)}BB), ${status}${last}`);
  }

  lines.push('\n[이번 핸드 액션 히스토리]');
  const history = hand.actions.slice(-15);
  for (const a of history) {
    if (a.type === 'deal') {
      lines.push(`  · ${streetName(a.street)} 공개`);
    } else {
      const p = hand.playerStates.find(x => x.id === a.playerId);
      lines.push(`  · ${streetName(a.street)} — ${p?.name || '?'} (${a.position}): ${describeShortAction(a)}`);
    }
  }
  return lines.join('\n');
}

function describeShortAction(a) {
  if (a.type === 'fold') return '폴드';
  if (a.type === 'check') return '체크';
  if (a.type === 'call') return `콜 ${a.amount}`;
  if (a.type === 'bet') return `베팅 ${a.amount}`;
  if (a.type === 'raise') return `레이즈 ${a.amount}`;
  if (a.type === 'allin') return '올인';
  return a.type;
}

// AI 호출 — 우선순위:
//  1) /api/openrouter 서버리스 프록시 (Vercel 환경변수 사용, 키 노출 X)
//  2) 실패/부재 시 클라이언트 키 직접 호출 (localStorage 또는 config.local.js)
async function askAI(userQuestion, opts) {
  opts = opts || {};
  if (aiBusy) return { error: '다른 요청이 진행 중입니다.' };
  aiBusy = true;

  try {
    aiChatMessages.push({ role: 'user', content: userQuestion });

    let fullUserContent = userQuestion;
    if (opts.includeContext !== false) {
      const ctx = buildGameContext();
      if (ctx) fullUserContent = `${ctx}\n\n[사용자 질문]\n${userQuestion}`;
    }

    const priorHistory = aiChatMessages.slice(-8, -1);
    const messages = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      ...priorHistory,
      { role: 'user', content: fullUserContent }
    ];
    const model = getAIModel();
    const payload = { model, messages, max_tokens: 500, temperature: 0.4 };

    // 1) 서버리스 프록시 시도 (Vercel 배포 환경)
    let data = null, proxyStatus = null, proxyWorked = false, proxyErrorDetail = null;
    try {
      const proxyResp = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      proxyStatus = proxyResp.status;
      if (proxyResp.ok) {
        data = await proxyResp.json();
        proxyWorked = true;
      } else {
        // 프록시가 응답했지만 실패 — 구체적 메시지 추출
        try {
          const err = await proxyResp.json();
          proxyErrorDetail = err?.error || JSON.stringify(err).slice(0, 200);
        } catch (e) {
          const txt = await proxyResp.text().catch(() => '');
          proxyErrorDetail = txt.slice(0, 200) || '(응답 본문 없음)';
        }
      }
    } catch (e) {
      // fetch 자체 실패 (네트워크 오류 등) — 조용히 폴백
      proxyErrorDetail = '네트워크 오류: ' + e.message;
    }

    // 2) 프록시 실패 시 클라이언트 키로 직접 호출
    if (!proxyWorked) {
      const key = getAIKey();
      // 프록시 응답이 있었는데 실패 = Vercel 배포된 프록시가 잘못됨 → 상세 에러 표시
      if (proxyStatus != null && proxyStatus !== 404 && !key) {
        return {
          error: `서버 프록시 오류 (${proxyStatus}): ${proxyErrorDetail}. Vercel 대시보드에서 OPENROUTER_API_KEY 환경변수를 확인하고, 설정 후 반드시 "Redeploy" 해주세요.`,
          proxyStatus
        };
      }
      // 프록시 404(배포 안됨) + 클라 키도 없음
      if (!key) {
        return {
          error: '이 배포에는 AI 프록시가 없어요. Vercel에 배포하고 OPENROUTER_API_KEY 환경변수를 설정하거나, 아래에 직접 API 키를 입력하세요.',
          proxyStatus
        };
      }
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin || 'http://localhost',
          'X-Title': 'PokerMaster Coach'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return { error: `API ${resp.status}: ${errText.slice(0, 250)}` };
      }
      data = await resp.json();
    }

    const reply = (data && data.choices && data.choices[0]?.message?.content) || '(빈 응답)';
    aiChatMessages.push({ role: 'assistant', content: reply });
    return { reply, viaProxy: proxyWorked };
  } catch (e) {
    return { error: '네트워크 오류: ' + e.message };
  } finally {
    aiBusy = false;
  }
}

// ==================== UI ====================
function toggleAIChat() {
  aiChatOpen = !aiChatOpen;
  renderAIChat();
}

function openAIChatWithQuestion(q) {
  aiChatOpen = true;
  renderAIChat();
  if (q) {
    const input = document.getElementById('ai-chat-input');
    if (input) input.value = q;
    submitAIChat();
  }
}

function renderAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  if (!panel) return;
  panel.classList.toggle('open', aiChatOpen);
  if (!aiChatOpen) return;

  const key = getAIKey();
  if (!key) {
    renderAIKeySetup();
    return;
  }
  renderAIChatMessages();
}

function renderAIChatMessages() {
  const body = document.getElementById('ai-chat-body');
  if (!body) return;
  if (aiChatMessages.length === 0) {
    body.innerHTML = `
      <div class="chat-hint">
        <div style="font-size:32px; margin-bottom:8px">🤖</div>
        <div style="margin-bottom: 6px; color: #bcd4f6;"><b>AI 포커 코치</b></div>
        <div>현재 핸드 상황을 자동으로 분석합니다. 자유롭게 질문하거나 아래 버튼을 누르세요.</div>
        <div class="quick-questions">
          <button onclick="quickAskAI('지금 이 상황을 분석해줘. 최선의 액션은?')">🎯 지금 상황 분석</button>
          <button onclick="quickAskAI('상대방의 레인지를 추정해줘')">🎴 상대 레인지 추정</button>
          <button onclick="quickAskAI('내가 가장 잘못하고 있는 점은?')">📊 약점 진단</button>
          <button onclick="quickAskAI('다음 스트리트 플랜을 짜줘')">🗺️ 다음 수 플래닝</button>
          <button onclick="quickAskAI('이 핸드에서 내 에쿼티와 팟오즈를 쉽게 설명해줘')">💡 에쿼티/팟오즈 설명</button>
        </div>
      </div>`;
    return;
  }
  const html = aiChatMessages.map(m => `
    <div class="chat-msg chat-${m.role}">
      <div class="chat-role">${m.role === 'user' ? '나' : '🤖 AI 코치'}</div>
      <div class="chat-bubble">${formatChatText(m.content)}</div>
    </div>
  `).join('');
  body.innerHTML = html;
  body.scrollTop = body.scrollHeight;
}

function formatChatText(s) {
  let t = String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\n/g, '<br>');
  return t;
}

function renderAIKeySetup() {
  const body = document.getElementById('ai-chat-body');
  body.innerHTML = `
    <div class="chat-setup">
      <h3>🔑 AI 코치 설정</h3>
      <p class="muted" style="font-size:12px; line-height:1.5">
        <b>OpenRouter API 키</b>가 필요합니다.<br>
        <a href="https://openrouter.ai/keys" target="_blank" style="color:#5a9cdf">openrouter.ai/keys</a>에서 발급.<br>
        키는 <b>브라우저 localStorage에만 저장</b>되며, OpenRouter API 외 다른 곳으로 전송되지 않습니다.
      </p>
      <input type="password" id="ai-key-input" placeholder="sk-or-v1-..." autocomplete="off" style="width:100%; padding:8px; background:#242c35; border:1px solid #2d3642; color:#e8e8e8; border-radius:4px; font-family:monospace; font-size:12px;">
      <div style="margin-top:10px">
        <label style="font-size:11px; color:#8b9095">모델</label>
        <select id="ai-model-select" style="width:100%; padding:6px; background:#242c35; border:1px solid #2d3642; color:#e8e8e8; border-radius:4px; font-size:12px;">
          <option value="anthropic/claude-haiku-4-5">Claude Haiku 4.5 — 빠르고 저렴 (권장)</option>
          <option value="anthropic/claude-sonnet-4-5">Claude Sonnet 4.5 — 균형</option>
          <option value="anthropic/claude-opus-4-6">Claude Opus 4.6 — 최고 품질</option>
          <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
          <option value="openai/gpt-4o">GPT-4o</option>
          <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
        </select>
      </div>
      <button class="primary big" style="margin-top:14px; width:100%" onclick="saveAIKeyFromUI()">저장하고 시작</button>
      <div class="muted" style="font-size:11px; text-align:center; margin-top:10px">
        * 기본은 Claude Haiku 4.5 — 질문당 약 0.001달러 수준
      </div>
    </div>
  `;
  document.getElementById('ai-model-select').value = getAIModel();
}

function saveAIKeyFromUI() {
  const key = document.getElementById('ai-key-input').value.trim();
  const model = document.getElementById('ai-model-select').value;
  if (!key) { alert('API 키를 입력하세요.'); return; }
  if (!/^sk-or-/.test(key)) {
    if (!confirm('OpenRouter 키 형식(sk-or-…)이 아닙니다. 그래도 저장할까요?')) return;
  }
  setAIKey(key);
  setAIModel(model);
  renderAIChatMessages();
}

async function submitAIChat() {
  const input = document.getElementById('ai-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const sendBtn = document.getElementById('ai-chat-send');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '생각 중...'; }

  // UI: 사용자 메시지 + 로딩
  renderAIChatMessages();
  const body = document.getElementById('ai-chat-body');
  const loadingEl = document.createElement('div');
  loadingEl.className = 'chat-msg chat-assistant loading';
  loadingEl.innerHTML = `<div class="chat-role">🤖 AI 코치</div><div class="chat-bubble">생각 중<span class="dot-anim">...</span></div>`;
  body.appendChild(loadingEl);
  body.scrollTop = body.scrollHeight;

  const result = await askAI(text);

  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '보내기'; }

  if (result.error) {
    aiChatMessages.push({ role: 'assistant', content: '⚠️ ' + result.error });
  }
  renderAIChatMessages();
}

// 짧은 프롬프트 1회 호출 (히스토리 무관, 생각 풍선 등에 사용)
async function callAIRaw(prompt, opts) {
  opts = opts || {};
  const model = getAIModel();
  const payload = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: opts.maxTokens || 60,
    temperature: opts.temperature ?? 0.7
  };

  // 프록시 우선
  try {
    const resp = await fetch('/api/openrouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (e) {}

  // 클라이언트 키 폴백
  const key = getAIKey();
  if (!key) return null;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'PokerMaster Thought' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { return null; }
}

// AI 생각 풍선 — 해당 플레이어가 속으로 하는 추리
async function generateAIThought(aiPlayer, hand) {
  if (!aiPlayer || !hand) return null;
  const pers = aiPlayer.personality;
  const hole = aiPlayer.hole ? aiPlayer.hole.map(c => c.rankStr + c.suitSym).join(' ') : '?';
  const handStr = aiPlayer.hole ? handToString(aiPlayer.hole[0], aiPlayer.hole[1]) : '?';
  const boardStr = hand.board.length ? hand.board.map(c => c.rankStr + c.suitSym).join(' ') : '(프리플롭)';
  const pot = hand.playerStates.reduce((s, p) => s + p.totalBet, 0);

  // 상대 관찰 요약
  const oppLines = [];
  for (const p of hand.playerStates) {
    if (p.id === aiPlayer.id || p.folded) continue;
    const last = p.lastAction ? ` 최근 ${actionPillText(p.lastAction)}` : '';
    oppLines.push(`${p.name}(${p.position})${last}`);
  }

  const history = hand.actions.filter(a => a.type !== 'deal').slice(-6).map(a => {
    const p = hand.playerStates.find(x => x.id === a.playerId);
    return `${p?.name || '?'}: ${shortActPreview(a)}`;
  }).join(' / ');

  const prompt = `포커 1인칭 생각 시뮬레이션.
나는 "${aiPlayer.name}" (${aiPlayer.position}, 성향: ${pers?.name || '일반'}). 내 핸드: ${hole} [${handStr}].
보드: ${boardStr}. 팟: ${pot}.
활성 상대: ${oppLines.join(', ') || '없음'}.
최근 액션: ${history || '(없음)'}.

위 상황에서 내가 속으로 하는 생각을 **30자 이내 한국어 한 문장**으로 써줘. 상대 레인지/카드 추측 또는 다음 액션 의도를 짧게 반영. 따옴표 없이.
예시: "레이즈 잦은데 이번엔 진짜인가?" / "프리플롭 콜만 했으니 미들 페어일듯." / "BTN은 블러프일 가능성 큼"`;

  const reply = await callAIRaw(prompt, { maxTokens: 80, temperature: 0.8 });
  if (!reply) return null;
  // 줄바꿈/따옴표 제거, 너무 길면 자름
  return reply.replace(/[\n"'“”『』「」]/g, '').trim().slice(0, 50);
}

function shortActPreview(a) {
  const m = { fold: '폴드', check: '체크', call: `콜${a.amount ? ' ' + a.amount : ''}`, bet: `베팅${a.amount ? ' ' + a.amount : ''}`, raise: `레이즈${a.amount ? ' ' + a.amount : ''}`, allin: '올인' };
  return m[a.type] || a.type;
}

function quickAskAI(q) {
  const input = document.getElementById('ai-chat-input');
  if (input) input.value = q;
  submitAIChat();
}

function resetAIChat() {
  aiChatMessages = [];
  renderAIChatMessages();
}

// 핸드 바뀔 때 자동으로 대화 초기화 원할 때 호출 가능 (옵션)
function onNewHandMaybeResetChat() {
  if (aiChatMessages.length > 10) aiChatMessages = [];
}
