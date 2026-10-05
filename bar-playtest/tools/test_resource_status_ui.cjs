const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1500,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 const chip=id=>p.locator('#resource-filters [data-status="'+id+'"]'),ids=()=>p.locator('#grid .card').evaluateAll(cs=>cs.map(c=>c.dataset.id));
 assert.equal(await p.locator('#status').count(),0);assert.equal(await p.locator('[data-status]').count(),9);
 const colors=await p.locator('[data-status] i').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));assert.equal(new Set(colors).size,9);
 await p.click('[data-group="bar-ui"]');await chip('revision').click();assert.equal((await ids()).length,4);assert.equal(await p.locator('#grid .revision-tag').count(),4);assert.equal(await chip('revision').getAttribute('aria-pressed'),'true');
 await p.click('[data-facet="topic"][data-value="gimmick"]');assert.deepEqual((await ids()).sort(),['ui:mini:shake','ui:mini:stir']);assert.equal(await chip('revision').locator('span').innerText(),'2');
 await p.fill('#search','스터');assert.deepEqual(await ids(),['ui:mini:stir']);await p.fill('#search','');
 await p.click('[data-group="bar-items"]');assert.equal(await chip('all').getAttribute('aria-pressed'),'true');await chip('registered').click();assert((await ids()).length>0);assert((await p.locator('#grid .badge').allTextContents()).every(s=>s==='등록됨'));
 await p.click('[data-group="bar-ui"]');assert.equal(await chip('revision').getAttribute('aria-pressed'),'true');assert.equal((await ids()).length,2);await p.click('[data-filter-reset]');assert.equal(await chip('all').getAttribute('aria-pressed'),'true');
 await chip('uiArt').focus();await p.keyboard.press('Space');assert.equal((await ids()).length,11);assert.equal(await p.evaluate(()=>document.activeElement.dataset.status),'uiArt');
 await chip('all').click();await p.screenshot({path:'/private/tmp/resource-status-desktop.png'});
 await p.fill('#search','no-such-resource');assert.equal((await ids()).length,0);assert(await chip('all').isEnabled());await p.click('[data-filter-reset]');
 await p.click('[data-group="bar-serve"]');await chip('missing').click();assert.equal((await ids()).length,10);assert(await chip('revision').isDisabled());await chip('registered').click();assert.equal((await ids()).length,5);
 await p.setViewportSize({width:390,height:844});await p.click('[data-group="bar-ui"]');await chip('revision').click();assert.equal((await ids()).length,4);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('.status-row').scrollIntoViewIfNeeded();await p.screenshot({path:'/private/tmp/resource-status-mobile.png'});
 assert.deepEqual(errors,[]);console.log('RESOURCE_STATUS_OK color chips, exact counts, revision + facets + search, keyboard, per-category retention, reset, mobile');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
