const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{window.shiftFixture=({sale=1200,tip=180,refund=60,before=2320,upkeep=400,variant='original',lang='ko',orders=true}={})=>{
   const g=barGame;g.reset(1,'practice',1,false,{variant});lunaCampaign.ui.variant=variant;g.lang=lang;g.progress.money=before;g.setUpkeepOverride(upkeep);
   g.transactions=orders?[{sale,tip,refund,net:sale+tip-refund,served:'gin_tonic',grade:'excellent',match:true}]:[];g.finishDay();lunaCampaign.render(true);
  };shiftFixture();});
  const value=key=>p.locator(`[data-shift-value="${key}"]`).innerText();
  await p.locator('.end-shift').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);
  assert.equal((await value('income')).replace(/\s/g,''),'+1,320G');assert.equal((await value('result')).replace(/\s/g,''),'1,920G');
  assert.equal(await p.locator('.end-shift table,.end-shift [data-act="export"]').count(),0);
  assert.equal(await p.locator('.end-shift button').count(),1);
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'confirmSettlement');
  await p.screenshot({path:'/private/tmp/settlement-redesign.png'});
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>barGame.screen),'settlement');assert.equal(await p.evaluate(()=>barGame.overlay),null);
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'confirmSettlement');
  await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>barGame.progress.money),1920);assert.equal(await p.evaluate(()=>barGame.dailySettlement.status),'paid');assert.equal(await p.locator('[data-act="confirmSettlement"]').count(),0);
  assert.equal(await p.evaluate(()=>barGame.confirmDailySettlement()),false,'Payment is idempotent');await p.screenshot({path:'/private/tmp/settlement-paid.png'});
  await p.locator('.end-shift [data-act="setup"]').click();assert.equal(await p.evaluate(()=>barGame.phase),'ready');
  await p.evaluate(()=>shiftFixture({before:99,upkeep:100,orders:false}));assert.equal((await value('result')).replace(/\s/g,''),'1G');assert((await p.locator('#shift-note').innerText()).includes('영업이 종료'));
  await p.locator('[data-act="confirmSettlement"]').click();assert.equal(await p.evaluate(()=>barGame.screen),'gameover');assert.equal(await p.evaluate(()=>barGame.progress.money),99);assert.equal(await p.locator('.shift-income').count(),0);
  await p.screenshot({path:'/private/tmp/settlement-shortfall.png'});await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'setup');await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'retryDay');
  await p.keyboard.press('Enter');assert.notEqual(await p.evaluate(()=>barGame.screen),'gameover');
  for(const variant of ['original','gpt'])for(const lang of ['ko','en']){
   await p.evaluate(([variant,lang])=>shiftFixture({sale:0,tip:0,refund:0,before:300,upkeep:0,variant,lang,orders:false}),[variant,lang]);
   assert.equal(await p.locator('[data-shift-value="refund"]').count(),0);assert.equal((await value('income')).replace(/\s/g,''),'0G');await p.locator('[data-act="confirmSettlement"]').click();assert.equal(await p.evaluate(()=>barGame.progress.money),300);
  }
  for(const [width,height]of [[960,540],[600,800],[1920,1080]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(150);await p.evaluate(()=>shiftFixture({before:1234567,upkeep:99}));const box=await p.locator('.end-shift').boundingBox();assert(box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,JSON.stringify(box));assert(await p.locator('.end-shift').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
  }
  await p.setViewportSize({width:1280,height:720});await p.evaluate(()=>{const c=lunaCampaign;c.session.uninstall();c.session.install();c.session.beginDay(1);c.screen('game');const g=barGame;g.overlay=null;g.pendingDailyUnlocks=false;g.progress.money=1000;g.setUpkeepOverride(100);g.finishDay();c.render(true);});
  assert.equal(await p.locator('[data-act="confirmSettlement"]').innerText(),'정산하고 퇴근하기\n→');await p.screenshot({path:'/private/tmp/settlement-main.png'});
  await p.locator('[data-act="confirmSettlement"]').click();await p.waitForFunction(()=>lunaCampaign.session.route==='out');assert.equal(await p.evaluate(()=>barGame.progress.money),900);await p.waitForFunction(()=>outsidePlaytest.active&&lunaCampaign.view==='game'&&!lunaCampaign.doorTransition,null,{timeout:30000});assert.equal(await p.evaluate(()=>outsidePlaytest.config.flow),'out');assert.equal(await p.evaluate(()=>barGame.progress.money),900);
  assert.deepEqual(errors,[]);console.log('SETTLEMENT_UI_OK: actual payment once, shortfall without deduction, retry, zero orders/upkeep, both variants/languages, focused keyboard popup, responsive bounds, real main-story commute-out');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
