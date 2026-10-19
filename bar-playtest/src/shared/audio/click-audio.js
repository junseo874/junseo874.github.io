/* Shared button click cue. User-supplied click_clean.wav is kept unchanged. */
(function(W){
 'use strict';
 const url=new URL('assets/audio/effects/click_clean.wav',new URL('../../../',document.currentScript.src).href);
 let context,buffer,loading,voice,generation=0;
 async function prepare(){
  try{
   if(!context){const Context=W.AudioContext||W.webkitAudioContext;if(!Context)return;context=new Context();}
   if(context.state==='suspended')void context.resume().catch(()=>{});
   if(!buffer&&!loading)loading=(async()=>{
    const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);
    buffer=await context.decodeAudioData(await r.arrayBuffer());
   })().catch(e=>console.warn('Click sound unavailable:',e.message)).finally(()=>{loading=null;});
   if(loading)await loading;
  }catch(e){console.warn('Click sound could not start:',e.message);}
 }
 function stop(){
  if(!voice)return;const {source,gain}=voice;voice=null;
  const now=context.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+.015);
  try{source.stop(now+.02);}catch{}
 }
 async function play(){
  const token=++generation,at=performance.now();
  if(document.hidden||W.LunaSfx?.volume===0)return;
  await prepare();
  if(token!==generation||document.hidden||W.LunaSfx?.volume===0||performance.now()-at>250||!buffer||context.state!=='running')return;
  stop();const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;gain.gain.value=W.LunaSfx.level('uiClick');source.connect(gain);gain.connect(W.LunaSfx.output(context));
  const active=voice={source,gain};source.onended=()=>{source.disconnect();gain.disconnect();if(voice===active)voice=null;};source.start();
 }
 function buttonFor(target){
  const el=target?.closest?.('button,[role="button"]');
  if(!el||!el.closest('#app,#campaign-root,#outside-root,#campaign-developer-back,#luna-updates')||el.disabled||el.matches(':disabled')||el.closest('[inert],[hidden],[aria-disabled="true"]')||!el.getClientRects().length)return null;
  if(!W.LunaUIAudioPolicy.allows(el,'click'))return null;
  // These are gameplay surfaces, not menu buttons: preserve their own sounds.
  if(el.matches('.outside-speech,.outside-background-speech,.campaign-speech,[data-drag],[data-hold],[data-opening-stage],[data-shake-surface]')||['rhythmHit','gimmickInput','stir'].includes(el.dataset.act))return null;
  return el;
 }
 // Capture before navigation replaces the clicked DOM. A click event handles
 // mouse, touch and native keyboard activation once, without pointerdown doubles.
 document.addEventListener('click',e=>{if(e.button===0&&buttonFor(e.target))void play();},true);
 document.addEventListener('pointerdown',e=>{if(e.button===0)void prepare();},{capture:true,passive:true});
 W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;stop();}});
 W.addEventListener('blur',()=>{generation++;stop();});
 W.LunaClickAudio={get ready(){return !!buffer&&context?.state==='running';}};
})(window);
