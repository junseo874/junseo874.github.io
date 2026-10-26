const assert=require('node:assert/strict');global.window=global;
require('../data/presentation/character-shadows.js');require('../data/presentation/shadow-lighting.js');require('../src/features/outside/outside-residence.js');require('../src/features/outside/effects/character-shadows.js');
const S=LunaCharacterShadows,D=LUNA_CHARACTER_SHADOWS;
const m={scene:'street',x:-10.9,y:-.7,facing:-1,time:0,elevatorY:LunaResidence.layout.elevatorBottom};
const light={...D.lights.find(l=>l.id==='1054065828'),gain:1};
assert(S.direction({x:light.x-.5,y:-.974},light,.8)[0]<0);
assert(S.direction({x:light.x+.5,y:-.974},light,.8)[0]>0);
assert.equal(S.direction({x:light.x,y:-.974},light,.8)[0],0);
assert(Math.hypot(...S.direction({x:light.x+100,y:-.974},light,.8))*.8<=D.player.maxLength+1e-9);
assert.equal(S.influence(S.foot(m),{...light,active:false}),0);
assert.equal(S.influence(S.foot(m),{...light,layers:[]}),0);
assert.equal(S.influence(S.foot(m),{...light,gain:0}),0);
assert.equal(S.influence(S.foot(m),{...light,type:4}),0,'Global ambient light has no projected direction');
assert.equal(S.influence({x:100,y:100},light),0);
let s=S.advance(m);for(let i=0;i<60;i++){m.time+=1/60;s=S.advance(m);}
assert(s.slots.filter(d=>d.energy>0&&d.influence>.01).length>=2,'Nearby emitters coexist; no strongest-light selector');assert.equal(s.receiver.name,'1F');
const stable=JSON.stringify(s);S.advance(m);assert.equal(JSON.stringify(s),stable,'Paused draws must not advance energy');
const previous=s.slots.map(d=>d.id);m.x=-6.1;m.time+=1/60;s=S.advance(m);assert.deepEqual(s.slots.map(d=>d.id),previous,'World emitters retain stable identities while walking');
assert(s.slots.filter(d=>d.influence>.01).length>=2);
const volume={active:true,intensity:2,color:[1,1,1],gain:1,points:[[0,0],[1,0],[1,1],[0,1]],bounds:[-.5,-.5,1.5,1.5],falloff:.5};
assert.equal(S.coverage({x:.5,y:.5},volume),1);assert.equal(S.coverage({x:2,y:.5},volume),0);assert(S.coverage({x:-.25,y:.5},volume)>0);
assert(Math.abs(S.fillAt({x:.5,y:.5},[volume])-2)<1e-9);assert.equal(S.fillAt({x:.5,y:.5},[{...volume,gain:0}]),0,'A dark neon cannot wash out shadows');
assert.deepEqual(S.fillField({x:0,y:0},[volume]),S.fillField({x:0,y:0},[volume]),'World fill field is deterministic');
// Cached geometry must match direct polygon evaluation as lights dim, the
// player crosses cells, and the lift/light volumes move. Cache remains bounded.
const cache={};for(const x of [0,.01,.06,1,8,0])for(const gain of [1,.2,0]){
 const p={x,y:0},v={...volume,gain},field=S.fillField(p,[v],cache),again=S.fillField(p,[v],cache);
 assert.deepEqual(field,again);
 for(let row=0;row<field.height;row++)for(let col=0;col<field.width;col++){
  const expected=Math.round(Math.min(1,S.fillAt({x:field.area[0]+col*.05,y:field.area[1]+row*.05},[v])/16)*65535),i=(row*field.width+col)*4;
  assert.equal(field.data[i]*256+field.data[i+1],expected);
 }assert(cache.samples.size<=1);
}
m.x=-16;m.y=LunaResidence.layout.upperY;assert.equal(S.advance(m).receiver.name,'2F');
m.x=LunaResidence.layout.elevatorX;m.elevatorY=4;m.y=4+LunaResidence.layout.passengerOffset;const lift=S.advance(m).receiver;assert.equal(lift.name,'Floor');
const raisedLight=S.lights(m).find(l=>l.ancestry.includes('Elevator'));m.elevatorY+=1;m.y+=1;assert.equal(S.advance(m).receiver.surface-lift.surface,1);assert.equal(S.lights(m).find(l=>l.id===raisedLight.id).y-raisedLight.y,1);
m.x=100;assert.equal(S.advance(m).receiver,null);m.scene='home';assert.equal(S.advance(m).receiver,null);
m.scene='street';m.x=-10;m.y=-.7;m.time=0;assert(S.advance(m).slots.every(d=>d.energy===0),'Restart resets irradiance');
console.log('CHARACTER_SHADOWS_OK direction/length, disabled lights, simultaneous emitters, polygon fill, pause/reset, street/corridor/lift receivers');
