const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.evaluate(()=>lunaCampaign.newGame());
  await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
  await p.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(c=>c.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&outsidePlaytest.model.controlsTutorial);
  const panel=p.locator('.outside-controls-tutorial');
  assert.equal(await panel.locator('.controls-close').count(),0);
  await p.keyboard.down('KeyD');await p.waitForTimeout(250);assert(await panel.isVisible());
  assert.equal(await p.evaluate(()=>!!barGame.progress.objectives?.first_commute),false);
  await p.waitForTimeout(1900);await p.keyboard.down('KeyD');assert(await panel.isVisible());
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);
  await p.keyboard.up('KeyD');await p.screenshot({path:'/private/tmp/day0-controls-lock.png'});
  await p.keyboard.down('KeyE');assert.equal(await panel.getAttribute('data-step'),'1');await p.waitForTimeout(400);await p.keyboard.down('KeyE');assert(await panel.isVisible());await p.keyboard.up('KeyE');
  assert.equal(await p.evaluate(()=>!!barGame.progress.objectives?.first_commute),false);
  await p.keyboard.press('KeyE');assert(await panel.isHidden());
  const goal=await p.evaluate(()=>({goal:barGame.progress.objectives.first_commute,carry:lunaCampaign.session.carry.objectives.first_commute,scene:outsidePlaytest.model.scene,transition:outsidePlaytest.model.transition}));
  assert.equal(goal.goal.status,'active');assert.equal(goal.goal.title,'첫 출근하기!');assert.deepEqual(goal.goal,goal.carry);assert.equal(goal.scene,'home');assert.equal(goal.transition,null);
  // Reopening the tutorial must not enqueue the same goal again.
  const count=await p.evaluate(()=>LunaStoryNotices.pending.filter(n=>n.title==='첫 출근하기!').length);
  await p.evaluate(()=>outsidePlaytest.showControlsTutorial());await p.waitForTimeout(2100);await p.keyboard.press('KeyE');await p.waitForTimeout(350);await p.keyboard.press('KeyE');
  assert.equal(await p.evaluate(()=>LunaStoryNotices.pending.filter(n=>n.title==='첫 출근하기!').length),count);
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=-1.5;m.updateNear();});await p.keyboard.press('KeyE');
  await p.waitForFunction(()=>outsidePlaytest.model.transition?.barArrival);
  await p.waitForFunction(()=>!!outsidePlaytest.model.barArrival);
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.level),0);
  const x=await p.evaluate(()=>outsidePlaytest.model.x);
  await p.keyboard.down('KeyA');await p.keyboard.press('KeyE');await p.waitForTimeout(500);await p.keyboard.up('KeyA');
  assert(await p.evaluate(x=>outsidePlaytest.model.x>x,x));assert.equal(await p.evaluate(()=>outsidePlaytest.model.near),null);
  await p.screenshot({path:'/private/tmp/day0-bar-walk.png'});
  await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='day0_bar_arrival');
  await p.waitForTimeout(1000);
  assert.equal(await p.locator('.outside-speech-text').textContent(),"바 '언노운' 여기인가보네.");
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.anim),'idle');
  await p.keyboard.down('KeyD');await p.waitForTimeout(150);await p.keyboard.up('KeyD');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),0);
  await p.screenshot({path:'/private/tmp/day0-bar-arrival.png'});
  await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.blocking),false);
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.near),null,'Stop at scrap pile, outside the bar interaction radius');
  // Both edges stop the player, use manual dialogue, and avoid a repeat loop.
  for(const [edge,key,other] of [[-.9,'KeyA','KeyD'],[2.15,'KeyD','KeyA']]){
   await p.evaluate(edge=>{const m=outsidePlaytest.model;m.x=edge;m.commuteBoundarySide=0;m.updateNear();},edge);
   await p.keyboard.down(key);await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='day0_commute_boundary');await p.keyboard.up(key);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),edge);
   await p.evaluate(()=>outsidePlaytest.model.story.speech.elapsed=99);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.line.text),'지금은 언노운 가게로 출근해야해.');
   await p.keyboard.press('KeyE');await p.keyboard.down(key);await p.waitForTimeout(250);await p.keyboard.up(key);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),edge);
   await p.keyboard.down(other);await p.waitForTimeout(300);await p.keyboard.up(other);assert.notEqual(await p.evaluate(()=>outsidePlaytest.model.x),edge);
  }
  const exclusions=await p.evaluate(()=>{
   const version=lunaCampaign.storyVersion,results=[];
   for(const storyVersion of ['A'])for(const day of [0,1,2])for(const flow of ['in','out']){
    lunaCampaign.storyVersion=storyVersion;const m=new LunaOutside.Model({place:'home',day,flow});
    results.push({storyVersion,day,flow,restricted:m.isFirstCommute()});
   }
   lunaCampaign.storyVersion=version;return results;
  });
  for(const v of exclusions)assert.equal(v.restricted,v.storyVersion==='A'&&v.day===0&&v.flow==='in',JSON.stringify(v));
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=0;m.commuteBoundarySide=0;m.updateNear();});
  await p.keyboard.down('KeyD');await p.waitForFunction(()=>outsidePlaytest.model.near?.id==='bar');await p.keyboard.up('KeyD');
  assert(await p.evaluate(()=>outsidePlaytest.model.x>.6),'Player walks the remaining distance to the door');
  await p.keyboard.press('KeyE');
  await p.waitForFunction(()=>!outsidePlaytest.active&&barGame.progress.objectives?.first_commute?.status==='completed',null,{timeout:30000});
  assert.deepEqual(errors,[]);console.log('PASS 2s tutorial lock / two pages / held-key protection / no X / goal on dismissal / fade and scripted arrival / manual speech / both boundaries / bar goal completion / version and day exclusions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
