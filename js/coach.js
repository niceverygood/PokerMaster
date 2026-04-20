// 코칭 / 프로필 / 랭크
// - 사용자의 모든 결정을 기록하고 권장과 비교해 누적 정확도를 관리

const PROFILE_KEY = 'pokermaster_profile';

const RANKS = [
  { key: 'master',   name: '마스터',   color: '#ff5a5a', icon: '👑', minHands: 1000, minAccuracy: 0.90 },
  { key: 'diamond',  name: '다이아',   color: '#5ac0ff', icon: '💎', minHands: 600,  minAccuracy: 0.85 },
  { key: 'platinum', name: '플래티넘', color: '#c0e0ff', icon: '✨', minHands: 300,  minAccuracy: 0.75 },
  { key: 'gold',     name: '골드',     color: '#ffd97a', icon: '🏆', minHands: 150,  minAccuracy: 0.65 },
  { key: 'silver',   name: '실버',     color: '#c0c0c0', icon: '🥈', minHands: 50,   minAccuracy: 0.55 },
  { key: 'bronze',   name: '브론즈',   color: '#cd7f32', icon: '🥉', minHands: 0,    minAccuracy: 0 }
];

function defaultProfile() {
  return {
    createdAt: Date.now(),
    totalHands: 0,
    totalDecisions: 0,
    correctDecisions: 0,
    partialDecisions: 0,
    preflopDecisions: 0,
    preflopCorrect: 0,
    postflopDecisions: 0,
    postflopCorrect: 0,
    tournamentCount: 0,
    tournamentWins: 0,
    totalChipDelta: 0,
    decisionLog: [],   // 최근 200개
    mistakes: {},      // key → count
    recentAccuracy: [],// 최근 20개 토너먼트 정확도 {when, accuracy, hands}
    achievements: [],
    lastUpdated: Date.now()
  };
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return Object.assign(defaultProfile(), JSON.parse(raw));
  } catch (e) {}
  return defaultProfile();
}

