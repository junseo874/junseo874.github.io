// Day 2 only. Notion 3d91612298dc8039a54ecb8b4f56701c, edited 2026-10-02T14:14:01.075Z.
// Live street staging, matching the corridor encounter; never opens a campaign scene overlay.
(function(W){
'use strict';
const id='day2-samho-commute',qaId='runtime:commute2',npcX=-5.99;
const isQA=m=>m.qa?.caseId===qaId;
function flags(m){return !m.qa&&W.lunaCampaign?.active?(W.barGame.progress.flags??={}):(m.samhoCommuteFlags??={});}
function visible(m){return isQA(m)||!m.qa&&m.config.day===2&&m.config.flow==='in'&&m.scene==='street'&&!m.level&&!flags(m).day2_samho_done;}
function start(m){if(m.encounter||!visible(m))return false;m.story.cancel();m.backgroundStory.cancel();W.outsidePlaytest?.clearInput();const x=isQA(m)?.25:npcX,side=m.x<=x?-1:1,to=x+side*.78;
 m.facing=side<0?1:-1;m.anim='idle';m.animTime=0;m.encounter={kind:id,stage:'entering',elapsed:0,from:m.x,to,npcX:x,alpha:1,camera:{x:(x+to)/2,y:m.y+.7,w:4.8},cameraReady:false,target:{id,x,y:m.y+.08}};m.updateNear();return true;
}
function action(m){const e=m.encounter;if(e?.kind!==id)return false;e.stage='depart';e.elapsed=0;e.departFrom=e.npcX;e.direction=m.x<e.npcX?1:-1;return true;}
function complete(m){flags(m).day2_samho_done=true;flags(m).samho_met=true;const c=W.lunaCampaign;if(!m.qa&&c?.active){c.morningSeen.add(2);if(c.session.carry){c.session.carry.flags??={};Object.assign(c.session.carry.flags,{day2_samho_done:true,samho_met:true});}}if(m.qa){m.qa.done=true;m.qa.camera=null;m.qa.events.push({event:'complete',time:m.time,id:qaId});}m.encounter=null;W.outsidePlaytest?.clearInput();m.updateNear();}
function tick(m,dt){let e=m.encounter;if(e?.kind!==id){if(!m.qa&&visible(m)&&!m.encounter&&!m.paused&&!m.transition&&!m.ride&&!m.dialog&&!m.story.blocking&&m.x>=npcX-.86&&m.x<=npcX+.86){start(m);return true;}return false;}
 e.elapsed+=dt;m.animTime+=dt;m.anim='idle';
 if(e.stage==='entering'){const p=Math.min(1,e.elapsed/.65);m.x=e.from+(e.to-e.from)*p*p*(3-2*p);if(Math.abs(e.to-e.from)>.03&&p<1)m.anim='walk';if(p===1&&e.cameraReady){e.stage='active';m.story.beginRows(isQA(m)?qaId:id,e.target,W.LUNA_CAMPAIGN_DATA.scenes.commute2);}}
 else if(e.stage==='depart'){const p=Math.min(1,e.elapsed/1.8);e.npcX=e.departFrom+e.direction*p*1.65;e.alpha=1-Math.max(0,(p-.65)/.35);e.target.x=e.npcX;if(p===1){e.stage='active';m.story.speech.index++;m.story.seek();}}
 else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.elapsed>.4&&e.cameraReady)complete(m);
 return true;
}
function draw(m,sprite){if(!visible(m))return;const e=m.encounter?.kind===id?m.encounter:null;if(isQA(m)&&m.qa.done&&!e)return;const x=e?.npcX??(isQA(m)?.25:npcX),source=W.LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='Samho'),phase=m.time%4,frame=phase<.3?Math.floor(phase*10)%3:0;
 // Samho's source faces right (unlike the gray extras). Preserve that distinction.
 sprite({...source.sprite,x:frame*84},x,m.y+(e?.stage==='depart'?Math.sin(e.elapsed*15)*.014:0),1,1,e?.stage==='depart'?e.direction<0:m.x<x,e?.alpha??1);
}
W.LunaOutsideSamhoCommute={id,qaId,visible,start,tick,action,draw};
})(window);
