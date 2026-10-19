const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  for(const storage of ['empty','legacy','invalid','denied']){
   const context=await browser.newContext({viewport:{width:1280,height:720}}),p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(storage=>{
    if(storage==='legacy')localStorage.setItem('luna.shake.mode.v1','fall');
    if(storage==='invalid')localStorage.setItem('luna.shake.mode.v2','invalid');
    if(storage==='denied'){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key.startsWith('luna.shake.mode'))throw Error('Storage unavailable');return get.call(this,key);};}
   },storage);
   await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
   if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
   assert.equal(await p.evaluate(()=>lunaCampaign.ui.shakeMode),'path',storage);
   await p.locator('[data-act="miniStart"][data-id="shake"]').click();
   assert.deepEqual(await p.evaluate(()=>({mode:barGame.gimmick.rhythm.mode,lesson:barGame.gimmick.mixTutorial.mode,page:barGame.gimmick.mixTutorial.page})),{mode:'path',lesson:'path',page:0});
   assert((await p.locator('.mix-guide-image image').getAttribute('href')).includes('path-0'));
   assert((await p.locator('.mix-tutorial').innerText()).includes('SPACE'));
   await p.keyboard.press('KeyE');await p.keyboard.press('KeyE');
   assert.deepEqual(await p.locator('[data-act="shakeMode"]').evaluateAll(es=>es.map(e=>[e.dataset.id,e.querySelector('small').textContent])),[['path','01'],['fall','02'],['cross','03']]);
   if(storage==='legacy'){
    await p.screenshot({path:'/private/tmp/shake-default-path.png'});
    await p.locator('[data-act="shakeMode"][data-id="fall"]').click();
    assert.equal(await p.evaluate(()=>localStorage.getItem('luna.shake.mode.v2')),'fall');
    await p.reload();await p.waitForFunction(()=>window.lunaCampaign?.ui);assert.equal(await p.evaluate(()=>lunaCampaign.ui.shakeMode),'fall','Explicit new preference persists');
    await p.evaluate(()=>{lunaCampaign.session.active=true;lunaCampaign.session.developer=false;lunaCampaign.screen('game');const g=barGame;g.reset(99,'practice',1);g.selectCocktail('gin_fizz');g.debugFill();g.startCraft();g.craft.index=g.craft.queue.findIndex(s=>s.type==='shake');g.nextGimmick();lunaCampaign.render(true);});
    assert.equal(await p.evaluate(()=>barGame.gimmick.rhythm.mode),'path','Main story stays path despite optional preference');
    assert.equal(await p.locator('[data-act="shakeMode"]').count(),0);
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  const p=await browser.newPage({viewport:{width:1500,height:950}});
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
  await p.waitForFunction(()=>window.resourceReview?.ready);
  for(const miss of [false,true]){
   await p.evaluate(async miss=>{await resourceReview.launch({type:'effect',id:'shake',hits:1,miss},'Test','');},miss);
   const state=await p.locator('#game').evaluate(e=>{const s=e.contentWindow.barGame.gimmick;return {mode:s.rhythm.mode,success:s.success,failures:s.failures,message:s.message};});
   assert.deepEqual(state,{mode:'path',success:1,failures:miss?1:0,message:miss?'MISS':'GOOD'});
   await p.evaluate(()=>resourceReview.close());
  }
  await p.evaluate(async()=>{document.querySelector('#game').contentWindow.lunaCampaign.ui.shakeMode='fall';await resourceReview.launch({type:'mini',id:'shake'},'Test','');});
  assert.equal(await p.locator('#game').evaluate(e=>e.contentWindow.barGame.gimmick.rhythm.mode),'path');
  console.log('PASS path default, old-setting migration, storage fallback, 01/02/03 order, popup image/input, explicit preference, story lock and resource examples');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
