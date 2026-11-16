const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {generate}=require('../../tools/build-shared-data.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js');
const {snapshot}=require('../../tools/dialogue-editor-storage.cjs');
const {condition}=require('../src/core/core.js');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const {catalog,result}=await generate(),rules=result.data.outsideAmbient;
 const ambient=catalog.read('script/ambient');
 assert.equal(ambient.place,'ambient');assert.equal(ambient.scenes.length,7);
 assert.deepEqual(Object.keys(rules).sort(),ambient.scenes.map(s=>s.id).sort());
 let count=0;
 for(const [id,r]of Object.entries(rules)){
  const scene=ambient.scenes.find(s=>s.id===id);
  assert(scene);assert.equal(scene.trigger,'manual');assert.equal(scene.phase,r.scene==='home'?'home':r.phase);
  for(const source of ['script/home','script/street'])assert(!catalog.read(source).scenes.some(s=>s.id===id),'no duplicate: '+id);
  const points=catalog.read(r.scene==='home'?'interact_points_home':'interact_points_outside');
  const point=points.find(p=>p.source_id===r.sourceId&&p.dialogue_flows?.some(f=>f.scene_id===id));
  assert.equal(point.activation_mode,'proximity');assert.equal(point.action_type,'dialogue');
  assert(scene.steps.every(s=>s.type==='say'&&s.dialogue_id&&s.text.ko));
  count+=scene.steps.length;
  const projected=result.data.sharedStory['ambient/'+id];
  assert.deepEqual(projected.map(s=>s.text),scene.steps.map(s=>s.text.ko));
  assert.deepEqual(projected.map(s=>s.actor),scene.steps.map(s=>s.actor));
  if(r.scene==='home'){assert(scene.steps.every(s=>s.actor==='tv'));assert.equal(point.id,r.phase==='commute_out'?'p_home_tv_evening':'p_home_tv_morning');}
  assert(projected.every(s=>s.editorRowId));
  assert.equal(r.playType,r.scene==='home'?'repeat':'once');
 }
 const script=require('./fixtures/exterior-notion.json').dialogues;
 assert.equal(count,Object.keys(rules).reduce((n,id)=>n+script['ambient/'+id].spoken,0));
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
  assert(model.rows(flow.id).every(row=>row.dataset_id==='script/ambient'));
 }
 const tvFlow=model.flow('ambient/outside_day0_tv_news1');
 assert(!model.canEdit(model.rows(tvFlow.id)[0],'actor',tvFlow));
 const [caption]=model.rows('home/book'),[prompt,menu]=model.rows('home/wardrobe');
 assert(!model.canAddMenu(model.flow('home/book'))&&!model.plain(caption));
 assert(!model.canEdit(menu,'text.ko',model.flow('home/wardrobe')));
 model.set(caption,'text.ko','책 표지 검수');model.set(prompt,'text.ko','옷장 안내 검수');
 const edited=await model.validate();assert.deepEqual(edited.errors,[]);
 assert.deepEqual(edited.result.data.sharedStory['home/wardrobe'].map(r=>[r.type,r.text]),[['home-choice','옷장 안내 검수']]);
 assert.equal(edited.result.data.sharedStory['home/book'][0].text,'책 표지 검수');
 // A full CSV relocation must not disconnect a test editor edit from the real TV screen.
 const m={scene:'home',config:{day:0,flow:'out'},dialog:{key:'qa'}},W={LUNA_DATA:{outsideChoices:edited.result.data.outsideChoices.map(r=>({...r}))},lunaCampaign:{outside:{model:m}},LunaCore:{condition}};
 const opts=W.LUNA_DATA.outsideChoices.filter(r=>r.menu==='home_tv_menu');assert.equal(opts.length,3);
 const watch=opts.find(r=>r.id==='watch');watch['text.ko']='방송 보기';watch.when='flag.tv_test';watch.order=3;
 vm.runInNewContext(fs.readFileSync(path.join(root,'bar-playtest/src/features/outside/events/outside-tv.js'),'utf8'),{window:W});
 assert.deepEqual(Array.from(W.LunaOutsideTV.choiceView(m).options,r=>r.label),['끈다','취소','방송 보기']);
 assert(W.LunaOutsideTV.choiceView(m).options.at(-1).disabled);
 W.barGame={progress:{flags:{tv_test:true}}};assert(!W.LunaOutsideTV.choiceView(m).options.at(-1).disabled);
 console.log('AMBIENT_NATIVE_CSV_OK: 7 scenes / '+count+' lines, native bindings, day/route matrix, TV speaker and editor.');
})().catch(e=>{console.error(e);process.exitCode=1;});
