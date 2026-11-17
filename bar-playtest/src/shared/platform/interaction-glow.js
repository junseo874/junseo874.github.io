/* Runtime sprite-alpha outlines. Original art and shared atlases stay unchanged. */
(function(W){
'use strict';
const style=Object.freeze({color:'#4bdaff',shadow:'#19caff',blur:9});
// These targets have dedicated sprites. Use the current draw's frame, including
// the uncovered sofa, and let later foreground layers occlude the outline.
const propNodes={tv:'IntractObjects',sofa:'home-bedding',exit:'Room_Entrance',home:'residence-home-door'};
function region(target,node,sp,x,y,model){
 if(!target||sp.noInteractionGlow)return null;
 const name=node?.name,full=[0,0,sp.w,sp.h];
 const prop=target.nodeName||propNodes[target.id];
 if(prop&&name===prop)return full;
 if(target.id==='bar'&&name==='Bar Spawn Point')return [2,15,34,51];
 // The supplied Bubi sheets have real alpha. Highlight the current cell,
 // never the retired baked carton or the empty background replacement.
 if(['neighborhood-box','neighborhood-cat','neighborhood-home-cat'].includes(target.id)&&sp.asset.startsWith('bubi-'))return full;
 // Unity sprite children can be offset from the interaction root. Identify
 // those actors by role rather than comparing their rendered pivot to the root.
 const engineRole=sp.engineActor?.role;
 if(['neighborhood-repair','neighborhood-guard','neighborhood-boss','neighborhood-cat','neighborhood-home-cat'].includes(target.id)&&(engineRole===target.actor||Math.abs(x-target.x)<.01&&Math.abs(y-target.y)<.01)){
  const kind=W.LunaOutsideAmbient.roleKinds[target.actor||target.id.slice('neighborhood-'.length)];
  if(kind&&sp.asset==='ambient-'+kind||target.id.endsWith('cat')&&sp.asset.startsWith('neighborhood-cat-'))return full;
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
 if(target.id==='day2-thug-information'&&sp.asset==='ambient-'+W.LunaOutsideAmbient.roleKinds['day2-corridor-thug']&&(engineRole==='thug'||Math.abs(x-target.x)<.01&&Math.abs(y-(target.y-.274))<.01))return full;
 return null;
}
function create(){
 const cache=new Map();let target=null,model=null,drawn=[];
 function begin(next,m){target=next;model=m;drawn=[];}
 function mask(image,sp,rect){
  const [x,y,w,h]=rect,key=[sp.asset,sp.x+x,sp.y+y,w,h].join(':');
  if(cache.has(key))return cache.get(key);
  const pad=3,base=document.createElement('canvas');base.width=w;base.height=h;
  const b=base.getContext('2d');
  b.drawImage(image,sp.x+x,sp.y+y,w,h,0,0,w,h);
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
