# 구조와 수정 지점

## 설계 기준

현재 게임은 여러 작은 전역 모듈을 HTML 순서대로 로드하는 정적 웹입니다. 이 정리에서는 게임 규칙을 재작성하거나 빌드 시스템을 도입하지 않았습니다. **기능별 소유권, 코드/대형 데이터 분리, 자원 위치와 검증 경로**를 정리했습니다.

Unity의 장면·캐릭터·UI·오디오 분리를 참고하되 웹의 URL 해석 방식을 유지합니다. 기존 리소스 ID는 그대로이고 실제 파일 경로만 변경됩니다. 컷씬 편집기와 본편은 같은 재생 모듈을 계속 공유합니다.

| 바꿀 기능 | 먼저 볼 파일 / 폴더 |
| --- | --- |
| 전체 화면·탭·입력 연결 | `bar-playtest/src/app/app.js` |
| 영업·주문·재료·점수·정산 규칙 | `bar-playtest/src/core/core.js` |
| 바 내부 화면·제조 준비 | `bar-playtest/src/features/bar/` |
| 따르기·개봉·쉐이킹·스터·제공 | `bar-playtest/src/features/crafting/` |
| 시뮬레이터 전용 와인 개봉 2종 | `bar-playtest/src/dev/wine-opening/` (진입: `features/crafting/minigames.js`) |
| 거리 이동·카메라·상호작용 | `bar-playtest/src/features/outside/outside.js` |
| 거리 인물·상점·강제 이벤트 | `bar-playtest/src/features/outside/events/` |
| 부비 입양·수리공·갱단 통행 | `bar-playtest/src/features/outside/events/outside-neighborhood.js` |
| 비·조명·불·수증기·스파크 | `bar-playtest/src/features/outside/effects/` |
| 공중 광고 차량·5초 LED 광고 | `bar-playtest/src/features/outside/effects/outside-ad-carrier.js` |
| 거리 전광판·랜덤 소등·실외기·CRT | `street-engine-effects.js`, `sign-scanlines.js` + `data/presentation/street-effects.js` |
| 본편 진행·밤·테라스·회상 | `bar-playtest/src/features/campaign/` |
| 컷씬 렌더링·편집기 재생 연결 | `bar-playtest/src/cinema/` |
| 설정·정산 팝업·알림·재화 UI | `bar-playtest/src/shared/ui/` |
| 16:9 영역·배율·포커스·입력 제한 | `bar-playtest/src/shared/platform/` |
| P 패널 촬영용 UI 숨김·복구 | `bar-playtest/src/shared/platform/capture-mode.js`, `capture-mode.css` |
| 말풍선·선택지·홀드 효과 | `bar-playtest/src/shared/dialogue/` |
| BGM·효과음·대사 음성 | `bar-playtest/src/shared/audio/` |
| 이동·제조 튜토리얼 | `bar-playtest/src/features/tutorials/` |
| 리소스 검수·다운로드 | `bar-playtest/src/dev/resources/` |
| 99일차·테스트 상황 | `bar-playtest/src/dev/qa/` |
| 공통 게임 데이터 원본 | `bar-playtest/data/shared-csv/` (Unity CSV 구조) |
| 캐릭터 이미지·표현 리소스 등록 | `bar-playtest/data/presentation/runtime-assets.json` |
| 거리 장면·스프라이트 좌표 | `bar-playtest/data/runtime/outside-scene-data.js` |
| 본편·거리 공통 대사 | `bar-playtest/data/shared-csv/story/` → 생성된 런타임 뷰 |
| 컷씬 편집 | `cutscene-studio/src/`, `styles/` |

## 로딩·경로 계약

### 포트 작업장 컷씬 보관

`workshop`(검은 배경의 크리스·포트 대화)은 본편 휴식 및 외부 QA 목록에서 제외하고 **컷씬 확인 탭의 포트의 작업장**에서만 재생합니다. CSV 원본·장면 ID·대사는 보존하며, `playSleepScenes`는 부비 첫 휴식 반응이 있으면 마친 뒤 바로 해당 밤의 테라스 대화 또는 수면으로 연결합니다. 컷씬 확인 탭의 독립 재생은 본편 진행 상태를 변경하지 않습니다.

