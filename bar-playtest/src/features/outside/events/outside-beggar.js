/* Optional authored encounter: Day 0 homeward / Day 1 commute.
 * Reuses existing street NPC art; promises are dialogue, not a reward grant. */
(function(W){
'use strict';
const id='street-beggar',witness='street-beggar-witness',cost=150;
const people=[{id,name:'노숙자',kind:'M2',x:-7.30,y:-.94,top:-.29},{id:witness,name:'근처 행인',kind:'M1',x:-8.20,y:-.94,top:-.34}];
const person=actor=>people.find(p=>p.id===actor);
const say=(actor,text)=>({type:'say',actor,who:actor==='luna'?'루나':person(actor).name,text});
const n=t=>say(id,t),l=t=>say('luna',t),w=t=>say(witness,t);
const intro=[n('거기, 잠깐만. 얼굴 보니까 믿을 만한 사람이네.'),l('무슨 일이신가요?'),n('딱 150원만 빌려줘. 내가 돈 굴리는 데는 재주가 있거든. 열 배로 불려서 돌려줄게.'),l('150원을… 1,500원으로요?'),n('그렇다니까. 아니면 그만한 값어치가 있는 임플란트를 구해 올 수도 있어. 물건 들어오는 데를 좀 알아.'),n('조만간 가져다줄게. 여기서 또 만나면 되잖아. 나 한번 믿어 봐.'),{type:'beggar-choice',actor:id,who:'노숙자',text:'노숙자에게 150원을 건네시겠습니까?'}];
const paid=[l('여기 150원입니다. 말씀하신 약속은 지켜 주세요.'),n('고마워! 사람 보는 눈이 있네. 내가 이 은혜는 꼭 갚을게.'),n('마침 지금 가 봐야 할 데가 있어서. 조만간 보자고!')];
const refused=[l('죄송하지만 돈을 드리기는 어려울 것 같습니다.'),n('…그래? 뭐, 억지로 달라는 건 아니니까. 가던 길 가.')];
const progress=()=>W.barGame.progress;
const flags=()=>progress().flags??={};
const refusal=m=>'street_beggar_refused_'+m.config.day+'_'+m.config.flow;
const balance=()=>Math.max(0,Number(progress().money)||0);
function active(m){return !m.qa&&m.scene==='street'&&!m.level&&(m.config.day===0&&m.config.flow==='out'||m.config.day===1&&m.config.flow==='in');}
function visible(m,actor){return active(m)&&(actor===witness||!flags().street_beggar_paid||!!m.beggarDeparture||m.story?.speech?.id===id);}
function sync(){const g=W.barGame,c=W.lunaCampaign;if(c?.active&&c.session.carry){c.session.carry.money=g.progress.money;c.session.carry.flags={...g.progress.flags};}g.changed();}
function targets(m){return active(m)?people.filter(p=>p.id===witness||!flags().street_beggar_paid).map(p=>({id:p.id,nodeName:p.id,label:p.name,x:p.x,y:p.y,top:p.top})):[];}
function warning(){
 if(flags().street_beggar_paid)return [w('너, 설마 방금 그 사람한테 돈 준 거야?'),l('150원을 드렸습니다. 열 배로 돌려주시거나, 그만한 가치의 임플란트를 가져오신다고…'),w('하… 역시 그 소리 했네. 지난주에는 내 옆집 사람한테도 똑같이 말했어.'),w('돈 굴려 준다, 임플란트 구해 준다. 말만 바뀌지 돈을 돌려받았다는 사람은 못 봤다.'),l('…처음부터 돌려줄 생각이 없었다는 말씀이신가요?'),w('그런 수법으로 먹고사는 사람이야. 다음에 또 만나도 더 주지는 마.'),l('…알려 주셔서 감사합니다.')];
 if(flags().street_beggar_met)return [w('저 사람 말, 믿은 건 아니지?'),l('돈을 불려주겠다고 하셨지만, 드리지는 않았습니다.'),w('잘했어. 저 사람, 여기저기서 똑같은 얘기로 푼돈을 받아 가. 임플란트도 다 미끼고.'),w('멀쩡하게 돌려받았다는 사람은 못 봤으니까, 앞으로도 조심해.'),l('기억해 두겠습니다.')];
 return [w('저 전기함 옆 사람하고 얘기할 거면 조심해.'),l('무슨 일이 있나요?'),w('적은 돈만 주면 몇 배로 돌려준다느니, 비싼 임플란트를 구해 준다느니 할 거야.'),w('그 말 믿고 돈 건넸다가 허탕 친 사람이 한둘이 아니거든.'),l('…알려 주셔서 감사합니다.')];
}
function interact(m,t){
 if(!active(m)||![id,witness].includes(t.id)||t.id===id&&flags().street_beggar_paid)return false;
 const p=person(t.id);m.facing=m.x<p.x?1:-1;W.outsidePlaytest?.clearInput();
 if(t.id===witness){flags().street_beggar_warned=true;const rows=warning();sync();return m.story.beginRows(witness,t,rows);}
 flags().street_beggar_met=true;sync();return m.story.beginRows(id,t,flags()[refusal(m)]?[n('알았어, 알았어. 더 붙잡지는 않을게.')]:intro);
}
function choiceView(){const money=balance();return {label:'노숙자에게 돈 건네기',money,options:[{id:'beggar-pay',label:'150원을 준다.',disabled:money<cost},{id:'beggar-refuse',label:'주지 않는다.',disabled:false}]};}
function choose(m,choice){
 const s=m.story.speech;if(!active(m)||s?.id!==id||s.line?.type!=='beggar-choice'||!s.choice||flags().street_beggar_paid)return false;
 if(!['beggar-pay','beggar-refuse'].includes(choice)||choice==='beggar-pay'&&balance()<cost)return false;
 s.choice=false;
 if(choice==='beggar-refuse'){flags()[refusal(m)]=true;m.story.beginRows(id,s.target,refused);sync();return true;}
 // Mark paid before notifying observers: repeated clicks cannot charge again.
 const before=balance();progress().money=before-cost;flags().street_beggar_paid=true;flags().street_beggar_paid_day=m.config.day;
 m.story.beginRows(id,s.target,paid,false,()=>{m.beggarDeparture={elapsed:0,x:person(id).x,alpha:1};m.updateNear();});
 W.barGame.log('street_beggar_payment',{price:cost,before,after:progress().money,day:m.config.day,flow:m.config.flow});sync();return true;
}
function tick(m,dt){const d=m.beggarDeparture;if(!d)return;if(!active(m)){m.beggarDeparture=null;return;}d.elapsed+=dt;d.x=person(id).x-Math.min(1,d.elapsed/3.4)*2.8;d.alpha=1-Math.max(0,(d.elapsed-2.9)/.5);if(d.elapsed>=3.4){m.beggarDeparture=null;m.updateNear();}}
function anchor(m,actor){const p=person(actor);return p?{x:actor===id&&m.beggarDeparture?m.beggarDeparture.x:p.x,y:p.top+.04}:null;}
function apply(data){for(const p of people){if(data.scenes.street.nodes.some(n=>n.name===p.id))continue;data.scenes.street.nodes.push({id:p.id,go:p.id,name:p.id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,beggarActor:p.id,sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}}
function drawNode(m,node,draw){if(!node.beggarActor)return false;if(!visible(m,node.beggarActor))return true;const d=node.beggarActor===id?m.beggarDeparture:null,x=d?.x??node.x,y=node.y+(d?Math.sin(d.elapsed*16)*.012:0);draw({...node.sprite,x:(Math.floor(m.time*(d?7:3.4))%6)*129},x,y,1,1,d?false:W.LunaOutsideAmbient.faceTarget(x,m.x),d?.alpha??1);return true;}
W.LunaOutsideBeggar={id,witness,cost,people,intro,paid,refused,active,visible,targets,interact,choiceView,choose,tick,anchor,apply,drawNode};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
