const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('street-loop'))errors.push('HTTP '+r.status());});
 await p.addInitScript(()=>{window.ambientSources=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>50&&this.buffer?.duration<61)ambientSources.push(this);return start.apply(this,args);};});
 try{
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();const updates=p.locator('.updates-confirm');if(await updates.isVisible())await updates.click();
  assert.equal(await p.evaluate(()=>LunaStreetAudio.volume),.55);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false);
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.waitForFunction(()=>LunaStreetAudio.state.ready&&LunaStreetAudio.state.playing);
  await p.waitForTimeout(2300);assert(await p.evaluate(()=>LunaStreetAudio.state.level>.2));
  assert(await p.evaluate(()=>ambientSources.at(-1).loop));assert.equal(await p.evaluate(()=>ambientSources.length),1);
  // Run across the loop boundary at accelerated playback; no duplicate source/restart.
  await p.evaluate(()=>ambientSources[0].playbackRate.value=60);await p.waitForTimeout(1300);await p.evaluate(()=>ambientSources[0].playbackRate.value=1);
  assert.equal(await p.evaluate(()=>ambientSources.length),1);assert(await p.evaluate(()=>LunaStreetAudio.state.playing));
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.story.beginRows('ambient-duck',{x:m.x,y:m.y},[{type:'say',actor:'luna',text:'거리에 있는 동안 환경음을 확인합니다. '.repeat(20)}]);});
  await p.waitForTimeout(100);assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.target)-.55*.65)<.001);
  await p.evaluate(()=>outsidePlaytest.model.story.cancel());
  await p.keyboard.press('Escape');await p.locator('.outside-dialog [data-street-volume]').waitFor({state:'visible'});
  await p.locator('.outside-dialog [data-street-volume]').fill('30');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>LunaStreetAudio.volume),.3);
  await p.screenshot({path:'/private/tmp/street-ambience-settings.png'});
  await p.locator('[data-street-volume]').fill('0');assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false);
  await p.locator('[data-street-volume]').fill('55');await p.keyboard.press('Escape');await p.waitForFunction(()=>LunaStreetAudio.state.playing);
  await p.evaluate(()=>outsidePlaytest.model.start({place:'home',day:1,flow:'in'}));await p.waitForTimeout(2400);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false,'No street sound inside home');
  await p.evaluate(()=>outsidePlaytest.model.start({place:'bar',day:2,flow:'out'}));await p.waitForFunction(()=>LunaStreetAudio.state.playing);await p.waitForTimeout(1500);
  const before=await p.evaluate(()=>ambientSources.length);await p.evaluate(()=>outsidePlaytest.model.start({place:'bar',day:3,flow:'in'}));await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>ambientSources.length),before,'Day changes do not duplicate loop');
  await p.evaluate(()=>{lunaCampaign.resumeView='developer';lunaCampaign.screen('options');});await p.locator('.campaign-card [data-street-volume]').waitFor({state:'visible'});assert.equal(await p.locator('.campaign-card [data-street-volume]').inputValue(),'55');
  await p.evaluate(()=>lunaCampaign.screen('loading'));await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false,'Blocked campaign transitions silence street assets/audio/effects');
  await p.evaluate(()=>lunaCampaign.screen('developer'));await p.waitForFunction(()=>LunaStreetAudio.state.playing);
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false,'Blur immediately silences ambience');
  await p.mouse.click(10,10);await p.evaluate(()=>outsidePlaytest.model.paused=false);await p.waitForFunction(()=>LunaStreetAudio.state.playing);
  await p.evaluate(()=>outsidePlaytest.exit(true));await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false,'No street sound inside bar/lobby');
  await p.evaluate(()=>LunaStreetAudio.setVolume(.3));await p.reload();await p.waitForFunction(()=>!!window.LunaStreetAudio);assert.equal(await p.evaluate(()=>LunaStreetAudio.volume),.3);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),false);
  assert.deepEqual(errors,[]);console.log('PASS: lazy loading, decoded seamless stereo loop, fades, dialogue ducking, one loop across days, home/blocked-transition/exit silence, blur, independent settings and persistence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
