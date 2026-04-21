# 홀덤 마스터 (PokerMaster)

로컬에서 실행되는 No-Limit Texas Hold'em 토너먼트 게임 + 복기 분석 + AI 코치 교육 프로그램.

## 기능

- **토너먼트 플레이**: 2~6인 6-max, 4등급 AI (초급/중급/고급/마스터)
- **실시간 코칭**: 내 액션 전 권장 액션, 팟 오즈, 몬테카를로 승률 표시
- **핸드 복기**: 종료된 핸드를 스텝별로 재생하며 매 결정에 대한 분석
- **훈련 모드**:
  - 드릴 5종 (프리플롭 오픈 / 숏스택 / vs 레이즈 / 포스트플롭 / 약점 공략)
  - 교과 과정 6개 (포지션·레인지·팟오즈·푸시폴드·C-Bet·ICM)
  - 업적 15개
  - 랭크 시스템: 브론즈 → 실버 → 골드 → 플래티넘 → 다이아 → 마스터
- **AI 코치 (OpenRouter)**: 현재 상황을 자동 컨텍스트로 주입해 자유로운 질문 가능
- **속도 조절**: 매우 느리게 ~ 즉시, 핸드마다 정지 옵션

## 실행 방법

```bash
cd PokerMaster
python3 -m http.server 8765
```

브라우저에서 http://localhost:8765 접속.

## 파일 구조

- `index.html`, `styles.css` — UI
- `js/cards.js` — Card/Deck/핸드 평가기
- `js/equity.js` — 몬테카를로 승률 계산
- `js/ranges.js` — 프리플롭 레인지 (오픈, 푸시/폴드)
- `js/coach.js` — 프로필/랭크/권장 로직
- `js/ai.js` — AI 봇 의사결정 (4등급)
- `js/engine.js` — 토너먼트/핸드 상태 머신
- `js/ui.js` — 테이블·액션 패널 렌더링
- `js/review.js` — 핸드 복기
- `js/training.js` — 드릴·레슨·업적
- `js/aicoach.js` — OpenRouter 기반 실시간 AI 코치
- `js/app.js` — 엔트리/이벤트 연결

## AI 코치 설정

AI 코치는 OpenRouter API를 사용합니다. 세 가지 방법 중 선택:

**방법 1: Vercel 배포 + 환경변수 (가장 안전, 사용자는 키 몰라도 됨)**

1. 이 저장소를 Vercel에 연결해 배포
2. Vercel 대시보드 → Project Settings → Environment Variables
3. 추가: `OPENROUTER_API_KEY` = `sk-or-v1-...`
4. 재배포 → `/api/openrouter` 서버리스 함수가 키를 서버에서 사용
5. 모든 방문자는 키 입력 없이 AI 사용 가능 (키는 클라이언트에 노출 X)

**방법 2: 로컬 config 파일 (로컬 개발)**

```bash
cp js/config.example.js js/config.local.js
# 에디터로 js/config.local.js 열어서 OPENROUTER_API_KEY 입력
```

`config.local.js`는 `.gitignore`에 의해 GitHub에 푸시되지 않습니다.

**방법 3: UI 입력 (localStorage, GitHub Pages 등)**

AI 코치 패널이나 로그 채팅에서 키 입력 폼 자동 표시. 브라우저 localStorage에만 저장.

우선순위: **서버리스 프록시 → 로컬 config → localStorage** (자동 폴백)

API 키 발급: [openrouter.ai/keys](https://openrouter.ai/keys)

## 데이터 저장

모든 프로필/토너먼트 기록은 브라우저 localStorage에 저장됩니다.
