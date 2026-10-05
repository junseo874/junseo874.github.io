const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready&&resourceReview.missing);
 const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>/^item:tequila:/.test(r.id)));
 assert.equal(rows.length,3);for(const r of rows){assert.equal(r.layers[0].src,'assets/tequila-registered.png');assert(['registered','shared'].includes(r.status));}
 assert(!await p.evaluate(()=>resourceReview.missing.entries.some(e=>e.rows.some(x=>/^item:tequila:/.test(x.row.id)))));
 const img=await p.evaluate(async()=>{const im=new Image();im.src='assets/tequila-registered.png';await im.decode();return [im.naturalWidth,im.naturalHeight];});assert.deepEqual(img,[57,171]);
 await p.evaluate(()=>resourceReview.launch({type:'prep',id:'tequila'},'데킬라 실제 리소스 확인'));
 const game=p.frameLocator('#game'),bottle=game.locator('.shelf-item[data-id="tequila"] img');
 await bottle.waitFor({state:'visible'});assert((await bottle.getAttribute('src')).endsWith('assets/tequila-registered.png'));
 await p.waitForTimeout(650);await p.screenshot({path:'/private/tmp/tequila-registered-shelf.png'});
 assert.deepEqual(errors,[]);console.log('TEQUILA_ART_UI_OK registered image loaded, 3 usages aligned, no missing gap, live shelf verified');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
