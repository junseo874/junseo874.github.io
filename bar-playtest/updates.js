(function(root){
'use strict';
// Add entries ONLY when the user explicitly designates them for the popup.
// Keep approved entries newest first, use unique IDs, and retain approved history.
const entries=[
 {id:'2026-09-27-ctrl-skip',date:'2026-09-27',title:'단골 대사 빠르게 넘기기',text:'대화 진행 중 Ctrl을 누르고 있으면 대사를 빠르게 넘길 수 있습니다.',note:'키를 놓으면 멈추며, 선택지와 제조 화면에서는 자동으로 진행하지 않습니다.'}
];
const storageKey='luna.bar.updates.dismissed.v1';
function mount(){
 if(document.getElementById('luna-updates')||!entries.length)return;
 const latest=entries[0].id;
 try{let dismissed=localStorage.getItem(storageKey);
  // The withdrawn shelf notice must not reset an already-dismissed Ctrl announcement.
  if(dismissed==='2026-09-27-shelf-layout'){dismissed='2026-09-27-ctrl-skip';localStorage.setItem(storageKey,dismissed);}
  if(dismissed===latest)return;
 }catch{}
 const dialog=document.createElement('dialog');
 dialog.id='luna-updates';dialog.className='updates-dialog';
 dialog.setAttribute('aria-labelledby','updates-heading');
 dialog.innerHTML='<header class="updates-header"><h2 id="updates-heading">업데이트 내역</h2><button type="button" class="updates-close" aria-label="업데이트 내역 닫기" autofocus>×</button></header><div class="updates-list" tabindex="0" role="region" aria-label="최신순 업데이트 목록"></div><footer class="updates-footer"><div><label class="updates-dismiss"><input type="checkbox">다시 보지 않기</label><p>새 업데이트가 있으면 다시 표시됩니다.</p></div><button type="button" class="primary updates-confirm">확인</button></footer>';
 const list=dialog.querySelector('.updates-list');
 for(const [index,entry] of entries.entries()){
  const article=document.createElement('article');article.className='updates-entry';article.dataset.updateId=entry.id;
  const meta=document.createElement('div');meta.className='updates-meta';
  const date=document.createElement('time');date.dateTime=entry.date;date.textContent=entry.date.replaceAll('-','.');meta.append(date);
  if(index===0){const badge=document.createElement('span');badge.className='updates-new';badge.textContent='최신';meta.append(badge);}
  const title=document.createElement('h3');title.textContent=entry.title;
  const text=document.createElement('p');text.textContent=entry.text;article.append(meta,title,text);
  if(entry.note){const note=document.createElement('p');note.className='updates-note';note.textContent=entry.note;article.append(note);}
  list.append(article);
 }
 const checkbox=dialog.querySelector('input');
 checkbox.addEventListener('change',()=>{try{if(checkbox.checked)localStorage.setItem(storageKey,latest);else localStorage.removeItem(storageKey);}catch{}});
 const previous=document.activeElement;
 const close=()=>dialog.close();
 dialog.querySelector('.updates-close').addEventListener('click',close);
 dialog.querySelector('.updates-confirm').addEventListener('click',close);
 // Keep game hotkeys out of this modal; native Tab navigation remains available.
 const guard=e=>{if(!dialog.open)return;e.stopImmediatePropagation();if(e.type==='keydown'&&e.code==='Escape'){e.preventDefault();close();}};
 window.addEventListener('keydown',guard,true);window.addEventListener('keyup',guard,true);
 dialog.addEventListener('close',()=>{
  window.removeEventListener('keydown',guard,true);window.removeEventListener('keyup',guard,true);dialog.remove();
  const target=previous?.isConnected&&previous!==document.body?previous:document.querySelector('.version-tabs button');target?.focus({preventScroll:true});
 },{once:true});
 document.body.append(dialog);dialog.showModal();list.scrollTop=0;
}
root.LunaUpdates={mount};
})(window);
