const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{window.stepSkipIntro=lunaCampaign.tick.bind(lunaCampaign);lunaCampaign.tick=()=>{};});
  for(const id of ['tv','bd']){
   await p.evaluate(id=>LunaCutsceneLibrary.play(lunaCampaign,id),id);
   const cue=p.locator('.campaign-skip');await cue.waitFor();
   assert(await cue.evaluate(e=>e.classList.contains('is-visible')),'Discoverable without pressing Space');
   assert.equal(await cue.locator('span').textContent(),'스페이스 바를 2초간 눌러 스킵');
   assert.equal(await cue.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');
   await p.evaluate(()=>{for(let i=0;i<28;i++)stepSkipIntro(.05);});
   assert(await cue.evaluate(e=>e.classList.contains('is-visible')),'Visible at 1.4 seconds');
   await p.waitForTimeout(280);await p.screenshot({path:'/private/tmp/skip-intro-'+id+'.png'});
   const age=await p.evaluate(()=>lunaCampaign.cinema.skipHintAge);
   await p.evaluate(()=>{lunaCampaign.resumeView='prologue';lunaCampaign.screen('options');for(let i=0;i<80;i++)stepSkipIntro(.05);lunaCampaign.screen('prologue');});
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.skipHintAge),age,'Pause/redraw does not consume or restart the hint');
   await p.waitForTimeout(280);await p.evaluate(()=>{for(let i=0;i<3;i++)stepSkipIntro(.05);});
   assert(!await cue.evaluate(e=>e.classList.contains('is-visible')),'Fade starts after 1.5 seconds');
   await p.waitForTimeout(80);const opacity=await cue.evaluate(e=>Number(getComputedStyle(e).opacity));assert(opacity>0&&opacity<1,'Uses existing fade, not an abrupt hide');
   await p.waitForTimeout(250);assert.equal(await cue.evaluate(e=>getComputedStyle(e).opacity),'0');
   await p.evaluate(()=>lunaCampaign.draw());assert(!await cue.evaluate(e=>e.classList.contains('is-visible')),'Redraw cannot replay introduction');
   await p.keyboard.down('Space');await p.evaluate(()=>{lunaCampaign.cinemaHoldStart=performance.now()-250;lunaCampaign.paintCinemaSkip();});assert.equal(await cue.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');
   await p.evaluate(()=>{lunaCampaign.cinemaHoldStart=performance.now()-1000;lunaCampaign.paintCinemaSkip();});assert(await cue.evaluate(e=>e.classList.contains('is-visible')));assert(Number(await cue.locator('[role=progressbar]').getAttribute('aria-valuenow'))>35);
   await p.keyboard.up('Space');assert.equal(await cue.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');
   // Only a real hold can complete skipping; introduction alone never does.
   await p.keyboard.down('Space');await p.evaluate(()=>{lunaCampaign.cinemaHoldStart=performance.now()-2010;stepSkipIntro(0);});await p.keyboard.up('Space');
   await p.waitForFunction(()=>!LunaCutsceneLibrary.active);assert.equal(await p.evaluate(()=>lunaCampaign.cinema),null);
  }
  // Opening is deliberately non-skippable, including its tutorial/contact.
  await p.evaluate(()=>LunaCutsceneLibrary.play(lunaCampaign,'opening-a'));assert(await p.locator('.campaign-skip').isHidden());
  await p.keyboard.down('Space');await p.evaluate(()=>stepSkipIntro(.05));await p.keyboard.up('Space');assert(await p.locator('.campaign-skip').isHidden());
  await p.evaluate(()=>LunaCutsceneLibrary.close());assert.deepEqual(errors,[]);
  console.log('PASS studio/legacy: automatic 1.5s hint, fade, pause/redraw persistence, 300ms grace, 2s hold skip, fresh scene replay; no hint on unskippable opening');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
