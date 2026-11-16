/* Editor-only visit index. Keep day AND trip paired: a visit on day 0 out and
   day 1 in/out must never accidentally appear on day 0 in. No story writes. */
(function(root){
'use strict';
const days=Object.freeze([0,1,2,3]),all='all',every=0xff;
// Bit order: 0-in, 0-out, 1-in, 1-out, 2-in, 2-out, 3-in, 3-out.
const routeBits={in:0x55,out:0xaa,both:every,none:0},routes=['in','out'];
const route=value=>Object.hasOwn(routeBits,value)?value:'both';
const enabled=(value,which)=>!!(routeBits[route(value)]&routeBits[which]);
function toggle(value,which){const bits=routeBits[route(value)]^routeBits[which];return Object.keys(routeBits).find(k=>routeBits[k]===bits);}
const parse=value=>value===all?all:/^[0-3]$/.test(String(value))?Number(value):null;
const mask=value=>Number.isInteger(parse(value))?3<<(2*Number(value)):0;
const windowOf=(d,r='both')=>(d===all?every:mask(d))&routeBits[route(r)];
const period=phase=>phase==='commute_in'||phase==='in'?routeBits.in:phase==='commute_out'||phase==='out'?routeBits.out:every;
function gateMask(when){
 // Player state (money, flags, etc.) varies within a day. Only rule out dates
 // contradicted by a required day comparison, never by an unknown expression.
 const rule=String(when||'');if(!rule.includes('day')||rule.includes('||'))return every;
 let result=every;
 for(const term of rule.split('&&')){
  const match=/^\s*\(*\s*day\s*(==|!=|>=|<=|>|<)\s*(\d+)\s*\)*\s*$/.exec(term);
  if(!match)continue;
  const n=Number(match[2]),op=match[1];for(const d of days)if(!({'==':d===n,'!=':d!==n,'>=':d>=n,'<=':d<=n,'>':d>n,'<':d<n}[op]))result&=~mask(d);
 }
 return result;
}
function index(model){return model.withReadIndex(()=>{
 const scenes=new Map(model.rawScenes.map(s=>[s.dataset_id+'/'+s.id,s]));
 const sceneOf=f=>scenes.get(f.ref.source+'/'+f.ref.scene);
 const sceneWindow=f=>{const s=sceneOf(f);return s?mask(s.day)&period(s.route)&period(s.phase):0;};
 const points=model.catalog.read('interact_points_outside');
 const visitWindow=family=>points.filter(p=>p.id.startsWith('p_'+family+'_')).reduce((acc,p)=>acc|(period(p.phase)&gateMask(p.spawn_when)&gateMask(p.interact_when)),0);
 const believer=visitWindow('believer'),newspaper=visitWindow('newspaper');
 // In the campaign projection the engine memory IDs have already been resolved
 // to the actual memory script. Use the calling night, not the template's day.
 const memories=new Map();
 for(const f of model.flows.filter(f=>f.campaign)){
  for(const r of model.projected.story?.scenes?.[f.id]||[]){
   const key=r.cinemaAfter==='johnny-memory'?'johnny':r.cinemaAfter==='terrace-memory'?(r.memoryKey||'terraceMemory'):'';
   if(key)memories.set(key,(memories.get(key)||0)|sceneWindow(f));
  }
 }
 const late=mask(2)|mask(3);
 function native(f){
  const id=f.id,ambient=model.projected.data.outsideAmbient?.[f.ref.scene];
  if(ambient)return (ambient.day==null?every:mask(ambient.day))&period(ambient.phase)&gateMask(ambient.spawnWhen)&gateMask(ambient.interactWhen)&gateMask(ambient.when)&gateMask(ambient.sceneWhen);
  if(memories.has(id))return memories.get(id);
  if(id==='workshop')return 0; // Retained script, no campaign entry.
  if(id.startsWith('believer/'))return believer;
  if(id.startsWith('newspaper/'))return newspaper;
  if(id.startsWith('beggar/'))return windowOf(0,'out');
  if(id.startsWith('home/'))return every;
  // OutsideShop.visible + needsAllowance; a QA shop day is not a story visit.
  if(id.startsWith('shop/allowance'))return mask(2);
  if(id.startsWith('shop/')||id==='choices/stock')return late;
  // OutsideNeighborhood.targets/entryKey: these manual scenes share templates.
  if(id.startsWith('neighborhood/repair'))return mask(1)|late;
  if(id==='neighborhood/guardBlocked')return windowOf(0,'out')|mask(1);
  if(id==='neighborhood/rest')return late&routeBits.out; // First sofa rest, before the night terrace.
  if(/^neighborhood\/(guard|boss|cat|feed|reveal|homeCat|rest)/.test(id))return late;
  if(id==='ambient/outside_day0_shiba_wanted')return every; // Persistent image inspection, despite its old scene ID.
  return sceneWindow(f);
 }
 const nodes=new Map(),parents=new Map(),entries=new Map(),options=new Map(model.tables.street_choices.map(r=>[r.row_id,r]));
 const sites=new Map(),map=root.LunaOutsideFlowMap||(typeof require==='function'&&require('./outside-flow-map.js'));
 for(const f of model.flows){
  const base=native(f),authored=/^(editor|graph)\//.test(f.id);
  nodes.set(f.id,{base,authored,incoming:[]});
  if(!authored&&!f.onlyChoices){const site=map.site(model,f).id;sites.set(site,(sites.get(site)||0)|base);}
  if(!f.onlyChoices&&!parents.has(f.parent))parents.set(f.parent,f);
  const ref=f.ref.source+'/'+f.ref.scene;
  if(!f.onlyChoices&&!f.ref.branch&&!f.offset&&!entries.has(ref))entries.set(ref,f);
 }
 // Loose nodes have a registration day but no route in the engine's manual
 // scene template. Show them during this site's visits until a wire owns them.
 for(const f of entries.values())if(f.id.startsWith('graph/')){
  const n=nodes.get(f.id),site=sites.get(map.site(model,f).id)||0;n.base&=site;
 }
 function incoming(to,from,when){
  if(to&&from)nodes.get(to.id).incoming.push({id:from.id,mask:gateMask(when)});
 }
 for(const f of model.flows)if(f.id.startsWith('editor/')){
  const opt=options.get(f.parent);if(opt)incoming(f,model.owner(opt.parent_id),opt.when);
 }
 for(const j of model.tables.steps)if(j.type==='goto'&&j.row_id.startsWith('exterior_editor_')){
  const to=entries.get(j.dataset_id+'/'+j.scene_id),opt=options.get(j.parent_id);
  const from=parents.get(j.parent_id)||(opt&&model.owner(opt.parent_id));
  incoming(to,from,[opt?.when,j.when].filter(Boolean).join(' && '));
 }
 // Propagate all callers (including shared/revisit/option paths), independent of
 // CSV ordering. Even a malformed cycle cannot keep the editor from opening.
 const starting=n=>n.authored&&n.incoming.length?0:n.base;
 const resolved=new Map([...nodes].map(([id,n])=>[id,starting(n)]));
 for(let i=0;i<nodes.size;i++){
  let changed=false;for(const [id,n] of nodes)if(n.incoming.length){
   const value=n.incoming.reduce((v,p)=>v|(resolved.get(p.id)&p.mask),starting(n));
   if(value!==resolved.get(id)){resolved.set(id,value);changed=true;}
  }if(!changed)break;
 }
 const keyOf=f=>typeof f==='string'?f:f?.id,bits=f=>resolved.get(keyOf(f))||0;
 const owners=new Map();
 for(const f of model.flows)for(const row of model.rows(f.id))if(!owners.has(row.row_id))owners.set(row.row_id,f.id);
 const has=(f,d,r='both')=>d===all&&r==='both'?resolved.has(keyOf(f)):!!(bits(f)&windowOf(d,r));
 return {has,days:(f,r='both')=>days.filter(d=>has(f,d,r)),routes:(f,d=all)=>routes.filter(r=>has(f,d,r)),
  allows:(f,when,d,r='both')=>d===all&&r==='both'?has(f,d,r):!!(bits(f)&gateMask(when)&windowOf(d,r)),
  sequence:(f,d,trip='both')=>trip==='none'?[]:model.sequence(f).filter(r=>!owners.has(r.row_id)||has(owners.get(r.row_id),d,trip))};
});}
const api={days,all,parse,index,route,enabled,toggle,allows:(rule,d)=>d===all||!!(gateMask(rule)&windowOf(d))};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaOutsideFlowDays=api;
})(typeof window==='undefined'?globalThis:window);
