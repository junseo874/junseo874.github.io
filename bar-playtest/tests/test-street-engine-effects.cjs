const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), window = {};
for (const f of ['data/presentation/street-effects.js', 'src/features/outside/effects/street-engine-effects.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), { window });
const D = window.LUNA_STREET_EFFECTS, fx = window.LunaStreetEngineEffects;
assert.equal(D.groups.length, 8); assert.equal(D.scans.length, 10); assert.equal(D.fan.steps, 73);
assert.deepEqual(Array.from(D.led.rect), [765, 121, 161, 26]); assert.equal(D.led.speed, 12);
for (const a of Object.values(D.assets)) { const bytes = fs.readFileSync(path.join(root, a.src)); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), a.sha256, a.src); }
for (const scan of D.scans) {
  assert(scan.x > 0 && scan.y > 0, 'sprite alignment, not raw pivot metadata');
  assert(scan.opacity <= .15); assert(Math.abs(scan.frequency) > 0);
}
for (const [id, w, h] of [['service-cluster', 254, 102], ['vertical-left', 15, 45], ['restaurant-cluster', 230, 185]]) {
  assert.equal(D.replacementSprites[id].w, w); assert.equal(D.replacementSprites[id].h, h);
}
assert(D.dim.runs[0].length && D.dim.runs[1].length && D.dim.runs[3].length, 'RGB channels survive zero-alpha mask decoding');
assert.equal(D.dim.runs[2].length, 0);
let moved = 0;
for (const center of D.fan.centers) for (let y = Math.floor(center[1] - 10); y < center[1] + 10; y++) for (let x = Math.floor(center[0] - 10); x < center[0] + 10; x++) {
  const r = (x + .5 - center[0]) ** 2 + (y + .5 - center[1]) ** 2, result = fx.fanSource(x, y, center, 1.7);
  if (r > D.fan.radius ** 2 || r <= D.fan.inner ** 2) assert.deepEqual(Array.from(result), [x, y], 'housing/hub stationary');
  else if (result[0] !== x || result[1] !== y) moved++;
}
assert(moved > 100);
const f = fx.createFlicker(12345), same = fx.createFlicker(12345), different = fx.createFlicker(6789), seen = new Set();
let simultaneous = false, randomDiff = false;
for (let t = 0; t < 180; t += 1 / 60) {
  const levels = f.levels(t); levels.forEach((n, i) => { if (!n) seen.add(i); });
  assert.deepEqual(levels, same.levels(t));
  assert(f.levels(t, true).every(n => n === 1));
  if (levels.filter(n => !n).length > 1) simultaneous = true;
  if (String(levels) !== String(different.levels(t))) randomDiff = true;
}
assert.equal(seen.size, 8); assert(simultaneous, 'independent outages, not round-robin'); assert(randomDiff);
const rewind = f.levels(30); assert.deepEqual(rewind, fx.createFlicker(12345).levels(30), 'snapshot/rewind stable');
for (const group of D.groups) {
  const mean = 60 / (D.flicker.burstsPerMinute * group.frequencyScale);
  assert(Math.abs(mean * (1 - D.flicker.intervalRandomness) - 8) < 1e-10, group.name + ' minimum wait');
  assert(Math.abs(mean * (1 + D.flicker.intervalRandomness) - 22) < 1e-10, group.name + ' maximum wait');
}
assert.deepEqual(JSON.parse(JSON.stringify(D.flicker)), {
  burstsPerMinute: 4, intervalRandomness: 7 / 15, longOffChance: .303, offBrightness: 0,
  flickersPerBurst: [1, 3], flickerOffSeconds: [.03, .14], flickerOnSeconds: [.03, .2], longOffSeconds: [.6, 3]
}, 'Only the wait configuration changes; burst and blackout settings stay intact');
// Isolate waiting from the burst itself to observe scheduler boundaries.
const saved = { ...D.flicker };
Object.assign(D.flicker, { flickersPerBurst: [1, 1], flickerOffSeconds: [.1, .1], flickerOnSeconds: [0, 0], longOffChance: 0 });
const probe = fx.createFlicker(12345), previous = D.groups.map(() => 1), end = D.groups.map(() => null), waits = D.groups.map(() => []);
for (let frame = 0; frame < 24000; frame++) {
  const time = frame / 100;
  probe.levels(time).forEach((level, i) => {
    if (level !== previous[i]) {
      if (level === 1) end[i] = time;
      else if (end[i] !== null) waits[i].push(time - end[i]);
      previous[i] = level;
    }
  });
}
Object.assign(D.flicker, saved);
waits.forEach((values, i) => {
  assert(values.length >= 8, D.groups[i].name + ' repeated scheduling');
  assert(values.every(t => t >= 7.99 && t <= 22.01), D.groups[i].name + ' waits stay within 8–22 seconds');
  assert(Math.max(...values) - Math.min(...values) > 3, 'waiting stays random');
});
console.log('FLICKER_WAIT_OK: all eight groups independently wait 8–22 seconds after each burst.');
console.log('STREET_ENGINE_EFFECTS_OK: source-byte hashes, 10 CRT regions, 8 random groups, 2 masked fans, replay/reduced motion.');
