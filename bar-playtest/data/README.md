# 게임 데이터 안내

현재 웹 본편이 확정 기준입니다. 데이터 구조와 실제 대화 실행 방법은 [데이터와 대화 연결](../../docs/gameplay/data-and-dialogue.md), 조건·분기·보상은 [사건별 흐름](../../docs/gameplay/events.md), 공통 게임 규칙은 [본편 구현 확정 기준](../../docs/gameplay/README.md)을 따릅니다.

- `shared-csv/`: 웹이 소유하는 공통 데이터 편집 원본과 웹 뷰 연결.
- `presentation/`: 이미지 등록·웹 표현 정보. 공통 CSV 스키마와 구분.
- `runtime/`: 실행용 데이터와 장면 자료. `game-data.js`, `campaign-data.js`는 CSV에서 생성하므로 직접 수정하지 않음. 다른 파일의 소유자는 구조 안내에서 확인.
- `provenance/`: 출처 기록. 현재 본편 진행 규칙을 정의하는 파일이 아님.

CSV 수정 뒤에는 저장소 루트에서 `node tools/build-shared-data.cjs --write`로 생성하고, `node tools/build-shared-data.cjs`로 일치 여부를 검사합니다. 대사 값뿐 아니라 새 장면을 추가할 때는 `web-views.json`과 실행 코드 연결도 확인하세요. 엔진 디렉터리로 자동 복사하거나 엔진의 옛 데이터로 역수입하지 않습니다.