### 시뮬레이터 와인 개봉

기믹 미니게임 목록의 **와인 개봉 → 버전 선택**에서만 실행합니다. 사용자 `2버전.html`은 버전 1(호일·스크류·뽑기), `4버전.html`은 버전 2(중앙 맞추기·기울기·2단 지렛대·린넨 포함)에 대응합니다. 본편 큐·레시피·CSV·저장 데이터에는 연결하지 않습니다. `minigames.js`의 기본 `KINDS`/`startMinigame` 계약도 유지합니다.

각 버전은 별도 문서에서 동작하고 공통 `session.js`가 이미지 준비, 활성 시간 기준 지연 작업, 재시작 취소, Esc/포커스 이탈 일시정지, 드래그 해제, 소리 및 종료를 담당합니다. 상위 화면은 출처와 iframe 창을 확인한 메시지로 버전 선택/목록 복귀만 받습니다. 16:9 검정 레터박스를 유지하고 원본 2184×1164 조작 좌표는 렌더·포인터에 동일 변환을 적용합니다. 병은 기존 `item_red_wine` 원본을 등비 확대하고, 오프너는 제공 HTML의 동일 PNG를 바이트 그대로 추출했습니다. `resources.json`에 출처를 기록했습니다. `test-wine-practice-ui.cjs`는 두 버전 실제 포인터 완주·실패·재시작 타이머·일시정지·화면 비율·진행 데이터 보존을 검사하며 `craft` 묶음에 포함됩니다.

### 누적 제조시간

본편의 개봉·따르기·채우기·스터·쉐이킹은 한 제조 시도의 `craft.elapsed`를 공유합니다. `bar-views.js`의 `craftTimer()`가 모든 화면 우측 상단에 동일한 스터 시계 UI를 표시하고 최종 판정도 같은 값을 사용합니다. 단계별 `gimmick.elapsed`는 동작·리듬 계산용으로만 유지합니다. 첫 조작 전, 튜토리얼·설정·포커스 이탈 일시정지, 완료 피드백·단계 전환은 합산하지 않습니다. 병 개봉의 실제 조작 시간도 포함하며 새 제조·재시도는 0부터 시작합니다. 독립 와인 실험은 본편 제조 큐에 연결하지 않습니다. 검증: `test-craft-clock.cjs`, `test-craft-clock-ui.cjs` (`craft` 묶음).

### 재화 알림

바·제조·외부·검수용 재화 알림은 `shared/ui/currency-view.js`와 `currency-view.css`를 공유합니다. 등록된 `assets.money` (`assets/ui/imported/money.png`)는 제공된 `IMG_money.png`와 바이트까지 동일한 원본이며 아이콘과 배경을 한 장으로 사용합니다. 542:108 비율을 유지하고 기존 절반 크기·우측 상단 위치·증감 타이밍은 유지합니다. 별도 SVG 동전이나 둥근 테두리는 덧씌우지 않습니다. 큰 금액은 글자 수에 따라 숫자만 축소합니다. 외부의 증분 갱신에서도 `--currency-digits`를 동기화합니다. 공통 사전 로딩 목록과 리소스 검수 등록 키는 기존 `money`를 그대로 사용합니다.

### 선택형 동네 이벤트

집 탁자 위 책은 `home-art.js`의 `bookTarget()` 및 `ForeFore_Object` 안의 책 부분 마스크로 상호작용합니다. `home-book` 표식·윤곽선은 탁자 전체가 아니라 책 더미에만 연결합니다. 표지는 `assets/outside/chris-home/nietzsche-the-gay-science.png`에 사용자 제공 원본 그대로 보존하고 외부 진입 로더로 미리 디코드합니다. `outside-inspection.js`의 기존 포스터 화면을 공유하며 설명은 `《즐거운 학문》 - 프리드리히 니체`입니다. 리소스 확인의 `outside:home-book`에서도 표지를 확인할 수 있습니다. 검증: `test-home-book-ui.cjs`.

