/* S#5 루나의 꿈 — 과거 기억 파편 회상.
   S#3의 핵심 순간 5개(프로토콜 확인 / 나이트타운 지시 / 하운드 문 파괴 / 밀침 / 낙하)를
   짧게 짜깁기한다. 장면 내내 약한 TV 노이즈가 깔리고, 파편 전환마다 노이즈가 튀며
   화이트 플래시로 컷이 넘어간다. 주요 단어는 [noise]로 가려 알아보기 어렵다.
   마지막은 화면이 하얗게 차오르며(화이트 페이드) 끝난다. */
window.buildScene5 = function () {
  const sc = new Engine.Scene(StageDisposal);
  const FLOOR = StageDisposal.FLOOR;
  const PITC = (StageDisposal.PIT.x0 + StageDisposal.PIT.x1) / 2;

  const yuna = sc.actor('yuna', { name: '유나', x: 566, y: FLOOR, flip: true, anim: 'yuna.stand', z: 2 });
  const luna = sc.actor('luna', { name: '루나', x: 594, y: FLOOR, anim: 'luna.stand', z: 1 });
  sc.actor('hound', { name: '하운드', x: 96, y: FLOOR, scale: 1.2, anim: 'hound.idle', vis: false, z: 3 });

  sc.stage('alarm', 0, 0.3);
  sc.stage('chute', 0, 1);                       // 꿈속이라 통로는 처음부터 열려 있다
  sc.eff({ type: 'lbox', t: 0, dur: 0.6 });
  sc.eff({ type: 'fade', t: 0, dur: 1.2, dir: 'in' });

  /* 꿈 전체 톤 — 채도가 빠진 그레이드 + 항상 깔리는 약한 TV 노이즈 */
  const END_GUESS = 40;
  sc.eff({ type: 'slowmo', t: 0, dur: END_GUESS });
  sc.eff({ type: 'tvnoise', t: 0, dur: END_GUESS, amount: 0.2, atk: 1.2 });
  sc.cue(0.2, '낮은 웅웅거림 (꿈 배경음)');

  /* 기억 전환 — 노이즈 스파이크 + 화이트 플래시 */
  function memoryCut(t) {
    sc.eff({ type: 'tvnoise', t: t - 0.14, dur: 0.5, amount: 0.9, atk: 0.03, rel: 0.2 });
    sc.eff({ type: 'flash', t: t - 0.06, dur: 0.28, peak: 0.55, color: '#dff4ff', falloff: 2.2 });
    sc.cue(t - 0.1, '기억 전환 노이즈');
  }

  /* ── 파편 ① 프로토콜 확인 ─────────────────────────────── */
  sc.cut(0, 'S#5 파편 ① 달의 혼', '처리장 두 사람. 프로토콜 문답의 파편 — 핵심 단어가 깨져 있다.');
  sc.cam(0, { x: 578, y: 317, zoom: 1.34 });
  sc.at(1.4);
  sc.line({ actor: 'yuna', speaker: '유나', glitch: true, text: '루나, 활성화된 프로토콜은?' });
  sc.line({ actor: 'luna', speaker: '루나', glitch: true, text: '[c:#1A66CC][noise]달의 혼[/noise][/c] 프로토콜입니다.', hold: 0.9 });

  /* ── 파편 ② 나이트타운 지시 ───────────────────────────── */
  const F2 = sc.T + 0.4;
  sc.cut(F2, 'S#5 파편 ② 나이트타운', '행선지 지시의 파편 — 지명이 깨져 있다.');
  memoryCut(F2);
  sc.camCut(F2, { x: 560, y: 300, zoom: 1.7 });
  sc.at(F2 + 0.5);
  sc.line({ actor: 'yuna', speaker: '유나', glitch: true, text: '[noise]서울 외곽[/noise] 쪽에 있는 [c:#8b00ff][noise]나이트타운[/noise][/c]으로 도망가' });
  sc.line({ actor: 'luna', speaker: '루나', glitch: true, text: '거기서 [noise]혼[/noise]을 찾을 수 있는 건가요?', hold: 0.8 });

  /* ── 파편 ③ 하운드 — 문 파괴 ──────────────────────────── */
  const F3 = sc.T + 0.4;
  sc.cut(F3, 'S#5 파편 ③ 하운드', '문이 부서지는 순간의 파편. 꿈이라 예고 없이 단번에 터진다.');
  memoryCut(F3);
  sc.camCut(F3, { x: 200, y: 310, zoom: 1.5 });
  const BREAK = F3 + 0.9;
  sc.stage('door', BREAK - 0.01, 0);
  sc.stage('door', BREAK, 1);
  sc.set('hound', 'anim', BREAK - 0.40, 'hound.punch');
  sc.set('hound', 'vis', BREAK - 0.02, true);
  sc.cue(BREAK, '문 부수는 사운드');
  sc.eff({ type: 'flash', t: BREAK, dur: 0.4, peak: 0.7, falloff: 2.4 });
  sc.eff({ type: 'shake', t: BREAK, dur: 1.0, amp: 6, hz: 34 });
  sc.eff({ type: 'tvnoise', t: BREAK, dur: 0.9, amount: 0.6, atk: 0.02, rel: 0.4 });
  sc.eff({ type: 'dust', t: BREAK, dur: 1.0, x: 150, y: FLOOR + 4, scale: 0.5 });
  sc.eff({ type: 'debris', t: BREAK, dur: 1.3, x: 130, y: FLOOR - 60,
           groundY: FLOOR - 2, count: 16, power: 260, seed: 9.4 });
  sc.set('hound', 'anim', BREAK + 0.9, 'hound.idle');
  sc.key('hound', 'x', BREAK + 0.9, 110);
  sc.key('hound', 'x', BREAK + 2.2, 210, 'eo');
  // Silent entrance: finish the approach before the next memory fragment.
  sc.at(BREAK + 2.6);

  /* ── 파편 ④ 밀침 — 통로로 ─────────────────────────────── */
  const F4 = sc.T + 0.4;
  sc.cut(F4, 'S#5 파편 ④ 밀침', '유나가 루나를 통로로 밀어 넣는 순간의 파편.');
  memoryCut(F4);
  sc.set('hound', 'vis', F4, false);             // 꿈의 점프 — 하운드는 사라져 있다
  sc.camCut(F4, { x: 640, y: 320, zoom: 1.28 });
  sc.at(F4 + 0.4);
  sc.line({ actor: 'yuna', speaker: '유나', glitch: true, text: '먼저 가[T:0.4] [noise]언젠간 만날 테니[/noise].', hold: 0.4 });
  const PUSH = sc.T + 0.1;
  sc.cue(PUSH, '밀치는 소리');
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
  sc.eff({ type: 'dust', t: PUSH + 0.4, dur: 0.6, x: PITC, y: FLOOR + 4, scale: 0.18, alpha: 0.5 });
  sc.eff({ type: 'tvnoise', t: PUSH + 0.4, dur: 0.6, amount: 0.55, atk: 0.05, rel: 0.3 });

  /* ── 파편 ⑤ 낙하 ──────────────────────────────────────── */
  const F5 = PUSH + 1.5;
  sc.cut(F5, 'S#5 파편 ⑤ 낙하', '수직 통로를 떨어지는 자신의 모습. 노이즈가 점점 차오른다.');
  memoryCut(F5);
  sc.switchStage(F5 - 0.01, StageShaft);
  sc.set('yuna', 'vis', F5 - 0.02, false);
  const X = 236;
  sc.set('luna', 'vis', F5, true);
  sc.set('luna', 'anim', F5, 'luna.fall');
  sc.key('luna', 'alpha', F5, 1, 'l');
  sc.key('luna', 'x', F5, X, 'l');
  sc.key('luna', 'y', F5, 295, 'l');
  sc.key('luna', 'y', F5 + 0.1, 300, 'l');
  sc.key('luna', 'rot', F5, -7, 'l');
  sc.key('luna', 'y', F5 + 5.4, 1900, 'ei');
  [[0.4, -7], [1.6, 8], [2.8, -6], [4.0, 7], [5.2, -4]]
    .forEach(k => sc.key('luna', 'rot', F5 + k[0], k[1], 'eio'));
  sc.stage('speed', F5, 0);
  sc.stage('speed', F5 + 1.6, 1, 'eo');
  sc.camCut(F5, { x: 240, y: 260, zoom: 1.28 });
  sc.cam(F5 + 5.5, { y: 1860 }, 'ei');
  sc.cue(F5 + 0.2, '낙하 풍절음 (상시)');
  sc.eff({ type: 'shake', t: F5 + 0.8, dur: 4.6, amp: 0.8, hz: 20 });
  // 꿈이 무너진다 — 노이즈가 점점 차오른다
  sc.eff({ type: 'tvnoise', t: F5 + 1.2, dur: 4.4, amount: 0.75, atk: 3.6, rel: 0.1 });
  sc.cue(F5 + 3.2, '낮은 웅웅거림 (꿈 배경음)');

  /* ── 종료 — 화면이 하얗게 차오르며 꿈이 끝난다 (CRT 오프·사운드 없음, PD 26.08.29) ── */
  const OFF = F5 + 5.6;
  sc.eff({ type: 'fade', t: OFF - 1.6, dur: 1.8, dir: 'out', color: '#ffffff' });
  sc.eff({ type: 'whitehold', t: OFF + 0.2, dur: 1.2 });
  sc.end = OFF + 1.4;

  return sc.finalize();
};
