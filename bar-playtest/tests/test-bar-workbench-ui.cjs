const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({headless:true,executablePath:rt.chrome}),ctx=await b.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage(),errors=[];
 const url=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/dialogue-editor.html?view=lines';
 try{
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForSelector('#flags-open:enabled');
  await p.locator('#line-list .line').nth(1).click();await p.click('#flags-open');await p.locator('.wb-new summary').click();await p.getByLabel('새 플래그 이름').fill('studio_flag');await p.locator('.wb-new button').click();await p.locator('[data-flag=studio_flag]').waitFor();
  await p.getByLabel('변경할 이름').fill('studio_shift');await p.getByRole('button',{name:'이름 변경',exact:true}).click();await p.locator('[data-flag=studio_shift]').waitFor();
  await p.locator('.wb-use').first().click();assert(await p.locator('#workbench').isHidden());assert.match(await p.locator('#inspector [data-field=effects]').first().inputValue(),/studio_shift/);
  const other=await ctx.newPage();other.on('dialog',d=>d.dismiss());await other.goto(url);await other.waitForSelector('#flags-open:enabled');await other.locator('#line-list .line').nth(2).click();await other.locator('.rail-foot details summary').click();await other.click('#reload');
  const slots=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('luna.bar.dialogue-editor.draft.v1.')));assert.equal(slots.length,1);await other.close();
  await p.locator('#line-list .line').nth(3).click();const input=p.locator('.choice-editor [data-field="text.ko"]').first();const savedText=await input.inputValue();await input.fill('<wave>미완성');await p.locator('#tag-alert:visible').waitFor();await p.click('#review');await p.waitForFunction(()=>document.querySelector('#validation').textContent.includes('닫히지'));assert(await p.locator('#commit').isDisabled());assert(await p.locator('#export-backup').isDisabled());
  await p.click('#review-audit');await p.locator('.wb-issue[data-level=error]').first().click();assert.equal(await p.evaluate(()=>document.activeElement.closest('[data-choice-row]')?.dataset.choiceRow),await p.locator('.choice-editor').first().getAttribute('data-choice-row'));await input.fill(savedText);assert(await p.locator('#tag-alert').isHidden());
  await p.evaluate(()=>{const m=dialogueEditor.model,row=m.rows('d1_tutorial_chris')[1];localStorage.setItem('luna.bar.graph-workspace.v2',JSON.stringify({[row.context]:{drafts:{[row.row_id]:['flag.studio_shift']}}}));});
  await p.click('#audit-open');await p.locator('.wb-issue[data-level=warning]').filter({hasText:'연결하지 않은'}).click();await p.locator('#flow-panel:visible').waitFor();
  // Delay an acknowledgement without ever POSTing edited data to a live server.
  let release,start;const pending=new Promise(r=>release=r),started=new Promise(r=>start=r);await p.route('**/api/dialogue-editor',async route=>{if(route.request().method()!=='POST')return route.continue();start();await pending;await route.fulfill({status:200,json:{saved:true,revision:'fixture_ack',backup:'fixture'}});});
  await p.click('#review');await p.waitForFunction(()=>!document.querySelector('#commit').disabled);await p.click('#commit');await started;await p.keyboard.press('Escape');assert(await p.locator('#review-dialog').isVisible());assert(await p.locator('#close-review').isDisabled());
  await p.evaluate(()=>{const m=dialogueEditor.model;m.set(m.rows('d1_tutorial_chris')[1],'text.ko','응답 대기 중 변경');});release();await p.waitForSelector('#review-dialog',{state:'hidden'});assert(await p.evaluate(()=>dialogueEditor.model.dirty()));assert.deepEqual(errors,[]);
  console.log('BAR_WORKBENCH_UI_OK: all-days modal, flag CRUD/jump, option tag live warning/save block, dangling pin jump, separate-tab drafts, delayed POST does not acknowledge newer edits.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
