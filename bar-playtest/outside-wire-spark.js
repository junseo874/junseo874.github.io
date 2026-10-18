/* FX_WireSpark_01.gif: 28 frames / 4.64s. Reuse the unmodified Unity
 * FX_TX_Lightning_04 5x5 sheet; only glow and falling flecks are code-rendered.
 * Coordinates below are native pixels in the supplied object_1.png atlas. */
(function(W){
'use strict';
const durations=[600,60,70,70,70,60,70,70,60,70,70,1300,70,60,70,70,60,70,70,60,70,70,70,60,70,70,60,1070];
const frames=[-1,0,1,2,3,4,5,6,7,8,9,-1,11,13,15,18,20,22,23,24,-1,-1,-1,-1,-1,-1,-1,-1];
const period=durations.reduce((a,b)=>a+b,0)/1000;
const crop={x:970,y:150,w:90,h:85},tip={x:1009,y:195};
const loose=[[987,165],[987,174],[988,179],[990,185],[993,189],[996,192],[1000,192],[1000,191],[1004,191],[1004,192],[1008,192],[1009,193],[1009,195],[1008,196]];
function apply(data){data.assets['street-wire-spark']={src:'assets/outside/wire-lightning-04.png',w:250,h:250,source:'Unity FX_TX_Lightning_04 · original 5 × 5 electric-wire atlas'};return data;}
function frameAt(time){let ms=((Math.max(0,time)%period)*1000);for(let i=0;i<durations.length;i++){if(ms<durations[i])return i;ms-=durations[i];}return 0;}
function canvas(){const c=document.createElement('canvas');c.width=crop.w;c.height=crop.h;return c;}
function dot(ctx,x,y,color,size=1){ctx.fillStyle=color;ctx.fillRect(Math.round(x-crop.x),Math.round(y-crop.y),size,size);}
function line(ctx,a,b,color){const dx=b[0]-a[0],dy=b[1]-a[1],steps=Math.max(Math.abs(dx),Math.abs(dy));for(let i=0;i<=steps;i++)dot(ctx,a[0]+dx*i/(steps||1),a[1]+dy*i/(steps||1),color);}
function halo(ctx,x,y,r,color,alpha){const g=ctx.createRadialGradient(x-crop.x,y-crop.y,0,x-crop.x,y-crop.y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(30,140,210,0)');ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-crop.x-r,y-crop.y-r,r*2,r*2);ctx.restore();}
const cache=new WeakMap();
function build(object,atlas){
 let cached=cache.get(object);if(cached?.atlas===atlas)return cached.frames;
 const panel=document.createElement('canvas');panel.width=10;panel.height=9;const pc=panel.getContext('2d');pc.drawImage(object,1023,157,10,9,0,0,10,9);const pixels=pc.getImageData(0,0,10,9).data;
 const rendered=frames.map((cell,index)=>{
  const core=canvas(),light=canvas(),c=core.getContext('2d'),l=light.getContext('2d');c.imageSmoothingEnabled=false;
  // Preserve the existing display glyph, lighting its teal pixels only.
  for(let y=0;y<9;y++)for(let x=0;x<10;x++){const i=(y*10+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]&&g>r+5&&b>r+3&&g>24)dot(c,1023+x,157+y,g>45?'#9be5bf':'#3c9d8c');}
  for(let i=1;i<loose.length;i++)line(c,loose[i-1],loose[i],'#286379');
  halo(l,1028,162,14,'#52d6ac',.16);
  halo(l,1002,183,26,'#327caa',.07);
  if(cell>=0){
   const spark=canvas(),s=spark.getContext('2d'),inner=index<12,ox=inner?978:982,oy=157;
   s.imageSmoothingEnabled=false;s.drawImage(atlas,cell%5*50,Math.floor(cell/5)*50,50,50,ox-crop.x,oy-crop.y,50,50);
   s.globalCompositeOperation='source-in';s.fillStyle='#9bdfff';s.fillRect(0,0,crop.w,crop.h);
   l.save();l.globalAlpha=.65;l.filter='blur(2px)';l.drawImage(spark,0,0);l.globalAlpha=.28;l.filter='blur(5px)';l.drawImage(spark,0,0);l.restore();
   c.drawImage(spark,0,0);
   if(index>=17&&index<=19)halo(l,tip.x,tip.y,16,'#56caff',index===19?.16:.42);
  }
  // Tiny blue debris follows the terminal flash, then goes fully dark.
  if(index>=19&&index<=26){const t=(index-19)/7;
   for(const [i,vx]of [-12,-6,3,9,14].entries()){
    const life=1-t;if(life<=0||i===4&&t<.28)continue;
    const x=tip.x+vx*t,y=tip.y+3+(5+i)*t+13*t*t;
    c.globalAlpha=life*.85;dot(c,x,y,i%2?'#8ee5ff':'#399cd2');
   }c.globalAlpha=1;
  }
  return{core,light};
 });cache.set(object,{atlas,frames:rendered});return rendered;
}
function paint(ctx,object,atlas,sp,width,height,time,reduced=false){
 if(!atlas)return;const f=build(object,atlas)[reduced?0:frameAt(time)],px=width/sp.w,py=height/sp.h;
 const x=-width*sp.pivot.x+crop.x*px,y=-height*(1-sp.pivot.y)+crop.y*py;
 ctx.save();ctx.globalCompositeOperation='screen';ctx.imageSmoothingEnabled=true;ctx.drawImage(f.light,x,y,crop.w*px,crop.h*py);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(f.core,x,y,crop.w*px,crop.h*py);ctx.restore();
}
function anchor(data){const n=data.scenes.street.nodes.find(n=>n.name==='B_Obects'),s=n.sprite;return{x:n.x+(tip.x-s.w*s.pivot.x)*n.sx/s.ppu,y:n.y+(s.h*(1-s.pivot.y)-tip.y)*n.sy/s.ppu};}
W.LunaWireSpark={apply,paint,frameAt,period,durations,frames,anchor};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(window);
