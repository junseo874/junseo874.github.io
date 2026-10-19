/* Pixel-drawn holo-call, timed from FX_Holo.gif: horizontal signal, unfolding
   card, then portrait/scan lines. Closing samples the same frames in reverse. */
(function(W){'use strict';
const width=100,height=72,duration=.8,steps=10,cache=new Map();
const clamp=x=>Math.max(0,Math.min(1,x));
function frame(mode,age){
 if(mode==='idle')return {step:steps,scan:Math.floor(Math.max(0,age)*8)%12};
 const forward=Math.min(steps,Math.floor(clamp(age/duration)*(steps+1)));
 return {step:mode==='off'?steps-forward:forward,scan:0};
}
function texture(step,scan=0){
 const key=step+':'+scan;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
 const rect=(x,y,w,h,color,alpha=1)=>{g.globalAlpha=alpha;g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 if(step>0&&step<=5){
  // Three staggered light streaks travel out from the device toward the card.
  const left=[0,68,49,28,10,10][step];
  rect(left,35,94-left,2,'#25f9f2',.95);
  if(step>=2)rect(left+15,23,79-left,2,'#26dcd9',.72);
  if(step>=3)rect(left+24,47,70-left,2,'#26dcd9',.66);
 }else if(step>=6){
  const h=[4,20,42,56,64][step-6],top=36-h/2,bottom=36+h/2;
  // The triangular projection is built from individual pixel scan lines.
  for(let y=top+2;y<bottom;y+=4){const reach=94-Math.abs(y-36)*1.65;rect(38,y,Math.max(0,reach-38),2,'#29dbd8',.22+(Math.floor(y/4)%3)*.10);}
  rect(5,top+2,34,h-4,'#04555b',.28);
  rect(7,top,30,2,'#27f3ec',.9);rect(7,bottom-2,30,2,'#27f3ec',.9);
  rect(4,top+3,2,h-6,'#27e9e6',.85);rect(38,top+3,2,h-6,'#27e9e6',.85);
  rect(6,top+2,2,2,'#69ffff',.9);rect(36,top+2,2,2,'#69ffff',.9);
  if(step>=8){
   g.save();g.beginPath();g.rect(7,top+4,29,h-8);g.clip();
   // Anonymous caller silhouette, matching the reference rather than a second Luna.
   rect(15,13,15,4,'#19e3e2',.92);rect(12,17,21,14,'#20e9e7',.92);
   rect(15,31,15,4,'#2ffbf2',.9);rect(19,35,7,4,'#16c4cd',.9);
   rect(12,39,20,4,'#2aefea',.87);rect(9,43,26,7,'#25dfdf',.85);
   rect(10,54,24,2,'#44f9ed',.9);rect(10,59,20,2,'#25dada',.8);
   for(let y=top+4;y<bottom-3;y+=4)rect(8,y,28,1,'#063f4b',.65);
   rect(8,12+scan*4,28,2,'#b8ffff',.28);
   g.restore();
  }
 }
 g.globalAlpha=1;cache.set(key,canvas);return canvas;
}
function draw(g,mode,age,k,scale){const f=frame(mode,age),image=texture(f.step,f.scan),w=width/100*k*scale,h=height/100*k*scale;g.imageSmoothingEnabled=false;g.drawImage(image,-w/2,-h,w,h);}
W.StudioHoloCall={width,height,duration,frame,draw,thumbnail:()=>texture(steps).toDataURL()};
})(window);
