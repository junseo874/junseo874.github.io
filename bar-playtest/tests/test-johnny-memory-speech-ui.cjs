const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{LunaFocusSettings.setEnabled(false);lunaCampaign.session.day=2;lunaCampaign.scene('night2','2일차 테라스','terrace',()=>{});});
  await page.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.findIndex(r=>r.cinemaAfter==='johnny-memory');c.dialog.chars=Infinity;c.next();});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
  async function checkRows(label){
   const count=await page.evaluate(()=>lunaCampaign.dialog.rows.length);assert.equal(count,56);
   for(let i=0;i<count;i++){
    const result=await page.evaluate(async i=>{
     const c=lunaCampaign;c.dialog.index=i;c.dialog.chars=Infinity;c.draw();
     await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
     const root=document.querySelector('.johnny-memory'),el=root.querySelector('.johnny-memory-speech');
     const stage=root.getBoundingClientRect(),rect=el.getBoundingClientRect(),scale=stage.width/1280;
     const matrix=new DOMMatrixReadOnly(getComputedStyle(root.querySelector('.counter-plane')).transform);
     const skin=new DOMMatrixReadOnly(getComputedStyle(el.querySelector('.exterior-textbox-skin')).transform);
     const tail=el.querySelector('.tail-center').getBoundingClientRect(),johnny=c.dialog.rows[i].actor==='johnny';
     return {johnny,speaker:el.dataset.speaker,flip:skin.d,bottomError:Math.abs(rect.bottom-(stage.top+(matrix.d*(johnny?601:555.5)+matrix.f)*scale)),centerError:Math.abs((tail.left+tail.right)/2-(stage.left+(matrix.a*1290+matrix.e)*scale)),tailAbove:tail.bottom<rect.top+2*scale,tailBelow:tail.top>rect.bottom-2*scale,inside:tail.top>=stage.top&&tail.bottom<=stage.bottom&&rect.left>=stage.left&&rect.right<=stage.right,clearFace:rect.top>stage.top+(matrix.d*350+matrix.f)*scale};
    },i);
    assert.equal(result.speaker,result.johnny?'johnny':'tom',label+' speaker '+i);
    assert.equal(result.flip,result.johnny?1:-1,label+' tail direction '+i);
    assert(result.bottomError<1,label+' bottom anchor '+i);
    assert(result.centerError<2,label+' tail points to speaker '+i);
    assert(result.johnny?result.tailBelow:result.tailAbove,label+' tail edge '+i);
    assert(result.inside,label+' within viewport '+i);assert(result.clearFace,label+' face clear '+i);
    if([0,1,16,35].includes(i))await page.screenshot({path:'/private/tmp/johnny-memory-'+label+'-'+i+'.png'});
   }
  }
  for(const viewport of [{width:1280,height:720},{width:960,height:600},{width:390,height:844}]){
   await page.setViewportSize(viewport);await checkRows('story-'+viewport.width);
  }
  await page.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.length;c.continueScene();});
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='terrace'&&!lunaCampaign.memoryTransition);
  assert(await page.evaluate(()=>barGame.progress.flags.campaign_observation));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=cutscenes');
  await page.locator('.updates-confirm').click();
  await page.locator('[data-act="cutscenePlay"][data-id="A-johnny"]').click();
  await page.waitForFunction(()=>lunaCampaign.dialog?.background==='johnny-memory'&&!lunaCampaign.memoryTransition);
  await page.setViewportSize({width:1280,height:720});await checkRows('preview');
  await page.keyboard.press('Escape');await page.locator('.cutscene-list').waitFor();
  assert.deepEqual(errors,[]);console.log('JOHNNY_MEMORY_SPEECH_OK: 56 rows, opposite speaker tails, bar anchors, face clearance, 3 viewports, terrace return and archive');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
