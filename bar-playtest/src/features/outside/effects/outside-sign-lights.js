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
// Only one faulty tube per cluster. Coordinates are in the Light2D atlas,
// not screen space. Letter-only masks retain the plaque, trim and other tubes.
const faults=[
 {id:'street-neon-service-strip',region:[339,115,29,1]},
 {id:'street-neon-vertical-left',region:[0,90,15,15]},
 {id:'street-neon-restaurant-cluster',region:[718,71,31,30]},
 {id:'street-neon-shiba-cluster',region:[95,110,11,11],letterMask:'top-letter'},
 {id:'street-neon-upper-left',region:[61,43,26,25],letterMask:'outlined-d'}
];
const faultCache=new WeakMap();
function faultLevel(id,time=0,still=false){
 if(still)return 1;
 const index=faults.findIndex(f=>f.id===id);if(index<0)return 1;
 // Staggered faults cannot black out the street together. Each lamp gets
 // a short irregular two-interruption episode, followed by ~11 s of rest.
 const t=Math.max(0,time),slot=Math.floor(t/2.4);
 if(slot%faults.length!==index)return 1;
 const seed=Math.sin((slot+1)*127.1)*43758.5453,r=seed-Math.floor(seed);
 const age=t-slot*2.4-(.4+r*1.1);
 if(age<0||age>=.70)return 1;
 if(age<.12+r*.05)return .07;
 if(age<.34)return 1;
 if(age<.57)return .04;
 return .3+.7*(age-.57)/.13;
}
function faultParts(image,sp,fault){
 let entries=faultCache.get(image);if(!entries){entries=new Map();faultCache.set(image,entries);}
 const key=[fault.id,sp.x,sp.y,sp.w,sp.h].join(':');if(entries.has(key))return entries.get(key);
 const base=document.createElement('canvas');base.width=sp.w;base.height=sp.h;
 const bc=base.getContext('2d');bc.drawImage(image,sp.x,sp.y,sp.w,sp.h,0,0,sp.w,sp.h);
 const [x,y,w,h]=fault.region,l=x-sp.x,top=y-sp.y;
 const tube=document.createElement('canvas');tube.width=w;tube.height=h;
 const tc=tube.getContext('2d');tc.drawImage(image,x,y,w,h,0,0,w,h);
 if(fault.letterMask){
  // The full letter includes both its violet core and gold outline/bevel.
  // The D's lower-right gold pixels also border "ance": native row limits
  // separate that lettering from D without blacking out the shared plaque.
  const pixels=tc.getImageData(0,0,w,h),back=bc.getImageData(l,top,w,h);
  for(let i=0;i<pixels.data.length;i+=4){
   const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],a=pixels.data[i+3];
   const px=x+(i/4)%w,py=y+Math.floor(i/4/w),violet=r>90&&g<90&&b>180;
   const gold=fault.letterMask==='outlined-d'?(r===255&&g===170&&b===78||r===228&&g===141&&b===66):(r===190&&g===144&&b===53||r===232&&g===177&&b===66);
   const dRight={58:78,59:78,60:77,61:77,62:75,63:75};
   const selected=a===255&&(violet||gold)&&(fault.letterMask!=='outlined-d'||px<=(dRight[py]??86));
   if(selected)back.data[i+3]=0;else pixels.data[i+3]=0;
  }
  tc.putImageData(pixels,0,0);bc.putImageData(back,l,top);
 }else bc.clearRect(l,top,w,h);
 const result={base,tube,l,top,w,h};entries.set(key,result);return result;
}
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
 const level=faultLevel(id,time,still),fault=level<1&&faults.find(f=>f.id===id);
 if(fault){
  const p=faultParts(image,sp,fault),px=width/sp.w,py=height/sp.h;
  const left=-width*sp.pivot.x,top=-height*(1-sp.pivot.y);
  ctx.save();ctx.translate(left,top);
  paint(ctx,p.base,{x:0,y:0,w:sp.w,h:sp.h,pivot:{x:0,y:1}},width,height);
  ctx.translate(p.l*px,p.top*py);ctx.globalAlpha*=level;
  paint(ctx,p.tube,{x:0,y:0,w:p.w,h:p.h,pivot:{x:0,y:1}},p.w*px,p.h*py);
  ctx.restore();return;
 }
 const {canvas,pad}=bloom(image,sp),px=width/sp.w,py=height/sp.h;
 const left=-width*sp.pivot.x,top=-height*(1-sp.pivot.y);
 ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;
 ctx.drawImage(canvas,left-pad*px,top-pad*py,canvas.width*px,canvas.height*py);
 ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,sp.x,sp.y,sp.w,sp.h,left,top,width,height);ctx.restore();
}
W.LunaStreetSigns={apply,paint,signs,faults,faultLevel};
if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
