const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  const setup=(kind,mode='path')=>p.evaluate(({kind,mode})=>{const g=barGame;lunaCampaign.ui.shakeMode=mode;g.reset(99,'practice',1);g.selectCocktail(kind==='stir'?'dry_martini':'gin_fizz');g.debugFill();g.startCraft();g.craft.index=g.craft.queue.findIndex(s=>s.type===kind);g.nextGimmick();lunaCampaign.render(true);},{kind,mode});
  const lesson=p.locator('.mix-tutorial');
  const frozen=()=>p.evaluate(()=>({started:barGame.gimmick.started,time:barGame.craft.elapsed,attempts:barGame.gimmick.attempts,failures:barGame.gimmick.failures}));
  await setup('stir');assert(await lesson.isVisible());assert(await p.locator('.mix-screen').evaluate(e=>e.inert));
  assert.equal(await p.locator('.mix-lesson-next').innerText(),'연습하기 · E');
  const before=await frozen();await p.waitForTimeout(400);assert.deepEqual(await frozen(),before);
  await p.keyboard.press('KeyE');await p.keyboard.press('KeyD');
  assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.index),0);assert.deepEqual(await frozen(),before);
  await p.screenshot({path:'/private/tmp/luna-stir-tutorial.png'});
  await p.keyboard.press('Escape');assert.equal(await lesson.count(),0);const clock=await p.evaluate(()=>barGame.gimmick.mixTutorial.clock);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.clock),clock);await p.keyboard.press('Escape');
  for(const key of ['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','ArrowUp'])await p.keyboard.press(key);
  assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.step),'done');assert.deepEqual(await frozen(),before);
  assert.equal(await p.locator('.mix-lesson-next').innerText(),'제조 시작 · E');
  await p.keyboard.press('KeyE');assert.equal(await lesson.count(),0);assert.equal(await p.evaluate(()=>barGame.progress.flags.mix_tutorial_stir),true);
  assert.deepEqual(await frozen(),before,'Acknowledgement does not leak into real gameplay');
  await p.keyboard.press('KeyW');assert.equal(await p.evaluate(()=>barGame.gimmick.started),true);
  await p.evaluate(()=>{barGame.nextGimmick();lunaCampaign.render(true);});assert.equal(await lesson.count(),0,'Next attempt does not repeat completed tutorial');
  for(const mode of ['path','fall','cross']){
   await setup('shake',mode);assert(await lesson.isVisible());
   await p.locator('[data-act="mixTutorialNext"]').click();
   await p.keyboard.press(mode==='path'?'Space':'KeyA');assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.hits),0);
   const initial=await frozen();
   await p.screenshot({path:'/private/tmp/luna-shake-tutorial-'+mode+'.png'});
   for(let i=0;i<2;i++){
    await p.evaluate(()=>{barGame.gimmick.mixTutorial.clock=.98;});
    if(mode==='path')await p.locator('[data-act="mixTutorialKey"]').click();else await p.keyboard.press(i?'ArrowRight':'ArrowLeft');
   }
   assert.equal(await p.evaluate(()=>barGame.gimmick.mixTutorial.step),'done');assert.deepEqual(await frozen(),initial);
   await p.locator('[data-act="mixTutorialNext"]').click();assert.equal(await lesson.count(),0);assert.equal(await p.evaluate(()=>barGame.progress.flags.mix_tutorial_shake),true);
   await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.started),true);
   await p.evaluate(()=>{barGame.nextGimmick();lunaCampaign.render(true);});assert.equal(await lesson.count(),0);
  }
  await setup('stir');assert(await lesson.isVisible(),'Fresh game resets first-use guidance');
  await p.setViewportSize({width:820,height:650});const rect=await p.locator('.mix-lesson-card').boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=820&&rect.y+rect.height<=650);
  await p.evaluate(()=>{barGame.startMinigame('stir');lunaCampaign.render(true);});assert(await lesson.isVisible());
  await p.keyboard.press('KeyE');for(const key of ['KeyW','KeyD','KeyS','KeyA','KeyW'])await p.keyboard.press(key);await p.keyboard.press('KeyE');
  await p.evaluate(()=>{barGame.startMinigame('stir');lunaCampaign.render(true);});assert.equal(await lesson.count(),0,'Standalone retries also retain completion');
  await p.evaluate(()=>{barGame.startMinigame('shake');lunaCampaign.render(true);});assert(await lesson.isVisible(),'Each skill has its own first-use flag');
  await p.evaluate(()=>{barGame.startMinigame('shake');lunaCampaign.render(true);});assert(await lesson.isVisible(),'Abandoned lessons are not marked complete');
  assert.deepEqual(errors,[]);console.log('PASS: first-use stirring/shaking lessons, safe practice, all shake controls, pause, completion, no repeat, fresh reset, responsive layout, standalone retries and abandoned lessons.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
