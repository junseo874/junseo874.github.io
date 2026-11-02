# 데이터와 대화 연결

[본편 구현 확정 기준으로 돌아가기](README.md)

이 문서는 현재 저장소의 데이터가 실제 플레이로 연결되는 방식을 설명한다. 새 범용 엔진 스키마를 제안하는 문서가 아니다. 모든 선택·연출이 CSV만으로 실행된다고 가정하면 현재 웹과 다른 게임이 된다.

## 데이터가 실행되는 경로

```text
data/shared-csv/                     편집 원본
  system/ 메타데이터 + 44개 표
       ↓ csv-catalog.js              타입/부모/순서를 복원
       ↓ web-views.json              웹에서 쓸 행과 장면 선택
       ↓ shared-data-views.cjs       웹 표현으로 투영
data/presentation/runtime-assets.json ─┘
       ↓ tools/build-shared-data.cjs --write
data/runtime/game-data.js            LUNA_DATA.tables / sharedStory / assets
data/runtime/campaign-data.js        LUNA_CAMPAIGN_DATA
       ↓ HTML에서 로드
core / campaign / outside            조건 검사·상태 변경·대사·연출 실행
```

현재 본편은 CSV에서 **미리 생성한 JS 데이터**를 로드한다. 대사 한 줄마다 CSV를 실시간 요청하는 구조가 아니다. CSV 수정 후 생성하지 않으면 배포된 게임의 대사는 바뀌지 않는다. `data-review.html`의 CSV 조회 기능과 본편의 로딩 방식은 구분한다.

`data/runtime/` 전체가 같은 생성물인 것은 아니다. `game-data.js`, `campaign-data.js`는 이 빌더의 산출물이고, 거리 이미지 배치·컷씬 카탈로그 등에는 다른 소유자/생성 도구가 있다. 폴더째 덮어쓰지 않는다.

## 무엇을 어디에서 수정하는가

이하 `data/`, `src/` 경로는 `bar-playtest/` 기준이다.

| 수정 대상 | 원본과 실행 담당 |
| --- | --- |
| 본편·거리 대사 본문 | `data/shared-csv/story/scenes.csv`, `steps.csv`. 장면 연결은 `web-views.json` |
| 바 선택지 | `story/bar_choice_groups.csv`, `bar_choices.csv`; `features/story/story-flow.js`의 `choose`가 조건·효과·이동 실행 |
| 외부 선택지 | 공통 `street_choices.csv`만 보지 말고 해당 NPC 모듈의 `choiceView` / `choose` 확인. 현재 동적 옵션은 JS가 소유하는 경우가 많음 |
| 외부 불가 사유 표현 | `data/presentation/choice-feedback.js`와 각 이벤트의 `disabledReason` |
| 칵테일·재료·제조량 | `craft/cocktails.csv`, `shelf_items.csv`, `recipes.csv` |
| 손님·주문·점수·정산 | `guests/`, `craft/order_rules.csv`, `settings/` + `features/bar/guest-service.js`, `settlement.js`, `features/crafting/craft-rules.js` |
| 외부 등장/해금/거래/완료 조건 | `src/features/outside/events/`의 해당 모듈 |
| 본편 진입·일차·휴식 연결 | `src/features/campaign/campaign.js`, `day-flow.js`, `campaign-engine.js` |
| 캐릭터/이미지 경로 | `data/presentation/runtime-assets.json`, 해당 장면/표현 데이터; [리소스 안내](../../docs/architecture/art-assets.md) |
| 카메라·피벗·애니메이션·임시 좌표 | outside/campaign/cinema의 해당 모듈 및 presentation 데이터 |
| 편집기 컷씬 | `cutscene-studio/`의 프로젝트와 본편 cinema 연결. 대사 CSV와 별도 연출 계층 |

`interaction/`의 등록 데이터가 있다고 모든 항목이 본편에서 자동 생성되는 것은 아니다. `targets`, `visible`, `interact` 등 실제 소비 코드를 확인한다. 데이터에 있는 미사용 필드나 `skippable` 값을 임의로 활성화하지 않는다.

## CSV 구조를 읽는 법

### 엔진 CSV와 동일한 기준본

