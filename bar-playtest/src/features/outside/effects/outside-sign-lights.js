/* Authored Unity Light2D cookies, aligned to the current storefront sprite.
 * PNGs are untouched. Only the soft spill is generated and cached at runtime. */
(function(W){
'use strict';
const root='assets/outside/street-20261018/Lights/';
// id, atlas, crop (top-left), engine x/y, pivotY, engine intensity.
// Duplicate roof/candle lights and Shiba's already-included subcrop are omitted;
// obsolete lights outside this storefront atlas are intentionally not imported.
const signs=[
 ['convenience',1,[279,27,147,14],-5.165,.015,.5,1.14],
 ['vertical-left',1,[0,60,15,45],-4.455,.83,.5,.81],
 // Tighten this Unity slice to the neon plaque; the atlas's detached magenta
 // test line at x=212 is not part of the storefront. Preserve its left edge.
 ['upper-left',1,[28,39,87,61],-3.765,.96,.5,.87],
 ['shiba-cluster',1,[52,107,161,120],-3.155,-.015,.5,.7],
 ['left-lanterns',1,[28,180,24,64],-4.08,-.475,.5,.74],
 ['service-strip',1,[339,115,29,1],-1.805,.91,.5,1.86],
 ['service-cluster',1,[228,147,254,102],-.63,-.325,.5,1.17],
 ['service-inset',2,[0,0,32,25],0,-.115,0,.44],
 ['service-top',1,[347,130,70,2],.68,.615,.5,1.33],
 ['bar-script',3,[0,0,38,26],.85,-.385,0,1.22],
 ['vending',1,[451,199,27,38],.464,-.53,.5,1.04],
 ['door-lamp',1,[494,234,12,12],.82,-.745,.5,1.08],
 ['leaning-sign',1,[537,215,18,34],1.28,-.675,.5,1.17],
 ['restaurant-cluster',1,[544,19,230,185],2.41,.54,.5,1.2],
 ['exit-signs',1,[782,202,13,42],3.705,-.585,.5,1.1],
 ['roof-sign',1,[795,0,134,40],4.57,1.455,.5,.96],
 ['food-bar',1,[587,229,166,20],4.59,.555,.5,1.47],
 ['poker-open',1,[807,166,111,37],4.575,-.19,.5,1.49],
 ['right-store',1,[798,56,130,81],5.88,-.47,.5,.45]
];
function apply(data){
 if(data.signLightVersion===1)return data;
 const nodes=data.scenes.street.nodes,parent=nodes.find(n=>n.name==='B_Fore_Building_1');
 if(!parent)return data;
 for(const [i,w,h] of [[1,929,249],[2,32,25],[3,38,26]])data.assets['street-sign-'+i]={src:root+'B_Light_'+i+'.png',w,h,source:'Unity OutSide · B_Light_'+i+' · authored Light2D cookie'};
 for(const [id,atlas,[x,y,w,h],wx,wy,pivotY,intensity] of signs){
  nodes.push({id:'street-neon-'+id,go:'street-neon-'+id,name:'간판 발광 · '+id,
   x:parent.x+(wx-.085),y:parent.y+(wy+.89),z:0,sx:1,sy:1,active:true,
   ancestry:['StreetSigns'],layer:parent.layer,order:parent.order+1,flip:false,
   light:true,neon:true,alpha:Math.min(.85,.35+intensity*.35),
   sprite:{asset:'street-sign-'+atlas,x,y,w,h,pivot:{x:.5,y:pivotY},ppu:100}});
 }
 data.signLightVersion=1;return data;
}
const cache=new WeakMap();
function bloom(image,sp){
 let frames=cache.get(image);if(!frames){frames=new Map();cache.set(image,frames);}
 const key=[sp.x,sp.y,sp.w,sp.h].join(':');if(frames.has(key))return frames.get(key);
 const pad=24,source=document.createElement('canvas');source.width=sp.w+pad*2;source.height=sp.h+pad*2;
 source.getContext('2d').drawImage(image,sp.x,sp.y,sp.w,sp.h,pad,pad,sp.w,sp.h);
 const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
 const ctx=canvas.getContext('2d');
 // Native-pixel radii keep the same physical spread while the camera zooms.
 // Each emissive core and its two falloff distances share the same gain.
 ctx.globalAlpha=.28;ctx.filter='blur(7px)';ctx.drawImage(source,0,0);
 ctx.globalAlpha=.48;ctx.filter='blur(2px)';ctx.drawImage(source,0,0);
 const value={canvas,pad};frames.set(key,value);return value;
}
// Draw in the caller's sprite-local transform. Actors/rails still draw later.
function paint(ctx,image,sp,width,height,id=null,time=0,still=false){
 const level=W.LunaStreetEngineEffects?.lightLevel(id,time,still)??1;
 if(level<=0)return;
 const {canvas,pad}=bloom(image,sp),px=width/sp.w,py=height/sp.h;
 const left=-width*sp.pivot.x,top=-height*(1-sp.pivot.y);
 ctx.save();ctx.globalAlpha*=level;ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;
 ctx.drawImage(canvas,left-pad*px,top-pad*py,canvas.width*px,canvas.height*py);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,sp.x,sp.y,sp.w,sp.h,left,top,width,height);ctx.restore();
}
const faultLevel=(id,time,still)=>W.LunaStreetEngineEffects?.lightLevel(id==='street-neon-service-strip'?'881909181':id,time,still)??1;
W.LunaStreetSigns={apply,paint,signs,faultLevel};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
