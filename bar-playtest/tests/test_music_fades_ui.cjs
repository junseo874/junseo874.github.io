const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/music-fade-harness',r=>r.fulfill({contentType:'text/html',body:'<button>Play</button><script src="src/shared/audio/bgm.js"></script><script>window.barBgm=new LunaBarBgm()</script>'}));
  await p.goto('http://127.0.0.1:8123/bar-playtest/music-fade-harness');await p.locator('button').click();
  const ready=()=>p.waitForFunction(()=>barBgm.status==='playing'&&!barBgm.fade&&!barBgm.gainFades.size&&barBgm.audio.currentTime>0);
  await ready();
  async function sample(action,ms=1350){return p.evaluate(async({action,ms})=>{const b=barBgm,before=b.audio.volume;Function('b',action)(b);const rows=[before,b.audio.volume];for(let i=0;i<ms/50;i++){await new Promise(r=>setTimeout(r,50));rows.push(b.audio.volume);}return rows;},{action,ms});}
  const smooth=(rows,up)=>{assert.equal(rows[0],rows[1],'No synchronous volume jump');for(let i=1;i<rows.length;i++){assert(Math.abs(rows[i]-rows[i-1])<.1,'No hard jump');assert(up?rows[i]>=rows[i-1]-1e-6:rows[i]<=rows[i-1]+1e-6,'Monotonic envelope');}assert(rows.some(x=>x>0&&x<.299),'Intermediate fade levels');};
  const time=await p.evaluate(()=>barBgm.audio.currentTime);
  smooth(await sample("b.setSuppressed('cinema',true)",1000),false);
  assert.equal(await p.evaluate(()=>barBgm.audio.volume),0);
  assert(await p.evaluate(t=>!barBgm.audio.muted&&!barBgm.audio.paused&&barBgm.audio.currentTime>t,time),'Cinema silence retains playback position');
  smooth(await sample("b.setSuppressed('cinema',false)"),true);
  await p.evaluate(()=>{barBgm.setSuppressed('cinema',true);barBgm.setSuppressed('preview',true);});await p.waitForTimeout(900);
  await p.evaluate(()=>barBgm.setSuppressed('cinema',false));await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>barBgm.audio.volume),0,'Closing a cutscene cannot unmute a parked preview');
  await p.evaluate(()=>barBgm.setSuppressed('preview',false));await ready();
  await p.evaluate(()=>barBgm.setSuppressed('cinema',true));await p.waitForTimeout(250);
  const reversed=await p.evaluate(()=>{const b=barBgm,before=b.audio.volume;b.setSuppressed('cinema',false);return [before,b.audio.volume];});assert.equal(reversed[0],reversed[1]);await ready();
  smooth(await sample('b.setTransitionGain(0)',800),false);smooth(await sample('b.setTransitionGain(1)',800),true);
  smooth(await sample('b.setEnabled(false)',650),false);assert(await p.evaluate(()=>barBgm.audio.paused));
  await p.evaluate(()=>barBgm.setEnabled(true));await ready();
  await p.evaluate(()=>{barBgm.setEnabled(false);barBgm.setLocation('street');});await p.waitForTimeout(650);assert(await p.evaluate(()=>barBgm.audio.paused));
  await p.evaluate(()=>barBgm.setEnabled(true));await ready();assert.equal(await p.evaluate(()=>barBgm.index),1);assert(Math.abs(await p.evaluate(()=>barBgm.audio.volume)-.18)<1e-6);
  await p.evaluate(()=>{barBgm.setEnabled(false);barBgm.setEnabled(true);});await ready();await p.waitForTimeout(550);assert(!await p.evaluate(()=>barBgm.audio.paused),'Old off callback cannot stop resumed music');
  // Same-location requests do not restart; different locations fade before replacing src.
  const same=await p.evaluate(()=>{const b=barBgm,t=b.audio.currentTime;b.setLocation('street');return t;});await p.waitForTimeout(100);assert(await p.evaluate(t=>barBgm.audio.currentTime>t,same));
  const switchStart=await p.evaluate(()=>{const b=barBgm,src=b.audio.src,volume=b.audio.volume;b.setLocation('home');return {src,volume,after:b.audio.volume};});assert.equal(switchStart.volume,switchStart.after);
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>barBgm.audio.src),switchStart.src);assert(await p.evaluate(v=>barBgm.audio.volume>0&&barBgm.audio.volume<v,switchStart.volume));await ready();assert.equal(await p.evaluate(()=>barBgm.index),2);
  // Simulate a short remaining tail: the local server does not support MP3 range seeks.
  // The actual timeupdate handler, audio replacement and fade-in still run normally.
  const ending=await p.evaluate(()=>{const b=barBgm,a=b.audio;Object.defineProperty(a,'duration',{configurable:true,value:a.currentTime+.8});a.addEventListener('loadstart',()=>delete a.duration,{once:true});a.dispatchEvent(new Event('timeupdate'));return {duration:a.duration,time:a.currentTime,paused:a.paused,fade:b.fade?.target};});
  assert.equal(ending.fade,0,JSON.stringify(ending));await p.waitForFunction(()=>barBgm.audio.currentTime<5);await ready();assert.equal(await p.evaluate(()=>barBgm.index),2);
  assert.equal(await p.locator('assets/audio/effects').count(),1);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('luna.bar.playtest.bgm.v1'))),{enabled:true,volume:.3});
  console.log('PASS music envelopes: scene enter/return, independent reasons, rapid reversal, transition, off/on, location, same-track continuity and file-end loop');
  // Exercise the actual shared cinema entry/exit paths, not only the player API.
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();await p.mouse.click(10,10);await ready();
  for(const id of ['tv','bd']){
   await p.evaluate(id=>LunaCutsceneLibrary.play(lunaCampaign,id),id);
   await p.waitForFunction(()=>barBgm.suppressed.has('cinema')&&barBgm.sceneGain===0);
   assert(!await p.evaluate(()=>barBgm.audio.muted));
   const before=await p.evaluate(()=>{const b=barBgm,before=b.audio.volume;LunaCutsceneLibrary.close();return [before,b.audio.volume];});assert.equal(before[0],before[1]);await ready();assert.equal(await p.evaluate(()=>barBgm.sceneGain),1);
  }
  assert.deepEqual(errors,[]);console.log('PASS real TV and BD cutscenes: fade-out entry, fade-in exit, no hard mute or browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
