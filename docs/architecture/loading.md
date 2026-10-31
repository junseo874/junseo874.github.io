# 데이터·로딩·경로 계약

[구조 안내](README.md)에서 필요한 기능만 찾아 읽으세요. 게임 동작의 기준은 [본편 규칙](../gameplay/README.md)이며, 이 문서는 구현 위치를 설명합니다.

## 데이터와 로딩 경로

CSV의 소유권·메타데이터·생성 흐름·실제 대화 예제·수정 방법은 [데이터와 대화 연결](../gameplay/data-and-dialogue.md)에 통합했습니다. 조회 화면은 `bar-playtest/data-review.html`이며 생성 검사는 `node tools/build-shared-data.cjs`, 수정 후 생성은 `--write`입니다. 웹 저장소가 원본을 소유하며 엔진 자동 복사/역수입은 하지 않습니다.

초기 마이그레이션 백업 `artifacts/shared-data-backup/`은 로컬 전용으로 버전 관리 대상이 아닙니다. 초기 재수입과 구형 생성 도구로 최신 데이터를 덮어쓰지 않습니다. `data/runtime/game-data.js`와 `campaign-data.js`는 직접 편집하지 않습니다.

HTML·자원 경로 계약:

1. `index.html`의 CSS/JS 순서는 기능 의존성과 CSS 우선순위의 일부입니다. 정리 전 순서를 보존합니다.
2. 브라우저 JS에서 `assets/...`는 **페이지 주소** 기준입니다. 파일을 `src/` 안에 옮겼다고 모든 이미지에 `../../../`를 붙이면 안 됩니다.
3. CSS `url(...)`은 **CSS 파일 위치** 기준입니다. 공유 스타일을 다른 페이지에서 로드해도 같은 리소스에 도달해야 합니다.
4. 오디오와 말풍선의 `document.currentScript` 기반 URL은 본편 폴더를 명시적으로 계산합니다.
5. `src/cinema/studio-player.js`는 `cutscene-studio/src/`의 모듈을 동적으로 불러오고, 편집기 원본 에셋은 편집기 페이지 기준으로 해석합니다.
6. 기존 공개 HTML 경로·쿼리, `localStorage`/IndexedDB 키, 이야기/아이템/캐릭터 ID는 변경하지 않습니다.
