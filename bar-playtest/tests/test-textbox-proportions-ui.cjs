const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
const samples=['네.','오늘은 진토닉으로 부탁할게요.','첫 줄\n두 번째 줄','모서리와 꼬리는 원본 비율을 유지해야 합니다. 긴 대사가 여러 줄로 이어져도 테두리가 눌리거나 늘어나지 않아야 합니다. '.repeat(2)];
async function geometry(bubble,selector){return bubble.evaluate((el,selector)=>{
 const b=el.getBoundingClientRect(),scale=b.width/parseFloat(getComputedStyle(el).width);
 return [...el.querySelectorAll(selector)].map(p=>{const rect=p.getBoundingClientRect(),v=p.viewBox.baseVal;return {piece:p.classList[1],sx:rect.width/scale/v.width,sy:rect.height/scale/v.height,width:rect.width/scale,height:rect.height/scale};});
},selector);}
function isotropic(parts){for(const p of parts){assert(Math.abs(p.sx-1/3)<.001,JSON.stringify(p));assert(Math.abs(p.sy-1/3)<.001,JSON.stringify(p));}}
(async()=>{const browser=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true,args:['--mute-audio']});let count=0;try{
 for(const dpr of [1,2]){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{await document.fonts.ready;lunaCampaign.screen('developer');const g=barGame;g.reset(99,'practice',1);g.screen='bar';g.phase='regular';g.speed=0;g.dialogSpeed=.00001;g.seats={L:{actor:'port',state:'STORY'},M:null,R:null};});
  for(const [width,height]of [[1280,720],[960,720],[1920,1080]]){
   await page.setViewportSize({width,height});
   for(const actor of ['port','luna'])for(const text of samples){
    await page.evaluate(({actor,text})=>{const g=barGame;g.dialogue=g.makeLine(actor,text);g.dialogue.chars=0;g.changed();},{actor,text});
    const box=page.locator('.dialogue-box');await box.waitFor();await page.waitForTimeout(100);
    await page.waitForFunction(()=>!barGame.cameraMoving&&barGame.transition===0);
    const skin=box.locator('.bar-textbox-skin');assert.equal(await skin.count(),1);
    assert.equal(await skin.evaluate(el=>getComputedStyle(el).backgroundImage),'none','no whole-image stretching');
    isotropic(await geometry(box,'.bar-textbox-piece:is(.piece-1,.piece-3,.piece-7,.piece-9,.piece-11)'));
    const before=await box.boundingBox();await page.evaluate(()=>{barGame.dialogue.chars=999;barGame.changed();});await page.waitForTimeout(70);
    const after=await box.boundingBox();assert(Math.abs(before.width-after.width)<.1&&Math.abs(before.height-after.height)<.1,'stable full-line layout');
    if(dpr===1&&width===1280&&text===samples[0])await page.screenshot({path:'/private/tmp/bubble-bar-'+actor+'-after.png'});
    if(dpr===1&&width===1280&&actor==='luna'&&text===samples[3])await page.screenshot({path:'/private/tmp/bubble-bar-long-after.png'});
    count++;
   }
  }
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();const o=outsidePlaytest,m=o.model;window.textboxTick=o.tick;o.tick=()=>{};m.story.cancel();m.backgroundStory.cancel();m.encounter=null;m.x=-3;m.y=-.7;o.snapCamera();textboxTick(0);});
  for(const [width,height]of [[1280,720],[960,720],[1920,1080]]){
   await page.setViewportSize({width,height});
   for(const text of samples){
    await page.evaluate(text=>{const o=outsidePlaytest,m=o.model;m.story.beginRows('proportions',{x:m.x,y:m.y},[{type:'say',actor:'luna',text}]);m.story.speech.elapsed=99;textboxTick(0);o.refreshHUD();},text);
    const box=page.locator('.outside-speech');await box.waitFor();
    isotropic(await geometry(box,'.textbox-piece:is(.piece-1,.piece-3,.piece-7,.piece-9,.piece-11)'));
    if(dpr===1&&width===1280)await page.screenshot({path:'/private/tmp/bubble-outside-'+(text===samples[0]?'short':'long')+'-after.png'});
    count++;
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('TEXTBOX_PROPORTIONS_OK',count,'bar guest/Luna and exterior cases, 3 viewports, DPR 1/2, fixed source corners/tails and stable typing');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
