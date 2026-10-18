/* Rooftop communication lamps, measured in the 1293 x 310 building atlas.
 * The cyan spill is baked into the art: dim that emission as well as the
 * lamp, without replacing the equipment or touching the aerial above it.
 * Everything is drawn in the parent sprite's transform, behind the fence.
 */
(function(W){'use strict';
const lamps=[
 {id:'radio-left',x:508,y:126,rx:14,ry:17,phase:0},
 {id:'radio-right',x:537,y:126,rx:13,ry:17,phase:.85}
];
const period=1.8,cache=new WeakMap();
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
function level(time,index,still=false){
 if(still)return 1;
 const t=((time-lamps[index].phase)%period+period)%period;
 // Slow status signals, not high-frequency random flashes. A short eased
 // ignition/extinction keeps the core and its spill on the same envelope.
 return smooth(t/.12)*(1-smooth((t-.62)/.16));
}
function prepare(image){
 if(cache.has(image))return cache.get(image);
 const parts=lamps.map(lamp=>{
  const x=lamp.x-lamp.rx,y=lamp.y-lamp.ry,w=lamp.rx*2+1,h=lamp.ry*2+1;
  const dim=document.createElement('canvas'),glow=document.createElement('canvas');
  for(const c of [dim,glow]){c.width=w;c.height=h;}
  const dc=dim.getContext('2d'),gc=glow.getContext('2d');
  dc.drawImage(image,x,y,w,h,0,0,w,h);
  const source=dc.getImageData(0,0,w,h),dark=dc.createImageData(w,h),light=gc.createImageData(w,h);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
   const i=(py*w+px)*4,r=source.data[i],g=source.data[i+1],b=source.data[i+2],a=source.data[i+3];
   const d=Math.hypot((px-lamp.rx)/lamp.rx,(py-lamp.ry)/lamp.ry);
   // Restrict to cyan receiver pixels. Black rails, the case outlines and
   // transparent gaps are never painted over with a rectangular dark patch.
   const cyan=clamp((g-r-6)/20)*clamp((g-b*.65)/18);
   const mask=(1-smooth((d-.25)/.75))*cyan;
   dark.data[i]=Math.round(r*.58);dark.data[i+1]=Math.round(g*.36);dark.data[i+2]=Math.round(b*.48);
   dark.data[i+3]=Math.round(a*mask);
   const halo=Math.max(0,1-d);
   light.data[i]=72;light.data[i+1]=224;light.data[i+2]=231;
   light.data[i+3]=Math.round(a*halo*halo*.27*cyan);
  }
  dc.putImageData(dark,0,0);gc.putImageData(light,0,0);
  return {x,y,w,h,dim,glow};
 });
 cache.set(image,parts);return parts;
}
function paintSprite(ctx,key,image,sp,width,height,time,still=false){
 if(key!=='B_Fore_Building_1')return;
 const sx=width/sp.w,sy=height/sp.h,alpha=ctx.globalAlpha;
 const parts=prepare(image);
 ctx.save();
 for(let i=0;i<parts.length;i++){
  const p=parts[i],v=level(time,i,still);
  const x=-width*sp.pivot.x+(p.x-sp.x)*sx,y=-height*(1-sp.pivot.y)+(p.y-sp.y)*sy;
  ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha*(1-v);
  ctx.drawImage(p.dim,x,y,p.w*sx,p.h*sy);
  ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;ctx.globalAlpha=alpha*v;
  ctx.drawImage(p.glow,x,y,p.w*sx,p.h*sy);
 }
 ctx.restore();
}
W.LunaRadioLights={lamps,period,level,prepare,paintSprite};
})(window);