삼호 외부 대기·대화는 `samho-animation.js`의 원본 Idle 8프레임/12FPS를 공유합니다. 출근길·밀수업자·계약 종료·QA·컷씬 편집기·리소스 검수에서 같은 프레임 등록을 사용합니다. 대사를 넘겨도 외부 월드 시계를 초기화하지 않습니다. 검증: `test-samho-idle-ui.cjs`. 날씨·환경음 조합 검증은 `test-weather-ambience-matrix-ui.cjs` (0~3일차, 출퇴근, 거리/집/테라스)입니다.

집의 침대 옆 옷장은 `home-art.js`의 `wardrobe`/`wardrobeTarget()`으로 원본 배경의 옷장 부분만 상호작용 처리합니다. `home-interactions.js`가 누른다/취소 선택을 담당하고, 공통 CSV `script/home`의 `home-wardrobe`와 `home-wardrobe-pressed`가 루나 대사를 소유합니다. 취소는 즉시 종료하며 누르기는 대사만 재생합니다. 기존 첫 상호작용 기록·공통 선택지 입력 보호를 공유합니다. 검증: `test-home-wardrobe-ui.cjs`.

집의 왼쪽 침대는 `home-art.js`의 `bed`(방 원본 픽셀 마스크)와 `bedTarget()`으로 위치·윤곽선·물음표를 맞춥니다. 소파의 별도 침구 이미지와 혼동하지 않습니다. 대사는 공통 CSV `script/home`의 `home-bed` → `sharedStory['home/bed']`로 연결하며 루나 말풍선으로 재생합니다. 첫 상호작용 기록은 기존 `outside_interacted_v1_bed`/일차 carry 규칙을 사용합니다. 검증: `test-home-bed-ui.cjs`.

외부 선택지는 `world-choices.js`의 `rejectUnavailable` 표시 모드를 사용합니다. `disabled`는 거래/이벤트 실행 조건으로 유지하되 네이티브 버튼 비활성화는 하지 않아 W/S·방향키·Tab·휠·호버로 선택할 수 있습니다. E/Enter/Space/클릭 확정 시 실행 대신 `disabledReason`으로 문구를 바꾸고 선명한 적색 `#ef3340`과 0.325초 텍스트 흔들림/제목 화면의 `title-signal`·`title-signal-slice` 글리치을 표시합니다. 다른 항목으로 이동하거나 조건이 갱신되면 원래 문구로 복구합니다. 접근성에는 `aria-disabled`와 변경 문구 알림을 사용하고 동작 줄이기 설정에서는 흔들지 않습니다. 조건 문구는 “돈이 부족합니다.”, “참치캔이 없습니다.”처럼 짧게 쓰며, 조건 안내는 각 외부 이벤트의 `choiceView`가 소유하며 하단 상시 설명은 없습니다. 본편 컷씬의 기존 선택 방식은 이 모드를 사용하지 않습니다. 검증: `test-outside-choice-rejection-ui.cjs`.

외부·컷씬의 `world-choices.js`와 바 내부 `choice-hold.js`는 선택지가 새로 나타난 뒤 800ms 동안 E 입력을 소비만 하고 확정/홀드를 시작하지 않습니다. 이때부터 계속 누른 E도 확정되지 않으며 놓고 새로 눌러야 합니다. 항목 이동·좌표·소지금 갱신은 시간을 다시 시작하지 않고, 다른 선택지 그룹 및 닫았다 다시 연 선택지는 새로 보호합니다. 마우스·Enter·Space의 기존 방식은 그대로이며 바 내부의 기존 0.5초 홀드도 유지합니다. 검증: `test-choice-entry-guard-ui.cjs`, `test_choice_hold_ui.cjs`.

