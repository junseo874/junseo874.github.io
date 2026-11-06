# 외부 공간 구현

[구조 안내](README.md)에서 필요한 기능만 찾아 읽으세요. 게임 동작의 기준은 [본편 규칙](../gameplay/README.md)이며, 이 문서는 구현 위치를 설명합니다.

## 외부 대상과 캐릭터 배치 구현

### 현재 배치 기준: Unity 장면, 이미지는 웹 최신본

`data/presentation/engine-world-layout.js`/`.json`은 Unity `Home.unity`, `OutSide.unity`, Sprite importer 메타데이터의 읽기 전용 스냅샷입니다. `src/features/outside/engine-world-layout.js`가 기존 이미지 등록 이후 위치·스케일·레이어를 연결합니다. **이미지를 엔진의 옛 버전으로 되돌리지 않습니다.** `tools/import-engine-world.rb --write`는 배치/프레임 메타데이터만 갱신하며 PNG를 복사하지 않습니다.

- 최신 결정은 **NPC 크기와 앞뒤 순서도 엔진 기준**입니다. 사건 NPC의 루트와 시각 자식 오프셋을 구분하고, 129×138 전체 셀을 확대하는 대신 엔진의 잘린 프레임을 사용합니다. 대사·등장 조건·아이템 지급·애니메이션 시계는 기존 웹 소유자가 유지합니다. `actorNodes()`는 배경을 그리기 전에 NPC 렌더 명령을 만들고 Unity 레이어/순서로 정렬합니다.
- 중요한 원본 상태: 사건용 사람·시바의 엔진 높이는 대부분 1.7이며 Default 레이어/order 100입니다. 거리 배경보다 뒤에 있어 가려질 수 있습니다. 웹에서 임의로 앞으로 꺼내거나 줄이지 않습니다. 이 상태의 원인은 엔진 배치이며, 스냅샷의 `actors`에서 확인할 수 있습니다.
- 집의 새 분리 이미지와 이전 엔진 이미지의 캔버스 범위가 다릅니다. 방 전체는 출입문 기준으로 맞추고, 대응되는 TV·문·옷걸이·소파·화분·테이블은 엔진 위치를 사용합니다. 새 TV 화면은 TV, 책은 테이블의 자식 오프셋을 따릅니다. 침대·옷장 등 새 분리 요소는 방의 로컬 좌표를 유지합니다. 시작/기상 컷씬도 `LunaHomeArt.studioPose()`로 같은 배치를 사용합니다.
- 거리 건물·난간·승강기·표지판·배경의 대응 Renderer는 엔진 월드 변환을 사용합니다. 승강기 몸체를 웹에서 별도 모터 조각으로 나누던 배치는 제거하고 엔진의 한 Renderer와 순서로 맞췄습니다. 기존 PNG는 유지합니다.
- 일반 화면 폭은 엔진의 480/100=4.8이며 브라우저 크기에 따라 시야 폭을 바꾸지 않습니다. 장면 Confiner를 적용하고 승강기 확대 폭 19.2, 오프셋 (8.4,-0.5), 확대 3초·복귀 6초와 원본 곡선을 사용합니다. 테라스는 엔진의 고정 `CM_Terrace`와 캐릭터·난간 좌표를 사용하며 기존 웹 전용 좌→우 진입 팬은 적용하지 않습니다.
- 신문 NPC는 엔진 변기 위치에 붙습니다. 엔진에 대응 사건이 없는 기신교 신도·행인·새 등은 삭제하거나 다른 NPC로 대체하지 않습니다. 엔진의 비활성 상호작용 예제 및 엔진에만 있는 `street_neighbours` 대사는 본편에 추가하지 않습니다.
- `node bar-playtest/tools/export-web-world-layout.cjs --write`는 실행 중인 로컬 웹을 읽어 `data/presentation/web-world-layout.json`을 만듭니다. `placementSource`가 `engine`, `web-child`, `web-room-frame`, `web-only`인지 구분합니다. 외부 대사 CSV에는 장면 배치 컬럼이 없으므로 좌표를 대사나 효과식에 끼워 넣지 않습니다. 엔진 원본 및 CSV 내용은 이 배치 작업으로 수정하지 않습니다.

