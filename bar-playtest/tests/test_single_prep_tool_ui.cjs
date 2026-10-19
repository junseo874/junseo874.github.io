const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.selectCocktail('bottle_beer');barGame.pickItem('mug');barGame.pickItem('beer');lunaCampaign.ui.tab='tool';lunaCampaign.ui.recipeOpen=false;lunaCampaign.render(true);});
  const ids=['opener','shaker','mixing_glass'];
  for(const first of ids)for(const second of ids){
   await p.evaluate(()=>{barGame.prep.tool=null;barGame.prep.opener=false;lunaCampaign.render(true);});
   await p.locator('.shelf-item[data-id="'+first+'"]').click();
   await p.locator('.shelf-item[data-id="'+second+'"]').click();
   const expected=first===second?[]:[second];
   const selected=await p.locator('.shelf-item.selected').evaluateAll(els=>els.map(el=>el.dataset.id));
   assert.deepEqual(selected.filter(id=>ids.includes(id)),expected);
   const tray=await p.locator('.inventory-slot[data-id]').evaluateAll(els=>els.map(el=>el.dataset.id));
   assert.deepEqual(tray.filter(id=>ids.includes(id)),expected);assert(tray.includes('mug')&&tray.includes('beer'));
  }
  await p.locator('.shelf-item[data-id="opener"]').click();
  await p.locator('.inventory-slot[data-id="opener"]').click();
  assert.equal(await p.locator('.shelf-item[data-id="opener"]').getAttribute('aria-pressed'),'false');
  await p.locator('.shelf-item[data-id="opener"]').click();
  await p.locator('[data-act="craft"]').click();
  assert.deepEqual(await p.evaluate(()=>barGame.craft.queue.map(s=>s.type)),['open','pour']);
  assert.deepEqual(errors,[]);console.log('PASS: all tool pairs replace/toggle, tray and shelf agree, glass/ingredients retained, beer opens then pours.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
