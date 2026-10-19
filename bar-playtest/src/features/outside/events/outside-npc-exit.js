// A local, timed departure: never make the player follow an NPC off camera.
(function(W){
 'use strict';
 const walk=1,fade=.3,speed=.65,duration=walk+fade;
 function sample(elapsed,from,direction=1){
  const t=Math.max(0,Math.min(duration,elapsed));
  const p=Math.max(0,Math.min(1,(t-walk)/fade));
  return {x:from+direction*speed*t,alpha:1-p*p*(3-2*p),done:t>=duration};
 }
 W.LunaOutsideNPCExit=Object.freeze({sample,walk,fade,duration});
})(typeof window==='undefined'?globalThis:window);
