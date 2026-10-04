(function(){
'use strict';
// Presentation-only observer: the game remains the sole owner of money.
window.LunaCurrencyView=function(){
 let owner=null,target=0,from=0,elapsed=3,delta=0;
 const duration=.8,lifetime=2.6;
 function value(){const t=Math.min(1,elapsed/duration);return from+(target-from)*(1-Math.pow(1-t,3));}
 return {reset(progress){owner=null;return this.update(progress);},update(progress,dt=0,paused=false){
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
window.LunaCurrencyView.html=function(f,progress,{lang='ko',reducedMotion=false}={}){const L=(ko,en)=>lang==='ko'?ko:en,fmt=n=>Math.round(n).toLocaleString(),active=f.active,spending=active&&f.delta<0,income=active&&f.delta>0,displayed=reducedMotion?progress.money:f.displayed;if(!active)return '';return `<div class="currency-hud ${spending?'currency-spending':income?'currency-income':''}" style="opacity:${f.opacity}" role="status" aria-label="${income?L('수입','Income'):L('차감','Spent')} ${fmt(Math.abs(f.delta))}, ${L('소지금','Balance')} ${fmt(progress.money)}" title="${L('현재 소지금','Current balance')}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><path fill="#96650e" d="M5 0h6v1h2v2h2v2h1v6h-1v2h-2v2h-2v1H5v-1H3v-2H1v-2H0V5h1V3h2V1h2z"/><path fill="#ebaa1d" d="M5 1h5v1h3v3h1v6h-2v2H5v-1H3V9H2V5h1V3h2z"/><path fill="#ffda4c" d="M5 2h5v1h2v2h1v5h-1v2H5v-1H3V5h1V3h1z"/><path fill="#9f6b16" d="M7 3h2v1h2v2H9V5H6v2h4v1h1v3H9v2H7v-2H5V9h2v1h2V9H6V8H5V5h2z"/><path fill="#ffe681" d="M4 3h1v2H4v3H3V5h1z"/></svg><span class="currency-value">${fmt(displayed)}</span>${active?`<span class="currency-delta" aria-hidden="true" style="transform:translateY(${reducedMotion?0:-Math.min(12,f.elapsed*7)}px)">${income?'+':'−'}${fmt(Math.abs(f.delta))}</span>`:''}</div>`;};
})();
