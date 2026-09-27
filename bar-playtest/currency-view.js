(function(){
'use strict';
// Presentation-only observer: the game remains the sole owner of money.
window.LunaCurrencyView=function(){
 let owner=null,target=0,from=0,elapsed=3,delta=0;
 const duration=.8,lifetime=2.6;
 function value(){const t=Math.min(1,elapsed/duration);return from+(target-from)*(1-Math.pow(1-t,3));}
 return {update(progress,dt=0,paused=false){
  const balance=Number(progress.money);
  if(owner!==progress){
   owner=progress;target=from=balance;elapsed=lifetime;delta=0;
  }else{
   if(!paused)elapsed+=Math.min(.1,Math.max(0,dt));
   if(balance!==target){
    const change=balance-target,current=delta&&Math.sign(delta)!==Math.sign(balance-target)?target:value();
    delta=elapsed<lifetime&&Math.sign(delta)===Math.sign(change)?delta+change:change;
    from=current;target=balance;elapsed=0;
   }
  }
  return {displayed:value(),delta,elapsed,active:elapsed<lifetime&&delta!==0,
   opacity:Math.min(1,Math.max(0,(lifetime-elapsed)/.5))};
 }};
};
})();
