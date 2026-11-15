const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data/runtime/game-data.js','utf8'),ctx);
const C=require('../src/core/core.js'),R=require('../src/features/bar/remix.js'),M=require('../src/features/crafting/minigames.js'),P=require('../src/features/crafting/pour-fluid.js');
function game(kind,variant){const g=new C.Game(ctx.window.LUNA_DATA);R.attach(g);M.attach(g);g.startMinigame(kind,variant);return g;}
for(const variant of ['original','gpt']){
 for(const offset of [-.141,-.13,-.064,0,.064,.13,.141]){
  const g=game('open',variant),s=g.gimmick;g.gimmickInput('Space');
  s.powerPos=.78;g.gimmickInput('Space');for(let i=0;i<30;i++)g.tick(.02);
  assert.equal(s.openPhase,'rhythm');s.beatTime=1.1+offset;
  g.gimmickInput('Space');assert.equal(s.completed,Math.abs(offset)<=.14);
  assert.equal(s.openFx.perfect,Math.abs(offset)<=.065);assert.equal(s.failures,Math.abs(offset)<=.14?0:1);
 }
 for(const unit of ['ml','oz','tsp'])for(const delta of [-5.001,-5,0,5,5.001]){
  const g=game('pour',variant),s=g.gimmick;s.unit=unit;s.target=unit==='ml'?45:unit==='oz'?1.5:9;P.init(s,g);
  s.started=true;s.fluid.ready=true;s.fluid.finishRequested=true;s.fluid.caughtMl=s.fluid.targetMl+delta;s.value=s.fluid.caughtMl/s.fluid.unitMl;
  g.endGimmick();assert.equal(s.pourFinishFx.perfect,Math.abs(delta)<=5);
  const time=g.craft.elapsed;g.endGimmick();assert.equal(g.craft.results.length,0);
  g.overlay='settings';g.tick(.2);assert.equal(s.pourFinishFx.age,0);g.overlay=null;
  for(let i=0;i<6;i++)g.tick(.2);
  assert.equal(g.craft.results.length,1);assert.equal(g.craft.elapsed,time);assert.equal(g.screen,'minigame_result');
 }
}
console.log('POLISH_UNIT_OK: open exact/edge success, ±5ml inclusive in ml/oz/tsp, no extra score/time, pause, one commit.');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');await p.locator('.updates-confirm').click();await p.evaluate(()=>lunaCampaign.screen('developer'));
 async function dismissGuide(){
  if(await p.locator('.mix-tutorial').isVisible()){await p.locator('.mix-lesson-next').click();await p.waitForFunction(()=>document.querySelector('.mix-guide-page')?.textContent.includes('2'));await p.locator('.mix-lesson-next').click();await p.locator('.mix-tutorial').waitFor({state:'hidden'});}
 }
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('open',v),variant);await p.locator('[data-opening-stage]').waitFor();
  await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('[data-opening-stage]').dataset.openAudioReady==='true');
  await p.evaluate(()=>{const s=barGame.gimmick;s.powerPos=.78;barGame.gimmickInput('Space');for(let i=0;i<30;i++)barGame.tick(.02);s.beatTime=1.1;barGame.gimmickInput('Space');});
  await p.waitForTimeout(140);await p.evaluate(()=>barGame.paused=true);await p.waitForTimeout(80);
  assert.equal(await p.locator('[data-open-feedback]').innerText(),'PERFECT!');
  assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-perfect'),'true');
  await p.evaluate(()=>{window.polishTick=barGame.tick;barGame.tick=()=>{};barGame.paused=false;});await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/polish-open-'+variant+'.png'});await p.evaluate(()=>barGame.tick=window.polishTick);
  await p.evaluate(v=>barGame.startMinigame('pour',v),variant);await p.locator('.fluid-screen').waitFor();
  await p.evaluate(()=>{
   const g=barGame,s=g.gimmick;g.holdPour(true);
   for(let i=0;i<4000&&!s.pourFinishFx;i++){if(s.held&&s.fluid.predicted(s)>=s.target)g.holdPour(false);if(s.fluid.canFinish(s))g.endGimmick();g.tick(1/120);}
   if(!s.pourFinishFx)throw Error('Pour never settled');g.paused=true;
  });await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-pour-perfect]').isVisible(),true);
  assert(await p.evaluate(()=>Math.abs(barGame.gimmick.pourFinishFx.errorMl)<=5));
  await p.evaluate(()=>{window.polishTick=barGame.tick;barGame.tick=()=>{};barGame.paused=false;});await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/polish-pour-'+variant+'.png'});await p.evaluate(()=>barGame.tick=window.polishTick);
  await p.evaluate(()=>barGame.paused=false);await p.locator('.minigame-result').waitFor();
  await p.evaluate(v=>barGame.startMinigame('shake',v),variant);await p.locator('.shake-screen').waitFor();await dismissGuide();await p.keyboard.press('Space');
  for(let i=0;i<6;i++){await p.evaluate(()=>{const s=barGame.gimmick;s.nodes=[{id:'qa-hit'+s.attempts,x:1,y:1}];s.pathPoint=[1,1];barGame.gimmickInput('Space');});await p.waitForTimeout(70);}
  assert.equal(await p.evaluate(()=>barGame.gimmick.success),6);
  await p.screenshot({path:'/private/tmp/polish-shake-'+variant+'.png'});
  await p.evaluate(()=>{barGame.gimmick.pathPoint=[9,9];barGame.gimmickInput('Space');});await p.waitForTimeout(70);
  assert.equal(await p.evaluate(()=>barGame.gimmick.shakeEffects.at(-1).ok),false);
  await p.evaluate(()=>{const g=barGame,s=g.gimmick;for(let i=0;i<s.targetStacks&&!s.completed;i++){s.nodes=[{id:'qa-end'+i,x:1,y:1}];s.pathPoint=[1,1];g.gimmickInput('Space');}});
  await p.waitForTimeout(100);assert.equal(await p.locator('.shake-screen').getAttribute('data-shake-finale'),'true');
  await p.evaluate(v=>barGame.startMinigame('stir',v),variant);await p.locator('.stir-screen').waitFor();await dismissGuide();await p.keyboard.press('KeyW');
  for(const k of ['KeyD','KeyS','KeyA','KeyW','KeyD','KeyS','KeyA','KeyW']){await p.keyboard.press(k);await p.waitForTimeout(220);}
  assert.equal(await p.evaluate(()=>barGame.gimmick.success),2);assert(await p.locator('[data-stir-polish] g').isVisible());
  await p.screenshot({path:'/private/tmp/polish-stir-'+variant+'.png'});
  await p.waitForTimeout(600);const frame=await p.evaluate(()=>barGame.gimmick.motionFrame);
  await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),frame);
  await p.keyboard.press('Escape');await p.waitForTimeout(70);const frozen=await p.locator('[data-stir-polish]').innerHTML();
  await p.waitForTimeout(150);assert.equal(await p.locator('[data-stir-polish]').innerHTML(),frozen);
  await p.keyboard.press('Escape');
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>barGame.startMinigame('stir','original'));await p.keyboard.press('KeyW');await p.keyboard.press('KeyD');await p.waitForTimeout(100);
 assert.equal(await p.locator('[data-stir-polish] g').count(),0);
 assert.deepEqual(errors,[]);console.log('POLISH_UI_OK: both variants, exact pop, physically settled perfect pour, six distinct hits, miss and finale, smooth stir flow, hand stops, pause, reduced motion.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
