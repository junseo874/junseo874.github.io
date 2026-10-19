const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready&&resourceReview.missing);
 const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>/^item:orange_juice:/.test(r.id)));
 assert.equal(rows.length,3);for(const r of rows){assert.equal(r.layers[0].src,'assets/items/item-orange-juice.png');assert(['registered','shared'].includes(r.status));}
 assert(!await p.evaluate(()=>resourceReview.missing.entries.some(e=>e.rows.some(x=>/^item:orange_juice:/.test(x.row.id)))));
 assert.deepEqual(await p.evaluate(async()=>{const im=new Image();im.src='assets/items/item-orange-juice.png';await im.decode();return [im.naturalWidth,im.naturalHeight];}),[93,223]);
 await p.click('[data-group="bar-items"]');await p.fill('#search','오렌지');assert.equal(await p.locator('#grid .card').count(),3);await p.screenshot({path:'/private/tmp/orange-art-catalog.png'});
 await p.evaluate(()=>resourceReview.launch({type:'prep',id:'orange_juice'},'오렌지 주스 리소스 확인'));
 const f=p.frames().find(f=>f.url().includes('resourceReview=1')),bottle=f.locator('.shelf-item[data-id="orange_juice"] img');await bottle.waitFor({state:'visible'});assert((await bottle.getAttribute('src')).endsWith('assets/items/item-orange-juice.png'));
 await p.waitForTimeout(400);await p.screenshot({path:'/private/tmp/orange-art-shelf.png'});
 assert.deepEqual(errors,[]);console.log('ORANGE_ART_OK all usages match, alpha dimensions correct, catalog + live shelf, removed from missing list');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
