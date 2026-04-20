// 트레이닝: 드릴, 레슨, 업적
// 초보 → 마스터 진화를 위한 학습 루프

// ============================================================
// 업적
// ============================================================
const ACHIEVEMENTS = [
  { id: 'first_hand',       icon: '🎲', name: '첫 걸음',           desc: '첫 핸드 완료',                       check: p => p.totalHands >= 1 },
  { id: 'first_tournament', icon: '🏁', name: '완주',               desc: '토너먼트 1회 완료',                   check: p => p.tournamentCount >= 1 },
  { id: 'first_win',        icon: '🏆', name: '첫 우승',            desc: '토너먼트 우승',                       check: p => p.tournamentWins >= 1 },
  { id: 'hands_50',         icon: '📊', name: '꾸준한 시작',        desc: '누적 50핸드',                        check: p => p.totalHands >= 50 },
  { id: 'hands_100',        icon: '💯', name: '100핸드 돌파',       desc: '누적 100핸드',                       check: p => p.totalHands >= 100 },
  { id: 'hands_500',        icon: '🎯', name: '500핸드 돌파',       desc: '누적 500핸드',                       check: p => p.totalHands >= 500 },
  { id: 'hands_1000',       icon: '🔥', name: '천 핸드 클럽',       desc: '누적 1000핸드',                      check: p => p.totalHands >= 1000 },
  { id: 'accuracy_60',      icon: '📈', name: '꾸준함',             desc: '100+핸드, 정답률 60%',                check: p => p.totalHands >= 100 && calculateAccuracy(p) >= 0.6 },
  { id: 'accuracy_75',      icon: '⭐', name: '발전',               desc: '200+핸드, 정답률 75%',                check: p => p.totalHands >= 200 && calculateAccuracy(p) >= 0.75 },
  { id: 'accuracy_85',      icon: '🌟', name: '전문가',             desc: '500+핸드, 정답률 85%',                check: p => p.totalHands >= 500 && calculateAccuracy(p) >= 0.85 },
  { id: 'preflop_master',   icon: '🎴', name: '프리플롭 마스터',    desc: '100+ 프리플롭 결정, 정답률 90%',     check: p => p.preflopDecisions >= 100 && (p.preflopCorrect / p.preflopDecisions) >= 0.9 },
  { id: 'postflop_solid',   icon: '🃏', name: '포스트플롭 숙련자',  desc: '50+ 포스트플롭 결정, 정답률 75%',    check: p => p.postflopDecisions >= 50 && (p.postflopCorrect / p.postflopDecisions) >= 0.75 },
  { id: 'drill_10',         icon: '📚', name: '성실한 학생',        desc: '드릴 10세션 완료',                    check: p => (p.drillSessions || 0) >= 10 },
  { id: 'drill_50',         icon: '🎓', name: '학구열',             desc: '드릴 50세션 완료',                    check: p => (p.drillSessions || 0) >= 50 },
  { id: 'lesson_all',       icon: '📖', name: '독학왕',             desc: '모든 레슨 완료',                      check: p => (p.lessonsCompleted || []).length >= LESSONS.length }
];

function checkAchievements(profile) {
  profile.achievements = profile.achievements || [];
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (profile.achievements.includes(a.id)) continue;
    try { if (a.check(profile)) { profile.achievements.push(a.id); unlocked.push(a); } } catch (e) {}
  }
  return unlocked;
}

