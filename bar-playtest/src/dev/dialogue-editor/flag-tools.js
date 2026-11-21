/* A flag exists in engine CSV only where an expression reads or writes it. */
(function(root){
'use strict';
const W=typeof module==='undefined'?root.LunaBarWiring:require('./flow-wiring.js');
const clean=v=>!v||v==='\\N'||v==='\\E'?'':String(v).trim();
const tokens=s=>[...new Set([...clean(s).matchAll(/\bflag\.(\w+)\b/g)].map(m=>m[1]))];
const system=new Set(('believer_conversation_done believer_emblem_received boobi_adopted campaign_observation campaign_response campaign_selected_drink day0_choice_hold_learned day0_drink_taught day0_pour_taught day0_recipe_taught day0_seats_revealed day0_skip_tutorial day0_tv_seen day1_open_taught day1_trade_done day3_sugar_received gang_wild_dog_paid gang_wild_dog_received gang_wild_dog_repair_promised gang_wild_dog_repeat_deal johnny_recipe_unlocked mix_tutorial_shake shiba_allowance_received shiba_old_fashioned_taught tom_name_known').split(' '));
const generated=n=>/^bp_(?:path|take)_/.test(n);
const fixed=n=>generated(n)||system.has(n);
function index(m){
 const flags=new Map(),editable=new Set(),sources=new Map(),meetings=new Set(m.projected.data.tables.characters.map(c=>c.id+'_met'));
 const put=(n,u)=>{if(!n)return;if(!flags.has(n))flags.set(n,{name:n,uses:[],protected:(fixed(n)||meetings.has(n))?'게임 또는 플로우 연결이 직접 사용하는 이름입니다.':''});const e=flags.get(n);e.uses.push(u);if(u.external)e.protected||='바 대사 밖에서도 사용하는 이름입니다. 일부 위치만 바꾸지 않도록 보호합니다.';};
 function scan(row,loc){for(const field of ['when','effects'])for(const n of tokens(row[field]))put(n,{...loc,field,row,value:row[field],write:field==='effects'});}
 for(const sc of m.scenes){const routes=W.scan(m,sc.id).routes,owner=new Map(routes.flatMap(rt=>rt.steps.map(s=>[s.row_id,rt])));for(const r of m.rows(sc.id)){
   editable.add(r.row_id);const route=owner.get(r.row_id),target=route?.source||r.row_id,loc={scene:sc.id,day:sc.day,step:target,routeId:route?.id,label:sc.title+' · '+(m.row(target)?.seq||r.seq)+'번',type:r.type};scan(r,loc);
   if(r.type==='choice')for(const c of m.choices(r.arg)){editable.add(c.row_id);scan(c,{...loc,choice:c.row_id,label:loc.label+' · 선택지 '+c.seq});}
 }}
 // Shipped QA, outside and registration fields are visible as references when
 // shared with the bar. Never perform a partial migration of their names.
 for(const [table,raw] of m.catalog.rawTables){const rows=table==='Steps'?m.tables.steps:table==='BarChoices'?m.tables.bar_choices:table==='Scenes'?m.tables.scenes:raw;
  for(const row of rows){if(editable.has(row.row_id))continue;for(const [field,value] of Object.entries(row)){
   if(!value)continue;const bare=/(?:^|_)flag$/.test(field);if(!bare&&!/(?:^|_)(?:when|effects|conditions?)$/.test(field))continue;
   const names=bare&&/^\w+$/.test(value)?[value]:tokens(value);
   for(const n of names){if(!sources.has(n))sources.set(n,[]);sources.get(n).push({external:true,row,field,value,write:field==='effects'||field==='completion_flag',label:(row.context||row.id||row.dataset_id||table)+' · '+(row.seq||field)});}
  }}
 }
 for(const [n,uses] of sources)if(flags.has(n))for(const use of uses)put(n,use);
 return {flags,reserved:new Set([...sources.keys(),...flags.keys(),...meetings])};
}
function checkName(name,idx){if(!/^[A-Za-z_]\w{0,79}$/.test(name)||name in Object.prototype||name==='prototype')throw Error('영문 또는 밑줄로 시작하는 1~80자의 영문·숫자·밑줄을 사용하세요.');
 if(fixed(name)||idx.reserved.has(name))throw Error('이미 사용 중이거나 시스템이 예약한 이름입니다.');}
const recordable=row=>row&&['say','order','coaster','choice','effect','enter','exit','craft','serve','empty_glass','tutorial'].includes(row.type);
function create(m,row,name,value){
 const option=m.tables.bar_choices.includes(row)&&m.scenes.some(sc=>m.rows(sc.id).some(r=>r.type==='choice'&&m.choices(r.arg).includes(row)));
 if(!option&&(!m.scenes.some(s=>s.id===row?.context)||!recordable(row)||generated(tokens(row.effects)[0]||'')&&row.type==='effect'))throw Error('이 위치에는 값을 기록할 수 없습니다. 대사나 상태 변경 줄을 선택하세요.');
 checkName(name,index(m));if(typeof value!=='boolean')throw Error('초깃값을 선택하세요.');
 if(row.type==='say')(typeof module==='undefined'?root.LunaBarFlow:require('./flow-model.js')).rememberCards(m,row.context);
 m.set(row,'effects',[clean(row.effects),'flag.'+name+' = '+value].filter(Boolean).join('; '));
}
function rewrite(m,old,next){
 const idx=index(m),entry=idx.flags.get(old);if(!entry||entry.protected)throw Error(entry?.protected||'사용 위치가 없는 플래그입니다.');
 if(next!==null)checkName(next,idx);
 const token='flag.'+old,re=new RegExp('\\bflag\\.'+old+'\\b','g'),edits=new Map();
 for(const u of entry.uses){const key=u.row.row_id+'/'+u.field;if(edits.has(key))continue;const sep=u.write?';':'&&';
  if(next===null&&!u.write&&W.scan(m,u.scene).routes.some(rt=>rt.steps[1]===u.row&&tokens(rt.predicate).includes(old)))throw Error('먼저 플로우 차트에서 해당 조건 핀을 수정하거나 연결을 해제하세요.');
  const value=next!==null?u.value.replace(re,'flag.'+next):u.value.split(sep).map(s=>s.trim()).filter(t=>{
   if(!tokens(t).includes(old))return true;
   const safe=u.write?new RegExp('^flag\\.'+old+'\\s*=\\s*(true|false)$'):new RegExp('^!?flag\\.'+old+'(?:\\s*(?:==|!=)\\s*(?:true|false))?$');
   if(!safe.test(t))throw Error('복합 비교식에서 '+token+'를 먼저 직접 수정하세요: '+t);return false;
  }).join(u.write?'; ':' && ');
  edits.set(key,{...u,value});
 }
 const scenes=new Set([...edits.values()].filter(e=>e.row.type==='say').map(e=>e.row.context));
 for(const scene of scenes)(typeof module==='undefined'?root.LunaBarFlow:require('./flow-model.js')).rememberCards(m,scene);
 for(const e of edits.values())m.set(e.row,e.field,e.value);
}
function draftIssues(m,all){const out=[];for(const sc of m.scenes){const data=all?.[sc.id]?.drafts||{},existing=W.scan(m,sc.id).routes;
 for(const [id,conditions] of Object.entries(data)){const row=m.row(id);if(row?.context!==sc.id||!Array.isArray(conditions))continue;
  for(const v of conditions)if(!existing.some(r=>(r.source===id||m.views.barEditorCards?.[sc.id]?.[r.source]===id)&&W.pinKey(r.choice,r.predicate)===W.pinKey('',v)))out.push({severity:'warning',scene:sc.id,day:sc.day,row:id,pin:true,predicate:v,label:sc.title+' · '+row.seq+'번',message:'연결하지 않은 조건 핀: '+(v.startsWith('?')?'조건 미지정':v)+' · 연결하기 전에는 CSV에 포함되지 않습니다.'});
 }}return out;}
// Include pending pins in the editor palette only. No setter or declaration is synthesized.
function palette(m){const idx=index(m);let pending=[];try{pending=draftIssues(m,JSON.parse(localStorage.getItem('luna.bar.graph-workspace.v2')||'{}'));}catch{}
 for(const u of pending)for(const n of tokens(u.predicate)){if(generated(n))continue;if(!idx.flags.has(n))idx.flags.set(n,{name:n,uses:[],protected:''});
  idx.reserved.add(n);idx.flags.get(n).uses.push({...u,step:u.row,write:false,value:u.predicate,label:u.label+' · 미연결 핀'});}
 return idx;
}
function warnings(m){const out=[];for(const e of index(m).flags.values()){if(e.protected||e.uses.some(u=>u.write))continue;const u=e.uses[0];out.push({severity:'warning',scene:u.scene,row:u.step,choice:u.choice,field:u.field,label:u.label,message:'플래그 '+e.name+'의 값을 기록하는 위치가 바 대본에 없습니다. 다른 곳에서 설정하는 값인지 확인하세요.'});}return out;}
const api={index,palette,checkName,rewrite,create,generated,tokens,draftIssues,recordable,warnings};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarFlags=api;
})(typeof window==='undefined'?globalThis:window);
