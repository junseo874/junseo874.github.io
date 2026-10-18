const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
 const inventory=await p.evaluate(()=>({tom:resourceReview.rows.filter(r=>r.id.startsWith('actor:tom:')),raw:resourceReview.rows.filter(r=>r.id.startsWith('ui-source:')).length,popups:resourceReview.rows.filter(r=>r.popupKind).length,files:resourceReview.rows.filter(ResourceLatest.isScreen).flatMap(r=>(r.variants||[{id:'default'}]).flatMap(v=>[ResourceLatest.screen(r,v.id),...(r.popupKind?[ResourceLatest.popup(r,v.id)]:[])]))}));
 assert.equal(inventory.raw,64);assert(inventory.popups>=24);assert(inventory.tom.every(r=>r.status==='registered'&&r.layers[0].src.endsWith('char-tom-idle-20261018.png')));
 for(const file of inventory.files){const png=fs.readFileSync(path.resolve(__dirname,'..',file.split('?')[0]));assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a',file);assert(png.readUInt32BE(16)>0&&png.readUInt32BE(20)>0,file);}
 await p.click('[data-group="common-popups"]');await p.evaluate(()=>resourceReview.select('popup:controls-interaction'));
 await p.selectOption('#inspect-state','interaction');
 let link=p.locator('#inspect-downloads a').first();assert((await link.getAttribute('href')).split('?')[0].endsWith('popup_controls-interaction--interaction--popup.png'));
 let saved=p.waitForEvent('download');await link.click();let d=await saved;assert.equal(d.suggestedFilename(),'popup_controls-interaction--interaction--popup.png');assert.equal(await d.failure(),null);
 const png=fs.readFileSync(await d.path());assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
 const alpha=await p.evaluate(async()=>{const im=new Image();im.src=document.querySelector('#inspect-downloads a').href;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,1,1).data[3];});assert(alpha<255,'Popup-only PNG must not have an opaque browser background');
 await p.click('[data-action="launch"]');
 const f=p.frames().find(f=>f.url().includes('resourceReview=1'));await f.locator('.outside-controls-tutorial[data-step="1"]').waitFor();
 await p.locator('[data-popup="popup:controls"]').click();
 await f.locator('.outside-controls-tutorial[data-step="0"]').waitFor();
 await p.waitForFunction(()=>document.querySelector('#lab-downloads a')?.href.includes('movement--popup.png'));
 await p.click('#close-lab');
 await p.click('[data-group="bar-ui"]');await p.evaluate(()=>resourceReview.select('ui-source:assets/ui/preparation/BTN_start.png'));
 saved=p.waitForEvent('download');await p.locator('#inspect-downloads a').click();d=await saved;
 assert(fs.readFileSync(await d.path()).equals(fs.readFileSync(path.resolve(__dirname,'../assets/ui/preparation/BTN_start.png'))));
 await p.click('[data-group="bar-characters"]');await p.evaluate(()=>resourceReview.select('actor:tom:idle_default'));
 assert((await p.locator('#inspect-downloads a').getAttribute('href')).endsWith('char-tom-idle-20261018.png'));
 await p.setViewportSize({width:390,height:844});await p.click('[data-group="common-popups"]');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS',inventory.files.length,'PNG files;',inventory.popups,'popup groups; raw UI sources, state-specific downloads, original byte preservation, latest Tom and mobile layout');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
