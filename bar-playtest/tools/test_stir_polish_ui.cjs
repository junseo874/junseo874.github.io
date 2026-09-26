const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.addInitScript(()=>{
  window.stirAudio=[];const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start=function(...args){
   const d=this.buffer?.duration,id=Math.abs(d-2.37)<.002?1:Math.abs(d-3.22)<.002?2:0;
   if(id){const a=this.buffer.getChannelData(0);this.testStir={id,loop:this.loop,channels:this.buffer.numberOfChannels,peak:a.reduce((p,x)=>Math.max(p,Math.abs(x)),0),signature:a.slice(200,220).join(','),stopped:false};stirAudio.push(this.testStir);}
   return start.apply(this,args);
  };
  AudioBufferSourceNode.prototype.stop=function(...args){if(this.testStir)this.testStir.stopped=true;return stop.apply(this,args);};
 });
 await p.goto(BASE+'?mode=minigames');
 const count=()=>p.evaluate(()=>stirAudio.length);
 async function key(k){await p.keyboard.press('Key'+k);await p.waitForTimeout(70);}
 for(const variant of ['original','gpt']){
  await p.evaluate(v=>barGame.startMinigame('stir',v),variant);await p.locator('.stir-screen').waitFor();
  await p.locator('[data-act="stirSound"][data-id="1"]').click();
  await p.waitForFunction(()=>document.querySelector('.stir-screen')?.dataset.stirAudioReady==='true');
  assert.equal(await p.locator('.stir-board .mix-guide,.stir-board .mix-feedback').count(),0);
  const before=await count();await key('W');assert.equal(await count(),before,'Start does not move the hand or play stirring');
  const board=await p.locator('.stir-dial').boundingBox();
  for(const k of ['D','S','A','W'])await key(k);
  assert.equal(await count(),before+1,'Continuous valid inputs preserve one audio source');
  assert.equal(await p.evaluate(()=>barGame.gimmick.success),1);
  assert.equal(await p.locator('[data-stir-round="good"]').count(),1);
  assert.deepEqual(await p.locator('.stir-dial').boundingBox(),board);
  await p.screenshot({path:'/private/tmp/stir-polish-'+variant+'.png'});
  await p.waitForTimeout(650);
  assert.equal(await p.locator('.stir-screen').getAttribute('data-stir-audio-playing'),'false');
  assert(await p.evaluate(()=>stirAudio.at(-1).stopped));
  await key('W');assert.equal(await count(),before+1,'Wrong input does not restart audio');
  assert.equal(await p.locator('[data-stir-round="miss"]').count(),1);
  await key('D');assert.equal(await count(),before+2);
  const attempts=await p.evaluate(()=>barGame.gimmick.attempts);
  await p.locator('[data-act="stirSound"][data-id="2"]').click();await p.waitForTimeout(30);
  assert.equal(await p.evaluate(()=>barGame.gimmick.attempts),attempts);
  assert.equal(await count(),before+2,'Selecting does not synthesize a game input');
  await key('S');assert.equal(await count(),before+3);assert.equal(await p.evaluate(()=>stirAudio.at(-1).id),2);
  await p.keyboard.press('Escape');await p.waitForTimeout(60);
  const frozen=await p.evaluate(()=>({s:JSON.stringify(barGame.gimmick),fx:document.querySelector('[data-stir-polish]').innerHTML}));
  await p.waitForTimeout(180);
  assert.deepEqual(await p.evaluate(()=>({s:JSON.stringify(barGame.gimmick),fx:document.querySelector('[data-stir-polish]').innerHTML})),frozen);
  assert(await p.evaluate(()=>stirAudio.every(x=>x.stopped)));
  await p.keyboard.press('Escape');await p.waitForTimeout(70);assert.equal(await count(),before+3,'Resume alone does not replay an input');
  await key('A');assert.equal(await count(),before+4);
  await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').uncheck();await p.keyboard.press('Escape');
  await key('W');assert.equal(await count(),before+4,'Mute preserves gameplay but suppresses audio');
  await p.keyboard.press('Escape');await p.locator('[data-change="gimmickAudio"]').check();await p.keyboard.press('Escape');
  await p.evaluate(()=>barGame.retryMinigame());await p.waitForTimeout(100);
  await key('W');const continuous=await count();
  // Longer than the source recording: crossing its loop seam must not create new source nodes.
  for(let i=0;i<24;i++){await key(['D','S','A','W'][i%4]);await p.waitForTimeout(85);}
  assert.equal(await count(),continuous+1,'One continuous source through the loop seam');
  assert.equal(await p.evaluate(()=>barGame.gimmick.success),6);
  await p.evaluate(()=>{const g=barGame;while(!g.gimmick.completed)g.gimmickInput(['KeyW','KeyD','KeyS','KeyA'][(g.gimmick.stirPos+1)%4]);});
  await p.waitForTimeout(100);assert.equal(await p.locator('.remix-step-feedback').count(),0);
  if(variant==='original')await p.locator('[data-act="endGimmick"]').click();
  await p.locator('.minigame-result').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);
  await p.locator('[data-act="miniRetry"]').click();await p.waitForTimeout(70);
  assert.equal(await p.evaluate(()=>barGame.gimmick.stirMotionPending),0);
 }
 await p.emulateMedia({reducedMotion:'reduce'});await key('W');for(const k of ['D','S','A','W'])await key(k);
 assert.equal(await p.locator('[data-stir-polish] g').count(),0,'Reduced motion removes rotating trails');
 const audio=await p.evaluate(()=>stirAudio);assert(audio.every(x=>x.loop&&x.channels===2&&x.peak>.01&&x.peak<.71));
 assert.notEqual(audio.find(x=>x.id===1).signature,audio.find(x=>x.id===2).signature);
 await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();await p.waitForTimeout(100);
 assert(await p.evaluate(()=>stirAudio.every(x=>x.stopped)));
 await p.reload();await p.evaluate(()=>barGame.startMinigame('stir','original'));await p.locator('.stir-screen').waitFor();
 assert.equal(await p.locator('[data-act="stirSound"][data-id="2"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 const failed=await browser.newPage();const failedErrors=[];failed.on('pageerror',e=>failedErrors.push(e.message));
 await failed.route('**/audio/stir_*.wav',r=>r.abort());await failed.goto(BASE+'?mode=minigames');
 await failed.evaluate(()=>barGame.startMinigame('stir','original'));await failed.locator('.stir-screen').waitFor();
 for(const k of ['W','D','S','A','W']){await failed.keyboard.press('Key'+k);await failed.waitForTimeout(50);}
 assert.equal(await failed.evaluate(()=>barGame.gimmick.success),1);assert.deepEqual(failedErrors,[]);
 await failed.close();
 console.log('STIR_POLISH_UI_OK: both recordings and rulesets; sustained loop, correct-input-only, fade/idle, switching, pause/mute, retry/exit, persisted selection, stable board, unchanged scoring, reduced motion and missing-audio fallback.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
