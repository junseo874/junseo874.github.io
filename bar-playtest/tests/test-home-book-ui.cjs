const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[],requests=[];
  p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  p.on('request',r=>{if(r.url().includes('nietzsche-the-gay-science.png'))requests.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{
   lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'home'});await outsidePlaytest.start();
   barGame.progress.flags={};lunaCampaign.session.carry={flags:{}};
   const a=outsidePlaytest,m=a.model,t=m.targets().find(t=>t.id==='home-book');
   m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=t.x-.18;m.updateNear();a.snapCamera();a.tick(0);
  });
  assert(requests.length>0,'Cover is requested before inspecting the book');
  const ready=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,t=m.near;
   return {id:t.id,marker:a.discoveryMarkers.find(t=>t.id==='home-book'),expected:LunaPixelCamera.position(t.x,t.top,a.renderCamera),glow:a.interactionGlow,art:LunaHomeArt.book};
  });
  assert.equal(ready.id,'home-book');assert(!ready.marker);
  assert.equal(ready.marker,undefined,'D11 removes the badge, not the book interaction');
  assert.equal(ready.glow.target,'home-book');assert.equal(ready.glow.drawn.length,1);
  assert.equal(ready.glow.drawn[0].node,'ForeFore_Object');assert.deepEqual(ready.glow.drawn[0].region,[...ready.art.rect,ready.art.edge]);
  assert.equal((await p.locator('.outside-interact').innerText()).replace(/\s+/g,' '),'E 보기');
  await p.screenshot({path:'/private/tmp/home-book-ready.png'});
  const money=await p.evaluate(()=>barGame.progress.money),x=await p.evaluate(()=>outsidePlaytest.model.x);
  await p.keyboard.press('KeyE');await p.locator('.outside-inspection').waitFor();
  assert.equal(await p.locator('#outside-inspection-description').textContent(),'《즐거운 학문》 - 프리드리히 니체');
  await p.waitForFunction(()=>{const i=document.querySelector('.outside-inspection-image');return i?.complete&&i.naturalWidth===1024&&i.naturalHeight===1536;});
  assert(await p.evaluate(()=>barGame.progress.flags['outside_interacted_v1_home-book']&&lunaCampaign.session.carry.flags['outside_interacted_v1_home-book']));
  await p.keyboard.down('KeyA');await p.waitForTimeout(150);await p.keyboard.up('KeyA');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
  await p.screenshot({path:'/private/tmp/home-book-inspection.png'});
  for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(120);
   const fit=await p.evaluate(()=>{
    const root=document.querySelector('.outside-inspection').getBoundingClientRect();
    return ['.outside-inspection-image','.outside-inspection-caption','.outside-inspection-exit'].map(s=>{
     const r=document.querySelector(s).getBoundingClientRect();return r.x>=root.x-1&&r.y>=root.y-1&&r.right<=root.right+1&&r.bottom<=root.bottom+1;
    });
   });assert(fit.every(Boolean),'Image, caption and exit remain within the game screen');
  }
  await p.keyboard.press('KeyE');assert.equal(await p.locator('.outside-inspection').count(),0);
  await p.evaluate(()=>outsidePlaytest.tick(0));assert(!(await p.evaluate(()=>outsidePlaytest.discoveryMarkers.some(t=>t.id==='home-book'))));
  await p.locator('.outside-interact').click();await p.locator('.outside-inspection').waitFor();
  assert(await p.evaluate(()=>!LunaUIAudioPolicy.allows(document.querySelector('.outside-inspection-exit'),'click')));
  await p.keyboard.press('Escape');assert.equal(await p.locator('.outside-inspection').count(),0);assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
  const cases=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,out=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out']){
    m.start({day,flow,place:'home'});m.controlsTutorial=false;const t=m.targets().find(t=>t.id==='home-book');m.x=t.x;m.updateNear();
    out.push(m.near?.id==='home-book'&&!LunaOutsideDiscovery.unseen(m,t)&&m.interact()&&m.dialog?.kind==='inspection');m.interact();
   }
   m.start({day:1,flow:'out',place:'homeDoor'});out.push(!m.targets().some(t=>t.id==='home-book'));
   const poster=LunaOutsideInspection.forTarget({id:'wanted-poster'});out.push(poster.text==='누군가 수배하는 포스터.'&&poster.image.includes('shiba-wanted'));
   return out;
  });assert(cases.every(Boolean));assert.equal(await p.evaluate(()=>barGame.progress.money),money);
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
  const card=await p.evaluate(()=>resourceReview.rows.find(r=>r.id==='outside:home-book'));
  assert.equal(card.layers[0].w,1024);assert.equal(card.layers[0].h,1536);assert(card.layers[0].src.endsWith('/nietzsche-the-gay-science.png'));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
  console.log('HOME_BOOK_OK: book-only glow and badge, original preloaded cover, exact caption, E/click/Esc, movement lock, resize, first-use history, all days/routes, poster retained, resource review');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
