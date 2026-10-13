const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.evaluate(()=>lunaCampaign.newGame());
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  // Finish the contact cutscene through its real return transition.
  await page.evaluate(()=>{const c=lunaCampaign;c.cinema.time=c.cinema.scene.end-.01;});
  await page.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.evaluate(()=>!!barGame.progress.objectives?.first_commute),false);
  await page.keyboard.press('KeyE'); // Dismiss the controls tutorial, consuming this input.
  await page.evaluate(()=>{const m=outsidePlaytest.model,t=m.targets().find(t=>t.id==='exit');m.x=t.x;m.updateNear();});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='day0_first_home_exit');
  const hasGoal=()=>page.evaluate(()=>!!barGame.progress.objectives?.first_commute);
  assert.equal(await hasGoal(),false);
  await page.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;});await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.story.speech.index),1);assert.equal(await hasGoal(),false);
  // Completing typing alone must not register the goal; the last line must be dismissed.
  await page.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;});assert.equal(await hasGoal(),false);
  await page.keyboard.press('KeyE');
  const state=await page.evaluate(()=>({goal:barGame.progress.objectives.first_commute,carry:lunaCampaign.session.carry.objectives.first_commute,speech:outsidePlaytest.model.story.speech,notices:LunaStoryNotices.pending.filter(n=>n.title==='첫 출근하기!').length,restart:outsidePlaytest.model.firstCommuteDirections()}));
  assert.equal(state.speech,null);assert.equal(state.goal.title,'첫 출근하기!');assert.equal(state.goal.status,'active');assert.deepEqual(state.carry,state.goal);assert.equal(state.notices,1);assert.equal(state.restart,false);
  // Generic completion hooks must not fire on cancellation or twice on extra input.
  const hooks=await page.evaluate(()=>{let count=0;const s=new LunaOutsideStory.Story({updateNear(){}});s.beginRows('cancel',{},[{type:'say',actor:'luna',text:'test'}],false,()=>count++);s.cancel();const canceled=count;s.beginRows('complete',{},[{type:'say',actor:'luna',text:'test'}],false,()=>count++);s.advance();s.advance();s.advance();return {canceled,count};});
  assert.deepEqual(hooks,{canceled:0,count:1});assert.deepEqual(errors,[]);
  console.log('PASS: no goal after contact or during doorway dialogue; final key dismiss registers one popup and persists carry; no repeat/cancel notifications.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
