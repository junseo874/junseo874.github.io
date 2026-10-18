const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   outsidePlaytest.exit(true);lunaCampaign.screen('developer');
   Object.assign(outsidePlaytest.config,{place:'home',flow:'out',day:0,variant:'original'});
   await outsidePlaytest.start();const m=outsidePlaytest.model;m.wakeAtSofa();m.story.cancel();m.backgroundStory.cancel();outsidePlaytest.refreshHUD();
  });
  const baseline=await page.evaluate(()=>JSON.stringify({progress:barGame.progress,storage:{...localStorage},day:lunaCampaign.session.day}));
  const choices=page.locator('.world-choices');
  await page.keyboard.press('KeyE');await choices.waitFor({state:'visible'});
  assert.deepEqual(await choices.locator('button').allTextContents(),['수면','저장','취소']);
  assert.equal(await page.locator('.outside-overlay').isVisible(),false);
  const x=await page.evaluate(()=>outsidePlaytest.model.x);
  await page.keyboard.down('KeyA');await page.waitForTimeout(120);await page.keyboard.up('KeyA');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.x),x);
  await page.keyboard.press('KeyW');assert.equal(await choices.locator('.is-selected').textContent(),'취소');
  await page.keyboard.press('KeyE');await choices.waitFor({state:'hidden'});
  await page.keyboard.press('KeyE');assert.equal(await choices.locator('.is-selected').textContent(),'수면');
  await page.keyboard.press('KeyS');await page.keyboard.press('KeyE');
  const saved=page.locator('.outside-save-feedback');await saved.waitFor({state:'visible'});
  assert.equal(await saved.textContent(),'저장 완료!');assert.equal(await choices.isVisible(),false);
  const box=await saved.boundingBox();assert(box.x>1000&&box.y>650,'Feedback is bottom-right');
  assert.equal(await page.evaluate(()=>JSON.stringify({progress:barGame.progress,storage:{...localStorage},day:lunaCampaign.session.day})),baseline);
  await page.screenshot({path:'/private/tmp/sofa-save-feedback.png'});
  await saved.waitFor({state:'hidden',timeout:4000});
  await page.keyboard.press('KeyE');await page.waitForTimeout(350);await page.screenshot({path:'/private/tmp/sofa-choices.png'});
  await page.mouse.wheel(0,100);assert.equal(await choices.locator('.is-selected').textContent(),'저장');
  await page.keyboard.press('Escape');assert.equal(await choices.isVisible(),false);
  await page.keyboard.down('KeyA');await page.waitForTimeout(120);await page.keyboard.up('KeyA');
  assert(await page.evaluate(()=>outsidePlaytest.model.x)<x,'Movement resumes after cancel');
  await page.evaluate(()=>{outsidePlaytest.model.wakeAtSofa();outsidePlaytest.refreshHUD();});
  await page.keyboard.press('KeyE');await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>!!lunaCampaign.outsideSleep||lunaCampaign.view==='scene');
  assert.equal(await choices.isVisible(),false,'Sleep closes choices and starts existing night flow');
  // Main campaign follows the same menu and invokes the existing bedtime flow.
  await page.evaluate(async()=>{
   const c=lunaCampaign;c.cancelMemoryTransition();c.cancelDayTransition();c.disposeCinema();c.dialog=null;c.outsideSleep=null;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(0);c.session.route='out';c.nightStarted=false;
   Object.assign(c.outside.config,{day:0,flow:'out',place:'home'});await c.outside.start();c.screen('game');c.outside.model.wakeAtSofa();c.outside.refreshHUD();
  });
  await page.keyboard.press('KeyE');await choices.waitFor({state:'visible'});await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>lunaCampaign.nightStarted),true);
  assert.equal(await choices.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS sofa choices: navigation/wrap, movement lock, cancel/reopen, feedback expiry, no save writes, developer and campaign sleep.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
