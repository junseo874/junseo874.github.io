/* S#1 벡터그룹 습격 — 노션 「연구소 컷씬 스토리보드」 1-1 / 1-2 / 1-3 기준.
   대사·행동·카메라·사운드 칸을 그대로 시간축에 배치했다.
   스프라이트가 없는 동작(걷기, 쓰러짐, 문 파편 등)은 있는 시트를 돌려 쓰거나
   도형·이펙트로 애드리브했다. 주석에 [애드리브]로 표시해 둔다. */
window.buildScene1 = function () {
  const sc = new Engine.Scene(StageLobby);
  const FLOOR = StageLobby.FLOOR;
  const DOOR_X = StageLobby.doorCenter;

  /* ---------- 배우 ---------- */
  // 보안부 3팀. 스프라이트 기본 방향은 좌향(정문 쪽)이다. flip=true 면 우향.
  const cap = sc.actor('cap', { name: '팀장', x: 478, y: 402, scale: 1.02, flip: true,
                                anim: 'sol.idle', tint: '#8a3a44', tintAmount: 0.34, z: 3 });
  sc.actor('t1', { name: '대원 1', x: 546, y: 406, scale: 1.06, flip: true, anim: 'sol.idle', z: 4 });
  sc.actor('t2', { name: '대원 2', x: 404, y: 398, flip: true, anim: 'sol.idle', z: 2 });
  sc.actor('t3', { name: '대원 3', x: 324, y: 406, scale: 1.06, flip: true, anim: 'sol.idle', z: 4 });
  sc.actor('t4', { name: '대원 4', x: 244, y: 400, flip: true, anim: 'sol.idle', z: 2 });
  sc.actor('hound', { name: '하운드', x: 96, y: FLOOR, scale: 1.2, anim: 'hound.idle', vis: false, z: 5 });

  sc.radioActor = 'cap';        // 무전 대사는 무전기를 든 팀장 말풍선으로 띄운다

  sc.muteAlarm = true;          // 로비 씬은 경보음 사운드를 쓰지 않는다(적색 경광등 시각 연출만, PD 26.08.29)

  const SQUAD = ['cap', 't1', 't2', 't3', 't4'];
  const POS = { cap: [478, 402], t1: [546, 406], t2: [404, 398], t3: [324, 406], t4: [244, 400] };

  /* 사격 일제 발사 [애드리브] — 총구 화염·예광탄·피탄 스파크를 시간축에 흩뿌린다 */
  function volley(t0, dur, shooters, targetFn, rate) {
    rate = rate || 7;
    const n = Math.floor(dur * rate);
    for (let k = 0; k < n; k++) {
      shooters.forEach(function (sid, si) {
        const t = t0 + k / rate + si * 0.038 + Engine.rnd(k * 3 + si) * 0.03;
        const p = POS[sid];
        const mx = p[0] - 27, my = p[1] - 31;
        const tg = targetFn(t);
        sc.eff({ type: 'muzzle', t: t, dur: 0.07, x: mx, y: my });
        sc.eff({ type: 'tracer', t: t, dur: 0.05, x: mx, y: my, x2: tg[0], y2: tg[1] });
        sc.eff({ type: 'spark', t: t + 0.035, dur: 0.18, x: tg[0], y: tg[1] });
      });
    }
  }
  function setAll(ids, t, prop, v) { ids.forEach(id => sc.set(id, prop, t, v)); }

  /* ======================================================================
     S#1-1  코라테크 병력 간 대화
     ====================================================================== */
  sc.cut(0, 'S#1-1 코라테크 병력 간 대화',
    '보안부 3팀이 무전으로 연구소 폐기 절차를 확인한다. 지하 진입 준비 중 정문 경계조가 끊긴다.');

  sc.cam(0, { x: 420, y: 325, zoom: 1 });
  sc.eff({ type: 'lbox', t: 0, dur: 0.9 });                      // 상·하단 레터박스 진입
  sc.eff({ type: 'fade', t: 0, dur: 1.6, dir: 'in' });           // 카메라 1. 첫 장면 페이드 인
  sc.cue(0.1, '앰비언스 · 로비 공조음');

  sc.at(1.8);
  sc.line({ actor: 'cap', speaker: '팀장', text: '진입조[T:0.35] 상황 보고해라.' });
  sc.cue(1.9, '무전 노이즈 인');
  sc.line({ kind: 'radio', speaker: '진입조', text: '여기는 진입조.[T:0.35] 현재 지하 3층까지 [T:0.3][c:#ff5566][shake]폐기 프로토콜[/shake][/c] [T:0.3]완료했습니다.' });
  sc.line({ kind: 'radio', speaker: '진입조', text: '하지만[T:0.3].[T:0.3].[T:0.35] 마지막 남은 층에서 연구원들이 저항이 좀 심해서..' });
  sc.line({ actor: 'cap', speaker: '팀장', text: '[shake]병신새끼[/shake]들[T:0.4] 겨우 연구원들한테 막혀?' });
  sc.line({ kind: 'radio', speaker: '진입조', text: '죄송합니다.[T:0.4] 어떤 실험체가 방해 공작을 펼치고 있습니다.' });
  sc.line({ actor: 'cap', speaker: '팀장', text: '버러지같은 놈[T:0.4] 내가 직접 내려간다.[T:0.4] 도망가는 놈만 막아.' });

  // 행동 2. 무전을 끊고 지하로 진입 준비
  const tReady = sc.T;
  sc.line({ actor: 'cap', speaker: '팀장', text: '진입 준비[T:0.35] 바로 내려간다.' });
  sc.cue(tReady + 0.9, '총기 견착음');
  setAll(['t1', 't2', 't3', 't4'], tReady + 0.9, 'anim', 'sol.aim');
  setAll(['t1', 't2', 't3', 't4'], tReady + 1.5, 'anim', 'sol.idle');

  sc.line({ actor: 't1', speaker: '대원 1', text: '모두 진입 준비!' });
  // [애드리브] 지하(계단·엘리베이터)는 우측이므로 대열이 오른쪽으로 돌아 두어 걸음 이동
  const tTurn = sc.T;
  setAll(['t1', 't2'], tTurn, 'anim', 'sol.run');
  sc.move('t1', tTurn, tTurn + 0.9, 570, null, 'eio');
  sc.move('t2', tTurn, tTurn + 0.9, 424, null, 'eio');
  setAll(['t1', 't2'], tTurn + 0.9, 'anim', 'sol.idle');
  POS.t1[0] = 570; POS.t2[0] = 424;

  // 행동 3 · 카메라 2. 경계조 무전이 시작될 때 카메라가 정문 쪽(좌측)으로 이동
  const tWatch = sc.T + 0.2;
  sc.at(tWatch);
  sc.cam(tWatch, { x: 420, y: 325 });
  sc.cam(tWatch + 2.6, { x: 302, y: 325 }, 'eio');
  sc.stage('alarm', tWatch, 0);
  sc.stage('alarm', tWatch + 1.2, 1, 'eo');
  setAll(SQUAD, tWatch + 0.5, 'flip', false);                     // 전원 정문 쪽을 본다

  sc.line({ kind: 'radio', speaker: '경계조', text: '팀장님!![T:0.6] 정문 쪽에 무언가 접근하고 있습니다!' });
  sc.line({ actor: 'cap', speaker: '팀장', text: '뭐?[T:0.45] 제대로 설명해봐' });
  sc.line({ kind: 'radio', speaker: '경계조 A',
            text: '현재 장갑차 여러 대가 계속 들어오고 있는데..[T:0.4] [shake:2]야![T:0.35] 보안 격벽 안 올리고 뭐해!' });

  const tJam = sc.T;
  sc.line({ kind: 'radio', speaker: '경계조 B', glitch: true,
            text: '[T:0.25]그[T:0.25].[T:0.25].그게[T:0.35] 작동이 먹[noise]히[/noise]지 않[noise]습[/noise]니다. [T:0.35]전파 방[noise]해[/noise]인 것 [noise]습[/noise]니다.' });
  sc.stage('outside', tJam, 0);
  sc.stage('outside', tJam + 0.8, 0.7, 'eo');                     // 사운드 3. 정문 밖 교전
  sc.cue(tJam + 0.8, '정문 밖 총기 격발음');

  const tHelp = sc.T;
  sc.line({ kind: 'radio', speaker: '경계조 A', glitch: true, text: '[noise]1[/noise]조 빨리 정문[noise]으[/noise]로 화력 지원[noise]![/noise] 해!!!' });
  sc.stage('outside', tHelp + 0.4, 1, 'eo');
  sc.eff({ type: 'shake', t: tHelp + 0.5, dur: 0.5, amp: 1.2, hz: 26 });

  // 사운드 4. 폭발 — 경계조 제압당함. 무전이 끊긴다.
  const tBoom = sc.T + 0.15;
  sc.cue(tBoom, '폭발음 · 무전 두절');
  sc.eff({ type: 'flash', t: tBoom, dur: 0.5, peak: 0.55, color: '#ffdca0', falloff: 2.4 });
  sc.eff({ type: 'shake', t: tBoom, dur: 1.1, amp: 4.2, hz: 30 });
  sc.stage('outside', tBoom, 1);
  sc.stage('outside', tBoom + 1.4, 0, 'eo');
  sc.at(tBoom + 0.9);

  sc.line({ actor: 'cap', speaker: '팀장', text: '경계조?[T:0.45] 경계조? [T:0.45]응답해라.' });
  sc.line({ actor: 'cap', speaker: '팀장', text: '[T:0.3].[T:0.3].[T:0.3].[T:0.3]시발.[T:0.5] 좆된 거 같은데.' });

  /* ======================================================================
     S#1-2  하운드 등장
     ====================================================================== */
  const C2 = sc.T + 0.3;
  sc.cut(C2, 'S#1-2 하운드 등장',
    '정문 경계 인원이 전멸하고 하운드가 문을 박살내며 진입. 파편에 대원 둘이 깔리고 보안부가 격발한다.');
  sc.at(C2);

  // 카메라 1. 천천히 정문 쪽으로 줌인
  sc.cam(C2, { x: 302, y: 325, zoom: 1 });
  sc.cam(C2 + 3.4, { x: 196, y: 332, zoom: 1.36 }, 'eio');
  sc.cue(C2 + 0.4, '정적 · 낮은 진동음');

  // [애드리브] 본 타격 전 두 번의 예비 타격 — 문이 안쪽으로 밀린다
  [C2 + 1.5, C2 + 2.5].forEach(function (t, i) {
    sc.eff({ type: 'shake', t: t, dur: 0.45, amp: 2.2 + i, hz: 30 });
    sc.eff({ type: 'dust', t: t, dur: 0.5, x: DOOR_X + 20, y: FLOOR, scale: 0.16, alpha: 0.35 });
    sc.stage('doorImpact', t, 0);
    sc.stage('doorImpact', t + 0.04, 1 + i * 0.4, 'eo');
    sc.stage('doorImpact', t + 0.24, 0, 'eio');
    sc.cue(t, i ? '문 타격 2 (더 큼)' : '문 타격 1');
  });

  // 행동 1. 하운드가 문을 주먹으로 박살낸다
  const tBreak = C2 + 3.8;
  sc.cue(tBreak, '문이 부서지는 소리');
  sc.stage('door', tBreak - 0.01, 0);
  sc.stage('door', tBreak, 1);
  sc.stage('doorAge', tBreak, 0);
  sc.stage('doorAge', tBreak + 40, 40, 'l');
  sc.set('hound', 'anim', tBreak - 0.40, 'hound.punch');          // 관통 프레임이 문 붕괴와 겹치게
  sc.set('hound', 'vis', tBreak - 0.02, true);
  sc.key('hound', 'x', tBreak - 0.02, 96);
  sc.eff({ type: 'flash', t: tBreak, dur: 0.35, peak: 0.75, falloff: 2.6 });
  sc.eff({ type: 'shake', t: tBreak, dur: 1.0, amp: 6.5, hz: 34 });
  sc.eff({ type: 'dust', t: tBreak, dur: 1.1, x: DOOR_X + 40, y: FLOOR + 6, scale: 0.36 });
  sc.eff({ type: 'dust', t: tBreak + 0.12, dur: 1.3, x: DOOR_X + 110, y: FLOOR + 4, scale: 0.30, alpha: 0.5 });
  sc.eff({ type: 'debris', t: tBreak, dur: 1.5, x: DOOR_X, y: FLOOR - 60,
           groundY: FLOOR - 2, count: 22, power: 300, seed: 4.2 });

  // 카메라 2. 문이 박살나고 나서 줌 아웃
  sc.cam(tBreak + 0.05, { x: 196, y: 332, zoom: 1.36 });
  sc.cam(tBreak + 0.95, { x: 326, y: 325, zoom: 1 }, 'eq');

  // 행동 3. 날아간 문 파편에 대원 두 명이 깔려 뭉개진다 [애드리브: 전용 스프라이트가 없어
  // 병사 스프라이트를 회전시켜 튕겨 나가 눕는 것으로 처리]
  sc.cue(tBreak + 0.16, '시체가 짓뭉개지는 소리');
  [['t4', 244, 308, 0.16], ['t3', 324, 384, 0.24]].forEach(function (d) {
    const id = d[0], x0 = d[1], x1 = d[2], off = d[3];
    const t = tBreak + off;
    sc.set(id, 'anim', t, 'sol.idle');
    sc.key(id, 'x', t, x0);
    sc.key(id, 'x', t + 0.42, x1, 'eo');
    sc.key(id, 'y', t, POS[id][1]);
    sc.key(id, 'y', t + 0.16, POS[id][1] - 26, 'eo');
    sc.key(id, 'y', t + 0.42, POS[id][1] + 2, 'ei');
    sc.key(id, 'rot', t, 0);
    sc.key(id, 'rot', t + 0.42, 88, 'eo');
    sc.key(id, 'alpha', t + 0.42, 1);
    sc.key(id, 'alpha', t + 0.60, 0.82, 'l');
    sc.eff({ type: 'dust', t: t + 0.42, dur: 0.7, x: x1, y: FLOOR + 4, scale: 0.17, alpha: 0.5 });
    POS[id][0] = x1;
  });

  // 행동 2. 하운드가 천천히 로비 안으로 들어오고 멈춘다
  // [애드리브] 걷기 시트가 없어 idle 을 재생한 채 위치만 밀고, 발소리마다 흔들림·먼지를 넣었다
  const tWalk = tBreak + 1.1, tStop = tWalk + 2.9;
  sc.set('hound', 'anim', tWalk, 'hound.idle');
  sc.key('hound', 'x', tWalk, 96);
  sc.key('hound', 'x', tStop, 262, 'eo');
  sc.cue(tWalk, '발걸음 소리 (무거움)');
  for (let i = 0; i < 6; i++) {
    const t = tWalk + 0.25 + i * 0.46;
    if (t > tStop) break;
    const px = 96 + (262 - 96) * ((t - tWalk) / (tStop - tWalk));
    sc.eff({ type: 'shake', t: t, dur: 0.22, amp: 1.6, hz: 40 });
    sc.eff({ type: 'dust', t: t, dur: 0.5, x: px + 10, y: FLOOR + 4, scale: 0.13, alpha: 0.4 });
  }
  sc.cam(tWalk, { x: 326, y: 325, zoom: 1 });
  sc.cam(tStop + 0.3, { x: 400, y: 325, zoom: 1 }, 'eio');

  // 행동 3. 보안부가 하운드에게 총을 조준한다
  const tAim = tStop + 0.15;
  sc.cue(tAim, '총기 조준 소리');
  setAll(['cap', 't1', 't2'], tAim, 'anim', 'sol.aim');

  sc.at(tAim + 0.55);
  sc.line({ actor: 'cap', speaker: '팀장', text: '[T:0.25]ㅆ[T:0.25].[T:0.25].[T:0.25].쏴!!!', hold: 0.5 });

  // 행동 4. 보안부가 하운드에게 총을 격발한다
  const tFire = sc.T - 0.2;
  sc.cue(tFire, '총 격발음 · 총알 피탄음');
  setAll(['cap', 't1', 't2'], tFire, 'anim', 'sol.fire');
  volley(tFire, 2.6, ['cap', 't1', 't2'], () => [268, FLOOR - 52], 9);
  sc.eff({ type: 'shake', t: tFire, dur: 2.6, amp: 0.9, hz: 46 });

  /* ======================================================================
     S#1-3  하운드와 보안부 전투 장면
     ====================================================================== */
  const C3 = tFire + 2.4;
  sc.cut(C3, 'S#1-3 하운드와 보안부 전투',
    '총을 그대로 맞던 하운드가 도약해 팀장에게 내리꽂는다. 직전에 슬로우 모션이 걸린다.');

  // 행동 1 · 카메라 1. 도약 준비 자세 — 하운드에게 줌인
  const tCharge = C3 + 0.2;
  sc.set('hound', 'anim', tCharge, 'hound.charge');
  sc.cam(tCharge, { x: 400, y: 325, zoom: 1 });
  sc.cam(tCharge + 0.9, { x: 286, y: 348, zoom: 1.32 }, 'eio');
  sc.cue(tCharge, '근육 긴장음 · 바닥 균열');
  sc.eff({ type: 'crack', t: tCharge + 0.7, dur: 40, x: 268, y: FLOOR + 3, scale: 0.5 });
  sc.eff({ type: 'dust', t: tCharge + 0.75, dur: 0.6, x: 274, y: FLOOR + 4, scale: 0.19, alpha: 0.5 });
  setAll(['cap', 't1', 't2'], tCharge, 'anim', 'sol.fire');

  /* 행동 1 · 카메라 2. 공중으로 높게 도약 — 카메라가 하운드를 따라 올라간다.
     하운드 키가 화면에서 100px 남짓이라 카메라 y는 "발 위치 - 55" 근처를 유지해야
     몸이 프레임 밖으로 잘리지 않는다. 아래 키프레임은 그 기준으로 잡았다. */
  const tJump = tCharge + 1.15, RISE = 0.85;
  sc.cue(tJump, '점프 소리');
  sc.set('hound', 'anim', tJump, 'hound.up');
  sc.key('hound', 'x', tJump, 262);
  sc.key('hound', 'y', tJump, FLOOR);
  sc.key('hound', 'x', tJump + RISE, 352, 'l');
  sc.key('hound', 'y', tJump + RISE, 190, 'eo');
  sc.eff({ type: 'shake', t: tJump, dur: 0.4, amp: 3.4, hz: 36 });
  sc.eff({ type: 'dust', t: tJump, dur: 0.8, x: 266, y: FLOOR + 4, scale: 0.28 });
  sc.eff({ type: 'crack', t: tJump, dur: 40, x: 264, y: FLOOR + 3, scale: 1 });
  sc.cam(tJump, { x: 286, y: 348, zoom: 1.32 });
  sc.cam(tJump + RISE * 0.5, { x: 312, y: 196, zoom: 1.14 }, 'eio');
  sc.cam(tJump + RISE, { x: 338, y: 138, zoom: 1.02 }, 'eo');

  // 행동 2. 도약한 하운드에게 계속 조준하며 격발
  const tApex = tJump + RISE;
  sc.set('hound', 'anim', tApex, 'hound.air');
  sc.key('hound', 'x', tApex + 0.5, 382, 'eio');
  sc.key('hound', 'y', tApex + 0.5, 180, 'eio');
  sc.cam(tApex + 0.5, { x: 360, y: 138, zoom: 1.0 }, 'eio');
  volley(tJump + 0.15, 1.15, ['cap', 't1', 't2'], function (t) {
    const u = Math.min(1, Math.max(0, (t - tJump) / RISE));
    return [262 + 92 * u, FLOOR - (FLOOR - 190) * Engine.Ease.eo(u) - 44];
  }, 9);
  sc.cue(tJump + 0.15, '총 격발음 · 총알 피탄음');

  // 행동 3·4. 공중에서 팀장 쪽으로 빠르게 내리꽂는다 / 카메라 3. 팔로우
  const tDive = tApex + 0.5;
  sc.set('hound', 'anim', tDive, 'hound.down');
  sc.key('hound', 'x', tDive, 382);
  sc.key('hound', 'y', tDive, 180);
  sc.key('hound', 'x', tDive + 0.30, 444, 'ei');
  sc.key('hound', 'y', tDive + 0.30, 296, 'ei');
  sc.cam(tDive, { x: 360, y: 138, zoom: 1.0 });
  sc.cam(tDive + 0.30, { x: 428, y: 244, zoom: 1.06 }, 'ei');
  sc.eff({ type: 'speedline', t: tDive, dur: 0.34, x: 240, y: 120 });
  sc.cue(tDive, '급강하 · 풍절음');
  setAll(['cap', 't1', 't2'], tDive, 'anim', 'sol.aim');

  /* 카메라 4. 내리꽂기 직전, 바로 밑의 팀장에게 줌인 — 슬로우 모션 구간.
     재생 배속을 건드리지 않고 키프레임 간격 자체를 늘려 슬로우를 만든다.
     그래서 아무 지점으로 스크럽해도 결과가 같고, Timeline 클립 길이로 그대로 옮길 수 있다. */
  const tSlow = tDive + 0.30, SLOW = 2.3;
  sc.eff({ type: 'slowmo', t: tSlow, dur: SLOW + 0.15 });
  sc.set('hound', 'anim', tSlow, 'hound.dive');   // 스트릭을 2초 넘게 정지시키지 않는다
  sc.key('hound', 'x', tSlow + SLOW, 472, 'l');
  sc.key('hound', 'y', tSlow + SLOW, 368, 'l');
  sc.cam(tSlow, { x: 428, y: 244, zoom: 1.06 });
  sc.cam(tSlow + SLOW * 0.75, { x: 478, y: 352, zoom: 1.5 }, 'eio');
  sc.eff({ type: 'speedline', t: tSlow + 0.1, dur: SLOW, x: 250, y: 120 });
  sc.cue(tSlow, '사운드 로우패스 · 슬로우');

  // (1-3 대사 없음 — 노션 26.08.29 개정으로 슬로우 대사 삭제)

  /* 내리꽂기 직전 화면이 어두워지기 시작해 임팩트 시점에 완전히 검어진다.
     완전히 검어진 뒤에 하운드가 바닥을 내려찍는 소리가 나고 씬이 끝난다 (PD 26.08.29).
     대사 말풍선도 페이드를 따라 같이 어두워진다(main.js overlayDim). */
  const tHit = tSlow + SLOW + 0.05;
  sc.key('hound', 'x', tHit, 482, 'ei');
  sc.key('hound', 'y', tHit, FLOOR, 'ei');
  sc.eff({ type: 'fade', t: tSlow + 0.9, dur: tHit - tSlow - 0.9, dir: 'out' });
  sc.eff({ type: 'black', t: tHit, dur: 2.0 });
  sc.cue(tHit + 0.2, '하운드 바닥 내려찍는 소리 (충돌·파쇄)');
  sc.eff({ type: 'shake', t: tHit + 0.2, dur: 0.8, amp: 6, hz: 30 });

  sc.end = tHit + 2.0;

  return sc.finalize();
};
