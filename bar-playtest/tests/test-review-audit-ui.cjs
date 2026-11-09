const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview.ready);
  const data=await p.evaluate(()=>{const f=document.querySelector('#game').contentWindow;return {rows:resourceReview.rows.filter(r=>r.id.startsWith('outside')).map(r=>({id:r.id,fps:r.layers?.[0]?.fps,title:r.title})),rates:[6,10].map(count=>f.LUNA_OUTSIDE_DATA.animations.idle.fps*Math.min(1,count/f.LUNA_OUTSIDE_DATA.animations.idle.frames.length))};});
  for(const kind of ['M1','M2','W1'])assert.equal(data.rows.find(r=>r.id==='outside:'+kind).fps,data.rates[0]);
  assert.equal(data.rows.find(r=>r.id==='outside:shiba').fps,data.rates[1]);
  assert(!data.rows.some(r=>r.id==='outside:samhoIdle'));assert.equal(data.rows.find(r=>r.id==='outside:samho').title,'삼호');
  for(const id of ['repair','neighbor','guard','boss','gangmate','gang-left','gang-far','home-chris'])assert(data.rows.some(r=>r.id==='outside-role:'+id));
  const sheets=await p.evaluate(()=>{const f=document.querySelector('#game').contentWindow,A=f.LunaOutsideAmbient;return Object.entries(A.sheets).map(([kind,s])=>({kind,frames:s.frames,src:s.src,row:resourceReview.rows.find(r=>r.id==='outside:'+kind),roles:Object.entries(A.roleKinds).filter(([,k])=>k===kind).map(([id])=>resourceReview.rows.find(r=>r.id==='outside-role:'+id)).filter(Boolean)}));});
  assert.equal(sheets.length,11);
  for(const s of sheets){assert.equal(s.row.layers[0].src,s.src);assert.equal(s.row.layers[0].frames,s.frames);assert.equal(s.row.layers[0].fps,12*s.frames/9);for(const role of s.roles)assert.equal(role.layers[0].src,s.src,'review role shares gameplay sheet');}
  for(const id of ['sleep','options','notice']){
   await p.evaluate(id=>resourceReview.launch({type:'review-campaign',id},id),id);
   const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
   const selector=await p.evaluate(id=>ResourceLatest.selector(resourceReview.rows.find(r=>r.id==='popup:campaign-dialogs'),{type:'review-campaign',id}),id);
   await f.locator(selector).first().waitFor({state:'visible'});
   if(id==='sleep')assert.deepEqual(await f.locator('.world-choices button').allTextContents(),['휴식','저장','취소']);
   assert.equal(await p.locator('#lab-note.error').count(),0);
   await p.screenshot({path:'/private/tmp/review-audit-'+id+'.png'});
  }
  await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=cutscenes');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.locator('.cutscene-list').waitFor();
  // A previously completed save must not suppress the preview's completion notice.
  await p.evaluate(()=>{barGame.progress.objectives??={};barGame.progress.objectives.elevator_repair={title:'엘레베이터 수리!',status:'completed'};});
  const state=()=>p.evaluate(()=>JSON.stringify({progress:barGame.progress,carry:lunaCampaign.session.carry,day:barGame.day,sessionDay:lunaCampaign.session.day,config:outsidePlaytest.config,outsideUI:lunaCampaign.ui.outside}));
  const before=await state();
  const entries=['boobi-reveal','boobi-adoption','boobi-rest','elevator-repair'];
  for(const id of entries)assert.equal(await p.locator('[data-act="cutscenePlay"][data-id="'+id+'"]').count(),0,'System event is not a standalone timeline');
  // Closing before the asynchronous outside preload completes must stay closed.
  await p.evaluate(()=>{LunaCutsceneLibrary.play(lunaCampaign,'boobi-rest');LunaCutsceneLibrary.close();});
  await p.waitForTimeout(1500);assert.equal(await state(),before);assert.equal(await p.locator('#outside-root').count(),0);
  assert.deepEqual(errors,[]);console.log('REVIEW_AUDIT_OK: corrected live popups, NPC names/speeds/roles, system events excluded from timeline gallery, unavailable preview no-op and exact progress restoration');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
