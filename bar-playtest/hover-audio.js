/* hover_holo_01.wav — Sci-Fi UI SFX Free by heyheythere, CC BY 4.0.
 * Original file unchanged; see audio/hover_holo_01-LICENSE.txt. */
(function(W){
'use strict';
const url=new URL('audio/hover_holo_01.wav',document.currentScript.src);
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
 source.buffer=buffer;gain.gain.value=1;source.connect(gain);gain.connect(W.LunaSfx.output(context));
 const playing=voice={source,gain};
 source.onended=()=>{source.disconnect();gain.disconnect();if(voice===playing)voice=null;};source.start();
}
function bind(root,{canHoverItem}){
 function keyFor(target){
  const el=target?.closest?.('[data-hover-item],.guest-card[data-act="dossier"]');
  if(!el||!root.contains(el)||el.disabled||el.closest('[inert]'))return null;
  if(el.dataset.hoverItem)return canHoverItem(el.dataset.hoverItem)?'item:'+el.dataset.hoverItem:null;
  return W.barGame?.overlay==='dossier'?'guest:'+el.dataset.id:null;
 }
 // Stable logical IDs survive the game's HTML redraws and nested portrait/image
 // elements. No pointerout reset: replacing a hovered DOM node is not a re-entry.
 const pointer=e=>{if(e.pointerType!=='touch')void enter(keyFor(e.target));};
 document.addEventListener('pointerover',pointer,true);
 document.addEventListener('pointermove',pointer,true);
 document.addEventListener('focusin',e=>{void enter(keyFor(e.target));},true);
 document.documentElement.addEventListener('pointerleave',()=>{void enter(null);});
}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){void enter(null);fadeVoice();}});
W.addEventListener('blur',()=>{void enter(null);fadeVoice();});
W.LunaHoverAudio={bind,get ready(){return !!buffer&&context?.state==='running';}};
})(window);
