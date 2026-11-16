/* Browser transport shared by authoring workspaces. Never turns a failed local save into export. */
(function(W){
'use strict';
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
// Response.text() removes UTF-8 BOMs; preserve them to match filesystem revisions.
async function readStatic(path){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const res=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!res.ok){
    if(attempt===0&&res.status>=500)continue;
    throw Error(path+' 읽기 실패 ('+res.status+')');
   }
   return new TextDecoder('utf-8',{ignoreBOM:true}).decode(await res.arrayBuffer());
  }catch(e){
   if(attempt===0&&(e instanceof TypeError||e.name==='TimeoutError'))continue;
   throw e;
  }
 }
}
const hash=async(files,presentation,stripBom=false)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(Object.keys(files).sort().map(k=>k+(stripBom?files[k].replace(/^\uFEFF/,''):files[k])).join('')+JSON.stringify(presentation))))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function connect(){const r=await fetch('/api/dialogue-editor',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('저장 서버 연결 실패 ('+r.status+'). python3 serve.py로 실행해 주세요.');const d=await r.json();if(d.mode!=='local-csv'||!d.token||!d.revision||!d.files||!d.presentation)throw Error('로컬 CSV 저장 서버가 아닙니다.');return d;}
async function load(){
 let error='';
 if(local)try{return{...await connect(),local:true};}catch(e){error=e.message;}
 const files={};
 const readCsv=async path=>files[path]=await readStatic('data/shared-csv/'+path);
 const [,views,placements,art]=await Promise.all([
  W.LunaCsv.load(readCsv),readStatic('data/shared-csv/web-views.json'),
  readStatic('data/presentation/npc-placements.json'),readStatic('data/presentation/runtime-assets.json')
 ]);
 files['web-views.json']=views;
 files['npc-placements.json']=placements;
 const presentation=JSON.parse(art.trimStart());
 return{files,presentation,revision:await hash(files,presentation),local:false,error};
}
async function save(model,revision,mode){const connection=await connect();if(connection.revision!==revision)throw Error('원본 CSV가 변경되어 저장을 중단했습니다. ZIP으로 보관한 뒤 다시 불러오세요.');const r=await fetch('/api/dialogue-editor',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':connection.token},body:JSON.stringify({mode,revision,files:model.output()})});const d=await r.json();if(!r.ok)throw Error(d.error||'저장 실패');return d;}
W.LunaEditorStorage={local,load,save,connect,hash};
})(window);
