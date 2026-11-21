/* A free-standing card is real CSV with an always-false guard until plugged in.
 * On attachment the ordinary forward-wire compiler supplies its activation flag. */
(function(W){'use strict';
const browser=typeof module==='undefined',F=browser?W.LunaBarFlow:require('./flow-model.js'),R=browser?W.LunaBarWiring:require('./flow-wiring.js'),D=browser?W.LunaBarDays:require('./flow-days.js');
const group=r=>r?.row_id?.match(/^(editor_block_[a-f0-9]{32})_\d+$/)?.[1]||'',parts=v=>F.clean(v).split('&&').map(x=>x.trim()).filter(Boolean);
const loose=R.asleep,members=(m,s,g)=>m.rows(s).filter(r=>group(r)===g);
const types={say:['대사','대화','“'],choice:['선택지','대화','⑂'],condition:['조건 분기','분기','◇'],enter:['손님 입장','손님','↳'],exit:['손님 퇴장','손님','↱'],coaster:['코스터 제공','서비스','▱'],orderSet:['주문 → 제조 → 제공','서비스','◇'],empty_glass:['빈잔으로 교체','서비스','▽'],effect:['플래그 · 소지금 · 호감도','진행','⚑'],tutorial:['튜토리얼','진행','?'],end_part:['영업 종료','진행','■']};
function create(m,scene,p){
 if(!types[p.type])throw Error('알 수 없는 노드 종류입니다.');F.checkGuard(p.when||'');
 if(p.type==='condition'&&(!p.when?.trim()||p.when.includes('flag.bp_')||parts(p.when).includes('false')))throw Error('검사할 플래그나 주문·등급 조건을 고르세요.');
 if(p.type==='effect'&&(!p.effect||!p.effect.split(';').every(c=>/^(?:flag\.\w+\s*=\s*(?:true|false)|affinity\.\w+\s*(?:\+=|-=|=)\s*-?\d+|money\s*(?:\+=|-=)\s*\d+)$/.test(c.trim()))))throw Error('기록할 값을 먼저 고르세요.');
 const g='editor_block_'+crypto.randomUUID().replaceAll('-',''),list=m.rows(scene),term=list.findIndex(r=>r.type==='end_part'&&!group(r)),index=term<0?list.length:term,block=[];
 for(const type of p.type==='orderSet'?['order','craft','serve']:p.type==='condition'?['effect','effect']:[p.type]){
  const row=m.add(scene,index+block.length,type),old=row.row_id,id=g+'_'+(p.type==='condition'?900+block.length:block.length),choiceGroup=row.arg;
  const spec=m.views.tables.steps.rows.find(s=>s.id===old);spec.id=id;row.row_id=row.web_row_id=id;D.neutral(m,row,p.actor||'luna');
  if(type==='say'){row.dialogue_id='dlg_'+id;m.set(row,'arg','default');m.set(row,'text.ko',p.text||'새 대사');}
  if(['order','tutorial','enter'].includes(type))m.set(row,'arg',p.arg);
  if(p.type==='effect')m.set(row,'effects',p.effect);
  if(type==='choice'){m.set(row,'arg',choiceGroup);const original=m.choices(row.arg);while(m.choices(row.arg).length>2)m.removeChoice(row.arg,m.choices(row.arg).at(-1).row_id);
   if(original.length===1)m.addChoice(row.arg);for(const [i,c]of m.choices(row.arg).entries()){for(const k of ['effects','when','goto','text.en','lock_reason.ko','lock_reason.en'])m.set(c,k,'');m.set(c,'text.ko','새 선택지 '+(i+1));}}
  m.set(row,'when',['false',p.type==='condition'&&block.length?'':p.when].filter(Boolean).join(' && '));block.push(row);
 }return block[0];
}
function check(m,s,src,dst,port,moving=false){
 if((!moving&&!loose(dst?.rows[0]))||!group(dst.rows[0])||dst.rows[0]!==members(m,s,group(dst.rows[0]))[0])return '독립 노드의 첫 입력 핀을 선택하세요.';
 if(!src||src.rows.at(-1).type==='end_part'||group(src.rows[0])===group(dst.rows[0]))return '자기 자신이나 종료 뒤에는 연결할 수 없습니다.';
 const last=src.rows.at(-1);if(group(last)&&last!==members(m,s,group(last)).at(-1))return '주문·제조·제공 묶음은 마지막 제공 핀에서 다음 노드에 연결하세요.';
 if(src.rows.at(-1).sync==='no_wait'||src.index+src.rows.length<m.prefix(s))return '고정된 시작 배치 또는 동시 입장 사이는 연결할 수 없습니다.';
 if(port.choice&&F.clean(m.choices(src.rows.at(-1).arg).find(c=>c.row_id===port.choice)?.goto))return '기존 장면 이동 연결을 먼저 해제하세요.';
 return '';
}
function bind(m,s,src,dst,port){
 const error=check(m,s,src,dst,port);if(error)throw Error(error);
 const target=dst.rows[0],head=src.rows[0].row_id,last=src.rows.at(-1),block=members(m,s,group(target)),plan=R.scan(m,s);
 const prior=src.routes.find(r=>R.pinKey(r.choice,r.predicate)===R.pinKey(port.choice,port.predicate));if(prior)R.disconnect(m,s,prior);
 // Move a chain built while detached together, including its native routing instructions.
 const collect=new Set(block),live=R.scan(m,s);for(let size=-1;size!==collect.size;){size=collect.size;for(const r of live.routes)if(collect.has(m.row(r.source))){
  const next=m.row(r.target);if(!group(next)||!parts(next.when).includes(r.gate)&&!parts(next.when).includes('flag.bp_join_'+group(next).slice('editor_block_'.length)))throw Error('연결한 뒤 이동할 수 없는 경로가 있습니다. 해당 출력을 먼저 해제하세요.');
  for(const row of [...r.steps,...members(m,s,group(next))])collect.add(row);
 }}
 const groups=new Set([...collect].map(group).filter(Boolean));for(const r of live.routes)if(collect.has(m.row(r.target))&&!collect.has(m.row(r.source)))throw Error('다른 흐름과 이미 합류한 묶음입니다. 외부 연결을 먼저 해제하세요.');
 for(const row of m.rows(s))if(groups.has('editor_block_'+R.mergeOwner(row)))collect.add(row);
 if(collect.has(last))throw Error('순환 연결은 만들 수 없습니다.');
 const list=m.rows(s),rest=list.filter(r=>!collect.has(r)),siblings=live.routes.filter(r=>r.source===last.row_id),anchor=siblings.at(-1)?.steps.at(-1)||last,ix=rest.indexOf(anchor)+1;
 // A route also crosses this slot when its target is exactly the row to our
 // right. Looking only at that row's negative guards would steal its input.
 const inherited=live.routes.filter(r=>rest.indexOf(m.row(r.source))>=0&&rest.indexOf(m.row(r.source))<ix&&rest.indexOf(m.row(r.target))>=ix).map(r=>'!'+r.gate);
 rest.splice(ix,0,...list.filter(r=>collect.has(r)));m.reorder(s,rest.map(r=>r.row_id));
 for(const r of block)m.set(r,'when',[...new Set([...inherited,...siblings.map(s=>'!'+s.gate),...parts(r.when).filter(t=>t!=='false'&&!/^!?flag\.bp_path_/.test(t))])].join(' && '));
 for(const r of live.logical)if(collect.has(r)&&!block.includes(r))m.set(r,'when',[...new Set([...inherited,...parts(r.when)])].join(' && '));
 const marks=[head,target.row_id,...plan.logical.map(r=>r.row_id)],graph=F.compile(m,s,marks),a=graph.nodes.find(n=>n.rows.includes(last)),b=graph.nodes.find(n=>n.rows.includes(target));
 R.wire(m,s,a,b,{...port,routeId:''});return target;
}
// The order in which the author plugs parallel replies into a join is not an
// execution rule. If the later reply is plugged last, move only the authored
// subtree forward, then recompile its existing inputs. Never move a native event.
function movable(m,s,src,dst){
 const target=dst?.rows[0],last=src?.rows.at(-1),g=group(target);
 if(!last||!g||target!==members(m,s,g)[0]||last===target||dst.index>src.index)return false;
 const routes=R.scan(m,s).routes,seen=new Set([g]);
 for(let size=-1;size!==seen.size;){size=seen.size;for(const r of routes)if(seen.has(group(m.row(r.source)))){
  const next=group(m.row(r.target));if(!next)return false;seen.add(next);
 }}
 return !seen.has(group(last))&&!routes.some(r=>seen.has(group(m.row(r.target)))&&m.row(r.target)!==target&&!seen.has(group(m.row(r.source))));
}
// Two adjacent, mutually exclusive arms may be serialized in either order.
// Move complete arms (including private CSV signal rows), not just the card.
function siblingReturn(m,s,src,dst,p){
 if(!src||!dst||dst.index>=src.index||src===dst||p.predicate||src.routes.length)return null;
 const last=src.rows.at(-1),head=dst.rows[0],guard=R.readable(head.when);
 if(!/^!?flag\.(?!bp_)\w+$/.test(guard)||group(head)||!['say','choice'].includes(last.type)||
    (last.type==='choice')!==!!p.choice)return null;
 const other=guard.startsWith('!')?guard.slice(1):'!'+guard,flag=guard.replace(/^!/,'');
 const plan=R.scan(m,s),rows=m.rows(s),logical=plan.logical,start=logical.indexOf(head);
 if(plan.errors.length||start<0||dst.index<m.prefix(s)||rows[dst.index-1]?.sync==='no_wait'||R.mergeOwner(rows[dst.index-1]))return null;
 const arm=(at,test)=>{
  const owned=new Set();let i=at;
  for(;i<logical.length;i++){
   const row=logical[i];
   if(group(row)){
    const incoming=plan.routes.filter(r=>r.target===members(m,s,group(row))[0]?.row_id);
    if(!incoming.length||incoming.some(r=>!owned.has(r.source)))break;
   }else if(R.readable(row.when)!==test)break;
   const writers=[row,...(row.type==='choice'?m.choices(row.arg):[])];
   if(writers.some(w=>F.clean(w.effects).split(';').some(v=>v.trim().split(/\s*=/)[0]===flag)))return null;
   owned.add(row.row_id);
  }
  return {end:i,owned};
 };
 const a=arm(start,guard);if(!a||logical[a.end]===undefined||R.readable(logical[a.end].when)!==other)return null;
 const b=arm(a.end,other);if(!b?.owned.has(last.row_id))return null;
 const zone=id=>a.owned.has(id)?1:b.owned.has(id)?2:0;
 if(plan.routes.some(r=>zone(r.source)!==zone(r.target)))return null;
 const mid=rows.indexOf(logical[a.end]),end=logical[b.end]?rows.indexOf(logical[b.end]):rows.length;
 if([mid,end].some(i=>rows[i-1]?.sync==='no_wait'||R.mergeOwner(rows[i])))return null;
 const skipped=logical.slice(logical.indexOf(last)+1,b.end);
 if(skipped.some(r=>['enter','exit','coaster','order','craft','serve','end_part'].includes(r.type)))return null;
 const owner=p.choice?m.choices(last.arg).find(o=>o.row_id===p.choice):last;
 if(!owner||F.clean(owner.goto))return null;
 return {order:[...rows.slice(0,dst.index),...rows.slice(mid,end),...rows.slice(dst.index,mid),...rows.slice(end)].map(r=>r.row_id),
  owner,flag,value:!guard.startsWith('!')};
}
function targetProblem(m,s,src,dst,p){
 if(loose(dst?.rows[0]))return check(m,s,src,dst,p);
 if(movable(m,s,src,dst))return check(m,s,src,dst,p,true);
 if(siblingReturn(m,s,src,dst,p))return '';
 return R.problem(m,s,src,dst,p);
}
function attach(m,s,src,dst,p){
 if(loose(dst?.rows[0]))return bind(m,s,src,dst,p);
 const swap=siblingReturn(m,s,src,dst,p);
 if(swap){
  m.reorder(s,swap.order);
  m.set(swap.owner,'effects',[F.clean(swap.owner.effects),swap.flag+' = '+swap.value].filter(Boolean).join('; '));
  const g=F.compile(m,s,[src.id,dst.id]);
  return R.wire(m,s,g.nodes.find(n=>n.rows.includes(src.rows.at(-1))),g.nodes.find(n=>n.id===dst.id),p);
 }
 if(!movable(m,s,src,dst))return R.wire(m,s,src,dst,p);
 const target=dst.rows[0],source=src.rows.at(-1),ins=R.scan(m,s).routes.filter(r=>r.target===target.row_id);
 const restore=ins.map(r=>({source:r.source,choice:r.choice,predicate:r.predicate})).filter(r=>r.source!==source.row_id||R.pinKey(r.choice,r.predicate)!==R.pinKey(p.choice,p.predicate));
 for(const r of ins)R.disconnect(m,s,r);
 const find=(id)=>F.compile(m,s,[target.row_id,src.id,...restore.map(r=>r.source)]).nodes.find(n=>n.rows.some(r=>r.row_id===id));
 bind(m,s,find(source.row_id),find(target.row_id),{...p,routeId:''});
 for(const r of restore)R.wire(m,s,find(r.source),find(target.row_id),r);
 return target;
}
function remove(m,s,row){
 const g=group(row);if(!g)throw Error('직접 만든 노드만 삭제할 수 있습니다.');const block=members(m,s,g),ids=new Set(block.map(r=>r.row_id));
 for(const r of R.scan(m,s).routes.filter(r=>ids.has(r.source)||ids.has(r.target)))R.disconnect(m,s,r);
 for(const r of block){const options=r.type==='choice'?m.choices(r.arg):[];m.remove(s,r.row_id);
  if(options.length&&!m.tables.steps.some(o=>o.type==='choice'&&o.arg===r.arg)){const keys=new Set(options.map(o=>o.web_row_id)),grp=m.tables.bar_choice_groups.find(b=>b.choice_group===r.arg);
   m.tables.bar_choices=m.tables.bar_choices.filter(o=>!keys.has(o.web_row_id));m.tables.bar_choice_groups=m.tables.bar_choice_groups.filter(o=>o!==grp);
   m.views.tables.bar_choices.rows=m.views.tables.bar_choices.rows.filter(o=>!keys.has(o.id));m.views.tables.bar_choice_groups.rows=m.views.tables.bar_choice_groups.rows.filter(o=>o.key?.choice_group!==r.arg&&o.id!==grp.row_id);}}
 return m.rows(s).at(-1);
}
const api={types,group,loose,create,check,bind,targetProblem,attach,siblingReturn,remove};if(browser)W.LunaBarLooseNodes=api;else module.exports=api;
})(globalThis);
