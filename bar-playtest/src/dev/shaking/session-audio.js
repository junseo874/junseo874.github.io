// Same recordings and gain calibration as the existing shake-polish.js.
window.ShakeLabAudio=(()=>{
 let context=null,voice=null;
 const recording='shaker_02_hit.wav';
 let buffer=null,loading=null;
 const enabled=()=>OPT.sfxOn&&OPT.sfx>0;
 function stop(){if(voice){try{voice.source.stop()}catch{}voice.source.disconnect();voice.gain.disconnect();voice=null;}}
 function unlock(){
  if(!enabled())return;
  context??=new (window.AudioContext||window.webkitAudioContext)();
  context.resume().catch(()=>{});
  loading??=fetch('../../../assets/audio/effects/'+recording)
    .then(r=>{if(!r.ok)throw Error('Missing shaker sound');return r.arrayBuffer()})
    .then(bytes=>context.decodeAudioData(bytes)).then(decoded=>{buffer=decoded;})
    .catch(()=>{document.body.dataset.audioError='true';});
 }
 function hit(){
  if(!enabled()||pauseAt!=null||!context||context.state!=='running')return;
  if(!buffer)return;
  stop();const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;gain.gain.value=.416*OPT.sfx/70;
  source.connect(gain);gain.connect(parent!==window&&parent.LunaSfx?parent.LunaSfx.output(context):context.destination);
  const current={source,gain};voice=current;
  source.onended=()=>{source.disconnect();gain.disconnect();if(voice===current)voice=null;};source.start();
  document.body.dataset.lastSound=recording;
 }
 addEventListener('pagehide',()=>{stop();context?.close();});
 return{unlock,hit,stop};
})();
