/* message_01.wav and access_granted_01.wav: Sci-Fi UI SFX Free by heyheythere, CC BY 4.0.
 * License: assets/audio/effects/message_01-LICENSE.txt. One cue on appearance, not while queued. */
(function(W){
'use strict';
const cues={notice:{url:new URL('assets/audio/effects/message_01.wav',new URL('../../../',document.currentScript.src).href)},'goal-complete':{url:new URL('assets/audio/effects/access_granted_01.wav',new URL('../../../',document.currentScript.src).href)}};
let context=null,generation=0;
const voices=new Set();
async function prepare(){
 try{
  if(!context){const Context=W.AudioContext||W.webkitAudioContext;if(!Context)return;context=new Context();}
  if(context.state==='suspended')void context.resume().catch(()=>{});
  await Promise.all(Object.values(cues).map(async cue=>{
   if(!cue.buffer&&!cue.loading)cue.loading=(async()=>{
    const response=await fetch(cue.url);if(!response.ok)throw Error('HTTP '+response.status);
    cue.buffer=await context.decodeAudioData(await response.arrayBuffer());
   })().catch(error=>{console.warn('Notice sound unavailable:',error.message);}).finally(()=>{cue.loading=null;});
   if(cue.loading)await cue.loading;
  }));
 }catch(error){console.warn('Notice sound could not start:',error.message);}
}
async function play(isCurrent=()=>true,kind='notice'){
 const cue=cues[kind]||cues.notice;
 const token=generation;
 if(document.hidden||W.LunaSfx?.volume===0)return;
 await prepare();
 // Never play a stale notification after loading, closing a preview or resume.
 if(token!==generation||!isCurrent()||document.hidden||!cue.buffer||context.state!=='running'||W.LunaSfx?.volume===0)return;
 const now=context.currentTime;
 // People and event lanes can appear in the same frame. One cue is enough;
 // stacking identical samples here would just double their loudness.
 if(now-(cue.lastAt??-Infinity)<.09)return;
 cue.lastAt=now;
 const source=context.createBufferSource(),gain=context.createGain();source.buffer=cue.buffer;
 gain.gain.value=.65;source.connect(gain);gain.connect(W.LunaSfx.output(context));voices.add(source);
 source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start();
}
function stop(){generation++;for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
W.LunaStoryNoticeAudio={play,stop,get ready(){return !!cues.notice.buffer&&context?.state==='running';}};
})(window);
