const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
const load=file=>vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W,{filename:file});
for(const file of ['data/runtime/outside-scene-data.js','data/presentation/engine-world-layout.js','src/features/outside/engine-world-layout.js','src/features/outside/samho-animation.js','src/features/outside/home-art.js','src/features/outside/outside-residence.js','src/features/outside/outside-art.js','src/features/outside/events/outside-ambient.js'])load(file);
const E=W.LunaEngineWorld,D=W.LUNA_OUTSIDE_DATA,art=JSON.stringify(D.assets),near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
E.applyStreet(D);assert.equal(JSON.stringify(D.assets),art,'layout must never replace or import images');
for(const n of D.scenes.street.nodes.filter(n=>n.placementSource==='engine')){
 const e=E.node('street',n.engineNode);near(n.x,e.x);near(n.y,e.y);assert.equal(n.layer,e.layer);assert.equal(n.order,e.order);
}
for(const name of ['Room_Entrance','Terrace_Entrance','Hanger','IntractObjects','home-bedding','home-herb','ForeFore_Object']){
 const n=D.scenes.home.nodes.find(n=>n.name===name),e=E.node('home',n.engineNode);near(n.x,e.x);near(n.y,e.y);assert.equal(n.order,e.order);
}
const roleKinds={neighbor:'Neighbor',repair:'Repairman',guard:'Gang1',boss:'Gang5',gangmate:'Gang3',chris:'Chris',thug:'Neighbor',dealer:'M1'};
let count=0;
for(const [name,s]of Object.entries(E.source.scenes))for(const [event,actors]of Object.entries(s.actors))for(const [role,a]of Object.entries(actors)){
 if(role==='boobi')continue; // procedural web cat has its own bounded drawing
 const sp=role==='samho'?W.LunaSamhoAnimation.frame(0):role==='shiba'?D.animations.shiba.frames[0]:W.LunaOutsideAmbient.sprite(roleKinds[role]);
 const p=E.actorPose(name,event,role,sp,a.root.x,a.root.y);
 near(p.x,a.visual.x);near(p.y,a.visual.y);near(p.sp.h/p.sp.ppu*p.sy,a.sprite.h/a.sprite.ppu*Math.hypot(a.visual.c,a.visual.d));
 assert.equal(p.layer,a.layer);assert.equal(p.order,a.order);assert.equal(p.sp.asset,sp.asset,'latest animation asset retained');count++;
}
load('src/shared/platform/pixel-camera.js');
for(const width of [960,1280,1920,2560])near(W.LunaPixelCamera.settledWidth(4.8,W.LunaPixelCamera.surface(width,width*9/16)),4.8);
for(const name of ['home','street']){
 const b=E.bounds(name),c=E.confine(name,{x:-100,y:-100,w:4.8});near(c.x,b.left+2.4);near(c.y,b.bottom+1.35);
}
const version=JSON.stringify(D.scenes);E.applyStreet(D);assert.equal(JSON.stringify(D.scenes),version,'idempotent layout');
assert.equal(E.camera('street').liftWidth,19.2);assert.equal(E.source.scenes.street.cameras.elevator.cameraReturnTiming,.75);
console.log(`ENGINE_WORLD_LAYOUT_OK: current images unchanged, scene transforms, ${count} actor poses/scales/sorting, fixed camera FOV and confiners`);
