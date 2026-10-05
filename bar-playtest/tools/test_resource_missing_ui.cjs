const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready&&resourceReview.missing);
const entries=await p.evaluate(()=>resourceReview.missing.entries);assert(entries.length>10);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
const pendingIds=['recipes','dossier','overlay:service','overlay:settings','overlay:history','overlay:johnnyUnlock','mini:shake','mini:stir','mini:pour','result'].map(id=>'ui:'+id);
const catalog=await p.evaluate(()=>resourceReview.rows);
assert.equal(catalog.filter(r=>r.uiArtPending).length,pendingIds.length);
for(const id of pendingIds){const r=catalog.find(r=>r.id===id);assert(r&&r.uiArtPending&&r.status==='missing'&&r.preview&&r.launch,id);assert(entries.some(e=>e.category==='ui'&&e.reasons.includes('uiArt')&&e.rows.some(x=>x.row.id===id)),id);}
for(const id of ['ui:updates','ui:qa-panel'])assert(!catalog.some(r=>r.id===id));
assert.equal(catalog.find(r=>r.id==='ui:choices').status,'code');
const passers=await p.evaluate(()=>resourceReview.rows.filter(r=>r.group==='out-characters'&&(/^outside:(M1|M2|W1)$/.test(r.id)||r.id.startsWith('outside-role:')&&/^행인(?:\s*\d+)?$/.test(r.title||''))).map(r=>r.id));
assert(passers.length>=7,'Passerby assets remain in the normal catalog');
assert(!entries.some(e=>e.rows.some(x=>passers.includes(x.row.id))),'Passerby excluded from missing list');
for(const id of ['bd-vendor','thug','resident-left','trade-smuggler']){assert(catalog.some(r=>r.id==='outside-role:'+id),id+' remains in full catalog');assert(!entries.some(e=>e.rows.some(x=>x.row.id==='outside-role:'+id)),id+' excluded from checklist');}
assert.deepEqual(entries.filter(e=>e.category==='character').map(e=>e.id).sort(),['character:actor:shiba','character:actor:tom','character:outside:terrace-chris']);
const terrace=catalog.find(r=>r.id==='outside:terrace-chris');assert(terrace.preview&&terrace.launch.type==='terrace'&&terrace.status==='missing');assert.equal(entries.find(e=>e.id==='character:outside:terrace-chris').area,'외부');assert(!entries.some(e=>e.rows.some(x=>x.row.id.startsWith('actor:chris:'))));
assert(!entries.some(e=>e.rows.some(x=>/^item:gin:/.test(x.row.id))));assert(entries.some(e=>e.rows.some(x=>x.row.id==='item:milk:shelf')));assert(!entries.some(e=>e.rows.some(x=>x.row.id==='bg:street:residence-building')));
console.log('GAPS',Object.fromEntries(['cocktail','item','character','background','ui','effect'].map(c=>[c,entries.filter(e=>e.category===c).length])));
await p.click('#missing-resources');assert(await p.locator('#missing-dialog').isVisible());assert.equal(await p.locator('[data-missing-category]').count(),7);assert.equal(await p.locator('#missing-list .missing-entry').count(),entries.length);assert.equal(await p.evaluate(()=>document.activeElement.id),'missing-search');
await p.waitForTimeout(350);await p.screenshot({path:'/private/tmp/resource-missing-all.png'});
await p.selectOption('#missing-reason','uiArt');assert.equal(await p.locator('#missing-list .missing-entry').count(),10);await p.screenshot({path:'/private/tmp/resource-ui-art-missing.png'});await p.click('#missing-reset');
for(const cat of ['cocktail','item','character','background','ui','effect']){await p.click('[data-missing-category="'+cat+'"]');assert.equal(await p.locator('#missing-list .missing-entry').count(),entries.filter(e=>e.category===cat).length);}
await p.click('[data-missing-category="item"]');await p.fill('#missing-search','우유');assert.equal(await p.locator('#missing-list .missing-entry').count(),1);assert((await p.locator('#missing-list').innerText()).includes('공용 더미 사용'));await p.locator('#missing-list summary').click();assert.equal(await p.locator('#missing-list .missing-detail').count(),3);await p.screenshot({path:'/private/tmp/resource-missing-item.png'});
const download=p.waitForEvent('download');await p.click('#missing-export');assert.equal((await download).suggestedFilename(),'unknown-missing-resources.csv');
await p.click('.missing-inspect');assert(!await p.locator('#missing-dialog').isVisible());assert.equal(await p.evaluate(()=>resourceReview.selected.id),'item:milk:shelf');assert.equal(await p.locator('[data-group="bar-items"]').getAttribute('aria-current'),'true');
await p.click('#missing-resources');await p.click('#missing-reset');await p.selectOption('#missing-area','외부');await p.selectOption('#missing-reason','sharedDummy');assert.equal(await p.locator('#missing-list .missing-entry').count(),0);assert(!(await p.locator('#missing-list').innerText()).includes('BD 칩'));
await p.fill('#missing-search','없는리소스검색');assert.equal(await p.locator('#missing-list .missing-entry').count(),0);assert(await p.locator('.missing-empty').isVisible());await p.click('#missing-reset');
await p.keyboard.press('Escape');assert(!await p.locator('#missing-dialog').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'missing-resources');
await p.setViewportSize({width:390,height:844});await p.click('#missing-resources');await p.click('[data-missing-category="character"]');await p.screenshot({path:'/private/tmp/resource-missing-mobile.png'});assert(await p.locator('#missing-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.click('#missing-close');assert(!await p.locator('#missing-dialog').isVisible());assert.deepEqual(errors,[]);
console.log('RESOURCE_MISSING_UI_OK',entries.length,'grouped gaps, category/search/reason/area filters, details, CSV, inspect navigation, Escape/focus, mobile');
await p.setViewportSize({width:1500,height:1000});await p.click('[data-group="bar-ui"]');await p.selectOption('#status','missing');
for(const id of pendingIds){const card=p.locator('#grid [data-id="'+id+'"]');assert(await card.isVisible());assert.equal(await card.locator('.badge').innerText(),'UI 아트 미제작');}
await p.locator('#grid [data-id="ui:recipes"]').click();assert((await p.locator('.ui-preview figcaption').innerText()).includes('미제작'));await p.screenshot({path:'/private/tmp/resource-ui-art-catalog.png'});
await p.locator('#inspector [data-action="launch"]').click();await p.waitForFunction(()=>!document.querySelector('#lab').classList.contains('parked')&&document.querySelector('#game').contentWindow.barGame.screen==='recipe');await p.click('#close-lab');assert.deepEqual(errors,[]);
console.log('RESOURCE_UI_ART_OK 10 confirmed UI art gaps, previews and recipe test retained, two catalog-only removals');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
