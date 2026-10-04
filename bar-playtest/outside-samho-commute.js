// Days 2/3 live commute encounters, shared by main, developer and QA.
// Live street staging, matching the corridor encounter; never opens a campaign scene overlay.
(function(W){
'use strict';
const id='day2-samho-commute',qaId='runtime:commute2',npcX=-5.99;
const day=m=>m.qa?.caseId==='runtime:commute3'?3:m.qa?.caseId===qaId?2:m.config.day;
const isQA=m=>[qaId,'runtime:commute3'].includes(m.qa?.caseId);
const xFor=m=>day(m)===3?W.LunaResidence.layout.elevatorX+1.45:npcX;
const doneKey=m=>'day'+day(m)+'_samho_done';
const sceneKey=m=>'commute'+day(m);
function flags(m){return !m.qa&&W.lunaCampaign?.active?(W.barGame.progress.flags??={}):(m.samhoCommuteFlags??={});}
function visible(m){return isQA(m)||!m.qa&&[2,3].includes(m.config.day)&&m.config.flow==='in'&&m.scene==='street'&&!m.level&&!flags(m)[doneKey(m)];}
function start(m){if(m.encounter||!visible(m))return false;m.story.cancel();m.backgroundStory.cancel();W.outsidePlaytest?.clearInput();const x=isQA(m)?.25:xFor(m),side=m.x<=x?-1:1,to=x+side*.78;
 m.facing=side<0?1:-1;m.anim='idle';m.animTime=0;m.encounter={kind:id,stage:'entering',elapsed:0,from:m.x,to,npcX:x,alpha:1,camera:{x:(x+to)/2,y:m.y+.7,w:4.8},cameraReady:false,target:{id,x,y:m.y+.08}};m.updateNear();return true;
}
function action(m){const e=m.encounter;if(e?.kind!==id)return false;e.stage='depart';e.elapsed=0;e.departFrom=e.npcX;e.direction=m.x<e.npcX?1:-1;return true;}
function complete(m){flags(m)[doneKey(m)]=true;flags(m).samho_met=true;const c=W.lunaCampaign;if(!m.qa&&c?.active){c.morningSeen.add(day(m));if(c.session.carry){c.session.carry.flags??={};Object.assign(c.session.carry.flags,{[doneKey(m)]:true,samho_met:true});}}if(m.qa){m.qa.done=true;m.qa.camera=null;m.qa.events.push({event:'complete',time:m.time,id:qaId});}m.encounter=null;W.outsidePlaytest?.clearInput();m.updateNear();}
function tick(m,dt){let e=m.encounter;if(e?.kind!==id){if(!m.qa&&visible(m)&&!m.encounter&&!m.paused&&!m.transition&&!m.ride&&!m.dialog&&!m.story.blocking&&m.x>=xFor(m)-.86&&m.x<=xFor(m)+.86){start(m);return true;}return false;}
 e.elapsed+=dt;m.animTime+=dt;m.anim='idle';
 if(e.stage==='entering'){const p=Math.min(1,e.elapsed/.65);m.x=e.from+(e.to-e.from)*p*p*(3-2*p);if(Math.abs(e.to-e.from)>.03&&p<1)m.anim='walk';if(p===1&&e.cameraReady){e.stage='active';m.story.beginRows(isQA(m)?'runtime:'+sceneKey(m):id,e.target,W.LUNA_CAMPAIGN_DATA.scenes[sceneKey(m)]);}}
 else if(e.stage==='depart'){const p=Math.min(1,e.elapsed/1.8);e.npcX=e.departFrom+e.direction*p*1.65;e.alpha=1-Math.max(0,(p-.65)/.35);e.target.x=e.npcX;if(p===1){e.stage='active';m.story.speech.index++;m.story.seek();}}
 else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.elapsed>.4&&e.cameraReady)complete(m);
 return true;
}
function draw(m,sprite){if(!visible(m))return;const e=m.encounter?.kind===id?m.encounter:null;if(isQA(m)&&m.qa.done&&!e)return;const x=e?.npcX??(isQA(m)?.25:xFor(m)),source=W.LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='Samho'),phase=m.time%4,frame=phase<.3?Math.floor(phase*10)%3:0;
 // Source faces left: use the shared target-facing rule, including departure.
 sprite({...source.sprite,x:frame*84},x,m.y+(e?.stage==='depart'?Math.sin(e.elapsed*15)*.014:0),1,1,W.LunaOutsideAmbient.faceTarget(x,e?.stage==='depart'?x+e.direction:m.x),e?.alpha??1);
}
W.LunaOutsideSamhoCommute={id,qaId,visible,start,tick,action,draw};
})(window);
