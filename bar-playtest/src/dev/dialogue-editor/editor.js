(async function(){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {Model,decode}=window.LunaDialogueEditorModel;
const types={say:'대사',enter:'입장',exit:'퇴장',choice:'선택지',coaster:'코스터 제공',order:'주문',craft:'제조 대기',serve:'음료 제공',empty_glass:'빈잔 전환',expression:'표정 유지',effect:'상태 변경',story_cue:'연출 신호',tutorial:'튜토리얼',end_part:'장면 종료'};
const draftKey='luna.bar.dialogue-editor.draft.v1';let model,local=null,sourceRevision='',selected='',scene='',playing=false,previewReady=false,expressions={},picks={},lastField='',reviewResult=null,saving=false,initializing=false,previewFlags={},previewMoney=1000;
const frame=$('preview'),status=text=>$('status').textContent=text,rows=()=>model.rows(scene),current=()=>model.row(selected);
const actorName=id=>model.projected.data.tables.characters.find(c=>c.id===id)?.['name.ko']||id;
function resize(){const el=document.querySelector('.preview-shell'),scale=Math.min(el.clientWidth/1280,el.clientHeight/720);$('preview-fit').style.transform='scale('+scale+')';$('preview-fit').style.left=(el.clientWidth-1280*scale)/2+'px';}
new ResizeObserver(resize).observe(document.querySelector('.preview-shell'));
function stop(){playing=false;$('play').textContent='▶ 연속 재생';frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'stop'},location.origin);}
function send(animate=false){if(!previewReady||!model||!current())return;
 const flags=previewFlags;
 const r=current(),index=rows().findIndex(x=>x.row_id===selected);
 frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'show',payload:{day:Number(model.scenes.find(s=>s.id===scene).day),rows:rows().map(x=>model.step(x)),index,choices:model.choices(r.arg).map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]))),picks,flags,money:previewMoney,animate,playing}},location.origin);
}
function autosave(){if(initializing)return;try{if(model.dirty())localStorage.setItem(draftKey,JSON.stringify({revision:local?.revision||sourceRevision,files:model.output(),scene,selected}));else localStorage.removeItem(draftKey);}catch{status('임시 보관 공간이 부족합니다. 저장하거나 내보내 주세요.');}}
function mark(){const dirty=model.dirty();$('dirty').textContent=dirty?'● 저장하지 않은 변경':'수정 없음';$('review').disabled=!dirty;$('undo').disabled=!model.undoStack.length;$('redo').disabled=!model.redoStack.length;autosave();}
function drawList(){
 const query=$('search').value.toLowerCase(),changed=new Set(model.changes().map(c=>c.id));
 $('line-list').innerHTML=rows().map((r,i)=>({r,i})).filter(({r})=>[r['text.ko'],r.actor,actorName(r.actor),r.row_id,types[r.type]].join(' ').toLowerCase().includes(query)).map(({r,i})=>`<button class="line ${changed.has(r.row_id)?'changed':''}" data-line="${esc(r.row_id)}" aria-current="${r.row_id===selected}"><small>${i+1}</small><small>${esc(types[r.type]||r.type)}</small><span>${esc(actorName(r.actor))}</span><span>${esc(decode(r['text.ko'])||decode(r.arg)||'—')}</span></button>`).join('');
 $('cursor').textContent=`${rows().findIndex(r=>r.row_id===selected)+1} / ${rows().length}`;
}
const field=(label,key,value,multi=false)=>`<label>${label}${multi?`<textarea data-field="${key}">${esc(decode(value))}</textarea>`:`<input data-field="${key}" value="${esc(decode(value))}">`}</label>`;
function inspector(){const r=current();if(!r)return;
 const actors=[...new Set(['luna',...Object.keys(model.presentation.characterLayers),...Object.keys(expressions),r.actor])],poses=[...(expressions[r.actor]||['default'])];if(['say','expression'].includes(r.type)&&!poses.includes(r.arg))poses.push(r.arg);
 $('inspector').innerHTML=`<h2>${esc(types[r.type]||r.type)} 편집</h2><p class="row-id">${esc(r.row_id)}</p><div class="field-pair"><label>진행 종류<select data-field="type">${Object.entries(types).map(([id,name])=>`<option value="${id}" ${r.type===id?'selected':''}>${name}</option>`).join('')}</select></label><label>화자 / 대상<select data-field="actor">${actors.map(id=>`<option value="${esc(id)}" ${r.actor===id?'selected':''}>${esc(actorName(id))}</option>`).join('')}</select></label></div>
 ${['say','expression'].includes(r.type)?`<label>표정<select data-field="arg">${poses.map(id=>`<option ${id===r.arg?'selected':''} value="${esc(id)}">${esc(id==='default'?'기본':id)}</option>`).join('')}</select></label>`:r.type==='enter'?`<div class="field-pair"><label>좌석<select data-field="arg"><option value="L" ${r.arg==='L'?'selected':''}>왼쪽</option><option value="R" ${r.arg==='R'?'selected':''}>오른쪽</option></select></label><label>등장<select data-field="entrance"><option value="" ${!r.entrance?'selected':''}>페이드 등장</option><option value="seated" ${r.entrance==='seated'?'selected':''}>이미 앉아 있음</option></select></label></div>`:field(r.type==='order'?'주문 (예: exact:gin_tonic)':r.type==='choice'?'선택지 그룹 ID':'인수 / 연출 ID','arg',r.arg)}
 ${['say','order'].includes(r.type)?field('한국어 대사','text.ko',r['text.ko'],true)+`<div class="tags">${[['shake','흔들림'],['wave','물결'],['pop','팝'],['name','이름 색'],['order','주문 색'],['big','크게'],['slow','천천히'],['color=#72DAE3','색상']].map(([tag,label])=>`<button data-tag="${tag}">${label}</button>`).join('')}<button data-delay>대기 0.3초</button></div><p class="hint">문장을 선택하고 효과를 누르세요. 예: &lt;shake amp=0.7 hz=18&gt;대사&lt;/shake&gt;, &lt;300&gt;은 300ms 대기. 엔진 전용 FX 프리셋·TMP sprite 태그는 이 편집기에서 아직 지원하지 않습니다.</p><details><summary>영문 대사</summary>${field('영문 (자동 번역하지 않음)','text.en',r['text.en'],true)}</details>`:''}
 ${r.type==='choice'?`<section id="choice-fields">${model.choices(r.arg).map((c,i)=>`<div class="choice-editor" data-choice-row="${esc(c.row_id)}"><div class="choice-head"><b>선택지 ${i+1}</b><button data-remove-choice="${esc(c.row_id)}">삭제</button></div>${field('선택지 문구','text.ko',c['text.ko'],true)}<label>이동할 장면<select data-field="goto"><option value="">현재 장면의 다음 줄</option>${model.scenes.filter(s=>s.day===$('day').value).map(s=>`<option value="${esc(s.id)}" ${c.goto===s.id?'selected':''}>${esc(s.title||s.id)} · ${esc(s.id)}</option>`).join('')}</select></label><details><summary>조건 · 효과 · 영문</summary>${field('조건','when',c.when)}${field('선택 효과','effects',c.effects)}${field('선택 불가 사유','lock_reason.ko',c['lock_reason.ko'])}${field('영문','text.en',c['text.en'])}</details></div>`).join('')}</section><button id="add-choice" ${model.choices(r.arg).length>=4?'disabled':''}>+ 선택지 추가 (최대 4개)</button><p class="hint">화면의 선택지를 누르면 해당 분기를 미리봅니다. 그룹 ID를 공유하는 줄은 같은 선택지를 사용합니다. 줄 복제 시 그룹은 독립 복제됩니다.</p>`:''}
 <details><summary>실행 조건 · 효과 · 동시 진행</summary>${field('이 줄의 실행 조건','when',r.when)}${field('완료 시 효과','effects',r.effects)}<label>동시 진행<select data-field="sync"><option value="wait" ${r.sync==='wait'?'selected':''}>이 줄 완료까지 대기</option><option value="no_wait" ${r.sync==='no_wait'?'selected':''}>다음 입장과 동시 진행</option></select></label></details><details><summary>미리보기 조건 (CSV에 저장하지 않음)</summary><label>소지금<input id="preview-money" type="number" min="0" value="1000"></label><label>플래그 JSON<textarea id="flags">{}</textarea></label><button id="apply-preview">조건 적용</button></details><p class="hint">${r.type==='expression'?'이 표정은 이후 대사·듣기에도 유지됩니다. 기본으로 되돌리려면 표정 유지 줄을 추가하세요.':r.type==='say'?'이 줄의 표정만 변경합니다. 이후에도 유지하려면 ‘표정 유지’ 줄을 추가하세요.':'제조·튜토리얼은 편집 재생에서 입력 과정을 생략하고 연출 신호와 결과 상태를 확인합니다.'}</p>`;
 if($('flags'))$('flags').value=JSON.stringify(previewFlags,null,2);if($('preview-money'))$('preview-money').value=previewMoney;
}
function select(id,animate=false){selected=id;lastField='';drawList();inspector();send(animate);$('line-list').querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});mark();}
function go(delta,automatic=false){const list=rows(),index=list.findIndex(r=>r.row_id===selected)+delta;if(index<0||index>=list.length){stop();status('장면 재생이 끝났습니다.');return;}if(!automatic)stop();select(list[index].row_id,automatic);}
function loadScene(id){stop();scene=id;picks={};$('scene').value=id;select(rows()[0].row_id);}
function dayOptions(day){$('scene').innerHTML=model.scenes.filter(s=>Number(s.day)===Number(day)).map(s=>`<option value="${s.id}">${s.phase==='bar_open'?'개점 전':'단골 영업'} · ${esc(s.title||s.id)}</option>`).join('');loadScene($('scene').value);}
async function initialize(){
 initializing=true;
 let savedDraft=null;try{savedDraft=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{}
 status('CSV와 장면 연결을 불러오는 중...');let files={},presentation;
 local=null;
 if(['localhost','127.0.0.1'].includes(location.hostname))try{const res=await fetch('/api/dialogue-editor',{cache:'no-store'});if(res.ok){const data=await res.json();if(data.mode==='local-csv'){local=data;files=data.files;presentation=data.presentation;}}}catch{}
 if(!local){await window.LunaCsv.load(async p=>{const res=await fetch('data/shared-csv/'+p,{cache:'no-store'});if(!res.ok)throw Error('CSV 읽기 실패: '+p);return files[p]=await res.text();});files['web-views.json']=await(await fetch('data/shared-csv/web-views.json',{cache:'no-store'})).text();presentation=await(await fetch('data/presentation/runtime-assets.json',{cache:'no-store'})).json();}
 sourceRevision=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(Object.keys(files).sort().map(k=>k+files[k]).join('')+JSON.stringify(presentation))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 model=await new Model(files,presentation).init();window.dialogueEditor={get model(){return model;},get local(){return !!local;},get selected(){return selected;}};
 $('storage-mode').textContent=local?'로컬 · 실제 CSV 저장':(['localhost','127.0.0.1'].includes(location.hostname)?'로컬 저장 미연결 · ZIP 내보내기':'웹 · CSV ZIP 내보내기');$('review').textContent=local?'변경 내역 / 저장':'변경 내역 / 내보내기';
 $('day').innerHTML=[0,1,2,3].map(d=>`<option value="${d}">${d}일차</option>`).join('');$('add-type').innerHTML=Object.entries(types).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 dayOptions(0);status(local?'로컬 CSV에 저장할 수 있습니다.':(['localhost','127.0.0.1'].includes(location.hostname)?'로컬 저장 서버에 연결되지 않았습니다. python3 serve.py로 실행/재시작하세요. 현재는 내보내기만 가능합니다.':'웹 원본은 변경하지 않습니다. ZIP을 내려받아 저장소에 적용하세요.'));
 try{const draft=savedDraft;if(draft&&Object.keys(draft.files).length){
  const same=draft.revision===(local?.revision||sourceRevision);
  if(same&&confirm('저장하지 않은 편집 내용이 있습니다. 복원할까요?')){model.checkpoint();for(const [table,path]of Object.entries(window.LunaDialogueEditorModel.paths))if(draft.files[path])model.tables[table]=window.LunaCsv.parseRows(draft.files[path],path);if(draft.files['web-views.json'])model.views=JSON.parse(draft.files['web-views.json']);const s=model.scenes.find(s=>s.id===draft.scene);if(s){$('day').value=s.day;dayOptions(s.day);loadScene(s.id);if(model.row(draft.selected))select(draft.selected);}mark();status('임시 편집을 복원했습니다. 아직 CSV에는 저장되지 않았습니다.');}
  else if(!same)status('원본이 변경되어 이전 임시 편집을 자동 복원하지 않았습니다. 저장 충돌 방지를 위해 원본을 사용합니다.');
 }}catch(e){status(e.message);}finally{initializing=false;}
}
function mutate(fn){stop();model.checkpoint();try{const result=fn();select(result?.row_id||selected);mark();}catch(e){model.undo();status(e.message);}}
$('day').onchange=()=>dayOptions($('day').value);$('scene').onchange=()=>loadScene($('scene').value);$('search').oninput=drawList;
$('line-list').onclick=e=>{const b=e.target.closest('[data-line]');if(b){stop();select(b.dataset.line);}};
$('previous').onclick=()=>go(-1);$('next').onclick=()=>go(1);$('line-play').onclick=()=>{stop();send(true);};$('play').onclick=()=>{if(playing)stop();else{playing=true;$('play').textContent='■ 정지';send(true);}};
$('add').onclick=()=>mutate(()=>model.add(scene,rows().findIndex(r=>r.row_id===selected)+1,$('add-type').value));
$('duplicate').onclick=()=>mutate(()=>model.add(scene,rows().findIndex(r=>r.row_id===selected)+1,current().type,current()));
$('delete').onclick=()=>{if(!confirm('현재 줄을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))return;mutate(()=>{const i=rows().findIndex(r=>r.row_id===selected);model.remove(scene,selected);selected=rows()[Math.min(i,rows().length-1)].row_id;});};
for(const [id,delta]of [['up',-1],['down',1]])$(id).onclick=()=>mutate(()=>{const ids=rows().map(r=>r.row_id),i=ids.indexOf(selected),j=i+delta;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];model.reorder(scene,ids);});
$('undo').onclick=()=>{stop();model.undo();if(!current())selected=rows()[0].row_id;select(selected);};$('redo').onclick=()=>{stop();model.redo();if(!current())selected=rows()[0].row_id;select(selected);};
$('reload').onclick=async()=>{if(model?.dirty()&&!confirm('저장하지 않은 편집을 버리고 원본을 다시 불러올까요?'))return;localStorage.removeItem(draftKey);stop();await initialize();};
$('inspector').addEventListener('input',e=>{const key=e.target.dataset.field;if(!key)return;stop();const cid=e.target.closest('[data-choice-row]')?.dataset.choiceRow,row=cid?model.tables.bar_choices.find(r=>r.row_id===cid):current(),keyId=row.row_id+'/'+key;
 if(lastField!==keyId){model.checkpoint();lastField=keyId;}model.set(row,key,e.target.value);drawList();send();mark();
 if(e.target.tagName==='SELECT'&&['type','actor','arg'].includes(key)){inspector();lastField='';}
});
$('inspector').addEventListener('focusout',()=>{lastField='';});
$('inspector').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='apply-preview'){try{const flags=JSON.parse($('flags').value);if(!flags||Array.isArray(flags)||typeof flags!=='object')throw Error('플래그는 JSON 객체로 입력하세요.');previewFlags=flags;previewMoney=Number($('preview-money').value);send();}catch(e){status(e.message);}return;}if(b.id==='add-choice'){mutate(()=>{model.addChoice(current().arg);});return;}if(b.dataset.removeChoice){mutate(()=>model.removeChoice(current().arg,b.dataset.removeChoice));return;}
 if(b.dataset.tag||b.hasAttribute('data-delay')){const t=$('inspector').querySelector('textarea[data-field="text.ko"]');if(!t)return;const start=t.selectionStart,end=t.selectionEnd,tag=b.dataset.tag,wrap=tag?'<'+tag+'>'+t.value.slice(start,end)+'</'+tag.split('=')[0]+'>':'<300>';model.checkpoint();model.set(current(),'text.ko',t.value.slice(0,start)+wrap+t.value.slice(end));t.value=current()['text.ko'];t.focus();t.setSelectionRange(start+wrap.length,start+wrap.length);drawList();send();mark();}
};
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.channel!=='luna-dialogue-preview')return;const m=e.data;
 if(m.type==='ready'){previewReady=true;expressions=m.expressions;if(model){inspector();send();}}
 if(m.type==='error'){stop();status('미리보기 오류: '+m.message);}
 if(m.type==='state')$('preview-note').textContent=m.warnings.length?m.warnings.join(' / '):'편집용 미리보기 · '+m.cast.map(actorName).join(' / ')+' · 코스터·제조는 입력 과정 대신 결과를 표시합니다.';
 if(m.type==='complete'&&playing&&m.index===rows().findIndex(r=>r.row_id===selected))go(1,true);
 if(m.type==='advance')go(1,playing);
 if(m.type==='choice'){const c=model.choices(current().arg).find(c=>String(c.seq)===String(m.seq));if(!c)return;picks[selected]=Object.fromEntries(Object.entries(c).map(([k,v])=>[k,decode(v)]));if(decode(c.goto)){const next=model.scenes.find(s=>s.id===c.goto);if(!next){status('이 편집기에 없는 이동 장면입니다.');stop();return;}const was=playing;loadScene(next.id);playing=was;send(was);}else go(1,playing);}
});
$('review').onclick=async()=>{stop();$('review-dialog').showModal();$('commit').disabled=true;$('validation').textContent='검사 중...';$('changes').innerHTML='<table><thead><tr><th>항목 / 변경</th><th>이전</th><th>이후</th></tr></thead><tbody>'+model.changes().map(c=>`<tr><td>${esc(c.kind+' · '+(c.key||c.table))}<br><small>${esc(c.id)}</small></td><td><del>${esc(c.before||'')}</del></td><td><ins>${esc(c.after||'')}</ins></td></tr>`).join('')+'</tbody></table>';
 $('save-explanation').textContent=local?'확정하면 로컬 CSV와 웹 실행 데이터를 함께 변경합니다. 변경 전 파일은 artifacts/dialogue-editor-backups에 보관합니다. 엔진·노션·깃허브에는 자동 저장하지 않습니다.':'CSV, 연결 정보, 웹 실행 데이터가 담긴 ZIP을 내려받습니다. GitHub 원본은 바뀌지 않으며, 저장소에 파일을 적용하고 커밋/푸시해야 반영됩니다.';
 $('commit').textContent=local?'로컬 CSV 저장':'CSV ZIP 내보내기';reviewResult=await model.validate();$('validation').textContent=reviewResult.errors.join('\n')||'검사 완료 · CSV 구조와 대사 태그, 선택지 연결에 오류가 없습니다.';$('commit').disabled=!!reviewResult.errors.length;
};
$('close-review').onclick=()=>$('review-dialog').close();
$('commit').onclick=async()=>{if(saving)return;saving=true;$('commit').disabled=true;try{
 const checked=await model.validate();if(checked.errors.length)throw Error(checked.errors.join('\n'));
 if(local){const res=await fetch('/api/dialogue-editor',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':local.token},body:JSON.stringify({revision:local.revision,files:model.output()})}),data=await res.json();if(!res.ok)throw Error(data.error||'저장 실패');local.revision=data.revision;model.files={...model.files,...model.output()};model.base=model.snapshot();model.undoStack=[];model.redoStack=[];mark();status('실제 CSV 저장 완료 · 복구 파일: '+data.backup);}
 else{const files=await window.LunaDialogueExport.packageFiles(model,checked.result),blob=window.LunaDialogueExport.zip(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='luna-bar-dialogue-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('ZIP 내보내기 완료. GitHub 원본에는 아직 반영되지 않았습니다.');}
 $('review-dialog').close();drawList();
 }catch(e){$('validation').textContent=e.message;}finally{saving=false;$('commit').disabled=false;}};
window.addEventListener('beforeunload',e=>{if(model?.dirty()){e.preventDefault();e.returnValue='';}});
const hello=()=>frame.contentWindow.postMessage({channel:'luna-dialogue-editor',type:'hello'},location.origin);frame.addEventListener('load',hello);hello();
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(model?.dirty())$('review').click();}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!['TEXTAREA','INPUT'].includes(e.target.tagName)){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}});
try{await initialize();}catch(e){status('불러오기 실패: '+e.message);$('inspector').textContent='불러오기에 실패했습니다. 로컬 서버 또는 배포 파일을 확인해 주세요.';}
})();
