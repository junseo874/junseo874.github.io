const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = {};
W.window = W;
const root = path.resolve(__dirname, '..');
for (const file of ['data/runtime/outside-scene-data.js', 'src/features/outside/events/outside-ambient.js', 'src/features/outside/events/outside-residents.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), W);
}
const data = W.LUNA_OUTSIDE_DATA, ambient = W.LunaOutsideAmbient;
assert.equal(data.animations.idle.fps, 12);
assert.equal(data.animations.walk.fps, 12);
assert.equal(data.animations.run.fps, 12);
const nodes = data.scenes.street.nodes.filter(n => n.ambient);
const resident = data.scenes.street.nodes.find(n => n.resident);
const ctx = {save(){}, beginPath(){}, rect(){}, clip(){}, restore(){}};
// Six-cell silhouettes must complete one breath in the same time as Luna's
// nine-cell idle, not loop 1.5 times faster merely because FPS matches.
// Longer Shiba clips keep their existing rate rather than being sped up.
for (const fps of [12, 18]) {
  data.animations.idle.fps = fps;
  const npcFPS = fps * 6 / data.animations.idle.frames.length;
  const cycle = data.animations.idle.frames.length / fps;
  for (let step = 0; step < 120; step++) {
    const time = (step + .25) / npcFPS;
    assert.equal(ambient.frameIndex(time), step % 6);
    assert.equal(ambient.frameIndex(time, data.animations.shiba.frames.length), Math.floor(time*fps) % 10);
    for (const node of nodes) {
      const result = ambient.frame(node, time);
      assert.equal(result.x, ((step + node.ambient.phase) % 6) * 129);
      assert.equal(result.w, 129);
      assert.equal(result.h, 138);
      assert.equal(ambient.frame(node, time).x, result.x, 'same paused clock keeps same frame');
    }
    let drawn;
    W.LunaOutsideResidents.drawNode({time, scene:'street', config:{day:0, flow:'out'}}, resident, sp => {drawn = sp;}, ctx, () => ({y:0}));
    assert.equal(drawn.x, (step % 6) * 129);
  }
  for(let loop=0;loop<20;loop++){
    assert.equal(ambient.frameIndex((loop+.999)*cycle),5,'last NPC frame lasts to the end of Luna’s cycle');
    assert.equal(ambient.frameIndex((loop+1.001)*cycle),0,'NPC and Luna begin the next cycle together');
  }
}
data.animations.idle.fps=12;
assert.equal(ambient.frameIndex(.1),0,'NPC no longer advances at the old 12 FPS');
assert.equal(ambient.frameIndex(.126),1,'six-frame NPC advances at 8 FPS');
// Derive timing from source metadata, rather than hard-coding a slowdown.
data.animations.idle.frames.push(data.animations.idle.frames[0],data.animations.idle.frames[0],data.animations.idle.frames[0]);
assert.equal(ambient.frameIndex(.999),5);assert.equal(ambient.frameIndex(1.001),0);
assert.equal(data.animations.shiba.fps, 6, 'generated source metadata is not rewritten');
console.log('OUTSIDE_NPC_ANIMATION_OK: same Luna idle loop duration, 8 FPS silhouettes, no Shiba acceleration, sheet wrapping, phases, residents, paused clock, live metadata changes');
