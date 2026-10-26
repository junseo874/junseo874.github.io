# 구조와 수정 지점

게임 규칙의 정본은 [본편 구현 확정 기준](../gameplay/README.md)입니다. 이 파일은 웹 구현 위치·좌표·리소스·로드 순서를 설명합니다. 대화/사건 규칙은 [사건별 흐름](../gameplay/events.md), CSV 사용은 [데이터와 대화 연결](../gameplay/data-and-dialogue.md)을 먼저 읽으세요. 현재 웹 본편이 확정 기준이며, 과거 노션·주석이나 도구 전용 동작이 이를 덮어쓰지 않습니다.

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
| 올드패션드 재료 목표 달성 알림 | `bar-playtest/src/features/campaign/restoration-notices.js` |
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

### 공통 규칙의 위치

입력·선택지·주변 대화·물음표 제거·이벤트 우선순위·상태 유지 규칙은 [본편 구현 확정 기준](../gameplay/README.md)에 통합했습니다. 이 파일에 별도 규칙 사본을 유지하지 않습니다.

### 본편 필터 구현

본편과 도구의 포함/제외 목록은 [본편 범위](../gameplay/README.md#본편과-도구의-경계)를 따릅니다. `campaign-engine.js`의 `Session.install`은 원래 테이블 참조를 보관하고 본편 세션에서만 필터링합니다. `uninstall`은 참조를 복원합니다. 검증: `test-long-island-main-excluded-ui.cjs`.

### 올드패션드 알림 구현

`restoration-notices.js`의 `LunaRestorationNotices.check`가 실제 거래 뒤 호출됩니다. 목표 ID는 `old_fashioned_materials`, 레시피 팝업은 `johnnyUnlock`입니다. 목표와 실제 해금의 차이는 [바 영업과 제조](../gameplay/README.md#바-영업과-제조)를 따릅니다. 검증: `test-restoration-notices.cjs`, `test-restoration-notices-ui.cjs`.

### 포트 작업장 보관 구현

`workshop`의 원본·ID는 보존하고 `cutscene-library.js`에서 독립 재생합니다. 본편 마감 연결은 `campaign.js`의 `playSleepScenes`가 소유합니다. [밤 대화 추적 순서](../gameplay/events.md#바와-밤-대화의-추적-순서) 참조.

### 시뮬레이터 와인 개봉

기믹 미니게임 목록의 **와인 개봉 → 버전 선택**에서만 실행합니다. 사용자 `2버전.html`은 버전 1(호일·스크류·뽑기), `4버전.html`은 버전 2(중앙 맞추기·기울기·2단 지렛대·린넨 포함)에 대응합니다. 본편 큐·레시피·CSV·저장 데이터에는 연결하지 않습니다. `minigames.js`의 기본 `KINDS`/`startMinigame` 계약도 유지합니다.

각 버전은 별도 문서에서 동작하고 공통 `session.js`가 이미지 준비, 활성 시간 기준 지연 작업, 재시작 취소, Esc/포커스 이탈 일시정지, 드래그 해제, 소리 및 종료를 담당합니다. 상위 화면은 출처와 iframe 창을 확인한 메시지로 버전 선택/목록 복귀만 받습니다. 16:9 검정 레터박스를 유지하고 원본 2184×1164 조작 좌표는 렌더·포인터에 동일 변환을 적용합니다. 병은 기존 `item_red_wine` 원본을 등비 확대하고, 오프너는 제공 HTML의 동일 PNG를 바이트 그대로 추출했습니다. `resources.json`에 출처를 기록했습니다. `test-wine-practice-ui.cjs`는 두 버전 실제 포인터 완주·실패·재시작 타이머·일시정지·화면 비율·진행 데이터 보존을 검사하며 `craft` 묶음에 포함됩니다.

### 제조 시계 구현

`bar-views.js`의 `craftTimer()`는 한 제조 시도의 `craft.elapsed`를 모든 제조 화면에 표시합니다. `gimmick.elapsed`는 단계별 동작·리듬 계산용입니다. 합산/제외 규칙은 [바 영업과 제조](../gameplay/README.md#바-영업과-제조)에 있습니다. 검증: `test-craft-clock.cjs`, `test-craft-clock-ui.cjs` (`craft` 묶음).

### 재화 알림

바·제조·외부·검수용 재화 알림은 `shared/ui/currency-view.js`와 `currency-view.css`를 공유합니다. 등록된 `assets.money` (`assets/ui/imported/money.png`)는 제공된 `IMG_money.png`와 바이트까지 동일한 원본이며 아이콘과 배경을 한 장으로 사용합니다. 542:108 비율을 유지하고 기존 절반 크기·우측 상단 위치·증감 타이밍은 유지합니다. 별도 SVG 동전이나 둥근 테두리는 덧씌우지 않습니다. 큰 금액은 글자 수에 따라 숫자만 축소합니다. 외부의 증분 갱신에서도 `--currency-digits`를 동기화합니다. 공통 사전 로딩 목록과 리소스 검수 등록 키는 기존 `money`를 그대로 사용합니다.

### 외부 대상과 캐릭터 배치 구현

등장 조건·대화·보상·완료 시점은 [사건별 흐름](../gameplay/events.md)에 통합했습니다. 아래는 화면 구현에 필요한 좌표·리소스 정보입니다.

- 집의 책·침대·옷장은 `home-art.js`의 `bookTarget()`, `bedTarget()`, `wardrobeTarget()`과 원본 배경 마스크를 사용합니다. 침대와 소파의 별도 침구 이미지를 혼동하지 않습니다. 책 표지는 `assets/outside/chris-home/nietzsche-the-gay-science.png`에 원본 그대로 보존하고 `outside-inspection.js`의 조사 UI로 표시합니다.
- `outside-neighborhood.js`의 `places`가 박스·착지점·소파·NPC 좌표를 소유합니다. `poses()`가 발·방향·크기·프레임·말풍선 기준을 소유합니다. 사람은 기존 `ambient-M1/M2/W1` 스프라이트, 부비는 교체 가능한 Canvas 더미를 사용합니다.
- 사람 셀 129×138의 실제 발끝 114px을 원점으로 둡니다. 도로는 -0.974, 복도는 `upperY - 0.274`로 루나와 맞춥니다. 갱단과 해당 구간 루나는 폐품 전경 앞 보행면에 그리며 복도 난간·엘리베이터의 가림은 유지합니다.
- `outside-ambient.js`의 `head/bounds`는 프레임별 투명 여백 대신 알파 합집합으로 머리를 측정합니다. 옆집 주민 이동은 초당 0.24 월드 단위, 고양이와 정지 간격은 0.60입니다. 수리공 퇴장 방향은 루나 반대쪽이며 1.6초에 종료합니다.
- 부비 첫 휴식 `chris-in` 액션은 0.45초 암전, TV 오른쪽 크리스 배치, 페이드 인과 0.32 월드 단위 좌→우 이동입니다. 카메라 폭 4.8·높이 0.023은 고정입니다. 사건의 뒤 연결은 이곳이 아니라 `playSleepScenes`를 따릅니다.
- 삼호 외부 대기·대화는 `samho-animation.js`의 동일 Idle 8프레임/12FPS를 사용합니다. 실루엣 호흡 프레임은 `outside-ambient.js`에서 루나 주기에 맞춥니다. 삼호 원본과 실루엣 프레임 수를 같다고 가정하지 않습니다.
- `outside-discovery.js`는 과거 이력·좌표 투영 API 호환만 유지합니다. 표식 렌더링은 비활성입니다. 선택지 피드백은 `world-choices.js`와 `data/presentation/choice-feedback.js`, 말풍선 화면 보정은 `world-speech.js`가 소유합니다.

검증: `test-neighborhood-staging-ui.cjs`, `test-samho-idle-ui.cjs`, `test-home-book-ui.cjs`, `test-home-bed-ui.cjs`, `test-home-wardrobe-ui.cjs`, `test-outside-discovery-stability-ui.cjs`. 진행 분기는 `outside` 묶음, 0~3일차 날씨/환경음 조합은 `test-weather-ambience-matrix-ui.cjs`.

### 거리 셰이더 스냅샷

광고 차량 순환: `flightBounds`(-24~10)은 맵과 차체 폭 바깥의 재등장 경계입니다. 각 노선은 이동 시간 `duration`으로 즉시 순환하며 별도 소멸 대기 구간은 없습니다. 경계 확장 시 이동 시간을 같은 비율로 늘려 기존 속도를 유지합니다. 순환은 게임 시간만 사용하고 광고 시계·카메라 상태를 초기화하지 않습니다.

공중 광고 차량은 `outside-ad-carrier.js`가 별도 소유합니다. `assets/outside/vehicles/ad-carrier.png`를 외부 장면 이미지 로더에 등록하여 진입 전에 디코드합니다. 차체와 광고는 1280×592 캐시에 합성하고 게임 시간의 24fps 단위로 표현합니다. 320×148은 레이아웃 좌표일 뿐 저해상도 중간 비트맵으로 쓰지 않습니다. 차체 원본 파일은 보존하며 중앙 직선 구간만 20px 연장합니다. 안테나·모서리·추진기는 늘리지 않습니다. 광고 패널은 134×56이며 인물 원화는 비율을 유지해 채웁니다. 원본 크기에서 알파 보정 후 고품질 축소하며, 최종 화면도 고품질 샘플링과 물리 픽셀 위치 정렬을 사용합니다. 원본의 고체 영역 알파 250–255는 캐시에서 255로 보정하고 차체에 불투명 청색 음영을 합성합니다. 거리감에 전체 투명도를 쓰지 않습니다. 광고는 게임 시간 기준 5초마다 슬라이드 없이 즉시 전환, 좌우 이동 시 글자는 뒤집지 않습니다. 크기는 최초 버전 대비 약 15% 확대, 이동은 25% 감속이며 광고 시계는 감속하지 않습니다. 렌더링 순서는 원경 → 중경 건물과 부착 디스플레이(layer 3–5) → 광고 차량 → 주거 건물·거리 전경입니다. 같은 layer 5를 사용하는 주거 건물은 `streetDrawOrder`에서 중경 뒤로 정렬하여 차량보다 앞에서 가립니다. 두 노선 높이는 2.55/7.5로 이전보다 각각 0.65 낮췄습니다. 여성 인물 원화 2종(ad-portrait-violet/crimson.png)은 artAssets로 외부 진입 전 미리 로드합니다. KORATECH·UNKNOWN 인물 광고와 Canvas PORT 발광 문양을 번갈아 표시하며, 가는 LED 세로줄·가로 주사선·느린 광택 띠·하단 작은 티커만 움직입니다. 원화 생성 방식과 프롬프트·영상 분석은 assets/outside/vehicles/ad-art-provenance.json에 기록했습니다. 독립 render 호출은 다섯 번째 인자로 로드된 이미지 Map을 전달합니다. 리소스 검수에서는 차체와 두 원화를 개별 카드로 확인하고 전경 보기로 시작합니다. 집/QA에서는 생성하지 않습니다. 광고 문구·속도·노선은 해당 모듈의 `ads`, `routes`, `travelRate`에서 수정합니다.

`bar-playtest/tools/import-street-effects.cjs --write`는 Unity의 `OutSide.unity`, `SH_LedSignScroll`, `NeonFlicker`, `M_Crt01–09`에서 필요한 설정과 PNG만 **웹으로** 복사합니다. 엔진은 읽기 전용이며 전체 장면 재수입은 하지 않습니다. 다른 체크아웃은 `--engine=/경로/HumanBartender`를 사용합니다. `--write` 없이 실행하면 스냅샷 일치 여부만 검사합니다.

원본 PNG는 `assets/outside/effects/`에 바이트 그대로 보존합니다. RGBA 소등 마스크는 독립 데이터 채널이므로 브라우저의 투명 픽셀 처리로 RGB가 사라지지 않도록 좌표 데이터도 생성합니다. 전광판 이동·팬 샘플링·랜덤 소등 범위와 타이밍은 엔진 설정을 따릅니다. 주변 빛 번짐은 기존 Canvas 렌더러용 근사이며 Unity URP의 픽셀 단위 출력과 동일하지는 않습니다. 거리 진입 전에 기존 외부 이미지 로더가 새 에셋도 로드합니다. 테라스 효과와 게임 진행 좌표는 변경하지 않습니다.

검증: `test-street-engine-effects.cjs`, `test-street-engine-effects-ui.cjs` (둘 다 `outside` 묶음에 포함).

### 데이터와 로딩 경로

CSV의 소유권·메타데이터·생성 흐름·실제 대화 예제·수정 방법은 [데이터와 대화 연결](../gameplay/data-and-dialogue.md)에 통합했습니다. 조회 화면은 `bar-playtest/data-review.html`이며 생성 검사는 `node tools/build-shared-data.cjs`, 수정 후 생성은 `--write`입니다. 웹 저장소가 원본을 소유하며 엔진 자동 복사/역수입은 하지 않습니다.

초기 마이그레이션 백업 `artifacts/shared-data-backup/`은 로컬 전용으로 버전 관리 대상이 아닙니다. 초기 재수입과 구형 생성 도구로 최신 데이터를 덮어쓰지 않습니다. `data/runtime/game-data.js`와 `campaign-data.js`는 직접 편집하지 않습니다.

HTML·자원 경로 계약:

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

### Street puddles, fog and postprocessing

`data/presentation/street-atmosphere.js` contains read-only Unity scene overrides; `src/features/outside/effects/street-atmosphere.js` and `street-atmosphere-renderer.js` render world-anchored pools, three fog layers, the authored light shaft and linear-color bloom before lens water. See [street-atmosphere.md](street-atmosphere.md) for source settings, rendering order, browser adaptations and tests. Import only with `bar-playtest/tools/import-street-atmosphere.cjs --write`; original art and engine files remain untouched.
