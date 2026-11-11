# 조작 잠금·대본 대기 계약

확인일: 2026-11-01. [본편 규칙](README.md)의 세부 명세다. 경로는 별도 표시가 없으면 `bar-playtest/src/` 기준이다. 아래 잠금은 현재 코드의 상태 조건이며, 작성자가 임의의 시간을 지정하는 범용 CSV 명령이 아니다.

## 먼저 구분할 세 가지

| 종류 | 막는 것 | 계속되는 것 | 해제 주체 |
| --- | --- | --- | --- |
| 일시정지 | 소유 모델의 진행 tick와 게임 입력 | 설정 UI 등 정지 화면의 조작 | 설정 닫기·포커스 복귀 등 원래 소유자 |
| 입력 잠금 | 이동·확정·제공 등 특정 행동 | 잠금을 풀어야 하는 카메라·전환·물리·연출 시계 | 해당 연출/행동의 완료 처리 |
| 대본 대기 | 다음 대본 행 실행 | 지정 행동(코스터/제조/선택 등), 필요한 화면 연출 | 성공한 행동이 대본을 재개 |

**카메라 이동 중이라고 게임 전체를 pause하면 이동이 끝나지 않는 교착 상태가 된다.** 반대로 입력만 막고 일반 영업/제조 시계를 계속 돌리면 설정창에서 시간이 소모된다. 둘을 하나의 `locked` 값으로 통합하지 않는다. DOM의 `disabled/inert`는 표현·입력 라우팅 수단이며 거래의 유효성 검사를 대체하지 않는다.

## 바 입력과 대본

