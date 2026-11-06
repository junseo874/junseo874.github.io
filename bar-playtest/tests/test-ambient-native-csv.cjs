const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {generate}=require('../../tools/build-shared-data.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js');
const {snapshot}=require('../../tools/dialogue-editor-storage.cjs');
const {condition}=require('../src/core/core.js');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const {catalog,result}=await generate(),rules=result.data.outsideAmbient;
 assert.equal(catalog.values.has('script/ambient'),false);
 assert.equal(Object.keys(rules).length,7);
 let count=0;
 for(const [id,r]of Object.entries(rules)){
  const source='script/'+r.scene,scene=catalog.read(source).scenes.find(s=>s.id===id);
  assert(scene);assert.equal(scene.start_mode,'auto');assert.equal(scene.runtime_scene,r.scene==='home'?'Home':'OutSide');
  const points=catalog.read(r.scene==='home'?'interact_points_home':'interact_points_outside');
  const point=points.find(p=>p.source_id===r.sourceId&&p.dialogue_flows?.some(f=>f.scene_id===id));
  assert.equal(point.activation_mode,'proximity');assert.equal(point.action_type,'dialogue');
  assert(scene.steps.every(s=>s.type==='say'&&s.dialogue_id&&s.text.ko));
  count+=scene.steps.length;
  const projected=result.data.sharedStory['ambient/'+id];
  assert.deepEqual(projected.map(s=>s.text),scene.steps.map(s=>s.text.ko));
  assert.deepEqual(projected.map(s=>s.actor),scene.steps.map(s=>s.actor==='tv_announcer'?'tv':s.actor));
  assert(projected.every(s=>s.editorRowId));
  assert.equal(r.playType,r.scene==='home'?'repeat':'once');
 }
 assert.equal(count,50);
 const sandbox={LUNA_DATA:result.data,LunaCore:{condition}};sandbox.window=sandbox;
 vm.runInNewContext(fs.readFileSync(path.join(root,'bar-playtest/data/runtime/outside-dialogues.js'),'utf8'),sandbox);
 const C=sandbox.LunaOutsideContent;
 for(const [id,r]of Object.entries(rules))for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const scene of ['home','street']){
  const expected=day===r.day&&scene===r.scene&&r.phase==='commute_'+flow;
  assert.equal(C.present({config:{day,flow},scene,level:0},{id}),expected,id+' '+day+flow+scene);
 }
 // Prove CSV conditions, not old event day/flow literals, determine visibility.
 const id='outside_day0_store_passers',rule=rules[id];rule.spawnWhen='day == 3';rule.day=3;rule.phase='commute_in';
 assert(C.present({scene:'street',config:{day:3,flow:'in'}},{id,day:0,flow:'out'}));
 const input=await snapshot(),model=await new Model(input.files,input.presentation).init();
 for(const id of Object.keys(rules)){
  const flow=model.flow('ambient/'+id);assert(flow);
  assert(model.rows(flow.id).every(row=>row.dataset_id===('script/'+rules[id].scene)));
 }
 assert.equal((await model.validate()).errors.length,0);
 console.log('AMBIENT_NATIVE_CSV_OK: 7 scenes / 50 lines, native bindings, day/route matrix, TV speaker and editor.');
})().catch(e=>{console.error(e);process.exitCode=1;});
