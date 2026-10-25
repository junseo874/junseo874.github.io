const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.outside.exit(true);lunaCampaign.session.uninstall();lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'homeDoor'});await outsidePlaytest.start();});
  const result=await p.evaluate(()=>{
   const N=LunaOutsideNeighborhood,R=LunaResidence.layout,m=outsidePlaytest.model,p=barGame.progress;
   const check=(v,message)=>{if(!v)throw Error(message);};
   Object.assign(p,{money:500,inventory:{},flags:{}});lunaCampaign.session.carry={money:500,inventory:{},flags:{}};
   const run=(seconds)=>{for(let t=0;t<seconds;t+=.05)m.tick(.05);};
   const finish=()=>{const lines=[];for(let i=0;i<500&&m.story.speech&&!m.story.speech.choice;i++){if(m.neighborhood?.action){run(2.5);continue;}if(m.story.speech.line){lines.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();}else throw Error('stuck story');}return lines;};
   const start=(day,flow,place)=>{m.start({day,flow,place});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();};
   start(0,'in','bar');check(!N.targets(m).length,'no day0 outbound events');
   start(0,'out','bar');check(N.targets(m).some(t=>t.actor==='guard'),'gang from day0 return');
   m.x=N.places.guard.x+.35;m.tick(.05,{move:-1,run:true});check(m.x>=N.places.guard.x+.34,'guard blocks physical movement');check(!m.story.speech,'guard collision never starts dialogue');check(m.near?.id==='neighborhood-guard','guard stays interactable at boundary');m.interact();check(m.story.speech?.id==='neighborhood/guardBlocked','guard speaks only after interaction');finish();
   start(1,'in','bar');check(N.targets(m).some(t=>t.actor==='repair'),'repairman day1 outbound');check(!N.after(m,1,'out'),'tuna and cat not outbound');
   start(1,'out','bar');m.x=N.places.repair.x;let t=N.targets(m).find(t=>t.actor==='repair');N.interact(m,t);check(m.story.choose('cancel'),'ignore repair');check(!p.flags.repairman_met,'ignore does not consume introduction');
   N.interact(m,t);m.story.choose('talk');const intro=finish();check(intro.length===12&&p.flags.repairman_met,'repair intro ends and remembers');
   N.interact(m,t);p.money=399;check(!m.story.choose('pay'),'insufficient funds');check(!m.story.choose('gear'),'missing gear');p.money=500;check(m.story.choose('pay'),'repair payment');check(p.money===100,'charge once');check(!m.story.choose('pay'),'no double charge');finish();check(p.flags.elevator_repaired,'repair completed');check(lunaCampaign.session.carry.flags.elevator_repaired,'repair carry');
   // Fast travel must enforce the same story gate even when the cabin is upstairs.
   const c=lunaCampaign,oldGate=c.dayEndRequirements,oldNotice=c.showHomewardRequirements,oldDev=c.session.developer;let gateCalls=0;
   c.session.developer=true;c.dayEndRequirements=()=>['wild_dog'];c.showHomewardRequirements=()=>gateCalls++;
   m.level=0;m.elevatorY=R.elevatorTop;m.dialog={kind:'elevator'};m.chooseObject('fast');check(gateCalls===1&&!m.neighborhood.action,'fast travel preserves story prerequisites');
   c.dayEndRequirements=oldGate;c.showHomewardRequirements=oldNotice;c.session.developer=oldDev;
   for(const level of [0,1]){m.level=level;m.x=R.elevatorX;m.y=level?R.upperY:-.7;m.elevatorY=level?R.elevatorTop:R.elevatorBottom;m.dialog={kind:'elevator'};check(m.chooseObject('fast'),'fast choice accepted');run(1.3);check(m.level===1-level&&!m.ride&&!m.neighborhood.action,'fast arrival both directions');}
   start(2,'out','bar');check(!N.targets(m).some(t=>t.actor==='repair'),'repair complete persists');
   t=N.targets(m).find(t=>t.actor==='guard');N.interact(m,t);check(m.story.choose('ask'),'gang quest choice');const gang=finish();check(gang.length===7&&p.flags.gang_pass_granted,'gang pass');m.x=N.places.guard.x+.35;m.tick(.05,{move:-1,run:true});check(m.x<N.places.guard.x+.34,'gang passage unlocked');
   // Browse first; tuna belongs to stock, never the greeting or allowance choice.
   start(1,'out','bar');m.x=-2.68;LunaOutsideShop.begin(m,{id:LunaOutsideShop.id,x:m.x,y:-.596},false);finish();check(!LunaOutsideShop.choiceView(m).options.some(o=>o.id==='shop-buy-tuna_can'),'no greeting purchase');check(m.story.choose('shop-yes'),'browse stock');finish();if(m.story.speech.line.stage==='allowance'){check(m.story.choose('shop-allowance-no'),'decline optional allowance');finish();}check(LunaOutsideShop.choiceView(m).options.some(o=>o.id==='shop-buy-tuna_can'),'tuna offer');p.money=49;check(!m.story.choose('shop-buy-tuna_can'),'tuna insufficient');p.money=100;check(m.story.choose('shop-buy-tuna_can'),'buy tuna');finish();check(p.inventory.tuna_can===1&&p.money===50,'50 currency tuna');
   start(2,'in','homeDoor');check(N.targets(m).some(t=>t.id==='neighborhood-box'),'unseen cat persists next day');m.x=N.places.box.x-.6;run(.05);check(p.flags.boobi_box_shaken,'box proximity once');run(1);check(m.neighborhood.shake===0,'shake ends');
   m.x=N.places.box.x;t=N.targets(m).find(t=>t.id==='neighborhood-box');N.interact(m,t);run(2);check(p.flags.boobi_revealed&&!m.story.speech&&!m.story.blocking&&!m.neighborhood.action,'reveal ends without dialogue or choices');
   t=N.targets(m).find(t=>t.id==='neighborhood-cat');check(t&&!N.targets(m).some(t=>t.id==='neighborhood-box'),'cat replaces box as interaction target');N.interact(m,t);check(m.story.speech.choice&&m.story.view().full==='야옹','separate cat interaction shows meow and choices');check(m.story.choose('pet'),'pet');finish();
   t=N.targets(m).find(t=>t.id==='neighborhood-cat');N.interact(m,t);check(m.story.choose('feed'),'feed');check(p.inventory.tuna_can===0,'consume one');const feed=finish();check(feed.join('|').includes('잘 먹네.')&&feed.at(-1)==='데리고 와도..괜찮은 거겠지?','feeding neighbor home dialogue');check(m.scene==='home'&&p.flags.boobi_adopted,'cat adopted');
   let continued=0;check(N.beforeRest(m,()=>continued++),'rest starts cat scene');const rest=finish();check(rest.length===5&&continued===1&&p.flags.boobi_rest_seen,'rest continues after Chris');check(!N.beforeRest(m,()=>continued++),'rest only once');
   // Gear route on an independent progress state, including interruption recovery.
   p.flags={repairman_met:true};p.inventory={gear_part:1};p.money=100;start(2,'in','bar');t=N.targets(m).find(t=>t.actor==='repair');N.interact(m,t);check(m.story.choose('gear'),'gear choice');check(p.inventory.gear_part===0&&p.money===100,'gear only');start(2,'out','bar');N.interact(m,N.targets(m).find(t=>t.actor==='repair'));check(m.story.speech.id==='neighborhood/repairPaid','paid repair resumes without paying again');finish();check(p.flags.elevator_repaired&&p.money===100,'gear repaired');
   m.config.flow='in';m.level=0;m.dialog={kind:'elevator'};m.chooseObject('fast');check(m.neighborhood.action,'fast started');m.story.cancel();check(!m.neighborhood.action,'developer cancellation clears scripted movement');
   // Leave the reference cat perch visible for the screenshot.
   p.flags={boobi_box_shaken:true,boobi_revealed:true};start(1,'out','homeDoor');m.x=N.places.cat.x-.45;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
   return {intro:intro.length,gang:gang.length,feed:feed.length,rest:rest.length};
  });
  await p.screenshot({path:'/tmp/luna-neighborhood-cat.png'});
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.start({day:1,flow:'out',place:'bar'});m.x=LunaResidence.layout.elevatorX;m.story.cancel();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  await p.screenshot({path:'/tmp/luna-neighborhood-street.png'});
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=LunaOutsideNeighborhood.places.guard.x+.34;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  await p.screenshot({path:'/tmp/luna-neighborhood-gang.png'});
  // All new interactive targets use the same silhouette outline as existing NPCs.
  for(const id of ['box','cat','repair','guard','home-cat']){
   const glow=await p.evaluate(id=>{
    const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
    barGame.progress.flags={boobi_box_shaken:true,boobi_revealed:id==='cat',boobi_adopted:id==='home-cat'};
    m.start({day:1,flow:'out',place:id==='home-cat'?'home':['box','cat'].includes(id)?'homeDoor':'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();
    const t=N.targets(m).find(t=>t.id==='neighborhood-'+id);m.x=t.x;m.updateNear();a.snapCamera();a.tick(0);return a.interactionGlow;
   },id);
   assert.equal(glow.target,'neighborhood-'+id);assert.equal(glow.drawn.length,1,JSON.stringify(glow));
   if(id==='box')assert(glow.drawn[0].region[4],'baked box uses a silhouette, not its opaque atlas rectangle');
   if(id==='box'){
    const shaking=await p.evaluate(()=>{outsidePlaytest.model.neighborhood.shake=.5;outsidePlaytest.tick(0);return outsidePlaytest.interactionGlow;});
    assert.equal(shaking.drawn.length,1);assert.equal(shaking.drawn[0].node,'neighborhood-shaking-box');
    await p.evaluate(()=>{outsidePlaytest.model.neighborhood.shake=0;outsidePlaytest.tick(0);});
   }
   await p.screenshot({path:'/tmp/luna-neighborhood-outline-'+id+'.png'});
   await p.evaluate(()=>{outsidePlaytest.model.paused=true;outsidePlaytest.tick(0);});
   assert.equal((await p.evaluate(()=>outsidePlaytest.interactionGlow)).drawn.length,0,'no outline under settings');
   await p.evaluate(()=>{outsidePlaytest.model.paused=false;});
  }
  for(const viewport of [{width:1280,height:720},{width:900,height:700}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(150);
   const anchors=await p.evaluate(()=>{
    const a=outsidePlaytest,m=a.model,N=LunaOutsideNeighborhood;
    barGame.progress.flags={};m.start({day:1,flow:'out',place:'bar'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=N.places.guard.x+.4;
    N.interact(m,N.targets(m).find(t=>t.actor==='guard'));a.snapCamera();a.tick(0);
    const stage=document.querySelector('.outside-stage').getBoundingClientRect(),tip=document.querySelector('.outside-speech .piece-9').getBoundingClientRect(),s=stage.width/1280;
    const head=LunaPixelCamera.position(N.places.guard.x,N.places.guard.y+.56,a.renderCamera);
    return {gap:(stage.y+head.y*s-tip.bottom)/s,xGap:Math.abs(stage.x+head.x*s-(tip.left+tip.right)/2)/s,guard:N.anchor(m,'guard').y,repair:N.anchor(m,'repair').y};
   });
   assert(anchors.gap>=0&&anchors.gap<12,JSON.stringify(anchors));assert(anchors.xGap<3,JSON.stringify(anchors));
   assert(Math.abs(anchors.guard-(-.414))<1e-6);assert(Math.abs(anchors.repair-(-.364))<1e-6);
  }
  await p.screenshot({path:'/tmp/luna-neighborhood-speech.png'});await p.setViewportSize({width:1280,height:720});
  // Exercise the actual sofa and campaign continuation, not only the module callback.
  await p.evaluate(async()=>{
   const c=lunaCampaign;c.cancelMemoryTransition();c.cancelDayTransition();c.disposeCinema();c.dialog=null;c.outsideSleep=null;c.outside.exit(true);c.session.uninstall();c.session.beginCommute(2);c.session.route='out';c.nightStarted=false;
   barGame.progress.flags.boobi_adopted=true;delete barGame.progress.flags.boobi_rest_seen;
   Object.assign(c.outside.config,{day:2,flow:'out',place:'home'});await c.outside.start();c.screen('game');c.outside.model.wakeAtSofa();c.outside.refreshHUD();
  });
  await p.keyboard.press('KeyE');await p.locator('.world-choices [data-choice="sleep"]').waitFor({state:'visible'});await p.waitForTimeout(820);await p.keyboard.press('KeyE');
  await p.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='neighborhood/rest');
  assert.equal(await p.evaluate(()=>lunaCampaign.nightStarted),true);
  const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyA');await p.waitForTimeout(100);await p.keyboard.up('KeyA');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
  await p.keyboard.press('Escape');await p.locator('.luna-settings:visible').waitFor();
  const paused=await p.evaluate(()=>outsidePlaytest.model.neighborhood.action.time);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>outsidePlaytest.model.neighborhood.action.time),paused);
  assert.notEqual(await p.locator('.luna-settings:visible .ls-close').evaluate(el=>getComputedStyle(el).cursor),'none');await p.locator('.luna-settings:visible .ls-close').click();
  await p.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<60;i++)m.tick(.05);outsidePlaytest.tick(0);});
  await p.screenshot({path:'/tmp/luna-neighborhood-home.png'});
  await p.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<300&&m.story.speech;i++){if(m.neighborhood?.action)m.tick(.05);else{m.story.speech.elapsed=99;m.interact();}}});
  await p.waitForFunction(()=>barGame.progress.flags.boobi_rest_seen&&lunaCampaign.dialog?.background==='terrace');
  assert.equal(await p.evaluate(()=>lunaCampaign.session.day),2,'optional cat scene must not skip the night or advance the day');
  assert.deepEqual(errors,[]);console.log('NEIGHBORHOOD_EVENTS_OK',result);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
