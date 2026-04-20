// 엔트리 포인트: 메뉴, 게임 루프, 이벤트 연결

let tournament = null;
let awaitingHumanInput = false;
let coachingEnabled = true;
let lastHeroActionStart = 0; // 한 핸드 내 히어로 결정 수집용
let currentHandHeroDecisions = [];
let gameSpeed = localStorage.getItem('pokermaster_speed') || 'normal';
let manualAdvance = localStorage.getItem('pokermaster_manual') === '1';
let waitingForNextHand = false;

// 속도 프리셋: [AI 기본 대기 ms, AI 랜덤 추가 ms, 핸드 사이 대기 ms]
const SPEED_PRESETS = {
  very_slow: { aiBase: 2500, aiRand: 1500, postHand: 5500 },
  slow:      { aiBase: 1400, aiRand: 1000, postHand: 3800 },
  normal:    { aiBase: 900,  aiRand: 700,  postHand: 2800 },
  fast:      { aiBase: 450,  aiRand: 400,  postHand: 1600 },
  instant:   { aiBase: 80,   aiRand: 120,  postHand: 500 }
};
function aiDelay() { const s = SPEED_PRESETS[gameSpeed] || SPEED_PRESETS.normal; return s.aiBase + Math.random() * s.aiRand; }
function postHandDelay() { const s = SPEED_PRESETS[gameSpeed] || SPEED_PRESETS.normal; return s.postHand; }

function showScreen(name) {
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  document.getElementById('screen-' + name).classList.add('active');
}

function randomName(i) {
  const names = ['민준', '서준', '도윤', '시우', '주원', '하준', '지호', '선우', '지안', '예준'];
  return names[i % names.length] + ((Math.floor(i / names.length) > 0) ? (Math.floor(i / names.length) + 1) : '');
}

function startTournament() {
  const opponents = parseInt(document.getElementById('opponents').value) || 5;
  const difficulty = document.getElementById('difficulty').value;
  const startStack = parseInt(document.getElementById('start-stack').value) || 1500;

  const players = [{ name: '나', isHuman: true }];
  for (let i = 0; i < opponents; i++) {
    players.push({ name: randomName(i), isHuman: false, difficulty });
  }

  tournament = new Tournament({ players, startStack, handsPerLevel: 8 });
  currentHandHeroDecisions = [];
  showScreen('game');
  const logEntries = document.getElementById('log-entries');
  if (logEntries) logEntries.innerHTML = '';
  logMessage(`토너먼트 시작 — ${players.length}명 참가, 난이도 ${diffKorean(difficulty)}`);
  startNextHand();
}

function diffKorean(d) {
  return { beginner: '초급', intermediate: '중급', advanced: '고급', master: '마스터' }[d] || d;
}

function startNextHand() {
  if (!tournament) return;
  const hero = tournament.players.find(p => p.isHuman);
  if (hero && hero.eliminated) {
    logMessage('아쉽게도 탈락하셨습니다.');
    finishTournament();
    return;
  }
  if (tournament.isOver()) {
    finishTournament();
    return;
  }
  const hand = tournament.startHand();
  if (!hand) { finishTournament(); return; }
  logMessage(`--- 핸드 #${hand.number} (블라인드 ${hand.sb}/${hand.bb}) ---`);
  renderTopbar(tournament);
  processTurn();
}

function processTurn() {
  if (!tournament || !tournament.currentHand) return;
  const hand = tournament.currentHand;
  if (hand.finished) {
    postHandSettle();
    return;
  }
  // 혼자 남은 경우는 엔진이 자동 처리하지만, showdown 이후 여기로 옴
  if (hand.toActIndex == null) {
    postHandSettle();
    return;
  }

  renderTable('table', tournament, hand, {
    highlightPlayerId: tournament.currentPlayer() ? tournament.currentPlayer().id : null
  });

  const cur = tournament.currentPlayer();
  if (!cur) { postHandSettle(); return; }

  if (cur.isHuman) {
    const legal = tournament.legalOptions();
    renderHeroInfo(tournament, hand, legal);
    renderActionButtons(legal);
    awaitingHumanInput = true;
    if (coachingEnabled) renderCoachingHint(hand, cur, legal);
    else hideCoachingHint();
  } else {
    renderHeroInfo(tournament, hand, null);
    renderActionButtons(null);
    awaitingHumanInput = false;
    hideCoachingHint();
    // AI 대기 (속도 설정)
    setTimeout(() => {
      if (!tournament || !tournament.currentHand) return;
      runAITurn();
    }, aiDelay());
  }
}

