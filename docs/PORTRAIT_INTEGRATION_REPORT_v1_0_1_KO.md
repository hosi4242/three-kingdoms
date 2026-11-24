# 초상화 통합·검사 보고서 — 삼국지: 천하패권 v1.0.1

## 1. 결론 (먼저 읽어 주세요)

| 요청 항목 | 상태 |
|---|---|
| 미완성 장수 30명 초상화 제작 (손권·주유·동탁 샘플 → 나머지 27명) | **미완료.** 이 작업 환경에는 이미지 생성 도구가 없어 기존 시트 수준의 반실사 회화 초상화를 만들 수 없었습니다. 임시 그림을 만들어 끼워 넣으면 화풍이 깨지므로 넣지 않았습니다. |
| 총 60명 초상화 완성 | **미달성 (30/60).** 나머지 30명은 이름 첫 글자 대체 표시로 동작합니다. |
| 파일명·경로 규칙 적용 | 완료 (도구와 검사로 `gen_XXX.webp` ↔ 장수 ID 일대일 확인, 규격 256×320 WebP 자동 검사) |
| 도감·상세·모집 결과·전투 편성 화면 적용 | 완료 (모집 결과, 전투 편성, 라운드 출전 선택은 이번에 신규 적용) |
| 이미지 실패 시 대체 표시 | 완료 (강제 로드 실패로 검증) |
| 브라우저/Android 동일 반영 | 완료 (파일 목록·내용 일치 검사 통과) |
| PWA 캐시 갱신 | 완료 (v1.0.1, `portrait.js` 추가, 실제 존재하는 초상화 30개만 목록에 등록) |
| 기존 기능·저장 데이터 유지 | 완료 (아래 3항) |
| 자동 기술검사 | 통과 (`docs/VERIFY_LOG_v1_0_1.txt`) |
| 모바일 화면 확인 | 360/390/430px 에뮬레이션 42항목 통과 (`docs/mobile-check/`). **실제 Android 기기 테스트는 하지 않았습니다.** |
| 60명 연락 시트·검사 보고서 | 완료 (제작된 30명 + 미제작 30칸 표시) |
| GitHub Desktop 업로드 스크립트 | 포함 (`UPLOAD_TO_GITHUB_WINDOWS.bat/.ps1`, v1.0.1 문구로 갱신) |

## 2. 변경 내용

- `js/portrait.js` (신규): 공통 렌더러 `portraitHTML`, 로드 실패 대체 `installPortraitFallback`
- `js/app.js`: 공통 렌더러 사용, 전투 편성·라운드 선택에 초상화 추가, 기존 저장 데이터에 최신 초상화 경로 반영(`old.portrait=fresh.portrait`). 이 필드는 표시용 정적 값이며 능력치·진행도는 건드리지 않습니다.
- `js/recruit-ui.js`: 모집 결과 카드가 이름 첫 글자 대신 공통 렌더러 사용
- `styles.css`: 편성·선택 버튼용 크기 규칙 추가, 이미지 상단 기준 정렬
- `sw.js`: 캐시 버전 1.0.1, `js/portrait.js` 추가
- `tools/`: `apply-portraits.mjs`(이미지 투입 시 자동 연결), `test-portrait.mjs`, `mobile-portrait-test.py`, `make_contact_sheet.py`, `verify.mjs`에 초상화 검사 추가
- 버전: 1.0.0 → 1.0.1 (캐시 갱신용). **저장 형식 7 유지.**

## 3. 변경하지 않은 것 (원본 ZIP과 파일 비교로 확인)

`generals.js`, `recruit.js`, `combat.js`, `db.js`, `progression.js`, `equipment.js`, `campaign.js`, `missions.js`, `shop.js` 는 원본과 바이트 단위로 동일합니다. 기존 초상화 30개의 해시도 동일합니다. 따라서 능력치·전투 효과·모집 확률·저장 구조는 변경되지 않았습니다.

## 4. 검사 결과 요약

- 추가 점검: JS가 참조하는 HTML id 누락 0, 중복 id 0, JSON(manifest·capacitor·package) 유효, 초상화 합계 약 473KB(최대 21KB)
- 정적/회귀 검사: 모집 확률·10회 보장·저장 변환, 육성, 전투 효과, 장비, 전장, 임무, 상점, 초상화 렌더러 → 전체 통과, FAIL 0
- 초상화: 파일 연결 30/60, 연결된 30개 모두 오프라인 캐시 포함, 캐시 목록에 없는 파일·없는 파일 등록 0건
- 모바일 에뮬레이션(Chromium, 360/390/430px): 가로 넘침 없음, 도감 이미지 29장 정상 로드, 강제 실패 이미지(gen_002) 대체 표시 확인, 상세 초상화 화면 안 배치, 전투 편성·라운드 선택·모집 결과(1회/10회) 표시, 콘솔 오류 없음

## 5. 미검증 항목

- 실제 Android 기기·APK 설치 상태에서의 표시와 터치 (미실시)
- 서비스워커 오프라인 동작을 실제 기기에서 확인하는 것 (정적 목록 검사만 실시)
- 60명 전체 초상화 기준의 화면 검사 (30명 분량은 제작되지 않아 대체 표시로만 확인)
- 새 초상화 30개의 화풍·얼굴 왜곡 검수 (이미지가 없어 해당 없음)

## 6. 남은 작업

(추가 자료: 30명 생성 프롬프트 `docs/portrait-reference/PORTRAIT_PROMPTS_30_KO.md`, 외부 검토용 `docs/CHATGPT_REVIEW_BRIEF_v1_0_1_KO.md`)

1. 30명 이미지를 별도 이미지 생성 도구로 만들어 `gen_021.webp` 등으로 저장 (가이드 `docs/portrait-reference/CLAUDE_PORTRAIT_GENERATION_GUIDE_KO.md` 참고)
2. `node tools/apply-portraits.mjs` → `node tools/verify.mjs` → `python tools/mobile-portrait-test.py`
3. 60/60이 되면 `python tools/make_contact_sheet.py` 로 연락 시트를 다시 만들고 실제 기기에서 확인
