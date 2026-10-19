const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.evaluate(()=>lunaCampaign.newGame('A'));
  await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  await p.evaluate(()=>{lunaCampaign.cinema.time=lunaCampaign.cinema.scene.end-.01;});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
  await p.keyboard.press('KeyE');
  const selector='[data-story-id="outside_day0_documentary_ambient"]';
  await p.locator(selector).waitFor({state:'visible'});
  assert.deepEqual(await p.evaluate(()=>{
   const s=outsidePlaytest.model.backgroundStory.channels.get(LunaOutsideTV.documentaryId);
   return {auto:s.speech.auto,blocking:s.blocking,lines:s.speech.rows.map(r=>r.text)};
  }),{auto:true,blocking:false,lines:await p.evaluate(()=>StudioOpening.source.tv)});
  const style=await p.locator(selector).evaluate(el=>({font:getComputedStyle(el.querySelector('p')).fontSize,padding:getComputedStyle(el).padding,max:getComputedStyle(el).maxWidth}));
  assert.deepEqual(style,{font:'15px',padding:'8px 11px',max:'320px'});
  await p.screenshot({path:'/private/tmp/day0-a-tv-ambient.png'});
  // Every sentence advances automatically, then the broadcast loops.
  assert.equal(await p.evaluate(()=>{
   const m=outsidePlaytest.model,id=LunaOutsideTV.documentaryId;
   for(let i=0;i<33;i++){m.backgroundStory.channels.get(id).speech.elapsed=99;LunaOutsideTV.tick(m,.01);}
   LunaOutsideTV.tick(m,.01);return m.backgroundStory.channels.get(id).speech.index;
  }),0);
  // Keep this new broadcast out of later days, QA, and the street.
  for(const mode of ['day1','qa','street']){
   assert.equal(await p.evaluate(mode=>{
    const m=outsidePlaytest.model,c=lunaCampaign,day=m.config.day,scene=m.scene;
    if(mode==='day1')m.config.day=1;if(mode==='qa')m.qa={};if(mode==='street')m.scene='street';
    LunaOutsideTV.tick(m,.01);const present=m.backgroundStory.channels.has(LunaOutsideTV.documentaryId);
    c.storyVersion='A';m.config.day=day;m.scene=scene;m.qa=null;LunaOutsideTV.tick(m,.01);return present;
   },mode),false,mode);
  }
  // Real interaction enters the manual documentary, not an options overlay.
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=1.22;m.updateNear();});
  await p.keyboard.press('KeyE');
  await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition);
  assert(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue').every(c=>c.wait)));
  await p.waitForFunction(()=>!!lunaCampaign.cinema.dialogueWait);
  const id=await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id);
  await p.waitForTimeout(1600);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),id);
  await p.keyboard.press('KeyE');await p.keyboard.press('KeyE');
  await p.waitForFunction(id=>lunaCampaign.cinema.dialogueWait?.id!==id,id);
  await p.evaluate(()=>lunaCampaign.finishCinema(true));
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
  await p.locator(selector).waitFor({state:'visible'});
  // Register the objective using the actual first-exit dialogue.
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=m.targets().find(t=>t.id==='exit').x;m.updateNear();});
  await p.keyboard.press('KeyE');await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='day0_first_home_exit');
  for(let i=0;i<2;i++){await p.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;});await p.keyboard.press('KeyE');}
  assert.equal(await p.evaluate(()=>barGame.progress.objectives.first_commute.status),'active');
  // Run the real bar door transition/commit, without walking the whole map.
  await p.evaluate(()=>{const c=lunaCampaign;c.outside.exit(true);c.startBar(0,c.session.carry);});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&lunaCampaign.session.route==='bar'&&!lunaCampaign.doorTransition);
  assert.deepEqual(await p.evaluate(()=>({
   progress:barGame.progress.objectives.first_commute.status,
   checkpoint:lunaCampaign.session.checkpoint.objectives.first_commute.status,
   carry:lunaCampaign.session.carry.objectives.first_commute.status,
   count:LunaStoryNotices.pending.filter(n=>n.kind==='goal-complete'&&n.title==='첫 출근하기!').length
  })),{progress:'completed',checkpoint:'completed',carry:'completed',count:1});
  await p.waitForFunction(()=>{
   const el=document.querySelector('.story-notice-event');
   return el&&!el.hidden&&el.textContent.includes('목표 달성')&&el.textContent.includes('첫 출근하기!');
  });
  await p.screenshot({path:'/private/tmp/day0-a-goal-complete.png'});
  assert.equal(await p.evaluate(()=>LunaStoryNotices.completeGoal(barGame.progress,'first_commute')),false);
  await p.evaluate(()=>lunaCampaign.session.retry());
  assert.equal(await p.evaluate(()=>barGame.progress.objectives.first_commute.status),'completed');
  // The new tip renders the existing +100 currency notification exactly once.
  await p.waitForTimeout(2700);
  const before=await p.evaluate(()=>{
   const g=barGame,i=g.story.steps.findIndex(s=>s.dialogue_id==='dlg_day0_revision_20261013_port_tip_offer');
   g.dialogue=null;g.choice=null;g.transition=0;g.tutorial=null;g.story.index=i;g.pump();return g.progress.money;
  });
  await p.evaluate(()=>{barGame.advance();barGame.advance();});
  assert.equal(await p.evaluate(()=>barGame.progress.money),before+100);
  await p.locator('.currency-income').waitFor({state:'visible'});
  assert.equal(await p.locator('.currency-delta').textContent(),'+100');
  await p.screenshot({path:'/private/tmp/day0-a-port-tip.png'});
  assert.equal(await p.evaluate(()=>{
   const g=barGame;g.dialogue=null;g.story.index=g.story.steps.findIndex(s=>s.row_id==='day0_revision_20261013_port_tip_reward');g.pump();return g.progress.money;
  }),before+100);
  assert.deepEqual(errors,[]);
  console.log('DAY0_A_UI_OK: compact TV loop / scope isolation / manual TV interaction / objective completion + retry / one-time +100 tip.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
