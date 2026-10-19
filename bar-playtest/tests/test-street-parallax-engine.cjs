const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../src/features/outside/outside-parallax.js');
const P = globalThis.LunaStreetParallax, context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../data/runtime/outside-scene-data.js'), 'utf8'), context);
const nodes = context.window.LUNA_OUTSIDE_DATA.scenes.street.nodes;
const node = name => nodes.find(n => n.name === name);
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
assert.deepEqual(P.layers, { C_Middle_Building_1: .2, C_Middle_Building_2: .5, C_Middle_Building_3: .05 });

// When the read-only engine checkout is available, verify against its actual YAML,
// not just web constants. The tests below also run without that external checkout.
const scenePath = path.resolve(__dirname, '../../../Human-Bartender/HumanBartender/Assets/01.Game/01.Scenes/OutSide.unity');
if (fs.existsSync(scenePath)) {
  const scene = fs.readFileSync(scenePath, 'utf8');
  const blocks = new Map([...scene.matchAll(/^--- !u!\d+ &(\d+)\r?\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
  const component = blocks.get('828715987');
  assert.match(component, /guid: 9e26fca1398d4f9ea7a5b071fd858b37/);
  assert.match(component, /movementTarget: \{fileID: 398070675\}/);
  assert.match(component, /moveY: 0\s+teleportDistance: 1/);
  assert.match(scene, /m_AssetsPPU: 100/);
  const ratios = {};
  for (const [, id, ratio] of component.matchAll(/target: \{fileID: (\d+)\}\s+followRatio: ([\d.]+)/g)) {
    if (id === '0') continue;
    const go = blocks.get(id).match(/m_GameObject: \{fileID: (\d+)\}/)[1];
    ratios[blocks.get(go).match(/m_Name: (.*)/)[1]] = Number(ratio);
  }
  assert.deepEqual(ratios, P.layers);
  for (const [name, id] of [['C_Middle_Object_1', '86088167'], ['C_Middle_Object_2', '1135728411']]) {
    const block = blocks.get(id), child = P.children[name];
    assert.match(block, /m_Father: \{fileID: 692369227\}/);
    const [, x, y] = block.match(/m_LocalPosition: \{x: ([\d.-]+), y: ([\d.-]+)/);
    assert.deepEqual([+x, +y], [child.x, child.y]);
  }
  console.log('PASS live engine YAML: Luna target, 3 ratios, 100 PPU, horizontal-only, teleport threshold, child hierarchy/positions');
}

for (const fps of [30, 60, 120]) {
  const renderer = P.create(nodes), model = { scene: 'street', x: -16, y: 9 };
  renderer.update(model);
  const before = JSON.stringify(nodes);
  for (let frame = 1; frame <= fps * 4; frame++) { model.x = -16 + frame / fps; renderer.update(model); }
  for (const [name, ratio] of Object.entries(P.layers)) {
    near(renderer.position(node(name)).x, node(name).x + 4 * ratio);
    assert.equal(renderer.position(node(name)).y, node(name).y);
  }
  for (const name of Object.keys(P.children)) {
    const child = P.children[name], parent = renderer.position(node(child.parent)), p = renderer.position(node(name));
    near(p.x - parent.x, child.x); near(p.y - parent.y, child.y);
  }
  for (const n of nodes.filter(n => !(n.name in P.layers) && !(n.name in P.children))) {
    assert.deepEqual(renderer.position(n), { x: n.x, y: n.y }, n.name + ' stays world-fixed');
  }
  const current = renderer.position(node('C_Middle_Building_2'));
  model.y += 12; renderer.update(model);
  assert.deepEqual(renderer.position(node('C_Middle_Building_2')), current, 'lift does not move background vertically');
  model.x += 3; renderer.update(model);
  assert.deepEqual(renderer.position(node('C_Middle_Building_2')), current, 'large teleport keeps accumulated background');
  renderer.notifyTeleport(); model.x += .7; renderer.update(model);
  assert.deepEqual(renderer.position(node('C_Middle_Building_2')), current, 'explicit short teleport is also excluded');
  model.scene = 'home'; renderer.update(model); model.x = 1; model.scene = 'street'; renderer.update(model);
  assert.deepEqual(renderer.position(node('C_Middle_Building_2')), current, 're-enable does not accumulate hidden movement');
  model.x += .2; renderer.update(model);
  near(renderer.position(node('C_Middle_Building_2')).x, current.x + .1);
  assert.equal(JSON.stringify(nodes), before, 'no mutation of shared sprite data');
}
const r = P.create(nodes), m = { scene: 'street', x: 0 };
for (const state of [{ barArrival: { to: 0 } }, { transition: { barArrival: true } }, { encounter: { stage: 'entering' } }]) {
  const renderer = P.create(nodes), actor = { scene: 'street', x: -4 };
  renderer.update(actor);
  actor.x += .4; renderer.update(actor);
  const before = nodes.map(n => renderer.position(n));
  Object.assign(actor, state);
  for (let i = 0; i < 180; i++) { actor.x += .008; renderer.update(actor); }
  assert.deepEqual(nodes.map(n => renderer.position(n)), before, 'cinematic preserves existing offsets and all children');
  delete actor[Object.keys(state)[0]];
  actor.x += .008; renderer.update(actor);
  assert.deepEqual(nodes.map(n => renderer.position(n)), before, 'final scripted step must not leak after cutscene clears');
  actor.x += .2; renderer.update(actor);
  near(renderer.position(node('C_Middle_Building_2')).x, before[nodes.indexOf(node('C_Middle_Building_2'))].x + .1);
}
console.log('PASS cinematic lock: arrival, transition, encounters, release frame, resume without catch-up');
r.update(m);
for (let i = 1; i <= 1000; i++) { m.x = i / 1000; r.update(m); }
near(r.position(node('C_Middle_Building_3')).x, node('C_Middle_Building_3').x + .05);
for (let i = 999; i >= 0; i--) { m.x = i / 1000; r.update(m); }
near(r.position(node('C_Middle_Building_3')).x, node('C_Middle_Building_3').x);
m.story = {}; P.update(m, nodes); m.x = 1; P.update(m, nodes);
near(P.position(node('C_Middle_Building_2'), m).x, node('C_Middle_Building_2').x + .5);
m.story = {}; P.update(m, nodes);
near(P.position(node('C_Middle_Building_2'), m).x, node('C_Middle_Building_2').x);
m.qa = {}; P.update(m, nodes);
assert.deepEqual(P.position(node('C_Middle_Object_1'), m), { x: node('C_Middle_Object_1').x, y: node('C_Middle_Object_1').y });
console.log('ENGINE_PARALLAX_OK: 30/60/120fps, subpixel accumulation/reversal, parent transforms, fixed layers, vertical lift, teleport/re-enable/run reset and QA isolation');

// A reversing player must not yank the scenery against the still-easing view.
for (const fps of [30,60,120]) {
 const renderer=P.create(nodes), actor={scene:'street',x:0}, camera={x:0,locked:false};
 renderer.update(actor,camera);
 let last=renderer.position(node('C_Middle_Building_2')).x, previousCamera=0;
 for(let frame=0;frame<fps*4;frame++){
  actor.x += (Math.floor(frame/(fps*.4))%2 ? -1 : 1)*1.5/fps;
  camera.x += (actor.x-camera.x)*(1-Math.exp(-5/fps));
  renderer.update(actor,camera);
  const next=renderer.position(node('C_Middle_Building_2')).x;
  near(next-last,(camera.x-previousCamera)*.5);
  assert(Math.abs(next-last)<.026,'No coarse source-pixel jump');
  previousCamera=camera.x;last=next;
 }
 const before=last;
 actor.x+=.1;renderer.update(actor,camera);
 near(renderer.position(node('C_Middle_Building_2')).x,before);
}
console.log('PASS camera-synchronized reversals at 30/60/120fps and stationary-camera isolation');
