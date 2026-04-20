// 토너먼트 & 핸드 상태 머신

const POSITIONS_BY_COUNT = {
  2: ['SB', 'BB'],                    // 헤즈업: SB=BTN
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']
};

const BLIND_SCHEDULE = [
  { sb: 10, bb: 20 },
  { sb: 15, bb: 30 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 75, bb: 150 },
  { sb: 100, bb: 200 },
  { sb: 150, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 400, bb: 800 },
  { sb: 600, bb: 1200 },
  { sb: 800, bb: 1600 },
  { sb: 1200, bb: 2400 },
  { sb: 1600, bb: 3200 },
  { sb: 2400, bb: 4800 }
];

class Tournament {
  constructor(opts) {
    // players: [{name, isHuman, difficulty}]
    this.startStack = opts.startStack || 1500;
    this.handsPerLevel = opts.handsPerLevel || 8;
    this.players = opts.players.map((p, i) => ({
      id: i,
      name: p.name,
      isHuman: !!p.isHuman,
      difficulty: p.difficulty || 'intermediate',
      stack: this.startStack,
      eliminated: false,
      position: null
    }));
    this.handNumber = 0;
    this.level = 0;
    this.buttonSeat = 0; // 생존자 배열의 인덱스, 매 핸드마다 돌아감
    this.handHistory = []; // 완료된 핸드 기록
    this.currentHand = null;
    this.startedAt = Date.now();
  }

  get alivePlayers() { return this.players.filter(p => !p.eliminated); }
  get currentBlinds() { return BLIND_SCHEDULE[Math.min(this.level, BLIND_SCHEDULE.length - 1)]; }

  isOver() { return this.alivePlayers.length <= 1; }

  startHand() {
    if (this.isOver()) return null;
    this.handNumber++;
    if (this.handNumber > 1 && (this.handNumber - 1) % this.handsPerLevel === 0) {
      this.level = Math.min(this.level + 1, BLIND_SCHEDULE.length - 1);
    }

    const alive = this.alivePlayers;
    const n = alive.length;
    // 버튼 위치 정규화
    if (this.buttonSeat >= n) this.buttonSeat = 0;

    const posNames = POSITIONS_BY_COUNT[n];
    // 버튼을 기준으로 순서대로 배정
    alive.forEach((p, i) => {
      const offset = (i - this.buttonSeat + n) % n;
      p.position = posNames[offset];
    });

    const { sb, bb } = this.currentBlinds;

    const deck = new Deck();
    const playerStates = alive.map(p => ({
      id: p.id,
      name: p.name,
      isHuman: p.isHuman,
      difficulty: p.difficulty,
      position: p.position,
      stackStart: p.stack,
      stack: p.stack,
      hole: deck.deal(2),
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      hasActed: false
    }));

    // 블라인드 포스팅
    const sbPlayer = playerStates.find(p => p.position === 'SB') || playerStates.find(p => p.position === 'BTN');
    const bbPlayer = playerStates.find(p => p.position === 'BB');
    // 2인(헤즈업): SB=BTN이 먼저, BB는 큰 블라인드
    this.postBlind(sbPlayer, sb);
    this.postBlind(bbPlayer, bb);

    this.currentHand = {
      number: this.handNumber,
      level: this.level,
      sb, bb,
      buttonSeat: this.buttonSeat,
      deck,
      board: [],
      playerStates,
      pot: sbPlayer.bet + bbPlayer.bet, // 집계용 (참고값)
      currentBet: bb,
      minRaise: bb,
      lastAggressor: bbPlayer.id,
      street: 'preflop',
      actions: [],
      seatOrder: alive.map(p => p.id),
      toActIndex: null,
      winners: null,
      finished: false
    };

    // 프리플롭 액션 시작 위치: BB 다음
    this.currentHand.toActIndex = this.firstToActPreflop();
    return this.currentHand;
  }

  postBlind(p, amount) {
    const paid = Math.min(p.stack, amount);
    p.stack -= paid;
    p.bet += paid;
    p.totalBet += paid;
    if (p.stack === 0) p.allIn = true;
  }

