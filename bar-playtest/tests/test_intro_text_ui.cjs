const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const lines=["그렇지 않아? 아니라면 인간들은 전부 죽었어야겠지.", "그래서 난 기적을 믿어 보기로 했어.", "바로 ■■■■■를 말이야.", "그러니까... 포기하지 말아 줘, 루나.", "그리고 전부터 이 말을 하고 싶었어.", "...■■■ ■■."];
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
   window.introNoiseBuffer=await StudioMedia.decode('opening-memory-noise');const alarmBuffer=await StudioMedia.decode('opening-alarm');window.introAudioTrace=[];
   const paint=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(text.trimEnd()==='그렇지 않아?'||text.startsWith('그렇지 않아? 아')){const kind=text.trimEnd()==='그렇지 않아?'?'question':'continuation';if(!introAudioTrace.some(e=>e.kind===kind))introAudioTrace.push({kind,time:c.cinema.dialogueWait.age});}if(text==='...■■■ ■■.')introAudioTrace.push({kind:'finalGlyph',time:c.cinema.time});return paint.call(this,text,...args);};
   const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
   AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer===introNoiseBuffer)introAudioTrace.push({kind:'start',time:c.cinema.time,offset:args[1],loop:this.loop,loopStart:this.loopStart});if(this.buffer===alarmBuffer)introAudioTrace.push({kind:'alarm',time:c.cinema.time});return start.apply(this,args);};
   AudioBufferSourceNode.prototype.stop=function(...args){if(this.buffer===introNoiseBuffer)introAudioTrace.push({kind:'stop',time:c.cinema.time,delay:(args[0]||0)-this.context.currentTime});return stop.apply(this,args);};
   const lines=scene.clips.filter(l=>l.layout==='intro'&&!l.introNotice),noise=scene.clips.find(l=>l.assetId==='opening-memory-noise'),home=scene.clips.find(l=>l.actor==='house').start;
   return {lines:lines.map(l=>({text:StudioTags.parse(l.text).text,start:l.start,duration:l.duration,wait:l.wait,typing:StudioTags.duration(StudioTags.parse(l.text),l.cps)})),home,alarm:scene.clips.find(l=>l.assetId==='opening-alarm').start,noise,bufferDuration:introNoiseBuffer.duration,gains:[0,.25,.5,.75,1].map(x=>StudioKeyframes.audioGain(noise,noise.duration*x)),canSkip:c.canSkipCinema()};
  });
  assert.deepEqual(meta.lines.map(l=>l.text),lines);assert(meta.lines.slice(0,-1).every(l=>l.wait));assert(!meta.lines.at(-1).wait);
  assert.equal(meta.alarm,meta.home);assert.equal(meta.noise.start,meta.lines[2].start);assert(meta.noise.loop);
  for(const line of meta.lines.slice(0,-1)){
   await p.waitForFunction(t=>lunaCampaign.cinema.dialogueWait?.age>=t,line.typing+.1);
   assert.equal(await p.evaluate(()=>StudioTags.parse(lunaCampaign.cinema.scene.clips.find(l=>l.id===lunaCampaign.cinema.dialogueWait.id).text).text),line.text);
   await canvas.click();assert(await p.evaluate(()=>!!lunaCampaign.cinema.dialogueWait));
   await p.keyboard.press('KeyE');
  }
  await p.waitForFunction(home=>lunaCampaign.cinema.time>=home,meta.home);
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,s=StudioModel.sample(c.scene,c.time);return !c.dialogueWait&&s.actors.house.active&&s.actors['home-luna'].assetId==='opening-luna-sleep';}));
  const trace=await p.evaluate(()=>introAudioTrace);
  assert(trace.some(x=>x.kind==='start'&&x.loop&&x.loopStart===.8&&x.offset>=.8));
  const cut=trace.filter(x=>x.kind==='stop'&&x.time>=meta.home).at(-1);assert(cut&&cut.time-meta.home<.1&&cut.delay<=0,'Noise must hard-stop on the exact room/alarm boundary, not retire with a fade');
  const pause=trace.find(x=>x.kind==='continuation').time-trace.find(x=>x.kind==='question').time;
  assert(Math.abs(pause-.4)<.055,'First question pauses about 400 ms before the next visible syllable');
  console.log('Opening question pause:',Math.round(pause*1000),'ms');
  const glyph=trace.find(x=>x.kind==='finalGlyph'),alarm=trace.find(x=>x.kind==='alarm');
  assert(glyph&&alarm&&alarm.time===cut.time&&alarm.time>glyph.time&&alarm.time-glyph.time<=.102,'Full final line must paint just before the noise stops and phone rings together');
  console.log('Final glyph to alarm/room:',Math.round((alarm.time-glyph.time)*1000),'ms');
  await p.screenshot({path:'/private/tmp/luna-intro-to-contact.png'});
  await p.waitForFunction(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.actor==='phone';},null,{timeout:15000});
  const sleepingX=await p.evaluate(()=>outsidePlaytest.model.x);
  await p.keyboard.down('ArrowRight');await p.waitForTimeout(200);await p.keyboard.up('ArrowRight');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),sleepingX,'Manual call still blocks exterior movement after settings resume');
  await p.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=guide-fade-in-20261016');await p.waitForFunction(()=>window.cutsceneStudio?.ready);
  assert.deepEqual(await p.evaluate(()=>cutsceneStudio.project.clips.filter(c=>c.layout==='intro'&&!c.introNotice&&!c.introStart).map(c=>StudioTags.parse(c.text).text)),lines);
  assert.deepEqual(errors,[]);console.log('PASS six dream lines with five keyboard advances; recorded noise crescendo/hard cut; settings pause; alarm + sleep/wake; manual call; shared editor.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
