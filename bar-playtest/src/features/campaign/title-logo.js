/* Horizontal signal tears, paced from the supplied 2.86-second logo reference.
 * Uses the existing transparent logo; no background or menu pixels are altered. */
(function(W){
 'use strict';
 const frames=[
  [0,0],[870,.15],[1010,1],[1070,.85],[1140,.12],[1270,0],
  [1410,.55],[1470,.7],[1540,.9],[1610,0],[1680,.35],
  [1740,.6],[1810,.8],[1880,.5],[1940,.75],[2010,1],
  [2080,.9],[2150,.6],[2210,.4],[2280,.1],[2350,0]
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
   const w=image.naturalWidth,h=image.naturalHeight,pad=Math.ceil(w*.06),strength=frames[frame][1];
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
   if(!strength){ctx.drawImage(image,pad,0);return;}
   // Each horizontal band is drawn exactly once, so the clean logo does not
   // remain behind the displaced pieces as a ghost image.
   let band=0;
   for(let y=0;y<h;band++){
    const seed=(band*37+frame*19)%101;
    const height=Math.min(h-y,Math.max(3,Math.round(h*(seed%5===0?.008:.025+(seed%4)*.012))));
    const offset=Math.round(((seed%17)-8)*w*.004*strength);
    ctx.drawImage(image,0,y,w,height,pad+offset,y,w,height);
    y+=height;
   }
  }
  function init(){
   if(!host.isConnected||!image.naturalWidth)return;
   canvas.width=image.naturalWidth+Math.ceil(image.naturalWidth*.06)*2;canvas.height=image.naturalHeight;
   ready=true;paint(0);host.classList.add('logo-ready');
  }
  if(image.complete)init();else image.addEventListener('load',init,{once:true});
  return state;
 }};
})(window);
