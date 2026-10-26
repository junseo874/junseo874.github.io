const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});await outsidePlaytest.start();
   window.restorationTest={
    drain(){const m=outsidePlaytest.model;for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}},
    reset(memory){LunaStoryNotices.clear();const m=outsidePlaytest.model;m.start({day:2,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();Object.assign(barGame.progress,{money:1500,inventory:{},flags:{gang_pass_granted:true,elevator_repaired:true,campaign_observation:memory},objectives:{}});lunaCampaign.session.carry=structuredClone(barGame.progress);outsidePlaytest.tick(0);},
    buy(){const m=outsidePlaytest.model;LunaOutsideShop.begin(m,{id:'shiba-shop',x:-2.68,y:-.596},false);this.drain();if(!m.story.choose('shop-yes'))throw Error('Shop greeting');this.drain();if(!m.story.choose('shop-buy-bitters'))throw Error('Buy bitters');this.drain();if(m.story.speech?.line.stage==='quiz'){if(!m.story.choose('shop-answer-1'))throw Error('Quiz purchase');this.drain();}},
    grant(){const m=outsidePlaytest.model,N=LunaOutsideNeighborhood,t=N.targets(m).find(t=>t.actor==='boss');m.x=t.x+.3;m.updateNear();N.interact(m,t);this.drain();if(!m.story.choose('boss-repair'))throw Error('Boss repair exchange');this.drain();outsidePlaytest.snapCamera();},
    advanceNotices(){for(let i=0;i<70;i++)outsidePlaytest.tick(.1);LunaStoryNotices.tick(barGame,outsidePlaytest,lunaCampaign,.1);}
   };
  });
  for(const order of ['shop-first','boss-first']){
   await p.evaluate(order=>{const t=restorationTest;t.reset(true);if(order==='shop-first')t.buy();else t.grant();if(LunaStoryNotices.pending.some(e=>e.kind.startsWith('goal-')||e.kind==='recipe-unlock'))throw Error('Single ingredient notified');if(order==='shop-first')t.grant();else t.buy();outsidePlaytest.tick(0);LunaStoryNotices.tick(barGame,outsidePlaytest,lunaCampaign,.1);},order);
   assert.equal(await p.locator('#story-notices [data-kind="goal-complete"] strong').textContent(),'올드패션드 재료 구하기!');
   assert(await p.locator('.outside-item-notice').isVisible());
   await p.evaluate(()=>restorationTest.advanceNotices());
   assert.equal(await p.locator('.story-notice-recipe').count(),0,'No separate recipe toast');
   assert(await p.evaluate(()=>!barGame.progress.flags.old_fashioned_recipe_notice_pending&&!barGame.progress.flags.johnny_recipe_unlocked));
   await p.screenshot({path:'/private/tmp/restoration-notice-'+order+'.png'});
   assert(await p.evaluate(()=>{LunaStoryNotices.clear();LunaRestorationNotices.check(barGame,lunaCampaign);return !LunaStoryNotices.pending.length;}));
  }
  // Real day-2 memory and next morning must not trigger an early recipe notification.
  await p.evaluate(async()=>{const c=lunaCampaign;c.toPicker();c.session.install({developer:true,serviceVersion:'A'});barGame.reset(2,'full',10,false,{serviceVersion:'A'});barGame.progress.inventory={wild_dog:1,bitters:1};barGame.progress.flags.campaign_observation=false;delete barGame.progress.flags.old_fashioned_recipe_notified;delete barGame.progress.flags.old_fashioned_recipe_notice_pending;LunaStoryNotices.clear();LunaRestorationNotices.check(barGame,c);LunaStoryNotices.clear();c.session.day=2;c.session.route='out';c.session.carry=structuredClone(barGame.progress);Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'home',variant:'original'});await outsidePlaytest.start({wakeAtSofa:true});c.screen(c.playView);});
  await p.keyboard.press('KeyE');await p.locator('.world-choices').waitFor({state:'visible'});await p.waitForTimeout(820);await p.keyboard.press('KeyE');
  await p.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
  await p.evaluate(()=>{const c=lunaCampaign;while(!c.memoryTransition){c.dialog.chars=1e5;c.next();}});
  await p.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
  await p.evaluate(()=>{const c=lunaCampaign;while(c.dialog?.background==='johnny-memory'&&!c.memoryTransition){c.dialog.chars=1e5;c.next();}});
  await p.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
  assert(await p.evaluate(()=>barGame.progress.flags.campaign_observation&&!barGame.progress.flags.old_fashioned_recipe_notice_pending&&!barGame.progress.flags.old_fashioned_recipe_notified));
  await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
  await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading&&!lunaCampaign.dayTransition&&['game','developer'].includes(lunaCampaign.view)&&outsidePlaytest.model.config.day===3,null,{timeout:20000});
  assert.equal(await p.locator('.story-notice-recipe').count(),0);
  assert(await p.evaluate(()=>!LunaStoryNotices.pending.some(e=>e.kind==='recipe-unlock')));
  assert(await p.evaluate(()=>{
   const g=barGame;g.day=3;delete g.progress.flags.johnny_recipe_unlocked;delete g.progress.flags.day3_sugar_received;
   if(g.checkJohnnyUnlock())return false;
   g.progress.flags.day3_sugar_received=true;
   return g.checkJohnnyUnlock()&&g.overlay==='johnnyUnlock'&&g.progress.flags.johnny_recipe_unlocked&&!g.checkJohnnyUnlock();
  }),'Existing sugar-gated recipe unlock popup still opens once');
  assert.deepEqual(errors,[]);console.log('RESTORATION_NOTICES_UI_OK both actual purchase orders, one-shot goal, no duplicate recipe toast after memory/day change, existing sugar-gated unlock popup retained');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