function runAITurn() {
  const hand = tournament.currentHand;
  if (!hand || hand.finished) { postHandSettle(); return; }
  const cur = tournament.currentPlayer();
  if (!cur || cur.isHuman) { processTurn(); return; }

  const legal = tournament.legalOptions();
  const activeOpps = hand.playerStates.filter(p => !p.folded && p.id !== cur.id).length;

  const decision = aiDecide({
    hole: cur.hole,
    board: hand.board,
    position: cur.position,
    stack: cur.stack,
    toCall: legal.toCall,
    pot: legal.potSize,
    minRaise: legal.minRaise,
    bigBlind: hand.bb,
    activeOpponents: activeOpps,
    street: hand.street,
    difficulty: cur.difficulty,
    personality: cur.personality
  });

  applyAndContinue(decision);
}

function applyAndContinue(decision) {
  const hand = tournament.currentHand;
  const cur = tournament.currentPlayer();
  const legal = tournament.legalOptions();
  // 액션 유효성 보정
  let act = { type: decision.action, amount: decision.amount };
  if (act.type === 'check' && !legal.canCheck) act = { type: 'call' };
  if (act.type === 'call' && legal.toCall === 0) act = { type: 'check' };
  if (act.type === 'fold' && !legal.canFold) act = legal.canCheck ? { type: 'check' } : { type: 'call' };
  if ((act.type === 'bet' || act.type === 'raise') && !(legal.canBet || legal.canRaise)) {
    act = legal.canCheck ? { type: 'check' } : { type: 'call' };
  }
  // 올인으로 컨버트
  if ((act.type === 'bet' || act.type === 'raise') && act.amount && act.amount >= legal.maxRaise) {
    act = { type: 'allin' };
  }

  // 히어로 결정이면 코칭 권장 대비 기록
  if (cur.isHuman) recordHeroDecisionLive(act.type);

  // applyAction 이후 추가된 액션 전부 로깅 (스트리트 자동 전환된 경우 deal도 포함)
  const before = hand.actions.length;
  tournament.applyAction(act);
  const added = hand.actions.slice(before);
  for (const a of added) {
    const p = a.playerId != null ? hand.playerStates.find(x => x.id === a.playerId) : null;
    logMessage(describeAction(a, p));
  }

  // 다음 턴
  if (hand.finished) {
    postHandSettle();
  } else {
    // 스트리트 변경이 발생했는지 확인 (deal 액션이 추가됐을 수 있음)
    processTurn();
  }
}

