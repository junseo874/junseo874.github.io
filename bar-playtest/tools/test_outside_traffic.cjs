const assert=require('node:assert/strict'),path=require('node:path');
require(path.resolve(process.argv[2]||path.join(__dirname,'..'),'outside-traffic.js'));
const T=global.LunaOutsideTraffic,m={scene:'street',time:0,config:{day:0}};
const depths=['far','mid','near'],widths={far:[],mid:[],near:[]},speeds={far:[],mid:[],near:[]};
let right=false,left=false,maxCount=0,total=0,frames=0,both=0;const palette=new Set(),crossings={1:0,'-1':0};
for(let time=0;time<240;time+=.1){
 const state={...m,time},cars=depths.flatMap(d=>T.vehicles(state,d));
 maxCount=Math.max(maxCount,cars.length);total+=cars.length;frames++;
 if(cars.some(c=>c.direction===1)&&cars.some(c=>c.direction===-1))both++;
 for(const c of cars){assert(c.x>=-18&&c.x<=9);assert(c.alpha>=0&&c.alpha<=.82);assert(c.width<.42);widths[c.depth].push(c.width);assert(c.y>.7);palette.add(c.color);if(c.direction===1)right=true;else left=true;}
 for(const depth of depths){
  const a=T.vehicles(state,depth),b=T.vehicles({...state,time:time+.01},depth);
  for(const c of a){const n=b.find(n=>n.id===c.id);if(n){assert((n.x-c.x)*c.direction>0&&Math.abs(n.x-c.x)<.02,'Continuous horizontal movement');speeds[depth].push(Math.abs(n.x-c.x));}}
  const next=T.vehicles({...state,time:time+.1},depth);
  for(const c of a){const n=next.find(n=>n.id===c.id);if(n&&c.y<2&&((c.x+8.7)*(n.x+8.7)<0))crossings[c.direction]++;}
  assert.deepEqual(T.vehicles(state,depth),a,'Re-render is deterministic');
 }
}
assert(right&&left);assert(maxCount<=14&&maxCount>=12);
for(const [closer,farther] of [['near','mid'],['mid','far']]){
 assert(Math.min(...widths[closer])>Math.max(...widths[farther]),'Depth size ranges never overlap');
 assert(Math.min(...speeds[closer])>Math.max(...speeds[farther]),'Farther traffic travels more slowly');
 assert(T.depths[closer].alpha>T.depths[farther].alpha);
 for(let axis=0;axis<2;axis++)assert(T.depths[closer].parallax[axis]>T.depths[farther].parallax[axis]);
}
assert(total/frames>5,'More traffic than the old three-route schedule');
assert(both/frames>.9,'Both directions are active together, not alternating one car');
assert.equal(palette.size,7);assert(palette.has(0),'Black body variant included');
assert(crossings[1]>=12&&crossings[-1]>=12,'Frequent low-altitude crossings in both directions');
for(const depth of depths)for(const day of [0,1,2,3]){
 const state={...m,time:13,config:{day}};
 assert.deepEqual(T.vehicles({...state,scene:'home'},depth),[]);
 assert.deepEqual(T.vehicles({...state,qa:{}},depth),[]);
 const snapshot=JSON.stringify(state);T.vehicles(state,depth);assert.equal(JSON.stringify(state),snapshot,'No gameplay mutation');
}
console.log('PASS increased bounded traffic, simultaneous opposing lanes, seven body colors including black, smooth movement, repeatable paused frames, days 0–3, home/QA exclusion', {average:total/frames,crossings});
