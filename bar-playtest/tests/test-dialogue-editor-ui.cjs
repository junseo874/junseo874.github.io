const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const rt=require('../../tools/lib/test-runtime.cjs'),{chromium}=rt.load('playwright');
const {snapshot,save}=require('../../tools/dialogue-editor-storage.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:rt.chrome}),page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 const initial=await snapshot(),tmp=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'luna-editor-ui-save-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');
 await fs.cp(path.join(__dirname,'../data/shared-csv'),base,{recursive:true});await fs.mkdir(runtime);for(const file of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',file),path.join(runtime,file));
 await page.route('**/api/dialogue-editor',async route=>{if(route.request().method()!=='POST')return route.continue();try{const value=await save(route.request().postDataJSON(),{base,runtime,backupRoot:path.join(tmp,'backups')});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});}catch(e){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:e.message})});}});
 try{
  await page.goto((process.env.EDITOR_URL||'http://127.0.0.1:8124')+'/bar-playtest/dialogue-editor.html');
  await page.waitForFunction(()=>window.dialogueEditor?.model&&document.querySelector('#line-list .line'),{timeout:30000});
  await page.selectOption('#day','3');await page.selectOption('#scene','campaign_d3_bar');
  const frame=page.frameLocator('#preview');await page.locator('#line-list .line').nth(1).click();
  await frame.locator('.dialogue-text .text-ink').waitFor();
  await page.locator('#inspector textarea[data-field="text.ko"]').fill('<shake>실시간 수정</shake> 확인');
  await page.waitForTimeout(700);assert((await frame.locator('.text-ink').innerText()).includes('실시간 수정'));assert(await frame.locator('.dialogue-fx-shake').count());
  const n=await page.locator('#line-list .line').count();await page.click('#duplicate');assert.equal(await page.locator('#line-list .line').count(),n+1);await page.click('#up');await page.click('#undo');await page.click('#undo');assert.equal(await page.locator('#line-list .line').count(),n);
  const two=await page.evaluate(()=>{const rows=dialogueEditor.model.rows('campaign_d3_bar');return rows.find(r=>r.type==='say'&&r.actor==='samho').row_id;});await page.locator('[data-line="'+two+'"]').click();await page.waitForTimeout(1500);
  const child=page.frames().find(f=>f.url().includes('dialogue-preview'));assert.equal(await child.evaluate(()=>Object.values(barGame.seats).filter(Boolean).length),2);
  assert.equal(await child.locator('dialog[open]').count(),0,'preview must not be covered by an update/settings modal');
  await fs.mkdir(path.join(__dirname,'../../artifacts/dialogue-editor'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../../artifacts/dialogue-editor/two-guests.png'),fullPage:true});
  const choice=await page.evaluate(()=>dialogueEditor.model.rows('campaign_d3_bar').find(r=>r.type==='choice').row_id);await page.locator('[data-line="'+choice+'"]').click();await frame.locator('.choices button').first().waitFor();
  await page.locator('.choice-editor textarea').first().fill('선택지 즉시 반영');await child.waitForFunction(()=>document.querySelector('.choices')?.textContent.includes('선택지 즉시 반영'));
  await page.click('#review');await page.waitForFunction(()=>!document.querySelector('#commit').disabled);assert((await page.locator('#save-explanation').innerText()).includes('로컬 CSV'));await page.click('#commit');await page.waitForFunction(()=>!dialogueEditor.model.dirty());assert((await fs.readFile(path.join(base,'story/bar_choices.csv'),'utf8')).includes('선택지 즉시 반영'));assert.equal((await snapshot()).revision,initial.revision,'live CSV remains untouched by test');
  await frame.locator('.choices button').first().click();await page.waitForFunction(id=>dialogueEditor.selected!==id,choice);
  const line=await page.evaluate(()=>dialogueEditor.model.rows('campaign_d3_bar').find(r=>r.type==='say'&&r.actor==='aili').row_id);await page.locator('[data-line="'+line+'"]').click();await page.click('#play');await page.waitForFunction(id=>dialogueEditor.selected!==id,line);await page.click('#play');
  // Read-only fallback exercises GitHub export without writing the live CSV.
  const web=await browser.newPage({viewport:{width:1600,height:1050}});await web.route('**/api/dialogue-editor',r=>r.fulfill({status:404,body:'unavailable'}));web.on('pageerror',e=>errors.push(e.message));
  await web.goto((process.env.EDITOR_URL||'http://127.0.0.1:8124')+'/bar-playtest/dialogue-editor.html');await web.waitForFunction(()=>window.dialogueEditor?.model);await web.locator('#line-list .line').nth(1).click();await web.locator('#inspector textarea[data-field="text.ko"]').fill('웹 내보내기 검수');await web.click('#review');await web.waitForFunction(()=>!document.querySelector('#commit').disabled);const download=web.waitForEvent('download');await web.click('#commit');const file=await download;assert(file.suggestedFilename().endsWith('.zip'));await file.saveAs(path.join(__dirname,'../../artifacts/dialogue-editor/export-test.zip'));
  assert.equal(await web.evaluate(()=>dialogueEditor.model.dirty()),true,'export must not claim GitHub saved');assert.deepEqual(errors,[]);console.log('DIALOGUE_EDITOR_UI_OK: live text/effects, two guests, choices, undo/reorder, local save review and ZIP export.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
