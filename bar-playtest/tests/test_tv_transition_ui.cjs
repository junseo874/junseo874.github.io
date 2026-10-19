const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 for(const main of [false,true]){
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.outsidePlaytest);
  if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
  await p.evaluate(async main=>{const c=lunaCampaign;if(main){c.session.uninstall();c.session.install({serviceVersion:'A'});c.session.beginCommute(0);c.screen('game');}Object.assign(outsidePlaytest.config,{day:0,flow:'in',place:'home'});await outsidePlaytest.start();outsidePlaytest.model.x=1.22;outsidePlaytest.model.updateNear();outsidePlaytest.tick(0);},main);
  await p.waitForFunction(()=>!outsidePlaytest.loading);
  for(const flow of ['in','out']){
   await p.evaluate(flow=>{const m=outsidePlaytest.model;m.config.flow=flow;m.updateNear();outsidePlaytest.tick(0);window.unwantedMenus=0;window.tvObserver=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&(n.matches('[aria-label="외부 공간 설정"]')||n.querySelector('[aria-label="외부 공간 설정"]')))unwantedMenus++;});tvObserver.observe(document.querySelector('.outside-overlay'),{childList:true,subtree:true});},flow);
   if(flow==='in')await p.keyboard.press('KeyE');else await p.locator('.outside-interact').click();
   assert(await p.evaluate(()=>!!lunaCampaign.memoryTransition&&outsidePlaytest.model.paused));
   assert.equal(await p.locator('[aria-label="외부 공간 설정"]').count(),0);
   assert(await p.locator('.outside-overlay').isHidden());
   if(main&&flow==='in')await p.screenshot({path:'/private/tmp/tv-transition-clean.png'});
   await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition,null,{timeout:60000});
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.template),'documentary');
   // ESC still opens the actual cutscene settings, and returns to the documentary.
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
   if(flow==='in'){await p.keyboard.down('Space');await p.waitForTimeout(3200);await p.keyboard.up('Space');}
   else await p.evaluate(()=>{lunaCampaign.cinema.dialogueWait=null;lunaCampaign.cinema.time=lunaCampaign.cinema.scene.end-.01;});
   await p.waitForFunction(()=>['game','developer'].includes(lunaCampaign.view)&&!lunaCampaign.memoryTransition,null,{timeout:15000});
   assert.equal(await p.evaluate(()=>unwantedMenus),0);await p.evaluate(()=>tvObserver.disconnect());
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.scene),'home');assert(await p.locator('.outside-overlay').isHidden());
   // Ordinary pause menus must remain usable in both play modes.
   await p.keyboard.press('Escape');
   if(main)assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');else assert(await p.locator('[aria-label="외부 공간 설정"]').isVisible());
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS TV E/click / main + simulator / in + out / no settings flash / skip + natural return / ESC settings');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