// ============================================================
// 레슨 (짧은 교안)
// ============================================================
const LESSONS = [
  {
    id: 'l1_position', title: '포지션의 이해', level: '초급', duration: '3분',
    summary: '포커에서 위치는 곧 돈이다. 왜 포지션이 수익성을 결정하는지.',
    content: `
      <h3>1. 포지션이란?</h3>
      <p>딜러 버튼을 기준으로 누가 먼저 액션을 하느냐가 정해집니다. <b>나중에 행동할수록</b> 상대의 정보를 더 많이 가진 채 결정할 수 있어 유리합니다.</p>
      <h3>2. 6맥스 포지션</h3>
      <ul>
        <li><b>UTG</b>: 가장 먼저. 가장 타이트하게.</li>
        <li><b>HJ · CO</b>: 중간 위치. 점점 넓히기.</li>
        <li><b>BTN</b>: 최고의 포지션. 가장 넓은 레인지로 공격.</li>
        <li><b>SB · BB</b>: 블라인드. 포스트플롭은 최악의 위치(OOP).</li>
      </ul>
      <h3>3. 실전 원칙</h3>
      <ol>
        <li>UTG에서 77+ 같은 강한 핸드만 오픈하세요.</li>
        <li>BTN에서는 Q7s, J9s 같은 플레이어블 핸드도 공격적으로 오픈합니다.</li>
        <li>SB에서는 림프(콜) 대신 레이즈 또는 폴드가 원칙입니다.</li>
      </ol>
      <h3>4. 왜 중요한가</h3>
      <p>같은 핸드라도 UTG와 BTN의 기대수익은 다릅니다. 포지션이 좋을수록 <b>베팅 컨트롤</b>과 <b>블러프 기회</b>가 생깁니다.</p>
    `
  },
  {
    id: 'l2_ranges', title: '프리플롭 핸드 레인지', level: '초급', duration: '4분',
    summary: '169가지 스타팅 핸드 중 무엇을 어디서 플레이할까.',
    content: `
      <h3>1. 핸드 레인지란</h3>
      <p>한 핸드만 보지 말고 <b>가능한 핸드 전체의 집합</b>을 생각하세요. 이게 포커 사고방식의 핵심입니다.</p>
      <h3>2. 강도 순서</h3>
      <ul>
        <li><b>프리미엄</b>: QQ+, AK (전 포지션 오픈/3벳)</li>
        <li><b>강한 핸드</b>: TT-99, AQ, AJs, KQs (CO 이하)</li>
        <li><b>중간 핸드</b>: 88-22, AT-A2s, KJs+, QJs, JTs</li>
        <li><b>스페큐</b>: 22, 수딩 커넥터, 수딩 에이스 (포지션에서)</li>
      </ul>
      <h3>3. 표준 오픈 레인지 (6맥스)</h3>
      <p><b>UTG</b>: 77+, ATs+, KTs+, QTs+, JTs, T9s, AJo+<br>
         <b>HJ</b>: 55+, A8s+, KTs+, QTs+, JTs+, T9s, 98s, AJo+, KQo<br>
         <b>CO</b>: 22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, A9o+, KTo+<br>
         <b>BTN</b>: 22+, A2s+, K4s+, Q7s+, J7s+, T7s+, 9x-7xs 등 매우 넓음</p>
      <h3>4. 실천 팁</h3>
      <p>오픈 전에 "<b>내 포지션에서 이 핸드를 플레이하나?</b>"를 매번 자문하세요. 모호하면 폴드가 무난합니다.</p>
    `
  },
  {
    id: 'l3_odds', title: '팟 오즈와 에퀴티', level: '중급', duration: '5분',
    summary: '콜 vs 폴드를 수학적으로 결정하는 법.',
    content: `
      <h3>1. 팟 오즈</h3>
      <p>팟에 현재 있는 금액 대비 내가 콜해야 할 금액 비율. <br>
         <b>필요 승률 = 콜 / (팟 + 콜)</b></p>
      <p>예) 팟 100, 콜 50 → 50 / (100+50) = 33.3%. 내 승률이 33.3% 이상이면 콜 수익.</p>
      <h3>2. 에퀴티(승률)</h3>
      <p>지금 상황에서 쇼다운까지 갔을 때 이길 확률. 몬테카를로 또는 계산기로 구합니다.</p>
      <h3>3. 결정 규칙</h3>
      <ul>
        <li><b>에퀴티 ≥ 필요 승률</b> → 콜 수익(+EV)</li>
        <li><b>에퀴티 < 필요 승률</b> → 폴드가 이득</li>
      </ul>
      <h3>4. 임플라이드 오즈</h3>
      <p>드로우가 완성되면 <b>상대에게 얼마나 더 받아낼 수 있는가</b>도 고려합니다. 직접 오즈가 부족해도 임플라이드로 콜이 정당화되는 경우가 있습니다.</p>
      <h3>5. 역오즈(Reverse Implied)</h3>
      <p>드로우를 맞춰도 상대에게 더 큰 핸드가 있을 수 있다면 역오즈로 불리합니다. K-high 플러시 드로우 등 주의.</p>
    `
  },
  {
    id: 'l4_pushfold', title: '숏스택 푸시/폴드', level: '중급', duration: '4분',
    summary: '15BB 이하에서는 레이즈 대신 올인이 원칙.',
    content: `
      <h3>1. 왜 푸시/폴드인가</h3>
      <p>스택이 얕을수록 <b>레이즈 후 포스트플롭</b>에서 벌 수 있는 돈이 적습니다. 올인은 상대의 폴드 에쿼티를 극대화합니다.</p>
      <h3>2. 대략적 기준</h3>
      <ul>
        <li><b>15BB</b>: 포지션에 따라 Nash 푸시 레인지</li>
        <li><b>10BB</b>: 더 넓게</li>
        <li><b>5BB</b>: 거의 아무 핸드</li>
      </ul>
      <h3>3. 포지션별 15BB 푸시 (근사)</h3>
      <p><b>UTG</b>: 66+, A9s+, AJo+<br>
         <b>HJ</b>: 44+, A7s+, ATo+, KQs<br>
         <b>CO</b>: 22+, A5s+, KTs+, A9o+, KJo+<br>
         <b>BTN</b>: 22+, A2s+, K7s+, Q9s+, A7o+, K9o+, QTo+<br>
         <b>SB</b>: 매우 넓음</p>
      <h3>4. 콜링 레인지는 더 타이트</h3>
      <p>누군가 쇼브한 걸 콜하려면 내 푸시 레인지보다 <b>더 강해야</b> 합니다. 왜? 내가 먼저 쇼브할 때는 폴드 에쿼티가 있지만, 콜은 상대가 이미 참여 의사를 밝힌 핸드입니다.</p>
    `
  },
  {
    id: 'l5_cbet', title: '컨티뉴에이션 벳 기초', level: '중급', duration: '4분',
    summary: '프리플롭 어그레서가 플롭에서 베팅하는 이유.',
    content: `
      <h3>1. C-Bet이란</h3>
      <p>프리플롭에서 레이즈한 플레이어가 플롭에서도 연이어 베팅하는 것. <b>이니셔티브</b>를 유지해 폴드 에쿼티를 가져옵니다.</p>
      <h3>2. 좋은 C-Bet 보드</h3>
      <ul>
        <li>A-high 드라이(A72 레인보우) — 상대가 A를 안 가진 경우가 많음</li>
        <li>K-high, Q-high — 프리미엄 오픈 레인지에 유리</li>
        <li>드로우 없는 페어링(775, TT3) — 밸류가 맞으면 강함</li>
      </ul>
      <h3>3. 나쁜 C-Bet 보드</h3>
      <ul>
        <li>저카드 위주 커넥티드(678) — 상대 수딩 커넥터에 맞음</li>
        <li>모노톤(같은 무늬 3장) — 상대 플러시 드로우 많음</li>
        <li>페어+하이카드(TT-J) — 상대 TT·J핸드 다량</li>
      </ul>
      <h3>4. 사이즈</h3>
      <p>드라이 보드: <b>1/3팟</b> 소형 / 드로우 많은 보드: <b>2/3팟</b> 대형. 보드가 젖을수록 사이즈를 키웁니다.</p>
    `
  },
  {
    id: 'l6_icm', title: 'ICM 기초', level: '고급', duration: '4분',
    summary: '토너먼트 상금 구조가 의사결정을 어떻게 바꾸는가.',
    content: `
      <h3>1. ICM이란</h3>
      <p>Independent Chip Model. 토너먼트 칩은 <b>비선형</b> 가치를 가집니다. 상금이 있는 구조에서 <b>타이트</b>하게 플레이해야 할 이유를 수식화합니다.</p>
      <h3>2. 버블 상황</h3>
      <p>상금권 직전은 <b>가장 타이트</b>한 플레이가 유리합니다. 탈락하면 0원이므로 +EV 칩 결정이 -EV 달러 결정이 될 수 있습니다.</p>
      <h3>3. 스택 사이즈별 원칙</h3>
      <ul>
        <li><b>큰 스택</b>: 숏스택을 압박. 공격적으로 쇼브 (ICM 압박).</li>
        <li><b>미디엄</b>: 숏이 탈락하기를 기다림. 큰 스택과의 충돌 피함.</li>
        <li><b>숏스택</b>: 생존이 최우선. 엄격한 푸시 레인지.</li>
      </ul>
      <h3>4. 실전 팁</h3>
      <p>버블에선 88조차 쇼브 콜이 -EV일 수 있습니다. 엄격한 레인지로 플레이하세요.</p>
    `
  }
];

