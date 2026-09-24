const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(BASE.split('?')[0])&&r.status()>=400)missing.push(r.url());});
 await p.goto(BASE+'?mode=minigames');await p.locator('.minigame-lobby').waitFor();assert.equal(await p.locator('.minigame-card').count(),5);assert.equal(await p.locator('.version-tabs .selected').count(),1);await p.screenshot({path:'/tmp/luna-minigames-lobby.png'});
 const records=await p.evaluate(()=>localStorage.getItem('luna.bar.gpt.v1'));
 for(const variant of ['gpt','original']){
  await p.locator(`[data-act="miniRules"][data-id="${variant}"]`).click();
  for(const kind of ['open','pour','fill_up','shake','stir']){
   await p.locator(`[data-act="miniStart"][data-id="${kind}"]`).click();assert.equal(await p.evaluate(()=>barGame.gimmick.type),kind);assert.equal(await p.locator('.currency-hud').count(),0);assert.equal(await p.evaluate(()=>barGame.craft.queue.length),1);await p.keyboard.press('F2');assert.equal(await p.locator('.inspector').count(),0);
   if(variant==='gpt')await p.screenshot({path:`/tmp/luna-minigame-${kind}.png`});
   if(['pour','fill_up'].includes(kind)){
    await p.keyboard.down('Space');await p.waitForFunction(()=>barGame.gimmick.angle>95);await p.keyboard.up('Space');await p.keyboard.press('Escape');const elapsed=await p.evaluate(()=>barGame.craft.elapsed);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),elapsed);await p.keyboard.press('Escape');
    await p.evaluate(()=>{barGame.gimmick.value=barGame.gimmick.target;barGame.gimmick.angle=0;});await p.locator('[data-act="endGimmick"]').click();
   }else{
    await p.keyboard.press(kind==='stir'?'KeyW':'Space');
    if(kind==='open'){await p.evaluate(()=>barGame.gimmick.beatTime=1.6);await p.keyboard.press('Space');}
    else if(kind==='shake'){const count=await p.evaluate(()=>barGame.gimmick.targetStacks);for(let i=0;i<count;i++){await p.evaluate(()=>barGame.gimmick.beatTime=.75);await p.keyboard.press('Space');await p.evaluate(()=>barGame.tick(.2));await p.evaluate(()=>barGame.tick(.1));}}
    else {const count=await p.evaluate(()=>barGame.gimmick.targetStacks);for(let i=0;i<count;i++)for(const key of ['KeyD','KeyS','KeyA','KeyW']){await p.evaluate(()=>barGame.tick(.12));await p.keyboard.press(key);}}
    if(variant==='original')await p.locator('[data-act="endGimmick"]').click();
   }
   await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);assert.equal(await p.locator('[data-act="offer"]').count(),0);if(kind==='stir'&&variant==='gpt')await p.screenshot({path:'/tmp/luna-minigame-result.png'});
   const id=await p.evaluate(()=>barGame.craft.id);await p.locator('[data-act="miniRetry"]').click();assert.notEqual(await p.evaluate(()=>barGame.craft.id),id);assert.equal(await p.evaluate(()=>barGame.gimmick.started),false);await p.locator('[data-act="miniExit"]').click();await p.locator('.minigame-lobby').waitFor();
  }
 }
 assert.equal(await p.evaluate(()=>localStorage.getItem('luna.bar.gpt.v1')),records);
 // Mid-play exit confirms, restores pause state, and later starts never receive stale completion.
 await p.locator('[data-act="miniStart"][data-id="open"]').click();await p.keyboard.press('Space');await p.locator('[data-act="miniExit"]').click();assert.equal(await p.evaluate(()=>barGame.overlay),'miniExit');await p.locator('[data-act="closeOverlay"]').first().click();assert.equal(await p.evaluate(()=>barGame.overlay),null);await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();
 await p.keyboard.press('Escape');await p.locator('[data-change="language"]').selectOption('en');await p.keyboard.press('Escape');await p.screenshot({path:'/tmp/luna-minigames-en.png'});
 for(const [width,height] of [[1280,720],[960,540],[1440,1000]]){await p.setViewportSize({width,height});await p.waitForTimeout(100);const box=await p.locator('.app-shell').boundingBox();assert(Math.abs(box.width/box.height-16/9)<.001);for(const r of await p.locator('.minigame-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}))){assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1);}}
 await p.locator('[data-act="version"][data-id="original"]').click();assert.equal(await p.locator('.minigame-lobby').count(),0);assert.equal(await p.evaluate(()=>barGame.minigame),null);await p.locator('[data-act="version"][data-id="gpt"]').click();await p.locator('.remix-start').waitFor();await p.locator('[data-act="version"][data-id="minigames"]').click();await p.locator('.minigame-lobby').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('MINIGAMES_UI_OK: 5 skills × 2 rulesets, input, pause, results, retry, exit, record isolation, lobby tabs, EN, 3 viewports.');
 }finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
