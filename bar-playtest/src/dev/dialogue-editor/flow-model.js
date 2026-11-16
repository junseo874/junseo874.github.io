/* Read-only graph projection. Source order, when, choice effects and goto are
   the actual wires; no graph IDs, coordinates or links are saved to CSV. */
(function(root){
'use strict';
const clean=v=>!v||v==='\\N'||v==='\\E'?'':v.trim();
const wiring=typeof module==='undefined'?root.LunaBarWiring:require('./flow-wiring.js');
const grades=['sewage','poor','decent','good','excellent'];
const gradeTest=s=>s.match(/^(grade|craft_grade|final_grade)\s*(==|!=|>=|<=|>|<)\s*(sewage|poor|decent|good|excellent)$/);
const compare=(a,op,b)=>({'==':a===b,'!=':a!==b,'>=':a>=b,'<=':a<=b,'>':a>b,'<':a<b})[op];
function checkGuard(value){
 if(!clean(value))return;
 for(const part of value.split('&&').map(s=>s.trim())){
  if(!flagTest(part)&&!gradeTest(part)&&!/^(!?(true|false)|(money|day|affinity\.\w+)\s*(==|!=|>=|<=|>|<)\s*-?\d+)$/.test(part))throw Error('지원 조건: 주문 일치, 제조/최종 등급, 플래그, 일차, 소지금, 호감도. 여러 조건은 &&로 연결하세요.');
 }
}
const kind=t=>({say:'대화',choice:'선택지',enter:'입장',exit:'퇴장',craft:'칵테일 제공',serve:'칵테일 제공',order:'주문',coaster:'코스터',empty_glass:'빈잔',tutorial:'튜토리얼',end_part:'장면 종료',effect:'상태 변경',timeline:'타임라인'}[t]||t);
function flagsAfter(effects){
 const flags={};for(const clause of clean(effects).split(';')){
  const m=clause.trim().match(/^(flag\.\w+)\s*=\s*(true|false)$/);if(m)flags[m[1]]=m[2]==='true';
 }return flags;
}
function flagTest(s){
 const m=s.match(/^(!)?(flag\.\w+|order_match)(?:\s*(==|!=)\s*(true|false))?$/);
 if(!m||(m[1]&&m[3]))return null;
 const value=m[4]!=='false';return [m[2],m[1]||m[3]==='!='?!value:value];
}
// Resolve only what the source guarantees. Unresolved tests retain both
// routes. Facts are local to one edge, not assumed to persist through scenes.
function truth(expr,facts,observed){
 if(!expr)return true;if(observed.has(expr))return observed.get(expr);
 const terms=expr.split('&&').map(x=>x.trim()).map(s=>{
  const f=flagTest(s);if(f&&Object.hasOwn(facts,f[0]))return facts[f[0]]===f[1];
  const g=gradeTest(s);if(g){const pool=facts[g[1]==='grade'?'final_grade':g[1]]||grades,pass=pool.filter(v=>compare(grades.indexOf(v),g[2],grades.indexOf(g[3])));return !pass.length?false:pass.length===pool.length?true:undefined;}
  if(s==='true'||s==='false')return s==='true';
  return observed.get(s);
 });return terms.includes(false)?false:terms.every(x=>x===true)?true:undefined;
}
function remember(expr,value,facts,observed){
 if(!expr)return;observed.set(expr,value);
 if(value||!expr.includes('&&'))for(const t of expr.split('&&')){
  const s=t.trim(),f=flagTest(s);if(f)facts[f[0]]=value===f[1];observed.set(s,value);
  const g=gradeTest(s);if(g){const k=g[1]==='grade'?'final_grade':g[1];facts[k]=(facts[k]||grades).filter(v=>compare(grades.indexOf(v),g[2],grades.indexOf(g[3]))===value);}
 }
}
function compile(model,scene,starts=[]){
 const list=model.rows(scene),plan=wiring.scan(model,scene),nodes=[],edges=[],seats={};
 const arrivals=new Set([...starts,...plan.routes.map(r=>r.target)]);
 for(const [index,row] of list.entries()){
  if(plan.hidden.has(row.row_id))continue;
  if(row.type==='enter'&&!wiring.asleep(row))seats[row.arg]=row.actor;
  const cast=[...new Set(Object.values(seats))];if(!cast.length&&row.actor&&['say','order','choice'].includes(row.type))cast.push(row.actor);
  const when=wiring.readable(row.when),type=kind(row.type),last=nodes.at(-1);
  const same=last&&wiring.block(last.rows.at(-1))===wiring.block(row)&&!arrivals.has(row.row_id)&&last.type===type&&clean(last.rows.at(-1).when)===clean(row.when)&&last.cast.join()===cast.join()&&!clean(last.rows.at(-1).effects)
   &&(row.type==='say'||row.type==='serve'&&last.rows.at(-1).type==='craft');
  if(wiring.decision(last?.rows[0])&&row.row_id===wiring.block(last.rows[0])+'_901')last.rows.push(row);
  else if(wiring.decision(row))nodes.push({id:row.row_id,index,start:index,type:'조건 분기',when:wiring.asleep(row)?'false':'',branchWhen:wiring.decisionRule(row),cast,rows:[row],routes:[]});
  else if(same)last.rows.push(row);
  else nodes.push({id:row.row_id,index,start:index,type,when,cast,rows:[row],routes:[]});
  if(row.type==='exit'&&!wiring.asleep(row))for(const k of Object.keys(seats))if(seats[k]===row.actor)delete seats[k];
 }
 for(const n of nodes)n.routes=plan.routes.filter(r=>r.source===n.rows.at(-1).row_id);
 function connect(node,i,choice){
  const facts={},observed=new Map();remember(node.when,true,facts,observed);
  if(choice)remember(clean(choice.when),true,facts,observed);
  if(node.rows.some(r=>clean(r.effects))||clean(choice?.effects))observed.clear();
  if(node.rows.some(r=>['order','serve'].includes(r.type))){observed.clear();for(const k of ['order_match','craft_grade','final_grade'])delete facts[k];}
  if(choice)Object.assign(facts,flagsAfter(choice.effects));
  for(const r of node.rows)Object.assign(facts,flagsAfter(r.effects));
  const label=choice?clean(choice['text.ko']):'',base={from:node.id,label,choice:choice?.row_id,requires:clean(choice?.when)};
  if(clean(choice?.goto)){edges.push({...base,targetScene:choice.goto});return;}
  for(const r of node.routes.filter(r=>(r.choice||'')===(choice?.row_id||''))){
   const enabled=truth(r.predicate,facts,observed);
   if(enabled!==false&&r.target){
    // The cable enters at the chosen row; its original conditions still
    // apply. Show the actual continuations when that row itself can be skipped.
    const start=nodes.findIndex(n=>n.id===r.target),seen=new Map(observed),known={...facts};remember(r.predicate,true,known,seen);
    for(let j=start;j>=0&&j<nodes.length;j++){
     const t=nodes[j],runs=truth(t.when,known,seen);
     if(runs!==false)edges.push({...base,to:t.id,guard:r.predicate,targetWhen:t.when,routeId:r.id});
     if(runs===true)break;if(runs===undefined)remember(t.when,false,known,seen);
     if(j===nodes.length-1)edges.push({...base,end:true,guard:r.predicate,routeId:r.id});
    }
   }
   if(enabled===true)return;
   if(enabled===undefined)remember(r.predicate,false,facts,observed);
  }
  for(let j=i+1;j<nodes.length;j++){
   const target=nodes[j];if(wiring.block(target.rows[0])&&wiring.block(target.rows[0])!==wiring.block(node.rows[0]))continue;
   if(wiring.asleep(node.rows[0])&&wiring.block(target.rows[0])!==wiring.block(node.rows[0]))break;
   if(wiring.block(node.rows[0])&&wiring.block(node.rows[0])===wiring.block(target.rows[0])&&node.rows.at(-1).type==='order'&&target.rows[0].type==='craft'){edges.push({...base,to:target.id,guard:''});return;}
   const v=truth(target.when,facts,observed);
   if(v!==false)edges.push({...base,to:target.id,guard:target.when});
   if(v===true)return;
   if(v===undefined)remember(target.when,false,facts,observed);
  }
  edges.push({...base,end:true});
 }
 for(const [i,node] of nodes.entries()){
  if(node.rows[0].type==='end_part'){edges.push({from:node.id,end:true});continue;}
  if(node.rows[0].type==='choice')for(const c of model.choices(node.rows[0].arg))connect(node,i,c);
  else connect(node,i);
 }
 // Execution may skip a guarded target and reach a later row. Keep those possible
 // outcomes in edges; sockets and the inspector show the single actual entry per pin.
 const connections=[],bySource=new Map();for(const e of edges){if(!bySource.has(e.from))bySource.set(e.from,[]);bySource.get(e.from).push(e);}
 for(const n of nodes){
  const pins=new Map(),key=e=>wiring.pinKey(e.choice,e.guard);
  for(const r of n.routes){const e={from:n.id,to:r.target,choice:r.choice,guard:r.predicate,routeId:r.id,label:r.choice?clean(r.owner?.['text.ko']):'',requires:r.choice?clean(r.owner?.when):'',targetWhen:nodes.find(t=>t.id===r.target)?.when};pins.set(key(e),e);}
  for(const e of bySource.get(n.id)||[]){if(e.routeId||pins.has(key(e)))continue;pins.set(key(e),e);}
  const choice=n.rows.at(-1).type==='choice'?model.choices(n.rows.at(-1).arg):[];const sequence=[...pins.values()];if(choice.length)sequence.sort((a,b)=>choice.findIndex(o=>o.row_id===a.choice)-choice.findIndex(o=>o.row_id===b.choice));
  connections.push(...sequence.map(e=>({...e,pinKey:key(e)})));
 }
 return {nodes,edges,connections,errors:plan.errors};
}
const presets=[['','항상 실행'],['order_match','주문한 술 일치'],['!order_match','주문한 술 불일치'],
 ['order_match && craft_grade >= good','주문 일치 · 제조 Good 이상'],['order_match && craft_grade < good','주문 일치 · 제조 Good 미만'],
 ...['craft_grade','final_grade'].flatMap(field=>grades.map(g=>[field+' == '+g,(field==='craft_grade'?'제조':'최종')+' 등급 · '+g]))];
// The new response row is an ordinary say. For a choice with no goto, set
// one boolean on every sibling so re-entering the choice cannot reuse a pick.
function addResponse(model,scene,node,choiceId,predicate){
 const last=node.rows.at(-1),index=model.rows(scene).findIndex(r=>r.row_id===last.row_id);
 if(index<0)throw Error('흐름을 다시 열어 주세요.');
 const resetsGuard=[last,...(last.type==='choice'?model.choices(last.arg):[])].some(r=>Object.keys(flagsAfter(r.effects)).some(k=>node.when.split(/[^\w.]+/).includes(k)));
 if(resetsGuard)throw Error('이 묶음은 완료할 때 자신의 실행 조건을 변경합니다. 다음 공통 대사에서 조건을 지정하세요.');
 let when=predicate;
 if(last.type==='choice'){
  const options=model.choices(last.arg),picked=options.find(c=>c.row_id===choiceId);
  if(!picked||clean(picked.goto))throw Error('다른 장면으로 이동하는 선택지는 도착 장면에서 편집하세요.');
  const key='flag.answer_'+picked.row_id.replace(/[^a-zA-Z0-9_]/g,'_');
  for(const c of options){
   const effects=clean(c.effects).split(';').map(v=>v.trim()).filter(v=>v&&!v.startsWith(key+' = '));
   effects.push(key+' = '+(c===picked));model.set(c,'effects',effects.join('; '));
  }when=key;
 }else {if(!clean(predicate))throw Error('반응을 실행할 조건을 입력하세요.');checkGuard(predicate);
  if(/\b(?:order_match|grade|craft_grade|final_grade)\b/.test(predicate)){const served=model.rows(scene).slice(0,index+1).filter(r=>['order','serve'].includes(r.type)).at(-1);if(served?.type!=='serve'||clean(served.when))throw Error('제조 결과는 제공이 확정된 위치에서 사용하세요.');}
 }
 const row=model.add(scene,index+1,'say');
 model.set(row,'actor',last.actor||'luna');model.set(row,'when',[clean(last.when),when].filter(Boolean).join(' && '));return row;
}
function insertChoice(model,scene,node){
 const last=node.rows.at(-1);if(last.type==='end_part')throw Error('장면 종료 뒤에는 추가할 수 없습니다.');
 const index=model.rows(scene).findIndex(r=>r.row_id===last.row_id);
 const row=model.add(scene,index+1,'choice');model.set(row,'when',clean(last.when));
 const opts=model.choices(row.arg);
 while(opts.length>2)model.removeChoice(row.arg,opts.pop().row_id);
 if(opts.length===1)opts.push(model.addChoice(row.arg));
 opts.forEach((o,i)=>{for(const k of ['text.en','when','effects','goto','lock_reason.ko','lock_reason.en'])model.set(o,k,'');model.set(o,'text.ko','새 선택지 '+(i+1));});
 return row;
}
const api={compile,presets,addResponse,insertChoice,kind,clean,checkGuard};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarFlow=api;
})(globalThis);
