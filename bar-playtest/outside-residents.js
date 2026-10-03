// Day 0 return trip: upstairs corridor speakers, with silent residents downstairs.
(function(W){
'use strict';
const id='outside_day0_building_residents',railY=9.55;
const people=[{id:'resident-left',name:'빌딩 주민 1',kind:'M2',x:-18.8,y:9.346,top:9.956,faces:'resident-right',color:'#d6b987'},{id:'resident-right',name:'빌딩 주민 2',kind:'W1',x:-18.15,y:9.346,top:9.876,faces:'resident-left',color:'#a8c4d8'}];
// Preserve the old silhouettes and idle motion, without dialogue identities/triggers.
const dummies=[{id:'silent-resident-left',kind:'M2',x:-14.9,y:7.61,railY:7.86,faces:'silent-resident-right'},{id:'silent-resident-right',kind:'W1',x:-14.22,y:7.61,railY:7.86,faces:'silent-resident-left'}];
const allPeople=[...people,...dummies],actor=id=>people.find(p=>p.id===id);
function visible(m){return !m.qa&&m.scene==='street'&&m.config.day===0&&m.config.flow==='out';}
function onScreen(cam){const h=cam.w*720/1280;return people.every(p=>p.x-.18>cam.x-cam.w/2&&p.x+.18<cam.x+cam.w/2&&p.top+.9<cam.y+h/2&&railY>cam.y-h/2);}
function tickView(m,cam){if(!visible(m)||m.paused||m.transition||m.encounter||m.story.blocking||m.playedAmbient.has(id))return;
 if(m.ride||m.level!==1||!people.some(p=>Math.abs(p.x-m.x)<=1.05)||!onScreen(cam))return;
 if(m.backgroundStory.begin(id,{id},true))m.playedAmbient.add(id);
}
// The player may keep walking; this optional conversation never takes over the camera.
function frame(m,view){return view;}
function apply(data){for(const p of allPeople){const key='building-'+p.id;if(data.scenes.street.nodes.some(n=>n.id===key))continue;data.scenes.street.nodes.push({id:key,name:key,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['BuildingResidents'],layer:9,order:0,resident:p.id,sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}}
function drawNode(m,n,sprite,ctx,position){if(!n.resident)return false;if(visible(m)){const p=allPeople.find(p=>p.id===n.resident),other=allPeople.find(other=>other.id===p.faces),frame=Math.floor(m.time*3.5)%6;ctx.save();ctx.beginPath();ctx.rect(-2048,-2048,5376,position(0,p.railY??railY).y+2048);ctx.clip();sprite({...n.sprite,x:frame*129},p.x,p.y,1,1,W.LunaOutsideAmbient.faceTarget(p.x,other.x));ctx.restore();}return true;}
W.LunaOutsideResidents={id,people,dummies,actor,visible,onScreen,tickView,frame,drawNode,railY};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
