(function(root){
'use strict';
// Add entries ONLY when the user explicitly designates them for the popup.
// Keep approved entries newest first, use unique IDs, and retain approved history.
const entries=[
 {"id":"2026-10-01-shaking-rhythm","date":"2026-10-01","title":"쉐이킹 리듬 기믹 개편","text":"쉐이킹을 세로 2레인·가로 드럼·중앙 교대의 세 가지 리듬 방식으로 플레이할 수 있습니다. 노드 수를 15개에서 20개로 늘리고, 시작 안내를 잠시 나타났다 사라지는 팝업으로 바꿨습니다.","note":"5콤보부터 1단계(1.25배), 10콤보부터 2단계(1.5배)로 노드와 쉐이킹 애니메이션이 빨라집니다. 단계에 따라 콤보 불꽃, 노드 잔상, 속도선과 화면 가장자리 빛 연출이 강해집니다. 실수하면 콤보·속도·연출이 초기화되며 애니메이션이 멈추고, 다음 노드를 맞히면 다시 재생됩니다. 개발자 시뮬레이터 → 기믹 미니게임 → 쉐이킹에서 세 방식을 비교해 보세요."},
 {id:'2026-09-28-day0-tutorial',date:'2026-09-28',title:'0일차 튜토리얼 안내 개선',text:'기존 버전의 0일차에서 코스터 전달부터 레시피 확인, 재료 준비, 제조 시작까지 직접 따라 하며 익힐 수 있습니다. 조작할 대상만 밝게 강조하고, 가까운 설명과 움직이는 화살표로 안내합니다.',note:'롱드링크잔을 선택한 뒤 A/D 키 또는 좌우 화살표로 선반을 이동해 진과 탄산수를 준비해 보세요. 진 담기·빼기도 연습할 수 있습니다. 최신 0일차 대사를 반영했으며, 이번 안내 확장은 기존 버전에 적용됩니다. GPT 개선 버전의 튜토리얼은 이전 상태를 유지합니다.'},
 {id:'2026-09-28-daily-unlocks',date:'2026-09-28',title:'새로운 재료 · 레시피 해금 안내',text:'1일차부터 바 영업을 시작할 때, 그날 새로 들어온 재료와 해금된 칵테일 레시피를 이미지로 확인할 수 있습니다.',note:'확인을 누르면 개점 대화와 영업 흐름이 이어집니다. 기존·GPT 개선 버전에 모두 적용되며, 0일차와 새 해금이 없는 날, 제조 연습 및 구간 바로 시작에서는 표시되지 않습니다.'},
 {id:'2026-09-27-ctrl-skip',date:'2026-09-27',title:'단골 대사 빠르게 넘기기',text:'대화 진행 중 Ctrl을 누르고 있으면 대사를 빠르게 넘길 수 있습니다.',note:'키를 놓으면 멈추며, 선택지와 제조 화면에서는 자동으로 진행하지 않습니다.'}
];
const storageKey='luna.bar.updates.dismissed.v1';
function mount({preview=false}={}){
 if(document.getElementById('luna-updates')||!entries.length)return;
 const latest=entries[0].id;
 try{let dismissed=localStorage.getItem(storageKey);
  // The withdrawn shelf notice must not reset an already-dismissed Ctrl announcement.
  if(dismissed==='2026-09-27-shelf-layout'){dismissed='2026-09-27-ctrl-skip';localStorage.setItem(storageKey,dismissed);}
  if(!preview&&dismissed===latest)return;
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
 checkbox.addEventListener('change',()=>{if(preview)return;try{if(checkbox.checked)localStorage.setItem(storageKey,latest);else localStorage.removeItem(storageKey);}catch{}});
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
