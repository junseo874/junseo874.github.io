const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.selectCocktail('gin_tonic');lunaCampaign.ui.tab='liquor';lunaCampaign.render(true);});
  await p.waitForTimeout(600);
  const gin=p.locator('.shelf-item[data-id="gin"]'),tip=p.locator('#ingredient-tip');
  await gin.hover();await tip.waitFor();
  assert.equal(await tip.locator('strong').textContent(),await p.evaluate(()=>barGame.name('gin')));
  assert.equal(await tip.locator('span').textContent(),await p.evaluate(()=>barGame.text(barGame.t.shelf_items.find(i=>i.id==='gin'),'desc')));
  assert.equal(await tip.evaluate(e=>getComputedStyle(e,'::after').content),'none');
  const r=await gin.boundingBox();await p.mouse.move(r.x+r.width*.4,r.y+r.height*.5);
  const a=await tip.boundingBox();await p.mouse.move(r.x+r.width*.4+8,r.y+r.height*.5+10);
  const c=await tip.boundingBox();assert(Math.abs(c.x-a.x-8)<2);assert(Math.abs(c.y-a.y-10)<2);
  await p.waitForTimeout(250);const stable=await tip.boundingBox();assert(Math.abs(stable.x-c.x)<1,'Render preserves pointer position');
  await p.screenshot({path:'/private/tmp/luna-ingredient-pointer.png'});
  // Clicking focuses the shelf button without moving the pointer. Both focus
  // and the selected-state redraw must preserve the existing tooltip anchor.
  await p.mouse.down();
  const focused=await tip.boundingBox();
  assert(Math.abs(focused.x-stable.x)<1&&Math.abs(focused.y-stable.y)<1,'Mouse focus must not move the hovered description');
  await p.mouse.up();await p.waitForTimeout(100);
  const selected=await tip.boundingBox();
  assert(Math.abs(selected.x-stable.x)<1&&Math.abs(selected.y-stable.y)<1,'Selection redraw must preserve the hovered description');
  assert((await p.evaluate(()=>barGame.prep.ingredients)).includes('gin'));
  const other=p.locator('.shelf-slide[data-current="true"] .shelf-item:not([data-id="gin"])').first();
  await other.hover();const otherBefore=await tip.boundingBox();
  await p.mouse.down();const otherFocused=await tip.boundingBox();
  assert(Math.abs(otherFocused.x-otherBefore.x)<1&&Math.abs(otherFocused.y-otherBefore.y)<1,'Blurring the previous ingredient must not clear the newly hovered pointer');
  await p.mouse.up();
  await p.mouse.move(2,2);await p.waitForTimeout(100);assert.equal(await tip.count(),0);
  await p.locator('[data-act="prepBack"]').focus();await gin.focus();await tip.waitFor();assert(await tip.isVisible(),'Keyboard focus fallback');
  await p.locator('[data-act="tab"][data-id="fridge"]').click();await p.waitForTimeout(600);
  for(const viewport of [{width:1440,height:900},{width:820,height:650}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(200);
   const items=p.locator('.shelf-slide[data-current="true"] .shelf-item');
   for(let i=0;i<await items.count();i++){
    await items.nth(i).hover();const t=await tip.boundingBox(),bounds=await p.locator('.prep-screen').boundingBox();
    assert(t.x>=bounds.x-1&&t.y>=bounds.y-1);assert(t.x+t.width<=Math.min(viewport.width,bounds.x+bounds.width)+1);assert(t.y+t.height<=Math.min(viewport.height,bounds.y+bounds.height)+1);
   }
  }
  await p.evaluate(()=>{barGame.overlay='settings';lunaCampaign.render(true);});await p.waitForTimeout(100);assert.equal(await tip.count(),0);
  assert.deepEqual(errors,[]);console.log('PASS ingredient pointer tooltip: follow, compact/no tail, content, selection, leave/focus, desktop/compact bounds, overlay hide.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
