const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1920,height:1080}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview?.ready);
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  await p.click('[data-group="common-popups"]');await p.click('[data-id="popup:goal"]');
  await p.selectOption('#lab-state','bar-complete');
  await f.waitForFunction(()=>document.querySelector('.story-notice-event')?.dataset.kind==='goal-complete');
  await p.click('#lab-fullscreen');
  await p.waitForFunction(()=>document.fullscreenElement===document.querySelector('.frame-wrap'));
  await p.waitForTimeout(450);
  assert(await p.locator('#fullscreen-exit').isVisible());assert(!await p.locator('#popup-rail').isVisible());
  assert.deepEqual(await f.evaluate(()=>[innerWidth,innerHeight]),await p.evaluate(()=>[innerWidth,innerHeight]));
  const size=await f.locator('.story-notice-event').evaluate(el=>{const r=el.getBoundingClientRect();return{w:r.width,right:r.right,bottom:r.bottom,font:getComputedStyle(el.querySelector('strong')).fontSize};});
  assert.equal(size.w,350);assert.equal(size.font,'19px');assert(size.right<=1920&&size.bottom<=1080);
  await p.screenshot({path:'/private/tmp/popup-fullscreen-goal.png'});
  await p.click('#fullscreen-replay');await f.waitForFunction(()=>LunaStoryNotices.pending.some(e=>e.kind==='goal-complete'));
  // Escape inside the embedded game exits the preview, not into game settings.
  await f.locator('body').click({position:{x:4,y:4}});await p.keyboard.press('Escape');
  await p.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('#lab').classList.contains('review-fullscreen'));
  assert.equal(await f.evaluate(()=>barGame.overlay),null);
  // A denied/unavailable native API still fills the embedded browser viewport.
  await p.evaluate(()=>document.querySelector('.frame-wrap').requestFullscreen=()=>Promise.reject(Error('Embedded browser')));
  await p.click('#lab-fullscreen');await p.waitForTimeout(450);
  assert.deepEqual(await f.evaluate(()=>[innerWidth,innerHeight]),[1920,1080]);
  await p.click('#fullscreen-exit');assert(await p.locator('#popup-rail').isVisible());
  await p.click('[data-popup="ui:exterior:purchase"]');await f.locator('.outside-item-notice').waitFor({state:'visible'});
  await p.click('#lab-fullscreen');await p.waitForTimeout(600);
  const item=await f.locator('.outside-item-notice').boundingBox();assert.equal(await f.locator('.outside-item-notice').evaluate(el=>getComputedStyle(el).width),'350px');assert(item.x>=0&&item.x+item.width<=1920);
  await p.screenshot({path:'/private/tmp/popup-fullscreen-material.png'});
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#lab').classList.contains('parked')&&!document.querySelector('#lab').classList.contains('review-fullscreen'));
  await p.goForward();await p.waitForFunction(()=>!document.querySelector('#lab').classList.contains('parked'));
  assert(await p.locator('#lab-fullscreen').isVisible());
  await p.click('[data-popup="popup:goal"]');await p.setViewportSize({width:390,height:844});
  await p.click('#lab-fullscreen');await p.waitForTimeout(500);
  const mobile=await f.locator('.story-notice-event').boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=390);
  assert(await p.locator('#fullscreen-exit').isVisible());await p.screenshot({path:'/private/tmp/popup-fullscreen-mobile.png'});
  await p.click('#fullscreen-exit');
  assert.deepEqual(errors,[]);console.log('PASS: native fullscreen, embedded fallback, replay, iframe Escape, history cleanup, enlarged notices and narrow viewport');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
