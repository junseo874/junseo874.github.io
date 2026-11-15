(function(W){
'use strict';
const $=id=>document.getElementById(id),F=W.LunaBarFlow,A=W.LunaFlowAuthoring,R=W.LunaBarWiring,esc=W.LunaBarCanvas.esc;
const options=arr=>arr.map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('');
// Each inspector opens in full on selection. A redraw of the same item keeps only
// the sections the author explicitly closed, keyed by purpose (not DOM order).
function inspectorState(panel,owner){
 const same=panel.dataset.owner===owner,top=same?panel.scrollTop:0;
 const closed=new Set(same?[...panel.querySelectorAll('details[data-fold]:not([open])')].map(d=>d.dataset.fold):[]);
 return ()=>{panel.dataset.owner=owner;for(const d of panel.querySelectorAll('details[data-fold]'))d.open=!closed.has(d.dataset.fold);panel.scrollTop=top;};
}
function group(key,title,body,attrs=''){
 return '<details open data-fold="'+esc(key)+'" '+attrs+'><summary>'+esc(title)+'</summary>'+body+'</details>';
}
const conditionTools=W.LunaRuleEditor.attach;
function create(api){
 const dialog=$('command-dialog');let source;
 function fields(){
  if(!source)return;const m=api.model(),k=$('command-type').value,list=m.rows(api.scene()),before=$('command-position').value==='before',at=list.indexOf(before?source.rows[0]:source.rows.at(-1))+(before?0:1),{seats}=A.state(m,api.scene(),at);
  const actors=Object.values(seats),choices=k==='enter'?[...new Set([...Object.keys(m.presentation.characterLayers),'shiba'])].filter(id=>id!=='luna'&&!actors.includes(id)):k==='say'?['luna',...actors]:actors;
  const old=$('command-actor').value;$('command-actor').innerHTML=options(choices.map(id=>[id,api.actorName(id)]));if(choices.includes(old))$('command-actor').value=old;
  $('cmd-actor-label').hidden=['choice','effect','end_part','tutorial'].includes(k);$('cmd-arg-label').hidden=!['enter','orderSet','tutorial'].includes(k);$('cmd-text-label').hidden=k!=='say';$('cmd-order-note').hidden=k!=='orderSet';$('command-effect-picker').hidden=$('cmd-effects-label').hidden=k!=='effect';
  const cocktails=m.projected.data.tables.cocktails.filter(c=>Number(c.unlock_day||0)<=Number(m.scenes.find(s=>s.id===api.scene()).day));
  const args=k==='orderSet'?[['free','손님이 술을 지정하지 않음'],...cocktails.map(c=>['exact:'+c.id,c['name.ko']||c.id])]:k==='enter'?[['L','왼쪽 좌석'],['R','오른쪽 좌석']].filter(([seat])=>!seats[seat]):[...new Set(m.tables.steps.filter(r=>r.type==='tutorial'&&F.clean(r.arg)).map(r=>r.arg))].map(s=>[s,s]);
  $('cmd-arg-label').firstElementChild.textContent=k==='orderSet'?'주문할 칵테일':k==='enter'?'입장할 좌석':'튜토리얼';$('command-arg').innerHTML=options(args);
 }
 function open(n,position){
  if(!n)return;source=n;$('command-type').innerHTML=options(Object.entries(A.names));$('command-position').value=position||(n.rows.at(-1).type==='end_part'?'before':'after');$('command-text').value='';$('command-effect').value='';$('command-when').value=n.when;$('command-error').textContent='';
  fields();conditionTools($('command-builder'),$('command-when'),api.model);const fx=$('command-effect-picker');fx.replaceChildren();W.LunaRuleEditor.effects(fx,$('command-effect'),api.model);dialog.showModal();
 }
 $('command-type').onchange=$('command-position').onchange=fields;$('command-cancel').onclick=()=>dialog.close();
 $('command-form').onsubmit=e=>{e.preventDefault();const before=$('command-position').value==='before',m=api.model(),list=m.rows(api.scene()),next=list[list.indexOf(before?source.rows[0]:source.rows.at(-1))+(before?0:1)];
  const beforeRows=new Set(list.map(r=>r.row_id));const ok=api.change(()=>{const r=A.create(m,api.scene(),source,{before,type:$('command-type').value,actor:$('command-actor').value||'luna',arg:$('cmd-arg-label').hidden?'':$('command-arg').value,text:$('command-text').value,effect:$('command-effect').value,when:$('command-when').value});const failure=W.LunaBarAudit.audit(m,m.projected.data.tables.text_tags).find(i=>i.scene===api.scene()&&!beforeRows.has(i.row)&&i.severity==='error');if(failure)throw Error(failure.message);api.boundary(r,next);return r;});
  if(ok){dialog.close();api.locate();}else $('command-error').textContent=$('status').textContent;
 };
 return {open};
}
function choices(m,n){
 const last=n.rows.at(-1);if(last.type!=='choice')return {fields:'',rules:''};
 const list=m.choices(last.arg),decode=W.LunaDialogueEditorModel.decode;
 const fields='<section class="quick-choices"><div class="choice-line-title"><h3>선택지 문구 <small>'+list.length+' / 4</small></h3><button data-action="add-option" '+(list.length>=4?'disabled':'')+'>＋ 선택지 추가</button></div>'+
  list.map((o,i)=>'<div class="quick-option" data-quick-row="'+esc(o.row_id)+'"><div class="choice-head"><b>선택지 '+(i+1)+'</b><button data-del-option="'+esc(o.row_id)+'" '+(list.length<2?'disabled':'')+'>삭제</button></div><textarea rows="2" data-quick-key="text.ko" aria-label="선택지 '+(i+1)+' 문구">\n'+esc(decode(o['text.ko']))+'</textarea></div>').join('')+'</section>';
 const rules=list.map((o,i)=>group('choice:'+o.row_id,'선택지 '+(i+1)+' · 조건과 효과',
  '<strong class="rc-field-title">선택 가능 조건</strong><input type="hidden" data-quick-key="when" value="'+esc(R.readable(o.when))+'"><div class="quick-builder"></div>'+
  '<strong class="rc-field-title">선택 시 효과</strong><input type="hidden" data-quick-key="effects" value="'+esc(R.authorEffects(o.effects))+'">'+
  '<label>선택할 수 없는 이유<input data-quick-key="lock_reason.ko" value="'+esc(decode(o['lock_reason.ko']))+'"></label>',
  'class="quick-rule" data-quick-row="'+esc(o.row_id)+'"')).join('');
 return {fields,rules};
}
W.LunaFlowAuthorUI={create,choices,conditionTools,group,inspectorState};
})(window);
