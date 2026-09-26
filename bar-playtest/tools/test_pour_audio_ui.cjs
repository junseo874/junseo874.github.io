const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.addInitScript(()=>{
  window.pourAudio=[];const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){
   const d=this.buffer?.duration,id=Math.abs(d-1.4)<.001?1:Math.abs(d-2.68)<.001?2:0;
   if(id){const a=this.buffer.getChannelData(0);this.testPour={id,loop:this.loop,channels:this.buffer.numberOfChannels,peak:a.reduce((p,x)=>Math.max(p,Math.abs(x)),0),signature:a.slice(200,220).join(','),stopped:false};pourAudio.push(this.testPour);}
   return start.apply(this,args);
  };
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.testPour)this.testPour.stopped=true;return stop.apply(this,args);};
 });
 const count=()=>p.evaluate(()=>pourAudio.length);
 const playing=()=>p.locator('.fluid-screen').getAttribute('data-pour-audio-playing');
 const waitPlay=()=>p.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='true');
 const waitStop=()=>p.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='false');
 await p.goto(BASE+'?mode=minigames');
 for(const variant of ['original','gpt'])for(const kind of ['pour','fill_up']){
  await p.evaluate(({variant,kind})=>barGame.startMinigame(kind,variant),{variant,kind});
  await p.locator('.fluid-screen').waitFor();
  await p.locator('[data-act="pourSound"][data-id="1"]').click();
  await p.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioReady==='true');
  const before=await count();await p.waitForTimeout(100);assert.equal(await count(),before,'Selecting alone is silent');
  await p.keyboard.down('Space');await p.waitForTimeout(180);assert.equal(await count(),before,'Before actual flow is silent');
  await waitPlay();assert.equal(await count(),before+1);
  await p.waitForTimeout(1550);assert.equal(await count(),before+1,'Same source across loop boundary');
  await p.keyboard.up('Space');await waitStop();await p.waitForTimeout(100);
  assert(await p.evaluate(()=>pourAudio.at(-1).stopped));
  await p.keyboard.down('Space');await waitPlay();
  await p.locator('[data-act="pourSound"][data-id="2"]').click();await waitPlay();await p.waitForTimeout(120);
  assert.equal(await p.evaluate(()=>pourAudio.at(-1).id),2);
  assert(await p.evaluate(()=>pourAudio.slice(0,-1).every(v=>v.stopped)),'Old sound released on switch');
  await p.keyboard.up('Space');await waitStop();
  await p.keyboard.down('Space');await waitPlay();
  await p.keyboard.press('Escape');await p.waitForTimeout(80);assert.equal(await playing(),'false');
  assert(await p.evaluate(()=>pourAudio.every(v=>v.stopped)));
  const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick));await p.waitForTimeout(160);
  assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);
  await p.keyboard.up('Space');await p.locator('[data-change="gimmickAudio"]').uncheck();await p.keyboard.press('Escape');
  const muted=await count();await p.keyboard.down('Space');await p.waitForTimeout(1400);await p.keyboard.up('Space');
  assert.equal(await count(),muted,'Muted physical pouring is silent');
  await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').check();await p.keyboard.press('Escape');
  await p.evaluate(()=>barGame.retryMinigame());await p.waitForTimeout(120);assert.equal(await playing(),'false');
  // Pointer starts/unlocks audio without relying on keyboard.
  await p.locator('[data-hold="pour"]').hover();await p.mouse.down();await waitPlay();
  const long=await count();await p.waitForTimeout(2800);assert.equal(await count(),long,'Second recording loops without restarting');
  await p.mouse.up();await waitStop();
  await p.screenshot({path:'/private/tmp/pour-audio-'+variant+'-'+kind+'.png'});
  await p.locator('[data-act="endGimmick"]').click();await p.locator('.minigame-result').waitFor({timeout:15000});
  assert(await p.evaluate(()=>pourAudio.every(v=>v.stopped)));
  await p.locator('[data-act="miniRetry"]').click();await p.locator('.fluid-screen').waitFor();
  assert.equal(await p.locator('[data-act="pourSound"][data-id="2"]').getAttribute('aria-pressed'),'true');
 }
 // Focus loss must stop immediately, even if animation frames stop running.
 await p.keyboard.down('Space');await waitPlay();
 await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(60);
 assert(await p.evaluate(()=>pourAudio.every(v=>v.stopped)));await p.keyboard.up('Space');await p.keyboard.press('Escape');
 await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();
 await p.reload();await p.evaluate(()=>barGame.startMinigame('pour','original'));await p.locator('.fluid-screen').waitFor();
 assert.equal(await p.locator('[data-act="pourSound"][data-id="2"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 // Missing recordings never block physical pouring or completing the minigame.
 const failed=await browser.newPage(),failedErrors=[];failed.on('pageerror',e=>failedErrors.push(e.message));
 await failed.route('**/audio/pour_*.wav',r=>r.abort());await failed.goto(BASE+'?mode=minigames');
 await failed.evaluate(()=>barGame.startMinigame('pour','original'));await failed.locator('.fluid-screen').waitFor();
 await failed.keyboard.down('Space');await failed.waitForFunction(()=>barGame.gimmick.value>.1);await failed.keyboard.up('Space');
 await failed.locator('[data-act="endGimmick"]').click();await failed.locator('.minigame-result').waitFor({timeout:15000});
 assert.deepEqual(failedErrors,[]);await failed.close();
 console.log('POUR_AUDIO_UI_OK: both sounds, both rulesets, pour/fill-up, real emission gating, continuous loops, switching, pause/mute/focus loss, retry/exit, pointer/keyboard, persistence, missing-audio fallback; no JS or HTTP errors.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
