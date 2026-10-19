const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.evaluate(()=>lunaCampaign.newGame());
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  // Finish the contact cutscene through its real return transition.
  await page.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(c=>c.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
  await page.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.evaluate(()=>!!barGame.progress.objectives?.first_commute),false);
  await page.keyboard.press('KeyE'); // During the lock this must not dismiss or register a goal.
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.controlsTutorial),true);
  const hasGoal=()=>page.evaluate(()=>!!barGame.progress.objectives?.first_commute);
  assert.equal(await hasGoal(),false);
  await page.waitForTimeout(1600);assert.equal(await hasGoal(),false);
  await page.keyboard.press('KeyE');
  const state=await page.evaluate(()=>({goal:barGame.progress.objectives.first_commute,carry:lunaCampaign.session.carry.objectives.first_commute,speech:outsidePlaytest.model.story.speech,notices:LunaStoryNotices.pending.filter(n=>n.title==='첫 출근하기!').length,restart:outsidePlaytest.model.firstCommuteDirections()}));
  assert.equal(state.speech,null);assert.equal(state.goal.title,'첫 출근하기!');assert.equal(state.goal.status,'active');assert.deepEqual(state.carry,state.goal);assert.equal(state.notices,1);assert.equal(state.restart,false);
  // Generic completion hooks must not fire on cancellation or twice on extra input.
  const hooks=await page.evaluate(()=>{let count=0;const s=new LunaOutsideStory.Story({updateNear(){}});s.beginRows('cancel',{},[{type:'say',actor:'luna',text:'test'}],false,()=>count++);s.cancel();const canceled=count;s.beginRows('complete',{},[{type:'say',actor:'luna',text:'test'}],false,()=>count++);s.advance();s.advance();s.advance();return {canceled,count};});
  assert.deepEqual(hooks,{canceled:0,count:1});assert.deepEqual(errors,[]);
  console.log('PASS: no goal during tutorial lock; tutorial dismissal registers one popup and persists carry; no repeat/cancel notifications.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