function markLessonComplete(lessonId) {
  const profile = loadProfile();
  profile.lessonsCompleted = profile.lessonsCompleted || [];
  if (!profile.lessonsCompleted.includes(lessonId)) {
    profile.lessonsCompleted.push(lessonId);
    saveProfile(profile);
  }
}

// ============================================================
// 드릴
// ============================================================
const DRILL_MODES = [
  { id: 'preflop_open',     icon: '🎯', name: '프리플롭 오픈',      desc: '레이즈 없는 상황에서 오픈/폴드 결정',      color: '#3aa05a' },
  { id: 'shortstack',       icon: '⚡', name: '숏스택 푸시/폴드',   desc: '5~15BB에서 올인 vs 폴드',                color: '#b85420' },
  { id: 'preflop_vs_raise', icon: '⚔️', name: '레이즈 대응',        desc: '앞에서 레이즈가 나왔을 때',              color: '#7a5ac0' },
  { id: 'postflop',         icon: '🎲', name: '포스트플롭 에퀴티',  desc: '승률·팟오즈 기반 결정',                   color: '#5aa0c0' },
  { id: 'weak_spot',        icon: '🎯', name: '내 약점 공략',       desc: '내가 자주 틀리는 상황 위주',              color: '#c05a7a' }
];

let drillState = null;

