// 포커 테이블 UI

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function cardEl(card, hidden) {
  const c = el('div', 'card ' + (hidden ? 'back' : (card && card.isRed ? 'red' : 'black')));
  if (!hidden && card) {
    c.innerHTML = `<span class="rank">${card.rankStr}</span><span class="suit">${card.suitSym}</span>`;
  }
  return c;
}

// 좌석 위치 (6맥스 기준, hero는 항상 0번 시트=아래 중앙)
const SEAT_POSITIONS_6 = [
  { x: 50, y: 95 },  // 0 hero 아래 중앙
  { x: 90, y: 80 },  // 1 오른쪽 아래
  { x: 95, y: 40 },  // 2 오른쪽 위
  { x: 70, y: 10 },  // 3 위 오른쪽
  { x: 30, y: 10 },  // 4 위 왼쪽
  { x: 5,  y: 40 }   // 5 왼쪽 위
];
const SEAT_POSITIONS_7 = [
  { x: 50, y: 93 },  // 0 hero 아래
  { x: 88, y: 80 },  // 1
  { x: 95, y: 40 },  // 2
  { x: 75, y: 13 },  // 3 위 오른쪽
  { x: 50, y: 8 },   // 4 맨 위
  { x: 25, y: 13 },  // 5 위 왼쪽
  { x: 5,  y: 40 }   // 6
];
const SEAT_POSITIONS_5 = [
  { x: 50, y: 95 }, { x: 95, y: 60 }, { x: 75, y: 10 }, { x: 25, y: 10 }, { x: 5, y: 60 }
];
const SEAT_POSITIONS_4 = [
  { x: 50, y: 95 }, { x: 95, y: 50 }, { x: 50, y: 10 }, { x: 5, y: 50 }
];
const SEAT_POSITIONS_3 = [
  { x: 50, y: 95 }, { x: 90, y: 20 }, { x: 10, y: 20 }
];
const SEAT_POSITIONS_2 = [
  { x: 50, y: 95 }, { x: 50, y: 10 }
];
function seatPositions(n) {
  return ({ 2: SEAT_POSITIONS_2, 3: SEAT_POSITIONS_3, 4: SEAT_POSITIONS_4, 5: SEAT_POSITIONS_5, 6: SEAT_POSITIONS_6, 7: SEAT_POSITIONS_7 })[n];
}

