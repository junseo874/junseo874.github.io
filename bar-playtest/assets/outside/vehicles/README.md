# 공중 광고 차량

`ad-carrier.png`는 사용자 제공 차량/비행 광고판 3종을 참고해 내장 이미지 생성 도구로 제작한 원본 RGBA 스프라이트입니다. 생성 PNG의 크기와 알파를 변경하지 않고 보존합니다. 참조 작품의 로고와 광고는 사용하지 않았습니다.

최종 생성 프롬프트 요약: 첫 참조의 주황·차콜 장갑 호버 차량을 정면 측면 픽셀 아트로 변형. 중앙 차체를 길게 확장하고 넓은 빈 직사각형 LED 패널과 주황 테두리를 배치. 야간 거리용 절제된 조명, 투명 배경, 바퀴/지면/로고/문자 없음. 두 번째·세 번째 참조는 대형 광고 디스플레이 배치만 참고.

## 최종 생성 프롬프트 (내장 imagegen)

Use case: stylized-concept / game sprite asset. Transform reference 1's armored orange and charcoal hover cargo vehicle into an ORIGINAL flying advertising carrier for a dark pixel-art cyberpunk side-scrolling game. References 2 and 3 are ONLY inspiration for large luminous advertising displays, NOT for the blimp silhouette. Keep the rugged chunky armored vehicle character of reference 1, widen and lengthen its middle hull and integrate ONE very large wide RECTANGULAR LED billboard into the middle SIDE surface, with a thick rusty orange frame. Nose left, rear right. STRICT flat orthographic side elevation, NO perspective, NO top surface visible, screen perfectly axis-aligned rectangular, horizontal and vertical sides. The screen takes roughly central 60 percent of vehicle length and 55 percent of hull height. Screen interior is plain uniform very dark blue-black EMPTY, ready for animated ads added by the game engine: no lettering, no graphics, no diagonal highlights. Hull length about 3.5 times hull height. Orange beveled nose cowling, large recessed antigravity pods at both ends, little vents, muted cyan strips on underside. Two short roof aerials and tiny running lights. Worn muted orange, charcoal gunmetal, dark navy shadows. Restrained lighting suitable for rainy midnight. Genuine crisp pixel-art with clean clustered pixels, limited shades, no photographic textures, no smooth painterly rendering, no fuzzy bloom. As if a 300-pixel-wide game sprite enlarged with nearest neighbor. Entire isolated vehicle centered with modest transparent margin, no ground, no environment, no cast shadow, no captions, no logos, no watermark. Truly transparent background. One single vehicle, not a sheet.

## 웹 합성

차체는 전체 불투명도 100%로 그립니다. 생성 원본 내부의 알파 253은 화면 캐시에서만 255로 보정하며 투명 배경과 가장자리 안티앨리어싱은 보존합니다. 청색 음영은 `source-atop` 색상 합성으로 넣으며 뒤 배경이 비치게 하지 않습니다. 먼 중경 `C_Middle_Building_3`보다 앞, 가까운 중경 `C_Middle_Building_1/2`보다 뒤에 배치합니다. 최초 적용 대비 크기는 약 15% 확대, 하단/상단 노선 높이는 각각 3.2/8.15, 이동 속도는 75%로 조절했습니다. 하단 노선은 중경 사이로 드러나도록 지붕 높이에 맞췄습니다. 5초 광고 간격은 동일합니다.

`outside-ad-carrier.js`가 원본을 320×128 화면 캐시에 그린 뒤 패널 내부 좌표 `(115,55,134,36)`에 런타임 광고를 합성합니다. KORATECH / UNKNOWN / PORT 세 광고가 게임 시간 5초마다 0.45초 슬라이드 전환합니다. 원본 미리보기의 빈 패널은 정상입니다. 외부 이미지 로더로 먼저 로드/디코드하며 광고 전환은 네트워크 요청이나 소리를 발생시키지 않습니다.
