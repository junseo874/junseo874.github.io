/* Shared UI hover cue: user-supplied hover_clean.wav, imported unchanged. */
(function(W){
'use strict';
const url=new URL('audio/hover_clean.wav',document.currentScript.src);
let context=null,buffer=null,loading=null,activeKey=null,generation=0,voice=null;
async function prepare(){
 try{
  if(!context){const Context=W.AudioContext||W.webkitAudioContext;if(!Context)return;context=new Context();}
  if(context.state==='suspended')void context.resume().catch(()=>{});
  if(!buffer&&!loading)loading=(async()=>{
   const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
   buffer=await context.decodeAudioData(await response.arrayBuffer());
  })().catch(error=>console.warn('Hover sound unavailable:',error.message)).finally(()=>{loading=null;});
  if(loading)await loading;
 }catch(error){console.warn('Hover sound could not start:',error.message);}
}
function fadeVoice(){
 if(!voice)return;const {source,gain}=voice;voice=null;
 gain.gain.cancelScheduledValues(context.currentTime);
 gain.gain.setValueAtTime(gain.gain.value,context.currentTime);
 gain.gain.linearRampToValueAtTime(0,context.currentTime+.015);
 try{source.stop(context.currentTime+.02);}catch{}
}
async function enter(key){
 if(key===activeKey)return;
 activeKey=key;const token=++generation,requestedAt=performance.now();
 if(!key||document.hidden||W.LunaSfx?.volume===0)return;
 await prepare();
 if(token!==generation||document.hidden||performance.now()-requestedAt>250||!buffer||context.state!=='running'||W.LunaSfx?.volume===0)return;
 fadeVoice();
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=buffer;gain.gain.value=W.LunaSfx.level('uiHover');source.connect(gain);gain.connect(W.LunaSfx.output(context));
 const playing=voice={source,gain};
 source.onended=()=>{source.disconnect();gain.disconnect();if(voice===playing)voice=null;};source.start();
}
function bind(root,{canHoverItem}){
 function keyFor(target){
  const el=target?.closest?.('[data-hover-item],.guest-card[data-act="dossier"],button,[role="button"]');
  if(!el||el.disabled||el.matches(':disabled')||el.closest('[inert],[hidden],[aria-disabled="true"]')||!el.getClientRects().length)return null;
  if(!W.LunaUIAudioPolicy.allows(el,'hover'))return null;
  // Dialogue surfaces receive automatic focus on each line; those are not UI
  // menu hovers. Keep dialogue typing/advance sounds separate from this cue.
  if(el.matches('.outside-speech,.outside-background-speech,.campaign-speech'))return null;
  if(el.dataset.hoverItem)return root.contains(el)&&canHoverItem(el.dataset.hoverItem)?'item:'+el.dataset.hoverItem:null;
  if(el.matches('.guest-card[data-act="dossier"]'))return W.barGame?.overlay==='dossier'&&!el.classList.contains('unmet')?'guest:'+el.dataset.id:null;
  const scope=el.closest('#app,#campaign-root,#outside-root,#campaign-developer-back,#luna-updates');
  if(!scope)return null;
  // A structural key survives redraws and ignores changing labels/counters.
  // It also distinguishes separate buttons with the same action or caption.
  const parts=[];for(let node=el;node&&node!==scope;node=node.parentElement)parts.push(node.tagName+':'+Array.prototype.indexOf.call(node.parentElement.children,node));
  return 'button:'+scope.id+':'+parts.reverse().join('/')+':'+(el.dataset.act||el.dataset.campaign||'')+':'+(el.dataset.id||'');
 }
 // Stable logical IDs survive the game's HTML redraws and nested portrait/image
 // elements. No pointerout reset: replacing a hovered DOM node is not a re-entry.
 const pointer=e=>{if(e.pointerType!=='touch')void enter(keyFor(e.target));};
 document.addEventListener('pointerover',pointer,true);
 document.addEventListener('pointermove',pointer,true);
 let choiceNavigationAt=-Infinity;
 document.addEventListener('keydown',e=>{choiceNavigationAt=['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)?performance.now():-Infinity;},true);
 document.addEventListener('pointerdown',()=>{choiceNavigationAt=-Infinity;},true);
 document.addEventListener('focusin',e=>{
  // The dialogue renderer auto-focuses a new choice. That is not a hover.
  const el=e.target.closest?.('button,[role="button"]');
  if(el&&W.LunaUIAudioPolicy.isChoice(el)&&performance.now()-choiceNavigationAt>150)return;
  void enter(keyFor(e.target));
 },true);
 document.documentElement.addEventListener('pointerleave',()=>{void enter(null);});
}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){void enter(null);fadeVoice();}});
W.addEventListener('blur',()=>{void enter(null);fadeVoice();});
W.LunaHoverAudio={bind,get ready(){return !!buffer&&context?.state==='running';}};
})(window);