function postHandSettle() {
  const hand = tournament.currentHand;
  if (!hand) return;
  // 결과 표시
  renderTable('table', tournament, hand, { revealOpponents: true });

  // 쇼다운: 2명 이상 남아 있고 보드가 깔렸으면 카드 공개 + 상세 승자 설명
  const survivors = hand.playerStates.filter(p => !p.folded);
  const isShowdown = survivors.length >= 2 && hand.board.length > 0;
  if (isShowdown) {
    const boardStr = hand.board.map(c => c.rankStr + c.suitSym).join(' ');
    logMessage('🎴 ═══ 쇼다운 (카드 공개) ═══');
    logMessage(`   보드: ${boardStr}`);
    const ranked = survivors.map(p => ({
      p, eval: evaluate7([...p.hole, ...hand.board])
    })).sort((a, b) => b.eval.score - a.eval.score);
    const topScore = ranked[0].eval.score;
    for (const r of ranked) {
      const cardsStr = r.p.hole.map(c => c.rankStr + c.suitSym).join(' ');
      const bestCards = r.eval.cards.map(c => c.rankStr + c.suitSym).join(' ');
      const tag = r.eval.score === topScore ? ' 🏆 승' : '';
      logMessage(`   ${r.p.name} (${r.p.position}): ${cardsStr} → ${r.eval.name} [${bestCards}]${tag}`);
    }
    // 승자/패자 사이 승리 이유 설명
    const winners = ranked.filter(r => r.eval.score === topScore);
    const losers = ranked.filter(r => r.eval.score !== topScore);
    if (winners.length === 1 && losers.length >= 1) {
      const w = winners[0];
      const l = losers[0];
      logMessage(`   ➜ ${explainWinReason(w, l)}`);
    } else if (winners.length > 1) {
      logMessage(`   ➜ 동일한 족보로 무승부 — 팟을 나눠 가져갑니다.`);
    }
  }

  if (hand.allocations) {
    for (const alloc of hand.allocations) {
      const names = alloc.winners.map(w => `${w.name}(${w.handName})`).join(', ');
      logMessage(`💰 팟 ${alloc.amount.toLocaleString()} → ${names}`);
    }
  }

  // 히어로 결정 상세 해설 로그
  if (currentHandHeroDecisions.length > 0) {
    const total = currentHandHeroDecisions.length;
    const good = currentHandHeroDecisions.filter(d => d.correct).length;
    const ok = currentHandHeroDecisions.filter(d => d.partial && !d.correct).length;
    const bad = total - good - ok;
    logMessage(`📊 내 결정 ${total}회: 정답 ${good} / 유사 ${ok} / 오답 ${bad}`);
    currentHandHeroDecisions.forEach((d, i) => {
      const icon = d.correct ? '✓' : d.partial ? '△' : '✗';
      const verdictLabel = d.correct ? '정답' : d.partial ? '유사' : '오답';
      const rec = d.rec;
      const streetLabel = streetName(rec.street || 'preflop');
      logMessage(`  ${icon} #${i + 1} ${streetLabel} ${rec.hand || ''} (${rec.position || ''}): ${verdictLabel}`);
      logMessage(`     실제: ${shortActionKor(d.actual)} · 권장: ${shortActionKor(rec.action)}`);
      if (rec.category === 'postflop' && typeof rec.equity === 'number') {
        const eqP = (rec.equity * 100).toFixed(1);
        const poP = (rec.potOdds * 100).toFixed(1);
        logMessage(`     승률 ${eqP}% · 필요승률 ${poP}%`);
      }
      logMessage(`     ${explainDecision(d)}`);
    });
  }

  renderTopbar(tournament);

  tournament.endHand();

  // 탈락 메시지
  for (const p of tournament.players) {
    if (p.eliminated && !p._announced) {
      logMessage(`${p.name} 탈락!`);
      p._announced = true;
    }
  }

  // 이번 핸드 히어로 결정 요약 토스트
  showHandSummaryToast();

  if (manualAdvance) {
    // 수동 진행 모드: 계속 버튼 표시
    showContinueButton();
    return;
  }

  setTimeout(() => {
    if (!tournament) return;
    if (tournament.isOver()) finishTournament();
    else startNextHand();
  }, postHandDelay());
}

function showContinueButton() {
  waitingForNextHand = true;
  hideCoachingHint();
  const panel = document.getElementById('action-buttons');
  if (!panel) return;
  // 버튼 영역에 "다음 핸드" 표시
  panel.innerHTML = `
    <button id="btn-continue" class="primary big" style="grid-column: 1 / -1; width: 100%">다음 핸드로 ▶</button>
  `;
  document.getElementById('btn-continue').onclick = () => {
    waitingForNextHand = false;
    // 원래 버튼 복원은 렌더에서 처리
    panel.innerHTML = `
      <button id="btn-fold">폴드</button>
      <button id="btn-check-call">체크</button>
      <button id="btn-raise">레이즈</button>
      <button id="btn-allin">올인</button>
    `;
    wireActionButtons();
    if (!tournament) return;
    if (tournament.isOver()) finishTournament();
    else startNextHand();
  };
}

function wireActionButtons() {
  document.getElementById('btn-fold').onclick = () => { if (awaitingHumanInput) { awaitingHumanInput = false; applyAndContinue({ action: 'fold' }); } };
  document.getElementById('btn-check-call').onclick = () => {
    if (!awaitingHumanInput) return;
    awaitingHumanInput = false;
    const legal = tournament.legalOptions();
    if (legal.canCheck) applyAndContinue({ action: 'check' });
    else applyAndContinue({ action: 'call' });
  };
  document.getElementById('btn-raise').onclick = () => {
    if (!awaitingHumanInput) return;
    const amt = parseInt(document.getElementById('raise-amount').value);
    if (isNaN(amt) || amt <= 0) return;
    awaitingHumanInput = false;
    const legal = tournament.legalOptions();
    const type = legal.canBet ? 'bet' : 'raise';
    applyAndContinue({ action: type, amount: amt });
  };
  document.getElementById('btn-allin').onclick = () => {
    if (!awaitingHumanInput) return;
    awaitingHumanInput = false;
    applyAndContinue({ action: 'allin' });
  };
}

