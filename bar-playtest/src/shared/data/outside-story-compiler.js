/* Translate native street CSV commands into web dialogue steps and routes.
   No game state, DOM, or effect execution. */
(function(root){'use strict';
function optionalPresentation(raw){
 if(raw?.actor==='tv_announcer')return {actor:'tv'}; // Existing Unity TV speaker; web screen anchor keeps its ID.
 if(raw?.actor==='street-newspaper'&&raw.type==='choice'&&raw['web_fields.type']==='choice')return {type:'newspaper-choice',who:'신문 읽는 남자'};
 if(raw?.type==='effect'&&raw.arg==='gear_part')return {type:'newspaper-action',action:'grant-gear'};
 if(raw?.type==='effect'&&raw.arg==='machine_church_emblem')return {type:'believer-action',action:'grant-emblem'};
 return {};
}

// Use the same proximity definitions the Unity scene controller consumes.
// The web view selects content; it does not own a second day/route rule set.
function compileAmbientInteractions(catalog,views){
 const result={};
 for(const [key,ref]of Object.entries(views.outside||{})){
  if(!key.startsWith('ambient/')||!['script/home','script/street'].includes(ref.source))continue;
  const home=ref.source==='script/home',scene=catalog.read(ref.source).scenes.find(s=>s.id===ref.scene);
  const points=catalog.read(home?'interact_points_home':'interact_points_outside');
  const matches=points.flatMap(point=>(point.dialogue_flows||[]).filter(flow=>flow.scene_id===ref.scene&&point.activation_mode==='proximity').map(flow=>({point,flow})));
  if(!matches.length)continue; // Forced encounters and inspectable posters are not ambient groups.
  if(matches.length!==1||!scene)throw Error('주변 자동 대화 연결이 모호합니다: '+ref.scene);
  const {point,flow}=matches[0];
  if(point.action_type!=='dialogue'||scene.start_mode!=='auto'||!scene.steps.length||scene.steps.some(s=>s.type!=='say'))throw Error('기본 자동 대화 형식이 아닙니다: '+ref.scene);
  result[ref.scene]={sourceId:point.source_id,scene:home?'home':'street',phase:point.phase,spawnWhen:point.spawn_when,interactWhen:point.interact_when,day:flow.day,when:flow.when,sceneWhen:scene.when,playType:flow.play_type,actors:[...new Set(scene.steps.map(s=>s.actor))]};
 }
 return result;
}

function compileNewspaperRoutes(catalog,views){
 const refs=Object.entries(views.outside).filter(([key])=>key.startsWith('newspaper/'));
 const byScene=new Map(refs.map(([key,ref])=>[ref.scene,key]));
 const scenes=catalog.read('script/street').scenes;
 const intro=scenes.find(s=>byScene.get(s.id)==='newspaper/intro');
 if(!intro)throw Error('신문 NPC의 시작 장면이 없습니다.');
 const menus=intro.steps.filter(s=>s.actor==='street-newspaper'&&s.web_fields?.type==='choice');
 if(menus.length!==1)throw Error(intro.id+': 기본 질문은 하나여야 합니다.');
 const menu=menus[0];
 const children=catalog.rawTables.get('Steps');
 const scene=catalog.rawTables.get('Scenes').find(r=>r.dataset_id==='script/street'&&r.id===intro.id);
 const rawMenu=children.find(r=>r.parent_id===scene.row_id&&r.actor==='street-newspaper'&&r['web_fields.type']==='choice');
 if(!menu||!rawMenu)throw Error('Missing newspaper native choice in '+intro.id);
 function terminalGoto(steps,label){
  const jumps=steps.filter(step=>step.type==='goto');
  if(!jumps.length)return null;
  const jump=jumps[0];
  if(jumps.length!==1||steps.at(-1)!==jump||jump.when||!jump.scene_id)
   throw Error(label+': 신문 분기는 마지막 줄의 무조건 goto 하나만 지원합니다.');
  return jump.scene_id;
 }
 function follow(id){
  const keys=[];
  while(id){
   const key=byScene.get(id),scene=scenes.find(s=>s.id===id);
   if(!key||!scene||keys.includes(key))throw Error('Invalid newspaper goto: '+id);
   for(const step of scene.steps)if(!['say','effect','goto'].includes(step.type)||step.type==='say'&&step.when)
    throw Error(id+' #'+step.seq+': 신문 기본 분기는 일반 대사·효과·마지막 무조건 goto만 지원합니다.');
   keys.push(key);
   id=terminalGoto(scene.steps,id);
  }
  return keys;
 }
 const routes={};for(const option of menu.options||[]){
  const steps=option.result_steps||[],target=terminalGoto(steps,option.id);
  if(!target&&['newspaper-wrong','newspaper-right'].includes(option.id))throw Error(option.id+': 기본 답변에 후속 goto가 없습니다.');
  if(target&&steps.length!==1)throw Error(option.id+': 기본 답변의 goto 앞에 별도 명령을 둘 수 없습니다.');
  if(target)routes[option.id]=follow(target);
 }
 const native=Object.values(routes);const join=native[0]?.filter(key=>native.every(route=>route.includes(key)))||[];
 return {parent:rawMenu.row_id,routes,join};
}
const api={optionalPresentation,compileNewspaperRoutes,compileAmbientInteractions};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaStoryProjectionParts=api;
})(typeof window==='undefined'?globalThis:window);
