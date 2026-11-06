# 웹 작업 안내

현재 작업 대상은 이 정적 웹 저장소다. 상위 디렉터리의 Unity 엔진·원본 아트는 요청 없이 수정하지 않는다.

## 엔진 데이터 계약 고정 (사용자 확정 · 2026-11-07)

- 모든 신규/수정 데이터와 이벤트는 현재 Unity 엔진의 기존 CSV 구조·필드 타입·명령 타입·조건/효과 문법을 그대로 사용한다. 기존 데이터 행과 지원 값의 조합으로 구현한다.
- 사용자 사전 승인 없이 테이블/열/타입/명령/데이터셋 계약을 신설·변경하거나 웹 전용 타입으로 우회하지 않는다. JSON 또는 `web_fields`에 새 게임 진행 규칙을 숨겨 같은 제한을 우회하지 않는다. 기존 표현 어댑터와 편집기 조회 키는 엔진 기능 지원의 근거가 아니다.
- 기존 구조로 동일 기능을 구현할 수 없으면 해당 부분은 수정하지 않고, 필요한 기능·기존 구조의 한계·최소 변경안·플레이 영향부터 사용자에게 설명한다. 명시적 허락 후에만 변경한다. 기능 추가 요청 자체를 데이터 구조 변경 승인으로 간주하지 않는다.
- 호환성 정리는 의미·대사·분기·보상 시점을 보존한다. 미지원 동작을 삭제하거나 의미가 다른 플래그로 대체해서 검사를 통과시키지 않는다. 파일 읽기/타입 변환과 실제 실행 지원을 따로 검증한다.
- 기준은 로컬 엔진의 실제 CSV/DTO/컴파일러/실행 처리기다. 엔진 파일은 읽기 전용으로 비교하며, 기존 엔진 데이터 자체의 미지원 문법도 웹이 만든 차이와 구분해 보고한다.
- 데이터/이벤트 작업 시 `node tools/check-engine-data-contract.cjs`로 현재 엔진과 구조·명령 차이를 확인한다. `errors`와 `gaps`를 분리해서 읽는다. 구조 검사가 통과해도 `gaps`의 실행 미지원 항목이 해결되었다고 보고하지 않는다.

## 최소 탐색

- 본편 규칙의 정본은 `docs/gameplay/README.md`다. 사건은 `docs/gameplay/events.md`, CSV·대화 연결은 `docs/gameplay/data-and-dialogue.md`를 따른다. 현재 웹 본편을 기준으로 하며 개발자/검수 전용 기능이나 과거 기획을 본편 규칙으로 혼합하지 않는다. 규칙 변경 시 해당 문서와 테스트를 함께 갱신한다.
- 먼저 `docs/architecture/README.md`의 수정 지점 표를 읽고 해당 기능 폴더만 검색한다.
- 조작 잠금은 `docs/gameplay/input-locks.md`에서 입력 차단·대본 대기·일시정지와 해제 주체를 구분한다. 코스터/빈잔 트리거는 `docs/gameplay/data-and-dialogue.md`의 작성 계약, 까마귀/비둘기는 `docs/architecture/ambient-birds.md`의 공유 설정을 먼저 확인한다.
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
- 리소스 교체는 `docs/architecture/art-assets.md`를 따른다. 원본 이미지와 음원을 재인코딩하지 않는다.

## 확인

- `node tools/check-structure.cjs`와 `node tools/check-site.cjs`를 실행한다.
- `node tools/check-code-boundaries.cjs`와 `node tools/test-source-index.cjs`로 모듈 설치·중복·탐색 경로를 확인한다.
- `node tools/run-tests.cjs smoke`가 기본 회귀 묶음이다. UI를 건드렸다면 `ui`, 외부는 `outside`, 컷씬은 `cinema` 묶음도 실행한다.
- 테스트에 필요한 Playwright/Sharp/브라우저 설정은 `tools/lib/test-runtime.cjs`와 테스트 안내를 참고한다.
- 변경 전부터 실패하던 테스트를 이번 작업의 성공으로 보고하지 않는다. 실패 기대값을 무조건 바꾸지 말고 원인·변경 전 재현 여부를 구분한다.
