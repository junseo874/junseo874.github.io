/* The order belongs to its original order row, never to a craft/serve row.
   Trace actual incoming paths, stopping at the previous completed service.
   When paths disagree, the author chooses the source explicitly. */
(function(W){
'use strict';
const esc=W.LunaBarCanvas.esc,plain=s=>W.LunaBarFlow.clean(s).replace(/<[^>]+>/g,'');
function orderContext(m,scene,g,n){
 const all=m.rows(scene).filter(r=>r.type==='order'),direct=n.rows.find(r=>r.type==='order');
 if(direct)return {all,preferred:direct,mode:'이 노드의 주문'};
 const service=n.rows.find(r=>r.type==='craft'||r.type==='serve'),nodes=new Map(g.nodes.map(x=>[x.id,x]));
 if(service){
  const incoming=new Map();for(const e of g.edges)if(e.to){if(!incoming.has(e.to))incoming.set(e.to,new Set());incoming.get(e.to).add(e.from);}
  const todo=[...(incoming.get(n.id)||[])],visited=new Set(),found=new Set();let unknown=!todo.length;
  while(todo.length){const id=todo.pop();if(visited.has(id))continue;visited.add(id);const at=nodes.get(id);if(!at){unknown=true;continue;}
   const boundary=at.rows.slice().reverse().find(r=>['order','serve','end_part'].includes(r.type));
   if(boundary){if(boundary.type==='order'&&(!service.actor||boundary.actor===service.actor))found.add(boundary);else unknown=true;continue;}
   const prev=incoming.get(id);if(prev?.size)todo.push(...prev);else unknown=true;
  }return {all,preferred:!unknown&&found.size===1?[...found][0]:null,mode:'제조·제공의 원래 주문',ambiguous:unknown||found.size!==1};
 }
 const next=g.edges.filter(e=>e.from===n.id),ids=new Set(next.map(e=>e.to)),near=next.length&&ids.size===1&&nodes.get(next[0].to)?.rows[0];
 return {all,preferred:near?.type==='order'?near:null,mode:near?.type==='order'?'바로 다음 주문':'장면의 주문'};
}
function orders(m,sc,context,requested,actorName){
 const {all,preferred,mode,ambiguous}=context;if(!all.length)return {html:'',row:null};
 const row=mode==='이 노드의 주문'?preferred:requested===''?null:all.find(r=>r.row_id===requested)||preferred,drinks=m.projected.data.tables.cocktails,free='자유 주문';
 const name=v=>v==='free'?free:drinks.find(c=>'exact:'+c.id===v)?.['name.ko']||v;
 const opt=(id,text,selected)=>'<option value="'+esc(id)+'"'+(selected?' selected':'')+'>'+esc(text)+'</option>';
 const source=all.map(r=>opt(r.row_id,r.seq+'번 · '+actorName(r.actor)+' · '+name(r.arg)+(plain(r.when)?' (조건부)':''),r===row)).join('');
 const choices=row?drinks.filter(c=>Number(c.unlock_day||0)<=Number(sc.day)||'exact:'+c.id===row.arg):[];
 const locked=row?drinks.filter(c=>!choices.includes(c)):[],later=locked.length?'<optgroup label="아직 해금되지 않은 술" disabled>'+locked.map(c=>opt('exact:'+c.id,(c['name.ko']||c.id)+' · '+c.unlock_day+'일차',false)).join('')+'</optgroup>':'';
 const value=row?opt('free',free,row.arg==='free')+choices.map(c=>opt('exact:'+c.id,c['name.ko']||c.id,'exact:'+c.id===row.arg)).join('')+(!['free',...choices.map(c=>'exact:'+c.id)].includes(row.arg)?opt(row.arg,row.arg,true):'')+later:opt('','주문 줄을 먼저 선택',true);
 const direct=mode==='이 노드의 주문',data=(direct?'<div class="dp-static"><span>주문한 손님</span><strong>'+esc(actorName(row.actor)+' · '+row.seq+'번 줄')+'</strong></div>':'<label>원본 주문 줄<select id="graph-order-source">'+opt('','수정할 주문 선택',!row)+source+'</select></label>')+
 '<label class="dp-drink">주문한 술<select id="graph-order" data-order-row="'+esc(row?.row_id||'')+'" '+(!row?'disabled':'')+'>'+value+'</select></label>'+
 (!row&&ambiguous?'<p class="dp-help">분기에 따라 주문이 달라질 수 있어요. 수정할 원본 주문을 먼저 고르세요.</p>':row?'<p class="dp-help">'+(direct?'':esc(row.seq)+'번 주문에 반영됩니다. ')+'대사 문구는 바뀌지 않습니다.</p>':'');
 return {row,html:W.LunaFlowAuthorUI.group('order','주문 · '+mode,data)};
}
const groups={affinity:['affinity','호감도'],order:['order','주문'],links:['links','분기·연결'],guard:['links','분기·연결'],branch:['links','분기·연결'],options:['choice','선택지'],content:['text','대사·진행'],append:['setup','구성'],layout:['setup','구성']};
const filters=new WeakMap();
function decorate(panel,owner){
 const sections=[...panel.children].filter(el=>el.hasAttribute('data-fold'));
 for(const s of sections){const key=s.dataset.fold;s.dataset.detailGroup=key.startsWith('choice:')?'choice':groups[key]?.[0]||'setup';}
 const nav=panel.querySelector('.dp-filters'),search=panel.querySelector('.dp-search'),empty=panel.querySelector('.dp-empty');if(!nav||!search)return;
 const prior=filters.get(panel),state=prior?.owner===owner?prior:{owner,id:'all',query:''};filters.set(panel,state);search.value=state.query;
 const labels=s=>[s.querySelector('summary')?.textContent,s.dataset.fold==='order'?'칵테일 주문 음료':'',...Array.from(s.querySelectorAll('label,summary,h3'),l=>Array.from(l.childNodes).filter(t=>t.nodeType===3).map(t=>t.textContent).join(' '))].join(' ').toLowerCase();
 const index=new Map(sections.map(s=>[s,labels(s)]));
 function refresh(){let count=0;for(const s of sections){s.hidden=(state.id!=='all'&&state.id!==s.dataset.detailGroup)||!index.get(s).includes(state.query.trim().toLowerCase());if(!s.hidden)count++;}
  for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.category===state.id));empty.hidden=!!count;}
 search.oninput=()=>{state.query=search.value;refresh();};search.onkeydown=e=>{if(e.key==='Escape'&&search.value){e.preventDefault();e.stopPropagation();search.value=state.query='';refresh();}};
 const pills=[['all','전체'],...new Map(Object.values(groups).filter(([k])=>sections.some(s=>s.dataset.detailGroup===k))).entries()];
 for(const [id,label] of pills){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.category=id;b.onclick=()=>{state.id=id;refresh();};nav.append(b);}if(!pills.some(([k])=>k===state.id))state.id='all';refresh();
}
W.LunaFlowDetails={orderContext,orders,decorate};
})(window);