외부 물음표는 `events/outside-discovery.js`가 담당합니다. `OutsideModel.interact`에서 실제 대상과 상호작용을 시작하면 `progress.flags.outside_interacted_v1_<대상 ID>`와 일차 carry에 즉시 기록합니다. 중도 취소도 상호작용으로 계산하며, 대사·선택지·일차가 바뀌어도 다시 표시하지 않습니다. 엘리베이터·소파·집 문·출입구·바 입구에는 표시하지 않습니다. 박스와 부비는 별개 대상이고, 복도와 집 안의 부비는 같은 대상입니다. 이전 대사 지문/만남 플래그는 호환용으로 읽어 대상 이력으로 이전합니다. `inRange`를 근접 대상 선택과 공유하며 범위 내 미상호작용 대상 여러 곳에 표시할 수 있습니다. 검정 테두리 없이 `LunaInteractionGlow.style`의 청록색과 광원만 사용하며, 설정·컷씬·촬영 모드에서는 숨깁니다. 검증: `test-outside-discovery-ui.cjs`.

물음표는 방향에 따라 뒤집히는 머리 중심 대신 고정된 NPC 원점과 전체 프레임의 머리 높이를 사용합니다. 말풍선의 방향별 머리 기준은 유지합니다. `outside-discovery.project`는 실제 스프라이트의 픽셀 정렬 보정량을 공유하고, 글자도 1280 논리 좌표가 아닌 `pixelSurface.factor`의 물리 픽셀에 정렬합니다. 화면 이동 시 별도 보간이나 지연 없이 대상과 함께 이동합니다. `test-outside-discovery-stability-ui.cjs`에서 좌우 왕복·방향 전환·애니메이션·가로/세로 카메라 이동·창 크기 변경·DPR 1/2를 검사합니다.

`outside-neighborhood.js`는 기존 외부 Story/선택지/일차 carry를 사용합니다. 사람은 `ambient-M1/M2/W1` 스프라이트를 재사용하며 부비만 교체 가능한 Canvas 더미입니다. `places`가 박스·착지점·소파·NPC 좌표를 소유합니다. 대사는 웹의 `story/scenes.csv`, `story/steps.csv`와 `web-views.json`의 `neighborhood/*`에서 투영합니다. Unity 파일은 변경하지 않습니다.

NPC 연출: `poses()`가 발 좌표·방향·크기·프레임과 말풍선/물음표의 동일한 기준을 소유합니다. 사람 셀 129×138의 실제 발끝(114px)을 원점으로 두며, 도로는 -0.974, 복도는 `upperY - 0.274`로 루나와 맞춥니다. 갱단원의 하반신은 자르지 않고, 갱단과 해당 구간의 루나만 검정 폐품 전경 앞 보행면에 그립니다. 복도 난간과 엘리베이터의 기존 가림은 유지합니다. `outside-ambient.js`의 `head/bounds`는 원본 알파의 애니메이션 합집합으로 머리를 측정해 투명 여백이나 호흡 프레임 때문에 표시가 떠 있거나 흔들리지 않게 합니다. 옆집 주민은 초당 0.24 월드 단위로 이동하고 고양이에서 0.60 떨어져 멈춥니다. 이동 방향은 경로, 정지 대화 방향은 루나 위치를 따릅니다. 수리공은 루나 반대 방향으로 이동하며 1.6초 안에 페이드 종료합니다. 기존 6프레임 실루엣의 호흡 주기는 루나와 동일하게 유지합니다.

부비 첫 휴식의 기존 CSV 액션 `chris-in`은 이제 걷기 명령이 아니라 **0.45초 암전 → 완전 검정 유지 → TV 오른쪽 크리스 고정 배치 → 페이드 인/0.32 월드 단위 좌→우 이동**입니다. 카메라 폭 4.8과 높이 0.023은 고정, 줌은 없습니다. 연출 뒤 기존 대사와 작업장/테라스/취침 연결을 그대로 사용합니다. 중단/재시작 시 카메라 소유권도 해제합니다. 검증: `test-neighborhood-staging-ui.cjs`.

