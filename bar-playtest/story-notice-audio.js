/* message_01.wav: Sci-Fi UI SFX Free by heyheythere, CC BY 4.0.
 * License: audio/message_01-LICENSE.txt. One cue on appearance, not while queued. */
(function(W){
'use strict';
const url=new URL('audio/message_01.wav',document.currentScript.src);
let context=null,buffer=null,loading=null,generation=0,lastAt=-Infinity;
const voices=new Set();
async function prepare(){
 try{
  if(!context){const Context=W.AudioContext||W.webkitAudioContext;if(!Context)return;context=new Context();}
  if(context.state==='suspended')void context.resume().catch(()=>{});
  if(!buffer&&!loading)loading=(async()=>{
   const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
   buffer=await context.decodeAudioData(await response.arrayBuffer());
  })().catch(error=>{console.warn('Notice sound unavailable:',error.message);}).finally(()=>{loading=null;});
  if(loading)await loading;
 }catch(error){console.warn('Notice sound could not start:',error.message);}
}
async function play(isCurrent=()=>true){
 const token=generation;
 if(document.hidden||W.LunaSfx?.volume===0)return;
 await prepare();
 // Never play a stale notification after loading, closing a preview or resume.
 if(token!==generation||!isCurrent()||document.hidden||!buffer||context.state!=='running'||W.LunaSfx?.volume===0)return;
 const now=context.currentTime;
 // People and event lanes can appear in the same frame. One cue is enough;
 // stacking identical samples here would just double their loudness.
 if(now-lastAt<.09)return;
 lastAt=now;
 const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
 gain.gain.value=.65;source.connect(gain);gain.connect(W.LunaSfx.output(context));voices.add(source);
 source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();
}
function stop(){generation++;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
W.LunaStoryNoticeAudio={play,stop,get ready(){return !!buffer&&context?.state==='running';}};
})(window);
