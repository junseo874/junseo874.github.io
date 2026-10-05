const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),path=require('path'),fs=require('fs');
(async()=>{const out=process.env.LUNA_EFFECT_PREVIEW_DIR; if(out)fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
 const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>r.effectCategory));assert.equal(rows.length,27);assert.equal(new Set(rows.map(r=>r.id)).size,27);
 if(!out){const missing=await p.evaluate(async rows=>(await Promise.all(rows.map(r=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth?null:r.id);i.onerror=()=>resolve(r.id);i.src=r.preview;})))).filter(Boolean),rows);assert.deepEqual(missing,[],'all effect previews load');}
 for(const group of ['bar-fx','out-fx']){await p.locator('[data-group="'+group+'"]').click();assert(await p.locator('[data-facet="effect"]').count()>1);assert(await p.locator('#grid .card').count()>5);}
 await p.locator('[data-group="bar-fx"]').click();await p.locator('[data-facet="effect"][data-value="judgement"]').click();assert.equal(await p.locator('#grid .card').count(),6);await p.locator('[data-filter-reset]').click();
 await p.selectOption('#status','dummy');assert.equal(await p.locator('#grid .card').count(),1);await p.locator('[data-filter-reset]').click();
 await p.addStyleTag({content:'.frame-wrap,.lab.parked .frame-wrap{width:960px!important;height:540px!important;max-width:none!important;border:0!important}'});
 for(const r of rows){
  await p.evaluate(r=>resourceReview.launch(r.launch,r.title,r.note),r);const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  const error=await p.locator('#lab-note').evaluate(e=>e.classList.contains('error')?e.textContent:null);assert.equal(error,null,r.id);
  const d=r.launch;
  if(d.type==='effect'&&d.id==='shake'){const s=await f.evaluate(()=>({combo:barGame.gimmick.rhythm.combo,tier:barGame.gimmick.rhythm.tier,playing:barGame.gimmick.rhythm.playing}));assert.equal(s.combo,d.miss?0:d.combo);assert.equal(s.tier,d.miss?0:d.combo===10?2:1);assert.equal(s.playing,!d.miss);}
  if(d.type==='effect'&&d.id==='open')assert.equal(await f.evaluate(()=>barGame.gimmick.openFx.kind),d.success?'success':'miss');
  if(d.type==='effect'&&d.id==='pour'){const s=await f.evaluate(()=>({tool:barGame.gimmick.fluid.tool,amount:barGame.gimmick.fluid.caughtMl,held:barGame.gimmick.held}));assert(s.amount>0);assert.equal(s.tool,d.ingredient==='beer'?'none':'pourer');assert.equal(s.held,false);}
  if(d.type==='effect'&&d.id==='stir')assert.equal(await f.evaluate(()=>barGame.gimmick.success),1);
  if(d.type==='effect'&&d.id==='camera'){assert.equal(await f.evaluate(()=>!!barGame.seats.L),false);assert.equal(await f.evaluate(()=>barGame.seats.R.actor),'tom');}
  if(out&&r.preview.includes('/fx_')){await p.waitForTimeout(90);await p.locator('#game').screenshot({path:path.join(out,path.basename(r.preview)),type:'jpeg',quality:85});}
  if(['door','day-transition','terrace','johnny-memory'].includes(d.type))await p.waitForTimeout(350);
  await p.evaluate(()=>resourceReview.close());assert.equal(await f.evaluate(()=>!!lunaCampaign.memoryTransition||!!lunaCampaign.dayTransition||!!lunaCampaign.doorTransition||outsidePlaytest.active),false,r.id+' cleanup');
  console.log('FX_OK',r.id);
 }
 // Closing during an async preset must not bring it back over another preview.
 await p.evaluate(()=>{resourceReview.launch({type:'effect',id:'camera'},'camera','');resourceReview.close();});
 await p.evaluate(()=>resourceReview.launch({type:'pair'},'pair',''));await p.waitForTimeout(3100);
 assert.equal(await p.frames().find(f=>f.url().includes('resourceReview=1')).evaluate(()=>barGame.seats.L.actor),'samho');
 await p.evaluate(()=>resourceReview.close());await p.setViewportSize({width:390,height:844});
 await p.locator('[data-group="bar-fx"]').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('RESOURCE_EFFECTS_OK 27 presets, filters, stage assertions, cancellation, cleanup, mobile');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
