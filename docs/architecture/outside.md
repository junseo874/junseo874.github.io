# 외부 공간 구현

[구조 안내](README.md)에서 필요한 기능만 찾아 읽으세요. 게임 동작의 기준은 [본편 규칙](../gameplay/README.md)이며, 이 문서는 구현 위치를 설명합니다.

## 외부 대상과 캐릭터 배치 구현

등장 조건·대화·보상·완료 시점은 [사건별 흐름](../gameplay/events.md)에 통합했습니다. 아래는 화면 구현에 필요한 좌표·리소스 정보입니다.

- 집의 책·침대·옷장은 `home-art.js`의 `bookTarget()`, `bedTarget()`, `wardrobeTarget()`과 원본 배경 마스크를 사용합니다. 침대와 소파의 별도 침구 이미지를 혼동하지 않습니다. 책 표지는 `assets/outside/chris-home/nietzsche-the-gay-science.png`에 원본 그대로 보존하고 `outside-inspection.js`의 조사 UI로 표시합니다.
- `outside-neighborhood.js`의 `places`가 박스·착지점·소파·NPC 좌표를 소유합니다. `poses()`가 발·방향·크기·프레임·말풍선 기준을 소유합니다. 사람 시트는 `outside-ambient.js`의 `sheets/roleKinds/sprite()`가 본편·컷씬·리소스 확인에 공통 공급합니다. 2026-10-31 제공 원본은 `assets/outside/characters/`에 있으며, 이웃(1·2일차 복도/부비 이벤트)은 Neighbor, 수리공은 Repairman, 집 크리스는 Chris, 갱단 보스는 Gang5, 입구 경비는 Gang1, 나머지 세 명은 Gang2/3/4입니다. 부비는 교체 가능한 Canvas 더미를 사용합니다.
- 새 사람 시트는 모두 129×138 셀, 발끝 행 114, 100 PPU입니다. 원본 크기 그대로 사용하며 Gang5는 이미 큰 체형이므로 추가 확대하지 않습니다. 6/8/9프레임은 루나의 9프레임·12FPS 대기와 같은 0.75초 주기로 재생합니다(각 8/10.667/12FPS). 프레임 전체의 알파 합집합으로 말풍선 기준을 고정합니다. 제공 파일은 Idle뿐이므로 이동 중에는 기존 이동 경로·방향·속도와 해당 Idle을 사용하며, 별도 걷기 애니메이션이 등록된 것으로 취급하지 않습니다.
- 사람 셀 129×138의 실제 발끝 114px을 원점으로 둡니다. 도로는 -0.974, 복도는 `upperY - 0.274`로 루나와 맞춥니다. 갱단과 해당 구간 루나는 폐품 전경 앞 보행면에 그리며 복도 난간·엘리베이터의 가림은 유지합니다.
- `outside-ambient.js`의 `head/bounds`는 프레임별 투명 여백 대신 알파 합집합으로 머리를 측정합니다. 옆집 주민 이동은 초당 0.24 월드 단위, 고양이와 정지 간격은 0.60입니다. 수리공 퇴장 방향은 루나 반대쪽이며 1.6초에 종료합니다.
- 부비 첫 휴식 `chris-in` 액션은 0.45초 암전, TV 오른쪽 크리스 배치, 페이드 인과 0.32 월드 단위 좌→우 이동입니다. 카메라 폭 4.8·높이 0.023은 고정입니다. 사건의 뒤 연결은 이곳이 아니라 `playSleepScenes`를 따릅니다.
- 삼호 외부 대기·대화는 `samho-animation.js`의 동일 Idle 8프레임/12FPS를 사용합니다. 실루엣 호흡 프레임은 `outside-ambient.js`에서 루나 주기에 맞춥니다. 삼호 원본과 실루엣 프레임 수를 같다고 가정하지 않습니다.
- `outside-discovery.js`는 과거 이력·좌표 투영 API 호환만 유지합니다. 표식 렌더링은 비활성입니다. 선택지 피드백은 `world-choices.js`와 `data/presentation/choice-feedback.js`, 말풍선 화면 보정은 `world-speech.js`가 소유합니다.

검증: `test-neighborhood-staging-ui.cjs`, `test-samho-idle-ui.cjs`, `test-home-book-ui.cjs`, `test-home-bed-ui.cjs`, `test-home-wardrobe-ui.cjs`, `test-outside-discovery-stability-ui.cjs`. 진행 분기는 `outside` 묶음, 0~3일차 날씨/환경음 조합은 `test-weather-ambience-matrix-ui.cjs`.

## 거리 셰이더 스냅샷

광고 차량 순환: `flightBounds`(-24~10)은 맵과 차체 폭 바깥의 재등장 경계입니다. 각 노선은 이동 시간 `duration`으로 즉시 순환하며 별도 소멸 대기 구간은 없습니다. 경계 확장 시 이동 시간을 같은 비율로 늘려 기존 속도를 유지합니다. 순환은 게임 시간만 사용하고 광고 시계·카메라 상태를 초기화하지 않습니다.

