// 카드, 덱, 핸드 평가기
// 전역 객체에 붙여서 단순 script 로딩으로도 작동

const SUIT_SYMBOLS = ['\u2660', '\u2665', '\u2666', '\u2663']; // 스페이드 하트 다이아 클럽
const SUIT_LETTERS = ['s', 'h', 'd', 'c'];
const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

class Card {
  constructor(rank, suit) {
    this.rank = rank; // 2~14
    this.suit = suit; // 0~3
  }
  get rankStr() { return RANK_CHARS[this.rank - 2]; }
  get suitSym() { return SUIT_SYMBOLS[this.suit]; }
  get isRed() { return this.suit === 1 || this.suit === 2; }
  toString() { return this.rankStr + SUIT_LETTERS[this.suit]; }
  toJSON() { return { rank: this.rank, suit: this.suit }; }
  static fromJSON(o) { return new Card(o.rank, o.suit); }
  equals(other) { return other && this.rank === other.rank && this.suit === other.suit; }
}

class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }
  reset() {
    this.cards = [];
    for (let r = 2; r <= 14; r++) {
      for (let s = 0; s < 4; s++) this.cards.push(new Card(r, s));
    }
    this.shuffle();
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = this.cards[i]; this.cards[i] = this.cards[j]; this.cards[j] = t;
    }
  }
  deal(n) { return this.cards.splice(0, n); }
  removeCards(list) {
    this.cards = this.cards.filter(c => !list.some(r => r.rank === c.rank && r.suit === c.suit));
  }
}

// 5장짜리 핸드 평가. { rank: 1~9, score: 비교 가능한 숫자, name: 한글 }
function evaluate5(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) { isStraight = true; straightHigh = unique[0]; }
    else if (unique[0] === 14 && unique[1] === 5 && unique[4] === 2) { isStraight = true; straightHigh = 5; }
  }

  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const sortedRanks = Object.keys(counts).map(Number).sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return b - a;
  });
  const cv = sortedRanks.map(r => counts[r]);

  const mul = (arr) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i] * Math.pow(15, arr.length - 1 - i);
    return s;
  };

  let rank, score, name;
  if (isStraight && isFlush) {
    rank = 9; score = rank * 1e12 + straightHigh;
    name = straightHigh === 14 ? '로열 플러시' : '스트레이트 플러시';
  } else if (cv[0] === 4) {
    rank = 8; score = rank * 1e12 + mul([sortedRanks[0], sortedRanks[1]]); name = '포카드';
  } else if (cv[0] === 3 && cv[1] === 2) {
    rank = 7; score = rank * 1e12 + mul([sortedRanks[0], sortedRanks[1]]); name = '풀 하우스';
  } else if (isFlush) {
    rank = 6; score = rank * 1e12 + mul(ranks); name = '플러시';
  } else if (isStraight) {
    rank = 5; score = rank * 1e12 + straightHigh; name = '스트레이트';
  } else if (cv[0] === 3) {
    rank = 4; score = rank * 1e12 + mul([sortedRanks[0], sortedRanks[1], sortedRanks[2]]); name = '트립스';
  } else if (cv[0] === 2 && cv[1] === 2) {
    rank = 3; score = rank * 1e12 + mul([sortedRanks[0], sortedRanks[1], sortedRanks[2]]); name = '투 페어';
  } else if (cv[0] === 2) {
    rank = 2; score = rank * 1e12 + mul([sortedRanks[0], sortedRanks[1], sortedRanks[2], sortedRanks[3]]); name = '원 페어';
  } else {
    rank = 1; score = rank * 1e12 + mul(ranks); name = '하이카드';
  }
  return { rank, score, name, cards };
}

// 7장 중 최고의 5장
function evaluate7(cards) {
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const r = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || r.score > best.score) best = r;
          }
        }
      }
    }
  }
  return best;
}

// "AKs" 같은 표준 표기
function handToString(c1, c2) {
  const hi = c1.rank >= c2.rank ? c1 : c2;
  const lo = c1.rank >= c2.rank ? c2 : c1;
  if (hi.rank === lo.rank) return hi.rankStr + lo.rankStr;
  return hi.rankStr + lo.rankStr + (hi.suit === lo.suit ? 's' : 'o');
}
