/* Only UI feedback is filtered here; typing, ingredient and gameplay SFX stay independent. */
(function(W){
 'use strict';
 const quietActions=new Set(['advance','reask','auto','seat','shelfCategory','shelfPage','tab',
  'service','recipes','craftRecipe','closeRecipe','selectRecipe','togglePrepRecipe','prepBack',
  'remixPreview','remixFavorite','remixFilter','tutorialContinue','tutorialBarContinue','pourTutorialNext',
  'rhythmHit','gimmickInput','stir']);
 const quietRegions='.dialogue-wrap,.outside-speech,.outside-background-speech,.campaign-speech,'+
  '.day0-guide,.day0-seat-legend,.outside-controls-tutorial,.pour-tutorial,.open-tutorial,'+
  '.service-layer,#service-panel,.service-handle,.recipe-list,.prep-recipe,.recipe-toggle,'+
  '[data-drag],[data-hold],[data-opening-stage],[data-shake-surface]';
 function isChoice(el){return el.dataset.act==='choice'||el.dataset.campaign?.startsWith('scene-choice:')||!!el.closest('.choices,.outside-choices');}
 function allows(el,kind){
  const action=el.dataset.act||'';
  // Poster viewing is silent, including the exit button's automatic focus cue.
  if(el.closest('.outside-inspection'))return false;
  if(el.dataset.outsideAction==='interact'&&el.closest('#outside-root')&&W.outsidePlaytest?.model?.near?.id==='wanted-poster')return false;
  if(el.closest('.world-choices'))return false;
  // Choice buttons retain hover feedback, never confirmation clicks. Handle
  // them before speech containers, which may also contain the choice buttons.
  if(isChoice(el))return kind==='hover';
  if(el.closest(quietRegions)||quietActions.has(action)||/tutorial/i.test(action)||el.dataset.outsideAction==='controls-close')return false;
  if(el.closest('#app')&&W.barGame?.screen==='recipe'&&!W.barGame.overlay)return false;
  if(el.closest('#app')&&['service','recipe'].includes(W.barGame?.overlay))return false;
  // Selecting/removing any shelf item is a physical action, not a menu click.
  if(kind==='click'&&(action==='craft'||action==='pick'||action==='pickOpener'||el.hasAttribute('data-hover-item')))return false;
  return true;
 }
 W.LunaUIAudioPolicy={allows,isChoice};
})(window);
