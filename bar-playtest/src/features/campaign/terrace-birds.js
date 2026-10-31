(function(W){
'use strict';
const {assets,sheet,crops,frameAt}=W.LunaBirdSprites;
// Positions in the original 480 × 270 composition. The ledges are rows 92/260;
// toes overlap their top edge by one pixel, as in the supplied wall reference.
// Both original sheets face right. Keep that direction for every perched/arriving bird.
const layouts={
 0:[['crow',78,93,1],['crow',137,261,1],['crow',194,261,1]],
 1:[['crow',142,261,1],['pigeon',159,261,1,true],['crow',178,261,1]],
 2:[['pigeon',81,93,1],['pigeon',101,93,1],['crow',199,93,1],['crow',88,261,1]]
};
// Trace the supplied red route in the 480 × 270 art grid: enter below the
// lower-right skyline, crest gently, then travel left onto the existing perch.
const arrival={duration:2.8,curves:[
 [[227,23],[220,12],[172,-7],[124,-7]],
 [[124,-7],[76,-7],[43,5],[0,0]]
]};
function arrivalOffset(age){
 const t=Math.max(0,Math.min(1,age/arrival.duration)),u=t*t*(3-2*t);
 const curve=arrival.curves[u<.5?0:1],p=u<.5?u*2:(u-.5)*2,q=1-p;
 return [0,1].map(axis=>q*q*q*curve[0][axis]+3*q*q*p*curve[1][axis]+3*q*p*p*curve[2][axis]+p*p*p*curve[3][axis]);
}
const frames=new WeakMap(),painted=new WeakMap();
function frameImage(image,crop,index){
 let cached=frames.get(image);
 if(!cached){
  cached=Array.from({length:sheet.frames},(_,i)=>{
   const canvas=document.createElement('canvas');canvas.width=crop.w*4;canvas.height=crop.h*4;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   ctx.drawImage(image,i*sheet.width+crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
   return canvas;
  });frames.set(image,cached);
 }
 return cached[index];
}
function begin(dialog,day){dialog.terraceBirds={day,arrivalAt:null};}
function advance(dialog){
 const state=dialog.terraceBirds;
 // Store the start on the conversation, not the DOM or a line's render clock.
 // Completing typing does not count; advancing past three spoken rows does.
 if(!state||state.day!==1||state.arrivalAt!==null)return;
 let spoken=0;
 for(let i=0;i<dialog.index;i++){const row=dialog.rows[i];if(row.text&&(!row.type||row.type==='say'))spoken++;}
 if(spoken>=3)state.arrivalAt=dialog.terraceTime||0;
}
function poses(dialog){
 const state=dialog.terraceBirds,time=dialog.terraceTime||0;
 return (layouts[state?.day]||[]).flatMap(([kind,x,y,facing,arrives],i)=>{
  if(arrives&&state.arrivalAt===null)return [];
  const age=arrives?Math.max(0,time-state.arrivalAt):Infinity;
  const reduced=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const landed=reduced||age>=arrival.duration;
  const [dx,dy]=landed?[0,0]:arrivalOffset(age);
  const idle=arrives?Math.max(0,age-arrival.duration):time+i*.47;
  return [{kind,x:x+dx,y:y+dy,facing,landed,frame:frameAt(idle,reduced||!landed)}];
 });
}
function draw(ctx,dialog,images,scale=1){
 ctx.save();ctx.imageSmoothingEnabled=false;
 for(const bird of poses(dialog)){
  const image=images.get(assets[bird.kind]);if(!image)continue;
  const crop=crops[bird.kind];
  ctx.save();ctx.translate(bird.x*scale,bird.y*scale);ctx.scale(bird.facing,1);
  ctx.drawImage(frameImage(image,crop,bird.frame),
   (crop.x-crop.footX)*scale,-crop.h*scale,crop.w*scale,crop.h*scale);
  ctx.restore();
 }
 ctx.restore();
}
function paint(dialog,host,images){
 const canvas=host.querySelector('.terrace-birds');if(!canvas)return;
 const stamp=JSON.stringify(poses(dialog));if(painted.get(canvas)===stamp)return;
 painted.set(canvas,stamp);
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 draw(ctx,dialog,images,4);
}
W.LunaTerraceBirds={assets,sheet,crops,layouts,arrival,begin,advance,poses,draw,paint};
})(window);
