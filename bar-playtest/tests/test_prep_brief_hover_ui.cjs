const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  const brief=page.locator('.prep-recipe-brief'),list=page.locator('.prep-brief-reveal');
  for(const variant of ['original','gpt'])for(const id of ['gin_tonic','long_island','bottle_beer']){
   await page.mouse.move(1200,10);
   await page.evaluate(({variant,id})=>{const g=barGame;g.reset(99,'practice',1,true,{variant});g.selectCocktail(id);},{variant,id});
   await brief.waitFor();await brief.evaluate(e=>e.blur());await page.waitForTimeout(300);
   const closed=await brief.evaluate(e=>e.offsetHeight);assert(closed<65);assert.equal(await list.evaluate(e=>getComputedStyle(e).visibility),'hidden');
   if(variant==='original'&&id==='gin_tonic')await page.screenshot({path:'/private/tmp/prep-brief-collapsed.png'});
   await brief.hover();await page.waitForTimeout(80);const midway=await brief.evaluate(e=>e.getBoundingClientRect().height);
   await page.waitForTimeout(300);const open=await brief.evaluate(e=>e.getBoundingClientRect().height);
   assert(open>closed+50);assert(midway>closed&&midway<=open);assert.equal(await list.evaluate(e=>getComputedStyle(e).visibility),'visible');
   assert(await page.locator('.prep-brief-row').count()>=3);
   assert.equal(await page.locator('.prep-brief-signal').first().evaluate(e=>getComputedStyle(e).animationIterationCount),'1');
   if(variant==='original'&&id==='gin_tonic')await page.screenshot({path:'/private/tmp/prep-brief-expanded.png'});
   // Moving onto the revealed rows must not close the panel.
   await page.locator('.prep-brief-row').last().hover();assert.equal(await list.evaluate(e=>getComputedStyle(e).visibility),'visible');
   await page.mouse.move(1200,10);await page.waitForTimeout(300);assert.equal(await brief.evaluate(e=>e.offsetHeight),closed);
   await brief.click();await page.locator('#prep-recipe-detail').waitFor();assert.equal(await brief.getAttribute('aria-expanded'),'true');
   await page.locator('#prep-recipe-detail [data-act="togglePrepRecipe"]').click();await page.locator('#prep-recipe-detail').waitFor({state:'detached'});
   await page.evaluate(()=>barGame.debugFill());await brief.hover();await page.waitForTimeout(300);
   assert(await page.locator('.prep-brief-row').evaluateAll(rows=>rows.every(e=>e.dataset.packed==='true'&&e.querySelector('.prep-brief-check').textContent==='✓')));
  }
  await page.mouse.move(1200,10);await brief.evaluate(e=>e.blur());await page.keyboard.press('Tab');await brief.focus();await page.waitForTimeout(300);
  assert.equal(await list.evaluate(e=>getComputedStyle(e).visibility),'visible');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await list.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');assert.equal(await page.locator('.prep-brief-signal').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  for(const size of [{width:960,height:540},{width:1920,height:1080}]){await page.setViewportSize(size);await brief.hover();await page.waitForTimeout(100);assert(await brief.evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));}
  assert.deepEqual(errors,[]);console.log('PREP_BRIEF_HOVER_OK: compact/reveal/collapse, one-shot glitch, checklist states, detail click, both variants, keyboard/reduced-motion/responsive');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
