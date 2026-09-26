(function(){
'use strict';
window.LunaStirPolish=function({g,ui}){
 let audio=null,active=null,voice=null,selection=null,lastTime=performance.now();
 const buffers=new Map(),jobs=new Map(),voices=new Set(),states=new WeakMap();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const raw=new Map([1,2].map(id=>[id,fetch(new URL('audio/stir_0'+id+'_loop.wav',document.baseURI)).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).catch(()=>null)]));
 function unlockAudio(){
  if(ui.gimmickAudio===false)return;
  try{
   audio??=new(window.AudioContext||window.webkitAudioContext)();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   for(const id of [1,2])if(!jobs.has(id))jobs.set(id,raw.get(id).then(b=>{if(!b)throw Error('Missing stir audio');return audio.decodeAudioData(b.slice(0));}).then(b=>buffers.set(id,b)).catch(()=>console.warn('Stir sound '+id+' unavailable')));
  }catch{}
 }
 function stop(immediate=false){
  if(immediate){for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}voices.clear();voice=null;return;}
  const v=voice;if(!v)return;voice=null;
  const now=audio.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(v.gain.gain.value,now);v.gain.gain.linearRampToValueAtTime(0,now+.08);
  v.source.stop(now+.085);
 }
 function start(id){
  if(voice||!audio||audio.state!=='running'||!buffers.has(id))return;
  const v={source:audio.createBufferSource(),gain:audio.createGain()};
  v.source.buffer=buffers.get(id);v.source.loop=true;v.source.connect(v.gain);v.gain.connect(audio.destination);
  v.gain.gain.setValueAtTime(0,audio.currentTime);v.gain.gain.linearRampToValueAtTime(.65,audio.currentTime+.015);
  v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();voices.delete(v);if(voice===v)voice=null;};
  voice=v;voices.add(v);v.source.start();
 }
 function sync(root){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  const s=g.gimmick,screen=root.querySelector('.stir-screen');
  if(g.screen!=='gimmick'||s?.type!=='stir'||!screen){stop(true);active=null;return;}
  if(active!==s){stop(true);active=s;}
  const selected=Number(ui.stirSound)||1;
  if(selection!==selected){stop(true);selection=selected;}
  let state=states.get(s);
  if(!state){state={target:0,attempts:0,stepAge:1,ringAge:1,ok:true};states.set(s,state);}
  const paused=g.isPaused(),fresh=s.spoonTarget>state.target;
  if(!paused){
   state.stepAge+=dt;state.ringAge+=dt;
   if(fresh)state.stepAge=0;
   if(s.attempts>state.attempts){state.ringAge=0;state.ok=!!s.outcomes.at(-1);}
  }
  state.target=s.spoonTarget;state.attempts=s.attempts;
  if(paused||ui.gimmickAudio===false)stop(true);
  else if(s.stirMotionPending>0){if(fresh)start(selected);}
  else stop();
  screen.dataset.stirSound=selected;
  screen.dataset.stirAudioReady=String(buffers.has(selected));
  screen.dataset.stirAudioPlaying=String(!!voice);
  const status=screen.querySelector('[data-stir-audio-status]');
  if(status)status.textContent=ui.gimmickAudio===false?(g.lang==='ko'?'음소거':'Muted'):audio&&!buffers.has(selected)?(g.lang==='ko'?'음원 준비 중 / 로드 실패 시 새로고침':'Loading / reload if unavailable'):'';
  const hit=Math.max(0,1-state.stepAge/.22),ring=Math.max(0,1-state.ringAge/.45);
  screen.style.setProperty('--stir-hit',hit.toFixed(3));
  screen.style.setProperty('--stir-round',ring.toFixed(3));
  screen.style.setProperty('--stir-color',state.ok?'#95f6e4':'#eb909a');
  for(const el of screen.querySelectorAll('.mix-direction'))el.classList.toggle('stir-hit',hit>0&&el.dataset.id===['KeyW','KeyD','KeyS','KeyA'][s.stirPos]);
  const layer=screen.querySelector('[data-stir-polish]');
  if(layer){
   const swirl=reduced.matches?0:Math.min(1,s.swirlSpeed/280)*.4;
   let html=swirl?'<g transform="rotate('+s.spoonAngle.toFixed(2)+' 100 100)" opacity="'+swirl.toFixed(3)+'"><circle cx="100" cy="100" r="69" fill="none" stroke="#eaffff" stroke-width="1.5" stroke-dasharray="55 89"/><circle cx="100" cy="100" r="61" fill="none" stroke="#d1fffa" stroke-width="1" stroke-dasharray="28 100"/></g>':'';
   if(ring)html+='<circle data-stir-round="'+(state.ok?'good':'miss')+'" cx="100" cy="100" r="'+(reduced.matches?83:78+state.ringAge*22)+'" fill="none" stroke="'+(state.ok?'#8efbe1':'#e78c97')+'" stroke-width="2" opacity="'+ring+'"/>';
   layer.innerHTML=html;
  }
 }
 return {sync,unlockAudio};
};
})();
