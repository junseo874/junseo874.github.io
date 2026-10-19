const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&r.url().includes('rain-loop'))errors.push('HTTP '+r.status());});
 await p.addInitScript(()=>{window.rainSources=[];window.citySources=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>17&&this.buffer?.duration<18)rainSources.push(this);if(this.buffer?.duration>59&&this.buffer?.duration<61)citySources.push(this);return start.apply(this,args);};});
 try{
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  const updates=p.locator('.updates-confirm');if(await updates.isVisible())await updates.click();
  assert.equal(await p.evaluate(()=>LunaStreetAudio.state.rain.ready),false,'Rain loads lazily');
  await p.evaluate(()=>{Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});return outsidePlaytest.start();});
  await p.waitForFunction(()=>!outsidePlaytest.loading&&LunaStreetAudio.state.playing&&LunaStreetAudio.state.rain.playing);
  assert(await p.evaluate(()=>rainSources[0].loop&&citySources[0].loop));
  await p.waitForTimeout(2400);assert(await p.evaluate(()=>LunaStreetAudio.state.rain.level>.25));
  assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.rain.target/LunaStreetAudio.state.target)-.85)<.001);
  await p.evaluate(()=>rainSources[0].playbackRate.value=40);await p.waitForTimeout(1000);await p.evaluate(()=>rainSources[0].playbackRate.value=1);
  assert.equal(await p.evaluate(()=>rainSources.length),1,'No restart across multiple loop boundaries');
  const set=(day,flow,place='bar')=>p.evaluate(({day,flow,place})=>{outsidePlaytest.model.start({day,flow,place});outsidePlaytest.snapCamera();},{day,flow,place});
  for(const [day,flow,raining] of [[1,'out',true],[2,'in',true],[2,'out',false],[1,'in',false],[3,'out',false],[0,'in',false]]){
   await set(day,flow);await p.waitForTimeout(120);
   assert.equal(await p.evaluate(()=>LunaStreetAudio.state.rain.target>0),raining,day+'/'+flow);
   assert(await p.evaluate(()=>LunaStreetAudio.state.playing),'City continues underneath');
  }
  await p.waitForTimeout(2700);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.rain.playing),false);
  assert.equal(await p.evaluate(()=>citySources.length),1,'Changing weather does not restart city');
  await set(0,'out');await p.waitForFunction(()=>LunaStreetAudio.state.rain.playing);
  await p.evaluate(()=>outsidePlaytest.model.story.beginRows('rain-duck',{x:1,y:-.7},[{type:'say',actor:'luna',text:'비가 내리는 거리입니다. '.repeat(10)}]));
  await p.waitForTimeout(120);assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.rain.target)-.55*.85*.65)<.001,'Dialogue ducking');
  await p.evaluate(()=>outsidePlaytest.model.story.cancel());
  await p.keyboard.press('Escape');await p.locator('[data-street-volume]').fill('0');
  assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing||LunaStreetAudio.state.rain.playing),false,'Shared slider mutes both immediately');
  await p.locator('[data-street-volume]').fill('55');await p.keyboard.press('Escape');await p.waitForFunction(()=>LunaStreetAudio.state.rain.playing);
  await set(0,'out','home');await p.waitForTimeout(3200);
  assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing||LunaStreetAudio.state.rain.playing),false,'Indoor silence');
  await set(0,'out');await p.waitForFunction(()=>LunaStreetAudio.state.rain.playing);
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>LunaStreetAudio.state.rain.playing),false,'Blur is silent');
  await p.mouse.click(10,10);await p.evaluate(()=>outsidePlaytest.model.paused=false);await p.waitForFunction(()=>LunaStreetAudio.state.rain.playing);
  await p.evaluate(()=>outsidePlaytest.exit(true));await p.waitForTimeout(3200);assert.equal(await p.evaluate(()=>LunaStreetAudio.state.rain.playing),false,'Exit fades out');
  assert.deepEqual(errors,[]);console.log('PASS rain: lazy decode, simultaneous city/rain loops, exact weather schedule, stable city source, loop continuity, gain/ducking, shared mute, indoor/exit fade and blur silence');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
