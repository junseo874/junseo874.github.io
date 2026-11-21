/* Browser-only edits followed by re-parsing the exact CSV payload. Never POST live data. */
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true}),p=await b.newPage({viewport:{width:1500,height:960}}),errors=[];
 try{
  p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto((process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/dialogue-editor.html?view=flow');await p.waitForSelector('.flow-card');
  const ui=p.locator('[data-pin-inspector]'),field=k=>ui.locator('[data-pin-field="'+k+'"]'),section=k=>field(k).locator('..'),apply=()=>ui.locator('[data-pin-apply]').click();
  const s=await p.evaluate(()=>{const m=dialogueEditor.model,scene=document.querySelector('#scene [aria-pressed=true]').dataset.scene,ns=LunaBarFlow.compile(m,scene).nodes,n=ns.find(n=>n.type==='선택지'),os=m.choices(n.rows.at(-1).arg),i=ns.findIndex(n=>n.when==='flag.day0_skip_tutorial');return {scene,source:n.id,choice:os[1].row_id,other:os[0].row_id,dst:ns[i+1].id};});
  const card=p.locator('[data-node="'+s.source+'"]'),opt=s.choice,key='pick:'+opt,socket=card.locator('.socket-out').nth(1);
  await socket.click();assert.equal(await ui.getAttribute('data-pin-inspector'),key);assert(!(await p.locator('#map-port').evaluate(e=>e.classList.contains('connecting'))));
  async function choose(k,name,value,create=false,chip=false){const holder=section(k);
   await (chip?holder.locator('.flag-chip').filter({hasText:chip}).first():holder.getByRole('button',{name:k==='choiceEffects'?'⚑ 플래그 값 설정':'⚑ 플래그 조건 선택',exact:true})).click();
   await p.fill('#fp-query',name);if(create)await p.locator('.fp-create').click();else await p.locator('#fp-list button[data-name="'+name+'"]').click();await p.click(value?'#fp-true':'#fp-false');
  }
  await section('choiceEffects').getByRole('button',{name:'⚑ 플래그 값 설정',exact:true}).click();await p.fill('#fp-query','test_cancel_new');await p.locator('.fp-create').click();await p.keyboard.press('Escape');assert(!(await field('choiceEffects').inputValue()).includes('test_cancel_new'));
  await choose('choiceEffects','studio_was_paid',true,true);await choose('predicate','studio_was_paid',true);await choose('choiceWhen','studio_may_order',false,true);
  await ui.locator('[data-pin-destination]').selectOption(s.dst);assert(!(await p.evaluate(()=>dialogueEditor.model.dirty())));await apply();
  const state=()=>p.evaluate(s=>{const m=dialogueEditor.model,route=LunaBarWiring.scan(m,s.scene).routes.find(r=>r.choice===s.choice),o=m.tables.bar_choices.find(c=>c.row_id===s.choice);return {id:route?.id,dst:route?.target,cond:route?.predicate,when:o.when,fx:o.effects};},s);
  const first=await state();assert.equal(first.dst,s.dst,await p.locator('#wire-hint').textContent());assert.equal(first.cond,'flag.studio_was_paid');assert.match(first.when,/!flag.studio_may_order/);assert.match(first.fx,/flag.studio_was_paid = true/);
  // A real SVG stroke has a wider pointer target, independent from the shared node.
  const path=p.locator('[data-line-from="'+s.source+'"][data-line-pin="'+key+'"]');await path.scrollIntoViewIfNeeded();
  const pt=await path.evaluate(e=>{for(let i=1;i<100;i++){const p=e.getPointAtLength(e.getTotalLength()*i/100).matrixTransform(e.getScreenCTM());if(document.elementFromPoint(p.x,p.y)===e)return [p.x,p.y];}return null;});assert(pt,'wire must be mouse-selectable');await p.mouse.click(...pt);assert.equal(await ui.getAttribute('data-pin-inspector'),key);
  await choose('predicate','studio_new_route',false,true,'studio_was_paid');await apply();const revised=await state();assert.deepEqual(revised,{...first,cond:'!flag.studio_new_route'});
  await p.click('#undo');assert.deepEqual(await state(),first);await p.click('#redo');assert.deepEqual(await state(),revised);
  await card.locator('.port-label').nth(1).click();await section('predicate').locator('.flag-chip').click();await p.click('#fp-remove');await apply();assert.deepEqual(await state(),{...first,cond:''});
  await p.click('#undo');await card.locator('.card-head').click();await p.locator('[data-inspect-key="'+key+'"]').click();assert.equal(await field('predicate').inputValue(),'!flag.studio_new_route');
  const result=await p.evaluate(async s=>{const m=dialogueEditor.model,M=LunaDialogueEditorModel.Model,r=await new M({...m.files,...m.output()},m.presentation).init(),scan=LunaBarWiring.scan(r,s.scene);const wire=scan.routes.find(x=>x.choice===s.choice);return {errors:scan.errors,when:wire.owner.when,pred:wire.predicate,target:wire.target,other:r.tables.bar_choices.find(c=>c.row_id===s.other).effects,files:Object.keys(m.output())};},s);
  assert.deepEqual(result.errors,[]);assert.equal(result.target,s.dst);assert.equal(result.pred,revised.cond);assert(!result.other.includes('studio_'));assert(!result.files.some(k=>/flag.?catalog/i.test(k)));assert.deepEqual(errors,[]);
  const talk=p.locator('.flow-card.tone-talk').first();await talk.locator('[data-card-action=pin]').click();await talk.locator('.socket.draft').click();
  await choose('predicate','studio_draft_only',true,true);await apply();await p.click('#flags-open');await p.click('[data-flag=studio_draft_only]');assert((await p.locator('.wb-use').first().textContent()).includes('미연결 핀'));await p.click('#wb-close');assert(!(await p.evaluate(()=>JSON.stringify(dialogueEditor.model.output()))).includes('studio_draft_only'));
  const draftNode=await talk.getAttribute('data-node');await talk.locator('.card-head').click();
  await p.locator('#node-detail [data-action="append-row"]').click();assert.equal(await p.locator('[data-node="'+draftNode+'"] .socket.draft').count(),1,'extending a card must not orphan its unfinished pin');
  await p.click('#undo');assert.equal(await talk.locator('.socket.draft').count(),1);
  const emptyLabel=talk.locator('.port-label').filter({hasText:'조건 지정 필요'}),declared=talk.locator('.socket.draft'),baseline=await declared.count();
  await talk.locator('[data-card-action=pin]').click();assert.equal(await declared.count(),baseline+1);
  await emptyLabel.click({button:'right'});assert(await p.locator('#map-menu [data-menu=inspect]').isVisible());assert.equal(await p.locator('#map-menu [data-menu=duplicate]').count(),0);await p.click('[data-menu=drop-pin]');assert.equal(await declared.count(),baseline);
  await p.click('#undo');assert.equal(await declared.count(),baseline+1);await p.click('#redo');assert.equal(await declared.count(),baseline);
  await talk.locator('[data-card-action=pin]').click();const emptyIndex=await emptyLabel.getAttribute('data-pin-label');
  await talk.locator('[data-port="'+emptyIndex+'"]').click({button:'right'});assert(await p.locator('[data-menu=drop-pin]').isVisible());await p.keyboard.press('Escape');await talk.locator('[data-pin-trash="'+emptyIndex+'"]').click();assert.equal(await declared.count(),baseline);
  await talk.locator('[data-card-action=pin]').click();await emptyLabel.click();await ui.getByRole('button',{name:'미연결 핀 삭제'}).click();assert.equal(await declared.count(),baseline);
  await card.locator('.port-label').nth(1).press('Shift+F10');assert(await p.locator('[data-menu=unlink]').isVisible());assert(await p.locator('[data-menu=drop-option]').isVisible());await p.keyboard.press('Escape');assert.deepEqual(await state(),revised);
  // The same registered actors and expression composer serve node, choice, pin and line edits.
  await card.locator('.socket-out').nth(1).click();
  const req=section('choiceWhen'),fx=section('choiceEffects'),old=await state();
  const actor=scope=>scope.getByLabel('호감도 인물'),number=scope=>scope.getByRole('spinbutton');
  for(const scope of [req,fx]){await scope.locator('[data-add-rule=affinity]').click();const expected=await p.evaluate(()=>dialogueEditor.model.projected.data.tables.characters.filter(c=>String(c.affinity)==='true').map(c=>c.id));assert.deepEqual(await actor(scope).locator('option').evaluateAll(os=>os.map(o=>o.value)),expected);await actor(scope).selectOption('samho');await number(scope).fill(scope===req?'12':'2');}
  await req.getByLabel('비교 기준').selectOption('>=');await fx.getByLabel('변경 방식').selectOption('-=');
  assert.equal(await ui.locator('input[type=text]:visible').count(),0);assert.equal(await ui.locator('details:not([open])').count(),0);assert.equal(await ui.getByRole('textbox').count(),2);
  await ui.getByLabel('선택지 문구',{exact:true}).fill('삼호에게 다시 묻기');await ui.getByLabel('선택 불가 안내').fill('조금 더 친해져야 합니다.');
  assert.deepEqual(await state(),old);await apply();const now=await state();assert.match(now.when,/affinity.samho >= 12/);assert.match(now.fx,/affinity.samho -= 2/);
  const saved=await p.evaluate(async cid=>{const m=dialogueEditor.model,r=await new LunaDialogueEditorModel.Model({...m.files,...m.output()},m.presentation).init(),o=r.tables.bar_choices.find(o=>o.row_id===cid);return [o['text.ko'],o['lock_reason.ko'],o.when,o.effects];},s.choice);
  assert.deepEqual(saved,['삼호에게 다시 묻기','조금 더 친해져야 합니다.',now.when,now.fx]);
  for(const width of [1450,1024,820,640]){await p.setViewportSize({width,height:830});assert(await ui.evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
  await p.setViewportSize({width:1500,height:960});await ui.getByRole('button',{name:'← 노드 상세'}).click();
  const guard=p.locator('#guard-builder');await guard.locator('[data-add-rule=affinity]').click();await actor(guard).selectOption('chris');await number(guard).fill('10');assert.equal(await p.inputValue('#node-when'),'affinity.chris >= 10');assert(await p.locator('#node-when').isHidden());assert(!await p.locator('#node-detail').innerText().then(s=>s.includes('직접 입력')));assert.deepEqual(errors,[]);
  console.log('PIN_INSPECTOR_UI_OK: pointer pin, real SVG hit, next-link inspector, inline create/cancel/reuse/replace/remove, separate choice requirements/effects/link predicate, undo/redo and CSV reload.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
