const BASE=(process.env.LUNA_TEST_URL||'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto(BASE);await p.evaluate(()=>{barGame.reset(99,'general',7);for(let i=0;i<53;i++)barGame.tick(.1);});await p.waitForTimeout(700);
 assert.equal(await p.locator('.bottom-tools,.brand,.seat-button').count(),0);
 assert.equal(await p.locator('.seat-indicators button').count(),3);
 assert.equal(await p.locator('.seat-indicators .selected').getAttribute('data-id'),'L');
 assert.equal(await p.locator('[data-act="recipes"],[data-act="sales"],[data-act="dossierOpen"]').count(),0);
 for(const size of [{width:1280,height:720},{width:1440,height:900},{width:820,height:650}]){
  await p.setViewportSize(size);await p.waitForTimeout(120);
  const layout=await p.evaluate(()=>{const stage=document.querySelector('.app-shell').getBoundingClientRect(),top=document.querySelector('.topbar').getBoundingClientRect(),dots=document.querySelector('.seat-indicators').getBoundingClientRect();return {ratio:stage.width/stage.height,dotsBottom:dots.bottom,stageBottom:stage.bottom,overflow:[...document.querySelectorAll('.topbar button,.topbar a,.topbar .statusbar')].some(e=>{const r=e.getBoundingClientRect();return r.right>top.right||r.left<top.left||r.bottom>top.bottom})};});
  assert(Math.abs(layout.ratio-16/9)<.001);assert(!layout.overflow);assert(layout.dotsBottom<layout.stageBottom);
 }
 await p.setViewportSize({width:1280,height:720});await p.screenshot({path:'/private/tmp/bar-service-main.png'});
 await p.keyboard.press('KeyD');await p.waitForTimeout(650);assert.equal(await p.locator('.seat-indicators .selected').getAttribute('data-id'),'M');
 await p.locator('.seat-indicators [data-id="R"]').click();await p.waitForTimeout(650);assert.equal(await p.evaluate(()=>barGame.focus),'R');
 await p.locator('[data-act="overview"]').click();assert.equal(await p.locator('.seat-indicators .selected').count(),0);
 await p.locator('.seat-indicators [data-id="R"]').click();assert.equal(await p.evaluate(()=>barGame.overview),false);
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>barGame.overlay),'service');
 const before=await p.evaluate(()=>({t:barGame.barTime,focus:barGame.focus,left:barGame.seats.L.left}));await p.waitForTimeout(350);
 await p.keyboard.press('KeyA');await p.keyboard.press('KeyE');await p.keyboard.press('KeyP');
 assert.deepEqual(await p.evaluate(()=>({t:barGame.barTime,focus:barGame.focus,left:barGame.seats.L.left})),before);
 assert.equal(await p.evaluate(()=>barGame.paused),false);assert.equal(await p.locator('#service-panel .service-actions button').count(),3);
 await p.screenshot({path:'/private/tmp/bar-service-panel.png'});
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>barGame.overlay),null);
 await p.waitForTimeout(200);assert((await p.evaluate(()=>barGame.barTime))>before.t);
 await p.locator('.service-handle').click();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>barGame.overlay),'sales');
 await p.keyboard.press('Escape');await p.keyboard.press('Tab');await p.locator('[data-act="dossierOpen"]').click();assert.equal(await p.evaluate(()=>barGame.overlay),'dossier');
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>barGame.overlay),'dossier');await p.keyboard.press('Escape');
 await p.keyboard.press('Tab');await p.locator('#service-panel [data-act="recipes"]').click();assert.equal(await p.evaluate(()=>barGame.screen),'recipe');assert.equal(await p.evaluate(()=>barGame.overlay),null);
 await p.locator('[data-act="selectRecipe"][data-id="gin_tonic"]').click();await p.waitForTimeout(550);
 const box=selector=>p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
 const active='.shelf-slide[data-current="true"] .shelf-scene',full=await box(active);
 assert.deepEqual(full,{x:0,y:0,w:1280,h:720});assert.deepEqual(await box('.prep-main'),full);
 assert.equal(await p.locator('.prep-recipe').count(),0);assert.equal(await p.locator('.recipe-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(await p.locator('.shelf-navigation>span').count(),0);
 assert.deepEqual(await p.locator('.shelf-arrow small').allTextContents(),['A','D']);
 assert.equal(await p.locator('.prep-inventory').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(12, 20, 32, 0.8)');
 assert.equal(await p.locator('.prep-inventory').evaluate(e=>getComputedStyle(e).opacity),'1');
 for(const side of ['prev','next']){assert(await p.locator('.shelf-arrow.'+side).evaluate(e=>e.querySelector('small').getBoundingClientRect().top>=e.querySelector('span').getBoundingClientRect().bottom));}
 await p.screenshot({path:'/private/tmp/bar-prep-default-closed.png'});
 await p.locator('.recipe-toggle').click();assert.equal(await p.locator('.prep-recipe').count(),1);assert.deepEqual(await box(active),full);
 await p.screenshot({path:'/private/tmp/bar-service-prep-open.png'});
 await p.locator('.prep-recipe [data-act="togglePrepRecipe"]').click();assert.deepEqual(await box(active),full);
 await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>barGame.overlay),null);
 for(const id of ['glass','tool','liquor','fridge']){
  await p.locator('[data-act="tab"][data-id="'+id+'"]').click();await p.waitForTimeout(550);
  assert.deepEqual(await box(active),full);await p.mouse.move(1230,10);await p.screenshot({path:'/private/tmp/bar-service-prep-'+id+'.png'});
 }
 await p.locator('.shelf-item[data-id="soda_water"]').click();assert.deepEqual(await p.evaluate(()=>barGame.prep.ingredients),['soda_water']);
 await p.locator('.recipe-toggle').click();assert.deepEqual(await box(active),full);
 await p.locator('[data-act="prepBack"]').click();assert.equal(await p.evaluate(()=>barGame.prep),null);assert.equal(await p.evaluate(()=>barGame.screen),'recipe');
 await p.screenshot({path:'/private/tmp/bar-service-recipes.png'});
 await p.locator('[data-act="selectRecipe"][data-id="gin_fizz"]').click();assert.equal(await p.locator('.prep-recipe').count(),0);
 // A story line that cannot manufacture yet keeps the drawer open and paused.
 await p.evaluate(()=>{barGame.reset(0,'full',1);});await p.waitForTimeout(1100);await p.keyboard.press('Tab');await p.locator('#service-panel [data-act="recipes"]').click();
 assert.equal(await p.evaluate(()=>barGame.overlay),'service');assert.equal(await p.evaluate(()=>barGame.screen),'bar');await p.keyboard.press('Escape');
 await p.evaluate(()=>{barGame.lang='en';barGame.reset(99,'general',1);});await p.waitForTimeout(150);await p.keyboard.press('Tab');assert.equal(await p.locator('#service-title').textContent(),'Service panel');
 await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/bar-service-en.png'});
 await p.keyboard.press('Escape');assert(await p.locator('.top-controls').evaluate(e=>e.getBoundingClientRect().right<=document.querySelector('.statusbar').getBoundingClientRect().left));
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('SERVICE_UI_OK: no bottom toolbar/brand, top controls, clickable seat dots, Tab drawer, menu pause/handoffs, input isolation, EN, full-stage shelves and stable recipe overlays, back/reset.');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