// 테이블 렌더: hand는 engine.currentHand 또는 스냅샷
function renderTable(rootId, tournament, hand, opts) {
  opts = opts || {};
  const revealOpponents = !!opts.revealOpponents;
  const revealedIds = opts.revealedIds || new Set();
  const clickToReveal = !!opts.clickToReveal;
  const onReveal = opts.onReveal;
  const highlightPlayerId = opts.highlightPlayerId;
  const heroId = tournament ? tournament.players.find(p => p.isHuman).id : opts.heroId;

  const root = document.getElementById(rootId);
  root.innerHTML = '';
  const felt = el('div', 'felt');
  root.appendChild(felt);

  // 보드
  const boardEl = el('div', 'board-area');
  for (let i = 0; i < 5; i++) {
    const c = hand && hand.board[i];
    if (c) boardEl.appendChild(cardEl(c, false));
    else boardEl.appendChild(el('div', 'card placeholder'));
  }
  felt.appendChild(boardEl);

  // 팟 표시
  if (hand) {
    const pot = (hand.playerStates || hand.players || []).reduce((s, p) => s + (p.totalBet || 0), 0);
    const potBox = el('div', 'pot-box', `팟: ${pot.toLocaleString()}`);
    felt.appendChild(potBox);
  }

  // 플레이어 렌더
  const playerList = hand ? (hand.playerStates || hand.players) : (tournament ? tournament.alivePlayers : []);
  if (!playerList || playerList.length === 0) return;

  // 히어로 기준으로 좌석 재정렬
  const heroIdx = playerList.findIndex(p => p.id === heroId);
  const n = playerList.length;
  const positions = seatPositions(n) || SEAT_POSITIONS_6;

  for (let i = 0; i < n; i++) {
    const playerIdx = (heroIdx + i) % n;
    const p = playerList[playerIdx];
    const pos = positions[i];
    const seat = el('div', 'seat');
    seat.style.left = pos.x + '%';
    seat.style.top = pos.y + '%';

    if (p.folded) seat.classList.add('folded');
    if (p.id === highlightPlayerId) seat.classList.add('active');
    if (p.isHuman) seat.classList.add('hero');

    const nameRow = el('div', 'seat-name');
    nameRow.textContent = `${p.name}${p.position ? ' (' + p.position + ')' : ''}`;
    seat.appendChild(nameRow);

    // 딜러 버튼 / SB / BB 칩
    if (p.position === 'BTN' || (n === 2 && p.position === 'SB')) {
      const chip = el('div', 'pos-chip dealer', 'D');
      seat.appendChild(chip);
    } else if (p.position === 'SB') {
      const chip = el('div', 'pos-chip sb', 'SB');
      seat.appendChild(chip);
    } else if (p.position === 'BB') {
      const chip = el('div', 'pos-chip bb', 'BB');
      seat.appendChild(chip);
    }

    const stackRow = el('div', 'seat-stack', `칩: ${(p.stack || 0).toLocaleString()}`);
    seat.appendChild(stackRow);

    const cards = el('div', 'seat-cards');
    const hole = p.hole;
    if (hole && hole.length === 2) {
      const h0 = hole[0] instanceof Card ? hole[0] : new Card(hole[0].rank, hole[0].suit);
      const h1 = hole[1] instanceof Card ? hole[1] : new Card(hole[1].rank, hole[1].suit);
      const show = p.isHuman || revealOpponents || revealedIds.has(p.id);
      cards.appendChild(cardEl(h0, !show));
      cards.appendChild(cardEl(h1, !show));
      // 클릭-공개 모드 (핸드 종료 후, 폴드 안 한 상대만)
      if (clickToReveal && !p.isHuman && !show && !p.folded) {
        cards.classList.add('clickable-cards');
        cards.title = '클릭해서 카드 공개';
        cards.onclick = (e) => {
          e.stopPropagation();
          revealedIds.add(p.id);
          if (typeof onReveal === 'function') onReveal(p.id);
        };
      }
    }
    seat.appendChild(cards);

    // 현재 베팅 칩
    if (p.bet > 0) {
      const betEl = el('div', 'seat-bet', `${p.bet.toLocaleString()}`);
      seat.appendChild(betEl);
    }
    if (p.allIn) {
      const aiEl = el('div', 'seat-allin', '올인');
      seat.appendChild(aiEl);
    }

    // 최근 액션 뱃지 (이전 스트리트의 액션도 유지, 현재 액션자는 제외)
    if (p.lastAction && p.id !== highlightPlayerId) {
      const currentStreet = hand?.street;
      const actionStreet = p.lastAction.street;
      const isOld = currentStreet && actionStreet && actionStreet !== currentStreet && !p.folded;
      let text = actionPillText(p.lastAction);
      if (isOld) text = `${text} · ${streetName(actionStreet)}`;
      const actEl = el('div', 'seat-action action-' + p.lastAction.type + (isOld ? ' old-action' : ''), text);
      seat.appendChild(actEl);
    }

    // 성향 보기 버튼 (AI 상대, 핸드 #10 이후)
    if (!p.isHuman && tournament && tournament.handNumber >= 10) {
      const mainP = tournament.players.find(mp => mp.id === p.id);
      if (mainP && mainP.personality) {
        const btn = document.createElement('button');
        btn.className = 'seat-personality-btn';
        btn.textContent = mainP.personality.emoji + ' 성향';
        btn.title = '이 상대의 플레이 스타일/통계 보기';
        btn.onclick = (e) => { e.stopPropagation(); if (typeof showPersonalityModal === 'function') showPersonalityModal(p.id); };
        seat.appendChild(btn);
      }
    }

    felt.appendChild(seat);
  }
}

function renderHeroInfo(tournament, hand, legal) {
  const root = document.getElementById('hero-info');
  root.innerHTML = '';
  if (!hand) return;
  const hero = tournament.players.find(p => p.isHuman);
  if (!hero) return;
  const state = hand.playerStates.find(p => p.id === hero.id);
  if (!state) return;

  const handStr = handToString(state.hole[0], state.hole[1]);
  const pot = hand.playerStates.reduce((s, p) => s + p.totalBet, 0);
  const heroToCall = state.folded ? 0 : Math.max(0, hand.currentBet - state.bet);
  const cur = tournament.currentPlayer();
  const waitingFor = cur && !cur.isHuman ? cur.name + ' (' + cur.position + ')' : null;

  const info = el('div', 'hero-info-grid');
  info.innerHTML = `
    <div><b>내 핸드:</b> ${handStr}${state.folded ? ' <span class="muted">(폴드됨)</span>' : ''}</div>
    <div><b>포지션:</b> ${state.position}</div>
    <div><b>스택:</b> ${state.stack.toLocaleString()} (${(state.stack / hand.bb).toFixed(1)}BB)</div>
    <div><b>팟:</b> ${pot.toLocaleString()}</div>
    <div><b>콜 필요:</b> ${heroToCall.toLocaleString()}</div>
    <div><b>스트리트:</b> ${streetName(hand.street)}${waitingFor ? ' · <span class="waiting-tag">⏳ ' + waitingFor + ' 대기중</span>' : ''}</div>
  `;
  root.appendChild(info);
}