2026-11-02 사용자 승인으로 엔진 `HumanBartender/Assets/StreamingAssets/csv/`의 48개 CSV를 웹에 바이트 단위로 동일하게 반영했다. 엔진의 읽기 쉬운 `row_id`·`parent_id`·`template_id`, 설명용 `context`, 줄바꿈 형식을 유지한다. CSV 구조와 연결 ID는 엔진 기준이며, 이전 웹의 해시 ID로 되돌리지 않는다. 게임용 인물·장면 ID와 `web_row_id`는 별개다.

`web-views.json`은 웹 전용 투영 설정으로 유지하며, 실행 JS는 공통 CSV로 재생성한다. `node tools/sync-shared-data.cjs --check`로 엔진과 웹 CSV 및 생성본의 일치를 확인한다. 일반 동기화는 충돌 보호를 유지한다. `--from-engine --accept-engine`은 사용자가 웹 변경을 엔진 기준으로 덮어쓰도록 명시적으로 승인한 경우에만 사용하며, 스키마·웹 연결·동시 수정 검사는 생략하지 않는다.

### 일반 손님 외형의 웹 최신본

일반 손님 외형 최신화 이후에는 `guests/guest_parts.csv`, `guest_exclusions.csv`, `guest_settings.csv` 세 파일이 웹 기준으로 갱신되어 위 엔진 복사본과 다르다. 실제 46개 파츠·금지 쌍 6개·기본 조합을 담으며 게임과 외형 시뮬레이터가 같은 데이터를 읽는다. 상세 계약은 [루트 README](../../README.md#일반-손님-외형-csv-현재-웹-기준)를 따른다. 엔진 폴더는 직접 수정하지 않았으므로 동기화 검사에서 이 차이가 나오는 것은 의도된 상태다.

### 레시피 표시 문구와 잔 ID

2026-10-30 [노션 편집 문서](https://app.notion.com/p/4091612298dc8057b687d21c30f8bf0c)의 한국어 이름·설명·제조법을 맞춤법 교정 후 반영했다. 원본은 `craft/cocktails.csv`, `craft/shelf_items.csv`, 키워드는 `craft/cocktail_tags.csv`다. 노션은 자동 동기화되지 않으며, 다음 수정도 CSV를 고친 뒤 런타임을 재생성한다. 병따개 설명은 `src/features/bar/bar-views.js`의 보조 도구 항목에 있다.

잔 ID는 `cocktail → martini`(마티니잔), `sour → flute`(플루트잔), `mug → weizen`(바이젠잔)으로 연결했다. 칵테일의 잔 참조·선반·이미지 등록 키도 같은 ID를 사용한다. 기존 CSV 행 식별자와 물리 이미지 파일명은 유지한다. 설명의 문단 나눔은 실제 줄바꿈으로 저장하며 레시피 목록 미리보기와 제조 준비 상세에서 함께 표시한다. 설명 문구의 도수·용량 표기는 제조 판정 수치를 덮어쓰지 않는다. 영어·실제 배합량·가격·해금 조건과 롱아일랜드 본편 제외 상태는 유지했다. 검증: `test-recipe-copy-ui.cjs`.

### 대사 문장부호

말줄임은 일반 마침표(U+002E) 세 개 `...`로 작성한다. 묶인 말줄임표(U+2026)나 가운데 점 세 개(U+22EF)는 대사에 사용하지 않는다. 점 여섯 개는 `......`로 유지한다. 이 기준은 한국어·영어, 바/외부/일반 손님/컷씬/QA 대사와 코드의 대체 대사에도 동일하게 적용한다. 폰트 글리프 수정이나 표시 단계의 문자 치환이 아니라 원본 데이터에서 지킨다. `test-dialogue-periods.cjs`가 생성 데이터와 대체 대사·편집기 예제를 검사한다.

| 파일 | 역할 |
| --- | --- |
| `system/table_index.csv` | 논리 테이블명 → 실제 파일 경로 |
| `system/columns.csv` | 열 순서와 타입 |
| `system/data_sets.csv` | 데이터셋 ID와 루트 템플릿 |
| `system/row_formats.csv` | 행을 객체·배열·자식으로 복원하는 스키마 |
| `web-views.json` | 웹 테이블/장면 투영 설정. CSV 스키마 자체는 아님 |

주요 공통 열:

- `dataset_id`: 예를 들어 `script/home`, `script/street`, `script/bar/day1`처럼 묶음을 식별한다.
- `row_id`: 전체 카탈로그에서 고유한 행 ID. 화면에 표시하는 이름이나 장면 ID와 다르다.
- `parent_id`, `parent_field`: 부모 행과 그 부모의 배열/필드에 연결한다. `context`가 비어 있어도 이 관계로 소속이 복원될 수 있다.
- `source_order`: 같은 부모/필드 안의 복원 순서. `seq`와 같은 것으로 가정하지 않는다. 기존 형식의 순서를 모두 확인한다.
- `template_id`: 해당 행의 복원 형식. 다른 장면에서 복사할 때 임의로 새 템플릿 이름을 만들지 않는다.
- `web_row_id`, `web_type`, `web_fields.*`, `web_core_keys`: 기존 웹이 필요로 하는 식별자·표현·투영 정보. 엔진 공통 필드와 구분한다.

빈 셀과 `\N`은 null, `\E`는 명시적 빈 문자열이다. 따옴표·쉼표·여러 줄 텍스트는 CSV 규칙으로 읽는다. 문자열을 단순히 쉼표로 나눠 파싱하지 않는다. 타입은 스키마에 따라 복원하며 ID·부모 연결·열 순서를 유지한다.

`csv-catalog.js`는 헤더 불일치, 중복 ID, 부모/템플릿 오류, 고아 행, 순환과 타입 오류를 검사한다. 이 검사 통과는 실제 이벤트가 본편에서 올바르게 연결되었다는 보증까지 하지는 않는다.

## 바 대본의 코스터·빈잔 트리거

단골 손님은 인사나 주문만으로 코스터를 요구하지 않는다. `steps`에 명시한 `coaster` 행에서만 전달을 기다린다. `actor`는 현재 앉아 있는 대상 인물 ID이며, 플레이어가 코스터를 전달하면 다음 행으로 진행한다. 이미 놓인 코스터는 중복 제공하지 않는다. 튜토리얼을 건너뛰는 분기에도 필요한 코스터 행을 따로 둔다.

`empty_glass` 행은 대상 인물에게 제공된 잔을 즉시 빈잔으로 바꾸고 다음 행으로 진행한다. 예를 들어 `say / chris / 음...` 다음에 `empty_glass / chris`를 넣으면 그 대사가 끝난 뒤 크리스의 잔만 비워진다. 잔이 없으면 생성하지 않으며, 다른 좌석·제조 결과·정산에는 영향을 주지 않는다. 새 음료를 제공하면 다시 채워진 잔이 된다.

| `type` | `actor` | 실행 |
| --- | --- | --- |
| `coaster` | `chris`, `port` 등 | 해당 좌석에 플레이어가 코스터를 전달할 때까지 대본 대기 |
| `empty_glass` | `chris`, `port` 등 | 해당 좌석의 제공된 잔만 빈잔으로 교체 |

### 작성 예시와 정확한 실행 시점

다음은 **런타임 단계의 핵심 필드만 보여 주는 예시**다. CSV 전체 행 복사용 형식이 아니며 실제 추가 시 `row_id/parent_id/source_order/seq`와 투영 설정도 기존 장면에 맞춰 작성한다.

| 순서 | type | actor | arg / text.ko | 언제 다음으로 가는가 |
| --- | --- | --- | --- | --- |
| 1 | enter | tom | arg=`L` | 입장 연출 완료 |
| 2 | say | tom | 주문해도 되나? | 플레이어가 대사 완독 후 다음 입력 |
| 3 | coaster | tom | 일반 행은 arg 비움 | 플레이어가 톰에게 코스터 전달 성공 |
| 4 | say | luna | 어떤 걸 드릴까요? | 대사 완료 |
| 5 | order | tom | arg=`exact:dry_martini` | 주문 생성. text가 있으면 그 대사를 마친 뒤 생성 |
| 6 | craft | tom | 일반 행은 arg 비움 | 제조·결과 확인·실제 음료 제공을 기다림 |
| 7 | serve | tom | 일반 행은 arg 비움 | 6과 연결되어 제공 성공 시 함께 완료 |
| 8 | say | tom | 한 모금 마셔 볼까. | 대사 완료 |
| 9 | empty_glass | tom | arg 비움 | 즉시 톰의 잔 상태 변경 후 다음 행 |
| 10 | say | tom | 괜찮군. | 빈잔이 표시된 상태에서 대사 |
| 11 | exit | tom | arg 비움 | 퇴장·테이블 정리 후 다음 행 |

**`craft` 바로 다음 행은 같은 주문 actor의 `serve`여야 한다.** 둘 사이에 `say`, `empty_glass`, 선택지 등을 끼우면 `order → craft → serve 연결 오류`가 된다. 마신 뒤 대사는 serve 뒤에 쓰고, 잔을 비울 위치는 그 뒤 대사 사이에서 정한다. 제공 성공은 두 행의 효과 적용·정산·주문 해제 후 1초 전환을 거쳐 다음 대본을 실행한다. `empty_glass` 시점에 돈을 다시 지급하지 않는다.

`say` **뒤**에 빈잔 트리거를 두면 마지막 글자가 찍힐 때가 아니라 플레이어가 해당 줄을 넘긴 다음 실행된다. 해당 대사를 시작할 때부터 빈잔이어야 하면 `say` **앞**에 둔다. 글자 중간이나 임의 초 단위 실행은 현재 이 트리거로 지원하지 않는다. 코스터도 동일하게 행 사이에서 시점을 정한다. `coaster`는 NPC 자동 제공 명령이 아니라 플레이어 행동 대기다.

### 두 명이 있을 때와 잘못된 데이터

- `enter`의 단골 좌석은 현재 L/R만 지원한다. M은 일반 손님 좌석 규칙과 혼동하지 않는다. 동시 입장은 첫 enter의 `sync=no_wait`와 바로 뒤 enter의 `sync=wait` 쌍만 지원하며 좌석 충돌은 오류다.
- 두 명에게 줄 때는 `coaster/tom → coaster/chris`처럼 두 행을 둔다. 각각의 actor로 좌석을 찾고 해당 좌석으로 초점을 옮긴다. 한 명만 받는 방문이면 그 사람 행만 둔다. 동행인이 있다고 자동으로 추가하지 않는다.
- 같은 방문에서 코스터가 이미 있으면 재전달 대기 없이 완료한다. 퇴장 후 재입장한 좌석은 새 상태이므로 필요한 코스터 행을 다시 둔다.
- `coaster`를 생략해도 주문 행이 자동으로 만들어 주지 않는다. 제공에는 코스터가 필요하므로 실제 음료를 받을 사람에게는 제조 전 접근 가능한 경로에 반드시 둔다. 튜토리얼 건너뛰기/선택 분기 양쪽을 확인한다.
- `coaster`/`empty_glass`의 actor가 앉아 있지 않으면 데이터 오류다. actor는 표시 이름이 아니라 `tom/chris/...` ID다. `empty_glass` 대상이 앉아 있지만 잔이 없으면 아무 잔도 생성하지 않고 행만 완료한다.
- 빈잔 트리거 자체를 반복해도 기존 잔의 boolean 상태만 유지한다. 타입 자체는 다른 손님의 잔, 현재 제조 결과, 코스터, 주문, 인벤토리, 돈을 수정하지 않는다. 단, 작성자가 별도로 넣은 `effects`는 각 행 완료 시 적용되므로 보상 효과를 중복 작성하지 않는다. 새 음료 제공은 같은 좌석의 잔과 실제 잔 종류를 다시 기록하고 `glassEmpty=false`로 되돌린다.
- 트리거 행의 `when`은 `pump`가 그 행에 도착할 때 검사하며 거짓이면 효과 없이 건너뛴다. `effects`는 행이 실제 완료될 때 적용한다. 코스터 대기 중에는 다음 행을 실행하지 않는다. 조건을 생략하면 무조건 실행되는 행이다.
- 현재 동시에 처리하는 단골 주문은 `currentOrder` 하나다. 두 사람의 제조/제공을 순서대로 쓴다. 여러 미처리 주문을 쌓는 범용 대기열로 해석하지 않는다.

### 소유 상태·원본·검증

| 항목 | 소유 위치 |
| --- | --- |
| 대본 순서·대상 | `data/shared-csv/story/steps.csv`, 장면/분기 투영은 `web-views.json` |
| 코스터 대기 | `story-flow.js:waitForStoryCoaster` → `Game.storyCoaster` |
| 실제 코스터 전달 | `guest-service.js:coaster` → `seats[seat].coaster` |
| 빈잔 전환 | `story-flow.js:pump` → `seats[seat].glassEmpty` |
| 음료 제공·초기화 | `craft-flow.js:serve` → `glass`, `glassKind`, `glassEmpty=false` |
| 일반 손님 자동 마시기 | `guest-service.js:setBarks/tickGeneral` → DRINKING → REACTION |
| 화면과 빈잔 리소스 | `bar-views.js`, `data/presentation/runtime-assets.json` |

`storyHasUpcomingOrder`는 남아 있는 조회 보조 함수이며 코스터 시점을 결정하는 정본이 아니다. `storyCoaster.kind=line` 호환 분기도 새 대본 작성법으로 사용하지 않는다. 현재 작성 행은 `kind=step` 경로를 만든다. 조작별 잠금·해제는 [조작 잠금 계약](input-locks.md)을 따른다.

작성 후 생성 데이터를 직접 손대지 말고 `node tools/build-shared-data.cjs --write`로 재생성한다. `test_story_coaster.cjs`(명시 시점·2인·중복·입력 가드), `test-empty-glass.cjs` 및 UI 검사(대상/잔 종류·일반 손님), `test-day1-notion-script.cjs`(현재 본편 대사 위치·분기)를 함께 확인한다. 이 이벤트 타입은 **바 실행기용**이며 외부/Studio에 같은 문자열을 추가한다고 자동 지원되지 않는다.

일반 손님은 대본 트리거 대신 수령 대사 → 마시기 → 빈잔/반응 대사 → 정산 순서로 처리한다. 다른 좌석을 보고 있어도 진행되며 일시정지 중에는 멈춘다. 빈잔 그림은 제공한 음료의 실제 잔 종류를 따른다. 바이젠잔은 `beer-glass.png`, 마티니잔은 `cocktail-glass.png`, 롱드링크잔은 `long-drink-glass.png`를 사용한다. 전용 리소스가 없는 플루트·와인잔은 마티니 모양, 올드패션드잔과 미등록 종류는 롱드링크 모양으로 임시 대체한다. 원본 리소스는 `assets/cocktails/empty/`, 등록은 `data/presentation/runtime-assets.json`에서 관리한다.

0일차 최신 반영본은 [노션 0일차 대사](https://app.notion.com/p/0-40a1612298dc801287f0c5017a7d65e0)이다. 노션의 `(플레이: 이름에게 코스터 제공)` / `(트리거: 이름의 잔을 빈잔으로 교체)` 위치를 위 행으로 옮기고 CSV에서 런타임 데이터를 재생성한다. 노션 자동 동기화는 아니다.

1일차는 [노션 1일차 대사](https://app.notion.com/p/1-40a1612298dc8053b9f3f393758b830f)의 2026-11-01 반영본을 따른다. 영업 준비의 크리스, 단골 영업의 개시바·톰·아일리에게 음료를 제공한 뒤 지정된 대사 전후에 `empty_glass`를 실행한다. 코스터는 크리스의 맥주 준비 지시 뒤, 개시바의 주문 재촉 뒤, 톰의 첫 침묵 뒤, 아일리의 안구 정화 비유 뒤에 제공한다. 단골 영업 중 크리스의 첫 방문과 마지막 재입장에는 모두 코스터 대기가 없다. 아일리는 입장 직후가 아니라 주문 직전에 한 번만 받는다. 기존 주문·정산·톰 이름 공개 알림·선택 분기·테라스 강조 표시·외부 사건 액션은 유지한다. 검증: `test-day1-notion-script.cjs`.

최신본 0~3일차의 추가 수정(2026-11-01): 0일차 포트는 정상 주문 분기의 “어떤가요?” 뒤, “크으...” 앞에서 빈잔이 된다. 2일차 삼호의 코스터는 “뭐?” 뒤, 포트의 코스터는 한 잔 부탁한다는 말 뒤다. 삼호는 제공 완료 뒤 첫 감상 대사 전에 빈잔이 되며, 포트의 빈잔 전환은 대본에 없으므로 임의로 추가하지 않는다. 3일차 톰의 코스터는 재료·레시피를 다 찾았는지 묻는 말 뒤, 삼호의 코스터는 “나도 톰처럼 술 한 잔 줘!” 뒤다. 톰은 “마법이라도 부릴 줄 아는 거야?”를 마친 뒤, 삼호는 “으음, 한 잔만 더!”를 시작하기 전에 빈잔이 된다. 입장 시 자동으로 코스터를 요구하지 않는다. 원본 행 ID·조건·주문 연결은 보존하고 순서와 트리거만 변경한다. `test-latest-story-timings.cjs`가 0~3일차 양쪽 선택 분기, 해당 경계의 잔 상태, 코스터 횟수와 중복 정산 방지를 검증한다.

## 실제 예제 1 옷장

원본 장면은 `Scenes`의 `id=home-wardrobe`, `dataset_id=script/home`, `row_id=shared_home_wardrobe`이다. `Steps`에서 `parent_id=shared_home_wardrobe`인 행이 대사를 담는다.

그 행의 주요 값:

```text
type                  choice
actor                 luna
text.ko               무언가 버튼이 보인다.
web_fields.type       home-choice
web_fields.stage      wardrobe
web_core_keys         actor|text
```

`web-views.json`의 실제 연결:

```json
"home/wardrobe": {
  "source": "script/home",
  "scene": "home-wardrobe",
  "offset": 0
}
```

생성 후 `LUNA_DATA.sharedStory['home/wardrobe']`의 행은 `type: home-choice`, `stage: wardrobe`, `actor: luna`, `text: 무언가 버튼이 보인다.`가 된다. **원본 `choice`를 외부 실행기가 그대로 읽는 것이 아니라 웹 실행용 타입으로 투영한다.**

실제 진행:

1. `home-art.js`의 대상 위치와 `outside.js`의 유효 범위로 옷장을 찾는다.
2. `Story.begin('home/wardrobe', target)`이 해당 행을 읽는다.
3. `Story.seek`가 `home-choice`를 만나 대사와 선택 대기 상태를 만든다.
4. `home-interactions.js`의 `choiceView`가 `press: 누른다`, `cancel: 취소`를 반환한다. 이 버튼 문구는 이 JS에 있다.
5. `press`는 `home/wardrobePressed`를 시작하고 “아직 애니메이션이 없는 걸...”을 표시한다. `cancel`은 대화를 닫는다.
6. 이 장면에는 실제 옷장 작동 애니메이션이나 보상이 없다. 다른 구현자가 이름만 보고 새 기능을 붙이지 않는다.

## 실제 예제 2 바 대화 선택

현재 0일차 바 장면 `d1_tutorial_chris`에는 `type=choice`, `arg=ch_day0_notion_tutorial`인 단계가 있다. 이름의 `d1`만 보고 1일차라고 고치지 않는다. 실제 `day`와 진입 경로가 기준이다.

- `arg`가 선택 그룹을 가리킨다. `bar_choice_groups`와 그 자식 `bar_choices`가 옵션을 구성한다.
- `when`은 선택 가능 조건, `lock_reason.ko`는 불가 사유, `effects`는 확정 시 효과, `goto`는 분기 장면이다.
- 예를 들어 실제 튜토리얼 선택 행에는 `flag.day0_skip_tutorial = false` 효과가 있다.
- `core.choose(seq)`가 조건을 다시 검사하고 선택 효과와 단계 효과를 적용한다. `goto`가 있으면 대상 장면으로, 없으면 다음 단계로 간다.
- UI는 공통 홀드 컨트롤을 사용하지만, 거래/분기 확정은 반드시 상태 소유자가 수행한다.

현재 `core/story-conditions.js` 조건식은 `&&`, 비교 연산, `!` 및 지원되는 상태값을 사용한다. `||`는 지원하지 않으며 오류가 난다. 효과는 `flag.*`, `affinity.*`, `money`, `reputation`에 대한 지원 연산을 세미콜론으로 나열한다. 플래그에는 boolean 대입만 허용한다. 이것은 범용 JavaScript 실행 문법이 아니다. 외부 JS의 조건을 이 문자열 문법으로 억지로 옮기지 않는다.

## 실제 예제 3 수리 대사와 액션

`web-views.json`의 `neighborhood/repairPaid`는 `script/street`의 `neighborhood-repairPaid`를 가리킨다. 생성된 행은 대사들 사이에 다음 액션을 포함한다.

```json
{"type":"neighborhood-action","action":"repair"}
```

`Story.seek`는 이를 글자로 출력하지 않고 `LunaOutsideNeighborhood.action`에 전달한다. 액션 동안 대사 진행을 기다리고, 수리 암전의 지정 시점에 `elevator_repaired`를 기록한다. 연출이 끝나면 다음 “자 이제 고쳐졌을꺼야” 대사로 돌아간다. 마지막 대화 정상 종료 후 목표 달성 알림을 표시한다.

즉 **비용 차감**, **수리 완료 플래그**, **마지막 대사 종료**, **알림**은 같은 프레임에 일괄 처리하는 한 단계가 아니다. 상세 흐름은 [수리공](events.md#수리공과-엘리베이터)을 따른다.

## 실행기별 역할

| 실행기 | 읽는 것 | 처리하는 것 |
| --- | --- | --- |
| `features/story/story-flow.js` (Game 메서드) | `LUNA_DATA.tables.scenes/steps/bar_choices` | 바 이야기, 조건/효과, 주문·제조와 연결 |
| `campaign.js` + `day-flow.js` + `cinema-flow.js` | `LUNA_CAMPAIGN_DATA`와 진행 상태 | 도입부, 장면 전환, 테라스·기억·일차 연결 |
| `outside-story.js` | `LUNA_OUTSIDE_DIALOGUES` 또는 `LUNA_DATA.sharedStory` | 외부 타이핑·수동/자동·선택 대기·액션 위임 |
| 각 외부 이벤트 모듈 | 진행 플래그와 해당 대사 배열 | 등장, 선택 목록, 재검사, 보상, 완료/재방문 |
| `cinema/` 및 Studio 플레이어 | 연출 프로젝트·대사 대기 상태 | 카메라·배치·타임라인과 자동/수동 재생 |

`LUNA_OUTSIDE_DIALOGUES`는 기존 외부 대사 호출을 연결하는 계층이다. 같은 문구의 CSV·런타임·JS fallback이 보이면 세 개의 독립 정본이 아니다. CSV에 연결된 대사는 CSV가 원본이며 생성본을 고치지 않는다. 반대로 `choiceView`가 직접 만드는 문구/분기는 그 모듈이 현재 실행 원본이다.

## 안전한 변경 순서

1. 본편에서 대상 장면을 확인하고 [사건 목록](events.md)에서 실행 담당을 찾는다.
2. 해당 키를 `web-views.json`에서 찾아 `source` / `scene` / 필요 시 `branch`를 확인한다.
3. 원본 장면의 `row_id`와 자식 관계를 따라 수정한다. 기존 대사 값 변경과 새 장면/옵션 추가를 구분한다.
4. 새 행은 스키마·고유 ID·부모·순서와 뷰 연결을 함께 검사한다. 새 액션 타입이면 실행기 처리도 필요하다. 데이터 추가만으로 자동 동작한다고 보지 않는다.
5. CSV 변경 시 아래 명령으로 산출물을 재생성하고 검사한다.

```sh
node tools/build-shared-data.cjs --write
node tools/build-shared-data.cjs
node tools/run-tests.cjs data
node tools/check-structure.cjs
node tools/check-site.cjs
```

6. 해당 사건 테스트와 본편 경로를 검사한다. 첫 만남/재방문, 조건 충족/부족, 취소, 설정 복귀, 중복 입력, 장면 이탈 후 재진입을 포함한다.
7. 바뀐 확정 규칙과 테스트를 같은 변경에 기록한다. 엔진 디렉터리에 자동 복사하지 않는다.

공통 CSV의 구조와 연결 ID는 **엔진 기준**으로 맞춘다. 웹의 CSV는 같은 데이터의 웹 실행용 사본이며, 양쪽에서 독립적으로 수정한 내용을 자동으로 덮어쓰지 않는다. 내용 변경 후에는 차이를 확인하고 승인된 방향으로 동기화한다. 같은 CSV라도 외부 실행 코드·표현 연결이 다르면 플레이 결과는 달라질 수 있다.
