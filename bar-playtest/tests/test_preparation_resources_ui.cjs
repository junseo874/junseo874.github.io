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
  await p.locator('.shelf-arrow.next').click();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>lunaCampaign.ui.tab),'tool');
  for(const [side,letter] of [['prev','L'],['next','R']]){
    const selector='.shelf-arrow.'+side,arrow=p.locator(selector);
    await p.mouse.move(640,10);await arrow.evaluate(e=>e.blur());
    assert((await bg(selector)).includes('BTN_arrow_'+letter+'_A.png'));
    const resting=await arrow.boundingBox();
    await arrow.hover();assert((await bg(selector)).includes('BTN_arrow_'+letter+'_B.png'));assert.deepEqual(await arrow.boundingBox(),resting);
    const paint=()=>arrow.evaluate(e=>{const style=getComputedStyle(e);return [style.backgroundSize,style.backgroundPosition,style.backgroundRepeat];});
    assert.deepEqual(await paint(),['contain','50% 50%','no-repeat'],'Full-sized authored hover sprite must fit the button');
    await p.mouse.move(640,10);await p.keyboard.press('Tab');await arrow.focus();
    assert((await bg(selector)).includes('BTN_arrow_'+letter+'_B.png'));
    assert.deepEqual(await paint(),['contain','50% 50%','no-repeat']);
  }
  const mixer=p.locator('.shelf-scene[data-category="tool"] [data-id="mixing_glass"] .shelf-sprite');
  const origin=await mixer.evaluate(img=>{const r=img.getBoundingClientRect(),s=img.closest('.shelf-scene').getBoundingClientRect();return [Math.round((r.left-s.left)*480/s.width),Math.round((r.top-s.top)*270/s.height)];});
  assert.deepEqual(origin,[126,66],'Mixing glass and spoons align with the silhouettes in the original shelf');
  await p.locator('.shelf-arrow.prev').click();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>lunaCampaign.ui.tab),'glass');
  await p.locator('.shelf-dots [data-id="liquor"]').click();await p.waitForTimeout(500);
  const stockRows=await p.locator('.shelf-scene[data-category="liquor"] .shelf-item').evaluateAll(items=>[...new Set(items.map(item=>Number(item.dataset.baseline)))]);
  assert.deepEqual(stockRows,[195,399]);
  const liquorSource=await p.evaluate(()=>new URL(barData.assets.prep_liquor.src,location.href).href);assert((await bg('.shelf-scene[data-category="liquor"]')).includes(liquorSource),'Render the current registered shelf resource');
  const shelf=await p.evaluate(async()=>{const a=barData.assets.prep_liquor,i=new Image();i.src=a.src;await i.decode();return [i.naturalWidth,i.naturalHeight];});assert.deepEqual(shelf,[960,540]);
  await p.screenshot({path:'/private/tmp/luna-new-liquor-shelf.png'});
  await p.locator('.shelf-item[data-id="gin"]').click();assert.equal(await p.locator('.inventory-slot[data-id="gin"]').count(),1);
  await p.evaluate(()=>{barGame.pickItem(barGame.cocktail('gin_tonic').glass);lunaCampaign.render(true);});assert(await start.isEnabled());
  const packedGin='.inventory-slot[data-id="gin"]',slotBackground=await bg(packedGin);
  assert(slotBackground.includes('IMG_igd_box_A.png'));
  await p.locator(packedGin).hover();
  assert.equal(await bg(packedGin),slotBackground,'Hover keeps the authored slot frame in place');
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