- 부비·참치캔: 1일차 퇴근부터. `boobi_box_shaken`, `boobi_revealed`, `boobi_adopted`, `boobi_rest_seen`을 보존합니다. 구매한 `tuna_can` 1개를 소비하며 `boobi_feeding_pending`은 중단된 입양을 재개합니다.
- 수리공: 1일차 출근부터. `repairman_met`, `elevator_repair_paid`, `elevator_repaired`로 400원 또는 `gear_part` 1개 중복 지불을 막습니다. 부품을 주는 포트 대화는 아직 없습니다. 빠른 이동도 본편 귀가 조건 검사를 거칩니다.
- 갱단: 0일차 퇴근부터, 술 질문은 1일차 퇴근부터. 갱단원 앞 경계는 이동만 막고 자동 대사는 시작하지 않습니다. 경계에서도 윤곽선·E 상호작용이 가능하며, 대화를 취소하거나 자리를 뜨면 계속 막힙니다. 술을 찾는 `guardPass` 대화를 끝내 `gang_pass_granted`를 얻은 뒤에만 물리 경계를 풀고 중앙의 `neighborhood-boss`에게 대화할 수 있습니다. `neighborhood/bossIntro` → 첫 선택, `bossRepeat` → 재방문 선택이며 `gang_boss_met`으로 구분합니다. 와일드 독은 500원 또는 `elevator_repaired`로 한 번 받습니다. 지불/수리 약속은 `gang_wild_dog_paid`, `gang_wild_dog_repair_promised`, `gang_wild_dog_repeat_deal`로 먼저 보존하고 CSV의 `wild-dog-grant` 지점에서 인벤토리·알림·`gang_wild_dog_received`를 갱신합니다. 중단 시 같은 거래 대사를 재개하며 중복 지불하지 않습니다. 기존 시바견 구매 플래그/보유분도 존중합니다.
- 시바견은 비터스·참치캔만 판매합니다. 와일드 독 판매 및 해당 QA/CSV 구매 분기는 제거했습니다. 와일드 독을 가진 상태에서 비터스를 사면 기존 올드 패션드 퀴즈를 진행합니다.
- 집 안 부비는 웹 CSV의 `neighborhood/homeCat`에서 “냐옹”과 `home-cat` 선택지를 표시합니다. 쓰다듬기/취소만 제공하며 소지금·참치캔 선택지는 표시하지 않습니다. 쓰다듬기는 1.6초 동안 감은 눈·꼬리 움직임·작은 하트로 반응한 뒤 조작을 돌려주며, 설정 일시정지/취소/재입장 시 남는 연출이 없습니다. 비용이나 휴식 이벤트 플래그는 변경하지 않습니다. 검증: `test-home-cat-interaction-ui.cjs`.
- 다음 휴식은 부비 소개 → 기존 작업장/테라스/취침 순서입니다. 이벤트를 하지 않아도 하루 진행을 막지 않습니다. 사운드는 `LunaNeighborhoodAudio.play(cue)` 연결 자리만 있고 기본 무음입니다.

검증: `node tools/run-tests.cjs outside`의 `test-neighborhood-events-ui.cjs`에서 날짜 경계·지불·중단 후 재개·입양·휴식 연결·설정 정지·빠른 이동을 확인합니다. `test-gang-wild-dog.cjs`, `test-gang-wild-dog-ui.cjs`는 갱단 4개 거래 분기, 499/500원 경계, 수리 조건, 중복 보상/중단 복구, 기존 세이브, 말풍선/윤곽선/실제 E 입력을 확인합니다.

### 거리 셰이더 스냅샷

광고 차량 순환: `flightBounds`(-24~10)은 맵과 차체 폭 바깥의 재등장 경계입니다. 각 노선은 이동 시간 `duration`으로 즉시 순환하며 별도 소멸 대기 구간은 없습니다. 경계 확장 시 이동 시간을 같은 비율로 늘려 기존 속도를 유지합니다. 순환은 게임 시간만 사용하고 광고 시계·카메라 상태를 초기화하지 않습니다.

