// Same recordings and gain calibration as the existing shake-polish.js.
window.ShakeLabAudio=(()=>{
 let context=null,voice=null;
 const buffers=new Map(),pending=new Map();
 const enabled=()=>OPT.sfxOn&&OPT.sfx>0;
 function stop(){if(voice){try{voice.source.stop()}catch{}voice.source.disconnect();voice.gain.disconnect();voice=null;}}
 function unlock(){
  if(!enabled())return;
  context??=new (window.AudioContext||window.webkitAudioContext)();
  context.resume().catch(()=>{});
  for(const id of [2])if(!pending.has(id))pending.set(id,
   fetch('../../../assets/audio/effects/shaker_0'+id+'_hit.wav')
    .then(r=>{if(!r.ok)throw Error('Missing shaker sound');return r.arrayBuffer()})
    .then(bytes=>context.decodeAudioData(bytes)).then(buffer=>buffers.set(id,buffer))
    .catch(()=>{document.body.dataset.audioError='true';}));
 }
 function hit(){
  if(!enabled()||pauseAt!=null||!context||context.state!=='running')return;
  const id=2,buffer=buffers.get(id);if(!buffer)return;
  stop();const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;gain.gain.value=.416*OPT.sfx/70;
  source.connect(gain);gain.connect(parent!==window&&parent.LunaSfx?parent.LunaSfx.output(context):context.destination);
  const current={source,gain};voice=current;
  source.onended=()=>{source.disconnect();gain.disconnect();if(voice===current)voice=null;};source.start();
  document.body.dataset.lastSound='shaker_0'+id+'_hit.wav';
 }
 addEventListener('pagehide',()=>{stop();context?.close();});
 return{unlock,hit,stop};
})();
