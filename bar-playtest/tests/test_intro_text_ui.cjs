const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const lines=['약속해줘, 루나. 포기하지 않겠다고.','잘 지내야 해. 알겠지?','...■■■ ■■.'];
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>lunaCampaign.newGame());
  await p.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait);
  const notices=await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.introNotice&&!c.introFade).map(c=>StudioTags.parse(c.text).text));
  assert.deepEqual(notices,[
   '—— 플레이 안내 ——\n이 게임은 인물들과의 대화를 중심으로 이야기가 진행됩니다.\n대화는 E키 또는 스페이스바로 넘길 수 있습니다.'
  ]);
  const canvas=p.locator('#campaign-root canvas.campaign-prologue');
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema;return c.scene.clips.filter(l=>l.introNotice&&!l.introFade).length===1&&!c.scene.clips.some(l=>l.text?.includes('감사합니다'))&&c.scene.clips.find(l=>l.introFadeIn).introFadeIn===1.5;}));
  await p.keyboard.press('KeyE');await canvas.click();assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),0,'Fade-in cannot be skipped or flashed by early input');
  const fadeInLevels=await p.evaluate(()=>{
   const c=lunaCampaign.cinema,canvas=lunaCampaign.host.querySelector('canvas'),g=canvas.getContext('2d'),values=[];
   for(const age of [0,.75,1.5]){
    c.player.render(c.time,null,false,.55,{...c.dialogueWait,age});
    const data=g.getImageData(100,190,1080,200).data;let sum=0;for(let i=0;i<data.length;i+=4)sum+=data[i]+data[i+1]+data[i+2];values.push(sum);
   }
   c.player.render(c.time,null,false,.55,c.dialogueWait);return values;
  });
  assert.equal(fadeInLevels[0],0);assert(fadeInLevels[1]>0&&fadeInLevels[2]>fadeInLevels[1]*1.8,'Guide smoothly fades in from black');
  await p.waitForFunction(()=>lunaCampaign.cinema.dialogueWait.age>=1.6);
  await canvas.click({button:'right'});assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),0);
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,line=c.scene.clips.find(l=>l.id===c.dialogueWait.id);return line.introControls&&line.textEffect==='instant';}));
  const a=await canvas.screenshot();let animated=false;for(let frame=0;frame<4;frame++){await p.waitForTimeout(250);animated||=!a.equals(await canvas.screenshot());}assert(animated,'Key/mouse icons animate while waiting');
  await p.screenshot({path:'/private/tmp/luna-start-guide.png'});
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);const stillA=await canvas.screenshot();await p.waitForTimeout(350);assert(stillA.equals(await canvas.screenshot()),'Reduced-motion preference stops pressing loops');await p.emulateMedia({reducedMotion:'no-preference'});
  await p.keyboard.press('Space');
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,fade=c.scene.clips.find(l=>l.introFade);return c.time>=1&&!c.dialogueWait&&fade.duration===3&&fade.introPhaseOffset>0&&!c.scene.clips.some(l=>l.introStart);}));
  const brightness=()=>canvas.evaluate(el=>{const d=el.getContext('2d').getImageData(100,190,1080,200).data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=d[i]+d[i+1]+d[i+2];return sum;});
  const early=await brightness();
  await p.keyboard.press('KeyE');await canvas.click();
  await p.waitForFunction(()=>lunaCampaign.cinema.time>=2.5);
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema;return c.time<4&&StudioModel.sample(c.scene,c.time).dialogue.introFade;}),'Guide remains visible during fade; input cannot skip it');
  const middle=await brightness();await p.screenshot({path:'/private/tmp/luna-guide-fade-half.png'});
  await p.waitForFunction(()=>lunaCampaign.cinema.time>=3.7);const late=await brightness();
  assert(early>middle*1.3&&middle>late*2&&late>0,'Guide dims gradually over all three seconds');
  await p.waitForFunction(()=>lunaCampaign.cinema.time>=4.5);
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema;if(c.time>=6||c.dialogueWait)return false;const canvas=lunaCampaign.host.querySelector('canvas'),pixels=canvas.getContext('2d').getImageData(0,0,1280,720).data;return pixels.every((v,i)=>i%4===3?v===255:v===0);}), 'After fade, two seconds stay pure black');
  const meta=await p.evaluate(async()=>{
   const c=lunaCampaign,scene=c.cinema.scene;LunaFocusSettings.setEnabled(false);StudioModel.validate(scene);
   window.introNoiseBuffer=await StudioMedia.decode('opening-memory-noise');window.introAudioTrace=[];
   const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
   AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer===introNoiseBuffer)introAudioTrace.push({kind:'start',time:c.cinema.time,offset:args[1],loop:this.loop});return start.apply(this,args);};
   AudioBufferSourceNode.prototype.stop=function(...args){if(this.buffer===introNoiseBuffer)introAudioTrace.push({kind:'stop',time:c.cinema.time,delay:(args[0]||0)-this.context.currentTime});return stop.apply(this,args);};
   const lines=scene.clips.filter(l=>l.layout==='intro'&&!l.introNotice),noise=scene.clips.find(l=>l.assetId==='opening-memory-noise'),home=scene.clips.find(l=>l.actor==='house').start;
   return {lines:lines.map(l=>({text:l.text,start:l.start,duration:l.duration,wait:l.wait,typing:StudioTags.duration(StudioTags.parse(l.text),l.cps)})),home,alarm:scene.clips.find(l=>l.assetId==='opening-alarm').start,noise,bufferDuration:introNoiseBuffer.duration,gains:[0,.25,.5,.75,1].map(x=>StudioKeyframes.audioGain(noise,noise.duration*x)),canSkip:c.canSkipCinema()};
  });
  assert.deepEqual(meta.lines.map(l=>l.text),lines);assert(meta.lines.every(l=>!l.wait&&l.duration>l.typing+1));
  assert.equal(meta.alarm,meta.home);assert.equal(meta.noise.start+meta.noise.duration,meta.home);
  assert.equal(meta.noise.start,meta.lines[0].start,'Quiet noise begins with the first card');
  const keys=meta.noise.keyframes.volume;
  assert(keys[0].value>0&&keys[2].value<=.12&&keys[3].value>=.6,'Keep early cards quiet and rise quickly in the last card');
  assert(keys.every(k=>k.value<=.65),'The climax is capped below the previous .95 gain');
  assert.equal(meta.noise.loop,false);assert.equal(meta.noise.fadeOut,0);assert(meta.bufferDuration>=meta.noise.offset+meta.noise.duration);
  assert(meta.gains.every((v,i,a)=>!i||v>a[i-1]));assert.equal(meta.canSkip,false);
  for(const [i,line] of meta.lines.entries()){
   await p.waitForFunction(start=>lunaCampaign.cinema.time>=start,line.start);
   const before=await p.evaluate(()=>lunaCampaign.cinema.time);
   for(const key of ['KeyE','Space','Enter'])await p.keyboard.press(key);
   await canvas.click();
   assert(await p.evaluate(({before,line})=>{const c=lunaCampaign.cinema;return !c.dialogueWait&&c.time<line.start+line.duration&&c.time-before<.6;},{before,line}),'Auto cards cannot be skipped by input');
   await p.waitForFunction(at=>lunaCampaign.cinema.time>=at,line.start+line.typing+.1);
   assert.equal(await p.evaluate(()=>{const c=lunaCampaign.cinema,l=StudioModel.sample(c.scene,c.time).dialogue;return c.player.dialogueCount(l)===StudioTags.parse(l.text).chars.length;}),true);
   if(i===1){
    await p.keyboard.press('Escape');const paused=await p.evaluate(()=>lunaCampaign.cinema.time);
    await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused,'Settings pause automatic playback');
    await p.keyboard.press('Escape');
   }
   await p.screenshot({path:'/private/tmp/luna-intro-auto-'+i+'.png'});
   // No confirmation: simply wait for the next authored boundary.
  }
  await p.waitForFunction(home=>lunaCampaign.cinema.time>=home,meta.home);
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,s=StudioModel.sample(c.scene,c.time);return !c.dialogueWait&&s.actors.house.active&&s.actors['home-luna'].assetId==='opening-luna-sleep';}));
  const trace=await p.evaluate(()=>introAudioTrace);
  assert(trace.some(x=>x.kind==='start'&&!x.loop&&x.offset>=.8));
  const cut=trace.filter(x=>x.kind==='stop'&&x.time>=meta.home).at(-1);assert(cut&&cut.time-meta.home<.1&&cut.delay<=0,'Noise must hard-stop on the exact room/alarm boundary, not retire with a fade');
  await p.screenshot({path:'/private/tmp/luna-intro-to-contact.png'});
  await p.waitForFunction(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.actor==='phone';},null,{timeout:15000});
  const sleepingX=await p.evaluate(()=>outsidePlaytest.model.x);
  await p.keyboard.down('ArrowRight');await p.waitForTimeout(200);await p.keyboard.up('ArrowRight');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),sleepingX,'Manual call still blocks exterior movement after settings resume');
  await p.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=guide-fade-in-20261016');await p.waitForFunction(()=>window.cutsceneStudio?.ready);
  assert.deepEqual(await p.evaluate(()=>cutsceneStudio.project.clips.filter(c=>c.layout==='intro'&&!c.introNotice&&!c.introStart).map(c=>StudioTags.parse(c.text).text)),lines);
  assert.deepEqual(errors,[]);console.log('PASS three Notion cards autoplay without skipping; recorded noise crescendo/hard cut; settings pause; alarm + sleep/wake; manual call; shared editor.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
