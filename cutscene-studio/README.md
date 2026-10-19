# 컷씬 편집기

`index.html`이 편집기 진입점입니다. 본편도 이 편집기의 런타임 모듈을 공유합니다.

- `src/`: 편집 모델·키프레임·렌더링·편집 UI
- `styles/`: 편집기와 공유 대사 스타일
- `data/`: 가져온 도입부 대사
- `assets/`: 편집기 기본 리소스
- `tests/`: 모델/브라우저 smoke tests

공유 모듈을 바꿀 때는 본편 `bar-playtest/tests/test_cutscene_library_ui.cjs`도 확인합니다. 브라우저의 기존 프로젝트/에셋 저장소 키는 변경하지 않습니다.
