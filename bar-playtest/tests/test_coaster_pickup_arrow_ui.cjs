const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await page.waitForFunction(()=>resourceReview.ready);
 await page.evaluate(()=>resourceReview.launch({type:'review-serving',id:'coaster'},'코스터 제공',''));
 const frame=page.frames().find(f=>f.url().includes('resourceReview=1')),popup=frame.locator('[data-drag="coaster"]'),arrow=frame.locator('.coaster-pickup-arrow');
 await frame.addStyleTag({content:'.qa-launch{display:none!important}'});
 await arrow.waitFor();assert.equal(await arrow.count(),1);
 for(const [width,height] of [[1280,720],[960,540],[1920,1080]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  const layout=await arrow.evaluate(e=>{const a=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect(),im=e.parentElement.querySelector('img').getBoundingClientRect(),s=getComputedStyle(e);return {above:a.bottom<p.top,center:Math.abs(a.left+a.width/2-im.left-im.width/2),inside:a.left>=0&&a.top>=0&&a.right<=innerWidth,events:s.pointerEvents,animation:s.animationName};});
  assert(layout.above&&layout.inside&&layout.center<1);assert.equal(layout.events,'none');assert.equal(layout.animation,'coaster-pickup-nudge');
 }
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);await page.locator('#game').screenshot({path:'/private/tmp/coaster-pickup-arrow.png'});
 const first=await arrow.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(350);assert.notEqual(await arrow.evaluate(e=>getComputedStyle(e).transform),first);
 async function grab(){const p=await popup.boundingBox();await page.mouse.move(p.x+p.width/2,p.y+p.height/2);await page.mouse.down();await arrow.waitFor({state:'detached'});}
 await grab();await page.mouse.move(100,150);await page.mouse.up();await arrow.waitFor();assert(await frame.evaluate(()=>barGame.storyCoasterReady()));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await arrow.evaluate(e=>getComputedStyle(e).animationName),'none');
 await grab();const target=await frame.locator('[data-drop="R"]').boundingBox();await page.mouse.move(target.x+target.width/2,target.y+target.height*.8,{steps:5});await page.mouse.up();
 await frame.waitForFunction(()=>barGame.seats.R.coaster&&!barGame.storyCoaster);assert.equal(await arrow.count(),0);
 await page.evaluate(()=>resourceReview.launch({type:'review-serving',id:'drink'},'칵테일 제공',''));assert.equal(await arrow.count(),0);
 assert.deepEqual(errors,[]);console.log('COASTER_PICKUP_ARROW_OK: regular-ready only, aligned animated arrow, responsive/reduced-motion, hidden on drag, restored on invalid drop, removed after serving');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
