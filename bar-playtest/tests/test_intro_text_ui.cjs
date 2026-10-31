const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const lines=['그러면... 약속해줘. 루나.','포기하지 않겠다고.','이건... 명령이 아니라 부탁이야.','사랑해 루나. 부디... 잘 지내야 해.'];
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
  await p.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait);
  assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),6);
  const text=()=>p.evaluate(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.text?StudioTags.parse(c.scene.clips.find(l=>l.id===c.dialogueWait.id).text).text:undefined;});
  const meta=await p.evaluate(()=>{const c=lunaCampaign,scene=c.cinema.scene;StudioModel.validate(scene);return {lines:scene.clips.filter(l=>l.layout==='intro'&&!l.introNotice&&!l.introStart).map(l=>({text:StudioTags.parse(l.text).text,wait:l.wait,effect:l.textEffect})),home:scene.clips.find(l=>l.actor==='house').start,alarm:scene.clips.find(l=>l.assetId==='opening-alarm').start,earlyArt:scene.clips.some(l=>l.type==='visual'&&l.start<10),canSkip:c.canSkipCinema()};});
  assert.deepEqual(meta.lines.map(l=>l.text),lines);assert(meta.lines.every(l=>l.wait&&l.effect==='typewriter'));
  assert.equal(meta.home,10);assert.equal(meta.alarm,10);assert.equal(meta.earlyArt,false);assert.equal(meta.canSkip,false);
  const punctuation=await p.evaluate(()=>{
   const clips=lunaCampaign.cinema.scene.clips.filter(c=>c.layout==='intro'&&!c.introNotice&&!c.introStart);
   return clips.map(c=>{
    const parsed=StudioTags.parse(c.text),timing=LunaDialogueRhythm.timing(parsed.text,c.cps);let valid=true;
    for(let i=1;i<parsed.chars.length;i++){
     const prev=parsed.chars[i-1].ch,next=parsed.chars[i].ch,before=parsed.chars[i-2]?.ch;
     const gap=prev==='.'&&next==='.'?.3:prev==='.'&&before!=='.'?.35:1/c.cps;
     valid&&=Math.abs(timing.times[i]-timing.times[i-1]-gap)<1e-8;
     valid&&=StudioTags.count(parsed,timing.times[i]-.001,c.cps)===i;
     valid&&=StudioTags.count(parsed,timing.times[i],c.cps)===i+1;
    }
    return {valid,pauses:parsed.pauses.map(x=>x.duration),initial:StudioTags.count(parsed,0,c.cps),partial:StudioTags.count(parsed,.08,c.cps)};
   });
  });
  assert.deepEqual(punctuation.map(x=>x.pauses),[[],[],[],[]],'No duplicated intro-only punctuation tags');
  assert(punctuation.every(x=>x.valid&&x.initial===0&&x.partial>0));
  for(let i=0;i<4;i++){
   assert.equal(await text(),lines[i]);
   if(i===0){
    const id=await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id);
    for(const key of ['KeyE','Space','Enter'])await p.keyboard.press(key);
    await canvas.click();
    assert(await p.evaluate(id=>{const c=lunaCampaign.cinema,w=c.dialogueWait,line=c.scene.clips.find(l=>l.id===id);return w.id===id&&!w.revealed&&c.player.dialogueCount(line)<StudioTags.parse(line.text).chars.length;},id),'Keys and clicks cannot reveal or skip partial intro text');
    await p.waitForFunction(()=>{const c=lunaCampaign.cinema,w=c.dialogueWait,l=c.scene.clips.find(l=>l.id===w.id);return c.player.dialogueCount(l)===StudioTags.parse(l.text).chars.length&&StudioOpening.typingPending(l,c.time-l.start+w.age);});
    await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),id,'Final full-stop pause also completes naturally');
   }
   await p.waitForFunction(()=>{const c=lunaCampaign.cinema,w=c.dialogueWait,l=c.scene.clips.find(l=>l.id===w.id);return !StudioOpening.typingPending(l,c.time-l.start+w.age);});
   await p.waitForTimeout(150);assert.equal(await text(),lines[i],'No automatic advancement');
   const bounds=await p.locator('.campaign-host canvas, .campaign-cinema canvas, canvas').first().evaluate(canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,1280,720).data;let x0=1280,x1=0,y0=720,y1=0;
    for(let y=0;y<720;y++)for(let x=0;x<1280;x++){const n=(y*1280+x)*4;if(data[n]||data[n+1]||data[n+2]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
    return {x0,x1,y0,y1};
   });
   assert(Math.abs((bounds.x0+bounds.x1)/2-640)<12);assert(Math.abs((bounds.y0+bounds.y1)/2-360)<12);
   assert(bounds.y1-bounds.y0<45,'Only centered text on pure black');
   if(i===0)await p.screenshot({path:'/private/tmp/luna-intro-text.png'});
   if(i===1){await p.keyboard.down('Space');await p.waitForTimeout(1800);assert.equal(await text(),lines[2],'Holding Space cannot skip additional lines');await p.keyboard.up('Space');}
   else await p.keyboard.press(i===2?'Enter':'KeyE');
   if(i<3)await p.waitForFunction(expected=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)&&StudioTags.parse(c.scene.clips.find(l=>l.id===c.dialogueWait.id).text).text===expected;},lines[i+1]);
  }
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,s=StudioModel.sample(c.scene,c.time);return !c.dialogueWait&&s.actors.house.active&&s.actors['home-luna'].assetId==='opening-luna-sleep';}));
  await p.waitForFunction(()=>StudioMedia.activeVoices>0);await p.screenshot({path:'/private/tmp/luna-intro-to-contact.png'});
  await p.waitForFunction(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.actor==='phone';},null,{timeout:15000});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),true);
  await p.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=guide-fade-in-20261016');await p.waitForFunction(()=>window.cutsceneStudio?.ready);
  assert.deepEqual(await p.evaluate(()=>cutsceneStudio.project.clips.filter(c=>c.layout==='intro'&&!c.introNotice&&!c.introStart).map(c=>StudioTags.parse(c.text).text)),lines);
  assert.deepEqual(errors,[]);console.log('PASS four exact centered black-screen cards; manual E/Enter/Space; no auto/repeat/skip; call + sleep/wake continuation; shared editor.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