| 상황 / 소유자 | 잠금 시작·조건 | 허용 / 금지 | 해제·재개 |
| --- | --- | --- | --- |
| 공통 정지 / `core/core.js:isPaused` | `paused`, `hidden`, `error`, `overlay` 중 하나가 유효 | Game tick 중지. 오류/팝업의 전용 복귀 조작만 UI가 처리 | 원인을 소유한 화면이 해당 상태 해제. 다른 잠금은 유지 |
| 안정된 바 화면 / `barInteractionBlocked` | 정지 상태, `screen !== bar`, `cameraMoving`, `cameraLeft > 0`, `transition > 0` | 대사 넘기기와 세 종류 코스터 전달의 공통 차단. 이 함수 자체는 시간/상태를 변경하지 않음 | 모든 조건이 해소되어야 재입력 가능 |
| 전환 / `setTransition`, `tick` | 입장·퇴장·코스터 튜토리얼 등 전환 예약 | 전환 시계만 진행하는 tick 분기. 새 대사/제공 입력 차단 | 시간이 0이면 `pendingTransition`을 먼저 비우고 콜백 실행. 중복 완료 금지 |
| 바 카메라 / `app/app.js`, `guest-service.js` | 좌석 변경·대본 화자 전환 | 이동 중 단골 대사 숨김/직접 넘김·선택 홀드·코스터 전달 차단. 일반 손님은 각 좌석 말풍선·입 애니메이션·대사 진행 유지 | `cameraMoving`과 `cameraLeft` 모두 해제. 도착했다고 held 입력을 재생하지 않음 |
| 단골 `say` / `story-flow.js:advance` | 대사 행 진입 | 타이핑 중 첫 확정은 해당 줄 완전 표시, 새 확정으로 행 완료. 일반 손님에는 이 수동 경로 미적용 | `finishLine → stepDone → pump`. 행의 효과는 완료 시 처리; 시작 알림은 별도 |
| 바 자동 진행·Ctrl / `app.js:frame` | auto 또는 readSkip 입력 | 안정된 바·현재 대사·정지/드래그 없음일 때만 진행. Ctrl은 opening/regular, 선택지/검수창/입력필드 중에는 금지 | auto는 완독 뒤 2초, Ctrl 경로는 0.12초마다 `advance`. 코스터/제조/선택을 자동 성공 처리하지 않음 |
| 단골 `coaster` / `story-flow.js`, `guest-service.js` | 지정 actor의 현재 좌석에 코스터 없음 | 지정 좌석에 드래그/키보드 전달만 허용. 다른 좌석·단축 호출·중복 전달 거부. 대본은 기다림 | 실제 전달 성공 → `storyCoaster` 제거 → 같은 행 재평가 → 다음 행. 이미 있으면 즉시 다음 행 |
| 코스터 튜토리얼 | 0일차 튜토리얼 대상 행 | 지정 좌석/입력만 허용 | 전달 후 튜토리얼 제거, 0.45초 전환 후 해당 행 완료 |
| 단골 `craft/serve` | 유효 주문 뒤 제조 대기 | 대사 넘기기로 제조를 대체하지 않음. 레시피→준비→기믹→결과→제공 경로 | 올바른 좌석에 실제 제공 후 대본 재개. `serve`를 제조 없이 pump가 만나면 데이터 오류 |
| 단골 `empty_glass` | 해당 행에 도달 | **조작 잠금을 만들지 않음.** 앉아 있는 actor의 잔 상태만 변경 | 같은 실행에서 다음 행으로 진행. 마시기 애니메이션 완료를 기다리는 명령이 아님 |
| 바 선택 / `choice-hold.js` + `app.js` | 선택지 표시 | 같은 버튼을 0.3초 연속 홀드. 활성 바·안정된 카메라·팝업/검수창/드래그 없음·외부/캠페인 차단 없음일 때만 유효 | release·포커스/버튼/선택 객체 변경·다른 입력·탭 이탈 시 취소. 완료 뒤 `choose`가 조건 재검사 |
| 선택 효과 / `story-flow.js:choose` | 홀드 완료 후 호출 | `when` 부족하면 적용 없음. 성공 시 선택 효과와 단계 효과 처리 | `goto` 장면 또는 다음 행으로 진행. 핵심 `choose()`는 0.3초 자체를 측정하지 않음: 엔진도 UI 홀드+상태 재검사를 모두 구현 |
| 바 튜토리얼 / `preparation-flow.js`, `guest-service.js` | 현재 tutorial.kind/step | 단계가 요구하는 좌석·서비스 패널·레시피·잔·재료·도구·제공만 통과. 임의 뒤로가기/다른 물품 선택 차단 | 기대하는 `tutorialEvent`와 실제 행동 성공으로 다음 단계. 안내를 닫았다고 완료 처리하지 않음 |
| 단골 제조 진입 / `app.js:storyCraftReady` | 주문 보유 + `craft` 대기, 대사·선택지·완성 잔 없음, 카메라·전환 완료 | 중앙 제조 버튼 없이 왼쪽 서비스 패널 버튼 표시. 정지 상태면 비활성. 클릭 또는 Tab → 칵테일 레시피; 첫날/맥주 튜토리얼은 기존 서비스 단계 제한 유지 | 패널/레시피를 닫아도 주문·대본 대기 유지. 제조·제공 성공까지 대본을 임의로 진행하지 않음 |
| 제공 / `craft-flow.js:serve` | 완성 drink가 있는 바 화면 | 정지·카메라 대기·전환 중 거부. 코스터 필수. 일반은 현재 좌석 WAIT_SERVE·남은 시간, 단골은 현재 주문 좌석 검사 | 승인 시 `glassEmpty=false`, 실제 잔 종류 저장, 주문당 정산 한 번. 이후 대본/일반 손님 흐름 재개 |

바 선택 홀드의 **포인터 release 후 500ms 클릭 억제**는 브라우저의 뒤따르는 click 중복 방지다. 외부 선택지 등장 지연이나 추가 홀드 시간이 아니다. 바의 `choose`, 제조/제공 등은 각자 가드가 다르므로 `barInteractionBlocked`를 모든 함수에 일괄 덧씌우지 않는다.

## 제조 입력과 완료 대기

