const assert=require('node:assert/strict');
require('../src/features/outside/effects/outside-ad-carrier.js');
require('../src/features/outside/effects/outside-traffic.js');
const A=global.LunaOutsideAdCarrier,T=global.LunaOutsideTraffic;
const base={scene:'street',time:0,config:{day:0}},data={assets:{}};
const {left,right}=A.flightBounds,span=right-left;
A.apply(data);A.apply(data);assert.deepEqual(Object.keys(data.assets),[A.assetId]);
assert.equal(A.interval,5);
assert.equal(A.travelRate,.75);
assert.equal(A.depth.alpha,1);
assert(A.routes[0].width>=1.65*1.15&&A.routes[1].width>=1.4*1.15);
assert.equal(A.routes[0].y,2.55);
assert.equal(A.routes[1].y,7.5);
for(let n=0;n<15;n++){
 assert.equal(A.adState(n*5).index,n%3);
 assert.equal(A.adState(n*5+4.999).index,n%3);
 assert.equal(A.adState(n*5+.001).index,n%3);
 assert.equal(A.adState(n*5).age,0);
}
assert.deepEqual(A.adState(5),{index:1,age:0});
assert.equal(A.adState(5.2).index,1);
assert.deepEqual(A.adState(-1),A.adState(0));
let count=0;const directions=new Set();
for(let time=0;time<600;time+=.125){
 const m={...base,time},snapshot=JSON.stringify(m),a=A.vehicles(m),b=A.vehicles({...m,time:time+.01});
 assert.equal(a.length,2,'No idle gap between passes');assert.equal(JSON.stringify(m),snapshot);assert.deepEqual(A.vehicles(m),a);
 for(const v of a){
  count++;directions.add(v.direction);assert(v.x>=left&&v.x<=right);assert.equal(v.alpha,1,'Opaque for the whole route, including endpoints');
  const next=b.find(n=>n.id===v.id);if(!next)continue;
  const speed=(next.x-v.x)/.01*v.direction;
  const route=A.routes.find(r=>v.id.startsWith(r.id+':'));
  assert(Math.abs(speed-span/route.duration*.75)<1e-9,'Constant speed; ad clock is independent');
  assert(Math.abs(speed-29/(route.id==='lower'?112:124)*.75)<1e-9,'Existing flight speed preserved');
  assert(Math.abs(next.y-v.y)<.001,'Subtle continuous hovering');
  for(const d of ['far','mid','near']){const cars=T.vehicles(m,d),later=T.vehicles({...m,time:time+.01},d);for(const c of cars){const n=later.find(n=>n.id===c.id);if(n)assert(Math.abs(n.x-c.x)>Math.abs(next.x-v.x));}}
 }
}
assert(count>0&&directions.size===2);
for(const route of A.routes)for(let cycle=1;cycle<=6;cycle++){
 const t=(cycle*route.duration-route.phase)/A.travelRate;
 const get=time=>A.vehicles({...base,time}).find(v=>v.id.startsWith(route.id+':'));
 const before=get(t-.001),after=get(t+.001);
 assert(before&&after);assert.notEqual(before.id,after.id);
 assert(Math.abs(before.x-(route.direction===1?right:left))<.001);
 assert(Math.abs(after.x-(route.direction===1?left:right))<.001);
 assert.deepEqual(after.ad,A.adState(t+.001),'Respawning does not reset the ad');
 // Whole hull stays outside all normal map camera edges at either endpoint.
 assert(left+route.width/2< -22.25);
 assert(right+(-22.25+7.85)*(1-A.depth.parallax[0])-route.width/2>6.55);
}
for(const day of [0,1,2,3]){
 assert(A.vehicles({...base,config:{day}}).length>0);
 assert.deepEqual(A.vehicles({...base,scene:'home',config:{day}}),[]);
 assert.deepEqual(A.vehicles({...base,qa:{},config:{day}}),[]);
}
console.log('AD_CARRIER_OK: 5s ads, bounded independent routes, slower than every traffic depth, deterministic pause, no gameplay mutation, home/QA excluded');
