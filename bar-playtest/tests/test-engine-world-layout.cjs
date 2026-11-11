const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
const load=file=>vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W,{filename:file});
for(const file of ['data/runtime/outside-scene-data.js','data/presentation/engine-world-layout.js','src/features/outside/engine-world-layout.js','src/features/outside/samho-animation.js','src/features/outside/home-art.js','src/features/outside/outside-residence.js','src/features/outside/outside-art.js','src/features/outside/events/outside-ambient.js'])load(file);
const E=W.LunaEngineWorld,D=W.LUNA_OUTSIDE_DATA,art=JSON.stringify(D.assets),near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
E.applyStreet(D);assert.equal(JSON.stringify(D.assets),art,'layout must never replace or import images');
for(const n of D.scenes.street.nodes.filter(n=>n.placementSource==='engine')){
 const e=E.node('street',n.engineNode);near(n.x,e.x);near(n.y,e.y);assert.equal(n.layer,e.layer);assert.equal(n.order,e.order);
}
for(const n of D.scenes.street.nodes.filter(n=>n.placementSource==='web-lift-framing')){
 const e=E.node('street',n.engineNode);near(n.x,e.x);near(n.y,e.y+E.residence().cabinOffsetY);near(n.sprite.w*n.sx/n.sprite.ppu,e.sprite.w*Math.hypot(e.a,e.b)/e.sprite.ppu);near(n.sprite.h*n.sy/n.sprite.ppu,e.sprite.h*Math.hypot(e.c,e.d)/e.sprite.ppu);
}
const door=E.node('home','1183900665'),doorPixels=W.LunaHomeArt.layers.find(l=>l.name==='Room_Entrance');
for(const layer of W.LunaHomeArt.layers){
 const n=D.scenes.home.nodes.find(n=>n.name===layer.name);
 near((n.x-door.x)*100,layer.x+layer.w/2-doorPixels.x-doorPixels.w/2);
 near((door.y-n.y)*100,layer.y+layer.h/2-doorPixels.y-doorPixels.h/2);
}
assert(D.scenes.home.nodes.find(n=>n.name==='home-tv-screen').order>D.scenes.home.nodes.find(n=>n.name==='IntractObjects').order);
assert(D.scenes.home.nodes.find(n=>n.name==='home-book').order>D.scenes.home.nodes.find(n=>n.name==='ForeFore_Object').order);
const roleKinds={neighbor:'Neighbor',repair:'Repairman',guard:'Gang1',boss:'Gang5',gangmate:'Gang3',chris:'Chris',thug:'Neighbor',dealer:'M1'};
let count=0;
for(const [name,s]of Object.entries(E.source.scenes))for(const [event,actors]of Object.entries(s.actors))for(const [role,a]of Object.entries(actors)){
 if(role==='boobi')continue; // procedural web cat has its own bounded drawing
 const sp=role==='samho'?W.LunaSamhoAnimation.frame(0):role==='shiba'?D.animations.shiba.frames[0]:W.LunaOutsideAmbient.sprite(roleKinds[role]);
 const p=E.actorPose(name,event,role,sp,a.root.x,a.root.y);
 near(p.x,a.root.x-(role==='shiba'?D.animations.shiba.frames[0].w/sp.ppu/2:0));
 if(role==='samho')near(p.y+((1-p.sp.pivot.y)*p.sp.h-74)/p.sp.ppu*p.sy,a.root.y-.274);
 else if(role==='dealer')near(p.y,a.root.y-.274);
 else near(p.y,a.root.y);
 near(p.sx,1);near(p.sy,1);
 assert.deepEqual(p.sp,sp,'keep native frame dimensions, pivot and pixel density');
 if(sp.asset.startsWith('ambient-')){
  const kind=sp.asset.slice(8),frames=W.LunaOutsideAmbient.sheets[kind].frames;
  for(let i=0;i<frames;i++){
   const cell={...sp,x:i*129},pose=E.actorPose(name,event,role,cell,a.root.x,a.root.y);
   assert.equal(JSON.stringify(pose.sp),JSON.stringify(cell),'no engine crop or frame remapping during idle');
   near(pose.x,p.x);near(pose.y,p.y);
  }
 }
 const camp=name==='street'&&['guard','boss','gangmate'].includes(role);
 assert.equal(p.layer,a.layer===0?(camp?14:12):a.layer);assert.equal(p.order,a.layer===0?(camp?0:4):a.order);
 const placed=E.actorPoint(name,event,role),nextDoor=name==='street'&&['day2-corridor-thug','day2-thug-information'].includes(event);
 near(placed.x,nextDoor?E.actor('street','neighborhood-reveal','neighbor').root.x:a.root.x);
 near(placed.y,name==='street'&&a.root.y>5?E.residence().upperY-.274:a.root.y);
 assert.equal(p.sp.asset,sp.asset,'latest animation asset retained');count++;
}
load('src/shared/platform/pixel-camera.js');
for(const width of [960,1280,1920,2560])near(W.LunaPixelCamera.settledWidth(4.8,W.LunaPixelCamera.surface(width,width*9/16)),4.8);
for(const name of ['home','street']){
 const b=E.bounds(name),c=E.confine(name,{x:-100,y:-100,w:4.8});near(c.x,b.left+2.4);near(c.y,b.bottom+1.35);
}
const version=JSON.stringify(D.scenes);E.applyStreet(D);assert.equal(JSON.stringify(D.scenes),version,'idempotent layout');
assert.equal(E.camera('street').liftWidth,19.2);assert.equal(E.source.scenes.street.cameras.elevator.cameraReturnTiming,.75);
// Ride camera joins preserve the engine endpoints without cabin/pivot jumps.
const R=E.residence(),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function liftRun(down,fps){
 const ride={from:down?R.elevatorTop:R.elevatorBottom,to:down?R.elevatorBottom:R.elevatorTop,time:0,call:false,duration:12};
 const m={scene:'street',story:{},time:0,x:R.elevatorX,y:down?R.upperY:-.7,elevatorY:ride.from,ride};
 let cam=E.confine('street',{x:m.x+.2,y:m.y,w:4.8});const initial={...cam},samples=new Map();
 for(let i=0;i<=16*fps;i++){
  const t=i/fps;m.time=t;ride.time=t;m.elevatorY=ride.from+(ride.to-ride.from)*smooth((t-.45)/12);
  m.y=m.elevatorY+R.passengerOffset;
  if(t>=13.1){m.ride=null;m.y=down?-.7:R.upperY;}
  const next=E.liftCamera(m,cam);if(next)cam=next;
  if(i===0){near(cam.x,initial.x);near(cam.y,initial.y);near(cam.w,initial.w);}
  if(i%(fps/2)===0)samples.set(t,{...cam});
  if(t===5){const frozen=E.liftCamera(m,cam);near(frozen.x,cam.x);near(frozen.y,cam.y);near(frozen.w,cam.w);}
  assert(cam.w>=4.8-1e-8&&cam.w<=19.2+1e-8,'no zoom overshoot');
 }
 const wide=samples.get(3),end=samples.get(15);near(wide.w,19.2);near(end.w,4.8);
 const target=E.confine('street',{x:m.x,y:m.y,w:4.8});near(end.x,target.x);near(end.y,target.y);
 const before=samples.get(14.5);assert(Math.hypot(before.x-end.x,before.y-end.y)<.06,'ease gently into the original camera');
 return samples;
}
for(const down of [false,true]){const baseline=liftRun(down,30);for(const fps of [60,120])for(const [t,p]of liftRun(down,fps)){const q=baseline.get(t);near(p.x,q.x);near(p.y,q.y);near(p.w,q.w);}}
assert.equal(E.liftCamera({scene:'street',story:{},x:R.elevatorX,y:-.7,elevatorY:R.elevatorBottom,time:0,ride:{call:true}}),null,'empty cabin call must not start passenger zoom');
console.log(`ENGINE_WORLD_LAYOUT_OK: current images unchanged, scene transforms, ${count} actor poses/scales/sorting, camera joins at 30/60/120fps and confiners`);
