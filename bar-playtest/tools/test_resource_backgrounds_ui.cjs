const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1600,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready,{},{timeout:60000});
 const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>r.backgroundScreen));assert(rows.length>45);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 const missing=await p.evaluate(async rows=>(await Promise.all(rows.flatMap(r=>r.layers).map(l=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im.naturalWidth?null:l.key);im.onerror=()=>resolve(l.key);im.src=l.src;})))).filter(Boolean),rows);assert.deepEqual(missing,[]);
 assert(rows.some(r=>r.title.includes('거주 빌딩')));assert(!rows.some(r=>r.title==='1F Left Building'));assert(!rows.some(r=>/experiment_recruit|poster_help_wanted|SAMHO|ambient-/.test(r.title)));
 assert.equal(rows.filter(r=>r.backgroundScreen==='컷씬'&&r.status==='dummy').length,3);
 const group=key=>p.locator('[data-group="'+key+'-backgrounds"]').click();
 for(const area of ['bar','out']){await group(area);assert(await p.locator('[data-facet="backgroundScreen"]').count()>3);assert(await p.locator('#grid .card').count()>15);}
 await group('bar');await p.locator('[data-facet="backgroundScreen"][data-value="재료 담기"]').click();assert.equal(await p.locator('#grid .card').count(),4);await p.locator('[data-filter-reset]').click();
 await p.locator('[data-id="bg:bar-composite"]').click();await p.waitForTimeout(300);const initial=await p.locator('#preview-canvas').evaluate(c=>c.toDataURL());await p.locator('[data-layer="bar_front"]').uncheck();assert.notEqual(await p.locator('#preview-canvas').evaluate(c=>c.toDataURL()),initial);await p.locator('[data-layer="bar_front"]').check();
 await p.screenshot({path:'/private/tmp/resource-backgrounds-bar.png'});
 await group('out');await p.locator('[data-id="bg:street-composite"]').click();await p.waitForTimeout(800);await p.screenshot({path:'/private/tmp/resource-backgrounds-street.png'});
 assert(await p.locator('#preview-canvas').evaluate(c=>c.width>2000&&c.height>1000));const before=await p.locator('#preview-canvas').evaluate(c=>c.toDataURL());await p.locator('[data-layer^="residence-building"]').uncheck();assert.notEqual(await p.locator('#preview-canvas').evaluate(c=>c.toDataURL()),before);
 await p.locator('[data-id="bg:cinema-stage3"]').click();await p.waitForTimeout(200);await p.screenshot({path:'/private/tmp/resource-backgrounds-cinema.png'});
 for(const row of rows.filter(r=>r.launch?.type==='background')){await p.evaluate(r=>resourceReview.launch(r.launch,r.title,r.note),row);const f=p.frames().find(f=>f.url().includes('resourceReview=1'));assert.equal(await p.locator('#lab-note').evaluate(e=>e.classList.contains('error')),false);if(row.launch.id==='shelf'){const tab=row.launch.tab;assert.equal(await f.locator('.shelf-slide[data-current="true"] .shelf-scene').getAttribute('data-category'),tab);}else assert.equal(await f.evaluate(()=>lunaCampaign.view),row.launch.id);await p.evaluate(()=>resourceReview.close());}
 await p.setViewportSize({width:390,height:844});await group('bar');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('RESOURCE_BACKGROUNDS_OK',rows.length,'rows, all images, filters, composites, layer toggles, shelf/title launch, mobile');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
