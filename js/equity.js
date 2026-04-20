// 몬테카를로 승률 계산

function calculateEquity(heroCards, boardCards, numOpponents, iterations) {
  iterations = iterations || 1000;
  if (numOpponents < 1) return { equity: 1, wins: iterations, ties: 0, iterations };

  let wins = 0, ties = 0;
  const removed = [...heroCards, ...boardCards];

  for (let i = 0; i < iterations; i++) {
    const deck = new Deck();
    deck.removeCards(removed);
    // shuffle already called in reset; no need to shuffle again

    const oppHands = [];
    for (let o = 0; o < numOpponents; o++) oppHands.push(deck.deal(2));

    const fullBoard = boardCards.slice();
    while (fullBoard.length < 5) fullBoard.push(...deck.deal(1));

    const heroBest = evaluate7([...heroCards, ...fullBoard]);
    let better = false, tiedCount = 0;
    for (const opp of oppHands) {
      const ob = evaluate7([...opp, ...fullBoard]);
      if (ob.score > heroBest.score) { better = true; break; }
      if (ob.score === heroBest.score) tiedCount++;
    }
    if (!better) {
      if (tiedCount === 0) wins++;
      else ties += 1 / (tiedCount + 1);
    }
  }

  return { wins, ties, iterations, equity: (wins + ties) / iterations };
}

// 팟 오즈 계산 (콜에 필요한 승률)
function potOdds(toCall, pot) {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall);
}