function generatePreflopDrill(opts) {
  opts = opts || {};
  const positions = opts.positions || ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const pos = positions[Math.floor(Math.random() * positions.length)];
  const deck = new Deck();
  const hole = deck.deal(2);
  const [minS, maxS] = opts.stackRange || [20, 100];
  const stackBB = minS + Math.floor(Math.random() * (maxS - minS + 1));
  const raiseProb = opts.raiseProbability != null ? opts.raiseProbability : 0.2;
  const facing = Math.random() < raiseProb ? 'raise' : 'none';
  const handStr = handToString(hole[0], hole[1]);
  const rec = preflopRecommendation(handStr, pos, stackBB, facing);

  return {
    category: 'preflop',
    hole: hole,
    handStr,
    position: pos,
    stackBB,
    facing,
    correctAction: rec.action,
    explanation: rec.reason,
    label: rec.label
  };
}

function generatePostflopDrill() {
  const deck = new Deck();
  const hole = deck.deal(2);
  const boardLen = [3, 3, 3, 4, 5][Math.floor(Math.random() * 5)]; // 플롭 편향
  const board = deck.deal(boardLen);
  const bb = 20;
  const potBB = 3 + Math.floor(Math.random() * 20);
  const pot = potBB * bb;
  const toCall = Math.random() < 0.3 ? 0 : Math.floor(pot * (0.25 + Math.random() * 0.75));
  const stackBB = 30 + Math.floor(Math.random() * 50);
  const positions = ['CO', 'BTN', 'SB', 'BB'];
  const position = positions[Math.floor(Math.random() * positions.length)];

  const rec = computeRecommendation({
    hole, board, position, stackBB,
    toCall, pot, activeOpp: 1, bb,
    iterations: 800
  });

  return {
    category: 'postflop',
    hole, board, position, stackBB,
    pot, toCall, bb,
    correctAction: rec.action,
    equity: rec.equity,
    potOdds: rec.potOdds,
    explanation: rec.reason,
    label: rec.label,
    street: board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river'
  };
}

