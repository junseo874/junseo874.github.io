const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.cityStarts=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>50)cityStarts++;return start.apply(this,args);};});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.mouse.click(10,10);
  await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();outsidePlaytest.model.paused=true;});
  assert.equal(await p.evaluate(()=>LunaStreetAudio.state.target),0,'Home remains silent');
  for(const day of [0,1,2,3]){
   await p.evaluate(day=>{const c=lunaCampaign;c.session.day=day;outsidePlaytest.model.config.day=day;outsidePlaytest.model.config.flow='in';c.scene(LunaTerrace.nightKey(day),'테라스','terrace',()=>c.screen('developer'));},day);
   await p.waitForFunction(()=>lunaCampaign.memoryTransition?.phase==='hold').catch(async e=>{throw Error('Day '+day+' '+JSON.stringify(await p.evaluate(()=>({view:lunaCampaign.view,phase:lunaCampaign.memoryTransition?.phase,time:lunaCampaign.memoryTransition?.time,hidden:document.hidden})))+' '+errors.join('; ')+' '+e.message);});
   assert.equal(await p.evaluate(()=>LunaStreetAudio.state.target),0,'No ambience before terrace reveal');
   await p.waitForFunction(()=>lunaCampaign.memoryTransition?.phase==='in'&&lunaCampaign.memoryTransition.time>.4);
   const entering=await p.evaluate(()=>LunaStreetAudio.state.target);assert(entering>0&&entering<.55*.55,'Volume fades in with the scene');
   await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&LunaStreetAudio.state.playing);
   await p.waitForTimeout(150);
   assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.target)-.55*.55)<.001,'Quiet terrace dialogue mix');
   const rain=await p.evaluate(()=>LunaStreetAudio.state.rain.target);
   const wet=[1,2,3].includes(day); // Latest schedule: days 1/3 both routes, day 2 incoming.
   assert(Math.abs(rain-(wet?.55*.55*.85:0))<.001,'Rain matches the incoming commute weather');
   const wetPixels=await p.evaluate(()=>{const cv=document.querySelector('.terrace-rain');return cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.some((v,i)=>i%4===3&&v>0);});
   assert.equal(wetPixels,wet,'Visible terrace rain matches its audio and incoming route');
   if(day===2)await p.screenshot({path:'/private/tmp/terrace-return-rain.png'});
   const starts=await p.evaluate(()=>cityStarts);
   await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});await p.waitForTimeout(100);
   assert.equal(await p.evaluate(()=>cityStarts),starts,'Dialogue lines do not restart the loop');
   if(day===0){
    await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');await p.waitForTimeout(100);
    assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.target)-.55*.55*.45)<.001,'Settings soften ambience');
    await p.keyboard.press('Escape');await p.waitForTimeout(100);
    await p.evaluate(()=>LunaStreetAudio.setVolume(0));assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing||LunaStreetAudio.state.rain.playing),false);
    await p.evaluate(()=>LunaStreetAudio.setVolume(.3));await p.waitForFunction(()=>LunaStreetAudio.state.playing);assert(Math.abs(await p.evaluate(()=>LunaStreetAudio.state.target)-.3*.55)<.001);
    await p.evaluate(()=>LunaStreetAudio.setVolume(.55));
   }
   // A retained terrace object must not leak audio into loading/other views.
   await p.evaluate(()=>lunaCampaign.screen('loading'));await p.waitForFunction(()=>LunaStreetAudio.state.target===0);
   await p.evaluate(()=>lunaCampaign.screen('scene'));
   await p.waitForFunction(()=>LunaStreetAudio.state.playing&&LunaStreetAudio.state.target>0);
   await p.evaluate(()=>{lunaCampaign.dialog.index=lunaCampaign.dialog.rows.length;lunaCampaign.continueScene();});
   await p.waitForFunction(()=>!LunaStreetAudio.state.playing&&!LunaStreetAudio.state.rain.playing);
  }
  // A standalone terrace replay must work with no active outside world.
  await p.evaluate(()=>{outsidePlaytest.exit(true);lunaCampaign.session.day=2;lunaCampaign.scene('night2','테라스','terrace',()=>{});});
  await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&LunaStreetAudio.state.playing);
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await p.evaluate(()=>LunaStreetAudio.state.playing),true,'Terrace ambience continues on blur');
  await p.evaluate(()=>{window.dispatchEvent(new Event('focus'));lunaCampaign.screen('scene');});await p.waitForFunction(()=>LunaStreetAudio.state.playing);
  await p.evaluate(()=>lunaCampaign.toPicker());await p.waitForFunction(()=>!LunaStreetAudio.state.playing);
  assert.deepEqual(errors,[]);console.log('PASS terrace nights 0–3: city/rain mix, reveal fade, continuous dialogue loop, settings/mute, loading/exit isolation, no outside renderer and focus safety');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
