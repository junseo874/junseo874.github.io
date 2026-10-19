const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('access_granted_01.wav'))requests.push(r.status());});
  await p.addInitScript(()=>{
   window.popupCues=[];const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){
    const duration=this.buffer?.duration;
    if(Math.abs(duration-47787/48000)<.001)popupCues.push('complete');
    else if(Math.abs(duration-.9133125)<.001)popupCues.push('notice');
    return start.apply(this,args);
   };
  });
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await p.waitForFunction(()=>resourceReview?.ready);
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  await p.click('[data-group="common-popups"]');await p.click('[data-id="popup:goal"]');
  await f.locator('.story-notice-event').waitFor({state:'visible'});
  // User gesture in the embedded simulator unlocks browser audio.
  await f.locator('body').click({position:{x:4,y:4}});
  await f.waitForFunction(()=>LunaStoryNoticeAudio.ready);
  await f.evaluate(()=>LunaSfx.setVolume(.65));
  for(const state of ['bar-complete','bar-new','outside-complete','outside-new']){
   await f.evaluate(()=>{LunaStoryNotices.clear();popupCues=[];});
   await p.selectOption('#lab-state',state);
   await f.waitForFunction(()=>popupCues.length>0);
   await p.waitForTimeout(250);
   assert.deepEqual(await f.evaluate(()=>popupCues),[state.endsWith('complete')?'complete':'notice'],state);
  }
  await f.evaluate(()=>{LunaStoryNotices.clear();popupCues=[];LunaSfx.setVolume(0);});
  await p.selectOption('#lab-state','outside-complete');
  await f.waitForFunction(()=>document.querySelector('.story-notice-event:not([hidden])')?.dataset.kind==='goal-complete');
  await p.waitForTimeout(300);assert.deepEqual(await f.evaluate(()=>popupCues),[],'Muted goal completion');
  assert.deepEqual(requests,[200],'Goal audio loaded and cached once');assert.deepEqual(errors,[]);
  console.log('PASS: goal completion uses access_granted once in bar/outside, new goals keep message_01, mute and cache work');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
