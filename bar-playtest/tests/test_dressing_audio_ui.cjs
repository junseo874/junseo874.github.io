const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');
  await page.evaluate(()=>lunaCampaign.newGame());
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const result=await page.evaluate(async()=>{
   const campaign=lunaCampaign;campaign.disposeCinema();campaign.screen('title');
   const canvas=document.createElement('canvas'),ui=document.createElement('div');
   canvas.id='dressing-test';document.body.append(canvas,ui);
   const reports=[];
   for(const kind of ['opening','morning']){
    const scene=await LunaStudioCinema.prepare(kind);StudioModel.validate(scene);
    const sound=scene.clips.find(c=>c.assetId==='opening-dressing');
    // Isolate the dressing voice from the opening's looping room ambience.
    for(const track of scene.tracks)if(track.type==='assets/audio/effects'&&track.id!==sound.track)track.muted=true;
    const black=scene.clips.find(c=>c.effect==='black'&&Math.abs(c.start-sound.start)<.001);
    const fade=scene.clips.find(c=>c.effect==='fadeOut'&&Math.abs(c.start+c.duration-black.start)<.001);
    const reveal=scene.clips.find(c=>c.effect==='fadeIn'&&c.start>black.start);
    const standing=scene.clips.find(c=>c.assetId==='opening-luna-home');
    const buffer=await StudioMedia.decode(sound.assetId),player=LunaStudioCinema.player(canvas,ui,scene);
    const uniform=()=>{const d=canvas.getContext('2d').getImageData(0,0,1280,720).data;for(let i=0;i<d.length;i+=4)if(d[i]!==2||d[i+1]!==4||d[i+2]!==7||d[i+3]!==255)return false;return true;};
    let blackThroughout=true;
    for(let t=black.start+.001;t<black.start+black.duration;t+=.037){player.render(t,null,false);blackThroughout&&=uniform();}
    await StudioMedia.unlock();
    player.render(sound.start+.02,sound.start,true);await new Promise(r=>setTimeout(r,50));
    const started=StudioMedia.activeVoices===1;
    player.pause();const paused=StudioMedia.activeVoices===0;
    player.render(sound.start+.3,sound.start+.29,true);await new Promise(r=>setTimeout(r,30));
    const resumed=StudioMedia.activeVoices===1;
    player.render(sound.start+.4,sound.start+.39,false);const muted=StudioMedia.activeVoices===0;
    // Real-time playback: audio starts behind the opaque frame and ends before reveal.
    const start=performance.now();let heard=false,visibleWhileSound=false;
    while(performance.now()-start<(black.duration+.05)*1000){
     const age=(performance.now()-start)/1000;
     player.render(sound.start+age,sound.start+Math.max(0,age-.016),true);
     heard ||= StudioMedia.activeVoices>0;
     if(StudioMedia.activeVoices>0&&!uniform())visibleWhileSound=true;
     await new Promise(requestAnimationFrame);
    }
    const ended=StudioMedia.activeVoices===0;
    player.render(reveal.start+.6,null,false);const revealed=!uniform();
    reports.push({kind,blackThroughout,started,paused,resumed,muted,heard,visibleWhileSound,ended,revealed,
     aligned:Math.abs(sound.start-black.start)<.001&&Math.abs(reveal.start-black.start-black.duration)<.001&&standing.start>=reveal.start-.001&&!!fade,
     duration:buffer.duration,hold:black.duration});
    player.dispose();
   }
   canvas.remove();ui.remove();return reports;
  });
  for(const r of result){
   for(const key of ['blackThroughout','started','paused','resumed','muted','heard','ended','revealed','aligned'])assert(r[key],r.kind+': '+key);
   assert(!r.visibleWhileSound,r.kind+': room revealed before sound ended');
   assert(r.hold>=r.duration&&r.hold-r.duration<.02);
  }
  assert.deepEqual(errors,[]);console.log('PASS opening + daily morning: full-black audio, complete WAV tail, pause/resume/mute, then dressed reveal.',result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
