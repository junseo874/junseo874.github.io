# Project LUNA 웹

본편, 개발자 플레이테스트, 리소스 검수, 컷씬 편집기를 제공하는 **빌드 없는 정적 사이트**입니다. 폴더 전체를 GitHub Pages에 배포합니다. 별도의 번들러나 서버 API는 필요하지 않습니다.

## 팀 프로그래머가 먼저 읽을 문서

**현재 웹 본편의 정상 플레이 동작이 게임 구현의 확정 기준입니다.** 엔진의 예전 동작이나 과거 기획보다 현재 본편을 우선합니다. 개발자 전용 기능과 데이터에만 남은 콘텐츠를 본편에 자동으로 포함하지 않습니다.

1. [본편 구현 확정 기준](docs/gameplay/README.md): 범위·진행·입력·거래·연출의 공통 규칙
2. [사건별 대화와 이벤트 흐름](docs/gameplay/events.md): 시작 조건·선택·보상·완료·재방문
3. [데이터와 대화 연결](docs/gameplay/data-and-dialogue.md): CSV 원본부터 실제 실행까지, 옷장·바 선택지·수리공 예제
4. [구조 안내](docs/architecture/README.md)와 [테스트 안내](docs/architecture/testing.md): 구현 위치와 검증

위 문서와 같은 커밋의 코드·CSV·생성 데이터를 함께 사용합니다. 클론에 포함되지 않는 로컬 미커밋 변경이나 채팅 기록을 전제로 구현하지 않습니다.

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
  src/core/                 제조·영업·진행 규칙
  src/features/             bar, crafting, outside, campaign, tutorials
  src/shared/               audio, dialogue, platform, ui
  src/cinema/               컷씬 재생 엔진·Studio 연결
  src/dev/                  QA, 리소스 검수, 이야기 안내
  data/shared-csv/          게임 데이터·대사 편집 원본
  data/presentation/        웹 표현·리소스 연결
  data/runtime/             대형 테이블·장면·카탈로그 데이터
  data/provenance/          원본 출처 기록
  assets/                   용도별 원본 이미지·폰트·음원
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

- 수정 위치: [구조 안내](docs/architecture/README.md)
- 검증 방법: [테스트 안내](docs/architecture/testing.md)
- 리소스 규칙: [리소스 안내](bar-playtest/assets/README.md)
- 폴더 이동 전후 이름은 `docs/architecture/path-migrations.json`에서 검색할 수 있습니다. 이 파일은 브라우저가 읽지 않습니다.

`localStorage`/IndexedDB 키, 게임 데이터 ID, 공개 페이지 URL, 스크립트 실행 순서는 구조 정리 전과 동일합니다. 이미지 픽셀·애니메이션 프레임·음원 데이터는 변경하지 않았습니다.
