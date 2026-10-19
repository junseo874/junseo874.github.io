/* Small, local-pixel exhaust plumes. Anchored to the current building art,
 * composited with that building (before nearer geometry), never screen-space.
 * No source PNG edits, randomness, blur, or gameplay clock/state changes. */
(function(W){'use strict';
const sources={
 B_Fore_Building_1:[
  {id:'roof-grille',x:646,y:120,spread:13,seed:1.7,strength:1},
  {id:'roof-fan',x:728,y:128,spread:8,seed:5.3,strength:.85}
 ],
 'residence-building':[
  {id:'residence-condenser',x:811,y:1217,spread:13,seed:9.1,strength:.8},
  {id:'residence-wall-grille',x:686,y:1355,spread:12,seed:13.8,strength:.72}
 ]
};
const width=100,height=70,originX=50,originY=30,fps=12;
const cache=new Map();
// Two softly divergent jets, directed out/down initially, then buoyant.
// Independent birth times avoid a synchronized looping "breathing wall".
function puffs(source,time){
 const out=[],interval=.27,life=3.2;
 for(const side of [-1,1]){
  const clock=time+source.seed+(side===1?.137:0),last=Math.floor(clock/interval);
  for(let i=last-12;i<=last;i++){
   const age=clock-i*interval;if(age<0||age>=life)continue;
   const u=age/life,seed=source.seed+i*2.399+side;
   const pulse=.7+.3*Math.sin(i*.47+source.seed);
   out.push({
    x:originX+side*(source.spread*.45+age*8.5)+Math.sin(seed+age*1.6)*age*1.15,
    y:originY+age*12-age*age*3.2+Math.sin(seed*.71)*age*.8,
    rx:2.3+age*3.2,ry:1.7+age*2.2,
    alpha:Math.min(1,age/.25)*Math.pow(1-u,1.7)*pulse*source.strength
   });
  }
 }
 return out;
}
function render(source,time,still=false){
 let e=cache.get(source.id);
 if(!e){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;e={canvas,stamp:null,x:source.x-originX,y:source.y-originY};cache.set(source.id,e);}
 const stamp=still?0:Math.floor(Math.max(0,time)*fps)+1;
 if(e.stamp===stamp)return e;
 e.stamp=stamp;
 const t=still?2:(stamp-1)/fps,ctx=e.canvas.getContext('2d'),pixels=ctx.createImageData(width,height),field=new Float32Array(width*height);
 for(const p of puffs(source,t)){
  const left=Math.max(0,Math.floor(p.x-p.rx*1.6)),right=Math.min(width,Math.ceil(p.x+p.rx*1.6));
  const top=Math.max(0,Math.floor(p.y-p.ry*1.6)),bottom=Math.min(height,Math.ceil(p.y+p.ry*1.6));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const dx=(x+.5-p.x)/p.rx,dy=(y+.5-p.y)/p.ry,r=dx*dx+dy*dy;
   if(r<2.56)field[y*width+x]+=p.alpha*Math.exp(-r*1.6);
  }
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Coherent eddies break up the silhouette without frame-to-frame noise.
  const ripple=.83+.17*Math.sin(x*.57+y*.39-t*2.1+source.seed);
  const d=field[y*width+x]*ripple;
  if(d<.055)continue;
  const i=(y*width+x)*4;
  pixels.data[i]=137;pixels.data[i+1]=158;pixels.data[i+2]=170;
  pixels.data[i+3]=d<.20?10:d<.48?23:39;
 }
 ctx.putImageData(pixels,0,0);return e;
}
function paintSprite(ctx,key,sp,w,h,time,still=false){
 const vents=sources[key];if(!vents)return;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
 const sx=w/sp.w,sy=h/sp.h;
 for(const vent of vents){const e=render(vent,time,still);
  ctx.drawImage(e.canvas,-w*sp.pivot.x+(e.x-sp.x)*sx,-h*(1-sp.pivot.y)+(e.y-sp.y)*sy,width*sx,height*sy);
 }
 ctx.restore();
}
W.LunaVentSteam={sources,render,paintSprite,puffs,fps};
})(window);
