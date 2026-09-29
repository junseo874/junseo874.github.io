// User-supplied 129x138 cells. Keep the original sheets and foot baseline intact.
(function(global){
'use strict';
// Luna stands at y=-.7 but its visible feet are -.974 (pivot is inside its cell).
// Put these foot-pivot sprites on the same road, slightly behind Luna.
const placements=[
 {id:'bar-pair-left',kind:'M2',x:-1.18,y:-.94,flip:false,fps:3.8,phase:0},
 {id:'bar-pair-right',kind:'W1',x:-.65,y:-.94,flip:true,fps:3.5,phase:2},
 {id:'shop-loner',kind:'M1',x:-4.6,y:-.95,flip:false,fps:3.2,phase:4},
 {id:'alley-pair-left',kind:'M1',x:-9.35,y:-.93,flip:false,fps:3.6,phase:1},
 {id:'alley-pair-right',kind:'M2',x:-8.75,y:-.93,flip:true,fps:3.3,phase:3}
];
function apply(data){
 if(data.ambientVersion===1)return data;
 for(const kind of ['M1','M2','W1'])data.assets['ambient-'+kind]={src:'assets/outside/NPC_idle_'+kind+'.png',w:774,h:138,source:'User supplied NPC Idle, 2026-09-29'};
 for(const p of placements){const id='ambient-'+p.id;data.scenes.street.nodes.push({id,go:id,name:id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,flip:p.flip,ambient:{fps:p.fps,phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}
 data.ambientVersion=1;return data;
}
function visible(model){return model.scene==='street'&&model.config.day===0&&model.config.flow==='out';}
function frame(node,time){return{...node.sprite,x:((Math.floor(time*node.ambient.fps)+node.ambient.phase)%6)*129};}
global.LunaOutsideAmbient={apply,visible,frame};
if(global.LUNA_OUTSIDE_DATA)apply(global.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
