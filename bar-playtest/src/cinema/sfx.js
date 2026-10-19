/* 플레이스홀더 사운드 — Web Audio로 즉석 합성한다.
   외부 음원을 쓰지 않으므로 라이선스 문제가 없고, 타임라인 큐에 정확히 붙는다.
   목적은 "이 타이밍에 이런 종류의 소리가 들어간다"를 귀로 확인하는 것이지
   최종 음원이 아니다. 실제 발주는 진행표의 사운드 큐 목록을 그대로 쓰면 된다. */
window.Sfx = (function () {

  let ctx = null, master = null, bus = null, lp = null;
  let loops = null;                      // 상시 재생 레이어(앰비언스·경보음·무전 노이즈)
  let ready = false, enabled = true, volume = 0.55;
  let NOISE = null;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    NOISE = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    master = ctx.createGain(); master.gain.value = volume;
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(lp); lp.connect(master); master.connect(ctx.destination);

    buildLoops();
    ready = true;
    return true;
  }

  const T = () => ctx.currentTime;
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = NOISE; s.loop = true; return s; }
  function env(g, t0, a, dur, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dur);
  }

  /* 노이즈 한 방 — 총성·폭발·충돌·발소리의 기본 재료 */
  function hit(o) {
    const t0 = T() + (o.at || 0), dur = o.dur || 0.2;
    const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + dur);
    f.Q.value = o.q || 1;
    env(g, t0, o.a || 0.004, dur, o.peak == null ? 0.3 : o.peak);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t0); s.stop(t0 + dur + 0.15);
  }

  /* 사인/사각 한 방 — 저역 충격, 삐 소리, 금속 링 */
  function tone(o) {
    const t0 = T() + (o.at || 0), dur = o.dur || 0.2;
    const s = ctx.createOscillator(), g = ctx.createGain();
    s.type = o.wave || 'sine';
    s.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    env(g, t0, o.a || 0.003, dur, o.peak == null ? 0.2 : o.peak);
    s.connect(g); g.connect(bus);
    s.start(t0); s.stop(t0 + dur + 0.15);
  }

  /* ---------- 레시피 ---------- */
  const R = {
    ambience() { },                                   // 상시 레이어에서 처리
    gunshot(n) {                                      // 총 격발
      for (let i = 0; i < (n || 1); i++) {
        const at = i * 0.085;
        hit({ at: at, dur: 0.09, type: 'highpass', f0: 700, peak: 0.26, a: 0.001 });
        tone({ at: at, wave: 'sine', f0: 130, f1: 45, dur: 0.07, peak: 0.22 });
      }
    },
    ricochet() {                                      // 총알 피탄
      hit({ dur: 0.16, type: 'bandpass', f0: 2600, f1: 1200, q: 3, peak: 0.24 });
    },
    aimfoley() {                                      // 총기 조준·견착 (철컥-철컥)
      hit({ dur: 0.05, type: 'bandpass', f0: 2400, q: 3, peak: 0.40, a: 0.001 });
      hit({ at: 0.09, dur: 0.07, type: 'bandpass', f0: 1600, q: 2.5, peak: 0.34, a: 0.001 });
      tone({ at: 0.09, wave: 'square', f0: 220, f1: 120, dur: 0.05, peak: 0.06 });
    },
    explosion(big) {                                  // 폭발
      const p = big ? 1 : 0.55;
      hit({ dur: big ? 1.5 : 0.9, f0: 900, f1: 60, peak: 0.42 * p, a: 0.008 });
      tone({ wave: 'sine', f0: 62, f1: 26, dur: big ? 1.3 : 0.8, peak: 0.34 * p });
      hit({ at: 0.02, dur: 0.25, type: 'highpass', f0: 1400, peak: 0.16 * p, a: 0.002 });
    },
    farBoom() {                                       // 멀리서 터지는 소리 — 고역이 없다
      hit({ dur: 1.6, f0: 260, f1: 45, peak: 0.30, a: 0.05 });
      tone({ wave: 'sine', f0: 48, f1: 22, dur: 1.5, peak: 0.26, a: 0.06 });
    },
    doorBreak() {                                     // 두꺼운 철문이 부서진다
      hit({ dur: 0.9, f0: 1600, f1: 90, peak: 0.42, a: 0.003 });
      tone({ wave: 'sine', f0: 90, f1: 32, dur: 0.7, peak: 0.34 });
      [0, 0.05, 0.12, 0.21, 0.33].forEach((d, i) =>                 // 금속 파편
        hit({ at: d, dur: 0.28, type: 'bandpass', f0: 1500 + i * 700, q: 4, peak: 0.26 }));
    },
    metalHit(strength) {                              // 문 예비 타격
      const p = strength || 1;
      hit({ dur: 0.45, f0: 700, f1: 80, peak: 0.30 * p, a: 0.003 });
      tone({ wave: 'sine', f0: 110, f1: 40, dur: 0.4, peak: 0.26 * p });
      hit({ at: 0.01, dur: 0.5, type: 'bandpass', f0: 1900, q: 5, peak: 0.20 * p });
    },
    crush() {                                         // 시체가 짓뭉개짐 — 젖은 저역 + 파쇄 클릭
      hit({ dur: 0.4, f0: 420, f1: 90, peak: 0.30, a: 0.004 });
      for (let i = 0; i < 7; i++)
        hit({ at: 0.02 + Math.random() * 0.22, dur: 0.05, type: 'bandpass',
              f0: 500 + Math.random() * 1400, q: 2.5, peak: 0.20 });
    },
    stompHeavy() {                                    // 하운드 발걸음
      hit({ dur: 0.35, f0: 260, f1: 55, peak: 0.30, a: 0.004 });
      tone({ wave: 'sine', f0: 74, f1: 34, dur: 0.3, peak: 0.24 });
    },
    footsteps(n, gap) {                               // 달리는 발소리
      for (let i = 0; i < (n || 6); i++)
        hit({ at: i * (gap || 0.21), dur: 0.07, type: 'bandpass', f0: 900, q: 1.2, peak: 0.26, a: 0.002 });
    },
    whoosh(dur) {                                     // 도약·급강하 풍절음
      const d = dur || 0.4;
      hit({ dur: d, type: 'bandpass', f0: 300, f1: 2600, q: 0.7, peak: 0.46, a: d * 0.35 });
    },
    jump() {
      R.whoosh(0.45);
      hit({ dur: 0.3, f0: 300, f1: 60, peak: 0.26, a: 0.004 });
    },
    rumble(dur) {                                     // 낮은 진동음·근육 긴장
      const d = dur || 1.2;
      hit({ dur: d, f0: 130, f1: 55, peak: 0.20, a: d * 0.5 });
      tone({ wave: 'sine', f0: 44, dur: d, peak: 0.14, a: d * 0.5 });
    },
    radioClick(open) {                                // 무전 스퀄치
      hit({ dur: 0.05, type: 'bandpass', f0: 1800, q: 2, peak: 0.30, a: 0.001 });
      tone({ wave: 'square', f0: open ? 900 : 600, f1: open ? 1400 : 400, dur: 0.06, peak: 0.05 });
    },
    paChime() {                                       // 안내 방송 시작 차임
      [[784, 0], [988, 0.16], [659, 0.32]].forEach(function (n) {
        tone({ at: n[1], wave: 'triangle', f0: n[0], dur: 0.5, peak: 0.13, a: 0.01 });
      });
    },
    breath() {                                        // 거친 숨소리 — 하아..하아..
      [0, 0.42].forEach(d => {
        hit({ at: d, dur: 0.24, type: 'bandpass', f0: 620, f1: 340, q: 0.7, peak: 0.30, a: 0.05 });
      });
    },
    debris() {                                        // 천장 먼지·잔해
      for (let i = 0; i < 24; i++)
        hit({ at: Math.random() * 1.6, dur: 0.06, type: 'bandpass',
              f0: 1800 + Math.random() * 2600, q: 3, peak: 0.16 });
    },
    crack() {                                         // 바닥 균열
      for (let i = 0; i < 5; i++)
        hit({ at: i * 0.045, dur: 0.09, type: 'bandpass', f0: 380 + i * 260, q: 3, peak: 0.24 });
    },
    hackBeeps() {                                     // 해킹 — 빠른 비프 시퀀스
      for (let i = 0; i < 9; i++)
        tone({ at: i * 0.12, wave: 'square', f0: 900 + (i % 3) * 320, dur: 0.05, peak: 0.06, a: 0.002 });
      tone({ at: 1.15, wave: 'triangle', f0: 520, f1: 780, dur: 0.3, peak: 0.10 });   // 승인음
    },
    doorSlide(open) {                                 // 통로 해치 개폐 — 유압 + 금속 슬라이드
      hit({ dur: 0.7, type: 'bandpass', f0: open ? 260 : 420, f1: open ? 520 : 200, q: 1, peak: 0.24, a: 0.12 });
      tone({ wave: 'sine', f0: open ? 70 : 90, f1: open ? 110 : 50, dur: 0.65, peak: 0.14, a: 0.1 });
      hit({ at: 0.62, dur: 0.18, f0: 500, f1: 90, peak: 0.26, a: 0.003 });            // 잠금 턱
    },
    shove() {                                         // 밀침 — 짧은 후시 + 둔탁
      R.whoosh(0.22);
      hit({ at: 0.05, dur: 0.16, f0: 500, f1: 120, peak: 0.2, a: 0.004 });
    },
    powerOff() {                                      // 디스플레이 꺼짐 — 하강 톤 + 퍽
      tone({ wave: 'sine', f0: 2600, f1: 40, dur: 0.55, peak: 0.16, a: 0.01 });
      hit({ at: 0.42, dur: 0.2, f0: 400, f1: 60, peak: 0.28, a: 0.004 });
      tone({ at: 0.46, wave: 'sine', f0: 70, f1: 28, dur: 0.5, peak: 0.2 });
      hit({ at: 0.05, dur: 0.4, type: 'highpass', f0: 3000, peak: 0.06, a: 0.1 });
    },
    dreamTone(dur) {                                  // 꿈 저음 웅웅거림
      const d = dur || 2.2;
      tone({ wave: 'sine', f0: 52, f1: 44, dur: d, peak: 0.12, a: d * 0.4 });
      tone({ wave: 'sine', f0: 78, f1: 66, dur: d, peak: 0.07, a: d * 0.4 });
    },
    slowIn() {                                        // 슬로우 진입 — 아래로 떨어지는 스웰
      tone({ wave: 'sine', f0: 300, f1: 55, dur: 1.1, peak: 0.16, a: 0.02 });
      hit({ dur: 1.2, f0: 1400, f1: 200, peak: 0.12, a: 0.3 });
    },
  };

  /* ---------- 대사 타이핑 블립 ----------
     전부 방송 톤(낮고 둔한 320Hz 부근)으로 통일 — PD 확정 26.08.29.
     화자·무전·글리치별 음색 분기는 뺐다. 남긴 것:
     - 공백 무음, 문장부호는 조금 낮고 작게
     - 글자 순번 기반 미세 지터(단조로움 방지, 재생 때마다 동일) */
  const jit = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };

  function blip(o) {
    if (!ready || !enabled) return;
    const ch = o.ch || '';
    if (/\s/.test(ch)) return;                                  // 공백은 무음
    const punct = /[.,…!?\-—·'"「」()]/.test(ch);
    const f = 320 * (1 + (jit(o.i || 0) - 0.5) * 0.06) * (punct ? 0.78 : 1);
    tone({ wave: 'triangle', f0: f, f1: f * 0.82, dur: 0.07,
           peak: 0.055 * (punct ? 0.6 : 1), a: 0.001 });
  }

  /* 라벨 → 레시피. 진행표의 사운드 큐 문구를 키워드로 매칭한다.
     위에서부터 먼저 걸리는 것이 이긴다. 큐 문구를 바꾸면 여기 키워드도 같이 봐야 한다. */
  const MAP = [
    [['폭발음'],            '폭발+무전두절', () => { R.explosion(true); R.radioClick(false); }],
    [['멀리서'],            '먼 폭발',       () => R.farBoom()],
    [['문이 부서지는', '문 부수는'], '문 파괴', () => R.doorBreak()],
    [['문 타격 2'],         '문 타격(강)',   () => R.metalHit(1.35)],
    [['문 타격'],           '문 타격',       () => R.metalHit(1)],
    [['짓뭉개지는'],        '압착',          () => R.crush()],
    [['발걸음'],            '육중한 발소리', () => R.stompHeavy()],
    [['달리는 발소리'],      '달리는 발소리', () => R.footsteps(7, 0.2)],
    [['걷는'],              '느린 발소리',   () => R.footsteps(5, 0.42)],
    [['TV 노이즈', '기억 전환'], 'TV 정전기', () => { hit({ dur: 1.2, type: 'highpass', f0: 2400, peak: 0.1, a: 0.12 }); }],
    [['꺼지는'],            '전원 꺼짐',     () => R.powerOff()],
    [['웅웅', '꿈 배경'],    '드림 톤',       () => R.dreamTone(2.4)],
    [['총기 조준', '견착'],  '총기 폴리',     () => R.aimfoley()],
    [['격발'],              '총성+피탄',     () => { R.gunshot(5); R.ricochet(); }],
    [['점프'],              '도약',          () => R.jump()],
    [['급강하', '풍절'],     '풍절음',        () => R.whoosh(0.5)],
    [['충돌', '파쇄'],       '충돌',          () => { R.explosion(true); R.crush(); R.crack(); }],
    [['근육', '바닥 균열'],  '저역 진동+균열', () => { R.rumble(1.1); R.crack(); }],
    [['로우패스', '슬로우'], '슬로우 진입',   () => R.slowIn()],
    [['정적', '진동음'],     '저역 진동',     () => R.rumble(1.6)],
    [['해킹'],              '해킹 비프',     () => R.hackBeeps()],
    [['열리는'],            '해치 개방',     () => R.doorSlide(true)],
    [['닫히는'],            '해치 폐쇄',     () => R.doorSlide(false)],
    [['밀치'],              '밀침',          () => R.shove()],
    [['무전'],              '무전 스퀄치',   () => R.radioClick(true)],
    [['안내 방송'],         '방송 차임',     () => R.paChime()],
    [['숨소리'],            '거친 숨',       () => R.breath()],
    [['먼지', '잔해'],       '잔해 낙하',     () => R.debris()],
    [['경고음', '경보음'],   '(상시 레이어: 경보음)', null],
    [['앰비언스'],          '(상시 레이어: 룸톤)',   null],
  ];

  function find(label) {
    for (const m of MAP) if (m[0].some(k => label.includes(k))) return m;
    return null;
  }
  function match(label) { const m = find(label); return m ? m[1] : null; }   // 검증용
  function play(label) {
    if (!ready || !enabled) return;
    const m = find(label);
    if (m && m[2]) m[2]();
  }

  /* ---------- 상시 레이어 ---------- */
  function buildLoops() {
    // 공조음·룸톤
    const amb = noiseSrc(), ambF = ctx.createBiquadFilter(), ambG = ctx.createGain();
    ambF.type = 'lowpass'; ambF.frequency.value = 190; ambG.gain.value = 0;
    amb.connect(ambF); ambF.connect(ambG); ambG.connect(bus); amb.start();

    // 비상 경보음 — 사인을 사각 LFO로 끊어 삐-삐- 를 만든다
    const al = ctx.createOscillator(), alG = ctx.createGain(), alOut = ctx.createGain();
    al.type = 'sine'; al.frequency.value = 662; alG.gain.value = 0; alOut.gain.value = 0;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.type = 'square'; lfo.frequency.value = 0.62; lfoG.gain.value = 0.5;
    lfo.connect(lfoG); lfoG.connect(alG.gain); alG.gain.value = 0.5;
    al.connect(alG); alG.connect(alOut); alOut.connect(bus);
    al.start(); lfo.start();

    // 무전·방송 캐리어 노이즈
    const rd = noiseSrc(), rdF = ctx.createBiquadFilter(), rdG = ctx.createGain();
    rdF.type = 'bandpass'; rdF.frequency.value = 1400; rdF.Q.value = 0.8; rdG.gain.value = 0;
    rd.connect(rdF); rdF.connect(rdG); rdG.connect(bus); rd.start();

    loops = { amb: ambG, alarm: alOut, radio: rdG };
  }

  function ramp(param, v, t) {
    param.cancelScheduledValues(T());
    param.setTargetAtTime(v, T(), t || 0.08);
  }

  /* on = {ambience:bool, alarm:0~1, radio:bool} */
  function setLoops(on) {
    if (!ready) return;
    const k = enabled ? 1 : 0;
    ramp(loops.amb.gain,   (on.ambience ? 0.05 : 0) * k, 0.3);
    ramp(loops.alarm.gain, (on.alarm || 0) * 0.045 * k, 0.25);
    ramp(loops.radio.gain, (on.radio ? 0.035 : 0) * k, 0.12);
  }

  /* 슬로우 모션 구간의 사운드 로우패스 (0~1) */
  function setLowpass(amount) {
    if (!ready) return;
    ramp(lp.frequency, 20000 - (20000 - 520) * (amount || 0), 0.15);
  }

  function resume() {
    if (!ready && !build()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function setEnabled(v) {
    enabled = v;
    if (ready) ramp(master.gain, v ? volume : 0, 0.1);
  }
  function setVolume(v) {
    volume = v;
    if (ready && enabled) ramp(master.gain, v, 0.05);
  }
  function silence() { if (ready) setLoops({}); }

  /* 검증용 — master 출력의 순간 최대 진폭을 읽는다 */
  let analyser = null;
  function peak() {
    if (!ready) return 0;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser); }
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    return m;
  }

  return { resume: resume, play: play, blip: blip, match: match, peak: peak,
           setLoops: setLoops, setLowpass: setLowpass,
           setEnabled: setEnabled, setVolume: setVolume, silence: silence,
           get available() { return !!(window.AudioContext || window.webkitAudioContext); },
           get state() { return ready ? ctx.state : 'not-built'; },
           get gain() { return ready ? master.gain.value : -1; } };
})();
