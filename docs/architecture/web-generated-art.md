# 웹 생성 PNG 관리

## 실제 위치와 소유권

생성 그래픽은 `bar-playtest/assets/01.ArtResources`의 화면/용도별 `WebGenerated` 안에 둔다. 단, 엔진에 동일한 이미지가 있는 28개는 엔진 경로·이름을 재사용한다(`reusesExisting: true`). 나머지 764개는 `Web_IMG_`, `Web_BTN_`, `Web_GRD_` 등으로 시작하며 해상도는 넣지 않는다. 아트 폴더에는 설명 문서나 관리 JSON을 두지 않는다.

- 962개 소스 항목 → 792개 PNG. 동일 크기·RGBA 중복 170개 통합.
- 기존 PNG 바이트 유지. 커서 12개만 투명 32×32 PNG로 변환하고 클릭 기준점 유지.
- `bar-playtest/data/presentation/generated-art/manifest.json`에 사용 화면·옛 경로·크기·해시·본체 영역이 있다. 옛 `sources[].src`는 이력이며 실행 참조가 아니다.

## 웹 연결

커서·광고·선택지·튜토리얼 조각은 코드/CSS에서 새 PNG를 직접 읽는다. `generated-art.css`는 정적 배경 69개 상태(54개 고유 PNG)를 읽는다. 변형과 배치는 원래 CSS/JS가 소유한다. 기본·호버·포커스는 일치하는 원본이 유일한 경우에만 연결하며 모호한 상태를 임의의 스냅샷으로 대체하지 않는다.

텍스트·게이지·타이밍·Canvas·글리치·동적 테두리 등은 계속 코드로 렌더링한다. PNG 추출물 전체가 본편 표시용인 것은 아니다. 나머지는 검수·다운로드에서 사용한다. `99.Review`는 QA/과거 도움말 추출물이며 본편 기능을 추가하라는 의미가 아니다.

## 변경 순서

1. 해당 PNG와 메타데이터를 수정한다. 파일 크기/여백을 바꾸면 `contentRect`와 사용 화면도 확인한다.
2. `node tools/build-generated-ui-css.cjs --write`
3. `node bar-playtest/tools/build_resource_extraction_catalog.cjs`
4. `node tools/build-preload-manifest.cjs --write`
5. `node tools/check-web-generated-art.cjs`, `node bar-playtest/tests/test-generated-art-ui.cjs`, 관련 UI 회귀 검사.

새 캡처는 `artifacts/ui-graphic-staging`으로 출력한다. 스테이징 전체를 assets에 복사하지 않고 기존 파일과 비교해 중복 제거·명명·등록한다. 수백 개의 검수 전용 PNG를 본편에서 일괄 사전 로딩하지 않는다. 현재 직접 쓰는 UI 조각과 배경만 로딩한다.

## 정리 범위

2026-11-01 기존 962개 생성 원본 경로를 위 라이브러리로 통합하고 옛 복사본·옛 추출 목록·운영체제 메타파일을 회수했다. 상위 원본 폴더에는 직전 작업으로 추가했던 파일만 회수했다. 기존 아티스트 파일은 보존했다. 268개 실행 소스의 이전 경로 미참조, 이전 URL 차단 브라우저 검사, 이미지 전체 디코딩·다운로드와 11개 공개 진입점 확인 후 회수했다.

회수 파일은 작업 당시 `/private/tmp/luna-retired-generated-e22uAW`에 복구용으로 보관했다. 임시 폴더는 영구 백업이 아니며, 기존 웹 파일은 Git 이력에도 남는다. 빈 폴더 72개를 정리했다. 다른 버전의 원본·음원·폰트·검수 캡처·출처 자료는 사용 여부가 확인되지 않았다는 이유만으로 삭제하지 않았다. Drive/엔진 변경이나 배포는 하지 않았다.
