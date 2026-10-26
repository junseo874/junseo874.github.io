const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
 await p.locator('.updates-confirm').click();
 await p.evaluate(()=>lunaCampaign.screen('developer'));
 for(const kind of ['pour','fill_up','open','stir','shake']){
  await p.evaluate(kind=>{barGame.startMinigame(kind);barGame.craft.elapsed=62.4;barGame.gimmick.elapsed=7;},kind);
  const clock=p.locator('.craft-screen .craft-timer');await clock.waitFor();
  await p.waitForFunction(()=>document.querySelector('.craft-timer')?.dataset.craftSeconds==='62');
  if(['stir','shake'].includes(kind)&&await p.locator('.mix-tutorial').isVisible()){
   await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),62.4,'tutorial excludes time');
   await p.locator('.mix-lesson-next').click();await p.waitForFunction(()=>document.querySelector('.mix-guide-page')?.textContent.includes('2'));await p.locator('.mix-lesson-next').click();await p.locator('.mix-tutorial').waitFor({state:'hidden'});
  }
  assert.equal(await clock.count(),1);assert.equal(await clock.getAttribute('aria-label'),'제조시간 01:02');
  assert.match(await clock.locator('img').getAttribute('src'),/ICN_sitr_time.png/);
  for(const viewport of [{width:1280,height:720},{width:820,height:650},{width:1920,height:1080}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(100);
   const boxes=await p.evaluate(()=>{
    const s=document.querySelector('.craft-screen').getBoundingClientRect(),t=document.querySelector('.craft-timer').getBoundingClientRect(),scale=s.width/1280;
    return {top:(t.top-s.top)/scale,right:(s.right-t.right)/scale,width:t.width/scale,bottom:t.bottom<=s.bottom,left:t.left>=s.left};
   });
   assert(Math.abs(boxes.top-54)<1&&Math.abs(boxes.right-73)<1&&boxes.bottom&&boxes.left,kind+JSON.stringify(boxes));
   if(kind==='shake')assert(await p.evaluate(()=>document.querySelector('.rhythm-modes').getBoundingClientRect().top>document.querySelector('.craft-timer').getBoundingClientRect().bottom),'mode tabs must not overlap the clock');
  }
  await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/craft-clock-'+kind+'.png'});
  await p.evaluate(()=>LunaCaptureMode.set(true));assert.equal(await clock.evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await p.evaluate(()=>LunaCaptureMode.set(false));
  await p.evaluate(kind=>barGame.gimmickInput(kind==='stir'?'KeyW':'Space'),kind);
  if(kind==='open'){await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),62.4,'opening is not scored time');}else await p.waitForFunction(()=>Number(document.querySelector('.craft-timer').dataset.craftSeconds)>62,null,{timeout:5000}).catch(async e=>{console.error(kind,await p.evaluate(()=>({elapsed:barGame.craft.elapsed,started:barGame.gimmick.started,completed:barGame.gimmick.completed,paused:barGame.paused,hidden:barGame.hidden,overlay:barGame.overlay,view:lunaCampaign.view})));throw e;});
  await p.keyboard.press('Escape');await p.locator('.luna-settings:visible').waitFor();
  const frozen=await p.evaluate(()=>barGame.craft.elapsed);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),frozen);
  await p.keyboard.press('Escape');
 }
 await p.evaluate(()=>{
  barGame.startMinigame('shake');barGame.minigame=null;barGame.craft.elapsed=125;
  lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.screen('game');
 });
 await p.locator('.main-story-mix.shake-screen .craft-timer').waitFor();
 if(await p.locator('.mix-tutorial').isVisible()){await p.locator('.mix-lesson-next').click();await p.waitForFunction(()=>document.querySelector('.mix-guide-page')?.textContent.includes('2'));await p.locator('.mix-lesson-next').click();await p.locator('.mix-tutorial').waitFor({state:'hidden'});}
 assert.equal(await p.locator('.rhythm-modes').count(),0);
 assert(await p.evaluate(()=>document.querySelector('.rhythm-stage').getBoundingClientRect().top>document.querySelector('.craft-timer').getBoundingClientRect().bottom),'main story keeps rhythm play below the shared clock');
 await p.screenshot({path:'/private/tmp/craft-clock-main-shake.png'});
 await p.evaluate(()=>{lunaCampaign.session.developer=true;lunaCampaign.screen('developer');barGame.startMinigame('stir');barGame.craft.elapsed=6001;});
 await p.waitForFunction(()=>document.querySelector('.craft-timer')?.dataset.craftSeconds==='6001');
 assert.equal(await p.locator('.craft-timer').getAttribute('aria-label'),'제조시간 100:01');
 assert.equal(await p.locator('.stir-clock').getAttribute('viewBox'),'0 0 120 33');
 await p.evaluate(()=>barGame.startMinigame('pour'));await p.waitForFunction(()=>document.querySelector('.craft-timer')?.dataset.craftSeconds==='0');
 assert.deepEqual(errors,[]);console.log('CRAFT_CLOCK_UI_OK: five screens, same art/position, cumulative rather than step time, live update, pause, capture, three sizes, long duration and reset');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