검증: `test-engine-world-layout.cjs`, `test-engine-world-layout-ui.cjs`, `test-engine-terrace-layout-ui.cjs`. 0~3일차 출퇴근/집/집 앞/바 진입 24조합, 프레임 범위, 이미지 누락, 승강기 카메라, NPC 자식 오프셋에 따른 윤곽선, 테라스 좌표를 검사합니다. 최신 웹의 분리 드럼통 앞면·불꽃은 엔진에 맞춘 배경 오브젝트의 자식 오프셋으로 배치하며 뒤판→불꽃→앞판 순서를 유지합니다.

기존 `outside`/`cinema` 검사의 일부는 과거 웹 좌표·발 잘라내기·테라스 진입 팬·NPC 전경 배치를 고정값으로 기대하므로 이 모드와 맞지 않습니다. 전체 회귀 묶음이 통과한 것으로 취급하지 않습니다. 아래의 과거 웹 전용 크기·화면 배치 수치는 엔진 스냅샷이 없는 독립 미리보기의 폴백이며 본편에서는 위 어댑터가 우선합니다. Unity 실행 화면의 셰이더까지 픽셀 단위로 일치한다는 뜻은 아닙니다.

등장 조건·대화·보상·완료 시점은 [사건별 흐름](../gameplay/events.md)에 통합했습니다. 아래는 화면 구현에 필요한 좌표·리소스 정보입니다.

