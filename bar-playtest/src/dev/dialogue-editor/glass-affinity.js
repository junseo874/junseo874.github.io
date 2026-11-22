/* The inspector edits the final change, not the taste-table correction.
   Keep existing row IDs (and their wires) even when restoring the default. */
(function(root){
'use strict';
const kinds=[
 ['!order_match','주문 불일치',['sewage']],
 ['order_match && final_grade == decent','DECENT',['decent']],
 ['order_match && final_grade < decent','POOR / SEWAGE',['poor','sewage']],
 ['order_match && final_grade >= good','GOOD / EXCELLENT',['good','excellent']]
];
const signed=n=>n>0?'+'+n:String(n);
function inspect(route,node,predicates){
 const branches=[];
 for(const [guard,title,grades] of kinds){
  if(!predicates.includes(guard))continue;
  const samples=grades.map(grade=>{
   const v=route.glassResult(guard!=='!order_match',grade);
   const when=guard+(grades.length>1?' && final_grade == '+grade:'');
   if(!v||v.row&&!node.rows.some(r=>r.row_id===v.row&&r.when===when))return null;
   return {...v,grade,when};
  });
  if(samples.some(s=>!s))continue;
  const equal=samples.every(s=>s.delta===samples[0].delta);
  branches.push({guard,title,samples,actor:samples[0].actor,value:equal?samples[0].delta:null,
   custom:samples.some(s=>s.correction!==0),display:equal?signed(samples[0].delta):samples.map(s=>s.grade.toUpperCase()+' '+signed(s.delta)).join(' / ')});
 }
 return branches;
}
function write(model,scene,node,branch,input){
 const reset=input===null;
 if(!reset&&(!/^[+-]?\d+$/.test(String(input).trim())||!Number.isSafeInteger(Number(input))))throw Error('호감도는 0 또는 양수·음수 정수로 입력하세요.');
 for(const s of branch.samples){
  const change=reset?0:Number(input)-(s.delta-s.correction);
  if(!Number.isSafeInteger(change)||Math.abs(change)>2147483647)throw Error('저장할 수 있는 정수 범위를 벗어났습니다.');
  if(change===s.correction)continue;
  // Insert before existing corrections, never after a wired output row.
  const r=s.row?model.row(s.row):model.add(scene,model.rows(scene).indexOf(node.rows[0])+1,'effect',node.rows[1]);
  if(!s.row){model.set(r,'actor',s.actor);model.set(r,'when',s.when);}
  model.set(r,'effects','affinity.'+s.actor+(change<0?' -= ':' += ')+Math.abs(change));
 }
 return node.rows[0];
}
const api={inspect,write};if(typeof module!=='undefined')module.exports=api;else root.LunaGlassAffinity=api;
})(globalThis);
