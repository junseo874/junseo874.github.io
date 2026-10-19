/* S#3 마지막 대화 + 3-5 떨어지는 루나 — 노션 3-1/3-2/3-3/3-5 기준. 한 씬으로 이어진다.
   장소: 지하 폐기물 처리장 → (암전 후) 폐기물 처리 통로(수직 샤프트).
   카메라 규칙(PD 확정 26.08.29): 이동이 끝나고 카메라가 멈춘 뒤에만 대사를 출력한다.
   하운드 진입 후에는 전원+통로가 들어오는 와이드로 빠져 고정, 이후 움직이지 않는다.
   화자 미표기 대사는 문맥상 화자를 붙였다(대본 확정 시 교체 가능). */
window.buildScene3 = function () {
  const sc = new Engine.Scene(StageDisposal);
  const FLOOR = StageDisposal.FLOOR;
  const PITC = (StageDisposal.PIT.x0 + StageDisposal.PIT.x1) / 2;   // 통로 중앙 714

  sc.actor('yuna', { name: '유나', x: 252, y: FLOOR, flip: true, anim: 'yuna.stand', z: 2 });
  sc.actor('luna', { name: '루나', x: 206, y: FLOOR, flip: true, anim: 'luna.stand', z: 1 });
  sc.actor('hound', { name: '하운드', x: 96, y: FLOOR, scale: 1.2, anim: 'hound.idle', vis: false, z: 3 });

  sc.stage('alarm', 0, 0.55);                    // 약한 경보 상황 (시각 경광등)
  sc.alarmGain = 0.2;                            // 경보음 사운드는 아주 희미하게만 (PD 26.08.29)
  sc.eff({ type: 'lbox', t: 0, dur: 0.9 });
  sc.eff({ type: 'fade', t: 0, dur: 1.4, dir: 'in' });
  sc.cue(0.1, '약한 경보음 소리 (상시)');

  /* ======================================================================
     3-1  통로 개방
     ====================================================================== */
  sc.cut(0, 'S#3-1 통로 개방',
    '통로 입구 앞까지 팔로우 → 카메라·이동 정지 후 대사. 해킹 이동만 잠깐 따라간다.');

  // 통로 입구 앞까지 걷는다 — 카메라 팔로우, 도착하면 카메라도 멈춘다
  const WALK0 = 0.6, WALK1 = 5.4;
  sc.set('yuna', 'anim', WALK0, 'yuna.walk');
  sc.set('luna', 'anim', WALK0, 'luna.walk');
  sc.move('yuna', WALK0, WALK1, 556, null, 'eio');
  sc.move('luna', WALK0, WALK1, 504, null, 'eio');
  sc.set('yuna', 'anim', WALK1, 'yuna.stand');
  sc.set('luna', 'anim', WALK1, 'luna.stand');
  sc.set('yuna', 'flip', WALK1 + 0.2, false);      // 뒤따라온 루나를 돌아본다
  sc.cue(WALK0 + 0.3, '걷는 소리');
  sc.cam(0, { x: 315, y: 312, zoom: 1.25 });
  sc.cam(WALK1, { x: 530, y: 312, zoom: 1.25 }, 'eio');

  // 카메라가 완전히 멈춘 뒤 대사 시작
  sc.at(WALK1 + 0.5);
  sc.line({ actor: 'yuna', speaker: '유나', text: '.[T:0.35].[T:0.35]역시[T:0.5] 이 쪽도…' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '어때 루나[T:0.5] 해볼 수 있겠어?' });
  sc.line({ actor: 'luna', speaker: '루나', text: '네.', hold: 0.7 });

  // 루나가 해킹하러 갈 때만 잠깐 팔로우 → 정지
  const HACK = sc.T + 0.2;
  sc.set('luna', 'anim', HACK, 'luna.walk');
  sc.set('yuna', 'flip', HACK + 0.7, true);        // 단말로 가는 루나를 눈으로 따라간다
  sc.move('luna', HACK, HACK + 1.4, 594, null, 'eio');
  sc.set('luna', 'anim', HACK + 1.4, 'luna.stand');
  sc.cam(HACK + 0.2, { x: 530, y: 312, zoom: 1.25 });
  sc.cam(HACK + 1.5, { x: 566, y: 320, zoom: 1.45 }, 'eio');
  sc.stage('hack', HACK + 1.7, 0);
  sc.stage('hack', HACK + 1.8, 1);
  sc.cue(HACK + 1.8, '해킹 사운드');

  // 문이 열리기 직전 통로 입구로 포커스 → 개방
  const OPEN = HACK + 3.4;
  sc.cam(OPEN - 0.7, { x: 566, y: 320, zoom: 1.45 });
  sc.cam(OPEN - 0.1, { x: 700, y: 330, zoom: 1.7 }, 'eio');
  sc.stage('chute', OPEN, 0);
  sc.stage('chute', OPEN + 0.7, 1, 'eio');
  sc.cue(OPEN, '통로 입구 열리는 사운드');
  sc.eff({ type: 'shake', t: OPEN, dur: 0.6, amp: 1.6, hz: 26 });
  sc.eff({ type: 'dust', t: OPEN + 0.1, dur: 0.8, x: PITC, y: FLOOR + 4, scale: 0.22, alpha: 0.5 });
  sc.stage('hack', OPEN + 0.3, 0, 'eo');

  // 대사 시작 직전, 루나·유나 중앙으로 포커스 이동 → 정지 → 이후 하운드 등장까지 유지
  const TWO = OPEN + 1.6;
  sc.cam(TWO, { x: 700, y: 330, zoom: 1.7 });
  sc.cam(TWO + 0.9, { x: 574, y: 317, zoom: 1.32 }, 'eio');
  sc.set('luna', 'flip', TWO + 0.4, false);      // 루나가 유나 쪽을 본다

  sc.at(TWO + 1.1);
  sc.line({ actor: 'luna', speaker: '루나', text: '열었습니다.', hold: 0.7 });
  sc.line({ actor: 'luna', speaker: '루나', text: '정말 여기로 떨어지는 건가요?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '그래.[T:0.5] 여기로 나가면 넌 살 수 있을 거야.' });
  sc.line({ actor: 'luna', speaker: '루나', text: '같이 가는 거 아니었습니까?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '아쉽게도 난 여기로는 못 가.[T:0.5] 다른 통로였으면 혹시 몰랐지만..' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '어쩔 수 없지[T:0.5] 먼저 가 있어 [T:0.5]나도 다른 곳으로 나가볼게' });

  /* ======================================================================
     3-2  루나를 보내기 전 마지막 대화 — 카메라는 계속 고정
     ====================================================================== */
  const C2 = sc.T + 0.3;
  sc.cut(C2, 'S#3-2 루나를 보내기 전 마지막 대화',
    '유나가 루나 바로 앞까지 반 걸음. 카메라는 하운드 등장까지 그대로 유지.');

  sc.set('yuna', 'anim', C2, 'yuna.walk');
  sc.move('yuna', C2, C2 + 0.55, 566, null, 'eio');
  sc.set('yuna', 'anim', C2 + 0.55, 'yuna.stand');
  sc.cue(C2 + 0.1, '걷는 소리');

  sc.at(C2 + 1.5);
  sc.line({ actor: 'yuna', speaker: '유나', text: '개체명 [noise]LUNA-503번[T:0.5][/noise] 너의 이름은?' });
  sc.line({ actor: 'luna', speaker: '루나', text: '루나입니다.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '현재 활성화된 프로토콜은?' });
  sc.line({ actor: 'luna', speaker: '루나', text: '[shake][c:#1A66CC]달의[T:0.5] 혼[T:0.6][/c][/shake] 프로토콜입니다.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '좋아 문제없네.[T:0.6]' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '만약[T:0.4] 밖에서 나를 만나지 못한다면' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '서울 외곽 쪽에 있는 [c:#8b00ff]나이트타운[/c]으로 도망가' });
  sc.line({ actor: 'luna', speaker: '루나', text: '안전한 곳인가요?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '그쪽에 섞여 들어가기만 하면 아무도 널 찾을 수 없을 거야.' });
  sc.line({ actor: 'luna', speaker: '루나', text: '거기서 혼을 찾을 수 있는 건가요?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '맞아[T:0.5] 대신 노력을 좀 해야겠지만 [T:0.5]뭐[T:0.35].[T:0.35].[T:0.5] 여기보단 낫겠지.' });

  /* ======================================================================
     3-3  하운드 등장
     ====================================================================== */
  const C3 = sc.T + 0.3;
  sc.cut(C3, 'S#3-3 하운드 등장',
    '문 두드림 2회 → 3번째에 박살. 하운드 진입 후 와이드로 빠져 고정(이후 카메라 이동 없음).');

  sc.at(C3 + 0.2);
  sc.line({ actor: 'luna', speaker: '루나', text: '제가 거기서 뭘 해야 하는 건가요?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '음[T:0.35].[T:0.35].[T:0.5] 그것도 가서 찾을 수 있을 거야 [T:0.5]대신 불법적인 일은 하면 안 돼' });
  sc.line({ actor: 'luna', speaker: '루나', text: '왜죠?' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '그런 행동을 하면 혼을 찾기 어려울 거야 [T:0.6]오히려 혼돈에 빠지겠지.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '뭐 자세한 건[T:0.5] 내가 남긴 기록 열어보면 돼.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '거기 아마.. [T:0.5]실력 좋은 수리공이 있을 텐..', hold: 0.15, gap: 0 });

  // 문 부수기 직전 — 카메라가 문으로 빠르게 이동
  const DOOR = sc.T + 0.1;
  sc.camCut(DOOR, { x: 530, y: 300, zoom: 1.32 });
  sc.cam(DOOR + 0.35, { x: 190, y: 310, zoom: 1.5 }, 'eo');

  // 두드림 1 · 2 → 3번째에 박살
  const BANG1 = DOOR + 0.7, BANG2 = BANG1 + 0.75, BREAK = BANG2 + 0.8;
  sc.cue(BANG1, '문 타격 1');
  sc.eff({ type: 'shake', t: BANG1, dur: 0.4, amp: 2.2, hz: 30 });
  sc.eff({ type: 'dust', t: BANG1, dur: 0.5, x: 150, y: FLOOR, scale: 0.16, alpha: 0.4 });
  sc.cue(BANG2, '문 타격 2 (더 큼)');
  sc.eff({ type: 'shake', t: BANG2, dur: 0.45, amp: 3.2, hz: 30 });
  sc.eff({ type: 'dust', t: BANG2, dur: 0.55, x: 150, y: FLOOR, scale: 0.2, alpha: 0.45 });

  sc.stage('door', BREAK - 0.01, 0);
  sc.stage('door', BREAK, 1);
  sc.set('hound', 'anim', BREAK - 0.40, 'hound.punch');
  sc.set('hound', 'vis', BREAK - 0.02, true);
  sc.cue(BREAK, '문 부수는 사운드');
  sc.eff({ type: 'flash', t: BREAK, dur: 0.35, peak: 0.6, falloff: 2.6 });
  sc.eff({ type: 'shake', t: BREAK, dur: 1.0, amp: 5.5, hz: 34 });
  sc.eff({ type: 'dust', t: BREAK, dur: 1.1, x: 150, y: FLOOR + 4, scale: 0.5 });
  sc.eff({ type: 'debris', t: BREAK, dur: 1.4, x: 130, y: FLOOR - 60,
           groundY: FLOOR - 2, count: 18, power: 260, seed: 6.1 });

  // 하운드 진입 → 줌아웃 와이드(하운드·유나·루나·통로가 한 화면) → 이후 카메라 고정
  const HWALK = BREAK + 1.0, HSTOP = HWALK + 2.2;
  sc.set('hound', 'anim', HWALK, 'hound.idle');
  sc.key('hound', 'x', HWALK, 100);
  sc.key('hound', 'x', HSTOP, 252, 'eo');
  for (let i = 0; i < 4; i++) {
    const t = HWALK + 0.3 + i * 0.5;
    sc.eff({ type: 'shake', t: t, dur: 0.2, amp: 1.4, hz: 40 });
    sc.eff({ type: 'dust', t: t, dur: 0.45, x: 110 + i * 36, y: FLOOR + 4, scale: 0.14, alpha: 0.4 });
  }
  sc.cam(HWALK + 0.2, { x: 190, y: 310, zoom: 1.5 });
  sc.cam(HSTOP + 0.4, { x: 502, y: 298, zoom: 0.86 }, 'eio');   // ← 여기서 고정, 이후 이동 없음
  sc.set('yuna', 'flip', HWALK + 0.5, false);
  sc.set('luna', 'flip', HWALK + 0.5, false);

  sc.at(HSTOP + 1.0);
  sc.line({ actor: 'hound', speaker: '하운드', text: '남은 개체가 있었군.' });
  sc.line({ actor: 'hound', speaker: '하운드', text: '투항해라. [T:0.5]살려는 주지.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '지랄하네.[T:0.5] [shake]개새끼[/shake]가.' });
  sc.line({ actor: 'luna', speaker: '루나', text: '확실히[T:0.5] 개를 닮은 얼굴입니다.' });
  sc.line({ actor: 'hound', speaker: '하운드', text: '미친 놈들인가.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '큭큭 확실히 그렇긴 하지.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '그래도 덕분에 즐거웠어 루나.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '내 삶의 이유도 찾았고 말이야.' });
  sc.line({ actor: 'yuna', speaker: '유나', text: '먼저 가[T:0.6] 언젠간 만날 테니.', hold: 0.6 });

  // 루나를 밀친다 → 버튼은 해킹 패널 바로 옆이라 반 걸음이면 된다
  const PUSH = sc.T + 0.1;
  sc.cue(PUSH, '밀치는 소리');
  sc.set('yuna', 'flip', PUSH - 0.05, true);
  sc.set('yuna', 'anim', PUSH, 'yuna.walk');
  sc.set('yuna', 'anim', PUSH + 0.22, 'yuna.stand');
  sc.key('yuna', 'x', PUSH, 566); sc.key('yuna', 'x', PUSH + 0.22, 588, 'eo');
  sc.key('luna', 'rot', PUSH, 0); sc.key('luna', 'rot', PUSH + 0.5, -26, 'eo');
  sc.key('luna', 'x', PUSH, 594); sc.key('luna', 'x', PUSH + 0.5, PITC, 'eo');
  sc.key('luna', 'y', PUSH + 0.18, FLOOR);
  sc.key('luna', 'y', PUSH + 0.75, FLOOR + 96, 'ei');
  sc.key('luna', 'alpha', PUSH + 0.45, 1);
  sc.key('luna', 'alpha', PUSH + 0.78, 0, 'l');
  sc.set('luna', 'vis', PUSH + 0.8, false);
  sc.eff({ type: 'dust', t: PUSH + 0.4, dur: 0.7, x: PITC, y: FLOOR + 4, scale: 0.2, alpha: 0.5 });

  const BTN = PUSH + 0.7;
  sc.set('yuna', 'anim', BTN, 'yuna.walk');
  sc.move('yuna', BTN, BTN + 0.5, 618, null, 'eo');
  sc.set('yuna', 'anim', BTN + 0.5, 'yuna.stand');
  sc.stage('btn', BTN + 0.6, 0);
  sc.stage('btn', BTN + 0.65, 1);
  sc.stage('chute', BTN + 0.7, 1);
  sc.stage('chute', BTN + 1.3, 0, 'eio');
  sc.cue(BTN + 0.7, '통로 문 닫히는 소리');
  sc.eff({ type: 'shake', t: BTN + 1.25, dur: 0.4, amp: 1.8, hz: 30 });
  sc.eff({ type: 'spark', t: BTN + 0.65, dur: 0.3, x: 632, y: FLOOR - 38 });

  // 마지막 대치 — 하운드가 천천히 다가온다 (카메라는 와이드 고정 그대로)
  sc.set('yuna', 'flip', BTN + 1.5, false);          // 하운드를 마주 본다
  // 하운드가 천천히 다가온다 — 발소리 진동
  const ADV = BTN + 1.7;
  sc.key('hound', 'x', ADV, 252);
  sc.key('hound', 'x', ADV + 3.2, 420, 'eio');
  for (let i = 0; i < 4; i++) {
    sc.eff({ type: 'shake', t: ADV + 0.4 + i * 0.7, dur: 0.18, amp: 1.2, hz: 40 });
    sc.eff({ type: 'dust', t: ADV + 0.4 + i * 0.7, dur: 0.4, x: 275 + i * 40, y: FLOOR + 4, scale: 0.12, alpha: 0.35 });
  }
  // 대본 지시: (완전히 멈춘 다음 말해야 함) — 하운드 정지 후에 대사 시작
  sc.at(ADV + 3.4);
  sc.line({ actor: 'hound', speaker: '하운드', text: '.[T:0.35].[T:0.35].[T:0.35]', hold: 0.5 });
  sc.line({ actor: 'yuna', speaker: '유나', text: '어쩌나. 이제 주인님한테 혼나겠네.' });
  sc.line({ actor: 'hound', speaker: '하운드', text: '.[T:0.3].[T:0.3].[T:0.3][c:#ff5566][shake]죽여주지.', hold: 1.0 });

  // 암전 → 무대 전환
  sc.eff({ type: 'fade', t: sc.T + 0.3, dur: 1.2, dir: 'out' });
  sc.eff({ type: 'black', t: sc.T + 1.5, dur: 1.0 });

  /* ======================================================================
     3-5  떨어지는 루나 — 수직 샤프트로 전환 (구 S#4)
     ====================================================================== */
  const T4 = sc.T + 2.3;
  sc.cut(T4, 'S#3-5 떨어지는 루나',
    '수직 통로 낙하. 점점 하얘지다 완전히 하얘지기 직전 쿵 소리와 함께 종료. 대사 없음.');
  sc.switchStage(T4 - 0.01, StageShaft);
  sc.set('yuna', 'vis', T4 - 0.02, false);
  sc.set('hound', 'vis', T4 - 0.02, false);
  sc.eff({ type: 'fade', t: T4, dur: 0.9, dir: 'in' });

  const X = 236;
  sc.set('luna', 'vis', T4, true);
  sc.set('luna', 'anim', T4, 'luna.fall');
  sc.key('luna', 'alpha', T4, 1, 'l');
  sc.key('luna', 'x', T4, X, 'l');
  sc.key('luna', 'y', T4, 170, 'l');
  sc.key('luna', 'y', T4 + 0.3, 190, 'l');
  sc.key('luna', 'rot', T4, 0, 'l');
  sc.key('luna', 'y', T4 + 2.6, 760, 'ei');
  sc.key('luna', 'y', T4 + 7.9, 2360, 'l');
  [[0.3, 0], [1.2, -8], [2.4, 7], [3.6, -6], [4.8, 8], [6.0, -7], [7.2, 5], [7.9, -3]]
    .forEach(k => sc.key('luna', 'rot', T4 + k[0], k[1], 'eio'));
  [[0.6, 0], [1.8, 10], [3.0, -8], [4.4, 9], [5.8, -9], [7.2, 6]]
    .forEach(k => sc.key('luna', 'x', T4 + k[0], X + k[1], 'eio'));

  sc.stage('speed', T4 + 0.3, 0);
  sc.stage('speed', T4 + 2.6, 1, 'eo');

  sc.camCut(T4, { x: 240, y: 150, zoom: 1.3 });
  sc.cam(T4 + 2.75, { y: 730 }, 'ei');
  sc.cam(T4 + 2.75, { zoom: 1.18 }, 'eio');
  sc.cam(T4 + 8.05, { y: 2330 }, 'l');

  sc.cue(T4 + 0.4, '낙하 풍절음 (상시)');
  sc.eff({ type: 'shake', t: T4 + 2.0, dur: 6.2, amp: 0.9, hz: 20 });

  sc.eff({ type: 'fade', t: T4 + 4.6, dur: 3.7, dir: 'out', color: '#ffffff' });
  const THUD = T4 + 8.12;
  sc.cue(THUD, '바닥 충돌음 (쿵)');
  sc.eff({ type: 'shake', t: THUD, dur: 0.7, amp: 7, hz: 30 });
  sc.eff({ type: 'flash', t: THUD, dur: 0.4, peak: 1, color: '#ffffff', falloff: 1.2 });
  sc.eff({ type: 'whitehold', t: T4 + 8.3, dur: 1.2 });

  sc.end = T4 + 9.5;
  return sc.finalize();
};
