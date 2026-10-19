const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('message_01.wav'))requests.push(r.status());});
  await p.addInitScript(()=>{
   window.noticeStarts=[];const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&Math.abs(this.buffer.duration-0.9133125)<.002)noticeStarts.push({time:performance.now(),channels:this.buffer.numberOfChannels});return start.apply(this,args);};
  });
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.waitForFunction(()=>LunaStoryNoticeAudio.ready);
  await p.evaluate(()=>{LunaSfx.setVolume(.8);LunaDialogueAudio.setVersion('off');barGame.reset(0,'full',1);});
  await p.waitForFunction(()=>noticeStarts.length===1);
  await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>noticeStarts.length),1,'A visible notice does not replay every frame');
  for(const delta of [1,-1]){
   const before=await p.evaluate(()=>noticeStarts.length);
   await p.evaluate(delta=>{LunaStoryNotices.clear();LunaCore.applyEffects('affinity.chris+='+delta,barGame.progress);},delta);
   await p.waitForFunction(n=>noticeStarts.length===n+1,before);await p.waitForTimeout(150);
  }
  // Blocked queue remains silent; its cue belongs to actual presentation.
  const before=await p.evaluate(()=>noticeStarts.length);
  await p.evaluate(()=>{LunaStoryNotices.clear();barGame.overlay='settings';LunaCore.applyEffects('affinity.chris+=1',barGame.progress);});
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>noticeStarts.length),before);
  await p.evaluate(()=>barGame.overlay=null);await p.waitForFunction(n=>noticeStarts.length===n+1,before);
  await p.waitForTimeout(150);await p.evaluate(()=>barGame.overlay='settings');await p.waitForTimeout(150);await p.evaluate(()=>barGame.overlay=null);
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>noticeStarts.length),before+1,'Pause/resume does not replay the existing popup');
  const muted=await p.evaluate(()=>noticeStarts.length);
  await p.evaluate(()=>{LunaStoryNotices.clear();LunaSfx.setVolume(0);LunaCore.applyEffects('affinity.chris+=1',barGame.progress);});
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>noticeStarts.length),muted,'Effect-volume zero is silent');
  await p.evaluate(()=>{LunaStoryNotices.clear();LunaSfx.setVolume(.42);return outsidePlaytest.start();});await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const external=await p.evaluate(()=>noticeStarts.length);
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.start({day:1,flow:'in',place:'homeDoor'});m.x=LunaResidence.layout.homeX+.15;outsidePlaytest.snapCamera();});
  await p.waitForFunction(()=>outsidePlaytest.model.encounter?.kind==='thug');await p.waitForFunction(n=>noticeStarts.length>n,external);
  assert.equal(await p.locator('.story-notice-event strong').textContent(),'새로운 이벤트 발생!');
  await p.waitForTimeout(180);
  const acquired=await p.evaluate(()=>noticeStarts.length);
  await p.evaluate(()=>{const o=outsidePlaytest;o.notifyItem(o.model,'wild_dog');o.notifyItem(o.model,'bitters');});
  await p.waitForFunction(n=>noticeStarts.length===n+1,acquired);
  await p.waitForTimeout(220);assert.equal(await p.evaluate(()=>noticeStarts.length),acquired+1,'Queued material stays silent until shown');
  await p.waitForFunction(n=>noticeStarts.length===n+2,acquired);
  assert.equal(await p.locator('.outside-item-notice').getAttribute('data-item'),'bitters');
  // Simultaneous lanes use one sound; inspect the shared gain actually used.
  await p.evaluate(()=>{outsidePlaytest.exit(true);barGame.reset(0,'full',1);LunaStoryNotices.clear();window.noticeBus=null;const output=LunaSfx.output;LunaSfx.output=c=>{const b=output(c);window.noticeBus=b;return b;};});
  await p.waitForTimeout(180);const simultaneous=await p.evaluate(()=>noticeStarts.length);
  await p.evaluate(()=>{LunaStoryNotices.affinity(barGame.progress,'chris',1);LunaStoryNotices.forced({encounter:{}});});
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>noticeStarts.length),simultaneous+1,JSON.stringify(await p.evaluate(()=>({phase:barGame.phase,paused:barGame.isPaused(),overlay:barGame.overlay,ready:LunaStoryNoticeAudio.ready,hidden:document.querySelector('#story-notices').hidden,pending:LunaStoryNotices.pending.map(e=>e.kind)}))));
  assert(Math.abs(await p.evaluate(()=>noticeBus.gain.value)-.42)<.0001);
  await p.evaluate(()=>LunaSfx.setVolume(0));await p.waitForTimeout(60);assert.equal(await p.evaluate(()=>noticeBus.gain.value),0,'Playing sound follows the master volume');
  assert.deepEqual(requests,[200]);assert.deepEqual(errors,[]);
  console.log('PASS message_01 decoded/cached once, first meeting, affinity up/down, real outdoor event, one-shot presentation, blocked queue, pause/resume, simultaneous coalescing and shared live volume');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