function saveProfile(p) {
  p.lastUpdated = Date.now();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function resetProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function calculateAccuracy(p) {
  if (!p || p.totalDecisions === 0) return 0;
  return (p.correctDecisions + p.partialDecisions * 0.5) / p.totalDecisions;
}

function getRank(p) {
  const acc = calculateAccuracy(p);
  for (const r of RANKS) {
    if (p.totalHands >= r.minHands && acc >= r.minAccuracy) return r;
  }
  return RANKS[RANKS.length - 1];
}

function getNextRank(p) {
  const cur = getRank(p);
  const idx = RANKS.findIndex(r => r.key === cur.key);
  return idx === 0 ? null : RANKS[idx - 1];
}

// ============================================================
// 권장 액션 계산 (코칭/복기 공용)
// ============================================================
function computeRecommendation(ctx) {
  const { hole, board, position, stackBB, toCall, pot, activeOpp, bb } = ctx;
  const hand = handToString(hole[0], hole[1]);

  if (board.length === 0) {
    let facing;
    if (toCall <= 0) facing = 'none';
    else if (toCall <= bb) facing = 'none';
    else facing = 'raise';
    const rec = preflopRecommendation(hand, position, stackBB, facing);
    return Object.assign({}, rec, { category: 'preflop', hand, position, stackBB, street: 'preflop' });
  }

  const iters = ctx.iterations || 400;
  const eq = calculateEquity(hole, board, Math.max(1, activeOpp), iters);
  const po = toCall > 0 ? potOdds(toCall, pot) : 0;
  const eqP = (eq.equity * 100).toFixed(1);

  let action, label, reason;
  if (toCall === 0) {
    if (eq.equity > 0.6) { action = 'bet'; label = `밸류 베팅 (약 ${Math.round(pot * 0.66).toLocaleString()})`; reason = `승률 ${eqP}%로 밸류 있음`; }
    else if (eq.equity >= 0.35) { action = 'check'; label = '체크'; reason = `승률 ${eqP}%, 컨트롤 권장`; }
    else { action = 'check'; label = '체크'; reason = `승률 ${eqP}% — 주로 체크`; }
  } else {
    const poP = (po * 100).toFixed(1);
    if (eq.equity > 0.75) { action = 'raise'; label = '레이즈 (밸류)'; reason = `승률 ${eqP}% — 밸류 레이즈`; }
    else if (eq.equity >= po) { action = 'call'; label = '콜'; reason = `승률 ${eqP}% ≥ 필요 ${poP}% → 수익`; }
    else { action = 'fold'; label = '폴드'; reason = `승률 ${eqP}% < 필요 ${poP}% → 손해`; }
  }

  const streetName = board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river';
  return { action, label, reason, equity: eq.equity, potOdds: po, category: 'postflop', hand, position, stackBB, street: streetName };
}

function evaluateDecision(recommended, actual) {
  const r = groupAction(recommended);
  const a = groupAction(actual);
  if (r === a) return { correct: true, partial: false, verdict: 'good' };
  if (r === 'passive' && a === 'passive') return { correct: false, partial: true, verdict: 'ok' };
  if (r === 'aggressive' && a === 'aggressive') return { correct: false, partial: true, verdict: 'ok' };
  return { correct: false, partial: false, verdict: 'bad' };
}

function groupAction(a) {
  if (a === 'fold' || a === 'muck') return 'fold';
  if (a === 'check' || a === 'call') return 'passive';
  return 'aggressive';
}

// 프로필에 결정 1건 기록
function recordDecision(profile, recommended, actualAction) {
  const ev = evaluateDecision(recommended.action, actualAction);
  profile.totalDecisions++;
  if (ev.correct) profile.correctDecisions++;
  else if (ev.partial) profile.partialDecisions++;

  if (recommended.category === 'preflop') {
    profile.preflopDecisions++;
    if (ev.correct) profile.preflopCorrect++;
  } else {
    profile.postflopDecisions++;
    if (ev.correct) profile.postflopCorrect++;
  }

  if (!ev.correct && !ev.partial) {
    const key = `${recommended.category}|${recommended.street || 'pre'}|rec:${recommended.action}|did:${actualAction}`;
    profile.mistakes[key] = (profile.mistakes[key] || 0) + 1;
  }

  profile.decisionLog.push({
    t: Date.now(),
    hand: recommended.hand,
    position: recommended.position,
    stackBB: recommended.stackBB,
    street: recommended.street,
    category: recommended.category,
    recommended: recommended.action,
    actual: actualAction,
    correct: ev.correct,
    partial: ev.partial,
    reason: recommended.reason,
    equity: recommended.equity,
    potOdds: recommended.potOdds
  });
  while (profile.decisionLog.length > 200) profile.decisionLog.shift();
  return ev;
}

// 가장 자주 틀리는 카테고리 상위 N
function topMistakes(profile, n) {
  n = n || 3;
  const entries = Object.entries(profile.mistakes).sort((a, b) => b[1] - a[1]);
  return entries.slice(0, n).map(([k, v]) => {
    const parts = k.split('|');
    return {
      key: k, count: v,
      category: parts[0], street: parts[1],
      recommended: parts[2].replace('rec:', ''),
      actual: parts[3].replace('did:', '')
    };
  });
}

function mistakeToKorean(m) {
  const streetMap = { preflop: '프리플롭', pre: '프리플롭', flop: '플롭', turn: '턴', river: '리버' };
  const actionMap = { fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인', push: '푸시' };
  return `${streetMap[m.street] || m.street}: 권장 ${actionMap[m.recommended] || m.recommended} 인데 ${actionMap[m.actual] || m.actual} (${m.count}회)`;
}

// 한 토너먼트 종료 후 히어로의 모든 결정을 분석해 프로필 업데이트
function analyzeTournamentForProfile(profile, tournamentEntry) {
  const hh = tournamentEntry.handHistory || [];
  const hero = tournamentEntry.players.find(p => p.isHuman);
  if (!hero) return { analyzed: 0 };

  let analyzed = 0;
  const perHand = []; // 토너먼트 내 결정별 요약

  for (const hand of hh) {
    const handDecisions = [];
    // 상태 시뮬레이션 (buildSteps 로직과 유사)
    const state = hand.players.map(p => ({
      id: p.id, name: p.name, isHuman: p.isHuman, position: p.position,
      stack: p.stackStart, bet: 0, totalBet: 0, folded: false, allIn: false,
      hole: p.hole
    }));
    // 블라인드 포스팅
    const sb = state.find(p => p.position === 'SB') || state.find(p => p.position === 'BTN');
    const bb = state.find(p => p.position === 'BB');
    if (sb) { const a = Math.min(sb.stack, hand.sb); sb.stack -= a; sb.bet = a; sb.totalBet = a; }
    if (bb) { const a = Math.min(bb.stack, hand.bb); bb.stack -= a; bb.bet = a; bb.totalBet = a; }

    let board = [];
    for (const act of hand.actions) {
      if (act.type === 'deal') {
        board = (act.board || []).slice();
        for (const p of state) p.bet = 0;
        continue;
      }
      const p = state.find(x => x.id === act.playerId);
      if (!p) continue;
      if (p.isHuman) {
        // 액션 전 스냅샷으로 권장 계산
        const holeCards = p.hole.map(c => new Card(c.rank, c.suit));
        const boardCards = board.map(c => new Card(c.rank, c.suit));
        const activeOpp = state.filter(x => !x.folded && x.id !== p.id).length;
        const toCall = act.toCallBefore || 0;
        const potBefore = act.potBefore || state.reduce((s, x) => s + x.totalBet, 0);
        const stackBefore = p.stack + (act.amount || 0);

        try {
          const rec = computeRecommendation({
            hole: holeCards, board: boardCards,
            position: p.position, stackBB: stackBefore / hand.bb,
            toCall, pot: potBefore,
            activeOpp, bb: hand.bb,
            iterations: 800
          });
          const ev = recordDecision(profile, rec, act.type);
          handDecisions.push({ street: rec.street, hand: rec.hand, recommended: rec.action, actual: act.type, correct: ev.correct, partial: ev.partial });
          analyzed++;
        } catch (e) { /* skip analysis errors */ }
      }

      // 상태 반영
      if (act.type === 'fold') p.folded = true;
      else if (act.type === 'call' || act.type === 'bet' || act.type === 'raise' || act.type === 'allin') {
        p.stack -= act.amount; p.bet += act.amount; p.totalBet += act.amount;
        if (p.stack === 0) p.allIn = true;
      }
    }
    perHand.push({ handNumber: hand.number, decisions: handDecisions });
  }

  profile.totalHands += hh.length;
  profile.tournamentCount++;
  const heroEliminated = hero.eliminated;
  const winner = tournamentEntry.players.filter(p => !p.eliminated).length === 1 && !heroEliminated;
  if (winner) profile.tournamentWins++;

  // 이 토너먼트의 마지막 스택 변화
  const heroPlayer = tournamentEntry.players.find(p => p.isHuman);
  if (heroPlayer && hh.length > 0) {
    const firstHandHero = hh[0].players.find(p => p.isHuman);
    const startStack = firstHandHero ? firstHandHero.stackStart : 0;
    profile.totalChipDelta += (heroPlayer.stackEnd - startStack);
  }

  // 이번 토너먼트 정확도 저장 (최대 20개)
  const totalDec = perHand.reduce((s, h) => s + h.decisions.length, 0);
  const correctDec = perHand.reduce((s, h) => s + h.decisions.filter(d => d.correct).length, 0);
  const partialDec = perHand.reduce((s, h) => s + h.decisions.filter(d => d.partial).length, 0);
  profile.recentAccuracy.push({
    when: Date.now(),
    accuracy: totalDec > 0 ? (correctDec + partialDec * 0.5) / totalDec : 0,
    decisions: totalDec,
    hands: hh.length
  });
  while (profile.recentAccuracy.length > 20) profile.recentAccuracy.shift();

  saveProfile(profile);
  return { analyzed, perHand };
}
