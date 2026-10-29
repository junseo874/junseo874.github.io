// Project the measured bubble, then keep its border inside the game viewport.
// Offset the authored tail independently so it still points to the speaker.
(function(W){
'use strict';
function place(el,{x,y,scale=1,gap=0,below=false}){
 el.dataset.worldSpeech='true';
 // Use the projected (unclamped) speaker, not the clamped bubble position.
 // Recompute every frame so camera movement also restores the central tail.
 const direction=x<0?'left':x>1280?'right':'center';
 if(el.dataset.speechTail!==direction)el.dataset.speechTail=direction;
 const width=el.offsetWidth*scale,height=el.offsetHeight*scale,margin=12;
 const center=Math.max(margin+width/2,Math.min(1280-margin-width/2,x));
 const desired=y+(below?gap:-gap)*scale;
 const edge=below?Math.max(margin,Math.min(720-margin-height,desired)):Math.max(margin+height,Math.min(720-margin,desired));
 el.style.left=center+'px';el.style.top=edge+'px';el.style.bottom='auto';
 el.style.transformOrigin=below?'50% 0%':'50% 100%';
 el.style.transform='translate(-50%, '+(below?'0%':'-100%')+') scale('+scale+')';
 const tail=Math.max(46,Math.min(el.offsetWidth-46,el.offsetWidth/2+(x-center)/scale));
 el.style.setProperty('--tail-x',tail+'px');
}
W.LunaWorldSpeech={place};
})(window);
