const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   LunaFocusSettings.setEnabled(false);
   Object.assign(outsidePlaytest.config,{day:2,flow:'in',place:'home'});await outsidePlaytest.start();
   lunaCampaign.session.day=2;lunaCampaign.scene('night2','테라스','terrace',()=>{});
  });
  await page.waitForFunction(()=>!lunaCampaign.memoryTransition&&lunaCampaign.view==='scene');
  const state=await page.evaluate(()=>{
   const c=lunaCampaign,d=c.dialog,host=document.querySelector('.terrace-scene').parentElement;
   const samples=[];
   for(const time of [0,1,3,7,20]){
    d.terraceEntryTime=time;d.terraceTime=time;d.chars=1e5;c.paintLine();
    const a=host.querySelector('.terrace-characters'),r=host.querySelector('.terrace-balustrade');
    samples.push({camera:LunaTerrace.camera(d),actor:[parseFloat(a.style.left),parseFloat(a.style.top)],rail:[parseFloat(r.style.left),parseFloat(r.style.top)],clip:getComputedStyle(a).clipPath});
   }
   const source=LunaEngineWorld.source.scenes.home,cam=source.cameras.views.find(v=>v.name==='CM_Terrace');
   const rect=id=>{const n=LunaEngineWorld.node('home',id),s=n.sprite;return[(n.x-cam.x+2.4)*100-s.w*s.pivot.x,(cam.y+1.35-n.y)*100-s.h*(1-s.pivot.y)];};
   return{samples,actor:rect('48449420'),rail:rect('1390137155'),index:d.index,entryDuration:d.terraceEntryDuration};
  });
  assert.equal(state.entryDuration,0,'Unity terrace camera is fixed, without the legacy web entrance pan');
  for(const s of state.samples){assert.deepEqual(s.camera,{x:0,y:0,zoom:1});for(const key of ['actor','rail'])assert(s[key].every((n,i)=>Math.abs(n-state[key][i])<1e-8));assert.equal(s.clip,'inset(0px)','Use the full engine sprite, not the legacy 39px foot crop');}
  await page.screenshot({path:'/tmp/luna-engine-layout-terrace.png'});
  await page.locator('.terrace-speech').click();assert.equal(await page.evaluate(()=>lunaCampaign.dialog.index),state.index+1);
  for(const place of ['home','homeDoor','bar']){
   await page.evaluate(async place=>{
    const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(2);
    Object.assign(c.outside.config,{day:2,flow:'out',place});await c.outside.start();c.screen(c.playView);
    const m=c.outside.model;m.controlsTutorial=false;m.story.cancel();c.outside.snapCamera();c.outside.tick(0);
   },place);
   await page.screenshot({path:'/tmp/luna-engine-layout-'+place+'.png'});
  }
  assert.deepEqual(errors,[]);
  console.log('ENGINE_TERRACE_LAYOUT_UI_OK: source camera/actor/rail alignment; full frames; dialogue advances; current layout captures');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
