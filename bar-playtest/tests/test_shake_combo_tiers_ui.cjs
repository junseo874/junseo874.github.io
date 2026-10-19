// Regression: the removed combo thresholds must never affect mixing again.
const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();await p.addStyleTag({content:'.qa-launch{display:none!important}'});
 const absent=async()=>{assert.equal(await p.locator('[data-rhythm-combo],.rhythm-combo-fire,.combo-flame,[data-rhythm-heat],.rhythm-speed-lines,.rhythm-note-tail,[data-combo-tier],[data-rhythm-tier],[data-stir-flow],[data-shake-streak]').count(),0);assert(!/COMBO|콤보|HEAT/.test(await p.locator('.craft-screen').innerText()));};
 for(const variant of ['original','gpt'])for(const mode of ['fall','cross','path']){
  await p.evaluate(({variant,mode})=>{const g=barGame;g.startMinigame('shake',variant);g.progress.flags.mix_tutorial_shake=true;delete g.gimmick.mixTutorial;LunaShakeRhythm.init(g.gimmick,mode);g.gimmickInput('Space');window.testTick=g.tick;g.tick=()=>{};},{variant,mode});
  await p.locator('.rhythm-board').waitFor();
  for(const goal of [4,5,10,19]){
   const state=await p.evaluate(goal=>{const g=barGame,s=g.gimmick;for(let guard=0;s.success<goal&&guard<20000;guard++){if(s.rhythm.mode==='path'){g.tickGimmick(.005);if(LunaCore.MIX.nearest(s))g.gimmickInput('Space');}else{const n=s.rhythm.notes.find(n=>!n.status);s.rhythm.trackTime=n.time;g.gimmickInput(n.lane?'KeyD':'KeyA');}}if(s.success!==goal)throw Error('Shake target not reached');
    const track=s.rhythm.trackTime,clock=s.rhythm.clock,elapsed=s.elapsed;g.tickGimmick(.05);
    return {delta:s.rhythm.trackTime-track,motion:s.rhythm.clock-clock,real:s.elapsed-elapsed,success:s.success,combo:s.rhythm.combo??null,best:s.rhythm.best??null};},goal);
   assert.equal(state.success,goal);assert.equal(state.combo,null);assert.equal(state.best,null);assert(Math.abs(state.delta-.05)<1e-8);assert(Math.abs(state.motion-.05)<1e-8);assert(Math.abs(state.real-.05)<1e-8);await p.waitForTimeout(70);await absent();
  }
  if(variant==='original'&&mode==='path')await p.screenshot({path:'/private/tmp/shake-no-combo.png'});
  const paused=await p.evaluate(()=>{barGame.paused=true;return JSON.stringify(barGame.gimmick);});await p.evaluate(()=>barGame.tickGimmick(.2));assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),paused);
  await p.evaluate(()=>{const g=barGame,s=g.gimmick;g.paused=false;if(s.rhythm.mode==='path'){for(let guard=0;!s.completed&&guard<20000;guard++){g.tickGimmick(.005);if(LunaCore.MIX.nearest(s))g.gimmickInput('Space');}}else{const n=s.rhythm.notes.find(n=>!n.status);s.rhythm.trackTime=n.time;g.gimmickInput(n.lane?'KeyD':'KeyA');}if(!s.completed)throw Error('Shake not complete');g.tick=window.testTick;});
  await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);assert(!/콤보|COMBO|Best combo/.test(await p.locator('.minigame-result').innerText()));assert.equal(await p.evaluate(()=>barGame.minigame.result.rhythm.bestCombo??null),null);
 }
 for(const variant of ['original','gpt']){
  await p.evaluate(variant=>{const g=barGame;g.startMinigame('stir',variant);g.progress.flags.mix_tutorial_stir=true;delete g.gimmick.mixTutorial;g.gimmickInput('KeyW');window.testTick=g.tick;g.tick=()=>{};for(let i=0;i<20;i++)g.gimmickInput(['KeyW','KeyD','KeyS','KeyA'][(g.gimmick.stirPos+1)%4]);},variant);
  await p.locator('.stir-screen').waitFor();await p.waitForTimeout(100);await absent();assert(await p.evaluate(()=>barGame.gimmick.success>0));
  if(variant==='original')await p.screenshot({path:'/private/tmp/stir-no-combo.png'});
  await p.evaluate(()=>{const g=barGame;for(let i=0;i<100&&!g.gimmick.completed;i++)g.gimmickInput(['KeyW','KeyD','KeyS','KeyA'][(g.gimmick.stirPos+1)%4]);g.tick=window.testTick;});
  await p.locator('[data-act="endGimmick"]').click();
  await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);
 }
 assert.deepEqual(errors,[]);console.log('MIX_NO_COMBO_OK: both variants, all shake modes, 4/5/10/19 hits stay at 1x, no combo state/assets/prototype/ui/FX/results, stir completion and scoring, pause');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
