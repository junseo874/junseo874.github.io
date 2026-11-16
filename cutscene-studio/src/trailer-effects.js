/* Trailer-local presentation. Reference: supplied Honeycam GIF, 2.86 seconds.
 * Clean white hold -> short coarse tears -> immediate clean recovery.
 * No campaign data, original assets, or engine files are changed. */
(function(W){
const colors=['#ffe087','#92baf1','#d7e176','#ff666a','#bb94ed','#ffad69','#ff9bbb','#92e3ca'];
W.LunaTrailerEffects=class{
 constructor(card,source){
  this.source=source;this.canvas=document.createElement('canvas');this.canvas.width=760;this.canvas.height=430;this.canvas.className='trailer-logo';this.canvas.hidden=true;card.append(this.canvas);
 }
 logo(t){
  const c=this.canvas,ctx=c.getContext('2d'),im=this.source;c.hidden=false;im.hidden=true;ctx.clearRect(0,0,c.width,c.height);
  if(!im.complete||!im.naturalWidth)return;
  const width=600,height=im.naturalHeight/im.naturalWidth*width,x=(c.width-width)/2,y=(c.height-height)/2;
  // Do not glitch during the slow reveal. The GIF has isolated held damaged
  // frames, not sine-driven vibration of every horizontal strip.
  const local=t-1.65;
  const bursts=[[.25,.36,0],[.72,.86,1],[1.00,1.10,2],[1.24,1.36,3],[1.68,1.79,0],[2.10,2.22,2]];
  const burst=bursts.find(([a,b])=>local>=a&&local<b);
  c.dataset.glitch=burst?'true':'false';
  if(!burst){ctx.drawImage(im,x,y,width,height);return;}
  const patterns=[
   [[0,.29,0],[.29,.35,20],[.35,.47,-22],[.47,.54,8],[.54,.7,-13],[.7,.85,15],[.85,1,-4]],
   [[0,.32,0],[.32,.48,-14],[.48,.64,16],[.64,.8,-12],[.8,1,9]],
   [[0,.43,0],[.43,.65,38],[.65,.72,-8],[.72,1,0]],
   [[0,.3,0],[.3,.43,15],[.43,.55,0],[.55,.68,-19],[.68,.82,8],[.82,1,0]]
  ];
  for(const [a,b,shift]of patterns[burst[2]]){
   ctx.drawImage(im,0,a*im.naturalHeight,im.naturalWidth,(b-a)*im.naturalHeight,x+shift,y+a*height,width,(b-a)*height);
  }
 }
 emotions(title,t,duration,words){
  const index=Math.min(7,Math.floor(t/duration*8)),phase=(t/duration*8)%1;
  if(title.dataset.emotion!==String(index)){
   title.dataset.emotion=String(index);title.replaceChildren();
   const label=document.createElement('small');label.textContent='그들에게서 학습하는';
   const word=document.createElement('span');word.className='emotion-word';word.textContent='‘'+words[index]+'’';word.style.color=colors[index];title.append(label,word);
  }
  const e=title.querySelector('.emotion-word'),pulse=Math.sin(phase*Math.PI),decay=1-phase;
  const motion=[`translateY(${-8*pulse}px)`,`translateY(${5*phase}px)`,`translateX(${Math.sin(phase*38)*3*decay}px)`,`translateX(${Math.sin(phase*55)*5*decay}px) scale(${1+.07*pulse})`,`translate(${Math.sin(phase*70)*2}px,${Math.cos(phase*57)*2}px)`,`scale(${1+.08*pulse})`,`scale(${1+.05*Math.sin(phase*12)})`,`translateY(${-6*pulse}px)`];
  e.style.transform=motion[index];e.style.textShadow=`0 0 ${8+16*pulse}px ${colors[index]}77`;
 }
};
W.LunaTrailerAudio=class{
 constructor(){
  const root='../bar-playtest/assets/audio/effects/';
  this.buffers=new Map();this.context=new AudioContext();this.active=null;this.ticks=new Set();this.lastTick=-Infinity;this.serial=0;this.previousSpeech=null;
  const files={pour:'pour_02_loop.wav',stir:'stir_02_loop.wav',shake:'shaker_02_hit.wav',open:'beercan_open.wav'};
  for(let i=0;i<6;i++)files['dialogue'+i]='dialogue/low-'+(i+1)+'.wav';
  this.voices=Object.fromEntries(Object.entries(files).map(([key,path])=>{const a=new Audio(root+path);a.preload='auto';return[key,a];}));
 }
 stop(){if(this.active){const v=this.active,now=this.context.currentTime;this.active=null;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.008);v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();};try{v.source.stop(now+.035);}catch{v.source.disconnect();v.gain.disconnect();}}}
 async prepare(){await Promise.all(Object.entries(this.voices).map(async([key,a])=>{const r=await fetch(a.src);if(!r.ok)throw Error('효과음 없음: '+key);this.buffers.set(key,await this.context.decodeAudioData(await r.arrayBuffer()));}));}
 dialogue(speech,playing,volume){
  const previous=this.previousSpeech;this.previousSpeech=speech?{...speech}:null;
  if(!playing){for(const voice of this.ticks){try{voice.stop();}catch{}}this.ticks.clear();return;}
  const context=this.context;if(context.state!=='running'){void context.resume().catch(()=>{});return;}
  if(!speech||previous?.key!==speech.key||speech.chars<=previous.chars||speech.chars-previous.chars>8)return;
  if(!/[\p{L}\p{N}]/u.test(speech.text.slice(previous.chars,speech.chars))||context.currentTime-this.lastTick<.064)return;
  const buffer=this.buffers.get('dialogue'+this.serial++%6);if(!buffer)return;
  this.lastTick=context.currentTime;
  const voice=context.createBufferSource(),gain=context.createGain();voice.buffer=buffer;
  // Match the game's six one-shot samples and 64 ms minimum interval.
  // Never loop, stretch, change pitch, or queue a burst for skipped text.
  voice.playbackRate.value=1;voice.loop=false;gain.gain.value=volume*.68;
  voice.connect(gain);gain.connect(context.destination);this.ticks.add(voice);
  voice.onended=()=>{this.ticks.delete(voice);voice.disconnect();gain.disconnect();};voice.start();
 }
 paint(s,t,playing,volume,speech){
  this.dialogue(speech,playing,volume);
  const key=s.file?.startsWith('pour-')?'pour':s.file==='stir'?'stir':s.file==='shake'?'shake':s.kind==='open'?'open':null;
  const start=key==='open'?.5:key==='pour'&&s.file==='pour-gin'?1.65:0;
  if(!key||!playing||t<start){this.stop();return;}
  const buffer=this.buffers.get(key),loop=key!=='open',at=t-start;
  if(!buffer||!loop&&at>=buffer.duration){this.stop();return;}
  const context=this.context;if(context.state!=='running'){void context.resume().catch(()=>{});return;}
  const level=volume*.8;
  if(this.active&&(this.active.key!==key||this.active.scene!==s||Math.abs(at-(this.active.at+context.currentTime-this.active.epoch))>.2))this.stop();
  if(!this.active){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=loop;source.connect(gain);gain.connect(context.destination);gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(level,context.currentTime+.015);source.start(0,loop?at%buffer.duration:at);this.active={source,gain,key,scene:s,at,epoch:context.currentTime};}
  else this.active.gain.gain.setTargetAtTime(level,context.currentTime,.015);
 }
};
})(window);
