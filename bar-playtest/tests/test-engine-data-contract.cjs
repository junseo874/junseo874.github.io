const assert=require('node:assert/strict');
const {audit}=require('../../tools/check-engine-data-contract.cjs');
const {snapshot}=require('../../tools/dialogue-editor-storage.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js');
const {engineExpressionErrors}=require('../src/dev/dialogue-editor/editor-model.js');
(async()=>{
 const current=await audit();assert.deepEqual(current.errors,[]);
 assert(!current.gaps.some(g=>/reputation|give\(soda_water/.test(g.value||'')));
 assert(!current.gaps.some(g=>['steps_shared_newspaper_common_11','steps_shared_believer_intro_15'].includes(g.row)));
 const s=await snapshot(),m=await new Model(s.files,s.presentation).init();
 const {parseRows}=require('../src/shared/data/csv-catalog.js');
 for(const [id,flag] of [['steps_shared_newspaper_common_11','newspaper_gear_received'],['steps_shared_believer_intro_15','believer_emblem_received']]){
  const r=parseRows(s.files['story/steps.csv']).find(r=>r.row_id===id);
  assert.deepEqual([r.type,r.arg,r.sync,r.when],['popup','event_occurred','nowait','!flag.'+flag]);
  assert(r.effects.includes('flag.'+flag+' = true'));assert(r['text.ko'].endsWith('획득!'));
 }
 const interactionFile='interaction/interact_points.csv',qaFile=s.files[interactionFile];
 const points=parseRows(qaFile),flows=parseRows(s.files['interaction/dialogue_flows.csv']);
 const {condition}=require('../src/core/core.js');
 function entry(source,day,phase,flags={}){
  const ctx={day,flags},point=points.find(r=>r.source_id===source&&[phase,'both'].includes(r.phase)&&condition(r.spawn_when,ctx));
  return point&&flows.filter(f=>f.parent_id===point.row_id&&(f.day==='\\N'||Number(f.day)===day)).sort((a,b)=>a.flow_seq-b.flow_seq).find(f=>f.when==='\\N'||condition(f.when,ctx))?.scene_id;
 }
 assert.equal(entry('street-newspaper',1,'commute_in'),'shared-newspaper-intro');
 assert.equal(entry('street-newspaper',1,'commute_in',{newspaper_gear_received:true}),'shared-newspaper-finish');
 assert.equal(entry('street-newspaper',1,'commute_out',{newspaper_conversation_done:true}),undefined);
 assert.equal(entry('street-newspaper',1,'commute_out',{newspaper_conversation_done:true,newspaper_evening_visit:true}),'shared-newspaper-repeat');
 assert.equal(entry('street-newspaper',1,'commute_out'),'shared-newspaper-evening');
 assert.equal(entry('street-believer',0,'commute_in'),undefined);
 assert.equal(entry('street-believer',0,'commute_out'),'shared-believer-intro');
 assert.equal(entry('street-believer',1,'commute_in',{believer_emblem_received:true}),'shared-believer-finish');
 assert.equal(entry('street-believer',1,'commute_out',{believer_conversation_done:true}),undefined);
 assert.equal(entry('home_tv',0,'commute_out'),'home_tv_cutscene');
 assert.equal(entry('home_tv_broadcast',0,'commute_out'),'outside_day0_tv_news1');
 assert.equal(parseRows(qaFile).find(r=>r.id==='p_qa_pure_display').action_type,'none');
 const invalidQA=qaFile.replace(/("p_qa_pure_display"[^\n]*?)"none"/,'$1"broken_type"');
 const invalid=await audit({read:p=>Promise.resolve(p===interactionFile?invalidQA:s.files[p])});
 assert(invalid.errors.some(e=>e.row==='p_qa_pure_display'&&e.reason.includes('action_type')));
 for(const [file,text] of Object.entries(s.files))assert(!text.includes('ob_vending'),file+' retains a vending reference');
 const qaChoice=parseRows(s.files['story/bar_choices.csv']).find(r=>r.row_id==='bar_choices_script_bar_day99_ch_t99_branch_2');
 assert.equal(qaChoice.effects,'money += 100; affinity.port += 2; flag.t99_paid = true');
 assert.equal(qaChoice['text.ko'],'효과 적용 — 골드+100 · 포트 호감+2');
 assert.equal(qaChoice['text.en'],'Apply effects — Gold +100 · Port +2');
 const qaResult=parseRows(s.files['story/steps.csv']).find(r=>r.row_id==='steps_t99_effect_check_1');
 assert(!/평판|Reputation/.test(qaResult['text.ko']+qaResult['text.en']));
 const menu=m.addMenu('believer/intro',1);m.addMenuOption(menu);
 assert.deepEqual((await m.validate()).errors,[]);
 let files={...s.files,...m.output()},checked=await audit({read:p=>Promise.resolve(files[p])});assert.deepEqual(checked.errors,[]);
 menu['web_fields.type']='editor-choice';files={...s.files,...m.output()};
 checked=await audit({read:p=>Promise.resolve(files[p])});assert(checked.errors.some(e=>e.reason.includes('editor-choice')));
 assert((await m.validate()).errors.some(e=>e.includes('editor-choice')));
 for(const effects of ['reputation += 1','give(soda_water, 1)','money = 500','money -= -1','flag.x += 1','affinity.tom += 0.5'])assert(engineExpressionErrors({effects}).length,effects);
 assert.deepEqual(engineExpressionErrors({effects:'money += 50; flag.x = true; affinity.tom -= 2',when:'day >= 1'}),[]);
 assert(engineExpressionErrors({when:'cocktail.abv >= 20'}).length);
 assert.deepEqual(engineExpressionErrors({effects:'reputation += 1'},{effects:'reputation += 1'}),[],'unchanged legacy data must not be silently removed');
 console.log('ENGINE_DATA_CONTRACT_OK: installed engine schema/types, native choice, rejected custom command/effects and explicit legacy gaps.');
})().catch(e=>{console.error(e);process.exitCode=1;});
