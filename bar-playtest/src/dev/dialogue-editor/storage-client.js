/* Browser transport shared by authoring workspaces. Never turns a failed local save into export. */
(function(W){
'use strict';
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const exact=async r=>{if(!r.ok)throw Error('원본 읽기 실패 ('+r.status+')');return new TextDecoder('utf-8',{ignoreBOM:true}).decode(await r.arrayBuffer());};
const hash=async(files,presentation)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(Object.keys(files).sort().map(k=>k+files[k]).join('')+JSON.stringify(presentation))))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function connect(){const r=await fetch('/api/dialogue-editor',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('저장 서버 연결 실패 ('+r.status+'). python3 serve.py로 실행해 주세요.');const d=await r.json();if(d.mode!=='local-csv'||!d.token||!d.files)throw Error('로컬 CSV 저장 서버가 아닙니다.');return d;}
async function load(){let error='';if(local)try{return{...await connect(),local:true};}catch(e){error=e.message;}const files={};await W.LunaCsv.load(async p=>files[p]=await exact(await fetch('data/shared-csv/'+p,{cache:'no-store'})));files['web-views.json']=await exact(await fetch('data/shared-csv/web-views.json',{cache:'no-store'}));const presentation=await(await fetch('data/presentation/runtime-assets.json')).json();return{files,presentation,revision:await hash(files,presentation),local:false,error};}
async function save(model,revision,mode){const connection=await connect();if(connection.revision!==revision)throw Error('원본 CSV가 변경되어 저장을 중단했습니다. ZIP으로 보관한 뒤 다시 불러오세요.');const r=await fetch('/api/dialogue-editor',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':connection.token},body:JSON.stringify({mode,revision,files:model.output()})});const d=await r.json();if(!r.ok)throw Error(d.error||'저장 실패');return d;}
W.LunaEditorStorage={local,load,save,connect};
})(window);
