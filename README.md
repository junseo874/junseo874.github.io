# Project LUNA 웹

본편, 개발자 플레이테스트, 리소스 검수, 컷씬 편집기를 제공하는 **빌드 없는 정적 사이트**입니다. 폴더 전체를 GitHub Pages에 배포합니다. 별도의 번들러나 서버 API는 필요하지 않습니다.

## 팀 프로그래머가 먼저 읽을 문서

**현재 웹 본편의 정상 플레이 동작이 게임 구현의 확정 기준입니다.** 엔진의 예전 동작이나 과거 기획보다 현재 본편을 우선합니다. 개발자 전용 기능과 데이터에만 남은 콘텐츠를 본편에 자동으로 포함하지 않습니다.

1. [본편 구현 확정 기준](docs/gameplay/README.md): 범위·진행·입력·거래·연출의 공통 규칙
2. [사건별 대화와 이벤트 흐름](docs/gameplay/events.md): 시작 조건·선택·보상·완료·재방문
3. [데이터와 대화 연결](docs/gameplay/data-and-dialogue.md): CSV 원본부터 실제 실행까지, **단골 코스터 제공·빈잔 교체 시점 작성 예시**
4. [구조 안내](docs/architecture/README.md) → [상태·모듈·엔진 대응](docs/architecture/modules.md): 구현 위치와 연결
5. [테스트 안내](docs/architecture/testing.md): 검증과 알려진 기존 실패

상세 구현 시에는 [조작 잠금·해제 조건표](docs/gameplay/input-locks.md)를 확인합니다. 바·제조·외부·집·컷씬의 입력 잠금, 대본 대기, 일시정지를 구분하고 완료/복귀 시점을 명시했습니다. 최근 추가한 [까마귀·비둘기](docs/architecture/ambient-birds.md)는 배치·발 기준·6 FPS·착지 시점·날씨·레이어·공유 리소스 소유권을 한곳에서 설명합니다.

위 문서와 같은 커밋의 코드·CSV·생성 데이터를 함께 사용합니다. 클론에 포함되지 않는 로컬 미커밋 변경이나 채팅 기록을 전제로 구현하지 않습니다.

## 일반 손님 외형 CSV (현재 웹 기준)

남녀 모두 입 파츠는 `mouth_1`~`mouth_3`만 사용한다. 각각 같은 번호의 `02.Talk/face_bottom_1`~`face_bottom_3` 말하기 시트에 연결한다. 대응 시트가 없는 입 4·5번은 게임·외형 선택 후보에서 제외했으며 원본 PNG는 삭제하지 않았다.

2026-11-02 실제 픽셀 대조 후 정적 PNG 번호를 재정렬했다(말하기 시트 번호는 유지). **남성: 옛 3→새 1, 옛 2→새 2, 옛 1→새 3. 여성: 옛 4→새 1, 옛 3→새 2, 옛 5→새 3, 옛 1→새 4, 옛 2→새 5.** 현재 CSV ID와 PNG 번호는 말하기 시트 번호에 대응한다. 웹과 Drive의 파일 이름을 변경했으며 Unity 폴더는 미수정이다. 기존 Unity에 반영할 때는 이름만 보고 같은 그림이라고 판단하지 말고 이번 파일들을 교체해야 한다. 원본 픽셀은 변경하지 않았다. 남성 정적 입은 말하기 마지막 프레임보다 원본 좌표가 1px 위이며, 모양은 동일하다. 검증: `test-guest-mouth-pairing.cjs`.

