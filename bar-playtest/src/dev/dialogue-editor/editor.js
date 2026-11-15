(async function(){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {Model,decode}=window.LunaDialogueEditorModel,L=window.LunaBarLineActions;
const types={say:'대사',enter:'입장',exit:'퇴장',choice:'선택지',coaster:'코스터 제공',order:'주문',craft:'제조 대기',serve:'음료 제공',empty_glass:'빈잔 전환',expression:'표정 유지',effect:'상태 변경',story_cue:'연출 신호',tutorial:'튜토리얼',end_part:'장면 종료'};
const draftKey='luna.bar.dialogue-editor.draft.v1';let model,local=null,sourceRevision='',selected='',scene='',playing=false,previewReady=false,expressions={},picks={},lastField='',reviewResult=null,reviewTicket=0,saving=false,initializing=false,previewFlags={},previewMoney=1000;
const drafts=window.LunaBarDrafts.open(draftKey);
const frame=$('preview'),status=text=>$('status').textContent=text,rows=()=>model.rows(scene),current=()=>model.row(selected);
let lastEditAt=0,lastInputType='';
const colorPicker=window.LunaDialogueColorPicker.create();let colorPreview=null;
const isLocal=['localhost','127.0.0.1','[::1]'].includes(location.hostname);let storageError='';
function storageUI(){
 $('storage-mode').textContent=local?'로컬 · 실제 CSV 저장':isLocal?'로컬 저장 연결 끊김':'웹 · CSV ZIP 내보내기';
 $('review').textContent=isLocal?'변경 내역 / 저장':'변경 내역 / 내보내기';
 $('reconnect-local').hidden=!isLocal;if(isLocal&&!local)$('reconnect-local').closest('details').open=true;$('storage-warning').hidden=!isLocal||!!local;
 $('storage-warning').textContent='로컬 CSV에 아직 저장할 수 없습니다. '+storageError+' 현재 서버를 종료하고 프로젝트의 python3 serve.py로 같은 포트에서 다시 실행한 뒤 ‘저장 연결 다시 확인’을 누르세요. 편집 내용은 유지됩니다. ZIP 내보내기는 다운로드만 하며 게임에 자동 적용되지 않습니다.';
}
async function readLocal(){
 const res=await fetch('/api/dialogue-editor',{cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error(res.status===404?'현재 서버에는 저장 기능이 없습니다 (404).':'저장 서버 응답 오류 ('+res.status+').');
 const data=await res.json();if(data.mode!=='local-csv'||!data.token||!data.revision||!data.files)throw Error('실제 CSV 저장 서버가 아닙니다.');return data;
}
const sourceHash=async(files,presentation,legacy=false)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(Object.keys(files).sort().map(k=>k+(legacy?files[k].replace(/^\uFEFF/,''):files[k])).join('')+JSON.stringify(presentation))))].map(n=>n.toString(16).padStart(2,'0')).join('');
// Response.text() removes UTF-8 BOMs; preserve them to match filesystem revisions.
const exactText=async res=>new TextDecoder('utf-8',{ignoreBOM:true}).decode(await res.arrayBuffer());
async function connectLocal(){
 try{const data=await readLocal();if(data.revision!==sourceRevision)throw Error('원본 CSV가 바뀌었습니다. 편집 내용을 ZIP으로 보관한 뒤 원본을 다시 불러오세요. 덮어쓰지 않았습니다.');local=data;storageError='';storageUI();status('로컬 저장 연결 완료. 편집 내용은 그대로 유지됩니다.');}
 catch(e){local=null;storageError=e.message;storageUI();throw e;}
}
$('reconnect-local').onclick=async()=>{try{await connectLocal();}catch(e){status(e.message);}};
const previewRow=r=>colorPreview?.rowId===r.row_id?{...r,[colorPreview.key]:colorPreview.text}:r;
const actorName=id=>model.projected.data.tables.characters.find(c=>c.id===id)?.['name.ko']||id;
let scope=null;
const routes=()=>window.LunaBarWiring.scan(model,scene);
const visibleRows=()=>routes().logical.filter(r=>!scope||scope.has(r.row_id));
function clearScope(){scope=null;$('flow-context').textContent='';}
const flow=window.LunaBarFlowView.create({
 model:()=>model,scene:()=>scene,selected:()=>selected,actorName,stop,loadScene,clearScope,payload:payloadFor,getPicks:()=>picks,settings:()=>({flags:previewFlags,money:previewMoney}),
 refresh:()=>{if(model){select(selected);resize();}},
 recordLayout(edit){model.recordLayout(edit);lastField='';historyButtons();},
 checkGuard:window.LunaBarFlow.checkGuard,
 inspect(node,rowId){stop();scope=new Set(node.rows.map(r=>r.row_id));lineUI.clear();lineUI.pane('detail');
  $('flow-context').textContent=node.type+' 묶음 · '+node.rows.length+'줄';resize();select(scope.has(rowId)?rowId:node.rows[0].row_id);},
 change:fn=>mutate(fn),quickSet(row,key,value,separate=false){const field='map/'+row.row_id+'/'+key,now=performance.now();if(separate||lastField!==field||now-lastEditAt>850){model.checkpoint();lastField=field;}lastEditAt=now;model.set(row,key,['when','effects'].includes(key)?window.LunaBarWiring.preserve(row[key],value,key==='when'?'&&':';'):value);mark();tagStatus(row);}
});
function resize(){const el=document.querySelector('.preview-shell'),scale=Math.min(el.clientWidth/1280,el.clientHeight/720);$('preview-fit').style.transform='scale('+scale+')';$('preview-fit').style.left=(el.clientWidth-1280*scale)/2+'px';$('preview-fit').style.top=(el.clientHeight-720*scale)/2+'px';}
new ResizeObserver(resize).observe(document.querySelector('.preview-shell'));
function stop(){playing=false;$('play').textContent='▶ 연속 재생';frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'stop'},location.origin);}
function payloadFor(r,scopeIds){
 const list=rows();return {day:Number(model.scenes.find(s=>s.id===scene).day),rows:list.map(x=>model.step(previewRow(x))),index:list.findIndex(x=>x.row_id===r.row_id),choices:model.choices(r.arg).map(x=>Object.fromEntries(Object.entries(previewRow(x)).map(([k,v])=>[k,decode(v)]))),picks,flags:previewFlags,money:previewMoney,scope:scopeIds};
}
function send(animate=false){if(!previewReady||!model||!current()||flow.opened)return;
 frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'show',payload:{...payloadFor(current(),scope?[...scope]:null),animate,playing}},location.origin);
}
function autosave(){if(initializing)return;try{if(model.dirty())drafts.write({revision:local?.revision||sourceRevision,files:model.output(),scene,selected});else drafts.clear();}catch{status('임시 보관 공간이 부족합니다. 저장하거나 내보내 주세요.');}}
function historyButtons(){$('undo').disabled=!model.undoStack.length;$('redo').disabled=!model.redoStack.length;}
function tagStatus(row){const alert=$('tag-alert'),r=row||(flow.opened?(model.row(flow.selectedNode)||current()):current());let issue='';if(r)for(const x of [r,...(r.type==='choice'?model.choices(r.arg):[])]){for(const f of ['text.ko','text.en','lock_reason.ko','lock_reason.en']){const err=window.LunaBarAudit.tagErrors(x[f],model.projected.data.tables.text_tags)[0];if(err){issue=(x===r?r.seq+'번 줄':'선택지 '+x.seq)+' · '+err;break;}}if(issue)break;}alert.textContent=issue;alert.hidden=!issue;}
function mark(){tagStatus();const dirty=model.dirty();$('dirty').textContent=dirty?'● 저장하지 않은 변경':'수정 없음';$('review').disabled=!dirty;historyButtons();autosave();}
const lineUI=window.LunaLineWorkspace.create({model:()=>model,current,selected:()=>selected,rows:visibleRows,scene:()=>scene,scope:()=>scope,types,typeOptions,rowTools,actorName,poses:()=>expressions,settings:()=>({flags:previewFlags,money:previewMoney}),pick:id=>{stop();select(id);}});
function drawList(){lineUI.draw();}
function inspector(){lineUI.inspector();}
function select(id,animate=false){selected=id;lastField='';$('line-title').textContent=model.scenes.find(s=>s.id===scene)?.title||scene;drawList();inspector();send(animate);$('line-list').querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});mark();}
function go(delta,automatic=false){const list=automatic?visibleRows():lineUI.found,index=list.findIndex(r=>r.row_id===selected)+delta;if(index<0||index>=list.length){stop();status(scope?'노드 재생이 끝났습니다.':'장면 재생이 끝났습니다.');return;}if(!automatic)stop();select(list[index].row_id,automatic);}
function loadScene(id){if(!model.scenes.some(s=>s.id===id))return;stop();clearScope();scene=id;const day=String(model.scenes.find(s=>s.id===id).day);$('day').value=day;fillScenes(day,id);picks={};lineUI.clear();lineUI.pane('both');select(rows()[0].row_id);if(flow.opened)flow.draw(selected);}
function dayList(){return [...new Set(model.scenes.map(s=>+s.day))].sort((a,b)=>a-b);}
function syncDays(){const old=$('day').value;$('day').innerHTML=dayList().map(d=>'<option value="'+d+'">'+d+'일차</option>').join('');if(dayList().includes(+old))$('day').value=old;}
function fillScenes(day,id){
 const available=model.scenes.filter(s=>+s.day===+day),previous=model.scenes.find(s=>s.id===scene)?.phase;
 const chosen=available.find(s=>s.id===id)||available.find(s=>s.phase===previous)||available[0];
 for(const b of $('scene').querySelectorAll('[data-phase]')){const sc=available.find(s=>s.phase===b.dataset.phase);b.dataset.scene=sc?.id||'';b.disabled=!sc;b.setAttribute('aria-pressed',String(!!sc&&sc===chosen));b.title=sc?sc.title:day+'일차에는 이 대본이 없습니다.';}
 return chosen?.id;
}
function dayOptions(day){const id=fillScenes(day);if(id)loadScene(id);}
async function initialize(skipDraft=false){
 initializing=true;
 let slots=[];try{slots=skipDraft?[]:drafts.candidates();}catch{}
 status('CSV와 장면 연결을 불러오는 중...');let files={},presentation;
 local=null;
 if(isLocal)try{local=await readLocal();files=local.files;presentation=local.presentation;storageError='';}catch(e){storageError=e.message;}
 if(!local){await window.LunaCsv.load(async p=>{const res=await fetch('data/shared-csv/'+p,{cache:'no-store'});if(!res.ok)throw Error('CSV 읽기 실패: '+p);return files[p]=await exactText(res);});files['web-views.json']=await exactText(await fetch('data/shared-csv/web-views.json',{cache:'no-store'}));presentation=await(await fetch('data/presentation/runtime-assets.json',{cache:'no-store'})).json();}
 sourceRevision=await sourceHash(files,presentation);
 model=await new Model(files,presentation).init();window.dialogueEditor={get model(){return model;},get local(){return !!local;},get selected(){return selected;}};
 storageUI();
 syncDays();$('add-type').innerHTML=Object.entries(types).filter(([id])=>!['expression','story_cue'].includes(id)&&model.tables.steps.some(r=>r.type===id&&r.template_id==='steps_format_68')).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 dayOptions(0);status(isLocal&&!local?'저장 연결이 끊겼습니다. 상단 안내를 확인하세요.':'');
 try{const legacy=slots.length?await sourceHash(files,presentation,true):'',slot=slots.find(x=>[sourceRevision,legacy].includes(x.v.revision))||slots[0],draft=slot?.v;if(draft&&Object.keys(draft.files).length){
  const same=draft.revision===(local?.revision||sourceRevision)||draft.revision===await sourceHash(files,presentation,true);
  if(same&&confirm('저장하지 않은 편집 내용이 있습니다. 복원할까요?')){drafts.restored(slot.k);model.checkpoint();for(const [table,path]of Object.entries(window.LunaDialogueEditorModel.paths))if(draft.files[path])model.tables[table]=window.LunaCsv.parseRows(draft.files[path],path);if(draft.files['web-views.json'])model.views=JSON.parse(draft.files['web-views.json']);const s=model.scenes.find(s=>s.id===draft.scene);if(s){syncDays();$('day').value=s.day;dayOptions(s.day);loadScene(s.id);if(model.row(draft.selected))select(draft.selected);}mark();status('임시 편집을 복원했습니다. 아직 CSV에는 저장되지 않았습니다.');}
  else if(!same)status('원본이 변경되어 이전 임시 편집을 자동 복원하지 않았습니다. 저장 충돌 방지를 위해 원본을 사용합니다.');
 }}catch(e){status(e.message);}finally{initializing=false;}
 $('new-day').disabled=false;flow.ready();bench.ready();
}
function mutate(fn){
 stop();const redo=model.redoStack,before=selected;model.checkpoint();
 try{const result=fn();const routeErrors=routes().errors;if(routeErrors.length)throw Error(routeErrors[0]);if(scope&&result?.row_id)scope.add(result.row_id);if(scope&&!scope.has(selected))clearScope();select(result?.row_id||selected);if(flow.opened)flow.draw(selected);return true;}
 catch(e){model.restore(model.undoStack.pop());model.redoStack=redo;selected=before;if(flow.opened)flow.draw(selected);mark();status(e.message);return false;}
}
$('day').onchange=()=>flow.switchScene(fillScenes($('day').value));$('scene').onclick=e=>{const b=e.target.closest('button[data-scene]');if(b&&!b.disabled)flow.switchScene(b.dataset.scene);};
$('scene').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...$('scene').querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;e.preventDefault();const i=buttons.indexOf(e.target),len=buttons.length;const next=e.key==='Home'?0:e.key==='End'?len-1:(i+(e.key==='ArrowRight'?1:-1)+len)%len;buttons[next].focus();buttons[next].click();};
$('new-day').onclick=()=>{let n=4;while(dayList().includes(n))n++;$('new-day-number').value=n;$('new-day-title').value=n+'일차';$('day-error').textContent='';$('day-dialog').showModal();};
$('day-cancel').onclick=()=>$('day-dialog').close();
$('day-form').onsubmit=e=>{e.preventDefault();const d=+$('new-day-number').value,redo=model.redoStack;model.checkpoint();try{const id=model.newDay(d,$('new-day-title').value);syncDays();$('day-dialog').close();flow.switchScene(id);mark();status(d+'일차 대본을 만들었습니다. 변경 내역에서 저장하세요.');}catch(err){model.restore(model.undoStack.pop());model.redoStack=redo;$('day-error').textContent=err.message;}};
$('previous').onclick=()=>go(-1);$('next').onclick=()=>go(1);$('line-play').onclick=()=>{stop();send(true);};$('play').onclick=()=>{if(playing)stop();else{playing=true;$('play').textContent='■ 정지';send(true);}};
function typeOptions(r){
 const c=L.context(model,scene,r);
 return Object.entries(types).filter(([k])=>!['story_cue','expression'].includes(k)||k===r.type).map(([id,name])=>({id,name,reason:L.typeProblem(model,scene,r,id,c)}));
}
function rowTools(r,visible,filtered){
 const c=L.context(model,scene,r),ids=visible.map(x=>x.row_id),after=L.placement(model,scene,c,c.at+1);
 return {before:L.placement(model,scene,c,c.at),after,duplicate:c.locked||after,delete:c.locked||(c.list.length<=1?'마지막 한 줄은 남겨 주세요.':''),
  up:L.moveProblem(model,scene,r,-1,ids,filtered),down:L.moveProblem(model,scene,r,1,ids,filtered)};
}
function changeType(r,k){
 if(k===r.type)return false;
 const problem=L.typeProblem(model,scene,r,k);if(problem){status(problem);return false;}
 const loss=r.type==='choice'?'이 줄과 선택지의 연결이 해제됩니다.':(decode(r['text.ko'])||decode(r['text.en']))&&!['say','order'].includes(k)?'기존 대사 문구가 제거됩니다.':'종류별 설정이 바뀝니다.';
 if(!confirm(r.seq+'번 줄을 ‘'+(types[k]||k)+'’로 바꿀까요? '+loss+' 되돌리기로 복구할 수 있습니다.'))return false;
 return mutate(()=>L.changeType(model,scene,r,k));
}
function lineAction(key,id=selected,type='say'){
 const r=model.row(id);if(!r||r.context!==scene)return;
 if(key==='focus'){$('inspector').querySelector('textarea[data-field="text.ko"],select[data-field="actor"],[data-field]:not([type="hidden"]),.rule-composer button')?.focus();return;}
 if(key==='play'){$('line-play').click();return;}if(key==='chart'){flow.locateRow(id);return;}
 const why=rowTools(r,visibleRows(),lineUI.filtered)[key];if(why){status(why);return;}
 if(key==='delete'&&!confirm(r.seq+'번 '+(types[r.type]||r.type)+' 줄을 삭제할까요? '+(r.type==='choice'?'이 줄만 사용하는 선택지도 함께 삭제됩니다. ':'')+'되돌리기로 복구할 수 있습니다.'))return;
 const ok=mutate(()=>{
  if(key==='before'||key==='after'||key==='duplicate')return L.insert(model,scene,r,key==='before'?'before':'after',key==='duplicate'?r.type:type,key==='duplicate');
  if(key==='delete'){const visible=visibleRows(),vis=lineUI.found.length>1&&lineUI.found.includes(r)?lineUI.found:visible,i=vis.indexOf(r);L.remove(model,scene,r);if(scope)scope.delete(id);const next=vis[i+1]||vis[i-1];if(!next)clearScope();const target=next||routes().logical[0];selected=target.row_id;return target;}
  const ids=rows().map(x=>x.row_id),i=ids.indexOf(id),j=i+(key==='up'?-1:1);[ids[i],ids[j]]=[ids[j],ids[i]];model.reorder(scene,ids);return r;
 });
 if(ok&&['before','after','duplicate','delete'].includes(key)){if(!lineUI.found.some(x=>x.row_id===selected))lineUI.clear();$('line-list').querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});}
}
for(const [button,key] of [['add','after'],['duplicate','duplicate'],['delete','delete'],['up','up'],['down','down']])$(button).onclick=()=>lineAction(key,selected,$('add-type').value);
window.LunaFlowWorkspaceMenu.attach($('line-list'),$('line-menu'),(el,keyboard)=>{
 const id=el.closest('[data-line]')?.dataset.line||(keyboard&&lineUI.found.some(r=>r.row_id===selected)?selected:null);if(!id)return;
 const r=model.row(id);stop();if(selected!==id)select(id);
 const guards=rowTools(r,visibleRows(),lineUI.filtered),entry=(key,title)=>[key,title,guards[key]?null:()=>lineAction(key,id),guards[key]];
 const typesForRow=typeOptions(r).map(t=>['type-'+t.id,t.name,t.reason||t.id===r.type?null:()=>changeType(r,t.id),t.reason,t.id===r.type]);
 return {focus:()=>$('line-list').querySelector('[data-line="'+CSS.escape(id)+'"]')||$('line-list'),entries:[
  entry('after','다음에 대사 줄 추가'),entry('before','앞에 대사 줄 추가'),entry('duplicate','이 줄 복제'),['type','진행 종류 변경',typesForRow],null,
  entry('up','한 줄 위로'),entry('down','한 줄 아래로'),null,entry('play','이 줄 재생'),entry('chart','플로우 차트에서 보기'),null,entry('delete','이 줄 삭제')]};
});
function history(direction){
 if(!model||saving||flow.cancelNodeDrag()||!model[direction+'Stack'].length)return;
 const active=document.activeElement,key=active?.dataset.field,quick=active?.dataset.quickKey,quickId=active?.closest('[data-quick-row]')?.dataset.quickRow,graphId=flow.selectedNode,cid=active?.closest('[data-choice-row]')?.dataset.choiceRow,
  start=active?.selectionStart,end=active?.selectionEnd,scroll=active?.scrollTop;
 const layout=model[direction]();
 if(layout){flow.applyLayout(layout,direction==='undo'?'before':'after');lastField='';historyButtons();
  const title=model.scenes.find(s=>s.id===layout.scene)?.title||layout.scene;status(title+' · '+(layout.kind==='draft-delete'?'미연결 핀 삭제':(layout.direction==='right'?'가로':'세로')+' 노드 배치')+' '+(direction==='undo'?'되돌림':'다시 실행'));return;}
 stop();syncDays();if(!model.scenes.some(s=>s.id===scene)){dayOptions(dayList().at(-1));}if(!current())selected=visibleRows()[0]?.row_id||rows()[0].row_id;if(scope&&!scope.has(selected))clearScope();select(selected);if(flow.opened)flow.draw(model.row(graphId)?.context===scene?graphId:selected);
 if(quick&&quickId&&flow.opened){const el=$('node-detail').querySelector('[data-quick-row="'+CSS.escape(quickId)+'"] [data-quick-key="'+CSS.escape(quick)+'"]');if(el){const more=el.closest('details');if(more)more.open=true;el.focus({preventScroll:true});if(typeof start==='number')el.setSelectionRange(Math.min(start,el.value.length),Math.min(end,el.value.length));el.scrollTop=scroll;}}
 // Rebuilding the inspector must not take the caret away from the edited field.
 if(key){
  const target=[...$('inspector').querySelectorAll('[data-field]')].find(el=>el.dataset.field===key&&el.closest('[data-choice-row]')?.dataset.choiceRow===cid);
  if(target){target.focus({preventScroll:true});if(typeof start==='number')target.setSelectionRange(Math.min(start,target.value.length),Math.min(end,target.value.length));target.scrollTop=scroll;}
 }
}
$('undo').onclick=()=>history('undo');$('redo').onclick=()=>history('redo');
$('reload').onclick=async()=>{if(model?.dirty()&&!confirm('저장하지 않은 편집을 버리고 원본을 다시 불러올까요?'))return;drafts.clear(true);stop();await initialize(true);};
$('inspector').addEventListener('input',e=>{const key=e.target.dataset.field;if(!key)return;stop();const cid=e.target.closest('[data-choice-row]')?.dataset.choiceRow,row=cid?model.tables.bar_choices.find(r=>r.row_id===cid):current(),keyId=row.row_id+'/'+key;
 if(key==='goto'&&cid){const v=e.target.value,old=routes().routes.some(w=>w.source===selected&&w.choice===cid)?'@local':decode(row.goto);if(v===old||v==='@local')return;const ok=mutate(()=>window.LunaBarWiring.sceneWire(model,scene,{rows:[current()]},cid,v));if(!ok)e.target.value=old;return;}
 if(key==='type'){if(!changeType(row,e.target.value))e.target.value=row.type;return;}
 const now=performance.now(),inputType=e.inputType||'replace';
 if(lastField!==keyId||(!e.isComposing&&(now-lastEditAt>800||inputType!==lastInputType||inputType==='insertFromPaste'||inputType==='insertReplacementText'||inputType==='replace'))){model.checkpoint();lastField=keyId;}
 lastEditAt=now;lastInputType=inputType;model.set(row,key,['when','effects'].includes(key)?window.LunaBarWiring.preserve(row[key],e.target.value,key==='when'?'&&':';'):e.target.value);if(key==='actor'&&row.type==='say'&&expressions[row.actor]&&!expressions[row.actor].includes(row.arg))model.set(row,'arg','default');drawList();send();mark();
 if(e.target.tagName==='SELECT'&&['type','actor','arg'].includes(key)){inspector();lastField='';}
});
$('inspector').addEventListener('focusout',()=>{lastField='';});
$('node-detail').addEventListener('beforeinput',e=>{if(e.target.dataset.quickKey&&['historyUndo','historyRedo'].includes(e.inputType)){e.preventDefault();history(e.inputType==='historyUndo'?'undo':'redo');}});
$('inspector').addEventListener('beforeinput',e=>{if(e.target.dataset.field&&['historyUndo','historyRedo'].includes(e.inputType)){e.preventDefault();history(e.inputType==='historyUndo'?'undo':'redo');}});
$('inspector').addEventListener('click',e=>{
 const b=e.target.closest('[data-color-field]');if(!b)return;stop();
 const container=b.closest('[data-choice-row]')||$('inspector'),t=container.querySelector('textarea[data-field="text.ko"]'),
  row=container.dataset.choiceRow?model.tables.bar_choices.find(r=>r.row_id===container.dataset.choiceRow):current(),
  key=b.dataset.colorField,start=t.selectionStart,end=t.selectionEnd,text=t.value;
 colorPicker.open({text,start,end,
  validate:value=>window.LunaTextEffects.compile(value,model.projected.data.tables.text_tags).errors[0],
  onPreview:value=>{colorPreview={rowId:row.row_id,key,text:value};send();},
  onCancel:()=>{colorPreview=null;send();t.focus({preventScroll:true});t.setSelectionRange(start,end);},
  onApply:value=>{colorPreview=null;lastField='';if(value!==text){model.checkpoint();model.set(row,key,value);}t.value=value;t.focus({preventScroll:true});drawList();send();mark();}
 });
});
$('inspector').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='apply-preview'){try{previewFlags=Object.fromEntries($('flags').value.split(';').map(t=>t.trim().match(/^flag\.(\w+) = (true|false)$/)).filter(Boolean).map(m=>[m[1],m[2]==='true']));previewMoney=Number($('preview-money').value);send();}catch(e){status(e.message);}return;}if(b.id==='add-choice'){mutate(()=>{model.addChoice(current().arg);});return;}if(b.dataset.removeChoice){const key=b.dataset.removeChoice,linked=routes().routes.filter(r=>r.choice===key);if(linked.length&&!confirm('이 선택지와 연결된 분기선도 함께 해제할까요?'))return;mutate(()=>{for(const r of linked)window.LunaBarWiring.disconnect(model,scene,r);model.removeChoice(current().arg,key);return current();});return;}
 if(b.dataset.tag||b.hasAttribute('data-delay')){const t=$('inspector').querySelector('textarea[data-field="text.ko"]');if(!t)return;const start=t.selectionStart,end=t.selectionEnd,tag=b.dataset.tag,wrap=tag?'<'+tag+'>'+t.value.slice(start,end)+'</'+tag.split('=')[0]+'>':'<300>';model.checkpoint();model.set(current(),'text.ko',t.value.slice(0,start)+wrap+t.value.slice(end));t.value=current()['text.ko'];t.focus();t.setSelectionRange(start+wrap.length,start+wrap.length);drawList();send();mark();}
};
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='luna-dialogue-preview')return;const m=e.data;
 if(m.type==='ready'){previewReady=true;expressions=m.expressions;if(model){inspector();send();}}
 if(m.type==='error'){stop();status('미리보기 오류: '+m.message);}
 if(m.type==='state'){const note=$('preview-note');note.textContent=m.warnings.join(' / ');note.hidden=!note.textContent||$('line-preview').hidden;}
 if(m.type==='complete'&&playing&&m.index===rows().findIndex(r=>r.row_id===selected))go(1,true);
 if(m.type==='advance')go(1,playing);
 if(m.type==='choice'){const c=model.choices(current().arg).find(c=>String(c.seq)===String(m.seq));if(!c)return;picks[selected]=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,decode(v)]));if(scope){stop();status('선택 완료 · 노드 재생이 끝났습니다.');return;}if(decode(c.goto)){const next=model.scenes.find(s=>s.id===c.goto);if(!next){status('이 편집기에 없는 이동 장면입니다.');stop();return;}const was=playing;loadScene(next.id);playing=was;send(was);}else go(1,true);}
});
const bench=window.LunaBarWorkbench.create({model:()=>model,current:()=>flow.opened?(model.row(flow.selectedNode)||current()):current(),mutate,stop,jump(loc){
 const sc=model.scenes.find(x=>x.id===loc.scene);if(!sc)return;flow.switchScene(sc.id);
 const scan=routes(),helper=scan.routes.find(rt=>rt.steps.some(r=>r.row_id===loc.row)),target=helper?.source||loc.row;
 if(loc.pin||helper||loc.routeId){flow.locateRow(target,{...loc,routeId:loc.routeId||helper?.id});return;}
 $('line-mode').click();clearScope();lineUI.clear();lineUI.pane('both');select(target);const scopeSelector=loc.choice?'[data-choice-row="'+CSS.escape(loc.choice)+'"] ':'';
 const field=loc.field&&$('inspector').querySelector(scopeSelector+'[data-field="'+CSS.escape(loc.field)+'"]');if(field){let node=field.parentElement;while(node&&node!==$('inspector')){if(node.tagName==='DETAILS')node.open=true;node=node.parentElement;}const target=field.type==='hidden'?field.nextElementSibling?.querySelector('button,select,input'):field;target?.focus();}
}});
$('review-audit').onclick=()=>{if(!saving){$('review-dialog').close();bench.audit();}};
$('review').onclick=async()=>{if(saving||$('review-dialog').open)return;const ticket=++reviewTicket;stop();$('review-dialog').showModal();$('commit').disabled=true;$('validation').textContent='검사 중...';$('changes').innerHTML='<table><thead><tr><th>항목 / 변경</th><th>이전</th><th>이후</th></tr></thead><tbody>'+model.changes().map(c=>`<tr><td>${esc(c.kind+' · '+(c.key||c.table))}<br><small>${esc(c.id)}</small></td><td><del>${esc(c.before||'')}</del></td><td><ins>${esc(c.after||'')}</ins></td></tr>`).join('')+'</tbody></table>';
 $('save-explanation').textContent=isLocal?'로컬 CSV 저장을 누르면 저장 연결을 다시 확인한 후 CSV와 웹 실행 데이터를 함께 변경합니다. 변경 전 파일은 백업합니다. ZIP 파일만 내보내기는 다운로드만 하며 게임에 자동 적용되지 않습니다.':'CSV, 연결 정보, 웹 실행 데이터가 담긴 ZIP을 내려받습니다. GitHub 원본은 바뀌지 않으며, 저장소에 파일을 적용하고 커밋/푸시해야 반영됩니다.';
 $('export-backup').hidden=!isLocal;$('export-backup').disabled=true;$('commit').textContent=isLocal?'로컬 CSV 저장':'CSV ZIP 내보내기';const checked=await model.validate().catch(e=>({errors:[e.message]}));if(ticket!==reviewTicket||!$('review-dialog').open)return;reviewResult=checked;const warnings=bench.issuesOf(reviewResult).filter(i=>i.severity==='warning');$('validation').textContent=[...reviewResult.errors,...warnings.map(i=>'주의 · '+i.label+' · '+i.message)].join('\n')||'검사 완료 · 대사 태그, 선택지, 좌석과 주문 연결에 오류가 없습니다.';$('commit').disabled=!!reviewResult.errors.length;$('export-backup').disabled=!!reviewResult.errors.length;
};
$('close-review').onclick=()=>{if(!saving)$('review-dialog').close();};
$('review-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
async function commit(exportOnly=false){if(saving)return;let invalid=false;saving=true;$('review-audit').disabled=true;$('close-review').disabled=true;$('commit').disabled=true;$('export-backup').disabled=true;try{
 if(isLocal&&!exportOnly)await connectLocal();
 const checked=await model.validate();if(checked.errors.length){invalid=true;throw Error(checked.errors.join('\n'));}
 if(isLocal&&!exportOnly){const sent=model.output(),submitted=model.snapshot();const res=await fetch('/api/dialogue-editor',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':local.token},body:JSON.stringify({revision:local.revision,files:sent})}),data=await res.json();if(!res.ok)throw Error(data.error||'저장 실패');local.revision=data.revision;sourceRevision=data.revision;model.files={...model.files,...sent};model.base=submitted;model.undoStack=[];model.redoStack=[];mark();window.LunaDialogueLiveData.notify(data.revision);status((data.saved?'실제 CSV 저장 완료':'이미 같은 내용으로 저장되어 있습니다')+' · 같은 주소의 본편/일차 테스트에 자동 반영 · 진행 중인 장면은 유지하고 다음 장면 또는 테스트 재시작부터 적용'+(data.saved?' · 복구 파일: '+data.backup:''));}
 else{const files=await window.LunaDialogueExport.packageFiles(model,checked.result),blob=window.LunaDialogueExport.zip(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='luna-bar-dialogue-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('ZIP 내보내기 완료. GitHub 원본에는 아직 반영되지 않았습니다.');}
 $('review-dialog').close();drawList();
 }catch(e){$('validation').textContent=e.message;}finally{saving=false;$('review-audit').disabled=false;$('close-review').disabled=false;$('commit').disabled=invalid;$('export-backup').disabled=invalid;}}
$('commit').onclick=()=>commit();$('export-backup').onclick=()=>commit(true);
window.addEventListener('beforeunload',e=>{if(model?.dirty()||window.LunaPinInspector.pending()){e.preventDefault();e.returnValue='';}});
const hello=()=>frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'hello'},location.origin);frame.addEventListener('load',hello);hello();
window.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||e.isComposing)return;
 const key=/^Key[SYZ]$/.test(e.code)?e.code.slice(3).toLowerCase():e.key.toLowerCase();
 if(document.querySelector('#flag-picker[open]')){if(key==='s')e.preventDefault();return;}
 if(saving||flow.modal||document.querySelector('#workbench[open]'))return;
 if($('color-dialog').open){if(key==='s')e.preventDefault();return;}
 if(window.LunaPinInspector.pending()&&['s','y','z'].includes(key)){e.preventDefault();window.LunaPinInspector.pending().querySelector('.pin-status').textContent='핀의 변경을 먼저 적용하거나 취소하세요.';return;}
 if(key==='s'){e.preventDefault();if(model?.dirty())$('review').click();return;}
 if(key!=='z'&&key!=='y')return;
 // Search and preview-only inputs retain their native text undo history.
 if($('review-dialog').open||((e.target.matches('input,textarea')||e.target.isContentEditable)&&!e.target.dataset.field&&!e.target.dataset.quickKey))return;
 e.preventDefault();history(key==='y'||e.shiftKey?'redo':'undo');
});
try{await initialize();}catch(e){status('불러오기 실패: '+e.message);$('inspector').textContent='불러오기에 실패했습니다. 로컬 서버 또는 배포 파일을 확인해 주세요.';}
})();
