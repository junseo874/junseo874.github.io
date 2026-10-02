const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
for(const mode of ['fall','cross']){
 await p.evaluate(()=>barGame.startMinigame('shake','original'));await p.locator('.rhythm-board').waitFor();await p.locator('[data-act="shakeMode"][data-id="'+mode+'"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),mode);
 let t=await p.evaluate(()=>barGame.gimmick.rhythm.clock);await p.waitForTimeout(200);assert(await p.evaluate(()=>barGame.gimmick.rhythm.clock)>t);
 await p.keyboard.press('Space');await p.waitForTimeout(500);await p.screenshot({path:'/private/tmp/rhythm-'+mode+'.png'});
 assert(await p.locator('[data-act="shakeMode"]').first().isDisabled());
 // Freeze game ticks during exact keyboard tests; input remains unpaused.
 await p.evaluate(()=>{window.normalTick=barGame.tick;barGame.tick=()=>{};barGame.gimmick.rhythm.trackTime=1.8;});
 await p.keyboard.press('d');assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.playing),false);const f=await p.locator('[data-motion-frame]').first().getAttribute('data-motion-frame');await p.waitForTimeout(200);assert.equal(await p.locator('[data-motion-frame]').first().getAttribute('data-motion-frame'),f);
 await p.evaluate(()=>barGame.gimmick.rhythm.trackTime=2.4);await p.locator('[data-act="rhythmHit"][data-id="KeyD"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.playing),true);assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.combo),1);
 await p.keyboard.down('d');await p.keyboard.down('d');await p.keyboard.up('d');const extras=await p.evaluate(()=>barGame.gimmick.rhythm.extraPresses);assert.equal(extras,1);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>barGame.overlay),'settings');const elapsed=await p.evaluate(()=>barGame.gimmick.elapsed);await p.keyboard.press('a');assert.equal(await p.evaluate(()=>barGame.gimmick.elapsed),elapsed);await p.keyboard.press('Escape');
 await p.evaluate(()=>{barGame.tick=window.normalTick;const s=barGame.gimmick;for(const n of s.rhythm.notes.filter(n=>!n.status)){s.rhythm.trackTime=n.time;barGame.gimmickInput(n.lane?'KeyD':'KeyA');}});await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.targetStacks),20);
 await p.locator('[data-act="miniRetry"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),mode);
}
await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');await p.locator('.updates-confirm').click();await p.locator('[data-act="miniStart"][data-id="shake"]').click();await p.locator('.rhythm-board').waitFor();assert.equal(await p.evaluate(()=>barGame.variant),'gpt');assert.equal(await p.locator('.rx-craft-cue').count(),0);await p.screenshot({path:'/private/tmp/rhythm-gpt.png'});await p.setViewportSize({width:960,height:540});await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/rhythm-small.png'});const board=await p.locator('.rhythm-board').boundingBox();assert(board.x>=0&&board.x+board.width<=960&&board.y+board.height<=540);assert.deepEqual(errors,[]);
console.log('RHYTHM_UI_OK: selectors, 60fps notes, keyboard and pointer, held-key guard, miss/resume, ESC, completion/retry, small viewport');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
