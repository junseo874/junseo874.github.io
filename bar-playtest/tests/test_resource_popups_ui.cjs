const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.creditCueCount=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&Math.abs(this.buffer.duration-32751/48000)<.0001)creditCueCount++;return start.apply(this,args);};});
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview?.ready);
  const f=p.frames().find(f=>f.url().includes('resourceReview=1'));
  const rows=await p.evaluate(()=>resourceReview.rows.filter(r=>r.group==='common-popups'));
  assert.equal(rows.length,15);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
  assert(!await p.evaluate(()=>resourceReview.rows.some(r=>['fx:income','fx:expense','fx:unlock','fx:purchase'].includes(r.id))));
  assert(await p.evaluate(()=>ResourceMissing.build(resourceReview.rows).find(r=>r.id==='ui:ui:unlock').area==='바 내부'));
  await p.click('[data-group="common-popups"]');await p.click('[data-id="popup:meet"]');
  await f.locator('.story-notice-people').waitFor({state:'visible'});
  assert.equal(await p.locator('#popup-rail button').count(),15);
  assert.equal(await f.locator('.story-notice-people small').innerText(),'새로운 인물!');
  assert.equal(await f.locator('.story-notice-people strong').innerText(),await f.evaluate(()=>barGame.name(document.querySelector('.story-notice-people').dataset.actor)));
  assert.equal(await f.locator('.story-notice-people .story-notice-icon').count(),0);
  const history=await p.evaluate(()=>window.history.length);
  await p.selectOption('#popup-actor','samho');await f.waitForFunction(()=>document.querySelector('.story-notice-people').dataset.actor==='samho');
  await p.waitForTimeout(400);await p.screenshot({path:'/private/tmp/resource-popup-lab.png'});
  await f.locator('.story-notice-people').waitFor({state:'hidden'});await p.click('#replay');await f.locator('.story-notice-people').waitFor({state:'visible'});
  await p.click('[data-popup="popup:affinity"]');await p.selectOption('#lab-state','bar-down');
  await f.waitForFunction(()=>document.querySelector('.story-notice-people strong').textContent==='삼호 호감도 하락!');
  await p.selectOption('#lab-state','outside-up');await f.waitForFunction(()=>outsidePlaytest.active&&document.querySelector('.story-notice-people strong').textContent==='삼호 호감도 상승!');
  await p.click('[data-popup="popup:event"]');await f.locator('.story-notice-event').waitFor({state:'visible'});
  assert.equal(await f.locator('.story-notice-event strong').innerText(),'새로운 이벤트 발생!');
  await p.waitForTimeout(400);await p.screenshot({path:'/private/tmp/resource-popup-event.png'});
  await p.click('[data-popup="popup:goal"]');
  assert.equal(await p.locator('#popup-actor').count(),0);
  for(const state of ['bar-new','bar-complete','outside-new','outside-complete']){
   await p.selectOption('#lab-state',state);
   const complete=state.endsWith('complete');
   await f.waitForFunction(kind=>document.querySelector('.story-notice-event:not([hidden])')?.dataset.kind===kind,complete?'goal-complete':'goal-new');
   assert.equal(await f.locator('.story-notice-event small').innerText(),complete?'목표 달성':'새로운 목표');
   assert.equal(await f.locator('.story-notice-event strong').innerText(),'바로 출근하기');
   assert.equal(await f.locator('.story-notice-event').evaluate(el=>getComputedStyle(el).getPropertyValue('--notice-accent').trim()),complete?'#a2e3b3':'#89deed');
   assert.equal(await f.evaluate(()=>LunaStoryNotices.pending.length),1);
   assert.equal(await f.locator('.currency-hud').count(),0);
  }
  await p.click('#replay');await f.locator('.story-notice-event').waitFor({state:'visible'});
  await p.waitForTimeout(400);await p.screenshot({path:'/private/tmp/resource-popup-goal.png'});
  await p.click('[data-popup="ui:income"]');await p.selectOption('#lab-state','outside-expense');
  await f.locator('.outside-money-notice .currency-spending').waitFor({state:'visible'});
  assert.equal(await f.evaluate(()=>barGame.progress.money),700);
  await p.selectOption('#lab-state','income');await f.locator('.currency-income').waitFor({state:'visible'});
  const creditCues=await f.evaluate(()=>creditCueCount);
  for(let i=0;i<2;i++){
   await p.click(i?'#replay':'[data-popup="ui:exterior:purchase"]');await f.locator('.outside-item-notice').waitFor({state:'visible'});
   const balance=await f.evaluate(()=>barGame.progress.money);
   assert.equal(await f.locator('.outside-item-notice strong').innerText(),'신규 재료 비터스 추가!');
   for(let j=0;j<6;j++){await p.waitForTimeout(100);assert.equal(await f.locator('.currency-hud').count(),0,'Ingredient-only preview never displays a money toast');}
   assert.equal(await f.evaluate(()=>barGame.progress.money),balance,'Preview never changes the wallet');
   assert.equal(await f.evaluate(()=>creditCueCount),creditCues,'Ingredient preview must not play currency assets/audio/effects');
  }
  await p.click('[data-popup="ui:warnings"]');await f.locator('#opener-warning-title').waitFor();
  await p.selectOption('#lab-state','ingredientWarning');await f.locator('#ingredient-warning-title').waitFor();
  await p.selectOption('#lab-state','homeward');await f.waitForFunction(()=>lunaCampaign.view==='notice');
  assert((await f.locator('#campaign-root').innerText()).includes('집에 올라가기 전에'));
  await p.click('[data-popup="ui:unlock"]');await p.selectOption('#lab-state','day-2');await f.locator('.daily-unlocks').waitFor();
  assert.equal(await f.evaluate(()=>barGame.day),2);
  await p.click('[data-popup="ui:overlay:johnnyUnlock"]');await f.locator('#johnny-unlock-title').waitFor();
  for(const id of ['service','settings','help','history','sales']){
   await p.click('[data-popup="ui:overlay:'+id+'"]');assert.equal(await f.evaluate(()=>barGame.overlay),id);
   assert.equal(await p.locator('#lab-note.error').count(),0);
  }
  await p.click('[data-popup="ui:dossier"]');assert.equal(await f.evaluate(()=>barGame.overlay),'dossier');
  assert.equal(await p.evaluate(()=>window.history.length),history,'Switching does not stack browser history');
  await p.goBack();await p.waitForFunction(()=>document.querySelector('#lab').classList.contains('parked'));
  assert.equal(await f.evaluate(()=>LunaStoryNotices.pending.length),0);
  await p.goForward();await p.waitForFunction(()=>!document.querySelector('#lab').classList.contains('parked'));
  assert.equal(await f.evaluate(()=>barGame.overlay),'dossier');await p.click('#close-lab');
  await p.click('[data-group="bar-items"]');await p.click('[data-id="item:gin:shelf"]');await p.click('[data-action="launch"]');
  assert(!await p.locator('#lab').evaluate(e=>e.classList.contains('popup-mode')));await p.click('#close-lab');
  await p.setViewportSize({width:390,height:844});await p.click('[data-group="common-popups"]');await p.click('[data-id="popup:meet"]');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/resource-popup-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS: popup hub, real notices, all modal tests, variants, cleanup, history, no duplicate entries, missing-resource area, normal tests and mobile');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
