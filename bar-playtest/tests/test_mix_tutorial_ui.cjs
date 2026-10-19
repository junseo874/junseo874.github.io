const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  const setup=(kind,mode='path')=>p.evaluate(({kind,mode})=>{const g=barGame;lunaCampaign.ui.shakeMode=mode;g.reset(99,'practice',1);g.selectCocktail(kind==='stir'?'dry_martini':'gin_fizz');g.debugFill();g.startCraft();g.craft.index=g.craft.queue.findIndex(s=>s.type===kind);g.nextGimmick();lunaCampaign.render(true);},{kind,mode});
  const frozen=()=>p.evaluate(()=>({started:barGame.gimmick.started,time:barGame.craft.elapsed,attempts:barGame.gimmick.attempts,failures:barGame.gimmick.failures,success:barGame.gimmick.success}));
  const lesson=p.locator('.mix-tutorial');
  for(const mode of ['stir','path','fall','cross']){
   const kind=mode==='stir'?'stir':'shake';await setup(kind,mode);assert(await lesson.isVisible());assert(await p.locator('.mix-screen').evaluate(e=>e.inert));
   const initial=await frozen();await p.waitForTimeout(300);assert.deepEqual(await frozen(),initial);
   assert.equal(await p.locator('[data-act="mixTutorialKey"]').count(),0);
   for(const key of ['KeyW','KeyD','KeyS','KeyA','ArrowUp','ArrowDown'])await p.keyboard.press(key);
   assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.page),0,'Gameplay keys do not require practice or advance guide');
   assert.deepEqual(await frozen(),initial);
   for(const page of [0,1]){
    assert(await p.evaluate(async()=>{const e=document.querySelector('.mix-guide-image image'),im=new Image();im.src=e.getAttribute('href');await im.decode();return im.naturalWidth>0;}));
    if(kind==='shake'){
     const marks=await p.locator('.mix-shake-callout').evaluateAll(es=>es.map(e=>{const ring=e.querySelector('.mix-shake-ring').getBoundingClientRect(),badge=e.querySelector('.mix-shake-badge').getBoundingClientRect(),svg=e.closest('svg').getBoundingClientRect();return {separate:badge.right<ring.left||badge.left>ring.right||badge.bottom<ring.top||badge.top>ring.bottom,inside:badge.left>=svg.left&&badge.right<=svg.right&&badge.top>=svg.top&&badge.bottom<=svg.bottom};}));
     assert.equal(marks.length,page?1:2);assert(marks.every(m=>m.separate&&m.inside),'Badges must remain outside the highlighted nodes and inside the preview');
     if(mode==='path'&&page===1)assert((await p.locator('.mix-guide-image figcaption').innerText()).includes('확대'));
    }
    await p.screenshot({path:'/private/tmp/mix-guide-'+mode+'-'+page+'.png'});
    if(page===0)await p.keyboard.press('KeyE');
   }
   await p.locator('.mix-lesson-prev').click();assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.page),0);
   await p.locator('.mix-lesson-next').click();
   await p.keyboard.press('Escape');assert.equal(await lesson.count(),0);await p.waitForTimeout(100);await p.keyboard.press('Escape');assert(await lesson.isVisible());
   assert.deepEqual(await frozen(),initial);
   await p.keyboard.press('KeyE');assert.equal(await lesson.count(),0);
   assert.equal(await p.evaluate(kind=>barGame.progress.flags['mix_tutorial_'+kind],kind),true);
   assert.deepEqual(await frozen(),initial,'Dismiss does not start gameplay');
   await p.keyboard.press(kind==='stir'?'KeyW':'Space');assert.equal(await p.evaluate(()=>barGame.gimmick.started),true);
   await p.evaluate(()=>{barGame.nextGimmick();lunaCampaign.render(true);});assert.equal(await lesson.count(),0,'Completed guide is not repeated');
  }
  await setup('stir');
  for(const [width,height]of [[820,650],[600,800]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(150);const r=await p.locator('.mix-lesson-card').boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+.1&&r.y+r.height<=height+.1,JSON.stringify({width,height,r}));
   assert(await p.locator('.mix-lesson-card').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No horizontal overflow');
  }
  await p.setViewportSize({width:1280,height:720});
  await p.evaluate(()=>{barGame.startMinigame('stir');lunaCampaign.render(true);});assert(await lesson.isVisible());
  await p.keyboard.press('KeyE');await p.keyboard.press('KeyE');
  await p.evaluate(()=>{barGame.startMinigame('stir');lunaCampaign.render(true);});assert.equal(await lesson.count(),0,'Minigame retry keeps acknowledgement');
  await p.evaluate(()=>{barGame.startMinigame('shake');lunaCampaign.render(true);});assert(await lesson.isVisible());
  await p.evaluate(()=>{barGame.startMinigame('shake');lunaCampaign.render(true);});assert(await lesson.isVisible(),'Abandoned guides are not completed');
  assert.deepEqual(errors,[]);console.log('PASS 8 screenshot pages, no required practice, input/time/score freeze, back/next/pause, isolated completion input, 3 shake modes, responsive layout and retry flags');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
