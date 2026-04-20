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
  return ({ 2: SEAT_POSITIONS_2, 3: SEAT_POSITIONS_3, 4: SEAT_POSITIONS_4, 5: SEAT_POSITIONS_5, 6: SEAT_POSITIONS_6 })[n];
}

// 테이블 렌더: hand는 engine.currentHand 또는 스냅샷
function renderTable(rootId, tournament, hand, opts) {
  opts = opts || {};
  const revealOpponents = !!opts.revealOpponents;
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

    const stackRow = el('div', 'seat-stack', `칩: ${(p.stack || 0).toLocaleString()}`);
    seat.appendChild(stackRow);

    const cards = el('div', 'seat-cards');
    const hole = p.hole;
    if (hole && hole.length === 2) {
      const h0 = hole[0] instanceof Card ? hole[0] : new Card(hole[0].rank, hole[0].suit);
      const h1 = hole[1] instanceof Card ? hole[1] : new Card(hole[1].rank, hole[1].suit);
      const show = p.isHuman || revealOpponents;
      cards.appendChild(cardEl(h0, !show));
      cards.appendChild(cardEl(h1, !show));
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

    // 이번 스트리트 최근 액션 뱃지
    if (p.lastAction) {
      const actEl = el('div', 'seat-action action-' + p.lastAction.type, actionPillText(p.lastAction));
      seat.appendChild(actEl);
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
  else if (msg.startsWith('팟 ')) cls += ' winner';
  const p = el('div', cls, msg);
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 200) log.removeChild(log.firstChild);
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
