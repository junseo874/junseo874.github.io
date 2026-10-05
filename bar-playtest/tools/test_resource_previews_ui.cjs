const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 const roster=await p.evaluate(()=>resourceReview.rows.filter(r=>r.id.startsWith('actor:')).map(r=>r.id.split(':')[1]));
 for(const id of ['haru','sunha','hina','rios','volts','hound','soldier'])assert(!roster.includes(id),id+' must be excluded');
 for(const id of ['chris','port','aili','samho','tom','shiba','bubi'])assert(roster.includes(id),id+' must remain');
 for(const id of ['luna','johnny'])assert(!roster.includes(id),id+' has no bar art');
 assert(await p.evaluate(()=>resourceReview.rows.filter(r=>r.id.startsWith('actor:bubi:')).every(r=>r.usage.includes('등장 예정'))));
 const result=await p.evaluate(async()=>{const rows=resourceReview.rows.filter(r=>['bar-ui','out-ui'].includes(r.group)&&r.launch),bad=[];await Promise.all(rows.map(r=>new Promise(resolve=>{const im=new Image();im.onload=()=>{if(im.naturalWidth<600||im.naturalHeight<300)bad.push(r.id);resolve();};im.onerror=()=>{bad.push(r.id);resolve();};im.src=r.preview;})));return{count:rows.length,bad};});assert(result.count>20&&result.count<60);assert.deepEqual(result.bad,[]);
 for(const group of ['bar-ui','out-ui']){await p.click('[data-group="'+group+'"]');await p.locator('.ui-shot').first().waitFor();await p.waitForTimeout(350);assert(await p.locator('.ui-shot').first().evaluate(im=>im.complete&&im.naturalWidth>0));await p.screenshot({path:'/private/tmp/resource-previews-'+group+'.png'});}
 for(const id of ['entry-hint','settings','console'])assert(!await p.evaluate(id=>resourceReview.rows.some(r=>r.id==='ui:exterior:'+id),id),id+' removed from catalog only');
 await p.evaluate(()=>resourceReview.select('ui:world-speech'));assert(await p.locator('.ui-preview img').isVisible());assert((await p.locator('.ui-preview figcaption').innerText()).includes('정적 미리보기'));
 await p.click('[data-action="launch"]');const f=p.frames().find(f=>f.url().includes('resourceReview=1'));await f.waitForFunction(()=>!!outsidePlaytest.model.story.speech);await p.click('#close-lab');
 await p.evaluate(()=>resourceReview.launch({type:'exterior',id:'console'},'기능 보존 확인',''));await f.locator('.outside-dev-console').waitFor({state:'visible'});await p.click('#close-lab');
 await p.click('[data-group="bar-characters"]');await p.evaluate(()=>resourceReview.select(resourceReview.rows.find(r=>r.id.startsWith('actor:bubi:')).id));await p.waitForTimeout(200);assert(await p.locator('#preview-canvas').isVisible());await p.screenshot({path:'/private/tmp/resource-previews-cast.png'});
 await p.setViewportSize({width:390,height:844});await p.click('[data-group="bar-ui"]');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/resource-previews-mobile.png'});
 assert.deepEqual(errors,[]);console.log('RESOURCE_PREVIEWS_OK cast filter + planned Bubi, unique UI captures, card/detail/live UI, preserved animation preview, mobile layout');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
