/* Loopback server helper. Input is a revision + four allowlisted source files,
   never a filesystem path. Validate and stage before touching live data. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('../bar-playtest/src/shared/data/csv-catalog.js');
const {Model,paths}=require('../bar-playtest/src/dev/dialogue-editor/editor-model.js');
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
 if(!input.files||Array.isArray(input.files)||Object.keys(input.files).some(p=>!allowed.has(p)||typeof input.files[p]!=='string'))throw Error('허용되지 않은 저장 파일입니다.');
 const files={...original.files,...input.files},model=await new Model(original.files,original.presentation).init();
 for(const [table,p]of Object.entries(paths))model.tables[table]=require('../bar-playtest/src/shared/data/csv-catalog.js').parseRows(files[p],p);
 model.views=JSON.parse(files['web-views.json']);
 const validation=await model.validate();if(validation.errors.length)throw Error(validation.errors.join('\n'));
 // This API is only a bar editor, not an arbitrary CSV writer.
 for(const table of Object.keys(paths)){
  const permitted=r=>/^script\/bar\/day[0-3]$/.test(r.dataset_id);
  const before=model.base.tables[table].filter(r=>!permitted(r)),after=model.tables[table].filter(r=>!permitted(r));
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('바 0~3일차 외의 데이터는 이 편집기에서 저장할 수 없습니다.');
 }
 const oldViews=JSON.parse(original.files['web-views.json']),newViews=JSON.parse(files['web-views.json']);
 for(const view of ['steps','bar_choices','bar_choice_groups']){delete oldViews.tables[view];delete newViews.tables[view];}
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
if(require.main===module)(async()=>{if(process.argv.includes('--snapshot'))return snapshot();let input='';for await(const chunk of process.stdin)input+=chunk;return save(JSON.parse(input));})().then(x=>process.stdout.write(JSON.stringify(x))).catch(e=>{process.stderr.write(e.message);process.exitCode=1;});
module.exports={snapshot,save};
