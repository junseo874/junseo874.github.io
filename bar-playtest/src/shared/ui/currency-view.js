(function(){
'use strict';
// Presentation-only observer: the game remains the sole owner of money.
function unitLossHTML(f,reduced){
 // Reuse the original money-delta anchor, typography and upward motion.
 // Each millilitre adds a new overlapping -1, never a lane or grouped sum.
 return '<span class="currency-unit-losses" aria-hidden="true">'+(reduced?(f.unitLosses.length?'<span class="currency-delta currency-unit-loss">−1</span>':''):f.unitLosses.map(p=>`<span class="currency-delta currency-unit-loss" data-loss-id="${p.id}" style="opacity:${Math.min(1,(.75-p.age)*4)};transform:translateY(${-Math.min(12,p.age*7)}px)">−1</span>`).join(''))+'</span>';
}
window.LunaCurrencyView=function(){
 let owner=null,target=0,from=0,elapsed=3,delta=0,revision=0,waste=0,pulseTime=0,pulseId=0,unitLosses=[],unitSpending=false;
 const duration=.8,lifetime=2.6;
 function value(){const t=Math.min(1,elapsed/duration);return from+(target-from)*(1-Math.pow(1-t,3));}
 return {reset(progress){owner=null;return this.update(progress);},update(progress,dt=0,paused=false){
  const balance=Number(progress.money);
  if(owner!==progress){
   owner=progress;target=from=balance;elapsed=lifetime;delta=0;revision++;waste=progress.pourWaste||0;pulseTime=0;unitLosses=[];unitSpending=false;
  }else{
   if(!paused){const step=Math.min(.1,Math.max(0,dt));elapsed+=step;pulseTime+=step;}
   unitLosses=unitLosses.filter(p=>pulseTime-p.at<.75);
   if(balance!==target){
    const change=balance-target,current=delta&&Math.sign(delta)!==Math.sign(balance-target)?target:value();
    const newWaste=Math.max(0,(progress.pourWaste||0)-waste);waste=progress.pourWaste||0;
    unitSpending=newWaste>0&&change===-newWaste;
    if(unitSpending){for(let i=0;i<newWaste;i++)unitLosses.push({id:++pulseId,at:pulseTime});unitLosses=unitLosses.slice(-256);}else unitLosses=[];
    delta=elapsed<lifetime&&Math.sign(delta)===Math.sign(change)?delta+change:change;
    from=current;target=balance;elapsed=0;
    const changeRevision=++revision;
    if(!paused&&!unitSpending)window.LunaCurrencyAudio?.play(()=>owner===progress&&revision===changeRevision);
   }
  }
  return {displayed:value(),delta,elapsed,unitSpending,unitLosses:unitLosses.map(p=>({id:p.id,age:pulseTime-p.at})),active:elapsed<lifetime&&delta!==0,
   opacity:Math.min(1,Math.max(0,(lifetime-elapsed)/.5))};
 }};
};
window.LunaCurrencyView.html=function(f,progress,{lang='ko',reducedMotion=false}={}){const L=(ko,en)=>lang==='ko'?ko:en,fmt=n=>Math.round(n).toLocaleString(),active=f.active,spending=active&&f.delta<0,income=active&&f.delta>0,displayed=reducedMotion?progress.money:f.displayed;if(!active)return '';return `<div class="currency-hud ${spending?'currency-spending':income?'currency-income':''}" style="opacity:${f.opacity};--currency-digits:${fmt(displayed).length}" role="status" aria-label="${income?L('수입','Income'):L('차감','Spent')} ${fmt(Math.abs(f.delta))}, ${L('소지금','Balance')} ${fmt(progress.money)}" title="${L('현재 소지금','Current balance')}"><img class="currency-art" src="${window.LUNA_DATA?.assets?.money?.src||'assets/ui/imported/money.png'}" width="542" height="108" alt="" aria-hidden="true" draggable="false"><span class="currency-value">${fmt(displayed)}</span>${f.unitSpending?unitLossHTML(f,reducedMotion):active?`<span class="currency-delta" aria-hidden="true" style="transform:translateY(${reducedMotion?0:-Math.min(12,f.elapsed*7)}px)">${income?'+':'−'}${fmt(Math.abs(f.delta))}</span>`:''}</div>`;};
})();
