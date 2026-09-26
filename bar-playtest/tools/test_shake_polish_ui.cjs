const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.addInitScript(()=>{
  window.shakeAudio=[];
  const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){
   const duration=this.buffer?.duration,kind=Math.abs(duration-.5)<.001?'ice':Math.abs(duration-.09)<.001?'pop':Math.abs(duration-.08)<.001?'miss':null;
   if(kind){const samples=this.buffer.getChannelData(0);const peak=samples.reduce((n,v)=>Math.max(n,Math.abs(v)),0);this.testSound={kind,peak,signature:samples.slice(2000,2020).join(','),channels:this.buffer.numberOfChannels,stopped:false};shakeAudio.push(this.testSound);}
   return start.apply(this,args);
  };
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.testSound)this.testSound.stopped=true;return stop.apply(this,args);};
 });
 await p.goto(BASE+'?mode=minigames');
 const counts=()=>p.evaluate(()=>Object.fromEntries(['pop','ice','miss'].map(k=>[k,shakeAudio.filter(s=>s.kind===k).length])));
 async function hit(pointer=false){
  await p.evaluate(()=>{const s=barGame.gimmick;s.elapsed=.1;LunaCore.MIX.updatePath(s,barGame.rng);});
  if(pointer){const box=await p.locator('[data-shake-surface]').boundingBox();await p.mouse.click(box.x+10,box.y+10);}else await p.keyboard.press('Space');
  await p.waitForTimeout(65);
 }
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('shake',v),variant);await p.locator('.shake-screen').waitFor();await p.waitForTimeout(100);
  assert.equal(await p.locator('.shake-board .mix-guide,.shake-board .mix-feedback').count(),0);
  const initial=await counts();await p.locator('[data-shake-surface]').click({position:{x:12,y:12}});
  await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);assert.deepEqual(await counts(),initial);
  const board=await p.locator('.shake-board').boundingBox();
  await hit(true);assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
  assert.deepEqual(await counts(),{pop:initial.pop,ice:initial.ice+1,miss:initial.miss});
  assert.equal(await p.locator('[data-shake-burst]').count(),1);assert.deepEqual(await p.locator('.shake-board').boundingBox(),board);
  const frames=await p.locator('[data-motion-frame]').evaluateAll(nodes=>nodes.map(n=>n.dataset.motionFrame));assert.equal(frames[0],frames[1]);
  await p.screenshot({path:'/private/tmp/shake-polish-'+variant+'-hit.png'});
  await p.keyboard.press('Escape');await p.waitForTimeout(80);
  const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick)),visual=await p.locator('[data-shake-fx]').innerHTML();
  await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);assert.equal(await p.locator('[data-shake-fx]').innerHTML(),visual);
  assert(await p.evaluate(()=>shakeAudio.filter(s=>s.kind==='ice').at(-1).stopped),'Pause stops the one-shot tail');
  await p.keyboard.press('Escape');await p.waitForTimeout(650);
  assert.deepEqual(await counts(),{pop:initial.pop,ice:initial.ice+1,miss:initial.miss});
  assert.equal(await p.locator('[data-shake-burst]').count(),0);
  await p.waitForFunction(()=>!LunaCore.MIX.nearest(barGame.gimmick),null,{polling:5});
  const frameBefore=await p.evaluate(()=>barGame.gimmick.motionFrame);
  await p.keyboard.press('Space');await p.waitForTimeout(65);assert.equal(await p.evaluate(()=>barGame.gimmick.failures),1);
  assert.equal(await p.evaluate(()=>barGame.gimmick.motionFrame),frameBefore);
  assert.deepEqual(await counts(),{pop:initial.pop,ice:initial.ice+1,miss:initial.miss+1});
  await p.screenshot({path:'/private/tmp/shake-polish-'+variant+'-miss.png'});
  await hit();assert.equal(await p.evaluate(()=>barGame.gimmick.motionClip),1);
  assert.deepEqual(await counts(),{pop:initial.pop,ice:initial.ice+2,miss:initial.miss+1});
  await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').uncheck();await p.keyboard.press('Escape');
  const muted=await counts();await hit();assert.deepEqual(await counts(),muted);assert.equal(await p.evaluate(()=>barGame.gimmick.success),3);
  await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').check();await p.keyboard.press('Escape');
  // Move to the final attempt through real core inputs; then test that the last gesture stays visible.
  await p.evaluate(()=>{const g=barGame;while(g.gimmick.attempts<g.gimmick.targetStacks-1){g.gimmick.elapsed=.1;LunaCore.MIX.updatePath(g.gimmick,g.rng);g.gimmickInput('Space');}});
  await hit();assert.equal(await p.evaluate(()=>barGame.gimmick.completed),true);
  assert.equal(await p.locator('.remix-step-feedback').count(),0);
  const expected=await p.evaluate(()=>100*(barGame.gimmick.targetStacks-1)/barGame.gimmick.targetStacks);
  const time=await p.evaluate(()=>barGame.craft.elapsed);await p.waitForTimeout(230);assert.equal(await p.evaluate(()=>barGame.craft.elapsed),time);
  if(variant==='original')await p.locator('[data-act="endGimmick"]').click();
  await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),expected);
  await p.locator('[data-act="miniRetry"]').click();assert.equal(await p.evaluate(()=>barGame.gimmick.shakeEffects.length),0);assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),0);
 }

 // Both user WAVs must be decoded, selectable, distinct, and persisted without consuming game input.
 await p.locator('[data-act="shakeSound"][data-id="1"]').click();
 await p.waitForFunction(()=>document.querySelector('.shake-screen')?.dataset.shakeAudioReady==='true');
 await p.keyboard.press('Space');await hit();
 const firstSound=await p.evaluate(()=>shakeAudio.filter(s=>s.kind==='ice').at(-1));
 const attempts=await p.evaluate(()=>barGame.gimmick.attempts),beforeSwap=await counts();
 await p.locator('[data-act="shakeSound"][data-id="2"]').click();await p.waitForTimeout(60);
 assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),attempts);
 assert.deepEqual(await counts(),beforeSwap);
 assert.equal(await p.locator('[data-act="shakeSound"][data-id="2"]').getAttribute('aria-pressed'),'true');
 assert.equal(await p.evaluate(()=>localStorage.getItem('luna.shake.sound.v1')),'2');
 await hit();
 const secondSound=await p.evaluate(()=>shakeAudio.filter(s=>s.kind==='ice').at(-1));
 assert.notEqual(firstSound.signature,secondSound.signature);
 assert.equal(firstSound.channels,2);assert.equal(secondSound.channels,2);
 assert.equal((await counts()).pop,0,'Old synthetic success tone is removed');
 await p.screenshot({path:'/private/tmp/shaker-recordings-ui.png'});
 await p.emulateMedia({reducedMotion:'reduce'});await p.keyboard.press('Space');await hit();
 assert.equal(await p.locator('[data-shake-trail] circle').count(),0);assert.equal(await p.locator('.motion-crop').first().evaluate(e=>getComputedStyle(e).transform),'none');
 const waveforms=await p.evaluate(()=>shakeAudio);assert(waveforms.every(x=>x.peak>.01&&x.peak<=.71));
 await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();await p.locator('.minigame-lobby').waitFor();
 const exited=await counts();await p.waitForTimeout(400);assert.deepEqual(await counts(),exited);

 await p.reload();await p.evaluate(()=>barGame.startMinigame('shake','original'));
 await p.locator('.shake-screen').waitFor();
 assert.equal(await p.locator('[data-act="shakeSound"][data-id="2"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('SHAKE_POLISH_UI_OK: both rulesets, two real stereo WAV options, no synthetic pop, one recording per gesture, distinct audio and persisted selection, miss isolation, pause/mute/retry, final motion, stationary judgement board, reduced motion, exit.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
