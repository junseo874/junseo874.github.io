const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.evaluate(()=>lunaCampaign.newGame('A'));
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const hint=page.locator('.campaign-skip');
  assert.equal(await hint.locator('span').textContent(),'스페이스 바를 눌러 스킵');
  assert.match(await hint.getAttribute('aria-label'),/1\.5초/);
  assert(await hint.evaluate(el=>el.classList.contains('is-visible')));
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).fontSize),'11px');
  const remaining=await page.evaluate(()=>lunaCampaign.cinemaHintUntil-performance.now());assert(remaining>0&&remaining<=2000);
  await page.waitForTimeout(2400);
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).opacity),'0');
  await page.keyboard.down('Space');await page.waitForTimeout(350);
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).opacity),'1');
  assert(+(await hint.locator('[role="progressbar"]').getAttribute('aria-valuenow'))>0);
  await page.keyboard.up('Space');await page.waitForTimeout(350);
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).opacity),'0');
  // The 1.5-second threshold still skips only the dream, not waking/contact.
  await page.keyboard.down('Space');
  assert(await page.evaluate(()=>{const c=lunaCampaign;c.cinemaHoldStart=performance.now()-1450;c.tick(.01);const before=c.canSkipCinema()&&c.cinema.time<c.cinema.skipUntil;c.cinemaHoldStart=performance.now()-1510;c.tick(.01);return before;}));
  await page.keyboard.up('Space');
  assert(await page.evaluate(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.canSkipCinema()&&lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil));
  assert(await hint.isHidden());




  assert.deepEqual(errors,[]);console.log('PASS: exact skip label, hint 2s / 11px, release reset, 1.5s threshold, dream-only skip with contact protected.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
