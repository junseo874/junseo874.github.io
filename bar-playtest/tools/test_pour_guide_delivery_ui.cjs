const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(()=>{const g=barGame;g.reset(99,'practice',1,true,{variant:'original'});g.selectCocktail('gin_tonic');g.debugFill();g.startCraft();g.craft.index=1;g.nextGimmick();});
 await p.locator('[data-pour-guide]').waitFor();assert(await p.evaluate(()=>barGame.gimmick.fluid.carbonated));
 assert(!(await p.locator('.fluid-screen').innerText()).includes('거품 속'));
 for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:960,height:540}]){
  await p.setViewportSize(size);await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.idleGuide==='true');await p.waitForTimeout(150);
  const state=await p.locator('[data-pour-guide]').evaluate(c=>{const r=c.getBoundingClientRect(),s=getComputedStyle(c),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])painted++;return{width:c.width,physical:Math.min(r.width,r.height*1000/540)*devicePixelRatio,render:s.imageRendering,pointer:s.pointerEvents,painted,pixel:getComputedStyle(document.querySelector('[data-pixel-pour]')).imageRendering};});
  assert(state.width>=state.physical);assert.equal(state.render,'auto');assert.equal(state.pointer,'none');assert.equal(state.pixel,'pixelated');assert(state.painted>100);
 }
 await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(300);await p.screenshot({path:'/private/tmp/pour-guide-crisp.png'});
 const b=await p.locator('[data-pixel-pour]').boundingBox();await p.mouse.move(b.x+b.width*.45,b.y+b.height*.4);await p.mouse.down();await p.waitForTimeout(100);assert(await p.evaluate(()=>barGame.gimmick.held));assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-idle-guide'),'false');await p.mouse.up();
 for(const tutorial of [false,true]){
  await p.evaluate(tutorial=>{lunaQA.state.cocktail='gin_tonic';lunaQA.state.seat='R';lunaQA.runSituation('serve');if(tutorial){barGame.day=0;barGame.tutorial={kind:'serveDrink',seat:'R'};}},tutorial);
  const popup=p.locator('[data-drag="drink"]');await popup.waitFor();await p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
  const ring=p.locator('[data-guide-ring="target"]');assert.equal(await p.locator('.delivery-cue').count(),0);
  if(tutorial)assert.equal(await ring.getAttribute('width'),'0');
  async function grab(){const r=await popup.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(80);assert.equal(await popup.isVisible(),false);assert(await p.locator('#drag-ghost').isVisible());assert.equal(await p.locator('.drop-ready .delivery-cue').count(),1);if(tutorial){assert(Number(await ring.getAttribute('width'))>0);assert.equal(await p.locator('.day0-guide-copy').isVisible(),false);assert.equal(await p.locator('[data-guide-ring="source"]').getAttribute('width'),'0');}}
  await grab();if(tutorial)await p.screenshot({path:'/private/tmp/drink-drag-target-only.png'});
  await p.mouse.move(100,180);await p.mouse.up();await popup.waitFor();assert(await p.evaluate(()=>!!barGame.drink));assert.equal(await p.locator('.delivery-cue').count(),0);if(tutorial){assert.equal(await ring.getAttribute('width'),'0');assert(await p.locator('.day0-guide-copy').isVisible());}
  await grab();await p.evaluate(()=>dispatchEvent(new PointerEvent('pointercancel')));await p.mouse.up();await popup.waitFor();assert.equal(await p.locator('.delivery-cue').count(),0);
  await grab();const target=await p.locator('[data-drop="R"]').boundingBox();await p.mouse.move(target.x+target.width/2,target.y+target.height*.8,{steps:6});await p.mouse.up();await p.waitForFunction(()=>!barGame.drink);assert.equal(await popup.count(),0);
 }
 assert.deepEqual(errors,[]);console.log('POUR_GUIDE_DELIVERY_OK: removed foam copy, HiDPI smooth guide/pixel art preserved, input works, target-on-pickup, hidden popup, invalid/cancel restore, valid drop, tutorial/general');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
