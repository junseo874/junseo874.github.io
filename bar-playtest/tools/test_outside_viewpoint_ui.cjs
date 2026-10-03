const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{await outsidePlaytest.start();});
 const settle=()=>page.evaluate(()=>{for(let i=0;i<100;i++)outsidePlaytest.tick(.05);return outsidePlaytest.camera;});
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.x=LunaOutside.viewpoint.x;m.updateNear();a.snapCamera();a.tick(0);});
 assert.equal(await page.locator('.outside-viewpoint').isVisible(),true);assert.equal(await page.locator('.outside-viewpoint').innerText(),'Y');
 await page.screenshot({path:'/private/tmp/viewpoint-near.png'});
 await page.keyboard.press('y');let camera=await settle();assert(Math.abs(camera.w-LUNA_WIDTH())<.01);assert(Math.abs(camera.x+8.78)<.01);assert(camera.y-camera.w*.5625/2>=-1.481);
 assert.equal(await page.locator('.outside-viewpoint').getAttribute('aria-pressed'),'true');await page.screenshot({path:'/private/tmp/viewpoint-wide.png'});
 await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);
 await page.locator('.outside-viewpoint').click();assert(Math.abs((await settle()).w-LUNA_WIDTH())<.01);
 await page.evaluate(()=>{outsidePlaytest.model.x=-7.9;outsidePlaytest.model.updateNear();});assert(Math.abs((await settle()).w-4.8)<.01);assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);
 const guards=await page.evaluate(()=>{const v=LunaOutside,m=outsidePlaytest.model,results=[];for(let day=0;day<=3;day++)for(const flow of ['in','out']){m.start({day,flow});m.x=v.viewpoint.x;results.push(v.atViewpoint(m));}for(const overrides of [{scene:'home'},{level:1},{ride:{}},{transition:{}},{encounter:{}},{dialog:{}},{qa:{}}]){m.start({day:0,flow:'out'});m.x=v.viewpoint.x;Object.assign(m,overrides);results.push(!v.atViewpoint(m));}m.start({day:0,flow:'out'});m.x=v.viewpoint.x;return results;});assert(guards.every(Boolean));
 await page.evaluate(()=>outsidePlaytest.tick(0));await page.keyboard.press('Escape');assert.equal(await page.locator('.outside-viewpoint').isVisible(),false);await page.keyboard.press('y');assert(Math.abs((await settle()).w-4.8)<.01);await page.keyboard.press('Escape');assert.equal(await page.locator('.outside-viewpoint').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('VIEWPOINT_OK: local Y prompt, keyboard/click toggle, moderate framing, floor clamp, leave-zone restore, days 0–3 both routes, home/lift/QA/dialog/encounter/pause guards');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
function LUNA_WIDTH(){return 12;}
