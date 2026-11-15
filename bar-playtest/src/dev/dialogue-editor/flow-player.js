/* An independent renderer for auditioning one node. It never navigates the
   line editor, changes its cursor or writes simulation choices into the CSV. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),esc=W.LunaBarCanvas.esc;
function create(api){
 const dialog=$('node-player'),stage=$('player-stage'),lines=$('player-lines');
 let frame=null,node=null,at=0,ready=false,playing=false,ended=false,ticket=0,picks={};
 function post(type,payload){frame?.contentWindow?.postMessage({channel:'luna-dialogue-editor',type,payload},location.origin);}
 function resize(){if(!frame)return;const k=Math.min(stage.clientWidth/1280,stage.clientHeight/720);Object.assign(frame.style,{transform:'scale('+k+')',left:(stage.clientWidth-k*1280)/2+'px',top:(stage.clientHeight-k*720)/2+'px'});}
 new ResizeObserver(resize).observe(stage);
 function controls(){
  $('player-count').textContent=(at+1)+' / '+node.rows.length;$('player-prev').disabled=at===0;$('player-next').disabled=at===node.rows.length-1;
  $('player-toggle').textContent=ended?'↻ 처음부터 재생':playing?'Ⅱ 일시정지':'▷ 이어 재생';
  for(const [i,b] of [...lines.children].entries())b.setAttribute('aria-current',i===at);
  lines.children[at]?.scrollIntoView({block:'nearest'});
 }
 function show(i,animate=true){
  at=i;ended=false;const row=node.rows[i];$('player-state').textContent=!ready?'바 화면을 준비하는 중…':row.type==='choice'?'화면에서 선택지를 선택하세요.':'';
  controls();const token=++ticket;if(ready)post('show',{...api.payload(row,node.rows.map(r=>r.row_id)),picks,playing,animate,token,modal:true});
 }
 function complete(){playing=false;ended=true;post('stop');controls();$('player-state').textContent='이 노드의 재생이 끝났습니다.';}
 function advance(){if(at+1>=node.rows.length)complete();else show(at+1);}
 function toggle(){
  if(ended){playing=true;show(0);return;}
  playing=!playing;if(ready)post(playing?'resume':'pause');controls();$('player-state').textContent=playing?'':'일시정지';
 }
 function open(n){
  if(!n)return;node=n;at=0;ready=false;playing=true;ended=false;picks={...api.getPicks()};
  $('player-title').textContent=n.type+' · '+(n.cast.map(api.actorName).join(' / ')||'장면 연출');
  lines.innerHTML=n.rows.map((r,i)=>'<button data-player-line="'+i+'"><small>'+String(i+1).padStart(2,'0')+'</small><b>'+esc(api.actorName(r.actor)||n.type)+'</b><span>'+esc(api.plain(r['text.ko'])||api.plain(r.arg)||n.type)+'</span></button>').join('');
  frame=document.createElement('iframe');frame.id='player-frame';frame.title='선택 노드의 실제 바 화면';frame.addEventListener('load',()=>post('hello'));frame.src='index.html?dev=1&dialogue-preview=1';stage.replaceChildren(frame);
  if(!dialog.open)dialog.showModal();resize();show(0);$('player-close').focus({preventScroll:true});
 }
 function close(){
  if(!dialog.open)return;post('stop');ticket++;ready=false;node=null;playing=false;dialog.close();stage.replaceChildren();frame=null;
 }
 W.addEventListener('message',e=>{
  if(!node||!dialog.open||e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.channel!=='luna-dialogue-preview')return;
  const m=e.data;if(m.type==='ready'){if(!ready){ready=true;show(at);}return;}
  if(m.token!==ticket)return;
  if(m.type==='escape'){api.back();return;}if(m.type==='error'){$('player-state').textContent='재생 오류: '+m.message;playing=false;controls();return;}
  if(m.type==='complete'&&playing&&!ended||m.type==='advance'&&!ended)advance();
  if(m.type==='choice'&&!ended){const row=node.rows[at],c=api.choices(row.arg).find(c=>String(c.seq)===String(m.seq));if(!c)return;picks[row.row_id]=c;advance();}
 });
 lines.onclick=e=>{const b=e.target.closest('[data-player-line]');if(b)show(Number(b.dataset.playerLine),playing);};
 $('player-prev').onclick=()=>{if(at>0)show(at-1,playing);};$('player-next').onclick=()=>{if(at+1<node.rows.length)show(at+1,playing);};$('player-toggle').onclick=toggle;
 $('player-close').onclick=api.back;dialog.addEventListener('cancel',e=>{e.preventDefault();api.back();});
 return {open,close,get isOpen(){return dialog.open;}};
}
W.LunaBarPlayer={create};
})(window);
