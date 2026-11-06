/* Day-one optional conversation. CSV owns dialogue; this module owns presence/reward. */
(function(W){
'use strict';
const id='street-newspaper',name='신문 읽는 남자';
const place=Object.freeze({x:W.LunaEngineWorld?.node('street','1286119217')?.x??-7.08,y:-.974,top:-.36,kind:'M2'});
const {entry,complete,grantGear,available}=W.LunaNewspaperProgress;
const {rows,choiceView,branch}=W.LunaNewspaperDialogue;
function visible(m){return !m.qa&&m.scene==='street'&&m.config.day===1&&['in','out'].includes(m.config.flow)&&available(m.config.flow);}
function targets(m){return visible(m)&&!m.level?[{id,nodeName:id,label:name,...place}]:[];}
function begin(m,t,key,done){m.anim='idle';m.facing=t.x>m.x?1:-1;W.outsidePlaytest?.clearInput();return m.story.beginRows(id,t,rows(key),false,done);}
function interact(m,t){if(t.id!==id||!targets(m).length)return false;const key=entry();return begin(m,t,key,key==='finish'?()=>complete(m):null);}
function preview(m,t){return t.id===id?{id,rows:rows(entry()),alternatives:['wrong','right','common','finish'].map(key=>({id:id+'/'+key,rows:rows(key)}))}:null;}
function choose(m,choice){const s=m.story.speech;if(!visible(m)||m.level||s?.id!==id||s.line?.type!=='newspaper-choice'||!s.choice)return false;
 return W.LunaNewspaperDialogue.choose(m,choice);
}
function action(m,row){const s=m.story.speech;if(s?.id!==id||row.action!=='grant-gear')return;
 grantGear(m);
 s.index++;m.story.seek();
}
function apply(data){if(data.scenes.street.nodes.some(n=>n.name===id))return;data.scenes.street.nodes.push({id,go:id,name:id,x:place.x,y:place.y,z:0,sx:1,sy:1,active:true,ancestry:['OptionalNPC'],layer:9,order:1,newspaperActor:true,sprite:W.LunaOutsideAmbient.sprite(place.kind)});}
function drawNode(m,node,draw){if(!node.newspaperActor)return false;if(visible(m))draw(W.LunaOutsideAmbient.sprite(place.kind,m.time),node.x,node.y,1,1,m.story.speech?.id===id?W.LunaOutsideAmbient.faceTarget(node.x,m.x):false);return true;}
W.LunaOutsideNewspaper={id,name,place,visible,targets,interact,preview,choiceView,choose,branch,action,apply,drawNode};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
