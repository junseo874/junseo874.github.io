/* Resource tests own one browser-history entry and never exit into game lobbies. */
(function(W){
'use strict';
function create({frame,isOpen,open,close}){
 const owner='review-'+Date.now()+'-'+Math.random(),key='resourceTest';let pending=null,resolvePending;
 if(history.state?.[key]){const state={...history.state};delete state[key];history.replaceState(state,'');}
 function enter(test){const state={...history.state,[key]:{owner,test}};if(history.state?.[key]?.owner===owner)history.replaceState(state,'');else history.pushState(state,'');}
 function leave(){if(pending||history.state?.[key]?.owner!==owner)return;pending=new Promise(resolve=>{resolvePending=resolve;});history.back();}
 W.addEventListener('popstate',e=>{
  const ownClose=!!pending,resolve=resolvePending;pending=null;resolvePending=null;
  if(!ownClose){if(e.state?.[key]?.owner===owner)open(e.state[key].test);else if(isOpen())close(true);}
  resolve?.();
 });
 const f=frame.contentWindow;
 f.document.addEventListener('click',e=>{
  if(!isOpen())return;const b=e.target.closest('button,a,[data-act],[data-campaign],[data-outside-action]');if(!b||b.disabled)return;
  const action=b.dataset.act,campaign=b.dataset.campaign,outside=b.dataset.outsideAction;
  const exit=['prepBack','closeRecipe','cancelCraft','miniExit','miniLobby','miniBar','setup'].includes(action)||['picker','exit-run','developer'].includes(campaign)||outside==='exit'||b.id==='campaign-developer-back';
  if(exit){e.preventDefault();e.stopImmediatePropagation();close(false);}
 },true);
 // Browser history shortcuts work even while keyboard focus is inside the game.
 f.addEventListener('keydown',e=>{if(isOpen()&&e.altKey&&e.code==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();close(false);}},true);
 return{enter,leave,get pending(){return pending;}};
}
W.ResourceReviewNavigation={create};
})(window);
