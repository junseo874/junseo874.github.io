const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  for(const developer of [false,true,false,true])for(const variant of ['original','gpt'])for(const day of [0,1,2,3,99]){
   const result=await page.evaluate(({developer,variant,day})=>{
    const c=lunaCampaign,g=barGame;c.session.uninstall();
    const original=g.t.cocktails,recipes=g.t.recipes,tags=g.t.cocktail_tags;
    c.session.install({developer});c.ui.variant=variant;g.variant=variant;g.reset(day,'practice',1,true);c.ui.peek=null;c.ui.remixFilter='all';c.screen(c.playView);g.changed();
    const has=rows=>rows.some(r=>r.id==='long_island'||r.context==='long_island');
    if(has(g.t.cocktails)!==developer||has(g.t.recipes)!==developer||has(g.t.cocktail_tags)!==developer)throw Error('Main catalog/practice isolation');
    const unlocked=g.cocktailsAvailable().some(r=>r.id==='long_island'),daily=g.dailyUnlocks().cocktails.some(r=>r.id==='long_island');
    if(unlocked!==(developer&&day>=2)||daily!==(developer&&day===2))throw Error('Unlock gate');
    const barks=g.setBarks;g.setBarks=()=>{};
    try{for(let i=0;i<200;i++){const guest={slot:{},personality:{think_chance:0}};g.beginOrder(guest,false);if(!developer&&guest.nextCocktail==='long_island')throw Error('Main random order');}}finally{g.setBarks=barks;}
    if(!developer){g.currentOrder={cocktail:'long_island'};if(g.selectCocktail('long_island'))throw Error('Stale order restored excluded recipe');g.currentOrder=null;}
    if(!['gin','vodka','rum','tequila','cola'].every(id=>g.t.shelf_items.some(r=>r.id===id)))throw Error('Shared ingredient removed');
    window.longIslandOriginal={original,recipes,tags};return {developer,day,unlocked};
   },{developer,variant,day});
   await page.waitForFunction(expected=>document.querySelectorAll('.recipe-card').length>0&&document.querySelectorAll('.recipe-card[data-id="long_island"]').length===expected,developer?1:0);
   assert.equal(await page.locator('.recipe-card[data-id="long_island"]').count(),developer?1:0,JSON.stringify({developer,variant,day}));
   assert(await page.evaluate(()=>{
    const g=barGame,canLong=lunaCampaign.session.developer&&g.day>=2;
    if(canLong){if(!g.selectCocktail('long_island'))return false;}else if(!g.selectCocktail('gin_tonic'))return false;
    g.debugFill();g.startCraft();return g.screen==='gimmick';
   }),'Other drinks remain craftable; developer Long Island retained: '+JSON.stringify(result));
   assert(await page.evaluate(()=>{lunaCampaign.session.uninstall();const g=barGame,o=longIslandOriginal;return g.t.cocktails===o.original&&g.t.recipes===o.recipes&&g.t.cocktail_tags===o.tags;}),'Exact table references restore after leaving main');
  }
  assert.deepEqual(errors,[]);console.log('LONG_ISLAND_MAIN_EXCLUDED_OK 40 main/developer/day/UI cases, 8000 random orders, locked cards, daily unlocks, stale order, crafting, shared ingredients and exact session restoration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
