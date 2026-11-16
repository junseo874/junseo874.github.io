/* Runtime views are projections, never independent content sources. */
(function(root){
const adapters=typeof module==='undefined'?root.LunaStoryProjectionParts:require('./outside-story-compiler.js');
const {optionalPresentation}=adapters;
const applyGuestArtwork=typeof module==='undefined'?root.LunaGuestArtworkView:require('./guest-artwork-view.js');
function project(catalog,views,presentation){
 const nullish=v=>v==null||v===''||v==='\\N';
 const decode=v=>nullish(v)?null:v==='\\E'?'':v?.startsWith('\\\\')?v.slice(1):v;
 const records=new Map([...catalog.rawTables.values()].flat().map(r=>[r.row_id,r]));
 const stepChildren=new Map();for(const r of catalog.rawTables.get('Steps')||[]){if(!stepChildren.has(r.parent_id))stepChildren.set(r.parent_id,[]);stepChildren.get(r.parent_id).push(r);}for(const rows of stepChildren.values())rows.sort((a,b)=>+a.source_order-+b.source_order);
 const rawScenes=catalog.rawTables.get('Scenes')||[],rawChoices=catalog.rawTables.get('StreetChoices')||[];
 const sceneViews=new Map(Object.entries(views.outside||{}).filter(([,r])=>!r.branch&&!r.offset).map(([k,r])=>[r.source+'|'+r.scene,k]));
 const tables={};
 for(const [name,view]of Object.entries(views.tables)){
  const raw=catalog.rawTables.get(view.table);if(!raw)throw Error('View table missing: '+name);
  tables[name]=view.rows.map(spec=>{
   const row=raw.find(r=>spec.id&&r.web_row_id===spec.id)||raw.find(r=>Object.keys(spec.key).length&&Object.entries(spec.key).every(([k,v])=>r[k]===String(v)));
   if(!row)throw Error('View record missing: '+name+'/'+spec.id);
   const parent=records.get(row.parent_id);
   const fields=name==='steps'&&row.type==='enter'&&!nullish(row.entrance)&&!spec.fields.includes('entrance')?[...spec.fields,'entrance']:spec.fields;
   return Object.fromEntries(fields.map(field=>{
    let value=field==='row_id'?spec.id:field==='value_type'?spec.valueType:field==='context'?(parent?.id||parent?.choice_group||decode(row.context)):field==='type'&&row.web_type?decode(row.web_type):field==='text'&&Object.hasOwn(row,'text.ko')?decode(row['text.ko']):decode(row[field]);
    if(value!=null&&value!==''){if(spec.numbers.includes(field))value=Number(value);if(spec.booleans.includes(field))value=value===true||value==='true';}
    // Imported CSV booleans retain the historical web shape.
    if(value==='true'||value==='false')value=value==='true';
    if(value==='count'&&spec.countLabel?.includes(field))value='개';
    return[field,value];
   }));
  });
 }
 applyGuestArtwork(tables,presentation);
 const roomPrompts=new Map();
 function lines(ref){
  const scene=catalog.read(ref.source).scenes.find(s=>s.id===ref.scene);if(!scene)throw Error('View scene missing: '+ref.scene);
  function option(steps,id){for(const step of steps)for(const o of step.options||[]){if(o.id===id)return o;const nested=option(o.result_steps||[],id);if(nested)return nested;}return null;}
  const steps=ref.branch?option(scene.steps,ref.branch)?.result_steps:scene.steps;if(!steps)throw Error('View branch missing: '+ref.branch);
  const sceneRow=rawScenes.find(r=>r.dataset_id===ref.source&&r.id===ref.scene);
  const within=id=>{let r=records.get(id);while(r){if(r.row_id===sceneRow?.row_id)return true;r=records.get(r.parent_id);}return false;};
  const parent=ref.branch?rawChoices.find(r=>r.dataset_id===ref.source&&r.id===ref.branch&&within(r.row_id))?.row_id:sceneRow?.row_id;
  const rawSteps=stepChildren.get(parent)||[];
  const projected=steps.slice(ref.offset).map((step,index)=>{
   const raw=rawSteps[(ref.offset||0)+index],presentation=optionalPresentation(raw);
   if(raw?.row_id.startsWith('exterior_editor_link_'))return {type:'goto',when:decode(raw.when)||'',target:sceneViews.get(ref.source+'|'+step.scene_id),editorRowId:raw.row_id};
   // Native popup is already an engine command; a web_fields.type override would recompile it as an unknown event.
   const authoredCommand=raw?.row_id.startsWith('exterior_editor_')&&['effect','popup'].includes(step.type);
   if(!step.web_fields&&!authoredCommand&&presentation.type!=='shop-allowance-grant')return null;
   const row=authoredCommand?{...step.web_fields,type:step.type}:{...step.web_fields};
   // The web player uses one presentation for both memories; Unity addresses two Studio assets.
   if(row.cinemaAfter==='tl_yuna_memory_d0'||row.cinemaAfter==='tl_yuna_memory_d3'){
    row.memoryKey=row.cinemaAfter==='tl_yuna_memory_d0'?'terraceMemory':'terraceMemory3';row.cinemaAfter='terrace-memory';
   }
   for(const key of (step.web_core_keys||'').split('|').filter(Boolean))row[key]=key==='text'?step.text?.ko:key==='en'?step.text?.en:key==='arg'&&step.web_empty_arg&&step[key]===null?'':step[key];
   if(adapters.isWorldScript(ref.source)){
    if(raw){Object.assign(row,presentation);row.editorRowId=raw.row_id;const config=views.outsideChoiceEdits?.[raw.row_id];if(config?.who)row.who=config.who;}
    if(authoredCommand){row.effects=step.effects||'';row.arg=step.arg;row.when=step.when||'';}
   }
   // World dialogue measures/reveals plain glyphs; keep the authored markup for painting.
   if(!ref.source.startsWith('script/bar/')&&typeof row.text==='string'&&/<(?:fx=|pop[ >]|shake[ >]|wave[ >]|slow>|fast>|color=|[0-9]+>)/.test(row.text)){
    row.styledText=row.text;
    row.text=row.text.replace(/<[^>]+>/g,'');
   }
   return row;
  }).filter(Boolean);
  // Unity speaks the wardrobe prompt, then runs its choice command. The web
  // presents that same prompt and menu together, without typing it twice.
  if(ref.scene==='home-wardrobe'){
   for(let i=1;i<projected.length;i++){
    const prompt=projected[i-1],menu=projected[i];
    if(prompt.type==='say'&&menu.type==='home-choice'&&menu.stage==='wardrobe'&&!menu.text&&prompt.actor===menu.actor){
     roomPrompts.set(menu.editorRowId,prompt.text);
     projected.splice(i-1,2,{...prompt,...menu,text:prompt.text});i--;
    }
   }
  }
  return projected;
 }
 const story={source:views.campaign.source,revision:views.campaign.revision,actors:views.campaign.actors};
 for(const group of ['opening','bar','scenes'])story[group]=Object.fromEntries(Object.entries(views.campaign[group]).map(([id,ref])=>[id,lines(ref)]));
 story.day0Bar=lines(views.campaign.day0Bar);
 const sharedStory=Object.fromEntries(Object.entries(views.outside||{}).map(([id,ref])=>[id,lines(ref)]));
 const outsideChoices=rawChoices.filter(r=>adapters.isWorldScript(r.dataset_id)).map(r=>{
  const row=Object.fromEntries(['row_id','parent_id','id','text.ko','text.en','when','lock_reason.ko'].map(k=>[k,decode(r[k])]));
  const step=records.get(r.parent_id);
  if((stepChildren.get(r.row_id)||[]).some(s=>s.row_id.startsWith('exterior_editor_link_')))row.transfer=true;
  if(records.get(step?.parent_id)?.id==='home_tv_menu')Object.assign(row,{menu:'home_tv_menu',order:+r.source_order});
  return row;
 });
 const outsideChoiceEdits=Object.fromEntries(Object.entries(views.outsideChoiceEdits||{}).map(([key,cfg])=>{const r=records.get(cfg.stepId);return[key,{...cfg,prompt:{text:roomPrompts.get(cfg.stepId)||decode(r?.['text.ko'])||'',actor:decode(r?.actor),...(cfg.who?{who:cfg.who}:{})}}];}));
 return{data:{...presentation,tables,outsideAmbient:adapters.compileAmbientInteractions(catalog,views),newspaperRoutes:adapters.compileNewspaperRoutes(catalog,views),outsideChoices,outsideChoiceEdits,sharedStory},story};
}
if(typeof module!=='undefined'&&module.exports)module.exports={project,optionalPresentation};
else root.LunaRuntimeProjection={project,optionalPresentation};
})(typeof window==='undefined'?globalThis:window);