function streetName(s) {
  return { preflop: '프리플롭', flop: '플롭', turn: '턴', river: '리버' }[s] || s;
}

// 현재 히어로 패 + 보드 조합 강도를 실시간 계산
function heroHandStrength(hole, board) {
  if (!hole || hole.length !== 2) return '-';
  const h0 = hole[0] instanceof Card ? hole[0] : new Card(hole[0].rank, hole[0].suit);
  const h1 = hole[1] instanceof Card ? hole[1] : new Card(hole[1].rank, hole[1].suit);
  const b = (board || []).map(c => c instanceof Card ? c : new Card(c.rank, c.suit));

  // 프리플롭
  if (b.length === 0) {
    const paired = h0.rank === h1.rank;
    const suited = h0.suit === h1.suit;
    if (paired) return `포켓 페어 ${h0.rankStr}${h1.rankStr} (같은 숫자 2장)`;
    const hi = h0.rank > h1.rank ? h0 : h1;
    const lo = h0.rank > h1.rank ? h1 : h0;
    const type = suited ? '수딩(같은 무늬)' : '오프슈트(다른 무늬)';
    return `${hi.rankStr}${lo.rankStr} ${type}`;
  }

  const all = [...b, h0, h1];
  let ev;
  try { ev = all.length === 5 ? evaluate5(all) : evaluate7(all); } catch (e) { return '-'; }

  // 페어 종류 세부화
  let label = ev.name;
  if (ev.rank === 2) { // 원 페어
    const boardRanks = b.map(c => c.rank);
    const topBoard = Math.max(...boardRanks);
    const counts = {};
    for (const c of all) counts[c.rank] = (counts[c.rank] || 0) + 1;
    const pairRank = Object.keys(counts).map(Number).find(r => counts[r] === 2);
    if (pairRank != null) {
      const rs = RANK_CHARS[pairRank - 2];
      if (h0.rank === h1.rank) {
        // 포켓 페어
        if (pairRank > topBoard) label = `오버페어 ${rs}${rs} (보드보다 높은 포켓 페어)`;
        else label = `언더 페어 ${rs}${rs} (보드보다 낮은 포켓 페어)`;
      } else if (pairRank === topBoard) {
        label = `탑 페어 ${rs} (가장 높은 보드 카드와 매치)`;
      } else if (boardRanks.includes(pairRank)) {
        // 내가 보드의 어느 카드와 매치했는지
        const sorted = [...new Set(boardRanks)].sort((a, b) => b - a);
        const idx = sorted.indexOf(pairRank);
        const ord = idx === 1 ? '세컨드' : idx === 2 ? '써드' : '웜';
        label = `${ord} 페어 ${rs} (보드 ${idx + 1}번째 카드와 매치)`;
      }
    }
  } else if (ev.rank === 1) {
    const hi = h0.rank > h1.rank ? h0 : h1;
    label = `하이카드 ${hi.rankStr}`;
  } else if (ev.rank === 3) {
    label = `투 페어`;
  } else if (ev.rank === 4) {
    const counts = {};
    for (const c of all) counts[c.rank] = (counts[c.rank] || 0) + 1;
    const tripRank = Object.keys(counts).map(Number).find(r => counts[r] === 3);
    const hasPocket = h0.rank === h1.rank && h0.rank === tripRank;
    label = hasPocket ? `셋(포켓으로 만든 트립스)` : `트립스(보드와 3매치)`;
  }

  // 드로우 감지 (리버 제외)
  const extras = [];
  if (b.length >= 3 && b.length <= 4) {
    const suitCounts = [0, 0, 0, 0];
    for (const c of all) suitCounts[c.suit]++;
    const maxSuit = Math.max(...suitCounts);
    if (maxSuit === 4 && ev.rank < 6) extras.push('플러시 드로우');

    // 스트레이트 드로우 간이 판정
    const unique = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b);
    // 오픈엔드: 연속 4개
    for (let i = 0; i <= unique.length - 4; i++) {
      if (unique[i + 3] - unique[i] === 3 && ev.rank < 5) {
        extras.push('오픈엔드 스트레이트 드로우');
        break;
      }
    }
  }

  if (extras.length) label += ' + ' + extras.join(' + ');
  return label;
}

