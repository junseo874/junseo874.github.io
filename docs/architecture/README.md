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
| 본편 진행·밤·테라스·회상 | `bar-playtest/src/features/campaign/` |
| 컷씬 렌더링·편집기 재생 연결 | `bar-playtest/src/cinema/` |
| 설정·정산 팝업·알림·재화 UI | `bar-playtest/src/shared/ui/` |
| 16:9 영역·배율·포커스·입력 제한 | `bar-playtest/src/shared/platform/` |
| 말풍선·선택지·홀드 효과 | `bar-playtest/src/shared/dialogue/` |
| BGM·효과음·대사 음성 | `bar-playtest/src/shared/audio/` |
| 이동·제조 튜토리얼 | `bar-playtest/src/features/tutorials/` |
| 리소스 검수·다운로드 | `bar-playtest/src/dev/resources/` |
| 99일차·테스트 상황 | `bar-playtest/src/dev/qa/` |
| 원본 테이블·캐릭터 이미지 등록 | `bar-playtest/data/runtime/game-data.js` |
| 거리 장면·스프라이트 좌표 | `bar-playtest/data/runtime/outside-scene-data.js` |
| 이야기 대사 | `bar-playtest/data/runtime/campaign-data.js`, `outside-dialogues.js` |
| 컷씬 편집 | `cutscene-studio/src/`, `styles/` |

## 로딩·경로 계약

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
