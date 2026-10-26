const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{
   lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();
   barGame.progress.flags={};lunaCampaign.session.carry={flags:{}};
   const a=outsidePlaytest,m=a.model,t=m.targets().find(t=>t.id==='wardrobe');
   m.controlsTutorial=false;m.x=t.x+.16;m.updateNear();a.snapCamera();a.tick(0);
  });
  const ready=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,t=m.near;
   return {id:t.id,marker:a.discoveryMarkers.find(t=>t.id==='wardrobe'),expected:LunaPixelCamera.position(t.x,t.top,a.renderCamera),glow:a.interactionGlow,art:LunaHomeArt.wardrobe};
  });
  assert.equal(ready.id,'wardrobe');assert(!ready.marker);
  assert.equal(ready.marker,undefined,'D11 removes the badge, not the wardrobe interaction');
  assert.equal(ready.glow.target,'wardrobe');assert.equal(ready.glow.drawn.length,1);
  assert.deepEqual(ready.glow.drawn[0].region,[...ready.art.rect,ready.art.edge]);
  await p.screenshot({path:'/private/tmp/home-wardrobe-ready.png'});
  const money=await p.evaluate(()=>barGame.progress.money);
  await p.keyboard.press('KeyE');await p.locator('.world-choices [data-choice="press"]').waitFor({state:'visible'});
  assert.deepEqual(await p.locator('.world-choices button').allTextContents(),['누른다','취소']);
  assert.deepEqual(await p.evaluate(()=>{const m=outsidePlaytest.model,v=m.story.view();return [v.title,v.full,m.story.speech.line.actor];}),['루나','무언가 버튼이 보인다.','luna']);
  assert(await p.evaluate(()=>barGame.progress.flags.outside_interacted_v1_wardrobe&&lunaCampaign.session.carry.flags.outside_interacted_v1_wardrobe));
  await p.waitForTimeout(550);await p.screenshot({path:'/private/tmp/home-wardrobe-menu.png'});
  await p.locator('[data-choice="cancel"]').click();assert(await p.evaluate(()=>!outsidePlaytest.model.story.blocking));
  await p.keyboard.press('KeyE');await p.waitForTimeout(550);await p.locator('[data-choice="press"]').click();
  assert.deepEqual(await p.evaluate(()=>{const m=outsidePlaytest.model;return [m.story.speech.id,m.story.view().full,m.story.speech.line.actor,!!m.story.speech.choice];}),['home/wardrobePressed','아직 애니메이션이 없는 걸...','luna',false]);
  await p.keyboard.press('KeyE');await p.screenshot({path:'/private/tmp/home-wardrobe-pressed.png'});await p.keyboard.press('KeyE');
  assert(await p.evaluate(()=>!outsidePlaytest.model.story.blocking));
  assert.equal(await p.evaluate(()=>barGame.progress.money),money);
  await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model;
   for(const day of [0,1,2,3])for(const flow of ['in','out']){
    m.start({day,flow,place:'home'});m.controlsTutorial=false;const t=m.targets().find(t=>t.id==='wardrobe');m.x=t.x;m.updateNear();a.snapCamera();a.tick(0);
    if(m.near?.id!=='wardrobe'||LunaOutsideDiscovery.unseen(m,t))throw Error('Wardrobe history/target');
    if(!m.interact()||m.story.view().full!=='무언가 버튼이 보인다.')throw Error('Repeat interaction');
    m.story.cancel();
   }
   m.start({day:1,flow:'out',place:'homeDoor'});if(m.targets().some(t=>t.id==='wardrobe'))throw Error('Wardrobe outside');
   m.start({day:1,flow:'out',place:'home'});const t=m.targets().find(t=>t.id==='wardrobe');m.x=t.x;m.controlsTutorial=false;m.updateNear();
   m.paused=true;if(m.interact())throw Error('Paused interaction');m.paused=false;
   a.snapCamera();a.tick(0);lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.screen('game');
  });
  await p.locator('.outside-interact').click();
  for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(120);
   const box=await p.locator('.world-choices:visible').boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
  }
  await p.waitForTimeout(550);await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.id),'home/wardrobePressed');
  assert.deepEqual(errors,[]);console.log('HOME_WARDROBE_OK: cabinet-only glow/marker, CSV Luna dialogue, cancel/press, repeat/history, all days/routes, pause, resize, campaign click/Enter');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
