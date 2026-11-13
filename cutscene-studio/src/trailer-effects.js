/* Trailer-local presentation. Engine title reference: SH_TitleGlitchPanel.shader
 * BandCount 24, Shift .031, Period 2.86, gate .87..2.35, flicker 47/19, 30fps.
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
  const local=t%2.86,strength=local<.87||local>2.35?0:Math.abs(Math.sin(local*47)*Math.sin(local*19));
  const tick=Math.floor(t*30);
  for(let band=0;band<24;band++){
   const shift=((band*17+tick*13)%11-5)/5*.031*width*strength;
   ctx.drawImage(im,0,band*im.naturalHeight/24,im.naturalWidth,im.naturalHeight/24,x+shift,y+band*height/24,width,height/24+.5);
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
  this.buffers=new Map();this.context=new AudioContext();this.active=null;
  this.voices=Object.fromEntries(Object.entries({pour:'pour_02_loop.wav',stir:'stir_02_loop.wav',shake:'shaker_02_hit.wav',open:'beercan_open.wav',serve:'glass-slide/glass_slide_03.wav',dialogue:'dialogue/low-1.wav'}).map(([key,path])=>{const a=new Audio(root+path);a.preload='auto';return[key,a];}));
 }
 stop(){if(this.active){const v=this.active,now=this.context.currentTime;this.active=null;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,.008);v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();};try{v.source.stop(now+.035);}catch{v.source.disconnect();v.gain.disconnect();}}}
 async prepare(){await Promise.all(Object.entries(this.voices).map(async([key,a])=>{const r=await fetch(a.src);if(!r.ok)throw Error('효과음 없음: '+key);this.buffers.set(key,await this.context.decodeAudioData(await r.arrayBuffer()));}));}
 paint(s,t,playing,volume,talking){
  const key=s.file?.startsWith('pour-')?'pour':s.file==='stir'?'stir':s.file==='shake'?'shake':s.kind==='open'?'open':s.kind==='serve'?'serve':talking?'dialogue':null;
  const start=key==='open'?.5:key==='pour'&&s.file==='pour-gin'?1.65:0;
  if(!key||!playing||t<start){this.stop();return;}
  const buffer=this.buffers.get(key),loop=!['open','serve'].includes(key),at=t-start+(key==='serve'?.2:0);
  if(!buffer||!loop&&at>=buffer.duration||key==='serve'&&t>=1.25){this.stop();return;}
  const context=this.context;if(context.state!=='running'){void context.resume().catch(()=>{});return;}
  const level=volume*(key==='dialogue'?.42:key==='serve'?.24:.8);
  if(this.active&&(this.active.key!==key||this.active.scene!==s||Math.abs(at-(this.active.at+context.currentTime-this.active.epoch))>.2))this.stop();
  if(!this.active){const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=loop;source.connect(gain);gain.connect(context.destination);gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(level,context.currentTime+.015);source.start(0,loop?at%buffer.duration:at);this.active={source,gain,key,scene:s,at,epoch:context.currentTime};}
  else this.active.gain.gain.setTargetAtTime(level,context.currentTime,.015);
 }
};
})(window);
