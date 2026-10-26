/* Read-only view of this shift's completed lines; never advances the story. */
(function(W){
 'use strict';
 let mounted=null,snapshot=null,owner=null;
 function entries(g){
  const rows=g.history.map(h=>({...h}));
  const current=g.screen==='bar'?g.currentDialogue():null;
  if(current&&current.chars>0)rows.push({actor:current.actor,text:current.text.slice(0,Math.floor(current.chars)),anonymous:g.speakerName(current.actor)==='???',current:true});
  return rows;
 }
 // Capture before opening the overlay changes camera/focus state. Reading
 // history must not make the current visible prefix disappear or reveal more.
 function open(g){snapshot=entries(g);owner=g.history;}
 function html({g,L,esc,close}){
  const rows=owner===g.history&&snapshot?snapshot:entries(g);
  return `<div class="dialogue-history-layer"><button class="dialogue-history-scrim" data-act="closeOverlay" tabindex="-1" aria-label="${L('대화 기록 닫기','Close dialogue history')}"></button><aside class="dialogue-history-panel" role="dialog" aria-modal="true" aria-labelledby="dialogue-history-title">
   <header class="dialogue-history-heading"><div><small>DIALOGUE HISTORY</small><h2 id="dialogue-history-title">${L('대화 기록','Dialogue history')}</h2></div>${close}</header>
   <div class="dialogue-history-meta"><span>${L(g.day+'일차 · 바 대화','DAY '+g.day+' · Bar conversations')}</span><span>${L(rows.length+'개 기록',rows.length+' entries')}</span></div>
   <div class="dialogue-history-scroll" tabindex="0" role="region" aria-label="${L('대화 기록 목록','Conversation log')}">${rows.length?rows.map(h=>`<article class="dialogue-history-entry${h.actor==='luna'?' is-luna':''}${h.current?' is-current':''}"><div class="dialogue-history-speaker"><b>${esc(h.anonymous?'???':g.name(h.actor))}</b>${h.current?'<small>'+L('진행 중','Current')+'</small>':''}</div><p>${esc(h.text)}</p></article>`).join(''):`<div class="dialogue-history-empty"><span aria-hidden="true">“</span><strong>${L('아직 기록된 대화가 없습니다.','No conversations yet.')}</strong><p>${L('대화를 나누면 이곳에 표시됩니다.','Your conversations will appear here.')}</p></div>`}</div>
   <footer><span>${L('기록을 보는 동안 진행이 멈춥니다.','Progress is paused while reading.')}</span><button data-act="historyLatest" ${rows.length?'':'disabled'}>${L('최근 대화로 ↓','Latest ↓')}</button></footer>
  </aside></div>`;
 }
 function latest(root){const scroll=root.querySelector('.dialogue-history-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;}
 function sync(root){
  const panel=root.querySelector('.dialogue-history-panel');
  if(!panel){if(mounted){snapshot=null;owner=null;}mounted=null;return;}
  if(panel!==mounted){mounted=panel;latest(root);panel.querySelector('.dialogue-history-scroll').focus({preventScroll:true});}
 }
 function key(e,root){
  const panel=root.querySelector('.dialogue-history-panel');if(!panel||e.code!=='Tab')return false;
  const focusable=[...panel.querySelectorAll('button:not(:disabled),[tabindex="0"]')],i=focusable.indexOf(document.activeElement);
  e.preventDefault();const next=i<0?(e.shiftKey?focusable.length-1:0):(i+(e.shiftKey?-1:1)+focusable.length)%focusable.length;focusable[next]?.focus({preventScroll:true});return true;
 }
 W.LunaDialogueHistory={html,open,sync,key,latest};
})(window);