- 집의 책·침대·옷장은 `home-art.js`의 `bookTarget()`, `bedTarget()`, `wardrobeTarget()`과 원본 배경 마스크를 사용합니다. 침대와 소파의 별도 침구 이미지를 혼동하지 않습니다. 책 표지는 `assets/outside/chris-home/nietzsche-the-gay-science.png`에 원본 그대로 보존하고 `outside-inspection.js`의 조사 UI로 표시합니다.
- `outside-neighborhood.js`의 `places`가 박스·착지점·소파·NPC 좌표를 소유합니다. `poses()`가 발·방향·크기·프레임·말풍선 기준을 소유합니다. 사람 시트는 `outside-ambient.js`의 `sheets/roleKinds/sprite()`가 본편·컷씬·리소스 확인에 공통 공급합니다. 2026-10-31 제공 원본은 `assets/outside/characters/`에 있으며, 이웃(1·2일차 복도/부비 이벤트)은 Neighbor, 수리공은 Repairman, 집 크리스는 Chris, 갱단 보스는 Gang5, 입구 경비는 Gang1, 나머지 세 명은 Gang2/3/4입니다. 부비는 교체 가능한 Canvas 더미를 사용합니다.
- 새 사람 시트는 모두 129×138 셀, 발끝 행 114, 100 PPU입니다. 원본 크기 그대로 사용하며 Gang5는 이미 큰 체형이므로 추가 확대하지 않습니다. 6/8/9프레임은 루나의 9프레임·12FPS 대기와 같은 0.75초 주기로 재생합니다(각 8/10.667/12FPS). 프레임 전체의 알파 합집합으로 말풍선 기준을 고정합니다. 제공 파일은 Idle뿐이므로 이동 중에는 기존 이동 경로·방향·속도와 해당 Idle을 사용하며, 별도 걷기 애니메이션이 등록된 것으로 취급하지 않습니다.
- 사람 셀 129×138의 실제 발끝 114px을 원점으로 둡니다. 도로는 -0.974, 복도는 `upperY - 0.274`로 루나와 맞춥니다. 갱단과 해당 구간 루나는 폐품 전경 앞 보행면에 그리며 복도 난간·엘리베이터의 가림은 유지합니다.
- `outside-ambient.js`의 `head/bounds`는 프레임별 투명 여백 대신 알파 합집합으로 머리를 측정합니다. 옆집 주민 이동은 초당 0.24 월드 단위, 고양이와 정지 간격은 0.60입니다. 수리공 퇴장 방향은 루나 반대쪽이며 1.6초에 종료합니다.
- 부비 첫 휴식 `chris-in` 액션은 0.45초 암전, TV 오른쪽 크리스 배치, 페이드 인과 0.32 월드 단위 좌→우 이동입니다. 카메라 폭 4.8·높이 0.023은 고정입니다. 사건의 뒤 연결은 이곳이 아니라 `playSleepScenes`를 따릅니다.
- 삼호 외부 대기·대화는 `samho-animation.js`의 동일 Idle 8프레임/12FPS를 사용합니다. 실루엣 호흡 프레임은 `outside-ambient.js`에서 루나 주기에 맞춥니다. 삼호 원본과 실루엣 프레임 수를 같다고 가정하지 않습니다.
- `outside-discovery.js`는 과거 이력·좌표 투영 API 호환만 유지합니다. 표식 렌더링은 비활성입니다. 선택지 피드백은 `world-choices.js`와 `data/presentation/choice-feedback.js`, 말풍선 화면 보정은 `world-speech.js`가 소유합니다.
- `outside-newspaper.js`는 1일차 변기 앞 신문 NPC의 등장·분기·기어 보상을 소유합니다. M2 원본 실루엣을 재사용하고 layer 9에서 변기/쓰레기통 앞에 그립니다. `newspaper/*` CSV 대사를 읽으며 공통 NPC 머리 경계·윤곽선·말풍선을 사용합니다. 부품은 칵테일 재료로 등록하지 않고 `outside-notices.js`의 퀘스트 아이템 알림으로 표시합니다.
- `outside-believer.js`는 기신교 신도의 기간별 등장·완료 후 숨김·엠블럼 지급을 소유한다. M1 원본을 layer 9에 배치하며 `believer/*` CSV, 공통 말풍선/윤곽선/타이핑을 재사용한다. 완료와 보상 플래그를 분리해 중단 후 중복 지급을 막고, 아이템은 `outside-notices.js` 퀘스트 알림으로 표시한다. 세부 규칙은 [사건 흐름](../gameplay/events.md#기신교-신도)을 따른다.
- `outside-corridor-birds.js`는 주거 건물 윗벽의 일곱 마리를 소유한다. 우천 까마귀/건조 비둘기, 발 기준·좌표·렌더 순서·공유 시트와 시계는 [새 구현 명세](ambient-birds.md#거리-윗벽)를 따른다.

검증: `test-neighborhood-staging-ui.cjs`, `test-samho-idle-ui.cjs`, `test-home-book-ui.cjs`, `test-home-bed-ui.cjs`, `test-home-wardrobe-ui.cjs`, `test-outside-discovery-stability-ui.cjs`. 진행 분기는 `outside` 묶음, 0~3일차 날씨/환경음 조합은 `test-weather-ambience-matrix-ui.cjs`.

## 거리 셰이더 스냅샷

까마귀·비둘기의 공통 설정과 테라스/거리 차이, 전체 좌표·시계·발 기준·레이어는 [새 구현 문서](ambient-birds.md)를 따른다. 공통 원본은 `data/presentation/bird-sprites.js`이며 거리 렌더러가 테라스 실행기를 참조하지 않는다. 외부 액션별 입력 잠금과 복귀는 [조작 잠금 계약](../gameplay/input-locks.md)에 모았다.

광고 차량 순환: `flightBounds`(-24~10)은 맵과 차체 폭 바깥의 재등장 경계입니다. 각 노선은 이동 시간 `duration`으로 즉시 순환하며 별도 소멸 대기 구간은 없습니다. 경계 확장 시 이동 시간을 같은 비율로 늘려 기존 속도를 유지합니다. 순환은 게임 시간만 사용하고 광고 시계·카메라 상태를 초기화하지 않습니다.

공중 광고 차량은 `outside-ad-carrier.js`가 별도 소유합니다. `assets/outside/vehicles/ad-carrier.png`를 외부 장면 이미지 로더에 등록하여 진입 전에 디코드합니다. 차체와 광고는 1280×592 캐시에 합성하고 게임 시간의 24fps 단위로 표현합니다. 320×148은 레이아웃 좌표일 뿐 저해상도 중간 비트맵으로 쓰지 않습니다. 차체 원본 파일은 보존하며 중앙 직선 구간만 20px 연장합니다. 안테나·모서리·추진기는 늘리지 않습니다. 광고 패널은 134×56이며 인물 원화는 비율을 유지해 채웁니다. 원본 크기에서 알파 보정 후 고품질 축소하며, 최종 화면도 고품질 샘플링과 물리 픽셀 위치 정렬을 사용합니다. 원본의 고체 영역 알파 250–255는 캐시에서 255로 보정하고 차체에 불투명 청색 음영을 합성합니다. 거리감에 전체 투명도를 쓰지 않습니다. 광고는 게임 시간 기준 5초마다 슬라이드 없이 즉시 전환, 좌우 이동 시 글자는 뒤집지 않습니다. 크기는 최초 버전 대비 약 15% 확대, 이동은 25% 감속이며 광고 시계는 감속하지 않습니다. 렌더링 순서는 원경 → 중경 건물과 부착 디스플레이(layer 3–5) → 광고 차량 → 주거 건물·거리 전경입니다. 같은 layer 5를 사용하는 주거 건물은 `streetDrawOrder`에서 중경 뒤로 정렬하여 차량보다 앞에서 가립니다. 두 노선 높이는 2.55/7.5로 이전보다 각각 0.65 낮췄습니다. 여성 인물 원화 2종(ad-portrait-violet/crimson.png)은 artAssets로 외부 진입 전 미리 로드합니다. KORATECH·UNKNOWN 인물 광고와 Canvas PORT 발광 문양을 번갈아 표시하며, 가는 LED 세로줄·가로 주사선·느린 광택 띠·하단 작은 티커만 움직입니다. 원화 생성 방식과 프롬프트·영상 분석은 assets/outside/vehicles/ad-art-provenance.json에 기록했습니다. 독립 render 호출은 다섯 번째 인자로 로드된 이미지 Map을 전달합니다. 리소스 검수에서는 차체와 두 원화를 개별 카드로 확인하고 전경 보기로 시작합니다. 집/QA에서는 생성하지 않습니다. 광고 문구·속도·노선은 해당 모듈의 `ads`, `routes`, `travelRate`에서 수정합니다.

`bar-playtest/tools/import-street-effects.cjs --write`는 Unity의 `OutSide.unity`, `SH_LedSignScroll`, `NeonFlicker`, `M_Crt01–09`에서 필요한 설정과 PNG만 **웹으로** 복사합니다. 엔진은 읽기 전용이며 전체 장면 재수입은 하지 않습니다. 다른 체크아웃은 `--engine=/경로/HumanBartender`를 사용합니다. `--write` 없이 실행하면 스냅샷 일치 여부만 검사합니다.

원본 PNG는 `assets/outside/effects/`에 바이트 그대로 보존합니다. RGBA 소등 마스크는 독립 데이터 채널이므로 브라우저의 투명 픽셀 처리로 RGB가 사라지지 않도록 좌표 데이터도 생성합니다. 전광판 이동·팬 샘플링·깜빡임 횟수와 소등 시간은 엔진 설정을 따릅니다. 단, 웹의 8개 간판/조명 그룹은 한 차례 깜빡임이 끝난 뒤 다음까지 각각 8–22초 랜덤 대기합니다(기준 15초, `burstsPerMinute=4`, `intervalRandomness=7/15`, 모든 `frequencyScale=1`). 첫 시작은 기존 분산 방식으로 0–22초이며, 재수입 도구도 이 웹 대기 설정을 보존합니다. 엔진 파일은 변경하지 않습니다. 주변 빛 번짐은 기존 Canvas 렌더러용 근사이며 Unity URP의 픽셀 단위 출력과 동일하지는 않습니다. 거리 진입 전에 기존 외부 이미지 로더가 새 에셋도 로드합니다. 테라스 효과와 게임 진행 좌표는 변경하지 않습니다.

검증: `test-street-engine-effects.cjs`, `test-street-engine-effects-ui.cjs` (둘 다 `outside` 묶음에 포함).

## Street puddles, fog and postprocessing

`data/presentation/street-atmosphere.js` contains read-only Unity scene overrides; `src/features/outside/effects/street-atmosphere.js` and `street-atmosphere-renderer.js` render world-anchored pools, three fog layers, the authored light shaft and linear-color bloom before lens water. See [street-atmosphere.md](street-atmosphere.md) for source settings, rendering order, browser adaptations and tests. Import only with `bar-playtest/tools/import-street-atmosphere.cjs --write`; original art and engine files remain untouched.
