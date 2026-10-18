const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8123/bar-playtest/');
  await page.locator('[data-campaign="developer"]').click();
  const updates=page.locator('.updates-confirm');if(await updates.isVisible())await updates.click();
  await page.evaluate(()=>outsidePlaytest.start());await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.paused=false;m.time=2.5;outsidePlaytest.tick(0);});
  await page.screenshot({path:'/private/tmp/luna-rain-preview.png'});
  // Reproduce the supplied shop view. Freeze only rain time so a full splash
  // is visible, then compare fixed-world impacts across several street areas.
  for(const x of [-2.87,1,-18]){
   const result=await page.evaluate(x=>{
    const o=outsidePlaytest,m=o.model;m.start({day:0,flow:'out',place:'bar'});m.x=x;m.time=2.5;o.snapCamera();
    const sp=LUNA_OUTSIDE_DATA.animations.idle.frames[0],foot=m.y-sp.h/sp.ppu*sp.pivot.y;
    const field=LunaOutsideRain.particles(m,o.camera);
    return {count:field.splashes.length,below:field.splashes.every(s=>s.y+.018<foot)};
   },x);assert(result.count>0&&result.below,'Road impacts below feet at '+x);
  }
  await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.x=-2.87;m.paused=false;m.time=2.5;window.rainPreviewTick=m.tick;m.tick=()=>{};o.snapCamera();o.tick(0);});
  await page.screenshot({path:'/private/tmp/luna-rain-ground-shop.png'});
  await page.evaluate(()=>{outsidePlaytest.model.tick=window.rainPreviewTick;delete window.rainPreviewTick;});
  for(const [day,flow,expected] of [[0,'out',true],[0,'in',false],[1,'out',true],[1,'in',false],[2,'in',true],[2,'out',false],[3,'out',false]]){
   const result=await page.evaluate(({day,flow})=>{const o=outsidePlaytest;o.openDev();o.devAction('dev-day-'+day);o.devAction('dev-flow-'+flow);o.devAction('dev-close');return LunaOutsideRain.enabled(o.model);},{day,flow});
   assert.equal(result,expected,day+'/'+flow);
  }
  await page.evaluate(()=>{const o=outsidePlaytest;o.openDev();o.devAction('dev-day-0');o.devAction('dev-flow-out');o.devAction('dev-home');o.devAction('dev-close');});
  assert.equal(await page.evaluate(()=>LunaOutsideRain.enabled(outsidePlaytest.model)),false);
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.start({day:1,flow:'out',place:'bar'});m.x=-8.78;m.time=3;m.paused=false;outsidePlaytest.snapCamera();});
  await page.keyboard.press('KeyY');await page.waitForTimeout(1500);
  await page.screenshot({path:'/private/tmp/luna-rain-panorama.png'});
  assert(await page.evaluate(()=>outsidePlaytest.camera.w>10.2&&outsidePlaytest.camera.w<=10.41));
  assert.deepEqual(errors,[]);
  console.log('PASS browser: rain rendering, P console day/route switches, indoor exclusion, panoramic zoom, no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