function generateDrillQuestions(mode, count) {
  count = count || 10;
  const qs = [];
  for (let i = 0; i < count; i++) {
    if (mode === 'preflop_open')       qs.push(generatePreflopDrill({ stackRange: [25, 80], raiseProbability: 0 }));
    else if (mode === 'shortstack')    qs.push(generatePreflopDrill({ stackRange: [5, 15], raiseProbability: 0.25 }));
    else if (mode === 'preflop_vs_raise') qs.push(generatePreflopDrill({ stackRange: [25, 80], raiseProbability: 1 }));
    else if (mode === 'postflop')      qs.push(generatePostflopDrill());
    else if (mode === 'weak_spot') {
      const p = loadProfile();
      const tm = topMistakes(p, 3);
      if (tm.length === 0) qs.push(generatePreflopDrill({}));
      else {
        const m = tm[i % tm.length];
        if (m.category === 'preflop') qs.push(generatePreflopDrill({}));
        else qs.push(generatePostflopDrill());
      }
    }
  }
  return qs;
}

function startDrillSession(mode) {
  const questions = generateDrillQuestions(mode, 10);
  drillState = {
    mode, questions,
    currentIdx: 0,
    correctCount: 0,
    partialCount: 0,
    answered: false,
    startedAt: Date.now(),
    finished: false
  };
  renderDrillView();
  showTrainingSub('drill');
}

function answerDrill(action) {
  if (!drillState || drillState.answered) return;
  const q = drillState.questions[drillState.currentIdx];
  const ev = evaluateDecision(q.correctAction, action);
  q.userAnswer = action;
  q.result = ev;
  if (ev.correct) drillState.correctCount++;
  else if (ev.partial) drillState.partialCount++;
  drillState.answered = true;
  renderDrillView();
}

function nextDrillQuestion() {
  if (!drillState) return;
  drillState.currentIdx++;
  drillState.answered = false;
  if (drillState.currentIdx >= drillState.questions.length) {
    finishDrillSession();
  } else {
    renderDrillView();
  }
}

function finishDrillSession() {
  const total = drillState.questions.length;
  const correct = drillState.correctCount;
  const partial = drillState.partialCount;
  const acc = (correct + partial * 0.5) / total;

  const profile = loadProfile();
  profile.drillSessions = (profile.drillSessions || 0) + 1;
  profile.drillQuestions = (profile.drillQuestions || 0) + total;
  profile.drillCorrect = (profile.drillCorrect || 0) + correct;

  // 드릴 결과도 프로필 정답률에 반영
  profile.totalDecisions = (profile.totalDecisions || 0) + total;
  profile.correctDecisions = (profile.correctDecisions || 0) + correct;
  profile.partialDecisions = (profile.partialDecisions || 0) + partial;

  const newAch = checkAchievements(profile);
  saveProfile(profile);

  drillState.finished = true;
  drillState.accuracy = acc;
  drillState.unlocked = newAch;

  // 업적 토스트
  for (const a of newAch) showToast(`${a.icon} 업적 달성!`, `<b>${a.name}</b><br>${a.desc}`, 6000);

  renderDrillView();
}

// ============================================================
// 렌더링
// ============================================================
function showTrainingSub(which) {
  ['training-hub', 'training-drill', 'training-lesson', 'training-achievements'].forEach(id => {
    const e = document.getElementById(id);
    if (!e) return;
    e.style.display = (id === 'training-' + which) ? '' : 'none';
  });
}

