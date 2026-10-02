// User-supplied 129x138 cells. Keep the original sheets and foot baseline intact.
(function(global){
'use strict';
// Luna stands at y=-.7 but its visible feet are -.974 (pivot is inside its cell).
// Put these foot-pivot sprites on the same road, slightly behind Luna.
const placements=[
 {id:'bar-pair-left',kind:'M2',x:-1.18,y:-.94,flip:true,faces:'bar-pair-right',fps:3.8,phase:0},
 {id:'bar-pair-right',kind:'W1',x:-.65,y:-.94,flip:false,faces:'bar-pair-left',fps:3.5,phase:2}
];
function apply(data){
 if(data.ambientVersion===2)return data;
 data.scenes.street.nodes=data.scenes.street.nodes.filter(n=>!n.ambient);
 for(const kind of ['M1','M2','W1'])data.assets['ambient-'+kind]={src:'assets/outside/NPC_idle_'+kind+'.png',w:774,h:138,source:'User supplied NPC Idle, 2026-09-29'};
 for(const p of placements){const id='ambient-'+p.id;data.scenes.street.nodes.push({id,go:id,name:id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,flip:p.flip,ambient:{fps:p.fps,phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}
 data.ambientVersion=2;return data;
}
// M1/M2/W1 and Samho are authored facing left. true mirrors them to the right.
function faceTarget(x,targetX){return targetX>x;}
function facing(node,model){
 const p=placements.find(p=>'ambient-'+p.id===node.id),partner=p&&placements.find(other=>other.id===p.faces);
 if(partner)return faceTarget(node.x,partner.x); // Overheard pairs face each other, not Luna.
 if(node.bdVendor||model.encounter?.kind==='direct'&&node.id==='ambient-'+model.encounter.target.actor)return faceTarget(node.x,model.x);
 return node.flip;
}
function visible(model){return model.scene==='street'&&model.config.day===0&&model.config.flow==='out';}
function frame(node,time){return{...node.sprite,x:((Math.floor(time*node.ambient.fps)+node.ambient.phase)%6)*129};}
global.LunaOutsideAmbient={apply,visible,frame,placements,faceTarget,facing};
if(global.LUNA_OUTSIDE_DATA)apply(global.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
