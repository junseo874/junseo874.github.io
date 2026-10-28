const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const C = require(root + '/src/core/core.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(root + '/data/runtime/game-data.js', 'utf8'), ctx);
function setup() {
  const g = new C.Game(ctx.window.LUNA_DATA);
  g.reset(99, 'general', 42, true);
  g.queue = [{ personality: 'gentle', order: 'gin_tonic', max_rounds: 1 }];
  g.queueIndex = 0;
  g.spawn();
  g.qaKeepGeneral = true;
  g.dialogSpeed = 1;
  return g;
}
function ticks(g, seconds, options) {
  for (let i = 0; i < seconds * 10; i++) g.tick(.1, options);
  assert.equal(g.error, null);
}
function away(g, guest) { g.focus = guest.seat === 'L' ? 'R' : 'L'; }
function order(g) {
  const guest = g.seats[g.focus];
  assert(g.coaster(guest.seat, 'drag'));
  away(g, guest);
  ticks(g, 20);
  assert.equal(guest.state, 'WAIT_SERVE', 'unwatched order must finish');
  return guest;
}
function serve(g, guest, selected = 'gin_tonic') {
  g.focus = guest.seat;
  g.cameraLeft = 0;
  g.cameraMoving = false;
  g.drink = { id: 'drink_' + guest.round, selected, missingCore: [], grade: 'excellent', score: 100 };
  assert(g.serve(guest.seat, 'drag'));
  away(g, guest);
}
for (const selected of ['gin_tonic', 'gin_fizz']) {
  const g = setup(), guest = order(g), before = g.progress.money;
  assert.equal(g.history.length, 0, 'unwatched lines are not reading history');
  serve(g, guest, selected);
  // Camera motion / coaster dragging hide speech, not guest lifecycle.
  g.cameraMoving = true;
  ticks(g, 35, { holdSpeech: true });
  assert.equal(g.seats[guest.seat], null, 'unwatched reaction must settle and leave');
  assert.equal(g.transactions.length, 1);
  const net = g.transactions[0].net;
  assert(selected === 'gin_tonic' ? net > 0 : net < 0, 'income / refund follows served drink');
  assert.equal(g.progress.money, before + net);
  ticks(g, 30);
  assert.equal(g.transactions.length, 1, 'no double settlement');
  assert.equal(g.progress.money, before + net);
}
{
  const g = setup(), guest = order(g);
  guest.maxRounds = 2;
  serve(g, guest);
  ticks(g, 30);
  assert.equal(g.transactions.length, 1);
  assert.equal(guest.round, 2);
  assert.equal(guest.state, 'WAIT_SERVE', 'reorder must not require watching');
  serve(g, guest);
  ticks(g, 30);
  assert.equal(g.transactions.length, 2);
  assert.equal(g.seats[guest.seat], null);
}
{
  const g = setup(), first = order(g);
  g.queue.push({ personality: 'gentle', order: 'gin_tonic', max_rounds: 1 });
  g.spawn();
  const second = Object.values(g.seats).find(guest => guest && guest !== first);
  g.focus = second.seat;
  assert(g.coaster(second.seat, 'drag'));
  ticks(g, 20);
  assert.equal(second.state, 'WAIT_SERVE');
  serve(g, first);
  serve(g, second, 'gin_fizz');
  g.focus = Object.keys(g.seats).find(seat => !g.seats[seat]);
  ticks(g, 30);
  assert.equal(g.transactions.length, 2, 'both hidden seats settle independently');
  assert.equal(g.seats[first.seat], null);
  assert.equal(g.seats[second.seat], null);
}
{
  const g = setup(), guest = order(g);
  serve(g, guest);
  g.focus = guest.seat;
  for (let i = 0; i < 300; i++) {
    g.afterCamera();
    g.tick(.1);
  }
  assert.equal(g.transactions.length, 1, 'returning camera cannot restart reaction hold');
  assert.equal(g.seats[guest.seat], null);
}
{
  const g = setup(), guest = order(g);
  serve(g, guest);
  for (const [key, value] of [['paused', true], ['hidden', true], ['overlay', 'history'], ['screen', 'prep']]) {
    const old = g[key], before = JSON.stringify(guest), money = g.progress.money;
    g[key] = value;
    ticks(g, 20);
    assert.equal(JSON.stringify(guest), before, key + ' still pauses guests');
    assert.equal(g.progress.money, money);
    g[key] = old;
  }
  ticks(g, 30);
  assert.equal(g.transactions.length, 1);
}
{
  const g = setup(), guest = g.seats[g.focus];
  away(g, guest);
  ticks(g, guest.left + 5);
  assert.equal(g.seats[guest.seat], null);
  assert.equal(g.transactions.length, 0, 'unserved timeout does not invent payment');
}
{
  const g = setup(), guest = g.seats[g.focus];
  g.setBarks(guest, ['call']);
  ticks(g, .2);
  const line = guest.lines[0], visible = line.chars;
  assert(visible > 0 && visible < line.text.length);
  away(g, guest);
  ticks(g, 8);
  assert.equal(g.history[0].text, line.text.slice(0, visible), 'history retains only viewed prefix');
}
console.log('GENERAL_OFFSCREEN_OK: orders, income/refund once, departure, reorder, timeout, pauses, visible-only history');
