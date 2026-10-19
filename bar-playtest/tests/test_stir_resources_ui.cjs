const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 if(await p.locator('.updates-confirm').isVisible()){await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();}
 await p.evaluate(()=>barGame.startMinigame('stir','original'));await p.locator('.stir-screen').waitFor();
 assert.match(await p.locator('.stir-screen').evaluate(e=>getComputedStyle(e).backgroundImage),/BG_stir.png/);
 assert.equal(await p.locator('[data-motion-frame]').count(),2);
 assert.equal(await p.locator('.stir-resource-gauge i').count(),await p.evaluate(()=>barGame.gimmick.targetStacks));
 for(const k of ['W','D','S','A'])assert.equal(await p.locator('[data-act="stir"][data-id="Key'+k+'"]').count(),1);
 async function key(k){await p.keyboard.press('Key'+k);await p.waitForTimeout(60);}
 await key('W');assert.match(await p.locator('[data-id="KeyW"]').evaluate(e=>getComputedStyle(e).backgroundImage),/BTN_key_A/);
 assert.match(await p.locator('[data-id="KeyD"]').evaluate(e=>getComputedStyle(e).backgroundImage),/BTN_key_B/);
 await p.locator('[data-id="KeyD"]').hover();assert.match(await p.locator('[data-id="KeyD"]').evaluate(e=>getComputedStyle(e).backgroundImage),/BTN_key_B/);
 await p.mouse.move(5,5);for(const k of ['D','S','A','W'])await key(k);
 assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 assert.match(await p.locator('.mix-gauge .good image').getAttribute('href'),/GAU_stir_success/);
 const frameBefore=await p.locator('[data-motion-frame]').evaluateAll(es=>es.map(e=>e.dataset.motionFrame));assert.equal(frameBefore[0],frameBefore[1]);
 await key('S');assert.equal(await p.evaluate(()=>barGame.gimmick.failures),1);assert.match(await p.locator('.mix-gauge .miss image').getAttribute('href'),/GAU_stir_fail/);
 await p.keyboard.press('Escape');const paused=await p.evaluate(()=>JSON.stringify(barGame.gimmick));await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),paused);await p.keyboard.press('Escape');
 await p.screenshot({path:'/private/tmp/luna-stir-resources.png'});
 // Main-game view uses the same layout, with no developer sound/navigation controls.
 await p.evaluate(()=>{barGame.minigame=null;lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.storyVersion='A';lunaCampaign.screen('game');lunaCampaign.render(true);});
 assert.equal(await p.locator('.stir-sound-picker,.gimmick-exit').count(),0);
 await p.screenshot({path:'/private/tmp/luna-stir-resources-main.png'});
 for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(100);
  const screen=await p.locator('.stir-screen').boundingBox();
  for(const sel of ['.stir-dial','.stir-resource-gauge','.mix-timer','.stir-detail','.gimmick-finish']){const box=await p.locator(sel).boundingBox();assert(box.x>=screen.x-1&&box.y>=screen.y-1&&box.x+box.width<=screen.x+screen.width+1&&box.y+box.height<=screen.y+screen.height+1,sel+' is within stage');}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.evaluate(()=>{lunaCampaign.session.developer=true;barGame.startMinigame('stir','original');barGame.gimmickInput('KeyW');for(let i=0;i<100&&!barGame.gimmick.completed;i++)barGame.gimmickInput(['KeyW','KeyD','KeyS','KeyA'][(barGame.gimmick.stirPos+1)%4]);});
 await p.locator('[data-act="endGimmick"]').click();await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);
 await p.locator('[data-act="miniRetry"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);assert.equal(await p.locator('.mix-gauge .good,.mix-gauge .miss').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('PASS Stir V3 resources: layout, pressed/next/hover keys, success/fail gauge, synced close-up, pause, main-story controls, small/full HD bounds, completion/score/retry, no missing assets.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
