const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const C=require(dir+'/core'),R=require(dir+'/remix'),M=require(dir+'/minigames'),P=require(dir+'/pour-fluid');
function game(kind,variant){const g=new C.Game(ctx.window.LUNA_DATA);R.attach(g);M.attach(g);g.startMinigame(kind,variant);return g;}
for(const variant of ['original','gpt']){
 for(const offset of [-10,-3,0,3,10,10.01]){
  const g=game('open',variant),s=g.gimmick;g.gimmickInput('Space');
  s.beatTime=(1-offset/(g.c('open_start_radius_px')-g.c('open_target_radius_px')))*g.c('open_approach_sec');
  g.gimmickInput('Space');assert.equal(s.completed,Math.abs(offset)<=10);
  assert.equal(s.openFx.perfect,Math.abs(offset)<=3);assert.equal(s.failures,Math.abs(offset)<=10?0:1);
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
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('open',v),variant);await p.locator('[data-opening-stage]').waitFor();
  await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('[data-opening-stage]').dataset.openAudioReady==='true');
  await p.evaluate(()=>{barGame.gimmick.beatTime=barGame.c('open_approach_sec');barGame.gimmickInput('Space');});
  await p.waitForTimeout(140);await p.evaluate(()=>barGame.paused=true);await p.waitForTimeout(80);
  assert.equal(await p.locator('[data-open-feedback]').innerText(),'PERFECT!');
  assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-perfect'),'true');
  await p.evaluate(()=>{window.polishTick=barGame.tick;barGame.tick=()=>{};barGame.paused=false;});await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/polish-open-'+variant+'.png'});await p.evaluate(()=>barGame.tick=window.polishTick);
  await p.evaluate(v=>barGame.startMinigame('pour',v),variant);await p.locator('.fluid-screen').waitFor();
  await p.evaluate(()=>{
   const g=barGame,s=g.gimmick;g.holdPour(true);
   for(let i=0;i<4000&&!s.pourFinishFx;i++){if(!s.fluid.finishRequested&&s.fluid.predicted(s)>=s.target)g.endGimmick();g.tick(1/120);}
   if(!s.pourFinishFx)throw Error('Pour never settled');g.paused=true;
  });await p.waitForTimeout(100);
  assert.equal(await p.locator('[data-pour-perfect]').isVisible(),true);
  assert(await p.evaluate(()=>Math.abs(barGame.gimmick.pourFinishFx.errorMl)<=5));
  await p.evaluate(()=>{window.polishTick=barGame.tick;barGame.tick=()=>{};barGame.paused=false;});await p.waitForTimeout(100);
  await p.screenshot({path:'/private/tmp/polish-pour-'+variant+'.png'});await p.evaluate(()=>barGame.tick=window.polishTick);
  await p.evaluate(()=>barGame.paused=false);await p.locator('.minigame-result').waitFor();
  await p.evaluate(v=>barGame.startMinigame('shake',v),variant);await p.locator('.shake-screen').waitFor();await p.keyboard.press('Space');
  for(let i=0;i<6;i++){await p.evaluate(()=>{barGame.gimmick.pathPoint=[0,0];barGame.gimmickInput('Space');});await p.waitForTimeout(70);}
  assert.equal(await p.locator('.shake-screen').getAttribute('data-shake-streak'),'6');
  await p.screenshot({path:'/private/tmp/polish-shake-'+variant+'.png'});
  await p.evaluate(()=>{barGame.gimmick.pathPoint=[9,9];barGame.gimmickInput('Space');});await p.waitForTimeout(70);
  assert.equal(await p.locator('.shake-screen').getAttribute('data-shake-streak'),'0');
  await p.evaluate(()=>{const g=barGame;while(!g.gimmick.completed){g.gimmick.pathPoint=[0,0];g.gimmickInput('Space');}});
  await p.waitForTimeout(100);assert.equal(await p.locator('.shake-screen').getAttribute('data-shake-finale'),'true');
  await p.evaluate(v=>barGame.startMinigame('stir',v),variant);await p.locator('.stir-screen').waitFor();await p.keyboard.press('KeyW');
  for(const k of ['KeyD','KeyS','KeyA','KeyW','KeyD','KeyS','KeyA','KeyW']){await p.keyboard.press(k);await p.waitForTimeout(220);}
  assert(Number(await p.locator('.stir-screen').getAttribute('data-stir-flow'))>.5);
  await p.screenshot({path:'/private/tmp/polish-stir-'+variant+'.png'});
  await p.waitForTimeout(600);const frame=await p.evaluate(()=>barGame.gimmick.motionFrame);
  await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),frame);
  await p.keyboard.press('Escape');await p.waitForTimeout(70);const frozen=await p.locator('[data-stir-polish]').innerHTML();
  await p.waitForTimeout(150);assert.equal(await p.locator('[data-stir-polish]').innerHTML(),frozen);
  await p.keyboard.press('Escape');
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>barGame.startMinigame('stir','original'));await p.keyboard.press('KeyW');await p.keyboard.press('KeyD');await p.waitForTimeout(100);
 assert.equal(await p.locator('[data-stir-polish] g').count(),0);
 assert.deepEqual(errors,[]);console.log('POLISH_UI_OK: both variants, exact pop, physically settled perfect pour, streak/reset/finale, smooth stir flow, hand stops, pause, reduced motion.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
