대화 선택지 UI 분리 리소스

현재 게임의 CSS/SVG를 실제 게임 폰트로 렌더링한 투명 PNG입니다. 게임 파일은 수정하지 않았습니다.
총 16개 조각, 1배 크기. preview.png는 조합 확인용이며 리소스가 아닙니다.

choices/: 선택 배경(좌/우), 비활성 세로선, E키/빈 키 테두리, 좌우 삼각형
tutorial/: W/S/E키, 마우스 휠, 위아래 삼각형, 패널 배경, 상단 장식, 구분선

selected-background-right: 루나 오른쪽에 뜨는 좌측 정렬 선택지. E키는 왼쪽.
selected-background-left: 루나 왼쪽에 뜨는 우측 정렬 선택지. E키는 오른쪽.
배경 PNG 64×32는 텍스트 없는 가변 폭 템플릿입니다. 실제 선택지 폭은 글자 폭+좌우 패딩+테두리로 계산합니다.
모서리를 보존하려면 9-slice 좌우6/상하6px로 사용하세요. 원본의 우측/좌측 하단5px 잘림을 유지해야 합니다.
E키 파일은 32×34이며 안쪽 키 본체22×24, 상하좌우5px 투명 여유입니다.
비활성 선택지는 배경을 사용하지 않고 세로선과 글자만 표시합니다.
글자색: 활성 #082b36 / 비활성 #addde8 / 키 컬러 #50d9f5 / 테두리 #8be8fa.
동적인 대사/소지금 텍스트는 이미지에 구워 넣지 않았습니다.
원본 CSS/JS도 첨부했습니다. 폰트는 게임의 기존 game-font.ttf를 연결하세요(폰트 파일은 중복 배포하지 않음).

개별 파일 규격:
choices/selected-background-right.png — 64×32 — 선택 배경, 루나의 오른쪽에 선택지가 있을 때. 글자 없는 가변 폭용 기본 조각.
choices/selected-background-left.png — 64×32 — 선택 배경, 루나의 왼쪽에 선택지가 있을 때. 글자 없는 가변 폭용 기본 조각.
choices/inactive-line.png — 2×30 — 비활성 선택지 세로선. 나머지 배경은 없음.
choices/key-e.png — 32×34 — 22×24 키 표시 + 사방 5px 투명 여유(원본 발광 보존).
choices/key-frame.png — 32×34 — 22×24 키 표시 + 사방 5px 투명 여유(원본 발광 보존).
choices/pointer-right.png — 5×6 — E키 옆 오른쪽 방향 삼각형.
choices/pointer-left.png — 5×6 — E키 옆 왼쪽 방향 삼각형.
tutorial/key-w.png — 27×30 — 튜토리얼 키 27×28 + 아래 그림자 2px.
tutorial/key-s.png — 27×30 — 튜토리얼 키 27×28 + 아래 그림자 2px.
tutorial/key-e.png — 27×30 — 튜토리얼 키 27×28 + 아래 그림자 2px.
tutorial/mouse-wheel.png — 24×32 — 휠이 강조된 마우스 아이콘.
tutorial/triangle-up.png — 12×10 — 선 없는 방향 삼각형.
tutorial/triangle-down.png — 12×10 — 선 없는 방향 삼각형.
tutorial/panel-background.png — 510×400 — 글자·상단 장식 없는 패널. 본체350×230, 위치80,60. 그림자 보존용 투명 여유 포함.
tutorial/panel-accent.png — 80×35 — 상단 장식48×3 + 발광 여유.
tutorial/divider.png — 308×1 — 패널 구분선.