function finishTournament() {
  const survivors = tournament.alivePlayers;
  if (survivors.length === 1) {
    logMessage(`토너먼트 종료 — 우승: ${survivors[0].name}`);
  } else {
    logMessage('토너먼트 종료');
  }

  // 기록 저장
  const entry = {
    startedAt: tournament.startedAt,
    endedAt: Date.now(),
    players: tournament.players.map(p => ({
      id: p.id, name: p.name, isHuman: p.isHuman, difficulty: p.difficulty,
      stackEnd: p.stack, eliminated: p.eliminated
    })),
    handHistory: tournament.handHistory
  };
  savePastTournament(entry);

  // 프로필 정밀 분석 (풀 몬테카를로) + 업적 체크
  try {
    const profile = loadProfile();
    const res = analyzeTournamentForProfile(profile, entry);
    const newAch = (typeof checkAchievements === 'function') ? checkAchievements(profile) : [];
    if (newAch.length) saveProfile(profile);
    const acc = calculateAccuracy(profile);
    const rankNow = getRank(profile);
    logMessage(`학습 업데이트: ${res.analyzed}개 결정 분석됨 · 누적 정답률 ${(acc * 100).toFixed(1)}% · 현재 랭크 ${rankNow.name}`);
    for (const a of newAch) showToast(`${a.icon} 업적 달성!`, `<b>${a.name}</b><br>${a.desc}`, 6000);
  } catch (e) {
    console.warn('profile analysis failed', e);
  }

  // 요약 팝업/메뉴로
  setTimeout(() => {
    if (confirm('토너먼트 종료. 복기 화면으로 이동할까요?')) {
      openReview(entry);
    } else {
      showScreen('menu');
      refreshPastList();
      renderProfileCard();
    }
    tournament = null;
  }, 800);
}

// 복기 화면
function refreshPastList() {
  const root = document.getElementById('past-tournaments');
  root.innerHTML = '';
  const arr = listPastTournaments();
  if (arr.length === 0) {
    root.innerHTML = '<div class="muted">기록된 토너먼트가 없습니다.</div>';
    return;
  }
  for (const t of arr) {
    const hero = t.players.find(p => p.isHuman);
    const rank = t.players.filter(p => !p.eliminated).length === 1 && !hero.eliminated ? '우승' : `${t.players.length - t.players.filter(p => p.eliminated && p.id !== hero.id).length}위 후보`;
    const date = new Date(t.startedAt);
    const item = el('div', 'tournament-item');
    item.innerHTML = `
      <div><b>${date.toLocaleString('ko-KR')}</b></div>
      <div class="muted">핸드 ${t.handHistory.length}개 · 난이도 ${diffKorean(t.players.find(p => !p.isHuman)?.difficulty || 'intermediate')} · 최종 스택 ${hero ? hero.stackEnd.toLocaleString() : '?'}</div>
    `;
    item.onclick = () => openReview(t);
    root.appendChild(item);
  }
}

// DOM 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').onclick = startTournament;
  const tb = document.getElementById('training-btn');
  if (tb) tb.onclick = () => openTraining();
  wireActionButtons();

  // 속도 컨트롤
  const speedSel = document.getElementById('game-speed');
  if (speedSel) {
    speedSel.value = gameSpeed;
    speedSel.addEventListener('change', () => {
      gameSpeed = speedSel.value;
      localStorage.setItem('pokermaster_speed', gameSpeed);
    });
  }
  const manual = document.getElementById('manual-advance');
  if (manual) {
    manual.checked = manualAdvance;
    manual.addEventListener('change', () => {
      manualAdvance = manual.checked;
      localStorage.setItem('pokermaster_manual', manualAdvance ? '1' : '0');
    });
  }

  // 레이즈 슬라이더와 input 연동
  const slider = document.getElementById('raise-slider');
  const raiseAmt = document.getElementById('raise-amount');
  slider.oninput = () => { raiseAmt.value = slider.value; };
  raiseAmt.oninput = () => { slider.value = raiseAmt.value; };

  // 프리셋
  document.getElementById('btn-bet-min').onclick = () => setBet('min');
  document.getElementById('btn-bet-half').onclick = () => setBet('half');
  document.getElementById('btn-bet-pot').onclick = () => setBet('pot');
  document.getElementById('btn-bet-2x').onclick = () => setBet('2x');

  document.getElementById('quit-btn').onclick = () => {
    if (confirm('토너먼트를 포기하고 메뉴로 돌아갈까요?')) {
      tournament = null;
      showScreen('menu');
      refreshPastList();
      renderProfileCard();
    }
  };

  document.getElementById('back-to-menu').onclick = () => {
    showScreen('menu');
    refreshPastList();
    renderProfileCard();
  };
  document.getElementById('review-prev').onclick = () => prevStep();
  document.getElementById('review-next').onclick = () => nextStep();
  document.getElementById('review-hand-prev').onclick = () => {
    if (reviewState.currentHandIdx > 0) selectHand(reviewState.currentHandIdx - 1);
  };
  document.getElementById('review-hand-next').onclick = () => {
    const len = reviewState.tournamentData.handHistory.length;
    if (reviewState.currentHandIdx < len - 1) selectHand(reviewState.currentHandIdx + 1);
  };
  const scrub = document.getElementById('review-scrubber');
  if (scrub) scrub.oninput = () => { reviewState.stepIdx = parseInt(scrub.value); replayStep(); };

  refreshPastList();
  renderProfileCard();

  const coachToggle = document.getElementById('coaching-toggle');
  if (coachToggle) {
    coachToggle.checked = coachingEnabled;
    coachToggle.addEventListener('change', () => { coachingEnabled = coachToggle.checked; });
  }
});

