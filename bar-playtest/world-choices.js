/* Detached, actor-anchored dialogue choices. The host owns the dialogue clock. */
(function(W){'use strict';
function wheelHint(up){
 const mouse='<svg class="choice-guide-mouse" viewBox="0 0 24 32" aria-hidden="true"><rect x="3" y="2" width="18" height="28" rx="9"/><path d="M3 14h18M12 2v5"/><rect class="choice-guide-wheel" x="9" y="6" width="6" height="10" rx="2"/></svg>';
 const triangle='<svg class="choice-guide-triangle" viewBox="0 0 12 10" aria-hidden="true"><polygon points="'+(up?'6,1 11,9 1,9':'1,1 11,1 6,9')+'"/></svg>';
 return '<span class="choice-wheel-input" role="img" aria-label="마우스 휠 '+(up?'위로':'아래로')+' 스크롤">'+mouse+triangle+'</span>';
}
function create(parent,onChoose,state={}){
 const panel=document.createElement('section'),guide=document.createElement('aside'),marker=document.createElement('kbd');
 marker.className='world-choice-confirm';marker.textContent='E';marker.setAttribute('aria-hidden','true');
 panel.className='world-choices outside-choices bd-choices';panel.setAttribute('role','group');panel.hidden=true;
 guide.className='world-choice-tutorial';guide.hidden=true;guide.setAttribute('role','note');
 guide.innerHTML='<header><small>TUTORIAL</small><h2>대화 선택지 선택</h2></header><div class="choice-guide-navigation"><p><span class="choice-guide-input"><kbd>W</kbd><i>/</i>'+wheelHint(true)+'</span><span>이전 선택지</span></p><p><span class="choice-guide-input"><kbd>S</kbd><i>/</i>'+wheelHint(false)+'</span><span>다음 선택지</span></p></div><p class="choice-guide-confirm"><kbd>E</kbd><span>로 선택 확정</span></p>';
 parent.append(panel,guide);
 let view=null,signature='',buttons=[],lastWheel=-Infinity,locked=false;
 const available=()=>!!view&&!panel.hidden&&panel.isConnected&&!panel.closest('[inert]')&&!document.hidden&&!W.LunaFocusSettings?.hiddenPaused;
 function placeMarker(){const row=buttons[state.index];marker.hidden=!row;if(row)marker.style.transform='translateY('+Math.round(row.offsetTop+(row.offsetHeight-marker.offsetHeight)/2)+'px)';}
 function paint(focus=false){buttons.forEach((b,i)=>{const selected=i===state.index;b.classList.toggle('is-selected',selected);b.tabIndex=selected?0:-1;b.setAttribute('aria-current',String(selected));});placeMarker();if(focus)buttons[state.index]?.focus({preventScroll:true});}
 function select(i,focus=false){if(!available()||buttons[i]?.disabled)return;state.index=i;paint(focus);}
 function move(delta){const enabled=buttons.map((b,i)=>b.disabled?-1:i).filter(i=>i>=0);if(!enabled.length)return;const at=enabled.indexOf(state.index);select(enabled[(at+delta+enabled.length)%enabled.length],true);}
 function confirm(){if(!available()||locked)return;const option=view.options[state.index];if(!option||option.disabled)return;locked=true;guide.hidden=true;onChoose(option.id);}
 panel.addEventListener('click',e=>{const b=e.target.closest('button[data-choice]');if(!b||b.disabled||!available())return;e.preventDefault();e.stopPropagation();select(buttons.indexOf(b));confirm();});
 panel.addEventListener('pointerover',e=>{const b=e.target.closest('button[data-choice]');if(b&&!b.disabled)select(buttons.indexOf(b));});
 panel.addEventListener('focusin',e=>{const i=buttons.indexOf(e.target);if(i>=0&&!buttons[i].disabled)select(i);});
 function wheel(e){if(!available()||e.ctrlKey||e.metaKey||e.altKey||!e.deltaY)return;e.preventDefault();e.stopImmediatePropagation();const now=performance.now();if(now-lastWheel<140)return;lastWheel=now;move(e.deltaY>0?1:-1);}
 W.addEventListener('wheel',wheel,{capture:true,passive:false});
 function key(e){if(!available()||e.ctrlKey||e.metaKey||e.altKey)return false;
  if(['KeyW','ArrowUp','KeyS','ArrowDown','Tab','KeyE','Space','Enter'].includes(e.code)){
   e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return true;
   if(['KeyW','ArrowUp'].includes(e.code)||e.code==='Tab'&&e.shiftKey)move(-1);
   else if(['KeyS','ArrowDown','Tab'].includes(e.code))move(1);
   else if(e.code==='KeyE')confirm();
   return true;
  }return false;
 }
 function update(next){
  view=next;panel.hidden=!next;guide.hidden=!next?.tutorial;if(!next)return;
  if(locked){signature='';state.key=null;locked=false;}
  if(next.options.length>4)throw Error('외부 대화 선택지는 최대 4개까지 지원합니다.');
  const stamp=JSON.stringify([next.key,next.options,next.money]);
  if(signature!==stamp){const previous=buttons[state.index]?.dataset.choice;const fresh=state.key!==next.key;signature=stamp;locked=false;
   if(fresh){state.key=next.key;state.index=0;state.tutorialPlayed=false;lastWheel=-Infinity;}
   panel.replaceChildren(marker);buttons=next.options.map((o,i)=>{const b=document.createElement('button');b.type='button';b.dataset.choice=o.id;b.disabled=!!o.disabled;b.style.setProperty('--choice-order',i);b.innerHTML='<span></span>';b.querySelector('span').textContent=o.label;if(o.disabled){const note=document.createElement('small');note.textContent=o.disabledReason||'선택할 수 없습니다 · 소지금 부족';b.querySelector('span').append(note);}b.addEventListener('keydown',key);panel.append(b);return b;});
   if(!fresh&&previous){const at=buttons.findIndex(b=>b.dataset.choice===previous);if(at>=0)state.index=at;}
   if(!buttons[state.index]||buttons[state.index].disabled)state.index=buttons.findIndex(b=>!b.disabled);
   if(Number.isFinite(next.money)){const balance=document.createElement('small');balance.className='bd-balance';balance.textContent='소지금 '+next.money.toLocaleString('ko-KR')+'원';panel.append(balance);}
   panel.setAttribute('aria-label',next.label||'대화 선택지');paint();
  }
  const head=next.head,w=panel.offsetWidth,h=panel.offsetHeight,right=next.facing===-1||next.facing==='left';
  panel.dataset.side=right?'right':'left';
  // Reserve the separate E marker's gutter, including at the viewport edge.
  panel.style.left=Math.round(Math.max(right?44:12,Math.min((right?1268:1236)-w,right?head.x+66:head.x-66-w)))+'px';
  panel.style.top=Math.round(Math.max(18,Math.min(702-h,head.y-16)))+'px';
  placeMarker();
  if(next.tutorial&&!state.tutorialPlayed){state.tutorialPlayed=true;W.LunaControlsTutorial?.play(()=>available()&&!guide.hidden);}
 }
 return {update,key,dispose(){view=null;W.removeEventListener('wheel',wheel,true);panel.remove();guide.remove();}};
}
W.LunaWorldChoices={create};
})(window);
