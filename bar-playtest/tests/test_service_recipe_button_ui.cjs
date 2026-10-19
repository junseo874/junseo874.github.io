const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await page.waitForFunction(()=>resourceReview.ready);
  await page.evaluate(()=>resourceReview.launch({type:'review-bar-tutorial',id:'recipe'},'서비스 패널',''));
  const frame=page.frames().find(f=>f.url().includes('resourceReview=1')),button=frame.locator('.service-actions [data-act="recipes"]');
  await button.waitFor();await page.waitForTimeout(350);
  for(const [width,height] of [[1280,720],[900,700],[1920,1080]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   for(const mode of ['idle','focus','hover']){
    if(mode==='idle'){await button.evaluate(e=>e.blur());await page.mouse.move(0,0);}
    if(mode==='focus')await button.focus();
    if(mode==='hover')await button.hover();
    const style=await button.evaluate(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect(),ring=document.querySelector('[data-guide-ring="source"]'),r=ring.getBoundingClientRect();return {size:s.backgroundSize,position:s.backgroundPosition,repeat:s.backgroundRepeat,border:s.borderWidth,image:s.backgroundImage,height:e.offsetHeight,inRing:b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom};});
    assert.equal(style.size,'100% 100%');assert.equal(style.position,'50% 50%');assert.equal(style.repeat,'no-repeat');assert.equal(style.border,'0px');assert.equal(style.height,55);assert(style.image.includes('BTN_service_B.png'));assert(style.inRing);
   }
  }
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);
  await page.locator('#game').screenshot({path:'/private/tmp/service-recipe-fixed.png'});
  // The resource preview paints the panel without the gameplay prerequisites.
  await frame.evaluate(()=>{barGame.tutorial.serviceOpened=true;barGame.drink=null;barGame.phase='practice';});
  await button.click();await frame.waitForFunction(()=>barGame.screen==='recipe');
  assert.deepEqual(errors,[]);console.log('SERVICE_RECIPE_BUTTON_OK: fitted artwork, stable bounds, idle/focus/hover, responsive, recipe opens');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
