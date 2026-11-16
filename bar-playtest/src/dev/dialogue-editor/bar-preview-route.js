/* An audition owns its route and effects. Looking ahead is pure; only the
   Next Node button commits a destination. Never drive the editor or game save. */
(function(root){
'use strict';
const {decode,rules}=typeof module==='undefined'?root.LunaDialogueEditorModel:require('./editor-model.js');
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
  flags:{tom_name_known:true,day0_skip_tutorial:true,...settings.flags},affinity:{},reputation:0,
  grade:'good',craft_grade:'good',final_grade:'good',order_match:true};
 const lanes=new Map();
 function lane(id){
  if(!lanes.has(id)){
   const rows=model.rows(id).map(r=>model.step(r)),byRow=new Map(),index=new Map(rows.map((r,i)=>[r.row_id,i]));
   const graph=graphFor(id);for(const n of graph.nodes)for(const r of n.rows)byRow.set(r.row_id,n);
   lanes.set(id,{id,title:model.scenes.find(s=>s.id===id)?.title,rows,index,byRow,graph});
  }return lanes.get(id);
 }
 function apply(row,state,choice){
  if(choice){if(state.day===0)state.flags.day0_choice_hold_learned=true;rules.applyEffects(decode(choice.effects),state);}
  rules.applyEffects(row.effects,state);
 }
 const first=lane(scene),ctx=structuredClone(witness(initial,[node.when])||initial),before=[],answers={};
 for(const r of first.rows.slice(0,first.index.get(node.id))){
  if(!rules.condition(r.when,ctx))continue;
  const c=picks[r.row_id]&&options(model,r).find(o=>o.row_id===picks[r.row_id].row_id&&rules.condition(o.when,ctx));
  if(c)answers[r.row_id]=c;before.push(r);apply(r,ctx,c);
 }
 let here={lane:first,node,before,ctx:witness(ctx,[node.when])||ctx,answers};
 function payload(i){
  const active=here.node.rows.map(r=>model.step(r)),row=active[i],state=structuredClone(here.ctx);
  for(const earlier of active.slice(0,i))apply(earlier,state,null);
  return {day:initial.day,flags:initial.flags,money:initial.money,rows:here.before.concat(active),index:here.before.length+i,
   choices:options(model,row),picks:here.answers,pathPreview:true,previewState:state};
 }
 function departure(pick,seed){
  const state=structuredClone(seed),trail=here.before.slice(),answers={...here.answers};
  let dest=here.lane,start;const rows=here.node.rows.map(r=>model.step(r));
  for(const r of rows){
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
   if(target)return {node:target,lane:dest,before:trail,ctx:state,answers};
   trail.push(r);apply(r,state);
  }
  return {end:true};
 }
 function next(pick){return follow(departure(pick,here.ctx));}
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
    outcomes.push({pick,target,guard,assumed});
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
    const wire=wires.find(r=>r.id===e.routeId),first=wire?src.index.get(wire.target):out.start,lastIndex=e.to?src.index.get(e.to):src.rows.length;
    if(first==null||lastIndex==null||lastIndex<first)continue;
    const want=[...facts,wire?.predicate||'',src.byRow.get(e.to)?.when||''];
    const skip=(wire?wires.slice(0,wires.indexOf(wire)):wires).map(r=>r.predicate);
    for(const n of src.graph.nodes)if(n.index>=first&&n.index<lastIndex)skip.push(n.when);
    const state=witness(out.state,want,skip);if(!state)continue;
    const target=follow(out,state);
    if(e.end?!target.end:target.node?.id!==e.to)continue;
    const guard=[...new Set([e.guard,e.targetWhen].filter(Boolean))].join(' && ');
    add(target,guard,seed!==here.ctx||state!==out.state,wire?.id);
   }
   if(![...seen].some(id=>id.startsWith(key(actual)+'|')))add(actual,'',seed!==here.ctx);
  }catch(e){outcomes.push({pick,blocked:'연결을 확인할 수 없습니다: '+e.message});}
  return outcomes;
 }
 return {get node(){return here.node;},get scene(){return here.lane.id;},payload,next,branches,
  enter(target){if(!target?.node)return false;here=target;return true;}};
}
const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarPreviewRoute=api;
})(globalThis);
