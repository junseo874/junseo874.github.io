const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{lunaCampaign.screen('developer');barGame.reset(0,'full',3,true,{variant:'original'});barGame.lang='ko';});
  await page.waitForFunction(()=>barGame.dialogue&&!barGame.cameraMoving&&!barGame.transition);
  await page.evaluate(()=>{barGame.dialogue.chars=1e5;barGame.changed();});
  const actual=await page.locator('.dialogue-text .text-ink').innerText();
  assert.equal(actual,'...그럼 이제 한번 시작해 볼까?');
  assert.deepEqual([...actual.slice(0,3)].map(c=>c.codePointAt(0)),[46,46,46]);
  const metrics=await page.locator('.dialogue-text').evaluate(async el=>{
   const style=getComputedStyle(el);await document.fonts.load(style.font,'...그럼');
   const c=document.createElement('canvas').getContext('2d');c.font=style.font;
   const dots=c.measureText('...'),hangul=c.measureText('그');
   return {family:style.fontFamily,spacing:style.letterSpacing,dotTop:dots.actualBoundingBoxAscent,dotBottom:dots.actualBoundingBoxDescent,letterTop:hangul.actualBoundingBoxAscent};
  });
  assert(metrics.family.includes('LunaPixel'));
  assert(['normal','0px'].includes(metrics.spacing));
  assert(metrics.dotTop<metrics.letterTop*.35,'Dots are near the baseline, not mid-height: '+JSON.stringify(metrics));
  assert(Math.abs(metrics.dotBottom)<1,'Original periods sit on the baseline');
  await page.screenshot({path:'/private/tmp/luna-dialogue-periods-chris.png'});
  assert.deepEqual(errors,[]);
  console.log('DIALOGUE_PERIODS_UI_OK actual Chris dialogue uses three original baseline periods, native spacing, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
