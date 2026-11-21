/* Editor-only destination picker shared by the two node players. The caller
   owns the candidates and only commits the selected one, never on dismissal. */
(function(W){
'use strict';
function create(trigger,editing=false){
 const dialog=document.createElement('dialog');dialog.className='preview-branch-picker';dialog.id=editing?'edit-branch-picker':'preview-branch-picker';
 dialog.innerHTML='<div class="branch-heading"><h2 id="preview-branch-title">이어 볼 분기 선택</h2><button type="button" class="branch-cancel" aria-label="분기 선택 취소">닫기 ×</button></div><div class="branch-list"></div>';
 const heading=dialog.querySelector('h2');if(editing){heading.id='edit-branch-title';heading.textContent='편집할 다음 분기 선택';}dialog.setAttribute('aria-labelledby',heading.id);
 document.body.append(dialog);trigger.setAttribute('aria-controls',dialog.id);
 const count=document.createElement('span');count.className='branch-count';count.hidden=true;trigger.append(count);
 function setCount(n){
  count.hidden=n<2;count.textContent=n>1?'분기 '+n:'';
  if(n>1)trigger.setAttribute('aria-haspopup','dialog');else trigger.removeAttribute('aria-haspopup');
 }
 const list=dialog.querySelector('.branch-list');let session=null;
 function dismiss(){if(!session)return;session=null;dialog.close();list.replaceChildren();}
 function cancel(){const cb=session?.cancel;dismiss();trigger.focus({preventScroll:true});cb?.();}
 dialog.querySelector('.branch-cancel').onclick=cancel;
 dialog.oncancel=e=>{e.preventDefault();cancel();};
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancel();}});
 list.onclick=e=>{const b=e.target.closest('button[data-branch]');if(!session||!b||b.disabled)return;const {items,choose}=session,entry=items[Number(b.dataset.branch)];dismiss();choose(entry);};
 dialog.onkeydown=e=>{
  if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  const buttons=[...list.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;
  e.preventDefault();const at=buttons.indexOf(document.activeElement),i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[i].focus();
 };
 function open(items,choose,onCancel,title){
  heading.textContent=title||(editing?'편집할 다음 분기 선택':'이어 볼 분기 선택');
  if(session)return;session={items,choose,cancel:onCancel};list.replaceChildren();
  for(const [i,entry] of items.entries()){
   const b=document.createElement('button');b.type='button';b.dataset.branch=i;b.disabled=!!entry.blocked;
   const add=(tag,text)=>{if(!text)return;const el=document.createElement(tag);el.textContent=text;b.append(el);};
   add('small',[(i+1)+'번',entry.selected?'방금 고른 선택':null,entry.badge].filter(Boolean).join(' · '));
   add('strong',entry.title);add('span',entry.detail);add('em',entry.blocked);
   if(entry.selected)b.dataset.selected='true';list.append(b);
  }
  dialog.showModal();(list.querySelector('[data-selected]:not(:disabled)')||list.querySelector('button:not(:disabled)')||dialog.querySelector('.branch-cancel')).focus();
 }
 return {open,dismiss,setCount,get active(){return !!session;}};
}
// Recompute on each click: unsaved wire, choice and condition edits are live.
function edit(trigger,list,follow,notice){
 const picker=create(trigger,true);
 trigger.onclick=()=>{try{
  const paths=list();if(!paths.some(p=>!p.blocked)){notice(paths[0]?.blocked||'이 노드에서 이어 편집할 대사가 없습니다.');return;}
  if(paths.length===1)follow(paths[0]);else picker.open(paths,follow);
 }catch(e){notice('다음 연결을 확인할 수 없습니다: '+e.message);}};
}
W.LunaPreviewBranchPicker={create,edit};
})(window);
