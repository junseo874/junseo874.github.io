const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio','--autoplay-policy=no-user-gesture-required']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.evaluate(()=>lunaCampaign.newGame());
  await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  const result=await p.evaluate(async()=>{
   const c=lunaCampaign,project=c.cinema.scene,alarm=project.clips.find(c=>c.assetId==='opening-alarm'),asset=StudioMedia.assets.get('opening-alarm');
   const home=project.clips.find(c=>c.type==='visual'&&c.actor==='house').start;
   const before=StudioModel.sample(project,home-.001),after=StudioModel.sample(project,home);
   const noFade=s=>!s.fx.some(f=>['fadeIn','fadeOut','flash'].includes(f.effect));
   const hardCut=noFade(before)&&noFade(after)&&before.actors.disposal.active&&!before.actors.house.active&&!after.actors.disposal.active&&after.actors.house.active;
   c.finishCinema(true);
   const skippedToCut=c.cinema.time===home&&!c.canSkipCinema();
   c.resumeView='prologue';c.screen('options');
   const buffer=await StudioMedia.decode('opening-alarm'),bytes=await(await fetch(asset.src)).arrayBuffer();
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   let peak=0;for(const x of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(x));
   await StudioMedia.unlock();
   const probe={tracks:project.tracks,clips:[{...alarm,id:'alarm-probe',start:0,keyframes:{}}]},starts=[],original=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){starts.push({loop:this.loop,bufferDuration:this.buffer.duration});return original.apply(this,args);};
   try{
    StudioMedia.sync(probe,.02,true,1,.55);await new Promise(r=>setTimeout(r,60));
    const active=StudioMedia.activeVoices;await new Promise(r=>setTimeout(r,800));
    StudioMedia.sync(probe,.5,true,1,.55);await new Promise(r=>setTimeout(r,30));
    const ended=StudioMedia.activeVoices;StudioMedia.stop();
    return {asset,alarm,home,hardCut,skippedToCut,duration:buffer.duration,peak,hash,starts,active,ended,phone:project.clips.find(c=>c.track==='phone-lines').start,
     wake:project.clips.find(c=>c.actor==='home-luna'&&c.type==='visual'&&c.rotation===0).start};
   }finally{AudioBufferSourceNode.prototype.start=original;StudioMedia.stop();}
  });
  assert(!result.asset.synth);assert(result.asset.src.endsWith('/assets/opening/chris-contact-confirm.wav'));
  assert.equal(result.hash,crypto.createHash('sha256').update(fs.readFileSync('cutscene-studio/assets/opening/chris-contact-confirm.wav')).digest('hex'));
  assert(Math.abs(result.duration-.726625)<.001);assert(result.peak>0&&result.peak<1);
  assert.equal(result.alarm.loop,false);assert(result.alarm.start+result.alarm.duration<result.wake&&result.wake<result.phone);
  assert.equal(result.alarm.start,result.home);assert(result.hardCut&&result.skippedToCut);
  assert.equal(result.active,1);assert.equal(result.ended,0);assert.equal(result.starts.length,1);assert.equal(result.starts[0].loop,false);
  assert.deepEqual(errors,[]);console.log('PASS: supplied WAV decoded, hash matches, one-shot playback ends without restart, wake/phone timing preserved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
