/* Canvas implementation of the authored Unity street shaders. Native pixels,
 * masks and timings come from the checked-in, narrowly imported snapshot. */
(function (W) {
'use strict';
const D = W.LUNA_STREET_EFFECTS;
const mod = (x, n) => ((x % n) + n) % n;
function createFlicker(seed = Math.floor(Math.random() * 0xffffffff)) {
  const cfg = D.flicker;
  const tracks = D.groups.map((g, index) => {
    let state = (seed + (index + 1) * 2654435761) >>> 0;
    const random = () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
    const range = ([a, b]) => Math.min(a, b) + random() * Math.abs(b - a);
    const stable = () => cfg.burstsPerMinute * g.frequencyScale <= .0001 ? Infinity : Math.max(.05, 60 / (cfg.burstsPerMinute * g.frequencyScale) * range([1 - cfg.intervalRandomness, 1 + cfg.intervalRandomness]));
    return { events: [{ time: 0, on: true }], next: random() * stable(), random, range, stable };
  });
  function levels(time, still = false) {
    if (still) return D.groups.map(() => 1);
    const t = Math.max(0, time);
    return tracks.map(track => {
      while (track.next <= t) {
        let at = track.next;
        const count = Math.max(1, cfg.flickersPerBurst[0]) + Math.floor(track.random() * (Math.max(...cfg.flickersPerBurst) - Math.max(1, cfg.flickersPerBurst[0]) + 1));
        for (let i = 0; i < count; i++) {
          track.events.push({ time: at, on: false }); at += track.range(cfg.flickerOffSeconds);
          track.events.push({ time: at, on: true }); at += track.range(cfg.flickerOnSeconds);
        }
        if (track.random() < cfg.longOffChance) {
          track.events.push({ time: at, on: false }); at += track.range(cfg.longOffSeconds);
          track.events.push({ time: at, on: true });
        }
        track.next = at + track.stable();
      }
      let lo = 0, hi = track.events.length;
      while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (track.events[mid].time <= t) lo = mid; else hi = mid; }
      return track.events[lo].on ? 1 : cfg.offBrightness;
    });
  }
  return { levels };
}
const flicker = createFlicker();
let lastTime, lastStill, lastLevels;
function levels(time, still) {
  if (time !== lastTime || still !== lastStill || !lastLevels) { lastTime = time; lastStill = still; lastLevels = flicker.levels(time, still); }
  return lastLevels;
}
function lightLevel(id, time, still) {
  const on = levels(time, still);
  return D.groups.reduce((gain, g, i) => gain * (g.lights.includes(id) ? on[i] : g.spillLights.includes(id) ? 1 - g.spillAmount * (1 - on[i]) : 1), 1);
}
function apply(data) {
  if (data.engineStreetEffectsVersion === 1) return;
  Object.assign(data.assets, D.assets);
  const nodes = data.scenes.street.nodes, parent = nodes.find(n => n.name === 'B_Fore_Building_1');
  if (!parent) return;
  for (const [id, sprite] of Object.entries(D.replacementSprites)) {
    const node = nodes.find(n => n.id === 'street-neon-' + id);
    if (node) node.sprite = sprite;
  }
  // This lamp was already present; use its exact light ID, never a second copy.
  const strip = nodes.find(n => n.id === 'street-neon-service-strip');
  if (strip) strip.engineLightId = '881909181';
  for (const light of D.lights.filter(l => l.id !== '881909181')) nodes.push({
    id: 'engine-neon-' + light.id, go: 'engine-neon-' + light.id, name: 'Engine neon · ' + light.id,
    x: parent.x + light.x - D.parent.x, y: parent.y + light.y - D.parent.y,
    sx: Math.hypot(light.a, light.b), sy: Math.hypot(light.c, light.d), active: true,
    ancestry: ['StreetSigns'], layer: parent.layer, order: parent.order + 1, light: true, neon: true,
    alpha: Math.min(.85, .35 + light.intensity * .35), engineLightId: light.id, sprite: light.sprite
  });
  data.engineStreetEffectsVersion = 1;
}
const rawCache = new WeakMap(), patchCache = new WeakMap();
function pixels(image) {
  let p = rawCache.get(image);
  if (!p) { const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    p = ctx.getImageData(0, 0, c.width, c.height); rawCache.set(image, p); }
  return p;
}
function patch(image, key, x, y, w, h, stamp, sample) {
  let entries = patchCache.get(image); if (!entries) { entries = new Map(); patchCache.set(image, entries); }
  let p = entries.get(key);
  if (!p) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; p = { canvas, x, y, stamp: null }; entries.set(key, p); }
  if (p.stamp !== stamp) {
    const ctx = p.canvas.getContext('2d'), out = ctx.createImageData(w, h), raw = pixels(image);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) sample(raw, out.data, (py * w + px) * 4, x + px, y + py);
    ctx.putImageData(out, 0, 0); p.stamp = stamp;
  }
  return p;
}
function copy(raw, out, i, x, y) { const s = (y * raw.width + x) * 4; for (let c = 0; c < 4; c++) out[i + c] = raw.data[s + c]; }
function fanSource(x, y, center, time) {
  const f = D.fan, dx = x + .5 - center[0], dy = y + .5 - center[1], r = dx * dx + dy * dy;
  if (r > f.radius ** 2 || r <= f.inner ** 2) return [x, y];
  const a = -Math.floor(time * f.speed * f.steps) / f.steps * 2 * Math.PI;
  const sx = Math.floor(center[0] + Math.cos(a) * dx - Math.sin(a) * dy), sy = Math.floor(center[1] + Math.sin(a) * dx + Math.cos(a) * dy);
  const sr = (sx + .5 - center[0]) ** 2 + (sy + .5 - center[1]) ** 2;
  return sr > f.radius ** 2 || sr <= f.inner ** 2 ? [x, y] : [sx, sy];
}
const linear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const srgb = v => 255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - .055);
const spillCache = new WeakMap();
function spillFrames(image) {
  if (spillCache.has(image)) return spillCache.get(image);
  const raw = pixels(image), sp = D.parentSprite, left = D.parent.x - sp.w * sp.pivot.x / sp.ppu, top = D.parent.y + sp.h * (1 - sp.pivot.y) / sp.ppu;
  const frames = D.spills.map(light => {
    const points = light.points.map(([x, y]) => [(x - left) * sp.ppu, (top - y) * sp.ppu]), falloff = light.falloff * sp.ppu;
    const x = Math.max(0, Math.floor(Math.min(...points.map(p => p[0])) - falloff)), y = Math.max(0, Math.floor(Math.min(...points.map(p => p[1])) - falloff));
    const w = Math.min(raw.width, Math.ceil(Math.max(...points.map(p => p[0])) + falloff)) - x, h = Math.min(raw.height, Math.ceil(Math.max(...points.map(p => p[1])) + falloff)) - y;
    if (w <= 0 || h <= 0) return null;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'), out = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const xx = x + px + .5, yy = y + py + .5, ri = ((y + py) * raw.width + x + px) * 4;
      if (!raw.data[ri + 3]) continue; // Light stays on the building, behind wires/actors.
      let inside = false, distance = Infinity;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j], b = points[i];
        if ((a[1] > yy) !== (b[1] > yy) && xx < (b[0] - a[0]) * (yy - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
        const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((xx - a[0]) * dx + (yy - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        distance = Math.min(distance, Math.hypot(xx - a[0] - t * dx, yy - a[1] - t * dy));
      }
      const coverage = inside ? 1 : Math.max(0, 1 - distance / Math.max(1, falloff));
      const i = (py * w + px) * 4;
      for (let c = 0; c < 3; c++) out.data[i + c] = srgb(light.color[c]);
      out.data[i + 3] = raw.data[ri + 3] * coverage * coverage * (1 - Math.exp(-light.intensity * .045));
    }
    ctx.putImageData(out, 0, 0); return { id: light.id, canvas, x, y };
  }).filter(Boolean);
  spillCache.set(image, frames); return frames;
}
function paintSprite(ctx, name, image, images, sp, width, height, time, still) {
  if (name !== 'B_Fore_Building_1') return;
  const t = still ? 0 : time, led = D.led, maskImage = images.get(led.mask.asset), glowImage = images.get(led.glow.asset);
  ctx.save(); ctx.translate(-width * sp.pivot.x, -height * (1 - sp.pivot.y)); ctx.scale(width / sp.w, height / sp.h); ctx.imageSmoothingEnabled = false;
  if (maskImage && glowImage) {
    const mask = pixels(maskImage), glow = pixels(glowImage), [x, y, w, h] = led.rect;
    const shift = Math.floor((t * led.speed + led.offset) / led.step) * led.step;
    const p = patch(image, 'led', x, y, w, h, shift, (raw, out, i, px, py) => {
      const mx = px - x, my = py - y, selected = mask.data[(my * w + mx) * 4] > 127;
      if (!selected) { copy(raw, out, i, px, py); return; }
      const sx = mod(mx + shift, w), valid = mask.data[(my * w + sx) * 4] > 127;
      copy(raw, out, i, valid ? x + sx : led.blank[0], valid ? py : led.blank[1]);
      if (valid) {
        const gi = ((py + led.glowOffset[1]) * glow.width + x + sx + led.glowOffset[0]) * 4;
        for (let c = 0; c < 3; c++) { const base = linear(out[i + c] / 255), light = linear(glow.data[gi + c] / 255) * led.glowColor[c] * led.strength;
          out[i + c] = Math.min(255, Math.round(srgb(base + base * light + light * glow.data[gi + 3] / 255 * led.volume * out[i + 3] / 255))); }
      }
    });
    ctx.drawImage(p.canvas, p.x - sp.x, p.y - sp.y);
  }
  D.fan.centers.forEach((center, index) => {
    const r = D.fan.radius, x = Math.floor(center[0] - r), y = Math.floor(center[1] - r), w = Math.ceil(center[0] + r) - x, h = Math.ceil(center[1] + r) - y;
    const p = patch(image, 'fan-' + index, x, y, w, h, Math.floor(t * D.fan.speed * D.fan.steps), (raw, out, i, px, py) => copy(raw, out, i, ...fanSource(px, py, center, t)));
    ctx.drawImage(p.canvas, p.x - sp.x, p.y - sp.y);
  });
  // Exact independent RGBA mask channels, including the gold bevel/outline.
  const on = levels(time, still);
  D.groups.forEach((g, i) => { if (g.channel < 0 || on[i] === 1) return;
    // Cache the full authored channel, preserving color in linear light rather
    // than darkening an arbitrary rectangle or losing the letter's outline.
    const p = patch(image, 'dim-' + g.channel, 0, 0, sp.w, sp.h, on[i], () => {});
    if (p.level !== on[i]) {
      const c = p.canvas.getContext('2d'), out = c.createImageData(sp.w, sp.h), raw = pixels(image);
      for (const [x, y, w, alpha] of D.dim.runs[g.channel]) for (let px = x; px < x + w; px++) {
        const at = (y * sp.w + px) * 4, gain = 1 - (1 - D.dim.floor) * (1 - on[i]) * alpha;
        for (let ch = 0; ch < 3; ch++) out.data[at + ch] = srgb(linear(raw.data[at + ch] / 255) * gain);
        out.data[at + 3] = raw.data[at + 3];
      }
      c.putImageData(out, 0, 0); p.level = on[i];
    }
    ctx.drawImage(p.canvas, -sp.x, -sp.y);
  });
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const inheritedAlpha = ctx.globalAlpha;
  for (const p of spillFrames(image)) { ctx.globalAlpha = inheritedAlpha * lightLevel(p.id, time, still); if (ctx.globalAlpha > 0) ctx.drawImage(p.canvas, p.x - sp.x, p.y - sp.y); }
  ctx.restore();
  ctx.restore();
}
W.LunaStreetEngineEffects = { data: D, apply, createFlicker, lightLevel, levels, fanSource, paintSprite };
if (W.LUNA_OUTSIDE_DATA) apply(W.LUNA_OUTSIDE_DATA);
})(window);
