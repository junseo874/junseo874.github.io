/* Convert the final web tables to the engine's existing dataset shapes. */
const META=new Set(['context','row_id','value_type','choice_group','string_id','situation','tag']);
const clone=x=>JSON.parse(JSON.stringify(x));
function mergeWeb(catalog,data,story,outside={}){
 const values=new Map([...catalog.values].map(([k,v])=>[k,clone(v)])),t=data.tables;
 const declared=new Map(catalog.columns.map(c=>[c.table+'.'+c.column,c.types]));
 const tableName=name=>catalog.tables.find(s=>s.path.split('/').pop()===name+'.csv')?.table;
 function row(name,r,drop=[]){
  const result={};for(const [key,raw]of Object.entries(r)){
   if(['context','row_id','value_type',...drop].includes(key)||key==='text'&&Object.hasOwn(r,'text.ko'))continue;
   let value=raw;const type=declared.get(tableName(name)+'.'+key);
   if(['unit','default_target_unit'].includes(key)&&value==='개')value='count';
   if(raw!==null&&raw!==''){
    if(type==='bool')value=raw===true||raw==='true';
    else if(type&&type.split('|').every(x=>['int','float'].includes(x)))value=Number(raw);
   }
   const fields=key.split('.');let at=result;for(const field of fields.slice(0,-1))at=at[field]??={};at[fields.at(-1)]=value;
  }
  if(r.row_id!==undefined)result.web_row_id=r.row_id;
  if(name==='steps'&&['story_cue','samho-action','notion-action','stage'].includes(result.type)){result.web_type=result.type;result.type='effect';}
  return result;
 }
 for(const name of ['barks','characters','days','dossier','order_rules','personalities','random_waves','regular_slots','shelf_items','tastes'])values.set(name,t[name].map(r=>row(name,r)));
 const balance=values.get('balance');
 balance.config=Object.fromEntries(t.balance_config.map(r=>[r.setting,r.value_type==='bool'?r.value===true||r.value==='true':['int','float'].includes(r.value_type)?Number(r.value):r.value]));
 for(const name of ['grade_cuts','score_bands','affinity_matrix'])balance[name]=t[name].map(r=>row(name,r));
 balance.settlement_rules=Object.fromEntries(t.settlement_rules.map(r=>[r.setting,row('settlement_rules',r,['setting'])]));
 for(const [name,key]of [['bark_situations','situation'],['text_tags','tag'],['ui_strings','string_id']])values.set(name,Object.fromEntries(t[name].map(r=>[r[key],row(name,r,[key])])));
 values.set('cocktails',t.cocktails.map(r=>({...row('cocktails',r),recipe:t.recipes.filter(x=>x.context===r.id).map(x=>row('recipes',x)),tags:t.cocktail_tags.filter(x=>x.context===r.id).map(x=>row('cocktail_tags',x))})));
 // Engine-only catalog entries are not deleted merely because a web view omits them.
 for(const source of ['characters','cocktails','shelf_items']){
  const ids=new Set(values.get(source).map(r=>r.id));
  values.get(source).push(...catalog.read(source).filter(r=>!ids.has(r.id)).map(clone));
 }
 // Parts retain their original group membership, which the flat web view omits.
 const bodies=values.get('guest_bodies'),parts=new Map(t.guest_parts.map(r=>[r.id,row('guest_parts',r)]));
 for(const [group,list]of Object.entries(bodies))if(Array.isArray(list)&&group!=='exclusions')bodies[group]=list.filter(r=>parts.has(r.id)).map(r=>({...r,...parts.get(r.id)}));
 bodies.defaults=row('guest_settings',t.guest_settings[0]).defaults;
 bodies.exclusions=t.guest_exclusions.map(r=>row('guest_exclusions',r));
 bodies.web_row_id=t.guest_settings[0].row_id;
 const views={tables:{},campaign:{source:story.source,revision:story.revision,actors:story.actors,opening:{},bar:{},scenes:{}}};
 for(const [name,rows]of Object.entries(t))views.tables[name]={table:tableName(name),rows:rows.map(r=>({id:r.row_id??null,key:Object.fromEntries(['id','setting','choice_group','string_id'].filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])),fields:Object.keys(r),countLabel:Object.keys(r).filter(k=>['unit','default_target_unit'].includes(k)&&r[k]==='개'),valueType:r.value_type,numbers:Object.keys(r).filter(k=>typeof r[k]==='number'),booleans:Object.keys(r).filter(k=>typeof r[k]==='boolean')}))};
 function line(r,index,old={}){
  const known=['say','enter','exit','order','craft','serve','coaster','end_part','effect','fx','sfx','choice','goto','set_state','tutorial','timeline','popup','move'];
  const type=known.includes(r.type)?r.type:r.type?.endsWith('-choice')?'choice':'effect';
  const result={seq:index+1,type,actor:r.actor??null,dialogue_id:r.dialogue_id??old.dialogue_id??null,arg:r.arg??old.arg??null,text:r.text==null?null:{ko:r.text,en:r.en??r.text},when:r.when??null,effects:r.effects??null,sync:r.sync??'wait'};
  // Presentation-only instructions remain explicit columns; text is never duplicated.
  result.web_fields=Object.fromEntries(Object.entries(r).filter(([key])=>!['text','en','actor','arg','when','effects','sync'].includes(key)));
  result.web_core_keys=Object.keys(r).filter(key=>['text','en','actor','arg','when','effects','sync'].includes(key)).join('|');
  if(type==='choice'&&old.options)result.options=old.options;
  return result;
 }
 for(const day of [0,1,2,3,99]){
  const id='script/bar/day'+day,base=values.get(id);if(!base)continue;
  const scenes=t.scenes.filter(s=>Number(s.day)===day);
  base.scenes=scenes.map(s=>({...row('scenes',s),steps:t.steps.filter(r=>r.context===s.id).map(r=>row('steps',r))}));
  const groups=new Set(base.scenes.flatMap(s=>s.steps.filter(r=>r.type==='choice').map(r=>r.arg)));
  base.choices=Object.fromEntries([...groups].map(id=>[id,t.bar_choices.filter(r=>r.context===id).map(r=>row('bar_choices',r))]));
 }
 // Campaign views reference the same main story scene, not a second dialogue copy.
 for(const day of [1,2,3])for(const part of ['opening','bar']){
  const source='script/bar/day'+day,id='campaign_d'+day+'_'+(part==='opening'?'bar_open':'bar');
  const scene=values.get(source).scenes.find(s=>s.id===id);
  if(!scene)throw Error('Campaign scene missing: '+id);
  const offset=part==='opening'?1:0;
  story[part][day].forEach((r,i)=>{scene.steps[i+offset].web_fields=Object.fromEntries(Object.entries(r).filter(([key])=>!['text','en','actor','arg','when','effects','sync'].includes(key)));scene.steps[i+offset].web_core_keys=Object.keys(r).filter(key=>['text','en','actor','arg','when','effects','sync'].includes(key)).join('|');if(r.arg==='')scene.steps[i+offset].web_empty_arg=true;});
  views.campaign[part][day]={source,scene:id,offset};
 }
 for(const [id,rows]of Object.entries(story.scenes)){
  let source=['commute2','commute3'].includes(id)?'script/street':['johnny','terraceMemory','terraceMemory3'].includes(id)?'script/cutscene':'script/home';
  const group=values.get(source);let scene=group.scenes.find(s=>s.id===id);
  if(!scene){scene={id,day:0,phase:source.split('/')[1],seq:group.scenes.length+1,trigger:'manual',title:id,skippable:false,steps:[]};group.scenes.push(scene);}
  scene.steps=rows.map((r,i)=>line(r,i,scene.steps[i]));views.campaign.scenes[id]={source,scene:id,offset:0};
 }
 // Keep unused legacy authoring arrays inspectable without making them auto scenes.
 for(const field of ['prologue','day0Bar']){
  const source='script/cutscene',id='web-authoring-'+field;
  values.get(source).scenes.push({id,day:0,phase:'intro',seq:900,trigger:'manual',title:id,skippable:true,steps:story[field].map((r,i)=>line(r,i))});
  views.campaign[field]={source,scene:id,offset:0};
 }
 views.outside={};
 function option(steps,id){for(const step of steps)for(const o of step.options||[]){if(o.id===id)return o;const nested=option(o.result_steps||[],id);if(nested)return nested;}return null;}
 const sceneMap={
  'thug/intro':['day1-corridor-thug'], 'thug/paid':['day1-corridor-thug','thug-pay'], 'thug/refused':['day1-corridor-thug','thug-refuse'],
  'notion/intro':['day2-corridor-thug'], 'notion/contract':['day3-samho-contract'],
  'notion/info/gang':['day2-thug-information','pay-gang'], 'notion/info/coratech':['day2-thug-information','pay-coratech'], 'notion/info/chris':['day2-thug-information','pay-chris'],
  'shop/intro':['shiba-shop'], 'shop/revisit':['shiba-shop-revisit'], 'shop/allowance':['shiba-allowance']
 };
 for(const[key,rows]of Object.entries(outside)){
  let source='script/street',id=sceneMap[key]?.[0]||key.slice(8),branch=sceneMap[key]?.[1];
  if(key.startsWith('ambient/')){if(values.get('script/ambient').scenes.some(s=>s.id===id))source='script/ambient';}
  else if(!sceneMap[key])id='shared-'+key.replaceAll('/','-');
  const group=values.get(source);let scene=group.scenes.find(s=>s.id===id);
  if(!scene){scene={id,day:0,phase:'street',seq:group.scenes.length+1,start_mode:'manual',title:id,steps:[]};group.scenes.push(scene);}
  const target=branch?option(scene.steps,branch):scene;if(!target)throw Error('Missing engine choice branch '+branch);
  const field=branch?'result_steps':'steps',before=target[field]||[],choice=before.find(r=>r.type==='choice');
  let sayIndex=0;
  const says=before.filter(r=>r.type==='say');
  const next=rows.map((r,i)=>line(r,i,r.type==='say'?(says[sayIndex++]||{}):r.type?.endsWith('-choice')?(choice||{}):{}));
  const effects=before.filter(r=>r.effects&&r.type!=='say');
  if(choice&&!next.some(r=>r.type==='choice'))next.push(choice);
  target[field]=[...effects,...next].map((r,i)=>({...r,seq:i+1}));
  views.outside[key]={source,scene:id,branch:branch||null,offset:0};
 }
 // An explicitly removed character must not be reintroduced by the engine copy.
 values.get('script/street').scenes=values.get('script/street').scenes.filter(s=>s.id!=='bd-vendor');
 values.set('interact_points_outside',values.get('interact_points_outside').filter(r=>![r.id,r.source_id,r.action_ref].some(v=>typeof v==='string'&&v.includes('bd-vendor'))));
 return{values,views};
}
module.exports={mergeWeb};
