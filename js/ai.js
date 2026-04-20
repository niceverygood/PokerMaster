// 난이도별 AI 의사 결정
// ctx: { hole, board, position, stack, toCall, pot, minRaise, bigBlind, activeOpponents, street, difficulty }

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
  const { hole, board, toCall, pot, stack, activeOpponents, difficulty } = ctx;
  const iters = { beginner: 150, intermediate: 300, advanced: 500, master: 700 }[difficulty];
  const eq = calculateEquity(hole, board, Math.max(1, activeOpponents), iters);

  const po = potOdds(toCall, pot);

  // 난이도별 마진
  const margin = { beginner: -0.08, intermediate: 0.0, advanced: 0.03, master: 0.05 }[difficulty];
  // 공격성: 베팅 빈도와 크기
  const aggro = { beginner: 0.35, intermediate: 0.55, advanced: 0.7, master: 0.75 }[difficulty];

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
