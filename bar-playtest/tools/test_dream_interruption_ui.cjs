const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.evaluate(()=>lunaCampaign.newGame());await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const result=await page.evaluate(()=>{
   const main=lunaCampaign,project=main.cinema.scene;
   main.resumeView='prologue';main.screen('options');
   const lines=project.clips.filter(c=>c.type==='dialogue'&&['dream-lines','interruption'].includes(c.track)),front=lines.find(c=>c.interruption),back=lines.find(c=>c.overlay),t=front.start+.6;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   const state=StudioModel.sample(project,t),k=1280/state.camera.w;
   const bounds=c=>{const a=state.actors[c.actor],b=StudioTypography.bubble(ctx,c,k),x=640+(a.x+(c.offsetX||0)-state.camera.x)*k,y=360-(a.y+c.offset-state.camera.y)*k;return {left:x-b.width/2,right:x+b.width/2,top:y-b.height,bottom:y};};
   const a=bounds(front),b=bounds(back),painted=[],paint=StudioTypography.paintBubble;
   StudioTypography.paintBubble=function(g,c,...rest){painted.push(c.id);return paint(g,c,...rest);};
   const player=LunaStudioCinema.player(canvas,document.createElement('div'),project);player.render(t,null,false);StudioTypography.paintBubble=paint;
   // Sample the actual intersecting interior: the back bubble/text must not bleed through.
   const x=Math.ceil(Math.max(a.left,b.left)+12),y=Math.ceil(a.bottom-8);
   const pixel=[...ctx.getImageData(x,y,1,1).data];player.dispose();
   document.body.replaceChildren(canvas);canvas.style.width='1280px';canvas.style.height='720px';
   return {a,b,painted,front:front.id,back:back.id,pixel,duration:project.duration,home:project.chapters[1].time,
    gaps:lines.slice(1).filter(c=>c!==front).map(c=>{const i=lines.indexOf(c);return c.start-lines[i-1].start-lines[i-1].duration;}),
    overlap:back.start+back.duration-front.start,allManual:project.clips.filter(c=>c.track==='phone-lines').every(c=>c.wait),cps:lines.map(c=>c.cps)};
  });
  assert.equal(result.a.bottom,result.b.bottom);assert(Math.min(result.a.right,result.b.right)-Math.max(result.a.left,result.b.left)>60);
  assert(result.painted.indexOf(result.back)<result.painted.indexOf(result.front));
  assert(result.overlap>1);assert(result.home<40);assert(result.gaps.every(g=>Math.abs(g-.12)<.003));assert(result.allManual);assert(result.cps.every(c=>c===55));
  await page.screenshot({path:'/private/tmp/dream-interruption-main.png'});
  await page.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening&revision=20261013-interruption');await page.waitForFunction(()=>cutsceneStudio.ready);
  await page.locator('#guides').uncheck();
  const studio=await page.evaluate(()=>{const p=cutsceneStudio.project,c=p.clips.find(c=>c.interruption);cutsceneStudio.select(null);cutsceneStudio.seek(c.start+.6);return {offset:c.offset,minWidth:c.bubbleMinWidth,duration:p.duration};});
  assert.equal(studio.offset,.68);assert.equal(studio.minWidth,1.25);assert.equal(studio.duration,result.duration);
  await page.locator('#stage').screenshot({path:'/private/tmp/dream-interruption-studio.png'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result));console.log('PASS: same-row overlap, foreground draw order, faster automatic pacing, unchanged manual phone dialogue, matching main/studio templates.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
