/* Optional day 0–1 invitation. Dialogue is authored in shared CSV. */
(function(W){
'use strict';
const id='street-believer',name='기신교 신도',item='machine_church_emblem';
const place=Object.freeze({x:4.7,y:-.974,top:-.36,kind:'M1'});
const progress=()=>W.barGame.progress;
const rows=key=>W.LUNA_DATA.sharedStory['believer/'+key];
function sync(){const p=progress(),carry=W.lunaCampaign?.session?.carry;if(carry)Object.assign(carry,{flags:{...p.flags},inventory:{...p.inventory}});W.barGame.changed();}
function visible(m){return !m.qa&&m.scene==='street'&&!progress().flags.believer_conversation_done&&((m.config.day===0&&m.config.flow==='out')||(m.config.day===1&&['in','out'].includes(m.config.flow)));}
function targets(m){return visible(m)&&!m.level?[{id,nodeName:id,label:name,...place}]:[];}
function entry(){return progress().flags.believer_emblem_received?'finish':'intro';}
function complete(m){progress().flags.believer_conversation_done=true;sync();m.updateNear();}
function interact(m,t){if(t.id!==id||!targets(m).length)return false;m.anim='idle';m.facing=t.x>m.x?1:-1;W.outsidePlaytest?.clearInput();return m.story.beginRows(id,t,rows(entry()),false,()=>complete(m));}
function preview(m,t){return t.id===id?{id,rows:rows(entry())}:null;}
function action(m,row){const s=m.story.speech;if(s?.id!==id||row.action!=='grant-emblem')return;
 const p=progress();if(!p.flags.believer_emblem_received){p.inventory||={};p.inventory[item]=(Number(p.inventory[item])||0)+1;p.flags.believer_emblem_received=true;sync();W.outsidePlaytest?.notifyItem?.(m,item);W.barGame.log('believer_emblem_received',{day:m.config.day,flow:m.config.flow,item});}
 s.index++;m.story.seek();
}
function apply(data){if(data.scenes.street.nodes.some(n=>n.name===id))return;data.scenes.street.nodes.push({id,go:id,name:id,x:place.x,y:place.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,believerActor:true,sprite:W.LunaOutsideAmbient.sprite(place.kind)});}
function drawNode(m,node,draw){if(!node.believerActor)return false;if(visible(m))draw(W.LunaOutsideAmbient.sprite(place.kind,m.time),node.x,node.y,1,1,m.story.speech?.id===id?W.LunaOutsideAmbient.faceTarget(node.x,m.x):false);return true;}
W.LunaOutsideBeliever={id,name,item,place,visible,targets,interact,preview,action,apply,drawNode};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
