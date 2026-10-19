/* Optional authored encounter: Day 0 homeward / Day 1 commute.
 * Reuses existing street NPC art; promises are dialogue, not a reward grant. */
(function(W){
'use strict';
const id='street-beggar',witness='street-beggar-witness',cost=200;
const people=[{id,name:'노숙자',kind:'M2',x:-7.30,y:-.94,top:-.29},{id:witness,name:'근처 행인',kind:'M1',x:-8.20,y:-.94,top:-.34}];
const person=actor=>people.find(p=>p.id===actor);
// Dialogue is owned by the web CSV, including the witness's one-off/repeat flows.
const rows=key=>W.LUNA_DATA.sharedStory['beggar/'+key];
const intro=rows('intro'),paid=rows('paid'),refused=rows('refused');
const progress=()=>W.barGame.progress;
const flags=()=>progress().flags??={};
const refusal=m=>'street_beggar_refused_'+m.config.day+'_'+m.config.flow;
const balance=()=>Math.max(0,Number(progress().money)||0);
function present(m){return !m.qa&&m.scene==='street'&&(m.config.day===0&&m.config.flow==='out'||m.config.day===1&&m.config.flow==='in');}
function active(m){return present(m)&&!m.level;}
const visitKey=m=>m.config.day+':'+m.config.flow;
// Keep the paid reaction available only during the street visit where Luna paid.
function witnessPresent(m){return !flags().street_beggar_paid||m.beggarWitnessPaidVisit===visitKey(m);}
function visible(m,actor){return present(m)&&(actor===witness?witnessPresent(m):!flags().street_beggar_paid||!!m.beggarDeparture||m.story?.speech?.id===id);}
function sync(){const g=W.barGame,c=W.lunaCampaign;if(c?.active&&c.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};}g.changed();}
function targets(m){return active(m)?people.filter(p=>p.id===witness?witnessPresent(m):!flags().street_beggar_paid).map(p=>({id:p.id,nodeName:p.id,label:p.name,x:p.x,y:p.y,top:p.top})):[];}
function warningKey(){
 const f=flags();
 if(f.street_beggar_paid)return f.street_beggar_witness_paid_seen?'warning/paid-repeat':'warning/paid';
 if(f.street_beggar_witness_met)return 'warning/unpaid-repeat';
 return f.street_beggar_met?'warning/met':'warning/unmet';
}
function interact(m,t){
 if(!active(m)||![id,witness].includes(t.id)||t.id===id&&flags().street_beggar_paid||t.id===witness&&!witnessPresent(m))return false;
 const p=person(t.id);m.facing=m.x<p.x?1:-1;W.outsidePlaytest?.clearInput();
 if(t.id===witness){
  const key=warningKey();
  return m.story.beginRows(witness,t,rows(key),false,()=>{
   flags().street_beggar_witness_met=true;flags().street_beggar_warned=true;
   if(key==='warning/paid')flags().street_beggar_witness_paid_seen=true;
   sync();
  });
 }
 const dialogue=flags().street_beggar_met?rows('repeat'):intro;
 flags().street_beggar_met=true;sync();return m.story.beginRows(id,t,dialogue);
}
function choiceView(m){const money=balance(),repeat=m?.story.speech?.rows!==intro;return {label:'대답하기',money,options:[
 {id:'beggar-pay',label:repeat?'네 드릴게요 (200원을 준다.)':'네. 여기요 (200원을 준다.)',disabled:money<cost},
 {id:'beggar-refuse',label:repeat?'아니요.':'싫어요.',disabled:false},
 {id:'beggar-question',label:flags().street_beggar_warned?'혹시 사기꾼인가요?':'???',disabled:!flags().street_beggar_warned,disabledReason:'아직 관련 정보를 듣지 못했습니다.'}
 ]};}
function choose(m,choice){
 const s=m.story.speech;if(!active(m)||s?.id!==id||s.line?.type!=='beggar-choice'||!s.choice||flags().street_beggar_paid)return false;
 if(!['beggar-pay','beggar-refuse','beggar-question'].includes(choice)||choice==='beggar-pay'&&balance()<cost||choice==='beggar-question'&&!flags().street_beggar_warned)return false;
 s.choice=false;
 if(choice==='beggar-question'){m.story.beginRows(id,s.target,rows('questioned'));return true;}
 if(choice==='beggar-refuse'){flags()[refusal(m)]=true;m.story.beginRows(id,s.target,refused);sync();return true;}
 // Mark paid before notifying observers: repeated clicks cannot charge again.
 const before=balance();progress().money=before-cost;flags().street_beggar_paid=true;flags().street_beggar_paid_day=m.config.day;
 m.beggarWitnessPaidVisit=visitKey(m);
 m.story.beginRows(id,s.target,paid,false,()=>{m.beggarDeparture={elapsed:0,x:person(id).x,alpha:1};m.updateNear();});
 W.barGame.log('street_beggar_payment',{price:cost,before,after:progress().money,day:m.config.day,flow:m.config.flow});sync();return true;
}
function tick(m,dt){if(!present(m))m.beggarWitnessPaidVisit=null;const d=m.beggarDeparture;if(!d)return;if(!active(m)){m.beggarDeparture=null;return;}d.elapsed+=dt;d.x=person(id).x-Math.min(1,d.elapsed/3.4)*2.8;d.alpha=1-Math.max(0,(d.elapsed-2.9)/.5);if(d.elapsed>=3.4){m.beggarDeparture=null;m.updateNear();}}
function anchor(m,actor){const p=person(actor);return p?{x:actor===id&&m.beggarDeparture?m.beggarDeparture.x:p.x,y:p.top+.04}:null;}
function apply(data){for(const p of people){if(data.scenes.street.nodes.some(n=>n.name===p.id))continue;data.scenes.street.nodes.push({id:p.id,go:p.id,name:p.id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,beggarActor:p.id,sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}}
function drawNode(m,node,draw){if(!node.beggarActor)return false;if(!visible(m,node.beggarActor))return true;const d=node.beggarActor===id?m.beggarDeparture:null,x=d?.x??node.x,y=node.y+(d?Math.sin(d.elapsed*16)*.012:0);draw({...node.sprite,x:(Math.floor(m.time*(d?7:3.4))%6)*129},x,y,1,1,d?false:W.LunaOutsideAmbient.faceTarget(x,m.x),d?.alpha??1);return true;}
W.LunaOutsideBeggar={id,witness,cost,people,intro,paid,refused,active,visible,targets,interact,choiceView,choose,tick,anchor,apply,drawNode};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
