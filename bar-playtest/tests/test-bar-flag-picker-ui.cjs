/* Real inspectors, disposable browser preferences; never POST to the user's data. */
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs');
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true}),p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];
 const url=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/dialogue-editor.html?view=lines',id='tom_name_known';
 try{
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-flag-roundtrip-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');
  await require('./helpers/copy-editor-source.cjs')(base);await fs.mkdir(runtime);for(const f of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',f),path.join(runtime,f));
  await p.route('**/api/dialogue-editor',async r=>{try{await r.fulfill({json:r.request().method()==='POST'?await save(r.request().postDataJSON(),{base,runtime,backupRoot:path.join(tmp,'backup')}):{...await snapshot(base),mode:'local-csv',token:'fixture'}});}catch(e){await r.fulfill({status:409,json:{error:e.message}});}});await p.route('**/api/dialogue-editor/runtime',async r=>r.fulfill({json:await runtimeSnapshot(base)}));
  p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForSelector('#flags-open:enabled');
  assert.deepEqual(await p.evaluate(()=>[
   LunaFlagPicker.updated('flag.demo == true && money >= 20 && flag.demo != false && flag.demo_other','when','demo',false),
   LunaFlagPicker.updated('flag.demo = true; money += 30; flag.demo = false; flag.demo_other = false','effects','demo',true)
  ]),['!flag.demo && money >= 20 && flag.demo_other','flag.demo = true; money += 30; flag.demo_other = false']);
  await p.click('#flags-open');await p.click('[data-flag='+id+']');await p.getByLabel('플래그 색상').fill('#e0a521');await p.getByLabel('플래그 아이콘').selectOption('♥');await p.click('#wb-close');
  assert.deepEqual(await p.evaluate(()=>dialogueEditor.model.output()),{});await p.reload();await p.waitForSelector('#flags-open:enabled');
  assert.deepEqual(await p.evaluate(n=>LunaFlagPicker.style(n),id),{icon:'♥',color:'#e0a521'});
  await p.locator('#line-list .line').nth(3).click();const line=p.locator('.choice-rule').first(),choiceId=await line.getAttribute('data-choice-row');
  async function pick(scope,text,truth,query='톰',target=id){await scope.getByRole('button',{name:text,exact:true}).click();await p.fill('#fp-query','zz_no_such_flag');assert(await p.locator('#fp-true').isDisabled());await p.fill('#fp-query',query);const opt=p.locator('#fp-list [data-name="'+target+'"]');await opt.click();await p.click(truth?'#fp-true':'#fp-false');}
  await line.getByRole('button',{name:'⚑ 플래그 조건 선택',exact:true}).click();await p.fill('#fp-query','새로운 대화 확인');await p.getByLabel('새 플래그 영문 ID').fill('studio_line_created');await p.locator('.fp-create').click();
  // The embedded game can finish loading while this modal owns the editable field.
  await p.waitForFunction(()=>document.querySelector('#preview').contentWindow.barGame);
  await p.evaluate(()=>new Promise(resolve=>{
   const preview=document.querySelector('#preview').contentWindow;
   function ready(e){if(e.source===preview&&e.data?.channel==='luna-dialogue-preview'&&e.data.type==='ready'){window.removeEventListener('message',ready);resolve();}}
   window.addEventListener('message',ready);
   preview.postMessage({channel:'luna-dialogue-editor',type:'hello'},location.origin);
  }));
  await p.click('#fp-false');assert((await line.locator('[data-field=when]').inputValue()).includes('!flag.studio_line_created'));assert(!(await line.locator('[data-field=effects]').inputValue()).includes('studio_line_created'));
  const effect=line.locator('[data-field=effects]'),when=line.locator('[data-field=when]');const fxTools=line.getByRole('group',{name:'효과 편집'}),whenTools=line.getByRole('group',{name:'조건 편집'});
  const priorEffects=await effect.inputValue(),withOriginal=v=>[priorEffects,v].filter(Boolean).join('; ');
  await fxTools.locator('[data-add-rule=money]').click();await fxTools.getByLabel('변경할 수치').fill('100');await fxTools.getByRole('button',{name:'⚑ 플래그 값 설정'}).click();await p.fill('#fp-query','studio_fixture');await p.locator('.fp-create').click();await p.click('#fp-true');
  await pick(line,'⚑ 플래그 값 설정',false);assert.equal(await effect.inputValue(),withOriginal('money += 100; flag.studio_fixture = true; flag.'+id+' = false'));
  await whenTools.getByRole('button',{name:'studio_line_created 조건 삭제'}).click();await whenTools.locator('[data-add-rule=money]').click();await whenTools.getByLabel('비교할 숫자').fill('10');await pick(line,'⚑ 플래그 조건 선택',true,'studio_fixture','studio_fixture');await pick(line,'⚑ 플래그 조건 선택',false,'studio_fixture','studio_fixture');assert.equal(await when.inputValue(),'money >= 10 && !flag.studio_fixture');
  assert.deepEqual(await p.evaluate(cid=>{const c=dialogueEditor.model.tables.bar_choices.find(o=>o.row_id===cid);return [LunaBarWiring.readable(c.when),LunaBarWiring.authorEffects(c.effects)];},choiceId),[await when.inputValue(),await effect.inputValue()]);
  await p.click('#line-to-map');const choice=p.locator('.flow-card.tone-choice').first();await choice.locator('.card-head').click();const rule=p.locator('.quick-rule').first();await pick(rule,'⚑ 플래그 값 설정',true);
  assert((await rule.locator('[data-quick-key=effects]').inputValue()).includes('flag.'+id+' = true'));assert.equal(await choice.locator('.port-marks [data-flag-mark='+id+']').first().getAttribute('data-icon'),'♥');
  await p.click('#undo');assert((await rule.locator('[data-quick-key=effects]').inputValue()).includes('flag.'+id+' = false'));
  await pick(rule,'⚑ 플래그 조건 선택',true,'studio_fixture','studio_fixture');assert.equal(await rule.locator('[data-quick-key=when]').inputValue(),'money >= 10 && flag.studio_fixture');await pick(rule,'⚑ 플래그 조건 선택',false,'studio_fixture','studio_fixture');
  await pick(p.locator('#guard-builder'),'⚑ 플래그 조건 선택',true);assert((await p.inputValue('#node-when')).includes('flag.'+id));await p.click('[data-action=guard]');
  const ids=await p.locator('.flow-card').evaluateAll(cards=>cards.map(c=>c.dataset.node));const card=n=>p.locator('[data-node="'+n+'"]');
  await p.selectOption('#map-bookmark',ids[14]);await pick(p.locator('#pin-builder'),'⚑ 플래그 조건 선택',true);await p.click('[data-action=add-pin]');
  await p.selectOption('#map-bookmark',ids[17]);await card(ids[17]).locator('.socket-in').click();await p.selectOption('#map-bookmark',ids[14]);
  const route=p.locator('.route-edit').first();await pick(route,'⚑ 플래그 조건 선택',false);await route.locator('[data-revise]').click();assert.equal(await route.locator('[data-route-value]').inputValue(),'!flag.'+id);await route.getByRole('button',{name:'⚑ 플래그 조건 선택',exact:true}).click();await p.fill('#fp-query','bp_path_');assert.equal(await p.locator('#fp-list button').count(),0);await p.keyboard.press('Escape');await p.waitForSelector('#flag-picker',{state:'hidden'});assert.equal(await route.locator('[data-route-value]').inputValue(),'!flag.'+id);
  await p.click('#map-add');await p.selectOption('#command-type','effect');await pick(p.locator('#command-effect-picker'),'⚑ 플래그 값 설정',false,'studio_fixture','studio_fixture');assert.equal(await p.inputValue('#command-effect'),'flag.studio_fixture = false');await p.click('#command-cancel');
  const files=await p.evaluate(()=>dialogueEditor.model.output());assert(Object.keys(files).every(k=>k.endsWith('.csv')||k==='web-views.json'));assert(Object.keys(files).some(k=>k.endsWith('/bar_choices.csv')));assert(!Object.values(files).some(v=>v.includes('#e0a521')||v.includes('flag-appearance')));await p.click('#review');await p.waitForFunction(()=>!document.querySelector('#commit').disabled);await p.click('#commit');await p.waitForFunction(()=>!document.querySelector('#review-dialog').open);await p.reload();await p.waitForSelector('#flags-open:enabled');
  const reloaded=await p.evaluate(cid=>{const m=dialogueEditor.model,c=m.tables.bar_choices.find(r=>r.row_id===cid);return {when:LunaBarWiring.readable(c.when),effects:LunaBarWiring.authorEffects(c.effects),route:LunaBarWiring.scan(m,'d1_tutorial_chris').routes.map(r=>r.predicate)};},choiceId);assert.equal(reloaded.when,'money >= 10 && !flag.studio_fixture');assert.equal(reloaded.effects,withOriginal('money += 100; flag.studio_fixture = true; flag.'+id+' = false'));assert(reloaded.route.includes('!flag.'+id));assert.deepEqual(errors,[]);
  console.log('BAR_FLAG_PICKER_UI_OK: stored style alone leaves export empty; new unsaved catalog entries, Korean search, true/false edits, peer terms, flow markers, undo, new/revised branch pins, nested command dialog and real CSV save/reload verified.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
