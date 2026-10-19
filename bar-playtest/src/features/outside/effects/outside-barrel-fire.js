/* The left-end green barrel, authored in object_1.png native coordinates.
 * Fire is crisp pixel art; only its local light spill is soft. Both share
 * one clock and the prop's transform, so camera movement cannot detach them. */
(function(W){'use strict';
const anchor={x:70,y:176},crop={x:12,y:108,w:116,h:102},fps=24;
const palette=['#df511b','#ff8c25','#ffbc45','#ffe67a','#fff5be'];
const colors=[[223,81,27],[255,140,37],[255,188,69],[255,230,122],[255,245,190]];
let cached=null;
function energy(t){return .87+.065*Math.sin(t*5.3)+.045*Math.sin(t*8.7+1.4)+.02*Math.sin(t*13.1);}
const smooth=v=>v*v*(3-2*v);
function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy),a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;}
function render(time,still=false){
 const stamp=still?-1:Math.floor(Math.max(0,time)*fps);if(cached?.stamp===stamp)return cached;
 const t=still?1.25:stamp/fps,core=document.createElement('canvas'),light=document.createElement('canvas');
 for(const c of [core,light]){c.width=crop.w;c.height=crop.h;}
 const ctx=core.getContext('2d'),lc=light.getContext('2d'),e=energy(t),ox=anchor.x-crop.x,oy=anchor.y-crop.y;
 // A continuous rising heat field, not rigid waving tongues. Both scales of
 // turbulence travel UP through the plume; new pixels are never random per
 // frame. Native 1px sampling retains the street art's pixel density.
 const data=ctx.createImageData(crop.w,crop.h);
 for(let y=oy-47;y<=oy;y++)for(let x=ox-14;x<=ox+14;x++){
  const rise=oy-y,height=37+2.6*Math.sin(t*2.1)+1.5*Math.sin(t*4.7),u=rise/height;
  if(u>1.14)continue;
  const center=ox+Math.sin(t*2.4-u*3.3)*u*2.7+Math.sin(t*.9)*u;
  const width=9.5*Math.max(.12,1-u*.76),dx=x-center;
  const broad=noise(dx/3.2,(rise-t*23)/5.4),fine=noise(dx/1.6+17,(rise-t*29)/2.9);
  const turbulence=(broad-.5)*(.4+u*.5)+(fine-.5)*(.1+u*.26);
  const profile=1-Math.pow(Math.abs(dx)/width,1.65);
  const tipFade=1-smooth(Math.max(0,Math.min(1,(u-.66)/.48)));
  let heat=(profile*(1-u*.4)-u*.10+turbulence)*tipFade;
  // Small hot packets rise out of the base and briefly split the crown.
  for(let n=0;n<3;n++){
   const life=1.65,age=(t+n*.55)%life,py=age*26,px=Math.sin(n*2.3+age*2.1)*(2.5+age*2);
   const r=2.2*(1-age/life)+1,packet=1-Math.hypot((x-ox-px)/r,(rise-py)/(r*2));
   if(packet>0)heat=Math.max(heat,packet*(.98-age*.18));
  }
  if(heat<.10||rise>45||rise<2&&Math.abs(x-ox)>9)continue;
  const color=heat>.82?4:heat>.65?3:heat>.43?2:heat>.25?1:0,i=(y*crop.w+x)*4,rgb=colors[color];
  data.data[i]=rgb[0];data.data[i+1]=rgb[1];data.data[i+2]=rgb[2];data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);
 // Sparse embers drift upward and extinguish close to the barrel.
 if(!still)for(let i=0;i<4;i++){
  const age=(t+i*.73)%2.9;if(age>1.25)continue;
  const x=Math.round(ox-3+i*2+Math.sin(age*2.6+i)*2.5),y=Math.round(oy-36-age*20);
  if(data.data[(y*crop.w+x)*4+3])continue;
  ctx.globalAlpha=Math.sin(age/1.25*Math.PI)*.75;ctx.fillStyle=palette[2];
  ctx.fillRect(x,y,1,1);
 }
 ctx.globalAlpha=1;
 function glow(x,y,rx,ry,color,alpha){
  lc.save();lc.translate(x,y);lc.scale(rx,ry);
  const g=lc.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(${color},${alpha*e})`);g.addColorStop(.4,`rgba(${color},${alpha*e*.45})`);g.addColorStop(1,`rgba(${color},0)`);
  lc.fillStyle=g;lc.fillRect(-1,-1,2,2);lc.restore();
 }
 glow(ox,oy-16,37,42,'255,116,30',.23);
 glow(ox,oy-14,15,25,'255,177,61',.21);
 glow(ox,oy+24,52,9,'227,113,43',.20);
 glow(ox,oy+9,17,24,'246,139,48',.19);
 cached={stamp,core,light,energy:e};return cached;
}
function paintSprite(ctx,key,sp,w,h,time,still=false){
 if(key!=='B_Obects')return;
 const f=render(time,still),sx=w/sp.w,sy=h/sp.h;
 const x=-w*sp.pivot.x+(crop.x-sp.x)*sx,y=-h*(1-sp.pivot.y)+(crop.y-sp.y)*sy;
 ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;
 ctx.drawImage(f.light,x,y,crop.w*sx,crop.h*sy);
 ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
 ctx.drawImage(f.core,x,y,crop.w*sx,crop.h*sy);ctx.restore();
}
W.LunaBarrelFire={anchor,crop,palette,render,energy,paintSprite,fps};
})(window);
