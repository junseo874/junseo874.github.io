/* A forward wire is ordinary engine data. Capture the output once, skip the
   intervening rows only on that route, then resume normal CSV execution.
   The three adjacent effect rows have no UI/time and also reset on re-entry. */
(function(root){
'use strict';
const clean=v=>!v||v==='\\N'||v==='\\E'?'':v.trim();
const terms=(v,sep='&&')=>clean(v).split(sep).map(s=>s.trim()).filter(Boolean);
const gateOf=id=>'flag.bp_path_'+id, armOf=id=>'flag.bp_take_'+id;
const owns=t=>/^!?flag\.bp_(?:path|take)_editor_\w+\b/.test(t);
const readable=v=>terms(v).filter(s=>!owns(s)).join(' && ');
const authorEffects=v=>terms(v,';').filter(s=>!owns(s)).join('; ');
const preserve=(old,value,sep)=>[...terms(old,sep).filter(owns),...terms(value,sep).filter(t=>!owns(t))].join(sep===';'?'; ':' && ');
const append=(m,r,key,value,sep)=>m.set(r,key,[...new Set([...terms(r[key],sep),value])].join(sep===';'?'; ':' && '));
const drop=(m,r,key,clause,sep)=>{const a=terms(r[key],sep);if(a.includes(clause))m.set(r,key,a.filter(t=>t!==clause).join(sep===';'?'; ':' && '));};
// A choice owns one output. An AND expression also owns one output regardless of
// whitespace or the order in which its clauses were entered. CSV spelling is preserved.
const pinKey=(choice,predicate)=>choice?'pick:'+choice:clean(predicate)?'if:'+([...new Set(terms(predicate).map(t=>t.replace(/\s+/g,'')))].sort().join('&&')):'next';
function scan(model,scene){
 const list=model.rows(scene),logical=[],hidden=new Set(),routes=[],errors=[],issues=[];
 const warn=(message,row)=>{errors.push(message);issues.push({severity:'error',scene,row:row?.row_id,message});};
 for(let i=0;i<list.length;i++){
  const a=list[i],id=a.row_id,gate=gateOf(id),arm=armOf(id);
  if(a.type!=='effect'||a.effects!==gate+' = false'){logical.push(a);continue;}
  const b=list[i+1],c=list[i+2],src=logical.at(-1),parts=terms(b?.when);
  if(!src||clean(a.when)||b?.type!=='effect'||b.effects!==gate+' = true'||parts[0]!==arm||c?.type!=='effect'||clean(c.when)||c.effects!==arm+' = false'){
   warn('분기 연결용 상태 줄이 분리되었습니다. 되돌린 후 플로우 차트에서 연결을 수정하세요.',src||a);logical.push(a);continue;
  }
  const siblings=src.type==='choice'?model.choices(src.arg):[src];
  const owners=siblings.filter(x=>terms(x.effects,';').includes(arm+' = true')),owner=owners[0];
  if(owners.length!==1||clean(owner.goto))warn('분기의 시작 줄이나 선택지가 바뀌었습니다. 플로우 차트에서 먼저 연결을 해제하세요.',src);
  routes.push({id,gate,arm,source:src.row_id,owner,choice:src.type==='choice'?owner?.row_id:'',predicate:readable(b.when),steps:[a,b,c],after:logical.length});
  for(const r of [a,b,c])hidden.add(r.row_id);
  i+=2;
 }
 for(const r of routes){
  let j=r.after;while(j<logical.length&&terms(logical[j].when).includes('!'+r.gate))j++;
  r.target=logical[j]?.row_id;
  if(!r.target||logical.slice(j+1).some(s=>terms(s.when).includes('!'+r.gate)))warn('분기 사이의 줄 순서가 끊겼습니다. 플로우 차트에서 다시 연결하거나 되돌려 주세요.',model.row(r.source));
  if(logical.some(s=>s!==r.owner&&terms(s.effects,';').includes(r.arm+' = true')))warn('연결 신호를 함께 복제할 수 없습니다. 플로우 차트에서 새 대사 노드를 추가하세요.',model.row(r.source));
 }
 const sources=new Map();for(const r of routes){const k=pinKey(r.choice,r.predicate);if(!sources.has(r.source))sources.set(r.source,new Set());const seen=sources.get(r.source);if(seen.has(k))warn('한 출력 핀에 연결이 두 개 있습니다. 해당 연결을 해제한 뒤 다시 지정하세요.',model.row(r.source));seen.add(k);}
 const gates=new Set(routes.flatMap(r=>[r.gate,r.arm]));
 for(const row of list)if([row,...(row.type==='choice'?model.choices(row.arg):[])].flatMap(r=>[r.when,r.effects]).some(value=>(clean(value).match(/flag\.bp_(?:path|take)_editor_\w+/g)||[]).some(k=>!gates.has(k)))){warn('연결을 구성하는 줄이 누락되었습니다. 되돌린 뒤 플로우 차트에서 수정하세요.',row);}
 return {logical,hidden,routes,errors,issues};
}
function problem(model,scene,src,dst,port){
 if(!src||!dst)return '같은 장면의 입력 핀을 골라 주세요.';
 const last=src.rows.at(-1),first=dst.rows[0],rows=model.rows(scene);
 if(!rows.includes(last)||!rows.includes(first))return '다른 대본으로 넘어가려면 선택지의 장면 연결을 사용하세요.';
 if((last.type==='choice')!==!!port.choice)return '선택지는 각 문구의 출력 핀 하나로 연결하세요.';
 if(dst.index<=src.index)return '이 장면은 앞으로만 진행합니다. 자기 자신이나 앞 노드로 반복할 수 없습니다.';
 if(last.type==='end_part'||last.sync==='no_wait'||rows[dst.index-1]?.sync==='no_wait')return '장면 종료나 동시 입장 두 줄의 중간에는 연결할 수 없습니다.';
 if(src.index+src.rows.length<model.prefix(scene))return '개점 전 초기 배치는 고정되어 있습니다.';
 if(port.choice){
  const option=model.choices(last.arg).find(c=>c.row_id===port.choice);
  if(!option)return '원래 선택지를 찾을 수 없습니다. 장면을 다시 확인하세요.';
  if(model.tables.steps.filter(s=>s.type==='choice'&&s.arg===last.arg).length>1)return '여러 장면이 공유하는 선택지입니다. 독립된 선택지 묶음에서 연결하세요.';
 }
 const pred=port.predicate||'';
 if(/\b(?:grade|craft_grade|final_grade|order_match)\b/.test(pred)){
  const latest=rows.slice(0,rows.indexOf(last)+1).filter(r=>r.type==='order'||r.type==='serve').at(-1);
  if(latest?.type!=='serve'||clean(latest.when))return '제공 결과는 잔을 제공한 뒤, 다음 주문을 받기 전에만 사용할 수 있습니다.';
 }
 const skipped=rows.slice(rows.indexOf(last)+1,dst.index);
 // A branch can bypass a coaster that its selected option explicitly makes
 // ineligible (day 0 has separate tutorial/skip coaster cues). Never bypass
 // a possibly active coaster: the real serve action needs it on the table.
 const facts=new Map(),learn=v=>{for(const t of terms(v)){const a=t.match(/^(!)?(flag\.\w+)$/);if(a)facts.set(a[2],!a[1]);}};
 learn(src.when);const opt=port.choice&&model.choices(last.arg).find(c=>c.row_id===port.choice);
 const writes=v=>{for(const t of terms(v,';')){const a=t.match(/^(flag\.\w+)\s*=\s*(true|false)$/);if(a)facts.set(a[1],a[2]==='true');}};
 if(opt){learn(opt.when);writes(opt.effects);}for(const r of src.rows)writes(r.effects);learn(pred);
 const possible=r=>!terms(r.when).some(t=>{const a=t.match(/^(!)?(flag\.\w+)$/);return a&&facts.has(a[2])&&facts.get(a[2])===!!a[1];});
 if(skipped.some(r=>['enter','exit','order','craft','serve','end_part'].includes(r.type)||r.type==='coaster'&&possible(r)))return '중간에 입·퇴장, 코스터 또는 주문·제조·제공이 있습니다. 좌석이나 주문 상태를 건너뛰지 않도록 그 앞의 노드에 연결하세요.';
 if(first.type==='serve'&&last.type!=='craft')return '제조를 거치지 않고 제공할 수 없습니다.';
 return '';
}
function sceneProblem(model,scene,src,choice,dst){
 const last=src?.rows.at(-1),option=last&&model.choices(last.arg).find(c=>c.row_id===choice);
 if(!choice||last?.type!=='choice'||!option)return '다른 장면으로 이동하는 핀은 선택지에서만 만들 수 있습니다.';
 if(model.tables.steps.filter(s=>s.type==='choice'&&s.arg===last.arg).length>1)return '여러 곳에서 공유하는 선택지입니다. 독립된 선택지에서 연결하세요.';
 if(!model.scenes.some(s=>s.id===dst&&s.day===model.scenes.find(x=>x.id===scene)?.day))return '같은 일차의 장면만 연결할 수 있습니다.';
 const seen=new Set();function reaches(id){
  if(id===scene)return true;if(seen.has(id))return false;seen.add(id);
  return model.rows(id).filter(r=>r.type==='choice').some(r=>model.choices(r.arg).some(o=>clean(o.goto)&&reaches(o.goto)));
 }
 return reaches(dst)?'이 연결은 원래 장면으로 되돌아오는 고리를 만듭니다. 엔진에서 반복 장면 이동을 허용하지 않습니다.':'';
}
function disconnect(model,scene,route){
 const clause='!'+route.gate;
 for(const r of model.rows(scene))drop(model,r,'when',clause,'&&');
 if(route.owner)drop(model,route.owner,'effects',route.arm+' = true',';');
 for(const s of route.steps)model.remove(scene,s.row_id);
}
function revise(model,scene,src,route,dst,value){
 value=clean(value);if(terms(value).some(owns))throw Error('자동 연결용 플래그는 수정할 수 없습니다.');
 const why=problem(model,scene,src,dst,{choice:route.choice,predicate:value});if(why)throw Error(why);
 const all=scan(model,scene).routes.filter(r=>r.source===route.source);
 if(all.some(r=>r.id!==route.id&&pinKey(r.choice,r.predicate)===pinKey(route.choice,value)))throw Error('동일한 조건의 출력이 이미 있습니다.');
 const changed=all.find(r=>r.id===route.id);if(!changed)throw Error('연결이 변경되었습니다. 다시 선택하세요.');if(changed.predicate===value)return;changed.predicate=value;
 // A fallback always runs last. Move only the three-row signal blocks; the
 // source, destination, user conditions and badges on intervening rows stay put.
 const ordered=[...all.filter(r=>r.choice||r.predicate),...all.filter(r=>!r.choice&&!r.predicate)];
 if(ordered.some((r,i)=>r!==all[i])){const list=model.rows(scene),ids=list.map(r=>r.row_id),at=list.indexOf(all[0].steps[0]);
  ids.splice(at,all.length*3,...ordered.flatMap(r=>r.steps.map(s=>s.row_id)));model.reorder(scene,ids);}
 ordered.forEach((r,i)=>model.set(r.steps[1],'when',[r.arm,...ordered.slice(0,i).filter(other=>(other.choice||'')===(r.choice||'')).map(other=>'!'+other.gate),r.predicate].filter(Boolean).join(' && ')));
}
function wire(model,scene,src,dst,port){
 const issue=problem(model,scene,src,dst,port);if(issue)throw Error(issue);
 const plan=scan(model,scene);if(plan.errors.length)throw Error(plan.errors[0]);
 const last=src.rows.at(-1),same=plan.routes.filter(r=>r.source===last.row_id);
 const condition=port.predicate||'',choice=port.choice||'',key=pinKey(choice,condition),prior=same.find(r=>pinKey(r.choice,r.predicate)===key);
 if(port.routeId&&port.routeId!==prior?.id)throw Error('이 핀이 변경되었습니다. 현재 출력 핀을 다시 선택하세요.');
 if(prior?.target===dst.rows[0].row_id)return last;
 if(choice){const o=model.choices(last.arg).find(c=>c.row_id===choice);if(clean(o.goto))model.set(o,'goto','');}
 // Insert a new conditional before the unconditional fallback. Existing wires
 // keep their precedence when dragged to a new target.
 let route=prior;
 if(!route){
  const owner=choice?model.choices(last.arg).find(c=>c.row_id===choice):last;
  let next=same.find(r=>(r.choice||'')===choice&&!r.predicate);
  let at=next?model.rows(scene).indexOf(next.steps[0]):model.rows(scene).indexOf(same.at(-1)?.steps.at(-1)||last)+1;
  const steps=[];
  for(let i=0;i<3;i++){const s=model.add(scene,at+i,'effect');model.set(s,'actor',last.actor||'luna');model.set(s,'arg','');model.set(s,'web_type','');model.set(s,'web_fields.type','effect');steps.push(s);}
  const id=steps[0].row_id,gate=gateOf(id),arm=armOf(id);
  append(model,owner,'effects',arm+' = true',';');
  model.set(steps[0],'effects',gate+' = false');model.set(steps[1],'effects',gate+' = true');model.set(steps[2],'effects',arm+' = false');
  route={id,gate,arm,steps,predicate:condition,choice};
  const ordered=[...same,route].sort((a,b)=>+a.steps[0].source_order-+b.steps[0].source_order);
  ordered.forEach((r,i)=>model.set(r.steps[1],'when',[r.arm,...ordered.slice(0,i).filter(p=>(p.choice||'')===(r.choice||'')).map(p=>'!'+p.gate),r.predicate].filter(Boolean).join(' && ')));
 }
 const logical=plan.logical,start=logical.indexOf(last),end=logical.indexOf(dst.rows[0]),skip='!'+route.gate;
 for(const [i,r] of logical.entries()){
  if(i>start&&i<end){if(!terms(r.when).includes(skip))model.set(r,'when',[skip,clean(r.when)].filter(Boolean).join(' && '));}
  else drop(model,r,'when',skip,'&&');
 }
 return last;
}
// Changing a choice between a local wire and a scene destination is also a replacement.
function sceneWire(model,scene,source,choice,dst){
 const last=source.rows.at(-1),option=model.choices(last.arg).find(o=>o.row_id===choice);
 if(!option)throw Error('선택지를 찾을 수 없습니다.');
 if(model.tables.steps.some(r=>r!==last&&r.type==='choice'&&r.arg===last.arg))throw Error('여러 줄이 공유하는 선택지입니다. 먼저 독립된 선택지로 복제하세요.');
 if(dst){const why=sceneProblem(model,scene,source,choice,dst);if(why)throw Error(why);}
 const plan=scan(model,scene);if(plan.errors.length)throw Error(plan.errors[0]);
 const local=plan.routes.filter(r=>r.source===last.row_id&&r.choice===choice);
 if(dst&&local.some(r=>r.predicate))throw Error('다른 장면으로 이동하기 전에 이 핀의 선택 후 이동 조건을 먼저 제거하세요.');
 for(const r of local)disconnect(model,scene,r);
 model.set(option,'goto',dst);return last;
}
const api={scan,problem,sceneProblem,sceneWire,pinKey,wire,disconnect,revise,readable,authorEffects,preserve,owns};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarWiring=api;
})(globalThis);
