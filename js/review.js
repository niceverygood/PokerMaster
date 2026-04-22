// 복기: 핸드 재생 + 의사 결정 분석

let reviewState = {
  tournamentData: null, // {players, handHistory, startedAt, ...}
  currentHandIdx: 0,
  stepIdx: 0, // 현재 보고 있는 액션 인덱스
  revealedIds: new Set() // 복기 중 클릭으로 공개된 플레이어 ID
};

function listPastTournaments() {
  try {
    const raw = localStorage.getItem('pokermaster_tournaments');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function savePastTournament(entry) {
  const arr = listPastTournaments();
  arr.unshift(entry);
  // 최대 50개 유지
  while (arr.length > 50) arr.pop();
  localStorage.setItem('pokermaster_tournaments', JSON.stringify(arr));
}

function openReview(tournamentData) {
  reviewState.tournamentData = tournamentData;
  reviewState.currentHandIdx = 0;
  reviewState.stepIdx = 0;
  showScreen('review');
  renderReviewTitle();
  renderHandList();
  selectHand(0);
}

function renderReviewTitle() {
  const t = reviewState.tournamentData;
  const title = document.getElementById('review-title');
  const date = new Date(t.startedAt);
  title.textContent = `${date.toLocaleString('ko-KR')} — ${t.handHistory.length}핸드 복기`;
}

function renderHandList() {
  const list = document.getElementById('hand-list');
  list.innerHTML = '';
  const hh = reviewState.tournamentData.handHistory;
  for (let i = 0; i < hh.length; i++) {
    const h = hh[i];
    const hero = h.players.find(p => p.isHuman);
    const item = document.createElement('div');
    item.className = 'hand-list-item';
    if (i === reviewState.currentHandIdx) item.classList.add('selected');
    const handStr = hero ? handToString(new Card(hero.hole[0].rank, hero.hole[0].suit), new Card(hero.hole[1].rank, hero.hole[1].suit)) : '';
    const diff = hero ? (hero.stackEnd - hero.stackStart) : 0;
    const diffStr = diff === 0 ? '±0' : (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString());
    item.innerHTML = `
      <div class="hand-list-title">핸드 #${h.number} — ${hero ? hero.position : ''} ${handStr}</div>
      <div class="hand-list-sub">블라인드 ${h.sb}/${h.bb} · 결과 ${diffStr}</div>
    `;
    item.onclick = () => selectHand(i);
    list.appendChild(item);
  }
}

function selectHand(idx) {
  reviewState.currentHandIdx = idx;
  reviewState.stepIdx = 0;
  reviewState.revealedIds = new Set(); // 새 핸드 선택 시 공개 상태 초기화
  renderHandList();
  replayStep();
}

function replayStep() {
  const hh = reviewState.tournamentData.handHistory;
  if (!hh.length) return;
  const hand = hh[reviewState.currentHandIdx];
  const steps = buildSteps(hand);
  if (reviewState.stepIdx >= steps.length) reviewState.stepIdx = steps.length - 1;
  if (reviewState.stepIdx < 0) reviewState.stepIdx = 0;

  const step = steps[reviewState.stepIdx];
  renderReviewTable(hand, step);
  renderStepInfo(hand, step, steps);
  renderAnalysis(hand, step);
  const scrub = document.getElementById('review-scrubber');
  if (scrub) {
    scrub.max = steps.length - 1;
    scrub.value = reviewState.stepIdx;
  }
}

// 각 액션 시점 + 결과 정리
function buildSteps(hand) {
  const steps = [];
  // 초기 상태
  const initial = {
    kind: 'initial',
    board: [],
    players: hand.players.map(p => ({
      id: p.id, name: p.name, isHuman: p.isHuman, position: p.position,
      stack: p.stackStart, bet: 0, totalBet: 0, folded: false, allIn: false,
      hole: p.hole
    })),
    street: 'preflop'
  };
  steps.push(initial);

  // 블라인드 포스팅 상태로 이동 (accumulative)
  let cur = deepCloneStep(initial);
  const sbP = cur.players.find(p => p.position === 'SB') || cur.players.find(p => p.position === 'BTN');
  const bbP = cur.players.find(p => p.position === 'BB');
  if (sbP) { const a = Math.min(sbP.stack, hand.sb); sbP.stack -= a; sbP.bet = a; sbP.totalBet = a; }
  if (bbP) { const a = Math.min(bbP.stack, hand.bb); bbP.stack -= a; bbP.bet = a; bbP.totalBet = a; }
  cur.kind = 'blinds';
  cur.label = `블라인드 포스팅 (${hand.sb}/${hand.bb})`;
  steps.push(cur);

  for (const act of hand.actions) {
    cur = deepCloneStep(cur);
    if (act.type === 'deal') {
      cur.board = (act.board || []).map(c => ({ rank: c.rank, suit: c.suit }));
      cur.street = act.street;
      for (const p of cur.players) {
        p.bet = 0;
        // lastAction 유지 (스트리트 전환 시 직전 액션 계속 보이게)
      }
      cur.kind = 'deal';
      cur.label = `${streetName(act.street)} 오픈`;
      steps.push(cur);
      continue;
    }
    const p = cur.players.find(x => x.id === act.playerId);
    if (!p) continue;
    cur.kind = 'action';
    cur.action = act;
    cur.actingPlayerId = p.id;
    cur.label = describeAction(act, p);

    if (act.type === 'fold') { p.folded = true; }
    else if (act.type === 'check') { /* no change */ }
    else if (act.type === 'call') {
      p.stack -= act.amount; p.bet += act.amount; p.totalBet += act.amount;
      if (p.stack === 0) p.allIn = true;
    } else if (act.type === 'bet' || act.type === 'raise' || act.type === 'allin') {
      p.stack -= act.amount; p.bet += act.amount; p.totalBet += act.amount;
      if (p.stack === 0) p.allIn = true;
    }
    p.lastAction = { type: act.type, amount: act.amount, street: act.street };
    steps.push(cur);
  }
  // 마지막: 쇼다운 (스택을 최종값으로 업데이트)
  if (hand.allocations) {
    cur = deepCloneStep(cur);
    cur.kind = 'showdown';
    cur.label = '쇼다운';
    cur.allocations = hand.allocations;
    for (const hp of hand.players) {
      const p = cur.players.find(pl => pl.id === hp.id);
      if (p) p.stack = hp.stackEnd;
    }
    steps.push(cur);
  }
  return steps;
}

function deepCloneStep(s) {
  return {
    kind: s.kind, label: s.label, street: s.street,
    board: s.board.map(c => ({ rank: c.rank, suit: c.suit })),
    players: s.players.map(p => ({
      ...p,
      hole: p.hole.map(c => ({ rank: c.rank, suit: c.suit })),
      lastAction: p.lastAction ? { ...p.lastAction } : null
    })),
    action: s.action, actingPlayerId: s.actingPlayerId, allocations: s.allocations
  };
}

function renderReviewTable(hand, step) {
  const players = step.players.map(p => ({
    id: p.id, name: p.name, isHuman: p.isHuman, position: p.position,
    stack: p.stack, bet: p.bet, totalBet: p.totalBet, folded: p.folded, allIn: p.allIn,
    hole: p.hole.map(c => new Card(c.rank, c.suit))
  }));
  const boardCards = step.board.map(c => new Card(c.rank, c.suit));

  const heroId = players.find(p => p.isHuman).id;
  const mockHand = { playerStates: players, board: boardCards, bb: hand.bb };
  // 쇼다운 스텝에서도 자동 공개하지 않고 클릭으로 공개
  const isShowdown = step.kind === 'showdown';
  renderTable('review-table', null, mockHand, {
    heroId,
    revealedIds: reviewState.revealedIds,
    clickToReveal: isShowdown,
    onReveal: () => replayStep(),
    highlightPlayerId: step.actingPlayerId
  });
}

function renderStepInfo(hand, step, steps) {
  const info = document.getElementById('review-step-info');
  const cur = reviewState.stepIdx + 1;
  const total = steps.length;
  info.innerHTML = `<b>${step.label || ''}</b> <span class="muted">(${cur}/${total})</span>`;
}

// 모든 스텝에 대해 분석/설명 표시 (초보 친화적)
function renderAnalysis(hand, step) {
  const box = document.getElementById('review-analysis');
  box.innerHTML = '';
  const hero = step.players.find(p => p.isHuman);

  // 블라인드/딜 등 비-액션 스텝 안내
  if (step.kind === 'blinds') {
    box.innerHTML = `<div class="analysis-section"><h3>블라인드 포스팅</h3>
      <div>SB/BB가 강제로 내야 하는 초기 베팅입니다. 이 돈은 아직 누구 소유가 아니며 팟의 기초가 됩니다.</div>
      <div class="muted">SB: ${hand.sb} · BB: ${hand.bb}</div></div>`;
    return;
  }
  if (step.kind === 'deal') {
    renderDealAnalysis(hand, step, hero);
    return;
  }
  if (step.kind === 'showdown') {
    renderShowdownAnalysis(hand, step);
    return;
  }
  if (step.kind !== 'action') return;

  const act = step.action;
  // 상대방 액션 — 레인지/의미 해설
  if (!hero || act.playerId !== hero.id) {
    renderOpponentAnalysis(hand, step);
    return;
  }

  const hole = hero.hole.map(c => new Card(c.rank, c.suit));
  const board = step.board.map(c => new Card(c.rank, c.suit));
  const handStr = handToString(hole[0], hole[1]);
  const stackBB = (hero.stack + (act.amount || 0)) / hand.bb; // 액션 직전 스택

  const box1 = el('div', 'analysis-section');
  box1.innerHTML = `<h3>내 결정 분석</h3>
    <div>핸드: <b>${handStr}</b> · 포지션: <b>${hero.position}</b> · 스택: <b>${stackBB.toFixed(1)}BB</b></div>
    <div>실제 액션: <b>${describeActionShort(act)}</b></div>`;
  box.appendChild(box1);

  // 액션 전 환경
  const potBefore = act.potBefore || 0;
  const toCall = act.toCallBefore || 0;

  // 활성 상대 수 계산
  const activeOpp = step.players.filter(p => !p.folded && p.id !== hero.id).length;

  if (board.length === 0) {
    // 프리플롭: 차트 기반 권장
    const facing = (toCall > hand.bb) ? 'raise' : (toCall === hand.bb ? 'none' : 'none');
    const rec = preflopRecommendation(handStr, hero.position, stackBB, facing);
    const recBox = el('div', 'analysis-section');
    recBox.innerHTML = `
      <h3>프리플롭 차트 권장</h3>
      <div>권장 액션: <b class="rec-${rec.action}">${rec.label}</b></div>
      <div class="muted">근거: ${rec.reason}</div>
      ${verdict(rec.action, act.type)}
    `;
    box.appendChild(recBox);
  } else {
    // 포스트플롭: 에퀴티 계산
    const eq = calculateEquity(hole, board, Math.max(1, activeOpp), 1500);
    const po = potOdds(toCall, potBefore);
    const eqPct = (eq.equity * 100).toFixed(1);
    const poPct = (po * 100).toFixed(1);

    // 간단한 권장 로직
    let recommendation, recLabel, reason;
    if (toCall === 0) {
      if (eq.equity > 0.6) { recommendation = 'bet'; recLabel = `밸류 베팅 (약 ${Math.round(potBefore * 0.66).toLocaleString()})`; reason = `승률 ${eqPct}%로 밸류 베팅 가능`; }
      else if (eq.equity > 0.4) { recommendation = 'check'; recLabel = '체크'; reason = `승률 ${eqPct}%, 블러프 빈도 조절 필요`; }
      else { recommendation = 'check'; recLabel = '체크'; reason = `승률 ${eqPct}%로 낮음`; }
    } else {
      if (eq.equity > 0.75) { recommendation = 'raise'; recLabel = '레이즈 (밸류)'; reason = `승률 ${eqPct}% — 밸류 레이즈 권장`; }
      else if (eq.equity >= po) { recommendation = 'call'; recLabel = '콜'; reason = `승률 ${eqPct}% ≥ 필요 승률 ${poPct}% — 콜 수익`; }
      else { recommendation = 'fold'; recLabel = '폴드'; reason = `승률 ${eqPct}% < 필요 승률 ${poPct}% — 콜 손해`; }
    }

    const eqBox = el('div', 'analysis-section');
    eqBox.innerHTML = `
      <h3>에퀴티 분석 (상대 ${activeOpp}명 기준)</h3>
      <div class="eq-row"><span>내 승률</span><b>${eqPct}%</b></div>
      <div class="eq-bar"><div class="eq-fill" style="width:${eqPct}%"></div></div>
      <div class="eq-row"><span>팟 오즈 (필요 승률)</span><b>${poPct}%</b></div>
      <div class="eq-row"><span>팟</span><b>${potBefore.toLocaleString()}</b></div>
      <div class="eq-row"><span>콜 금액</span><b>${toCall.toLocaleString()}</b></div>
      <h3>권장</h3>
      <div>권장 액션: <b class="rec-${recommendation}">${recLabel}</b></div>
      <div class="muted">${reason}</div>
      ${verdict(recommendation, act.type)}
    `;
    box.appendChild(eqBox);
  }
}

function renderDealAnalysis(hand, step, hero) {
  const box = document.getElementById('review-analysis');
  const boardStr = step.board.map(c => (c.rank >= 10 ? ['T','J','Q','K','A'][c.rank-10] : c.rank) + ['♠','♥','♦','♣'][c.suit]).join(' ');
  const suits = step.board.map(c => c.suit);
  const ranks = step.board.map(c => c.rank);
  const sameSuit = new Set(suits).size;
  const texture = sameSuit === 1 ? '모노톤(같은 무늬 3장 — 플러시 드로우 많음)' :
                  sameSuit === 3 ? '레인보우(무늬 모두 달라 드로우 적은 드라이 보드)' :
                  '일반 보드(무늬 2개)';
  let heroAnalysis = '';
  if (hero && step.board.length >= 3 && !hero.folded) {
    try {
      const hole = hero.hole.map(c => new Card(c.rank, c.suit));
      const board = step.board.map(c => new Card(c.rank, c.suit));
      const activeOpp = step.players.filter(p => !p.folded && p.id !== hero.id).length;
      const eq = calculateEquity(hole, board, Math.max(1, activeOpp), 1000);
      heroAnalysis = `<div class="eq-row"><span>내 승률(에쿼티)</span><b>${(eq.equity * 100).toFixed(1)}%</b></div>
        <div class="eq-bar"><div class="eq-fill" style="width:${(eq.equity * 100).toFixed(1)}%"></div></div>`;
    } catch (e) {}
  }
  box.innerHTML = `<div class="analysis-section"><h3>${streetName(step.street)} 오픈</h3>
    <div>보드: <b>${boardStr}</b></div>
    <div class="muted">${texture}</div>
    ${heroAnalysis}
  </div>`;
}

function renderOpponentAnalysis(hand, step) {
  const box = document.getElementById('review-analysis');
  const act = step.action;
  const p = step.players.find(x => x.id === act.playerId);
  const actKo = ({ fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인' })[act.type] || act.type;
  let meaning = '';
  if (act.type === 'fold') meaning = '이 핸드를 포기 — 레인지에서 제외됩니다.';
  else if (act.type === 'check') meaning = '체크 — 약한 핸드 or 트랩 가능성. 레인지가 넓어짐.';
  else if (act.type === 'call') meaning = '콜 — 특별히 강하진 않지만 가치 있는 핸드일 가능성 (페어, 드로우, 중간 강도).';
  else if (act.type === 'bet' || act.type === 'raise') {
    const posIsEarly = ['UTG', 'MP', 'HJ'].includes(p?.position);
    meaning = posIsEarly ?
      `${p?.position} 자리에서 공격 — 타이트한 자리라 보통 강한 레인지(예: 99+, AQ+)일 가능성이 높음.` :
      `${p?.position} 자리에서 공격 — 포지션 이점을 이용한 넓은 공격 가능. 블러프 섞여 있을 수 있음.`;
  }
  else if (act.type === 'allin') meaning = '올인 — 강한 밸류(프리미엄) 또는 세미블러프(드로우+폴드 에쿼티). 상대 스택/히스토리 고려 필요.';
  box.innerHTML = `<div class="analysis-section"><h3>상대 액션 · ${p?.name || ''} (${p?.position || ''})</h3>
    <div>액션: <b>${actKo}${act.amount ? ' ' + act.amount.toLocaleString() : ''}</b></div>
    <div class="muted">${meaning}</div>
  </div>`;
}

function renderShowdownAnalysis(hand, step) {
  const box = document.getElementById('review-analysis');
  const survivors = step.players.filter(p => !p.folded);
  const boardCards = step.board.map(c => new Card(c.rank, c.suit));
  const ranked = survivors.map(p => ({
    p, e: evaluate7([...p.hole.map(c => new Card(c.rank, c.suit)), ...boardCards])
  })).sort((a, b) => b.e.score - a.e.score);
  const rows = ranked.map((r, i) => {
    const cards = r.p.hole.map(c => (c.rank >= 10 ? ['T','J','Q','K','A'][c.rank-10] : c.rank) + ['♠','♥','♦','♣'][c.suit]).join(' ');
    const tag = i === 0 ? ' 🏆' : '';
    return `<div class="eq-row"><span>${r.p.name} (${r.p.position}): ${cards}</span><b>${r.e.name}${tag}</b></div>`;
  }).join('');
  box.innerHTML = `<div class="analysis-section"><h3>쇼다운 결과</h3>${rows}</div>`;
}

function describeActionShort(act) {
  if (act.type === 'fold') return '폴드';
  if (act.type === 'check') return '체크';
  if (act.type === 'call') return `콜 ${act.amount.toLocaleString()}`;
  if (act.type === 'bet') return `베팅 ${act.amount.toLocaleString()}`;
  if (act.type === 'raise') return `레이즈 ${act.amount.toLocaleString()}`;
  if (act.type === 'allin') return `올인 ${act.amount.toLocaleString()}`;
  return act.type;
}

function verdict(recommended, actual) {
  // 대략적인 일치도
  const groupRec = groupAction(recommended);
  const groupAct = groupAction(actual);
  if (groupRec === groupAct) return `<div class="verdict good">✓ 일치: 권장과 동일한 액션을 선택했습니다.</div>`;
  // 유사(call vs check, raise vs bet)는 좋게 평가
  if ((groupRec === 'passive' && groupAct === 'passive') || (groupRec === 'aggressive' && groupAct === 'aggressive')) {
    return `<div class="verdict ok">△ 유사: 권장 성향과 비슷한 방향입니다.</div>`;
  }
  return `<div class="verdict bad">✗ 차이: 권장은 <b>${recommended}</b> 계열인데 실제는 <b>${actual}</b>였습니다.</div>`;
}

function groupAction(a) {
  if (a === 'fold') return 'fold';
  if (a === 'check' || a === 'call') return 'passive';
  return 'aggressive';
}

function nextStep() { reviewState.stepIdx++; replayStep(); }
function prevStep() { reviewState.stepIdx--; replayStep(); }
