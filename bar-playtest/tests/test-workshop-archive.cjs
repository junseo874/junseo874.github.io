const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const W = {addEventListener() {}};
const source = fs.readFileSync(path.join(root, 'src/features/campaign/campaign.js'), 'utf8');
vm.runInNewContext(source.replace('create: a => new Campaign(a)', 'prototype: Campaign.prototype'), {
  window: W, document: {addEventListener() {}}
});
const playSleepScenes = W.LunaCampaign.prototype.playSleepScenes;
const keys = ['night0', 'night1', null, 'ending'];
W.LunaTerrace = {nightKey: day => keys[day]};
for (const day of [0, 1, 2, 3]) for (const cat of [false, true]) for (const noTerrace of [false, true]) {
  const calls = [];
  let afterCat;
  W.LunaOutsideNeighborhood = {beforeRest(model, next) {
    if (cat) { calls.push('cat'); afterCat = next; }
    return cat;
  }};
  const c = {
    outside: {model: {}},
    data: {scenes: {workshop: [{}], ...Object.fromEntries(keys.filter(Boolean).map(k => [k, noTerrace ? [] : [{}]]))}},
    dayEndRequirements: () => [],
    scene(key, title, background, done) { assert.equal(background, 'terrace'); calls.push(key); done(); },
    playRestCinema(kind, done) { calls.push(kind); done(); },
    beginMemoryTransition() { assert.fail('Workshop must not be queued from rest'); }
  };
  playSleepScenes.call(c, day, () => calls.push('done'));
  if (cat) { assert.deepEqual(calls, ['cat']); afterCat(); }
  assert.deepEqual(calls, [...(cat ? ['cat'] : []), keys[day] && !noTerrace ? keys[day] : 'sleep', 'done']);
}
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/runtime/campaign-data.js'), 'utf8'), {window: W});
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/features/campaign/cutscene-library.js'), 'utf8'), {window: W});
assert.equal(W.LUNA_CAMPAIGN_DATA.scenes.workshop.length, 12);
const entry = W.LunaCutsceneLibrary.catalog.find(c => c.id === 'A-workshop');
assert.equal(entry.background, 'black');
assert.match(entry.description, /본편 미사용/);
console.log('WORKSHOP_ARCHIVE_OK: all day/rest/cat/fallback routes skip workshop; original 12 lines and gallery retained');
