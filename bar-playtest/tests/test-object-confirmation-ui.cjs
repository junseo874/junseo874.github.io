const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'elevator'});await outsidePlaytest.start();});
 for(const level of [0,1]){
  await p.evaluate(level=>{const m=outsidePlaytest.model,R=LunaResidence.layout;m.ride=null;m.dialog=null;m.scene='street';m.level=level;m.elevatorY=level?R.elevatorTop:R.elevatorBottom;m.x=R.elevatorX;m.y=level?R.upperY:-.7;m.story.cancel();m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);},level);
  await p.keyboard.press('KeyE');await p.waitForFunction(label=>document.querySelector('.world-choices [data-choice="confirm"]')?.textContent===label,level?'내려간다':'올라간다');assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.ride),false);
  assert.deepEqual(await p.locator('.world-choices button').allTextContents(),[level?'내려간다':'올라간다','취소']);
  await p.locator('[data-choice="cancel"]').click();assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.ride),false);
  await p.keyboard.press('KeyE');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>outsidePlaytest.model.dialog),null);
  await p.keyboard.press('KeyE');await p.locator('[data-choice="confirm"]').click();assert(await p.evaluate(()=>!!outsidePlaytest.model.ride));
 }
 for(const level of [0,1])for(const choice of ['fast','confirm','cancel']){
  await p.evaluate(level=>{
   const a=outsidePlaytest,m=a.model,R=LunaResidence.layout;
   barGame.progress.flags.elevator_repaired=true;m.start({day:0,flow:'out',place:'elevator'});
   m.level=level;m.elevatorY=level?R.elevatorTop:R.elevatorBottom;m.x=R.elevatorX;m.y=level?R.upperY:-.7;
   m.controlsTutorial=false;m.updateNear();a.snapCamera();a.tick(0);
  },level);
  await p.keyboard.press('KeyE');await p.locator('.world-choices [data-choice="fast"]').waitFor({state:'visible'});
  assert.deepEqual(await p.locator('.world-choices button').allTextContents(),['빠른 이동',level?'내려간다':'올라간다','취소']);
  assert.equal(await p.locator('.world-choices button.is-selected').getAttribute('data-choice'),'fast','fast travel is the default selection');
  if(choice==='fast'){
   await p.keyboard.press('Enter');
   await p.waitForFunction(level=>outsidePlaytest.model.level===1-level&&!outsidePlaytest.model.neighborhood.action,level);
   assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.ride),false,'fast travel skips the ride');
  }else{
   await p.locator('.world-choices [data-choice="'+choice+'"]').click();
   assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.ride),choice==='confirm');
   if(choice==='cancel')assert.equal(await p.evaluate(()=>outsidePlaytest.model.level),level);
  }
 }
 await p.evaluate(async()=>{const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(0);delete barGame.progress.flags.day0_tv_seen;Object.assign(c.outside.config,{day:0,flow:'in',place:'home'});await c.outside.start();c.screen('game');const m=c.outside.model;m.x=1.22;m.story.cancel();m.updateNear();c.outside.snapCamera();c.outside.tick(0);});
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>lunaCampaign.cinema?.scene?.template==='documentary');
 assert(!await p.evaluate(()=>!!barGame.progress.flags.day0_tv_seen));
 await p.waitForFunction(()=>!lunaCampaign.memoryTransition);
 assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.campaign-prologue')).cursor),'none');
 await p.keyboard.press('Escape');await p.locator('.luna-settings:visible').waitFor();
 assert.notEqual(await p.locator('.luna-settings:visible .ls-close').evaluate(el=>getComputedStyle(el).cursor),'none');
 assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).cursor),'none');
 await p.locator('.luna-settings:visible .ls-close').click();
 assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.campaign-prologue')).cursor),'none');
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.campaign-prologue')).cursor),'none');
 await p.evaluate(()=>{const c=lunaCampaign,done=c.cinema.returnTo;c.disposeCinema();done();});
 assert(await p.evaluate(()=>barGame.progress.flags.day0_tv_seen&&lunaCampaign.session.carry.flags.day0_tv_seen));
 assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).cursor),'none');
 await p.keyboard.press('KeyE');await p.locator('.world-choices [data-choice="confirm"]').waitFor({state:'visible'});assert.deepEqual(await p.locator('.world-choices button').allTextContents(),['TV를 본다','끈다']);
 assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);await p.locator('[data-choice="cancel"]').click();
 assert(await p.evaluate(()=>outsidePlaytest.model.tvOff));assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);
 await p.keyboard.press('KeyE');await p.locator('[data-choice="confirm"]').click();await p.waitForFunction(()=>lunaCampaign.cinema?.scene?.template==='documentary');assert(!await p.evaluate(()=>outsidePlaytest.model.tvOff));
 assert.deepEqual(errors,[]);console.log('PASS elevator both directions/cancel/Escape, repaired fast-first/default selection/normal ride, first TV direct, seen flag/carry, replay/off and replay after off');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