공중 광고 차량은 `outside-ad-carrier.js`가 별도 소유합니다. `assets/outside/vehicles/ad-carrier.png`를 외부 장면 이미지 로더에 등록하여 진입 전에 디코드합니다. 차체와 광고는 1280×592 캐시에 합성하고 게임 시간의 24fps 단위로 표현합니다. 320×148은 레이아웃 좌표일 뿐 저해상도 중간 비트맵으로 쓰지 않습니다. 차체 원본 파일은 보존하며 중앙 직선 구간만 20px 연장합니다. 안테나·모서리·추진기는 늘리지 않습니다. 광고 패널은 134×56이며 인물 원화는 비율을 유지해 채웁니다. 원본 크기에서 알파 보정 후 고품질 축소하며, 최종 화면도 고품질 샘플링과 물리 픽셀 위치 정렬을 사용합니다. 원본의 고체 영역 알파 250–255는 캐시에서 255로 보정하고 차체에 불투명 청색 음영을 합성합니다. 거리감에 전체 투명도를 쓰지 않습니다. 광고는 게임 시간 기준 5초마다 슬라이드 없이 즉시 전환, 좌우 이동 시 글자는 뒤집지 않습니다. 크기는 최초 버전 대비 약 15% 확대, 이동은 25% 감속이며 광고 시계는 감속하지 않습니다. 렌더링 순서는 원경 → 중경 건물과 부착 디스플레이(layer 3–5) → 광고 차량 → 주거 건물·거리 전경입니다. 같은 layer 5를 사용하는 주거 건물은 `streetDrawOrder`에서 중경 뒤로 정렬하여 차량보다 앞에서 가립니다. 두 노선 높이는 2.55/7.5로 이전보다 각각 0.65 낮췄습니다. 여성 인물 원화 2종(ad-portrait-violet/crimson.png)은 artAssets로 외부 진입 전 미리 로드합니다. KORATECH·UNKNOWN 인물 광고와 Canvas PORT 발광 문양을 번갈아 표시하며, 가는 LED 세로줄·가로 주사선·느린 광택 띠·하단 작은 티커만 움직입니다. 원화 생성 방식과 프롬프트·영상 분석은 assets/outside/vehicles/ad-art-provenance.json에 기록했습니다. 독립 render 호출은 다섯 번째 인자로 로드된 이미지 Map을 전달합니다. 리소스 검수에서는 차체와 두 원화를 개별 카드로 확인하고 전경 보기로 시작합니다. 집/QA에서는 생성하지 않습니다. 광고 문구·속도·노선은 해당 모듈의 `ads`, `routes`, `travelRate`에서 수정합니다.

`bar-playtest/tools/import-street-effects.cjs --write`는 Unity의 `OutSide.unity`, `SH_LedSignScroll`, `NeonFlicker`, `M_Crt01–09`에서 필요한 설정과 PNG만 **웹으로** 복사합니다. 엔진은 읽기 전용이며 전체 장면 재수입은 하지 않습니다. 다른 체크아웃은 `--engine=/경로/HumanBartender`를 사용합니다. `--write` 없이 실행하면 스냅샷 일치 여부만 검사합니다.

원본 PNG는 `assets/outside/effects/`에 바이트 그대로 보존합니다. RGBA 소등 마스크는 독립 데이터 채널이므로 브라우저의 투명 픽셀 처리로 RGB가 사라지지 않도록 좌표 데이터도 생성합니다. 전광판 이동·팬 샘플링·깜빡임 횟수와 소등 시간은 엔진 설정을 따릅니다. 단, 웹의 8개 간판/조명 그룹은 한 차례 깜빡임이 끝난 뒤 다음까지 각각 8–22초 랜덤 대기합니다(기준 15초, `burstsPerMinute=4`, `intervalRandomness=7/15`, 모든 `frequencyScale=1`). 첫 시작은 기존 분산 방식으로 0–22초이며, 재수입 도구도 이 웹 대기 설정을 보존합니다. 엔진 파일은 변경하지 않습니다. 주변 빛 번짐은 기존 Canvas 렌더러용 근사이며 Unity URP의 픽셀 단위 출력과 동일하지는 않습니다. 거리 진입 전에 기존 외부 이미지 로더가 새 에셋도 로드합니다. 테라스 효과와 게임 진행 좌표는 변경하지 않습니다.

검증: `test-street-engine-effects.cjs`, `test-street-engine-effects-ui.cjs` (둘 다 `outside` 묶음에 포함).

## Street puddles, fog and postprocessing

`data/presentation/street-atmosphere.js` contains read-only Unity scene overrides; `src/features/outside/effects/street-atmosphere.js` and `street-atmosphere-renderer.js` render world-anchored pools, three fog layers, the authored light shaft and linear-color bloom before lens water. See [street-atmosphere.md](street-atmosphere.md) for source settings, rendering order, browser adaptations and tests. Import only with `bar-playtest/tools/import-street-atmosphere.cjs --write`; original art and engine files remain untouched.
