const assert=require('node:assert/strict');global.window=global;
require('../data/presentation/character-shadows.js');require('../data/presentation/shadow-lighting.js');require('../src/features/outside/outside-residence.js');require('../src/features/outside/effects/character-shadows.js');require('../src/features/outside/effects/character-lighting.js');
const L=LunaCharacterLighting,S=LunaCharacterShadows;
const model={scene:'street',x:-10.9,y:-.7,facing:-1,time:0,elevatorY:LunaResidence.layout.elevatorBottom};
const p=S.foot(model),light={...S.lights(model).find(l=>l.active&&l.layers.includes(LUNA_CHARACTER_SHADOWS.player.sortingLayer)),x:p.x,y:p.y+1,radius:5,priority:1,intensity:1,color:[1,1,1],gain:1};
const a={...light,id:'a'},b={...light,id:'b',intensity:1.1};
assert.equal(L.select(p,[a,b],'a').id,'a','15% hysteresis');
assert.equal(L.select(p,[a,{...b,intensity:1.2}],'a').id,'b');
assert.equal(L.select(p,[{...a,active:false}],'a'),null);
const original=S.lights;S.lights=()=>[a];
let s=L.advance(model,'player',p);assert.equal(s.weight,0);
for(let i=0;i<30;i++){model.time+=1/60;s=L.advance(model,'player',p);}
assert(s.weight>.9);const stable=JSON.stringify(s);L.advance(model,'player',p);assert.equal(JSON.stringify(s),stable,'same-frame / paused draws stable');
const lastPosition=[...s.position];S.lights=()=>[];model.time+=.1;s=L.advance(model,'player',p);assert(s.weight>0&&s.weight<1);assert.deepEqual(s.position,lastPosition,'fade keeps last direction');
for(let i=0;i<5;i++){model.time+=.1;s=L.advance(model,'player',p);}assert.equal(s.weight,0);
model.time=0;assert.equal(L.advance(model,'player',p).weight,0,'restart resets');S.lights=original;
console.log('CHARACTER_LIGHTING_OK: engine constants, selected light hysteresis, 0.3s fade, pause, reset, departed light direction');
