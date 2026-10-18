const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await page.locator('.updates-close').count())await page.locator('.updates-close').click();
 for(const lang of ['ko','en'])for(const kind of ['open','pour','fill_up','shake','stir']){
  await page.evaluate(({kind,lang})=>{barGame.startMinigame(kind);barGame.lang=lang;barGame.changed();},{kind,lang});
  await page.locator('.craft-screen').waitFor();await page.waitForTimeout(100);
  assert.equal(await page.locator('.craft-screen [data-act="miniExit"], .gimmick-exit').count(),0,kind+' exit');
  assert(!/다른 기믹 선택|Other minigames/.test(await page.locator('.craft-screen').innerText()));
  if(['pour','fill_up'].includes(kind)){
   const spilled=await page.evaluate(()=>{const s=barGame.gimmick;barGame.holdPour(true);s.dragAngle=145;for(let i=0;i<1800;i++)s.fluid.tick(s,1/120);barGame.holdPour(false);barGame.changed();return s.fluid.spilledMl;});
   assert(spilled>0);await page.waitForTimeout(100);
   assert.equal(await page.locator('[data-pour-detail]').count(),0);
   assert(!/넘침|Spilled/.test(await page.locator('.pour-top-readout').innerText()));
   assert(await page.locator('[data-pour-value]').isVisible());assert(await page.locator('.pour-target-value').isVisible());
   if(lang==='ko'&&kind==='pour')await page.screenshot({path:'/private/tmp/pour-clean-ui.png'});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS all five gimmicks in Korean/English: no in-play switch button, overflow hidden while physics remains, target/current visible');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
