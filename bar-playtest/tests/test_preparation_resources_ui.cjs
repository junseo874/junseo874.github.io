const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.selectCocktail('gin_tonic');lunaCampaign.ui.tab='glass';lunaCampaign.ui.recipeOpen=false;lunaCampaign.render(true);});
  const start=p.locator('.craft-start');assert(await start.isDisabled());assert.equal(await start.getAttribute('aria-label'),'제조 시작');await start.locator('img').evaluate(e=>e.decode());assert(await start.locator('img').evaluate(e=>e.complete&&e.naturalWidth===497));
  const bg=sel=>p.locator(sel).evaluate(e=>getComputedStyle(e).backgroundImage);
  const tray=await p.locator('.prep-inventory').evaluate(e=>{const s=getComputedStyle(e),b=getComputedStyle(e,'::before');return {background:b.backgroundImage,filter:b.filter,backgroundOpacity:b.opacity,base:s.backgroundColor,opacity:s.opacity,itemFilter:getComputedStyle(e.querySelector('.inventory-slot')).filter};});
  assert(tray.background.includes('IMG_igd_backround.png'));assert.equal(tray.filter,'contrast(1.2) brightness(0.94)');assert.equal(tray.base,'rgba(0, 0, 0, 0)');assert.equal(tray.backgroundOpacity,'0.85');assert.equal(tray.opacity,'1');assert.equal(tray.itemFilter,'none');assert((await bg('.empty-slot')).includes('IMG_igd_box_B.png'));
  assert((await bg('.shelf-dots button.selected span')).includes('IMG_indicator_B.png'));assert(await p.locator('.shelf-arrow.prev').isDisabled());
  await p.locator('.shelf-arrow.next').hover();assert((await bg('.shelf-arrow.next')).includes('BTN_arrow_R_B.png'));await p.locator('.shelf-arrow.next').click();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>lunaCampaign.ui.tab),'tool');
  await p.locator('.shelf-dots [data-id="liquor"]').click();await p.waitForTimeout(500);
  const liquorSource=await p.evaluate(()=>new URL(barData.assets.prep_liquor.src,location.href).href);assert((await bg('.shelf-scene[data-category="liquor"]')).includes(liquorSource),'Render the current registered shelf resource');
  const shelf=await p.evaluate(async()=>{const a=barData.assets.prep_liquor,i=new Image();i.src=a.src;await i.decode();return [i.naturalWidth,i.naturalHeight];});assert.deepEqual(shelf,[960,540]);
  await p.screenshot({path:'/private/tmp/luna-new-liquor-shelf.png'});
  await p.locator('.shelf-item[data-id="gin"]').click();assert.equal(await p.locator('.inventory-slot[data-id="gin"]').count(),1);
  await p.evaluate(()=>{barGame.pickItem(barGame.cocktail('gin_tonic').glass);lunaCampaign.render(true);});assert(await start.isEnabled());
  assert((await bg('.inventory-slot[data-id="gin"]')).includes('IMG_igd_box_A.png'));
  assert.equal(await p.locator('.inventory-slot[data-id="gin"] .remove-mark').isVisible(),false);
  await p.locator('.inventory-slot[data-id="gin"]').click();assert.equal(await p.locator('.inventory-slot[data-id="gin"]').count(),0);assert(await start.isDisabled());
  await p.evaluate(()=>{barGame.pickItem('gin');barGame.pickItem('soda_water');barGame.pickItem('ice');barGame.pickOpener();lunaCampaign.ui.tab='tool';lunaCampaign.ui.recipeOpen=true;lunaCampaign.render(true);});await p.waitForTimeout(500);
  await p.screenshot({path:'/private/tmp/luna-preparation-resources.png'});
  const slot=await p.locator('.inventory-slot').first().boundingBox(),strip=await p.locator('.inventory-scroll').boundingBox();assert(Math.abs(strip.x+strip.width/2-640)<1,'Recipe visibility must not change centered slot alignment');
  assert(await p.locator('.recipe-toggle').isHidden());
  // Existing pointer tooltip and shelf art placement are deliberately unchanged.
  await p.locator('#prep-recipe-detail [data-act="togglePrepRecipe"]').click();assert.deepEqual(await p.locator('.inventory-slot').first().boundingBox(),slot,'Closing must not move the slots');
  await p.screenshot({path:'/private/tmp/luna-preparation-resources-closed.png'});
  for(const size of [{width:820,height:650},{width:1920,height:1080}]){await p.setViewportSize(size);await p.waitForTimeout(100);const r=await start.boundingBox(),area=await p.locator('.prep-inventory').boundingBox();assert(r.x>=0&&r.x+r.width<=size.width&&r.y+r.height<=area.y);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await p.setViewportSize({width:1280,height:720});await start.click();assert.notEqual(await p.evaluate(()=>barGame.screen),'prep');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS preparation image assets, indicators/arrows, add/remove, disabled/start action, stationary centered slots and responsive layout.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
