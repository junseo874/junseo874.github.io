# 외부 거리 렌더링 개선 — 2026-11-13

기존 그래픽을 유지하면서 전체 장면을 Canvas2D와 WebGL 사이에 반복 전송하던 작업을 줄였다. 거리·안개·캐릭터 조명·물웅덩이·블룸·유리 빗방울은 하나의 GPU 문맥에서 합성하며, 정적 이미지와 반복 계산을 재사용한다. 기존 로딩 화면에서 효과를 준비하고, 지속적인 성능 저하가 감지되면 안개와 블룸의 중간 계산 해상도만 단계적으로 조정한다.

## 비교 조건

- 기준 커밋: `6ce208f3ca95ee42d7e2b12fc7b3b0e06b859089`.
- 동일한 로컬 Chrome, 화면 1280×720, DPR 2, 실제 그리기 2560×1440.
- 같은 난수 시드와 좌우 이동 입력, 카메라 추적, 날씨 및 애니메이션.
- 장면별 40프레임 준비 후 120프레임 측정. 다른 브라우저 검사와 동시에 실행하지 않음.
- 자동 조절을 끄고 **최고 품질 고정**. 효과 삭제나 화면 해상도 감소 없이 비교.
- CPU 수치는 실제 모델 갱신과 그리기 명령 제출 시간이며 GPU 완료 시간은 아님.
- CPU 8배 지연은 개발 머신의 브라우저 에뮬레이션이다. 실제 저사양 CPU/GPU 시험을 대체하지 않는다.

## 결과

| 조건 | 장면 | 평균 CPU 시간, 전 → 후 | 평균 FPS, 전 → 후 |
| --- | --- | --- | --- |
| 정상 CPU | 비 오는 상점가 | 2.80 → 2.04 ms | 60 → 60 |
| 정상 CPU | 모닥불 구역 | 3.40 → 1.81 ms | 60 → 60 |
| 정상 CPU | 맑은 거리 | 2.62 → 1.63 ms | 60 → 60 |
| CPU 8배 지연 | 비 오는 상점가 | 24.79 → 20.27 ms | 30.4 → 40.5 |
| CPU 8배 지연 | 모닥불 구역 | 27.24 → 17.85 ms | 28.3 → 44.4 |
| CPU 8배 지연 | 맑은 거리 | 22.12 → 14.82 ms | 32.6 → 52.9 |

CPU 8배 지연 조건에서 평균 CPU 처리 시간은 약 18–34% 감소했다. 분위기 효과용 전체 장면 업로드는 프레임당 **6회 → 0회**가 됐다. 변경된 작은 효과 캔버스 업로드와 최종 화면 출력은 남아 있다. GPU 타이머 결과는 편차가 커서 정확한 GPU 절감률의 근거로 사용하지 않았다.

원자료: [before.json](before.json), [after.json](after.json). GPU 타이머 참고 자료는 `gpu-before.json`, `gpu-after.json`이며 위 FPS/CPU 표와 별도 측정이다.

## 그래픽 유지 및 검증

- 합성·좌우 반전·잘라내기·혼합·클리핑의 합성 샘플은 기존 Canvas2D 결과와 픽셀 단위로 동일했다.
- 상점가·모닥불·맑은 거리·상층 복도의 정지 화면을 비교했다. RGBA 채널 평균 차이는 0–255 기준 각각 약 0.044 / 0.007 / 0.041 / 0.024였다.
- 물웅덩이 9개 × 카메라 위치 3개 비교에서 기존 직접 계산과 새 셀 계산의 최대 차이는 채널당 1/255였다.
- 반사 가림, 캐릭터 조명 격리, 스캔라인, 빛 번짐의 이동 연속성, 비 시뮬레이션, 창 크기 변경, 재진입, 준비 취소 및 GPU 오류 시 기존 방식으로 전환을 확인했다.
- 기본 검사 **43/43 통과**. 외부 검사와 관련 재검사 및 추가 물웅덩이 검사 **75/83 통과**. 테라스 비 연속성과 일차 전환 로딩 검사도 통과했다.

이전부터 남아 있던 외부 검사 실패 8개는 통과로 처리하지 않았다:

| 검사 | 남은 불일치 |
| --- | --- |
| `test-corridor-birds-ui.cjs` | 기존 새 발 위치 기대값 |
| `test-engine-barrel-fire.cjs` | Unity 전체 ProjectSettings 해시 |
| `test-campfire-lighting-ui.cjs` | 기존 모닥불 위치 기준 |
| `test-outside-npc-animation.cjs` | NPC 단위 검사에 필요한 콘텐츠 의존성 누락 |
| `test-street-parallax-engine-ui.cjs` | 도착 연출 카메라 기대값 |
| `test-home-weather-ui.cjs` | 이전 실내 이미지 기준 픽셀 검사 |
| `test_upper_crate_boundary_ui.cjs` | 이전 상자 경계 기준 |
| `test-lift-right-boundary-ui.cjs` | 이전 승강기 오른쪽 여유 공간 기준 |

검사별 결과는 [validation.json](validation.json), 주요 추가 검사 출력은 같은 폴더의 `.log` 파일에 있다. GPU 전환으로 더 이상 사용하지 않는 Canvas2D 그리기 감시 부분은 실제 GPU 명령/반사 화면을 검사하도록 수정했으며, 기존 시각·배치·순서 판정 기준은 낮추지 않았다.

## 재현

로컬 서버를 8123 포트에서 실행하고 저장소 루트에서 아래 명령을 **차례대로** 실행한다. 결과 파일을 덮어쓰지 않도록 별도 이름을 사용한다.

```sh
STREET_BASELINE_REF=6ce208f3ca95ee42d7e2b12fc7b3b0e06b859089 STREET_CPU_RATES=1,8 STREET_GPU_TIMERS=0 STREET_LABEL=before-recheck node artifacts/street-unified-performance/benchmark.cjs
STREET_CPU_RATES=1,8 STREET_GPU_TIMERS=0 STREET_LABEL=after-recheck node artifacts/street-unified-performance/benchmark.cjs
node bar-playtest/tests/test-street-render-budget.cjs
node bar-playtest/tests/test-street-gpu-surface-ui.cjs
node bar-playtest/tests/test-street-water-grid-ui.cjs
```

실제 저사양 기기의 장시간 플레이와 여러 GPU/브라우저에서의 성능은 추가 검증이 필요하다. 모든 컴퓨터에서 60 FPS를 보장하는 결과는 아니다.
