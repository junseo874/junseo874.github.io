// Strokes use the game recording. The completion cue is rendered from the FX prototype.
window.ShakeLabAudio=(()=>{
 let context=null,voice=null;
 const recording='shaker_02_hit.wav';
 const files={
  [recording]:'../../../assets/audio/effects/'+recording,
  'shake-complete.wav':'assets/shake-complete.wav'
 };
 const buffers=new Map();
 let loading=null;
 const enabled=()=>OPT.sfxOn&&OPT.sfx>0;
 function stop(){if(voice){try{voice.source.stop()}catch{}voice.source.disconnect();voice.gain.disconnect();voice=null;}}
 function unlock(){
  if(!enabled())return;
  context??=new (window.AudioContext||window.webkitAudioContext)();
  context.resume().catch(()=>{});
  loading??=Promise.all(Object.entries(files).map(async ([name,url])=>{
   try{
    const response=await fetch(url);
    if(!response.ok)throw Error('Missing shaker sound: '+name);
    buffers.set(name,await context.decodeAudioData(await response.arrayBuffer()));
   }catch{document.body.dataset.audioError='true'}
  }));
 }
 function play(name,level){
  const buffer=buffers.get(name);
  if(!buffer||!enabled()||pauseAt!=null||context.state!=='running')return;
  stop();const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;gain.gain.value=level*OPT.sfx/70;
  source.connect(gain);gain.connect(parent!==window&&parent.LunaSfx?parent.LunaSfx.output(context):context.destination);
  const current={source,gain};voice=current;
  source.onended=()=>{source.disconnect();gain.disconnect();if(voice===current)voice=null;};source.start();
  document.body.dataset.lastSound=name;
 }
 addEventListener('pagehide',()=>{stop();context?.close();});
 return{unlock,stop,
  hit:()=>play(recording,.416),
  complete:()=>play('shake-complete.wav',.85)
 };
})();
