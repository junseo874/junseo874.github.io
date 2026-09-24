# L.U.N.A 웹 허브

프로젝트 소개와 웹 플레이테스트를 모아 둔 GitHub Pages 정적 사이트입니다. npm 빌드나 Unity 실행 없이 동작합니다.

## 페이지 구분

| 경로 | 역할 |
| --- | --- |
| `index.html` | 메인 로비. 소개·방향성·바 영업 플레이테스트로 이동 |
| `bar-playtest/` | **현행 바 내부 플레이테스트**. 일반/단골 손님 영업, 대화·선택지, 제조 기믹, 정산·유지비 게임오버, 공통 BGM |
| `bar-playtest/?mode=minigames` | 기믹 5종 단독 연습. 기존/GPT 규칙 선택·결과·재도전 |
| `intro.html` | 기존 프로젝트 소개 자료 |
| `direction.html` | 기존 게임 방향성·스토리 데모 |
| `simulator.html` | **이전 전체 흐름 프로토타입 보관본**. 과거 데이터·규칙이 포함되어 있으므로 현행 구현 기준으로 사용하지 않음 |
| `LUNA_TestTool.html` | 기존 대화 테스트 도구 |

기존 페이지와 리소스 경로는 유지했습니다. 이전 시뮬레이터를 삭제하거나 새 시뮬레이터의 데이터와 섞지 않았습니다.

## 로컬 실행

```sh
python3 serve.py
```

- 로비: http://127.0.0.1:8123/
- 바 영업: http://127.0.0.1:8123/bar-playtest/
- 다른 포트를 쓰려면 `python3 serve.py 8124`처럼 실행합니다.
- 서버는 이 파일이 있는 폴더를 기준으로 서비스하며, 로컬 컴퓨터에서만 접속할 수 있습니다.
- 바 시뮬레이터 자체는 `bar-playtest/index.html`을 Chrome/Edge에서 직접 열어도 실행됩니다.

## 수정·동기화 기준

**바 시뮬레이터의 편집 원본은 이 저장소의 `bar-playtest/` 한 곳입니다.** 앱 코드·대본 스냅샷·이미지·폰트·BGM·검수 도구를 함께 보관합니다. 실행 설명과 기능 범위는 [시뮬레이터 README](bar-playtest/README.md)를 참고하세요.

이 컴퓨터의 이전 Codex 작업 경로는 `bar-playtest/`를 가리키는 디렉터리 링크로 연결했습니다. 별도의 복사본을 양쪽에서 편집하는 방식이 아니므로 어느 경로로 열어도 같은 파일이 바뀝니다. 이 링크는 사이트 바깥의 로컬 편의 설정이며, 배포되는 폴더 안에는 외부 경로를 가리키는 링크가 없습니다.

- 코드 수정: `bar-playtest/app.js`, `core.js`, `bar-views.js`, `bgm.js` 및 CSS를 직접 수정합니다.
- 대본/리소스: `bar-playtest/data.js`와 `assets/`가 웹 실행에 필요한 사본입니다. 원본 Unity 프로젝트나 CSV를 자동으로 덮어쓰지 않습니다.
- 원본 데이터 재반영: 필요한 경우에만 `tools/import_sources.py` → `tools/import_animation_art.py` 순서로 실행하고 전체 재검수합니다. BGM 사본은 `tools/import_bgm.py`로 별도 생성합니다.
- 전달용 ZIP: `python3 bar-playtest/tools/package.py`. 저장소 루트에 `LUNA-Bar-Playtest.zip`이 생성되며 Git 추적에서는 제외합니다.
- 예전 로컬 ZIP은 스냅샷입니다. 이후 수정 내용까지 전달하려면 ZIP을 다시 만드세요.

## 검수

```sh
node tools/check-site.cjs
node tools/test-site.cjs
node bar-playtest/tools/test_core.cjs
LUNA_TEST_URL=http://127.0.0.1:8123/bar-playtest/ node bar-playtest/tools/test_browser.cjs
```

`check-site.cjs`는 파일명 대소문자·상대 경로·시뮬레이터 데이터/이미지/폰트/BGM 연결과 외부 심볼릭 링크를 확인합니다. 브라우저 검수 도구는 현재 작업 Mac의 Chrome/Playwright 경로를 사용합니다. 다른 컴퓨터에서는 도구의 실행 경로를 조정해야 하며 사이트 실행 자체에는 Playwright가 필요하지 않습니다.

통합 시 이동 전 284개 파일의 내용 해시를 대조했습니다. 원본 ZIP과 비교해 대본·로직·이미지·폰트·음원이 보존되었음을 확인했으며, 경로 검수와 로비 이동, 영업 흐름, 캐릭터/말풍선, 16:9 배치, 스터/쉐이킹, 단골 정보, BGM의 브라우저 회귀 검수를 통과했습니다. 실제 원격 Pages 배포 검수는 커밋·푸시 후 별도로 진행해야 합니다.

## GitHub Pages 반영

GitHub Pages에서 이 저장소 루트를 배포하도록 설정한 경우 게시 경로는 `/bar-playtest/`입니다. `.nojekyll`로 파일을 정적 리소스 그대로 제공합니다. 로컬 파일을 수정하는 것만으로 원격 사이트가 바뀌지는 않으며, 사용자가 변경 내용을 확인하고 커밋·푸시한 뒤 Pages 배포가 끝나야 반영됩니다.

이번 통합 작업은 **로컬 저장소 정리까지**입니다. 자동 커밋·푸시·원격 배포 설정 변경은 하지 않습니다. 기존에 추적 중이던 `.DS_Store` 등은 임의로 삭제하거나 스테이징하지 않았습니다.
