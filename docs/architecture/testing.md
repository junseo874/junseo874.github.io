# 검증 방법

플레이 결과의 기준은 [본편 구현 확정 기준](../gameplay/README.md)과 [사건별 흐름](../gameplay/events.md)입니다. 테스트는 이 기준의 검증 자료이며 개발자/QA에서 강제로 만든 상태를 본편 규칙으로 정의하지 않습니다. 데이터 수정 시 [CSV 변경 순서](../gameplay/data-and-dialogue.md#안전한-변경-순서)를 함께 따릅니다.

## 실행

먼저 저장소 루트에서 `python3 serve.py`로 8123 포트의 정적 서버를 실행합니다. 게임 배포에는 Node나 테스트 의존성이 필요하지 않습니다.

```sh
node tools/check-structure.cjs
node tools/check-site.cjs
node tools/check-code-boundaries.cjs
node tools/test-source-index.cjs
node tools/run-tests.cjs smoke
node tools/run-tests.cjs ui
node tools/run-tests.cjs outside
node tools/run-tests.cjs cinema
node tools/run-tests.cjs craft
node tools/run-tests.cjs site
```

`npm run check`, `npm test`도 같은 명령을 실행합니다. 개별 테스트는 `node tools/run-tests.cjs bar-playtest/tests/<파일>.cjs` 또는 직접 Node로 실행할 수 있습니다.

## 의존성

UI 테스트에는 Playwright와 Chrome/Chromium, 이미지 검증에는 Sharp가 필요합니다. `tools/lib/test-runtime.cjs`가 로컬 설치를 먼저 찾고, 없으면 기존 Codex의 번들 런타임을 찾습니다. 필요하면 `PLAYWRIGHT_MODULE`, `SHARP_MODULE`, `CHROME_PATH`로 지정합니다. 브라우저가 별도로 설치된 Playwright를 쓴다면 `CHROME_PATH` 없이 기본 브라우저를 사용할 수 있습니다.

대부분의 기존 UI 테스트는 `127.0.0.1:8123`을 사용합니다. 변경 전부터 있던 테스트의 게임 진행 기대값을 리팩토링에 맞추려는 이유로 바꾸지 않습니다.

## 검사 범위

- **구조**: 공개 진입 페이지 유지, 스크립트/CSS 로딩 순서, JS 문법, 앱 루트에 코드가 다시 쌓이지 않는지 확인.
- **모듈 경계**: Game/Campaign 기능 메서드의 설치·중복·속성 일치, 실행 코드의 대형 인라인 데이터·소스맵 재유입, 기능 탐색 경로 확인. 테스트 때문에 Babel이나 번들러를 추가로 설치할 필요는 없습니다.
- **정적 자원**: HTML/CSS의 실제 파일 경로·대소문자, 폰트, 테이블 등록 이미지, BGM, 배포 불가능한 심볼릭 링크 검사.
- **스모크**: 상점, 첫날 튜토리얼, 등록 리소스, 거리, 제공 화면의 대표 흐름.
- **UI**: 여러 화면 크기/DPR의 16:9 경계·팝업·상호작용 안내·코스터·설정.
- **외부**: 본편/개발자, 일차·출퇴근 조합, 상점·불량배·자동 대화·이동 메뉴.
- **컷씬**: 본편 13개 미리보기와 상태 복귀, 편집기 모델·재생.
- **제조**: 제공 애니메이션/대체 이미지/거품·탄산/따르기.

새 스크립트를 의도적으로 추가했을 때만 `node tools/check-structure.cjs --record-entrypoints`로 로딩 계약을 갱신하고, 순서 변경을 검토합니다. 단순 경고를 숨기기 위해 갱신하지 않습니다.

## 변경 전 기준

2026-10-31 컷씬 문장부호 간격 검수에서 추가한 `test_intro_text_ui.cjs`는 현재 안내문과 다른 옛 기대 문구를 수정한 뒤, `StudioModel.validate`의 기존 배경 레이어 오류에서 멈췄다. `house-home-city` / `opening-home-home-city`의 레이어는 -11이고 편집기 검증은 -10~10만 허용한다. 변경 전 `HEAD`의 `opening-template.js`·`tags.js`를 브라우저에 제공해도 같은 오류가 재현된다. 배경이나 검증 범위를 이번 타이핑 작업에서 변경하지 않는다. 실제 도입부 네 문장과 크리스 통화 다섯 줄의 출력·마침표 대기·입력 제한은 별도 `test-cinema-typing-rhythm-ui.cjs`로 검사한다.

2026-10-31 모듈 분리 검수: 구조·정적 자원·모듈 경계·소스 탐색 검사와 `smoke`, `outside`, `cinema`, `site` 묶음은 통과했습니다. Game 공개 API·93개 prototype 멤버의 본문/속성 및 기존 스크립트의 상대 순서를 변경 전 작업 사본과 비교했습니다. 컷씬 이미지 스냅샷은 설명 주석을 제외한 원본 데이터가 동일합니다.

`ui`는 엘리베이터 착지 직후 입력 검사가 병렬 실행 중 한 번 실패했으며, 변경 전 소스 비교 실행과 변경 후 단독 재실행은 모두 통과했습니다. `craft`는 제조시간 UI 검사(`test-craft-clock-ui.cjs`)의 스터 시작/시간 증가 대기에서 실패했고 나머지는 통과했습니다. 해당 실패는 변경 전 코어를 브라우저에 제공해도 동일하게 재현되어 미해결 상태로 남깁니다. 테스트 기대값을 낮추거나 게임 동작을 바꿔 통과 처리하지 않았습니다.

일반 손님 비주시 진행은 `test-general-offscreen.cjs` (`smoke` 포함)에서 확인한다. 주문·반응·판매/환불·재주문·복수 좌석·퇴장·중복 정산 방지·카메라 복귀·일시정지·부분 열람 기록을 검사한다. 2026-10-27 추가 검사에서 구형 `test_guest_spacing.cjs`의 B 영업 첫 큐 수 기대값(1명, 실제 2명)은 변경 전 `HEAD` 코어에서도 동일하게 실패했으며 이번 자동 진행 수정과 구분한다.

2026-10-19 구조 정리 전에 `test_core.cjs`는 **24개 그룹 통과, 10개 그룹 실패**였습니다. 실패는 예전 해금 수량·기믹 입력·일차 진행 기대값 등에서 재현되었습니다. 이 오래된 전체 코어 테스트는 기본 smoke 묶음에서 제외하되 파일은 보존합니다. 현재 첫날 흐름과 개별 제조 기능은 전용 테스트로 검증합니다. 전체 테스트가 모두 통과한다고 간주하지 않습니다.

2026-10-27 바 QA 대화형 메뉴 변경 검수: `smoke`와 두 바 QA 테스트는 통과했습니다. `ui`의 `test-lift-lock-recipe-escape-ui.cjs`는 착지 후 새 이동 입력 검사에서 실패했고, 변경 전 `app.js`·`qa-lab.js`·`bar-qa-presets.js`를 브라우저에 제공한 비교 실행에서도 같은 실패가 재현되었습니다. 별도 구형 `test_outside_qa_tab_ui.cjs` 역시 변경 전후 모두 현재 없는 `[data-outside-action="exit"]`를 기다리다 실패합니다. 현재 외부 QA의 리사이즈·Tab/Esc 검사는 `test-outside-resize-qa-ui.cjs`에서 통과했습니다. 위 두 기존 실패를 QA 메뉴 수정의 성공 항목으로 계산하지 않습니다.
