const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{LunaFocusSettings.setEnabled(false);lunaCampaign.session.day=2;lunaCampaign.scene('night2','2일차 테라스','terrace',()=>{window.night2Finished=true;lunaCampaign.screen('developer');});});
  await page.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px 65px 39px 0px)');
  await page.screenshot({path:'/private/tmp/kihyun-terrace-alone.png'});
  await page.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.locator('.johnny-memory').count(),1);
  assert.equal(await page.evaluate(()=>lunaCampaign.dialog.rows.length),39);
  await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<100&&c.dialog?.background==='johnny-memory'&&!c.memoryTransition;i++){c.dialog.chars=1e5;c.next();}});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.locator('.terrace-characters').evaluate(el=>el.style.clipPath),'inset(0px 0px 39px)');
  assert(await page.evaluate(()=>barGame.progress.flags.campaign_observation));
  await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<20&&c.view==='scene';i++){c.dialog.chars=1e5;c.next();}});
  assert.equal(await page.evaluate(()=>lunaCampaign.view),'scene-choice');
  assert.equal(await page.locator('.world-choices button').count(),2);
  assert.match(await page.locator('.terrace-speech p').textContent(),/구했다고\? 어디서\?/);
  await page.screenshot({path:'/private/tmp/kihyun-terrace-choice.png'});
  await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>lunaCampaign.view),'scene-choice','entry guard consumes repeated advance');
  await page.waitForTimeout(850);await page.keyboard.press('KeyS');await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>lunaCampaign.view),'scene');
  assert.equal(await page.evaluate(()=>barGame.progress.flags.night2_answer_1),false);
  assert.match(await page.evaluate(()=>lunaCampaign.dialog.rows[lunaCampaign.dialog.index].text),/^시바한테서요/);
  // Revisit the same choice using the other branch; no blank speech or stale input.
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.findIndex(r=>r.type==='choice');c.dialog.chars=0;c.continueScene();});
  await page.waitForTimeout(850);await page.keyboard.press('KeyW');await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>barGame.progress.flags.night2_answer_1),true);
  assert.match(await page.evaluate(()=>lunaCampaign.dialog.rows[lunaCampaign.dialog.index].text),/^자신이 팔았다고/);
  await page.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<50&&c.dialog;i++){c.dialog.chars=1e5;c.next();}});
  assert(await page.evaluate(()=>window.night2Finished));
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:99,qaCase:'runtime:night2'});await outsidePlaytest.start();});
  for(const selected of ['1','2']){
   const qa=await page.evaluate(selected=>{
    const m=outsidePlaytest.model;m.start({day:99,qaCase:'runtime:night2'});const before=JSON.stringify(barGame.progress);
    LunaOutsideQA.interact(m,LunaOutsideQA.target(m));for(let i=0;i<20&&m.qa.runtime;i++)LunaOutsideQA.tick(m,.1);
    for(let i=0;i<100&&!m.story.speech?.choice;i++){m.story.speech.elapsed=1e5;m.story.advance();}
    const options=LunaOutsideQA.choiceView(m).options;LunaOutsideQA.choose(m,selected);
    return{options:options.length,text:m.story.speech.line.text,flag:m.qa.scriptProgress.flags.night2_answer_1,isolated:before===JSON.stringify(barGame.progress)};
   },selected);
   assert.equal(qa.options,2);assert.equal(qa.flag,selected==='1');assert(qa.isolated);
   assert(qa.text.startsWith(selected==='1'?'자신이 팔았다고':'시바한테서요'));
  }
  assert.deepEqual(errors,[]);
  console.log('KIHYUN_STORY_UI_OK: solo terrace, actual Johnny memory, return with Chris, retained speech, two choice branches and 800ms guard');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
