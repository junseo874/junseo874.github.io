/* Per-NPC terrain: entry points, shared lines, choice pins and locked gameplay cues. */
(function(W){
'use strict';
const map=W.LunaOutsideFlowMap,$=id=>document.getElementById(id),safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const WIDTH=226,GAP=64,storageKey='luna.outside.flow-layout.v1';
function create(api){
 const viewport=$('street-graph'),cards=$('graph-cards'),sheet=$('graph-sheet'),wires=$('graph-wires'),tip=$('chart-tip');
 const undoMoves=[],redoMoves=[],menu=document.createElement('div');menu.className='street-card-menu';menu.hidden=true;menu.setAttribute('role','menu');document.body.append(menu);let context=null;
 let group='',scene=null,zoom=1,offsets={},positions={},pending=null,drag=null,suppress=false,extent={w:1,h:1},frame=0;
 try{offsets=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}
 const remember=()=>{try{localStorage.setItem(storageKey,JSON.stringify(offsets));}catch{}};
 const note=text=>tip.textContent=text;
 function applyScale(){sheet.style.transform='scale('+zoom+')';$('graph-area').style.width=Math.ceil(extent.w*zoom)+'px';$('graph-area').style.height=Math.ceil(extent.h*zoom)+'px';const z=$('chart-zoom'),label=Math.round(zoom*100)+'%';const custom=z.querySelector('[data-current]');if(custom&&custom.value!==label)custom.remove();if(![...z.options].some(o=>o.value===label)){const o=new Option(label,label);o.dataset.current='';z.add(o);}z.value=label;}
 function scale(next,x=viewport.clientWidth/2,y=viewport.clientHeight/2){const ox=(viewport.scrollLeft+x)/zoom,oy=(viewport.scrollTop+y)/zoom;zoom=Math.max(.25,Math.min(1.65,next));applyScale();viewport.scrollTo(ox*zoom-x,oy*zoom-y);}
 function persistLayout(){offsets[group]??={};if(drag?.node){const id=drag.node;undoMoves.push({group,id,before:offsets[group][id]?{...offsets[group][id]}:null,after:{...positions[id]}});if(undoMoves.length>60)undoMoves.shift();redoMoves.length=0;offsets[group][id]={...positions[id]};}remember();}
 function layout(){
  if(!scene)return;const layers=new Map(),seen=new Set(),open=new Set(),incoming=new Map();
  for(const e of scene.edges){if(!incoming.has(e.to))incoming.set(e.to,[]);incoming.get(e.to).push(e.from);}
  const rank=id=>{if(seen.has(id))return layers.get(id);if(open.has(id))return -1;open.add(id);const v=Math.max(0,...(incoming.get(id)||[]).map(k=>rank(k)+1));open.delete(id);seen.add(id);layers.set(id,v);return v;};
  const heights=new Map();extent={w:1,h:1};positions={};
  for(const card of cards.children){const id=card.dataset.node,col=rank(id),y=heights.get(col)||20;heights.set(col,y+card.offsetHeight+28);const p=offsets[group]?.[id],pos=p&&isFinite(p.x)&&isFinite(p.y)?{x:Math.max(8,p.x),y:Math.max(8,p.y)}:{x:18+col*(WIDTH+GAP),y};positions[id]=pos;card.style.left=pos.x+'px';card.style.top=pos.y+'px';}
  drawWires();
 }
 function drawWires(){const els=new Map([...cards.children].map(c=>[c.dataset.node,c]));extent={w:1,h:1};for(const [id,c] of els){const p=positions[id];if(p){extent.w=Math.max(extent.w,p.x+WIDTH+28);extent.h=Math.max(extent.h,p.y+c.offsetHeight+26);}}
  sheet.style.width=extent.w+'px';sheet.style.height=extent.h+'px';wires.setAttribute('width',extent.w);wires.setAttribute('height',extent.h);
  wires.innerHTML=scene.edges.map(e=>{const a=els.get(e.from),b=els.get(e.to),pa=positions[e.from],pb=positions[e.to];if(!a||!b||!pa||!pb)return '';const pin=e.port>=0?a.querySelector('[data-port="'+e.port+'"]'):null;const x=pa.x+WIDTH,y=pa.y+(pin?pin.offsetTop+pin.offsetHeight/2:a.offsetHeight/2),tx=pb.x,ty=pb.y+Math.min(b.offsetHeight/2,36),c=Math.max(28,Math.abs(tx-x)*.42);return '<path class="'+(pin?'is-branch':'')+'" d="M'+x+','+y+' C'+(x+c)+','+y+' '+(tx-c)+','+ty+' '+tx+','+ty+'"/>';}).join('');applyScale();
 }
 function nodeFor(id){return scene?.nodes.find(n=>n.id===id);}
 function button(name,body,title){return '<button type="button" data-act="'+name+'" title="'+safe(title)+'" aria-label="'+safe(title)+'">'+body+'</button>';}
 function render(){
  const m=api.model(),f=m.flow(api.flow()),site=map.site(m,f),changed=group!==site.id;group=site.id;if(changed){menu.hidden=true;pending=null;viewport.scrollTo(0,0);}
  scene=map.graph(m,group);const selected=scene.byRow.get(api.selected());
  $('site-title').textContent=site.name+' · '+f.title;$('site-tag').textContent=site.place+' | ';$('chart-count').textContent=scene.flows.length+'개 흐름 · '+scene.nodes.length+'개 노드 · '+scene.edges.length+'개 연결';
  if(changed)$('chart-search').value='';indexJumps();
  cards.innerHTML=scene.nodes.map(n=>{const s=m.step(n.rows[0]),actors=[...new Set(n.rows.map(r=>m.step(r).actor).filter(Boolean))],first=scene.first.get(n.flow)===n.id,isTarget=pending&&first;
   return '<article class="street-card '+n.kind+(selected===n?' selected':'')+(isTarget?' link-target':'')+'" data-node="'+safe(n.id)+'" aria-label="'+safe(n.title)+'"><div class="node-head" data-handle><span>'+({talk:'“',choice:'⑂',cue:'◇',join:'↳'}[n.kind])+'　'+map.kinds[n.kind]+'</span><small>'+safe(n.title)+'</small></div><button class="node-text" data-act="edit"><span class="cast-frame"><canvas class="node-cast" width="176" height="78" aria-hidden="true"></canvas></span><b>'+safe(actors.map(W.LunaOutsideEditorPreview.label).join(' · ')||'사건 신호')+'</b><span>'+safe(s['text.ko']||s.action||s.cinema||(n.kind==='choice'?'선택을 기다림':'연출 연결'))+'</span></button><div class="node-foot"><small>'+n.rows.length+'줄</small>'+button('preview','▷','이 지점부터 미리보기')+button('script','≡','이 노드의 대사 목록 보기')+'</div>'+
   n.ports.map(({c,dest,to},i)=>'<button class="street-port" data-port="'+i+'" title="'+safe(c.label+' → '+(dest.flow?m.flow(dest.flow)?.title:dest.label||'다음 대사'))+'"><span>'+safe(c.label)+'</span><i aria-hidden="true">◉</i></button>').join('')+
   (isTarget?button('target','여기에 연결','선택한 분기를 이 흐름에 연결'):'')+'</article>';}).join('');
  for(const card of cards.children){const n=nodeFor(card.dataset.node),ids=[...new Set(n.rows.map(r=>m.step(r).actor).filter(Boolean))];api.portrait(card.querySelector('canvas'),ids);}
  layout();cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(viewport.clientWidth)layout();});
 }
 function select(n){api.select(n.flow,n.rows[0].row_id);}
 function indexJumps(){const q=$('chart-search').value.trim().toLocaleLowerCase(),select=$('chart-jump'),found=scene.nodes.filter(n=>!q||[n.title,map.kinds[n.kind],...n.rows.map(r=>{const s=api.model().step(r);return (s['text.ko']||'')+' '+W.LunaOutsideEditorPreview.label(s.actor);})].join(' ').toLocaleLowerCase().includes(q));
  select.replaceChildren(new Option(q?found.length+'개 검색 결과':'노드 바로가기…',''),...found.map(n=>new Option(n.title+' · '+map.kinds[n.kind]+' · '+(api.model().step(n.rows[0])['text.ko']||n.rows.length+'줄').slice(0,40),n.id)));return found;}
 function locate(n){if(!n)return;const el=[...cards.children].find(c=>c.dataset.node===n.id),p=positions[n.id];if(el&&p)viewport.scrollTo({left:Math.max(0,(p.x+WIDTH/2)*zoom-viewport.clientWidth/2),top:Math.max(0,(p.y+el.offsetHeight/2)*zoom-viewport.clientHeight/2),behavior:'smooth'});}
 const focusSelected=()=>locate(scene?.byRow.get(api.selected()));$('chart-locate').onclick=focusSelected;$('chart-search').oninput=indexJumps;
 $('chart-search').onkeydown=e=>{if(e.key==='Enter'){const n=indexJumps()[0];if(n){select(n);locate(n);}}};$('chart-jump').onchange=e=>{const n=nodeFor(e.target.value);if(n){select(n);locate(n);}};$('chart-zoom').onchange=e=>scale(parseFloat(e.target.value)/100);
 viewport.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();focusSelected();}});
 function chooseTarget(n){const src=pending;if(!src)return;pending=null;const m=api.model(),r=m.row(src.rowId);if(!r||!m.menuEditable(r))return;const sameNative=m.menuOutcomes(r).find(c=>map.destination(m,r,c).flow===n.flow);
  if(n.flow===src.flow&&!sameNative){note('자기 흐름으로 되돌아가는 연결은 만들 수 없어요.');render();return;}
  api.connect(r,src.index,r.row_id===m.projected.data.newspaperRoutes.parent?'flow:'+n.flow:sameNative?.route||'flow:'+n.flow);render();
 }
 function arm(n,index){const m=api.model(),c=n.ports[index];if(!c)return;select(n);api.focusOption(index);
  if(!m.menuEditable(n.rows[0])){note('이 선택은 본편의 사건 처리기가 관리합니다.');return;}
  pending={rowId:n.rows[0].row_id,flow:n.flow,index};render();note('연결할 흐름의 첫 노드를 누르세요. Esc로 취소 · 선택 조건은 오른쪽에서 편집');}
 cards.addEventListener('click',e=>{if(suppress){suppress=false;return;}const card=e.target.closest('[data-node]'),n=card&&nodeFor(card.dataset.node);if(!n)return;const pin=e.target.closest('[data-port]'),act=e.target.closest('[data-act]')?.dataset.act;
  if(pin)return arm(n,+pin.dataset.port);if(pending&&card.classList.contains('link-target'))return chooseTarget(n);
  pending=null;select(n);if(act==='preview')api.preview();if(act==='script')api.script();});
 viewport.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1)return;const card=e.target.closest('[data-node]'),pin=e.target.closest('[data-port]');if(card&&!e.target.closest('[data-handle]')&&!pin)return;
  drag={x:e.clientX,y:e.clientY,sx:viewport.scrollLeft,sy:viewport.scrollTop,node:pin?null:card?.dataset.node,pin:pin?{n:nodeFor(card.dataset.node),index:+pin.dataset.port}:null,moved:false};if(drag.node)drag.origin={...positions[drag.node]};if(!pin&&!card||e.button===1)e.preventDefault();});
 viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;if(!drag.moved){drag.moved=true;viewport.setPointerCapture(e.pointerId);}
  if(drag.pin){note('입력할 흐름의 첫 노드 위에서 놓으세요.');return;}
  if(drag.node){const p=positions[drag.node]={x:Math.max(8,drag.origin.x+dx/zoom),y:Math.max(8,drag.origin.y+dy/zoom)},card=[...cards.children].find(c=>c.dataset.node===drag.node);card.style.left=p.x+'px';card.style.top=p.y+'px';drawWires();}else viewport.scrollTo(drag.sx-dx,drag.sy-dy);});
 W.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;if(d.moved){suppress=true;setTimeout(()=>{suppress=false;},0);if(d.node){persistLayout();viewport.focus({preventScroll:true});}if(d.pin){const card=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-node]'),n=card&&nodeFor(card.dataset.node);arm(d.pin.n,d.pin.index);if(n&&scene.first.get(n.flow)===n.id)chooseTarget(n);}}drag=null;});
 W.addEventListener('pointercancel',()=>{drag=null;});W.addEventListener('keydown',e=>{if(e.key==='Escape'&&pending){pending=null;render();note('연결 지정을 취소했어요.');}});
 viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const b=viewport.getBoundingClientRect();scale(zoom*Math.exp(-Math.max(-80,Math.min(80,e.deltaY))*.002),e.clientX-b.left,e.clientY-b.top);}},{passive:false});
 $('chart-minus').onclick=()=>scale(zoom/1.12);$('chart-plus').onclick=()=>scale(zoom*1.12);$('chart-fit').onclick=()=>{scale(Math.min(1,(viewport.clientWidth-8)/extent.w,(viewport.clientHeight-8)/extent.h),0,0);viewport.scrollTo(0,0);};
 function restoreMove(entry,which){const point=entry[which];offsets[entry.group]??={};if(point)offsets[entry.group][entry.id]={...point};else delete offsets[entry.group][entry.id];remember();layout();}
 viewport.addEventListener('keydown',e=>{if(!e.ctrlKey&&!e.metaKey)return;const undo=e.key.toLowerCase()==='z'&&!e.shiftKey,redo=e.key.toLowerCase()==='y'||e.key.toLowerCase()==='z'&&e.shiftKey,stack=undo?undoMoves:redoMoves;if((undo||redo)&&stack.at(-1)?.group===group){e.preventDefault();e.stopPropagation();const item=stack.pop();(undo?redoMoves:undoMoves).push(item);restoreMove(item,undo?'before':'after');}});
 cards.addEventListener('contextmenu',e=>{const card=e.target.closest('[data-node]'),n=card&&nodeFor(card.dataset.node);if(!n)return;e.preventDefault();pending=null;select(n);context=n;const pin=e.target.closest('[data-port]');menu.innerHTML=(pin?'<button data-command="pin" data-index="'+pin.dataset.port+'">◉ 이 선택의 문구 · 조건 편집</button>':'')+'<button data-command="preview">▷ 여기서 재생</button><button data-command="script">≡ 대사 편집기로 열기</button><button data-command="add" '+($('add').disabled?'disabled':'')+'>＋ 대사 추가</button><button data-command="add-menu" '+($('add-menu').disabled?'disabled':'')+'>⑂ 선택지 추가</button><button data-command="reset" '+(offsets[group]?.[n.id]?'':'disabled')+'>↺ 이 카드 위치 복원</button>';menu.hidden=false;menu.style.left=Math.min(e.clientX,innerWidth-menu.offsetWidth-6)+'px';menu.style.top=Math.min(e.clientY,innerHeight-menu.offsetHeight-6)+'px';menu.querySelector('button')?.focus();});
 menu.onclick=e=>{const b=e.target.closest('button'),key=b?.dataset.command;if(!key||!context)return;menu.hidden=true;if(key==='preview')api.preview();else if(key==='script')api.script();else if(key==='pin')api.focusOption(+b.dataset.index);else if(key==='reset'){const id=context.id,item={group,id,before:{...offsets[group][id]},after:null};undoMoves.push(item);redoMoves.length=0;restoreMove(item,'after');}else $(key)?.click();};
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.hidden=true;});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;viewport.focus();}});
 new ResizeObserver(()=>{if(scene&&viewport.clientWidth)layout();}).observe(viewport);
 return{render,site:()=>map.site(api.model(),api.model().flow(api.flow())),clear(){pending=null;},selectedNode:()=>scene?.byRow.get(api.selected())};
}
W.LunaOutsideChart={create};
})(window);
