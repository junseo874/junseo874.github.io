const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await p.locator('.updates-confirm').click();
  assert.equal(await p.locator('#outside-day,#outside-place,#outside-flow').count(),0);
  await p.screenshot({path:'/private/tmp/outside-entry-lobby.png'});
  const action=a=>p.locator('[data-outside-action="'+a+'"]');
  const state=()=>p.evaluate(()=>{const m=outsidePlaytest.model;return {day:m.config.day,flow:m.config.flow,scene:m.scene,x:m.x,y:m.y,level:m.level,qa:!!m.qa,money:barGame.progress.money};});
  await action('start').click();await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  assert(await p.locator('.outside-entry-hint').isVisible());
  let s=await state();assert.equal(s.day,0);assert.equal(s.flow,'out');assert.equal(s.scene,'street');
  await p.keyboard.down('KeyD');await p.waitForTimeout(150);await p.keyboard.up('KeyD');assert.deepEqual(await state(),s);
  await p.screenshot({path:'/private/tmp/outside-entry-hint.png'});
  await p.keyboard.press('KeyP');assert(await p.locator('.outside-dev-console').isVisible());assert.equal(await p.locator('.outside-entry-hint').count(),0);
  await action('dev-plus').click();const money=(await state()).money;
  await p.evaluate(()=>barGame.progress.flags.entry_test=true);
  for(const day of [1,2,3,0]){
   await action('dev-day-'+day).click();assert.equal((await state()).day,day);assert.equal((await state()).x,s.x);assert.equal(await action('dev-day-'+day).getAttribute('aria-pressed'),'true');
   for(const flow of ['in','out']){await action('dev-flow-'+flow).click();assert.equal((await state()).flow,flow);assert.equal((await state()).money,money);}
  }
  assert(await p.evaluate(()=>barGame.progress.flags.entry_test));
  for(const dest of ['elevator','bar','home']){await action('dev-'+dest).click();assert.equal((await state()).scene,dest==='home'?'home':'street');}
  s=await state();await action('dev-day-2').click();assert.equal((await state()).x,s.x);assert.equal((await state()).scene,'home');
  await p.waitForTimeout(350);await p.screenshot({path:'/private/tmp/outside-entry-console.png'});
  await action('dev-day-99').click();assert((await state()).qa);assert.equal((await state()).day,99);
  for(const dest of ['home','elevator','bar'])assert(await action('dev-'+dest).isDisabled());
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>lunaQA.opened),false);
  assert(await p.evaluate(()=>document.activeElement.closest('.outside-dev-console')!==null));
  await p.keyboard.press('KeyP');await p.keyboard.press('Tab');assert(await p.evaluate(()=>lunaQA.opened));
  await p.selectOption('[data-qa-field="outsideCase"]','lift-up');await p.locator('[data-qa="outside"]').click();
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.qa.caseId),'lift-up');
  await p.screenshot({path:'/private/tmp/outside-entry-qa.png'});
  await p.keyboard.press('KeyP');await action('dev-day-1').click();
  assert.equal((await state()).qa,false);assert.equal((await state()).scene,'home');assert.equal((await state()).x,s.x);assert.equal((await state()).money,money);
  await action('dev-elevator').click();await p.keyboard.press('KeyP');await p.keyboard.press('KeyE');
  assert(await p.evaluate(()=>!!outsidePlaytest.model.ride));await p.keyboard.press('KeyP');await action('dev-day-3').click();
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.ride),null);assert.equal((await state()).level,0);assert.equal((await state()).y,-.7);
  await p.setViewportSize({width:800,height:600});await action('dev-plus').click();
  const box=await p.locator('.outside-dev-console').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=800&&box.y+box.height<=600);
  await p.keyboard.press('KeyP');await p.keyboard.press('Escape');await action('exit').click();await action('start').click();
  await p.waitForFunction(()=>!outsidePlaytest.loading);assert(await p.locator('.outside-entry-hint').isVisible());assert.equal((await state()).day,0);
  await p.keyboard.press('Space');assert.equal(await p.locator('.outside-entry-hint').count(),0);assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.blocking),false);
  // Main uses the same 0–3 day console; QA 99 remains developer-only.
  await p.evaluate(async()=>{outsidePlaytest.exit(true);lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:false});Object.assign(outsidePlaytest.config,{day:1,flow:'in',place:'bar'});await outsidePlaytest.start();});
  assert.equal(await p.locator('.outside-entry-hint').count(),0);await p.keyboard.press('KeyP');assert(await p.locator('.outside-dev-console').isVisible());assert(await p.locator('.outside-dev-days-section').isVisible());assert.equal(await action('dev-day-99').isVisible(),false);
  await p.evaluate(()=>outsidePlaytest.devAction('dev-day-99'));assert.equal((await state()).day,1);
  await action('dev-flow-out').click();assert.equal((await state()).flow,'out');
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
  await p.evaluate(()=>resourceReview.launch({type:'exterior',id:'entry-hint'},'탐색 시작 / P 설정 안내'));
  const frame=p.frames().find(f=>f.url().includes('resourceReview=1'));await frame.locator('.outside-entry-hint').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);console.log('OUTSIDE_ENTRY_OK: clean launch, P onboarding/freeze, days/routes/location/money, QA isolation/Tab/return, ride reset, viewport, main regression, resource preview');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
