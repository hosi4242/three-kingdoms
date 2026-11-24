# 삼국지: 천하패권 v2.0.2 — 브라우저 + Android 프로젝트

## v1.0.0 주요 기능
- 장수 도감 60명, 이름 검색·세력/등급 필터, 상세 정보
- 장수 모집, 등급별 확률 및 10회 보장, 중복 장수 혼 조각 전환
- 장수 레벨 1~30, 경험치·경험서·각성 5단계
- 5개 장비 슬롯, 제작·장착·강화·분해 및 세트 효과
- 3명 출전, 3판 2선승 카드 전투, 장수별 상성·특성·필살기·약점
- 3개 캠페인 × 5개 스테이지, 잠금 해제 및 최초/반복 보상
- 누적 임무·업적 13종, 일회성 보상
- 금화로 이용하는 게임 내 상점 5종(현금 결제 없음)
- IndexedDB 저장, JSON 백업·복원, PWA 오프라인 캐시

## v1.0.1 초상화 통합 (30/60명 적용, 30명 미제작)

- 새 파일 `js/portrait.js`: 도감·상세·수련·**모집 결과·전투 편성·라운드 출전 선택** 화면이 같은 초상화 렌더러를 사용합니다. 이미지가 없거나 로드에 실패하면 이름 첫 글자 대체 표시로 돌아갑니다.
- 기존 저장 데이터를 열 때도 최신 초상화 경로가 반영됩니다. 능력치·모집 확률·전투 밸런스·저장 형식(7)은 바꾸지 않았습니다.
- **아직 초상화가 없는 장수 30명**(gen_021~024, 029, 032, 035, 036, 038, 039, 041~060)은 이 버전에 이미지가 포함되어 있지 않습니다. 이 환경에서는 기존 시트 수준의 회화풍 이미지를 만들 수 없어 임시 그림을 넣지 않았습니다.
- 이미지를 준비했다면: `browser-test/assets/portraits/` 에 `gen_021.webp` 처럼 **256×320 WebP**(권장 150KB 이하)로 넣고 `node tools/apply-portraits.mjs` → `node tools/verify.mjs` 를 실행하세요. 경로 연결·캐시 목록·Android 동기화를 자동으로 처리합니다.
- 연락 시트: `docs/portrait-reference/contact_sheet_60_status.jpg` (다시 만들기: `python tools/make_contact_sheet.py`)
- 상세 결과: `docs/PORTRAIT_INTEGRATION_REPORT_v1_0_1_KO.md`

## 장수 초상화 현황
- 장수 데이터는 60명입니다.
- 현재 포함된 초상화 파일은 30개이며, 나머지 30명은 임시 이름 첫 글자 표시를 사용합니다.
- 누락 대상과 모바일 UI 점검 결과는 `docs/UX_MOBILE_AUDIT_v1_0_0_KO.md`에 기록했습니다.
- 초상화가 추가되면 `browser-test/assets/portraits/`와 Android `www/assets/portraits/`를 함께 갱신하고 PWA `sw.js` 캐시 목록도 업데이트해야 합니다.

## 저장 데이터
- 현재 저장 형식: 7
- v1.0.0에서 저장 형식 6 → 7로 상점 구매 통계를 추가합니다.
- 기존 장수, 재화, 인벤토리, 전적, 전장 진행도, 업적, 모집 이력을 보존하도록 마이그레이션합니다.
- 브라우저 저장 공간과 Android 앱 저장 공간은 자동 동기화되지 않습니다. 버전 변경 전후 중요한 데이터는 게임 내 백업을 권장합니다.

## 기술 검사
- `node tools/verify.mjs` : JavaScript 문법, 장수 데이터, 버전, PWA 캐시, 브라우저/Android 소스 일치 및 회귀 테스트
- `node tools/test-shop.mjs` : 상점 구매·재화 차감·저장 형식 변환
- `node tools/test-missions.mjs` : 임무 진행도·일회성 보상·마이그레이션
- `node tools/test-campaign.mjs` : 전장 15단계·보상·잠금·적 팀
- `node tools/test-recruit.mjs`, `test-progression.mjs`, `test-combat.mjs`, `test-equipment.mjs` : 기존 기능 회귀 테스트
- 실제 모바일 브라우저·Android APK·기기별 UI 검증은 사용자 기기에서 별도로 진행해야 합니다.

## Windows PC에서 GitHub 업로드
1. ZIP을 PC에 내려받고 압축을 해제합니다.
2. `samgukji-cheonhap_v1_0_0_dual` 폴더 안의 `UPLOAD_TO_GITHUB_WINDOWS.bat`을 더블클릭합니다.
3. 스크립트는 PATH의 Git을 우선 찾고, 없으면 GitHub Desktop 설치 폴더의 내장 Git을 탐색합니다.
4. 커밋 작성자 이름/이메일이 비어 있으면 입력하고, GitHub 인증이 나오면 로그인합니다.
5. 완료 화면에 `main` 브랜치와 커밋 해시가 표시되면 업로드가 끝난 것입니다. Cloudflare는 기존 GitHub 연결 설정에 따라 자동 배포됩니다.

업로드 스크립트는 임시 폴더에 저장소를 복제한 뒤 지정된 프로젝트 폴더만 동기화합니다. 인증 또는 푸시 오류가 발생하면 오류와 진단용 임시 폴더 경로를 표시합니다.

## APK 빌드
Android APK는 이 ZIP만으로 생성된 상태가 아닙니다. Android Studio 및 Android SDK가 설치된 Windows 환경에서 `android-apk-project/BUILD_APK_WINDOWS.bat`을 사용해 별도로 빌드하고 실기기 설치를 검증해야 합니다.


## v2.0.1 첫 개발 단계
- 기존 게임을 유지하면서 4대4 AI 아레나를 별도 메뉴로 추가했습니다.
- 장수 카드에 HP·ATK·DEF·SPD 및 효과 상태를 표시합니다.
- 전투는 수치와 로그 중심이며, 카드 등장과 HP 변화에만 짧은 애니메이션을 사용합니다.
- 자세한 구현 범위와 미완료 항목은 `docs/V2_0_0_ARENA_FOUNDATION_KO.md`를 참고하세요.
