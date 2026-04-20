// AI 성향 정의
const PERSONALITIES = [
  { id: 'tag',     emoji: '🎯', name: '타이트-어그레시브 (TAG)', short: '타이트+공격적', desc: '타이트한 레인지로 공격적으로 플레이. 표준적인 +EV 스타일이에요. 블러프보다는 밸류 위주.', rangeMul: 1.0, aggroMul: 1.05, foldMul: 1.0, bluffFreq: 0.15, adviceTip: '이 상대는 베팅할 때 대부분 강한 핸드예요. 마진 핸드로는 과감히 폴드하세요.' },
  { id: 'lag',     emoji: '🔥', name: '루즈-어그레시브 (LAG)', short: '루즈+공격적', desc: '넓은 레인지로 공격적으로 플레이. 블러프 많고 예측이 어려워요.', rangeMul: 1.4, aggroMul: 1.3, foldMul: 1.0, bluffFreq: 0.38, adviceTip: '이 상대는 블러프가 많으니 괜찮은 핸드면 콜다운 해도 좋아요.' },
  { id: 'rock',    emoji: '🗿', name: '락 (Rock)', short: '타이트+수동', desc: '극도로 타이트하고 수동적. 강한 핸드만 플레이, 베팅 나오면 대개 폴드.', rangeMul: 0.55, aggroMul: 0.7, foldMul: 1.4, bluffFreq: 0.02, adviceTip: '블러프가 잘 먹히는 상대. 레이즈로 압박하면 쉽게 폴드해요.' },
  { id: 'station', emoji: '📞', name: '콜링스테이션', short: '루즈+수동', desc: '아무 핸드로나 콜. 레이즈는 드물고 블러프가 잘 안 먹혀요.', rangeMul: 1.5, aggroMul: 0.55, foldMul: 0.55, bluffFreq: 0.03, adviceTip: '블러프 금지! 강한 핸드로는 얇게라도 밸류 베팅 계속 하세요.' },
  { id: 'maniac',  emoji: '🤪', name: '매니악', short: '초루즈+초공격', desc: '아무 핸드로 올인/레이즈. 폴드를 거의 안 함. 분산 심함.', rangeMul: 1.9, aggroMul: 1.7, foldMul: 0.85, bluffFreq: 0.5, adviceTip: '좋은 핸드로 최대한 유도해서 큰 팟 받아내세요. 기다림의 미학.' },
  { id: 'nit',     emoji: '🧊', name: '닛 (Nit)', short: '프리미엄만', desc: 'QQ+, AK 같은 최상위 핸드만 플레이. 블러프는 전혀 하지 않아요.', rangeMul: 0.45, aggroMul: 0.8, foldMul: 1.6, bluffFreq: 0, adviceTip: '이 상대가 레이즈하면 대부분 프리미엄. 마진 핸드는 과감히 접으세요.' }
];

function getPersonalityById(id) { return PERSONALITIES.find(p => p.id === id) || PERSONALITIES[0]; }

function assignPersonality(difficulty) {
  let pool;
  if (difficulty === 'beginner')        pool = ['station', 'maniac', 'station', 'rock', 'lag'];
  else if (difficulty === 'intermediate') pool = ['tag', 'lag', 'rock', 'station', 'nit', 'maniac'];
  else if (difficulty === 'advanced')    pool = ['tag', 'lag', 'tag', 'lag', 'rock', 'nit'];
  else                                    pool = ['tag', 'lag', 'tag']; // master
  const id = pool[Math.floor(Math.random() * pool.length)];
  return getPersonalityById(id);
}

// 난이도별 AI 의사 결정
// ctx: { hole, board, position, stack, toCall, pot, minRaise, bigBlind, activeOpponents, street, difficulty, personality }

function aiDecide(ctx) {
  const { hole, board, toCall, pot, stack, bigBlind, activeOpponents, difficulty } = ctx;
  const stackBB = stack / bigBlind;
  const isPreflop = board.length === 0;

  // 효과 스택이 15BB 이하 & 프리플롭이면 숏스택 푸시/폴드 우선
  if (isPreflop && stackBB <= 15 && difficulty !== 'beginner') {
    return aiShortStackPreflop(ctx);
  }

  if (isPreflop) return aiPreflop(ctx);
  return aiPostflop(ctx);
}

function aiShortStackPreflop(ctx) {
  const { hole, position, stack, toCall, pot, bigBlind, difficulty } = ctx;
  const stackBB = stack / bigBlind;
  const pushRange = getPushRange(position, stackBB);
  const hand = handToString(hole[0], hole[1]);

  // 레인지 느슨함/엄격함 조절
  const loosen = { beginner: 1.2, intermediate: 1.05, advanced: 1.0, master: 0.95 }[difficulty];
  const threshold = loosen * 0.5;

  const inRange = pushRange.has(hand);
  const strongHand = handScore(hand) / 110 > threshold;

  if (toCall === 0) {
    if (inRange || strongHand) {
      return { action: 'raise', amount: Math.min(stack, stack) }; // 올인
    }
    return { action: 'fold' };
  }
  // 누군가 레이즈 / 쇼브한 상태
  const tight = tightenRange(pushRange, difficulty === 'master' ? 0.6 : 0.75);
  if (tight.has(hand)) {
    // 콜 (리쉬브는 단순화)
    if (toCall >= stack) return { action: 'call' };
    return { action: 'call' };
  }
  return { action: 'fold' };
}

