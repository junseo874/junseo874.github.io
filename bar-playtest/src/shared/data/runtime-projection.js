/* Runtime views are projections, never independent content sources. */
(function(root){
function project(catalog,views,presentation){
 const nullish=v=>v==null||v===''||v==='\\N';
 const decode=v=>nullish(v)?null:v==='\\E'?'':v?.startsWith('\\\\')?v.slice(1):v;
 const records=new Map([...catalog.rawTables.values()].flat().map(r=>[r.row_id,r]));
 const stepChildren=new Map();for(const r of catalog.rawTables.get('Steps')||[]){if(!stepChildren.has(r.parent_id))stepChildren.set(r.parent_id,[]);stepChildren.get(r.parent_id).push(r);}for(const rows of stepChildren.values())rows.sort((a,b)=>+a.source_order-+b.source_order);
 const rawScenes=catalog.rawTables.get('Scenes')||[],rawChoices=catalog.rawTables.get('StreetChoices')||[];
 const tables={};
 for(const [name,view]of Object.entries(views.tables)){
  const raw=catalog.rawTables.get(view.table);if(!raw)throw Error('View table missing: '+name);
  tables[name]=view.rows.map(spec=>{
   const row=raw.find(r=>spec.id&&r.web_row_id===spec.id)||raw.find(r=>Object.keys(spec.key).length&&Object.entries(spec.key).every(([k,v])=>r[k]===String(v)));
   if(!row)throw Error('View record missing: '+name+'/'+spec.id);
   const parent=records.get(row.parent_id);
   return Object.fromEntries(spec.fields.map(field=>{
    let value=field==='row_id'?spec.id:field==='value_type'?spec.valueType:field==='context'?(parent?.id||parent?.choice_group||decode(row.context)):field==='type'&&row.web_type?decode(row.web_type):field==='text'&&Object.hasOwn(row,'text.ko')?decode(row['text.ko']):decode(row[field]);
    if(value!=null&&value!==''){if(spec.numbers.includes(field))value=Number(value);if(spec.booleans.includes(field))value=value===true||value==='true';}
    // Imported CSV booleans retain the historical web shape.
    if(value==='true'||value==='false')value=value==='true';
    if(value==='count'&&spec.countLabel?.includes(field))value='개';
    return[field,value];
   }));
  });
 }
 function lines(ref){
  const scene=catalog.read(ref.source).scenes.find(s=>s.id===ref.scene);if(!scene)throw Error('View scene missing: '+ref.scene);
  function option(steps,id){for(const step of steps)for(const o of step.options||[]){if(o.id===id)return o;const nested=option(o.result_steps||[],id);if(nested)return nested;}return null;}
  const steps=ref.branch?option(scene.steps,ref.branch)?.result_steps:scene.steps;if(!steps)throw Error('View branch missing: '+ref.branch);
  const sceneRow=rawScenes.find(r=>r.dataset_id===ref.source&&r.id===ref.scene);
  const within=id=>{let r=records.get(id);while(r){if(r.row_id===sceneRow?.row_id)return true;r=records.get(r.parent_id);}return false;};
  const parent=ref.branch?rawChoices.find(r=>r.dataset_id===ref.source&&r.id===ref.branch&&within(r.row_id))?.row_id:sceneRow?.row_id;
  const rawSteps=stepChildren.get(parent)||[];
  return steps.slice(ref.offset).map((step,index)=>{
   if(!step.web_fields)return null;
   const row={...step.web_fields};
   for(const key of (step.web_core_keys||'').split('|').filter(Boolean))row[key]=key==='text'?step.text?.ko:key==='en'?step.text?.en:key==='arg'&&step.web_empty_arg&&step[key]===null?'':step[key];
   if(ref.source.startsWith('script/street')||ref.source.startsWith('script/home')){
    const raw=rawSteps[(ref.offset||0)+index];
    if(raw){row.editorRowId=raw.row_id;const config=views.outsideChoiceEdits?.[raw.row_id];if(config?.who)row.who=config.who;}
   }
   return row;
  }).filter(Boolean);
 }
 const story={source:views.campaign.source,revision:views.campaign.revision,actors:views.campaign.actors};
 for(const group of ['opening','bar','scenes'])story[group]=Object.fromEntries(Object.entries(views.campaign[group]).map(([id,ref])=>[id,lines(ref)]));
 for(const key of ['prologue','day0Bar'])story[key]=lines(views.campaign[key]);
 const outsideChoices=(catalog.rawTables.get('StreetChoices')||[]).filter(r=>['script/street','script/home'].includes(r.dataset_id)).map(r=>Object.fromEntries(['row_id','parent_id','id','text.ko','text.en','when','lock_reason.ko'].map(k=>[k,decode(r[k])])));
 const outsideChoiceEdits=Object.fromEntries(Object.entries(views.outsideChoiceEdits||{}).map(([key,cfg])=>{const r=records.get(cfg.stepId);return[key,{...cfg,prompt:{text:decode(r?.['text.ko'])||'',actor:decode(r?.actor),...(cfg.who?{who:cfg.who}:{})}}];}));
 return{data:{...presentation,tables,outsideChoices,outsideChoiceEdits,sharedStory:Object.fromEntries(Object.entries(views.outside||{}).map(([id,ref])=>[id,lines(ref)]))},story};
}
if(typeof module!=='undefined'&&module.exports)module.exports={project};
else root.LunaRuntimeProjection={project};
})(typeof window==='undefined'?globalThis:window);
