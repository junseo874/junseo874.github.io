const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 if(await p.locator('.updates-confirm').isVisible()){await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();}
 await p.locator('[data-act="version"][data-id="cutscenes"]').click();
 const entries=await p.evaluate(()=>LunaCutsceneLibrary.catalog);
 assert.equal(entries.length,13);assert(entries.every(x=>!x.id.startsWith('B-')&&x.id!=='opening-b'));assert.equal(await p.locator('.cutscene-card').count(),entries.length);
 assert.equal(await p.locator('.version-tabs button.selected').count(),1);
 await p.locator('[data-act="cutsceneFilter"][data-id="2일차"]').click();assert.equal(await p.locator('.cutscene-card').count(),entries.filter(x=>x.day==='2일차').length);
 await p.locator('[data-act="cutsceneFilter"][data-id="all"]').click();
 await p.screenshot({path:'/private/tmp/luna-cutscene-library.png'});
 const state=()=>p.evaluate(()=>JSON.stringify({progress:barGame.progress,carry:lunaCampaign.session.carry,day:barGame.day,story:lunaCampaign.storyVersion}));
 const before=await state();
 for(const entry of entries){
  await p.locator('[data-act="cutscenePlay"][data-id="'+entry.id+'"]').click();
  await p.waitForFunction(()=>['scene','prologue','load-error'].includes(lunaCampaign.view)&&!lunaCampaign.memoryTransition,null,{timeout:60000});
  assert.notEqual(await p.evaluate(()=>lunaCampaign.view),'load-error',entry.id+': '+await p.evaluate(()=>lunaCampaign.loadError));
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>getComputedStyle(lunaCampaign.host).cursor),'none',entry.id+' hides the cinematic cursor');
  if(entry.id==='opening-a')await p.screenshot({path:'/private/tmp/luna-cutscene-preview.png'});
  if(entry.id==='wake-a')assert(await p.evaluate(()=>lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil));
  if(entry.id==='A-johnny')await p.evaluate(()=>{barGame.progress.flags.campaign_observation=true;});
  if(entry.id==='A-workshop')await p.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.length;c.continueScene();});
  else await p.keyboard.press('Escape');
  await p.locator('.cutscene-list').waitFor();assert.equal(await state(),before,entry.id+' leaked progress');
  assert.equal(await p.locator('#cutscene-preview-toolbar').count(),0);assert.equal(await p.evaluate(()=>lunaCampaign.view),'developer');
  console.log('PASS preview '+entry.id);
  assert.notEqual(await p.evaluate(()=>getComputedStyle(document.body).cursor),'none',entry.id+' restores the cursor');
 }
 // Follow a real terrace-to-memory link, then complete the memory and return safely.
 await p.locator('[data-act="cutscenePlay"][data-id="A-night2"]').click();
 await p.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
 await p.evaluate(()=>{const c=lunaCampaign;const at=c.dialog.rows.findIndex(r=>r.cinemaAfter==='johnny-memory');if(at<0)throw Error('Missing linked Johnny memory');c.dialog.index=at;c.dialog.chars=Infinity;c.next();});
 await p.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
 await p.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.length;c.continueScene();});
 await p.waitForFunction(()=>!lunaCampaign.memoryTransition);
 if(await p.evaluate(()=>LunaCutsceneLibrary.active))await p.keyboard.press('Escape');
 assert.equal(await state(),before,'Linked memory leaked progression');
 // Cancel an async transition, and ensure its completion cannot reopen a preview.
 await p.locator('[data-act="cutscenePlay"][data-id="A-night0"]').click();await p.keyboard.press('Escape');await p.waitForTimeout(2500);assert.equal(await p.evaluate(()=>lunaCampaign.view),'developer');
 for(const id of ['original','minigames','outside','cutscenes']){await p.locator('[data-act="version"][data-id="'+id+'"]').click();assert.equal(await p.locator('.version-tabs button.selected').count(),1);}
 for(const viewport of [{width:820,height:650},{width:1920,height:1080}]){await p.setViewportSize(viewport);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const box=await p.locator('.cutscene-list').boundingBox();assert(box.width>300&&box.height>100);}
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=cutscenes');await p.locator('.cutscene-list').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS all cutscene previews, filters, state restoration, linked memories, normal completion, cancellation, tabs, deep link and responsive layout');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
