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
| 거리 이동·카메라·상호작용 | `bar-playtest/src/features/outside/outside.js` |
| 거리 인물·상점·강제 이벤트 | `bar-playtest/src/features/outside/events/` |
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

### 거리 셰이더 스냅샷

광고 차량 순환: `flightBounds`(-24~10)은 맵과 차체 폭 바깥의 재등장 경계입니다. 각 노선은 이동 시간 `duration`으로 즉시 순환하며 별도 소멸 대기 구간은 없습니다. 경계 확장 시 이동 시간을 같은 비율로 늘려 기존 속도를 유지합니다. 순환은 게임 시간만 사용하고 광고 시계·카메라 상태를 초기화하지 않습니다.

공중 광고 차량은 `outside-ad-carrier.js`가 별도 소유합니다. `assets/outside/vehicles/ad-carrier.png`를 외부 장면 이미지 로더에 등록하여 진입 전에 디코드합니다. 차체와 광고는 1280×512 캐시에 합성하고 24fps로 갱신합니다. 320×128은 레이아웃 좌표일 뿐 저해상도 중간 비트맵으로 쓰지 않습니다. 원본 크기에서 알파 보정 후 고품질 축소하며, 최종 화면도 고품질 샘플링과 물리 픽셀 위치 정렬을 사용합니다. 원본의 고체 영역 알파 250–255는 캐시에서 255로 보정하고 차체에 불투명 청색 음영을 합성합니다. 거리감에 전체 투명도를 쓰지 않습니다. 광고는 게임 시간 기준 5초마다 슬라이드 없이 즉시 전환, 좌우 이동 시 글자는 뒤집지 않습니다. 크기는 최초 버전 대비 약 15% 확대, 이동은 25% 감속이며 광고 시계는 감속하지 않습니다. 렌더링 순서는 원경 → 중경 건물과 부착 디스플레이(layer 3–5) → 광고 차량 → 주거 건물·거리 전경입니다. 같은 layer 5를 사용하는 주거 건물은 `streetDrawOrder`에서 중경 뒤로 정렬하여 차량보다 앞에서 가립니다. 두 노선 높이는 2.55/7.5로 이전보다 각각 0.65 낮췄습니다. 리소스 검수에서는 전경 보기로 시작합니다. 집/QA에서는 생성하지 않습니다. 광고 문구·속도·노선은 해당 모듈의 `ads`, `routes`, `travelRate`에서 수정합니다.

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
