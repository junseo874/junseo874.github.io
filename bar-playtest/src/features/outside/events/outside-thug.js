// Day 1 forced corridor encounter. Reuses the street actor and speech layers.
(function(W){
'use strict';
const id='day1-corridor-thug',R=W.LunaResidence.layout,home=R.homeX,enginePoint=W.LunaEngineWorld?.actorPoint('street',id,'thug'),baseX=enginePoint?.x??home+.7,positionX=()=>W.LunaNpcScene?.shift('thug',baseX)??baseX;
const intro=W.LUNA_DATA.sharedStory['thug/intro'];
const paid=W.LUNA_DATA.sharedStory['thug/paid'];
const refused=W.LUNA_DATA.sharedStory['thug/refused'];
function flags(m){return W.lunaCampaign?.session.active&&!W.lunaCampaign.session.developer?(W.barGame.progress.flags??={}):(m.thugFlags??={});}
function save(m,key,value){flags(m)[key]=value;const c=W.lunaCampaign;if(c?.session.active&&!c.session.developer&&c.session.carry){c.session.carry.flags??={};c.session.carry.flags[key]=value;}}
function visible(m){return !m.qa&&m.scene==='street'&&m.level===1&&m.config.day===1&&m.config.flow==='in'&&!flags(m).day1_thug_done;}
function start(m){const npcX=positionX();m.backgroundStory.cancel();m.facing=1;m.anim='idle';m.animTime=0;W.outsidePlaytest?.clearInput();m.encounter={kind:'thug',stage:'entering',elapsed:0,camera:{x:W.LunaNpcScene?.shift('thug',home+.4)??home+.4,y:R.upperY+.65,w:4.8},cameraReady:false,npcX,alpha:1,hurt:false,target:{id,x:npcX,y:R.upperY}};m.updateNear();}
function rows(m){return flags(m).day1_thug_choice==='pay'?paid:flags(m).day1_thug_choice==='refuse'?refused:intro;}
function action(m,row){const e=m.encounter;if(e?.kind!=='thug')return false;e.stage=row.action;e.elapsed=0;e.from=e.npcX;return true;}
function tick(m,dt){let e=m.encounter;
 if(e?.kind!=='thug')return false;
 e.elapsed+=dt;m.anim='idle';m.animTime+=dt;
 if(e.stage==='entering'&&e.elapsed>=.65&&e.cameraReady){e.stage='active';m.story.beginRows(id,e.target,rows(m));}
 else if(e.stage==='punch'){
  const t=e.elapsed;e.npcX=t<.65?e.from+(m.x+.33-e.from)*Math.min(1,t/.65):m.x+.33+Math.min(1,(t-.85)/.6)*.3;e.target.x=e.npcX;
  if(t>=.85)e.hurt=true;
  if(t>=1.65){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='depart'){
  const exit=W.LunaOutsideNPCExit.sample(e.elapsed,e.from);e.npcX=exit.x;e.alpha=exit.alpha;e.target.x=e.npcX;
  if(exit.done){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.cameraReady&&e.elapsed>.4){save(m,'day1_thug_done',true);m.encounter=null;W.outsidePlaytest?.clearInput();m.updateNear();}
 return true;
}
function choiceView(){const money=Math.max(0,Number(W.barGame?.progress.money)||0);return{label:'입주 비용 선택',money,options:[{id:'thug-pay',label:'500원을 준다 · 500원',disabled:money<500,disabledReason:'돈이 부족합니다.'},{id:'thug-refuse',label:'주지 않는다.',disabled:false}]};}
function choose(m,choice){const s=m.story.speech;if(s?.id!==id||!s.choice)return false;const pay=choice==='thug-pay';if(!pay&&choice!=='thug-refuse'||pay&&Math.max(0,Number(W.barGame?.progress.money)||0)<500)return false;s.choice=false;
 if(pay){const g=W.barGame,before=g.progress.money;g.progress.money=before-500;const c=W.lunaCampaign;if(c?.session.active&&c.session.carry)c.session.carry.money=g.progress.money;g.log('corridor_thug_payment',{before,after:g.progress.money,price:500});g.changed();}
 save(m,'day1_thug_choice',pay?'pay':'refuse');m.story.beginRows(id,s.target,pay?paid:refused);return true;
}
function pose(m){const e=m.encounter?.kind==='thug'?m.encounter:null,x=e?.npcX??positionX(),p={sp:W.LunaOutsideAmbient.sprite('Neighbor',m.time),x,y:enginePoint?.y??R.upperY-.274,flip:e?.stage==='depart'||(!!e&&W.LunaOutsideAmbient.faceTarget(x,m.x)),alpha:e?.alpha??1};return W.LunaEngineWorld?W.LunaEngineWorld.actorPose('street',id,'thug',p.sp,p.x,p.y,p.flip,p.alpha):p;}
function anchor(m,actor){if(actor!==id)return null;const p=pose(m);return W.LunaOutsideAmbient.head(p.sp,p.x,p.y,p.sx??1,p.sy??1,p.flip)||{x:p.x,y:p.y+.61};}
function draw(m,sprite,ctx,position){if(!visible(m))return;const p=pose(m);
 // The right-hand pillar is baked into the building art; clip the NPC behind it.
 ctx.save();ctx.beginPath();ctx.rect(-2048,-2048,position(-13.70,0).x+2048,4096);ctx.clip();
 sprite({...p.sp,engineActor:p.engineActor,engineLayer:p.layer,engineOrder:p.order},p.x,p.y,p.sx??1,p.sy??1,p.flip,p.alpha);
 // The existing body lunge/recoil conveys the hit. Do not draw an extra limb.
 ctx.restore();
}
function offer(m){W.LunaOutsideStory.events.offer(m,id,()=>visible(m)&&m.x>=(W.LunaNpcScene?.shift('thug',home+.12)??home+.12)&&m.x<=R.upperMax,()=>start(m),10);}
W.LunaOutsideThug={id,intro,paid,refused,visible,start,tick,action,choose,choiceView,draw,pose,anchor,offer};
})(window);