  firstToActPreflop() {
    const h = this.currentHand;
    // BB 다음 자리부터 시계방향으로 활성 플레이어
    const bbIdx = h.playerStates.findIndex(p => p.position === 'BB');
    const n = h.playerStates.length;
    for (let k = 1; k <= n; k++) {
      const idx = (bbIdx + k) % n;
      const p = h.playerStates[idx];
      if (!p.folded && !p.allIn) return idx;
    }
    return bbIdx;
  }

  firstToActPostflop() {
    const h = this.currentHand;
    const n = h.playerStates.length;
    // 헤즈업: SB=BTN이므로 BB가 먼저 액션
    let btnIdx = h.playerStates.findIndex(p => p.position === 'BTN');
    if (btnIdx < 0) btnIdx = h.playerStates.findIndex(p => p.position === 'SB');
    for (let k = 1; k <= n; k++) {
      const idx = (btnIdx + k) % n;
      const p = h.playerStates[idx];
      if (!p.folded && !p.allIn) return idx;
    }
    return -1;
  }

  currentPot() {
    return this.currentHand.playerStates.reduce((s, p) => s + p.totalBet, 0);
  }

  currentPlayer() {
    const h = this.currentHand;
    if (!h || h.toActIndex == null) return null;
    return h.playerStates[h.toActIndex];
  }

  // 현재 액션자의 합법적 옵션
  legalOptions() {
    const h = this.currentHand;
    const p = this.currentPlayer();
    if (!p) return null;
    const toCall = h.currentBet - p.bet;
    const opts = {
      canFold: toCall > 0,
      canCheck: toCall === 0,
      canCall: toCall > 0 && toCall < p.stack,
      canAllInCall: toCall >= p.stack && p.stack > 0,
      canBet: h.currentBet === 0 && p.stack > 0,
      canRaise: h.currentBet > 0 && p.stack > toCall,
      toCall,
      minRaise: h.currentBet + h.minRaise,
      maxRaise: p.bet + p.stack,
      potSize: this.currentPot(),
      currentBet: h.currentBet,
      myBet: p.bet,
      myStack: p.stack
    };
    return opts;
  }

  // 액션 적용. action: {type: 'fold'|'check'|'call'|'bet'|'raise'|'allin', amount?}
  applyAction(action) {
    const h = this.currentHand;
    const p = this.currentPlayer();
    if (!p) return;
    const toCall = h.currentBet - p.bet;

    let actualType = action.type;
    let amountRecord = 0;

    if (action.type === 'fold') {
      p.folded = true;
    } else if (action.type === 'check') {
      if (toCall > 0) throw new Error('Cannot check when there is a bet to call');
    } else if (action.type === 'call') {
      const paid = Math.min(p.stack, toCall);
      p.stack -= paid;
      p.bet += paid;
      p.totalBet += paid;
      if (p.stack === 0) p.allIn = true;
      amountRecord = paid;
    } else if (action.type === 'bet' || action.type === 'raise' || action.type === 'allin') {
      // 목표 베팅 = action.amount (자기 bet의 최종값), 올인은 전액
      let target;
      if (action.type === 'allin') target = p.bet + p.stack;
      else target = Math.min(action.amount, p.bet + p.stack);

      // 최소 베팅/레이즈 보정
      if (h.currentBet === 0) {
        target = Math.max(target, Math.min(p.bet + p.stack, h.bb));
      } else {
        const minRaiseTo = h.currentBet + h.minRaise;
        if (target < minRaiseTo && target < p.bet + p.stack) target = minRaiseTo;
      }
      const add = target - p.bet;
      if (add > p.stack) target = p.bet + p.stack;
      const paid = target - p.bet;
      p.stack -= paid;
      p.bet = target;
      p.totalBet += paid;
      if (p.stack === 0) p.allIn = true;

      const raiseIncrement = target - h.currentBet;
      if (target > h.currentBet) {
        h.minRaise = Math.max(h.minRaise, raiseIncrement);
        h.currentBet = target;
        h.lastAggressor = p.id;
        // 새로운 레이즈/베팅 → 다른 플레이어들은 다시 액션 필요
        for (const pl of h.playerStates) {
          if (pl.id !== p.id && !pl.folded && !pl.allIn) pl.hasActed = false;
        }
      }
      amountRecord = paid;
      actualType = p.allIn && add === p.stack + 0 ? 'allin' : action.type;
    }

    p.hasActed = true;
    p.lastAction = { type: actualType, amount: amountRecord, street: h.street };
    h.actions.push({
      street: h.street,
      playerId: p.id,
      position: p.position,
      type: actualType,
      amount: amountRecord,
      toCallBefore: toCall,
      potBefore: this.currentPot() - amountRecord,
      board: h.board.slice(),
      hole: p.hole.map(c => c.toJSON()),
      stackBefore: p.stack + amountRecord + (action.type === 'fold' ? 0 : 0),
      stackAfter: p.stack,
      players: h.playerStates.map(ps => ({
        id: ps.id,
        name: ps.name,
        position: ps.position,
        stack: ps.stack,
        bet: ps.bet,
        totalBet: ps.totalBet,
        folded: ps.folded,
        allIn: ps.allIn,
        isHuman: ps.isHuman
      }))
    });

    h.pot = this.currentPot();
    this.advance();
  }

