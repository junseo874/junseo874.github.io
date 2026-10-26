const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});await outsidePlaytest.start();});
 for(const inventory of [{},{tuna_can:1},{bitters:1},{bitters:1,tuna_can:1}])for(const money of [1000,0]){
  await p.evaluate(({inventory,money})=>{
   const a=outsidePlaytest,m=a.model;Object.assign(barGame.progress,{money,inventory,flags:{shiba_shop_met:true}});
   m.start({day:2,flow:'out',place:'bar'});m.x=-2.87;m.controlsTutorial=false;m.updateNear();
   LunaOutsideShop.openStock(m,m.near);
   for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}
   if(m.story.speech?.line.stage==='allowance')m.story.choose('shop-allowance-no');
   a.snapCamera();a.tick(0);
  },{inventory,money});
  const buttons=p.locator('.world-choices button');await buttons.first().waitFor({state:'visible'});
  assert.equal(await buttons.first().getAttribute('data-choice'),'shop-no');assert.equal(await buttons.first().textContent(),'구매하지 않는다.');
  assert.equal(await p.locator('.world-choices button.is-selected').getAttribute('data-choice'),'shop-no');
  assert.equal(await p.locator('[data-choice="shop-buy-tuna_can"]').count(),inventory.tuna_can?0:1);
  await p.waitForTimeout(550);await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.view().full),'뭐야. 그럼 꺼져.');
  assert.deepEqual(await p.evaluate(()=>({money:barGame.progress.money,inventory:barGame.progress.inventory})),{money,inventory});
  // Reopening after choosing another row must reset focus to cancellation.
  await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.story.cancel();LunaOutsideShop.openStock(m,LunaOutsideShop.targets(m)[0]);for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}if(m.story.speech?.line.stage==='allowance')m.story.choose('shop-allowance-no');a.tick(0);});
  assert.equal(await p.locator('.world-choices button.is-selected').getAttribute('data-choice'),'shop-no');
  if(await buttons.count()>1){await p.keyboard.press('ArrowDown');assert.notEqual(await p.locator('.world-choices button.is-selected').getAttribute('data-choice'),'shop-no');}
  await p.evaluate(()=>{outsidePlaytest.model.story.cancel();outsidePlaytest.tick(0);});
 }
 assert.deepEqual(errors,[]);console.log('SHIBA_CANCEL_FIRST_OK: default/reopen, tuna/bitters/sold-out, insufficient funds, Enter cancels without spending, navigation retained');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
