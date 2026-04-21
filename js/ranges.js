// 프리플롭 레인지 (오픈 레이즈, 푸시/폴드)

function expandNotation(notation) {
  const out = [];
  // 특정 페어 "77"
  if (notation.length === 2 && notation[0] === notation[1]) { out.push(notation); return out; }
  // "77+" 페어 이상
  if (notation.length === 3 && notation[2] === '+' && notation[0] === notation[1]) {
    const idx = RANK_CHARS.indexOf(notation[0]);
    for (let i = idx; i < 13; i++) out.push(RANK_CHARS[i] + RANK_CHARS[i]);
    return out;
  }
  // 특정 s/o "AKs"
  if (notation.length === 3 && (notation[2] === 's' || notation[2] === 'o')) {
    out.push(notation); return out;
  }
  // "AKs+" : 하위 카드가 상위 카드 바로 아래까지
  if (notation.length === 4 && notation[3] === '+' && (notation[2] === 's' || notation[2] === 'o')) {
    const hi = notation[0], loStart = notation[1], sfx = notation[2];
    const hiIdx = RANK_CHARS.indexOf(hi);
    const loStartIdx = RANK_CHARS.indexOf(loStart);
    for (let i = loStartIdx; i < hiIdx; i++) out.push(hi + RANK_CHARS[i] + sfx);
    return out;
  }
  // "T9s-76s" 같은 커넥터 구간
  if (notation.includes('-')) {
    const [a, b] = notation.split('-');
    const sfx = a[2];
    const aHi = RANK_CHARS.indexOf(a[0]);
    const aLo = RANK_CHARS.indexOf(a[1]);
    const bHi = RANK_CHARS.indexOf(b[0]);
    const gap = aHi - aLo;
    for (let h = aHi; h >= bHi; h--) {
      const l = h - gap;
      if (l < 0) break;
      out.push(RANK_CHARS[h] + RANK_CHARS[l] + sfx);
    }
    return out;
  }
  out.push(notation);
  return out;
}

function buildRange(strings) {
  const s = new Set();
  for (const n of strings) for (const h of expandNotation(n)) s.add(h);
  return s;
}

