const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs');
const {Model}=require('../src/dev/dialogue-editor/outside-model.js');
const {controller}=require('../src/dev/dialogue-editor/live-data.js');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const source=await snapshot(),m=await new Model(source.files,source.presentation).init();
 assert.equal(m.flows.length,80);assert.deepEqual(m.output(),{});assert.deepEqual((await m.validate()).errors,[]);
 for(const id of ['prologue','night0','night1','night2','ending','johnny','terraceMemory','believer/intro','newspaper/options','choices/info','choices/stock'])assert(m.rows(id).length,id);
 const first=m.rows('believer/intro')[0],original=first['text.ko'];m.checkpoint();m.set(first,'text.ko','편집기 "검수"...\n두 번째 줄');m.undo();assert.equal(m.row(first.row_id)['text.ko'],original);m.redo();
 const added=m.add('believer/intro',1),duplicate=m.add('believer/intro',2,added);assert.notEqual(added.row_id,duplicate.row_id);m.remove('believer/intro',added.row_id);m.set(duplicate,'text.ko','추가한 외부 대사');
 assert.throws(()=>m.remove('newspaper/options',m.rows('newspaper/options')[0].row_id),/연출/);
 const choiceStep=m.rows('thug/intro').at(-1),choices=m.choices(choiceStep.row_id);assert.equal(choices.length,2);m.set(choices[0],'text.ko','조건을 확인하고 지불한다.');m.set(choices[0],'when','money >= 500 && flag.editor_ready');m.set(choices[0],'lock_reason.ko','먼저 준비를 마치세요.');
 assert.deepEqual((await m.validate()).errors,[]);
 m.set(duplicate,'text.ko','<shake>추가 줄도 검증</shake>');assert((await m.validate()).errors.length);m.set(duplicate,'text.ko','추가한 외부 대사');
 m.set(choices[0],'when','false && invalid()');assert((await m.validate()).errors.length);m.set(choices[0],'when','money >= 500 && flag.editor_ready');
 const ambientId='ambient/outside_day0_store_passers',ambient=m.rows(ambientId)[0];assert.equal(ambient.dataset_id,'script/street');m.set(ambient,'text.ko','주변 대화 CSV 저장 검수.');
 const tvId='ambient/outside_day0_tv_news1',tv=m.rows(tvId)[0];assert.equal(tv.dataset_id,'script/home');assert.equal(tv.actor,'tv_announcer');m.set(tv,'text.ko','TV 뉴스 CSV 저장 검수.');
 m.set(m.row(first.row_id),'text.ko','<shake>미지원</shake>');assert((await m.validate()).errors.length);m.set(m.row(first.row_id),'text.ko','편집기 "검수"...\n두 번째 줄');
 // Actual writes happen only in a disposable CSV/runtime copy, never the live repository.
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-outside-editor-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');await fs.cp(path.join(root,'bar-playtest/data/shared-csv'),base,{recursive:true});await fs.mkdir(runtime);for(const p of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(root,'bar-playtest/data/runtime',p),path.join(runtime,p));
 const options={base,runtime,backupRoot:path.join(tmp,'backups')},saved=await save({mode:'outside',revision:source.revision,files:m.output()},options);assert(saved.saved);assert((await fs.readFile(path.join(base,'story/steps.csv'),'utf8')).includes('추가한 외부 대사'));assert((await fs.readFile(path.join(runtime,'game-data.js'),'utf8')).includes('조건을 확인하고 지불한다.'));await assert.rejects(save({mode:'outside',revision:source.revision,files:m.output()},options),/변경/);
 const current=await snapshot(base),changed=await new Model(current.files,current.presentation).init();changed.tables.steps.find(r=>r.dataset_id==='script/bar/day0')['text.ko']='범위 밖';await assert.rejects(save({mode:'outside',revision:current.revision,files:changed.output()},options),/항목|범위/);
 const live=await runtimeSnapshot(base);assert(live.exterior.sharedStory['believer/intro'].some(r=>r.text==='추가한 외부 대사'));
 assert.equal(live.exterior.sharedStory[ambientId][0].text,'주변 대화 CSV 저장 검수.');assert.equal(live.exterior.sharedStory[tvId][0].text,'TV 뉴스 CSV 저장 검수.');assert.equal(live.exterior.sharedStory[tvId][0].actor,'tv');assert.equal(live.exterior.ambient.outside_day0_tv_news1.sourceId,'home_tv');
 // The NPC modules capture these arrays: hot reload must preserve their identity.
 const captured=[{text:'previous'}],scenes={night0:[{text:'old terrace'}]},raw={tables:{},sharedStory:{'believer/intro':captured}},g={story:{index:3}},campaign={session:{original:{}},data:{scenes}},story={scenes};
 const bridge=controller({g,D:raw,raw,campaign,story});assert.equal(bridge.receive(live),'pending');assert.equal(raw.sharedStory['believer/intro'],captured);assert(captured.some(r=>r.text==='추가한 외부 대사'));assert.equal(g.story.index,3);bridge.apply();assert.equal(bridge.revision,saved.revision);
 assert.deepEqual(raw.outsideAmbient,live.exterior.ambient);
 // Native choice labels/conditions are used both by preview and real handlers.
 const W={LunaRuleParts:{conditions:require('../src/core/story-conditions.js')},LUNA_DATA:{outsideChoices:live.exterior.choices},barGame:{progress:{money:600,flags:{},affinity:{}}}};
 vm.runInNewContext(await fs.readFile(path.join(root,'bar-playtest/src/features/outside/events/outside-authoring.js'),'utf8'),{window:W});const baseView={options:[{id:'thug-pay',label:'old',disabled:false},{id:'thug-refuse',label:'old'}]},line={type:'thug-choice'};let view=W.LunaOutsideAuthoring.choices(line,baseView,{config:{day:1}});assert(view.options[0].disabled);assert.equal(view.options[0].disabledReason,'먼저 준비를 마치세요.');W.barGame.progress.flags.editor_ready=true;view=W.LunaOutsideAuthoring.choices(line,baseView,{config:{day:1}});assert(!view.options[0].disabled);assert.equal(view.options[0].label,'조건을 확인하고 지불한다.');baseView.options[0].disabled=true;assert(W.LunaOutsideAuthoring.choices(line,baseView,{config:{day:1}}).options[0].disabled,'runtime transaction guard cannot be bypassed');
 assert.equal((await snapshot()).revision,source.revision);
 console.log('OUTSIDE_EDITOR_OK: 80 flows, CRUD/undo, branch-safe CSV, conditions, real temp save/backup/conflict, scoped writes, runtime choice gates and live captured-array update.');
})().catch(e=>{console.error(e);process.exitCode=1;});
