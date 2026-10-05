// Notion exterior conversations: ambient pairs and the day 1 forced trade scene.
(function(global){
'use strict';
const trade='outside_day1_samho_smuggler';
const actors={'store-pair-left':{name:'행인 1',color:'#d6b987'},'store-pair-right':{name:'행인 2',color:'#a8c4d8'},'bar-pair-left':{name:'행인 1',color:'#d6b987'},'bar-pair-right':{name:'행인 2',color:'#a8c4d8'},'trade-samho':{name:'삼호',color:'#d6b987'},'trade-smuggler':{name:'밀수업자',color:'#a8c4d8'}};
const trading=[{id:'trade-samho',kind:'samho',x:3.6,y:-.7,top:-.24,faces:'trade-smuggler'},{id:'trade-smuggler',kind:'M1',x:4.32,y:-.94,top:-.38,faces:'trade-samho'}];
const cases=[{id:'outside_day0_store_passers',activation:'proximity',kind:'pair',members:['store-pair-left','store-pair-right']},{id:'outside_day0_building_residents',activation:'upper-corridor-visible',kind:'pair',members:['resident-left','resident-right']},{id:'outside_day0_port_pair',activation:'proximity',kind:'pair',members:['bar-pair-left','bar-pair-right']},{id:trade,activation:'forced',kind:'pair',members:trading.map(p=>p.id)}];
function actor(id){const resident=global.LunaOutsideResidents?.actor(id);if(resident)return resident;const p=trading.find(p=>p.id===id)||global.LunaOutsideAmbient.placements.find(p=>p.id===id);return p?{...p,name:'행인',...actors[id],top:p.top??p.y+(p.kind==='M2'?.61:p.kind==='W1'?.53:.56)}:null;}
function tradeVisible(m){return !m.qa&&global.LunaOutsideContent.active(m,global.LunaOutsideContent.events.find(e=>e.id===trade));}
function targets(){return [];}
const flags=m=>m.qa?(m.qa.storyFlags??={}):global.lunaCampaign?.active?(global.barGame.progress.flags??={}):(m.notionFlags??={});
function start(m){
 if(m.encounter)return false;
 m.story.cancel();m.backgroundStory.cancel();global.outsidePlaytest?.clearInput();
 const center=m.qa?.425:(trading[0].x+trading[1].x)/2;
 m.encounter={kind:'smuggler-trade',stage:'entering',elapsed:0,camera:{x:(center+m.x)/2,y:-.05,w:4.8},cameraReady:false,target:{id:trade,x:center,y:-.7}};
 m.facing=m.x<center?1:-1;m.anim='idle';m.updateNear();return true;
}
function tick(m,dt){
 const e=m.encounter;
 if(e?.kind!=='smuggler-trade'){
  if(!m.qa&&!m.encounter&&!m.paused&&!m.transition&&!m.ride&&!m.dialog&&!m.story.blocking&&tradeVisible(m)&&!flags(m).day1_trade_done&&m.x>=2.7&&m.x<=5)return start(m);
  return false;
 }
 e.elapsed+=dt;m.anim='idle';m.animTime+=dt;
 if(e.stage==='entering'&&e.elapsed>=.65&&e.cameraReady){e.stage='active';m.story.begin(trade,e.target);}
 else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.cameraReady&&e.elapsed>.4){
  flags(m).day1_trade_done=true;
  const c=global.lunaCampaign;if(!m.qa&&c?.active&&c.session.carry){c.session.carry.flags??={};c.session.carry.flags.day1_trade_done=true;}
  m.encounter=null;if(m.qa){m.qa.done=true;m.qa.camera=null;}global.outsidePlaytest?.clearInput();m.updateNear();
 }
 return true;
}
function prepare(){return null;}
function tickProximity(model){
 const story=model.backgroundStory;
 if(model.scene!=='street'||model.qa||model.level||model.transition||model.ride||model.encounter||model.dialog||model.story.blocking)return;
 for(const c of cases.filter(c=>c.activation==='proximity'&&global.LunaOutsideContent.active(model,global.LunaOutsideContent.events.find(e=>e.id===c.id))&&!model.playedAmbient.has(c.id)&&c.members.some(id=>Math.abs(actor(id).x-model.x)<=.85)))if(story.begin(c.id,{id:c.id},true))model.playedAmbient.add(c.id);
}
function apply(data){const source=data.scenes.street.nodes.find(n=>n.name==='Samho');for(const p of trading){const id='optional-'+p.id;if(data.scenes.street.nodes.some(n=>n.id===id))continue;data.scenes.street.nodes.push({id,name:id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,tradeActor:p.id,sprite:p.kind==='samho'?{...source.sprite}:{asset:'ambient-M1',x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}}
function drawNode(m,n,draw){if(!n.tradeActor)return false;if(tradeVisible(m)){const p=actor(n.tradeActor),other=actor(p.faces),phase=m.time%4,frame=p.kind==='samho'?(phase<.3?Math.floor(phase*10)%3:0):Math.floor(m.time*3.4)%6;draw({...n.sprite,x:frame*(p.kind==='samho'?84:129)},n.x,n.y,1,1,global.LunaOutsideAmbient.faceTarget(p.x,other.x));}return true;}
global.LunaOutsideEncounters={cases,actor,targets,prepare,start,tick,tickProximity,tradeVisible,trading,drawNode};
if(global.LUNA_OUTSIDE_DATA)apply(global.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
