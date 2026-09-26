const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.addInitScript(()=>{const original=AudioBufferSourceNode.prototype.start;window.noiseStarts=0;AudioBufferSourceNode.prototype.start=function(...args){window.noiseStarts++;return original.apply(this,args);};});
 await p.goto(BASE+'?mode=minigames');
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('open',v),variant);await p.locator('[data-opening-stage]').waitFor();
  await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/open-'+variant+'-ready.png'});
  assert.equal(await p.locator('.opening-caption,.opening-misses').count(),0);
  assert.equal(await p.locator('[data-open-timing]').isVisible(),false);
  assert.equal(await p.locator('.craft-top,.gimmick-footer,.pour-footer').count(),0);
  assert.equal(await p.locator('[data-act="endGimmick"]').isDisabled(),true);
  await p.keyboard.press('Space');await p.waitForTimeout(80);await p.keyboard.press('Space');await p.waitForTimeout(80);
  assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-state'),'miss');
  assert.equal(await p.evaluate(()=>barGame.gimmick.failures),1);
  await p.screenshot({path:'/private/tmp/open-'+variant+'-miss.png'});
  await p.keyboard.press('Escape');await p.waitForTimeout(100);
  const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick));await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);
  assert.equal(await p.locator('[data-open-timing]').isVisible(),false);
  await p.keyboard.press('Escape');
  for(const [beat,visible] of [[.3,false],[1.40,false],[1.52,true],[1.63,true],[1.78,false]]){
   await p.evaluate(beat=>{barGame.gimmick.beatTime=beat;},beat);await p.waitForTimeout(30);
   assert.equal(await p.locator('[data-open-timing]').isVisible(),visible,'Space hint follows the real hit window');
  }
  await p.evaluate(()=>{barGame.gimmick.beatTime=1.56;});await p.waitForTimeout(25);
  await p.screenshot({path:'/private/tmp/open-space-window-'+variant+'.png'});
  // Fix the judgement clock, then exercise the real UI input. No score overrides.
  await p.evaluate(()=>{barGame.gimmick.beatTime=1.54;});await p.keyboard.press('Space');
  await p.waitForTimeout(130);assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-state'),'success');
  assert.equal(await p.locator('[data-open-timing]').isVisible(),false,'Hide after success');
  await p.screenshot({path:'/private/tmp/open-'+variant+'-pop.png'});
  const elapsed=await p.evaluate(()=>barGame.craft.elapsed);
  await p.keyboard.press('Escape');await p.waitForTimeout(120);
  const cap=await p.evaluate(()=>barGame.gimmick.openFx.age),plays=await p.evaluate(()=>noiseStarts);
  await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>barGame.gimmick.openFx.age),cap);assert.equal(await p.evaluate(()=>noiseStarts),plays);
  await p.keyboard.press('Escape');
  if(variant==='original'){await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),elapsed);await p.locator('[data-act="endGimmick"]').click();}
  await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),85);
  assert.equal(await p.evaluate(()=>noiseStarts),plays,'Sound must not repeat');
  await p.locator('[data-act="miniRetry"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.openFx),undefined);
 }
 // Mute suppresses synthesis without suppressing feedback.
 await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').uncheck();await p.keyboard.press('Escape');
 const muted=await p.evaluate(()=>noiseStarts);await p.keyboard.press('Space');await p.keyboard.press('Space');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>noiseStarts),muted);
 for(const type of ['open','stir','shake','pour','fill_up']){
  await p.evaluate(type=>barGame.startMinigame(type,'original'),type);await p.waitForTimeout(200);
  assert.equal(await p.locator('.craft-top,.gimmick-footer,.pour-footer,.currency-hud').count(),0);
  const exit=await p.locator('.gimmick-exit').boundingBox(),finish=await p.locator('.gimmick-finish').boundingBox();
  assert(exit.x>1050&&exit.y<55&&exit.height<45);assert(finish.x>900&&finish.y>620);
  await p.screenshot({path:'/private/tmp/minimal-'+type+'.png'});
 }
 for(const [width,height] of [[960,540],[1440,900]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>barGame.startMinigame('open','original'));await p.waitForTimeout(100);
  const box=await p.locator('.app-shell').boundingBox();assert(Math.abs(box.width/box.height-16/9)<.001);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.keyboard.press('Space');await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();await p.locator('.minigame-lobby').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert(muted>=4,'Two attempts each produce miss and pop sounds');
 console.log('OPEN_UI_OK: original/GPT exact-window Space hint, removed caption/miss count, success, slip, preserved score, pause, sound once/mute, retry, all five minimal layouts, responsive & exit.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
