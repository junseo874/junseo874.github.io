const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.addInitScript(()=>localStorage.setItem('luna.shake.mode.v1','drum'));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');await p.locator('.updates-confirm').click();await p.locator('[data-act="miniStart"][data-id="shake"]').click();
 assert.equal(await p.locator('[data-act="shakeMode"]').count(),3);assert.equal(await p.locator('[data-id="drum"]').count(),0);assert.equal(await p.locator('.rhythm-board').getAttribute('data-rhythm-mode'),'path');
 await p.locator('[data-act="shakeMode"][data-id="fall"]').click();await p.locator('[data-act="shakeMode"][data-id="path"]').click();
 await p.keyboard.press('Space');await p.waitForTimeout(550);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);assert(await p.locator('[data-path-node]').count()>4);
 await p.evaluate(()=>{window.normalTick=barGame.tick;barGame.tick=()=>{};});
 async function position(hit){await p.evaluate(hit=>{const g=barGame;for(let i=0;i<6000;i++){g.tickGimmick(.005);const n=LunaCore.MIX.nearest(g.gimmick);if(hit?!!n&&!n.fixed:!n)return;}throw Error('target unavailable');},hit);}
 await position(true);await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
 await position(false);await p.locator('[data-shake-surface]').click({position:{x:12,y:12}});assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.playing),false);
 await position(true);await p.locator('[data-act="rhythmHit"][data-id="Space"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),3);assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.playing),true);
 await p.keyboard.down('Space');const attempts=await p.evaluate(()=>barGame.gimmick.attempts);await p.keyboard.down('Space');await p.keyboard.up('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),attempts);
 await p.keyboard.press('Escape');const paused=await p.evaluate(()=>barGame.gimmick.attempts);await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),paused);await p.keyboard.press('Escape');
 await p.screenshot({path:'/private/tmp/shake-path-restored.png'});
 await p.setViewportSize({width:960,height:540});await p.waitForTimeout(100);const box=await p.locator('.rhythm-board').boundingBox();assert(box.y>=0&&box.y+box.height<=540&&box.x+box.width<=960);await p.screenshot({path:'/private/tmp/shake-path-small.png'});
 await p.evaluate(()=>{const s=barGame.gimmick;while(!s.completed){s.pathPoint=[...LunaCore.MIX.points[0]];barGame.gimmickInput('Space');}barGame.tick=window.normalTick;});await p.locator('.minigame-result').waitFor();await p.locator('[data-act="miniRetry"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),'path');
 assert.deepEqual(errors,[]);console.log('PATH_UI_OK: legacy selection migration, 3 tabs, keyboard/pointer, no duplicate click, held keys, pause, mobile fit, completion/retry, no browser errors');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