공중 광고 차량은 `outside-ad-carrier.js`가 별도 소유합니다. `assets/outside/vehicles/ad-carrier.png`를 외부 장면 이미지 로더에 등록하여 진입 전에 디코드합니다. 차체와 광고는 1280×592 캐시에 합성하고 게임 시간의 24fps 단위로 표현합니다. 320×148은 레이아웃 좌표일 뿐 저해상도 중간 비트맵으로 쓰지 않습니다. 차체 원본 파일은 보존하며 중앙 직선 구간만 20px 연장합니다. 안테나·모서리·추진기는 늘리지 않습니다. 광고 패널은 134×56이며 인물 원화는 비율을 유지해 채웁니다. 원본 크기에서 알파 보정 후 고품질 축소하며, 최종 화면도 고품질 샘플링과 물리 픽셀 위치 정렬을 사용합니다. 원본의 고체 영역 알파 250–255는 캐시에서 255로 보정하고 차체에 불투명 청색 음영을 합성합니다. 거리감에 전체 투명도를 쓰지 않습니다. 광고는 게임 시간 기준 5초마다 슬라이드 없이 즉시 전환, 좌우 이동 시 글자는 뒤집지 않습니다. 크기는 최초 버전 대비 약 15% 확대, 이동은 25% 감속이며 광고 시계는 감속하지 않습니다. 렌더링 순서는 원경 → 중경 건물과 부착 디스플레이(layer 3–5) → 광고 차량 → 주거 건물·거리 전경입니다. 같은 layer 5를 사용하는 주거 건물은 `streetDrawOrder`에서 중경 뒤로 정렬하여 차량보다 앞에서 가립니다. 두 노선 높이는 2.55/7.5로 이전보다 각각 0.65 낮췄습니다. 여성 인물 원화 2종(ad-portrait-violet/crimson.png)은 artAssets로 외부 진입 전 미리 로드합니다. KORATECH·UNKNOWN 인물 광고와 Canvas PORT 발광 문양을 번갈아 표시하며, 가는 LED 세로줄·가로 주사선·느린 광택 띠·하단 작은 티커만 움직입니다. 원화 생성 방식과 프롬프트·영상 분석은 assets/outside/vehicles/ad-art-provenance.json에 기록했습니다. 독립 render 호출은 다섯 번째 인자로 로드된 이미지 Map을 전달합니다. 리소스 검수에서는 차체와 두 원화를 개별 카드로 확인하고 전경 보기로 시작합니다. 집/QA에서는 생성하지 않습니다. 광고 문구·속도·노선은 해당 모듈의 `ads`, `routes`, `travelRate`에서 수정합니다.

`bar-playtest/tools/import-street-effects.cjs --write`는 Unity의 `OutSide.unity`, `SH_LedSignScroll`, `NeonFlicker`, `M_Crt01–09`에서 필요한 설정과 PNG만 **웹으로** 복사합니다. 엔진은 읽기 전용이며 전체 장면 재수입은 하지 않습니다. 다른 체크아웃은 `--engine=/경로/HumanBartender`를 사용합니다. `--write` 없이 실행하면 스냅샷 일치 여부만 검사합니다.

원본 PNG는 `assets/outside/effects/`에 바이트 그대로 보존합니다. RGBA 소등 마스크는 독립 데이터 채널이므로 브라우저의 투명 픽셀 처리로 RGB가 사라지지 않도록 좌표 데이터도 생성합니다. 전광판 이동·팬 샘플링·랜덤 소등 범위와 타이밍은 엔진 설정을 따릅니다. 주변 빛 번짐은 기존 Canvas 렌더러용 근사이며 Unity URP의 픽셀 단위 출력과 동일하지는 않습니다. 거리 진입 전에 기존 외부 이미지 로더가 새 에셋도 로드합니다. 테라스 효과와 게임 진행 좌표는 변경하지 않습니다.

검증: `test-street-engine-effects.cjs`, `test-street-engine-effects-ui.cjs` (둘 다 `outside` 묶음에 포함).

### 공통 CSV (2026-10-19)

`bar-playtest/data-review.html`에서 44개 표를 검색하고 CSV를 내려받을 수 있습니다. Unity의 `Assets/StreamingAssets/csv`와 동일한 4개 메타데이터 파일 및 44개 데이터 표를 사용합니다. 웹 최신 대사와 레시피를 우선하고, 엔진 전용 캐릭터·아이템은 보존했습니다. BD 판매상 장면은 제외했습니다.

