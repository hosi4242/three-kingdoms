# ChatGPT 검토 요청용 안내 (v1.0.1)

## 프로젝트 요약
- 삼국지: 천하패권 v1.0.1 — 오프라인 모바일 카드 배틀 게임 (브라우저 PWA + Capacitor Android). 저장 형식 7.
- 이번 버전의 변경: 초상화 공통 렌더러(`js/portrait.js`) 도입, 모집 결과·전투 편성·라운드 선택 화면에 초상화 적용, 기존 저장 데이터에 최신 초상화 경로 반영, 캐시 v1.0.1.

## 알려진 미완료 (숨기지 않고 명시)
1. 장수 30명 초상화 이미지 미제작 (60명 중 30명 완료). 대상 ID: gen_021~024, 029, 032, 035, 036, 038, 039, 041~060. 해당 장수는 이름 첫 글자로 표시됨.
2. 실제 Android 기기/APK 테스트 미실시. 모바일 확인은 Chromium 에뮬레이션(360/390/430px)만 수행.
3. 서비스워커 오프라인 동작은 정적 목록 검사만 수행 (기기 검증 없음).

## 검토를 부탁할 항목
- `browser-test/js/portrait.js`, `app.js`(normalizeState의 `old.portrait=fresh.portrait`), `recruit-ui.js` 변경의 결함·회귀 가능성
- 서비스워커: `cache.add`가 하나라도 404면 설치 실패 → 이미지 추가 시 `tools/apply-portraits.mjs`가 파일이 실제 있는 것만 목록에 넣는 설계의 타당성
- 로드 실패 fallback(캡처 단계 error 리스너)의 안정성, lazy loading 영향
- CSS(`.portrait-sm`, `.portrait-choice`)의 소형 화면 잘림
- `tools/verify.mjs`, `tools/test-portrait.mjs`가 놓치는 검사

## 검토 시 변경 금지
능력치, 전투 밸런스, 모집 확률, 저장 데이터 구조(저장 형식 7), 기존 초상화 30개 파일.

## 검사 방법
```
node tools/verify.mjs            # 전체 정적·회귀 검사
python tools/mobile-portrait-test.py   # (선택) Chromium 모바일 에뮬레이션
```
이미지 30개 준비 후: `node tools/apply-portraits.mjs` → 위 검사 재실행. 프롬프트: `docs/portrait-reference/PORTRAIT_PROMPTS_30_KO.md`.
