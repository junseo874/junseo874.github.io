const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const card=p.locator('.outside-item-notice');
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.x=-2.87;m.updateNear();o.snapCamera();o.notifyItem(m,'wild_dog');o.notifyItem(m,'bitters');});
  await p.waitForTimeout(350);
  assert.equal(await card.locator('strong').innerText(),'신규 재료 와일드 독 추가!');
  assert.equal(await card.locator('small').innerText(),'재료 획득');
  assert(await card.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0));
  const rect=await card.boundingBox();assert(rect.x>=19&&rect.x<=21&&rect.y===17&&rect.width===270&&rect.height<=100,JSON.stringify(rect));
  const style=await card.evaluate(el=>{const s=getComputedStyle(el);return {border:s.borderLeftWidth,color:s.borderLeftColor,background:s.backgroundImage,pointer:s.pointerEvents,overflow:el.scrollWidth>el.clientWidth};});
  assert.equal(style.border,'3px');assert.equal(style.color,'rgb(141, 229, 223)');assert(style.background.includes('linear-gradient'));assert.equal(style.pointer,'none');assert(!style.overflow);
  await p.screenshot({path:'/private/tmp/item-notice-profile-style.png'});
  await p.waitForFunction(()=>document.querySelector('.outside-item-notice').dataset.item==='bitters');
  assert.equal(await card.locator('strong').innerText(),'신규 재료 비터스 추가!');assert.equal(await card.count(),1);
  await p.waitForTimeout(2900);assert(await card.isHidden());
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.evaluate(()=>outsidePlaytest.notifyItem(outsidePlaytest.model,'sugar_cube'));
  await p.waitForTimeout(300);assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'none');
  assert((await card.locator('strong').innerText()).startsWith('신규 재료 '));
  await p.setViewportSize({width:600,height:400});await p.waitForTimeout(100);
  const small=await card.boundingBox();assert(small.x>=0&&small.x+small.width<=600);
  await p.evaluate(()=>outsidePlaytest.exit(true));assert.equal(await card.count(),0);
  assert.deepEqual(errors,[]);console.log('PASS shared profile theme, requested ingredient copy, preview, upper-left compact layout, FIFO/expiry, reduced motion, small viewport and cleanup');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
