# 대사 서체

- 사용자 제공 `KOPUBWORLD_TTF_FONTS2026`의 `KoPubWorld Dotum Medium.ttf`, `KoPubWorld Dotum Bold.ttf`를 원본 바이트 그대로 복사했다.
- `kopubworld-dotum-medium.ttf`: 기존 일반 대사 굵기(400)와 중간 굵기.
- `kopubworld-dotum-bold.ttf`: 기존 강조 굵기(700–900). 없는 ExtraBold를 인위적으로 만들지 않는다.
- 등록은 `src/shared/ui/dialogue-fonts.css` 한곳에서 한다. 기존 `LunaPixel`과 컷씬의 `StudioGame` 이름은 저장된 클립·Canvas·기존 UI 호환용 별칭이며 실제 서체는 모두 KoPubWorld 돋움이다.
- 바·외부·테라스·회상·컷씬 편집기 및 기존 별칭을 쓰던 제목/선택지/알림에 함께 적용한다. Paperlogy·Pretendard·디지털 숫자는 별도 역할이므로 유지한다.
- 종전 `font.ttf`와 `stardust-*.ttf`는 복구용 원본으로 남기고 실행 폰트 등록·사전 로딩 목록에서 제외한다. 이미지에 이미 포함된 글자는 이번 서체 교체 대상이 아니다.
