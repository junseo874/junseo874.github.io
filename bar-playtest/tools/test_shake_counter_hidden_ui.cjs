const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  for(const mode of ['path','fall','cross']){
   await page.locator('[data-act="miniStart"][data-id="shake"]').click();
   while(await page.locator('.mix-tutorial').isVisible())await page.locator('[data-act="mixTutorialNext"]').click();
   await page.locator('[data-act="shakeMode"][data-id="'+mode+'"]').click();
   assert.equal(await page.locator('[data-rhythm-count]').count(),0);
   await page.keyboard.press('Space');
   await page.evaluate(()=>{window.savedCounterTick=barGame.tick;barGame.tick=()=>{};const s=barGame.gimmick;if(s.rhythm.mode==='path'){s.pathPoint=[...LunaCore.MIX.points[0]];barGame.gimmickInput('Space');}else{s.rhythm.trackTime=s.rhythm.notes[0].time;barGame.gimmickInput('KeyA');}});
   await page.waitForFunction(()=>document.querySelector('[data-rhythm-verdict]')?.textContent);
   assert.equal(await page.evaluate(()=>barGame.gimmick.attempts),1);
   assert.equal(await page.evaluate(()=>barGame.gimmick.success),1);
   assert.equal(await page.locator('[data-rhythm-count]').count(),0);
   if(mode==='path')await page.screenshot({path:'/private/tmp/shake-counter-hidden.png'});
   await page.evaluate(()=>{const g=barGame,s=g.gimmick;for(let guard=0;!s.completed&&guard<20000;guard++){if(s.rhythm.mode==='path'){g.tickGimmick(.005);if(LunaCore.MIX.nearest(s))g.gimmickInput('Space');}else{const n=s.rhythm.notes.find(n=>!n.status);s.rhythm.trackTime=n.time;g.gimmickInput(n.lane?'KeyD':'KeyA');}}if(!s.completed)throw Error('Shake not complete');g.tick=window.savedCounterTick;});
   await page.locator('.minigame-result').waitFor();
   assert.equal(await page.evaluate(()=>barGame.minigame.result.targetStacks),20);
   await page.locator('[data-act="miniLobby"]').click();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: all three shaking modes hide current/max count; successful input, verdict and 20-attempt completion remain intact');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
