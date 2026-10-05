const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 const f=()=>p.frames().find(f=>f.url().includes('resourceReview=1'));const parked=()=>p.waitForFunction(()=>document.querySelector('#lab').classList.contains('parked'));
 await p.click('[data-group="bar-items"]');await p.click('[data-facet="kind"][data-value="ingredient"]');await p.fill('#search','진');await p.locator('[data-id="item:gin:recipe"]').click();
 assert((await p.locator('#inspector').innerText()).includes('더미가 아니며'));assert.equal(await f().evaluate(()=>barData.assets.recipe_item_gin.src),await f().evaluate(()=>barData.assets.item_gin.src));
 await p.locator('[data-action="launch"]').click();await f().locator('[data-act="prepBack"]').waitFor();await f().locator('[data-act="prepBack"]').click();await parked();assert.equal(await p.locator('#search').inputValue(),'진');assert.equal(await p.evaluate(()=>resourceReview.selected.id),'item:gin:recipe');
 await p.evaluate(()=>resourceReview.launch({type:'prep-recipe'},'재료 상세',''));await p.waitForTimeout(200);const gin=await f().evaluate(()=>barData.assets.item_gin.src);assert(await f().locator('img[src="'+gin+'"]').count()>1);await p.screenshot({path:'/private/tmp/resource-reuse-recipe.png'});
 await p.goBack();await parked();assert(p.url().endsWith('resource-review.html'));await p.goForward();await p.waitForFunction(()=>!document.querySelector('#lab').classList.contains('parked'));await f().locator('[data-act="prepBack"]').waitFor();
 await p.locator('#close-lab').click();await parked();
 for(const [type,id,selector]of [['mini','open','[data-act="miniExit"]'],['recipes',null,'[data-act="closeRecipe"]'],['background','title','[data-campaign="picker"]:visible'],['exterior','settings','[data-outside-action="exit"]']]){await p.evaluate(({type,id})=>resourceReview.launch({type,id},'back test',''),{type,id});await f().locator(selector).click();await parked();assert(p.url().endsWith('resource-review.html'));}
 // Replay must not add history entries; Alt+Left in the iframe returns to the list.
 await p.evaluate(()=>resourceReview.launch({type:'mini',id:'pour'},'pour',''));await p.locator('#replay').click();await f().locator('[data-act="miniExit"]').waitFor();await f().locator('[data-act="miniExit"]').focus();await p.keyboard.press('Alt+ArrowLeft');await parked();
 await p.evaluate(()=>resourceReview.launch({type:'background',id:'title'},'title',''));await p.goBack();await parked();await p.goBack();assert(p.url().includes('?dev=1')&&!p.url().includes('resource-review'));
 // The normal game retains its own Back behavior, outside resource review.
 await p.waitForFunction(()=>window.lunaQA);await p.evaluate(()=>{document.querySelector('.updates-confirm')?.click();lunaQA.runSituation('prep');lunaCampaign.render(true);});await p.locator('[data-act="prepBack"]').click();assert.equal(await p.evaluate(()=>barGame.screen),'recipe');
 assert.deepEqual(errors,[]);console.log('RESOURCE_NAVIGATION_OK in-game back, browser back/forward, replay, Alt+Left, filter/selection retention, shared gin rendering, normal-game isolation');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
