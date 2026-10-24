/* Runtime sprite-alpha outlines. Original art and shared atlases stay unchanged. */
(function(W){
'use strict';
const style=Object.freeze({color:'#4bdaff',shadow:'#19caff',blur:9});
// Current Chrishouse2 sofa silhouette united with the supplied bedding alpha.
// The left armrest recess follows native rows 197–204; do not bridge its wall gap.
// Keep this mask on the room so foreground furniture and Luna occlude it.
const HOME_SOFA={asset:'629b82812402bc',rect:[410,180,109,53],edge:[
 [465,180],[470,180],[470,181],[472,181],[472,182],[473,182],
 [473,181],[477,181],[477,182],[478,182],[478,183],[479,183],
 [479,184],[514,184],[514,185],[517,185],[517,186],[518,186],
 [518,187],[519,187],[519,224],[518,224],[518,225],[517,225],
 [517,226],[516,226],[516,227],[515,227],[515,228],[513,228],
 [513,230],[512,230],[512,233],[430,233],[430,230],[427,230],
 [427,228],[423,228],[423,226],[420,226],[420,225],[417,225],
 [417,223],[415,223],[415,222],[413,222],[413,220],[412,220],
 [412,218],[410,218],[410,209],[411,209],[411,208],[412,208],
 [412,207],[413,207],[413,206],[416,206],[416,205],[419,205],
 [419,204],[431,204],[431,203],[434,203],[434,202],[435,202],
 [435,199],[434,199],[434,198],[432,198],[432,197],[428,197],
 [428,196],[427,196],
 [427,195],[426,195],[426,194],[425,194],[425,188],[426,188],
 [426,187],[427,187],[427,186],[428,186],[428,185],[429,185],
 [429,184],[451,184],[451,183],[452,183],[452,182],[454,182],
 [454,181],[462,181],[462,182],[464,182],[464,181],[465,181]
]};
const sofaRegion=[...HOME_SOFA.rect,HOME_SOFA.edge.map(([x,y])=>[x-HOME_SOFA.rect[0],y-HOME_SOFA.rect[1]])];
const boxEdge=[[0,3],[3,3],[3,2],[7,2],[7,1],[14,1],[14,0],[17,0],[17,3],[26,3],[26,28],[0,28]];
function region(target,node,sp,x,y,model){
 if(!target)return null;
 const name=node?.name,full=[0,0,sp.w,sp.h];
 if(target.id==='bed')return name==='main_bg'?[...W.LunaHomeArt.bed.rect,W.LunaHomeArt.bed.edge]:null;
 if(target.id==='wardrobe')return name==='main_bg'?[...W.LunaHomeArt.wardrobe.rect,W.LunaHomeArt.wardrobe.edge]:null;
 if(target.nodeName&&name===target.nodeName)return full;
 if(target.id==='bar'&&name==='Bar Spawn Point')return [2,15,34,51];
 if(target.id==='exit'&&name==='Room_Entrance')return full;
 if(target.id==='sofa'&&name==='main_bg'&&sp.asset===HOME_SOFA.asset)return sofaRegion;
 // Home atlas: do not outline the neighbouring plant, sofa, or TV together.
 if(name==='IntractObjects'){
  if(target.id==='tv')return [0,0,53,34];
 }
 // The apartment doorway is baked into the residence layer, above the railing.
 if(target.id==='home'&&name==='residence-building')return node.interactionRegions?.home||[567,438,44,77];
 // The Boobi box is baked into an opaque atlas. Trace only its stepped lid
 // and sides, not the wall or the bin beneath it.
 if(target.id==='neighborhood-box'){
  if(name==='residence-building'&&!(model.neighborhood?.shake>0))return [647,424,27,28,boxEdge];
  if(name==='neighborhood-shaking-box')return [0,0,27,28,boxEdge];
 }
 if(['neighborhood-repair','neighborhood-guard','neighborhood-boss','neighborhood-cat','neighborhood-home-cat'].includes(target.id)&&Math.abs(x-target.x)<.01&&Math.abs(y-target.y)<.01){
  if(['neighborhood-repair','neighborhood-boss'].includes(target.id)&&sp.asset==='ambient-M2'||target.id==='neighborhood-guard'&&sp.asset==='ambient-M1'||target.id.endsWith('cat')&&sp.asset.startsWith('neighborhood-cat-'))return full;
 }
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
  ctx.save();ctx.globalAlpha=.96;ctx.shadowColor=style.shadow;ctx.shadowBlur=style.blur;
  ctx.drawImage(canvas,left,top,canvas.width*px,canvas.height*py);ctx.restore();
  drawn.push({node:node?.name||null,asset:sp.asset,region:rect});
 }
 return {begin,paint,snapshot:()=>({target:target?.id||null,drawn,cacheSize:cache.size})};
}
W.LunaInteractionGlow={create,region,style};
})(window);