수정 원본은 `data/shared-csv/`입니다. `data/runtime/game-data.js`, `campaign-data.js`는 배포용 생성 결과이므로 직접 수정하지 않습니다. 웹에서 변경 후 `node tools/sync-shared-data.cjs --to-engine`, 엔진에서 변경 후 `--from-engine`을 실행합니다. 다른 엔진 경로는 마지막 인자로 지정합니다. 양쪽을 동시에 수정하면 충돌로 중단하며 자동 덮어쓰지 않습니다. `--check`로 양쪽 파일 및 웹 생성 결과의 일치를 검사합니다. 웹만 생성할 때는 `node tools/build-shared-data.cjs --write`를 사용합니다.

CSV 구조의 ID·부모 연결·타입 정의는 유지해야 합니다. `web-views.json`은 기존 웹의 테이블/장면 연결 정보입니다. 기존 행 값 변경은 바로 반영되지만 새 행·새 장면을 추가할 때는 해당 뷰 연결도 등록해야 합니다. `count` 단위는 엔진에서 사용하며 웹에는 기존처럼 `개`로 표시합니다. `web_*` 열은 웹 표현 정보입니다.

초기 원본 백업은 로컬 `artifacts/shared-data-backup/`에 있습니다(버전 관리 제외). 이미 배포한 뒤 초기 마이그레이션을 다시 실행할 수 없도록 막았습니다. 구형 import/build_campaign 생성 도구도 덮어쓰기를 차단합니다. 검증은 `node tools/run-tests.cjs data`로 실행합니다.

현재 공통화 범위는 게임 테이블, 본편 캠페인, 등록된 거리 인물·상점·불량배 대사입니다. 컷씬 편집기 연출 프로젝트, 동적으로 조립하는 일부 이벤트 선택 문구·진행 로직, 이미지 좌표·애니메이션은 여전히 웹 모듈에 있습니다. CSV 일치는 양 플랫폼의 플레이 동작 일치까지 보증하지 않으므로 Unity 실제 플레이 검증은 별도로 필요합니다.

1. `index.html`의 CSS/JS 순서는 기능 의존성과 CSS 우선순위의 일부입니다. 정리 전 순서를 보존합니다.
2. 브라우저 JS에서 `assets/...`는 **페이지 주소** 기준입니다. 파일을 `src/` 안에 옮겼다고 모든 이미지에 `../../../`를 붙이면 안 됩니다.
3. CSS `url(...)`은 **CSS 파일 위치** 기준입니다. 공유 스타일을 다른 페이지에서 로드해도 같은 리소스에 도달해야 합니다.
4. 오디오와 말풍선의 `document.currentScript` 기반 URL은 본편 폴더를 명시적으로 계산합니다.
5. `src/cinema/studio-player.js`는 `cutscene-studio/src/`의 모듈을 동적으로 불러오고, 편집기 원본 에셋은 편집기 페이지 기준으로 해석합니다.
6. 기존 공개 HTML 경로·쿼리, `localStorage`/IndexedDB 키, 이야기/아이템/캐릭터 ID는 변경하지 않습니다.

## 파일 찾기

```sh
node tools/locate.cjs outside
rg -n 'interactionLabel' bar-playtest/src/features/outside
rg -n 'overflow|spill' bar-playtest/src/features/crafting
```

`path-migrations.json`은 옛 경로를 찾을 때만 조회합니다. 전체 출력은 불필요합니다. `runtime-contract.json`은 HTML 로드 순서 검사용이며 런타임에 추가 요청을 만들지 않습니다.

## 재정리가 필요한 경우

`app.js`, `core.js`, `outside.js`, `campaign.js`는 상태와 진입점을 소유합니다. 규칙 변경 없이 위치를 정리한 이번 작업에서는 그 상태를 억지로 여러 파일에 분산하지 않았습니다. 새 기능은 해당 기능 모듈에 두고, 이 파일들에는 연결만 추가합니다. 더 큰 로직 분리는 해당 기능의 테스트를 먼저 확보한 뒤 진행합니다.
