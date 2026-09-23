const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(BASE);
 async function prepare(type){await p.evaluate(type=>{
  barGame.reset(99,'practice',1);barGame.selectCocktail(type==='stir'?'dry_martini':'gin_fizz');barGame.debugFill();barGame.startCraft();
  barGame.craft.index=barGame.craft.queue.findIndex(q=>q.type===type);barGame.nextGimmick();
 },type);await p.waitForTimeout(150);
 assert(await p.locator('.craft-top').evaluate(e=>{const hud=document.querySelector('.currency-hud').getBoundingClientRect();return [...e.children].every(child=>child.getBoundingClientRect().right<hud.left);}),'Craft header overlaps balance');}
 await prepare('stir');assert.equal(await p.locator('.mix-direction').count(),4);
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>barGame.gimmick.elapsed),0);
 await p.screenshot({path:'/private/tmp/bar-mix-stir-ready.png'});
 await p.keyboard.press('KeyW');await p.keyboard.press('KeyD');await p.keyboard.press('KeyS');
 assert.equal(await p.evaluate(()=>barGame.gimmick.stirStep),2);
 assert((await p.locator('.orbit-progress').getAttribute('stroke-dasharray')).startsWith('50 '));
 await p.keyboard.press('Escape');await p.waitForTimeout(100);
 const frozen=await p.evaluate(()=>barGame.gimmick.elapsed),frames=await p.locator('[data-motion-frame]').evaluateAll(es=>es.map(e=>e.dataset.motionFrame));
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>barGame.gimmick.elapsed),frozen);
 assert.deepEqual(await p.locator('[data-motion-frame]').evaluateAll(es=>es.map(e=>e.dataset.motionFrame)),frames);
 await p.keyboard.press('Escape');await p.screenshot({path:'/private/tmp/bar-mix-stir-playing.png'});
 await p.keyboard.press('KeyA');await p.keyboard.press('KeyW');assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 assert.equal(await p.locator('.mix-gauge i.good').count(),1);
 // Wrong direction is a red segment; timeout is another red segment, not a lost round.
 await p.keyboard.press('KeyA');assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),2);
 await p.evaluate(()=>{for(let i=0;i<21;i++)barGame.tick(.1)});assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),3);
 await p.waitForTimeout(150);assert.equal(await p.locator('.mix-gauge i.miss').count(),2);
 await p.screenshot({path:'/private/tmp/bar-mix-stir-outcomes.png'});
 for(let i=0;i<7;i++)for(const k of ['D','S','A','W'])await p.locator('.mix-direction[data-id="Key'+k+'"]').click();
 assert.equal(await p.evaluate(()=>barGame.gimmick.completed),true);assert.equal(await p.evaluate(()=>barGame.gimmick.outcomes.length),10);
 await p.locator('[data-act="endGimmick"]').click();assert.notEqual(await p.evaluate(()=>barGame.gimmick?.type),'stir');
 await prepare('shake');await p.screenshot({path:'/private/tmp/bar-mix-shake-ready.png'});
 assert.equal(await p.locator('.mix-gauge.vertical i').count(),20);
 await p.keyboard.press('Space');await p.evaluate(()=>{barGame.gimmick.beatTime=.72});await p.keyboard.press('Space');
 assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 await p.screenshot({path:'/private/tmp/bar-mix-shake-hit.png'});
 await p.evaluate(()=>{barGame.gimmick.beatTime=.99;barGame.tick(.02)});await p.waitForTimeout(150);
 assert.equal(await p.locator('.mix-gauge i.good').count(),1);
 await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.message),'MISS');
 await p.evaluate(()=>{barGame.gimmick.beatTime=.99;barGame.tick(.02)});await p.waitForTimeout(150);
 assert.equal(await p.locator('.mix-gauge i.miss').count(),1);
 const f=await p.locator('.mix-cinema [data-motion-frame]').getAttribute('data-motion-frame');
 await p.waitForFunction(f=>document.querySelector('.mix-cinema [data-motion-frame]').dataset.motionFrame!==f,f,{timeout:1500});
 const f2=await p.locator('[data-motion-frame]').evaluateAll(es=>es.map(e=>e.dataset.motionFrame));assert.equal(f2[0],f2[1]);
 await p.locator('[data-act="craftRecipe"]').click();const time=await p.evaluate(()=>barGame.gimmick.elapsed);
 await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>barGame.gimmick.elapsed),time);await p.keyboard.press('Escape');
 await p.evaluate(()=>{for(let i=barGame.gimmick.attempts;i<20;i++){barGame.gimmick.beatTime=.72;barGame.gimmick.hit=false;barGame.gimmickInput('Space');barGame.gimmick.beatTime=.99;barGame.tick(.02);}});
 assert.equal(await p.evaluate(()=>barGame.gimmick.completed),true);
 await p.waitForTimeout(100);assert.equal(await p.locator('.mix-gauge i.good').count(),19);assert.equal(await p.locator('.mix-gauge i.miss').count(),1);
 await p.screenshot({path:'/private/tmp/bar-mix-shake-complete.png'});
 for(const size of [{width:1440,height:900},{width:820,height:650}]){await p.setViewportSize(size);await p.screenshot({path:'/private/tmp/bar-mix-shake-'+size.width+'.png'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.locator('[data-act="endGimmick"]').click();assert.notEqual(await p.evaluate(()=>barGame.gimmick?.type),'shake');
 await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth),null,{timeout:10000});
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)),[]);
 console.log('MIX_UI_OK: stir keyboard/mouse, round progress, success/miss/timeout history, shake timing/path, synchronized source animation, ready/pause/menu time freeze, completion, scaling.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
