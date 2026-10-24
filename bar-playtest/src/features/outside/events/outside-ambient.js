// User-supplied 129x138 cells. Keep the original sheets and foot baseline intact.
(function(global){
'use strict';
// Luna stands at y=-.7 but its visible feet are -.974 (pivot is inside its cell).
// Put these foot-pivot sprites on the same road, slightly behind Luna.
const placements=[
 {id:'store-pair-left',kind:'M1',x:-5.78,y:-.94,flip:true,faces:'store-pair-right',phase:1},
 {id:'store-pair-right',kind:'M2',x:-5.12,y:-.94,flip:false,faces:'store-pair-left',phase:3},
 {id:'bar-pair-left',kind:'M2',x:-1.18,y:-.94,flip:true,faces:'bar-pair-right',phase:0},
 {id:'bar-pair-right',kind:'W1',x:-.65,y:-.94,flip:false,faces:'bar-pair-left',phase:2}
];
function apply(data){
 if(data.ambientVersion===2)return data;
 data.scenes.street.nodes=data.scenes.street.nodes.filter(n=>!n.ambient);
 for(const kind of ['M1','M2','W1'])data.assets['ambient-'+kind]={src:'assets/outside/NPC_idle_'+kind+'.png',w:774,h:138,source:'User supplied NPC Idle, 2026-09-29'};
 for(const p of placements){const id='ambient-'+p.id;data.scenes.street.nodes.push({id,go:id,name:id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,flip:p.flip,ambient:{phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});}
 data.ambientVersion=2;return data;
}
// M1/M2/W1 and Samho are authored facing left. true mirrors them to the right.
function faceTarget(x,targetX){return targetX>x;}
function facing(node,model){
 const p=placements.find(p=>'ambient-'+p.id===node.id),partner=p&&placements.find(other=>other.id===p.faces);
 if(partner)return faceTarget(node.x,partner.x); // Overheard pairs face each other, not Luna.
 if(model.encounter?.kind==='direct'&&node.id==='ambient-'+model.encounter.target.actor)return faceTarget(node.x,model.x);
 return node.flip;
}
function visible(model,node){return model.scene==='street'&&(node?.notionEvent?global.LunaOutsideContent.present(model,global.LunaOutsideContent.events.find(e=>e.id===node.notionEvent)):model.config.day===0&&model.config.flow==='out');}
// Match the idle LOOP, not just FPS: Luna has 9 cells, silhouettes only 6.
// At Luna's 12 FPS the six-cell NPCs need 8 FPS for the same .75s breath.
// Never accelerate longer clips (e.g. Shiba) beyond Luna's frame rate.
// Phase offsets, world time, travel speed and event timing remain independent.
function frameIndex(time,count=6,phase=0){const idle=global.LUNA_OUTSIDE_DATA.animations.idle,rate=idle.fps*Math.min(1,count/idle.frames.length);return(Math.floor(time*rate)+phase)%count;}
function frame(node,time){return{...node.sprite,x:frameIndex(time,6,node.ambient.phase??0)*129};}
// Measure only character/interaction cells on demand, never a whole scene atlas.
// Union animated frames so indicators do not bounce with transparent padding.
let artImages=null,artData=null;const boundsCache=new Map();
function prepareBounds(images,data){artImages=images;artData=data;}
function bounds(sp){
 const animation=Object.values(artData?.animations||{}).find(a=>a.frames[0]?.asset===sp.asset);
 const cells=animation?.frames||(sp.asset.startsWith('ambient-')?Array.from({length:6},(_,i)=>({...sp,x:i*129})): [sp]);
 const key=[sp.asset,animation?'animation':sp.asset.startsWith('ambient-')?'idle':sp.x,sp.y,sp.w,sp.h].join(':');
 if(boundsCache.has(key))return boundsCache.get(key);
 const image=artImages?.get(sp.asset);if(!image)return null;
 const canvas=document.createElement('canvas');canvas.width=sp.w;canvas.height=sp.h;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 let left=sp.w,top=sp.h,right=0,bottom=0;
 for(const cell of cells){ctx.clearRect(0,0,sp.w,sp.h);ctx.drawImage(image,cell.x,cell.y,cell.w,cell.h,0,0,sp.w,sp.h);const rgba=ctx.getImageData(0,0,sp.w,sp.h).data;
  for(let y=0;y<sp.h;y++)for(let x=0;x<sp.w;x++)if(rgba[(y*sp.w+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}}
 const box={left,top,right,bottom};boundsCache.set(key,box);return box;
}
function head(sp,x,y,sx=1,sy=1,flip=false){const b=bounds(sp);if(!b)return null;return{x:x+((b.left+b.right)/2-sp.w*sp.pivot.x)/sp.ppu*sx*(flip?-1:1),y:y+((1-sp.pivot.y)*sp.h-b.top)/sp.ppu*sy};}
function actorHead(m,actor,target){
 if(actor==='luna'){const sp=global.LUNA_OUTSIDE_DATA.animations.idle.frames[0];return head(sp,m.x,m.y,1,1,m.facing>0);}
 const n=global.LUNA_OUTSIDE_DATA?.scenes[m.scene]?.nodes.find(n=>n.name===(target?.nodeName||actor)||n.id===actor);
 return n?.sprite?head(n.sprite,n.x,n.y,n.sx,n.sy,n.flip):null;
}
global.LunaOutsideAmbient={apply,visible,frame,frameIndex,placements,faceTarget,facing,prepareBounds,bounds,head,actorHead};
if(global.LUNA_OUTSIDE_DATA)apply(global.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
