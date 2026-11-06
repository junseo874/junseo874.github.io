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
    return{bad:bad.map(p=>p.engineActor),width:c.outside.renderCamera.w,version:LUNA_OUTSIDE_DATA.engineWorldVersion,source:LunaEngineWorld.exportLayout(LUNA_OUTSIDE_DATA).artPolicy};
   },{day,flow,place});
   assert.deepEqual(state.bad,[],`${day}/${flow}/${place}: valid original-image crop`);assert.equal(state.width,4.8);assert.equal(state.version,1);assert.equal(state.source,'latest-web-images');
  }
  const outlines=await page.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
   return ['repair','guard','boss'].map(actor=>{
    barGame.progress.flags={gang_pass_granted:actor==='boss'};m.start({day:2,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
    const t=N.targets(m).find(t=>t.actor===actor);m.x=t.x;m.updateNear();a.snapCamera();a.tick(0);
    return{actor,target:a.interactionGlow.target,count:a.interactionGlow.drawn.length};
   });
  });
  for(const o of outlines){assert.equal(o.target,'neighborhood-'+o.actor);assert.equal(o.count,1,'offset sprite still receives its interaction outline: '+o.actor);}
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