// ============================================================
// 코칭 / 프로필 통합
// ============================================================
function renderCoachingHint(hand, heroState, legal) {
  const bar = document.getElementById('coaching-bar');
  if (!bar) return;
  try {
    const activeOpp = hand.playerStates.filter(p => !p.folded && p.id !== heroState.id).length;
    const rec = computeRecommendation({
      hole: heroState.hole,
      board: hand.board,
      position: heroState.position,
      stackBB: heroState.stack / hand.bb,
      toCall: legal.toCall,
      pot: legal.potSize,
      activeOpp,
      bb: hand.bb,
      iterations: 300
    });
    let bodyHtml = `<span class="coach-title">💡 코칭</span>`;
    bodyHtml += `<span class="coach-rec rec-${rec.action}">${rec.label}</span>`;
    if (typeof rec.equity === 'number') {
      const eqP = (rec.equity * 100).toFixed(1);
      bodyHtml += ` <span class="coach-bar"><span class="coach-bar-fill" style="width:${eqP}%"></span></span>`;
      bodyHtml += `<span>승률 ${eqP}%</span>`;
      if (rec.potOdds > 0) bodyHtml += ` · 필요 ${(rec.potOdds * 100).toFixed(1)}%`;
    }
    bodyHtml += `<span class="coach-reason">${rec.reason || ''}</span>`;
    bodyHtml += ` <button class="coach-ai-btn" onclick="openAIChatWithQuestion('지금 이 상황을 분석해줘. 최선의 액션과 그 이유를 알려줘.')" title="AI 코치에게 물어보기">🤖 AI 분석</button>`;
    bar.innerHTML = bodyHtml;
    bar.classList.add('visible');

    // 히어로 결정 대기 상태 컨텍스트 저장 → applyAndContinue 에서 기록
    lastHeroActionStart = Date.now();
    window._pendingHeroRec = rec;
  } catch (e) {
    bar.classList.remove('visible');
  }
}

function hideCoachingHint() {
  // 더 이상 완전히 숨기지 않고 "대기 중" 표시로 전환
  renderCoachingIdle();
}

function renderCoachingIdle() {
  const bar = document.getElementById('coaching-bar');
  if (!bar) return;
  let waitText = '상대 턴 대기 중';
  try {
    const cur = tournament?.currentPlayer();
    if (cur && !cur.isHuman) waitText = `${cur.name} (${cur.position}) 플레이 중...`;
  } catch (e) {}
  bar.innerHTML = `
    <span class="coach-title">💡 코칭</span>
    <span class="coach-reason">${waitText}</span>
    <button class="coach-ai-btn" onclick="openAIChatWithQuestion('지금 이 상황을 분석해줘. 내 차례가 오면 뭘 고려해야 할까?')" title="AI 코치에게 물어보기">🤖 AI 분석</button>
  `;
  bar.classList.add('visible');
}

