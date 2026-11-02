const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs'),{Model}=require('../src/dev/dialogue-editor/editor-model.js');
const {compile,html}=require('../src/shared/dialogue/text-effects.js');
const {range}=require('../src/dev/dialogue-editor/color-picker.js');
const root=path.resolve(__dirname,'../..');
(async()=>{
 assert.deepEqual(range('안녕 루나',0,2),{start:0,end:2,content:'안녕',color:'#72DAE3',existing:false});
 assert.equal(range('안녕 루나',2,2).content,'안녕 루나','no selection colors the whole line');
 const colored='앞 <color=#ff6666>안녕</color> 뒤',inside=colored.indexOf('안녕'),editRange=range(colored,inside,inside);
 assert.equal(editRange.existing,true);assert.equal(editRange.color,'#FF6666');assert.equal(editRange.content,'안녕');assert.equal(colored.slice(editRange.start,editRange.end),'<color=#ff6666>안녕</color>');
 const source=await snapshot(),m=await new Model(source.files,source.presentation).init();assert.equal(m.scenes.length,7);assert.deepEqual((await m.validate()).errors,[]);assert.deepEqual(m.output(),{});
 // Exercise the real Python -> Node stdin boundary, not only the in-process helper.
 const payload=JSON.stringify({revision:source.revision,files:{'story/steps.csv':source.files['story/steps.csv']}}),bytes=Buffer.from(payload),split=Buffer.byteLength(payload.slice(0,payload.search(/[가-힣]/)))+1;
 const transport=await new Promise((resolve,reject)=>{
  const child=require('node:child_process').spawn(process.execPath,[path.join(root,'tools/dialogue-editor-storage.cjs')]);let out='',error='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>error+=v);child.on('error',reject);child.stdin.on('error',reject);
  child.on('close',code=>code?reject(Error(error)):resolve(JSON.parse(out)));child.stdin.write(bytes.subarray(0,split));setTimeout(()=>child.stdin.end(bytes.subarray(split)),30);
 });assert.equal(transport.saved,false,'unchanged CSV must survive a split Korean UTF-8 character without being corrupted');assert.equal(transport.revision,source.revision);
 const scene='campaign_d3_bar',r=m.rows(scene).find(r=>r.type==='say'),original=r['text.ko'];m.checkpoint();m.set(r,'text.ko','안녕, "루나".\n<shake amp=1 hz=18>반가워!</shake>');assert(m.dirty());m.undo();assert.equal(m.row(r.row_id)['text.ko'],original);m.redo();
 const added=m.add(scene,2,'say');m.set(added,'text.ko','테스트 대사');const copy=m.add(scene,3,'say',added);assert.notEqual(copy.row_id,added.row_id);m.remove(scene,added.row_id);
 const choice=m.rows(scene).find(r=>r.type==='choice'),duplicate=m.add(scene,4,'choice',choice);assert.notEqual(duplicate.arg,choice.arg);assert.equal(m.choices(duplicate.arg).length,2);m.addChoice(duplicate.arg);m.addChoice(duplicate.arg);assert.throws(()=>m.addChoice(duplicate.arg));assert.deepEqual((await m.validate()).errors,[]);
 m.choices(duplicate.arg)[0].goto='missing-scene';assert((await m.validate()).errors.some(e=>e.includes('없는 이동')));m.choices(duplicate.arg)[0].goto='';
 const parsed=compile('<color=#aabbcc>가</color><300><wave amp=2 hz=2>나</wave>');assert.equal(parsed.text,'가나');assert.equal(parsed.timings[1],350);assert.equal(parsed.errors.length,0);assert(compile('<shake>누락').errors.length);assert(compile('<wave nope=3>가</wave>').errors.length);assert(!html('<img src=x onerror=alert(1)>안녕',20,[]).includes('<img'));
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-dialogue-editor-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');
 await fs.cp(path.join(root,'bar-playtest/data/shared-csv'),base,{recursive:true});await fs.mkdir(runtime);for(const f of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(root,'bar-playtest/data/runtime',f),path.join(runtime,f));
 const options={base,runtime,backupRoot:path.join(tmp,'backups')},result=await save({revision:source.revision,files:m.output()},options);assert(result.saved);assert((await fs.readFile(path.join(base,'story/steps.csv'),'utf8')).includes('테스트 대사'));assert((await fs.readFile(path.join(runtime,'game-data.js'),'utf8')).includes('테스트 대사'));
 await assert.rejects(save({revision:source.revision,files:m.output()},options),/변경/);const now=await snapshot(base);await assert.rejects(save({revision:now.revision,files:{'../../oops':'x'}},options),/허용/);assert.equal((await snapshot(base)).revision,now.revision);
 const live=await runtimeSnapshot(base);assert.equal(live.revision,result.revision);assert.deepEqual(Object.keys(live.tables),['steps','bar_choices','bar_choice_groups']);assert(live.tables.steps.some(r=>r['text.ko']==='테스트 대사'));assert(live.story.bar['3'].some(r=>r.text==='테스트 대사'));assert(!live.story.scenes,'exterior/cutscenes are not hot-reloaded by the bar editor');
 // No test save is ever made to the live source repository.
 assert.equal((await snapshot()).revision,source.revision);
 console.log('DIALOGUE_EDITOR_OK: 7 scenes, CRUD/undo, independent choices, tags, real CSV+runtime save, conflict guard and original preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
