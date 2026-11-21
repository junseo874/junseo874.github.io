const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs'),{Model}=require('../src/dev/dialogue-editor/editor-model.js'),F=require('../src/dev/dialogue-editor/flow-model.js'),wiring=require('../src/dev/dialogue-editor/flow-wiring.js');
(async()=>{
 const original=await snapshot(),m=await new Model(original.files,original.presentation).init();
 for(const scene of m.scenes){
  const g=F.compile(m,scene.id),plan=wiring.scan(m,scene.id,true);
  assert.deepEqual(plan.errors,[]);
  const all=m.rows(scene.id),signals=new Set(plan.routes.flatMap(link=>link.steps.map(row=>row.row_id)));
  for(const row of all)if(wiring.mergeOwner(row))signals.add(row.row_id);
  assert.deepEqual(plan.hidden,signals,'only recognized route and join signals may be hidden');
  assert.deepEqual(g.nodes.flatMap(n=>n.rows),all.filter(row=>!signals.has(row.row_id)));
  assert(g.edges.every(e=>e.end||e.targetScene||g.nodes.find(n=>n.id===e.to)));
 }
 const scene='d1_tutorial_chris',graph=F.compile(m,scene),choice=graph.nodes.find(n=>n.type==='선택지'),opts=m.choices(choice.rows[0].arg),branches=graph.edges.filter(e=>e.from===choice.id);
 assert.equal(branches.length,2);assert.deepEqual(branches.map(e=>e.guard),['!flag.day0_skip_tutorial','flag.day0_skip_tutorial']);
 assert.deepEqual(m.output(),{});assert.throws(()=>F.checkGuard('served_cocktail.id == gin_tonic'));
 const service=graph.nodes.find(n=>n.rows.at(-1).type==='serve');
 const newLine=F.addResponse(m,scene,service,null,'craft_grade == excellent');m.set(newLine,'text.ko','제조 결과 테스트');
 m.checkpoint();const reply=F.addResponse(m,scene,choice,opts[1].row_id);assert(reply.when.startsWith('flag.'));
 const key=reply.when;m.set(reply,'text.ko','선택 응답 테스트');assert(m.choices(choice.rows[0].arg)[1].effects.endsWith(key+' = true'));assert(m.choices(choice.rows[0].arg)[0].effects.endsWith(key+' = false'));
 m.undo();assert(!m.row(reply.row_id));m.redo();assert(m.row(reply.row_id));
 const second='campaign_d2_bar_open',talk=F.compile(m,second).nodes.find(n=>n.type==='대화'),menu=F.insertChoice(m,second,talk),newOptions=m.choices(menu.arg);
 assert.equal(newOptions.length,2);assert(newOptions.every(o=>!o.effects&&!o.goto));m.set(newOptions[1],'goto','campaign_d2_bar');
 assert(F.compile(m,second).edges.some(e=>e.choice===newOptions[1].row_id&&e.targetScene==='campaign_d2_bar'));
 // A choice goto changes the script, not the seats. Chris is still on R,
 // so his second arrival late in the destination would actually stop play.
 const blocked=await m.validate();assert(blocked.issues.some(i=>i.scene==='campaign_d2_bar'&&i.message.includes('좌석이 비기 전에 chris')));
 const exit=m.add(second,m.rows(second).indexOf(menu),'exit');require('../src/dev/dialogue-editor/flow-days.js').neutral(m,exit,'chris');
 assert.deepEqual((await m.validate()).errors,[]);
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'bar-flow-test-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');
 await require('./helpers/copy-editor-source.cjs')(base);await fs.mkdir(runtime);
 for(const f of ['campaign-data.js','game-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',f),path.join(runtime,f));
 await save({revision:original.revision,files:m.output()},{base,runtime,backupRoot:path.join(tmp,'backup')});
 const live=await runtimeSnapshot(base);for(const r of [reply,newLine]){const saved=live.tables.steps.find(x=>x.dialogue_id===r.dialogue_id);assert.equal(saved.when,r.when);assert.equal(saved['text.ko'],r['text.ko']);}
 assert(live.tables.bar_choices.some(o=>o.context===menu.arg&&o.goto==='campaign_d2_bar'));
 const reload=await snapshot(base),again=await new Model(reload.files,reload.presentation).init(),cg=F.compile(again,scene);
 assert(cg.edges.some(e=>e.from===choice.id&&e.choice===opts[1].row_id&&e.to===reply.row_id));assert.equal((await snapshot()).revision,original.revision);
 console.log('BAR_FLOW_OK: 7 scenes, choice paths, scoped CSV branches, undo, disk save and main-game reload');
})().catch(e=>{console.error(e);process.exitCode=1;});
