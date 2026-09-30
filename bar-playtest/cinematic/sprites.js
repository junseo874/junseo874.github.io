/* 스프라이트 시트 관리 — assets.js(window.SHEETS)에 박아 넣은 base64 시트를 읽는다.
   앵커: 시트별로 "셀 안 컨텐츠의 가로 중앙 / 아래끝"의 중앙값을 발 위치로 삼는다.
   중앙값을 쓰면 총구 화염처럼 특정 프레임만 튀어나온 경우에도 캐릭터가 흔들리지 않고,
   프레임별 실제 움직임(도약 궤적 등)은 그대로 살아난다. */
window.Sprites = (function () {
  const sheets = {};
  const tintCache = {};

  function median(a) {
    const s = a.slice().sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  }

  function load(done) {
    const names = Object.keys(window.SHEETS);
    let left = names.length;
    names.forEach(function (n) {
      const d = window.SHEETS[n];
      const img = new Image();
      img.onload = function () { if (--left === 0) done(); };
      img.onerror = function () { console.error('시트 로드 실패', n); if (--left === 0) done(); };
      img.src = d.png;
      sheets[n] = {
        img: img,
        frames: d.frames,
        anchorX: median(d.frames.map(f => f.ox + f.sw / 2)),
        anchorY: median(d.frames.map(f => f.oy + f.sh)),
      };
    });
    if (!names.length) done();
  }

  function get(n) { return sheets[n]; }

  function tinted(name, i, color, amount) {
    const key = name + '|' + i + '|' + color + '|' + amount;
    if (tintCache[key]) return tintCache[key];
    const s = sheets[name], f = s.frames[i];
    const c = document.createElement('canvas');
    c.width = f.sw; c.height = f.sh;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(s.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = amount;
    g.fillStyle = color;
    g.fillRect(0, 0, f.sw, f.sh);
    tintCache[key] = c;
    return c;
  }

  /* 애니메이션 단위 앵커.
     mode 'sheet' = 시트 전체 중앙값(기본, 총구 화염 같은 튀는 프레임에 흔들리지 않음)
          'anim'  = 해당 클립 프레임들의 중앙값(다른 셀 크기의 시트로 갈아탈 때 정렬용)
          'frame' = 프레임마다 자기 컨텐츠 아래끝·가로중앙(도약/낙하처럼 y를 트랙으로 직접 몰 때) */
  function animAnchor(name, from, to, mode) {
    const s = sheets[name];
    if (!s || mode === 'frame') return null;
    if (mode !== 'anim') return { ax: s.anchorX, ay: s.anchorY };
    const fr = s.frames.slice(from, to + 1);
    return { ax: median(fr.map(f => f.ox + f.sw / 2)), ay: median(fr.map(f => f.oy + f.sh)) };
  }

  /* x,y = 발 기준점(월드 좌표). opt: flip, scale, alpha, tint, tintAmount, dx, dy, ax, ay */
  function draw(ctx, name, i, x, y, opt) {
    const s = sheets[name];
    if (!s) return;
    opt = opt || {};
    const f = s.frames[Math.max(0, Math.min(s.frames.length - 1, i | 0))];
    if (!f) return;
    const sc = opt.scale || 1;
    const ax = opt.ax == null ? (f.ox + f.sw / 2) : opt.ax;      // ax/ay 미지정 = 프레임 자체 기준
    const ay = opt.ay == null ? (f.oy + f.sh) : opt.ay;
    const dx = (f.ox - ax) * sc + (opt.dx || 0);
    const dy = (f.oy - ay) * sc + (opt.dy || 0);
    const w = Math.round(f.sw * sc), h = Math.round(f.sh * sc);
    ctx.save();
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (opt.flip) ctx.scale(-1, 1);
    if (opt.tint) {
      ctx.drawImage(tinted(name, i, opt.tint, opt.tintAmount == null ? 0.4 : opt.tintAmount),
        0, 0, f.sw, f.sh, Math.round(dx), Math.round(dy), w, h);
    } else {
      ctx.drawImage(s.img, f.sx, f.sy, f.sw, f.sh, Math.round(dx), Math.round(dy), w, h);
    }
    ctx.restore();
  }

  /* 시트 기준 컨텐츠 높이 — 말풍선 앵커 계산용 */
  function contentHeight(name) {
    const s = sheets[name];
    if (!s) return 40;
    return median(s.frames.map(f => f.sh));
  }

  return { load: load, get: get, draw: draw, contentHeight: contentHeight, animAnchor: animAnchor };
})();
