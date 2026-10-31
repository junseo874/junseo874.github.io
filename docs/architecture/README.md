# 구조와 수정 지점

현재 웹 본편이 구현 기준입니다. 처음에는 이 안내와 [상태·의존성 구조](modules.md)만 읽고, 필요한 기능으로 좁혀 들어가세요. 전체 파일이나 과거 기록을 한꺼번에 읽을 필요는 없습니다.

## 먼저 찾기

```sh
node tools/locate.cjs                   # 기능 목록
node tools/locate.cjs 외부              # 관련 코드·문서·엔진 대응 위치
node tools/locate.cjs scoreCraft        # 함수가 옮겨져도 현재 파일/행 찾기
node tools/locate.cjs campaign --symbols
```

기본 출력은 파일 40개·심볼 80개로 제한합니다. 필요한 경우에만 `--all` 또는 `--json`을 사용하세요. 심볼 목록은 가벼운 탐색용 윤곽이며 완전한 호출 그래프는 아닙니다.

## 수정 지점

경로는 `bar-playtest/src/` 기준입니다. 기능별 JS/CSS는 같은 곳에 둡니다.

| 바꿀 기능 | 소유 파일 / 폴더 |
| --- | --- |
| 시작·전체 화면·입력 연결 | `app/app.js` |
| 게임 상태·초기화·공통 tick | `core/core.js` |
| CSV 조건·효과식 | `core/story-conditions.js` |
| 바 대사·선택·스토리 주문·해금 | `features/story/story-flow.js` |
| 일반 손님·좌석·코스터 | `features/bar/guest-service.js` |
| 수익·호감도·하루 정산 | `features/bar/settlement.js` |
| 바 표시·대화 기록 | `features/bar/bar-views.js`, `dialogue-history.js` |
| 제조 준비 | `features/crafting/preparation-flow.js` |
| 제조 큐·기믹 진행·제공 | `features/crafting/craft-flow.js` |
| 단위 변환·레시피 판정 | `features/crafting/craft-rules.js` |
| 개봉·쉐이크·스터 연산 | `features/crafting/gimmick-mechanics.js` |
| 개별 기믹 화면·따르기 물리 | `features/crafting/*-view.js`, `pour-fluid.js` |
| 외부 상태·이동·상호작용 | `features/outside/outside.js` |
| 외부 화면·카메라·HUD·입력 | `features/outside/outside-view.js` |
| 외부 사건·상점·대사 타이핑 | `features/outside/events/` |
| 집 배치·상호작용 | `features/outside/home-*.js` |
| 거리 조명·비·그림자·광고 차량 | `features/outside/effects/` |
| 본편 화면 조율·입력 | `features/campaign/campaign.js` |
| 일차·출퇴근·휴식·장면 전환 | `features/campaign/day-flow.js` |
| 컷씬 로딩·회상·스킵·종료 | `features/campaign/cinema-flow.js` |
| 컷씬 공통 재생 | `cinema/` |
| 말풍선·선택지·공유 UI·오디오 | `shared/dialogue`, `shared/ui`, `shared/audio` |
| 개발자 기능·리소스 검수 | `dev/` |
| 컷씬 편집기 | 저장소 루트 `cutscene-studio/src/` |

## 필요한 문서만 읽기

- [상태 소유권·모듈 연결·엔진 대응](modules.md): 새 기능을 어디에 추가할지
- [본편 공통 규칙](../gameplay/README.md), [사건 흐름](../gameplay/events.md), [CSV와 실행 연결](../gameplay/data-and-dialogue.md)
- [말풍선 표현](dialogue-presentation.md), [바·제조·QA](bar-and-crafting.md), [외부 배치·효과](outside.md)
- [거리 렌더링 상세](street-atmosphere.md): 빛·그림자·물웅덩이 수정 때만
- [데이터·로딩 계약](loading.md), [검증 방법](testing.md), [리소스 규칙](../../bar-playtest/assets/README.md)

## 보존할 경계

- 빌드 없는 정적 사이트이며 classic script의 순서 의존성을 유지합니다. 모듈을 추가할 때 소유 파일보다 먼저 로드합니다.
- 공개 HTML 주소, 저장 키, 캐릭터·아이템·장면 ID, CSV 값, 리소스 원본을 구조 정리 때문에 바꾸지 않습니다.
- `data/shared-csv/`는 편집 원본, `data/presentation/`은 표현 설정, `data/runtime/`은 실행 데이터입니다. 컷씬의 대형 이미지 스냅샷도 `data/runtime/cinema-assets.js`에 둡니다.
- `runtime-contract.json`은 로딩 순서 검사용, `feature-map.json`은 탐색용입니다. 게임은 이 문서 파일을 읽지 않습니다.
- 파일 이동은 `path-migrations.json`, 함수 분리는 위 표와 탐색 도구에서 찾습니다. 옛 경로 문서 전체를 읽지 마세요.
- 인라인 소스맵·이미지 데이터는 실행 코드에 다시 넣지 않습니다. 원본 JS를 직접 디버깅합니다.
