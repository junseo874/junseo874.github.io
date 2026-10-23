const assert=require('node:assert/strict');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  for(const variant of ['original','gpt'])for(const day of [0,99]){
   await page.evaluate(({variant,day})=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();c.session.install({developer:true});
    c.ui.variant=variant;g.variant=variant;g.reset(day,'practice',1,true);
    c.ui.peek=null;c.ui.remixFilter='all';c.screen(c.playView);g.changed();
   },{variant,day});
   await page.waitForSelector('.recipe-card .drink-art');
   assert.equal(await page.locator('.remix-recipes').count(),variant==='gpt'?1:0);
   const cards=await page.evaluate(async()=>{
    return Promise.all([...document.querySelectorAll('.recipe-card')].map(async card=>{
     const img=card.querySelector('.drink-art'),id=card.dataset.id;
     await img.decode();const box=img.getBoundingClientRect(),parent=card.getBoundingClientRect();
     const assets=barGame.data.assets;
     // Unauthored drinks use the same shared fallback as the actual table.
     return {id,src:img.getAttribute('src'),expected:(assets['table_cocktail_'+id]||assets['cocktail_'+id]||assets['recipe_cocktail_'+id]||assets['item_'+barGame.cocktail(id).glass])?.src,
      usage:img.dataset.artUsage,loaded:img.naturalWidth>0,locked:card.disabled,
      filter:getComputedStyle(img).filter,contained:box.left>=parent.left&&box.right<=parent.right&&box.top>=parent.top&&box.bottom<=parent.bottom};
    }));
   });
   assert(cards.length>=8);
   for(const card of cards){assert(card.expected,card.id+' table asset');assert.equal(card.src,card.expected);assert.equal(card.usage,'table');assert(card.loaded&&card.contained,JSON.stringify(card));if(card.locked)assert.equal(card.filter,'brightness(0)');}
   if(day===0)assert(cards.some(c=>c.locked));
   if(variant==='original'&&day===0)await page.screenshot({path:'/private/tmp/recipe-table-art.png'});
   await page.locator('[data-hover-recipe="gin_tonic"]').hover();
   await page.waitForSelector('.recipe-hero .drink-art');
   assert.equal(await page.locator('.recipe-hero .drink-art').getAttribute('data-art-usage'),'recipe','Detailed recipe art is unchanged');
   await page.locator('[data-hover-recipe="gin_tonic"]').click();
   if(variant==='original')await page.waitForFunction(()=>barGame.screen==='prep');
  }
  assert.deepEqual(errors,[]);console.log('RECIPE_TABLE_ART_OK: original/remix, locked/unlocked table sprites, decoded/contained, detail art preserved, recipe selection');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
