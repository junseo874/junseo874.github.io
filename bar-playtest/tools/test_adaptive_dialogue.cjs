const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/');
 await p.evaluate(()=>document.fonts.ready);
 const set=async(text,actor='port',pair=false)=>{await p.evaluate(({text,actor,pair})=>{const g=barGame;g.screen='bar';g.phase='regular';g.dialogSpeed=.00001;g.seats={L:{actor:'port',state:'STORY'},M:null,R:pair?{actor:'aili',state:'STORY'}:null};g.dialogue=g.makeLine(actor,text);},{text,actor,pair});await p.waitForFunction(()=>!barGame.cameraMoving&&barGame.transition===0&&document.querySelector('.dialogue-wrap'));await p.waitForTimeout(120);};
 const box=()=>p.locator('.dialogue-wrap').boundingBox();
 for(const variant of ['original','gpt']){
  await p.evaluate(variant=>barGame.reset(99,'practice',1,true,{variant}),variant);
  await set('네.');assert.equal((await box()).width,269);
  await set('오늘은 진토닉으로 부탁할게요.');const middle=await box();assert(middle.width>269&&middle.width<618.7,JSON.stringify(middle));
  await set('오늘 밤에도 좋은 이야기를 들려주세요. '.repeat(5));const initial=await box();assert(Math.abs(initial.width-618.7)<.1);assert(initial.height>124);
  for(const chars of [1,15,999]){await p.evaluate(chars=>barGame.dialogue.chars=Math.min(chars,barGame.dialogue.text.length),chars);await p.waitForTimeout(120);assert.deepEqual(await box(),initial,'Typing must not resize the full-line box');}
  await p.screenshot({path:'/private/tmp/dialogue-adaptive-long-'+variant+'.png'});
  await set('네.','luna');assert.equal((await box()).width,269);assert(Math.abs((await box()).x+134.5-640)<1);
  for(const actor of ['port','aili']){
   await set('두 사람이 등장해도 각자의 자리 아래에서 긴 대사가 자연스럽게 줄바꿈됩니다. '.repeat(2),actor,true);
   const r=await box();assert(Math.abs(r.width-520)<.1);assert(Math.abs(r.x+r.width/2-(actor==='port'?370:910))<1);
   await p.evaluate(()=>barGame.dialogue.chars=barGame.dialogue.text.length);await p.waitForTimeout(120);
   await p.screenshot({path:'/private/tmp/dialogue-adaptive-pair-'+actor+'.png'});
  }
  await set('SUPERCALIFRAGILISTIC'.repeat(12));assert((await box()).width<619);
  assert(await p.locator('.text-measure').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Unbroken text must wrap');
  await set('첫 줄\n짧은 줄');const multiline=await box();assert.equal(multiline.width,269);assert(multiline.height>124);
  for(const [width,height] of [[1920,1080],[820,650],[600,800],[1280,720]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(120);
   assert(await p.locator('.dialogue-wrap').evaluate(e=>{const b=e.getBoundingClientRect(),s=document.querySelector('.app-shell').getBoundingClientRect();return b.left>=s.left&&b.right<=s.right&&b.top>=s.top&&b.bottom<=s.bottom;}));
  }
 }
 assert.deepEqual(errors,[]);console.log('ADAPTIVE_DIALOGUE_OK: min/max, typing stability, pair anchors, Luna, wrapping, both variants and viewport scaling');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
