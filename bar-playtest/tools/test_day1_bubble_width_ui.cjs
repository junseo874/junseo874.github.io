const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1650,height:1002}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'in',place:'homeDoor'});await outsidePlaytest.start();});
  await page.waitForFunction(()=>!outsidePlaytest.loading);
  await page.evaluate(async()=>{
   await document.fonts.ready;
   const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();m.x=LunaResidence.layout.homeX+.2;
   LunaOutsideThug.start(m);m.encounter.stage='active';m.encounter.hurt=true;m.tick=()=>{};
   window.bubbleStep=o.tick;o.tick=()=>{};
   for(let i=0;i<160;i++)bubbleStep(.05);
   m.story.beginRows(LunaOutsideThug.id,m.encounter.target,LunaOutsideThug.refused);m.story.speech.index=5;m.story.seek();m.story.speech.elapsed=99;o.refreshHUD();
  });
  const bubble=page.locator('.outside-speech');
  assert((await bubble.innerText()).includes('몸이 왜 이렇게 단단해'));
  await page.screenshot({path:'/private/tmp/day1-thug-bubble-fixed.png'});
  const inspect=()=>bubble.evaluate(el=>{
   const b=el.getBoundingClientRect(),cs=getComputedStyle(el),scale=b.width/parseFloat(cs.width),lines=[];
   for(const span of el.querySelectorAll('.outside-speech-text>span')){
    if(!span.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(span);
    for(const r of range.getClientRects()){let line=lines.find(l=>Math.abs(l.top-r.top)<scale);if(!line){line={left:r.left,right:r.right,top:r.top};lines.push(line);}else{line.left=Math.min(line.left,r.left);line.right=Math.max(line.right,r.right);}}
   }
   const longest=lines.reduce((a,b)=>a.right-a.left>b.right-b.left?a:b),padding=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
   return {width:parseFloat(cs.width),height:el.offsetHeight,lines:lines.length,unused:(b.width-(longest.right-longest.left))/scale-padding,left:(longest.left-b.left)/scale,right:(b.right-longest.right)/scale,positions:lines.map(l=>[(l.left-b.left)/scale,(l.top-b.top)/scale])};
  });
  const target=await inspect();assert(target.width<420);assert(target.unused>=-.1&&target.unused<=2,JSON.stringify(target));
  assert(target.left>=28&&target.left<=30);assert(target.right>=34&&target.right<=36);
  console.log('Exact reported line',target);
  const rows=await page.evaluate(()=>[...LunaOutsideThug.intro,...LunaOutsideThug.paid,...LunaOutsideThug.refused].filter(r=>r.type==='say'));
  let cases=0;
  for(const width of [960,1280,1650]){
   await page.setViewportSize({width,height:Math.round(width*9/16)});
   for(const row of rows){
    await page.evaluate(row=>{const o=outsidePlaytest,m=o.model;m.story.beginRows('padding-'+row.text,m.encounter.target,[row]);m.story.speech.elapsed=0;o.refreshHUD();},row);
    const before=await inspect();
    for(const elapsed of [.03,.2,99]){
     await page.evaluate(elapsed=>{outsidePlaytest.model.story.speech.elapsed=elapsed;outsidePlaytest.refreshHUD();},elapsed);
     const after=await inspect();for(const key of ['width','height','lines'])assert.equal(after[key],before[key],'Typing must preserve '+key+': '+row.text);
     for(let i=0;i<before.positions.length;i++)for(let axis=0;axis<2;axis++)assert(Math.abs(after.positions[i][axis]-before.positions[i][axis])<.02,'Typing must not shift a line: '+row.text);
    }
    if(before.width>111)assert(before.unused>=-.1&&before.unused<=2,JSON.stringify({text:row.text,...before}));
    cases++;
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS real day-1 event, actual ink margins and stable typing:',cases,'line/viewport cases');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
