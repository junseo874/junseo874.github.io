/* An independent renderer for auditioning one node. It never navigates the
   line editor, changes its cursor or writes simulation choices into the CSV. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),esc=W.LunaBarCanvas.esc;
function create(api){
 const dialog=$('node-player'),stage=$('player-stage'),lines=$('player-lines');
 let frame=null,node=null,route=null,pending=null,defaultNext=null,at=0,ready=false,playing=false,ended=false,ticket=0;
 const nextNode=$('player-next-node'),picker=W.LunaPreviewBranchPicker.create(nextNode);
 let paths=[],chosen='',heldComplete=false,resumable=false;
 function post(type,payload){frame?.contentWindow?.postMessage({channel:'luna-dialogue-editor',type,payload},location.origin);}
 function resize(){if(!frame)return;const k=Math.min(stage.clientWidth/1280,stage.clientHeight/720);Object.assign(frame.style,{transform:'scale('+k+')',left:(stage.clientWidth-k*1280)/2+'px',top:(stage.clientHeight-k*720)/2+'px'});}
 new ResizeObserver(resize).observe(stage);
 function controls(){
  const choice=node.rows[at].type==='choice';
  $('player-count').textContent=(at+1)+' / '+node.rows.length;$('player-prev').disabled=at===0;$('player-next').disabled=!ready||ended||choice;
  $('player-next').title=at===node.rows.length-1?'마지막 줄 확인':'다음 줄';
  const many=paths.length>1;
  nextNode.disabled=(!many&&(!pending||!!pending.error||!!paths[0]?.blocked))||(!paths.length&&!!pending?.needsChoice);
  nextNode.hidden=!many&&!!pending?.end;
  nextNode.title=many?'연결된 '+paths.length+'개 분기 중 이어 볼 경로를 고릅니다.':paths[0]?.blocked||'남은 대사를 건너뛰고 연결된 노드를 엽니다.';
  picker.setCount(paths.length);
  $('player-toggle').textContent=ended?'↻ 처음부터 재생':playing?'Ⅱ 일시정지':resumable?'▶ 이어 재생':'▶ 자동 재생';
  $('player-toggle').setAttribute('aria-pressed',String(playing));
  for(const [i,b] of [...lines.children].entries())b.setAttribute('aria-current',i===at);
  lines.children[at]?.scrollIntoView({block:'nearest'});
 }
 function show(i,animate=playing){
  at=i;ended=false;resumable=false;chosen='';pending=defaultNext;const row=node.rows[i];$('player-state').textContent=pending.error||(!ready?'바 화면을 준비하는 중…':paths.length>1?'다음 노드 미리보기에서 '+paths.length+'개 분기 중 고를 수 있습니다.':row.type==='choice'?'이어 볼 선택지를 고르세요.':pending.end?'마지막 노드입니다.':'');
  controls();heldComplete=false;const token=++ticket;if(ready){post('show',{...route.payload(i),playing,animate,token,modal:true});if(picker.active)post('pause');}
 }
 function plan(pick){try{return route.next(pick);}catch(e){return {error:'다음 연결을 확인할 수 없습니다: '+e.message};}}
 function complete(pick){
  const next=pick?plan(pick):defaultNext;if(next.error){playing=false;pending=next;ended=true;post('stop');controls();$('player-state').textContent=next.error;return;}
  if(next.needsChoice)return;if(pick)chosen=pick.row_id;
  playing=false;ended=true;pending=next;post('stop');controls();
  const result=pick?'선택: '+api.plain(pick['text.ko'])+' · ':'';
  $('player-state').textContent=result+(paths.length>1?'다음 노드 미리보기에서 이어 볼 분기를 고르세요.':next.node?'이 노드의 재생이 끝났습니다. 다음: '+next.node.type+' · '+(next.node.index+1)+'번 줄':'연결된 다음 노드가 없습니다. 이 흐름은 여기서 끝납니다.');
 }
 function advance(){if(at+1>=node.rows.length)complete();else show(at+1);}
 function toggle(){
  if(playing){playing=false;resumable=ready;if(ready)post('pause');controls();$('player-state').textContent='일시정지';return;}
  playing=true;
  // A held, fully visible row has no running clock to resume. Start it fresh
  // so time spent reading never counts towards automatic advancement.
  if(ended||!resumable){show(ended?0:at);return;}
  resumable=false;if(heldComplete){heldComplete=false;advance();return;}
  post('resume');controls();$('player-state').textContent='';
 }
 function setNode(n){
  node=n;at=0;playing=false;ended=false;resumable=false;chosen='';defaultNext=plan();
  try{paths=route.branches();}catch(e){paths=[];defaultNext={error:'다음 연결을 확인할 수 없습니다: '+e.message};}pending=defaultNext;
  $('player-title').textContent=n.type+' · '+(n.cast.map(api.actorName).join(' / ')||'장면 연출');
  dialog.dataset.previewNode=n.id;
  lines.innerHTML=n.rows.map((r,i)=>'<button data-player-line="'+i+'"><small>'+String(i+1).padStart(2,'0')+'</small><b>'+esc(api.actorName(r.actor)||n.type)+'</b><span>'+esc(api.plain(r['text.ko'])||api.plain(r.arg)||n.type)+'</span></button>').join('');
 }
 function open(n,rowId){
  if(!n)return;route=api.route(n);ready=false;setNode(n);
  frame=document.createElement('iframe');frame.id='player-frame';frame.title='선택 노드의 실제 바 화면';frame.addEventListener('load',()=>post('hello'));frame.src='index.html?dev=1&dialogue-preview=1';stage.replaceChildren(frame);
  if(!dialog.open)dialog.showModal();resize();show(Math.max(0,n.rows.findIndex(r=>r.row_id===rowId)));$('player-toggle').focus({preventScroll:true});
 }
 function close(){
  if(!dialog.open)return;picker.dismiss();post('stop');ticket++;ready=false;node=route=pending=defaultNext=null;paths=[];playing=false;dialog.close();stage.replaceChildren();frame=null;delete dialog.dataset.previewNode;
 }
 W.addEventListener('message',e=>{
  if(!node||!dialog.open||e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.channel!=='luna-dialogue-preview')return;
  const m=e.data;if(m.type==='ready'){if(!ready){ready=true;show(at);}return;}
  if(m.token!==ticket)return;
  if(m.type==='complete'&&!ended&&(resumable||(picker.active&&playing))){heldComplete=true;return;}
  if(picker.active)return;
  if(m.type==='escape'){api.back();return;}if(m.type==='error'){$('player-state').textContent='재생 오류: '+m.message;playing=false;controls();return;}
  if((m.type==='complete'&&playing||m.type==='advance')&&!ended&&node.rows[at].type!=='choice')advance();
  if(m.type==='choice'&&node.rows[at].type==='choice'){const c=route.payload(at).choices.find(c=>String(c.seq)===String(m.seq));if(c)complete(c);}
 });
 lines.onclick=e=>{const b=e.target.closest('[data-player-line]');if(b)show(Number(b.dataset.playerLine),playing);};
 $('player-prev').onclick=()=>{if(at>0)show(at-1,playing);};$('player-next').onclick=()=>{if(at+1<node.rows.length)show(at+1,playing);else complete();};$('player-toggle').onclick=toggle;
 function describe(p){
  const n=p.target?.node,ctor=p.pick&&api.plain(p.pick['text.ko']),guard=p.guard&&api.guard(p.guard);
  const first=n?.rows.find(r=>api.plain(r['text.ko'])),excerpt=first&&api.plain(first['text.ko']);
  const dest=n?[p.target.lane.id!==route.scene&&p.target.lane.title,n.type+' · '+(n.index+1)+'번 줄',excerpt].filter(Boolean).join(' · '):p.blocked?'':'대화 종료';
  return {path:p,selected:!!chosen&&chosen===p.pick?.row_id&&!p.assumed&&p.target?.node?.id===pending?.node?.id,
   title:ctor||guard||'그 외의 경우',detail:[ctor&&guard, dest].filter(Boolean).join(' → '),
   badge:p.blocked?'선택 불가':p.assumed?'조건을 가정한 미리보기':!ctor?'현재 조건':'',blocked:p.blocked};
 }
 function move(p){
  if(p.blocked){$('player-state').textContent=p.blocked;return;}
  if(!route.enter(p.target)){playing=false;ended=true;chosen=p.pick?.row_id||'';pending=p.target;post('stop');controls();$('player-state').textContent=(p.pick?'선택: '+api.plain(p.pick['text.ko'])+' · ':'')+'이 경로는 여기서 끝납니다.';}
  else{setNode(route.node);show(0);}
  (nextNode.hidden||nextNode.disabled?$('player-toggle'):nextNode).focus({preventScroll:true});
 }
 nextNode.onclick=()=>{
  if(paths.length>1){
   if(playing)post('pause');
   picker.open(paths.map(describe),e=>move(e.path),()=>{if(playing&&ready){if(heldComplete){heldComplete=false;advance();}else post('resume');}});
  }else if(paths[0])move(paths[0]);
 };
 $('player-close').onclick=api.back;dialog.addEventListener('cancel',e=>{e.preventDefault();api.back();});
 return {open,close,get isOpen(){return dialog.open;}};
}
W.LunaBarPlayer={create};
})(window);
