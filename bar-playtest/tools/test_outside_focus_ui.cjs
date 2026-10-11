const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(()=>{const el=document.querySelector('#outside-root'),s=getComputedStyle(el);return{active:document.activeElement.id,visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor,selection:String(getSelection())};});
 try{
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.locator('[data-campaign="developer"]').click();
  const updates=page.locator('.updates-confirm');if(await updates.isVisible())await updates.click();
  await page.evaluate(()=>outsidePlaytest.start());await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await page.keyboard.press('KeyP');await page.keyboard.press('KeyP');
  const found=await state();console.log('After closing P console:',found);
  if(process.argv.includes('--diagnose')){await page.screenshot({path:'/private/tmp/outside-focus-before.png'});return;}
  assert.equal(found.active,'outside-root');assert.equal(found.outline,'none');assert.equal(found.selection,'');
  const x=await page.evaluate(()=>outsidePlaytest.model.x);await page.keyboard.down('KeyD');await page.waitForTimeout(300);await page.keyboard.up('KeyD');
  assert(await page.evaluate(()=>outsidePlaytest.model.x)>x,'Movement preserved');
  await page.keyboard.press('KeyP');await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>document.activeElement.matches('.outside-dev-console button:focus-visible')),'Buttons remain keyboard-focusable');
  await page.keyboard.press('Escape');assert.equal((await state()).outline,'none');
  await page.keyboard.press('Escape');assert(await page.locator('.outside-dialog').isVisible());
  await page.keyboard.press('Escape');assert.equal((await state()).outline,'none');
  await page.mouse.move(320,180);await page.mouse.down();await page.mouse.move(850,530,{steps:12});await page.mouse.up();
  assert.equal(await page.evaluate(()=>String(getSelection())),'');
  await page.evaluate(()=>{const m=outsidePlaytest.model;m.x=1;m.y=-.7;m.updateNear();document.querySelector('#outside-root').focus();});
  await page.keyboard.press('KeyE');assert(await page.evaluate(()=>!!outsidePlaytest.model.dialog||outsidePlaytest.model.story.blocking),'Interaction preserved');
  assert.equal((await state()).outline,'none');
  await page.screenshot({path:'/private/tmp/outside-focus-after.png'});
  assert.deepEqual(errors,[]);console.log('PASS root focus border suppressed; movement, P/E/Escape, Tab controls and drag selection preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
