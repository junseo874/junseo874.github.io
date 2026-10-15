const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const lines=['그러면... 약속해줘. 루나.','포기하지 않겠다고.','이건... 명령이 아니라 부탁이야.','사랑해 루나. 부디... 잘 지내야 해.'];
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait);
  const text=()=>p.evaluate(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.text;});
  const meta=await p.evaluate(()=>{const c=lunaCampaign,scene=c.cinema.scene;StudioModel.validate(scene);return {lines:scene.clips.filter(l=>l.layout==='intro').map(l=>({text:l.text,wait:l.wait,effect:l.textEffect})),home:scene.clips.find(l=>l.actor==='house').start,alarm:scene.clips.find(l=>l.assetId==='opening-alarm').start,earlyArt:scene.clips.some(l=>l.type==='visual'&&l.start<4),canSkip:c.canSkipCinema()};});
  assert.deepEqual(meta.lines.map(l=>l.text),lines);assert(meta.lines.every(l=>l.wait&&l.effect==='instant'));
  assert.equal(meta.home,4);assert.equal(meta.alarm,4);assert.equal(meta.earlyArt,false);assert.equal(meta.canSkip,false);
  for(let i=0;i<4;i++){
   assert.equal(await text(),lines[i]);
   await p.waitForTimeout(1200);assert.equal(await text(),lines[i],'No automatic advancement');
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
   if(i<3)await p.waitForFunction(expected=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.text===expected;},lines[i+1]);
  }
  assert(await p.evaluate(()=>{const c=lunaCampaign.cinema,s=StudioModel.sample(c.scene,c.time);return !c.dialogueWait&&s.actors.house.active&&s.actors['home-luna'].assetId==='opening-luna-sleep';}));
  await p.waitForFunction(()=>StudioMedia.activeVoices>0);await p.screenshot({path:'/private/tmp/luna-intro-to-contact.png'});
  await p.waitForFunction(()=>{const c=lunaCampaign.cinema;return c.scene.clips.find(l=>l.id===c.dialogueWait?.id)?.actor==='phone';},null,{timeout:15000});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),true);
  await p.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=intro-text-20261016');await p.waitForFunction(()=>window.cutsceneStudio?.ready);
  assert.deepEqual(await p.evaluate(()=>cutsceneStudio.project.clips.filter(c=>c.layout==='intro').map(c=>c.text)),lines);
  assert.deepEqual(errors,[]);console.log('PASS four exact centered black-screen cards; manual E/Enter/Space; no auto/repeat/skip; call + sleep/wake continuation; shared editor.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
