const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();});
  for(const route of ['pay','gear','resume-gear']){
   const before=await page.evaluate(route=>{
    const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood,p=barGame.progress,notices=LunaStoryNotices;
    notices.clear();Object.assign(p,{money:500,inventory:{gear_part:1},flags:{repairman_met:true},objectives:{}});
    lunaCampaign.session.carry={money:p.money,inventory:{...p.inventory},flags:{...p.flags},objectives:{}};
    m.start({day:1,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
    const target=()=>N.targets(m).find(t=>t.actor==='repair');m.x=target().x+.2;m.updateNear();
    N.interact(m,target());
    p.money=399;p.inventory.gear_part=0;
    if(m.story.choose('pay')||m.story.choose('gear')||notices.pending.length)throw Error('Invalid payment must not notify');
    p.money=500;p.inventory.gear_part=1;
    if(!m.story.choose(route==='pay'?'pay':'gear'))throw Error('Repair choice failed');
    if(notices.pending.length)throw Error('Payment must not notify before repair dialogue');
    if(route==='resume-gear'){
     m.story.cancel();if(notices.pending.length)throw Error('Cancellation must not notify');
     m.start({day:2,flow:'out',place:'bar'});m.controlsTutorial=false;m.x=target().x+.2;N.interact(m,target());
    }
    for(let i=0;i<400;i++){
     if(p.flags.elevator_repaired&&!m.neighborhood.action&&m.story.speech)break;
     if(m.neighborhood.action)m.tick(.05);else{m.story.speech.elapsed=99;m.story.advance();}
    }
    if(!p.flags.elevator_repaired||m.neighborhood.action||!m.story.speech)throw Error('Did not reach final repair dialogue');
    if(notices.pending.length||p.objectives.elevator_repair)throw Error('Completion notice fired before the last dialogue ended');
    m.story.speech.elapsed=99;a.snapCamera();a.tick(0);
    return {money:p.money,gear:p.inventory.gear_part,last:m.story.view().full};
   },route);
   assert.equal(before.money,route==='pay'?100:500);assert.equal(before.gear,route==='pay'?1:0);
   assert(before.last.includes('고쳐졌'),'Final repair dialogue is still visible');
   await page.keyboard.press('KeyE');
   const notice=page.locator('#story-notices [data-kind="goal-complete"]');await notice.waitFor({state:'visible'});
   assert.equal(await notice.locator('small').textContent(),'목표 달성');
   assert.equal(await notice.locator('strong').textContent(),'엘레베이터 수리!');
   const state=await page.evaluate(()=>({goal:barGame.progress.objectives.elevator_repair,carry:lunaCampaign.session.carry.objectives.elevator_repair,pending:LunaStoryNotices.pending.map(e=>[e.kind,e.title]),speech:!!outsidePlaytest.model.story.speech,departure:!!outsidePlaytest.model.neighborhood.repairDeparture}));
   assert.deepEqual(state.goal,{title:'엘레베이터 수리!',status:'completed'});assert.deepEqual(state.carry,state.goal);
   assert.deepEqual(state.pending,[['goal-complete','엘레베이터 수리!']]);assert(!state.speech&&state.departure);
   await page.waitForTimeout(300);await page.screenshot({path:'/private/tmp/repair-goal-'+route+'.png'});
   assert(await page.evaluate(()=>{
    LunaStoryNotices.clear();barGame.progress=structuredClone(barGame.progress);
    const m=outsidePlaytest.model;m.start({day:3,flow:'out',place:'bar'});m.story.advance();
    return !LunaOutsideNeighborhood.targets(m).some(t=>t.actor==='repair')&&!LunaStoryNotices.completeGoal(barGame.progress,'elevator_repair')&&!LunaStoryNotices.pending.length;
   }),'Completed repair stays one-shot after restoration/day change');
  }
  assert.deepEqual(errors,[]);console.log('REPAIR_GOAL_OK pay/gear/resumed gear, invalid payment/cancel silent, final dialogue timing, shared goal toast, carry and one-shot restoration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