// 표준 6-max 오픈 레이즈 레인지 (효과스택 >20BB 가정)
const OPEN_RANGES = {
  UTG: buildRange(['77+', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', 'AJo+']),
  MP:  buildRange(['66+', 'A9s+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', 'AJo+', 'KQo']),
  HJ:  buildRange(['55+', 'A8s+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', 'AJo+', 'KQo']),
  CO:  buildRange(['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', '76s', 'A9o+', 'KTo+', 'QTo+', 'JTo']),
  BTN: buildRange(['22+', 'A2s+', 'K4s+', 'Q7s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '64s+', '54s',
                   'A2o+', 'K8o+', 'Q9o+', 'J8o+', 'T8o+', '98o']),
  SB:  buildRange(['22+', 'A2s+', 'K6s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '87s', '76s', '65s',
                   'A2o+', 'K9o+', 'Q9o+', 'JTo']),
  BB:  buildRange([])
};

// 숏스택 푸시 레인지 (대략적인 Nash ICM 단순화)
const PUSH_15BB = {
  UTG: buildRange(['66+', 'A9s+', 'KJs+', 'AJo+']),
  MP:  buildRange(['55+', 'A8s+', 'KTs+', 'QJs', 'AJo+', 'KQo']),
  HJ:  buildRange(['44+', 'A7s+', 'KTs+', 'QJs', 'ATo+', 'KQo']),
  CO:  buildRange(['22+', 'A5s+', 'KTs+', 'QTs+', 'JTs', 'A9o+', 'KJo+']),
  BTN: buildRange(['22+', 'A2s+', 'K7s+', 'Q9s+', 'J9s+', 'T9s', '98s', '87s', '76s',
                   'A7o+', 'K9o+', 'QTo+', 'JTo']),
  SB:  buildRange(['22+', 'A2s+', 'K5s+', 'Q7s+', 'J7s+', 'T7s+', '97s+', '86s+', '75s+', '65s',
                   'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o'])
};

const PUSH_10BB = {
  UTG: buildRange(['44+', 'A7s+', 'KTs+', 'QJs', 'AJo+']),
  MP:  buildRange(['33+', 'A6s+', 'KTs+', 'QTs+', 'JTs', 'ATo+', 'KJo+']),
  HJ:  buildRange(['22+', 'A5s+', 'K9s+', 'QTs+', 'JTs', 'A9o+', 'KJo+']),
  CO:  buildRange(['22+', 'A2s+', 'K7s+', 'Q9s+', 'J9s+', 'T9s', 'A7o+', 'KTo+', 'QJo']),
  BTN: buildRange(['22+', 'A2s+', 'K4s+', 'Q6s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '65s', '54s',
                   'A2o+', 'K8o+', 'Q8o+', 'J9o+', 'T9o']),
  SB:  buildRange(['22+', 'A2s+', 'K2s+', 'Q5s+', 'J6s+', 'T6s+', '95s+', '85s+', '74s+', '64s+', '53s+',
                   'A2o+', 'K5o+', 'Q8o+', 'J8o+', 'T8o+', '98o'])
};

const PUSH_5BB = {
  UTG: buildRange(['22+', 'A2s+', 'K7s+', 'Q9s+', 'JTs', 'A7o+', 'KTo+', 'QJo']),
  MP:  buildRange(['22+', 'A2s+', 'K6s+', 'Q8s+', 'J9s+', 'T9s', 'A6o+', 'KTo+', 'QTo+', 'JTo']),
  HJ:  buildRange(['22+', 'A2s+', 'K5s+', 'Q8s+', 'J9s+', 'T9s', 'A5o+', 'K9o+', 'QTo+', 'JTo']),
  CO:  buildRange(['22+', 'A2s+', 'K2s+', 'Q6s+', 'J7s+', 'T7s+', '97s+', '87s', 'A2o+', 'K7o+', 'Q9o+', 'J9o+']),
  BTN: buildRange(['22+', 'A2s+', 'K2s+', 'Q2s+', 'J3s+', 'T6s+', '96s+', '85s+', '75s+', '64s+', '54s',
                   'A2o+', 'K3o+', 'Q6o+', 'J7o+', 'T8o+', '98o']),
  SB:  buildRange(['22+', 'A2s+', 'K2s+', 'Q2s+', 'J2s+', 'T5s+', '95s+', '84s+', '74s+', '63s+', '53s+', '43s',
                   'A2o+', 'K2o+', 'Q5o+', 'J6o+', 'T7o+', '97o+', '87o'])
};

// 스택/포지션 → 푸시 레인지
function getPushRange(position, stackBB) {
  const pos = position || 'BTN';
  let table;
  if (stackBB <= 6) table = PUSH_5BB;
  else if (stackBB <= 11) table = PUSH_10BB;
  else table = PUSH_15BB;
  return table[pos] || table.BTN;
}

// 프리플롭 권장 액션
// 포지션 풀네임 (초보도 이해 쉽게)
const POS_FULL_KO = {
  UTG: 'UTG(첫 자리)', MP: 'MP(미들 포지션)', HJ: 'HJ(하이잭)', CO: 'CO(컷오프)',
  BTN: 'BTN(버튼=가장 좋은 자리)', SB: 'SB(스몰 블라인드)', BB: 'BB(빅 블라인드)'
};
function posKo(p) { return POS_FULL_KO[p] || p; }

function preflopRecommendation(hand, position, stackBB, facingAction) {
  const sBB = Math.round(stackBB);
  const posName = posKo(position);

  if (stackBB <= 15) {
    const pushRange = getPushRange(position, stackBB);
    if (facingAction === 'none' || facingAction === 'limp') {
      if (pushRange.has(hand)) {
        return {
          action: 'push', label: '올인 (전부)',
          reason: `${posName} · ${sBB}BB 숏스택. 이 핸드는 올인으로 밀어붙일 만큼 충분히 강해요. 레이즈보다 올인이 정답 (상대가 폴드할 확률도 크고, 콜 받아도 승산 있음).`
        };
      }
      return {
        action: 'fold', label: '폴드 (포기)',
        reason: `${posName} · ${sBB}BB에서 이 핸드는 너무 약해요. 숏스택에선 애매한 핸드로 칩을 낭비하면 안 돼요. 더 좋은 스팟을 기다리세요.`
      };
    }
    if (facingAction === 'shove' || facingAction === 'raise') {
      const tight = tightenRange(pushRange, 0.7);
      if (tight.has(hand)) {
        return {
          action: 'call', label: '콜 (맞춰 내기)',
          reason: '숏스택에서 콜해도 될 만큼 강한 핸드예요. 하지만 콜은 내 올인 레인지보다 타이트해야 한다는 점 기억하세요.'
        };
      }
      return {
        action: 'fold', label: '폴드 (포기)',
        reason: '상대가 올인/레이즈한 상태예요. 이 핸드로 콜하면 대부분 지는 상황이라 폴드가 맞아요.'
      };
    }
  }

  const openRange = OPEN_RANGES[position] || OPEN_RANGES.BTN;
  if (facingAction === 'none') {
    if (openRange.has(hand)) {
      return {
        action: 'raise', label: '레이즈 (먼저 공격)',
        reason: `${posName}에서 먼저 들어갈 만한 좋은 핸드예요. 크기는 보통 빅블라인드 2~3배(예: 40~60) 정도. 이렇게 선제 공격하면 블라인드를 훔칠 확률도 커져요.`
      };
    }
    return {
      action: 'fold', label: '폴드 (포기)',
      reason: `${posName} 자리에서는 이 핸드가 너무 약해요. 앞 자리일수록 엄선된 핸드만 플레이해야 합니다.`
    };
  }
  if (facingAction === 'raise') {
    const threeBetValue = buildRange(['QQ+', 'AKs', 'AKo']);
    const callRange = tightenRange(openRange, 0.55);
    if (threeBetValue.has(hand)) return {
      action: 'raise', label: '재레이즈 (3-Bet · 공격)',
      reason: 'QQ+/AK — 최상위 핸드예요. 상대 레이즈 위에 한 번 더 크게 레이즈해서 팟을 키우세요.'
    };
    if (callRange.has(hand)) return {
      action: 'call', label: '콜 (맞춰 내기)',
      reason: '재레이즈 할 만큼 최강은 아니지만 콜로 플롭을 볼 가치가 있는 핸드예요. 포지션이 좋다면 더 유리합니다.'
    };
    return {
      action: 'fold', label: '폴드 (포기)',
      reason: '상대가 먼저 레이즈했어요. 이 핸드로 따라가면 대부분 밀리는 상황이에요.'
    };
  }
  if (facingAction === 'limp') {
    if (openRange.has(hand)) return {
      action: 'raise', label: '레이즈 (림퍼 응징)',
      reason: '앞 플레이어가 약하게 콜만 한 상태(림프). 레이즈로 압박해서 팟을 키우고 주도권을 잡으세요.'
    };
    return { action: 'fold', label: '폴드 (포기)', reason: '림프에 참가할 만한 핸드는 아니에요.' };
  }
  return { action: 'fold', label: '폴드 (포기)', reason: '애매한 상황 — 일단 폴드 무난.' };
}

function tightenRange(set, keepRatio) {
  // 상위 keepRatio 비율만 남김 (단순 강도 기준)
  const strengths = [];
  for (const h of set) strengths.push([h, handScore(h)]);
  strengths.sort((a, b) => b[1] - a[1]);
  const keep = strengths.slice(0, Math.ceil(strengths.length * keepRatio));
  return new Set(keep.map(x => x[0]));
}

// 프리플롭 핸드 강도 근사치 (챈의 포인트 변형)
function handScore(handStr) {
  const r1 = RANK_CHARS.indexOf(handStr[0]);
  const r2 = RANK_CHARS.indexOf(handStr[1]);
  const paired = r1 === r2;
  const suited = handStr[2] === 's';
  let score = 0;
  if (paired) {
    score = 50 + r1 * 5; // 22=50, AA=110
  } else {
    score = (r1 + 2) * 2 + (r2 + 2);
    if (suited) score += 5;
    const gap = r1 - r2;
    if (gap === 1) score += 3;
    else if (gap === 2) score += 1;
    if (r1 >= 8) score += 2; // 하이 카드 보너스 (T 이상)
  }
  return score;
}
