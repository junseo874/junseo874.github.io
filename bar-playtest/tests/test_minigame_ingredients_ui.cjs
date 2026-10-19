const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.locator('.minigame-lobby').waitFor();
 async function open(kind='pour'){await p.locator(`[data-act="miniStart"][data-id="${kind}"]`).click();await p.locator('.mini-ingredient-modal').waitFor();assert.equal(await p.evaluate(()=>barGame.minigame),null);}
 async function lobby(){await p.keyboard.press('Escape');await p.locator('[data-act="miniExit"], [data-act="miniLobby"]').first().click();await p.locator('.minigame-lobby').waitFor();}
 await open();const ids=await p.locator('.mini-ingredient-card').evaluateAll(es=>es.map(e=>e.dataset.id));assert(ids.length>=22);
 await p.waitForFunction(()=>[...document.querySelectorAll('.mini-ingredient-card img')].every(i=>i.complete&&i.naturalWidth>0));
 for(const size of [[1280,720],[960,540],[1440,1000]]){await p.setViewportSize({width:size[0],height:size[1]});await p.waitForTimeout(200);const box=await p.locator('.mini-ingredient-modal').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=size[0]+1&&box.y+box.height<=size[1]+1);}
 await p.setViewportSize({width:1280,height:720});await p.screenshot({path:'/private/tmp/minigame-ingredient-picker.png'});
 await p.locator('.mini-ingredient-modal footer button').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'miniIngredientCancel');
 await p.keyboard.press('Escape');assert.equal(await p.locator('.mini-ingredient-modal').count(),0);assert.equal(await p.evaluate(()=>document.activeElement.dataset.id),'pour');assert.equal(await p.evaluate(()=>barGame.minigame),null);
 for(const id of ids){await open();await p.locator(`[data-act="miniIngredient"][data-id="${id}"]`).click();await p.locator('[data-pour-ingredient]').waitFor();assert.equal(await p.evaluate(()=>barGame.gimmick.ingredient),id);assert.equal(await p.locator('.mini-ingredient-modal').count(),0);assert.equal(await p.locator('[data-pour-ingredient]').getAttribute('data-pour-ingredient'),id);await lobby();}
 await open('fill_up');assert.equal(await p.locator('.mini-ingredient-card').count(),3);await p.locator('[data-act="miniIngredient"][data-id="cola"]').focus();await p.keyboard.press('Enter');await p.locator('[data-pour-ingredient]').waitFor();assert.equal(await p.evaluate(()=>barGame.gimmick.ingredient),'cola');await lobby();
 await open();await p.locator('.mini-ingredient-modal footer button').click();assert.equal(await p.evaluate(()=>barGame.minigame),null);
 for(const kind of ['open','shake','stir']){await p.locator(`[data-act="miniStart"][data-id="${kind}"]`).click();assert.equal(await p.evaluate(()=>barGame.gimmick.type),kind);assert.equal(await p.locator('.mini-ingredient-modal').count(),0);await lobby();}
 assert.deepEqual(errors,[]);console.log('PASS ingredient popup, all previews/selections, cancel/Esc, focus, keyboard, fill-up, other skills and 3 viewports');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
