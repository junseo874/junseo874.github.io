/* Exterior properties use the bar workbench's details and rail styling. All persisted
 * fields still go through the outside editor model; this module owns display state only. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const drafts=new Map(),groups={text:'대사·진행',choice:'선택지·연결',place:'배치',setup:'미리보기',source:'원본'};
const prop=(label,body)=>'<label><span>'+esc(label)+'</span>'+body+'</label>';
const note=s=>'<p class="dp-help">'+esc(s)+'</p>';
const block=(key,cat,title,body)=>'<details open data-fold="'+key+'" data-detail-group="'+cat+'"><summary>'+esc(title)+'</summary>'+body+'</details>';
const option=(val,name,sel)=>'<option value="'+esc(val)+'"'+(val===sel?' selected':'')+'>'+esc(name)+'</option>';
function install({model:m,flow:f,site,rows,r,decoded,kind,idx,mode,node,label,decode,menu,context}){
 const panel=$('node-detail'),owner=f.id+'|'+r.row_id+'|'+mode,prior=panel.dataset.owner,pos=prior===owner?$('inspector').scrollTop:0;
 if(!drafts.has(owner)){if(drafts.size>180)drafts.delete(drafts.keys().next().value);drafts.set(owner,{filter:'all',q:'',folds:{}});}
 const st=drafts.get(owner);panel.dataset.owner=owner;
 const write=(title,key)=>prop(title,'<textarea data-field="'+key+'" '+(m.canEdit(r,key,f)?'':'readonly')+'>'+esc(decode(r[key]))+'</textarea>');
 const actors=[...new Set(['luna','chris',...m.flows.flatMap(f=>m.rows(f.id).map(r=>decode(r.actor))).filter(Boolean)])],onStage=[...new Set(rows.map(r=>m.step(r).actor).filter(Boolean))],actor=decoded.actor||'luna';
 const choice=m.isMenu(r),event=kind==='연출 / 알림',tone=choice?'#c0a7e8':event?'#ecbf7a':'#8ed6ce';
 const eventCue=decoded.action||decoded.cinema||m.kind(r);
 let content=block('line','text',choice?'선택지 앞 대사':'대사 · 진행',
  prop('화자','<select data-field="actor" '+(m.canEdit(r,'actor',f)?'':'disabled')+'>'+actors.map(a=>option(a,label(a),r.actor)).join('')+'</select>')+
  write('한국어 대사','text.ko')+(choice&&!decode(r['text.ko'])?note('이 줄이 비어 있으면 직전 말풍선과 함께 선택지를 표시합니다.'):''));
 if(event)content+=block('cue','text','사건 · 연출 신호','<div class="dp-static"><span>실행 동작</span><strong>'+esc(eventCue)+'</strong></div>'+note('본편 사건에 연결된 동작입니다. 대본에서 줄 순서를 바꿔 실행 시점을 조정할 수 있습니다.'));
 const posId=site.pins.includes(f.id)?f.id:site.pins[0],spec=W.LunaNpcPlacement.specs[posId],cp=spec&&W.LunaNpcPlacement.editPoint(m.placement,posId);
 const place=spec?block('position','place','NPC 배치',
 '<div class="dp-static"><span>장소</span><strong>'+esc(W.LunaNpcPlacement.floorNames[spec.floor])+'</strong></div><div class="dp-static"><span>'+ (posId==='newspaper'?'앉은 위치':'발 위치') +'</span><strong>X '+cp.x.toFixed(2)+'　Y '+cp.y.toFixed(3)+'</strong></div><button class="detail-open" data-detail-action="place">⌖　씬에서 위치 지정</button>'):'';
 const choiceBody=menu?block('options','choice','선택지 · '+m.menu(r).length+'개',menu):'';
 const cast=block('cast','setup','캐릭터 이미지 / 행동',prop('미리보기 대상','<select id="preview-actor">'+(onStage.length?onStage:[actor]).map(a=>option(a,label(a),actor)).join('')+'</select>')+'<div id="actor-controls"></div>'+note('현재 줄의 미리보기 전용입니다. 본편 NPC의 시트는 바뀌지 않습니다.'));
 const preset=site.id==='repair'?prop('수리 상황','<select id="repair-preset"><option value="">직접 설정</option><option value="none">부품 없음 · 399원</option><option value="gear">부품 있음 · 0원</option><option value="pay">부품 없음 · 400원</option><option value="done">이미 수리함</option></select>'):'';
 const ctx=block('ctx','setup','조건 테스트 / 알림',preset+prop('일차 · 소지금','<span class="compact-pair"><input id="preview-day" aria-label="테스트 일차" type="number" min="0" max="99" value="'+context.day+'"><input id="preview-money" aria-label="테스트 소지금" type="number" min="0" value="'+context.money+'"></span>')+
 '<details class="source-gate"><summary>플래그 · 인벤토리 테스트 값</summary>'+prop('플래그 JSON','<textarea id="preview-flags">'+esc(JSON.stringify(context.flags))+'</textarea>')+prop('인벤토리 JSON','<textarea id="preview-inventory">'+esc(JSON.stringify(context.inventory))+'</textarea>')+'</details><button id="apply-context">조건 적용</button>'+
 prop('알림 종류','<select id="notice-type"><option value="item">신규 재료</option><option value="gear">기어 부품</option><option value="emblem">기신교의 엠블럼</option><option value="goal">목표 달성</option><option value="money">돈 획득</option></select>')+
 prop('재료','<select id="notice-item">'+m.projected.data.tables.shelf_items.filter(i=>i.kind==='ingredient').map(i=>option(i.id,i['name.ko']||i.id)).join('')+'</select>')+'<button id="notice-demo">▷　알림 미리보기</button>');
 const members=mode==='map'&&node?block('members','text','진행 줄 · '+node.rows.length,'<ul class="node-lines">'+node.rows.map(member=>{const s=m.step(member);return '<li><button data-member="'+esc(member.row_id)+'" aria-current="'+(member.row_id===r.row_id)+'"><small>'+String(rows.indexOf(member)+1).padStart(2,'0')+'</small>'+esc((s.actor?label(s.actor)+'　':'')+(s['text.ko']||s.action||(m.isMenu(member)?'선택지':'연출')))+'</button></li>';}).join('')+'</ul>'):'';
 const origin=block('source','source','원본 · 영문 대사',write('영문 대사','text.en')+'<details class="source-gate"><summary>원본 식별자</summary><p class="row-id">'+[r.dataset_id,r.parent_id,r.template_id].map(esc).join('<br>')+'</p></details>');
 panel.style.setProperty('--t',tone);panel.style.setProperty('--wash',choice?'#332b40':'#203637');
 panel.innerHTML='<div class="dp-tab">▤　디테일</div><div class="inspector-title"><h2>'+esc(choice?'선택지':kind)+'</h2><small>#'+String(idx+1).padStart(2,'0')+'</small></div><p class="node-meta">'+esc(site.name)+'　/　'+esc(f.title)+'</p><div class="node-actions"><button data-detail-action="mode">'+(mode==='map'?'대사 편집':'↖ 플로우 차트')+'</button><button data-detail-action="stage">▷ '+(mode==='map'?'노드 재생':'여기서 재생')+'</button></div>'+
 '<div class="dp-toolbar"><input class="dp-search" type="search" aria-label="디테일 속성 검색" placeholder="속성 검색"><nav class="dp-filters" aria-label="디테일 항목 필터"></nav></div><p class="dp-empty" hidden>일치하는 속성이 없습니다.</p>'+
 (choice?choiceBody+content:content+choiceBody)+place+cast+members+ctx+origin;
 const secs=[...panel.querySelectorAll(':scope > [data-detail-group]')],nav=panel.querySelector('.dp-filters'),search=panel.querySelector('.dp-search');search.value=st.q;
 for(const s of secs){s.open=st.folds[s.dataset.fold]!==false;s.addEventListener('toggle',()=>{if(s.isConnected)st.folds[s.dataset.fold]=s.open;});}
 const visibleCats=Object.entries(groups).filter(([id])=>secs.some(s=>s.dataset.detailGroup===id));
 if(st.filter!=='all'&&!visibleCats.some(([id])=>st.filter===id))st.filter='all';
 function filter(){let found=0;for(const s of secs){const words=[groups[s.dataset.detailGroup],...Array.from(s.querySelectorAll('summary,label>span,.choice-actions b,.dp-static span,[data-menu-field="text.ko"]'),e=>e.value||e.textContent),...Array.from(s.querySelectorAll('label'),e=>Array.from(e.childNodes).filter(t=>t.nodeType===3).map(t=>t.textContent).join(' '))].join(' ').toLocaleLowerCase();s.hidden=(st.filter!=='all'&&s.dataset.detailGroup!==st.filter)||!words.includes(st.q.trim().toLocaleLowerCase());if(!s.hidden){found++;if(st.q)s.open=true;}}
  for(const b of nav.children)b.setAttribute('aria-pressed',String(st.filter===b.dataset.category));panel.querySelector('.dp-empty').hidden=!!found;}
 for(const [id,name]of [['all','전체'],...visibleCats]){const b=document.createElement('button');b.type='button';b.dataset.category=id;b.textContent=name;b.onclick=()=>{st.filter=id;filter();};nav.append(b);}
 search.oninput=()=>{st.q=search.value;filter();};search.onkeydown=e=>{if(e.key==='Escape'&&st.q){e.preventDefault();e.stopPropagation();search.value=st.q='';filter();}};filter();$('inspector').scrollTop=pos;
}
W.LunaOutsideDetails={install};
})(window);