- `bar-playtest/data/shared-csv/guests/guest_parts.csv`: 실제 사용하는 정적 파츠 46개. `id`는 웹 이미지 등록 키, `sprite`는 `bar-playtest/` 기준 실제 PNG 경로다. 남녀 각각 몸체 1·상의 3·눈썹 6·눈 4·입 3·머리 2종. 여성 액세서리 3종, 남성 액세서리 2종·사이버웨어 3종이다. 사용하지 않는 옛 의상 후보는 제거했다.
- `guest_exclusions.csv`: 동시에 사용할 수 없는 `a`·`b` 쌍 6개. **남성 `Acc_2`, `cyberware_1`, `cyberware_3` 각각과 `top_1` 또는 `top_2`의 조합을 금지한다. 세 파츠는 `top_3`에서만 허용하며 `cyberware_2`에는 이 제한이 없다.** ID에는 모두 `guest_m_` 접두사가 붙는다. 쌍의 방향은 무관하다.
- `guest_settings.csv`: 남녀 기본 파츠 ID도 현재 후보로 갱신했다. 기본값은 예비 조합이며 방문 외형을 고정하는 값이 아니다.
- 매 방문 남녀 50% 추첨 후 같은 성별의 몸체·상의·눈썹·눈·입·머리를 하나씩 고른다. 액세서리와 사이버웨어는 **합쳐서 없음 또는 한 개**만 선택한다. 상의를 먼저 뽑고 금지 후보를 제외한 뒤 균등 추첨한다. 현재 모든 `weight`는 1이다. 웹은 균등 추첨이므로 가중치를 바꿔 차등 추첨하려면 별도 구현이 필요하다.
- 기존 CSV 구조의 `necklaces`·`outerwears`·`arm_accessories`는 분류일 뿐 각각 하나씩 장착하는 슬롯이 아니다. 셋을 합친 선택 슬롯 하나로 처리한다. 다른 성별 혼합은 금지하고, 외형 탭에서 상의 변경 시 금지된 파츠는 자동 해제한다. 같은 손님은 퇴장까지 외형을 유지한다.
- 정적 합성 순서는 몸체 → 상의 → 액세서리 → 눈썹 → 눈 → 입 → 머리다. 말하기 시 불투명한 눈 애니메이션 시트를 쓰면 눈썹을 그 뒤에 그려 가려지지 않도록 한다. 같은 번호의 눈·입 애니메이션이 없으면 정적 파츠를 유지한다.
- 게임과 시뮬레이터의 **손님 외형** 탭은 같은 CSV 후보·금지 규칙을 사용한다. 수정 후 `node tools/build-shared-data.cjs --write`로 실행 데이터를 재생성한다. `web-views.json`의 해당 행 목록도 함께 유지한다. 검증은 `test-guest-random-appearance.cjs`, `test-guest-appearance-tab-ui.cjs`다.
- 이번 변경은 **웹 저장소만 반영**했다. 엔진 CSV와 이 세 파일은 이제 다르며, 엔진 반영 시 함께 가져가야 한다. 엔진 이미지 루트에는 `sprite`의 `assets/01.ArtResources/` 뒤 상대 경로를 연결한다. CSV만 복사한다고 엔진의 추첨·합성 코드까지 자동 변경되지는 않는다.

## 실행

```sh
python3 serve.py
# http://127.0.0.1:8123/
```

| 화면 | 주소 | 수정 위치 |
| --- | --- | --- |
| 사이트 입구 | `/` | `index.html` |
| 게임 본편 | `/bar-playtest/` | `bar-playtest/src/` |
| 개발자 모드 | `/bar-playtest/?dev=1` | 본편과 같은 코드 |
| 리소스 검수 | `/bar-playtest/resource-review.html` | `bar-playtest/src/dev/resources/` |
| 컷씬 편집기 | `/cutscene-studio/` | `cutscene-studio/src/` |
| 기존 프로토타입 | `/simulator.html` 등 | `js/`, `css/`, `assets/prototype/` |

## 구조

```text
bar-playtest/
  src/app/                  진입·전체 화면 조립
  src/core/                 게임 상태·공통 tick·조건식·기능 조립
  src/features/story/       바 스토리·선택지·해금
  src/features/bar/         일반 손님·좌석·정산·바 화면
  src/features/crafting/    준비·큐·판정·기믹 연산·제공 화면
  src/features/outside/     외부 모델 / 화면 / 사건 / 효과 / 집
  src/features/campaign/    본편 화면 / 일차 흐름 / 컷씬 연결
  src/features/tutorials/   이동·제조 안내
  src/shared/               audio, dialogue, platform, ui
  src/cinema/               컷씬 재생 엔진·Studio 연결
  src/dev/                  QA, 리소스 검수, 이야기 안내
  data/shared-csv/          게임 데이터·대사 편집 원본
  data/presentation/        웹 표현·리소스 연결
  data/runtime/             대형 테이블·장면·카탈로그 데이터
  data/provenance/          원본 출처 기록
  assets/01.ArtResources/     드라이브·엔진 원본과 동일한 그래픽 상대 경로·파일명
  assets/                   나머지 웹 전용 이미지·폰트·음원
  tests/                    회귀 테스트
  tools/                    가져오기·캡처·생성 도구와 입력 자료
cutscene-studio/             src, styles, data, assets, tests
assets/                     사이트 이미지와 기존 프로토타입 리소스
tools/                      전체 사이트 검사·테스트 실행
docs/architecture/          구조·수정 지점·경로 이동표
docs/gameplay/              본편 확정 규칙·사건 흐름·데이터 연결
docs/history/               과거 변경 기록(평소 읽을 필요 없음)
artifacts/                  작업 결과물(실행 코드와 분리)
archives/                   이전 배포 압축본
```

- 수정 위치: [구조 안내](docs/architecture/README.md). `node tools/locate.cjs 제조` 또는 `node tools/locate.cjs scoreCraft`로 기능·함수부터 찾습니다.
- 검증 방법: [테스트 안내](docs/architecture/testing.md)
- 리소스 규칙: [리소스 안내](docs/architecture/art-assets.md)
- 폴더 이동 전후 이름은 `docs/architecture/path-migrations.json`에서 검색할 수 있습니다. 이 파일은 브라우저가 읽지 않습니다.

`localStorage`/IndexedDB 키, 게임 데이터 ID, 공개 페이지 URL과 기존 스크립트의 상대 실행 순서는 유지합니다. 분리된 모듈만 소유 파일보다 먼저 로드합니다. 이미지 픽셀·애니메이션 프레임·음원 데이터는 변경하지 않았습니다.
