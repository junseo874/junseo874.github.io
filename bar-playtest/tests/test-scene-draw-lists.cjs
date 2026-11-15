const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {create}=require('../src/features/outside/scene-draw-lists.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/runtime/outside-scene-data.js'),'utf8'),ctx);
const scenes=structuredClone(ctx.window.LUNA_OUTSIDE_DATA.scenes);
const base=(a,b)=>a.layer-b.layer||a.order-b.order||b.z-a.z||0;
let engine=false,calls=0;
const depth=n=>!engine&&n.name==='residence-building'?5.5:n.layer;
const rank=n=>['BG','Residence'].includes(n.ancestry?.[0])?0:1;
const compare=(a,b)=>depth(a)-depth(b)||a.order-b.order||b.z-a.z||rank(a)-rank(b)||String(a.id).localeCompare(String(b.id));
const lists=create((a,b)=>{calls++;return compare(a,b);});
function same(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((node,i)=>assert.equal(node,expected[i]));}
function parity(source,actors,street){
 const reference=[...source,...actors].sort(base),result=lists(source,actors,street,engine);
 same(result.base,reference);same(result.paint,street?reference.slice().sort(compare):reference);return result;
}
for(const mode of [false,true]){
 engine=mode;
 for(const [scene,{nodes}] of Object.entries(scenes)){
  const street=scene==='street',a=nodes[0];
  parity(nodes,[],street);const old=calls;
  for(let i=0;i<60;i++)parity(nodes,[],street);
  assert.equal(calls,old,'unchanged scenery must not be sorted again');
  for(let i=0;i<8;i++){
   const actors=[{...a,id:'live',order:i%2},{...a,engineDraw:()=>i}];
   const result=parity(nodes,actors,street);
   assert(result.paint.includes(actors[1]),'use the live draw callback, not the previous frame');
  }
 }
}
const source=scenes.street.nodes.slice(0,10),actor={...source[0]};parity(source,[actor],true);
for(const [key,value] of [['layer',-100],['order',99],['z',15],['id','changed'],['name','residence-building'],['ancestry',['Residence']]]){
 Object.assign(source[0],{[key]:value});const prev=calls;parity(source,[actor],true);assert(calls>prev);
}
source.reverse();parity(source,[actor],true);source.pop();parity(source,[actor],true);
source[0]={...source[0]};parity(source,[actor],true);engine=false;parity(source,[actor],true);
console.log('SCENE_DRAW_LISTS_OK: home/street layer parity, equal keys, live actors, mutations and engine mode; 60 unchanged frames with zero static re-sorts.');
