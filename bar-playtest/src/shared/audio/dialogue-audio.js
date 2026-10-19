(function(global){
'use strict';
const KEY='luna.dialogue.sound.v1', versions=['main','low','off'];
const base=new URL('assets/audio/effects/dialogue/',new URL('../../../',document.currentScript.src).href);
let version='low',context=null,loading=null,lastAt=-Infinity,serial=0,previewTimers=[];
const buffers=new Map(),voices=new Set(),controls=new Set();
try{const saved=localStorage.getItem(KEY);if(versions.includes(saved))version=saved;}catch{}
function stop(){
 previewTimers.forEach(clearTimeout);previewTimers=[];
 for(const voice of voices){try{voice.stop();}catch{}}
 voices.clear();
}
async function unlock(){
 try{
  if(!context){const Context=global.AudioContext||global.webkitAudioContext;if(!Context)return;context=new Context();}
  if(context.state==='suspended')await context.resume();
  if(!loading)loading=Promise.all(['main','low'].flatMap(name=>Array.from({length:6},async(_,i)=>{
   const response=await fetch(new URL(name+'-'+(i+1)+'.wav',base));if(!response.ok)throw Error('Dialogue audio '+response.status);
   buffers.set(name+'-'+i,await context.decodeAudioData(await response.arrayBuffer()));
  }))).catch(error=>{loading=null;console.warn('Dialogue audio unavailable:',error.message);});
  await loading;
 }catch(error){console.warn('Dialogue audio could not start:',error.message);}
}
function pulse(soft=false){
 if(version==='off'||document.hidden||controls.size||!context||context.state!=='running'||global.LunaSfx.volume===0)return;
 const now=context.currentTime;if(now-lastAt<.064)return;
 const buffer=buffers.get(version+'-'+(serial%6));if(!buffer)return;
 lastAt=now;serial++;
 const voice=context.createBufferSource(),gain=context.createGain();
 voice.buffer=buffer;gain.gain.value=soft ? .34 : .68;
 voice.connect(gain);gain.connect(global.LunaSfx.output(context));voices.add(voice);
 voice.onended=()=>{voices.delete(voice);voice.disconnect();gain.disconnect();};voice.start();
}
function reveal(text,from,to,soft=false){
 // A frame emits at most one tick. Spaces/punctuation and skipped text never queue audio.
 const start=Math.max(0,Math.floor(from)),end=Math.min(String(text).length,Math.floor(to));
 if(end>start&&/[\p{L}\p{N}]/u.test(String(text).slice(start,end)))pulse(soft);
}
function setVersion(value){
 if(!versions.includes(value))return;
 stop();version=value;lastAt=-Infinity;
 try{localStorage.setItem(KEY,value);}catch{}
 document.querySelectorAll('[data-dialogue-version]').forEach(el=>el.value=value);
 document.querySelectorAll('[data-dialogue-preview]').forEach(el=>el.disabled=value==='off');
}
async function preview(){
 stop();const selected=version;await unlock();if(version!==selected||version==='off'||document.hidden)return;
 lastAt=-Infinity;
 for(const delay of [0,80,160,240,400,480,560])previewTimers.push(setTimeout(()=>pulse(),delay));
}
function settingsHTML(lang='ko'){
 const en=lang==='en';
 return '<div class="dialogue-audio-settings"><label><span>'+(en?'Dialogue sound':'대사 출력음')+'</span><select data-dialogue-version aria-label="'+(en?'Dialogue sound version':'대사 출력음 버전')+'">'+[['main',en?'Version 1 · Original':'버전 1 · 기본음'],['low',en?'Version 2 · Low tone / gain adjusted':'버전 2 · 저음·게인 조정'],['off',en?'Off':'끄기']].map(([id,label])=>'<option value="'+id+'" '+(version===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label><button type="button" data-dialogue-preview '+(version==='off'?'disabled':'')+'>'+(en?'Preview':'미리 듣기')+'</button></div>';
}
document.addEventListener('pointerdown',()=>{void unlock();},{passive:true});
// Observe before campaign/outside handlers consume keyboard events in capture phase.
global.addEventListener('keydown',e=>{
 if(e.key==='Control'||e.code==='ControlLeft'||e.code==='ControlRight'||e.keyCode===17){controls.add(e.code||'Control');stop();}
 if(e.code==='Escape')stop();
 if(!e.repeat)void unlock();
},true);
global.addEventListener('keyup',e=>{controls.delete(e.code);if(e.key==='Control')controls.delete('Control');},true);
global.addEventListener('blur',()=>{controls.clear();stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){controls.clear();stop();}});
document.addEventListener('change',e=>{if(e.target.matches('[data-dialogue-version]'))setVersion(e.target.value);},true);
document.addEventListener('click',e=>{if(e.target.closest('[data-dialogue-preview]')){e.preventDefault();void preview();}},true);
global.LunaDialogueAudio={reveal,setVersion,settingsHTML,preview,stop,unlock,get version(){return version;},get ready(){return buffers.size===12;}};
})(window);
