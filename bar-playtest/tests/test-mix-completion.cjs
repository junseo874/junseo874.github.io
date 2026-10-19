const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const C = require('../src/core/core.js');
const R = require('../src/features/bar/remix.js');
const M = require('../src/features/crafting/minigames.js');
const S = require('../src/features/crafting/shake-rhythm.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname, '../data/runtime/game-data.js'), 'utf8'), ctx);
const data = C.millilitreData(ctx.window.LUNA_DATA);
function step(g, seconds) { for (let t = 0; t < seconds - 1e-9; t += .01) g.tick(Math.min(.01, seconds - t)); }
function complete(g, success) {
  const s = g.gimmick;
  g.startGimmick();
  while (!s.completed) {
    if (s.type === 'stir') {
      if (success) for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) g.gimmickInput(key);
      else g.gimmickInput('KeyW');
    } else {
      s.pathPoint = success ? [0, 0] : [-100, -100];
      s.pathFixedHits = [];
      g.gimmickInput('Space');
    }
  }
}
let cases = 0;
for (const variant of ['original', 'gpt']) for (const kind of ['stir', 'shake']) for (const destination of ['next', 'serve', 'practice']) for (const success of [true, false]) {
  const g = new C.Game(data); R.attach(g); M.attach(g); S.attach(g);
  g.startMinigame(kind);
  if (destination !== 'practice') g.minigame = null;
  // startMinigame deliberately fixes original mode; enable the alternate wrapper
  // explicitly so this also catches double holds / finishing the next step.
  if (variant === 'gpt') {
    const craft = g.craft;
    g.reset(99, 'practice', 1, false, { variant });
    g.craft = craft; g.screen = 'gimmick';
    if (destination === 'practice') g.minigame = { kind };
    g.nextGimmick();
  }
  if (destination === 'next') g.craft.queue.push(M.example(g, 'pour').step);
  complete(g, success);
  const s = g.gimmick, elapsed = g.craft.elapsed, attempts = s.attempts, score = s.success;
  assert.equal(g.endGimmick(), false, 'manual next cannot bypass feedback');
  assert.equal(g.gimmickInput(kind === 'stir' ? 'KeyD' : 'Space'), false);
  step(g, .4); assert.equal(g.gimmick, s);
  const heldAge = s.completionAge;
  g.paused = true; step(g, 3); assert.equal(s.completionAge, heldAge);
  assert.equal(g.gimmick, s); g.paused = false;
  step(g, .49); assert.equal(g.gimmick, s, 'hold lasts at least .9 seconds');
  if (kind === 'stir') assert.equal(s.stirMotionPending, 0, 'final hand animation finishes during feedback');
  assert.equal(g.craft.elapsed, elapsed); assert.equal(s.attempts, attempts); assert.equal(s.success, score);
  step(g, .02);
  assert.equal(g.craft.results.length, 1);
  assert.equal(g.craft.results[0].endType, 'AutoTarget');
  assert.equal(g.craft.results[0].completion, success ? 1 : 0);
  assert.equal(g.craft.elapsed, elapsed);
  assert.equal(g.screen, destination === 'next' ? 'gimmick' : destination === 'serve' ? 'result' : 'minigame_result');
  if (destination === 'next') { assert.equal(g.gimmick.type, 'pour'); assert.equal(g.gimmick.started, false); }
  step(g, 1); assert.equal(g.craft.results.length, 1, 'one transition only');
  g.startMinigame(kind); assert.equal(g.gimmick.completionAge, 0, 'retry resets hold');
  cases++;
}
console.log('MIX_COMPLETION_OK:', cases, 'cases: both rules/kinds, next/serve/practice, good/miss, pause, score/time, input lock, retry');
