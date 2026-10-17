const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(()=>lunaCampaign.newGame());
  await page.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait);
  const hint=page.locator('.campaign-skip');
  assert.match(await hint.getAttribute('aria-label'),/2초/);
  assert(await hint.isHidden(),'Opening dialogue remains unskippable');
  // Loaded scene used as a skippable documentary fixture with manual dialogue.
  await page.evaluate(()=>{const c=lunaCampaign;c.cinema.skipUntil=c.cinema.scene.end-1;c.cinema.scene.template='documentary';c.paintCinemaSkip();});
  const visible=()=>hint.evaluate(el=>el.classList.contains('is-visible'));
  assert.equal(await visible(),false,'No unsolicited skip overlay');
  await page.keyboard.down('Space');
  assert.equal(await visible(),false,'Dialogue tap does not flash the overlay');
  await page.keyboard.up('Space');assert.equal(await visible(),false);
  const sample=ms=>page.evaluate(ms=>{const c=lunaCampaign;c.cinemaHoldStart=performance.now()-ms;const complete=c.paintCinemaSkip(),el=c.host.querySelector('.campaign-skip');return {complete,visible:el.classList.contains('is-visible'),progress:Number(el.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))};},ms);
  assert.deepEqual(await sample(250),{complete:false,visible:false,progress:0});
  const active=await sample(350);assert(active.visible&&active.progress>0&&!active.complete);
  assert.equal((await sample(1150)).progress,50);
  assert.equal((await sample(1950)).complete,false);
  assert.equal((await sample(2010)).complete,true);
  await page.keyboard.up('Space');
  assert.equal(await visible(),false);
  assert.equal(await hint.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'0');
  await page.keyboard.down('Space');assert.equal(await visible(),false);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(()=>lunaCampaign.cinemaHoldStart),null);
  await page.keyboard.up('Space');
  await page.evaluate(()=>{const c=lunaCampaign;c.screen('prologue');c.cinema.dialogueWait=null;c.cinemaHoldStart=performance.now()-2010;c.tick(.01);});
  assert(await page.evaluate(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.canSkipCinema()&&lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil));
  assert(await hint.isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS: 300 ms silent activation, 2 s total hold, tap/release/focus reset, protected cutscene boundary.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
