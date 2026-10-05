/* Production gaps, not every shared asset: approved reuse and code-only UI are valid. */
(function(W){
'use strict';
const categories=[['cocktail','칵테일'],['item','재료 · 잔 · 도구'],['character','캐릭터'],['background','배경'],['ui','UI'],['effect','연출']];
const reasons={dummy:'더미·임시만 등록',sharedDummy:'공용 더미 사용',missing:'전용 리소스 미등록',animation:'제공 애니메이션 미등록',uiArt:'UI 아트 미제작'};
const temporary=l=>/더미|dummy|임시/i.test(l.source||'')||/campaign\/(johnny-|tom-|shiba-)/i.test(l.src||'')||l.key==='item_dummy'||/^ambient-/.test(l.key||'');
function category(r){
 if(['bar-drinks','bar-serve'].includes(r.group))return 'cocktail';
 if(r.group==='bar-items')return 'item';
 if(r.group.endsWith('-characters'))return 'character';
 if(r.group.endsWith('-backgrounds')||/^ui-art:(bar($|_)|prep_|gimmick)/.test(r.id))return 'background';
 if(r.group.endsWith('-fx'))return 'effect';
 return 'ui';
}
function reason(r){
 // The current character production checklist is limited by the owner.
 // This affects only missing-resource reporting, not the full catalog.
 if(category(r)==='character'&&!/^actor:(tom|shiba)(:|$)/.test(r.id)&&r.id!=='outside:terrace-chris')return null;
 if(r.uiArtPending)return 'uiArt';
 const ls=r.layers||[],dummy=ls.some(temporary);
 if(r.status==='missing')return 'missing';
 if(r.id.startsWith('serve:')&&r.status==='shared')return 'animation';
 if(r.key==='item_dummy'||r.id.startsWith('outside-role:')&&r.status==='dummy'||r.status==='shared'&&dummy)return 'sharedDummy';
 if(r.status==='dummy'||dummy)return 'dummy';
 if(r.id.startsWith('drink:')&&r.key?.startsWith('item_'))return 'missing';
 return null;
}
function family(r){
 if(/^(drink|serve):/.test(r.id))return 'cocktail:'+r.id.split(':')[1];
 if(/^(item|actor):/.test(r.id))return r.id.split(':').slice(0,2).join(':');
 // A composite and its raw layers need review, but must not inflate the count.
 if(r.id.startsWith('guest'))return 'guest:'+(/guest[:_]m/.test(r.id)?'m':'f');
 return r.id;
}
function build(rows){
 const entries=new Map();
 for(const row of rows){const why=reason(row);if(!why)continue;const kind=category(row),id=kind+':'+family(row);if(!entries.has(id))entries.set(id,{id,category:kind,title:row.title,area:row.group.startsWith('bar-')?'바 내부':'외부',rows:[],reasons:[]});const e=entries.get(id);e.rows.push({row,reason:why});if(!e.reasons.includes(why))e.reasons.push(why);}
 return [...entries.values()].sort((a,b)=>categories.findIndex(c=>c[0]===a.category)-categories.findIndex(c=>c[0]===b.category)||a.title.localeCompare(b.title,'ko'));
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount({getRows,inspect,paint}){
 const panel=document.querySelector('#missing-view');let entries=[],picked='all',query='',status='all',area='all';
 const visible=()=>entries.filter(e=>(picked==='all'||picked===e.category)&&(status==='all'||e.reasons.includes(status))&&(area==='all'||e.area===area)&&(!query||[e.title,e.area,...e.rows.flatMap(({row:r})=>[r.usage,r.id,r.note,r.wanted,r.key,...(r.layers||[]).map(l=>l.key+' '+l.source)])].join(' ').toLowerCase().includes(query)));
 function render(){
  const list=visible();
  panel.querySelector('.missing-tabs').innerHTML=[['all','전체'],...categories].map(([id,title])=>'<button data-missing-category="'+id+'" aria-pressed="'+(picked===id)+'">'+title+'<span>'+entries.filter(e=>id==='all'||e.category===id).length+'</span></button>').join('');
  panel.querySelector('#missing-count').textContent=list.length+'종 / 전체 '+entries.length+'종 · 같은 항목의 용도·표정은 한 줄로 모았습니다.';
  panel.querySelector('#missing-list').innerHTML=list.map(e=>{const r=e.rows[0].row;return '<article class="missing-entry" data-gap="'+esc(e.id)+'"><div class="missing-thumb">'+(r.preview?'<img src="'+esc(r.preview)+'" alt="현재 임시 표시" loading="lazy">':r.layers?.length?'<canvas data-thumb="'+esc(r.id)+'" aria-label="'+esc(e.title)+' 현재 표시"></canvas>':'<span aria-label="이미지 미등록">—</span>')+'</div><div class="missing-copy"><small>'+categories.find(c=>c[0]===e.category)[1]+' · '+e.area+'</small><h3>'+esc(e.title)+'</h3><div class="missing-badges">'+e.reasons.map(k=>'<span class="badge '+(k==='missing'?'missing':'dummy')+'">'+reasons[k]+'</span>').join('')+'</div><p>'+esc([...new Set(e.rows.map(({row})=>row.usage))].join(' / '))+'</p><details><summary>누락·대체 내역 '+e.rows.length+'건</summary>'+e.rows.map(({row:r,reason:k})=>'<div class="missing-detail"><b>'+esc(r.usage)+'</b><p>'+reasons[k]+(k==='animation'?' · 정적 이미지로 대신 재생 중':'')+'</p><p>'+esc(r.note||'현재 등록된 이미지의 출처가 더미·임시로 표시되어 있습니다.')+'</p><code>'+esc(r.id)+'</code>'+(r.layers?.length?'<p class="missing-source">현재 사용: '+r.layers.map(l=>esc(l.key)+'<br>'+esc(l.source||'출처 메타데이터 없음')).join('<br>')+'</p>':'<p>사용 가능한 이미지 없음</p>')+'<button data-missing-inspect="'+esc(r.id)+'">이 용도 확인 ↗</button></div>').join('')+'</details></div><button class="missing-inspect" data-missing-inspect="'+esc(r.id)+'">리소스 보기 ↗</button></article>';}).join('')||'<p class="missing-empty">'+(query||status!=='all'||area!=='all'?'조건에 맞는 항목이 없습니다.':'현재 등록 데이터에서 이 분류의 미제작 항목이 확인되지 않았습니다.')+'</p>';
  for(const canvas of panel.querySelectorAll('canvas[data-thumb]')){const r=getRows().find(r=>r.id===canvas.dataset.thumb);if(r)paint(canvas,r,0);}
 }
 function refresh(){entries=build(getRows());if(!panel.hidden)render();}
 function show(){entries=build(getRows());render();}
 panel.addEventListener('click',e=>{const tab=e.target.closest('[data-missing-category]');if(tab){picked=tab.dataset.missingCategory;render();panel.querySelector('[data-missing-category="'+picked+'"]').focus();}const link=e.target.closest('[data-missing-inspect]');if(link)inspect(link.dataset.missingInspect);});
 panel.querySelector('#missing-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
 panel.querySelector('#missing-reason').onchange=e=>{status=e.target.value;render();};
 panel.querySelector('#missing-area').onchange=e=>{area=e.target.value;render();};
 panel.querySelector('#missing-reset').onclick=()=>{picked=status=area='all';query='';panel.querySelector('#missing-search').value='';panel.querySelector('#missing-reason').value='all';panel.querySelector('#missing-area').value='all';render();};
 panel.querySelector('#missing-export').onclick=()=>{
  const cells=[['분류','영역','리소스','용도','누락 상태','현재 사용 키','출처','비고'],...visible().flatMap(e=>e.rows.map(({row:r,reason:k})=>[categories.find(c=>c[0]===e.category)[1],e.area,e.title,r.usage,reasons[k],(r.layers||[]).map(l=>l.key).join(' | '),(r.layers||[]).map(l=>l.source).join(' | '),r.note]))];
  const csv=cells.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='unknown-missing-resources.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 refresh();return{refresh,show,get entries(){return entries;}};
}
W.ResourceMissing={build,reason,category,mount,categories,reasons};if(typeof module!=='undefined')module.exports=W.ResourceMissing;
})(typeof window==='undefined'?globalThis:window);
