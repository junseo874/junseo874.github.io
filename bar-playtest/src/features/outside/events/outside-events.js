// Exterior encounter behaviour; the dialogue itself comes from the shared script.
(function(W){
'use strict';
const D=W.LUNA_OUTSIDE_DIALOGUES,C=W.LunaOutsideContent,R=W.LunaResidence.layout;
const news='outside_day1_tv_news2',passers='outside_day1_commute_passers2';
C.events.push({id:news,label:'1일차 출근길 · TV 뉴스 2 · 집 안',day:1,flow:'in',scene:'home',auto:true,kind:'broadcast',title:'TV 뉴스 2'},{id:passers,label:'1일차 출근길 · 행인 대사 2 · 엘리베이터 오른쪽',day:1,flow:'in',auto:true,kind:'pair'});
C.source.lastEdited='2026-11-11T05:47:05.794Z';
const pair=[{id:'commute-pair-left',kind:'M1',x:R.elevatorX+1.45,y:-.94,faces:'commute-pair-right',phase:1},{id:'commute-pair-right',kind:'M2',x:R.elevatorX+2.15,y:-.94,faces:'commute-pair-left',phase:3}];
W.LunaOutsideAmbient.placements.push(...pair);
for(const p of pair)W.LUNA_OUTSIDE_DATA.scenes.street.nodes.push({id:'ambient-'+p.id,name:p.id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,notionEvent:passers,ambient:{phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});
W.LunaOutsideEncounters.cases.push({id:passers,activation:'proximity',kind:'pair',members:pair.map(p=>p.id)});

const reopening='outside_day2_commute_reopening';
C.events.push({id:reopening,label:'2일차 출근길 · 행인 대사 2 · 시BAR 왼쪽',day:2,flow:'in',auto:true,kind:'pair'});
const reopeningPair=[{id:'reopening-pair-left',kind:'M2',x:-4.35,y:-.94,faces:'reopening-pair-right',phase:1},{id:'reopening-pair-right',kind:'W1',x:-3.65,y:-.94,faces:'reopening-pair-left',phase:3}];
W.LunaOutsideAmbient.placements.push(...reopeningPair);
for(const p of reopeningPair)W.LUNA_OUTSIDE_DATA.scenes.street.nodes.push({id:'ambient-'+p.id,name:p.id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,notionEvent:reopening,ambient:{phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});
W.LunaOutsideEncounters.cases.push({id:reopening,activation:'proximity',kind:'pair',members:reopeningPair.map(p=>p.id)});
const tradeEvent=C.events.find(e=>e.id==='outside_day1_samho_smuggler');Object.assign(tradeEvent,{auto:true,kind:'forced',trigger:'proximity'});
const thug='day2-corridor-thug',info='day2-thug-information',contract='day3-samho-contract',samho='contract-samho',dealer='contract-smuggler';
const story=W.LUNA_DATA.sharedStory;
const intro=story['notion/intro'],contractRows=story['notion/contract'];
const infoRows=Object.fromEntries(['gang','coratech','chris'].map(key=>[key,story['notion/info/'+key]]));
const qaCases=[{id:'runtime:thug2',label:'2일차 출근길 · 불량배 재회',notion:thug,auto:true},{id:'runtime:thug-info',label:'2일차 출근길 · 불량배 정보 구매 (50원)',notion:info,auto:false},{id:'runtime:samho-contract',label:'3일차 퇴근길 · 삼호의 계약 종료',notion:contract,auto:true}];
const mode=m=>qaCases.find(c=>c.id===m.qa?.caseId)?.notion;
const state=m=>m.qa?(m.qa.shopProgress??={money:1000,flags:{},inventory:{}}):W.barGame.progress;
const flags=m=>m.qa?state(m).flags:W.lunaCampaign?.active?(W.barGame.progress.flags??={}):(m.notionFlags??={});
function save(m,key){flags(m)[key]=true;const c=W.lunaCampaign;if(!m.qa&&c?.active&&c.session.carry){c.session.carry.flags??={};c.session.carry.flags[key]=true;}}
// The Boobi scene temporarily owns the same neighbor actor. Do not draw a
// second stationary copy (or offer its information menu) during that entrance.
const visibleThug=m=>[thug,info].includes(mode(m))||!m.qa&&m.scene==='street'&&m.level===1&&m.config.day===2&&m.config.flow==='in'&&!m.neighborhood?.neighbor;
const visibleContract=m=>mode(m)===contract||!m.qa&&m.scene==='street'&&m.config.day===3&&m.config.flow==='out'&&!flags(m).day3_contract_done;
const tx=m=>m.qa?.25:(W.LunaEngineWorld?.actorPoint('street',thug,'thug')?.x??R.homeX+1.90);
const base=m=>m.qa?-.45:(W.LunaEngineWorld?.actorPoint('street',contract,'samho')?.x??R.elevatorX+2.05)-.7;
const dealerBase=m=>m.qa?base(m):(W.LunaEngineWorld?.actorPoint('street',contract,'dealer')?.x??base(m));
const thugY=m=>m.qa?-.7:(W.LunaEngineWorld?.actorPoint('street',thug,'thug')?.y??R.upperY);
function targets(m){return visibleThug(m)&&flags(m).day2_thug_done?[{id:info,x:tx(m),y:thugY(m),top:anchor(m,thug).y,label:'불량배'}]:[];}
const infoPrompt=(stage,topic)=>{const line={type:'notion-choice',actor:thug,stage,...topic&&{topic}};return {...line,text:W.LunaOutsideAuthoring.prompt(line)};};
const infoGreeting=()=>[infoPrompt('topic')];
function preview(m,t){return t.id===info?{id:info,rows:infoGreeting(),alternatives:state(m).money>=50?Object.values(infoRows).map(rows=>({id:info,rows})):[]}:null;}
function infoStart(m,target){m.story.beginRows(info,target,infoGreeting());return true;}
function interact(m,t){return t.id===info&&infoStart(m,t);}
function start(m,kind=mode(m)){
 if(m.encounter)return false;
 m.story.cancel();m.backgroundStory.cancel();W.outsidePlaytest?.clearInput();m.anim='idle';m.animTime=0;
 if(kind===info){save(m,'day2_thug_done');return infoStart(m,{id:info,x:tx(m),y:thugY(m)});}
 const x=kind===contract?base(m)+.7:tx(m),to=kind===contract?x+1.0:Math.min(m.x,x-.55),y=kind===contract?-.7:thugY(m);
 m.encounter={kind,stage:'entering',elapsed:0,from:m.x,to,npcX:x,dealerX:dealerBase(m),alpha:1,dealerAlpha:1,camera:{x:kind===contract?x+.2:(x+to)/2,y:y+.65,w:4.8},cameraReady:false,target:{id:kind,x,y}};
 m.facing=kind===contract?-1:1;m.updateNear();return true;
}
function runAction(m,row){const e=m.encounter;if(e?.kind!==contract)return false;e.stage=row.action;e.elapsed=0;e.actionX=row.action==='dealer-exit'?e.dealerX:e.npcX;if(row.action==='approach')e.camera={x:(e.npcX+m.x)/2,y:-.7+.65,w:4.8};return true;}
function tick(m,dt){let e=m.encounter;
 if(![thug,contract].includes(e?.kind)){
  return false;
 }
 e.elapsed+=dt;m.anim='idle';m.animTime+=dt;
 if(e.stage==='entering'){const p=Math.min(1,e.elapsed/.65);m.x=e.from+(e.to-e.from)*p*p*(3-2*p);if(p<1&&Math.abs(e.to-e.from)>.02)m.anim='walk';if(p===1&&e.cameraReady){e.stage='active';m.story.beginRows(e.kind,e.target,e.kind===thug?intro:contractRows);}}
 else if(['dealer-exit','approach','samho-exit'].includes(e.stage)){
  const approaching=e.stage==='approach',exit=approaching?null:W.LunaOutsideNPCExit.sample(e.elapsed,e.actionX,e.stage==='dealer-exit'?-1:1);
  const p=Math.min(1,e.elapsed/.95),smooth=p*p*(3-2*p);
  if(e.stage==='dealer-exit'){e.dealerX=exit.x;e.dealerAlpha=exit.alpha;}
  if(e.stage==='approach'){e.npcX=e.actionX+(m.x-.75-e.actionX)*smooth;}
  if(e.stage==='samho-exit'){e.npcX=exit.x;e.alpha=exit.alpha;}
  e.target.x=e.npcX;
  if(approaching?p===1:exit.done){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.cameraReady&&e.elapsed>.4){save(m,e.kind===thug?'day2_thug_done':'day3_contract_done');m.encounter=null;if(m.qa){m.qa.done=true;m.qa.camera=null;}W.outsidePlaytest?.clearInput();m.updateNear();}
 return true;
}
function choiceView(m){const line=m.story.speech?.line,money=Number(state(m).money)||0;return{label:'정보 구매',money,options:line.stage==='topic'?[{id:'info-gang',label:'갱에 대해서'},{id:'info-coratech',label:'코라테크에 대해서'},{id:'info-chris',label:'크리스에 대해서'},{id:'info-cancel',label:'대화 그만하기'}]:[{id:'info-pay',label:'네. (50원)',disabled:money<50,disabledReason:'돈이 부족합니다.'},{id:'info-cancel',label:'아니요.'}]};}
function choose(m,id){const sp=m.story.speech;if(sp?.id!==info||!sp.choice)return false;
 if(id==='info-cancel'){m.story.cancel();return true;}
 if(sp.line.stage==='topic'&&infoRows[id.slice(5)]){m.story.beginRows(info,sp.target,[infoPrompt('payment',id.slice(5))]);return true;}
 if(id!=='info-pay'||sp.line.stage!=='payment'||!infoRows[sp.line.topic]||state(m).money<50)return false;
 const progress=state(m),before=progress.money;sp.choice=false;progress.money-=50;
 if(!m.qa){const c=W.lunaCampaign;if(c?.active&&c.session.carry)c.session.carry.money=progress.money;W.barGame.log('thug_information_purchase',{topic:sp.line.topic,price:50,before,after:progress.money});W.barGame.changed();}
 m.story.beginRows(info,sp.target,infoRows[sp.line.topic]);return true;
}
function anchor(m,actor){const e=m.encounter;
 if(actor===thug){
  const x=e?.kind===thug?e.npcX:tx(m),y=thugY(m),sp=W.LunaOutsideAmbient.sprite('Neighbor'),flip=W.LunaOutsideAmbient.faceTarget(x,m.x);
  const p=W.LunaEngineWorld&&!m.qa?W.LunaEngineWorld.actorPose('street',thug,'thug',sp,x,y,flip):{sp,x,y:y-.274,sx:1,sy:1,flip};
  return W.LunaOutsideAmbient.head(p.sp,p.x,p.y,p.sx,p.sy,p.flip)||{x,y:y+.61};
 }
 if(e?.kind===contract&&[samho,dealer].includes(actor))return{x:actor===samho?e.npcX:e.dealerX,y:-.7+.44};
 return null;
}
function draw(m,sprite,ctx,position){
 const e=m.encounter;
 const idle=(kind,x,y,target,alpha=1,event=thug,role='thug')=>{const sp=W.LunaOutsideAmbient.sprite(kind,m.time),flip=W.LunaOutsideAmbient.faceTarget(x,target);if(W.LunaEngineWorld&&!m.qa)W.LunaEngineWorld.drawActor(sprite,'street',event,role,sp,x,y,flip,alpha);else sprite(sp,x,y,1,1,flip,alpha);};
 if(visibleThug(m)){if(!m.qa){ctx.save();ctx.beginPath();ctx.rect(-2048,-2048,position(-13.70,0).x+2048,4096);ctx.clip();}idle('Neighbor',e?.kind===thug?e.npcX:tx(m),thugY(m)-(W.LunaEngineWorld&&!m.qa?0:.274),m.x);if(!m.qa)ctx.restore();}
 if(visibleContract(m)&&(!m.qa||!m.qa.done||e?.kind===contract)){
  const x=e?.kind===contract?e.npcX:base(m)+.7,dx=e?.kind===contract?e.dealerX:dealerBase(m),stage=e?.kind===contract?e.stage:'',toward=['approach','samho-exit'].includes(stage)||e?.dealerAlpha===0?m.x:dx;
  const sp=W.LunaSamhoAnimation.frame(m.time),flip=W.LunaOutsideAmbient.faceTarget(x,stage==='samho-exit'?x+1:toward),alpha=e?.kind===contract?e.alpha:1;
  if(W.LunaEngineWorld&&!m.qa)W.LunaEngineWorld.drawActor(sprite,'street',contract,'samho',sp,x,-.7,flip,alpha);else sprite(sp,x,-.7,1,1,flip,alpha);
  idle('M1',dx,W.LunaEngineWorld&&!m.qa?-.7:-.94,stage==='dealer-exit'?dx-1:x,e?.kind===contract?e.dealerAlpha:1,contract,'dealer');
 }
}
for(const [key,lines]of Object.entries(W.LUNA_DATA?.sharedStory||{}))if(key.startsWith('ambient/'))D[key.slice(8)]=lines;
function offer(m){const events=W.LunaOutsideStory.events;
 events.offer(m,thug,()=>visibleThug(m)&&!flags(m).day2_thug_done&&m.x>=tx(m)-.35&&m.x<=R.upperMax,()=>start(m,thug),20);
 events.offer(m,contract,()=>!m.level&&visibleContract(m)&&Math.abs(m.x-(base(m)+1.7))<.8,()=>start(m,contract),20);
}
W.LunaOutsideNotion={news,passers,reopening,thug,info,contract,intro,infoRows,contractRows,qaCases,targets,interact,preview,start,tick,action:runAction,choose,choiceView,anchor,draw,visibleThug,visibleContract,offer};
})(window);