| 상황 | 시작 조건 / 차단 | 풀리는 조건 | 소유 파일 |
| --- | --- | --- | --- |
| 레시피 열기 | 바가 아니거나 정지/전환 중, 이미 든 음료, 허용되지 않는 이야기 단계, 튜토리얼 선행단계 미완료 | 본편 craft 대기 또는 일반 영업 등 해당 진입 조건 충족 | `preparation-flow.js:openRecipes` |
| 준비/제조 시작 | 필요한 잔·재료·도구/병따개와 튜토리얼 순서 검증. 경고 overlay 동안 정지 | 부족 항목 보완·경고 확인 후 다시 시작 | `preparation-flow.js`, `craft-flow.js:startCraft` |
| 기믹 첫 입력 | 관련 없는 키는 시작·채점 시계에 영향 없음 | 종류별 유효 키/포인터 입력 | `craft-flow.js:gimmickInput`, 각 view |
| 스터·V1 쉐이크 안내 | `mixTutorial`의 두 페이지를 읽는 동안 기믹 입력·tick·종료 차단 | 안내 확인 완료. 본편 스터는 progress 플래그, 미니게임은 세션의 miniSeen에 기록 | `features/tutorials/mix-tutorial.js` |
| 본편 V2 쉐이크 | 자체 안내 중 시계/입력 차단. 안내 후 틴 맞추기부터 시계 시작. 설정/창 이탈과 부모 게임의 pause는 입력·연출·시간을 함께 정지. 다른 기믹/취소/초기화 시 iframe과 수신기 해제 | 안내 완료는 기존 `mix_tutorial_shake` 플래그. 성공은 3초 분리 마무리, 실패는 1.5초 비산 완료 뒤 한 번만 큐 진행. 임의 종료·결과 재시도 없음 | `features/crafting/shake-v2.js`, `dev/shaking/session-craft.js` |
| 따르기 복귀 | 잡고 있거나 각도 `!== 0` 또는 병 입구 원점 거리 `>= 0.1px`면 종료 거부 | 놓은 뒤 각도와 위치 모두 복귀 | `pour-fluid.js:canFinish`, `pour-view.js`, `endGimmick` |
| 따르기 승인 후 | `finishRequested=true`부터 재잡기/재입력 거부, 버튼 ‘정리 중..’ | 각도 복귀+공중 액체 소진+위치 복귀 상태가 0.2초 초과 지속하여 ready, 이후 0.8초 완료 표시 | `pour-fluid.js:step`, `craft-flow.js` |
| 스터·V1 쉐이크 완료 | `completed` 이후 기믹 입력 무효 | 완료 표시 0.9초(`MIX.completionHoldSec`) 뒤 진행. 본편 V2는 위의 자체 마무리로 대체하며 중복 대기하지 않음 | `gimmick-mechanics.js`, `craft-flow.js` |
| 병따기 완료 | 완료 후 탄산 연출 도중 진행 차단; 튜토리얼은 미완료 종료도 금지 | `OPEN.carbonationSec=2.05` 후 진행 | 같은 파일의 OPEN / `endGimmick` |
| 버리기 | `screen=discarding` | 1.3초 피드백 후 새 prep로 복귀 | `core.js:tick`, `craft-flow.js` |

따르기 복귀 중 누른 종료는 **예약하지 않는다**. 종료 승인 후 물리 정리 중에는 시계와 방울이 계속 움직여야 한다. 일반적인 액션 금지와 `Game.isPaused()`는 다르다. 화면 버튼과 핵심 종료 함수가 모두 조건을 검사한다. 스터·쉐이크의 수동 조기 종료 버튼은 본편에 없으며, 내부 메서드 존재만 보고 다시 노출하지 않는다.

