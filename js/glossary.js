// 포커 용어 사전 — 어려운 단어에 마우스 올리면 상세 설명 표시

const GLOSSARY = {
  // 액션
  '폴드': { detail: '핸드를 포기. 더 이상 베팅에 참여 안 함.' },
  '체크': { detail: '베팅 없이 다음 사람으로 액션 넘김. 앞에 베팅이 없을 때만 가능.' },
  '콜': { detail: '상대의 현재 베팅 금액을 똑같이 맞춰 냄.' },
  '레이즈': { detail: '현재 최고 베팅을 더 올림.' },
  '베팅': { detail: '앞서 아무도 베팅 안 한 상태에서 첫 번째로 금액을 내는 것.' },
  '올인': { detail: '가진 칩 전부를 베팅. 더 이상 추가 액션 불가.' },
  '푸시': { detail: '올인과 동일. 주로 숏스택에서 전액 쇼브.' },
  '쇼브': { detail: '올인(push). Shove.' },
  '림프': { detail: 'BB 금액만 콜. 레이즈 없이 참여 (약한 플레이로 간주됨).' },

  // 포지션
  'UTG': { detail: 'Under The Gun. 프리플롭 첫 액터. 가장 먼저 행동해 타이트하게 플레이.' },
  'HJ': { detail: 'Hijack. CO 바로 앞 포지션. 중간 단계.' },
  'CO': { detail: 'Cutoff. BTN 바로 앞. 비교적 유리한 포지션.' },
  'BTN': { detail: 'Button / 딜러 자리. 가장 유리한 포지션 (제일 나중 행동).' },
  'SB': { detail: 'Small Blind. 작은 강제 베팅. 포스트플롭은 OOP.' },
  'BB': { detail: 'Big Blind. 큰 강제 베팅 = 1 BB. 포스트플롭 OOP.' },
  'OOP': { detail: 'Out Of Position. 상대보다 먼저 액션해야 하는 불리한 위치.' },
  'IP': { detail: 'In Position. 상대보다 나중에 액션하는 유리한 위치.' },

  // 용어
  '3-Bet': { detail: '프리플롭 첫 레이즈 이후의 재레이즈. 강한 밸류 또는 블러프.' },
  '4-Bet': { detail: '3-Bet에 대한 재레이즈. 프리플롭 최상위 레인지.' },
  'C-Bet': { detail: 'Continuation Bet. 프리플롭 레이저가 플롭에서도 베팅해 이니셔티브 유지.' },
  '컨티뉴에이션 벳': { detail: 'C-Bet과 동일. 프리플롭 레이저가 플롭에서 연속 베팅.' },
  '블러프': { detail: '내 핸드는 약하지만 상대를 폴드시키려고 베팅/레이즈.' },
  '세미 블러프': { detail: '아직 미완성이지만 플러시/스트레이트 드로우가 있어 맞으면 이기는 블러프.' },
  '밸류': { detail: '내가 이길 확률이 높을 때 상대에게 더 콜받기 위한 액션.' },
  '밸류 베팅': { detail: '약한 핸드 상대에게 콜받아 팟 키우려는 베팅.' },
  '밸류 레이즈': { detail: '강한 핸드로 팟을 키우기 위한 레이즈.' },
  '이니셔티브': { detail: '프리플롭 마지막 레이저로서의 공격권. 포스트플롭 C-Bet 정당화.' },
  '폴드 에쿼티': { detail: '상대가 폴드할 확률에서 오는 이익. 올인/블러프 성공 가능성.' },

  // 수학/확률
  'EV': { detail: 'Expected Value 기대값. +EV면 장기적 이익, -EV면 손해.' },
  '+EV': { detail: '장기적으로 이익이 나는 선택.' },
  '-EV': { detail: '장기적으로 손해가 나는 선택.' },
  '팟 오즈': { detail: '콜 금액 / (팟 + 콜). 이 비율 이상의 승률이면 콜이 수학적으로 이득.' },
  '필요 승률': { detail: '팟 오즈로 계산된 최소 승률. 내 에쿼티가 이보다 높아야 콜 +EV.' },
  '에쿼티': { detail: '쇼다운까지 갔을 때 이길 확률 (%).' },
  '승률': { detail: '에쿼티 — 쇼다운까지 갔을 때 이길 확률.' },
  '레인지': { detail: '특정 액션을 한 상대가 가질 수 있는 핸드 조합 전체.' },
  '임플라이드 오즈': { detail: '드로우가 완성됐을 때 추가로 받을 수 있는 금액까지 고려한 팟 오즈.' },
  'ICM': { detail: 'Independent Chip Model. 토너먼트 상금 구조를 고려해 칩 가치를 비선형으로 계산.' },
  'SPR': { detail: 'Stack-to-Pot Ratio. 스택/팟 비율. 낮으면 올인 쉽고, 높으면 기술 필요.' },

  // 핸드 표기
  '수딩': { detail: 'Suited. 두 홀카드가 같은 무늬(s 표시).' },
  '오프슈트': { detail: 'Offsuit. 두 홀카드가 다른 무늬(o 표시).' },
  '커넥터': { detail: '연속한 두 랭크 (예: 98, 76). 스트레이트 메이킹 기대.' },
  '수딩 커넥터': { detail: '같은 무늬 + 연속 숫자. 플러시+스트레이트 잠재력.' },
  '갭퍼': { detail: '한 칸 이상 떨어진 커넥터 (예: T8s).' },
  '브로드웨이': { detail: 'T, J, Q, K, A로만 이루어진 핸드.' },
  '페어': { detail: '같은 랭크 2장. 포켓 페어.' },
  '포켓 페어': { detail: '홀카드 2장이 같은 랭크.' },

  // 드로우/플롭 유형
  '드로우': { detail: '미완성 핸드. 추가 카드가 필요.' },
  '플러시 드로우': { detail: '같은 무늬 4장. 1장 더 맞추면 플러시.' },
  '스트레이트 드로우': { detail: '4장 연속에 1장 부족. 맞추면 스트레이트.' },
  '오픈엔드': { detail: 'Open-ended. 양쪽 어느 카드든 스트레이트 가능 (8아웃츠).' },
  '검샷': { detail: 'Gutshot. 스트레이트 인사이드 드로우 (4아웃츠).' },
  '드라이 보드': { detail: '드로우 가능성이 적은 보드 (예: A72 레인보우).' },
  '웻 보드': { detail: '드로우/액션 많은 보드 (연속된 숫자 or 모노톤).' },
  '모노톤': { detail: '보드 3장이 전부 같은 무늬.' },
  '레인보우': { detail: '보드 3장이 전부 다른 무늬.' },

  // 핸드 강도
  '투 페어': { detail: 'Two Pair. 페어 2개.' },
  '트립스': { detail: 'Trips. 같은 랭크 3장 (보드 페어 포함).' },
  '셋': { detail: 'Set. 포켓 페어로 만든 3 of a kind.' },
  '포카드': { detail: 'Four of a Kind. 같은 랭크 4장.' },
  '풀 하우스': { detail: '3 of a kind + 페어.' },
  '스트레이트': { detail: '연속 5장.' },
  '플러시': { detail: '같은 무늬 5장.' },
  '스트레이트 플러시': { detail: '같은 무늬 연속 5장.' },
  '로열 플러시': { detail: '같은 무늬 T-J-Q-K-A.' },

  // 토너먼트 개념
  '숏스택': { detail: '스택이 15BB 이하. 푸시/폴드 위주 플레이.' },
  '빅스택': { detail: '상대적으로 큰 스택. 숏스택을 압박 가능.' },
  '버블': { detail: '상금권 직전. 엄격한 플레이 필요.' },
  '오픈 레이즈': { detail: '모두 폴드된 상태에서 첫 번째로 레이즈하는 것.' },
  '블라인드 방어': { detail: 'SB/BB에서 오픈 레이즈에 대응하는 콜/리레이즈.' },
  '블라인드 스틸': { detail: 'BTN/CO에서 블라인드를 훔치기 위한 넓은 오픈 레이즈.' }
};

