(function(){
'use strict';
window.LunaShakePolish=function({g,D,ui}){
 let audio=null,active=null,selection=null;const voices=new Map(),buffers=new Map(),seen=new WeakMap(),loading=new Map();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 // Fetch both tiny WAVs in advance; decoding/resume happens only after user input.
 const bytes=new Map([1,2].map(id=>[id,fetch(new URL('audio/shaker_0'+id+'_hit.wav',document.baseURI)).then(r=>{if(!r.ok)throw Error('Shaker audio '+r.status);return r.arrayBuffer();}).catch(()=>null)]));
 function prepare(id){
  if(!audio||buffers.has(id)||loading.has(id))return;
  loading.set(id,bytes.get(id).then(raw=>{if(!raw)throw Error('Missing shaker recording');return audio.decodeAudioData(raw.slice(0));}).then(b=>{buffers.set(id,b);}).catch(()=>{console.warn('Shaker sound '+id+' unavailable');}));
 }
 function unlockAudio(){if(ui.gimmickAudio===false)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});prepare(1);prepare(2);}catch{}}
 function stop(channel){for(const [key,v] of voices){if(channel&&key!==channel)continue;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();voices.delete(key);}}
 // Keep the quiet failure cue; successful hits use only the selected real recording.
 function missBuffer(){
  if(buffers.has('miss'))return buffers.get('miss');
  const b=audio.createBuffer(1,Math.ceil(audio.sampleRate*.08),audio.sampleRate),out=b.getChannelData(0);let seed=1637,low=0;
  for(let i=0;i<out.length;i++){const t=i/audio.sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;low+=.14*(noise-low);out[i]=(.16*Math.sin(2*Math.PI*175*t)+.08*low)*Math.exp(-65*t)*Math.min(1,t/.001);}
  buffers.set('miss',b);return b;
 }
 function play(effect){
  if(ui.gimmickAudio===false||!audio||audio.state!=='running')return;
  const channel=effect.ok?'ice':'hit',b=effect.ok?buffers.get(Number(ui.shakeSound)||1):missBuffer();
  // Never replay an old input after loading finishes, or fall back to the discarded synthetic success sound.
  if(!b)return;
  stop(channel);
  const current={gain:audio.createGain(),source:audio.createBufferSource()};voices.set(channel,current);
  current.gain.gain.value=.65;current.gain.connect(audio.destination);current.source.buffer=b;current.source.connect(current.gain);
  current.source.onended=()=>{current.source.disconnect();current.gain.disconnect();if(voices.get(channel)===current)voices.delete(channel);};
  current.source.start();
 }
 const at=(x,y)=>[55+x*118,42+y*118];
 function point(s,lag=0){
  const m=window.LunaCore.MIX,time=Math.max(0,s.elapsed-m.delay-lag),i=Math.floor(time),t=time-i,a=m.points[m.route[i%6]],b=m.points[m.route[(i+1)%6]];
  return at(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
 }
 function burst(e){
  const [x,y]=at(e.x,e.y),t=e.age,fade=Math.max(0,1-t/.55),radius=reduced.matches?16:9+t*80,color=e.ok?'#a3ffec':'#ef9e9c';
  let parts='<circle r="'+radius+'" fill="none" stroke="'+color+'" stroke-width="'+(2.6*fade)+'"/>';
  if(e.ok){
   parts+='<circle r="'+(7+t*25)+'" fill="#eafff8" opacity="'+Math.max(0,1-t*8)+'"/>';
   for(let i=0;i<(reduced.matches?0:10);i++){const angle=i*Math.PI/5+e.id*.43,d=12+t*(45+(i%3)*30),px=Math.cos(angle)*d,py=Math.sin(angle)*d+t*t*60;
    parts+='<path d="M-2 0L0 -4L2 0L0 4Z" fill="'+(i%3?color:'#ffe6a8')+'" transform="translate('+px.toFixed(2)+' '+py.toFixed(2)+') rotate('+(i*36+t*150)+')"/>';}
  }else parts+='<path d="M-6 -6L6 6M6 -6L-6 6" stroke="'+color+'" stroke-width="2"/>';
  return '<g data-shake-burst="'+e.id+'" transform="translate('+x+' '+y+')" opacity="'+fade+'">'+parts+'</g>';
 }
 function sync(root){
  const s=g.gimmick,screen=root.querySelector('.shake-screen');
  if(!screen||g.screen!=='gimmick'||s?.type!=='shake'){stop();active=null;return;}
  if(active!==s){stop();active=s;}
  const selected=Number(ui.shakeSound)||1;
  if(selection!==selected){stop('ice');selection=selected;}
  screen.dataset.shakeSound=selected;
  screen.dataset.shakeAudioReady=String(buffers.has(selected));
  const status=screen.querySelector('[data-shake-audio-status]');
  if(status)status.textContent=ui.gimmickAudio===false?(g.lang==='ko'?'음소거':'Muted'):audio&&!buffers.has(selected)?(g.lang==='ko'?'음원 준비 중 / 로드 실패 시 새로고침':'Loading / reload if unavailable'):'';
  const effects=s.shakeEffects||[],last=effects.at(-1);
  if(g.isPaused()||ui.gimmickAudio===false)stop();
  if(!g.isPaused()){
   const previous=seen.get(s)||0;
   // If several inputs landed before this frame, only the newest visible gesture is audible.
   if(last&&last.id>previous){seen.set(s,last.id);if(last.age<.12)play(last);}
  }
  const marker=screen.querySelector('[data-shake-marker]'),p=at(...s.pathPoint);
  if(marker){marker.setAttribute('cx',p[0]);marker.setAttribute('cy',p[1]);}
  const trail=screen.querySelector('[data-shake-trail]');
  if(trail)trail.innerHTML=s.started&&!reduced.matches?[.025,.055,.09,.13].map((lag,i)=>{const v=point(s,lag);return '<circle cx="'+v[0]+'" cy="'+v[1]+'" r="'+(6-i)+'" fill="#ef69b3" opacity="'+(.3-i*.06)+'"/>';}).join(''):'';
  const layer=screen.querySelector('[data-shake-fx]');
  if(layer)layer.innerHTML=effects.map(burst).join('');
  const nearest=window.LunaCore.MIX.nearest(s);
  for(const node of screen.querySelectorAll('[data-shake-node]'))node.classList.toggle('in-range',s.started&&!s.completed&&node.dataset.shakeNode===nearest?.id);
  const impact=last?.ok?Math.max(0,1-last.age/.25):0;
  screen.style.setProperty('--shake-impact',impact.toFixed(3));
  const offset=!reduced.matches&&last?.ok?Math.sin(last.age*48)*Math.exp(-last.age*19)*2.5:0;
  screen.style.setProperty('--shake-kick',offset.toFixed(3)+'px');
  // Preserve exact source clip frames, but submit the rendered frame with the same RAF as effects.
  const art=D.assets.mix_shake_motion;
  for(const el of screen.querySelectorAll('[data-motion-frame]')){
   el.dataset.motionFrame=s.motionFrame;
   el.style.backgroundPosition=s.motionFrame/(art.frames-1)*100+'% 0px';
  }
 }
 return {sync,unlockAudio};
};
})();
