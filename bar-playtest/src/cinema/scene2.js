/* S#2 도망을 가는 이들 — 노션 「연구소 컷씬 스토리보드」 2-1 기준.
   기본 설명: 유나와 루나가 복도를 좌측에서 우측으로 달린다.
   기본 조명은 꺼지고 적색 경고등만 깜빡이며 피난 안내 방송이 계속 나온다.
   카메라 지시 4개(천장 스피커 → 바닥/하반신 → 상반신 → 얼굴 클로즈업 후 줌아웃 팔로우)를
   하드 컷으로 연결했다. */
window.buildScene2 = function () {
  const sc = new Engine.Scene(StageCorridor);
  const FLOOR = StageCorridor.FLOOR;          // 250
  const SPK   = StageCorridor.SPEAKERS[0];    // 첫 번째 천장 스피커 = 150

  sc.radioActor = 'yuna';

  /* 달리기 — 등속 직선. 카메라 키도 같은 식으로 잡아서 팔로우가 정확히 맞는다. */
  /* END = 배우·카메라 키가 깔리는 끝점(넉넉히). 실제 씬 길이는 맨 아래에서
     폭발 시점 기준으로 정한다 — 대사에 [T:] 정지 태그를 넣어도 끝이 잘리지 않게. */
  const V = 110, X0 = 340, GAP = 38, END = 27.0;
  const X = t => X0 + V * t;

  /* ---------- 배우 ----------
     둘 다 실제 달리기 시트를 쓴다. 루나는 v2 디자인(luna_v2-run_Sheet, 8프레임).
     보폭을 맞추려고 루나 쪽 fps를 유나(6프레임 14fps)보다 빠른 18fps로 잡았다 —
     키가 작으니 더 잦게 딛는 게 자연스럽다. */
  sc.actor('yuna', { name: '유나', x: X(0), y: FLOOR, flip: true, anim: 'yuna.run', z: 2 });
  sc.actor('luna', { name: '루나', x: X(0) - GAP, y: FLOOR, flip: true, anim: 'luna.run', z: 1 });

  sc.key('yuna', 'x', 0, X(0));      sc.key('yuna', 'x', END, X(END), 'l');
  sc.key('luna', 'x', 0, X(0) - GAP); sc.key('luna', 'x', END, X(END) - GAP, 'l');

  /* ---------- 무대 상태 ---------- */
  sc.stage('alarm', 0, 1);                    // 적색 경고등은 처음부터 계속
  sc.stage('pa', 0, 0);
  sc.stage('pa', 1.3, 1, 'eo');               // 방송 송출 중
  sc.stage('pa', 10.0, 1);
  sc.stage('pa', 10.5, 0, 'eo');

  sc.eff({ type: 'lbox', t: 0, dur: 0.9 });
  sc.eff({ type: 'fade', t: 0, dur: 1.5, dir: 'in' });
  sc.cue(0.15, '비상 경고음 (상시)');

  /* ======================================================================
     2-1  대피 방송과 복도를 달리는 두 명
     ====================================================================== */
  sc.cut(0, 'S#2-1 ① 천장 방송 스피커',
    '지하 4층 복도. 기본 조명이 꺼지고 적색 경고등만 깜빡인다. 거짓된 대피 방송이 울린다.');

  // 카메라 1. 복도 천장 방송용 스피커 쪽에 줌인된 상태로 방송 대사가 나옴
  sc.cam(0, { x: SPK, y: 172, zoom: 3.6 });
  sc.cue(1.4, '안내 방송 시작 (기계음·에코)');

  const PA = { kind: 'pa', speaker: '방송', at: [SPK, 168], below: true };
  sc.at(1.5);
  sc.line(Object.assign({}, PA, { text: '현재[T:0.4] 시설에 무장 병력이 침입했습니다.' }));
  sc.line(Object.assign({}, PA, { text: '연구원들은 실험체를 인솔하여 로비로 올라와 보안 병력에게 투항하십시오.' }));
  sc.line(Object.assign({}, PA, { text: '반복 전달합니다.[T:0.4] 현재 —' }));   // 방송은 여기서 처음으로 되돌아간다

  /* 카메라 2. 복도 바닥에 줌인 된 상태로 있다가 달리며 지나가는 두 사람의 하반신만 짧게
     [고정 카메라 — 인물이 프레임을 통과한다. 등장·퇴장 시각은 달리는 속도에서 역산] */
  const CB = 10.3;
  sc.cut(CB, 'S#2-1 ② 바닥 · 하반신 통과', '고정 카메라. 유나와 루나의 하반신만 프레임을 스쳐 지나간다.');
  sc.camCut(CB, { x: 1538, y: 244, zoom: 4.6 });
  sc.cue(CB, '달리는 발소리');
  for (let i = 0; i < 5; i++)                 // 발소리에 맞춘 미세한 흔들림 [애드리브]
    sc.eff({ type: 'shake', t: CB + 0.25 + i * 0.21, dur: 0.14, amp: 0.7, hz: 44 });

  /* 카메라 3. 줌인 된 상태(얼굴 하관과 상반신만 나오는 사이즈)로 지나가는 모습이 짧게 */
  const CC = 11.8;
  sc.cut(CC, 'S#2-1 ③ 상반신 통과', '얼굴 하관과 상반신만 잡히는 사이즈. 역시 고정 카메라.');
  sc.camCut(CC, { x: 1696, y: 214, zoom: 6.2 });   // 머리 위쪽부터 목·상반신까지만 (PD 26.08.29)

  /* 카메라 4. 유나의 얼굴이 클로즈업된 상태에서 천천히 줌 아웃해 복도 전체가 나올 때까지 되고,
     계속 유나와 루나가 달리는 모습을 카메라 팔로우 */
  const CD = 13.3, ZOUT0 = 14.5, ZOUT1 = 16.8;   // 줌아웃 2.3초 (PD: 살짝 더 빠르게)
  sc.cut(CD, 'S#2-1 ④ 유나 클로즈업 → 줌아웃 팔로우',
    '유나 얼굴 클로즈업에서 천천히 빠져 복도 전체가 보일 때까지. 줌아웃이 끝난 뒤 유나 대사.');
  sc.camCut(CD, { x: X(CD) + 10, y: 209, zoom: 6.2 });
  sc.cam(ZOUT0, { x: X(ZOUT0) + 10 }, 'l');
  sc.cam(ZOUT0, { y: 209, zoom: 6.2 }, 'l');
  sc.cam(ZOUT1, { x: X(ZOUT1) + 30 }, 'l');           // x는 등속 팔로우 유지
  sc.cam(ZOUT1, { y: 205, zoom: 1.9 }, 'eio');        // y·줌만 천천히 빠진다
  sc.cam(END,   { x: X(END) + 30 }, 'l');

  /* 행동 3. 유나가 달리면서 짧은 대사를 뱉는다
     — 줌아웃이 완전히 끝난 뒤(복도 전체가 보이는 상태)부터 출력한다 (PD 지시) */
  sc.cue(ZOUT1 + 0.1, '유나 거친 숨소리');
  sc.at(ZOUT1 + 0.2);
  sc.line({ actor: 'yuna', speaker: '유나', text: '하아..[T:0.5]하아.. [T:0.5]개소리하고 있네..' });

  // 사운드 3. 멀리서 무언가 터지는 소리 — 유나 대사가 끝난 뒤 한 박자 두고
  const BOOM = sc.T + 0.4;
  sc.cue(BOOM, '멀리서 무언가 터지는 소리');
  sc.eff({ type: 'shake', t: BOOM, dur: 1.3, amp: 3.2, hz: 26 });
  sc.eff({ type: 'flash', t: BOOM, dur: 0.5, peak: 0.18, color: '#ffd9a0', falloff: 2.6 });
  sc.stage('dust', BOOM, 0);
  sc.stage('dust', BOOM + 0.25, 0.9, 'eo');
  sc.stage('dust', BOOM + 3.0, 0, 'eio');
  sc.cue(BOOM + 0.25, '천장 먼지·잔해 떨어지는 소리');
  // 폭발 직후 경고등이 한 번 흔들린다 [애드리브]
  sc.stage('alarm', BOOM, 1);
  sc.stage('alarm', BOOM + 0.35, 0.35, 'l');
  sc.stage('alarm', BOOM + 1.1, 1, 'eio');

  // 종료 — 두 사람이 계속 달려가는 상태에서 페이드 아웃
  sc.eff({ type: 'fade', t: BOOM + 1.5, dur: 1.3, dir: 'out' });
  sc.eff({ type: 'black', t: BOOM + 2.8, dur: 0.8 });
  sc.end = BOOM + 3.6;

  return sc.finalize();
};