  advance() {
    const h = this.currentHand;
    const active = h.playerStates.filter(p => !p.folded);
    // 혼자 남음 → 핸드 종료
    if (active.length === 1) {
      this.showdown();
      return;
    }
    // 모두가 올인 → 끝까지 돌림
    const canAct = active.filter(p => !p.allIn);
    if (canAct.length === 0) {
      this.dealRemainingAndShowdown();
      return;
    }
    // 스트리트 종료 체크: 모두 액션했고 bet 동일
    const allActed = canAct.every(p => p.hasActed);
    const allMatched = canAct.every(p => p.bet === h.currentBet);
    if (allActed && allMatched) {
      this.nextStreet();
      return;
    }
    // 다음 액션자
    this.advanceToActIndex();
  }

  advanceToActIndex() {
    const h = this.currentHand;
    const n = h.playerStates.length;
    let idx = h.toActIndex;
    for (let k = 1; k <= n; k++) {
      idx = (idx + 1) % n;
      const p = h.playerStates[idx];
      if (!p.folded && !p.allIn) { h.toActIndex = idx; return; }
    }
  }

  nextStreet() {
    const h = this.currentHand;
    // 베트 리셋 (새 스트리트 → 액션 표시 클리어, 단 폴드는 유지)
    for (const p of h.playerStates) {
      p.bet = 0;
      p.hasActed = false;
      if (!p.folded) p.lastAction = null;
    }
    h.currentBet = 0;
    h.minRaise = h.bb;

    if (h.street === 'preflop') {
      h.board.push(...h.deck.deal(3));
      h.street = 'flop';
    } else if (h.street === 'flop') {
      h.board.push(...h.deck.deal(1));
      h.street = 'turn';
    } else if (h.street === 'turn') {
      h.board.push(...h.deck.deal(1));
      h.street = 'river';
    } else {
      this.showdown();
      return;
    }

    h.actions.push({ type: 'deal', street: h.street, board: h.board.slice() });

    // 포스트플롭 첫 액션자
    const first = this.firstToActPostflop();
    if (first === -1 || h.playerStates[first].allIn) {
      // 모두 올인 상태
      this.dealRemainingAndShowdown();
    } else {
      h.toActIndex = first;
    }
  }

  dealRemainingAndShowdown() {
    const h = this.currentHand;
    while (h.board.length < 5) {
      if (h.street === 'preflop') { h.board.push(...h.deck.deal(3)); h.street = 'flop'; }
      else if (h.street === 'flop') { h.board.push(...h.deck.deal(1)); h.street = 'turn'; }
      else if (h.street === 'turn') { h.board.push(...h.deck.deal(1)); h.street = 'river'; }
      else break;
      h.actions.push({ type: 'deal', street: h.street, board: h.board.slice() });
    }
    this.showdown();
  }

