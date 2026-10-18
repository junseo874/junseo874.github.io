const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const deps='/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright');
const sharp=require(deps+'sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 const idle=path.join(root,'assets/char-shiba-idle-20261019.png');
 const talk=path.join(root,'assets/char-shiba-talk-20261019.png');
 const supplied='/Users/lee/Desktop/project/9_ArtResources/01.Characters/01.Bar/08.Shiba/Shiba_Idle2.png';
 if(fs.existsSync(supplied))assert.deepEqual(fs.readFileSync(talk),fs.readFileSync(supplied));
 async function bounds(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
  return [info.width,info.height,x0,y0,x1,y1];
 }
 assert.deepEqual(await bounds(talk),await bounds(idle));
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  for(const mode of ['original','gpt','campaign']){
   await page.evaluate(mode=>{
    const c=lunaCampaign,g=barGame;
    if(window.savedShibaTick)g.tick=window.savedShibaTick;
    c.session.uninstall();c.session.install({developer:mode!=='campaign'});c.session.day=1;c.ui.variant=mode==='gpt'?'gpt':'original';
    g.reset(1,'regular',42,true,{variant:c.ui.variant});c.screen(c.playView);c.render(true);
    for(let i=0;i<3000;i++){
     g.cameraMoving=false;
     if(g.dialogue?.actor==='shiba'){
      g.cameraLeft=0;g.dialogue.chars=3;window.savedShibaTick=g.tick;g.tick=()=>{};c.render(true);g.realTime+=3;c.render(true);return;
     }
     if(g.storyCoaster){g.coaster(g.storyCoaster.seat,'keyboard');g.tick(.1);}
     else if(g.dialogue){g.advance();g.advance();}else g.tick(.1);
    }
    throw Error('No Shiba dialogue: '+JSON.stringify({mode,screen:g.screen,step:g.story?.index,error:g.error}));
   },mode);
   const actor=page.locator('.actor[data-actor="shiba"]');
   async function expectPose(key){
    await page.waitForFunction(key=>{lunaCampaign.render(true);return !!document.querySelector('.actor[data-actor="shiba"] [data-layer="'+key+'"]');},key);
    return actor.locator('.actor-layer').boundingBox();
   }
   const typing=await expectPose('char_shiba_talk');
   assert.equal(await actor.evaluate(el=>getComputedStyle(el).opacity),'1');
   assert.equal(await actor.getAttribute('data-talking'),'true');
   if(mode==='original')await page.screenshot({path:'/private/tmp/shiba-speaking.png'});
   await page.evaluate(()=>{barGame.dialogue.chars=barGame.dialogue.text.length;lunaCampaign.render(true);});
   assert.deepEqual(await expectPose('char_shiba_static'),typing);
   assert.equal(await actor.getAttribute('data-talking'),'false');
   if(mode==='original')await page.screenshot({path:'/private/tmp/shiba-idle.png'});
   // Reveal/skip finishes articulation without advancing to the next line.
   await page.evaluate(()=>{barGame.dialogue.chars=1;lunaCampaign.render(true);});
   await expectPose('char_shiba_talk');
   await page.evaluate(()=>{barGame.advance();lunaCampaign.render(true);});
   assert.deepEqual(await expectPose('char_shiba_static'),typing);
   // A different speaker must not open Shiba's mouth.
   await page.evaluate(()=>{barGame.dialogue.actor='chris';barGame.dialogue.chars=1;lunaCampaign.render(true);});
   await expectPose('char_shiba_static');
  }
  assert.deepEqual(errors,[]);
  console.log('SHIBA_TALK_UI_OK: supplied pixels and bounds preserved; typing, completion, reveal and other speaker in original/GPT/campaign; no position or size jump');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
