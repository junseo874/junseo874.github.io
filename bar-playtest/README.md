# 본편 / 개발자 플레이테스트

실행: `http://127.0.0.1:8123/bar-playtest/`, 개발자 모드: `?dev=1`.

현재 웹 본편이 확정 기준입니다. 구현을 넘겨받는 사람은 [공통 규칙](../docs/gameplay/README.md) → [사건별 흐름](../docs/gameplay/events.md) → [CSV와 대화 사용법](../docs/gameplay/data-and-dialogue.md) 순서로 읽으세요. 개발자 모드와 검수 탭의 동작은 본편 진행과 구분합니다.

현재 구조와 수정 위치는 [구조 안내](../docs/architecture/README.md), 검증은 [테스트 안내](../docs/architecture/testing.md)를 참조하세요.

- `src/`: 수정하는 실행 코드와 스타일. 기능별로 JS/CSS를 함께 보관합니다.
- `data/runtime/`: 대형 테이블·대사·장면·이미지 카탈로그. 필요한 키만 조회합니다.
- `assets/`: 실제 사용하는 이미지·폰트·소리. 규칙은 [assets/README.md](assets/README.md).
- `tests/`: 기능별 회귀 테스트. 실행 도구는 저장소 루트 `tools/run-tests.cjs`.
- `tools/`: 원본 가져오기·캡처·카탈로그 생성. 원본 재수입은 웹 전용 보정에 영향을 줄 수 있으므로 명시적으로 필요할 때만 수행합니다.

과거 900줄의 변경 기록은 [보관 문서](../docs/history/bar-changelog-through-2026-10-18.md)로 이동했습니다. 기록 속 옛 경로는 당시의 경로입니다.
