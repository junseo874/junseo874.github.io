const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../src/core/core.js');
// Exhaust common input blockers. This predicate must not pause/mutate simulation.
const keys=['paused','hidden','error','overlay','cameraMoving','cameraLeft','transition'];
for(let mask=0;mask<1<<keys.length;mask++)for(const screen of ['bar','prep']){
 const g=Object.create(C.Game.prototype);g.screen=screen;
 for(let i=0;i<keys.length;i++)g[keys[i]]=mask&(1<<i)?1:0;
 const before=JSON.stringify(g);
 assert.equal(!!g.barInteractionBlocked(),screen!=='bar'||mask!==0);
 assert.equal(JSON.stringify(g),before,'Input gate cannot advance/reset state');
}
const W={matchMedia:()=>({matches:false}),LunaOutsideRain:{wet:()=>true}};
const context={window:W};
function load(file){vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);}
load('data/presentation/bird-sprites.js');
load('src/features/outside/outside-corridor-birds.js');
assert.equal(W.LunaTerraceBirds,undefined,'Corridor must load without terrace scene');
const data={assets:{}};W.LunaCorridorBirds.apply(data);
assert.equal(data.assets['corridor-crow'].w,1548);
assert.equal(data.assets['corridor-pigeon'].h,138);
const b=W.LunaBirdSprites;
assert.equal(b.frameAt(0),0);assert.equal(b.frameAt(.5),3);
assert.equal(b.frameAt(2),0);assert.equal(b.frameAt(1,true),0);
load('src/features/campaign/terrace-birds.js');
assert.equal(W.LunaTerraceBirds.assets,b.assets,'Compatibility aliases share the same source');
assert.equal(W.LunaTerraceBirds.sheet,b.sheet);assert.equal(W.LunaTerraceBirds.crops,b.crops);
const d={rows:[],index:0,terraceTime:0};W.LunaTerraceBirds.begin(d,0);
assert.equal(W.LunaTerraceBirds.poses(d).length,3);
W.LunaTerraceBirds.begin(d,3);assert.equal(W.LunaTerraceBirds.poses(d).length,0);
console.log('SHARED_BIRDS_BAR_GATES_OK: 256 guard combinations, no mutation, corridor scene independence, shared metadata and frame clock');