제조 화면에서는 일반 영업 tick을 실행하지 않는다. `craft.elapsed`는 한 잔의 유효 기믹 수행시간 누적이며 개봉·첫 입력 전·정지·완료 피드백/전환을 제외한다. 상세는 [제조 시계](../architecture/bar-and-crafting.md#제조-시계-구현)를 따른다.

## 외부·집·이벤트

| 상황 / 상태 | 차단되는 조작 | 진행 및 해제 |
| --- | --- | --- |
| 로딩/실패/개발자 콘솔/진입 안내 | 외부 tick·이동·새 상호작용 | 리소스 완료/재시도, 콘솔·안내 닫기. 실패를 정상 완료로 처리하지 않음 |
| 최초 이동 안내 `controlsTutorial` | 일반 이동·상호작용 | 안내 전용 키/단계 완료 후 해제. `outside-view.js`의 안내 입력 보호도 적용 |
| 직접 대화 `story.blocking` | 자유 이동·다른 대상 상호작용 | 현재 대사 넘김/선택만 허용. 대사·세계 효과 시계는 유지. 해당 흐름 종료 후 가까운 대상 재계산 |
| 주변 NPC 자동 대화 | 플레이어 직접 대화보다 낮은 우선순위 | `backgroundStory`가 소유. 직접 대화와 혼합하여 본편 입력을 빼앗지 않음 |
| 조사 이미지 `dialog.kind=inspection` | 이동·다른 대상 선택 | 조사 닫기로 복귀. 모델은 `time/animTime`만 진행하는 별도 분기이며 일반 탐색 tick 전체가 진행되지는 않음 |
| 소파/TV/엘리베이터 선택 | 이동·다른 대상 상호작용 | 선택 확정 또는 허용된 취소 후 재개. Esc는 이 오브젝트 선택·조사를 닫음 |
| 외부 선택지 등장 | 최초 **500ms** 확정 금지(E/Enter/Space/클릭), 탐색 포커스는 이동 가능 | 같은 선택 key의 재그리기는 보호시간 재시작 안 함. 누른 채 기다린 입력을 나중에 자동 승인하지 않음 |
| 외부 조건 부족 | 포커스는 허용, 확정 거래는 거부 | 빨간 배경·흔들림·글리치와 사유. 다른 항목 선택 시 원문 복구; owner가 거래 조건 재검사 |
| 강제 만남 `encounter` | 진입·퇴장 중 자유 이동/일반 상호작용 | scripted 이동과 cameraReady를 기다린 뒤 active 대화, 퇴장 완료 후 복귀. 일반 NPC의 E 대화와 구분 |
| 엘리베이터 `ride` | 이동/방향키 저장·다른 대상 실행 | 이동/call 상태 종료 후 복귀. 도착 전에 누른 이동키는 새 이동으로 재사용하지 않음 |
| 방 전환 `transition` / 바 도착 `barArrival` | 이동·중복 출입 | 외부 방 전환 0.38초에 내용 교체, 0.85초에 종료; 바 출입은 별도 문 전환/로딩 완료를 기다림 |
| 동네 액션 `neighborhood.action` | 자유 이동·새 이벤트·현재 대사 건너뛰기 | 해당 액션 tick가 완료하면 `endAction`이 **같은 speech**인지 확인 후 다음 행. 다른 대화의 인덱스를 증가시키지 않음 |
| 부비 등장/쓰다듬기/먹이·이웃 이동 | 위 액션 잠금 | 등장 컷씬 종료와 이후 고양이 상호작용은 별개. 씬별 경로/완료 시점은 [사건 문서](events.md)와 `outside-neighborhood.js` 소유 |
| 수리/입양/빠른 이동 암전 | 같은 액션 잠금 | 수리 총 2.15초, 입양/빠른 이동 1.15초. 중간 한 번만 상태 전환하고 연출 끝에 대본 재개 |
| 부비 첫 휴식 `chris-in` | 자유 이동·새 상호작용 | 암전→크리스 배치→페이드/수평 카메라 완료 후 대화. 완료 후 테라스/수면 연결은 `day-flow.js` |

코드 위치: `outside.js`의 `interact/updateNear/tick`, `outside-view.js`의 `tick/keydown/clearInput`, `events/outside-story.js`, `outside-neighborhood.js`, 각 encounter 소유 모듈. 단순히 `near=null`인 것은 전체 정지와 같지 않다. 갱단의 통행 경계도 이동 범위 제한이며 강제 대화 잠금이 아니다.

외부 선택지의 Escape는 취소 ID가 실제로 존재하는 메뉴에서만 그 선택을 실행한다. 필수 대사에 임의의 취소 분기를 만들지 않는다. 소파/TV/엘리베이터·조사 닫기와 설정 열기는 호스트의 우선순위를 따른다. `world-choices.js`의 `locked`는 유효 선택의 이중 실행 방지이며 화면 전체 시간을 멈추는 상태가 아니다.

## 캠페인·테라스·컷씬·공통 팝업

| 상황 | 현재 구현 계약 | 소유자 |
| --- | --- | --- |
| 캠페인 차단 화면 | game/developer 이외의 화면 또는 일차 전환 중 바·외부 DOM을 inert로 전환. 숨은 바/거리 입력이 들어가지 않게 함 | `campaign.js:blocking/draw/key` |
| 문·기억·일차 전환 | key 라우팅에서 먼저 소비. 로딩/암전 동안 중복 진입 방지. 오래된 비동기 로딩 결과가 새 화면을 덮지 않게 소유 토큰 검사 | `day-flow.js`, `cinema-flow.js`, `bar-door-transition.js` |
| 일차 명언·저자·숫자 | 암전·명언 전 1.5초 대기부터 다음 날 공개 완료까지 동일한 일차 전환 잠금. 저자 완전 표시 후 4초 유지, 명언이 완전히 사라진 뒤 숫자 롤. 숨김 탭 자동 정지 시 대기·읽는 시간도 정지. E/Enter/Space/Esc 스킵 없음. 준비 실패 시 오류/재시도로 복귀 | `day-transition.js` 표시, `day-flow.js` 진행; [상세 시간표](events.md#일차-전환--명언과-day-숫자) |
| 테라스 대사 | 타이핑·수동 다음 줄. 선택지 새 진입은 **800ms** 확정 보호. 바의 0.3초 홀드와 다름 | `campaign.js:paintSceneChoices`, `terrace-view.js` |
| 테라스 진입 카메라 | 기억 전환 상태가 암전/등장/카메라를 소유해 그동안 다음 대사 입력 차단. 기본 진입은 hold 0.7초+수평 이동 5.6초+settle 0.5초, 총 6.8초. reduced-motion은 카메라 이동 시간을 생략 | `terrace-view.js:entrance`, `cinema-flow.js:tickMemoryTransition` |
| 테라스 새 | 대사/선택지 중에도 terraceTime 진행. 설정에서 멈추며 복귀해도 착지 재시작 안 함. 새 자체는 입력 잠금을 만들지 않음 | [새 구현](../architecture/ambient-birds.md) |
| 컷씬 수동 대사 `dialogueWait` | 타임라인은 그 줄에서 대기, 타이핑의 age는 진행. 첫 확정 완전 표시, 다음 입력 진행. choice가 있으면 먼저 처리; 도입부 typingPending 구간은 성급한 진행 거부 | `cinema-flow.js:tickCinemaDialogue/advanceCinemaDialogue` |
| TV 다큐 | 대사 대기 중에도 별도 effectTime으로 주사선 계속 재생. Space 2초 연속 홀드 스킵은 TV만 허용. 설정/해제/전환 시 홀드 취소 | `cinema-flow.js:canSkipCinema`, campaign key/tick |
| 다른 컷씬 | 도입부 연락·조니 기억 등을 TV처럼 통째로 스킵하지 않음. 수동 줄 넘김과 전체 스킵 구분 | `cinema-flow.js`, Studio dialogue 설정 |
| 마지막 부탁 자동 대사 | 세 문장 3.6/3.2/3초는 입력 대기 없이 재생. E/Enter/Space/클릭으로 건너뛰거나 즉시 완성하지 않음. 설정/비활성화 때 기존 컷씬 시계를 멈추고 재개하며, 기상 전환에서 노이즈를 즉시 중단 | `opening-template.js`, 기존 `wait:false` 대사·audio 키프레임 |
| 설정/기록/정보 팝업 | 아래 게임 조작 정지. 취소 가능한 최상위 화면부터 닫음 | `app.js`, 각 overlay, campaign options |
| `johnnyUnlock` / `dailyUnlocks` | Esc·일반 진행키로 우회 불가. 해당 확인 버튼으로만 완료; Tab 포커스는 내부 제한 | `app.js`와 story/day-flow |
| 획득/인물/호감도/목표 알림 | 토스트 자체는 조작락/거래 실행기가 아님. 차단 화면 중 숨기고 큐 대기, 진행 데이터 owner가 바뀌면 오래된 알림 제거 | `shared/ui/story-notices.js`, `currency-view.js`, 외부 획득 UI |

테라스 진입의 6.8초는 **카메라 구간**이다. `beginMemoryTransition`의 암전 0.9초 → 최소 0.2초 및 리소스 준비 대기 → 공개 구간 순서가 먼저 있다. 공개 시 페이드 인 1.8초와 카메라를 함께 진행하고 둘 다 끝난 뒤 잠금을 푼다. reduced-motion에서도 리소스 준비와 페이드까지 전부 건너뛰는 것은 아니다. 이 준비 과정이 실패하면 잠금 상태로 방치하지 않고 load-error/재시도 화면으로 전환한다.

## 포커스 이탈과 복귀

`shared/platform/focus-settings.js`의 자동 일시정지는 기본 켜짐이며 사용자가 끌 수 있다. `hiddenPaused = enabled && document.hidden`이며 해당 설정과 호스트의 blur 처리가 적용된다. 끈 경우 숨겨진 탭에서 제한된 dt로 진행할 수 있으므로 “포커스를 잃으면 무조건 모든 게임 시간이 정지한다”고 구현하지 않는다.

정지 설정과 별개로 놓친 keyup/pointerup 때문에 입력이 붙지 않도록 홀드·드래그·따르기·스킵·이동키를 정리한다. 복귀 후 **새 입력**이 필요하다. UI 재마운트 때 대사 위치·완료 플래그·까마귀 시계를 초기화하지 않는다. 오류 화면을 닫는 것과 저장 복구는 별개이며 현재 앱 종료 후 저장 복귀는 미구현이다.

## 데이터 작성자와 엔진 구현자의 경계

- 데이터로 정할 수 있음: 기존 대사/선택 분기, 조건·효과, `coaster`/`empty_glass` 행 위치·actor, 기존 주문·제조·제공 순서, 지원되는 액션 참조.
- 데이터만으로 정할 수 없음: 임의 입력의 lock/unlock, 새 카메라 경로, 모든 시계를 공유하는 범용 pause, 새 컷씬 액션 종류, 임의의 N초 코스터 자동 제공. 이들은 현재 각 실행기의 코드 계약이다.
- `sync=wait/no_wait`는 해당 타입의 실행기가 지원하는 범위에서만 사용한다. 모든 행을 병렬화하거나 잠금을 해제하는 전역 플래그가 아니다.
- 바 `fx/sfx`는 현재 간단한 더미 미리보기다. `sync=wait`일 때 hard_cut 0.2초/그 외 0.7초 transition을 기다리고, no_wait는 다음 행을 진행한다. 실제 Studio 타임라인·완성된 이펙트 시스템과 동일 기능으로 간주하지 않는다.
- 새 잠금 추가 시 진입/해제·취소/오류·다른 화면 이탈·포커스 복귀·시간 소유권·중복 입력 처리·검증 테스트를 함께 정의한다. 모든 상태를 한꺼번에 false로 만드는 강제 복구를 넣지 않는다.

본편 Session은 `variant=original`을 사용한다. 개발자 GPT/remix의 추가 `remix.hold`, 결과 잠금 1.1초, 독립 개봉 연습의 `minigameHoldSec`, 와인 미니게임 iframe의 별도 입력/정지 상태를 본편 공통 규칙에 합치지 않는다. 검수 도구를 수정할 때는 각각 `bar/remix.js`, `crafting/minigames.js`, `dev/wine-opening/session.js`를 확인한다.

## 회귀 확인

`test-shared-birds-and-bar-gates.cjs`는 공통 가드 256조합과 무변경성을 검사한다. 실제 경로는 `test_story_coaster*`, `test-day1-notion-script`, `test-empty-glass*`, `test_choice_hold_ui`, `test-bar-choice-hold-clock`, `test-choice-entry-guard-ui`, `test-game-input-guard-ui`, `test_focus_settings_ui`, `test-settings-resume-ui`, `test-lift-lock-recipe-escape-ui`, `test-pour-finish-lock*`, `test-pour-input-recovery-ui`, `test-mix-completion*`, `test-craft-clock*`, `test-neighborhood-staging-ui`, `test-tv-skip-ui`, `test-terrace-birds-ui`가 담당한다. 이 목록은 모든 가능한 상태 조합의 완전 증명을 뜻하지 않는다.
