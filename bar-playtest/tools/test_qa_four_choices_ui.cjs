const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:99,place:'bar',flow:'out'});await outsidePlaytest.start();});
  await page.keyboard.press('Tab');await page.locator('[data-qa="outside-pick"][data-id="ui:choice-four"]').click();
  const before=await page.evaluate(()=>JSON.stringify(barGame.progress));
  for(let i=0;i<4;i++){
   await page.mouse.move(1200,30);
   await page.keyboard.press('KeyE');await page.waitForSelector('.world-choices:not([hidden])');
   const rows=page.locator('.world-choices:not([hidden]) button');assert.equal(await rows.count(),4);
   if(i===0){await page.waitForTimeout(500);await page.screenshot({path:'/private/tmp/qa-four-choices.png'});}
   if(i===1){await page.keyboard.press('KeyS');await page.keyboard.press('KeyE');}
   else if(i===2){await page.mouse.wheel(0,100);await page.waitForFunction(()=>document.querySelector('.world-choices .is-selected')?.dataset.choice==='ask');await page.waitForTimeout(200);await page.mouse.wheel(0,100);await page.waitForFunction(()=>document.querySelector('.world-choices .is-selected')?.dataset.choice==='think');await page.keyboard.press('KeyE');}
   else await rows.nth(i).click();
   assert.equal(await page.evaluate(()=>outsidePlaytest.model.qa.events.filter(e=>e.event==='choice').at(-1).index),i+1);
   assert((await page.evaluate(()=>outsidePlaytest.model.story.speech.line.text)).startsWith((i+1)+'번 선택:'));
   await page.keyboard.press('KeyE');await page.keyboard.press('KeyE');
   await page.waitForFunction(()=>!outsidePlaytest.model.story.speech);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(barGame.progress)),before,'QA choices do not change main progress');
  await page.setViewportSize({width:960,height:600});
  await page.evaluate(()=>{const o=outsidePlaytest;o.model.start({...o.config,day:99,qaCase:'ui:choice-four',qaActivation:'proximity'});o.snapCamera();});
  await page.waitForSelector('.world-choices:not([hidden])');await page.waitForTimeout(700);
  assert.equal(await page.locator('.world-choices:not([hidden]) button').count(),4,'Proximity choices wait for input');
  const bounds=await page.locator('.world-choices:not([hidden])').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=960&&bounds.y+bounds.height<=600);
  assert.deepEqual(errors,[]);console.log('QA_FOUR_CHOICES_UI_OK: catalog entry, four outcomes, W/S and wheel/E and mouse, replay, proximity waits, small viewport, main progress unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
