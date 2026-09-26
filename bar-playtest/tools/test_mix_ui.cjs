const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],bad=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});await p.goto(BASE);
 async function prepare(type){await p.evaluate(type=>{
  barGame.reset(99,'practice',1,true,{variant:'original'});barGame.selectCocktail(type==='stir'?'dry_martini':'gin_fizz');barGame.debugFill();barGame.startCraft();
  barGame.craft.index=barGame.craft.queue.findIndex(q=>q.type===type);barGame.nextGimmick();
 },type);await p.waitForTimeout(200);await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 assert.equal(await p.locator('.craft-top,.gimmick-footer,.currency-hud').count(),0);assert(await p.locator('.gimmick-finish').isVisible());}
 await prepare('stir');assert.equal(await p.locator('.mix-direction').count(),4);
 assert.equal(await p.locator('.stir-live-glass [data-ice-cube]').count(),6);assert.equal(await p.locator('.stir-side-glass [data-ice-cube]').count(),6);
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>barGame.gimmick.elapsed),0);
 await p.screenshot({path:'/private/tmp/bar-mix-stir-ready.png'});
 const ready=await p.locator('.stir-live-glass').innerHTML();
 await p.keyboard.press('KeyW');await p.waitForTimeout(120);assert.equal(await p.locator('.stir-live-glass').innerHTML(),ready);
 await p.keyboard.press('KeyD');await p.keyboard.press('KeyS');assert.equal(await p.evaluate(()=>barGame.gimmick.stirStep),2);
 await p.waitForTimeout(150);assert(await p.evaluate(()=>barGame.gimmick.spoonAngle>150));assert(await p.evaluate(()=>barGame.gimmick.swirlSpeed>0));
 const progress=parseFloat(await p.locator('.orbit-progress').getAttribute('stroke-dasharray'));assert(progress>50&&progress<100,'Ring shows remaining time, not quarter count');
 await p.screenshot({path:'/private/tmp/bar-mix-stir-playing.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(100);
 const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick)),glass=await p.locator('.stir-live-glass').innerHTML();
 await p.waitForTimeout(350);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);assert.equal(await p.locator('.stir-live-glass').innerHTML(),glass);
 await p.keyboard.press('Escape');await p.keyboard.press('KeyA');await p.keyboard.press('KeyW');assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 await p.keyboard.press('KeyA');assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),2);
 await p.evaluate(()=>{for(let i=0;i<21;i++)barGame.tick(.1)});assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),3);
 await p.waitForTimeout(100);assert.equal(await p.locator('.mix-gauge i.miss').count(),2);
 for(let i=0;i<7;i++)for(const k of ['D','S','A','W'])await p.locator('.mix-direction[data-id="Key'+k+'"]').click();
 assert.equal(await p.evaluate(()=>barGame.gimmick.completed),true);assert.equal(await p.evaluate(()=>barGame.gimmick.outcomes.length),10);
 await p.locator('[data-act="endGimmick"]').click();assert.notEqual(await p.evaluate(()=>barGame.gimmick?.type),'stir');
 await prepare('shake');assert.equal(await p.locator('.mix-gauge.vertical i').count(),20);
 await p.screenshot({path:'/private/tmp/bar-mix-shake-ready.png'});
 await p.locator('[data-shake-surface]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.started),true);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);
 await p.waitForTimeout(650);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),0);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);
 await p.waitForFunction(()=>{const s=barGame.gimmick,n=LunaCore.MIX.nearest(s);return n&&!n.fixed&&n.distance<.08;},null,{polling:5,timeout:6000});
 await p.locator('[data-shake-surface]').click({position:{x:12,y:12},force:true});
 assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);assert.equal(await p.evaluate(()=>barGame.gimmick.motionClip),0);
 await p.waitForTimeout(150);const frames=await p.locator('[data-motion-frame]').evaluateAll(es=>es.map(e=>e.dataset.motionFrame));assert.equal(frames[0],frames[1]);
 await p.screenshot({path:'/private/tmp/bar-mix-shake-hit.png'});
 await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),0);
 await p.waitForFunction(()=>!LunaCore.MIX.nearest(barGame.gimmick),null,{polling:5});
 await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.failures),1);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),0);
 await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),2);assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),0);
 // Static points remain eligible, but no keyboard autorepeat and no duplicate browser click.
 await p.waitForFunction(()=>LunaCore.MIX.nearest(barGame.gimmick)?.distance<.08,null,{polling:5});
 await p.keyboard.down('Space');const held=await p.evaluate(()=>barGame.gimmick.attempts);await p.waitForTimeout(260);await p.keyboard.up('Space');
 assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),held);assert.equal(await p.evaluate(()=>barGame.gimmick.motionClip),1);
 await p.keyboard.press('Escape');const state=await p.evaluate(()=>JSON.stringify(barGame.gimmick));
 await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),state);await p.keyboard.press('Escape');
 await p.evaluate(()=>{let guard=0;while(!barGame.gimmick.completed&&guard++<10000){barGame.tick(.005);const s=barGame.gimmick;if(LunaCore.MIX.nearest(s)&&!s.feedbackLeft)barGame.gimmickInput('Space');}});
 assert.equal(await p.evaluate(()=>barGame.gimmick.completed),true);await p.waitForTimeout(600);
 assert.equal(await p.locator('.mix-gauge i.good').count(),19);assert.equal(await p.locator('.mix-gauge i.miss').count(),1);
 await p.screenshot({path:'/private/tmp/bar-mix-shake-complete.png'});
 for(const size of [{width:1440,height:900},{width:820,height:650}]){await p.setViewportSize(size);await p.screenshot({path:'/private/tmp/bar-mix-shake-'+size.width+'.png'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.locator('[data-act="endGimmick"]').click();assert.notEqual(await p.evaluate(()=>barGame.gimmick?.type),'shake');
 // Both variants' DOM uses the same input-driven frame, including focus-loss pause.
 await p.setViewportSize({width:1280,height:720});await p.evaluate(()=>barGame.startMinigame('shake','gpt'));await p.waitForTimeout(150);
 await p.keyboard.press('Space');await p.keyboard.press('Space');await p.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await p.waitForTimeout(150);const pause=await p.evaluate(()=>JSON.stringify(barGame.gimmick));await p.waitForTimeout(350);
 assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),pause);await p.keyboard.press('Escape');
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 console.log('MIX_UI_OK: real keyboard/click, shared visual state, non-looping hit animation, inertial ice, retained stir direction, timer ring, pause/resume, 20/10 completion, scaling, zero JS/resource errors.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