function renderTrainingHub() {
  const root = document.getElementById('training-hub');
  if (!root) return;
  const profile = loadProfile();
  const rank = getRank(profile);
  const acc = calculateAccuracy(profile);

  // 다음 추천 드릴
  const recommended = pickRecommendedDrill(profile);

  root.innerHTML = `
    <div class="training-banner">
      <div class="training-banner-left">
        <div class="rank-badge small" style="border-color:${rank.color}; color:${rank.color}">${rank.icon}</div>
        <div>
          <div style="font-size:18px; font-weight:800; color:${rank.color}">${rank.name}</div>
          <div class="muted">누적 ${profile.totalHands}핸드 · 정답률 ${(acc * 100).toFixed(0)}% · 드릴 ${profile.drillSessions || 0}회</div>
        </div>
      </div>
      <div class="training-banner-right">
        <div class="reco-card" onclick="startDrillSession('${recommended.id}')">
          <div class="muted">추천 드릴</div>
          <div style="font-weight:700; color:${recommended.color}">${recommended.icon} ${recommended.name}</div>
          <div class="muted" style="font-size:11px">${recommended.reason}</div>
        </div>
      </div>
    </div>

    <h2>훈련 드릴 (10문제)</h2>
    <div class="drill-grid">
      ${DRILL_MODES.map(m => `
        <div class="drill-mode-card" onclick="startDrillSession('${m.id}')" style="border-left:4px solid ${m.color}">
          <div class="drill-mode-icon">${m.icon}</div>
          <div class="drill-mode-name">${m.name}</div>
          <div class="drill-mode-desc muted">${m.desc}</div>
        </div>
      `).join('')}
    </div>

    <h2>교과 과정</h2>
    <div class="lesson-list">
      ${LESSONS.map(l => {
        const done = (profile.lessonsCompleted || []).includes(l.id);
        return `
        <div class="lesson-card ${done ? 'done' : ''}" onclick="openLesson('${l.id}')">
          <div class="lesson-level">${l.level} · ${l.duration}</div>
          <div class="lesson-title">${done ? '✓ ' : ''}${l.title}</div>
          <div class="lesson-summary muted">${l.summary}</div>
        </div>`;
      }).join('')}
    </div>

    <h2>업적 <span class="muted" style="font-size:12px">(${(profile.achievements || []).length}/${ACHIEVEMENTS.length})</span></h2>
    <div class="achievement-grid">
      ${ACHIEVEMENTS.map(a => {
        const unlocked = (profile.achievements || []).includes(a.id);
        return `
        <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
          <div class="ach-icon">${unlocked ? a.icon : '🔒'}</div>
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc muted">${a.desc}</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

function pickRecommendedDrill(profile) {
  const tm = topMistakes(profile, 1);
  if (tm.length > 0) return { ...DRILL_MODES.find(m => m.id === 'weak_spot'), reason: '최근 자주 틀리는 상황 집중' };
  if ((profile.totalHands || 0) < 30) return { ...DRILL_MODES.find(m => m.id === 'preflop_open'), reason: '기본기 다지기' };
  if ((profile.postflopDecisions || 0) < 30) return { ...DRILL_MODES.find(m => m.id === 'postflop'), reason: '포스트플롭 보강' };
  const preAcc = profile.preflopDecisions > 0 ? profile.preflopCorrect / profile.preflopDecisions : 0;
  if (preAcc < 0.8) return { ...DRILL_MODES.find(m => m.id === 'shortstack'), reason: '숏스택 푸시 레인지 강화' };
  return { ...DRILL_MODES.find(m => m.id === 'preflop_vs_raise'), reason: '레이즈 대응 레인지 연마' };
}

function renderDrillView() {
  const root = document.getElementById('training-drill');
  if (!root || !drillState) return;

  if (drillState.finished) {
    const total = drillState.questions.length;
    const acc = drillState.accuracy;
    const pctText = (acc * 100).toFixed(0);
    let grade = 'ㅠ', gradeColor = '#ff8c8c';
    if (acc >= 0.9) { grade = 'S'; gradeColor = '#ffd97a'; }
    else if (acc >= 0.75) { grade = 'A'; gradeColor = '#8fe8a5'; }
    else if (acc >= 0.6) { grade = 'B'; gradeColor = '#bcd4f6'; }
    else if (acc >= 0.4) { grade = 'C'; gradeColor = '#ffb3b3'; }

    root.innerHTML = `
      <button class="ghost" onclick="backToTrainingHub()">◀ 훈련 허브</button>
      <div class="drill-summary">
        <div class="drill-grade" style="color:${gradeColor}">${grade}</div>
        <h2>세션 완료</h2>
        <div style="font-size:20px">정답률 <b style="color:${gradeColor}">${pctText}%</b></div>
        <div class="muted">${drillState.correctCount}정답 · ${drillState.partialCount}유사 · ${total - drillState.correctCount - drillState.partialCount}오답</div>
        ${(drillState.unlocked && drillState.unlocked.length) ? `
          <div class="drill-unlocks">
            ${drillState.unlocked.map(a => `<div class="mini-ach">${a.icon} ${a.name}</div>`).join('')}
          </div>` : ''}
        <div class="drill-review">
          ${drillState.questions.map((q, i) => {
            const ok = q.result && q.result.correct;
            const ok2 = q.result && q.result.partial;
            return `<div class="drill-review-row ${ok ? 'good' : ok2 ? 'ok' : 'bad'}">
              <span>#${i + 1}</span>
              <span>${q.category === 'preflop' ? (q.position + ' · ' + handToString(q.hole[0], q.hole[1]) + ' · ' + q.stackBB + 'BB') : (q.position + ' · 보드 ' + q.board.length + '장')}</span>
              <span>권장 ${shortAct(q.correctAction)} → 내 답 ${shortAct(q.userAnswer)}</span>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex; gap:10px; margin-top:16px">
          <button class="primary" onclick="startDrillSession('${drillState.mode}')">같은 모드 다시</button>
          <button onclick="backToTrainingHub()">허브로</button>
        </div>
      </div>
    `;
    return;
  }

  const q = drillState.questions[drillState.currentIdx];
  const idx = drillState.currentIdx;
  const total = drillState.questions.length;
  const progress = ((idx / total) * 100).toFixed(0);

  let situationHtml = '';
  let boardHtml = '';
  if (q.category === 'preflop') {
    const facingText = q.facing === 'raise' ? `앞에서 레이즈 나옴 (콜 약 ${(q.stackBB >= 30 ? 2.5 : 2) * 20}~${5 * 20})` : '레이즈 없음 (블라인드만)';
    situationHtml = `
      <div class="drill-situation">
        <div class="ds-row"><span class="ds-label">포지션</span><b>${q.position}</b></div>
        <div class="ds-row"><span class="ds-label">스택</span><b>${q.stackBB}BB</b></div>
        <div class="ds-row"><span class="ds-label">상황</span><b>${facingText}</b></div>
      </div>
    `;
  } else {
    situationHtml = `
      <div class="drill-situation">
        <div class="ds-row"><span class="ds-label">포지션</span><b>${q.position}</b></div>
        <div class="ds-row"><span class="ds-label">스택</span><b>${q.stackBB}BB</b></div>
        <div class="ds-row"><span class="ds-label">팟</span><b>${q.pot.toLocaleString()}</b></div>
        <div class="ds-row"><span class="ds-label">콜 필요</span><b>${q.toCall.toLocaleString()}${q.toCall > 0 ? ' (팟오즈 ' + ((q.toCall / (q.pot + q.toCall)) * 100).toFixed(1) + '%)' : ''}</b></div>
      </div>
    `;
    boardHtml = `<div class="drill-board"><div class="muted" style="font-size:12px">보드</div><div class="board-cards">${q.board.map(c => cardHtml(c)).join('')}</div></div>`;
  }

  const buttons = drillActionButtons(q);

  let feedbackHtml = '';
  if (drillState.answered) {
    const ok = q.result.correct;
    const ok2 = q.result.partial;
    const cls = ok ? 'good' : ok2 ? 'ok' : 'bad';
    const icon = ok ? '✓ 정답' : ok2 ? '△ 유사' : '✗ 오답';
    let extra = '';
    if (q.category === 'postflop' && q.equity != null) {
      extra = `<div class="muted" style="margin-top:6px">승률 ${(q.equity * 100).toFixed(1)}% · 팟오즈 ${(q.potOdds * 100).toFixed(1)}%</div>`;
    }
    feedbackHtml = `
      <div class="drill-feedback ${cls}">
        <div class="fb-icon">${icon}</div>
        <div>권장: <b>${q.label}</b></div>
        <div class="muted">${q.explanation || ''}</div>
        ${extra}
      </div>
      <button class="primary big" onclick="nextDrillQuestion()">다음 →</button>
    `;
  }

  root.innerHTML = `
    <button class="ghost" onclick="backToTrainingHub()">◀ 훈련 허브</button>
    <div class="drill-card">
      <div class="drill-header">
        <div class="drill-title">${DRILL_MODES.find(m => m.id === drillState.mode).name}</div>
        <div class="drill-counter">${idx + 1} / ${total} · 정답 ${drillState.correctCount}</div>
      </div>
      <div class="drill-progress"><div class="drill-progress-bar" style="width:${progress}%"></div></div>

      ${situationHtml}
      ${boardHtml}

      <div class="drill-hand-label">내 핸드</div>
      <div class="drill-hand">
        ${cardHtml(q.hole[0])}
        ${cardHtml(q.hole[1])}
      </div>

      <div class="drill-question">무엇을 해야 할까요?</div>
      <div class="drill-actions ${drillState.answered ? 'disabled' : ''}">
        ${buttons}
      </div>

      ${feedbackHtml}
    </div>
  `;
}

function cardHtml(c) {
  const card = c instanceof Card ? c : new Card(c.rank, c.suit);
  return `<div class="card ${card.isRed ? 'red' : 'black'}"><span class="rank">${card.rankStr}</span><span class="suit">${card.suitSym}</span></div>`;
}

function drillActionButtons(q) {
  // 상황에 따라 4개 버튼 표시
  const disabled = drillState.answered ? 'disabled' : '';
  const mark = (act) => drillState.answered && q.userAnswer === act ? 'selected' : '';
  const correct = (act) => drillState.answered && q.correctAction === act ? 'correct' : '';

  if (q.category === 'preflop') {
    const hasRaise = q.facing === 'raise';
    return [
      `<button ${disabled} class="drill-btn fold ${mark('fold')} ${correct('fold')}" onclick="answerDrill('fold')">폴드</button>`,
      `<button ${disabled} class="drill-btn call ${mark('call')} ${correct('call')}" onclick="answerDrill('call')">${hasRaise ? '콜' : '콜(림프)'}</button>`,
      `<button ${disabled} class="drill-btn raise ${mark('raise')} ${correct('raise')}" onclick="answerDrill('raise')">레이즈</button>`,
      `<button ${disabled} class="drill-btn allin ${mark('push')} ${correct('push')} ${mark('allin')} ${correct('allin')}" onclick="answerDrill('push')">올인/푸시</button>`
    ].join('');
  }
  const checkCall = q.toCall > 0 ? '콜' : '체크';
  const ccAction = q.toCall > 0 ? 'call' : 'check';
  const betRaise = q.toCall > 0 ? '레이즈' : '베팅';
  const brAction = q.toCall > 0 ? 'raise' : 'bet';
  return [
    `<button ${disabled} class="drill-btn fold ${mark('fold')} ${correct('fold')}" onclick="answerDrill('fold')">폴드</button>`,
    `<button ${disabled} class="drill-btn call ${mark(ccAction)} ${correct(ccAction)}" onclick="answerDrill('${ccAction}')">${checkCall}</button>`,
    `<button ${disabled} class="drill-btn raise ${mark(brAction)} ${correct(brAction)}" onclick="answerDrill('${brAction}')">${betRaise}</button>`,
    `<button ${disabled} class="drill-btn allin ${mark('allin')} ${correct('allin')}" onclick="answerDrill('allin')">올인</button>`
  ].join('');
}

function shortAct(a) {
  const m = { fold: '폴드', check: '체크', call: '콜', bet: '베팅', raise: '레이즈', allin: '올인', push: '푸시' };
  return m[a] || a || '-';
}

function backToTrainingHub() {
  renderTrainingHub();
  showTrainingSub('hub');
  drillState = null;
}

// 레슨 열기
function openLesson(id) {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) return;
  const root = document.getElementById('training-lesson');
  root.innerHTML = `
    <button class="ghost" onclick="backToTrainingHub()">◀ 훈련 허브</button>
    <article class="lesson-article">
      <div class="lesson-meta">${lesson.level} · ${lesson.duration}</div>
      <h1>${lesson.title}</h1>
      <div class="lesson-body">${lesson.content}</div>
      <button class="primary big" onclick="completeLesson('${id}')">✓ 레슨 완료</button>
    </article>
  `;
  showTrainingSub('lesson');
}

function completeLesson(id) {
  markLessonComplete(id);
  const profile = loadProfile();
  const newAch = checkAchievements(profile);
  saveProfile(profile);
  for (const a of newAch) showToast(`${a.icon} 업적 달성!`, `<b>${a.name}</b><br>${a.desc}`, 6000);
  backToTrainingHub();
}

// 훈련 화면 진입
function openTraining() {
  showScreen('training');
  renderTrainingHub();
  showTrainingSub('hub');
}
