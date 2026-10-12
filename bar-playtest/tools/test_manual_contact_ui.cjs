const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();
  await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
  const lines=await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.track==='phone-lines'));
  assert.equal(lines.length,6);assert(lines.every(c=>c.wait));
  assert(await p.evaluate(()=>!lunaCampaign.cinema.scene.clips.some(c=>c.actor==='route')&&!lunaCampaign.cinema.scene.actors.route));
  assert(await p.evaluate(()=>!barGame.progress.objectives?.first_commute));
  await p.evaluate(start=>{const c=lunaCampaign;c.finishCinema(true);if(c.cinema.time!==c.cinema.skipUntil)throw Error('dream skip');c.cinema.time=start-.01;c.tick(.02);},lines[0].start);
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),lines[0].id);
  await p.keyboard.press('KeyE');assert(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.revealed));
  // Holding and browser key repeats must not acknowledge another line.
  await p.evaluate(()=>{const c=lunaCampaign;c.key({code:'KeyE',repeat:true});for(let i=0;i<500;i++)c.tick(.05);});
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),lines[0].id);
  await p.keyboard.press('Escape');const age=await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.age);
  await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.age),age);
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),lines[0].id);
  await p.locator('.campaign-stage').screenshot({path:'/private/tmp/manual-contact-dialogue.png'});
  for(let i=0;i<lines.length;i++){
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),lines[i].id);
   await p.evaluate(()=>{for(let j=0;j<300;j++)lunaCampaign.tick(.05);});
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),lines[i].id);
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),lines[i].start);
   await p.keyboard.press(['KeyE','Space','Enter'][i%3]);
   if(i<lines.length-1)await p.waitForFunction(id=>lunaCampaign.cinema?.dialogueWait?.id===id,lines[i+1].id);
  }
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
  await p.waitForFunction(()=>document.querySelector('.story-notice[data-kind="goal-new"]')?.textContent.includes('첫 출근하기!'));
  assert.deepEqual(await p.evaluate(()=>barGame.progress.objectives.first_commute),{title:'첫 출근하기!',status:'active'});
  assert.deepEqual(await p.evaluate(()=>lunaCampaign.session.carry.objectives.first_commute),{title:'첫 출근하기!',status:'active'});
  assert(await p.locator('.outside-controls-tutorial').isVisible());
  await p.waitForTimeout(400);await p.screenshot({path:'/private/tmp/first-commute-goal.png'});
  const serial=await p.locator('.story-notice[data-kind="goal-new"]').getAttribute('data-serial');
  assert.equal(await p.evaluate(()=>LunaStoryNotices.startGoal(barGame.progress,'first_commute','첫 출근하기!')),false);
  // TV retains automatic playback/skip and cannot register the first goal again.
  await p.evaluate(()=>lunaCampaign.playDayZeroTV(outsidePlaytest.model));
  await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
  assert(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue').every(c=>!c.wait)));
  await p.evaluate(()=>lunaCampaign.finishCinema(true));
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
  assert.equal(await p.locator('.story-notice[data-kind="goal-new"]').getAttribute('data-serial'),serial);
  assert.deepEqual(errors,[]);console.log('PASS six manual lines / reveal / repeated key / ESC resume / dream-only skip / no route card / first commute goal / TV unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
