/* Pointer and keyboard interaction is isolated from CSV mutation. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),L=W.LunaBarLayout,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={play:'M7 4l13 8-13 8z',edit:'M4 16l-1 5 5-1L20 8l-4-4z M13 7l4 4',trash:'M3 6h18 M9 6V3h6v3 M6 6l1 14h10l1-14 M10 10v6 M14 10v6',plus:'M12 4v16 M4 12h16',link:'M10 14l4-4 M8 16l-1 1a4 4 0 01-6-6l4-4a4 4 0 016 0 M16 8l1-1a4 4 0 116 6l-4 4a4 4 0 01-6 0',unlink:'M9 15l-2 2a3.6 3.6 0 01-5-5l3-3 M15 9l2-2a3.6 3.6 0 015 5l-3 3 M8 3l2 4 M3 8l4 2 M17 17l4 2 M16 20l2 2',arrow:'M4 12h15 M13 5l7 7-7 7'};
const icon=k=>'<svg class="studio-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[k]+'"/></svg>';
function create(api){
 const view=$('map-port'),world=$('map-world'),box=$('map-size'),hint=$('wire-hint');
 let items=[],edges=[],reserved=[],byId,positions,prefs,active='',wire=null,drag=null,pointer=null,raf=0,noClick=0;
 let zoomFrame=0,zoomGoal=0,zoomAnchor=null;const zoom=()=>prefs.s.zoom,card=id=>world.querySelector('[data-node="'+CSS.escape(id)+'"]');
 const rightAt=id=>(prefs.s.portsAt?.[id]||prefs.s.direction)==='right';
 let selection=new Set(),rect;
 function highlight(){for(const el of world.querySelectorAll('.flow-card'))el.classList.toggle('multi-selected',selection.has(el.dataset.node));}
 const homeHint='빈 곳 드래그: 여러 노드 선택　·　가운데 버튼 드래그: 화면 이동　·　카드 끌기: 배치';
 function tell(s){hint.textContent=s||homeHint;}
 function point(x,y){const r=view.getBoundingClientRect();return {x:(x-r.left-view.clientLeft+view.scrollLeft)/zoom(),y:(y-r.top-view.clientTop+view.scrollTop)/zoom()};}
 function size(){
  const all=[...positions.values()],w=Math.max(view.clientWidth/zoom(),...all.map(p=>p.x+L.width+100)),h=Math.max(view.clientHeight/zoom(),...all.map(p=>p.y+p.h+100));
  world.style.width=w+'px';world.style.height=h+'px';world.style.transform='scale('+zoom()+')';box.style.width=Math.ceil(w*zoom())+'px';box.style.height=Math.ceil(h*zoom())+'px';
 }
 function endpoint(id,i){const obj=byId.get(id);return L.pin(positions.get(id),i,obj.ports.length,rightAt(id));}
 function paintLines(){
  const svg=world.querySelector('.wires');if(!svg)return;
  svg.innerHTML=edges.filter(e=>byId.has(e.from)&&byId.has(e.to)).map(e=>{
   const n=byId.get(e.from),i=Math.max(0,n.ports.findIndex(p=>p.key===e.pinKey)),p=L.curve(endpoint(e.from,i),endpoint(e.to,-1),rightAt(e.from),rightAt(e.to));
   const hit='<path class="wire-hit" data-line-from="'+esc(e.from)+'" data-line-pin="'+esc(e.pinKey)+'" role="button" tabindex="0" aria-label="'+esc(n.ports[i]?.label||'다음 흐름')+' 연결 편집" d="'+p+'"/>';
   return hit+'<path data-from="'+esc(e.from)+'" data-pin="'+esc(e.pinKey)+'" data-to="'+esc(e.to)+'" class="'+(e.branch?'branch ':'')+(e.from===active||e.to===active?'focus':'')+'" d="'+p+'"/>';
  }).join('')+'<path class="wire-ghost"/>';
  if(wire)ghost();
 }
 function moveLines(ids){
  for(const path of world.querySelectorAll('.wires path[data-from]')){
   const {from,to,pin}=path.dataset;if(!ids.has(from)&&!ids.has(to))continue;
   const i=byId.get(from).ports.findIndex(p=>p.key===pin),d=L.curve(endpoint(from,Math.max(i,0)),endpoint(to,-1),rightAt(from),rightAt(to));
   path.setAttribute('d',d);path.previousElementSibling.setAttribute('d',d);
  }
 }
 function ghost(){
  if(!wire)return;const el=world.querySelector('.wire-ghost'),start=endpoint(wire.id,wire.i),hit=socketAt()?.closest('[data-node]')?.dataset.node;
  const end=hit?endpoint(hit,-1):pointer?point(pointer.x,pointer.y):{x:start.x+(rightAt(wire.id)?60:0),y:start.y+(rightAt(wire.id)?0:60)};
  el.setAttribute('d',L.curve(start,end,rightAt(wire.id),hit?rightAt(hit):rightAt(wire.id)));el.classList.toggle('bad',!!hit&&!!api.reason(wire.id,wire.p,hit));
 }
 function socketAt(){return pointer&&document.elementFromPoint(pointer.x,pointer.y)?.closest('.socket-in');}
 function mark(id){
  world.querySelectorAll('.pin-selected').forEach(e=>e.classList.remove('pin-selected'));active=id;for(const el of world.querySelectorAll('[data-node]')){const on=el.dataset.node===id;el.classList.toggle('active',on);if(on)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');}
  for(const line of world.querySelectorAll('.wires [data-from]'))line.classList.toggle('focus',line.dataset.from===id||line.dataset.to===id);
 }
 function locate(id=active){const p=positions?.get(id);if(p)view.scrollTo(Math.max(0,(p.x+L.width/2)*zoom()-view.clientWidth/2),Math.max(0,(p.y+p.h/2)*zoom()-view.clientHeight/2));}
 function zoomLabel(){const sel=$('map-scale'),value=Math.round(zoom()*100)+'%',live=sel.querySelector('[data-live]');if(live)live.remove();if(![...sel.options].some(o=>o.value===value)){const o=new Option(value,value);o.dataset.live='';sel.add(o);}sel.value=value;}
 function setZoom(next,event){
  next=Math.min(3,Math.max(.25,next));
  const r=view.getBoundingClientRect(),x=event?.clientX??r.left+r.width/2,y=event?.clientY??r.top+r.height/2,anchor=point(x,y);
  zoomGoal=next;zoomAnchor={anchor,x:x-r.left,y:y-r.top};if(zoomFrame)return;
  let then=performance.now();function tick(now){const dt=Math.max(1,Math.min(42,now-then));then=now;const final=Math.abs(zoomGoal-zoom())<.001,ratio=final?zoomGoal:zoom()+(zoomGoal-zoom())*(1-Math.exp(-dt/62));prefs.s.zoom=ratio;size();view.scrollTo(zoomAnchor.anchor.x*ratio-zoomAnchor.x,zoomAnchor.anchor.y*ratio-zoomAnchor.y);zoomLabel();if(wire)ghost();if(final){zoomFrame=0;prefs.save();}else zoomFrame=requestAnimationFrame(tick);}zoomFrame=requestAnimationFrame(tick);
 }
 function endWire(msg){wire=null;view.classList.remove('connecting');$('wire-cancel').hidden=true;world.querySelectorAll('.link-ok,.link-bad,.pin-live').forEach(e=>e.classList.remove('link-ok','link-bad','pin-live'));world.querySelector('.wire-ghost')?.removeAttribute('d');tell(msg);}
 function startWire(id,i){
  const p=byId.get(id)?.ports[i];if(!p)return;if(!p.editable){tell(p.note||'이 선은 CSV 순서로 이어지는 기본 경로입니다. 조건 출력을 추가해 주세요.');return;}
  endWire();wire={id,i,p};api.select(id,false);view.classList.add('connecting');$('wire-cancel').hidden=false;
  card(id).querySelectorAll('.socket-out')[i].classList.add('pin-live');
  for(const obj of items)card(obj.id)?.classList.add(api.reason(id,p,obj.id)?'link-bad':'link-ok');
  tell('「'+p.label+'」 → 강조된 입력 핀에 놓거나 클릭하세요. Esc로 취소');ghost();
 }
 function finishWire(id){
  if(!wire)return;const {id:src,p}=wire,reason=api.reason(src,p,id);
  if(reason){tell(reason+'　·　Esc로 취소');return;}
  endWire();api.connect(src,p,id);
 }
 function html(n){
  const pos=positions.get(n.id),coordinates=(idx)=>{const a=L.pin({x:0,y:0,h:pos.h},idx,n.ports.length,rightAt(n.id));return 'left:'+(a.x-1)+'px;top:'+(a.y-4)+'px';};
  return '<article tabindex="0" class="flow-card tone-'+n.tone+'" data-node="'+esc(n.id)+'" aria-label="'+esc(n.title)+'" style="left:'+pos.x+'px;top:'+pos.y+'px;height:'+pos.h+'px">'+
   '<div class="card-head"><span class="kind-sign">'+esc(n.symbol)+'</span><b>'+esc(n.type)+'</b><small>'+esc(n.number)+(n.lines!=null?' · 대사 '+n.lines:'')+'</small><span class="grip" aria-hidden="true">⠿</span></div>'+
   '<div class="flow-cast">'+(n.images||'<i aria-hidden="true">'+esc(n.symbol)+'</i>')+'<span>'+esc(n.cast)+'</span><b class="flow-flag-marks"></b></div>'+
   '<p class="excerpt" title="'+esc(n.excerpt)+'">'+esc(n.excerpt)+'</p><div class="card-tools">'+(n.portal||n.jump?'<button data-card-action="goto">장면 열기 ↗</button>':'<button data-card-action="play" aria-label="노드 미리보기" title="노드 미리보기">'+icon('play')+'</button><button data-card-action="edit" aria-label="대사 편집" title="대사 편집">'+icon('edit')+'</button>')+'</div>'+
   '<button type="button" class="socket socket-in" style="'+coordinates(-1)+'" title="이 노드로 연결" aria-label="'+esc(n.title)+' 입력 핀"></button>'+
   n.ports.map((p,i)=>(p.draft?'<button type="button" class="pin-trash" data-pin-trash="'+i+'" style="top:'+(L.base+i*L.step)+'px" aria-label="미연결 핀 삭제" title="미연결 핀 삭제">'+icon('trash')+'</button>':'')+'<button type="button" class="port-label'+(p.draft?' with-trash':'')+'" data-pin-label="'+i+'" title="클릭: 핀 편집 · 우클릭: 핀 작업" style="top:'+(L.base+i*L.step)+'px"><b class="port-marks"></b><span>'+esc(rightAt(n.id)?'':(i+1)+'. ') +esc(p.label)+'</span>'+(p.affinityLabel?'<strong class="port-affinity"'+(p.award?' title="클릭: 이 분기의 호감도 수정"':'')+'>'+esc(p.affinityLabel)+'</strong>':'')+'</button><button type="button" class="socket socket-out '+(p.editable?'editable ':'')+(p.draft?'draft':'')+'" data-port="'+i+'" style="'+coordinates(i)+'" title="'+esc(p.label+(p.editable?' · 클릭: 조건 편집 / 끌기: 연결':' · 기본 흐름'))+'" aria-label="'+esc(p.label)+' 출력 핀">'+(rightAt(n.id)?'':i+1)+'</button>').join('')+(n.portal||n.jump||n.terminal||n.fixedPorts?'':'<button class="card-add" data-card-action="'+(n.type==='선택지'?'option':'pin')+'" '+(n.type==='선택지'&&n.ports.length>=4?'disabled':'')+'>'+(icon('plus')+(n.type==='선택지'?' 선택지':' 분기 핀'))+'</button>')+'</article>';
 }
 function arranged(){
  const direction=prefs.s.direction,hidden=Object.fromEntries(reserved.map(n=>[n.id,prefs.s.positions[direction]?.[n.id]]));
  const layout=L.place(items,edges,{direction,positions:{[direction]:hidden}},reserved);
  return [...layout].map(([id,{x,y}])=>[id,{x,y}]);
 }
 function restorePositions(){
  positions=L.place(items,edges,prefs.s,reserved);
  const saved=prefs.s.positions[prefs.s.direction]??={};let changed=false;
  for(const [id,{x,y}] of positions)if(saved[id]?.x!==x||saved[id]?.y!==y){saved[id]={x,y};changed=true;}
  if(changed)prefs.save();
 }
 function draw(data,p,resetView){
  if(drag)finish(null,true);cancelAnimationFrame(zoomFrame);zoomFrame=0;endWire();items=data.items;edges=data.edges;reserved=data.reserved;prefs=p;byId=new Map(items.map(n=>[n.id,n]));restorePositions();
  world.dataset.direction=prefs.s.direction;world.innerHTML='<svg class="wires" aria-label="노드 연결선"></svg>'+items.map(html).join('');
  selection=new Set([...selection].filter(id=>byId.has(id)));highlight();
  for(const c of world.querySelectorAll('[data-node]')){const n=byId.get(c.dataset.node);W.LunaFlagPicker.markers(c.querySelector('.flow-flag-marks'),n.flagExpr);c.querySelectorAll('.port-marks').forEach((slot,i)=>W.LunaFlagPicker.markers(slot,n.ports[i].flagExpr));}
  size();paintLines();zoomLabel();$('map-direction').value=prefs.s.direction;if(resetView)view.scrollTo(0,0);
 }
 function positionCard(el,p){el.style.left=p.x+'px';el.style.top=p.y+'px';}
 function refreshPositions(){
  restorePositions();
  for(const el of world.querySelectorAll('[data-node]'))positionCard(el,positions.get(el.dataset.node));
  size();paintLines();
 }
 function shift(id,x,y){
  const pos=positions.get(id);pos.x=L.coordinate(x);pos.y=L.coordinate(y);positionCard(card(id),pos);size();paintLines();
 }
 function commitMove(id,origin,x,y){
  const next={x:Math.round(L.coordinate(x)),y:Math.round(L.coordinate(y))};
  if(next.x===origin.x&&next.y===origin.y){shift(id,origin.x,origin.y);return;}
  api.move(id,next);
 }
 function moveAction(){
  if(!pointer||!drag)return;const {x,y}=pointer;
  if(!drag.moved&&Math.hypot(x-drag.x,y-drag.y)<4)return;drag.moved=true;
  if(drag.kind==='pan'){view.scrollTo(drag.left+drag.x-x,drag.top+drag.y-y);return;}
  const pt=point(x,y);
  if(drag.kind==='box'){const x1=Math.min(pt.x,drag.start.x),y1=Math.min(pt.y,drag.start.y),x2=Math.max(pt.x,drag.start.x),y2=Math.max(pt.y,drag.start.y);
   Object.assign(rect.style,{left:x1+'px',top:y1+'px',width:x2-x1+'px',height:y2-y1+'px'});selection=new Set([...positions].filter(([id,p])=>p.x<=x2&&p.x+L.width>=x1&&p.y<=y2&&p.y+p.h>=y1).map(([id])=>id));highlight();}
  if(drag.kind==='node'){const origins=drag.origins,dx=Math.max(pt.x-drag.start.x,24-Math.min(...origins.map(v=>v[1].x))),dy=Math.max(pt.y-drag.start.y,24-Math.min(...origins.map(v=>v[1].y)));
   for(const [id,o] of origins){const p=positions.get(id);p.x=o.x+dx;p.y=o.y+dy;positionCard(card(id),p);}size();moveLines(selection);}
  if(drag.kind==='wire'){if(!wire)startWire(drag.id,drag.port);if(wire)ghost();}
 }
 function scrollEdge(){
  raf=0;if(!drag?.moved||drag.kind==='pan'||!pointer)return;
  const r=view.getBoundingClientRect(),speed=(v,min,max)=>v<min+38?-Math.min(22,(min+38-v)*.5):v>max-38?Math.min(22,(v-max+38)*.5):0;
  const dx=speed(pointer.x,r.left,r.right),dy=speed(pointer.y,r.top,r.bottom);
  if(dx||dy){view.scrollBy(dx,dy);raf=requestAnimationFrame(()=>{moveAction();scrollEdge();});}
 }
 view.addEventListener('pointerdown',e=>{
  if(drag||(e.button!==0&&e.button!==1))return;noClick=0;const el=e.target.closest('[data-node]'),pin=e.target.closest('.socket'),id=el?.dataset.node;
  if(pin?.classList.contains('socket-in')||e.button===0&&e.target.closest('[data-line-pin]'))return;
  if(!pin&&e.target.closest('button'))return;
  const pt=point(e.clientX,e.clientY),pos=positions.get(id);pointer={x:e.clientX,y:e.clientY};
  let kind=e.button===1?'pan':!el?'box':pin?'wire':'node';
  if(kind==='wire')endWire();
  if(kind==='node'){if(!selection.has(id))selection=new Set([id]);highlight();el.focus({preventScroll:true});}
  if(kind==='box'){selection.clear();highlight();rect=document.createElement('div');rect.className='flow-selection-box';world.append(rect);}
  const origins=[...selection].filter(k=>positions.has(k)).map(k=>[k,{...positions.get(k)}]);
  drag={kind,id,port:pin?Number(pin.dataset.port):-1,pointerId:e.pointerId,origin:pos&&{...pos},x:e.clientX,y:e.clientY,dx:pos?pt.x-pos.x:0,dy:pos?pt.y-pos.y:0,left:view.scrollLeft,top:view.scrollTop};
  Object.assign(drag,{start:pt,origins});e.preventDefault();view.setPointerCapture(e.pointerId);view.classList.add('dragging');
 });
 view.addEventListener('dragstart',e=>e.preventDefault());
 view.addEventListener('pointermove',e=>{if(drag&&drag.pointerId!==e.pointerId)return;pointer={x:e.clientX,y:e.clientY};if(drag){if(!raf)raf=requestAnimationFrame(()=>{moveAction();scrollEdge();});}else if(wire)ghost();});
 function finish(e,cancel){
  if(!drag||(e&&e.pointerId!==drag.pointerId))return;const d=drag;
  if(e&&!cancel){pointer={x:e.clientX,y:e.clientY};if(d.kind!=='pan')moveAction();}
  drag=null;cancelAnimationFrame(raf);raf=0;view.classList.remove('dragging');
  if(d.kind==='box'){rect?.remove();rect=null;}
  if(d.kind==='node'&&d.moved){if(cancel){for(const [id,o]of d.origins){Object.assign(positions.get(id),o);positionCard(card(id),o);}size();paintLines();}
   else {const moves=d.origins.flatMap(([id,o])=>{const p=positions.get(id),x=Math.round(p.x),y=Math.round(p.y);return x===o.x&&y===o.y?[]:[[id,{x,y}]];});if(moves.length)api.moveGroup(moves);else refreshPositions();}}
  if(d.kind==='node'&&!cancel&&!byId.get(d.id).portal)api.select(d.id,false);
  if(d.kind==='wire'&&d.moved){const input=socketAt(),target=input?.closest('[data-node]')?.dataset.node;if(!cancel&&target)finishWire(target);else endWire('연결하지 않았습니다.');}
  if(d.kind==='wire'&&!d.moved&&!cancel){api.inspect(d.id,byId.get(d.id).ports[d.port].key);noClick=performance.now()+100;}
  if(cancel&&wire)endWire();if(d.moved)noClick=performance.now()+100;
  if(view.hasPointerCapture(d.pointerId))view.releasePointerCapture(d.pointerId);
 }
 function cancelNodeDrag(){if(drag?.kind!=='node')return false;finish(null,true);return true;}
 view.onpointerup=e=>finish(e,false);view.onpointercancel=e=>finish(e,true);
 view.addEventListener('lostpointercapture',e=>{if(e.target===view)finish(e,true);});
 window.addEventListener('blur',()=>{if(drag)finish(null,true);});
 view.onclick=e=>{if(e.detail&&performance.now()<noClick)return;const line=e.target.closest('[data-line-pin]');if(line){api.inspect(line.dataset.lineFrom,line.dataset.linePin);return;}const el=e.target.closest('[data-node]');if(!el)return;const id=el.dataset.node,action=e.target.closest('[data-card-action]')?.dataset.cardAction;
  const bin=e.target.closest('[data-pin-trash]');if(bin){api.dropDraft(id,byId.get(id).ports[Number(bin.dataset.pinTrash)].predicate);return;}
  const pinLabel=e.target.closest('[data-pin-label]');if(pinLabel){const pin=byId.get(id).ports[Number(pinLabel.dataset.pinLabel)];
   if(pin.award&&e.target.closest('.port-affinity'))api.focusAward(id,pin.key);else api.inspect(id,pin.key);return;}
  if(e.target.closest('.socket-in')){if(wire)finishWire(id);else if(!byId.get(id).portal)api.select(id,false);return;}
  const out=e.target.closest('.socket-out');if(out){if(!e.detail)startWire(id,Number(out.dataset.port));return;}
  if(action)api.action(id,action);else if(!byId.get(id).portal)api.select(id,false);
 };
 view.ondblclick=e=>{const el=e.target.closest('[data-node]');if(el&&!e.target.closest('button'))api.action(el.dataset.node,byId.get(el.dataset.node).portal||byId.get(el.dataset.node).jump?'goto':'edit');};
 view.addEventListener('wheel',e=>{if(!prefs||e.shiftKey||(!e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaX)>Math.abs(e.deltaY)))return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?15:e.deltaMode===2?80:1),power=Math.max(-.13,Math.min(.13,-delta*(e.ctrlKey ? .003 : .0013)));setZoom((zoomFrame?zoomGoal:zoom())*Math.exp(power),e);},{passive:false});
 $('zoom-in').onclick=()=>setZoom((zoomFrame?zoomGoal:zoom())*1.1);$('zoom-out').onclick=()=>setZoom((zoomFrame?zoomGoal:zoom())/1.1);
 view.onkeydown=e=>{const line=e.target.closest('[data-line-pin]');if(line&&(e.key==='Enter'||e.key===' ')){e.preventDefault();api.inspect(line.dataset.lineFrom,line.dataset.linePin);return;}const el=e.target.closest('[data-node]'),id=el?.dataset.node;
  const selectedPort=e.target.closest('[data-port],[data-pin-label],[data-pin-trash]');
  if(id&&selectedPort&&e.key==='Delete'&&!e.repeat){const pin=byId.get(id)?.ports[Number(selectedPort.dataset.port??selectedPort.dataset.pinLabel??selectedPort.dataset.pinTrash)];
   if(pin?.draft){e.preventDefault();api.dropDraft(id,pin.predicate);card(id)?.focus({preventScroll:true});return;}}
  if(['Delete','Backspace'].includes(e.key)&&!e.repeat&&!selectedPort&&!line&&!wire&&!drag&&!e.target.closest('button,input,textarea,select,[contenteditable=true]')&&(id||active)){
   e.preventDefault();if(selection.size>1){tell('삭제할 노드 하나를 선택하세요.');return;}api.action(id||active,'delete');return;
  }
  if(['+','=','-','0'].includes(e.key)){e.preventDefault();setZoom(e.key==='0'?1:(zoomFrame?zoomGoal:zoom())*(e.key==='-'?1/1.1:1.1));return;}
  if(e.key==='f'||e.key==='F'){e.preventDefault();locate();return;}
  if(!id||e.target.closest('button'))return;
  if(e.altKey&&e.key.startsWith('Arrow')){e.preventDefault();const p=positions.get(id),dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(dir&&!drag)commitMove(id,p,p.x+dir[0]*16,p.y+dir[1]*16);return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();api.action(id,byId.get(id).portal||byId.get(id).jump?'goto':e.key==='Enter'?'edit':'play');}
 };
 new ResizeObserver(()=>{if(positions)size();}).observe(view);
 $('map-scale').onchange=e=>setZoom(parseInt(e.target.value,10)/100);$('map-locate').onclick=()=>locate();$('wire-cancel').onclick=()=>endWire();
 return {draw,arranged,point,mark,markPin(id,key){const i=byId.get(id)?.ports.findIndex(p=>p.key===key);card(id)?.querySelector('[data-pin-label="'+i+'"]')?.classList.add('pin-selected');world.querySelector('.wires path[data-from="'+CSS.escape(id)+'"][data-pin="'+CSS.escape(key)+'"]')?.classList.add('pin-selected');},locate,tell,endWire,startWire,refreshPositions,cancelNodeDrag,get pending(){return wire&&{id:wire.id,key:wire.p.key};},get connecting(){return !!wire;}};
}
W.LunaBarCanvas={create,esc,icon};
})(window);
