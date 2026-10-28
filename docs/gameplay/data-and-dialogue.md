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
| 바 선택지 | `story/bar_choice_groups.csv`, `bar_choices.csv`; `core.js`의 `choose`가 조건·효과·이동 실행 |
| 외부 선택지 | 공통 `street_choices.csv`만 보지 말고 해당 NPC 모듈의 `choiceView` / `choose` 확인. 현재 동적 옵션은 JS가 소유하는 경우가 많음 |
| 외부 불가 사유 표현 | `data/presentation/choice-feedback.js`와 각 이벤트의 `disabledReason` |
| 칵테일·재료·제조량 | `craft/cocktails.csv`, `shelf_items.csv`, `recipes.csv` |
| 손님·주문·점수·정산 | `guests/`, `craft/order_rules.csv`, `settings/` + `src/core/core.js` |
| 외부 등장/해금/거래/완료 조건 | `src/features/outside/events/`의 해당 모듈 |
| 본편 진입·일차·휴식 연결 | `src/features/campaign/campaign.js`, `campaign-engine.js` |
| 캐릭터/이미지 경로 | `data/presentation/runtime-assets.json`, 해당 장면/표현 데이터; [리소스 안내](../../bar-playtest/assets/README.md) |
| 카메라·피벗·애니메이션·임시 좌표 | outside/campaign/cinema의 해당 모듈 및 presentation 데이터 |
| 편집기 컷씬 | `cutscene-studio/`의 프로젝트와 본편 cinema 연결. 대사 CSV와 별도 연출 계층 |

`interaction/`의 등록 데이터가 있다고 모든 항목이 본편에서 자동 생성되는 것은 아니다. `targets`, `visible`, `interact` 등 실제 소비 코드를 확인한다. 데이터에 있는 미사용 필드나 `skippable` 값을 임의로 활성화하지 않는다.

## CSV 구조를 읽는 법

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

현재 `core.js` 조건식은 `&&`, 비교 연산, `!` 및 지원되는 상태값을 사용한다. `||`는 지원하지 않으며 오류가 난다. 효과는 `flag.*`, `affinity.*`, `money`, `reputation`에 대한 지원 연산을 세미콜론으로 나열한다. 플래그에는 boolean 대입만 허용한다. 이것은 범용 JavaScript 실행 문법이 아니다. 외부 JS의 조건을 이 문자열 문법으로 억지로 옮기지 않는다.

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
| `core.js` | `LUNA_DATA.tables.scenes/steps/bar_choices` | 바 이야기, 조건/효과, 주문·제조와 연결 |
| `campaign.js` | `LUNA_CAMPAIGN_DATA`와 진행 상태 | 도입부, 장면 전환, 테라스·기억·일차 연결 |
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

공통 CSV는 **웹 저장소 소유**이다. 엔진 팀이 이 원본과 이 명세를 가져가 구현한다. 옛 양방향 동기화 도구나 원본 재수입으로 웹의 최신 내용을 덮어쓰지 않는다. 같은 CSV라도 외부 실행 코드·표현 연결이 다르면 플레이 결과는 달라질 수 있다.