function actionPillText(a) {
  if (a.type === 'fold') return '폴드';
  if (a.type === 'check') return '체크';
  if (a.type === 'call') return `콜 ${a.amount.toLocaleString()}`;
  if (a.type === 'bet') return `베팅 ${a.amount.toLocaleString()}`;
  if (a.type === 'raise') return `레이즈 ${a.amount.toLocaleString()}`;
  if (a.type === 'allin') return '올인';
  return a.type;
}

function renderActionButtons(legal) {
  const fold = document.getElementById('btn-fold');
  const cc = document.getElementById('btn-check-call');
  const raise = document.getElementById('btn-raise');
  const allin = document.getElementById('btn-allin');
  const slider = document.getElementById('raise-slider');
  const raiseAmt = document.getElementById('raise-amount');
  const raiseCtrl = document.getElementById('raise-controls');
  const panel = document.getElementById('action-panel');

  // 패널 자체는 항상 유지. 상대 턴일 때만 'inactive' 클래스 추가.
  panel.classList.toggle('inactive', !legal);
  raiseCtrl.style.visibility = 'visible';
  raiseCtrl.style.display = 'flex';

  if (!legal) {
    [fold, cc, raise, allin].forEach(b => b.disabled = true);
    fold.textContent = '폴드';
    cc.textContent = '체크/콜';
    raise.textContent = '레이즈';
    allin.textContent = '올인';
    // 슬라이더/입력 비활성만, 숨기진 않음
    slider.disabled = true;
    raiseAmt.disabled = true;
    return;
  }

  slider.disabled = false;
  raiseAmt.disabled = false;

  fold.disabled = !legal.canFold;
  fold.textContent = '폴드';

  if (legal.canCheck) {
    cc.textContent = '체크';
    cc.disabled = false;
  } else {
    cc.textContent = `콜 ${legal.toCall.toLocaleString()}`;
    cc.disabled = !(legal.canCall || legal.canAllInCall);
  }

  const canRaiseAny = legal.canBet || legal.canRaise;
  raise.disabled = !canRaiseAny;
  raise.textContent = legal.canBet ? '베팅' : '레이즈';

  allin.disabled = legal.myStack <= 0;
  allin.textContent = `올인 ${legal.maxRaise.toLocaleString()}`;

  if (canRaiseAny) {
    const min = Math.min(legal.maxRaise, legal.minRaise);
    const max = legal.maxRaise;
    slider.min = min;
    slider.max = max;
    slider.value = Math.min(max, Math.max(min, Math.floor(legal.potSize > 0 ? legal.potSize + legal.toCall : min)));
    raiseAmt.value = slider.value;
  }
}

function renderTopbar(tournament) {
  const tb = document.getElementById('topbar-info');
  if (!tb) return;
  const bl = tournament.currentBlinds;
  tb.innerHTML = `
    <span>레벨 ${tournament.level + 1} — ${bl.sb}/${bl.bb}</span>
    <span>핸드 #${tournament.handNumber}</span>
    <span>생존 ${tournament.alivePlayers.length}명</span>
  `;
}

function logMessage(msg) {
  const log = document.getElementById('log-entries');
  if (!log) return;
  let cls = 'log-line';
  if (msg.startsWith('---')) cls += ' hand-sep';
  else if (msg.startsWith('💰') || msg.startsWith('팟 ')) cls += ' winner';
  else if (msg.startsWith('🎴') || msg.includes('쇼다운')) cls += ' showdown';
  else if (msg.startsWith('📊') || msg.startsWith('📖')) cls += ' summary';
  else if (msg.startsWith('  ✓')) cls += ' verdict-good';
  else if (msg.startsWith('  △')) cls += ' verdict-ok';
  else if (msg.startsWith('  ✗')) cls += ' verdict-bad';
  const p = el('div', cls);
  const wrapped = (typeof wrapJargonText === 'function') ? wrapJargonText(msg) : msg.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  p.innerHTML = wrapped;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 300) log.removeChild(log.firstChild);
}

