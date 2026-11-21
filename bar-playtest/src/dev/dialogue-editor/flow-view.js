/* Editor-only canvas. Cards and inspector share the same live CSV model. */
(function(W){
'use strict';
const $=id=>document.getElementById(id),F=W.LunaBarFlow;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>F.clean(s).replace(/<[^>]+>/g,'');
const options=(list)=>list.map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');
function portrait(id,D){
 let layers;
 if(id==='luna')layers=[{src:'assets/01.ArtResources/01.Characters/02.Outside/01.Luna/Legacy/luna_v2_idle_Sheet.png',w:267,h:258,alphaBBox:[31,22,58,80]}];
 else if(id==='shiba'&&!D.characterLayers.shiba)layers=[{src:'assets/01.ArtResources/01.Characters/01.Bar/08.Shiba/Shiba_Idle.png',w:551,h:530,alphaBBox:[219,271,347,422]}];
 else {const poses=D.characterLayers[id]||{},key=Object.keys(poses).find(k=>/idle_default$/i.test(k));layers=(poses[key]||[]).map(k=>D.assets[k]).filter(Boolean);}
 if(!layers.length)return '';
 const boxes=layers.map(a=>a.alphaBBox||[0,0,a.frameWidth||a.w,a.frameHeight||a.h]),x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1])),r=Math.max(...boxes.map(b=>b[2])),b=Math.max(...boxes.map(b=>b[3]));
 return `<svg aria-hidden="true" viewBox="${x} ${y} ${r-x} ${b-y}">${layers.map(a=>`<image href="${esc(a.src)}" width="${a.w}" height="${a.h}"/>`).join('')}</svg>`;
}
const themes={say:['talk','“'],choice:['choice','⑂'],craft:['serve','◆'],serve:['serve','◆'],order:['order','◇'],enter:['cast','↳'],exit:['cast','↱'],coaster:['prop','▱'],empty_glass:['prop','▽'],end_part:['end','■'],timeline:['event','▸']};
function create(api){
 const detail=$('node-detail'),R=W.LunaBarWiring,S=W.LunaBarSections;
 let parts=[],partId=S.first;const nameScene=W.LunaFlowWorkspaceMenu.naming();
 let graph,prefs,sceneId='',active='',opened=false,items=[],historyReady=false,editingDraft='';
 const model=()=>api.model(),scene=()=>api.scene(),node=id=>graph?.nodes.find(n=>n.id===id),item=id=>items.find(n=>n.id===id);
 const chosenOrders=new Map();
 const title=n=>n.type+' · '+(n.index+1)+(n.rows.length>1?'–'+(n.index+n.rows.length):'');
 const label=p=>p?(F.presets.find(([key])=>key===p)?.[1]||W.LunaRuleEditor.describe(p,api.actorName)):'기본 진행';
 const author=W.LunaFlowAuthorUI.create({...api,boundary(r,next){prefs.s.breaks=[...new Set([...(prefs.s.breaks||[]),r.row_id,next?.row_id].filter(Boolean))];prefs.save();},locate(){canvas.locate();}});
 const tester=W.LunaBarPlaytest.create({...api,back});$('scene-run').onclick=()=>go('test',active);
 function previewGraph(id){return opened&&graph&&id===sceneId?graph:F.compile(model(),id,[...(W.LunaBarLayout.preferences(id).s.breaks||[]),...S.records(model(),id).map(s=>s.start)]);}
 const routeFor=n=>W.LunaBarPreviewRoute.create({model:model(),scene:scene(),node:n,settings:api.settings(),picks:api.getPicks(),graphFor:previewGraph});
 const player=W.LunaBarPlayer.create({route:routeFor,actorName:api.actorName,guard:label,plain,back});
 let editRoute=null,hop=0;
 W.LunaPreviewBranchPicker.edit($('line-edit-next'),()=>{
  api.stop();const n=previewGraph(scene()).nodes.find(n=>n.rows.some(r=>r.row_id===api.selected()));if(!n)return [];
  const m=model(),checkpoint=m.undoStack.at(-1),settings=JSON.stringify([api.settings(),api.getPicks()]);
  // Carry the chosen branch's flags across consecutive hops, not into game
  // state. After an edit, undo, reload or manual jump, plan from live rows.
  if(!editRoute||!currentState()?.editHop||editRoute.hop!==currentState().editHop||editRoute.route.node.id!==n.id||editRoute.route.scene!==scene()||
   editRoute.model!==m||editRoute.checkpoint!==checkpoint||editRoute.settings!==settings)editRoute={route:routeFor(n),model:m,checkpoint,settings};
  return editRoute.route.branches().map(p=>{const dst=p.target?.node,guard=[...new Set([p.pick?.when,p.guard].filter(Boolean).map(label))].join(' · '),choice=p.pick&&plain(p.pick['text.ko']);
   return {target:p.target,title:choice||guard||'기본 진행',detail:[choice&&guard,p.target?.lane?.title,dst&&title(dst),dst&&plain(dst.rows.find(r=>plain(r['text.ko']))?.['text.ko'])].filter(Boolean).join(' · '),blocked:p.blocked||(!dst?'대화 종료 · 이어 편집할 대사가 없습니다.':'')};
  });
 },({target})=>{if(['edit','section-lines','lines'].includes(currentState()?.view))saveState({...currentState(),row:api.selected()},false);
  editRoute.route.enter(target);editRoute.hop=++hop;
  saveState({view:'edit',scene:target.lane.id,id:target.node.id,row:target.node.id,editHop:hop},true);restore(currentState());$('line-edit-next').focus({preventScroll:true});},api.notice);
 const canvas=W.LunaBarCanvas.create({select,action,inspect:inspectPin,reason,connect,dropDraft,moveGroup:recordPositions,move:(id,pos)=>recordPositions([[id,pos]])});
 const loose=W.LunaBarLooseNodes,palette=W.LunaNodePalette.create();
 function createAt(x,y){const at=canvas.point(x,y);palette.open(x,y,Object.entries(loose.types).map(([key,[name,group,icon]])=>({key,name,group,icon,hint:'입력 핀에 연결하기 전에는 실행되지 않음'})),type=>author.open(node(active)||graph.nodes[0],null,{type,place(r){(prefs.s.freeParts??={})[loose.group(r)]=partId;const manual=(prefs.s.positions[prefs.s.direction]||={});manual[r.row_id]=W.LunaNodePalette.vacant(at,W.LunaBarLayout.width,360,$('map-world').querySelectorAll('.flow-card'),24);prefs.save();requestAnimationFrame(()=>canvas.locate(r.row_id));}}));}
 const menu=W.LunaFlowWorkspaceMenu.create(contextEntries,createAt);
 function recordPositions(entries){
  const direction=prefs.s.direction,manual=prefs.s.positions[direction]||{};
  const changes=entries.map(([id,after])=>({id,before:manual[id]?{...manual[id]}:null,after}));
  if(!changes.length)return;
  const edit={scene:sceneId,direction,changes};applyLayout(edit,'after');api.recordLayout(edit);
 }
 function applyLayout(edit,side){
  const owner=sceneId===edit.scene?prefs:W.LunaBarLayout.preferences(edit.scene);
  if(edit.kind==='draft-delete'){const ds=owner.s.drafts[edit.row]||[],rest=ds.filter(x=>x!==edit.predicate);if(side==='before')rest.splice(Math.min(edit.index,rest.length),0,edit.predicate);
   if(rest.length)owner.s.drafts[edit.row]=rest;else delete owner.s.drafts[edit.row];owner.save();if(opened&&owner===prefs)draw(edit.node);return;}
  const manual=owner.s.positions[edit.direction]||{};
  for(const change of edit.changes){const p=change[side];if(p)manual[change.id]={...p};else delete manual[change.id];}
  // A missing override means automatic placement, even if the graph has since changed.
  if(Object.keys(manual).length)owner.s.positions[edit.direction]=manual;else delete owner.s.positions[edit.direction];
  owner.save();
  if(opened&&owner===prefs&&owner.s.direction===edit.direction)canvas.refreshPositions();
 }
 function dests(n){return graph.connections.filter(e=>e.from===n.id);}
 function ports(n){
  const last=n.rows.at(-1),result=[];
  const push=(choice,predicate,name,editable=true,note='')=>{
   const key=R.pinKey(choice,predicate);
   if(result.some(p=>p.key===key))return;
   const route=n.routes.find(r=>R.pinKey(r.choice,r.predicate)===key);
   result.push({key,choice,predicate,flagExpr:predicate,label:name,editable,note,routeId:route?.id});
  };
  if(last.type==='end_part')return result;if(n.branchWhen){push('',n.branchWhen,'조건 충족 · '+label(n.branchWhen));push('','','그 외');return result;}
  if(last.type==='choice'){
   for(const o of model().choices(last.arg)){push(o.row_id,'',plain(o['text.ko']));const p=result.at(-1);p.predicate=n.routes.find(r=>r.choice===o.row_id)?.predicate||'';p.flagExpr=[R.readable(o.when),R.authorEffects(o.effects),p.predicate].join(' ');}
  }else{
   for(const r of n.routes)if(r.predicate)push('',r.predicate,label(r.predicate));
   for(const e of dests(n))if(e.guard&&!e.routeId&&!e.choice)push('',e.guard,label(e.guard));
   for(const d of prefs.s.drafts[last.row_id]||[])if(!result.some(p=>p.key===R.pinKey(null,d))){push('',d,d.startsWith('?')?'조건 지정 필요':label(d));result.at(-1).draft=true;}
   push('','',n.branchWhen?'그 외':'다음 흐름');
  }
  return result;
 }
 function reason(src,p,dst){
  const n=node(src),d=item(dst);if(p.predicate?.startsWith('?'))return '오른쪽에서 조건을 지정한 뒤에 연결하세요.';if(!n||!d)return '같은 장면에서 입력 핀을 선택하세요.';
  if(d.jump)return '이 카드는 다른 장면으로 가는 길입니다. 전체 연결 보기에서 실제 노드에 꽂으세요.';
  if(d.portal&&p.choice&&p.predicate)return '다른 장면으로 가는 선택지에는 선택 후 조건을 따로 저장할 수 없습니다. 먼저 핀의 이동 조건을 지우세요.';
  if(d.portal)return R.sceneProblem(model(),scene(),n,p.choice,d.portal);
  return targetProblem(n,node(dst),p);
 }
 const targetProblem=(src,dst,p)=>loose.targetProblem(model(),scene(),src,dst,p);
 const writeWire=(src,dst,p)=>loose.attach(model(),scene(),src,dst,p);
 function connect(src,p,dst){
  const n=node(src),d=item(dst),why=reason(src,p,dst);if(why){canvas.tell(why);return;}
  const last=n.rows.at(-1),saved=prefs.s.drafts[last.row_id]||[];
  const old=dests(n).find(e=>e.pinKey===p.key),sameTarget=d.portal?old?.targetScene===d.portal:old?.to===dst;
  if(sameTarget&&(old.routeId||old.targetScene)){canvas.tell('이미 연결된 노드입니다.');return;}
  const swap=!d.portal&&loose.siblingReturn(model(),scene(),n,node(dst),p);
  if(swap&&!confirm('두 분기의 대본 순서를 바꿔 연결합니다. 이 답변 뒤에는 도착 노드의 실행 조건에 맞게 '+label(swap.flag)+' 값을 '+(swap.value?'참':'거짓')+'으로 바꿉니다. 연결할까요?'))return;
  let ok=api.change(()=>{
   if(d.portal){
    R.sceneWire(model(),scene(),n,p.choice,d.portal);
   }else{F.checkGuard(p.predicate);writeWire(n,node(dst),p);}
   return last;
  });
  if(ok){if(saved.includes(p.predicate)){prefs.s.drafts[last.row_id]=saved.filter(x=>x!==p.predicate);prefs.save();}select(src);canvas.tell('연결됨: '+p.label+' → '+d.title+(old&&!sameTarget?' · 이전 연결 교체':''));}
 }
 function draw(prefer,keepPart=false){
  if(!model())return;
  const changed=sceneId!==scene();if(changed||!prefs){sceneId=scene();prefs=W.LunaBarLayout.preferences(sceneId);}
  const marks=S.records(model(),scene());graph=F.compile(model(),scene(),[...(prefs.s.breaks||[]),...marks.map(p=>p.start)]);
  parts=S.partition(model(),scene(),graph.nodes,api.actorName);if(changed)partId=prefs.s.section||S.first;
  for(const p of parts){const free=p.nodes.filter(n=>loose.loose(n.rows[0])&&prefs.s.freeParts?.[loose.group(n.rows[0])]&&prefs.s.freeParts[loose.group(n.rows[0])]!==p.id);for(const n of free){const dst=parts.find(k=>k.id===prefs.s.freeParts[loose.group(n.rows[0])]);if(dst){p.nodes=p.nodes.filter(v=>v!==n);dst.nodes.push(n);}}}
  if(partId!==S.all&&!parts.some(p=>p.id===partId))partId=S.first;
  const wanted=S.current(parts,prefer);if(!keepPart&&wanted&&partId!==S.all&&(!changed||prefer!==graph.nodes[0]?.id))partId=wanted.id;
  const shown=partId===S.all?graph.nodes:parts.find(p=>p.id===partId)?.nodes||[],showIds=new Set(shown.map(n=>n.id));menu.close();drawNav();
  const art=$('preview').contentWindow?.LUNA_DATA||model().presentation;
  const sceneInfo=model().scenes.find(s=>s.id===scene()),otherScenes=model().scenes.filter(s=>s.id!==scene()&&s.day===sceneInfo.day);
  items=shown.map(n=>{const i=graph.nodes.indexOf(n);
   const head=n.rows[0],theme=themes[head.type]||['event','✦'];
   const drink=arg=>model().projected.data.tables.cocktails.find(c=>'exact:'+c.id===arg)?.['name.ko']||arg;
   const cue=n.branchWhen?label(n.branchWhen):{enter:api.actorName(head.actor)+' · '+(head.arg==='L'?'왼쪽':'오른쪽')+' 좌석에 등장',exit:api.actorName(head.actor)+' 퇴장',craft:'제조한 잔을 '+api.actorName(head.actor)+'에게 제공',order:head.arg==='free'?'자유 주문':drink(head.arg),coaster:'손님 앞에 코스터 놓기',empty_glass:'테이블의 잔을 빈잔으로 교체',effect:R.authorEffects(head.effects),end_part:'정산으로 이동'}[head.type];
   const excerpt=head.type==='choice'?model().choices(head.arg).map(o=>plain(o['text.ko'])).join(' / '):n.rows.map(r=>plain(r['text.ko'])).find(Boolean)||cue||plain(head.arg)||n.type;
   return {id:n.id,flagExpr:n.rows.map(r=>R.readable(r.when)+' '+R.authorEffects(r.effects)).join(' '),type:n.type,fixedPorts:!!n.branchWhen,terminal:head.type==='end_part',title:title(n),number:'#'+String(i+1).padStart(2,'0'),lines:n.rows.filter(r=>r.type==='say'||r.type==='order'&&plain(r['text.ko'])).length,tone:theme[0],symbol:theme[1],cast:n.cast.map(api.actorName).join(' · '),images:n.cast.map(id=>portrait(id,art)).join(''),excerpt,ports:ports(n)};
  });
  for(const s of otherScenes.filter(s=>partId===S.all||graph.connections.some(e=>e.targetScene===s.id&&showIds.has(e.from))))items.push({id:'goto:'+s.id,portal:s.id,title:s.title||s.id,type:'장면 이동',tone:'portal',symbol:'↗',number:'SCENE',cast:'같은 일차의 다른 장면',excerpt:s.title||s.id,ports:[]});
  const neighbors=new Map();const stub=id=>'part:'+id;
  const relevant=graph.connections.filter(e=>showIds.has(e.from)&&(e.to||e.targetScene));
  for(const e of relevant)if(e.to&&!showIds.has(e.to)){const p=S.current(parts,e.to);if(p&&!neighbors.has(e.to)){neighbors.set(e.to,true);items.push({id:stub(e.to),jump:e.to,title:p.name,type:'다음 장면',tone:'portal',symbol:'↗',number:'SCENE '+(p.index+1),cast:'다른 편집 장면으로 이어짐',excerpt:node(e.to).type+' · '+p.name,ports:[]});}}
  const edges=relevant.map(e=>{
   const n=item(e.from),pin=n.ports.find(p=>p.key===e.pinKey);
   return {from:e.from,to:e.to?(showIds.has(e.to)?e.to:stub(e.to)):'goto:'+e.targetScene,pinKey:pin?.key,branch:!!(e.guard||e.choice||e.routeId)};
  });
  canvas.draw({items,edges},prefs,changed);
  for(const card of $('map-world').querySelectorAll('[data-node]'))if(loose.loose(node(card.dataset.node)?.rows[0])){card.classList.add('tone-loose');card.querySelector('.card-head small').prepend('미연결 · ');}
  const caption=sceneInfo.title||sceneInfo.id;$('graph-title').textContent=caption.startsWith(sceneInfo.day+'일차')?caption:sceneInfo.day+'일차 · '+caption;
  const part=parts.find(p=>p.id===partId);$('graph-stats').textContent=(part?('장면 '+(part.index+1)+' / '+parts.length+' · '+part.name+'　|　'):'대본 전체　|　')+shown.length+'개 노드 · '+edges.length+'개 연결';
  if(changed)$('map-search').value='';filter();
  const dest=shown.find(n=>n.rows.some(r=>r.row_id===prefer))||shown.find(n=>n.id===active)||shown[0];
  if(dest)select(dest.id,changed);
  if(graph.errors.length)canvas.tell(graph.errors[0]);
 }
 function drawNav(){
  $('section-total').textContent=parts.length+'개';$('section-list').innerHTML=parts.map(p=>'<button data-section="'+esc(p.id)+'" aria-pressed="'+(p.id===partId)+'" title="'+esc(p.name)+'"><small>'+String(p.index+1).padStart(2,'0')+'</small><span>'+esc(p.name)+'</span><small>'+p.nodes.length+'</small></button>').join('');
  $('section-all').setAttribute('aria-pressed',partId===S.all);
 }
 function navigatePart(id,prefer){
  if(!parts.length)return;const cable=canvas.pending,all=id===S.all;
  const p=parts.find(p=>p.id===id);if(!all&&!p)return;
  const target=prefer||(all?active:p.nodes[0].id);
  if(id!==partId)saveState({view:'map',scene:scene(),part:id,id:target},true);
  partId=id;prefs.s.section=id;prefs.save();draw(target,true);canvas.locate(target);
  if(cable&&all){const it=item(cable.id),i=it?.ports.findIndex(p=>p.key===cable.key);if(i>=0)canvas.startWire(cable.id,i);}
 }
 $('section-list').onclick=e=>{const b=e.target.closest('[data-section]');if(b)navigatePart(b.dataset.section);};$('section-all').onclick=()=>navigatePart(S.all);
 function named(n,op){
  const p=S.current(parts,n.id),at=p.nodes.indexOf(n),split=op==='split';
  const order=p.nodes.slice(at),ids=new Set(order.map(n=>n.id)),cross=graph.connections.filter(e=>e.to&&(ids.has(e.from)!==ids.has(e.to))).length;
  const prompt=split?'「'+p.name+'」의 이 노드부터 마지막까지 '+order.length+'개를 바로 다음 장면으로 옮깁니다. 앞에는 '+at+'개가 남습니다. 경계를 지나는 연결 '+cross+'개와 본편의 재생 순서는 유지됩니다.':'왼쪽 목록과 이 장면으로 이어지는 연결 카드의 이름을 바꿉니다.';
  nameScene(split?'다음 장면으로 분리':'장면 이름 변경',prompt,split?'새 장면 '+(p.index+2):p.name,value=>{
   const fromPart=partId,prev=p.nodes[at-1]?.id,oldState=currentState();let err;const ok=api.change(()=>{try{if(split)S.split(model(),scene(),parts,n.id,value);else S.rename(model(),scene(),parts,p,value);}catch(e){err=e;throw e;}return n.rows[0];});
   if(!ok)throw err||Error($('status').textContent);if(split){partId=fromPart;saveState({...oldState,view:'map',scene:scene(),part:fromPart,id:prev},false);}navigatePart(split?n.id:p.id,n.id);canvas.tell(split?'이 노드부터 새 장면으로 이동했습니다. Ctrl / ⌘ + Z로 되돌릴 수 있습니다.':'장면 이름을 변경했습니다.');
  });
 }
 function dropDraft(id,predicate){const n=node(id);if(!n)return;const row=n.rows.at(-1).row_id,index=(prefs.s.drafts[row]||[]).indexOf(predicate);if(index<0)return;
  const change={kind:'draft-delete',scene:scene(),node:id,row,index,predicate};editingDraft='';applyLayout(change,'after');api.recordLayout(change);canvas.tell('미연결 핀을 삭제했습니다. 되돌리기로 복구할 수 있습니다.');}
 function removeOption(n,id){const last=n.rows.at(-1);if(last.type!=='choice'||model().choices(last.arg).length<=1)return;
  if(!confirm('이 선택지와 여기에 연결된 경로를 삭제할까요? 다른 선택지는 유지됩니다.'))return;
  api.change(()=>{for(const r of n.routes.filter(r=>r.choice===id))R.disconnect(model(),scene(),r);model().removeChoice(last.arg,id);return last;});}
 function contextEntries(id,portIndex,pinKey){
  const n=node(id),it=item(id);if(!n){
   if(it?.portal||it?.jump)return [['open','↗　연결된 장면 열기',()=>action(id,'goto')]];
   return [['add','＋　선택한 노드 옆에 추가',()=>author.open(node(active))],['find','◎　선택 노드로 이동',()=>canvas.locate()],['all','⤢　전체 연결 보기',()=>navigatePart(S.all)],['arrange','▦　카드 자동 정렬',()=>$('map-arrange').click()]];
  }
  select(id);const end=n.rows.at(-1),p=S.current(parts,id),ix=pinKey!=null?it.ports.findIndex(v=>v.key===pinKey):portIndex,pin=it.ports[ix],entries=[];
  if(pin){const r=n.routes.find(r=>r.id===pin.routeId),option=pin.choice&&model().choices(end.arg).find(o=>o.row_id===pin.choice),to=dests(n).find(e=>e.pinKey===pin.key),blank=pin.draft&&pin.predicate.startsWith('?');
   canvas.markPin(id,pin.key);entries.push(['inspect',option?'선택지 편집':'핀 조건 편집',()=>inspectPin(id,pin.key)],
    ['wire',r||to?.targetScene?'연결 대상 변경':'연결할 노드 고르기',!pin.editable||blank?null:()=>canvas.startWire(id,ix),blank?'조건을 먼저 선택하세요.':pin.note]);
   if(to?.to)entries.push(['goto-pin','도착 노드 보기',()=>select(to.to,true)]);
   entries.push(null,['add-sibling',option?'선택지 추가':'분기 핀 추가',n.branchWhen||option&&it.ports.length>=4?null:()=>action(id,option?'option':'pin')]);
   if(r||option&&F.clean(option.goto))entries.push(['unlink','연결만 해제',()=>api.change(()=>{if(r)R.disconnect(model(),scene(),r);else R.sceneWire(model(),scene(),n,pin.choice,'');return end;})]);
   if(pin.draft)entries.push(['drop-pin','미연결 핀 삭제',()=>dropDraft(id,pin.predicate)]);
   if(option)entries.push(['drop-option','선택지 삭제',it.ports.length>1?()=>removeOption(n,pin.choice):null,'선택지는 하나 이상 남겨야 합니다.']);
   return entries;}
  const isChoice=end.type==='choice',allowed=n.rows.every(r=>r.type==='say'&&!F.clean(r.effects))&&!n.routes.length&&!graph.nodes.some(o=>o.routes.some(r=>n.rows.some(x=>x.row_id===r.target)))&&n.index>=model().prefix(scene());
  return entries.concat([['play','▷　노드 미리보기',()=>action(id,'play')],['edit','✎　노드 대사 편집',()=>action(id,'edit')],
   ['focus','◎　가운데 보기',()=>canvas.locate(id)],null,
   ['before','＋　이 노드 앞에 추가',()=>author.open(n,'before')],['after','＋　이 노드 뒤에 추가',end.type==='end_part'?null:()=>author.open(n,'after')],
   ['port',isChoice?'＋　선택지와 출력 핀 추가':'＋　조건 분기 핀 추가',n.branchWhen||end.type==='end_part'||isChoice&&it.ports.length>=4?null:()=>action(id,isChoice?'option':'pin')],
   ['duplicate','⧉　대사 묶음 복제',allowed?()=>api.change(()=>{const m=model(),list=m.rows(scene()),at=list.indexOf(end)+1;let head;for(const [i,r] of n.rows.entries()){const copy=m.add(scene(),at+i,'say',r);head||=copy;}prefs.s.breaks=[...new Set([...(prefs.s.breaks||[]),head.row_id,list[at]?.row_id].filter(Boolean))];prefs.save();return head;}):null,'효과·분기의 연결점이 아닌 대사 묶음만 복제합니다.'],
   ['delete',loose.group(end)?'×　독립 노드 삭제':'−　대사 묶음 삭제',loose.group(end)?()=>{if(confirm('이 노드와 연결선을 삭제할까요? 실행 취소로 복원할 수 있습니다.'))api.change(()=>loose.remove(model(),scene(),end));}:allowed&&graph.nodes.length>1?()=>{if(confirm('이 묶음의 대사 '+n.rows.length+'줄을 삭제할까요? 되돌리기로 복구할 수 있습니다.'))api.change(()=>{const m=model(),list=m.rows(scene()),to=list[list.indexOf(end)+1]||list[n.index-1];for(const r of n.rows)m.remove(scene(),r.row_id);return to;});}:null,'등장·주문이나 연결된 분기를 실수로 지우지 않도록 보호합니다.'],null,
   ['split','✂　이 노드부터 다음 장면으로 분리…',p.nodes[0]===n?null:()=>named(n,'split'),'현재 편집 장면에서 이 노드를 포함한 나머지를 새 장면으로 옮깁니다.'],
   ['section-lines','≡　현재 장면 대사 목록',()=>go('section-lines',id)],['rename','✎　현재 장면 이름 변경…',()=>named(n,'rename')],
   ['merge','↤　이 장면을 앞 장면에 합치기',p.index?()=>{if(confirm('「'+p.name+'」을 앞 장면에 합칠까요? 대사와 분기는 유지됩니다.'))api.change(()=>{S.merge(model(),scene(),parts,p);return n.rows[0];});}:null],
   ['auto','↺　등장·퇴장 기준 자동 구분 복원',S.records(model(),scene()).length?()=>{if(confirm('이 대본의 편집 장면 이름과 수동 구분을 자동 구분으로 되돌릴까요? 대사는 유지됩니다.'))api.change(()=>{S.reset(model(),scene());return n.rows[0];});}:null]]);
 }
 function filter(){const q=$('map-search').value.trim().toLowerCase(),outside=q?graph.nodes.filter(n=>!item(n.id)).map(n=>({id:n.id,type:n.type,cast:n.cast.map(api.actorName).join(' · '),number:'#'+String(graph.nodes.indexOf(n)+1).padStart(2,'0'),title:(S.current(parts,n.id)?.name||'')+' › '+n.type,excerpt:n.rows[0].type==='choice'?model().choices(n.rows[0].arg).map(r=>plain(r['text.ko'])).join(' / '):n.rows.map(r=>plain(r['text.ko'])||plain(r.arg)).find(Boolean)||''})):[],matches=[...items,...outside].filter(i=>!q||[i.type,i.cast,i.number,i.title,i.excerpt,...(node(i.id)?.rows||[]).map(r=>plain(r['text.ko']))].join(' ').toLowerCase().includes(q));$('map-bookmark').innerHTML='<option value="">'+(q?matches.length+'개 검색 결과':'노드 바로가기…')+'</option>'+options(matches.map(i=>[i.id,i.number+' '+i.title+'　'+i.excerpt.slice(0,23)]));return matches;}
 $('map-search').oninput=filter;$('map-search').onkeydown=e=>{if(e.key==='Enter'){const m=filter()[0];if(m){if(m.portal||m.jump)action(m.id,'goto');else select(m.id,true);}}};
 function inspectPin(id,key){
  const n=node(id),p=item(id)?.ports.find(x=>x.key===key);if(!n||!p)return;
  canvas.endWire();select(id);canvas.markPin(id,key);
  const m=model(),last=n.rows.at(-1),route=n.routes.find(r=>r.id===p.routeId),edge=dests(n).find(e=>e.pinKey===key);
  const dst=node(route?.target||edge?.to),o=p.choice?m.choices(last.arg).find(c=>c.row_id===p.choice):null;
  const fields=[],add=(key,title,help,value,mode='when')=>fields.push({key,title,help,value,mode});
  if(o){add('text.ko','선택지 문구','플레이어에게 보이는 선택지입니다.',W.LunaDialogueEditorModel.decode(o['text.ko']),'text');
   add('lock_reason.ko','선택 불가 안내','선택 조건을 만족하지 않을 때 보여줄 문구입니다.',W.LunaDialogueEditorModel.decode(o['lock_reason.ko']),'text');
   add('choiceWhen','선택 가능 조건','선택지를 누르기 전에 확인합니다.',R.readable(o.when));
   add('choiceEffects','선택 시 값 기록','이 선택지를 골랐을 때만 적용됩니다.',R.authorEffects(o.effects),'effects');}
  const independent=!route&&!p.draft&&!edge?.targetScene&&last.type!=='end_part'&&model().rows(scene()).indexOf(last)>=m.prefix(scene())-1;
  if((!n.branchWhen||p.predicate)&&(route||p.draft||independent))add('predicate',o?'선택 후 이동 조건':'이 연결의 조건',p.draft?'조건을 적용한 뒤 이 핀을 원하는 노드에 연결하세요.':'참이면 연결된 노드로 갑니다. 거짓이면 이 연결을 건너뛰고 다음 분기 또는 대본 순서를 따릅니다.',route?.predicate||(p.predicate.startsWith('?')?'':p.predicate));

  const note=edge?.targetScene?'장면 이동은 기존 선택지의 이동 대상입니다. 조건을 만족한 선택지만 그 장면으로 이동합니다.':independent?'현재 대본 순서에서 계산된 길입니다. 조건이나 목적지를 바꾸면 이 핀만의 연결을 만듭니다. 거짓일 때는 원래 순서로 진행하므로 바로 다음 줄이 목적지라면 결과가 같을 수 있습니다.'+ (dst?.when?' 도착 노드 조건: '+label(dst.when):''):'';
  const destinations=(independent||route||p.draft)?pred=>[...(route?[]:[{id:'',label:p.draft?'나중에 연결':'이동할 노드 선택'}]),...graph.nodes.filter(t=>t===dst||!targetProblem(n,t,{...p,predicate:pred})).map(t=>({id:t.id,label:title(t)+' · '+(plain(t.rows[0]['text.ko'])||t.cast.map(api.actorName).join(' · ')).slice(0,32)}))]:null;
  W.LunaPinInspector.show(detail,{key,draft:p.draft,title:o?'선택지 '+(m.choices(last.arg).indexOf(o)+1)+' · '+p.label:(p.draft?'새 분기 핀':'출력 핀'),from:title(n),to:dst?title(dst):edge?.targetScene?(m.scenes.find(s=>s.id===edge.targetScene)?.title||edge.targetScene):edge?.end?'장면 종료':'연결 대기',fields,note,destinations,destination:dst?.id,model,back:()=>select(id),
   remove:p.draft?{label:'미연결 핀 삭제',run:()=>dropDraft(id,p.predicate)}:o&&m.choices(last.arg).length>1?{label:'선택지 삭제',run:()=>removeOption(n,o.row_id)}:null,
   unlink:route||o&&F.clean(o.goto)?()=>api.change(()=>{if(route)R.disconnect(m,scene(),route);else R.sceneWire(m,scene(),n,o.row_id,'');return last;}):null,
   rewire:()=>{if(p.draft&&p.predicate.startsWith('?')){canvas.tell('먼저 조건을 적용하세요.');return;}select(id);canvas.startWire(id,item(id).ports.findIndex(x=>x.key===key));},
   apply(v,destination){v.predicate??=p.predicate||'';for(const f of fields)if(f.mode==='when'&&v[f.key]!==f.value)F.checkGuard(v[f.key]);
    if(o&&!v['text.ko'].trim())throw Error('선택지 문구를 입력하세요.');
    let nextKey=key;
    if(p.draft){if(!v.predicate||v.predicate==='true')throw Error('분기 핀에는 조건이 필요합니다.');
     nextKey=R.pinKey('',v.predicate);if(nextKey!==key&&item(id).ports.some(x=>x.key===nextKey))throw Error('이 노드에 같은 조건의 핀이 있습니다.');
     const ds=prefs.s.drafts[last.row_id]||[];if(!ds.includes(p.predicate))throw Error('핀이 변경되었습니다. 다시 선택하세요.');
     if(destination){const why=targetProblem(n,node(destination),{choice:'',predicate:v.predicate});if(why)throw Error(why);
      const ok=api.change(()=>writeWire(n,node(destination),{choice:'',predicate:v.predicate}));if(!ok)throw Error($('status').textContent);}
     prefs.s.drafts[last.row_id]=destination?ds.filter(x=>x!==p.predicate):ds.map(x=>x===p.predicate?v.predicate:x);prefs.save();editingDraft='';draw(id);
    }else{
     const newWire=independent&&(v.predicate!==(p.predicate||'')||destination!==(dst?.id||''));
     if(newWire){if(!node(destination))throw Error('이 조건을 만족하면 이동할 노드를 고르세요.');nextKey=R.pinKey(p.choice,v.predicate);if(n.routes.some(r=>R.pinKey(r.choice,r.predicate)===nextKey))throw Error('같은 조건의 연결이 이미 있습니다. 그 핀을 선택해서 수정하세요.');}
     if(route&&!o){nextKey=R.pinKey('',v.predicate);if(nextKey!==key&&item(id).ports.some(x=>x.key===nextKey&&x.draft))throw Error('같은 조건의 미연결 핀이 있습니다.');}
     const ok=api.change(()=>{
      if(o){for(const k of ['text.ko','lock_reason.ko'])if(v[k]!==W.LunaDialogueEditorModel.decode(o[k]))m.set(o,k,v[k]);if(v.choiceWhen!==R.readable(o.when))m.set(o,'when',R.preserve(o.when,v.choiceWhen,'&&'));if(v.choiceEffects!==R.authorEffects(o.effects))m.set(o,'effects',R.preserve(o.effects,v.choiceEffects,';'));}
      if(route){const target=node(destination)||dst;R.revise(m,scene(),n,route,dst,v.predicate);if(target!==dst)writeWire(n,target,{choice:route.choice,predicate:v.predicate,routeId:route.id});}
      else if(newWire){if(n.branchWhen&&p.predicate!==v.predicate)R.setDecision(m,n.rows[0],v.predicate);writeWire(n,node(destination),{choice:p.choice,predicate:v.predicate});}
      return last;
     });if(!ok){const message=$('status').textContent;inspectPin(id,key);
       const current=detail.querySelector('[data-pin-inspector]');if(current){for(const i of current.querySelectorAll('[data-pin-field]')){i.value=v[i.dataset.pinField]||'';i.dispatchEvent(new Event('input',{bubbles:true}));}const sel=current.querySelector('[data-pin-destination]');if(sel){sel.value=destination||'';sel.dispatchEvent(new Event('input',{bubbles:true}));}current.querySelector('.pin-status').textContent=message;}canvas.tell(message);return;}
    }
    const live=graph.nodes.find(x=>x.rows.some(r=>r.row_id===last.row_id));if(live&&item(live.id)?.ports.some(x=>x.key===nextKey))inspectPin(live.id,nextKey);
    canvas.tell('조건을 적용했습니다.');}
  });
 }
 function select(id,scroll=false){
  const n=node(id);if(!n){if(scroll)canvas.locate(id);return;}if(!item(id)){const part=S.current(parts,id);if(part){navigatePart(part.id,id);}return;}
  if(active!==id)editingDraft='';active=id;canvas.mark(id);if(scroll)canvas.locate(id);const it=item(id),last=n.rows.at(-1),choice=last.type==='choice',served=last.type==='serve',outs=dests(n);
  const UI=W.LunaFlowAuthorUI,g=UI.group,restoreInspector=UI.inspectorState(detail,scene()+'/'+id);
  const routeList=n.routes.map(r=>(r.predicate?g('route:'+r.id,'분기 조건 수정','<input type="hidden" data-route-value="'+esc(r.id)+'" value="'+esc(r.predicate)+'"><button data-revise="'+esc(r.id)+'">조건 적용</button>','class="route-edit"'):'')+
   '<div class="conn-row"><span>'+esc(r.choice?plain(r.owner?.['text.ko']):label(r.predicate))+'</span><button data-remove-route="'+esc(r.id)+'" title="원래 순서로 복구">연결 해제</button></div>').join('');
  const drafts=(prefs.s.drafts[last.row_id]||[]).filter(x=>it.ports.some(p=>p.draft&&p.predicate===x)).map(x=>'<div class="conn-row"><button data-edit-draft="'+esc(x)+'">✎ '+esc(x.startsWith('?')?'미설정 분기':label(x))+'</button><button data-remove-draft="'+esc(x)+'">핀 삭제</button></div>').join('');
  const optionUI=UI.choices(model(),n),order=last.type==='order',end=last.type==='end_part',DP=W.LunaFlowDetails;
  const orderField=DP.orders(model(),model().scenes.find(s=>s.id===scene()),DP.orderContext(model(),scene(),graph,n),chosenOrders.get(id),api.actorName).html;
  const showLines=!choice&&(!order||plain(last['text.ko']));
  const lines=showLines?g('content',(n.rows[0].type==='say'?'대사 줄':'진행 줄')+' · '+n.rows.length,'<ol class="node-lines">'+n.rows.map((r,i)=>'<li><button data-row="'+esc(r.row_id)+'" title="대사 편집기에서 열기"><small>'+String(i+1).padStart(2,'0')+'</small>'+esc(plain(r['text.ko'])||(n.rows.length===1?it.excerpt:F.kind(r.type)+' '+F.clean(r.arg)))+'</button>'+(i?'<button class="split-line" data-split="'+esc(r.row_id)+'" title="여기부터 별도 노드로 보기">나누기</button>':'')+'</li>').join('')+'</ol>','data-priority="content"'):'';
  const next=outs.map((e,i)=>{const dst=item(e.to||'goto:'+e.targetScene)||item('part:'+e.to);return '<div class="pin-next-row"><button class="flow-jump" data-edge="'+i+'" '+(e.end?'disabled':'')+'><small>'+esc([e.label,e.requires&&'선택 조건: '+label(e.requires),e.guard&&label(e.guard),e.targetWhen&&e.targetWhen!==e.guard&&'도착: '+label(e.targetWhen)].filter(Boolean).join(' · ')||'기본 진행')+'</small><span>↳ '+esc(dst?.title||'장면 종료')+'</span></button><button type="button" data-inspect-key="'+esc(e.pinKey)+'" aria-label="'+esc(e.label||label(e.guard))+' 핀 편집">핀 편집</button></div>';}).join('');
  const sceneLinks=choice?model().choices(last.arg).filter(o=>F.clean(o.goto)).map(o=>'<div class="conn-row"><span>'+esc(plain(o['text.ko']))+'</span><button data-clear-scene="'+esc(o.row_id)+'">장면 연결 해제</button></div>').join(''):'';
  const links=!end?g('links','다음 노드 연결',next+routeList+sceneLinks+drafts+(choice?'<button data-action="whole-map" title="다른 장면에 연결">전체 연결 보기</button>':'')):'';
  const guard=g('guard',n.branchWhen?'분기 기준 · 조건 충족 / 그 외':'노드 실행 조건','<input type="hidden" id="node-when" value="'+esc(n.branchWhen||n.when)+'"><div id="guard-builder"></div><button data-action="guard">노드에 적용</button>');
  const branch=choice||end||n.branchWhen?'':g('branch','새 분기','<label>빠른 조합<select id="pin-preset"><option value="">조합 추가…</option>'+options(F.presets.slice(1))+'</select></label><input type="hidden" id="pin-condition"><div id="pin-builder"></div>'+
   '<div class="inspector-buttons"><button data-action="add-pin" title="연결한 순서대로 처음 맞는 경로 하나를 따릅니다">＋ 조건 출력 핀</button><button data-action="multi-response" title="조건을 만족하는 반응 대사를 모두 재생합니다">＋ 조건부 대사</button></div>');
  const append=end?g('append','다음 노드 추가','<span class="dp-help">종료 노드 뒤에는 추가할 수 없습니다.</span> <button data-action="before-end">종료 앞에 추가</button>'):g('append','다음 노드 추가','<button data-action="new-line">＋ 대사</button> '+(last.type==='say'?'<button data-action="insert-choice">＋ 선택지</button>':'')+
   (choice||served?'<label>반응 조건<select id="response-pick">'+options(choice?model().choices(last.arg).filter(o=>!F.clean(o.goto)).map(o=>[o.row_id,o['text.ko']]):F.presets.slice(1))+'</select></label><button data-action="response">＋ 반응 대사</button>':''),'class="add-tools"');
  const orient=g('layout','핀 배치','<label>입력 / 출력 방향<select id="node-orient">'+options([['','차트 방향 따르기'],['right','왼쪽 입력 → 오른쪽 출력'],['down','위쪽 입력 ↓ 아래쪽 출력']])+'</select></label>');
  detail.className='tone-'+it.tone;detail.innerHTML='<div class="dp-tab">▤　디테일</div><header class="inspector-title"><h2>'+esc(n.type)+'</h2><small>'+esc(it.number)+'</small></header>'+
   (it.cast||it.lines?'<p class="node-meta">'+esc([it.cast,it.lines?'대사 '+it.lines+'줄':''].filter(Boolean).join(' · '))+'</p>':'')+
   '<div class="node-actions"><button data-action="edit">대사 편집</button><button data-action="play">▷ 노드 미리보기</button></div>'+
   '<div class="dp-toolbar"><input type="search" class="dp-search" aria-label="디테일 속성 검색" placeholder="속성 검색"><nav class="dp-filters" aria-label="디테일 항목 필터"></nav></div><div class="dp-empty" hidden>일치하는 속성이 없습니다.</div>'+orderField+(choice?g('options','선택지 문구',optionUI.fields):'')+optionUI.rules+links+guard+branch+lines+append+orient;
  DP.decorate(detail,scene()+'/'+id);
  UI.conditionTools($('guard-builder'),$('node-when'),model);UI.conditionTools($('pin-builder'),$('pin-condition'),model,'분기 조건을 추가하세요');
  for(const box of detail.querySelectorAll('.quick-rule'))UI.conditionTools(box.querySelector('.quick-builder'),box.querySelector('[data-quick-key="when"]'),model);
  for(const input of detail.querySelectorAll('[data-quick-key="effects"],[data-route-value]')){const wrap=document.createElement('div');(input.closest('label')||input).after(wrap);if(input.hasAttribute('data-route-value'))UI.conditionTools(wrap,input,model,'항상 연결');else W.LunaRuleEditor.effects(wrap,input,model);}
  restoreInspector();
  if(editingDraft&&$('pin-condition')){$('pin-condition').value=editingDraft.startsWith('?')?'':editingDraft;$('pin-condition').dispatchEvent(new Event('input'));detail.querySelector('[data-action="add-pin"]').textContent='조건 확정 · 연결하기';}
  $('node-orient').value=prefs.s.portsAt?.[id]||'';
  if(historyReady&&opened&&window.history.state?.barStudio?.view==='map')saveState({view:'map',scene:scene(),id:active},false);
 }
 function mode(map){
  opened=map;$('section-nav').hidden=!map;document.body.classList.toggle('map-open',map);$('flow-panel').hidden=!map;$('map-mode').setAttribute('aria-pressed',map);$('line-mode').setAttribute('aria-pressed',!map);
  document.title='LUNA · '+(map?'플로우 차트':'대사 편집기');
 }
 function open(prefer){api.stop();api.clearScope();mode(true);draw(prefer);}
 const currentState=()=>window.history.state?.barStudio;
 function saveState(s,push){
  const url=new URL(location.href);url.searchParams.set('view',['lines','edit','section-lines','line-player'].includes(s.view)?'lines':'flow');
  const state={...window.history.state,barStudio:{part:s.part??(s.scene===sceneId?partId:undefined),...s,depth:push?(currentState()?.depth||0)+1:s.depth??currentState()?.depth??0}};
  window.history[push?'pushState':'replaceState'](state,'',url);
 }
 function restore(s){
  if(!s||!model())return;const was=opened;historyReady=false;player.close();tester.close();api.stop();if(s.scene&&s.scene!==scene()&&model().scenes.some(sc=>sc.id===s.scene))api.loadScene(s.scene);
  if(s.part&&s.scene===scene()&&graph&&sceneId===scene()&&s.part!==partId){partId=s.part;draw(s.id,true);}
  if(s.view==='line-player'){
   mode(false);const n=previewGraph(scene()).nodes.find(n=>n.id===s.id);if(n)player.open(n,s.row);
  }else if(s.view==='lines'||s.view==='edit'||s.view==='section-lines'){
   if(s.view==='section-lines'){if(!graph||sceneId!==scene())draw(s.id);const p=S.current(parts,s.id)||parts[0];mode(false);if(p)api.inspect({type:p.name,rows:p.nodes.flatMap(n=>n.rows)},s.row||s.id);}
   else if(s.view==='edit'){if(!was||!graph||sceneId!==scene())draw(s.id);const n=node(s.id)||graph.nodes.find(n=>n.rows.some(r=>r.row_id===s.row));mode(false);if(n)api.inspect(n,s.row);else{api.clearScope();api.refresh();}}
   else{mode(false);api.clearScope();api.refresh(s.row);}
  }else{
   if(!was||!graph||sceneId!==scene()){open(s.id);}else if(node(s.id)&&active!==s.id)select(s.id,true);
   if(s.view==='player'&&node(s.id))player.open(node(s.id));if(s.view==='test')tester.open();
  }
  historyReady=true;
 }
 function go(view,id,row){
  const s={view,scene:scene(),id:id||active,row};
  if(currentState()?.view===view&&currentState()?.scene===scene()&&currentState()?.id===s.id)return;
  saveState(s,true);restore(currentState());
 }
 function back(){
  if(canvas.connecting){canvas.endWire();return;}
  if(currentState()?.depth){window.history.back();return;}
  if(player.isOpen||!opened){const s={view:'map',scene:scene(),id:active};saveState(s,false);restore(currentState());return;}
  location.href='dialogue-editors.html';
 }
 function action(id,what,row){
  const it=item(id);if(!it)return;
  if(what==='goto'&&it.jump){const p=S.current(parts,it.jump);if(p)navigatePart(p.id,it.jump);return;}
  if(what==='goto'){saveState({view:'map',scene:it.portal},true);restore(currentState());return;}
  select(id);if(what==='option'){$('node-detail').querySelector('[data-action="add-option"]')?.click();return;}
  if(what==='pin'){if(node(id).branchWhen){canvas.tell('조건 충족 / 그 외 두 출력에서 이어 주세요.');return;}const last=node(id).rows.at(-1);editingDraft='?'+Date.now().toString(36);(prefs.s.drafts[last.row_id]||=[]).push(editingDraft);prefs.save();draw(id);$('pin-builder').querySelector('button')?.focus();canvas.tell('새 미연결 핀을 만들었습니다. 조건을 정한 뒤 출력 핀을 연결하세요.');return;}go(what==='play'?'player':'edit',id,row);
 }
 detail.onchange=e=>{if(e.target.id==='graph-order-source'){chosenOrders.set(active,e.target.value);select(active);$('graph-order-source')?.focus({preventScroll:true});return;}if(e.target.id==='graph-order'){const r=model().row(e.target.dataset.orderRow),value=e.target.value,current=node(active);if(r?.type!=='order'||r.context!==scene()||!current)return;api.change(()=>{model().set(r,'arg',value);return current.rows[0];});return;}if(e.target.id==='node-orient'){(prefs.s.portsAt||={})[active]=e.target.value;prefs.save();draw(active);return;}if(e.target.id==='pin-preset'&&e.target.value){const input=$('pin-condition');input.value=[...new Set([input.value,e.target.value].flatMap(s=>s.split('&&')).map(s=>s.trim()).filter(Boolean))].join(' && ');input.dispatchEvent(new Event('input'));e.target.value='';}};
 detail.oninput=e=>{const k=e.target.dataset.quickKey,cid=e.target.closest('[data-quick-row]')?.dataset.quickRow,n=node(active);if(!k||!cid||!n)return;const opts=model().choices(n.rows[0].arg),o=opts.find(o=>o.row_id===cid);if(!o)return;
  api.quickSet(o,k,e.target.value,e.inputType==='insertReplacementText');if(k==='when'||k==='effects'){const ps=item(active).ports,i=ps.findIndex(p=>p.choice===cid);if(i>=0){ps[i].flagExpr=[R.readable(o.when),R.authorEffects(o.effects),ps[i].predicate].join(' ');const mark=document.querySelector('[data-node="'+CSS.escape(active)+'"]')?.querySelectorAll('.port-marks')[i];if(mark)W.LunaFlagPicker.markers(mark,ps[i].flagExpr);}}
  if(k==='text.ko'){const it=item(active),i=it.ports.findIndex(p=>p.choice===cid),text=plain(e.target.value);if(i<0)return;it.ports[i].label=text;it.excerpt=opts.map(c=>plain(c['text.ko'])).join(' / ');
   const card=document.querySelector('[data-node="'+CSS.escape(active)+'"]');card.querySelectorAll('.port-label span')[i].textContent=text;card.querySelectorAll('.socket-out')[i].setAttribute('aria-label',text+' 출력 핀');card.querySelectorAll('.socket-out')[i].title=text+' · 끌어서 연결';card.querySelector('.excerpt').textContent=it.excerpt;card.querySelector('.excerpt').title=it.excerpt;for(const [j,b] of [...detail.querySelectorAll('.flow-jump')].entries()){const edge=dests(n)[j];if(edge.choice===cid){edge.label=text;b.querySelector('small').textContent=text;}}filter();}
 };
 $('map-add').onclick=()=>author.open(node(active));
 $('map-create').onclick=()=>{const b=$('map-port').getBoundingClientRect();createAt(b.left+b.width/2,b.top+b.height/3);};
 detail.onclick=e=>{
  const b=e.target.closest('button'),n=node(active);if(!b||!n)return;const last=n.rows.at(-1);
  if(b.hasAttribute('data-inspect-key')){inspectPin(active,b.dataset.inspectKey);return;}
  if(b.dataset.editDraft){inspectPin(active,R.pinKey('',b.dataset.editDraft));return;}
  if(b.dataset.delOption){
   const id=b.dataset.delOption,linked=n.routes.filter(r=>r.choice===id);if(linked.length&&!confirm('이 선택지와 연결된 분기선도 해제할까요? 되돌리기로 복구할 수 있습니다.'))return;
   api.change(()=>{for(const r of linked)R.disconnect(model(),scene(),r);model().removeChoice(last.arg,id);return last;});return;
  }
  if(b.dataset.edge!=null){const edge=dests(n)[+b.dataset.edge];if(edge.to)select(edge.to,true);else if(edge.targetScene)action('goto:'+edge.targetScene,'goto');return;}
  if(b.dataset.row){action(active,'edit',b.dataset.row);return;}
  if(b.dataset.revise){const r=n.routes.find(r=>r.id===b.dataset.revise),val=detail.querySelector('[data-route-value="'+CSS.escape(r.id)+'"]').value.trim();api.change(()=>{F.checkGuard(val);R.revise(model(),scene(),n,r,node(r.target),val);return last;});return;}
  if(b.dataset.split){prefs.s.breaks=[...new Set([...(prefs.s.breaks||[]),b.dataset.split])];prefs.save();draw(b.dataset.split);canvas.locate();return;}
  if(b.dataset.clearScene){api.change(()=>R.sceneWire(model(),scene(),n,b.dataset.clearScene,''));return;}
  if(b.dataset.removeRoute){api.change(()=>{R.disconnect(model(),scene(),n.routes.find(r=>r.id===b.dataset.removeRoute));return last;});canvas.tell('연결 해제 · 원래 순서와 조건으로 돌아갑니다.');return;}
  if(b.dataset.removeDraft){dropDraft(active,b.dataset.removeDraft);return;}
  switch(b.dataset.action){
   case 'before-end':author.open(n,'before');break;
   case 'whole-map':navigatePart(S.all,n.id);break;
   case 'add-option':{const ok=api.change(()=>{model().addChoice(last.arg);return last;});if(ok)detail.querySelector('.quick-option:last-of-type textarea')?.focus();break;}
   case 'edit':case 'play':action(active,b.dataset.action);break;
   case 'add-pin':{
    const value=$('pin-condition').value.trim();try{
     if(!value||value==='true')throw Error('조건을 하나 이상 선택하세요. 무조건 이동은 ‘다음 흐름’ 핀을 사용합니다.');
     F.checkGuard(value);if(value.includes('flag.bp_'))throw Error('편집기의 연결 플래그는 조건에 사용할 수 없습니다.');
     const samePin=item(active).ports.find(p=>p.key===R.pinKey(null,value));if(samePin&&editingDraft!==samePin.predicate){
      prefs.s.drafts[last.row_id]=(prefs.s.drafts[last.row_id]||[]).filter(x=>x!==editingDraft);editingDraft='';prefs.save();draw(active);
      canvas.startWire(active,item(active).ports.findIndex(p=>p.key===R.pinKey(null,value)));break;
     }
     prefs.s.drafts[last.row_id]=(prefs.s.drafts[last.row_id]||[]).filter(x=>x!==editingDraft&&x!==value);editingDraft='';prefs.s.drafts[last.row_id].push(value);prefs.save();draw(active);canvas.startWire(active,item(active).ports.findIndex(p=>p.predicate===value));
    }catch(err){canvas.tell(err.message);}break;}
   case 'multi-response':{const value=$('pin-condition').value.trim();if(n.routes.length){canvas.tell('연결된 분기가 있습니다. 도착 위치의 노드 앞에 조건부 대사를 추가하세요.');return;}api.change(()=>F.addResponse(model(),scene(),n,null,value));break;}
   case 'guard':{const g=$('node-when').value.trim();if(g===(n.branchWhen||n.when))return;api.change(()=>{F.checkGuard(g);if(n.branchWhen){const route=n.routes.find(r=>r.predicate===n.branchWhen);if(route)R.revise(model(),scene(),n,route,node(route.target),g);else R.setDecision(model(),n.rows[0],g);return n.rows[0];}
    if(/\b(?:order_match|grade|craft_grade|final_grade)\b/.test(g)&&model().rows(scene()).slice(0,n.index).filter(r=>['order','serve'].includes(r.type)).at(-1)?.type!=='serve')throw Error('제공한 뒤에만 결과 조건을 사용할 수 있습니다.');
    for(const r of n.rows)model().set(r,'when',R.preserve(r.when,g,'&&',r));return n.rows[0];});break;}
   case 'insert-choice':case 'response':case 'new-line':{
    if(n.routes.length){canvas.tell('이 노드에는 연결된 분기가 있습니다. 도착 노드에 추가하거나 연결 해제 후 추가하세요.');break;}
    api.change(()=>{
     if(b.dataset.action==='insert-choice')return F.insertChoice(model(),scene(),n);
     if(b.dataset.action==='response')return F.addResponse(model(),scene(),n,$('response-pick').value,$('response-pick').value);
     const list=model().rows(scene()),at=list.indexOf(last)+1,r=model().add(scene(),at,'say');model().set(r,'actor',last.actor||'luna');model().set(r,'when',last.when);
     prefs.s.breaks=[...new Set([...(prefs.s.breaks||[]),r.row_id,list[at]?.row_id].filter(Boolean))];prefs.save();return r;
    });break;}
  }
 };
 $('map-direction').onchange=e=>{prefs.s.direction=e.target.value;prefs.save();draw(active);canvas.locate();};
 $('map-arrange').onclick=()=>{const ids=Object.keys(prefs.s.positions[prefs.s.direction]||{});if(ids.length&&!confirm('이 방향의 카드 위치를 자동 정렬할까요? 대사와 연결은 그대로 유지합니다.'))return;recordPositions(ids.map(id=>[id,null]));canvas.locate();};
 $('map-bookmark').onchange=e=>{if(e.target.value){const it=item(e.target.value);if(it?.portal||it?.jump)action(it.id,'goto');else select(e.target.value,true);}e.target.value='';};
 $('map-mode').onclick=$('line-to-map').onclick=()=>{if(model()&&!opened){const n=previewGraph(scene()).nodes.find(n=>n.rows.some(r=>r.row_id===api.selected()));if(['edit','section-lines'].includes(currentState()?.view)&&currentState()?.depth&&!currentState().editHop)back();else go('map',n?.id);}};
 $('line-mode').onclick=()=>{if(model())go('lines',active);};
 $('line-node-preview').onclick=()=>{if(!model())return;const row=api.selected(),n=previewGraph(scene()).nodes.find(n=>n.rows.some(r=>r.row_id===row));if(n)go('line-player',n.id,row);};
 window.addEventListener('popstate',()=>restore(currentState()||{view:'map',scene:scene()}));
 window.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||e.isComposing||document.querySelector('dialog[open]'))return;if(canvas.cancelNodeDrag()){e.preventDefault();return;}if(canvas.connecting||!opened){e.preventDefault();back();}});
 return {open,draw,applyLayout,cancelNodeDrag:canvas.cancelNodeDrag,locateRow(rowId,loc){const n=F.compile(model(),scene(),prefs?.s.breaks).nodes.find(n=>n.rows.some(r=>r.row_id===rowId));if(!n)return;go('map',n.id);if(loc){const actual=graph?.nodes.find(x=>x.rows.some(r=>r.row_id===rowId));if(!actual)return;select(actual.id,true);const pin=item(actual.id)?.ports.find(p=>loc.routeId?p.routeId===loc.routeId:loc.pin&&p.predicate===loc.predicate);if(pin)inspectPin(actual.id,pin.key);}},switchScene(id){if(!id||id===scene())return;saveState({view:opened?'map':'lines',scene:id},true);restore(currentState());},get opened(){return opened;},get selectedNode(){return active;},get modal(){return player.isOpen||tester.isOpen;},ready(){
  $('map-mode').disabled=false;$('scene-run').disabled=false;const s=currentState()||{view:new URLSearchParams(location.search).get('view')==='flow'?'map':'lines',scene:scene(),depth:0};saveState(s,false);restore(s);
 }};
}
W.LunaBarFlowView={create};
})(window);
