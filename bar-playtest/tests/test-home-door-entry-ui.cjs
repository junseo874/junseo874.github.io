const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  const results=await page.evaluate(async()=>{
   lunaCampaign.screen('developer');
   Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'homeDoor'});
   await outsidePlaytest.start();
   const m=outsidePlaytest.model,results=[];
   for(const day of [0,1,2,3]){
    m.start({day,flow:'out',place:'homeDoor'});m.controlsTutorial=false;
    m.x=m.targets().find(t=>t.id==='home').x;m.facing=-1;m.updateNear();
    if(m.near?.id!=='home'||!m.interact())throw Error('Door interaction failed');
    for(let i=0;i<18;i++)m.tick(.05);
    const x=m.x;m.tick(.05);
    results.push({day,scene:m.scene,x,settledX:m.x,facing:m.facing,transition:m.transition,
     door:LunaEngineWorld.point('home','home_exit_door').x,safe:LunaEngineWorld.point('home','04.Gameplay/HomeSafeSpawn').x});
   }
   outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
   return results;
  });
  for(const r of results){
   assert.equal(r.scene,'home');assert.equal(r.transition,null);assert.equal(r.facing,1);
   assert(Math.abs(r.x-r.door)<.2);assert(Math.abs(r.x-r.safe)>1);
   assert.equal(r.x,r.settledX,'No clamp jump after entry');
  }
  await page.screenshot({path:'/private/tmp/home-door-entry.png'});
  assert.deepEqual(errors,[]);
  console.log('HOME_DOOR_ENTRY_OK: days 0–3, doorway entry, inward facing, stable position');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
