/* Horizontal signal tears, paced from the supplied 2.86-second logo reference.
 * Uses the existing transparent logo; no background or menu pixels are altered. */
(function(W){
 'use strict';
 // Sampled from Honeycam 2026-08-24 20-22-09.gif.
 // Entries retain frame start (ms) and [source row, row count, horizontal shift].
 // Source logo spans y=76..150; its LUNA letters span y=100..148.
 const frames=[
  [0,[[0,75,0]]],
  [620,[[0,75,0]]],
  [870,[[0,75,0]]],
  [940,[[0,75,0]]],
  [1010,[[0,3,0],[3,1,10],[4,1,11],[5,1,10],[6,1,9],[7,1,10],[8,1,-7],[9,1,-6],[10,14,0],[24,1,-5],[25,1,3],[26,1,4],[27,1,7],[28,3,9],[31,2,-8],[33,2,-6],[35,6,-7],[41,5,-6],[46,6,-7],[52,1,-8],[53,9,-9],[62,1,6],[63,1,5],[64,3,6],[67,1,7],[68,2,6],[70,2,7],[72,3,0]]],
  [1070,[[0,3,0],[3,1,6],[4,1,5],[5,3,6],[8,2,-5],[10,14,0],[24,1,-5],[25,3,-4],[28,1,0],[29,3,2],[32,2,-4],[34,14,-5],[48,7,-4],[55,1,-5],[56,3,-4],[59,2,-5],[61,1,-4],[62,4,-3],[66,2,-2],[68,2,-1],[70,1,0],[71,1,-1],[72,3,0]]],
  [1140,[[0,75,0]]],
  [1210,[[0,75,0]]],
  [1270,[[0,75,0]]],
  [1340,[[0,75,0]]],
  [1410,[[0,24,0],[24,16,4],[40,1,3],[41,1,4],[42,2,3],[44,11,0],[55,17,-7],[72,3,0]]],
  [1470,[[0,24,0],[24,8,8],[32,1,7],[33,1,8],[34,1,7],[35,1,8],[36,2,7],[38,5,8],[43,1,7],[44,11,0],[55,17,-13],[72,3,0]]],
  [1540,[[0,24,0],[24,5,6],[29,3,8],[32,11,5],[43,1,4],[44,12,0],[56,3,-8],[59,3,-9],[62,6,-8],[68,4,-6],[72,3,0]]],
  [1610,[[0,75,0]]],
  [1680,[[0,44,0],[44,28,-12],[72,3,0]]],
  [1740,[[0,24,0],[24,3,1],[27,1,2],[28,3,1],[31,1,2],[32,7,1],[39,1,2],[40,1,1],[41,1,2],[42,2,1],[44,4,-14],[48,1,-13],[49,23,-14],[72,3,0]]],
  [1810,[[0,24,0],[24,20,-11],[44,10,-12],[54,1,-13],[55,1,-15],[56,16,-16],[72,3,0]]],
  [1880,[[0,24,0],[24,31,-10],[55,1,-13],[56,16,-14],[72,3,0]]],
  [1940,[[0,24,0],[24,31,-10],[55,6,-15],[61,1,-16],[62,7,-15],[69,1,-16],[70,2,-15],[72,3,0]]],
  [2010,[[0,24,0],[24,10,-10],[34,17,0],[51,1,-1],[52,1,0],[53,2,-10],[55,17,-14],[72,3,0]]],
  [2080,[[0,24,0],[24,10,-10],[34,21,0],[55,12,-10],[67,1,0],[68,1,-7],[69,3,-6],[72,3,0]]],
  [2150,[[0,24,0],[24,10,-12],[34,21,0],[55,1,-3],[56,10,-4],[66,9,0]]],
  [2210,[[0,24,0],[24,10,-7],[34,22,0],[56,1,-2],[57,18,0]]],
  [2280,[[0,75,0]]],
  [2350,[[0,75,0]]]
 ];
 W.LunaTitleLogo={mount(host){
  const image=host?.querySelector('img'),canvas=host?.querySelector('canvas');
  if(!image||!canvas)return null;
  const ctx=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(!ctx)return null;
  let ready=false,last=-1;
  const state={time:0,tick(dt){
   if(!host.isConnected||document.hidden)return;
   if(!motion.matches)state.time=(state.time+dt)%2.86;
   paint(motion.matches?0:state.time*1000);
  }};
  function paint(ms){
   if(!ready)return;
   let frame=0;for(let i=1;i<frames.length&&ms>=frames[i][0];i++)frame=i;
   if(last===frame)return;last=frame;
   const w=image.naturalWidth,h=image.naturalHeight,pad=Math.ceil(w*.12);
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
   // Align the reference's letter boundaries to the native 1340×660 artwork.
   // Every scanline is painted once, including undisturbed margins.
   let previous=0;
   for(const [row,height,shift] of frames[frame][1]){
    const start=Math.round((90.5+row*6.48)*h/660);
    const end=Math.min(h,Math.round((90.5+(row+height)*6.48)*h/660));
    if(start>previous)ctx.drawImage(image,0,previous,w,start-previous,pad,previous,w,start-previous);
    if(end>start)ctx.drawImage(image,0,start,w,end-start,pad+Math.round(shift*w/201),start,w,end-start);
    previous=end;
   }
   if(previous<h)ctx.drawImage(image,0,previous,w,h-previous,pad,previous,w,h-previous);
  }

  function init(){
   if(!host.isConnected||!image.naturalWidth)return;
   canvas.width=image.naturalWidth+Math.ceil(image.naturalWidth*.12)*2;canvas.height=image.naturalHeight;
   ready=true;paint(0);host.classList.add('logo-ready');
  }
  if(image.complete)init();else image.addEventListener('load',init,{once:true});
  return state;
 }};
})(window);
