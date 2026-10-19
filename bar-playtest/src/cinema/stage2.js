/* 지하 4층 복도 — S#2 「도망을 가는 이들」 배경.
   스토리보드 기본 설명 기준: 비상 상황이라 기본 조명등이 꺼지고 적색 경고등만 깜빡이며,
   천장 방송용 스피커에서 피난 안내 방송이 계속 나온다.
   축척은 로비와 동일(유나 스프라이트 49px ≒ 1.75m → 1px ≒ 3.6cm).
   복도 내부 높이 84px ≒ 3.0m. 실제 배경 아트 전까지 쓰는 연출 확인용 임시 배경이다. */
window.StageCorridor = (function () {

  const W = 3600, H = 340;
  const FLOOR = 250;              // 바닥 윗면
  const CEIL  = 166;              // 천장 밑면 (복도 내부 = 166~250, 84px ≒ 3.0m)
  const DECK  = 106;              // 천장 구조물 시작

  const C = {
    void:'#05070a', deck:'#0d1116', wall:'#1a1e25', wallHi:'#242a33', wallLo:'#12161c',
    seam:'#0c1015', metal:'#333a44', metalHi:'#4b5765', metalLo:'#20262e',
    floor:'#232a33', floorHi:'#2e3742', floorLo:'#171c23',
    red:'#d8434b', redDim:'#5e2126', amber:'#e0a03a', cyan:'#4fd6e0',
  };

  const r  = (g,x,y,w,h,c)   => { g.fillStyle = c; g.fillRect(x|0, y|0, w|0, h|0); };
  const ra = (g,x,y,w,h,c,a) => { g.save(); g.globalAlpha = a; r(g,x,y,w,h,c); g.restore(); };
  const T  = (g,s,x,y,sc,c)  => PixFont.text(g, s, x, y, sc, c);
  const TW = (s,sc)          => PixFont.textW(s, sc);
  function rnd(s) { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); }

  /* 반복 배치 기준 x */
  const SPEAKERS = [];   for (let x = 150;  x < W; x += 500) SPEAKERS.push(x);
  const BEACONS  = [];   for (let x = 210;  x < W; x += 300) BEACONS.push(x);
  const DOORS    = [];   for (let x = 380;  x < W; x += 600) DOORS.push(x);
  const LAMPS    = [];   for (let x = 80;   x < W; x += 160) LAMPS.push(x);

  /* ---------- 정적 레이어 ---------- */

  function deck(g) {                                   // 천장 구조물 — 배관·케이블 트레이
    r(g, 0, 0, W, DECK, C.void);
    r(g, 0, DECK, W, CEIL - DECK, C.deck);
    r(g, 0, CEIL - 4, W, 4, '#191f26');
    ra(g, 0, CEIL - 5, W, 1, C.metalHi, 0.35);
    const pipes = [[DECK + 8, 7, '#2c333c'], [DECK + 19, 5, '#262d35'], [DECK + 28, 9, '#313943']];
    pipes.forEach(function (p) {
      r(g, 0, p[0], W, p[1], p[2]);
      ra(g, 0, p[0], W, 1, C.metalHi, 0.30);
      ra(g, 0, p[0] + p[1] - 1, W, 1, '#000', 0.35);
      for (let x = 0; x < W; x += 190) {               // 배관 조인트
        r(g, x, p[0] - 1, 8, p[1] + 2, '#3b444f');
        ra(g, x, p[0] - 1, 8, 1, C.metalHi, 0.4);
      }
    });
    r(g, 0, DECK + 40, W, 3, '#232a32');               // 케이블 트레이
    for (let x = 0; x < W; x += 9) ra(g, x, DECK + 43, 5, 2, '#1a2028', 0.9);
    for (let x = 30; x < W; x += 240) {                // 행거
      r(g, x, DECK, 3, CEIL - DECK - 6, '#252c34');
      r(g, x - 6, DECK + 36, 15, 2, '#252c34');
    }
  }

  function ceilingLamp(g, x) {                         // 기본 조명등 — 꺼져 있다
    r(g, x - 22, CEIL, 3, 6, C.metalLo);
    r(g, x + 19, CEIL, 3, 6, C.metalLo);
    r(g, x - 26, CEIL + 6, 52, 6, '#242a32');
    r(g, x - 23, CEIL + 7, 46, 3, '#191d24');          // 꺼진 형광 튜브
    ra(g, x - 23, CEIL + 7, 46, 1, '#3a434e', 0.4);
  }

  function speaker(g, x) {                             // 천장 방송용 스피커
    const y = 148;
    r(g, x - 2, DECK + 34, 4, y - DECK - 34, '#262d35');   // 행거
    r(g, x - 15, y, 30, 18, '#2b323b');                     // 몸통
    ra(g, x - 15, y, 30, 1, C.metalHi, 0.5);
    r(g, x - 15, y + 17, 30, 1, '#12161c');
    for (let i = 0; i < 6; i++) r(g, x - 11 + i * 4, y + 4, 2, 10, '#171c22');  // 그릴
    r(g, x + 11, y + 3, 3, 3, C.redDim);                    // 송출 램프
    r(g, x - 16, y + 18, 32, 3, '#20262e');                 // 나팔 립
    r(g, x - 30, y + 2, 10, 12, '#1e242c');                 // 옆 배선 박스
    ra(g, x - 30, y + 2, 10, 1, C.metalHi, 0.35);
    r(g, x - 26, y + 14, 2, 8, '#191f26');
    r(g, x + 20, y + 5, 12, 7, '#1e1a13');                  // 경고 플레이트
    ra(g, x + 20, y + 5, 12, 1, '#4a3c1c', 0.6);
    ra(g, x + 22, y + 7, 8, 3, '#5c4a22', 0.7);
  }

  function beacon(g, x) {                              // 벽면 적색 경고등 (본체만, 빛은 동적)
    const y = 176;
    r(g, x - 7, y, 14, 4, '#2c333c');
    r(g, x - 5, y + 4, 10, 6, C.redDim);
    ra(g, x - 5, y + 4, 10, 1, '#8e3a40', 0.8);
    r(g, x - 8, y + 10, 16, 2, '#20262e');
  }

  function door(g, x) {                                // 실험실 문
    const y = 172, w = 76, h = FLOOR - y;
    r(g, x - w / 2 - 5, y - 6, w + 10, h + 6, '#141920');   // 리세스
    ra(g, x - w / 2 - 5, y - 6, w + 10, 2, C.metalHi, 0.25);
    r(g, x - w / 2, y, w, h, '#242b34');
    r(g, x - 1, y, 2, h, '#151a20');                        // 양문 분할선
    ra(g, x - w / 2, y, w, 1, C.metalHi, 0.35);
    for (let i = 0; i < 2; i++) {                           // 관측창
      const dx = x - w / 2 + 8 + i * (w / 2);
      r(g, dx, y + 12, w / 2 - 16, 20, '#0e141a');
      ra(g, dx, y + 12, w / 2 - 16, 20, C.cyan, 0.05);
      ra(g, dx, y + 12, w / 2 - 16, 1, '#33414f', 0.7);
    }
    for (let i = 0; i < 6; i++)                             // 하부 위험 스트라이프
      r(g, x - w / 2 + 4 + i * 12, FLOOR - 14, 6, 10, i % 2 ? '#252c34' : '#6b5320');
    r(g, x + w / 2 + 8, y + 10, 12, 16, '#1b2129');         // 카드리더
    r(g, x + w / 2 + 11, y + 13, 6, 3, C.redDim);
    const lab = 'B4-' + (1 + Math.round(x / 600));          // 실번호
    r(g, x - TW(lab, 1) / 2 - 5, y - 18, TW(lab, 1) + 10, 11, '#1b2129');
    T(g, lab, x - TW(lab, 1) / 2, y - 15, 1, '#4d5a68');
  }

  function wallRun(g) {                                // 벽면 기본 + 반복 디테일
    r(g, 0, CEIL, W, FLOOR - CEIL, C.wall);
    r(g, 0, CEIL, W, 10, C.wallLo);                    // 천장 접합 그림자
    for (let x = 0; x < W; x += 62) r(g, x, CEIL, 1, FLOOR - CEIL, C.seam);
    ra(g, 0, CEIL + 34, W, 1, C.wallHi, 0.4);
    r(g, 0, CEIL + 35, W, 1, C.seam);
    r(g, 0, FLOOR - 8, W, 8, '#161b22');               // 걸레받이
    ra(g, 0, FLOOR - 9, W, 1, C.metalHi, 0.25);
    for (let x = 0; x < W; x += 62) {                  // 벽면 패널 음영
      ra(g, x + 2, CEIL + 12, 58, 20, C.wallHi, 0.12);
      ra(g, x + 2, CEIL + 38, 58, 26, C.wallHi, 0.07);
    }
    r(g, 0, CEIL + 60, W, 4, '#20262e');               // 벽면 배선관
    ra(g, 0, CEIL + 60, W, 1, C.metalHi, 0.2);
    for (let x = 120; x < W; x += 300) {               // 소화전함
      r(g, x, CEIL + 14, 20, 26, '#3a2226');
      ra(g, x, CEIL + 14, 20, 1, '#7a3a40', 0.7);
      r(g, x + 3, CEIL + 18, 14, 16, '#2a181b');
    }
    for (let x = 230; x < W; x += 300) {               // 벽면 스텐실
      T(g, 'B4', x, CEIL + 14, 2, '#232a33');
      T(g, 'EXIT', x + 2, CEIL + 40, 1, '#212831');
    }
  }

  function floorRun(g) {
    r(g, 0, FLOOR, W, H - FLOOR, C.floor);
    ra(g, 0, FLOOR, W, 1, C.metalHi, 0.3);
    r(g, 0, FLOOR + 1, W, 3, C.floorHi);
    for (let x = 0; x < W; x += 40) {                  // 바닥 플레이트
      r(g, x, FLOOR, 1, H - FLOOR, C.floorLo);
      ra(g, x + 1, FLOOR + 4, 38, 1, C.floorHi, 0.25);
    }
    ra(g, 0, FLOOR + 20, W, 1, C.floorLo, 0.8);
    r(g, 0, FLOOR + 30, W, H - FLOOR - 30, '#121820');  // 카메라 아래쪽 어둠
    for (let x = 60; x < W; x += 300) {                 // 노란 유도선
      ra(g, x, FLOOR + 10, 34, 2, '#6b5320', 0.55);
    }
  }

  let staticCanvas = null;
  function buildStatic() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    r(g, 0, 0, W, H, C.void);
    deck(g); wallRun(g);
    DOORS.forEach(x => door(g, x));
    floorRun(g);
    LAMPS.forEach(x => ceilingLamp(g, x));
    BEACONS.forEach(x => beacon(g, x));
    SPEAKERS.forEach(x => speaker(g, x));
    staticCanvas = c;
  }

  /* ---------- 동적 레이어 ---------- */

  /* 적색 경고등 — 기본 조명이 꺼져 있어 이 빛이 복도의 유일한 광원이다 */
  function alarmLight(g, t, st) {
    const k = st.alarm == null ? 1 : st.alarm;
    if (k <= 0) return;
    const pulse = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 3.4)), 2);
    const a = k * pulse;
    for (const x of BEACONS) {
      const y = 180;
      ra(g, x - 5, y + 4, 10, 6, '#ff6a72', 0.35 + 0.65 * a);
      ra(g, x - 10, y - 1, 20, 16, C.red, 0.22 * a);
      g.save();                                        // 아래로 퍼지는 빛
      const lg = g.createLinearGradient(0, y + 8, 0, FLOOR + 16);
      lg.addColorStop(0, 'rgba(216,67,75,' + (0.30 * a) + ')');
      lg.addColorStop(1, 'rgba(216,67,75,0)');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x - 12, y + 8); g.lineTo(x + 12, y + 8);
      g.lineTo(x + 52, FLOOR + 16); g.lineTo(x - 52, FLOOR + 16); g.closePath(); g.fill();
      g.restore();
      ra(g, x - 40, FLOOR + 1, 80, 8, '#ff5a63', 0.10 * a);   // 바닥 반사
      ra(g, x - 26, CEIL - 6, 52, 6, C.red, 0.07 * a);        // 천장 반사
    }
    ra(g, 0, CEIL, W, FLOOR - CEIL, C.red, 0.035 * a);         // 전체 붉은 기운
  }

  /* 방송 중인 스피커 — 송출 램프와 진동 링 */
  function paLight(g, t, st) {
    const k = st.pa || 0;
    if (k <= 0) return;
    const blip = Math.sin(t * 16) > -0.2 ? 1 : 0.3;
    for (const x of SPEAKERS) {
      ra(g, x + 11, 151, 3, 3, '#ff7a80', k * blip);
      ra(g, x + 9, 149, 7, 7, C.red, 0.35 * k * blip);
      for (let i = 0; i < 3; i++) {                    // 음압 링
        const u = ((t * 1.6 + i / 3) % 1);
        ra(g, x - 15 - u * 16, 166 + u * 10, 30 + u * 32, 1, '#ffd9a0', (1 - u) * 0.16 * k);
      }
    }
  }

  /* 멀리서 터진 뒤 천장에서 떨어지는 먼지 */
  function ceilingDust(g, t, st) {
    const k = st.dust || 0;
    if (k <= 0) return;
    for (let i = 0; i < 900; i++) {
      const bx = rnd(i * 3.1) * W;
      const fall = ((t * (26 + rnd(i * 7.7) * 40) + rnd(i * 2.3) * 200) % (FLOOR - CEIL));
      ra(g, bx, CEIL + fall, 1, 2 + rnd(i * 5.5) * 2, '#8e9099', 0.35 * k);
    }
  }

  function paint(g, t, st) {
    if (!staticCanvas) buildStatic();
    g.drawImage(staticCanvas, 0, 0);
    alarmLight(g, t, st);
    paLight(g, t, st);
    ceilingDust(g, t, st);
  }

  return { W: W, H: H, FLOOR: FLOOR, CEIL: CEIL, paint: paint, SPEAKERS: SPEAKERS, C: C };
})();