function aiPreflop(ctx) {
  const { hole, position, stack, toCall, pot, bigBlind, difficulty } = ctx;
  const hand = handToString(hole[0], hole[1]);
  const openRange = OPEN_RANGES[position] || OPEN_RANGES.BTN;

  // 난이도별 레인지 조정
  let activeRange = openRange;
  if (difficulty === 'beginner') {
    const extra = buildRange(['22+', 'A2s+', 'K2s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', 'A7o+', 'KTo+', 'QJo', 'JTo']);
    activeRange = new Set([...openRange, ...extra]);
  } else if (difficulty === 'master') {
    activeRange = tightenRange(openRange, 0.9);
  }

  // 성향 반영
  const pers = ctx.personality;
  if (pers) {
    if (pers.rangeMul > 1.2) {
      const extra = buildRange(['22+', 'A2s+', 'K5s+', 'Q7s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '65s', '54s', 'A2o+', 'K7o+', 'Q9o+', 'J9o+', 'T9o']);
      activeRange = new Set([...activeRange, ...extra]);
    } else if (pers.rangeMul < 0.7) {
      activeRange = tightenRange(activeRange, pers.rangeMul);
    }
  }

  const strength = handScore(hand);
  const premium = strength >= 90;

  // BB가 레이즈 없이 자기 차례
  if (toCall === 0) {
    if (activeRange.has(hand)) {
      const raiseSize = Math.min(stack, bigBlind * 3);
      return { action: 'raise', amount: raiseSize };
    }
    return { action: 'check' };
  }

  // 오픈 전 (toCall <= BB): 오픈 or 폴드
  if (toCall <= bigBlind) {
    if (activeRange.has(hand)) {
      const raiseSize = Math.min(stack, bigBlind * 2.5);
      return { action: 'raise', amount: raiseSize };
    }
    // SB: 콜(=컴플리트)로 팟 싸움은 지양
    if (difficulty === 'beginner' && strength > 45) return { action: 'call' };
    return { action: 'fold' };
  }

  // 누군가 레이즈함
  if (premium) {
    const raiseSize = Math.min(stack, toCall * 3);
    return { action: 'raise', amount: raiseSize };
  }
  const continueRange = tightenRange(activeRange, difficulty === 'beginner' ? 0.9 : 0.55);
  if (continueRange.has(hand)) {
    const po = potOdds(toCall, pot);
    if (po < 0.33 || difficulty === 'beginner') return { action: 'call' };
    if (strength >= 70) return { action: 'call' };
  }
  return { action: 'fold' };
}

function aiPostflop(ctx) {
  const { hole, board, toCall, pot, stack, activeOpponents, difficulty, personality } = ctx;
  const iters = { beginner: 150, intermediate: 300, advanced: 500, master: 700 }[difficulty];
  const eq = calculateEquity(hole, board, Math.max(1, activeOpponents), iters);

  const po = potOdds(toCall, pot);

  // 난이도별 마진
  let margin = { beginner: -0.08, intermediate: 0.0, advanced: 0.03, master: 0.05 }[difficulty];
  // 공격성: 베팅 빈도와 크기
  let aggro = { beginner: 0.35, intermediate: 0.55, advanced: 0.7, master: 0.75 }[difficulty];

  // 성향 반영
  if (personality) {
    aggro = Math.max(0.05, Math.min(1, aggro * personality.aggroMul));
    margin = margin / (personality.foldMul || 1);
    // 블러프 베팅
    if (toCall === 0 && eq.equity < 0.35 && Math.random() < personality.bluffFreq) {
      const size = Math.min(stack, Math.floor(pot * (0.55 + Math.random() * 0.3)));
      return { action: 'bet', amount: Math.max(1, size) };
    }
  }

  if (toCall === 0) {
    if (eq.equity > 0.55) {
      if (Math.random() < aggro) {
        const size = Math.min(stack, Math.floor(pot * (0.55 + Math.random() * 0.4)));
        return { action: 'bet', amount: Math.max(1, size) };
      }
      return { action: 'check' };
    }
    if (eq.equity > 0.35 && Math.random() < aggro * 0.4) {
      // 세미 블러프
      const size = Math.min(stack, Math.floor(pot * 0.5));
      return { action: 'bet', amount: Math.max(1, size) };
    }
    return { action: 'check' };
  }

  // 콜/폴드/레이즈 결정
  if (eq.equity > 0.75) {
    // 밸류 레이즈
    if (Math.random() < aggro) {
      const size = Math.min(stack, toCall + Math.floor(pot * (0.7 + Math.random() * 0.6)));
      return { action: 'raise', amount: size };
    }
    return { action: 'call' };
  }
  if (eq.equity > po + margin) return { action: 'call' };
  // 블러프 콜 (비기너만 가끔)
  if (difficulty === 'beginner' && Math.random() < 0.25) return { action: 'call' };
  return { action: 'fold' };
}
