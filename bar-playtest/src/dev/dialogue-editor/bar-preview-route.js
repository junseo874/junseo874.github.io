/* An audition owns its route and effects. Looking ahead is pure; only the
   Next Node button commits a destination. Never drive the editor or game save. */
(function(root){
'use strict';
const {decode,rules}=typeof module==='undefined'?root.LunaDialogueEditorModel:require('./editor-model.js');
const settlement=(typeof module==='undefined'?root.LunaGameParts.settlement:require('../../features/bar/settlement.js'))({
 condition:rules.condition,n:v=>Number(v)||0,sortSeq:a=>[...a].sort((x,y)=>Number(x.seq)-Number(y.seq)),root:{}
}).prototype;
const affinityLabel=(change,name)=>change?name(change.actor)+' 호감도 '+(change.delta>0?'+':'')+change.delta:'';
const options=(m,row)=>row.type==='choice'?m.choices(row.arg).map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,decode(v)]))):[];
const terms=expr=>decode(expr).split('&&').map(s=>s.trim()).filter(Boolean);
// Find a preview context in which each required guard passes and each skipped
// guard fails. Negating an AND needs only ONE failed term, not all of them.
// Day, unknown rule values and generated wire signals are never invented.
function witness(seed,required,skipped=[]){
 const passes=s=>required.every(x=>rules.condition(x,s))&&skipped.every(x=>!rules.condition(x,s));
 if(passes(seed))return seed;
 function solve(checks){
  const state=structuredClone(seed),groups=new Map();
  for(const [term,want] of checks){
   const raw=term.match(/^!?(flag\.\w+|order_match|affinity\.\w+|money|craft_grade|final_grade|grade)\b/)?.[1];
   if(!raw||/^flag\.bp_(?:path|take)_editor_/.test(raw)){if(rules.condition(term,state)!==want)return null;continue;}
   const key=raw==='grade'?'final_grade':raw;if(!groups.has(key))groups.set(key,[]);groups.get(key).push([term,want]);
  }
  for(const [key,tests] of groups){
   const ok=()=>tests.every(([t,v])=>rules.condition(t,state)===v);if(ok())continue;
   const [kind,id]=key.split('.'),obj=kind==='flag'?state.flags:kind==='affinity'?state.affinity:state,field=id||key;
   const values=kind==='flag'||key==='order_match'?[false,true]:key.endsWith('_grade')?['good','decent','excellent','poor','sewage']:
    tests.flatMap(([t])=>{const n=t.match(/(-?\d+)$/);return n?[+n[1],+n[1]-1,+n[1]+1]:[];}).sort((a,b)=>Math.abs(a-(obj[field]||0))-Math.abs(b-(obj[field]||0)));
   if(!values.some(v=>{obj[field]=v;if(key==='final_grade')state.grade=v;return ok();}))return null;
  }
  const unmet=skipped.find(x=>rules.condition(x,state));
  if(unmet===undefined)return state;
  for(const t of terms(unmet)){const result=solve([...checks,[t,false]]);if(result)return result;}return null;
 }
 return solve(required.flatMap(x=>terms(x).map(t=>[t,true])));
}
function create({model,graphFor,scene,node,settings={},picks={}}){
 const initial={day:Number(model.scenes.find(s=>s.id===scene).day),phase:'bar',money:settings.money??1000,
  flags:{tom_name_known:true,day0_skip_tutorial:true,...settings.flags},affinity:{...settings.affinity},reputation:0,
  grade:settings.order_match===false?'sewage':settings.final_grade||'good',craft_grade:settings.craft_grade||'good',order_match:settings.order_match??true};
 initial.final_grade=initial.grade;
 const lanes=new Map(),services=new Map();
 function lane(id){
  if(!lanes.has(id)){
   const rows=model.rows(id).map(r=>model.step(r)),byRow=new Map(),index=new Map(rows.map((r,i)=>[r.row_id,i]));
   const graph=graphFor(id);for(const n of graph.nodes)for(const r of n.rows)byRow.set(r.row_id,n);
   for(let i=3;i<rows.length;i++)if(rows[i].type==='empty_glass'&&rows[i-3].type==='craft'&&!rows[i-3].effects&&
     rows[i-2].type==='serve'&&!rows[i-2].effects&&rows[i-2].actor===rows[i].actor&&rows[i+1]?.type==='effect'){
    services.set(rows[i].row_id,{steps:rows,index:i-3});
   }
   lanes.set(id,{id,title:model.scenes.find(s=>s.id===id)?.title,rows,index,byRow,graph});
  }return lanes.get(id);
 }
 function apply(row,state,choice){
  if(choice){if(state.day===0)state.flags.day0_choice_hold_learned=true;rules.applyEffects(decode(choice.effects),state);}
  if(row.type==='order')(state.orders??={})[row.actor]=row.arg.startsWith('exact:')?row.arg.slice(6):null;
  const story=services.get(row.row_id);
  if(story&&state.orders?.[row.actor]){
   const actor=row.actor,adjustment=settlement.reactionAffinity.call({story,ctx:()=>state},actor);
   if(adjustment){
    // Apply the same single combined change as the game, on the same row.
    state.pendingAward={actor,id:adjustment.step.row_id,delta:adjustment.delta};
   }
  }
  const award=state.pendingAward;
  if(award?.id===row.row_id){
   const t=model.projected.data.tables,id=state.order_match?state.orders[award.actor]:null;
   settlement.applyAffinity.call({t,progress:state,log(){},ctx:()=>({...state,cocktail:t.cocktails.find(c=>c.id===id),
    tags:t.cocktail_tags.filter(c=>c.context===id).map(c=>c.ko)})},award.actor,{match:state.order_match,grade:state.final_grade},award.delta);
   delete state.pendingAward;if(row.type==='effect')return;
  }
  rules.applyEffects(row.effects,state);
 }
 const first=lane(scene),ctx=structuredClone(witness(initial,[node.when])||initial),before=[],answers={};
 for(const r of first.rows.slice(0,first.index.get(node.rows[0].row_id))){
  if(!rules.condition(r.when,ctx))continue;
  const c=picks[r.row_id]&&options(model,r).find(o=>o.row_id===picks[r.row_id].row_id&&rules.condition(o.when,ctx));
  if(c)answers[r.row_id]=c;before.push(r);apply(r,ctx,c);
 }
 let here={lane:first,node,isolated:true,before,ctx:witness(ctx,[node.when])||ctx,answers};
 function auditionWhen(r){
  if(!here.isolated)return r.when;
  const wiring=typeof module==='undefined'?root.LunaBarWiring:require('./flow-wiring.js');
  return terms(wiring.readable(r.when)).filter(t=>!(t==='false'&&wiring.asleep(r))).join(' && ');
 }
 function playableFrom(index){
  const state=structuredClone(here.ctx),rows=here.node.rows;
  for(let i=here.entry||0;i<rows.length;i++){const r=model.step(rows[i]);if(!rules.condition(auditionWhen(r),state))continue;
   if(i>=index)return i;apply(r,state,null);}
  return -1;
 }
 function payload(i){
  const active=here.node.rows.map(r=>model.step(r)),row=active[i],state=structuredClone(here.ctx);
  const prior=here.before.slice();for(const earlier of active.slice(here.entry||0,i))if(rules.condition(auditionWhen(earlier),state)){prior.push(earlier);apply(earlier,state,null);}
  return {tags:model.tables.text_tags,day:initial.day,flags:initial.flags,money:initial.money,rows:prior.concat(active.slice(i)),index:prior.length,
   choices:options(model,row),picks:here.answers,pathPreview:true,previewState:state};
 }
 function departure(pick,seed){
  const state=structuredClone(seed),trail=here.before.slice(),answers={...here.answers};
  let dest=here.lane,start;const rows=here.node.rows.map(r=>model.step(r));
  for(const r of rows.slice(here.entry||0)){
   if(!rules.condition(r.when,state))continue;
   if(r.type==='end_part')return {end:true};
   let c=null;if(r.type==='choice'){
    c=options(model,r).find(o=>o.row_id===pick?.row_id&&rules.condition(o.when,state));
    if(!c)return {needsChoice:true};answers[r.row_id]=c;
   }
   trail.push(r);apply(r,state,c);
   if(c?.goto){
    if(!model.scenes.some(s=>s.id===c.goto&&Number(s.day)===initial.day))throw Error('선택지의 도착 장면을 찾을 수 없습니다.');
    dest=lane(c.goto);start=0;
   }
  }
  return {state,trail,answers,dest,start:start??dest.index.get(rows.at(-1).row_id)+1};
 }
 function follow(out,seed){
  if(!out.dest)return out;
  const {answers,dest,start}=out,trail=out.trail.slice(),state=structuredClone(seed||out.state);
  // Include the ordinary CSV effect rows that implement pins, but don't
  // offer them as visible cards. Conditions, skips and joins use game rules.
  for(let i=start;i<dest.rows.length;i++){
   const r=dest.rows[i];if(!rules.condition(r.when,state))continue;
   const target=dest.byRow.get(r.row_id);
   if(target)return {node:target,entry:target.rows.findIndex(v=>v.row_id===r.row_id),lane:dest,before:trail,ctx:state,answers};
   trail.push(r);apply(r,state);
  }
  return {end:true};
 }
 function annotate(target){
  const row=here.node.rows[0];
  if(target.ctx&&services.has(row.row_id)&&here.ctx.orders?.[row.actor]){
   const actor=row.actor;target.affinityChange={actor,delta:(target.ctx.affinity[actor]||0)-(here.ctx.affinity[actor]||0)};
  }
  return target;
 }
 function next(pick){return annotate(follow(departure(pick,here.ctx)));}
 // Evaluate this glass only. Prior orders retain their original result.
 function glassResult(match,grade){
  const state={...here.ctx,order_match:match,craft_grade:grade,grade:match?grade:'sewage',final_grade:match?grade:'sewage'};
  const story=services.get(here.node.rows[0].row_id),actor=here.node.rows[0].actor;
  if(!story||!state.orders?.[actor])return null;
  const adjustment=settlement.reactionAffinity.call({story,ctx:()=>state},actor);
  if(!adjustment)return null;
  const out=departure(null,state);if(!out.state)return null;
  return {actor,delta:(out.state.affinity[actor]||0)-(state.affinity[actor]||0),
   row:adjustment.step.type==='effect'?adjustment.step.row_id:null,correction:adjustment.delta};
 }
 // Offer actual outgoing outcomes, not every later card. For an alternate
 // pin, prove a context and run the same CSV walker (including hidden effect
 // rows) before offering it. Merely listing paths never commits effects.
 function branches(){
  const {lane:src,node}=here,rows=node.rows.map(r=>model.step(r)),last=rows.at(-1),choice=last.type==='choice';
  const edges=src.graph.edges.filter(e=>e.from===node.id),outcomes=[];
  for(const pick of choice?options(model,last):[null])try{
   const seed=witness(here.ctx,[node.when,pick?.when||'']);
   if(!seed){outcomes.push({pick,blocked:pick?.['lock_reason.ko']||'현재 일차와 이 노드에서는 선택할 수 없습니다.'});continue;}
   const out=departure(pick,seed),actual=follow(out),local=edges.filter(e=>(e.choice||'')===(pick?.row_id||''));
   const seen=new Set(),key=t=>t.node?t.lane.id+'/'+t.node.id:'end';
   function add(target,guard,assumed,via=''){
    const id=key(target)+'|'+via;if(seen.has(id))return;seen.add(id);
    outcomes.push({pick,target:annotate(target),guard,assumed});
   }
   if(!out.dest||out.dest!==src||local.length<2){add(actual,local[0]?.guard||'',seed!==here.ctx);continue;}
   const wires=node.routes.filter(r=>(r.choice||'')===(pick?.row_id||''));
   // A value assigned by this choice/row is a fact, not an input to fake.
   const changed=new Map(),readState=k=>k.startsWith('flag.')?out.state.flags[k.slice(5)]:k.startsWith('affinity.')?out.state.affinity[k.slice(9)]:out.state[k];
   for(const r of [pick,...rows].filter(Boolean))for(const part of decode(r.effects).split(';')){
    const m=part.trim().match(/^(flag\.\w+|money|affinity\.\w+)\s*(=|\+=|-=)/);if(m)changed.set(m[1],m[2]==='='||changed.get(m[1])||false);
   }
   const newResult=rows.some(r=>r.type==='order'||r.type==='serve');
   const facts=[...terms(node.when),...terms(pick?.when)].filter(t=>{
    const k=t.match(/^!?([\w.]+)/)?.[1];return !changed.has(k)&&!(newResult&&['order_match','craft_grade','grade','final_grade'].includes(k))&&rules.condition(t,out.state);
   });
   for(const [k,fixed] of changed)if(fixed)facts.push(k+' == '+readState(k));
   for(const e of local){
    const wire=wires.find(r=>r.id===e.routeId),first=wire?src.index.get(wire.target):out.start,lastIndex=e.to?src.graph.nodes.find(n=>n.id===e.to)?.index:src.rows.length;
    if(first==null||lastIndex==null||lastIndex<first)continue;
    const want=[...facts,wire?.predicate||'',src.byRow.get(e.to)?.when||''];
    const skip=(wire?wires.slice(0,wires.indexOf(wire)):wires).map(r=>r.predicate);
    for(const n of src.graph.nodes)if(n.index>=first&&n.index<lastIndex)skip.push(n.when);
    const state=witness(out.state,want,skip);if(!state)continue;
    let target;
    if(services.has(rows[0].row_id)&&state!==out.state){
     // A different glass result is an input to this node, not a change
     // made after its affinity effects have already been committed.
     const replay=structuredClone(seed);
     for(const k of ['order_match','craft_grade','final_grade','money'])if(state[k]!==out.state[k])replay[k]=state[k];
     for(const k of ['flags','affinity'])for(const id of Object.keys(state[k]))if(state[k][id]!==out.state[k][id])replay[k][id]=state[k][id];
     if(!replay.order_match)replay.final_grade='sewage';
     else if(replay.final_grade!==seed.final_grade&&state.craft_grade===out.state.craft_grade)replay.craft_grade=replay.final_grade;
     replay.grade=replay.final_grade;
     target=follow(departure(pick,replay));
    }else target=follow(out,state);
    if(e.end?!target.end:target.node?.id!==e.to)continue;
    const guard=[...new Set([e.guard,e.targetWhen].filter(Boolean))].join(' && ');
    add(target,guard,seed!==here.ctx||state!==out.state,wire?.id);
   }
   if(![...seen].some(id=>id.startsWith(key(actual)+'|')))add(actual,'',seed!==here.ctx);
  }catch(e){outcomes.push({pick,blocked:'연결을 확인할 수 없습니다: '+e.message});}
  return outcomes;
 }
 return {get current(){return here;},get node(){return here.node;},get scene(){return here.lane.id;},payload,playableFrom,next,branches,glassResult,
  previous(){const graph=here.lane.graph,ids=new Set(graph.connections.filter(e=>e.to===here.node.id).map(e=>e.from));return graph.nodes.filter(n=>ids.has(n.id));},
  startAt(n){return create({model,graphFor,scene:here.lane.id,node:n,settings,picks});},
  enter(target){if(!target?.node)return false;here=target;return true;}};
}
const api={create,affinityLabel};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarPreviewRoute=api;
})(globalThis);
