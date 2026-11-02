/* Day-one optional conversation. CSV owns dialogue; this module owns presence/reward. */
(function(W){
'use strict';
const id='street-newspaper',name='신문 읽는 남자';
const place=Object.freeze({x:-7.08,y:-.974,top:-.36,kind:'M2'});
const progress=()=>W.barGame.progress;
const flags=()=>progress().flags;
const rows=key=>W.LUNA_DATA.sharedStory['newspaper/'+key];
function sync(){const p=progress(),carry=W.lunaCampaign?.session?.carry;if(carry)Object.assign(carry,{flags:{...p.flags},inventory:{...p.inventory}});W.barGame.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&m.config.day===1&&['in','out'].includes(m.config.flow)&&(!flags().newspaper_conversation_done||flags().newspaper_completed_flow===m.config.flow);}
function targets(m){return visible(m)&&!m.level?[{id,nodeName:id,label:name,...place}]:[];}
function entry(){return flags().newspaper_conversation_done?'repeat':flags().newspaper_gear_received?'finish':'intro';}
function complete(m){flags().newspaper_conversation_done=true;flags().newspaper_completed_flow=m.config.flow;sync();m.updateNear();}
function begin(m,t,key,done){m.anim='idle';m.facing=t.x>m.x?1:-1;W.outsidePlaytest?.clearInput();return m.story.beginRows(id,t,rows(key),false,done);}
function interact(m,t){if(t.id!==id||!targets(m).length)return false;const key=entry();return begin(m,t,key,key==='finish'?()=>complete(m):null);}
function preview(m,t){return t.id===id?{id,rows:rows(entry()),alternatives:['wrong','right','common','finish'].map(key=>({id:id+'/'+key,rows:rows(key)}))}:null;}
function choiceView(){return{label:'대답하기',options:['wrong','right'].map((key,i)=>({id:'newspaper-'+key,label:rows('options')[i].text}))};}
function branch(m,dialogue){const s=m.story.speech;return m.story.beginRows(id,s.target,[...dialogue,...rows('common'),...rows('finish')],false,()=>complete(m));}
function choose(m,choice){const s=m.story.speech;if(!visible(m)||m.level||s?.id!==id||s.line?.type!=='newspaper-choice'||!s.choice)return false;
 const key=choice==='newspaper-wrong'?'wrong':choice==='newspaper-right'?'right':null;if(!key)return false;
 return branch(m,rows(key));
}
function action(m,row){const s=m.story.speech;if(s?.id!==id||row.action!=='grant-gear')return;
 if(!flags().newspaper_gear_received){const p=progress();p.inventory||={};p.inventory.gear_part=(Number(p.inventory.gear_part)||0)+1;flags().newspaper_gear_received=true;sync();W.outsidePlaytest?.notifyItem?.(m,'gear_part');W.barGame.log('newspaper_gear_received',{day:m.config.day,flow:m.config.flow,item:'gear_part'});}
 s.index++;m.story.seek();
}
function apply(data){if(data.scenes.street.nodes.some(n=>n.name===id))return;data.scenes.street.nodes.push({id,go:id,name:id,x:place.x,y:place.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,newspaperActor:true,sprite:W.LunaOutsideAmbient.sprite(place.kind)});}
function drawNode(m,node,draw){if(!node.newspaperActor)return false;if(visible(m))draw(W.LunaOutsideAmbient.sprite(place.kind,m.time),node.x,node.y,1,1,m.story.speech?.id===id?W.LunaOutsideAmbient.faceTarget(node.x,m.x):false);return true;}
W.LunaOutsideNewspaper={id,name,place,visible,targets,interact,preview,choiceView,choose,branch,action,apply,drawNode};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
