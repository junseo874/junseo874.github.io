/* An editing scene is a named range of the real, continuous bar script.
   It never becomes an engine scene, a goto, or an extra game command. */
(function(root){
'use strict';
const first='@first',all='@all',limit=10;
const records=(m,s)=>m.views.barEditorScenes?.[s]||[];
const title=(value)=>{const t=String(value??'').trim();if(!t||t.length>64||/[\x00-\x1f]/.test(t))throw Error('장면 이름은 한 줄로 1~64자까지 입력하세요.');return t;};
function suggest(nodes,start,actorName,end=nodes.length){
 const r=nodes[start].rows[0];if(r.type==='enter'||r.type==='exit')return actorName(r.actor)+(r.type==='enter'?' 등장':' 퇴장');
 const arriving=nodes.slice(start+1,Math.min(start+4,end)).find(n=>n.rows[0].type==='enter');if(arriving)return actorName(arriving.rows[0].actor)+' 등장';
 const c=nodes[start].cast;return c.length?c.map(actorName).join(' · ')+' 대화':'장면 시작';
}
function auto(nodes){
 const out=[0];let a=0;
 while(nodes.length-a>limit){
  const cuts=[],fallback=[];for(let i=a+1;i<nodes.length;i++){
   const r=nodes[i].rows[0],prev=nodes[i-1].rows.at(-1);
   if(!['enter','exit'].includes(r.type)||r.type==='enter'&&prev.type==='enter'&&prev.sync==='no_wait')continue;
   fallback.push(i);
   // Prefer the arrival over a nearby farewell, and avoid a one-node trailer where possible.
   if(r.type==='exit'&&nodes.slice(i+1,i+4).some(n=>n.rows[0].type==='enter'))continue;
   if(i-a<2||nodes.length-i<2)continue;
   cuts.push(i);
  }
  if(!cuts.length)cuts.push(...fallback);if(!cuts.length)break;
  a=cuts.sort((i,j)=>Math.abs(i-a-limit)-Math.abs(j-a-limit)||i-j)[0];out.push(a);
 }return out;
}
function partition(m,s,nodes,actorName=id=>id){
 if(!nodes.length)return [];
 const fixed=records(m,s),pos=new Map(nodes.map((n,i)=>[n.id,i]));
 const marks=fixed.length?fixed.map(v=>({i:v.start===first?0:pos.get(v.start),name:v.name})).filter(v=>v.i!==undefined).sort((a,b)=>a.i-b.i):auto(nodes).map((i,k,a)=>({i,name:suggest(nodes,i,actorName,a[k+1])}));
 return marks.map((v,k)=>({id:v.i===0?first:nodes[v.i].id,name:v.name,nodes:nodes.slice(v.i,marks[k+1]?.i),index:k,start:v.i,end:marks[k+1]?.i??nodes.length,manual:!!fixed.length})).filter(x=>x.nodes.length);
}
function current(parts,id){return parts.find(g=>g.nodes.some(n=>n.id===id||n.rows.some(r=>r.row_id===id)));}
function write(m,s,items){(m.views.barEditorScenes||={})[s]=items.map(p=>({start:p.id,name:title(p.name)}));}
function split(m,s,parts,id,name){
 const part=current(parts,id),at=part?.nodes.findIndex(n=>n.id===id);
 if(at==null||at<1)throw Error('첫 노드는 이미 이 장면의 시작입니다. 두 번째 이후 노드에서 나누세요.');
 const next=title(name);if(parts.some(p=>p.name===next))throw Error('이 대본에 같은 이름의 장면이 있습니다.');
 const result=[...parts];result.splice(part.index+1,0,{id,name:next});write(m,s,result);
}
function rename(m,s,parts,part,name){const next=title(name);if(parts.some(p=>p.id!==part.id&&p.name===next))throw Error('이미 있는 장면 이름입니다.');write(m,s,parts.map(p=>p.id===part.id?{...p,name:next}:p));}
function merge(m,s,parts,part){if(!part||!part.index)throw Error('앞 장면이 없습니다.');write(m,s,parts.filter(p=>p.id!==part.id));}
function reset(m,s){if(!m.views.barEditorScenes)return;delete m.views.barEditorScenes[s];if(!Object.keys(m.views.barEditorScenes).length)delete m.views.barEditorScenes;}
function removed(m,s,id,logical){const data=records(m,s),i=data.findIndex(p=>p.start===id);if(i<0)return;
 const next=logical[logical.findIndex(r=>r.row_id===id)+1];if(next&&!data.some(p=>p.start===next.row_id))data[i].start=next.row_id;else data.splice(i,1);
}
function reordered(m,s,ids){
 const data=records(m,s);if(!data.length)return;
 const rank=new Map(ids.map((id,i)=>[id,i])),marks=data.slice(1).filter(p=>rank.has(p.start)).sort((a,b)=>rank.get(a.start)-rank.get(b.start));
 const atHead=marks[0]?.start===ids[0]?marks.shift():null;
 m.views.barEditorScenes[s]=[{start:first,name:(atHead||data[0]).name},...marks];
}
function validate(m,wire){
 const issues=[],data=m.views.barEditorScenes;if(data===undefined)return issues;
 if(!data||typeof data!=='object'||Array.isArray(data))return ['편집 장면 목록을 읽을 수 없습니다.'];
 for(const [s,marks] of Object.entries(data)){
  if(!m.scenes.some(sc=>sc.id===s)||!Array.isArray(marks)||!marks.length){issues.push('바 대본이 아닌 편집 장면: '+s);continue;}
  const list=wire.scan(m,s).logical,ids=new Set(list.slice(1).map(r=>r.row_id)),used=new Set();
  for(const [i,p] of marks.entries())try{if(!p||Object.keys(p).some(k=>!['start','name'].includes(k))||typeof p.name!=='string'||title(p.name)!==p.name||used.has(p.start)||(i===0?p.start!==first:!ids.has(p.start)))throw Error('시작 노드 또는 이름을 확인하세요.');used.add(p.start);}catch(e){issues.push(s+' 편집 장면: '+e.message);}
 }return issues;
}
const api={first,all,records,auto,partition,current,split,rename,merge,reset,removed,reordered,validate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaBarSections=api;
})(globalThis);
