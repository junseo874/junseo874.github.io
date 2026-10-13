const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.evaluate(()=>lunaCampaign.newGame('A'));
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const hint=page.locator('.campaign-skip');
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
  // Holding for three seconds still skips only the dream, not waking/contact.
  await page.keyboard.down('Space');
  await page.evaluate(()=>{lunaCampaign.cinemaHoldStart=performance.now()-3010;lunaCampaign.tick(.01);});
  await page.keyboard.up('Space');
  assert(await page.evaluate(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.canSkipCinema()&&lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil));
  assert(await hint.isHidden());
  // Version B retains its old size and five-second hint after releasing Space.
  await page.evaluate(()=>{const c=lunaCampaign;c.storyVersion='B';c.cinema.time=0;c.cinemaHoldStart=performance.now();c.releaseCinemaSkip();c.paintCinemaSkip();});
  assert.equal(await hint.evaluate(el=>getComputedStyle(el).fontSize),'12px');
  assert(await page.evaluate(()=>lunaCampaign.cinemaHintUntil-performance.now()>4500));
  assert.deepEqual(errors,[]);console.log('PASS: A hint 2s / 11px / hidden after release, hold progress and 3s dream-only skip intact; B unchanged.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
