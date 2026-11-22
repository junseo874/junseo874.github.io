/* Samho Idle.anim: eight 84×81 cells, 12 FPS, row-major, pivot (.5, .43).
   Standing and speaking share this clock; dialogue never substitutes a blink clip. */
(function(W){'use strict';
function apply(data){
 const node=data.scenes.street.nodes.find(n=>n.name==='Samho');
 const folder='assets/01.ArtResources/01.Characters/02.Outside/03.Samho/Legacy/';
 for(const [animation,asset,file,prefix] of [
  ['samhoIdle','samho-idle','samho_IDLE_Sheet.png','samho-IDLE_Sheet_'],
  ['samhoRun','samho-run','samho_RUN3_Sheet.png','samho_RUN3_Sheet_']
 ]){
  data.assets[asset]={src:folder+file,w:252,h:243,source:file};
  const frames=Array.from({length:8},(_,i)=>({...node.sprite,asset,x:i%3*84,y:Math.floor(i/3)*81,name:prefix+i}));
  data.animations[animation]={fps:12,frames};
 }
 node.sprite=data.animations.samhoIdle.frames[0];
}
function frame(time,moving=false){const a=W.LUNA_OUTSIDE_DATA.animations[moving?'samhoRun':'samhoIdle'];return a.frames[Math.floor(Math.max(0,time)*a.fps)%a.frames.length];}
// All eight supplied idle cells end their visible soles at pixel 74, not 81.
// Seat visible pixels on the road without scaling the transparent cell padding.
function groundOrigin(sp,scale,ground){return ground-((1-sp.pivot.y)*sp.h-74)/sp.ppu*scale;}
W.LunaSamhoAnimation={apply,frame,groundOrigin};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
