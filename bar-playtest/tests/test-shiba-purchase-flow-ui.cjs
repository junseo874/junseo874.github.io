const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();});
  const finish=()=>p.evaluate(()=>{const a=outsidePlaytest,m=a.model;for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}a.tick(0);});
  for(const day of [1,2,3])for(const money of [49,1000]){
   await p.evaluate(({day,money})=>{const a=outsidePlaytest,m=a.model;Object.assign(barGame.progress,{money,inventory:{},flags:{shiba_shop_met:true}});m.start({day,flow:'out',place:'bar'});m.controlsTutorial=false;m.x=-2.87;m.updateNear();LunaOutsideShop.interact(m,LunaOutsideShop.targets(m)[0]);a.snapCamera();},{day,money});
   await finish();
   assert.deepEqual(await p.locator('.world-choices button').evaluateAll(es=>es.map(e=>e.dataset.choice)),['shop-yes','shop-no']);
   assert.equal(await p.evaluate(()=>LunaOutsideShop.choose(outsidePlaytest.model,'shop-buy-tuna_can')),false,'Greeting cannot purchase even through a stale choice');
   await p.waitForTimeout(550);await p.locator('[data-choice="shop-yes"]').click();await finish();
   // Preserve the existing optional allowance conversation, but never sell from it.
   if(await p.evaluate(()=>outsidePlaytest.model.story.speech.line.stage==='allowance')){
    assert.equal(await p.locator('[data-choice="shop-buy-tuna_can"]').count(),0);
    await p.waitForTimeout(550);await p.locator('[data-choice="shop-allowance-no"]').click();await finish();
   }
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.view().full),'어떤 걸 살 거야?');
   assert.deepEqual(await p.locator('.world-choices button').evaluateAll(es=>es.map(e=>e.dataset.choice)),['shop-no','shop-buy-bitters','shop-buy-tuna_can']);
   assert.equal(await p.locator('.world-choices button.is-selected').getAttribute('data-choice'),'shop-no');
   // aria-disabled advertises rejection to assistive tools; keyboard selection
   // still accepts the attempt so the game's insufficient-funds feedback runs.
   await p.waitForTimeout(550);await p.locator('[data-choice="shop-buy-tuna_can"]').hover();await p.keyboard.press('Enter');
   if(money<50){
    assert.equal(await p.locator('[data-choice="shop-buy-tuna_can"]').innerText(),'돈이 부족합니다.');
    assert.equal(await p.evaluate(()=>barGame.progress.money),money);
    assert.equal(await p.evaluate(()=>barGame.progress.inventory.tuna_can||0),0);
    await p.locator('[data-choice="shop-no"]').click();
   }else{
    assert.equal(await p.evaluate(()=>barGame.progress.money),money-50);
    assert.equal(await p.evaluate(()=>barGame.progress.inventory.tuna_can),1);
    assert.equal(await p.evaluate(()=>LunaOutsideShop.choose(outsidePlaytest.model,'shop-buy-tuna_can')),false);
   }
   await finish();
   assert.equal(await p.evaluate(()=>!!outsidePlaytest.model.story.speech),false);
  }
  // First encounter still reaches stock only after Luna says she will browse.
  const first=await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;Object.assign(barGame.progress,{money:1000,inventory:{},flags:{}});m.start({day:1,flow:'out',place:'bar'});m.controlsTutorial=false;LunaOutsideShop.interact(m,LunaOutsideShop.targets(m)[0]);const lines=[];for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){lines.push(m.story.view().full);m.story.speech.elapsed=99;m.story.advance();}a.tick(0);return {lines,stage:m.story.speech.line.stage};});
  assert(first.lines.some(s=>s.includes('한번 보고 생각해 볼게요.')));assert.equal(first.stage,'items');
  assert.deepEqual(errors,[]);console.log('SHIBA_PURCHASE_FLOW_OK: greeting/browse/question/stock, day1-3, cancellation default, no funds, allowance, first meeting, single purchase and stale choice guard');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
