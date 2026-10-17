const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   const c=lunaCampaign;c.session.uninstall();c.session.install();c.session.day=0;c.session.carry=structuredClone(barGame.progress);
   LunaStoryNotices.clear();await c.street('out');
  });
  await page.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.doorTransition&&barGame.progress.objectives?.first_homeward).catch(async e=>{console.log(await page.evaluate(()=>({view:lunaCampaign.view,active:lunaCampaign.active,dev:lunaCampaign.session.developer,error:lunaCampaign.loadError,model:outsidePlaytest.model&&{config:outsidePlaytest.model.config,paused:outsidePlaytest.model.paused},goal:barGame.progress.objectives,door:lunaCampaign.doorTransition&&{time:lunaCampaign.doorTransition.time,ready:lunaCampaign.doorTransition.ready},hidden:LunaFocusSettings.hiddenPaused})));console.log(errors);throw e;});
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.story-notice-event strong').textContent(),'집으로 가기!');
  assert.equal(await page.locator('.story-notice-event small').textContent(),'새로운 목표');
  await page.screenshot({path:'/private/tmp/homeward-goal.png'});
  const checks=await page.evaluate(()=>{
   const m=outsidePlaytest.model,fn=LunaOutside.homewardCues,results=[];
   results.push(JSON.stringify(barGame.progress.objectives)===JSON.stringify(lunaCampaign.session.carry.objectives));
   for(let i=0;i<20;i++)m.tick(0);
   results.push(LunaStoryNotices.pending.filter(n=>n.title==='집으로 가기!').length===1);
   const lower=fn(m);results.push(lower.length===1,lower[0].kind==='route',lower[0].label==='엘리베이터로',lower[0].direction==='left');
   const oldX=m.x;m.x=LunaResidence.layout.elevatorX;results.push(fn(m)[0].kind==='arrival',fn(m)[0].destination==='엘리베이터');
   m.level=1;results.push(fn(m)[0].kind==='route',fn(m)[0].label==='집으로');
   m.x=LunaResidence.layout.homeX;results.push(fn(m)[0].kind==='arrival',fn(m)[0].destination==='집 입구');
   m.x=LunaResidence.layout.homeX-2;results.push(fn(m)[0].direction==='right');m.x=oldX;m.level=0;
   for(const [key,value]of [['scene','home'],['qa',{}],['ride',{}],['transition',{}]]){const old=m[key];m[key]=value;results.push(fn(m).length===0);m[key]=old;}
   for(const [key,value]of [['encounter',{}],['dialog',{}],['ride',{call:true}]]){const old=m[key];m[key]=value;results.push(fn(m).length===1);m[key]=old;}
   for(const day of [1,2,3]){m.config.day=day;results.push(fn(m).length===0);}m.config.day=0;
   m.config.flow='in';results.push(fn(m).length===0);m.config.flow='out';
   return results;
  });assert(checks.every(Boolean));
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.story.cancel();m.backgroundStory.cancel();outsidePlaytest.refreshHUD();});
  const guide=page.locator('.outside-homeward-guide');assert(await guide.isVisible());
  await page.waitForTimeout(450);
  const firstBox=await guide.boundingBox();assert.equal(firstBox.x,28);assert.equal(firstBox.y,26);
  assert.equal(firstBox.width,220);assert.equal(firstBox.height,64);assert(!(await guide.textContent()).includes('현재 목표'));
  assert.equal(await guide.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  assert.equal(await guide.evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.x=-4;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.refreshHUD();});
  assert.deepEqual(await guide.boundingBox(),firstBox,'HUD stays fixed when player and camera move');
  // Foreground poster reading and nearby/distant NPC conversations keep it visible.
  for(const kind of ['foreground','background','distant']){
   await page.evaluate(kind=>{const m=outsidePlaytest.model,story=kind==='foreground'?m.story:m.backgroundStory;story.beginRows('guide-test-'+kind,{x:m.x+(kind==='distant'?10:0),y:m.y},[{type:'say',actor:'guide-npc',text:'이야기를 읽는 중입니다.'}],kind!=='foreground');outsidePlaytest.refreshHUD();},kind);
   assert(await guide.isVisible(),kind);assert.equal(await guide.getAttribute('data-visible'),'true');
   assert.deepEqual(await guide.boundingBox(),firstBox,'Dialogue must not restart the entrance animation');
   await page.evaluate(()=>{const m=outsidePlaytest.model;m.story.cancel();m.backgroundStory.cancel();outsidePlaytest.refreshHUD();});assert(await guide.isVisible());
  }
  // An actual elevator ride slides the HUD out, then restores it for the upper floor.
  await page.evaluate(()=>{
   const m=outsidePlaytest.model,r=LunaResidence.layout;
   m.level=0;m.x=r.elevatorX;m.y=-.7;m.elevatorY=r.elevatorBottom;m.updateNear();m.interact();outsidePlaytest.refreshHUD();
  });
  assert(await page.evaluate(()=>!!outsidePlaytest.model.ride&&!outsidePlaytest.model.ride.call));
  assert.equal(await guide.getAttribute('data-visible'),'false');
  await page.waitForTimeout(120);
  const slidingOut=await guide.boundingBox();assert(slidingOut.x<firstBox.x&&slidingOut.x>-230,'Exit travels toward the left edge');
  await page.waitForTimeout(350);assert.equal(await guide.isVisible(),false);
  await page.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<280;i++)m.tick(.05);outsidePlaytest.refreshHUD();});
  assert.equal(await guide.getAttribute('data-visible'),'true');
  await page.waitForTimeout(100);const slidingIn=await guide.boundingBox();assert(slidingIn.x<firstBox.x,'Entry starts outside the left edge');
  await page.waitForTimeout(400);assert.deepEqual(await guide.boundingBox(),firstBox);
  assert.equal(await guide.getAttribute('data-destination'),'home');
  for(const [name,x,level]of [['bar',1,0],['fence',-8.78,0],['lift',-12.2,0],['home',-15.6,1]]){
   await page.evaluate(({x,level})=>{
    const m=outsidePlaytest.model,r=LunaResidence.layout;m.x=x;m.level=level;m.y=level?r.upperY:-.7;
    m.elevatorY=level?r.elevatorTop:r.elevatorBottom;m.story.cancel();m.backgroundStory.cancel();m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
   },{x,level});
   await page.screenshot({path:'/private/tmp/homeward-'+name+'.png'});
  }
  // Use the actual home doorway transition, not a direct scene replacement.
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.x=LunaResidence.layout.homeX;m.updateNear();m.interact();});
  await page.waitForFunction(()=>outsidePlaytest.model.scene==='home'&&!outsidePlaytest.model.transition);
  await page.waitForFunction(()=>barGame.progress.objectives.first_homeward.status==='completed');
  assert.equal(await page.evaluate(()=>lunaCampaign.session.carry.objectives.first_homeward.status),'completed');
  assert.equal(await page.evaluate(()=>LunaOutside.homewardCues(outsidePlaytest.model).length),0);
  await page.waitForTimeout(450);assert.equal(await guide.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: fixed guide during foreground/background dialogue, left-edge entry/exit, actual elevator ride hide/restore, upper-floor destination, no looping animation/input interception, goal persistence and home completion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
