/* Runtime sprite-alpha outlines. Original art and shared atlases stay unchanged. */
(function(W){
'use strict';
// The complete sofa is baked into the current ver4 room full-shot, not the
// IntractObjects atlas (that only contains its loose pillow and blanket).
// Trace the visible pixel steps in that full-shot's own coordinates. Keeping
// the mask on main_bg also lets the real foreground table and Luna occlude it.
const HOME_SOFA={asset:'629b82812402bc',rect:[410,180,110,53],edge:[
 [410,209],[411,208],[412,207],[413,206],[416,206],[416,205],
 [419,205],[419,204],[421,204],[421,203],[422,203],[422,202],
 [423,202],[423,201],[424,201],[424,200],[432,200],[432,197],
 [428,197],[428,196],[427,196],[427,195],[426,195],[426,194],
 [425,194],[425,188],[426,188],[426,187],[427,187],[427,186],
 [428,186],[428,185],[429,185],[429,184],[475,184],[475,182],
 [477,182],[477,181],[486,181],[486,182],[487,182],[487,181],
 [488,181],[488,180],[493,180],[493,181],[495,181],[495,182],
 [496,182],[496,181],[500,181],[500,182],[501,182],[501,184],
 [514,184],[514,185],[517,185],[517,186],[518,186],[518,187],
 [519,187],[519,224],[518,224],[518,225],[517,225],[517,226],
 [516,226],[516,227],[515,227],[515,228],[513,228],[513,230],
 [512,230],[512,233],[430,233],[430,230],[427,230],[427,228],
 [423,228],[423,226],[420,226],[420,225],[417,225],[417,223],
 [415,223],[415,222],[413,222],[413,220],[412,220],[412,218],
 [410,218]
]};
const sofaRegion=[...HOME_SOFA.rect,HOME_SOFA.edge.map(([x,y])=>[x-HOME_SOFA.rect[0],y-HOME_SOFA.rect[1]])];
function region(target,node,sp,x,y,model){
 if(!target)return null;
 const name=node?.name,full=[0,0,sp.w,sp.h];
 if(target.nodeName&&name===target.nodeName)return full;
 if(target.id==='bar'&&name==='Bar Spawn Point')return [2,15,34,51];
 if(target.id==='exit'&&name==='Room_Entrance')return full;
 if(target.id==='sofa'&&name==='main_bg'&&sp.asset===HOME_SOFA.asset)return sofaRegion;
 // Home atlas: do not outline the neighbouring plant, sofa, or TV together.
 if(name==='IntractObjects'){
  if(target.id==='tv')return [0,0,53,34];
 }
 // The apartment doorway is baked into the residence layer, above the railing.
 if(target.id==='home'&&name==='residence-building')return [567,438,44,77];
 if(target.id==='elevator'){
  const atFloor=(model.elevatorY>4)===(model.level===1);
  if(atFloor&&name==='Elevator')return full;
  // When the car is away, highlight the boarding rails at this floor instead.
  if(!atFloor&&name==='Elevator Line'){
   const top=Math.max(0,Math.round(sp.h*(1-sp.pivot.y)-(target.y+.6-node.y)*sp.ppu));
   return [0,top,sp.w,Math.min(80,sp.h-top)];
  }
 }
 // This NPC is drawn directly, not through a scene node. Match only his cell.
 if(target.id==='day2-thug-information'&&sp.asset==='ambient-M2'&&Math.abs(x-target.x)<.01&&Math.abs(y-(target.y-.24))<.01)return full;
 return null;
}
function create(){
 const cache=new Map();let target=null,model=null,drawn=[];
 function begin(next,m){target=next;model=m;drawn=[];}
 function mask(image,sp,rect){
  const [x,y,w,h,contour]=rect,key=[sp.asset,sp.x+x,sp.y+y,w,h,JSON.stringify(contour)].join(':');
  if(cache.has(key))return cache.get(key);
  const pad=3,base=document.createElement('canvas');base.width=w;base.height=h;
  const b=base.getContext('2d');
  if(contour){b.beginPath();contour.forEach(([x,y],i)=>i?b.lineTo(x,y):b.moveTo(x,y));b.closePath();b.fill();}
  else b.drawImage(image,sp.x+x,sp.y+y,w,h,0,0,w,h);
  const pixels=b.getImageData(0,0,w,h);
  for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=75;pixels.data[i+1]=218;pixels.data[i+2]=255;pixels.data[i+3]=pixels.data[i+3]>20?255:0;}
  b.putImageData(pixels,0,0);
  const ring=document.createElement('canvas');ring.width=w+pad*2;ring.height=h+pad*2;
  const c=ring.getContext('2d');
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)c.drawImage(base,pad+dx,pad+dy);
  c.globalCompositeOperation='destination-out';c.drawImage(base,pad,pad);
  const value={canvas:ring,pad};if(cache.size>=96)cache.delete(cache.keys().next().value);cache.set(key,value);return value;
 }
 function paint(ctx,image,sp,node,x,y,w,h){
  const rect=region(target,node,sp,x,y,model);if(!rect||rect[2]<=0||rect[3]<=0)return;
  const {canvas,pad}=mask(image,sp,rect),px=w/sp.w,py=h/sp.h;
  const left=-w*sp.pivot.x+(rect[0]-pad)*px,top=-h*(1-sp.pivot.y)+(rect[1]-pad)*py;
  ctx.save();ctx.globalAlpha=.96;ctx.shadowColor='#19caff';ctx.shadowBlur=9;
  ctx.drawImage(canvas,left,top,canvas.width*px,canvas.height*py);ctx.restore();
  drawn.push({node:node?.name||null,asset:sp.asset,region:rect});
 }
 return {begin,paint,snapshot:()=>({target:target?.id||null,drawn,cacheSize:cache.size})};
}
W.LunaInteractionGlow={create,region};
})(window);
