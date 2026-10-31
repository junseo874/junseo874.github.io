# 웹 작업 안내

현재 작업 대상은 이 정적 웹 저장소다. 상위 디렉터리의 Unity 엔진·원본 아트는 요청 없이 수정하지 않는다.

## 최소 탐색

- 본편 규칙의 정본은 `docs/gameplay/README.md`다. 사건은 `docs/gameplay/events.md`, CSV·대화 연결은 `docs/gameplay/data-and-dialogue.md`를 따른다. 현재 웹 본편을 기준으로 하며 개발자/검수 전용 기능이나 과거 기획을 본편 규칙으로 혼합하지 않는다. 규칙 변경 시 해당 문서와 테스트를 함께 갱신한다.
- 먼저 `docs/architecture/README.md`의 수정 지점 표를 읽고 해당 기능 폴더만 검색한다.
- `node tools/locate.cjs <기능명|파일명|함수명>`으로 현재 소유 파일부터 찾는다. `--symbols`도 출력 제한을 유지하며, `--all`은 필요할 때만 쓴다.
- `rg`는 기본적으로 `bar-playtest/src/<해당 영역>`에서 시작한다. 저장소 전체 검색이 필요하면 `data/`, `assets/`, `docs/history/`, `artifacts/`, `archives/`를 제외한다.
- `data/runtime/`에는 큰 생성 데이터가 있다. 전체 파일을 출력하지 말고 필요한 객체/키만 Node로 읽는다.
- 과거 전체 변경 기록 대신 현재 구조 안내를 읽는다. 이동된 파일은 `docs/architecture/path-migrations.json`의 해당 키만 조회한다.
- 기존 사용자 변경을 보존한다. 외부 원본·생성 데이터를 임의로 재수입하지 않는다.

## 코드와 경로

- 본편 코드는 `bar-playtest/src/`의 기능 폴더에 둔다. 동일 UI의 JS/CSS는 같은 폴더에 둔다.
- `core/core.js`는 상태·초기화·공통 tick·모듈 조립을 소유한다. 대사·손님·제조·정산 로직을 다시 모으지 않는다. 분리 방식과 상태 소유권은 `docs/architecture/modules.md`를 따른다.
- 인라인 소스맵·대형 이미지 데이터는 실행 코드에 넣지 않는다. 컷씬 아틀라스는 `data/runtime/cinema-assets.js`다.
- 새 파일은 소문자 kebab-case. 변경 날짜를 실행 파일명에 붙이지 않는다.
- 현재는 순서 의존성이 있는 classic script다. HTML의 로딩 순서를 바꾸거나 `async`/`defer`/ESM을 섞지 않는다.
- JS의 이미지 URL은 HTML 기준, CSS `url()`은 CSS 파일 기준이다. `document.currentScript` 기반 경로는 이동할 때 별도로 검증한다.
- 공개 HTML 주소, 세이브 키, 캐릭터/아이템/리소스 ID는 파일명과 다르다. 경로 정리 목적으로 ID를 바꾸지 않는다.
- 리소스 교체는 `bar-playtest/assets/README.md`를 따른다. 원본 이미지와 음원을 재인코딩하지 않는다.

## 확인

- `node tools/check-structure.cjs`와 `node tools/check-site.cjs`를 실행한다.
- `node tools/check-code-boundaries.cjs`와 `node tools/test-source-index.cjs`로 모듈 설치·중복·탐색 경로를 확인한다.
- `node tools/run-tests.cjs smoke`가 기본 회귀 묶음이다. UI를 건드렸다면 `ui`, 외부는 `outside`, 컷씬은 `cinema` 묶음도 실행한다.
- 테스트에 필요한 Playwright/Sharp/브라우저 설정은 `tools/lib/test-runtime.cjs`와 테스트 안내를 참고한다.
- 변경 전부터 실패하던 테스트를 이번 작업의 성공으로 보고하지 않는다. 실패 기대값을 무조건 바꾸지 말고 원인·변경 전 재현 여부를 구분한다.
