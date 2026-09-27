(function(){
'use strict';
const KEY='luna.bar.sfx.volume.v1',buses=new Map();
let volume=.8;
try{const raw=localStorage.getItem(KEY),saved=raw===null?null:JSON.parse(raw);if(typeof saved==='number'&&Number.isFinite(saved))volume=Math.max(0,Math.min(1,saved));}catch{}
// Active 50ms-window RMS target -29 dBFS, with peak headroom at -4 dBFS.
// Keep source files and envelopes intact; continuous pouring still follows its flow.
const levels=Object.freeze({open:.881,shake1:.473,shake2:.416,stir1:.846,stir2:.900,pour1:.804,pour2:.820});
function release(context){const bus=buses.get(context);if(bus){bus.disconnect();buses.delete(context);}}
window.LunaSfx={
 get volume(){return volume;},
 level(name){return levels[name]??1;},
 output(context){
  for(const ctx of buses.keys())if(ctx.state==='closed')release(ctx);
  if(!buses.has(context)){const bus=context.createGain();bus.gain.value=volume;bus.connect(context.destination);buses.set(context,bus);}
  return buses.get(context);
 },
 setVolume(value){
  if(!Number.isFinite(value))return;
  volume=Math.max(0,Math.min(1,value));
  try{localStorage.setItem(KEY,JSON.stringify(volume));}catch{}
  for(const [context,bus] of buses){
   if(context.state==='closed'){release(context);continue;}
   const now=context.currentTime;
   bus.gain.cancelScheduledValues(now);
   if(volume===0||context.state!=='running'){bus.gain.value=volume;bus.gain.setValueAtTime(volume,now);}
   else{bus.gain.setValueAtTime(bus.gain.value,now);bus.gain.linearRampToValueAtTime(volume,now+.02);}
  }
 },
 release
};
})();
