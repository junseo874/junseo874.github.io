const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{
   LunaFocusSettings.setEnabled(false);
   window.qaSource=JSON.stringify(barData.tables);window.qaCarry=JSON.stringify(lunaCampaign.session.carry);
   window.qaSettle=()=>{const g=barGame;for(let i=0;i<10&&g.pendingTransition;i++){const f=g.pendingTransition;g.pendingTransition=null;g.transition=0;f();}g.transition=0;g.cameraMoving=false;g.cameraLeft=0;};
   window.qaChoice=()=>{const g=barGame;for(let i=0;i<100&&!g.choice;i++){qaSettle();if(g.dialogue){g.dialogue.chars=g.dialogue.text.length;g.advance();}else g.pump();if(g.error)throw Error(g.error);}qaSettle();g.changed();if(!g.choice)throw Error('No choice');};
  });
  const entries=await p.evaluate(()=>lunaQA.presets.map(c=>c.id));assert(entries.length>=35);
  for(const id of entries){const error=await p.evaluate(id=>{lunaQA.runPreset(id);qaSettle();return barGame.error;},id);assert(!error,id+': '+error);}
  console.log('PASS all '+entries.length+' preset entries');
  for(const [id,expected]of [['coaster-one',['port']],['coaster-two',['port','aili']],['coaster-mixed',['port']]]){
   const result=await p.evaluate(id=>{
    lunaQA.runPreset(id);const g=barGame,coasters=[],served=[];
    for(let i=0;i<100&&g.story&&!g.story.scene.id.startsWith('qa99_menu_complete');i++){
     qaSettle();if(g.error)throw Error(g.error);
     if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;
     if(g.storyCoaster){const seat=g.storyCoaster.seat;coasters.push(g.seats[seat].actor);if(!g.coaster(seat,'drag'))throw Error('Coaster rejected');}
     else if(g.dialogue)g.advance();
     else if(g.currentOrder&&g.story.steps[g.story.index]?.type==='craft'){
      const seat=g.currentOrder.seat,id=g.currentOrder.cocktail;g.openRecipes();g.selectCocktail(id);g.debugCraft('excellent');g.offer();qaSettle();if(!g.serve(seat))throw Error('Serve rejected');served.push(id);
     }else g.pump();
    }
    g.changed();return{coasters,served,done:g.story?.scene.id.startsWith('qa99_menu_complete'),error:g.error,bubi:g.seats.R?.actor==='bubi'?g.seats.R.coaster:null};
   },id);
   assert.deepEqual(result.coasters,expected);assert.equal(result.served.length,expected.length);assert(result.done,id);assert(!result.error);if(id==='coaster-mixed')assert.equal(result.bubi,false);
  }
  console.log('PASS 1/2/mixed coaster → real crafting → correct seat service');
  for(const [id,seq]of [['choice-money',1],['choice-money',2],['choice-money',3],['choice-affinity',1],['choice-affinity',2],['choice-combined',1],['choice-goals',1],['choice-goals',2],['choice-goals',3],['choice-goals',4]]){
   const r=await p.evaluate(({id,seq})=>{lunaQA.runPreset(id);qaChoice();LunaStoryNotices.clear();const ok=barGame.choose(seq);return{ok,money:barGame.progress.money,affinity:barGame.progress.affinity.port,kinds:LunaStoryNotices.pending.map(e=>e.kind),choice:!!barGame.choice,error:barGame.error};},{id,seq});
   assert(!r.error,id);if(id==='choice-money'){assert.equal(r.money,seq===1?1300:seq===2?600:1000);assert.equal(r.choice,seq===3);}else if(id==='choice-affinity'){assert.equal(r.affinity,seq===1?11:9);assert(r.kinds.includes(seq===1?'up':'down'));}else if(id==='choice-combined'){assert.deepEqual(r.kinds,['meet','up']);assert.equal(r.money,1300);}else assert(r.kinds.includes(['goal-new','goal-complete','goal-complete','event'][seq-1]));
  }
  for(const id of await p.evaluate(()=>LunaStoryNotices.roster)){
   const r=await p.evaluate(id=>{lunaQA.runPreset('register-'+id);qaChoice();LunaStoryNotices.clear();barGame.choose(1);return{met:barGame.progress.flags[id+'_met'],notices:LunaStoryNotices.pending.filter(e=>e.kind==='meet').length};},id);assert(r.met,id);assert.equal(r.notices,id==='chris'?0:1,id);
  }
  await p.evaluate(()=>{lunaQA.runPreset('profiles-all');qaChoice();});
  // Exercise the rendered choice using the same press-and-hold path as play.
  await p.waitForTimeout(1000);const unlock=p.locator('[data-act="choice"]').first();await unlock.waitFor();await unlock.hover();await p.mouse.down();await p.waitForTimeout(650);await p.mouse.up();
  await p.locator('.dossier-screen').waitFor();assert.equal(await p.locator('.guest-card:not(.unmet)').count(),12);assert.equal(await p.locator('.guest-card .filled').count(),36);
  await p.locator('.guest-card[data-id="shiba"]').click();assert.equal(await p.locator('.profile-section.locked').count(),0);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  for(const stage of [0,1,2,3]){
   await p.evaluate(stage=>lunaQA.runPreset('profiles-stage-'+stage),stage);
   assert.equal(await p.locator('.guest-card.unmet').count(),stage===0?12:0);
   assert.equal(await p.locator('.guest-card .filled').count(),stage*12);
   await p.keyboard.press('Escape');
  }
  for(const id of ['service','settings','history','help','johnnyUnlock']){
   await p.evaluate(id=>{lunaQA.runPreset('popup-'+id);qaChoice();barGame.choose(1);},id);
   assert.equal(await p.evaluate(()=>barGame.overlay),id);
   if(id==='johnnyUnlock')await p.locator('[data-act="confirmJohnnyUnlock"]').click();else await p.keyboard.press('Escape');
   assert.equal(await p.evaluate(()=>barGame.overlay),null,id+' closes');
   assert(await p.evaluate(()=>barGame.dialogue?.text.includes('팝업을 닫았습니다.')));
  }
  // Source-scene jumps must keep the source day for conditional/goto lookup,
  // while the developer's QA launcher remains on day 99.
  const branch=await p.evaluate(()=>{
   const step=barData.tables.steps.find(s=>s.type==='choice'&&barData.tables.scenes.some(c=>c.id===s.context&&Number(c.day)>=0&&Number(c.day)<4));
   const scene=barData.tables.scenes.find(s=>s.id===step.context),choice=barData.tables.bar_choices.find(c=>c.context===step.arg&&!c.when);
   lunaQA.state.scene=scene.id;lunaQA.state.step=String(barData.tables.steps.filter(s=>s.context===scene.id).sort((a,b)=>Number(a.seq)-Number(b.seq)).indexOf(step));
   lunaQA.runScene();qaSettle();const selected=barGame.choose(choice.seq);return{day:barGame.day,expected:Number(scene.day),selected,error:barGame.error};
  });assert.equal(branch.day,branch.expected);assert(branch.selected);assert(!branch.error);
  for(const id of ['memory-choice','memory-dialogue']){
   await p.evaluate(id=>{lunaQA.runPreset(id);if(id==='memory-choice'){qaChoice();barGame.choose(1);}else{qaSettle();barGame.dialogue.chars=barGame.dialogue.text.length;barGame.advance();}},id);
   await p.waitForFunction(()=>lunaCampaign.view==='scene'&&lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
   assert(await p.locator('.johnny-memory').isVisible());
   await p.evaluate(()=>{const c=lunaCampaign;for(let i=0;i<100&&!c.memoryTransition&&c.view==='scene';i++){c.dialog.chars=c.dialog.rows[c.dialog.index].text.length;c.next();}});
   await p.waitForFunction(()=>lunaCampaign.view==='developer'&&!lunaCampaign.memoryTransition&&barGame.dialogue?.text.includes('[QA]'));
   assert.equal(await p.evaluate(()=>barGame.progress.money),1000);
   assert.equal(await p.evaluate(()=>!!barGame.progress.flags.campaign_observation),false);
   assert.equal(await p.evaluate(()=>JSON.stringify(lunaCampaign.session.carry)===qaCarry),true);
  }
  await p.evaluate(()=>lunaQA.startDialogue());assert(await p.locator('#qa-lab').isHidden());assert(await p.locator('.qa-launch').isHidden());
  await p.setViewportSize({width:600,height:760});assert(await p.locator('.choices').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));await p.screenshot({path:'/private/tmp/bar-qa-presets-mobile.png'});
  await p.evaluate(()=>{lunaQA.runSituation('arrival');});
  assert.equal(await p.evaluate(()=>JSON.stringify(barData.tables)===qaSource),true,'source tables unchanged');
  await p.evaluate(()=>{lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:false});lunaCampaign.session.beginCommute(0);lunaQA.tick(0);});
  assert.equal(await p.evaluate(()=>Object.keys(barGame.progress.flags).some(k=>k.startsWith('qa_'))),false);
  assert.equal(await p.evaluate(()=>{try{lunaQA.runPreset('profiles-all');return false;}catch{return true;}}),true,'main mode rejects QA mutation');
  assert.deepEqual(errors,[]);console.log('PASS choices/notices, 12 profiles, memory roundtrip, pose presets, narrow layout, main/source isolation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
