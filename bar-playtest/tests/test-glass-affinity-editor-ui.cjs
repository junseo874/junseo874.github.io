// Edits an isolated browser draft; never POSTs the author's CSV.
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome});
 try{
  const p=await b.newPage({viewport:{width:1450,height:920}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(9000);
  await p.goto((process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/dialogue-editor.html?view=flow');
  await p.locator('.flow-card').first().waitFor();await p.selectOption('#day','1');
  await p.click('[data-scene=campaign_d1_bar_open]');await p.click('#section-all');
  const card=p.locator('.flow-card').filter({has:p.locator('.port-affinity')}).first();
  const badge=card.locator('.port-affinity'),row=name=>p.locator('.award-row').filter({has:p.getByRole('spinbutton',{name:name+' 최종 호감도'})});
  await badge.nth(3).click();const high=row('GOOD / EXCELLENT'),dec=row('DECENT');
  assert(await high.locator('input').evaluate(e=>document.activeElement===e));assert.equal(await high.locator('input').inputValue(),'5');
  await high.locator('input').fill('8');await high.getByRole('button',{name:'수정'}).click();assert.match(await badge.nth(3).innerText(),/\+8/);
  await high.getByRole('button',{name:'보정 삭제'}).click();assert.match(await badge.nth(3).innerText(),/GOOD \+1 \/ EXCELLENT \+2/);
  await p.click('#undo');assert.match(await badge.nth(3).innerText(),/\+8/);
  await p.click('#redo');assert.match(await badge.nth(3).innerText(),/EXCELLENT \+2/);
  await dec.locator('input').fill('-4');await dec.getByRole('button',{name:'추가'}).click();assert.match(await badge.nth(1).innerText(),/-4/);
  const serialized=await p.evaluate(async id=>{
   const m=dialogueEditor.model,copy=await new LunaDialogueEditorModel.Model({...m.files,...m.output()},m.presentation).init();
   const scene='campaign_d1_bar_open',graphFor=()=>LunaBarFlow.compile(copy,scene),node=graphFor().nodes.find(n=>n.id===id);
   const route=LunaBarPreviewRoute.create({model:copy,node,scene,graphFor});
   return [(await copy.validate()).errors,['good','excellent','decent','poor'].map(g=>route.glassResult(true,g).delta),route.branches().length];
  },await card.getAttribute('data-node'));
  assert.deepEqual(serialized,[[],[1,2,-4,-5],4]);
  await dec.locator('input').fill('0');await dec.getByRole('button',{name:'수정'}).click();assert.match(await badge.nth(1).innerText(),/호감도 0/);
  await card.locator('[data-pin-label]').nth(1).locator('span').click();await p.getByRole('button',{name:'호감도 편집'}).click();
  assert(await dec.locator('input').evaluate(e=>document.activeElement===e));assert.deepEqual(errors,[]);
  console.log('GLASS_AFFINITY_EDITOR_OK: badge and pin navigation, add/edit/reset, both grouped grades, undo/redo, preview and CSV copy round-trip');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
