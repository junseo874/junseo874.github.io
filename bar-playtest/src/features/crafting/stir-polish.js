(function(){
'use strict';
window.LunaStirPolish=function({g,ui}){
 let audio=null,active=null,voice=null,buffer=null,decodeJob=null,lastTime=performance.now();
 const voices=new Set(),states=new WeakMap();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const raw=fetch(new URL('assets/audio/effects/stir_02_loop.wav',document.baseURI))
  .then(r=>r.ok?r.arrayBuffer():null).catch(()=>null);
 function unlockAudio(){
  if(ui.gimmickAudio===false)return;
  try{
   audio??=new(window.AudioContext||window.webkitAudioContext)();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   decodeJob??=raw.then(bytes=>bytes && audio.decodeAudioData(bytes)).then(decoded=>{buffer=decoded;})
    .catch(()=>console.warn('Stir sound unavailable'));
  }catch{}
 }
 function stop(immediate=false){
  if(immediate){for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}voices.clear();voice=null;return;}
  const v=voice;if(!v)return;voice=null;
  const now=audio.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(v.gain.gain.value,now);v.gain.gain.linearRampToValueAtTime(0,now+.08);
  v.source.stop(now+.085);
 }
 function start(){
  if(voice||!audio||audio.state!=='running'||!buffer)return;
  const v={source:audio.createBufferSource(),gain:audio.createGain()};
  v.source.buffer=buffer;v.source.loop=true;v.source.connect(v.gain);v.gain.connect(window.LunaSfx.output(audio));
  v.gain.gain.setValueAtTime(0,audio.currentTime);v.gain.gain.linearRampToValueAtTime(window.LunaSfx.level("stir2"),audio.currentTime+.015);
  v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();voices.delete(v);if(voice===v)voice=null;};
  voice=v;voices.add(v);v.source.start();
 }
 function sync(root){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  const s=g.gimmick,screen=root.querySelector('.stir-screen');
  if(g.screen!=='gimmick'||s?.type!=='stir'||!screen){stop(true);active=null;return;}
  if(active!==s){stop(true);active=s;}
  let state=states.get(s);
  if(!state){state={target:0,attempts:0,stepAge:1,ringAge:1,ok:true,angle:0};states.set(s,state);}
  const paused=g.isPaused(),fresh=s.spoonTarget>state.target;
  if(!paused){
   state.stepAge+=dt;state.ringAge+=dt;
   if(fresh)state.stepAge=0;
   state.angle+=s.swirlSpeed*dt;
   if(s.attempts>state.attempts){state.ringAge=0;state.ok=!!s.outcomes.at(-1);state.message=s.message;}
  }
  state.target=s.spoonTarget;state.attempts=s.attempts;
  if(paused||ui.gimmickAudio===false)stop(true);
  else if(s.stirMotionPending>0||state.stepAge<.44){if(fresh)start();}
  else stop();
  screen.dataset.stirAudioReady=String(!!buffer);
  screen.dataset.stirAudioPlaying=String(!!voice);
  const hit=Math.max(0,1-state.stepAge/.22),ring=Math.max(0,1-state.ringAge/.45);
  screen.style.setProperty('--stir-hit',hit.toFixed(3));
  screen.style.setProperty('--stir-round',ring.toFixed(3));
  screen.style.setProperty('--stir-color',state.ok?'#95f6e4':'#eb909a');
  screen.classList.toggle('stir-miss',!state.ok&&ring>0);
  const feedback=screen.querySelector('[data-stir-feedback]');
  if(feedback){
   const fade=state.ok?0:Math.max(0,1-state.ringAge/.65);
   const message=fade?(state.message==='너무 빨라..'?'너무 빨라..':'MISS'):'';
   if(feedback.textContent!==message)feedback.textContent=message;
   feedback.style.opacity=fade.toFixed(3);
   feedback.style.transform='translate(-50%,'+(reduced.matches?0:-state.ringAge*16)+'px)';
  }
  for(const el of screen.querySelectorAll('.mix-direction'))el.classList.toggle('stir-hit',hit>0&&el.dataset.id===['KeyW','KeyD','KeyS','KeyA'][s.stirPos]);
  const layer=screen.querySelector('[data-stir-polish]');
  if(layer){
   const swirl=reduced.matches?0:Math.min(1,s.swirlSpeed/280)*.25;
   let html=swirl?'<g transform="rotate('+state.angle.toFixed(2)+' 100 100)" opacity="'+swirl.toFixed(3)+'"><circle cx="100" cy="100" r="69" fill="none" stroke="#eaffff" stroke-width="1.5" stroke-dasharray="55 89"/><circle cx="100" cy="100" r="61" fill="none" stroke="#d1fffa" stroke-width="1" stroke-dasharray="28 100"/></g>':'';
   if(ring)html+='<circle data-stir-round="'+(state.ok?'good':'miss')+'" cx="100" cy="100" r="'+(reduced.matches?83:78+state.ringAge*22)+'" fill="none" stroke="'+(state.ok?'#8efbe1':'#e78c97')+'" stroke-width="2" opacity="'+ring+'"/>';
   layer.innerHTML=html;
  }
 }
 return {sync,unlockAudio};
};
})();
