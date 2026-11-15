# 본편 / 개발자 플레이테스트

실행: `http://127.0.0.1:8123/bar-playtest/`, 개발자 모드: `?dev=1`.

현재 웹 본편이 확정 기준입니다. 구현을 넘겨받는 사람은 [공통 규칙](../docs/gameplay/README.md) → [사건별 흐름](../docs/gameplay/events.md) → [CSV와 대화 사용법](../docs/gameplay/data-and-dialogue.md) 순서로 읽으세요. 개발자 모드와 검수 탭의 동작은 본편 진행과 구분합니다.

현재 구조와 수정 위치는 [구조 안내](../docs/architecture/README.md), 검증은 [테스트 안내](../docs/architecture/testing.md)를 참조하세요.

- `src/`: 수정하는 실행 코드와 스타일. 기능별로 JS/CSS를 함께 보관합니다.
- `data/shared-csv/`: 대사·선택지·게임 표의 원본. `data/runtime/`는 실행용 데이터이므로 대사를 고칠 때 직접 덮어쓰지 않습니다.
- `assets/`: 실제 사용하는 이미지·폰트·소리. 경로·교체 규칙은 [리소스 안내](../docs/architecture/art-assets.md)를 참고하세요.
- `tests/`: 기능별 회귀 테스트. `tests/helpers/`에는 여러 검사에서 함께 쓰는 실제 조작 절차(병 놓기·좌석 안내 등)를 둡니다. 실행 도구는 저장소 루트 `tools/run-tests.cjs`입니다.
- `tools/`: 원본 가져오기·캡처·카탈로그 생성. 원본 재수입은 웹 전용 보정에 영향을 줄 수 있으므로 명시적으로 필요할 때만 수행합니다.

예전에 노션에서 가져왔던 [대본과 기획 메모](../archives/bar-playtest-authoring/)는 기록용이며 게임과 편집기에서 읽지 않습니다. 현재 대본과 생성 결과가 일치하는지는 저장소 루트에서 `node tools/build-shared-data.cjs`로 확인하세요.

과거 900줄의 변경 기록은 [보관 문서](../docs/history/bar-changelog-through-2026-10-18.md)로 이동했습니다. 기록 속 옛 경로는 당시의 경로입니다.
