const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))missing.push(r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const place of ['home','homeDoor','bar']){
   const state=await page.evaluate(async({day,flow,place})=>{
    LunaFocusSettings.setEnabled(false);const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(day);
    Object.assign(c.outside.config,{day,flow,place});await c.outside.start();c.screen(c.playView);
    const m=c.outside.model;m.controlsTutorial=false;m.story.cancel();c.outside.snapCamera();c.outside.tick(0);
    const bad=(m.engineActorViews||[]).filter(p=>![p.x,p.y,p.sx,p.sy,p.sp.x,p.sp.y].every(Number.isFinite)||p.sp.x<0||p.sp.y<0||p.sp.x+p.sp.w>LUNA_OUTSIDE_DATA.assets[p.sp.asset].w||p.sp.y+p.sp.h>LUNA_OUTSIDE_DATA.assets[p.sp.asset].h);
    const soles=(m.engineActorViews||[]).filter(p=>['samho','dealer'].includes(p.engineActor?.role)).map(p=>{
     const pixels=LunaOutsideAmbient.bounds(p.sp);
     return{role:p.engineActor.role,y:p.y+((1-p.sp.pivot.y)*p.sp.h-pixels.bottom)/p.sp.ppu*p.sy};
    });
    return{bad:bad.map(p=>p.engineActor),soles,width:c.outside.renderCamera.w,version:LUNA_OUTSIDE_DATA.engineWorldVersion,source:LunaEngineWorld.exportLayout(LUNA_OUTSIDE_DATA).artPolicy};
   },{day,flow,place});
   assert.deepEqual(state.bad,[],`${day}/${flow}/${place}: valid original-image crop`);assert.equal(state.width,4.8);assert.equal(state.version,1);assert.equal(state.source,'latest-web-images');
   for(const sole of state.soles)assert(Math.abs(sole.y+.974)<.03,`${day}/${flow}/${place}: visible ${sole.role} feet must meet the road, got ${sole.y}`);
  }
  const outlines=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   return ['repair','guard','boss'].map(actor=>{
    barGame.progress.flags={gang_pass_granted:actor==='boss'};m.start({day:2,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
    const t=N.targets(m).find(t=>t.actor===actor);m.x=t.x;m.updateNear();a.snapCamera();a.tick(0);
    const pose=m.engineActorViews.find(v=>v.engineActor?.role===actor);
    const box=LunaOutsideAmbient.bounds(pose.sp);
    return{actor,target:a.interactionGlow.target,count:a.interactionGlow.drawn.length,layer:pose.layer,foot:pose.y+((1-pose.sp.pivot.y)*pose.sp.h-box.bottom)/pose.sp.ppu*pose.sy,height:(box.bottom-box.top)/pose.sp.ppu*pose.sy};
   });
  });
  for(const o of outlines){assert.equal(o.target,'neighborhood-'+o.actor);assert.equal(o.count,1,'offset sprite still receives its interaction outline: '+o.actor);assert.equal(o.layer,o.actor==='repair'?12:14,'NPC must render in front of opaque scenery');assert(Math.abs(o.foot+.974)<.001,'NPC soles stay on the road');assert(o.height>=.5&&o.height<=.72,'NPC native height relative to 0.53-unit Luna: '+o.actor);}
  const neighbor=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   barGame.progress.flags={day2_thug_done:true};m.start({day:2,flow:'in',place:'homeDoor'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.notionFlags.day2_thug_done=true;
   m.x=N.places.neighbor.x-.3;m.updateNear();a.snapCamera();a.tick(0);
   const p=m.engineActorViews.find(v=>v.engineActor?.event==='day2-corridor-thug'),target=LunaOutsideNotion.targets(m)[0];
   const box=LunaOutsideAmbient.bounds(p.sp);
   return{x:p.x,layer:p.layer,foot:p.y+((1-p.sp.pivot.y)*p.sp.h-box.bottom)/p.sp.ppu*p.sy,expectedX:N.places.neighbor.x,expectedFoot:LunaResidence.layout.upperY-.274,targetX:target.x,catDistance:p.x-N.places.cat.x};
  });
  assert.equal(neighbor.layer,12);assert(Math.abs(neighbor.x-neighbor.expectedX)<1e-6);assert(Math.abs(neighbor.foot-neighbor.expectedFoot)<1e-6);assert.equal(neighbor.targetX,neighbor.expectedX);assert(neighbor.catDistance>.8,'Next-door information NPC must not stand on the cat');
  await page.screenshot({path:'/tmp/luna-placement-neighbor.png'});
  const neighborOwnership=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   m.story.beginRows('neighborhood/reveal-check',{},[{type:'neighborhood-action',action:'neighbor-in'},{type:'say',actor:'neighbor',text:'검수'}]);
   for(let i=0;i<45;i++)m.tick(.05);a.tick(0);
   const walking=m.engineActorViews.filter(p=>['neighbor','thug'].includes(p.engineActor?.role));
   const hiddenMenu=LunaOutsideNotion.targets(m).length===0;
   m.story.cancel();N.cancel(m);a.tick(0);
   const returned=m.engineActorViews.filter(p=>p.engineActor?.event==='day2-corridor-thug');
   return{walking:walking.map(p=>p.engineActor.role),hiddenMenu,returned:returned.length};
  });
  assert.deepEqual(neighborOwnership,{walking:['neighbor'],hiddenMenu:true,returned:1},'Boobi scene and information dialogue must not duplicate the same neighbor');
  const animation=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,A=LunaOutsideAmbient;
   m.start({day:2,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=N.places.guard.x+.3;a.snapCamera();
   const poses=[],shiba=[];
   for(let i=0;i<18;i++){
    m.time=i/12+.001;a.tick(0);
    const p=m.engineActorViews.find(p=>p.engineActor?.role==='guard');
    poses.push({frame:p.sp.x,x:p.x,y:p.y,sx:p.sx,sy:p.sy,head:A.head(p.sp,p.x,p.y,p.sx,p.sy,p.flip)});
    shiba.push(m.engineActorViews.find(p=>p.engineActor?.role==='shiba').sp.name);
   }
   return{poses,shiba};
  });
  for(let i=0;i<18;i++){
   const p=animation.poses[i],first=animation.poses[0];
   assert.equal(p.frame,i%9*129,'all nine native idle cells in order, without engine re-slicing');
   assert.equal(p.x,first.x);assert.equal(p.y,first.y);assert.equal(p.sx,1);assert.equal(p.sy,1);assert.deepEqual(p.head,first.head,'speech anchor remains stable through the full loop');
   if(i%2===1)assert.equal(animation.shiba[i],animation.shiba[i-1],'Shiba stays at authored 6 FPS, not 12');
  }
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.start({day:2,flow:'in',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();});
  const lift=await page.evaluate(()=>{
   const m=outsidePlaytest.model;m.scene='street';m.level=0;m.y=-.7;m.elevatorY=LunaResidence.layout.elevatorBottom;m.startLift();
   const views=[];for(let i=0;i<325;i++){m.tick(.05,{});outsidePlaytest.tick(0);views.push(outsidePlaytest.renderCamera.w);}
   return{max:Math.max(...views),last:views.at(-1),level:m.level,ride:!!m.ride,time:m.time,encounter:m.encounter?.kind,story:m.story.speech?.id};
  });
  assert(lift.max>19&&lift.max<=19.201,JSON.stringify(lift));assert(!lift.ride&&lift.level===1,JSON.stringify(lift));assert(Math.abs(lift.last-4.8)<.01,JSON.stringify(lift));
  for(const width of [960,1920]){await page.setViewportSize({width,height:width*9/16});await page.evaluate(()=>outsidePlaytest.snapCamera());assert.equal(await page.evaluate(()=>outsidePlaytest.renderCamera.w),4.8);}
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log('ENGINE_WORLD_LAYOUT_UI_OK: 24 day/route/location entries; valid NPC atlas crops; no missing images; engine lift lens; stable FOV');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
