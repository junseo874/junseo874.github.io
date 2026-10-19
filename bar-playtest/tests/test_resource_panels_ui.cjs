const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[],bad=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  const reset=()=>p.evaluate(()=>{barGame.reset(99,'practice',1);barGame.screen='bar';lunaCampaign.render(true);});
  await reset();await p.locator('.service-handle').click();
  await p.locator('#service-panel').waitFor();await p.waitForTimeout(250);
  const recipe=p.locator('#service-panel [data-act="recipes"]');await recipe.hover();await p.waitForTimeout(250);
  assert((await recipe.evaluate(e=>getComputedStyle(e).backgroundImage)).includes('BTN_service_B.png'));
  const time=await p.evaluate(()=>barGame.barTime);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>barGame.barTime),time);
  await p.screenshot({path:'/private/tmp/luna-service-resources.png'});
  await recipe.click();await p.locator('.resource-recipe-list').waitFor();
  const card=p.locator('.recipe-card[data-id="dry_martini"]');await card.hover();await p.waitForTimeout(150);
  assert((await card.evaluate(e=>getComputedStyle(e).backgroundImage)).includes('BTN_recipe_choice_B.png'));
  assert.equal(await card.evaluate(e=>getComputedStyle(e).backgroundSize),'100% 100%');
  await p.screenshot({path:'/private/tmp/luna-recipe-resources.png'});
  for(const viewport of [{width:1440,height:900},{width:820,height:650}]){
   await p.setViewportSize(viewport);await p.waitForTimeout(200);
   const shell=await p.locator('.app-shell').boundingBox(),list=await p.locator('.resource-recipe-list').boundingBox(),preview=await p.locator('.recipe-preview').boundingBox();
   assert(list.x>=shell.x-1&&preview.x>=list.x+list.width-1);assert(preview.x+preview.width<=shell.x+shell.width+1);assert(preview.y+preview.height<=shell.y+shell.height+1);
   await p.locator('.recipe-list').evaluate(e=>e.scrollTop=e.scrollHeight);await p.waitForTimeout(150);assert(await p.locator('.recipe-list').evaluate(e=>e.scrollTop>0));
   await card.focus();await p.waitForTimeout(100);assert(await p.locator('.recipe-preview').isVisible());
  }
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>barGame.screen),'bar');assert.equal(await p.evaluate(()=>barGame.overlay),null);
  await p.locator('.service-handle').click();await p.locator('#service-panel [data-act="sales"]').click();assert.equal(await p.evaluate(()=>barGame.overlay),'sales');await p.keyboard.press('Escape');
  await p.locator('.service-handle').click();await p.locator('#service-panel [data-act="dossierOpen"]').click();assert.equal(await p.evaluate(()=>barGame.overlay),'dossier');await p.keyboard.press('Escape');
  await p.locator('.service-handle').click();await p.locator('#service-panel .resource-close').click();assert.equal(await p.evaluate(()=>barGame.overlay),null);
  await p.locator('.service-handle').click();await p.locator('#service-panel [data-act="recipes"]').click();await card.click();assert.equal(await p.evaluate(()=>barGame.screen),'prep');
  await p.evaluate(()=>{barGame.reset(0,'practice',1);lunaCampaign.render(true);});await p.locator('.recipe-card.locked').first().waitFor();assert(await p.locator('.recipe-card.locked').first().isDisabled());
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  console.log('PASS supplied UI resources: service/recipe hover art, pause, preview, scroll, compact layout, ESC/close, sales/profile routes, recipe selection and locked cards.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
