/* Authored street CRT planes in receiver-local pixels, plus the independent
 * terrace raster. Never a full-screen post-process or a mutation of source art. */
(function(W){'use strict';
const rect=(id,x,y,w,h)=>({id,points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
const quad=(id,...points)=>({id,points});
const masks={
 terrace:[
  // City art is already flattened: omit screens occluded by its foreground
  // rooftops and the far-right facade. One visible display = one phase/mask.
  rect('upper-left-ad',227,9,18,45),rect('upper-portrait',252,25,39,32),
  quad('upper-slanted',[298,35],[320,23],[320,42],[298,50]),
  rect('portrait-left',197,55,23,63),rect('pink-small',227,68,21,47),
  quad('small-slanted',[292,68],[313,60],[313,87],[292,95]),
  rect('blue-face',274,110,17,23),
  quad('woman-right',[355,46],[370,51],[374,141],[355,136])
 ]
};
// CRT planes are attached to their receiving sprite, so parallax, zoom and
// foreground occlusion cannot move them off the signs. Terrace is unchanged.
for(const r of W.LUNA_STREET_EFFECTS?.scans||[]){
 const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>[r.x+r.a*x+r.c*y,r.y+r.b*x+r.d*y]);
 (masks[r.receiver]??=[]).push({...r,points});
}
const cache=new Map();
function bounds(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return{x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};}
function render(key,time=0,still=false){
 const regions=masks[key];if(!regions)return null;
 let entry=cache.get(key);
 if(!entry){const b=bounds(regions.flatMap(r=>r.points)),canvas=document.createElement('canvas');b.x=Math.floor(b.x);b.y=Math.floor(b.y);canvas.width=Math.ceil(b.right)-b.x;canvas.height=Math.ceil(b.bottom)-b.y;entry={canvas,x:b.x,y:b.y,stamp:null};cache.set(key,entry);}
 const terrace=key==='terrace';
 const fps=terrace?12:60,stamp=still?0:Math.floor(Math.max(0,time)*fps)+1;if(entry.stamp===stamp)return entry;
 entry.stamp=stamp;const t=still?0:(stamp-1)/fps,ctx=entry.canvas.getContext('2d');
 ctx.clearRect(0,0,entry.canvas.width,entry.canvas.height);ctx.save();ctx.translate(-entry.x,-entry.y);
 regions.forEach((r,index)=>{
  if(!terrace){
   ctx.save();ctx.transform(r.a,r.b,r.c,r.d,r.x,r.y);ctx.beginPath();ctx.rect(-.5,-.5,1,1);ctx.clip();
   const rows=Math.max(1,Math.ceil(Math.hypot(r.c,r.d)*2)),frequency=r.frequency;
   for(let row=0;row<rows;row++){
    const uv=(1-(row+.5)/rows+t*r.speed+.5)*frequency;
    const fraction=((uv+.25)%1+1)%1,distance=4*Math.abs(fraction-.5)-1;
    const alpha=.5+.5*Math.max(-1,Math.min(1,distance*.35/(Math.abs(frequency)/rows)));
    ctx.fillStyle=`rgba(0,0,0,${alpha*r.opacity})`;ctx.fillRect(-.5,row/rows-.5,1,1/rows);
   }
   ctx.restore();return;
  }
  const b=bounds(r.points),h=b.bottom-b.y,w=b.right-b.x,phase=index*.73;
  ctx.save();ctx.beginPath();r.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  // A calm moving raster, not brightness flicker or horizontal distortion.
  const step=3,shift=still?0:Math.floor(t*5+phase)%step;
  ctx.fillStyle='rgba(3,8,19,.09)';
  for(let y=b.y-step+shift;y<b.bottom;y+=step)ctx.fillRect(b.x,y,w,1);
  ctx.fillStyle='rgba(211,235,249,.02)';
  for(let y=b.y-step+shift+1;y<b.bottom;y+=step)ctx.fillRect(b.x,y,w,1);
  if(!still){
   const band=Math.max(3,Math.min(12,h*.16)),speed=Math.max(4,h/5),cy=b.y+((t*speed+phase*13)%(h+band*2))-band;
   for(let i=0;i<band;i++){ctx.fillStyle='rgba(211,235,249,'+(.035*Math.sin(Math.PI*i/band))+')';ctx.fillRect(b.x,Math.floor(cy+i),w,1);}
  }
  ctx.restore();
 });ctx.restore();return entry;
}
function paintSprite(ctx,key,sp,width,height,time,still){
 const e=render(key,time,still);if(!e)return;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
 const sx=width/sp.w,sy=height/sp.h;
 ctx.drawImage(e.canvas,-width*sp.pivot.x+(e.x-sp.x)*sx,-height*(1-sp.pivot.y)+(e.y-sp.y)*sy,e.canvas.width*sx,e.canvas.height*sy);ctx.restore();
}
function paintTerrace(host,time){
 const target=host.querySelector('.terrace-sign-scanlines');if(!target)return;
 const e=render('terrace',time,W.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 if(target.dataset.stamp===String(e.stamp))return;
 const ctx=target.getContext('2d');ctx.clearRect(0,0,480,270);ctx.drawImage(e.canvas,e.x,e.y);target.dataset.stamp=String(e.stamp);
}
W.LunaSignScanlines={masks,render,paintSprite,paintTerrace};
})(window);
