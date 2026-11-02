/* Loopback server helper. Input is a revision + mode-scoped allowlisted source files,
   never a filesystem path. Validate and stage before touching live data. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {Model,paths}=require('../bar-playtest/src/dev/dialogue-editor/editor-model.js');
const Exterior=require('../bar-playtest/src/dev/dialogue-editor/outside-model.js');
const {generate}=require('./build-shared-data.cjs');
const ROOT=path.resolve(__dirname,'..'),BASE=path.join(ROOT,'bar-playtest/data/shared-csv');
const allowed=new Set([...Object.values(paths),'web-views.json']);
async function snapshot(base=BASE){
 const files={};await load(async p=>(files[p]=await fs.readFile(path.join(base,p),'utf8')));
 files['web-views.json']=await fs.readFile(path.join(base,'web-views.json'),'utf8');
 const presentation=JSON.parse(await fs.readFile(path.join(ROOT,'bar-playtest/data/presentation/runtime-assets.json'),'utf8'));
 const hash=crypto.createHash('sha256');for(const k of Object.keys(files).sort())hash.update(k).update(files[k]);hash.update(JSON.stringify(presentation));
 return {files,presentation,revision:hash.digest('hex')};
}
async function save(input,{base=BASE,runtime=path.join(ROOT,'bar-playtest/data/runtime'),backupRoot=path.join(ROOT,'artifacts/dialogue-editor-backups')}={}){
 const original=await snapshot(base);if(input.revision!==original.revision)throw Error('다른 작업에서 CSV가 변경되었습니다. 새로 불러온 뒤 변경 내용을 다시 적용하세요.');
 const exterior=input.mode==='outside',activePaths=exterior?Exterior.paths:paths,allow=exterior?new Set([...Object.values(activePaths),'web-views.json']):allowed;
 if(!input.files||Array.isArray(input.files)||Object.keys(input.files).some(p=>!allow.has(p)||typeof input.files[p]!=='string'))throw Error('허용되지 않은 저장 파일입니다.');
 const files={...original.files,...input.files},model=await new (exterior?Exterior.Model:Model)(original.files,original.presentation).init();
 const exteriorIds=exterior?new Set(model.flows.flatMap(f=>model.rows(f.id).map(r=>r.row_id))):null;
 const choiceIds=exterior?new Set(model.flows.flatMap(f=>model.rows(f.id).flatMap(r=>model.choices(r.row_id).filter(c=>Object.hasOwn(f.links,c.id)).map(c=>c.row_id)))):null;
 if(exterior)for(const r of model.tables.street_choices)if(Object.values(model.views.outsideChoiceEdits||{}).some(c=>c.stepId===r.parent_id))choiceIds.add(r.row_id);
 for(const [table,p]of Object.entries(activePaths))model.tables[table]=require('../bar-playtest/src/shared/data/csv-catalog.js').parseRows(files[p],p);
 model.views=JSON.parse(files['web-views.json']);
 if(exterior)model.refreshChoiceFlows();
 const validation=await model.validate();if(validation.errors.length)throw Error(validation.errors.join('\n'));
 // This API is a scoped dialogue editor, not an arbitrary CSV writer.
 for(const table of Object.keys(activePaths)){
  const permitted=r=>exterior?(table==='steps'?(exteriorIds.has(r.row_id)||r.row_id.startsWith('exterior_editor_')&&model.flows.some(f=>f.parent===r.parent_id&&!f.onlyChoices)):choiceIds.has(r.row_id)||r.row_id.startsWith('exterior_editor_')&&Object.values(model.views.outsideChoiceEdits||{}).some(c=>c.stepId===r.parent_id)):/^script\/bar\/day[0-3]$/.test(r.dataset_id);
  const before=model.base.tables[table].filter(r=>!permitted(r)),after=model.tables[table].filter(r=>!permitted(r));
  if(JSON.stringify(before)!==JSON.stringify(after)){
   const index=before.findIndex((r,i)=>JSON.stringify(r)!==JSON.stringify(after[i])),row=before[index]||after[before.length],changed=Object.keys(row||{}).filter(k=>row[k]!==after[index]?.[k]);
   throw Error('이 편집기의 허용 범위 밖 데이터는 저장할 수 없습니다. ('+table+': '+(row?.row_id||'행 수')+' / '+changed.join(', ')+')');
  }
 }
 const oldViews=JSON.parse(original.files['web-views.json']),newViews=JSON.parse(files['web-views.json']);
 if(exterior){
  if(model.base.tables.street_choices.some(r=>!model.tables.street_choices.some(n=>n.row_id===r.row_id)&&(!r.row_id.startsWith('exterior_editor_')||model.row(r.parent_id))))throw Error('기존 분기 원본은 보관해야 합니다. 활성 선택지 목록에서 제거하세요.');
  for(const row of model.base.tables.steps){const next=model.row(row.row_id);if(exteriorIds.has(row.row_id)&&!next&&!model.plain(row)&&!model.removableMenu(row))throw Error('연출·분기 연결 행은 삭제할 수 없습니다.');}
  const editableNew=new Set(['row_id','web_row_id','dialogue_id','seq','source_order','text.ko','text.en','actor','web_fields.who']);
  for(const row of model.tables.steps.filter(r=>!model.base.tables.steps.some(b=>b.row_id===r.row_id))){
   const source=model.base.tables.steps.find(b=>exteriorIds.has(b.row_id)&&model.plain(b)&&Object.keys(b).every(k=>editableNew.has(k)||b[k]===row[k]));
   const menu=model.kind(row)==='editor-choice'&&row.template_id==='steps_format_62'&&model.menuConfig(row);
   const branch=row.parent_field==='result_steps'&&row.template_id==='steps_format_30'&&model.tables.street_choices.some(c=>c.row_id===row.parent_id&&c.row_id.startsWith('exterior_editor_'));
   if((!menu&&!branch&&(!source||model.kind(row)!=='say'))||/[<>]/.test((row['text.ko']||'')+(row['text.en']||'')))throw Error('새 줄은 기존 대사·선택지 구조를 유지해야 합니다.');
  }
  for(const flow of model.flows)if(!model.rows(flow.id).length)throw Error('빈 대화 흐름은 저장할 수 없습니다.');
  const known=new Set(model.base.tables.steps.filter(r=>exteriorIds.has(r.row_id)&&r.web_row_id).map(r=>r.web_row_id));
  const safe=v=>v.tables.steps.rows.filter(r=>!known.has(r.id)&&!r.id?.startsWith('exterior_editor_'));
  if(JSON.stringify(safe(oldViews))!==JSON.stringify(safe(newViews)))throw Error('다른 대화의 웹 연결은 변경할 수 없습니다.');
  for(const [id,ref]of Object.entries(newViews.outside).filter(([id])=>id.startsWith('editor/'))){const c=model.tables.street_choices.find(c=>c.id===ref.branch&&c.row_id.startsWith('exterior_editor_'));if(!c||!Object.values(model.views.outsideChoiceEdits||{}).some(g=>g.stepId===c.parent_id)||!Object.values(oldViews.outside).some(r=>r.source===ref.source&&r.scene===ref.scene)||ref.offset!==0)throw Error('새 분기 연결이 원본 장면 밖을 가리킵니다.');}
  delete oldViews.outsideChoiceEdits;delete newViews.outsideChoiceEdits;
  for(const v of [oldViews,newViews])for(const id of Object.keys(v.outside))if(id.startsWith('editor/'))delete v.outside[id];
 }
 for(const view of exterior?['steps']:['steps','bar_choices','bar_choice_groups']){delete oldViews.tables[view];delete newViews.tables[view];}
 if(JSON.stringify(oldViews)!==JSON.stringify(newViews))throw Error('장면 외 연결 구조 변경은 허용하지 않습니다.');
 const built=await generate(p=>Promise.resolve(files[p]));
 const updates=Object.entries(input.files).filter(([p,text])=>text!==original.files[p]).map(([p,text])=>({target:path.join(base,p),relative:'shared-csv/'+p,text}));
 if(!updates.length)return {saved:false,revision:original.revision};
 for(const [p,text]of Object.entries(built.files))updates.push({target:path.join(runtime,p),relative:'runtime/'+p,text});
 const backup=path.join(backupRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8));
 await fs.mkdir(backup,{recursive:true});
 for(const u of updates){u.before=await fs.readFile(u.target,'utf8');const dest=path.join(backup,u.relative);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,u.before);u.temp=u.target+'.editor-'+crypto.randomUUID()+'.tmp';await fs.writeFile(u.temp,u.text);}
 const written=[];
 try{
  if((await snapshot(base)).revision!==original.revision)throw Error('저장 준비 중 원본이 변경되어 중단했습니다.');
  for(const u of updates){await fs.rename(u.temp,u.target);written.push(u);}
 }catch(e){for(const u of written)await fs.writeFile(u.target,u.before);throw e;}
 finally{for(const u of updates)await fs.rm(u.temp,{force:true});}
 return {saved:true,revision:(await snapshot(base)).revision,backup:path.relative(ROOT,backup),files:updates.map(u=>u.relative)};
}
async function runtimeSnapshot(base=BASE){
 const source=await snapshot(base),{result}=await generate(p=>Promise.resolve(source.files[p]));
 return {revision:source.revision,tables:Object.fromEntries(['steps','bar_choices','bar_choice_groups'].map(k=>[k,result.data.tables[k]])),story:{opening:result.story.opening,bar:result.story.bar,day0Bar:result.story.day0Bar},exterior:{sharedStory:result.data.sharedStory,choices:result.data.outsideChoices,choiceEdits:result.data.outsideChoiceEdits,scenes:result.story.scenes,prologue:result.story.prologue}};
}
if(require.main===module)(async()=>{if(process.argv.includes('--runtime'))return runtimeSnapshot();if(process.argv.includes('--snapshot'))return snapshot();let input='';process.stdin.setEncoding('utf8');for await(const chunk of process.stdin)input+=chunk;return save(JSON.parse(input));})().then(x=>process.stdout.write(JSON.stringify(x))).catch(e=>{process.stderr.write(e.message);process.exitCode=1;});
module.exports={snapshot,save,runtimeSnapshot};
