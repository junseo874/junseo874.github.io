# 말풍선·대화 표현

[구조 안내](README.md)에서 필요한 기능만 찾아 읽으세요. 게임 동작의 기준은 [본편 규칙](../gameplay/README.md)이며, 이 문서는 구현 위치를 설명합니다.

## 말풍선 원본 비율

대사·대화 선택지는 원본 Stardust TTF를 그대로 사용하고 추가 자간은 0이다. 별도 보조 폰트·표시 단계의 문자 치환·점 크기/높이 보정은 사용하지 않는다. 말줄임은 [대사 문장부호 기준](../gameplay/data-and-dialogue.md#대사-문장부호)에 따라 원본 데이터에 일반 마침표 세 개 `...`로 작성한다. 컷씬 편집기의 기존 Neo둥근모 폰트도 원본 그대로 유지한다. 검증: `test-dialogue-native-font-ui.cjs` (원본 파일 바이트, 원본 대비 글자 폭·높이, 실제 렌더링 서체, 자간, 원문 보존), `test-dialogue-periods.cjs` (데이터의 일반 마침표 사용).

`shared/dialogue/exterior-textbox.js`는 외부 11조각(`html`)과 바 손님/루나 원본 프레임(`barHTML`)의 잘라 보기 영역을 소유합니다. 원본 PNG는 수정하지 않습니다. 바는 `features/crafting/serving-hud.css`, 외부·공유 컷씬은 `shared/dialogue/exterior-textbox.css`에서 모서리와 꼬리를 원본의 **1/3 등비율**로 표시하고 직선 테두리·중앙만 늘립니다. 말풍선 전체 이미지를 `100% 100%`로 늘려 문장 폭에 맞추지 않습니다. 바 직선 조각 사이에는 반 픽셀 겹침과 외곽선 안쪽의 연속 배경을 두어 화면 배율에 따른 틈을 막습니다. 대사 폭·패딩·타이핑·인물별 꼬리 위치는 기존 대화 배치 로직이 소유합니다. 검증: `test-textbox-proportions-ui.cjs` (`ui` 묶음, 손님/루나/외부 × 문장 4종 × 화면 3종 × DPR 1/2).

대화 기록 패널은 `features/bar/dialogue-history.js`가 `g.history`를 읽기 전용으로 표시합니다. `finishLine`과 일반 손님 자동 대사 완료가 기존 기록 생산자이며, 패널은 중복 기록을 추가하지 않습니다. 현재 줄은 표시된 접두사만 임시로 표시합니다. `app.js`의 기존 `history` 오버레이·Y/Esc 처리·일시정지를 재사용하고, 패널의 스크롤 복구·첫 진입 최신 위치·Tab 포커스 순환만 별도 관리합니다. 검사: `test-dialogue-history-ui.cjs` (`ui` 묶음).

외부 스킨의 9번 슬롯은 기존 일체형 꼬리 대신 `GRD_textbox_tail_A/B/C.png`를 원본 크기·알파 그대로 사용합니다. `world-speech.js`가 화면 보정 전 화자 X로 `data-speech-tail`을 매 프레임 갱신하며, CSS는 세 이미지를 미리 장착한 고정 슬롯에서 하나만 표시합니다. 내레이션의 꼬리 숨김·아래 배치 시 수직 반전은 유지하고 바 내부 `barHTML`에는 적용하지 않습니다. `test-exterior-tail-ui.cjs`는 좌우 이탈·복귀, 화면 3종, DPR 1/2, 원본 비율·꼬리 숨김을 검사합니다.

외부 주변 대화의 상대 크기는 `outside-view.js`의 `renderSpeech(..., background)`에서 적용합니다. 원래 조판을 유지한 채 월드 배율에 0.8을 곱하고 머리 간격은 보정하여 글자·여백·모서리·꼬리가 같은 비율로 작아집니다. `.is-auto`가 아닌 주변 대화 채널로 구분하므로 직접 대화의 자동 연출은 영향을 받지 않습니다. 검증: `test-ambient-speech-size-ui.cjs`.

주변 말풍선은 `outside-view.js`에서 `data-story-id`로 유지하며, 거리·상호작용으로 일시 숨길 때 문장 DOM을 다시 만들지 않습니다. `outside-story.js`는 진입/이탈 거리 차이를 두고, `world-speech.js`의 `composite` 배치는 같은 렌더 카메라 좌표를 `translate3d`로 적용해 이동 때 레이아웃 위치를 계속 수정하지 않습니다. 검증: `test-ambient-speech-motion-ui.cjs` (카메라 왕복·동시 대화 증감·경계·숨김/복귀·정리, DPR 1/2).
