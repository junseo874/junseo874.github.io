const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await load('playwright').chromium.launch({executablePath:chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=cutscenes');await p.locator('.updates-confirm').click();
  const before=await p.evaluate(()=>JSON.stringify({progress:barGame.progress,carry:lunaCampaign.session.carry,day:barGame.day,screen:barGame.screen,phase:barGame.phase}));
  const launch=p.locator('[data-act=servePreview]');
  assert(await launch.evaluate(e=>e.previousElementSibling.querySelector('.cutscene-trailer-link')!==null),'New launcher immediately follows trailer');
  await launch.click();const dialog=p.locator('.serve-preview-dialog');
  const choices=await dialog.locator('select[name=drink] option').evaluateAll(es=>es.map(e=>e.value));assert.equal(choices.length,13);
  const grades=await dialog.locator('select[name=grade] option').evaluateAll(es=>es.map(e=>e.value));assert.deepEqual(grades,['excellent','good','decent','poor','sewage']);
  for(let i=0;i<choices.length;i++){
   const id=choices[i],grade=grades[i%5];await dialog.locator('[name=drink]').selectOption(id);await dialog.locator('[name=grade]').selectOption(grade);await p.evaluate(()=>{window.__gradeGate=null;const observer=new MutationObserver(()=>{const e=document.querySelector('.serve-preview-dialog .serve-actions');if(e){window.__gradeGate={alpha:+e.style.opacity,disabled:[...e.querySelectorAll('button')].every(b=>b.disabled),time:+e.closest('.serve-presentation').querySelector('.serve-grade-effects').dataset.time};observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});});await dialog.locator('.serve-preview-start').click();
   await dialog.locator('.serve-presentation').waitFor();assert.equal(await dialog.locator('.serve-grade').count(),0);assert.equal(await dialog.locator('[data-act=offer]').count(),0);
   await dialog.locator('.serve-grade').waitFor();assert.equal(await dialog.locator('.serve-canvas').getAttribute('data-frame'),'28');assert.equal(await dialog.locator('[data-act=offer]').count(),0,'Grade must be legible before controls appear');
   if(i===0){
    await dialog.locator('[data-preview=pause]').click();const t=await dialog.locator('.serve-grade-effects').getAttribute('data-time');await p.waitForTimeout(350);assert.equal(await dialog.locator('.serve-grade-effects').getAttribute('data-time'),t);await dialog.locator('[data-preview=pause]').click();
   }
   await dialog.locator('.serve-actions').waitFor();const fading=await p.evaluate(()=>window.__gradeGate);assert(fading.alpha<1&&fading.disabled,JSON.stringify(fading));assert(fading.time>=.42&&fading.time<1,'Buttons fade as the recorded grade becomes legible, while effects continue');
   await p.waitForFunction(()=>document.querySelector('.serve-preview-stage .serve-presentation')?.dataset.ready==='true');
   assert.equal(await dialog.locator('.serve-grade').getAttribute('data-grade'),grade);assert.equal(await dialog.locator('.serve-grade-effects').getAttribute('data-grade'),grade);assert(await dialog.locator('[data-act=offer]').isEnabled());assert((await dialog.locator('.serve-grade-effects').getAttribute('data-lettering')).endsWith('/FX_TX_GradeText_'+grade[0].toUpperCase()+grade.slice(1)+'_01.png'),'Use original high-resolution lettering, not GIF text');
   assert(await dialog.locator('.serve-grade-effects').evaluate(e=>e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((v,i)=>i%4===3&&v>0)));
   if(i===0){const frame=+await dialog.locator('.serve-grade-effects').getAttribute('data-frame');assert(frame<204);await p.waitForTimeout(200);assert(+await dialog.locator('.serve-grade-effects').getAttribute('data-frame')>frame,'Grade keeps animating after controls unlock');}
   if(i<5)await dialog.locator('.serve-preview-stage').screenshot({path:'/tmp/grade-review-'+grade+'.png'});
   if(i===0){
    await p.waitForFunction(()=>+document.querySelector('.serve-preview-stage .serve-grade-effects')?.dataset.time>4.5);
    const pixels=()=>dialog.locator('.serve-grade-effects').evaluate(c=>c.toDataURL());
    const ambient=await pixels();await p.waitForTimeout(400);assert.notEqual(await pixels(),ambient,'Original ambient sparkles and soft light continue beyond the entrance');
    await dialog.locator('[data-preview=pause]').click();const frozen=await pixels();await p.waitForTimeout(300);assert.equal(await pixels(),frozen,'Persistent effects pause with the scene');await dialog.locator('[data-preview=pause]').click();
    for(const [label,file,w,h] of [['버리기','BTN_trash.png',186,187],['제공하기','BTN_offer.png',520,167]]){
     const art=await dialog.getByRole('button',{name:label,exact:true}).locator('img').evaluate(img=>{
      const button=img.closest('button').getBoundingClientRect(),rect=img.getBoundingClientRect();
      return {file:img.src.split('/').pop(),w:img.naturalWidth,h:img.naturalHeight,width:rect.width,height:rect.height,fills:rect.width===button.width&&rect.height===button.height};
     });
     assert.deepEqual([art.file,art.w,art.h],[file,w,h]);
     assert(art.fills&&Math.abs(art.height-art.width*h/w)<1,'Artwork fills the clickable area at its original aspect ratio');
    }
    await dialog.locator('[data-act=discard]').click();assert((await dialog.locator('.serve-preview-status').innerText()).includes('차감되지'));
    await dialog.locator('[data-act=offer]').click();assert((await dialog.locator('.serve-preview-status').innerText()).includes('그대로'));
    await dialog.locator('[data-preview=fullscreen]').click();await p.waitForFunction(()=>document.fullscreenElement===document.documentElement);
    await dialog.locator('[data-preview=fullscreen]').click();await p.waitForFunction(()=>!document.fullscreenElement);
    for(const viewport of [{width:390,height:844},{width:1920,height:1080},{width:3840,height:2160},{width:1280,height:900}]){
     await p.setViewportSize(viewport);await p.waitForTimeout(100);
     const box=await dialog.evaluate(e=>{const s=e.querySelector('.serve-preview-stage').getBoundingClientRect(),items=[...e.querySelectorAll('header button,.serve-actions button,.serve-grade')].map(n=>n.getBoundingClientRect());const c=e.querySelector('.serve-canvas').getBoundingClientRect();
      const w=Math.min(innerWidth,innerHeight*16/9),h=w*9/16;
      const fills=Math.abs(c.width-w)<=1&&Math.abs(c.height-h)<=1&&Math.abs(c.left-(innerWidth-w)/2)<=1&&Math.abs(c.top-(innerHeight-h)/2)<=1;
      return{ratio:s.width/s.height,fills,inside:items.every(r=>r.left>=-.1&&r.top>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1)};});assert(Math.abs(box.ratio-16/9)<.01&&box.inside&&box.fills,JSON.stringify(box));
    }
    await dialog.locator('[data-preview=replay]').click();assert.equal(await dialog.locator('.serve-grade').count(),0);assert.equal(await dialog.locator('[data-act=offer]').count(),0);
   }
   await dialog.locator('[data-preview=select]').click();assert.equal(await dialog.locator('[name=drink]').inputValue(),id);assert.equal(await dialog.locator('[name=grade]').inputValue(),grade);
  }
  await p.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert(await launch.evaluate(e=>document.activeElement===e));
  const after=await p.evaluate(()=>JSON.stringify({progress:barGame.progress,carry:lunaCampaign.session.carry,day:barGame.day,screen:barGame.screen,phase:barGame.phase}));assert.equal(after,before,'Read-only preview preserves campaign state');
  // Shared renderer: deterministic effect, all five original PNGs, game-clock timing.
  const metadata=await p.evaluate(()=>({assets:LunaServeGrade.assets,bounds:LunaServeGrade.bounds,timing:LunaServeGrade.timing}));
  for(const [id,a]of Object.entries(metadata.assets)){
   const local=path.join(__dirname,'..',a.src),m=await load('sharp')(local).metadata();assert.equal(m.width,1261);assert.equal(m.height,287);assert(m.hasAlpha);
   const record=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/presentation/engine-art-sync.json'))).records.find(r=>r.path===a.src.replace('assets/01.ArtResources/',''));assert.equal(record.sha256,crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex'));
  }
  assert.equal(metadata.bounds.x+metadata.bounds.w/2,640);assert.equal(metadata.timing.reveal,3.4);assert.equal(metadata.timing.readable,.42);
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>/^art:serve-grade-(excellent|good|decent|poor|sewage)$/.test(r.id)).map(r=>({id:r.id,launch:r.launch})));assert.equal(rows.length,5);assert(rows.every(r=>r.launch.grade));assert.equal(await p.evaluate(()=>resourceReview.rows.filter(r=>r.id.startsWith('art:serve-grade-reveal-')).length),0);
  // A missing grade image must not leave a finished drink permanently locked.
  await p.route('**/FX_TX_GradeText_Poor_01.png',route=>route.abort());
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{const g=barGame;g.reset(99,'practice',1,true);g.selectCocktail('cosmopolitan');g.debugFill();g.startCraft();g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));g.craft.index=g.craft.queue.length;g.nextGimmick();g.result.grade='poor';g.changed();});
  await p.locator('.serve-presentation[data-ready=true]').waitFor();
  assert.equal(await p.locator('.serve-grade').getAttribute('data-grade'),'poor');assert.equal(await p.locator('.serve-grade-effects').getAttribute('data-grade'),'poor');
  assert(await p.locator('.serve-grade-effects').evaluate(e=>e.getContext('2d').getImageData(e.width*.3,0,e.width*.4,e.height*.2).data.some((v,i)=>i%4===3&&v>0)),'Missing PNG retains a readable fallback');
  await p.locator('[data-act=offer]').click();assert.equal(await p.evaluate(()=>barGame.screen),'bar');
  assert.equal(await p.locator('[data-render-error]').count(),0);assert.deepEqual(errors,[]);console.log('PASS: 13 cocktail previews, all 5 grades, original PNGs, timing/fade input gate, pause/replay, fullscreen/16:9/mobile, grade review inventory, no gameplay mutations or browser errors.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
