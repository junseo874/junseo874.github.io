/* Samho Idle.anim: eight 84×81 cells, 12 FPS, row-major, pivot (.5, .43).
   Standing and speaking share this clock; dialogue never substitutes a blink clip. */
(function(W){'use strict';
function apply(data){
 const node=data.scenes.street.nodes.find(n=>n.name==='Samho');
 data.assets['samho-idle']={src:'assets/outside/samho-idle.png',w:252,h:243,source:'Samho Idle.anim / samho-IDLE_Sheet.png (original bytes)'};
 const frames=Array.from({length:8},(_,i)=>({...node.sprite,asset:'samho-idle',x:i%3*84,y:Math.floor(i/3)*81,name:'samho-IDLE_Sheet_'+i}));
 data.animations.samhoIdle={fps:12,frames};node.sprite=frames[0];
}
function frame(time){const a=W.LUNA_OUTSIDE_DATA.animations.samhoIdle;return a.frames[Math.floor(Math.max(0,time)*a.fps)%a.frames.length];}
W.LunaSamhoAnimation={apply,frame};if(W.LUNA_OUTSIDE_DATA)apply(W.LUNA_OUTSIDE_DATA);
})(typeof window==='undefined'?globalThis:window);
