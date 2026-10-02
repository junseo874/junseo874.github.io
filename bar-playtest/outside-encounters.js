// Notion-authored NPC-to-NPC scene in front of Port's shop (left of the bar).
(function(global){
'use strict';
const actors={'bar-pair-left':{name:'행인 1',color:'#d6b987'},'bar-pair-right':{name:'행인 2',color:'#a8c4d8'}};
const cases=[{id:'outside_day0_port_pair',activation:'proximity',kind:'pair',members:['bar-pair-left','bar-pair-right']}];
function actor(id){const p=global.LunaOutsideAmbient.placements.find(p=>p.id===id);return p&&actors[id]?{...p,...actors[id],top:p.y+(p.kind==='M2'?.61:p.kind==='W1'?.53:.56)}:null;}
// This scene is overheard; there is no E prompt or forced camera/movement lock.
function targets(){return[];}
function prepare(){return null;}
function tickProximity(model){
 const story=model.backgroundStory;
 if(!global.LunaOutsideAmbient.visible(model)||model.level||model.transition||model.ride||model.encounter||model.dialog||model.story.blocking||story.speech)return;
 const c=cases.find(c=>!model.playedAmbient.has(c.id)&&c.members.some(id=>Math.abs(actor(id).x-model.x)<=.85));
 if(c&&story.begin(c.id,{id:c.id},true))model.playedAmbient.add(c.id);
}
global.LunaOutsideEncounters={cases,actor,targets,prepare,tickProximity};
})(typeof window==='undefined'?globalThis:window);
