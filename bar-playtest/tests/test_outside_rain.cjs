const assert=require('node:assert/strict'),path=require('node:path');
require(path.resolve(process.argv[2]||path.join(__dirname,'..'),'src/features/outside/effects/outside-rain.js'));
const R=global.LunaOutsideRain,cam={x:1,y:0,w:4.8};
for(const day of [0,1,2,3,99])for(const flow of ['in','out'])for(const scene of ['street','home']){
 const m={config:{day,flow},scene,time:2.5};
 const expected=scene==='street'&&(day===1||day===0&&flow==='out'||day===2&&flow==='in');
 assert.equal(R.enabled(m),expected,`${day}/${flow}/${scene}`);
 assert.equal(R.particles(m,cam).drops.length>0,expected);
 assert.equal(R.enabled({...m,qa:{}}),false);
}
const m={config:{day:0,flow:'out'},scene:'street',time:2.5};
const a=R.particles(m,cam),b=R.particles(m,{...cam,w:12.8});
assert(a.drops.length>=15&&a.drops.length<45,'Continuous reference-like rain density');
const next=R.particles({...m,time:m.time+1/60},cam);
const tracked=a.drops.map(d=>[d,next.drops.find(e=>e.id===d.id)]).filter(([d,e])=>e&&d.y>e.y&&d.y-e.y<.1);
assert(tracked.length>10,'Drops advance on every display frame, not at 15 Hz');
for(const [d,e] of tracked){assert(e.x<d.x);assert(Math.abs((d.x-e.x)/(d.y-e.y)-.43)<1e-8);}
assert(a.drops.every(d=>b.drops.some(e=>JSON.stringify(d)===JSON.stringify(e))),'World positions survive zoom');
assert.deepEqual(R.particles(m,cam),a,'Paused frame remains stable');
assert.notDeepEqual(R.particles({...m,time:2.8},cam),a,'Rain animates');
assert(R.particles(m,{x:-20,y:7,w:12}).drops.length>0,'Elevator/high floors remain rainy');
assert.equal(R.particles(m,{x:-20,y:7,w:4.8}).splashes.length,0,'No midair floor splashes');
// The actor origin (-.70) is at the hips. Soles extend .344 below it.
const footY=-.70-.86*.4;
let floorDrops=0,splashCount=0;
for(let t=0;t<10;t+=1/15){
 const field=R.particles({...m,time:t},cam);splashCount+=field.splashes.length;
 for(const s of field.splashes){assert(s.y<=-1.08&&s.y>=-1.30);assert(s.y+.027*.65<footY,'Entire splash stays below soles');}
 floorDrops+=field.drops.filter(d=>d.y<footY).length;
 assert(field.drops.every(d=>d.y>=-1.30),'Drops stop inside road band');
 const wide=R.particles({...m,time:t},{...cam,w:12.8});
 assert(field.splashes.every(s=>wide.splashes.some(e=>JSON.stringify(s)===JSON.stringify(e))),'Splash position survives zoom');
}
assert(splashCount>20&&floorDrops>0,'Visible ground impacts and rain reaching below feet');
assert.equal(R.particles(m,{x:1,y:0,w:3.4}).splashes.length,0,'No impacts when only the old hip-height band is visible');
let drawn=0,saves=0;const ctx={save(){saves++;},restore(){saves--;},fillRect(){drawn++;}};
R.draw(ctx,m,cam,(x,y)=>({x,y}));assert(drawn>0);assert.equal(saves,0);
const all=drawn;drawn=0;R.draw(ctx,m,cam,(x,y)=>({x,y}),'splashes');const impacts=drawn;
assert.equal(impacts,a.splashes.length*5);drawn=0;R.draw(ctx,m,cam,(x,y)=>({x,y}),'drops');assert.equal(drawn+impacts,all,'Two passes preserve the original particles exactly');assert.equal(saves,0);
drawn=0;R.draw(ctx,{...m,scene:'home'},cam,(x,y)=>({x,y}));assert.equal(drawn,0);
console.log('PASS rain schedule, home/QA exclusion, world-space zoom, pause, animation, lift and draw isolation');
