const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{
   lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();
   barGame.progress.flags={};lunaCampaign.session.carry={flags:{}};
   const a=outsidePlaytest,m=a.model,t=m.targets().find(t=>t.id==='bed');
   if(!t)throw Error('Bed target missing');m.controlsTutorial=false;m.x=t.x+.16;m.updateNear();a.snapCamera();a.tick(0);
  });
  const ready=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,t=m.near;
   return {near:t.id,marker:a.discoveryMarkers.find(x=>x.id==='bed'),expected:LunaPixelCamera.position(t.x,t.top,a.renderCamera),glow:a.interactionGlow,bed:LunaHomeArt.bed,range:LunaOutsideDiscovery.inRange(m,t)};
  });
  assert.equal(ready.near,'bed');assert(!ready.marker&&ready.range);
  assert.equal(ready.marker,undefined,'D11 removes the badge, not the interaction');
  assert.equal(ready.glow.target,'bed');assert.equal(ready.glow.drawn.length,1);assert.deepEqual(ready.glow.drawn[0].region,[...ready.bed.rect,ready.bed.edge]);
  await p.screenshot({path:'/private/tmp/home-bed-ready.png'});
  await p.keyboard.press('KeyE');
  const speech=await p.evaluate(()=>{const m=outsidePlaytest.model;return {id:m.story.speech.id,line:m.story.speech.line,view:m.story.view(),x:m.x,seen:barGame.progress.flags.outside_interacted_v1_bed,carry:lunaCampaign.session.carry.flags.outside_interacted_v1_bed};});
  assert.equal(speech.id,'home/bed');assert.equal(speech.line.actor,'luna');assert.equal(speech.view.title,'루나');
  assert.equal(speech.view.full,'크리스가 사용하는 침대.. 푹신해보인다.');assert(Math.abs(speech.view.anchor.x-speech.x)<.2);
  assert(speech.seen&&speech.carry);await p.keyboard.press('KeyE');await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/home-bed-speech.png'});
  await p.keyboard.press('KeyE');assert(await p.evaluate(()=>!outsidePlaytest.model.story.blocking));
  const checks=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,D=LunaOutsideDiscovery,result=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out']){
    m.start({day,flow,place:'home'});m.controlsTutorial=false;const t=m.targets().find(t=>t.id==='bed');m.x=t.x;m.updateNear();a.snapCamera();a.tick(0);
    if(m.near?.id!=='bed'||D.unseen(m,t)||a.discoveryMarkers.some(t=>t.id==='bed'))throw Error('Persistent first interaction history');
    if(!m.interact()||m.story.view().full!=='크리스가 사용하는 침대.. 푹신해보인다.')throw Error('Repeat inspection missing');
    m.story.cancel();result.push(day+flow);
   }
   m.start({day:1,flow:'out',place:'homeDoor'});if(m.targets().some(t=>t.id==='bed'))throw Error('Bed leaked outside');
   m.start({day:1,flow:'out',place:'home'});const t=m.targets().find(t=>t.id==='bed');m.x=t.x+.41;m.updateNear();if(m.near?.id==='bed')throw Error('Out of range');
   m.x=t.x;m.updateNear();m.paused=true;if(m.interact())throw Error('Paused inspection');m.paused=false;
   barGame.progress.flags={};m.updateNear();a.snapCamera();a.tick(0);return result;
  });
  assert.equal(checks.length,8);
  for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(100);
   assert(await p.evaluate(()=>!outsidePlaytest.discoveryMarkers.some(t=>t.id==='bed')));
  }
  await p.evaluate(()=>{lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.screen('game');});
  await p.locator('.outside-interact').click();assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.id),'home/bed');
  await p.evaluate(()=>{outsidePlaytest.model.story.cancel();barGame.progress.flags={};outsidePlaytest.tick(0);});
  await p.evaluate(()=>LunaCaptureMode.set(true));await p.waitForTimeout(100);
  assert(await p.evaluate(()=>!outsidePlaytest.discoveryMarkers.length));
  assert.deepEqual(errors,[]);console.log('HOME_BED_OK: Luna CSV dialogue, first-use marker/carry, all days/routes, range, pause, capture, resize, no street target');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
