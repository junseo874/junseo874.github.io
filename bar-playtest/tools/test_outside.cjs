const assert=require('assert/strict'),path=require('path'),fs=require('fs');
const root=path.resolve(__dirname,'..');require(root+'/outside-residence.js');require(root+'/outside-dialogue-data.js');require(root+'/outside-story.js');require(root+'/outside.js');const {Model}=global.LunaOutside;
const step=(m,seconds,input)=>{for(let i=0;i<Math.ceil(seconds*60);i++)m.tick(1/60,input);};
for(const place of ['bar','homeDoor','home'])for(const flow of ['in','out'])for(const day of [0,1,2,3]){let m=new Model({place,flow,day});assert.equal(m.config.day,day);assert.equal(m.config.flow,flow);assert.equal(m.scene,place==='home'?'home':'street');assert.equal(m.level,place==='bar'?0:1);assert(m.near);assert.equal(m.anim,'idle');}
console.log('PASS all 24 start configurations');
for(const [place,lo,hi]of [['bar',-12.81,6.1],['homeDoor',-21.65,-12.28],['home',-1.5,3.4]]){const m=new Model({place});step(m,100,{move:-1,run:true});assert.equal(m.x,lo);assert.equal(m.anim,'idle');step(m,100,{move:1,run:true});assert.equal(m.x,hi);assert.equal(m.anim,'idle');}
console.log('PASS floor boundaries and no walking at blocked edges');
let m=new Model();step(m,1,{move:-1});assert(Math.abs(m.x-.3)<1e-6);assert.equal(m.anim,'walk');step(m,1,{move:1,run:true});assert(Math.abs(m.x-1.5)<1e-6);assert.equal(m.anim,'run');step(m,.1,{});assert.equal(m.anim,'idle');m.paused=true;let before=JSON.stringify(m);step(m,2,{move:1});assert.equal(JSON.stringify(m),before);m.paused=false;
console.log('PASS speed, direction, animation and pause');
m.x=-12.51;m.updateNear();assert.equal(m.near.id,'elevator');assert(m.interact());assert(!m.interact());step(m,5,{move:1,run:true});assert.equal(m.x,-12.51);assert(Math.abs(m.y-m.elevatorY-.382)<1e-9);m.paused=true;before=m.elevatorY;step(m,3);assert.equal(m.elevatorY,before);m.paused=false;step(m,9);assert(!m.ride);assert.equal(m.level,1);assert.equal(m.elevatorY,9.238);assert.equal(m.y,9.62);assert.equal(m.arrivals,1);
// Approach the actual house door, then enter and leave once.
m.x=-16.36;m.updateNear();assert.equal(m.near.id,'home');m.interact();assert(!m.interact());step(m,1);assert.equal(m.scene,'home');assert.equal(m.near.id,'exit');m.interact();step(m,1);assert.equal(m.scene,'street');assert.equal(m.level,1);assert.equal(m.config.day,0);
m.x=-12.51;m.updateNear();m.interact();step(m,14);assert.equal(m.level,0);assert.equal(m.arrivals,2);assert.equal(m.elevatorY,-1.09);
console.log('PASS elevator up/down, interruption guard, house round trip');
m=new Model({place:'homeDoor'});m.elevatorY=-1.09;m.x=-12.51;m.updateNear();m.interact();assert(m.ride.call);step(m,8);assert.equal(m.y,9.62);assert.equal(m.elevatorY,9.238);assert.equal(m.arrivals,0);
console.log('PASS calling a remote elevator does not move the player');
m=new Model({place:'home',day:3,flow:'out'});m.x=2.557;m.updateNear();m.interact();assert.equal(m.dialog.title,'소파');step(m,5,{move:-1});assert.equal(m.x,2.557);assert.equal(m.config.day,3);m.interact();assert(!m.dialog);m.x=3.4;m.updateNear();m.interact();assert.equal(m.dialog.title,'테라스');
console.log('PASS object inspection locks movement without changing day or saving');
global.window={};require(root+'/outside-data.js');const d=global.LunaResidence.apply(window.LUNA_OUTSIDE_DATA);
for(const asset of Object.values(d.assets)){const b=fs.readFileSync(path.join(root,asset.src));assert.equal(b.readUInt32BE(16),asset.w);assert.equal(b.readUInt32BE(20),asset.h);}
const sprites=[...Object.values(d.scenes).flatMap(s=>s.nodes.map(n=>n.sprite)),...Object.values(d.animations).flatMap(a=>a.frames)];for(const s of sprites){const a=d.assets[s.asset];assert(a);assert(s.x>=0&&s.y>=0&&s.x+s.w<=a.w&&s.y+s.h<=a.h);assert(s.ppu>0);}
assert.equal(d.animations.walk.frames.length,8);assert.equal(d.animations.run.frames.length,8);assert.equal(d.animations.idle.frames.length,9);assert(d.scenes.street.nodes.some(n=>n.layer===1));assert(d.scenes.street.nodes.some(n=>n.layer===10));
assert.equal(d.residenceVersion,1);assert(!d.scenes.street.nodes.some(n=>n.name==='House Spawn Point'));assert.equal(d.scenes.street.nodes.find(n=>n.name==='residence-railing').layer,10);const count=d.scenes.street.nodes.length;global.LunaResidence.apply(d);assert.equal(d.scenes.street.nodes.length,count);console.log('PASS source images, sprite slices, residence foreground and idempotent import override');
