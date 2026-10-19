const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();});
  await page.waitForFunction(()=>!outsidePlaytest.loading);
  await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.stepTextbox=o.tick;o.tick=()=>{};m.story.cancel();m.backgroundStory.cancel();m.x=-3;m.y=-.7;o.snapCamera();stepTextbox(0);});
  const bubble=page.locator('.outside-speech'),cue=bubble.locator('.dialogue-advance-cue');
  for(const [name,text]of [['tiny','응.'],['short','오늘도 수고했어.'],['preview-one','테스트 텍스트 가나다라 한줄은 이렇게'],['preview-two','테스트 텍스트 가나다라마바사 아자차카 타파하 !?\n두줄도 가능합니다 가능하면 가운데 정렬 기본으로~'],['beggar','고마워! 사람 보는 눈이 있네. 내가 이 은혜는 꼭 갚을게.'],['two-lines','오늘은 바람이 꽤 차네.\n잠깐 쉬었다가 집으로 돌아가자.'],['long','오래된 간판 아래에서 누군가 이야기를 나누고 있다. 새로운 말풍선은 긴 대사에서도 테두리와 모서리가 찌그러지지 않고, 읽기 편하게 여러 줄로 이어져야 한다.']]){
   await page.evaluate(text=>{const o=outsidePlaytest,m=o.model;m.story.beginRows('skin-'+text,{x:m.x,y:m.y},[{type:'say',actor:'luna',text},{type:'say',actor:'luna',text:'다음 대사입니다.'}],false);o.refreshHUD();},text);
   assert(await cue.isHidden());assert.equal(await bubble.locator('.textbox-piece').count(),11);
   const before=await bubble.boundingBox();await page.keyboard.press('KeyE');assert(await cue.isVisible());
   assert.deepEqual(await bubble.boundingBox(),before,'Typing must not resize the bubble');
   const spacing=await bubble.evaluate(el=>{const s=getComputedStyle(el),p=el.querySelector('p'),ps=getComputedStyle(p);return {padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],font:ps.fontSize,line:parseFloat(ps.lineHeight),height:el.offsetHeight,width:el.offsetWidth,fits:p.scrollWidth<=p.clientWidth};});
   assert.deepEqual(spacing.padding,['14px','34px','14px','28px']);assert.equal(spacing.font,'17px');assert(Math.abs(spacing.line-24.65)<.1);assert(spacing.fits);
   if(name==='short'||name==='tiny')assert(spacing.height<=54,'Compact single-line height');
   if(name==='two-lines')assert(spacing.height<=79,'Compact two-line height');
   const layout=await bubble.evaluate(el=>{const b=el.getBoundingClientRect(),p=el.querySelector('p').getBoundingClientRect(),c=el.querySelector('.dialogue-advance-cue').getBoundingClientRect(),tail=el.querySelector('.piece-9').getBoundingClientRect();return {align:getComputedStyle(el.querySelector('p')).textAlign,background:getComputedStyle(el).backgroundColor,arrow:getComputedStyle(el.querySelector('.dialogue-advance-cue')).backgroundImage,animation:getComputedStyle(el.querySelector('.dialogue-advance-cue')).animationName,inside:c.left>=p.right&&c.right<=b.right&&c.top>=b.top&&c.bottom<=b.bottom,center:Math.abs((tail.left+tail.right-b.left-b.right)/2),extension:tail.bottom-b.bottom};});
   assert.equal(layout.align,'center');assert.equal(layout.background,'rgba(0, 0, 0, 0)');assert(layout.arrow.includes('IMG_textbox_arrow.png'));assert.equal(layout.animation,'exterior-textbox-arrow-bob');assert(layout.inside,'Arrow must not overlap text');assert(layout.center<1);assert(layout.extension>15&&layout.extension<24);
   await page.waitForTimeout(180);await page.screenshot({path:'/private/tmp/exterior-textbox-'+name+'.png'});
   if(name==='tiny'){
    // Check rendered ink, not just tile dimensions: severe downsampling used
    // to erase the straight edges while corners and the tail remained intact.
    const probes=await bubble.evaluate(el=>[2,4,6,8,10].map(id=>{
     const r=el.querySelector('.piece-'+id).getBoundingClientRect();
     return {id,x:[4,6].includes(id)?(id===4?r.left:r.right-3):r.left+r.width/2-1,
      y:[4,6].includes(id)?r.top+r.height/2-1:(id===2?r.top:r.bottom-3),
      w:[4,6].includes(id)?3:2,h:[4,6].includes(id)?2:3};
    }));
    const sharp=require('../../tools/lib/test-runtime.cjs').load('sharp');
    const {data,info}=await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
    for(const p of probes){let visible=false;
     for(let y=Math.floor(p.y);y<=Math.ceil(p.y+p.h);y++)for(let x=Math.floor(p.x);x<=Math.ceil(p.x+p.w);x++){
      const k=(y*info.width+x)*info.channels,r=data[k],g=data[k+1],b=data[k+2];
      if(g>85&&b>100&&r<b*.8)visible=true;
     }
     assert(visible,'Short bubble retains cyan border on tile '+p.id);
    }
   }
   await bubble.click();assert(await cue.isHidden(),'Click still advances and hides cue for new typing');
  }
  // Ambient speech shares the art, never the manual progression cue.
  await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();m.backgroundStory.beginRows('skin-ambient',{x:m.x,y:m.y},[{type:'say',actor:'luna',text:'밤공기가 차갑네.\n따뜻한 거라도 마실까?'}],true);m.backgroundStory.speech.elapsed=.6;o.refreshHUD();});
  assert.equal(await page.locator('.outside-background-speech:not([hidden]) .textbox-piece').count(),11);
  assert(await page.locator('.outside-background-speech .dialogue-advance-cue').isHidden());
  await page.screenshot({path:'/private/tmp/exterior-textbox-ambient.png'});
  // Choice layout and affordability remain functional with the new skin.
  await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.config.day=0;m.backgroundStory.cancel();barGame.progress.money=100;LunaOutsideBeggar.interact(m,{id:'street-beggar',x:-7.30,y:-.94});for(let i=0;i<20&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}m.x=-7.30;o.snapCamera();stepTextbox(0);o.refreshHUD();});
  assert.equal(await bubble.locator('.outside-choices').count(),0);
  assert(await page.locator('.world-choices').isVisible());assert(await cue.isHidden());
  assert(await page.locator('[data-choice="beggar-pay"]').isDisabled());
  await page.screenshot({path:'/private/tmp/exterior-textbox-choice.png'});
  await page.locator('[data-choice="beggar-refuse"]').click();
  await page.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;outsidePlaytest.refreshHUD();});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await cue.evaluate(e=>getComputedStyle(e).animationName),'none');
  for(const width of [640,1920]){await page.setViewportSize({width,height:width*9/16});await page.waitForTimeout(100);const b=await bubble.boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0);await page.screenshot({path:'/private/tmp/exterior-textbox-'+width+'.png'});}
  // Ship the originals, including the artist's preview; do not bake test text into live UI.
  const originals=process.env.EXTERIOR_TEXTBOX_ORIGINALS||'/Users/lee/Desktop/exterior_textbox';
  const names=[...Array.from({length:11},(_,i)=>'GRD_textbox_'+(i+1)+'.png'),'GRD_textbox.png','IMG_textbox_arrow.png'];
  for(const name of names){const bytes=fs.readFileSync(path.join(__dirname,'../assets/ui/exterior-textbox',name));assert.equal(bytes.subarray(1,4).toString(),'PNG');if(fs.existsSync(originals))assert(fs.readFileSync(path.join(originals,name)).equals(bytes));}
  if(!fs.existsSync(originals))console.log('SKIP source-byte comparison: original export folder unavailable; packaged PNGs verified.');
  assert.deepEqual(errors,[]);console.log('PASS packaged 11-piece art, centered short/long/ambient bubbles, detached choices, stable typing, next-line controls, inset arrow, reduced motion, viewport scaling');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
