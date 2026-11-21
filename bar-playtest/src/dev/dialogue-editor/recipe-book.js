/* Craft authoring uses the existing Unity row templates; IDs aren't free-form inputs. */
(function(root){
'use strict';
const Csv=typeof module==='undefined'?root.LunaCsv:require('../../shared/data/csv-catalog.js');
const paths={cocktails:'craft/cocktails.csv',shelf_items:'craft/shelf_items.csv',recipes:'craft/recipes.csv'};
const fields={cocktails:['name.ko','name.en','flavor.ko','flavor.en','recipe_desc.ko','recipe_desc.en','mix','glass','price','abv','time_limit_sec'],shelf_items:['name.ko','name.en','desc.ko','desc.en','default_target_qty']};
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v),fail=msg=>{throw Error(msg);};
const csv=(text,rows)=>{const header=Csv.parseCsv(text)[0];return (text.startsWith('\uFEFF')?'\uFEFF':'')+[header,...rows.map(r=>header.map(k=>r[k]))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
class Book{
 constructor(files){
  this.files=files;this.base=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,Csv.parseRows(files[p])]));
  this.tags=Csv.parseRows(files['craft/cocktail_tags.csv']);this.edits={cocktails:{},shelf_items:{},recipes:{}};
 }
 row(table,id){const r=this.base[table].find(r=>r.id===id);if(!r)fail('목록에 없는 항목: '+id);return {...r,...this.edits[table][id]};}
 lines(id){return this.edits.recipes[id]||this.originalLines(id);}
 originalLines(id){return this.base.recipes.filter(r=>r.context===id).map(({ingredient,qty,is_core,action})=>({ingredient,qty,is_core,action}));}
 set(table,id,k,v){
  if(!Object.hasOwn(fields,table)||!fields[table].includes(k)||typeof v!=='string')fail('허용되지 않은 편집 항목입니다.');
  this.row(table,id);const changes=this.edits[table][id]??={};
  if(this.base[table].find(r=>r.id===id)[k]===v)delete changes[k];else changes[k]=v;
  if(!Object.keys(changes).length)delete this.edits[table][id];
 }
 setLines(id,lines){this.row('cocktails',id);if(!Array.isArray(lines)||lines.length>this.base.shelf_items.length)fail('재료 목록을 확인하세요.');
  const clean=lines.map(r=>{if(!r||!['ingredient','qty','action','is_core'].every(k=>typeof r[k]==='string'))fail('재료 값이 올바르지 않습니다.');
   return {ingredient:r.ingredient,qty:r.qty,is_core:r.is_core,action:r.action};});
  if(same(clean,this.originalLines(id)))delete this.edits.recipes[id];else this.edits.recipes[id]=clean;
 }
 apply(edits){
  if(!record(edits))fail('변경 목록이 없습니다.');
  for(const [t,rows] of Object.entries(edits)){if(!Object.hasOwn(paths,t)||!record(rows))fail('허용되지 않은 테이블입니다.');
   for(const [id,v] of Object.entries(rows)){if(t==='recipes')this.setLines(id,v);else{if(!record(v))fail('잘못된 변경입니다.');for(const [k,val] of Object.entries(v))this.set(t,id,k,val);}}}
 }
 validate(){
  for(const t of Object.keys(fields))for(const [id,changes] of Object.entries(this.edits[t]))for(const [k,v] of Object.entries(changes)){
   if(v.startsWith('\\')||k.startsWith('name.')&&!v.trim())fail(id+' · 이름과 텍스트를 확인하세요.');
   if(['price','abv','time_limit_sec','default_target_qty'].includes(k)&&(!/^\d+$/.test(v)||!Number.isSafeInteger(+v)||+v>(k==='abv'?100:2147483647)||(['time_limit_sec','default_target_qty'].includes(k)&&+v===0)))fail(id+' · 숫자 범위를 확인하세요.');
   if(k==='mix'&&!['build','shake','stir','none'].includes(v)||k==='glass'&&!this.base.shelf_items.some(r=>r.kind==='glass'&&r.id===v))fail('등록된 잔이나 제조 방식을 선택하세요.');
   if(t==='shelf_items'&&this.row(t,id).kind!=='ingredient')fail('재료만 수정할 수 있습니다.');
  }
  for(const [id,lines] of Object.entries(this.edits.recipes)){
   if(!lines.length||new Set(lines.map(r=>r.ingredient)).size!==lines.length)fail(id+' · 서로 다른 재료를 한 가지 이상 선택하세요.');
   for(const r of lines){const item=this.row('shelf_items',r.ingredient),count=item.default_target_unit==='count';
    if(item.kind!=='ingredient'||!['true','false'].includes(r.is_core)||!(count?['add']:['pour','fill_up']).includes(r.action))fail(id+' · 재료와 동작을 확인하세요.');
    if(!/^\d+(?:\.\d+)?$/.test(r.qty)||!(+r.qty>0&&+r.qty<=2147483647)||count&&!Number.isInteger(+r.qty))fail(id+' · 용량은 양수, 개수는 정수로 입력하세요.');
   }
  }
 }
 output(){
  this.validate();const out={};
  for(const t of Object.keys(fields))if(Object.keys(this.edits[t]).length)out[paths[t]]=csv(this.files[paths[t]],this.base[t].map(r=>{
   const patch=this.edits[t][r.id];if(!patch)return r;return {...r,...patch,...(patch.mix?{target_mix_method:patch.mix}:{})};}));
  if(Object.keys(this.edits.recipes).length){
   const views=JSON.parse(this.files['web-views.json']),specs=views.tables.recipes.rows,lookup=new Map(specs.map(s=>[s.id,s])),nextSpecs=new Map(),nextRows=new Map();
   for(const [id,lines] of Object.entries(this.edits.recipes)){const parent=this.row('cocktails',id),old=this.base.recipes.filter(r=>r.context===id);
    const rows=lines.map((l,i)=>{const item=this.row('shelf_items',l.ingredient),r=old.find(r=>r.ingredient===l.ingredient),key='recipes_'+id+'_'+l.ingredient;
     return {...(r||{context:id,unit:item.default_target_unit,scored:'true',auto_apply:'false',dataset_id:parent.dataset_id,row_id:key,parent_id:parent.row_id,parent_field:'recipe',web_row_id:'recipe_editor_'+id+'_'+l.ingredient}),...l,source_order:String(i),template_id:Number.isInteger(+l.qty)?(r?.template_id||'recipes_format_01'):'recipes_format_02'};});
    nextRows.set(id,rows);nextSpecs.set(id,rows.map(r=>lookup.get(r.web_row_id)||{...specs[0],id:r.web_row_id,countLabel:r.unit==='count'?['unit']:[]}));
   }
   const replace=(arr,group,replacements)=>{const seen=new Set();return arr.flatMap(r=>{const k=group(r);if(!replacements.has(k))return [r];if(seen.has(k))return [];seen.add(k);return replacements.get(k);});};
   out[paths.recipes]=csv(this.files[paths.recipes],replace(this.base.recipes,r=>r.context,nextRows));
   const byWeb=new Map(this.base.recipes.map(r=>[r.web_row_id,r.context]));
   const updated=replace(specs,s=>byWeb.get(s.id),nextSpecs);if(!same(updated,specs)){views.tables.recipes.rows=updated;out['web-views.json']=JSON.stringify(views,null,2)+'\n';}
  }return out;
 }
}
const api={Book,paths,fields};if(typeof module==='undefined')root.LunaRecipeBook=api;else module.exports=api;
})(typeof window==='undefined'?globalThis:window);
