const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('luna.shake.mode.v1','cross');localStorage.setItem('luna.shake.sound.v2','1');});
 await p.goto('http://127.0.0.1:8123/bar-playtest/');
 await p.evaluate(()=>lunaCampaign.newGame('A'));await p.waitForFunction(()=>lunaCampaign.view==='prologue');
 await p.evaluate(()=>{const c=lunaCampaign;c.disposeCinema();c.outside.exit(true);c.screen('game');
  window.prepareShake=()=>{
   const g=barGame;g.reset(99,'practice',2);g.selectCocktail('gin_fizz');g.debugFill();g.startCraft();
   g.craft.index=g.craft.queue.findIndex(s=>s.type==='shake');if(g.craft.index<0)throw Error('Missing shake step');g.nextGimmick();
  };prepareShake();
 });
 await p.locator('.main-story-mix .rhythm-board').waitFor();
 assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),'path');
 await p.waitForFunction(()=>document.querySelector('.shake-screen')?.dataset.shakeSound==='2');
 assert.equal(await p.locator('[data-act="shakeMode"],[data-act="shakeSound"],.shake-sound-picker,.rhythm-modes').count(),0);
 // Even stale/injected selector actions cannot change the main-story setting.
 await p.evaluate(()=>{
  for(const [act,id]of [['shakeMode','fall'],['shakeSound','1']]){
   const button=document.createElement('button');button.dataset.act=act;button.dataset.id=id;document.querySelector('#app').append(button);button.click();button.remove();
  }
 });
 assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),'path');
 await p.waitForFunction(()=>document.querySelector('.shake-screen')?.dataset.shakeSound==='2');
 for(const [width,height]of [[1280,720],[960,540],[1920,1080]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  const boxes=await p.locator('.main-story-mix .mix-cinema,.main-story-mix .rhythm-board,.main-story-mix .rhythm-stage,.main-story-mix .rhythm-pads').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}));
  for(const r of boxes){assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1);assert(r.w>100&&r.h>15);}
  assert(Math.abs(boxes[0].h-boxes[1].h)<2);
 }
 await p.setViewportSize({width:1280,height:720});await p.screenshot({path:'/private/tmp/main-shake-fixed.png'});
 while(await p.locator('.mix-tutorial').isVisible())await p.locator('[data-act="mixTutorialNext"]').click();
 await p.keyboard.press('Space');assert(await p.evaluate(()=>barGame.gimmick.started));
 await p.evaluate(()=>{
  const g=barGame,s=g.gimmick;
  for(let guard=0;!s.completed&&guard<20000;guard++){g.tickGimmick(.005);if(LunaCore.MIX.nearest(s))g.gimmickInput('Space');}
  if(!s.completed)throw Error('Shake not complete');
 });
 await p.waitForFunction(()=>barGame.craft.results.some(r=>r.type==='shake'));





 await p.evaluate(()=>{lunaCampaign.developer();barGame.startMinigame('shake');});
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 while(await p.locator('.mix-tutorial').isVisible())await p.locator('[data-act="mixTutorialNext"]').click();
 await p.locator('.rhythm-modes').waitFor();await p.locator('[data-act="shakeMode"][data-id="fall"]').click();
 assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),'fall');
 await p.locator('[data-act="shakeSound"][data-id="2"]').click();
 await p.waitForFunction(()=>document.querySelector('.shake-screen')?.dataset.shakeSound==='2');
 assert.deepEqual(errors,[]);console.log('MAIN_SHAKE_OK: fixed path + sound 2, no selectors, protected actions, viewport fit, input/completion, developer preserved.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
