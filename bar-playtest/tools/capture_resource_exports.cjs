// Rebuild current UI snapshots and transparent popup-only PNGs using real renderers.
// LUNA_EXPORT_MATCH can select IDs for a targeted refresh after the initial run.
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
const path=require('node:path'),fs=require('node:fs');
const out=path.resolve(__dirname,'../assets/reference/exports');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1800,height:1100}}),exportPage=await browser.newPage({viewport:{width:1280,height:720}});let errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
 // Same origin is required for the game's bundled font (about:blank would
 // make its TTF request cross-origin and silently fall back to a system font).
 await exportPage.goto('http://127.0.0.1:8123/bar-playtest/story-guide.html');
 await p.addStyleTag({content:'.frame-wrap,.lab.parked .frame-wrap,.lab.popup-mode .frame-wrap{width:1280px!important;height:720px!important;max-width:none!important;border:0!important}.popup-layout{max-width:none!important}.lab{overflow:auto!important}'});
 const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
 await f.addStyleTag({content:'.qa-launch{display:none!important}'});
 const items=await p.evaluate(()=>resourceReview.rows.filter(ResourceLatest.isScreen).flatMap(r=>(r.variants||[{id:'default',launch:r.launch}]).map(v=>({id:r.id,title:r.title,note:r.note,popup:!!r.popupKind,file:ResourceLatest.stem(r,v.id),selector:ResourceLatest.selector(r,v.launch),d:{...v.launch,reviewId:r.id,variantId:v.id,...(r.popupKind?{popupId:r.id}: {})}}))));
 const selected=items.filter(r=>(!process.env.LUNA_EXPORT_POPUPS||r.popup)&&(!process.env.LUNA_EXPORT_MATCH||new RegExp(process.env.LUNA_EXPORT_MATCH).test(r.id))),failures=[];
 for(const [i,r]of selected.entries()){
  errors=[];
  try{
   await p.evaluate(r=>resourceReview.launch(r.d,r.title,r.note),r);
   const note=await p.locator('#lab-note').evaluate(e=>e.classList.contains('error')?e.textContent:null);if(note)throw Error(note);
   await f.evaluate(()=>document.fonts.ready);
   if(r.d.type==='review-serving'&&r.d.id==='coaster')await f.waitForFunction(()=>barGame.storyCoasterReady()&&!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
   if(r.d.type==='serve'){
    await f.locator('.serve-presentation[data-ready=true]').waitFor({timeout:10000});
    await p.waitForTimeout(900); // Include the ongoing carbonation after the one-shot presentation.
   }
   await p.waitForTimeout(r.d.type==='review-opening'?1800:r.d.type==='terrace'||r.d.type==='johnny-memory'?2900:r.d.type==='day-transition'?2050:r.d.type==='door'?3350:r.d.type==='outside'?1400:r.popup?400:700);
   await f.evaluate(()=>{if(barGame.dialogue)barGame.dialogue.chars=barGame.dialogue.text.length;if(lunaCampaign.dialog){const d=lunaCampaign.dialog;if(d.rows[d.index]){d.chars=d.rows[d.index].text.length;lunaCampaign.paintLine();}}for(const s of [outsidePlaytest.model?.story,outsidePlaytest.model?.backgroundStory])if(s?.speech)s.speech.elapsed=99;outsidePlaytest.refreshHUD();});
   if(r.d.type==='exterior'&&r.d.id==='wire-spark')await f.evaluate(()=>{const m=outsidePlaytest.model;window.__wirePNGTick=m.tick;m.tick=()=>{};m.time=2.94;outsidePlaytest.tick(0);});
   if(r.id==='ui:world-speech')await f.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.__textboxPNGTick=m.tick;m.tick=()=>{};for(const story of [m.story,...m.backgroundStory.channels.values()])if(story.speech)story.speech.elapsed=story.speech.chars.length/55+.01;o.refreshHUD();});
   if(errors.length)throw Error(errors.join('; '));
   if(r.popup)await f.locator(r.selector).filter({visible:true}).first().waitFor({state:'visible',timeout:3500});
   await p.locator('#game').screenshot({path:path.join(out,r.file+'.png')});
   if(r.popup){
    // Freeze RAF-driven live UI only for capture; resume every queued callback afterwards.
    await f.evaluate(()=>{window.__pngRAF={original:requestAnimationFrame,pending:[]};window.requestAnimationFrame=fn=>{__pngRAF.pending.push(fn);return 0;};});
    await p.waitForTimeout(60);
    const target=f.locator(r.selector).filter({visible:true}).first();await target.waitFor({state:'visible',timeout:2500});
    await target.evaluate(el=>{el.dataset.pngExport='true';for(let p=el.parentElement;p;p=p.parentElement)p.dataset.pngAncestor='true';});
    const style=await f.addStyleTag({content:'html,body,[data-png-ancestor]{background:transparent!important;backdrop-filter:none!important;box-shadow:none!important}body *{visibility:hidden!important}[data-png-export],[data-png-export] *{visibility:visible!important}[data-png-export]{backdrop-filter:none!important}'});
    // A script-free copy in a top-level page avoids Chromium's opaque iframe
    // backing surface. Preserve the real DOM/CSS and every painted canvas.
    const html=await f.evaluate(()=>{const clone=document.documentElement.cloneNode(true),live=[...document.querySelectorAll('canvas')];clone.querySelectorAll('canvas').forEach((canvas,i)=>{canvas.dataset.exportCanvas=live[i].toDataURL();});clone.querySelectorAll('script').forEach(e=>e.remove());const base=document.createElement('base');base.href=document.baseURI;clone.querySelector('head').prepend(base);return '<!doctype html>'+clone.outerHTML;});
    await exportPage.setContent(html,{waitUntil:'domcontentloaded'});
    await exportPage.evaluate(()=>Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>l.sheet?Promise.resolve():new Promise((resolve,reject)=>{l.onload=resolve;l.onerror=()=>reject(Error('Missing stylesheet '+l.href));}))));
    await exportPage.evaluate(async()=>{await document.fonts.load('14px LunaPixel');await document.fonts.ready;if(!document.fonts.check('14px LunaPixel'))throw Error('Game font unavailable');await Promise.all([...document.querySelectorAll('canvas[data-export-canvas]')].map(async c=>{const im=new Image();im.src=c.dataset.exportCanvas;await im.decode();c.getContext('2d').drawImage(im,0,0);}));});
    const exportTarget=exportPage.locator('[data-png-export]');
    const box=await exportTarget.boundingBox();if(!box)throw Error('Missing popup bounds');
    const overflow=await exportTarget.evaluate(el=>{const b=el.getBoundingClientRect(),boxes=[b,...[...el.querySelectorAll('*')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height)];return {left:Math.min(...boxes.map(r=>r.left))-b.left,top:Math.min(...boxes.map(r=>r.top))-b.top,right:Math.max(...boxes.map(r=>r.right))-b.right,bottom:Math.max(...boxes.map(r=>r.bottom))-b.bottom};});
    const clip={x:Math.max(0,box.x+overflow.left-8),y:Math.max(0,box.y+overflow.top-8),width:box.width-overflow.left+overflow.right+16,height:box.height-overflow.top+overflow.bottom+16};
    await exportPage.screenshot({path:path.join(out,r.file+'--popup.png'),clip,omitBackground:true});
    await style.evaluate(el=>el.remove());await f.evaluate(()=>document.querySelectorAll('[data-png-export],[data-png-ancestor]').forEach(el=>{delete el.dataset.pngExport;delete el.dataset.pngAncestor;}));
   }
   console.log('OK',i+1+'/'+selected.length,r.file);
  }catch(error){failures.push(r.file+': '+error.message);console.log('FAIL',r.file,error.message);}
  finally{await f.evaluate(()=>{document.querySelectorAll('style').forEach(el=>{if(el.textContent.includes('[data-png-export]'))el.remove();});document.querySelectorAll('[data-png-export],[data-png-ancestor]').forEach(el=>{delete el.dataset.pngExport;delete el.dataset.pngAncestor;});if(window.__textboxPNGTick){outsidePlaytest.model.tick=window.__textboxPNGTick;delete window.__textboxPNGTick;}if(window.__wirePNGTick){outsidePlaytest.model.tick=window.__wirePNGTick;delete window.__wirePNGTick;}if(window.__pngRAF){const {original,pending}=__pngRAF;window.requestAnimationFrame=original;delete window.__pngRAF;pending.forEach(fn=>original(fn));}});}
  await p.evaluate(()=>resourceReview.close());
 }
 if(failures.length)throw Error(failures.join('\n'));
 console.log('EXPORTS_OK',selected.length,'states');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
