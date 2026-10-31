# 상태 소유권과 모듈 연결

이 문서는 구현 구조만 설명합니다. 게임 규칙은 [본편 기준](../gameplay/README.md), 대사·조건·효과 데이터는 [데이터 연결](../gameplay/data-and-dialogue.md)이 정본입니다.

## 실행 흐름

```text
bar-playtest/index.html  ← 순서가 명시된 classic scripts
  app/app.js            ← Game 생성, 화면/입력/오디오 어댑터 조립
    core/core.js        ← 한 영업의 상태와 공통 tick
      story-flow        ← 바 스토리 대사/선택/주문
      guest-service     ← 일반 손님/좌석/코스터
      preparation-flow  ← 레시피/재료/도구 선택
      craft-flow        ← 기믹 큐/제공
      settlement        ← 매출/호감도/하루 정산
    campaign.js         ← 본편 화면/입력 조율
      day-flow          ← 출근/영업/퇴근/휴식/다음 날
      cinema-flow       ← 컷씬 로딩/회상/스킵/종료
    outside.js          ← 외부 Model: 위치/이동/상호작용/사건 상태
      outside-view.js   ← Canvas/DOM/카메라/외부 입력
```

## 상태를 복제하지 않는 분리

| 소유자 | 보관하는 상태 | 다른 모듈의 접근 |
| --- | --- | --- |
| `Game` | 영업, 좌석, 주문, 제조, 금전, 대화 | 분리된 기능 메서드의 `this`는 같은 Game 인스턴스 |
| `Campaign` / `Session` | 본편 일차, 화면, 장면 전환, 진행 전달 | `day-flow`와 `cinema-flow`도 같은 Campaign 사용 |
| 외부 `Model` | 위치·층·탑승·대사·외부 사건 | 화면은 모델을 읽고 기존 명령 메서드 호출 |
| 외부 `create()`의 뷰 | 이미지 캐시, 캔버스, DOM, 카메라, 입력 | 모델 상태를 별도의 영구 데이터로 복사하지 않음 |
| `ui` | 패널·선택·미리보기 등 화면 상태 | 본편 플래그와 QA 미리보기 구분 |

`LunaGameParts`, `LunaCampaignParts`, `LunaRuleParts`, `LunaOutsideParts`는 로딩 시 등록하는 **모듈 팩토리 목록**입니다. 진행 저장소나 이벤트 버스가 아닙니다.

기능 파일의 `create({ ... })`는 필요한 헬퍼를 명시적으로 받습니다. Game/Campaign은 생성 전에 기능 클래스의 메서드 속성을 자기 prototype에 한 번 설치합니다. 따라서 `this`, getter, 비열거 속성, 기존 메서드 이름은 유지됩니다. 기능별 Game 인스턴스를 만들거나 상태를 동기화하지 않습니다. Node 테스트에서는 같은 팩토리를 `require()`로 불러옵니다.

계산은 별도로 분리했습니다.

- `core/story-conditions.js`: 시드 난수, 가중 선택, CSV 조건·효과식 해석. 효과 적용은 전달된 상태를 수정합니다.
- `features/crafting/craft-rules.js`: 단위 변환, 기믹 큐 구성, 제조 판정. 화면을 다루지 않습니다.
- `features/crafting/gimmick-mechanics.js`: 개봉·쉐이크·스터 상태 연산. 세션 전역 상태를 새로 소유하지 않습니다.

`LunaCore` 공개 API, `barGame`, `lunaCampaign`, `outsidePlaytest`와 기존 데이터 ID는 그대로입니다. 기존 확장 모듈과 테스트는 이 인터페이스를 계속 사용합니다.

## 새 콘텐츠 / 새 기능을 추가할 때

1. 대사·레시피·조건 값은 먼저 CSV와 `web-views.json`에서 편집합니다. 생성 데이터는 직접 고치지 않습니다.
2. 기존 action/step으로 표현할 수 없는 동작만 기능 코드에 추가합니다. 바 스토리 분기는 `story-flow`, 외부 사건은 `outside/events`, 일차 연결은 `day-flow`입니다.
3. 함수가 필요한 의존성을 `create` 인자와 조립 지점 양쪽에 명시합니다. 전역 상태의 숨은 사본이나 파일별 초기화 부작용을 만들지 않습니다.
4. 새 팩토리는 HTML에서 소유자보다 먼저 로드합니다. 기존 스크립트 상대 순서·CSS 우선순위는 보존합니다.
5. 두 기능 파일에 같은 메서드를 선언하지 않습니다. `tools/check-code-boundaries.cjs`가 중복·설치 누락을 검사합니다.
6. [테스트 안내](testing.md)에 따라 검증합니다. 구조 변경을 위해 게임 기대값을 바꾸지 않습니다.

본편에서 제외된 포트 작업장 컷씬의 원본과 ID는 유지합니다. `cutscene-library.js`에서만 독립 재생하며 밤 연결은 `day-flow.js`의 `playSleepScenes`가 소유합니다.

## Unity와 대응시키는 기준

확인한 엔진 기준 경로는 `HumanBartender/Assets/01.Game/02.Scripts/`입니다. 숫자 접두사나 C# 파일 규칙을 웹에 복사하지 않고 **역할**을 대응시킵니다. 이 표는 기능 동등성·이식 완료를 뜻하지 않습니다.

| 엔진 영역 | 웹 위치 |
| --- | --- |
| `01.Bootstrap` | `src/app` |
| `02.Core/01.Progression`, `03.SceneFlow` | `src/core`, `features/campaign` |
| `03.Data` | `data/shared-csv`, `data/presentation`, `data/runtime` 및 `tools/lib/shared-data-*` |
| `04.Features/01.Crafting`, `02.Minigames` | `features/crafting`의 준비·흐름·판정·기믹 모듈 |
| `04.Features/03.Tycoon` | `features/bar/guest-service.js`, `settlement.js`, 바 화면 |
| `04.Features/04.Story`, `05.Dialogue` | `features/story`, `shared/dialogue`, 외부 사건 대사 |
| `04.Features/06.Cutscenes` | `src/cinema`, `campaign/cinema-flow.js`, `cutscene-studio/src` |
| `04.Features/07.Outside`, `08.Home` | `features/outside` 및 실제 집 모듈 |
| `05.Presentation` | `shared/audio`, `shared/ui`, `shared/platform`, 각 기능의 view/effects |
| `Assets/01.Game/Editor`, `06.Tests` | `src/dev`, `tools`, `tests` |

웹에서 집은 외부 모델을 공유하므로 별도의 빈 Home/Player 계층을 만들지 않습니다. 저장·풀링 등 엔진에 폴더가 있다는 이유만으로 웹에 미구현 폴더를 만들지 않습니다. `app.js`는 아직 화면 조립·입력이 큰 편이고 외부 뷰는 카메라/렌더 클로저를 공유합니다. 이번 분리는 전면적인 프레임워크 전환이 아니며, 이후 분리도 테스트 가능한 책임 단위로 진행합니다.
