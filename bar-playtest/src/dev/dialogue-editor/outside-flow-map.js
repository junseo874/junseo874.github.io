/* Exterior authoring follows encounters and their actual CSV row identities (not bar seats). */
(function(root){
'use strict';
const sites=[
 ['believer','기신교 신도','거리','believer/','believer'],['newspaper','신문 읽는 남자','거리','newspaper/','newspaper'],
 ['beggar','노숙자','거리','beggar/','beggar'],['witness','근처 행인','거리','beggar/warning/','witness'],
 ['thug','복도 불량배','복도','thug/','thug'],['information','옆집 아저씨','복도','notion/,choices/pay-','information'],
 ['shop','개시바','가게','shop/','shop'],['repair','수리공','거리','neighborhood/repair','repair'],
 ['guard','갱단 경비','거리','neighborhood/guard','guard'],['boss','갱단 보스 · 동료','거리','neighborhood/boss','camp'],
 ['cat','부비 · 옆집 아저씨','복도','neighborhood/cat,neighborhood/feed,neighborhood/reveal','box'],
 ['home-cat','부비 · 크리스','집','neighborhood/homeCat,neighborhood/rest','home-cat'],
 ['samho','삼호','거리','commute2,commute3','commute2,commute3'],['contract','삼호 · 밀수업자','거리','notion/contract','contract'],
 ['trade','삼호 · 밀수업자','거리','ambient/outside_day1_samho','trade'],
 ['store-pair','편의점 앞 행인','거리','ambient/outside_day0_store','store-pair'],
 ['bar-pair','바 앞 행인','거리','ambient/outside_day0_port','bar-pair'],
 ['residents','상층 주민','복도','ambient/outside_day0_building','residents'],
 ['commute-pair','출근길 행인','거리','ambient/outside_day1_commute','commute-pair'],
 ['reopening-pair','재개점 소문 행인','거리','ambient/outside_day2_commute','reopening-pair'],
 ['poster','수배 전단','거리','ambient/outside_day0_shiba',''],['news','TV 뉴스','방송','ambient/outside_day0_tv,ambient/outside_day1_tv',''],
 ['room','집 오브젝트','집','home/',''],['terrace','크리스 · 테라스','테라스','night0,night1,night2,ending',''],
 ['memory','회상 인물','회상','terraceMemory,johnny',''],['workshop','작업실','보관','workshop','']
].map(([id,name,place,prefixes,pins])=>({id,name,place,prefixes:prefixes.split(','),pins:pins?pins.split(','):[]}));
const other={id:'other',name:'기타 대화',place:'기타',pins:[]};
function site(m,f,seen=new Set()){
 if(!f||seen.has(f.id))return other;seen.add(f.id);
 if(f.id.startsWith('graph/'))return sites.find(s=>f.ref.scene.startsWith('graph_'+s.id+'_'))||other;
 if(f.id.startsWith('editor/')){const option=m.tables.street_choices.find(c=>c.row_id===f.parent);return site(m,m.owner(option?.parent_id),seen);}
 let match=null,len=-1;for(const s of sites)for(const p of s.prefixes)if(f.id.startsWith(p)&&p.length>len){match=s;len=p.length;}return match||other;
}
function destination(m,r,c){
 const route=c.route||'';if(route.startsWith('flow:'))return{flow:route.slice(5)};
 if(route==='continue')return{next:true};if(route==='end')return{label:'대화 종료',end:true};
 const id=route.replace(/^native:/,''),line=m.step(r),stage=line.stage;
 const newspaper=m.newspaperDest(r,c);if(newspaper)return{flow:newspaper,native:true};
 const known={'thug-pay':'thug/paid','thug-refuse':'thug/refused','beggar-pay':'beggar/paid','beggar-refuse':'beggar/refused','beggar-question':'beggar/questioned',feed:'neighborhood/feed',talk:'neighborhood/repairIntro',gear:'neighborhood/repairPaid',pay:'neighborhood/repairPaid',ask:'neighborhood/guardPass',press:'home/wardrobePressed'};
 let flow=m.projected.data.newspaperRoutes.routes[id]?.[0]||known[id];
 if(id.startsWith('info-')&&['gang','coratech','chris'].includes(id.slice(5)))flow='choices/pay-'+id.slice(5);
 if(id==='info-pay'&&line.topic)flow='notion/info/'+line.topic;
 if(id==='boss-wait'&&stage==='boss-first')flow='neighborhood/bossWait';
 if(['boss-pay','boss-repair'].includes(id))flow='neighborhood/boss'+(id==='boss-pay'?'Pay':'Repair')+(stage==='boss-first'?'First':'Repeat');
 if(id==='shop-yes'&&stage==='greeting')flow='shop/browse';
 if(id==='shop-no')flow=stage==='greeting'?'shop/noBrowse':'shop/noStockPurchase';
 if(id==='shop-buy-bitters')flow='shop/purchased';
 if(id==='shop-allowance-yes')flow='shop/allowanceYes';
 if(flow&&m.flow(flow))return{flow,native:true};
 return{label:({pet:'쓰다듬기',cancel:'대화 종료','info-cancel':'구매 취소','shop-no':'구매 취소','shop-buy-bitters':'비터스 거래','shop-buy-tuna_can':'참치캔 거래','shop-allowance-yes':'용돈 받기','shop-allowance-no':'용돈 거절'})[id]||'본편 사건 처리',native:true};
}
const kinds={talk:'대화',choice:'선택',cue:'사건',join:'공통 대화'};
function optionInScope(m,owner,c,dest,allow,allowWhen){
 const target=dest.flow&&m.flow(dest.flow);
 return (!allowWhen||allowWhen(c.when,owner))&&(!allow||!target||allow(target));
}
function graph(m,siteId,allow,allowWhen){
 return m.withReadIndex(()=>buildGraph(m,siteId,allow,allowWhen));
}
function buildGraph(m,siteId,allow,allowWhen){
 const flows=m.visibleFlows().filter(f=>site(m,f).id===siteId&&(!allow||allow(f))),nodes=[],edges=[],byRow=new Map(),first=new Map(),seqs=new Map();
 for(const f of flows){const seq=m.sequence(f.id),ids=[];let n=null,prevOwner=null;
  for(const row of seq){const owner=m.owner(row.row_id),id=row.row_id,step=m.step(row),type=m.isMenu(row)?'choice':(['say','timeline'].includes(step.type)&&!step.action&&!step.cinema?'talk':'cue');
   if(allow&&owner&&!allow(owner))continue;
   if(byRow.has(id)){n=byRow.get(id);if(ids.at(-1)!==n.id)ids.push(n.id);n=null;continue;}
   const breaks=m.views.outsideEditorBreaks?.[row.parent_id];
   if(!n||prevOwner!==owner?.id||n.kind!==type||type!=='talk'||(breaks?breaks.includes(id):n.rows.length>=6)){n={id,flow:f.id,owner:owner?.id,first:!ids.length,kind:type,rows:[],ports:[],title:owner?.title||f.title};nodes.push(n);ids.push(id);}
   n.rows.push(row);byRow.set(id,n);prevOwner=owner?.id;
  }first.set(f.id,ids[0]);seqs.set(f.id,ids);
 }
 const edge=(from,to,port)=>{if(from&&to&&from!==to&&!edges.some(e=>e.from===from&&e.to===to&&e.port===port))edges.push({from,to,port});};
 const byId=new Map(nodes.map(n=>[n.id,n]));
 for(const [flow,ids]of seqs)ids.forEach((id,i)=>{const n=byId.get(id),next=ids[i+1];
  if(n.kind!=='choice')edge(id,next,-1);else{
   n.ports=m.menu(n.rows[0]).map((c,j)=>{const dest=destination(m,n.rows[0],c),outsideDay=!optionInScope(m,m.flow(n.owner||flow),c,dest,allow,allowWhen),to=outsideDay?undefined:dest.next?next:first.get(dest.flow);edge(id,to,j);return{c,dest,to,outsideDay};});
  }
 });
 for(const n of nodes)if(n.kind==='talk'&&edges.filter(e=>e.to===n.id).length>1)n.kind='join';
 const N=root.LunaOutsideNodes||(typeof require==='function'&&require('./outside-node-authoring.js'));
 for(const n of nodes){
  const f=m.flow(n.owner||n.flow),kind=N.graphView(m,f)?.kind;n.authored=kind;n.extra=[];
  const add=(slot,label,j)=>{const target=N.targetOf(m,j),to=first.get(target?.id),index=n.ports.length+n.extra.length;n.extra.push({slot,label,flow:target?.id,to});edge(n.id,to,index);};
  if(N.tailPin(m,n)){
   const jumps=N.all(m,f.parent).filter(r=>N.isLink(r)&&N.shapeOf(N.targetOf(m,r))?.[2]!=='repeat');
   if(kind==='condition'){add('yes','조건 충족',jumps.find(r=>r.when));add('no','그 외',jumps.find(r=>!r.when));}
   else add('next','다음 노드',jumps.at(-1));
  }
  const entries=N.repeatEntries(m,f);
  if(!kind&&entries.length&&n.id===first.get(f.id)&&(flows[0]?.id===f.id||entries.some(e=>e.id===f.id))){
   const j=N.all(m,entries[0].parent).find(r=>N.isLink(r)&&N.shapeOf(N.targetOf(m,r))?.[2]==='repeat');add('revisit','↻ 다시 말을 걸 때',j);
  }
 }
 return{flows,nodes,edges,byRow,first};
}
// Follow the current encounter's sequence, not the order of cards on the canvas.
// Shared tails (newspaper) already belong to that sequence. Authored subflows
// instead return to the row after the menu. Planning must not consume that return.
function previewNext(m,flow,node,option,returns=[]){
 const sequence=m.sequence(flow),last=node.rows.at(-1),i=sequence.findIndex(r=>r.row_id===last.row_id);
 if(i<0)return {end:true,label:'현재 대본에 없는 줄입니다.'};
 const trail=returns.slice(),after=sequence[i+1],tail=after&&{flow,row:after.row_id};
 const outputs=(node.extra||[]).filter(p=>p.slot!=='revisit'),pin=option?.graphSlot?outputs.find(p=>p.slot===option.graphSlot):outputs.length===1?outputs[0]:null;
 if(pin?.flow){const r=m.sequence(pin.flow)[0];if(r)return{flow:pin.flow,row:r.row_id,trail:[]};}
 if(outputs.length>1&&!option)return{needsChoice:true};
 if(m.isMenu(last)){
  if(!option)return {needsChoice:true};
  const dest=destination(m,last,option);
  if(dest.flow){
   const first=m.flow(dest.flow)&&m.sequence(dest.flow)[0];
   if(!first)return {end:true,label:'연결한 흐름에 재생할 대사가 없습니다.'};
   const transfer=m.optionJump(option.row)?.row_id.startsWith('exterior_editor_link_');if(transfer)trail.length=0;else if(tail&&option.route?.startsWith('flow:')&&m.kind(last)!=='newspaper-choice')trail.push(tail);
   return {flow:dest.flow,row:first.row_id,trail};
  }
  if(!dest.next)return {end:true,label:dest.label||'대화 종료',native:dest.native};
 }
 const next=tail||trail.pop();return next?{...next,trail}:{end:true,label:'대화 종료'};
}
const api={sites,site,graph,kinds,destination,previewNext,optionInScope};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaOutsideFlowMap=api;
})(typeof window==='undefined'?globalThis:window);
