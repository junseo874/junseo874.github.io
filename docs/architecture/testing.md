# 검증 방법

## 실행

먼저 저장소 루트에서 `python3 serve.py`로 8123 포트의 정적 서버를 실행합니다. 게임 배포에는 Node나 테스트 의존성이 필요하지 않습니다.

```sh
node tools/check-structure.cjs
node tools/check-site.cjs
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
- **정적 자원**: HTML/CSS의 실제 파일 경로·대소문자, 폰트, 테이블 등록 이미지, BGM, 배포 불가능한 심볼릭 링크 검사.
- **스모크**: 상점, 첫날 튜토리얼, 등록 리소스, 거리, 제공 화면의 대표 흐름.
- **UI**: 여러 화면 크기/DPR의 16:9 경계·팝업·상호작용 안내·코스터·설정.
- **외부**: 본편/개발자, 일차·출퇴근 조합, 상점·불량배·자동 대화·이동 메뉴.
- **컷씬**: 본편 13개 미리보기와 상태 복귀, 편집기 모델·재생.
- **제조**: 제공 애니메이션/대체 이미지/거품·탄산/따르기.

새 스크립트를 의도적으로 추가했을 때만 `node tools/check-structure.cjs --record-entrypoints`로 로딩 계약을 갱신하고, 순서 변경을 검토합니다. 단순 경고를 숨기기 위해 갱신하지 않습니다.

## 변경 전 기준

2026-10-19 구조 정리 전에 `test_core.cjs`는 **24개 그룹 통과, 10개 그룹 실패**였습니다. 실패는 예전 해금 수량·기믹 입력·일차 진행 기대값 등에서 재현되었습니다. 이 오래된 전체 코어 테스트는 기본 smoke 묶음에서 제외하되 파일은 보존합니다. 현재 첫날 흐름과 개별 제조 기능은 전용 테스트로 검증합니다. 전체 테스트가 모두 통과한다고 간주하지 않습니다.
