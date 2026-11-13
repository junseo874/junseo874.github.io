// Compare the optimized buckets against the original ordered spatial search.
// Keep the oracle independent of production indexing and retained storage.
const assert = require('node:assert/strict');
require('../src/features/outside/effects/rain-glass-simulation.js');
const {Simulation} = globalThis.LunaRainSimulation;
class Reference extends Simulation {
  merge() {
    const grid = new Map(), dead = new Set(), key = (x, y) => x + ',' + y;
    this.drops.forEach((d, i) => {
      const k = key(Math.floor(d.x / 8), Math.floor(d.y / 8));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(i);
    });
    for (let i = 0; i < this.drops.length; i++) {
      if (dead.has(i)) continue;
      let a = this.drops[i];
      const cx = Math.floor(a.x / 8), cy = Math.floor(a.y / 8);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        for (const j of grid.get(key(cx + ox, cy + oy)) || []) {
          if (j === i || dead.has(j)) continue;
          const b = this.drops[j], reach = (a.radius + b.radius) * .8;
          if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > reach * reach) continue;
          const aa = a.radius * a.radius, ab = b.radius * b.radius, total = aa + ab;
          const keepA = a.sliding === b.sliding ? aa >= ab : a.sliding;
          const keep = {...(keepA ? a : b)}, other = keepA ? b : a;
          const area = keep.radius * keep.radius, otherArea = other.radius * other.radius;
          keep.mx = other.x - keep.x; keep.my = other.y - keep.y;
          keep.mergeFraction = otherArea / total; keep.mergeRemaining = 1;
          keep.age = Math.max(keep.age, other.age);
          keep.x += (other.x - keep.x) * (otherArea / total * .5);
          keep.y += (other.y - keep.y) * (otherArea / total * .5);
          keep.vx = (keep.vx * area + other.vx * otherArea) / total;
          keep.vy = (keep.vy * area + other.vy * otherArea) / total;
          keep.radius = Math.sqrt(total); a = keep; dead.add(j);
        }
      }
      this.drops[i] = a;
    }
    this.drops = this.drops.filter((d, i) => !dead.has(i));
  }
}
for (const seed of [1, 20261019, 777]) {
  const reference = new Reference({}, seed), actual = new Simulation({}, seed);
  for (let i = 0; i < 2400; i++) {
    const dt = [1 / 60, 1 / 30, .075, 0][i % 4];
    const wind = {x: Math.sin(i / 17) * 100, y: Math.cos(i / 53) * 50};
    const rain = i % 600 < 450 ? 1 : 0;
    reference.step(dt, rain, wind, i % 180 < 90);
    actual.step(dt, rain, wind, i % 180 < 90);
    assert.deepEqual(actual.drops, reference.drops, `seed=${seed}, step=${i}`);
    assert.deepEqual(actual.upload(), reference.upload(), 'Shader data must stay identical');
    if (i % 800 === 400) { reference.resize(2); actual.resize(2); }
  }
  const grid = actual.mergeGrid, links = actual.mergeLinks;
  actual.merge();
  assert.equal(actual.mergeGrid, grid);
  assert.equal(actual.mergeLinks, links);
}
console.log('RAIN_MERGE_EQUIVALENCE_OK: 7,200 steps, three seeds, forces, pause, weather and resize');