// 로그 하단 인라인 AI 채팅
async function submitLogChat() {
  const input = document.getElementById('log-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendLogChatMsg('user', text);
  appendLogChatMsg('assistant', '⏳ 생각 중...', true);

  // askAI가 먼저 /api/openrouter 프록시를 시도하고, 실패하면 클라이언트 키를 시도
  const result = (typeof askAI === 'function') ? await askAI(text) : { error: 'AI 모듈 미로드' };
  removeLogChatLoading();

  if (result.error) {
    // "API 키" 관련 에러라면 → 서버 env도 없고 클라이언트 키도 없음 → 인라인 키 설정 UI
    if (result.error.includes('API 키') || result.error.includes('OPENROUTER_API_KEY')) {
      const box = document.getElementById('log-chat-messages');
      const userMsgs = box.querySelectorAll('.lcm-user');
      if (userMsgs.length) userMsgs[userMsgs.length - 1].remove();
      showInlineKeySetup(text);
      return;
    }
    appendLogChatMsg('assistant', '⚠️ ' + result.error);
  } else {
    appendLogChatMsg('assistant', result.reply);
  }
}

function showInlineKeySetup(pendingQuestion) {
  const box = document.getElementById('log-chat-messages');
  if (!box) return;
  box.innerHTML = '';
  const setup = document.createElement('div');
  setup.className = 'log-chat-setup';
  setup.innerHTML = `
    <div style="color:#ffd97a; font-weight:700; margin-bottom:6px">🔑 AI 코치 사용을 위해 API 키를 입력하세요</div>
    <div style="color:#8b9095; font-size:10px; line-height:1.5; margin-bottom:8px">
      <a href="https://openrouter.ai/keys" target="_blank" style="color:#5a9cdf">openrouter.ai/keys</a>에서 무료 발급.<br>
      키는 이 브라우저에만 저장되며 다른 곳으로 전송되지 않습니다.
    </div>
    <input type="password" id="inline-key-input" placeholder="sk-or-v1-..." style="width:100%; padding:6px 8px; background:#1a1f26; border:1px solid #2d3642; color:#e8e8e8; border-radius:4px; font-family:monospace; font-size:11px; margin-bottom:6px">
    <button class="primary" style="width:100%; padding:6px" onclick="saveInlineKey()">저장하고 계속</button>
  `;
  box.appendChild(setup);
  window._pendingLogChatQuestion = pendingQuestion || '';
  setTimeout(() => document.getElementById('inline-key-input')?.focus(), 50);
}

async function saveInlineKey() {
  const input = document.getElementById('inline-key-input');
  if (!input) return;
  const key = input.value.trim();
  if (!key) { alert('API 키를 입력하세요.'); return; }
  if (typeof setAIKey === 'function') setAIKey(key);
  // 메시지 박스 초기화
  const box = document.getElementById('log-chat-messages');
  if (box) box.innerHTML = '';
  appendLogChatMsg('assistant', '✅ 키가 저장되었습니다! 이제 질문에 답해드릴게요.');
  // 보류된 질문 자동 제출
  const pending = window._pendingLogChatQuestion;
  window._pendingLogChatQuestion = '';
  if (pending) {
    const chatInput = document.getElementById('log-chat-input');
    if (chatInput) chatInput.value = pending;
    await new Promise(r => setTimeout(r, 300));
    submitLogChat();
  }
}

function appendLogChatMsg(role, content, loading) {
  const box = document.getElementById('log-chat-messages');
  if (!box) return;
  const m = document.createElement('div');
  m.className = 'log-chat-msg lcm-' + role + (loading ? ' loading' : '');
  const fmt = (typeof formatChatText === 'function') ? formatChatText(content) : content.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>');
  m.innerHTML = `<b>${role === 'user' ? '나' : '🤖'}</b> ${fmt}`;
  box.appendChild(m);
  box.scrollTop = box.scrollHeight;
}

function removeLogChatLoading() {
  const box = document.getElementById('log-chat-messages');
  if (!box) return;
  const loading = box.querySelector('.log-chat-msg.loading');
  if (loading) loading.remove();
}

function quickLogAsk(q) {
  const input = document.getElementById('log-chat-input');
  if (input) { input.value = q; submitLogChat(); }
}

function describeAction(act, state) {
  const p = state ? state.name : `P${act.playerId}`;
  switch (act.type) {
    case 'fold': return `${p}: 폴드`;
    case 'check': return `${p}: 체크`;
    case 'call': return `${p}: 콜 ${act.amount.toLocaleString()}`;
    case 'bet': return `${p}: 베팅 ${act.amount.toLocaleString()}`;
    case 'raise': return `${p}: 레이즈 ${act.amount.toLocaleString()}`;
    case 'allin': return `${p}: 올인`;
    case 'deal': return `${streetName(act.street)} 공개`;
    default: return JSON.stringify(act);
  }
}
