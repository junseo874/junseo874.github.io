const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  for(const width of [1280,820,1537]){
   await p.setViewportSize({width,height:900});
   await p.evaluate(()=>{barGame.reset(0,'practice',1);barGame.selectCocktail('gin_tonic');lunaCampaign.ui.recipeOpen=true;barGame.tutorial={kind:'prepRecipeRead'};lunaCampaign.render(true);});
   await p.waitForTimeout(250);
   await p.locator('[data-act="tutorialContinue"]').hover();
   const samples=await p.evaluate(async()=>{const out=[];for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const r=document.querySelector('.day0-guide-copy').getBoundingClientRect();out.push([r.x,r.y,r.width,r.height]);}return out;});
   for(let j=0;j<4;j++)assert(Math.max(...samples.map(r=>r[j]))-Math.min(...samples.map(r=>r[j]))<1,'Guide stable '+width);
   await p.evaluate(()=>{barGame.tutorial=null;lunaCampaign.ui.recipeOpen=false;barGame.prep.ingredients=['gin','soda_water'];lunaCampaign.render(true);});
   const slot=p.locator('.prep-inventory button[data-id="gin"]'),tip=p.locator('.inventory-pointer-tip');
   await slot.hover();await tip.waitFor({state:'visible'});
   assert.equal(await tip.innerText(),await p.evaluate(()=>barGame.name('gin')));
   const box=await slot.boundingBox();await p.mouse.move(box.x+box.width*.3,box.y+box.height*.3);
   const a=await tip.boundingBox();await p.mouse.move(box.x+box.width*.3+8,box.y+box.height*.3+6);
   const b=await tip.boundingBox();assert(Math.abs(b.x-a.x-8)<1&&Math.abs(b.y-a.y-6)<1,'Tip follows mouse');
   const stage=await p.locator('.prep-screen').boundingBox();assert(b.x>=stage.x&&b.y>=stage.y&&b.x+b.width<=stage.x+stage.width&&b.y+b.height<=stage.y+stage.height);
   await p.mouse.move(1,1);await tip.waitFor({state:'hidden'});
  }
  assert.deepEqual(errors,[]);console.log('PREP_GUIDE_INVENTORY_OK: stable guide and cursor-following name-only inventory tooltip at three sizes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