  showdown() {
    const h = this.currentHand;
    h.toActIndex = null;
    const active = h.playerStates.filter(p => !p.folded);

    // 혼자 남음 → 단일 팟 처리 (쇼다운 없이)
    if (active.length === 1) {
      const winner = active[0];
      const totalPot = h.playerStates.reduce((s, p) => s + p.totalBet, 0);
      winner.stack += totalPot;
      h.pots = [{ amount: totalPot, eligible: [winner.id] }];
      h.allocations = [{ potIdx: 0, amount: totalPot, winners: [{ id: winner.id, name: winner.name, handName: '단독(무대결)' }] }];
      h.finished = true;
      for (const ps of h.playerStates) {
        const main = this.players.find(mp => mp.id === ps.id);
        if (main) main.stack = ps.stack;
      }
      for (const p of this.players) { if (!p.eliminated && p.stack <= 0) p.eliminated = true; }
      this.buttonSeat = (this.buttonSeat + 1) % this.alivePlayers.length;
      this.handHistory.push(this.snapshotHand());
      return;
    }

    // 사이드 팟 계산
    const pots = this.buildPots(h.playerStates);
    const allocations = []; // {potIdx, amount, winners:[{id,name,handName}]}

    for (let i = 0; i < pots.length; i++) {
      const pot = pots[i];
      const eligibles = pot.eligible.filter(id => {
        const p = h.playerStates.find(x => x.id === id);
        return !p.folded;
      });
      if (eligibles.length === 0) continue;

      if (eligibles.length === 1) {
        const winner = h.playerStates.find(x => x.id === eligibles[0]);
        winner.stack += pot.amount;
        allocations.push({ potIdx: i, amount: pot.amount, winners: [{ id: winner.id, name: winner.name, handName: '단독' }] });
        continue;
      }
      const results = eligibles.map(id => {
        const p = h.playerStates.find(x => x.id === id);
        return { player: p, eval: evaluate7([...p.hole, ...h.board]) };
      });
      results.sort((a, b) => b.eval.score - a.eval.score);
      const top = results[0].eval.score;
      const winners = results.filter(r => r.eval.score === top);
      const share = Math.floor(pot.amount / winners.length);
      const rem = pot.amount - share * winners.length;
      winners.forEach((w, idx) => { w.player.stack += share + (idx === 0 ? rem : 0); });
      allocations.push({
        potIdx: i,
        amount: pot.amount,
        winners: winners.map(w => ({ id: w.player.id, name: w.player.name, handName: w.eval.name }))
      });
    }

    h.pots = pots;
    h.allocations = allocations;
    h.finished = true;

    // 메인 플레이어 객체 동기화
    for (const ps of h.playerStates) {
      const main = this.players.find(mp => mp.id === ps.id);
      if (main) main.stack = ps.stack;
    }
    // 탈락 처리
    for (const p of this.players) {
      if (!p.eliminated && p.stack <= 0) p.eliminated = true;
    }
    // 버튼 전진
    this.buttonSeat = (this.buttonSeat + 1) % this.alivePlayers.length;

    this.handHistory.push(this.snapshotHand());
  }

  buildPots(players) {
    // 모든 플레이어의 totalBet 기준으로 단계별 팟 구성
    const contributions = players.map(p => ({ id: p.id, amount: p.totalBet, folded: p.folded }));
    const pots = [];
    let prev = 0;
    const levels = [...new Set(contributions.map(c => c.amount))].filter(v => v > 0).sort((a, b) => a - b);
    for (const level of levels) {
      let amt = 0;
      for (const c of contributions) {
        const diff = Math.max(0, Math.min(c.amount, level) - prev);
        amt += diff;
      }
      const eligible = contributions.filter(c => c.amount >= level && !c.folded).map(c => c.id);
      if (amt > 0) pots.push({ amount: amt, eligible });
      prev = level;
    }
    return pots;
  }

  snapshotHand() {
    const h = this.currentHand;
    return {
      number: h.number,
      level: h.level,
      sb: h.sb, bb: h.bb,
      buttonSeat: h.buttonSeat,
      board: h.board.map(c => c.toJSON()),
      actions: h.actions.map(a => ({ ...a, board: (a.board || []).map(c => c.toJSON ? c.toJSON() : c), hole: a.hole })),
      players: h.playerStates.map(p => ({
        id: p.id, name: p.name, isHuman: p.isHuman, difficulty: p.difficulty,
        position: p.position, stackStart: p.stackStart, stackEnd: p.stack,
        hole: p.hole.map(c => c.toJSON()), folded: p.folded, allIn: p.allIn,
        totalBet: p.totalBet
      })),
      pots: h.pots, allocations: h.allocations
    };
  }

  endHand() {
    this.currentHand = null;
  }
}
