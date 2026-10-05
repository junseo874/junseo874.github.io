const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1600,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 const facet=(key,value)=>p.locator('[data-facet="'+key+'"][data-value="'+value+'"]');
 const ids=()=>p.locator('#grid .card').evaluateAll(cs=>cs.map(c=>c.dataset.id));
 const group=id=>p.locator('[data-group="'+id+'"]').click();
 await group('bar-drinks');assert.equal((await ids()).length,45);await facet('usage','table').click();assert.equal((await ids()).length,15);assert((await ids()).every(id=>id.endsWith(':table')));assert.equal(await facet('usage','table').getAttribute('aria-pressed'),'true');
 await facet('usage','recipe').focus();await p.keyboard.press('Space');assert((await ids()).every(id=>id.endsWith(':recipe')));await p.fill('#search','진토닉');assert.equal((await ids()).length,1);await p.locator('[data-filter-reset]').click();assert.equal((await ids()).length,45);
 await p.screenshot({path:'/private/tmp/resource-filters-drinks.png'});
 await group('bar-items');await facet('kind','glass').click();await facet('usage','inventory').click();assert.equal((await ids()).length,6);assert((await ids()).every(id=>id.endsWith(':inventory')));
 await facet('kind','tool').click();assert.equal((await ids()).length,3);assert((await ids()).some(id=>id.includes(':opener:')));await facet('usage','recipe').click();assert((await ids()).every(id=>id.endsWith(':recipe')));
 await p.screenshot({path:'/private/tmp/resource-filters-items.png'});
 await group('bar-characters');await facet('actor','톰 거너').click();await facet('motion','idle').click();await facet('media','static').click();assert((await ids()).every(id=>id.startsWith('actor:tom:')));assert.equal((await ids()).length,2);assert(await facet('media','animation').isDisabled());
 await p.locator('[data-filter-reset]').click();await facet('motion','idle').click();await facet('media','animation').click();assert((await ids()).length>0);assert((await ids()).every(id=>!id.startsWith('actor:tom:')));
 await facet('actor','크리스').click();assert((await ids()).every(id=>id.startsWith('actor:chris:')));assert.equal((await ids()).length,2);await p.screenshot({path:'/private/tmp/resource-filters-characters.png'});
 // Search/status intersect with tabs; empty results can always reset, and selections persist per group.
 await p.fill('#search','없는리소스');assert.equal((await ids()).length,0);assert(await facet('motion','idle').isEnabled());await p.locator('[data-filter-reset]').click();assert((await ids()).length>20);
 await group('bar-items');assert.equal(await facet('kind','tool').getAttribute('aria-pressed'),'true');assert.equal(await facet('usage','recipe').getAttribute('aria-pressed'),'true');await p.locator('[data-filter-reset]').click();
 await p.selectOption('#status','attention');await facet('kind','ingredient').click();assert((await ids()).length>0);await p.locator('[data-filter-reset]').click();
 await group('out-characters');await facet('motion','run').click();await facet('media','animation').click();assert((await ids()).length>0);assert(await p.locator('#grid').innerText().then(s=>!s.includes('하운드')));await p.screenshot({path:'/private/tmp/resource-filters-outside.png'});
 await group('bar-serve');assert(await facet('media','animation').isVisible());
 await group('bar-ui');await facet('topic','gimmick').click();assert.equal((await ids()).length,5);assert.equal(await p.locator('.ui-shot').count(),5);await p.locator('#grid .card').first().click();assert(await p.locator('.ui-preview').isVisible());
 await facet('topic','art').click();assert((await ids()).every(id=>id.startsWith('ui-art:')));assert.equal(await p.locator('.ui-preview').count(),0);
 await group('out-ui');await facet('topic','transition').click();assert.equal((await ids()).length,3);await p.screenshot({path:'/private/tmp/resource-filters-ui.png'});
 await p.setViewportSize({width:390,height:844});await group('bar-characters');await p.locator('#resource-filters').scrollIntoViewIfNeeded();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/resource-filters-mobile.png'});
 assert.deepEqual(errors,[]);console.log('RESOURCE_FILTERS_OK all 7 groups, facets/counts/intersections, static Tom vs animated idle, keyboard, search/status/reset, group memory, UI previews, mobile');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