function showToast(title, bodyHtml, durationMs) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${bodyHtml}</div>`;
  host.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, durationMs || 4500);
}

// 히어로 결정 시점 기록 → 핸드 종료 시 요약
function recordHeroDecisionLive(actionType) {
  const rec = window._pendingHeroRec;
  if (!rec) return;
  const ev = evaluateDecision(rec.action, actionType);
  currentHandHeroDecisions.push({
    rec, actual: actionType, verdict: ev.verdict, correct: ev.correct, partial: ev.partial
  });
  window._pendingHeroRec = null;
}

function explainWinReason(winnerObj, loserObj) {
  const rankKo = ['', '하이카드', '원 페어', '투 페어', '트립스', '스트레이트', '플러시', '풀 하우스', '포카드', '스트레이트/로열 플러시'];
  const we = winnerObj.eval, le = loserObj.eval;
  const wName = winnerObj.p.name, lName = loserObj.p.name;
  if (we.rank > le.rank) {
    return `${wName} 승! 포커 족보에서 <b>${rankKo[we.rank]}</b>이(가) <b>${rankKo[le.rank]}</b>보다 위라 이김.`;
  }
  const wCards = we.cards.map(c => c.rank).sort((a, b) => b - a);
  const lCards = le.cards.map(c => c.rank).sort((a, b) => b - a);
  const rc = r => RANK_CHARS[r - 2];
  for (let i = 0; i < Math.min(wCards.length, lCards.length); i++) {
    if (wCards[i] !== lCards[i]) {
      return `${wName} 승! 같은 <b>${rankKo[we.rank]}</b>지만 더 높은 카드 <b>${rc(wCards[i])}</b>가 상대 <b>${rc(lCards[i])}</b>를 이김(킥커 승).`;
    }
  }
  return `${wName} 승! 같은 ${rankKo[we.rank]}로 더 강한 조합.`;
}

function shortActionKor(a) {
  return ({ fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인', push: '푸시' })[a] || a || '-';
}

// 개별 결정의 자세한 설명
function explainDecision(d) {
  const rec = d.rec;
  const recAct = rec.action;
  const actualAct = d.actual;
  if (d.correct) {
    if (rec.category === 'preflop') {
      return `✅ 이유: ${rec.reason}. 차트가 권장한 ${shortActionKor(recAct)}을(를) 정확히 선택.`;
    }
    const eqP = (rec.equity * 100).toFixed(1);
    return `✅ 이유: 수학적으로 +EV. 승률 ${eqP}%가 상황에 맞는 ${shortActionKor(recAct)}을(를) 정당화.`;
  }

  // 오답 또는 유사 — 왜 틀렸는지 구체적 설명
  if (rec.category === 'preflop') {
    if (recAct === 'fold' && (actualAct === 'call' || actualAct === 'raise' || actualAct === 'allin')) {
      return `⚠️ ${rec.position} ${Math.round(rec.stackBB)}BB에서 이 핸드는 레인지 밖. 플레이하면 OOP 또는 커버되지 않는 스팟이 많아 장기적으로 칩 손실.`;
    }
    if ((recAct === 'raise' || recAct === 'push') && actualAct === 'fold') {
      return `⚠️ 플레이 가능한 프리미엄/레인지 핸드를 폴드. 블라인드 방어 및 포지션 이점을 놓침.`;
    }
    if ((recAct === 'raise' || recAct === 'push') && actualAct === 'call') {
      return `⚠️ 콜 대신 레이즈가 더 강한 선택. 이니셔티브를 잡고 폴드 에쿼티를 확보할 기회.`;
    }
    if (recAct === 'call' && actualAct === 'fold') {
      return `⚠️ 팟 오즈/포지션상 콜이 가능한 스팟을 포기. 수익 기회 놓침.`;
    }
    if (recAct === 'call' && (actualAct === 'raise' || actualAct === 'allin')) {
      return `⚠️ 과한 공격. 3-Bet/올인 레인지가 아닌 핸드로 리레이즈 → 상대 밸류에 잡힐 위험.`;
    }
    return `⚠️ 근거: ${rec.reason}`;
  }

  // 포스트플롭
  const eqP = (rec.equity * 100).toFixed(1);
  const poP = (rec.potOdds * 100).toFixed(1);
  if (recAct === 'fold' && (actualAct === 'call' || actualAct === 'raise' || actualAct === 'allin')) {
    return `⚠️ 승률 ${eqP}% < 필요승률 ${poP}%. 콜은 장기적 -EV. 폴드가 수학적 정답.`;
  }
  if (recAct === 'call' && actualAct === 'fold') {
    return `⚠️ 승률 ${eqP}% ≥ 필요승률 ${poP}%. 팟 오즈상 콜이 +EV인 스팟을 놓침.`;
  }
  if ((recAct === 'raise' || recAct === 'bet') && actualAct === 'fold') {
    return `⚠️ 승률 ${eqP}%로 밸류 베팅/레이즈가 정답. 폴드는 과소평가.`;
  }
  if ((recAct === 'raise' || recAct === 'bet') && (actualAct === 'call' || actualAct === 'check')) {
    return `⚠️ 승률 ${eqP}%면 밸류 추출을 위해 공격적 액션이 필요. 체크/콜은 밸류를 흘림.`;
  }
  if ((recAct === 'check') && (actualAct === 'bet' || actualAct === 'raise')) {
    return `⚠️ 승률 ${eqP}%는 밸류 베팅에 약하고, 베팅 받았을 때 도망가기도 어려움. 체크가 무난.`;
  }
  return `⚠️ 근거: ${rec.reason}`;
}

function showHandSummaryToast() {
  if (currentHandHeroDecisions.length === 0) return;
  const total = currentHandHeroDecisions.length;
  const good = currentHandHeroDecisions.filter(d => d.correct).length;
  const ok = currentHandHeroDecisions.filter(d => d.partial).length;
  const bad = total - good - ok;

  let body = `결정 ${total}회 · <span class="stat-ok">정답 ${good}</span>`;
  if (ok > 0) body += ` · 유사 ${ok}`;
  if (bad > 0) body += ` · <span class="stat-bad">오답 ${bad}</span>`;

  // 오답 중 첫 케이스 상세
  const firstBad = currentHandHeroDecisions.find(d => !d.correct && !d.partial);
  if (firstBad) {
    body += `<br><span style="color:#ffd97a">팁:</span> ${firstBad.rec.street || ''} ${firstBad.rec.hand || ''} — ${firstBad.rec.reason || ''}`;
  }
  showToast('핸드 요약', body);
  currentHandHeroDecisions = [];
}

// 프로필 대시보드 렌더
function renderProfileCard() {
  const root = document.getElementById('profile-card');
  if (!root) return;
  const profile = loadProfile();
  const rank = getRank(profile);
  const next = getNextRank(profile);
  const acc = calculateAccuracy(profile);
  const preAcc = profile.preflopDecisions > 0 ? profile.preflopCorrect / profile.preflopDecisions : 0;
  const postAcc = profile.postflopDecisions > 0 ? profile.postflopCorrect / profile.postflopDecisions : 0;

  let nextHtml = '';
  if (next) {
    const handsToNext = Math.max(0, next.minHands - profile.totalHands);
    const accNeeded = next.minAccuracy;
    const handsProgress = Math.min(1, profile.totalHands / next.minHands);
    const accProgress = Math.min(1, acc / next.minAccuracy);
    const overallProgress = Math.min(handsProgress, accProgress);
    nextHtml = `
      <div class="next-rank">
        <div>다음: <b>${next.name}</b></div>
        <div class="progress"><div class="progress-bar" style="width:${(overallProgress * 100).toFixed(0)}%"></div></div>
        <div style="margin-top:4px; font-size:11px">핸드 ${profile.totalHands}/${next.minHands} · 정답률 ${(acc * 100).toFixed(0)}/${(accNeeded * 100).toFixed(0)}%</div>
      </div>`;
  } else {
    nextHtml = `<div class="next-rank">최고 등급 도달!</div>`;
  }

  const topM = topMistakes(profile, 3);
  const mistakesHtml = topM.length > 0 ?
    `<div class="profile-mistakes"><h3>자주 틀리는 유형</h3>${topM.map(m => `<div class="mistake-row">${mistakeToKorean(m)}</div>`).join('')}</div>` :
    '';

  if (profile.totalDecisions === 0) {
    root.innerHTML = `
      <div class="profile-header">
        <div class="rank-badge" style="border-color:${rank.color}; color:${rank.color}">${rank.icon}</div>
        <div class="rank-info">
          <div class="rank-name" style="color:${rank.color}">${rank.name}</div>
          <div class="rank-hands">첫 토너먼트를 시작해보세요!</div>
        </div>
      </div>
      <div class="profile-empty">게임을 플레이하면 여기에 실력 분석이 표시됩니다.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="profile-header">
      <div class="rank-badge" style="border-color:${rank.color}; color:${rank.color}">${rank.icon}</div>
      <div class="rank-info">
        <div class="rank-name" style="color:${rank.color}">${rank.name}</div>
        <div class="rank-hands">누적 ${profile.totalHands}핸드 · 토너먼트 ${profile.tournamentCount}회 (${profile.tournamentWins}승)</div>
      </div>
      ${nextHtml}
    </div>
    <div class="profile-stats">
      <div class="stat-cell"><div class="stat-value">${(acc * 100).toFixed(0)}%</div><div class="stat-label">전체 정답률</div></div>
      <div class="stat-cell"><div class="stat-value">${(preAcc * 100).toFixed(0)}%</div><div class="stat-label">프리플롭</div></div>
      <div class="stat-cell"><div class="stat-value">${(postAcc * 100).toFixed(0)}%</div><div class="stat-label">포스트플롭</div></div>
      <div class="stat-cell"><div class="stat-value">${profile.totalChipDelta >= 0 ? '+' : ''}${profile.totalChipDelta.toLocaleString()}</div><div class="stat-label">누적 칩</div></div>
    </div>
    ${mistakesHtml}`;
}

// 성향 모달
function showPersonalityModal(playerId) {
  if (!tournament) return;
  const player = tournament.players.find(p => p.id === playerId);
  if (!player || !player.personality) return;
  const pers = player.personality;
  const st = player.stats || {};
  const hp = st.handsPlayed || 0;
  const vpip = hp > 0 ? Math.round(st.vpipHands / hp * 100) : 0;
  const pfr = hp > 0 ? Math.round(st.pfrHands / hp * 100) : 0;
  const af = (st.passiveActions > 0) ? (st.aggressiveActions / st.passiveActions).toFixed(1) : (st.aggressiveActions > 0 ? '∞' : '-');

  closePersonalityModal();
  const wrap = document.createElement('div');
  wrap.id = 'personality-modal-wrap';
  wrap.innerHTML = `
    <div class="pm-backdrop" onclick="closePersonalityModal()"></div>
    <div class="pm-modal">
      <button class="pm-close" onclick="closePersonalityModal()">✕</button>
      <div class="pm-header">
        <div class="pm-icon">${pers.emoji}</div>
        <div class="pm-meta">
          <div class="pm-name">${player.name} · ${player.position || ''}</div>
          <div class="pm-type">${pers.name}</div>
          <div class="pm-short">${pers.short}</div>
        </div>
      </div>
      <div class="pm-desc">${pers.desc}</div>
      <div class="pm-advice"><b>공략 팁:</b> ${pers.adviceTip}</div>
      <div class="pm-stats">
        <div class="pm-stat"><div class="pm-stat-value">${vpip}%</div><div class="pm-stat-label">VPIP</div></div>
        <div class="pm-stat"><div class="pm-stat-value">${pfr}%</div><div class="pm-stat-label">PFR</div></div>
        <div class="pm-stat"><div class="pm-stat-value">${af}</div><div class="pm-stat-label">AF</div></div>
        <div class="pm-stat"><div class="pm-stat-value">${hp}</div><div class="pm-stat-label">핸드</div></div>
      </div>
      <div class="pm-hint">
        <div><b>VPIP</b>: 자발적으로 팟에 들어간 비율. 20~25% 타이트 / 30%+ 루즈.</div>
        <div><b>PFR</b>: 프리플롭 레이즈 비율. VPIP에 근접할수록 공격적.</div>
        <div><b>AF</b>: 공격성 = (베팅+레이즈) / (콜+체크). 2.0 이상이면 공격적.</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

function closePersonalityModal() {
  const w = document.getElementById('personality-modal-wrap');
  if (w) w.remove();
}

function setBet(kind) {
  if (!tournament) return;
  const legal = tournament.legalOptions();
  const pot = legal.potSize;
  let amt;
  if (kind === 'min') amt = legal.minRaise;
  else if (kind === 'half') amt = Math.max(legal.minRaise, legal.toCall + Math.floor(pot * 0.5));
  else if (kind === 'pot') amt = Math.max(legal.minRaise, legal.toCall + pot);
  else if (kind === '2x') amt = Math.max(legal.minRaise, legal.toCall + pot * 2);
  amt = Math.min(amt, legal.maxRaise);
  document.getElementById('raise-amount').value = amt;
  document.getElementById('raise-slider').value = amt;
}
