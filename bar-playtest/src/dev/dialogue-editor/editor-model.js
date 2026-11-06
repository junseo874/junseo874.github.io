/* Editable CSV source snapshot. No writes or main-game state in this module. */
(function(root){
'use strict';
const Csv=typeof module==='undefined'?root.LunaCsv:require('../../shared/data/csv-catalog.js');
const Projection=typeof module==='undefined'?root.LunaRuntimeProjection:require('../../shared/data/runtime-projection.js');
const Text=typeof module==='undefined'?root.LunaTextEffects:require('../../shared/dialogue/text-effects.js');
const rules=(typeof module==='undefined'?root.LunaRuleParts.conditions:require('../../core/story-conditions.js'))({GRADES:['sewage','poor','decent','good','excellent'],n:(v,d=0)=>v==null||v===''?d:Number(v),root:{}});
const paths={steps:'story/steps.csv',bar_choices:'story/bar_choices.csv',bar_choice_groups:'story/bar_choice_groups.csv'};
const clone=x=>JSON.parse(JSON.stringify(x)),empty=v=>v==null||v===''||v==='\\N',decode=v=>empty(v)?'':v==='\\E'?'':v;
const csv=(header,rows)=>[header,...rows.map(r=>header.map(k=>r[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const uid=()=> 'editor_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)).replaceAll('-','');
// Editing must not introduce semantics absent from the current Unity ConditionUtil.
// Existing unsupported source rows remain visible for explicit user decisions.
function engineExpressionErrors(row,before){
 const errors=[],changed=key=>!before||row[key]!==before[key];
 if(changed('effects'))for(const clause of decode(row.effects).split(';').map(x=>x.trim()).filter(Boolean)){
  if(!/^(?:flag\.\w+\s*=\s*(?:true|false)|affinity\.\w+\s*(?:\+=|-=|=)\s*-?\d+|money\s*(?:\+=|-=)\s*\d+)$/.test(clause))errors.push('엔진이 지원하지 않는 효과입니다. 구조 변경은 승인 후 진행하세요: '+clause);
 }
 if(changed('when')&&/\b(?:reputation|phase|cocktail|alive|ordered_cocktail|served_cocktail)\b/.test(decode(row.when).replace(/"[^"]*"|'[^']*'/g,'')))errors.push('엔진이 지원하지 않는 조건 값입니다: '+row.when);
 return errors;
}
class Model{
 constructor(files,presentation){this.files={...files};this.presentation=presentation;this.views=JSON.parse(files['web-views.json']);this.tables={};this.headers={};for(const [table,path]of Object.entries(paths)){this.tables[table]=Csv.parseRows(files[path],path);this.headers[table]=Csv.parseCsv(files[path])[0];}this.undoStack=[];this.redoStack=[];this.base=this.snapshot();}
 async init(){this.catalog=await Csv.load(p=>Promise.resolve(this.files[p]));this.projected=Projection.project(this.catalog,this.views,this.presentation);this.scenes=this.projected.data.tables.scenes.filter(s=>Number(s.day)>=0&&Number(s.day)<=3);return this;}
 snapshot(){return clone({tables:this.tables,views:this.views});}
 restore(s){this.tables=clone(s.tables);this.views=clone(s.views);}
 checkpoint(){this.undoStack.push(this.snapshot());if(this.undoStack.length>80)this.undoStack.shift();this.redoStack=[];}
 undo(){if(!this.undoStack.length)return;this.redoStack.push(this.snapshot());this.restore(this.undoStack.pop());}
 redo(){if(!this.redoStack.length)return;this.undoStack.push(this.snapshot());this.restore(this.redoStack.pop());}
 dirty(){return JSON.stringify(this.snapshot())!==JSON.stringify(this.base);}
 rows(scene){return this.tables.steps.filter(r=>r.context===scene).sort((a,b)=>Number(a.source_order)-Number(b.source_order));}
 row(id){return this.tables.steps.find(r=>r.row_id===id);}
 choices(id){const group=this.tables.bar_choice_groups.find(r=>r.choice_group===id);return group?this.tables.bar_choices.filter(r=>r.parent_id===group.row_id).sort((a,b)=>Number(a.source_order)-Number(b.source_order)):[];}
 step(row){return Object.fromEntries(['type','actor','arg','text.ko','text.en','when','effects','sync','entrance','dialogue_id','seq','row_id'].map(k=>[k,decode(row[k])]));}
 set(row,key,value){row[key]=String(value);if(key==='type'&&!empty(row['web_fields.type']))row['web_fields.type']=value;if(key==='actor'&&!empty(row['web_fields.who']))row['web_fields.who']=this.projected.data.tables.characters.find(c=>c.id===value)?.['name.ko']||value;}
 prefix(scene){return Object.values(this.views.campaign.opening).find(r=>r.scene===scene)?.offset||0;}
 reorder(scene,ids){const rows=this.rows(scene),prefix=this.prefix(scene);if(ids.length!==rows.length||new Set(ids).size!==ids.length||ids.some(id=>!rows.some(r=>r.row_id===id)))throw Error('순서 목록이 일치하지 않습니다.');if(rows.slice(0,prefix).some((r,i)=>r.row_id!==ids[i]))throw Error('개점 장면의 초기 배치는 맨 앞에 유지해야 합니다.');ids.forEach((id,i)=>{const r=this.row(id);r.source_order=String(i);r.seq=String(i+1);});}
 add(scene,index,type='say',duplicate=null){
  const rows=this.rows(scene),source=duplicate||rows.find(r=>r.type===type&&r.template_id==='steps_format_68')||this.tables.steps.find(r=>r.type===type&&r.template_id==='steps_format_68');
  if(!source)throw Error('이 종류의 추가 템플릿이 없습니다. 기존 줄을 복제해 주세요.');
  const r=clone(source),id=uid(),anchor=rows[0];Object.assign(r,{row_id:id,web_row_id:id,dialogue_id:type==='say'?'dlg_'+id:'',context:scene,parent_id:anchor.parent_id,dataset_id:anchor.dataset_id,source_order:String(rows.length),seq:String(rows.length+1)});
  if(!duplicate){for(const k of ['text.ko','text.en','when','effects'])r[k]='';if(type==='say'){r.arg='default';r['text.ko']='새 대사';}}
  const spec=this.views.tables.steps.rows.find(s=>s.id===source.web_row_id);if(!spec)throw Error('웹 연결 템플릿을 찾을 수 없습니다.');this.views.tables.steps.rows.push({...clone(spec),id});this.tables.steps.push(r);
  if(type==='choice')this.cloneChoiceGroup(source.arg,r);
  const ids=rows.map(r=>r.row_id);ids.splice(Math.max(this.prefix(scene),index),0,id);this.reorder(scene,ids);return r;
 }
 cloneChoiceGroup(groupId,step){
  const source=this.tables.bar_choice_groups.find(r=>r.choice_group===groupId),sourceRows=this.choices(groupId);if(!source||!sourceRows.length)throw Error('복제할 선택지가 없습니다.');
  const group=clone(source),id=uid();Object.assign(group,{row_id:id,choice_group:'ch_'+id,dataset_id:step.dataset_id,parent_id:'script_files_'+step.dataset_id.replaceAll('/','_')});
  const siblings=this.tables.bar_choice_groups.filter(r=>r.parent_id===group.parent_id);group.source_order=String(Math.max(-1,...siblings.map(r=>Number(r.source_order)))+1);
  this.tables.bar_choice_groups.push(group);step.arg=group.choice_group;
  // The groups view uses engine row keys, not web_row_id.
  const gv=this.views.tables.bar_choice_groups,gs=gv.rows.find(s=>s.key?.choice_group===groupId||s.id===source.web_row_id);
  if(gs){const copied=clone(gs);copied.key={...copied.key,choice_group:group.choice_group};if(copied.id)copied.id=group.row_id;gv.rows.push(copied);}
  for(const old of sourceRows){const r=clone(old),id=uid(),spec=this.views.tables.bar_choices.rows.find(s=>s.id===old.web_row_id);Object.assign(r,{row_id:id,web_row_id:id,parent_id:group.row_id,dataset_id:step.dataset_id,context:step.dataset_id.replaceAll('/','_')+'/'+group.choice_group});this.tables.bar_choices.push(r);this.views.tables.bar_choices.rows.push({...clone(spec),id});}
 }
 remove(scene,id){const rows=this.rows(scene);if(rows.findIndex(r=>r.row_id===id)<this.prefix(scene))throw Error('장면 초기 배치는 삭제할 수 없습니다.');if(rows.length===1)throw Error('장면에 한 줄은 남겨 주세요.');const row=this.row(id);this.tables.steps=this.tables.steps.filter(r=>r!==row);this.views.tables.steps.rows=this.views.tables.steps.rows.filter(s=>s.id!==row.web_row_id);this.reorder(scene,this.rows(scene).map(r=>r.row_id));}
 addChoice(groupId){const rows=this.choices(groupId);if(rows.length>=4)throw Error('선택지는 최대 4개입니다.');if(!rows.length)throw Error('선택지 원본이 없습니다.');const r=clone(rows.at(-1)),old=r.web_row_id,id=uid();Object.assign(r,{row_id:id,web_row_id:id,seq:String(rows.length+1),source_order:String(rows.length),'text.ko':'새 선택지','text.en':'',when:'',effects:'',goto:'','lock_reason.ko':'','lock_reason.en':''});this.tables.bar_choices.push(r);this.views.tables.bar_choices.rows.push({...clone(this.views.tables.bar_choices.rows.find(s=>s.id===old)),id});return r;}
 removeChoice(groupId,id){const rows=this.choices(groupId);if(rows.length<=1)throw Error('선택지를 한 개 이상 남겨 주세요.');const row=rows.find(r=>r.row_id===id);this.tables.bar_choices=this.tables.bar_choices.filter(r=>r!==row);this.views.tables.bar_choices.rows=this.views.tables.bar_choices.rows.filter(s=>s.id!==row.web_row_id);this.choices(groupId).forEach((r,i)=>{r.seq=String(i+1);r.source_order=String(i);});}
 changes(){const result=[];for(const table of Object.keys(paths)){const old=new Map(this.base.tables[table].map(r=>[r.row_id,r]));for(const r of this.tables[table]){const before=old.get(r.row_id);if(!before)result.push({table,id:r.row_id,kind:'추가',after:decode(r['text.ko'])||r.type||r.choice_group});else for(const [key,value]of Object.entries(r))if(before[key]!==value)result.push({table,id:r.row_id,kind:'수정',key,before:decode(before[key]),after:decode(value)});old.delete(r.row_id);}for(const r of old.values())result.push({table,id:r.row_id,kind:'삭제',before:decode(r['text.ko'])||r.type});}return result;}
 output(){const files={};for(const [table,path]of Object.entries(paths)){if(JSON.stringify(this.tables[table])!==JSON.stringify(this.base.tables[table]))files[path]=csv(this.headers[table],this.tables[table]);}if(JSON.stringify(this.views)!==JSON.stringify(this.base.views))files['web-views.json']=JSON.stringify(this.views,null,2)+'\n';return files;}
 async validate(){
  const files={...this.files,...this.output()},errors=[];let result;
  try{const catalog=await Csv.load(p=>Promise.resolve(files[p]));result=Projection.project(catalog,this.views,this.presentation);}catch(e){return {errors:[e.message]};}
  const ids=new Set(result.data.tables.scenes.map(s=>s.id));
  const baseline=new Map([...this.base.tables.steps,...this.base.tables.bar_choices].map(r=>[r.row_id,r]));
  for(const row of [...this.tables.steps,...this.tables.bar_choices])errors.push(...engineExpressionErrors(row,baseline.get(row.row_id)));
  const supported=new Set(['say','enter','exit','effect','choice','order','craft','serve','end_part','timeline','tutorial','coaster','empty_glass','popup']);
  for(const row of this.tables.steps)if((!baseline.has(row.row_id)||baseline.get(row.row_id).type!==row.type)&&!supported.has(row.type))errors.push('엔진 실행기가 지원하지 않는 대사 타입: '+row.type);
  for(const scene of this.scenes){const rows=this.rows(scene.id);for(const [index,r]of rows.entries()){
   const label=scene.day+'일차 '+(index+1)+'번';
   const ctx={day:Number(scene.day),money:1000,reputation:0,phase:'bar',flags:{},affinity:{},grade:'good',craft_grade:'good',final_grade:'good',order_match:true,cocktail:{id:'gin_tonic',abv:10},tags:[],ordered:'gin_tonic',served:'gin_tonic'};
   for(const x of [r,...(r.type==='choice'?this.choices(r.arg):[])])try{rules.condition(decode(x.when),ctx);rules.applyEffects(decode(x.effects),{...ctx,flags:{},affinity:{}});}catch(e){errors.push(label+': '+e.message);}
   for(const lang of ['ko','en'])for(const error of Text.compile(decode(r['text.'+lang]),result.data.tables.text_tags).errors)errors.push(label+': '+error);
   if(r.type==='enter'&&!['L','R'].includes(r.arg))errors.push(label+': 입장 좌석은 L 또는 R입니다.');
   if(r.type==='enter'&&r.sync==='no_wait'&&(rows[index+1]?.type!=='enter'||rows[index+1]?.sync!=='wait'))errors.push(label+': 동시 입장은 바로 다음에 대기형 입장 줄이 필요합니다.');
   if(r.type==='enter'&&!this.presentation.characterLayers[r.actor]&&r.actor!=='shiba')errors.push(label+': 바에 표시할 수 없는 입장 인물입니다.');
   if(['say','expression','order','coaster','serve','empty_glass','exit'].includes(r.type)&&empty(r.actor))errors.push(label+': 화자/대상을 지정하세요.');
   if(r.type==='order'&&r.arg.startsWith('exact:')&&!result.data.tables.cocktails.some(c=>c.id===r.arg.slice(6)))errors.push(label+': 없는 칵테일 주문입니다.');
   if(r.type==='craft'&&rows[index+1]?.type!=='serve')errors.push(label+': 제조 다음에는 음료 제공 줄이 필요합니다.');
   if(r.type==='choice'){const choices=this.choices(r.arg);if(!choices.length||choices.length>4)errors.push(label+': 선택지는 1~4개입니다.');for(const c of choices){if(!empty(c.goto)&&(!ids.has(c.goto)||!result.data.tables.scenes.some(s=>s.id===c.goto&&String(s.day)===String(scene.day))))errors.push(label+': 없는 이동 장면 또는 다른 일차 '+c.goto);if(empty(c['text.ko']))errors.push(label+': 빈 선택지가 있습니다.');}}
  }}
  return {errors:[...new Set(errors)],result};
 }
}
const api={Model,paths,csv,decode,engineExpressionErrors};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaDialogueEditorModel=api;
})(typeof window==='undefined'?globalThis:window);
