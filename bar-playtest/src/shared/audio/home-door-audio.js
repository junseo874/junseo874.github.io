/* User-supplied Mixkit Cupboard soft sliding door, first 0.300 s removed.
 * Source: assets/audio/effects/home-door-SOURCE.txt. Uses the shared effects volume. */
(function(W){
'use strict';
const url=new URL('assets/audio/effects/home-door.wav',new URL('../../../',document.currentScript.src).href);
let context=null,buffer=null,loading=null,voice=null,generation=0;
async function prepare(){
 try{
  if(!context){const Context=W.AudioContext||W.webkitAudioContext;if(!Context)return;context=new Context();}
  if(context.state==='suspended')void context.resume().catch(()=>{});
  if(!buffer&&!loading)loading=(async()=>{
   const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);
   buffer=await context.decodeAudioData(await response.arrayBuffer());
  })().catch(error=>console.warn('Home door sound unavailable:',error.message)).finally(()=>{loading=null;});
  if(loading)await loading;
 }catch(error){console.warn('Home door sound could not start:',error.message);}
}
async function play(isCurrent=()=>true){
 const token=++generation,requestedAt=performance.now();
 if(document.hidden||W.LunaSfx?.volume===0)return;
 await prepare();
 if(token!==generation||!isCurrent()||performance.now()-requestedAt>500||document.hidden||!buffer||context.state!=='running'||W.LunaSfx?.volume===0)return;
 if(voice){try{voice.stop();}catch{}}
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=buffer;gain.gain.value=.48;
 source.connect(gain);gain.connect(W.LunaSfx.output(context));voice=source;
 source.onended=()=>{source.disconnect();gain.disconnect();if(voice===source)voice=null;};
 source.start();
}
function stop(){generation++;if(voice){try{voice.stop();}catch{}voice=null;}}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
W.addEventListener('blur',stop);W.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
W.LunaHomeDoorAudio={play,stop,get ready(){return !!buffer&&context?.state==='running';},get playing(){return !!voice;}};
})(window);
