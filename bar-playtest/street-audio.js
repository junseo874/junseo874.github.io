(function(global){
'use strict';
const key='luna.street.ambience.volume.v1',base=document.currentScript.src;
const track=(file)=>({url:new URL('audio/ambience/'+file,base),gain:null,buffer:null,source:null,pending:null,failed:false,level:0,target:0});
const city=track('street-loop.ogg'),rain=track('rain-loop.ogg'),tracks=[city,rain];
let volume=.55,context=null,unlocked=false,previous=0,away=false;
try{const raw=localStorage.getItem(key),value=raw===null?null:JSON.parse(raw);if(typeof value==='number'&&Number.isFinite(value))volume=Math.max(0,Math.min(1,value));}catch{}
function wanted(){
 const outside=global.outsidePlaytest,campaign=global.lunaCampaign,m=outside?.model;
 if(away||document.hidden||!outside?.active||outside.loading||outside.loadError||m?.scene!=='street')return 0;
 const view=campaign?.view;
 const menu=view==='options'&&['game','developer'].includes(campaign.resumeView);
 if(campaign?.blocking&&!menu)return 0;
 let speaking=!!m.story?.speech?.line;
 if(!speaking)for(const story of m.backgroundStory?.channels?.values()||[]){const a=story.view()?.anchor;if(a&&Math.abs(a.x-m.x)<4&&Math.abs(a.y-m.y)<1.6){speaking=true;break;}}
 return volume*(menu||m.paused||outside.devConsoleOpen ? .45 : speaking ? .65 : 1);
}
function stop(t){if(t.source){try{t.source.stop();}catch{}t.source.disconnect();t.source=null;}}
async function prepare(t){
 if(!context||t.buffer||t.pending||t.failed)return;
 t.pending=(async()=>{try{const response=await fetch(t.url);if(!response.ok)throw Error('HTTP '+response.status);t.buffer=await context.decodeAudioData(await response.arrayBuffer());}catch(error){t.failed=true;console.warn('Street ambience unavailable:',t.url.pathname,error.message);}finally{t.pending=null;}})();
 await t.pending;
}
function unlock(e){
 if(!e.isTrusted||e.repeat)return;
 unlocked=true;away=false;
 try{
  if(!context){const Context=global.AudioContext||global.webkitAudioContext;if(!Context)return;context=new Context();for(const t of tracks){t.gain=context.createGain();t.gain.gain.value=0;t.gain.connect(global.LunaSfx.output(context));}}
  if(context.state==='suspended')context.resume().catch(()=>{});
 }catch{}
}
function frame(now){
 const dt=previous?Math.min(.1,(now-previous)/1000):0;previous=now;city.target=wanted();
 // Share the exact visual weather rule, including indoor/QA exclusion. City ambience stays underneath.
 rain.target=global.LunaOutsideRain?.enabled(global.outsidePlaytest?.model)?city.target*.85:0;
 for(const t of tracks){
  if(unlocked&&t.target>0){void prepare(t);if(t.buffer&&!t.source&&context?.state==='running'){t.source=context.createBufferSource();t.source.buffer=t.buffer;t.source.loop=true;t.source.connect(t.gain);t.source.start();}}
  // Real-time envelopes remain independent of paused game clocks; decoding starts from silence.
  const destination=t.source?t.target:0;
  t.level+=(destination-t.level)*(1-Math.exp(-dt/(destination>t.level?(t===rain?.7:.45):(t===rain?.35:.24))));
  if(t.gain)t.gain.gain.value=t.level;
  if(t.target===0&&t.level<.0005){t.level=0;if(t.gain)t.gain.gain.value=0;stop(t);}
 }
 requestAnimationFrame(frame);
}
function silence(){away=true;for(const t of tracks){t.level=0;t.target=0;if(t.gain)t.gain.gain.value=0;stop(t);}}
function setVolume(value){
 if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));
 if(volume===0)for(const t of tracks){t.level=0;t.target=0;if(t.gain)t.gain.gain.value=0;stop(t);}
 try{localStorage.setItem(key,JSON.stringify(volume));}catch{}
 document.querySelectorAll('[data-street-volume]').forEach(el=>{el.value=Math.round(volume*100);el.parentElement.querySelector('output').textContent=el.value+'%';});
}
function settingsHTML(lang='ko'){
 return '<label class="street-audio-setting"><span>'+(lang==='en'?'Street ambience':'외부 거리 환경음')+'</span><input aria-label="'+(lang==='en'?'Street ambience volume':'외부 거리 환경음 음량')+'" type="range" min="0" max="100" step="1" data-street-volume value="'+Math.round(volume*100)+'"><output>'+Math.round(volume*100)+'%</output></label>';
}
global.addEventListener('pointerdown',unlock,true);global.addEventListener('keydown',unlock,true);
global.addEventListener('blur',silence);global.addEventListener('focus',()=>{away=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();else away=false;});
document.addEventListener('input',e=>{if(e.target.matches('[data-street-volume]'))setVolume(Number(e.target.value)/100);},true);
const status=t=>({ready:!!t.buffer,playing:!!t.source,level:t.level,target:t.target,failed:t.failed,duration:t.buffer?.duration||0});
global.LunaStreetAudio={settingsHTML,setVolume,get volume(){return volume;},get state(){return{...status(city),rain:status(rain)};}};
requestAnimationFrame(frame);
})(window);
