const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  for(const answer of [1,2]){
   await page.evaluate(()=>{window.night2Finished=false;LunaFocusSettings.setEnabled(false);lunaCampaign.session.day=2;lunaCampaign.scene('night2','2일차 테라스','terrace',()=>{window.night2Finished=true;lunaCampaign.screen('developer');});});
   await page.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
   assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows.length),27);
   assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows[0].stage),'luna-alone');
   assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px 65px 0px 0px)','Hide Chris during the chip-reading monologue');
   await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<2;i++){c.dialog.chars=1e5;c.next();}});
   await page.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
   assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows.length),39);
   assert.equal(await page.evaluate(()=>lunaCampaign.dialog.johnnyView.g.seats.R.actor),'tom');
   await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<100&&c.dialog?.background==='johnny-memory'&&!c.memoryTransition;i++){c.dialog.chars=1e5;c.next();}});
   await page.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
   assert(await page.evaluate(()=>barGame.progress.flags.campaign_observation));
   assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px)','Chris is visible after the memory');
   assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows[lunaCampaign.dialog.index].text),'... 아, 크리스.');
   await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<30&&c.view==='scene';i++){c.dialog.chars=1e5;c.next();}});
   await page.locator('.world-choices button').first().waitFor();
   assert.equal(await page.locator('.world-choices button').count(),2);
   await page.waitForTimeout(850);await page.locator('[data-choice="'+answer+'"]').click();
   const seen=await page.evaluate(()=>{const c=lunaCampaign,text=[];for(let i=0;i<50&&c.dialog;i++){text.push(c.dialog.rows[c.dialog.index]?.text);c.dialog.chars=1e5;c.next();}return text;});
   assert.equal(seen.some(t=>t?.includes('어떻게 아셨나요?')),answer===1);
   assert.equal(seen.some(t=>t?.includes('허, 그 자식.')),answer===2);
   assert(await page.evaluate(()=>window.night2Finished));
  }
  assert.deepEqual(errors,[]);
  console.log('KIHYUN_STORY_UI_OK: Luna-alone chip, 39-line memory, Chris return, both visible choices and completion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
