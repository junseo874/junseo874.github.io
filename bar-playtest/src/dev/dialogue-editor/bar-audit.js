/* Read-only analysis shared by the editor, ZIP review and local save endpoint. */
(function(root){
'use strict';
const Text=typeof module==='undefined'?root.LunaTextEffects:require('../../shared/dialogue/text-effects.js');
const clean=v=>!v||v==='\\N'||v==='\\E'?'':String(v).trim();
const resultKey=/(?<![\w.])(?:grade|craft_grade|final_grade|order_match)\b/;
const grades=['sewage','poor','decent','good','excellent'];
function tagErrors(value,tags){
 const s=clean(value);if(!s.includes('<'))return [];
 const errors=Text.compile(s,tags).errors;
 if(/<\/?(?:[A-Za-z][\w-]*|\d+)\b[^<>]*(?=<|$)/.test(s))return [...new Set([...errors,'태그의 끝 기호(>)가 없습니다.'])];
 return errors;
}
const labels={coaster:'코스터 제공',order:'주문',empty_glass:'빈잔 전환',expression:'표정 변경',exit:'퇴장'};
function audit(m,tags){
 const issues=[],seen=new Set(),byId=new Map(m.scenes.map(sc=>[sc.id,sc])),lists=new Map(m.scenes.map(sc=>[sc.id,m.rows(sc.id)]));
 function report(sc,row,msg,severity='error',option,field){const i={scene:sc.id,day:sc.day,row:row.row_id,choice:option?.row_id,field,severity,message:msg,label:sc.day+'일차 · '+(sc.phase==='bar'?'단골 영업':'개점 전')+' · '+row.seq+'번'+(option?' · 선택지 '+option.seq:'')};const k=JSON.stringify(i);if(!seen.has(k)){seen.add(k);issues.push(i);}}
 for(const sc of m.scenes)for(const r of lists.get(sc.id)){
  const opts=r.type==='choice'?m.choices(r.arg):[];
  for(const x of [r,...opts])for(const f of (x===r?['text.ko','text.en']:['text.ko','text.en','lock_reason.ko','lock_reason.en']))for(const e of tagErrors(x[f],tags))report(sc,r,e,'error',x!==r?x:null,f);
  const pair=lists.get(sc.id)[lists.get(sc.id).indexOf(r)+1];
  if(r.type==='craft'&&pair?.type==='serve'&&clean(pair.when)&&clean(pair.when)!==clean(r.when))report(sc,pair,'제공은 바로 앞 제조와 한 번에 실행되어 이 줄의 별도 조건을 검사하지 않습니다. 제조 줄에 조건을 두세요.','warning');
  if(r.type==='enter'&&r.sync==='no_wait'&&pair?.type==='enter'&&clean(pair.when)&&clean(pair.when)!==clean(r.when))report(sc,pair,'동시 입장은 첫 번째 줄에서 두 손님을 함께 입장시킵니다. 두 번째 줄의 별도 조건은 적용되지 않습니다.','warning');
  if(r.type==='end_part'&&clean(r.effects))report(sc,r,'영업 종료 줄에서는 상태 변경이 실행되지 않습니다. 종료 전 줄로 옮기세요.','warning');
  if(r.type==='order'&&r.arg!=='free'&&!/^exact:\w+$/.test(clean(r.arg)))report(sc,r,'주문 종류가 없습니다. 자유 주문 또는 실제 칵테일을 선택하세요.');
  for(const o of opts)if(!clean(o['text.ko']))report(sc,r,'빈 선택지입니다. 표시할 문구를 입력하세요.','error',o,'text.ko');
  for(const o of opts)if(clean(o.goto)&&(!byId.has(o.goto)||byId.get(o.goto).day!==sc.day))report(sc,r,'없는 이동 장면 또는 다른 일차: '+o.goto,'error',o,'goto');
 }
 // Split AND conditions into mutually exclusive passing/failing paths. Repeated
 // tests of the same flag reuse that path's value, including choice assignments.
 const reached=new Set();let truncated=false;
 const fork=(s,k,v)=>({...s,f:{...s.f,[k]:v}});
 function split(s,expr,day){
  let yes=s;const no=[];
  for(const t of clean(expr).split('&&').map(x=>x.trim()).filter(Boolean)){
   if(!yes)break;let k=t.replace(/\s+/g,''),want=true,known;
   const b=k.match(/^(!)?(flag\.\w+|order_match)(?:(==|!=)(true|false))?$/);
   if(b){k=b[2];want=!b[1];if(b[3]&&(b[3]==='!=')===(b[4]==='true'))want=!want;}
   if(k==='!true'||k==='!false'){want=false;k=k.slice(1);}
   const cmp=k.match(/^(grade|final_grade|craft_grade|money|affinity\.\w+)(==|!=|>=|<=|<|>)(-?\d+|sewage|poor|decent|good|excellent)$/);
   if(cmp){const [,name,op,lit]=cmp,g=grades.includes(lit),key=name==='grade'?'final_grade':name,n=g?grades.indexOf(lit):Number(lit),bound=Number.MAX_SAFE_INTEGER;
    const domain=yes.f[key]||(g?[[0,4]]:[[-bound,bound]]),ranges={'==':[[n,n]],'!=':[[-bound,n-1],[n+1,bound]],'<':[[-bound,n-1]],'<=':[[-bound,n]],'>':[[n+1,bound]],'>=':[[n,bound]]},inverse={'==':'!=','!=':'==','<':'>=','>=':'<','>':'<=','<=':'>'};
    const clip=zones=>domain.flatMap(([a,b])=>zones.map(([l,h])=>[Math.max(a,l),Math.min(b,h)]).filter(([l,h])=>l<=h));
    const pass=clip(ranges[op]),fail=clip(ranges[inverse[op]]);if(fail.length)no.push(fork(yes,key,fail));yes=pass.length?fork(yes,key,pass):null;continue;
   }
   if(k==='true'||k==='false')known=k==='true';
   const n=k.match(/^day(==|!=|>=|<=|>|<)(\d+)$/);if(n){const a=+day,v=+n[2];known=({'==':a===v,'!=':a!==v,'>=':a>=v,'<=':a<=v,'>':a>v,'<':a<v})[n[1]];}
   known=known??yes.f[k]??(/^flag\.bp_(?:take|path)_editor_/.test(k)?false:undefined);
   if(known===undefined){no.push(fork(yes,k,!want));yes=fork(yes,k,want);}
   else if(known!==want){no.push(yes);yes=null;}
  }
  return {yes,no};
 }
 function effects(s,expr){
  const f={...s.f};for(const t of clean(expr).split(';')){
   const a=t.trim().match(/^(flag\.\w+)\s*=\s*(true|false)$/);if(a){for(const k of Object.keys(f))if(k!==a[1]&&(k.match(/\bflag\.\w+/g)||[]).includes(a[1]))delete f[k];f[a[1]]=a[2]==='true';}
   else {const key=t.trim().match(/^(money|affinity\.\w+)/)?.[1];if(key)for(const k of Object.keys(f))if(k.includes(key))delete f[k];}
  }return {...s,f};
 }
 function missesResult(s,expr,day){for(const term of clean(expr).split('&&')){if(!s)return false;if(resultKey.test(term)&&!s.result)return true;s=split(s,term,day).yes;}return false;}
 const resetResult=s=>({...s,result:false,f:Object.fromEntries(Object.entries(s.f).filter(([k])=>!resultKey.test(k)))});
 const initial=()=>({f:{},L:'',R:'',coasters:[],order:'',result:false});
 const roots=m.scenes.filter(s=>s.trigger!=='manual');
 for(const origin of roots){
  const work=[{id:origin.id,i:0,s:initial(),path:[origin.id]}],memo=new Map();
  function push(ctx,i,s){work.push({...ctx,i,s});}
  for(let at=0;at<work.length;at++){
   const ctx=work[at],{id,i,s,path}=ctx,sc=byId.get(id),list=lists.get(id),r=list[i];
   if(!r){if(s.order&&list.length)report(sc,list.at(-1),'장면이 끝나도 '+s.order+'의 주문이 남아 있습니다.');continue;}
   const pos=path.join('/')+':'+i,key=JSON.stringify(s);let bucket=memo.get(pos);if(!bucket)memo.set(pos,bucket=new Set());if(bucket.has(key))continue;
   if(bucket.size>=192||at>75000){truncated=true;report(sc,r,'분기 조합이 많아 일부 경로만 검사했습니다. 이 장면은 직접 재생해 주세요.','warning');if(at>75000)break;continue;}bucket.add(key);
   const fail=msg=>report(sc,r,msg);
   if(missesResult(s,r.when,sc.day))fail('칵테일 제공 전에 제조 결과 조건을 읽는 경로가 있습니다.');
   const gate=split(s,r.when,sc.day);for(const skip of gate.no)push(ctx,i+1,skip);
   let v=gate.yes;if(!v)continue;reached.add(r.row_id);
   const actor=r.actor,seat=v.L===actor?'L':v.R===actor?'R':'';
   if(labels[r.type]&&!seat){fail(labels[r.type]+' 대상 '+actor+'가 입장하지 않은 경로가 있습니다. 입장과 이 줄의 조건을 확인하세요.');continue;}
   if(r.type==='choice'){
    const options=m.choices(r.arg);let locked=[v];
    for(const o of options){
     const expr=o.when;if(missesResult(v,expr,sc.day))report(sc,r,'제공 결과가 없는 상태에서 선택지 조건을 읽습니다.','error',o,'when');
     locked=locked.flatMap(p=>split(p,expr,sc.day).no);const on=split(v,expr,sc.day).yes;if(!on)continue;
     const out=effects(effects(on,o.effects),r.effects),dest=clean(o.goto);
     if(!dest)push(ctx,i+1,out);
     else if(byId.has(dest)&&byId.get(dest).day===sc.day){
      if(path.includes(dest))report(sc,r,'선택지로 이미 지난 장면에 돌아가는 순환 연결입니다.','error',o,'goto');
      else work.push({id:dest,i:0,s:resetResult(out),path:[...path,dest]});
     }
    }
    if(locked.length)fail('모든 선택지가 동시에 잠겨 다음으로 갈 수 있는 선택지가 없는 경로입니다.');continue;
   }
   if(r.type==='enter'){
    const pair=r.sync==='no_wait'&&list[i+1]?.type==='enter'?[r,list[i+1]]:[r];
    for(const e of pair){reached.add(e.row_id);if(v[e.arg==='L'?'R':'L']===e.actor)fail(e.actor+'가 두 좌석에 동시에 입장해 제공 대상을 구분할 수 없습니다.');if(v[e.arg])fail(e.arg+' 좌석이 비기 전에 '+e.actor+'가 다시 입장합니다.');v=effects({...v,[e.arg]:e.actor},e.effects);v=fork(v,'flag.'+e.actor+'_met',true);}
    push(ctx,i+pair.length,v);continue;
   }
   if(r.type==='exit')v={...v,[seat]:'',coasters:v.coasters.filter(x=>x!==actor)};
   if(r.type==='coaster')v={...v,coasters:[...new Set([...v.coasters,actor])]};
   if(r.type==='order'){if(v.order)fail('앞 주문을 제공하기 전에 새 주문을 받습니다.');v={...resetResult(v),order:actor};}
   if(r.type==='craft'){
    const serve=list[i+1];if(!v.order||serve?.type!=='serve'||serve.actor!==v.order||!v.coasters.includes(v.order)){fail('제조 후 제공할 수 없습니다. 같은 손님의 입장 → 코스터 → 주문 → 제조 → 제공 순서를 확인하세요.');continue;}
    reached.add(serve.row_id);push(ctx,i+2,effects(effects({...resetResult(v),result:true,order:''},r.effects),serve.effects));continue;
   }
   if(r.type==='serve'){fail('제조를 거치지 않고 제공 줄에 도착하는 경로가 있습니다.');continue;}
   if(r.type==='end_part'){if(v.order)fail('주문을 제공하지 않고 영업을 종료합니다.');continue;}
   push(ctx,i+1,effects(v,r.effects));
  }
 }
 if(!truncated)for(const sc of m.scenes){const list=lists.get(sc.id);for(let i=0;i<list.length;){if(reached.has(list[i].row_id)){i++;continue;}const first=list[i++];while(i<list.length&&!reached.has(list[i].row_id))i++;const last=list[i-1];report(sc,first,(last===first?'이 줄':first.seq+'~'+last.seq+'번 줄')+'을 실행하는 경로를 찾지 못했습니다. 앞의 종료·장면 이동과 조건을 확인하세요.','warning');}}
 return issues;
}
const api={audit,tagErrors};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarAudit=api;
})(typeof window==='undefined'?globalThis:window);
