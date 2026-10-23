const assert=require('node:assert/strict');
require('../src/features/outside/effects/outside-ad-carrier.js');
require('../src/features/outside/effects/outside-traffic.js');
const A=global.LunaOutsideAdCarrier,T=global.LunaOutsideTraffic;
const base={scene:'street',time:0,config:{day:0}},data={assets:{}};
A.apply(data);A.apply(data);assert.deepEqual(Object.keys(data.assets),[A.assetId]);
assert.equal(A.interval,5);
assert.equal(A.travelRate,.75);
assert.equal(A.depth.alpha,1);
assert(A.routes[0].width>=1.65*1.15&&A.routes[1].width>=1.4*1.15);
assert(A.routes[0].y>.65&&A.routes[1].y>7.7);
for(let n=0;n<15;n++){
 assert.equal(A.adState(n*5).index,n%3);
 assert.equal(A.adState(n*5+4.999).index,n%3);
 assert.equal(A.adState(n*5+.5).mix,1);
}
assert(A.adState(5.2).mix>0&&A.adState(5.2).mix<1);
assert.deepEqual(A.adState(-1),A.adState(0));
let count=0;const directions=new Set();
for(let time=0;time<600;time+=.125){
 const m={...base,time},snapshot=JSON.stringify(m),a=A.vehicles(m),b=A.vehicles({...m,time:time+.01});
 assert(a.length<=2);assert.equal(JSON.stringify(m),snapshot);assert.deepEqual(A.vehicles(m),a);
 for(const v of a){
  count++;directions.add(v.direction);assert(v.x>=-19&&v.x<=10);assert.equal(v.alpha,1,'Opaque for the whole route, including endpoints');
  const next=b.find(n=>n.id===v.id);if(!next)continue;
  const speed=(next.x-v.x)/.01*v.direction;
  const route=A.routes.find(r=>v.id.startsWith(r.id+':'));
  assert(Math.abs(speed-29/route.duration*.75)<1e-9,'Exactly 25% slower; ad clock is independent');
  assert(Math.abs(next.y-v.y)<.001,'Subtle continuous hovering');
  for(const d of ['far','mid','near']){const cars=T.vehicles(m,d),later=T.vehicles({...m,time:time+.01},d);for(const c of cars){const n=later.find(n=>n.id===c.id);if(n)assert(Math.abs(n.x-c.x)>Math.abs(next.x-v.x));}}
 }
}
assert(count>0&&directions.size===2);
for(const day of [0,1,2,3]){
 assert(A.vehicles({...base,config:{day}}).length>0);
 assert.deepEqual(A.vehicles({...base,scene:'home',config:{day}}),[]);
 assert.deepEqual(A.vehicles({...base,qa:{},config:{day}}),[]);
}
console.log('AD_CARRIER_OK: 5s ads, bounded independent routes, slower than every traffic depth, deterministic pause, no gameplay mutation, home/QA excluded');
