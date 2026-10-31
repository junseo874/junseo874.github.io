const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 for(const type of ['pour','fill_up']){
  await p.evaluate(type=>{LunaFocusSettings.setEnabled(false);barGame.startMinigame(type);},type);
  const finish=p.locator('.pour-finish');await finish.waitFor();assert(await finish.isDisabled());
  await p.keyboard.down('Space');await p.waitForFunction(()=>barGame.gimmick.angle>100);
  assert(await finish.isDisabled());await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.finishRequested),false);
  await p.keyboard.up('Space');
  const state=await p.evaluate(()=>{const g=barGame,s=g.gimmick;document.querySelector('.pour-finish').click();return {angle:s.angle,accepted:g.endGimmick(),requested:s.fluid.finishRequested};});
  assert(state.angle>0);assert.equal(state.accepted,false);assert.equal(state.requested,false);
  await p.keyboard.press('Enter');await p.screenshot({path:'/private/tmp/pour-finish-locked-'+type+'.png'});
  await p.waitForFunction(()=>barGame.gimmick.fluid.canFinish(barGame.gimmick));await p.waitForFunction(()=>!document.querySelector('.pour-finish').disabled);
  assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.finishRequested),false);assert.equal(await finish.textContent(),'따르기 마치기 →');
  if(type==='pour')await finish.click();else await p.keyboard.press('Enter');
  await p.waitForFunction(()=>barGame.gimmick?.fluid.finishRequested);assert(await finish.isDisabled());assert.equal(await finish.textContent(),'정리 중..');
  await p.screenshot({path:'/private/tmp/pour-finish-cleanup-'+type+'.png'});
  await p.waitForFunction(()=>barGame.screen==='minigame_result');assert.equal(await p.evaluate(()=>barGame.craft.results.length),1);
 }
 assert.deepEqual(errors,[]);console.log('POUR_FINISH_LOCK_UI_OK: bottle/can, disabled while held/returning, Enter/click guard, short cleanup label, automatic completion');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
