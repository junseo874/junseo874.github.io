/* 컷씬 엔진.
   설계 원칙: 화면 상태는 "시간 t의 순수 함수"다. 모든 움직임은 키프레임 트랙에서
   평가하고, 랜덤은 t로 시드를 만든다. 그래서 타임라인을 아무 데나 스크럽해도
   결과가 항상 같고, 연출 타이밍을 프레임 단위로 검토할 수 있다.
   슬로우모션도 재생 배속이 아니라 키프레임 간격 자체에 구워 넣는다. */
window.Engine = (function () {

  const VW = 480, VH = 270;                     // 유니티 프로토와 같은 픽셀 기준 해상도

  const Ease = {
    l:  u => u,
    ei: u => u * u,
    eo: u => 1 - (1 - u) * (1 - u),
    eio:u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2,
    ec: u => 1 - Math.pow(1 - u, 3),
    eq: u => 1 - Math.pow(1 - u, 5),
  };

  /* align: 'sheet'(기본) | 'anim' | 'frame' — Sprites.animAnchor 참조 */
  const ANIM = {
    'sol.idle':   { sheet: 'soldier_ani_idle',        from: 0, to: 7,  fps: 8,  loop: true },
    'sol.run':    { sheet: 'soldier_ani_run',         from: 0, to: 7,  fps: 12, loop: true },
    'sol.aim':    { sheet: 'soldier_ani_shoot',       from: 0, to: 0,  fps: 1,  loop: true },
    'sol.fire':   { sheet: 'soldier_ani_shoot',       from: 0, to: 2,  fps: 14, loop: true },
    'hound.idle': { sheet: 'hound_room_idle',         from: 0, to: 10, fps: 9,  loop: true },
    'hound.punch':{ sheet: 'hound_punch_sheet',       from: 0, to: 14, fps: 15, loop: false, align: 'anim' },
    'hound.charge':{sheet: 'hound_attack_ani_charge', from: 0, to: 13, fps: 13, loop: false, align: 'anim' },
    'hound.land': { sheet: 'hound_attack_ani_charge', from: 13, to: 13, fps: 1, loop: true,  align: 'anim' },
    'hound.up':   { sheet: 'hound_attack_ani_up',     from: 0, to: 10, fps: 16, loop: false, align: 'frame' },
    'hound.air':  { sheet: 'hound_attack_ani_up',     from: 8, to: 10, fps: 8,  loop: true,  align: 'frame' },
    'hound.dive': { sheet: 'hound_attack_ani_up',     from: 9, to: 10, fps: 5,  loop: true,  align: 'frame' },
    'hound.down': { sheet: 'hound_attack_ani_down',   from: 0, to: 1,  fps: 9,  loop: false, align: 'frame' },
    'hound.swipe':{ sheet: 'hound_attack_ani',        from: 0, to: 7,  fps: 14, loop: false, align: 'anim' },
    'yuna.idle':  { sheet: 'yuna_idle',               from: 0, to: 8,  fps: 7,  loop: true },
    'yuna.run':   { sheet: 'yuna_ani_run',            from: 0, to: 5,  fps: 14, loop: true },
    'yuna.walk':  { sheet: 'yuna_walk',               from: 0, to: 7,  fps: 9,  loop: true, stride: 56 },
    'yuna.stand': { sheet: 'yuna_idle',               from: 0, to: 8,  fps: 7,  loop: true },
    'yuna.up':    { sheet: 'yuna_ani_stand_up',       from: 0, to: 6,  fps: 11, loop: false, align: 'anim' },
    'luna.stand': { sheet: 'luna_idle',               from: 0, to: 8,  fps: 6,  loop: true },
    'luna.run':   { sheet: 'luna_v2-run_Sheet',       from: 0, to: 7,  fps: 18, loop: true },
    'luna.walk':  { sheet: 'luna_walk',               from: 0, to: 7,  fps: 9,  loop: true, stride: 48 },
    'luna.fall':  { sheet: 'luna_fall',               from: 0, to: 5,  fps: 9,  loop: true, anchor: { ax: 46.5, ay: 39 } },
    'luna.crawl': { sheet: 'luna_crawl',              from: 0, to: 7,  fps: 9,  loop: true },
  };
  const ANCHOR = {};                                    // 스프라이트 로드 후 1회 계산
  function initAnchors() {
    Object.keys(ANIM).forEach(function (k) {
      const d = ANIM[k];
      ANCHOR[k] = d.anchor || Sprites.animAnchor(d.sheet, d.from, d.to, d.align || 'sheet');
    });
  }

  function rnd(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function srnd(s) { return rnd(s) * 2 - 1; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------- 트랙 ---------- */
  function evalNum(keys, t, dflt) {
    if (!keys || !keys.length) return dflt;
    if (t <= keys[0].t) return keys[0].v;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (t >= keys[i].t) {
        const a = keys[i], b = keys[i + 1];
        if (!b) return a.v;
        const u = b.t <= a.t ? 1 : clamp((t - a.t) / (b.t - a.t), 0, 1);
        return a.v + (b.v - a.v) * (Ease[b.ease] || Ease.eio)(u);
      }
    }
    return dflt;
  }
  function evalStep(keys, t, dflt) {
    if (!keys || !keys.length) return dflt;
    let v = dflt;
    for (let i = 0; i < keys.length; i++) { if (t >= keys[i].t) v = keys[i]; else break; }
    return v === dflt ? dflt : v;
  }

  /* ---------- 씬 ---------- */
  function Scene(stage) {
    this.st = stage || window.StageLobby;
    this.world = { W: this.st.W, H: this.st.H, floor: this.st.FLOOR };
    this.stageList = [{ t: 0, st: this.st }];   // 한 씬 안에서 무대를 갈아탈 수 있다(암전 중 전환용)
    this.actors = {};
    this.order = [];
    this.camX = []; this.camY = []; this.camZ = [];
    this.fx = [];
    this.lines = [];
    this.sfx = [];
    this.cuts = [];
    this.stageTracks = {};                      // 무대별 상태 트랙. 이름은 무대 모듈이 정한다
    this.T = 0;
    this.end = 0;
  }

  Scene.prototype.actor = function (id, o) {
    const a = {
      id: id, name: o.name || id, z: o.z || 0,
      tint: o.tint || null, tintAmount: o.tintAmount || 0.4,
      bubbleDy: o.bubbleDy || 0,
      bob: o.bob || 0, bobHz: o.bobHz || 4.7,     // 달리는 느낌을 내는 절차적 상하 흔들림
      x: [{ t: 0, v: o.x }], y: [{ t: 0, v: o.y }],
      rot: [{ t: 0, v: o.rot || 0 }], scale: [{ t: 0, v: o.scale || 1 }],
      alpha: [{ t: 0, v: o.alpha == null ? 1 : o.alpha }],
      anim: [{ t: 0, v: o.anim || 'sol.idle' }],
      flip: [{ t: 0, v: !!o.flip }],
      vis: [{ t: 0, v: o.vis === false ? false : true }],
    };
    this.actors[id] = a; this.order.push(a);
    return a;
  };

  Scene.prototype.key = function (id, prop, t, v, ease) {
    this.actors[id][prop].push({ t: t, v: v, ease: ease });
    this.end = Math.max(this.end, t);
    return this;
  };
  Scene.prototype.set = function (id, prop, t, v) {          // 스텝 트랙(anim/flip/vis)
    this.actors[id][prop].push({ t: t, v: v });
    this.end = Math.max(this.end, t);
    return this;
  };
  Scene.prototype.move = function (id, t0, t1, x1, y1, ease) {
    const a = this.actors[id];
    this.key(id, 'x', t0, evalNum(a.x, t0, 0));
    this.key(id, 'y', t0, evalNum(a.y, t0, 0));
    this.key(id, 'x', t1, x1, ease || 'eio');
    this.key(id, 'y', t1, y1 == null ? evalNum(a.y, t0, 0) : y1, ease || 'eio');
    return this;
  };
  Scene.prototype.cam = function (t, o, ease) {
    if (o.x != null) this.camX.push({ t: t, v: o.x, ease: ease });
    if (o.y != null) this.camY.push({ t: t, v: o.y, ease: ease });
    if (o.zoom != null) this.camZ.push({ t: t, v: o.zoom, ease: ease });
    this.end = Math.max(this.end, t);
    return this;
  };
  Scene.prototype.stage = function (name, t, v, ease) {
    (this.stageTracks[name] = this.stageTracks[name] || []).push({ t: t, v: v, ease: ease });
    this.end = Math.max(this.end, t);
    return this;
  };

  /* 하드 컷 — 현재 카메라 값을 t 직전에 한 번 고정하고 t에서 새 값으로 튄다 */
  Scene.prototype.camCut = function (t, o) {
    const e = 0.001;
    this.cam(t - e, {
      x: evalNum(this.camX, t - e, this.world.W / 2),
      y: evalNum(this.camY, t - e, this.world.floor - 90),
      zoom: evalNum(this.camZ, t - e, 1),
    }, 'l');
    this.cam(t, o, 'l');
    return this;
  };
  Scene.prototype.eff = function (o) {
    o.dur = o.dur || 0.4;
    this.fx.push(o);
    this.end = Math.max(this.end, o.t + o.dur);
    return this;
  };
  Scene.prototype.cue = function (t, label) { this.sfx.push({ t: t, label: label }); return this; };
  Scene.prototype.switchStage = function (t, st) {
    this.stageList.push({ t: t, st: st });
    this.end = Math.max(this.end, t);
    return this;
  };
  Scene.prototype.stageAt = function (t) {
    let s = this.st;
    for (const e of this.stageList) if (t >= e.t) s = e.st;
    return s;
  };
  Scene.prototype.cut = function (t, label, note) { this.cuts.push({ t: t, label: label, note: note }); return this; };

  /* 웹 편집기용 오버라이드.
     LINE_OV[i] = {text, cps, hold, gap} 형태로 i번째 대사를 덮어쓴다.
     TYPE_SCALE 은 모든 대사의 타이핑 속도에 곱해지는 전역 배율. */
  let LINE_OV = null, TYPE_SCALE = 1;
  function setLineOverrides(m) { LINE_OV = m || null; }
  function setTypingScale(v) { TYPE_SCALE = v > 0 ? v : 1; }

  /* 대사 안의 타이핑 정지 태그를 뽑아낸다.
     `[T:0.125]` = 그 지점에서 0.125초 동안 글자 출력을 멈춘다. 대소문자·공백 허용.
     태그는 본문에서 제거되므로 말풍선 크기·진행표 표시에는 영향을 주지 않는다. */
  /* 인라인 태그 문법
     [T:0.2]                 타이핑 0.2초 정지
     [c:#ff5566]…[/c]        글자 색
     [shake]…[/shake]        떨림 (강도: [shake:2], 기본 1)
     [noise]…[/noise]        지지직 — 글자가 계속 깨져서 읽을 수 없다
     [censor]…[/censor]      모자이크 — ▓▒█ 블록으로 가려진다
     \\n 또는 [br]            강제 줄바꿈
     태그는 본문에서 제거되고, 닫는 태그가 없으면 대사 끝까지 적용된다.
     깨진 태그는 본문에 그대로 남는다(오타를 눈에 띄게). */
  const TAG = /\[\s*[Tt]\s*:\s*([0-9]*\.?[0-9]+)\s*\]|\[\s*[bB][rR]\s*\]|\[(c|shake)\s*:\s*([^\]]+?)\s*\]|\[(shake|noise|censor)\]|\[\/(c|shake|noise|censor)\]/g;
  function parseTags(src) {
    src = String(src).replace(/\\n/g, '\n');        // 문서에 쓴 리터럴 \n → 실제 줄바꿈
    const pauses = [], spans = [];
    const stack = { c: [], shake: [], noise: [], censor: [] };
    let text = '', last = 0, m, total = 0;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(src)) !== null) {
      text += src.slice(last, m.index);
      last = m.index + m[0].length;
      if (m[1] !== undefined) {                                  // [T:초]
        const d = parseFloat(m[1]);
        if (d > 0) { pauses.push({ i: text.length, d: d }); total += d; }
      } else if (/^\[\s*br\s*\]$/i.test(m[0])) {               // [br] → 줄바꿈
        text += '\n';
      } else if (m[2]) {                                         // [c:#hex] | [shake:강도]
        stack[m[2]].push({ start: text.length, param: m[3] });
      } else if (m[4]) {                                         // [shake] [noise] [censor]
        stack[m[4]].push({ start: text.length, param: null });
      } else if (m[5]) {                                         // 닫는 태그
        const st = stack[m[5]].pop();
        if (st && text.length > st.start)
          spans.push({ type: m[5], i0: st.start, i1: text.length, param: st.param });
      }
    }
    text += src.slice(last);
    for (const k in stack)                                       // 안 닫힌 스팬은 끝까지
      for (const st of stack[k])
        if (text.length > st.start) spans.push({ type: k, i0: st.start, i1: text.length, param: st.param });
    return { text: text, pauses: pauses, total: total, spans: spans };
  }

  /* 글자별 스타일 표 — main.js가 말풍선 DOM을 만들 때 쓴다 */
  function charStyles(len, spans) {
    const st = [];
    for (let i = 0; i < len; i++) st.push({ color: null, shake: 0, noise: false, censor: false });
    for (const sp of spans || [])
      for (let i = sp.i0; i < sp.i1 && i < len; i++) {
        if (sp.type === 'c') st[i].color = sp.param;
        else if (sp.type === 'shake') st[i].shake = Math.max(st[i].shake, parseFloat(sp.param) || 1);
        else if (sp.type === 'noise') st[i].noise = true;
        else if (sp.type === 'censor') st[i].censor = true;
      }
    return st;
  }

  /* 경과시간 e(=t - 시작 - lead)  /* 경과시간 e(=t - 시작 - lead) 기준으로 지금 몇 글자가 보여야 하는지.
     정지 구간에서는 글자 수가 그대로 멈춘다. */
  function typedCount(l, e) {
    if (e <= 0) return 0;
    const cps = l.cps, ps = l.pauses || [];
    let acc = 0;
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k];
      if (e < p.i * cps + acc + p.d) return Math.max(0, Math.min(p.i, Math.floor((e - acc) / cps)));
      acc += p.d;
    }
    return Math.max(0, Math.min(l.text.length, Math.floor((e - acc) / cps)));
  }

  /* 대사. 길이에 맞춰 자동으로 시간을 잡고 커서를 밀어 준다. */
  Scene.prototype.line = function (o) {
    const idx = this.lines.length;                       // 씬 안에서의 대사 순번 = 오버라이드 키
    const ov = LINE_OV && LINE_OV[idx];
    if (ov) o = Object.assign({}, o, ov);
    const parsed = parseTags(o.text);
    const len = parsed.text.length;
    const lead = 0.12, cps = (o.cps || 0.02) * TYPE_SCALE, hold = o.hold == null ? 1.15 : o.hold;
    const dur = o.dur || Math.max(1.5, lead + len * cps + parsed.total + hold);
    const rec = {
      idx: idx, t: this.T, dur: dur, speaker: o.speaker, text: parsed.text,
      baseCps: o.cps || 0.02, hold: hold, gap: o.gap == null ? 0.16 : o.gap,
      raw: o.text, pauses: parsed.pauses, pauseTotal: parsed.total, spans: parsed.spans,
      kind: o.kind || 'bubble', actor: o.actor || null,
      at: o.at || null, below: !!o.below,        // at = 배우 대신 월드 좌표에 붙인다(천장 스피커 등)
      glitch: !!o.glitch, lead: lead, cps: cps,
    };
    this.lines.push(rec);
    this.T += dur + (o.gap == null ? 0.16 : o.gap);
    this.end = Math.max(this.end, this.T);
    return rec;
  };

  Scene.prototype.wait = function (d) { this.T += d; this.end = Math.max(this.end, this.T); return this; };
  Scene.prototype.at = function (t) { this.T = t; return this; };

  Scene.prototype.finalize = function () {
    const bt = (k) => k.sort((a, b) => a.t - b.t);
    this.order.forEach(a => ['x', 'y', 'rot', 'scale', 'alpha', 'anim', 'flip', 'vis'].forEach(p => bt(a[p])));
    bt(this.camX); bt(this.camY); bt(this.camZ);
    Object.keys(this.stageTracks).forEach(k => bt(this.stageTracks[k]));
    bt(this.fx); bt(this.lines); bt(this.sfx); bt(this.cuts);
    this.order.sort((a, b) => a.z - b.z);
    this.stageList.sort((a, b) => a.t - b.t);
    return this;
  };

  Scene.prototype.actorState = function (a, t) {
    const bob = a.bob ? -Math.abs(Math.sin(t * a.bobHz * Math.PI)) * a.bob : 0;
    let anim = evalStep(a.anim, t, { t: 0, v: 'sol.idle' });
    const d = ANIM[anim.v];
    if (d && d.stride) {
      // 지상 보행은 이동 거리에 맞춰 재생한다. 가감속·정지·역방향 스크럽에도 동일하다.
      let distance = 0, x = evalNum(a.x, anim.t, 0);
      for (const key of a.x) {
        if (key.t <= anim.t || key.t >= t) continue;
        distance += Math.abs(key.v - x);
        x = key.v;
      }
      distance += Math.abs(evalNum(a.x, t, 0) - x);
      anim = { ...anim, frame: distance / (d.stride * evalNum(a.scale, t, 1)) * (d.to - d.from + 1) };
    }
    return {
      x: evalNum(a.x, t, 0), y: evalNum(a.y, t, 0) + bob,
      rot: evalNum(a.rot, t, 0), scale: evalNum(a.scale, t, 1),
      alpha: evalNum(a.alpha, t, 1),
      anim: anim,
      flip: evalStep(a.flip, t, { t: 0, v: false }).v,
      vis: evalStep(a.vis, t, { t: 0, v: true }).v,
    };
  };

  function frameOf(animKey, t) {
    const d = ANIM[animKey.v];
    const n = d.to - d.from + 1;
    let k = Math.floor(animKey.frame == null ? (t - animKey.t) * d.fps : animKey.frame);
    if (k < 0) k = 0;
    k = d.loop ? ((k % n) + n) % n : Math.min(k, n - 1);
    const a = ANCHOR[animKey.v];
    return { sheet: d.sheet, i: d.from + k, ax: a && a.ax, ay: a && a.ay };
  }

  Scene.prototype.lineAt = function (t) {
    for (const l of this.lines) if (t >= l.t && t < l.t + l.dur) return l;
    return null;
  };
  Scene.prototype.cutAt = function (t) {
    let c = this.cuts[0] || null;
    for (const x of this.cuts) if (t >= x.t) c = x;
    return c;
  };

  /* ---------- 렌더러 ---------- */
  function Renderer(canvas, scene) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.sc = scene;
    this.opts = { letterbox: true, grade: true, sfxLabel: true, overview: false, debug: false };
  }

  Renderer.prototype.camera = function (t) {
    const sc = this.sc;
    const stg = sc.stageAt(t);
    let z = evalNum(sc.camZ, t, 1) || 1;
    let x = evalNum(sc.camX, t, stg.W / 2);
    let y = evalNum(sc.camY, t, stg.FLOOR - 90);
    if (this.opts.overview) { z = VW / stg.W; x = stg.W / 2; y = stg.H / 2; }
    let sx = 0, sy = 0;
    for (const f of sc.fx) {                                   // 화면 흔들림
      if (f.type !== 'shake' || t < f.t || t > f.t + f.dur) continue;
      const u = 1 - (t - f.t) / f.dur;
      const k = Math.floor(t * (f.hz || 34));
      sx += srnd(k * 3.1 + f.t) * f.amp * u;
      sy += srnd(k * 7.7 + f.t) * f.amp * u * 0.7;
    }
    if (!this.opts.overview) {
      const hw = VW / (2 * z), hh = VH / (2 * z);
      x = clamp(x, hw, stg.W - hw);
      y = clamp(y, hh, stg.H - hh);
    }
    return { x: x + sx, y: y + sy, z: z };
  };

  Renderer.prototype.project = function (cam, wx, wy) {
    return { x: (wx - cam.x) * cam.z + VW / 2, y: (wy - cam.y) * cam.z + VH / 2 };
  };

  Renderer.prototype.drawActors = function (g, t) {
    const sc = this.sc;
    for (const a of sc.order) {
      const s = sc.actorState(a, t);
      if (!s.vis || s.alpha <= 0.01) continue;
      const f = frameOf(s.anim, t);
      g.save();
      if (s.rot) { g.translate(s.x, s.y); g.rotate(s.rot * Math.PI / 180); g.translate(-s.x, -s.y); }
      Sprites.draw(g, f.sheet, f.i, s.x, s.y, {
        flip: s.flip, scale: s.scale, alpha: s.alpha, ax: f.ax, ay: f.ay,
        tint: a.tint, tintAmount: a.tintAmount,
      });
      g.restore();
      if (this.opts.debug) {
        g.fillStyle = '#ff3b6b'; g.fillRect(s.x - 1, s.y - 1, 2, 2);
        g.fillStyle = '#8be9fd'; g.font = '6px monospace';
        g.fillText(a.id, s.x - 8, s.y - Sprites.contentHeight(f.sheet) * s.scale - 3);
      }
    }
  };

  Renderer.prototype.drawWorldFx = function (g, t) {
    for (const f of this.sc.fx) {
      if (t < f.t || t > f.t + f.dur) continue;
      const u = (t - f.t) / f.dur;
      switch (f.type) {
        case 'dust': {
          const sh = Sprites.get('lab_effect-Sheet');
          const n = sh.frames.length;
          const i = Math.min(n - 1, Math.floor(u * n));
          Sprites.draw(g, 'lab_effect-Sheet', i, f.x, f.y, {
            scale: f.scale || 1, alpha: (f.alpha == null ? 0.62 : f.alpha) * (1 - u * 0.45), flip: f.flip,
            tint: f.tint || '#5c6470', tintAmount: f.tintAmount == null ? 0.62 : f.tintAmount,
          });
          break;
        }
        case 'muzzle': {
          const a = 1 - u;
          g.save(); g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(255,232,170,' + (0.9 * a) + ')';
          g.fillRect(f.x - 5, f.y - 2, 11, 4);
          g.fillRect(f.x - 2, f.y - 5, 4, 11);
          g.fillStyle = 'rgba(255,255,255,' + (0.7 * a) + ')';
          g.fillRect(f.x - 2, f.y - 2, 4, 4);
          g.restore();
          break;
        }
        case 'tracer': {
          g.save(); g.globalAlpha = (1 - u) * 0.85;
          g.strokeStyle = '#ffeab4'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke();
          g.restore();
          break;
        }
        case 'spark': {
          const a = 1 - u;
          g.save(); g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 5; i++) {
            const s = rnd(f.t * 31 + i);
            g.fillStyle = 'rgba(255,220,180,' + (0.8 * a) + ')';
            g.fillRect(f.x + srnd(s * 3) * 7 - u * srnd(s) * 10,
                       f.y + srnd(s * 5) * 9 - u * 8, 2, 2);
          }
          g.restore();
          break;
        }
        case 'debris': {                                    // 날아가는 문 파편
          const n = f.count || 16;
          for (let i = 0; i < n; i++) {
            const s = rnd(f.seed + i * 4.3), s2 = rnd(f.seed + i * 9.1);
            const vx = (0.5 + s * 1.6) * (f.power || 260);
            const vy = -(0.15 + s2 * 1.1) * (f.power || 260) * 0.55;
            const tt = u * f.dur;
            const px = f.x + vx * tt;
            const py = Math.min(f.groundY, f.y + vy * tt + 470 * tt * tt);
            const w = 3 + s * 9, h = 2 + s2 * 7;
            g.save();
            g.translate(px, py);
            g.rotate((s - 0.5) * 14 * tt);
            g.fillStyle = s > 0.66 ? '#4a5b6b' : s > 0.33 ? '#3a4653' : '#8a6a24';
            g.fillRect(-w / 2, -h / 2, w, h);
            g.restore();
          }
          break;
        }
        case 'link': {                                      // 손을 잡고 달리는 두 배우를 잇는 팔
          const A = this.sc.actors[f.a], B = this.sc.actors[f.b];
          if (!A || !B) break;
          const sa = this.sc.actorState(A, t), sb = this.sc.actorState(B, t);
          if (!sa.vis || !sb.vis) break;
          const x1 = sa.x + (f.ax || 0), y1 = sa.y + (f.ay || -26);
          const x2 = sb.x + (f.bx || 0), y2 = sb.y + (f.by || -20);
          g.save();
          g.strokeStyle = f.color || '#e8dcc8'; g.lineWidth = f.w || 2;
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(x1, y1);
          g.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + (f.sag == null ? 3 : f.sag), x2, y2);
          g.stroke(); g.restore();
          break;
        }
        case 'crack': {                                     // 착지·도약 충격 바닥 균열
          const k = Math.min(1, u * 8), sc2 = f.scale || 1;
          g.save(); g.strokeStyle = '#0c1218'; g.lineWidth = 1; g.globalAlpha = 0.9;
          for (let i = 0; i < 10; i++) {
            const dir = i % 2 ? 1 : -1;
            const len = (10 + rnd(f.t * 5 + i) * 34) * sc2 * k;
            const dy = (rnd(i * 13 + f.t) - 0.5) * 6 * sc2;
            g.beginPath(); g.moveTo(f.x, f.y);
            g.lineTo(f.x + dir * len, f.y + dy);
            g.lineTo(f.x + dir * len * 1.5, f.y + dy * 2.2);
            g.stroke();
          }
          g.restore();
          break;
        }
        case 'speedline': {
          g.save(); g.globalAlpha = Math.sin(u * Math.PI) * 0.5;
          g.strokeStyle = '#dff4ff'; g.lineWidth = 1;
          for (let i = 0; i < 14; i++) {
            const a = rnd(f.t * 13 + i) * Math.PI * 2, r0 = 40 + rnd(i * 7) * 60;
            g.beginPath();
            g.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
            g.lineTo(f.x + Math.cos(a) * (r0 + 26), f.y + Math.sin(a) * (r0 + 26));
            g.stroke();
          }
          g.restore();
          break;
        }
      }
    }
  };

  Renderer.prototype.drawScreenFx = function (g, t, cam) {
    for (const f of this.sc.fx) {
      if (t < f.t || t > f.t + f.dur) continue;
      const u = (t - f.t) / f.dur;
      if (f.type === 'slowmo' && this.opts.grade) {
        g.save();
        g.globalCompositeOperation = 'saturation';
        g.globalAlpha = 0.75; g.fillStyle = '#808080'; g.fillRect(0, 0, VW, VH);
        g.restore();
        g.save();
        g.globalAlpha = 0.07; g.fillStyle = '#9fd8ff'; g.fillRect(0, 0, VW, VH);
        const grd = g.createRadialGradient(VW / 2, VH / 2, 50, VW / 2, VH / 2, 290);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.72)');
        g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
        g.restore();
      }
      if (f.type === 'flash') {
        const a = (f.peak || 1) * Math.pow(1 - u, f.falloff || 2);
        g.save(); g.globalAlpha = a; g.fillStyle = f.color || '#ffffff';
        g.fillRect(0, 0, VW, VH); g.restore();
      }
      if (f.type === 'fade') {
        const a = f.dir === 'in' ? 1 - u : u;                // in = 검은 화면에서 밝아짐
        g.save(); g.globalAlpha = a; g.fillStyle = f.color || '#000';
        g.fillRect(0, 0, VW, VH); g.restore();
      }
      if (f.type === 'black') {
        g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH); g.restore();
      }
      if (f.type === 'whitehold') {
        g.save(); g.fillStyle = '#fff'; g.fillRect(0, 0, VW, VH); g.restore();
      }
    }
  };

  /* 컬러TV 고장식 화면 노이즈. amount 0~1.
     RGB 채널 분리 + 수평 티어링 + 색 막대 + 스펙클 + 스캔라인 + 동기 롤링 밴드.
     모든 랜덤은 시간으로 시드를 만들어 스크럽해도 항상 같은 그림이 나온다. */
  Renderer.prototype.tvNoise = function (g, t, amount) {
    const W = VW, H = VH;
    if (!this._na) {
      this._na = document.createElement('canvas'); this._na.width = W; this._na.height = H;
      this._nb = document.createElement('canvas'); this._nb.width = W; this._nb.height = H;
    }
    const a = this._na.getContext('2d'), b = this._nb.getContext('2d');
    a.globalCompositeOperation = 'source-over';
    a.drawImage(this.cv, 0, 0);                                  // 현재 프레임 스냅샷
    const k = Math.floor(t * 20);
    const R = s2 => rnd(k * 13.7 + s2 * 3.1);

    // 수직 홀드 흔들림 + RGB 분리 폭
    const dy = R(1) < 0.14 * amount ? Math.round((R(2) - 0.5) * 12 * amount) : 0;
    const dx = Math.max(1, Math.round((1 + 4 * amount) * (R(3) < 0.85 ? 1 : 1.8)));

    // 시안(G+B) 사본을 본판으로 깔고, 빨강(R) 사본을 가산 합성으로 어긋나게 얹는다
    b.globalCompositeOperation = 'source-over'; b.drawImage(this._na, 0, 0);
    b.globalCompositeOperation = 'multiply'; b.fillStyle = '#00ffff'; b.fillRect(0, 0, W, H);
    g.drawImage(this._nb, -dx, dy);
    b.globalCompositeOperation = 'source-over'; b.drawImage(this._na, 0, 0);
    b.globalCompositeOperation = 'multiply'; b.fillStyle = '#ff0000'; b.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(this._nb, dx, dy); g.restore();

    // 수평 티어링 — 띠 단위로 프레임이 옆으로 찢어진다
    const bands = Math.round(amount * 6 * (0.4 + R(4)));
    for (let i = 0; i < bands; i++) {
      const y = Math.floor(R(10 + i) * H);
      const h = 2 + Math.floor(R(20 + i) * 16 * amount);
      const ox = Math.round((R(30 + i) - 0.5) * 70 * amount);
      g.drawImage(this._na, 0, y, W, h, ox, y, W, h);
    }

    // 색 막대 — 마젠타/시안/그린 블록이 잠깐씩 떠오른다
    g.save(); g.globalCompositeOperation = 'screen';
    const blocks = Math.round(amount * 5 * R(5));
    for (let i = 0; i < blocks; i++) {
      g.globalAlpha = 0.10 + 0.30 * amount * R(40 + i);
      g.fillStyle = ['#f0f', '#0ff', '#0f4', '#fe0'][Math.floor(R(50 + i) * 4)];
      g.fillRect(Math.floor(R(60 + i) * W), Math.floor(R(70 + i) * H),
                 24 + R(80 + i) * 150, 2 + R(90 + i) * 12);
    }
    g.restore();

    // 스펙클 — 희고 검은 점 (기존 점 노이즈는 이 안에서 약하게만)
    g.save();
    const n = Math.floor(30 + 240 * amount);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = (0.12 + 0.30 * amount) * R(200 + i);
      g.fillStyle = R(300 + i) < 0.55 ? '#fff' : '#000';
      g.fillRect(Math.floor(R(400 + i) * W), Math.floor(R(500 + i) * H),
                 1 + (R(600 + i) < 0.2 ? 2 : 0), 1);
    }
    g.restore();

    // 스캔라인
    g.save(); g.globalAlpha = 0.08 + 0.16 * amount; g.fillStyle = '#000';
    for (let y = k % 2; y < H; y += 2) g.fillRect(0, y, W, 1);
    g.restore();

    // 동기 롤링 밴드 — 위에서 아래로 흐르는 밝은 띠
    const ry = ((t * 110) % (H + 80)) - 40;
    const lg = g.createLinearGradient(0, ry, 0, ry + 46);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,' + (0.05 + 0.10 * amount) + ')');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, ry, W, 46);
  };

  /* CRT/디스플레이 꺼짐. u 0~0.5 화면이 세로로 짜부라지고, ~0.8 밝은 가로선이
     중앙으로 줄어들며, ~1.0 점이 사그라든다. 실제 프레임을 스냅샷해 찌그러뜨린다. */
  Renderer.prototype.crtOff = function (g, t, f) {
    const u = Math.max(0, Math.min(1, (t - f.t) / f.dur));
    const W = VW, H = VH;
    if (!this._ca) { this._ca = document.createElement('canvas'); this._ca.width = W; this._ca.height = H; }
    const a = this._ca.getContext('2d');
    if (u < 0.5) {
      a.drawImage(this.cv, 0, 0);
      const k = u / 0.5;
      const h = Math.max(3, H * Math.pow(1 - k, 2.2));
      const y = (H - h) / 2;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.drawImage(this._ca, 0, 0, W, H, 0, y, W, h);
      g.save(); g.globalCompositeOperation = 'lighter';          // 압축될수록 밝아진다
      g.globalAlpha = 0.25 * k; g.drawImage(this._ca, 0, 0, W, H, 0, y, W, h);
      g.globalAlpha = 0.5 * k; g.fillStyle = '#cfe8ee';
      g.fillRect(0, y - 1, W, 2); g.fillRect(0, y + h - 1, W, 2);
      g.restore();
    } else if (u < 0.8) {
      const k = (u - 0.5) / 0.3;
      const w = W * Math.pow(1 - k, 1.6);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.save(); g.globalCompositeOperation = 'lighter';
      const grd = g.createLinearGradient((W - w) / 2, 0, (W + w) / 2, 0);
      grd.addColorStop(0, 'rgba(180,230,240,0)');
      grd.addColorStop(0.5, 'rgba(235,255,255,' + (0.95 - 0.3 * k) + ')');
      grd.addColorStop(1, 'rgba(180,230,240,0)');
      g.fillStyle = grd;
      g.fillRect((W - w) / 2, H / 2 - 1.5, w, 3);
      g.fillStyle = 'rgba(200,240,248,' + (0.25 * (1 - k)) + ')';
      g.fillRect((W - w) / 2, H / 2 - 4, w, 8);
      g.restore();
    } else {
      const k = (u - 0.8) / 0.2;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const r2 = 3 * (1 - k);
      if (r2 > 0.2) {
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - k;
        g.fillStyle = '#eaffff';
        g.beginPath(); g.arc(W / 2, H / 2, r2, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  };

  Renderer.prototype.letterbox = function (g, t) {
    if (!this.opts.letterbox) return;
    const H = Math.round(VH * 0.12);
    let u = 1;
    const e = this.sc.fx.find(f => f.type === 'lbox');
    if (e) u = clamp((t - e.t) / e.dur, 0, 1);
    const h = Math.round(H * Ease.ec(u));
    g.fillStyle = '#000';
    g.fillRect(0, 0, VW, h);
    g.fillRect(0, VH - h, VW, h);
  };

  Renderer.prototype.render = function (t) {
    const g = this.g, sc = this.sc;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH);
    const cam = this.camera(t);
    const st = {};
    for (const k in sc.stageTracks) st[k] = evalNum(sc.stageTracks[k], t, 0);
    g.save();
    g.translate(Math.round(VW / 2 - cam.x * cam.z), Math.round(VH / 2 - cam.y * cam.z));
    g.scale(cam.z, cam.z);
    sc.stageAt(t).paint(g, t, st);
    this.drawActors(g, t);
    const foreground = sc.stageAt(t).paintForeground;
    if (foreground) foreground(g, t, st);
    this.drawWorldFx(g, t);
    g.restore();
    this.drawScreenFx(g, t, cam);
    this.letterbox(g, t);
    let nz = 0;                                    // 겹치면 가장 센 것
    for (const f of sc.fx) {
      if (f.type !== 'tvnoise' || t < f.t || t > f.t + f.dur) continue;
      const atk = f.atk == null ? 0.06 : f.atk, rel = f.rel == null ? 0.12 : f.rel;
      let e = 1;
      if (t - f.t < atk) e = (t - f.t) / atk;
      const left = f.t + f.dur - t;
      if (left < rel) e = Math.min(e, left / rel);
      nz = Math.max(nz, (f.amount == null ? 0.5 : f.amount) * e);
    }
    if (nz > 0) this.tvNoise(g, t, nz);
    for (const f of sc.fx)
      if (f.type === 'crtoff' && t >= f.t && t <= f.t + f.dur + 0.001) this.crtOff(g, t, f);
    return cam;
  };

  return {
    VW: VW, VH: VH, Scene: Scene, Renderer: Renderer, ANIM: ANIM, initAnchors: initAnchors,
    Ease: Ease, evalNum: evalNum, evalStep: evalStep, rnd: rnd,
    typedCount: typedCount, parseTags: parseTags, charStyles: charStyles,
    setLineOverrides: setLineOverrides, setTypingScale: setTypingScale,
  };
})();
