const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs'),{Model}=require('../src/dev/dialogue-editor/editor-model.js'),F=require('../src/dev/dialogue-editor/flag-tools.js');
(async()=>{
 const src=await snapshot(),m=await new Model(src.files,src.presentation).init(),p=await fs.mkdtemp(path.join(os.tmpdir(),'luna-workbench-')),base=path.join(p,'csv'),runtime=path.join(p,'runtime'),config={base,runtime,backupRoot:path.join(p,'backup')};
 await fs.cp(path.join(__dirname,'../data/shared-csv'),base,{recursive:true});await fs.cp(path.join(__dirname,'../data/runtime'),runtime,{recursive:true});
 const scenes=m.scenes,first=m.rows(scenes[0].id)[0],r=m.rows(scenes[1].id).find(r=>r.type==='say'),menu=m.rows(scenes[2].id).find(r=>r.type==='choice'),choice=m.choices(menu.arg)[0],check=()=>m.validate();
 const baseAudit=await check();assert.deepEqual(baseAudit.issues,[]);for(const s of scenes)for(const e of m.rows(s.id).filter(r=>r.entrance==='seated'))assert.equal(baseAudit.result.data.tables.steps.find(x=>x.row_id===e.web_row_id).entrance,'seated');
 for(const [field,value]of [['text.ko','<shake>안녕'],['lock_reason.ko','잠금 <color=#']]){const orig=choice[field];choice[field]=value;const a=await check();assert(a.issues.some(i=>i.choice===choice.row_id&&i.field===field&&i.severity==='error'));await assert.rejects(save({revision:src.revision,files:m.output()},config),/태그/);choice[field]=orig;}
 const priorWhen=first.when;first.when='flag.visitor';assert((await check()).issues.some(i=>i.message.includes('입장하지 않은')&&i.scene===first.context));first.when=priorWhen;
 const options=m.choices(menu.arg),gates=options.map(x=>x.when);options.forEach(x=>x.when='flag.gate');assert((await check()).errors.some(s=>s.includes('모든 선택지')));options.forEach((x,i)=>x.when=gates[i]);
 F.create(m,r,'visit',false);m.set(choice,'when','!flag.visit && !flag.visit_plus');const raw='대사 속 flag.visit';m.set(r,'text.ko',raw);
 assert.throws(()=>F.rewrite(m,'visit','visit_plus'),/이미/);assert.throws(()=>F.rewrite(m,'day0_skip_tutorial','unsafe'),/보호|게임/);
 m.checkpoint();F.rewrite(m,'visit','visited');assert.equal(choice.when,'!flag.visited && !flag.visit_plus');assert.equal(r['text.ko'],raw);assert.equal(F.index(m).flags.get('visited').uses.length,2);
 const cr=choice.row_id,rr=r.row_id;const find=()=>m.tables.bar_choices.find(x=>x.row_id===cr);m.undo();assert.match(find().when,/!flag\.visit &&/);m.redo();m.checkpoint();F.rewrite(m,'visited',null);assert.equal(find().when,'!flag.visit_plus');m.undo();assert.match(find().when,/visited/);
 assert.deepEqual((await check()).errors,[]);const response=await save({revision:src.revision,files:m.output()},config);assert(response.saved);const live=await runtimeSnapshot(base),saved=await snapshot(base),reload=await new Model(saved.files,saved.presentation).init();
 assert.match(reload.row(rr).effects,/flag\.visited = false/);assert(live.tables.bar_choices.some(x=>x.when==='!flag.visited && !flag.visit_plus'));assert.equal((await snapshot()).revision,src.revision);
 console.log('BAR_WORKBENCH_OK: tag+service blockers in server, all-days token rename/delete/undo, seated projection and isolated disk/runtime reload.');
})().catch(e=>{console.error(e);process.exitCode=1;});
