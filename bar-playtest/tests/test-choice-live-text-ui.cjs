/* Editing copy must not remount the live street choices or restart entry animation. */
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/outside-dialogue-editor.html?flow=newspaper/intro');
  await page.waitForFunction(()=>window.outsideDialogueEditor?.model);
  await page.locator('#line-list .line').last().click();await page.waitForTimeout(650);
  await page.locator('#preview-choices button').nth(1).focus();
  await page.evaluate(()=>{window.originalChoiceNodes=[...document.querySelectorAll('#preview-choices button')];window.choiceEntries=0;document.querySelector('#preview-choices').addEventListener('animationstart',e=>{if(/^world-choice-in/.test(e.animationName))choiceEntries++;});});
  const text=page.locator('[data-menu-index="1"] textarea[data-menu-field="text.ko"]');
  await text.fill('');await text.pressSequentially('Typing without blinking',{delay:30});
  await text.fill('한글 선택지 수정 중');await page.waitForTimeout(250);
  assert.equal(await page.locator('#preview-choices button').nth(1).innerText(),'한글 선택지 수정 중');
  assert.equal(await page.evaluate(()=>choiceEntries),0,'typing must not replay entry');
  assert(await page.evaluate(()=>originalChoiceNodes.every((b,i)=>b===document.querySelectorAll('#preview-choices button')[i])),'reuse button nodes');
  assert.equal(await page.locator('#preview-choices button').nth(1).getAttribute('aria-current'),'true');
  assert(await text.evaluate(el=>el===document.activeElement&&el.selectionStart===el.value.length),'typing caret stays in editor');
  await page.locator('[data-menu-index="1"] input[data-menu-field="when"]').fill('money >= 99999');
  assert.equal(await page.locator('#preview-choices button').nth(1).getAttribute('aria-disabled'),'true');
  assert.equal(await page.evaluate(()=>choiceEntries),0,'condition edits must not replay entry');
  assert(await page.locator('#preview-choices button').nth(1).evaluate(el=>getComputedStyle(el).clipPath.startsWith('polygon(')));
  // Actually leaving and reopening the menu should still animate once.
  await page.click('#previous');await page.click('#next');await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>choiceEntries),2);
  await page.click('#menu-add');assert.equal(await page.locator('#preview-choices button').count(),3);
  const refresh=await page.evaluate(()=>{
   const host=document.createElement('div');document.body.append(host);const ui=LunaWorldChoices.create(host,()=>{});
   try{const view={key:'refresh-probe',head:{x:640,y:350},options:[{id:'a',label:'원본',disabled:true,disabledReason:'부족합니다.'}],money:100,rejectUnavailable:true};ui.update(view);const button=host.querySelector('button'),balance=host.querySelector('.bd-balance');
    ui.update({...view,money:200,options:[{...view.options[0],label:'수정본'}]});const retained=button===host.querySelector('button')&&balance===host.querySelector('.bd-balance')&&balance.textContent.includes('200');
    ui.update({...view,money:undefined,rejectUnavailable:false,options:[{...view.options[0],label:'다른 표시'}]});return {retained,noBalance:!host.querySelector('.bd-balance'),disabled:button.disabled,noStaleLabel:!button.hasAttribute('aria-label'),reason:button.querySelector('small')?.textContent};
   }finally{ui.dispose();host.remove();}
  });
  assert.deepEqual(refresh,{retained:true,noBalance:true,disabled:true,noStaleLabel:true,reason:'부족합니다.'});
  assert.deepEqual(errors,[]);
  console.log('CHOICE_LIVE_TEXT_OK: Korean/Latin typing and condition edits retain nodes, selection, caret and animation; reopening and adding options still work.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
