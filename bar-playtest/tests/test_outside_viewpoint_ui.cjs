const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.locator('[data-campaign="developer"]').click();if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{await outsidePlaytest.start();});
 const settle=()=>page.evaluate(()=>{for(let i=0;i<100;i++)outsidePlaytest.tick(.05);return outsidePlaytest.camera;});
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.x=LunaOutside.viewpoint.x;m.updateNear();a.snapCamera();a.tick(0);});
 // Day zero: no prompt, and neither keys nor a dispatched click can bypass the guard.
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);
 await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.locator('.outside-viewpoint').dispatchEvent('click');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:1,flow:'out'});m.x=LunaOutside.viewpoint.x;m.updateNear();a.snapCamera();a.tick(0);});
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),true);assert.equal(await page.locator('.outside-viewpoint').innerText(),'Y');
 await page.screenshot({path:'/private/tmp/viewpoint-near.png'});
 await page.keyboard.press('y');let camera=await settle();assert(Math.abs(camera.w-LUNA_WIDTH())<.01);assert(Math.abs(camera.x+8.78)<.01);assert(camera.y-camera.w*.5625/2>=-1.481);
 assert.equal(await page.locator('.outside-viewpoint').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);await page.screenshot({path:'/private/tmp/viewpoint-wide.png'});
 await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.locator('.outside-viewpoint').click();assert(Math.abs((await settle()).w-LUNA_WIDTH())<.01);
 await page.evaluate(()=>{outsidePlaytest.model.x=-7.9;outsidePlaytest.model.updateNear();});assert(Math.abs((await settle()).w-4.8)<.01);assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);
 const guards=await page.evaluate(()=>{const v=LunaOutside,m=outsidePlaytest.model,results=[];for(let day=0;day<=3;day++)for(const flow of ['in','out']){m.start({day,flow});m.x=v.viewpoint.x;results.push(v.atViewpoint(m)===(day>0));}for(const overrides of [{scene:'home'},{level:1},{ride:{}},{transition:{}},{encounter:{}},{dialog:{}},{qa:{}}]){m.start({day:1,flow:'out'});m.x=v.viewpoint.x;Object.assign(m,overrides);results.push(!v.atViewpoint(m));}m.start({day:1,flow:'out'});m.x=v.viewpoint.x;return results;});assert(guards.every(Boolean));
 await page.evaluate(()=>outsidePlaytest.tick(0));await page.keyboard.press('Escape');assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);await page.keyboard.press('Escape');assert.equal(await page.locator('.outside-viewpoint').isVisible(),true);
 // Re-entry shows the prompt again; repeating a held Y must not exit the panorama.
 await page.keyboard.down('KeyY');await page.keyboard.down('KeyY');await page.keyboard.up('KeyY');
 assert(Math.abs((await settle()).w-LUNA_WIDTH())<.01);assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);
 // Switching to day zero also cancels an already active panorama.
 await page.evaluate(()=>{outsidePlaytest.model.config.day=0;});assert(Math.abs((await settle()).w-4.8)<.01);
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);





 assert.deepEqual(errors,[]);console.log('VIEWPOINT_OK: day-zero keyboard/click blocked, days 1–3 allowed, viewing prompt hidden, Y return/repeat guard, zone re-entry, pause guards');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
function LUNA_WIDTH(){return 10.4;}