// 주어진 텍스트에서 용어를 찾아 <span class="jargon" data-detail="..."> 로 감싸기
// 규칙: 긴 용어부터 매칭, 중복/중첩 방지 (placeholder 사용)
function wrapJargonText(text) {
  if (!text || typeof text !== 'string') return text || '';
  // HTML-safe
  let html = text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const placeholders = [];
  for (const term of terms) {
    const idx = html.indexOf(term);
    if (idx === -1) continue;
    const gloss = GLOSSARY[term];
    const detail = gloss.detail.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const pIdx = placeholders.length;
    const placeholder = `\u0001J${pIdx}\u0002`;
    placeholders.push(`<span class="jargon" data-detail="${detail}">${term}</span>`);
    html = html.split(term).join(placeholder);
  }
  placeholders.forEach((r, i) => {
    html = html.split(`\u0001J${i}\u0002`).join(r);
  });
  return html;
}

// 기존 HTML에 이미 포함된 텍스트 노드만 골라 wrap (이미 HTML이 들어있을 때)
function wrapJargonInElement(el) {
  if (!el) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.classList && parent.classList.contains('jargon')) continue;
    // 버튼/입력/스크립트는 건너뛰기
    const tag = parent.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'SCRIPT' || tag === 'STYLE') continue;
    const wrapped = wrapJargonText(node.nodeValue);
    if (wrapped === node.nodeValue) continue;
    const temp = document.createElement('span');
    temp.innerHTML = wrapped;
    // 풀어서 삽입 (temp span 자체는 제거)
    while (temp.firstChild) parent.insertBefore(temp.firstChild, node);
    parent.removeChild(node);
  }
}
