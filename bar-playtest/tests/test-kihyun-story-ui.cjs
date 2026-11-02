const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{LunaFocusSettings.setEnabled(false);lunaCampaign.session.day=2;lunaCampaign.scene('night2','2일차 테라스','terrace',()=>{window.night2Finished=true;lunaCampaign.screen('developer');});});
  await page.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px 0px 39px)');
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows.length),13);
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows[0].text),'다행히 말씀해 주신 재료는 다 구한 것 같아요.');
  await page.screenshot({path:'/private/tmp/notion-terrace-two-people.png'});
  // Run the new linear terrace, without the obsolete purchase-source choice.
  await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<12;i++){c.dialog.chars=1e5;c.next();}});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows.length),56);
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.johnnyView.g.seats.R),null);
  await page.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
  assert(await page.evaluate(()=>lunaCampaign.dialog.johnnyView.g.seats.R?.actor==='tom'));
  await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<100&&c.dialog?.background==='johnny-memory'&&!c.memoryTransition;i++){c.dialog.chars=1e5;c.next();}});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px 0px 39px)');
  assert(await page.evaluate(()=>barGame.progress.flags.campaign_observation));
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows[lunaCampaign.dialog.index].text),'...');
  await page.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
  assert(await page.evaluate(()=>window.night2Finished));assert.deepEqual(errors,[]);
  console.log('KIHYUN_STORY_UI_OK: Notion 13-line terrace, both characters, 56-line memory, Tom appearance, return and completion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
