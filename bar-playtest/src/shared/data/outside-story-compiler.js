/* Translate native street CSV commands into web dialogue steps and routes.
   No game state, DOM, or effect execution. */
(function(root){'use strict';
const isWorldScript=id=>['script/street','script/home','script/ambient'].includes(id);
function optionalPresentation(raw){
 // Keep the grant between the two spoken lines, even if the surrounding dialogue is edited.
 if(raw?.parent_id==='street_choices_allow_yes'&&raw.type==='effect'&&raw.effects==='money += 500')return {type:'shop-allowance-grant'};
 if(raw?.actor==='tv_announcer')return {actor:'tv'}; // Legacy, non-proximity broadcasts share the screen anchor.
 if(raw?.actor==='street-newspaper'&&raw.type==='choice'&&raw['web_fields.type']==='choice'&&!raw.row_id?.startsWith('exterior_editor_'))return {type:'newspaper-choice',who:'신문 읽는 남자'};
 // Unity displays this notification and commits the receipt flags on the same step.
 // The web's existing item handler owns its single notification and inventory increment.
 if(raw?.type==='popup'&&raw.arg==='event_occurred'){
  const flags=(raw.effects||'').split(';').map(s=>s.trim());
  if(flags.includes('flag.newspaper_gear_received = true'))return {type:'newspaper-action',action:'grant-gear'};
  if(flags.includes('flag.believer_emblem_received = true'))return {type:'believer-action',action:'grant-emblem'};
 }
 return {};
}

// Use the same proximity definitions the Unity scene controller consumes.
// The web view selects content; it does not own a second day/route rule set.
function compileAmbientInteractions(catalog,views){
 const result={};
 for(const scene of catalog.read('script/ambient').scenes){
  const ref=views.outside?.['ambient/'+scene.id];
  if(ref?.source!=='script/ambient'||ref.scene!==scene.id)throw Error('주변 대화 원본에 연결되지 않은 웹 장면: '+scene.id);
  const home=scene.phase==='home';
  const points=catalog.read(home?'interact_points_home':'interact_points_outside');
  const matches=points.flatMap(point=>(point.dialogue_flows||[]).filter(flow=>flow.scene_id===scene.id&&point.activation_mode==='proximity').map(flow=>({point,flow})));
  if(matches.length!==1)throw Error('주변 대화에 근접 상호작용이 정확히 하나 필요합니다: '+scene.id);
  const {point,flow}=matches[0];
  if(point.action_type!=='dialogue'||scene.trigger!=='manual'||!scene.steps?.length||scene.steps.some(s=>s.type!=='say'))throw Error('기본 주변 대화 형식이 아닙니다: '+scene.id);
  if(point.source_id==='home_tv_broadcast'&&scene.steps.some(s=>s.actor!=='tv'))throw Error('집 TV 방송의 화자는 tv여야 합니다: '+scene.id);
  result[scene.id]={sourceId:point.source_id,scene:home?'home':'street',phase:point.phase,spawnWhen:point.spawn_when,interactWhen:point.interact_when,day:flow.day,when:flow.when,sceneWhen:scene.when,playType:flow.play_type,actors:[...new Set(scene.steps.map(s=>s.actor))]};
 }
 return result;
}

function compileNewspaperRoutes(catalog,views){
 const refs=Object.entries(views.outside).filter(([key])=>key.startsWith('newspaper/'));
 const byScene=new Map(refs.map(([key,ref])=>[ref.scene,key]));
 const scenes=catalog.read('script/street').scenes;
 const intro=scenes.find(s=>byScene.get(s.id)==='newspaper/intro');
 if(!intro)throw Error('신문 NPC의 시작 장면이 없습니다.');

 const children=catalog.rawTables.get('Steps');
 const scene=catalog.rawTables.get('Scenes').find(r=>r.dataset_id==='script/street'&&r.id===intro.id);
 const questions=children.filter(r=>r.parent_id===scene.row_id&&r.actor==='street-newspaper'&&r['web_fields.type']==='choice'&&!r.row_id.startsWith('exterior_editor_'));
 if(questions.length!==1)throw Error(intro.id+': 기본 질문은 하나여야 합니다.');const rawMenu=questions[0],menu=intro.steps.find(s=>+s.seq===+rawMenu.seq);
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
   for(const step of scene.steps){
    const reward=step.type==='popup'&&optionalPresentation(step).action==='grant-gear';
    if((!reward&&!['say','effect','goto'].includes(step.type))||(step.type==='say'&&step.when))
     throw Error(id+' #'+step.seq+': 신문 분기는 일반 대사·보상·효과·마지막 무조건 goto만 지원합니다.');
   }
   keys.push(key);
   id=terminalGoto(scene.steps,id);
   // A player-authored epilogue runs from the real terminal goto inside
   // 'finish', after the gear and completion flag; don't flatten it twice.
   if(key==='newspaper/finish'&&id&&views.outside?.['graph/'+id]?.source==='script/street'&&children.some(r=>r.context===scene.id&&r.type==='goto'&&r.row_id.startsWith('exterior_editor_link_')&&r.scene_id===id))break;
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
const api={isWorldScript,optionalPresentation,compileNewspaperRoutes,compileAmbientInteractions};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LunaStoryProjectionParts=api;
})(typeof window==='undefined'?globalThis:window);
