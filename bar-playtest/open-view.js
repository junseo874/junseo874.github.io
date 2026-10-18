(function(){
'use strict';
// Original project bottle pixels, enlarged around the cap. No replacement artwork.
window.LunaOpenView=function({g,D,L,esc,button,ui}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const images=new Map(),seen=new WeakMap();let audio=null,buffer=null,loading=null,voice=null,fizzBuffer=null,fizzLoading=null,fizzVoice=null,active=null;
 const bytes=fetch(new URL('audio/beercan_open.wav',document.baseURI)).then(r=>{if(!r.ok)throw Error('Opening audio '+r.status);return r.arrayBuffer();}).catch(()=>null);
 const fizzBytes=fetch(new URL('audio/beer_fizz_tail.wav?v=tail-35',document.baseURI)).then(r=>{if(!r.ok)throw Error('Fizz audio '+r.status);return r.arrayBuffer();}).catch(()=>null);
 function prepareFizz(){if(!audio||fizzBuffer||fizzLoading)return;fizzLoading=fizzBytes.then(raw=>{if(!raw)throw Error('Missing fizz recording');return audio.decodeAudioData(raw.slice(0));}).then(b=>{fizzBuffer=b;}).catch(()=>console.warn('Carbonation recording unavailable'));}
 function stopFizz(){if(!fizzVoice)return;const v=fizzVoice;fizzVoice=null;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();}
 function playFizz(){
  if(!fizzBuffer)return; // Never append late audio after a completed opening.
  const v={source:audio.createBufferSource(),gain:audio.createGain()};fizzVoice=v;
  // Let the cap transient lead; carbonation slowly emerges as a quiet tail.
  const start=audio.currentTime+.45,level=window.LunaSfx.level('openFizz');
  v.source.buffer=fizzBuffer;v.gain.gain.setValueAtTime(0,audio.currentTime);
  v.gain.gain.setValueAtTime(0,start);
  v.gain.gain.linearRampToValueAtTime(level,start+.4);
  v.gain.gain.linearRampToValueAtTime(level*.8,start+2.2);
  v.gain.gain.linearRampToValueAtTime(0,start+fizzBuffer.duration);
  v.source.connect(v.gain);v.gain.connect(window.LunaSfx.output(audio));
  v.source.onended=()=>{v.source.disconnect();v.gain.disconnect();if(fizzVoice===v)fizzVoice=null;};
  v.source.start(start);
 }
 function prepare(){if(!audio||buffer||loading)return;loading=bytes.then(raw=>{if(!raw)throw Error('Missing opening recording');return audio.decodeAudioData(raw.slice(0));}).then(b=>{buffer=b;}).catch(()=>console.warn('Opening recording unavailable'));}
 function stopSound(){stopFizz();if(!voice)return;const v=voice;voice=null;try{v.source.stop();}catch{}v.source.disconnect();v.tone.disconnect();v.gain.disconnect();}
 function playOpening(perfect){
  if(!buffer)return; // Never play a delayed success cue after loading.
  stopSound();const v={source:audio.createBufferSource(),gain:audio.createGain(),tone:audio.createBiquadFilter()};voice=v;
  v.source.buffer=buffer;v.source.playbackRate.value=perfect?1.16:1.08;v.tone.type="highshelf";v.tone.frequency.value=2200;v.tone.gain.value=1.5;v.gain.gain.value=window.LunaSfx.level("open")*.88;v.source.connect(v.tone);v.tone.connect(v.gain);v.gain.connect(window.LunaSfx.output(audio));
  v.source.onended=()=>{v.source.disconnect();v.tone.disconnect();v.gain.disconnect();if(voice===v)voice=null;};
  v.source.start();playFizz();
 }
 function image(key){if(!images.has(key)){const i=new Image();i.src=D.assets[key]?.src||D.assets.item_dummy.src;images.set(key,i);}return images.get(key);}
 function unlockAudio(){if(ui.gimmickAudio===false)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});prepare();prepareFizz();}catch{}}
 function sound(ok,perfect){
  if(ui.gimmickAudio===false||!audio||audio.state!=='running')return;
  if(ok){playOpening(perfect);return;}
  const now=audio.currentTime,bus=audio.createGain();bus.gain.value=.35;bus.connect(window.LunaSfx.output(audio));
  const len=.12,buf=audio.createBuffer(1,Math.ceil(audio.sampleRate*len),audio.sampleRate),data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*12);
  const noise=audio.createBufferSource(),filter=audio.createBiquadFilter();noise.buffer=buf;filter.type='highpass';filter.frequency.value=2800;noise.connect(filter);filter.connect(bus);noise.start(now);
  const ping=audio.createOscillator(),env=audio.createGain();ping.type='triangle';ping.frequency.setValueAtTime(480,now);ping.frequency.exponentialRampToValueAtTime(140,now+.16);env.gain.setValueAtTime(.13,now);env.gain.exponentialRampToValueAtTime(.0001,now+.22);ping.connect(env);env.connect(bus);ping.start(now);ping.stop(now+.23);
  ping.onended=()=>{ping.disconnect();env.disconnect();noise.disconnect();filter.disconnect();bus.disconnect();};
 }
 function lesson(s){if(!s.openTutorial||g.isPaused())return '';const text=s.completed?L('잘했어요. 다음을 눌러 제조를 이어가세요.','Well done. Select Next to continue.'):!s.started?L('Space를 눌러 시작하세요. 먼저 힘 게이지가 움직여요.','Press Space to start. The outer ring will begin to shrink.'):s.failures?L('괜찮아요. 초록 힘 구간을 맞춘 뒤, 두 원이 겹칠 때 눌러 보세요.','Try again. Press Space when the outer ring meets the mint ring.'):L('초록 구간에서 힘을 맞추고, 이어서 원이 겹칠 때 누르면 열려요.','Press Space again when the outer ring meets the mint ring to pop the cap.');return '<div class="opening-lesson" data-open-lesson><svg viewBox="0 0 1280 720" aria-hidden="true"><defs><mask id="opening-lesson-mask"><rect width="1280" height="720" fill="white"/><circle cx="640" cy="310" r="190" fill="black"/><rect x="510" y="600" width="260" height="100" rx="12" fill="black"/><rect x="1100" y="640" width="165" height="70" rx="12" fill="black"/></mask></defs><rect width="1280" height="720" fill="#020611" opacity=".55" mask="url(#opening-lesson-mask)"/></svg><div class="opening-lesson-copy"><kbd>SPACE</kbd><p>'+text+'</p><span aria-hidden="true">→</span></div></div>';}
 function html(s){
  const ready=s.completed&&(s.openFx?.age||0)>=(g.minigame?window.LunaCore.OPEN.minigameHoldSec:window.LunaCore.OPEN.carbonationSec);
  return '<div class="craft-screen opening-screen">'+(g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):'')+
   '<img class="gimmick-room-background" src="'+esc(D.assets.gimmick.src)+'" alt="" aria-hidden="true" draggable="false">'+
   '<canvas class="opening-stage" data-opening-stage width="1280" height="720" role="img" aria-label="'+L('맥주병 뚜껑에 초점을 맞춘 병따기','Bottle opening focused on the cap')+'"></canvas>'+
   '<div class="opening-timing-hint" data-open-timing hidden aria-hidden="true">Space</div>'+
   '<div class="opening-feedback" role="status" data-open-feedback></div><div class="opening-phase" data-open-phase></div>'+
   button(s.completed?L('OPEN!','OPEN!'):s.started?'<kbd>Space</kbd> '+(s.openPhase==='power'?L('힘 조절','Set power'):L('뚜껑 따기','Pop the cap')):'<kbd>Space</kbd> '+L('시작','Start'),'gimmickInput',s.completed?'disabled':'','primary opening-hit')+
   lesson(s)+button(g.minigame?L('마치기 →','Finish →'):L('다음 →','Next →'),'endGimmick',(!ready||g.remix?.hold?'disabled':''),'primary gimmick-finish')+'</div>';
 }
 function sync(root){
  const canvas=root.querySelector('[data-opening-stage]'),s=g.gimmick;
  if(!canvas||g.screen!=='gimmick'||s?.type!=='open'){stopSound();active=null;return;}
  if(active!==s){stopSound();active=s;}
  if(g.isPaused()||ui.gimmickAudio===false)stopSound();
  canvas.dataset.openAudioReady=String(!!buffer);
  canvas.dataset.fizzAudioReady=String(!!fizzBuffer);
  // Use the exact input judgement (unclamped radius), not the drawing radius or a timer approximation.
  const targetRadius=g.c('open_target_radius_px',44),startRadius=g.c('open_start_radius_px',165);
  const judgeRadius=startRadius-(startRadius-targetRadius)*s.beatTime/1.1;
  const inWindow=g.screen==='gimmick'&&s.openPhase==='rhythm'&&!s.completed&&!g.isPaused()&&Math.abs(s.beatTime-1.1)<=.14;
  const hint=root.querySelector('[data-open-timing]');if(hint)hint.hidden=!inWindow;
  const fx=s.openFx,t=fx?.age||0,ok=fx?.kind==='success',miss=fx?.kind==='miss'&&t<.55;
  if(fx&&seen.get(s)!==fx.serial&&!g.isPaused()){seen.set(s,fx.serial);if(fx.age<.12)sound(ok,fx.perfect);}
  canvas.dataset.perfect=String(!!fx?.perfect);
  canvas.dataset.state=ok?'success':s.openPhase||'ready';
  canvas.dataset.carbonation='0';
  const phaseLabel=root.querySelector('[data-open-phase]');if(phaseLabel)phaseLabel.textContent=L(({ready:'Space / 클릭으로 시작',power:'1 · 힘 조절 — 초록 구간에서 누르기','power-done':'힘 조절 성공',rhythm:'2 · 타이밍 — 두 원이 겹칠 때 누르기',broken:'병이 깨졌어요 · 다시 준비 중',pop:'병따기 완료'})[s.openPhase]||'','POWER → TIMING');
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1280,720);
  // The supplied room is a full-screen layer, independent of cap animation.
  const halo=ctx.createRadialGradient(640,310,25,640,310,450);halo.addColorStop(0,ok?'#124e4740':'#19364926');halo.addColorStop(1,'#080e1700');ctx.fillStyle=halo;ctx.fillRect(0,0,1280,720);
  const bottle=image('item_'+s.ingredient),scale=4.2,cx=640,cy=310;
  const kick=reduced.matches?0:ok&&t<.24?Math.sin(t*42)*Math.exp(-t*18)*6:miss?Math.sin(t*48)*Math.exp(-t*10)*5:0;
  ctx.save();ctx.translate(cx+kick,cy);ctx.imageSmoothingEnabled=false;if(s.openPhase==='broken')ctx.globalAlpha=.2;
  if(bottle.complete&&bottle.naturalWidth){
   // beer.png: cap x33..54, y66..72. Body retains the native alpha and neck.
   ctx.drawImage(bottle,22,72,43,150,-21*scale,3*scale,43*scale,150*scale);
   if(ok&&s.ingredient==='beer'){
    ctx.save();ctx.scale(scale,scale);
    canvas.dataset.carbonation=String(window.LunaOpenCarbonation.draw(ctx,t,reduced.matches));
    ctx.restore();
   }
   if(ok){ctx.fillStyle='#38291c';ctx.beginPath();ctx.ellipse(0,3*scale,8*scale,1.5*scale,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#af9669';ctx.lineWidth=2;ctx.stroke();}
   ctx.save();
   if(ok){const launch=fx.perfect?1.2:1;ctx.translate(260*t*launch,-690*t*launch+300*t*t);ctx.rotate(-12*t*launch);ctx.globalAlpha=Math.max(0,1-(t-.65)*2);}
   else if(miss){const decay=Math.exp(-t*9);ctx.translate(-10*Math.sin(t*36)*decay,4*decay);ctx.rotate((fx.offset<0?1:-1)*.24*Math.sin(t*28)*decay);ctx.transform(1,0,.25*decay,1-.22*decay,0,0);}
   ctx.drawImage(bottle,33,66,21,6,-10*scale,-3*scale,21*scale,6*scale);ctx.restore();
  }
  ctx.restore();
  if(ok&&fx.perfect&&t<.7){ctx.save();ctx.globalAlpha=Math.max(0,1-t/.7);ctx.strokeStyle='#ffe5a0';ctx.lineWidth=2;const r=reduced.matches?70:48+t*160;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();if(!reduced.matches)for(let i=0;i<8;i++){const a=i*Math.PI/4,d=50+t*220,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();}ctx.restore();}
  // Opener lever reacts only to a hit; a miss slips back instead of detaching the cap.
  const tool=image('item_opener'),strike=fx&&t<.45;
  if(tool.complete&&tool.naturalWidth){ctx.save();ctx.translate(cx+48+(strike?Math.sin(t*15)*35:35),cy+36+(strike?Math.sin(t*15)*20:35));ctx.rotate(-.9+(strike?(ok?-1:1)*Math.sin(t*13)*.6:0));ctx.globalAlpha=ok?Math.max(0,1-t*3):.85;ctx.imageSmoothingEnabled=false;ctx.drawImage(tool,13,63,45,44,-25,-15,135,132);ctx.restore();}
  if(!ok&&s.openPhase==='rhythm'){
   const target=g.c('open_target_radius_px',44),start=g.c('open_start_radius_px',165),radius=Math.max(12,start-(start-target)*s.beatTime/1.1);
   ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='#7cf3c6';ctx.lineWidth=3;ctx.shadowColor='#60edc0';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,target,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle=miss?'#f18d89':'#e1faff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
  }else if(ok&&t<.65){
   ctx.save();ctx.globalAlpha=1-t/.65;ctx.strokeStyle='#a4ffdd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,44+t*210,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<16;i++){const a=i*2.399,r=30+t*(110+i*8);ctx.fillStyle=i%3?'#9cffe1':'#ffe7a8';ctx.fillRect(cx+Math.cos(a)*r,cy+Math.sin(a)*r-t*80,3,5);}ctx.restore();
  }
  if(['power','power-done'].includes(s.openPhase)){
   const x=400,y=240,h=250;ctx.fillStyle='#17252fee';ctx.fillRect(x,y,30,h);
   ctx.fillStyle='#42775d';ctx.fillRect(x,y+h*(1-.932),30,h*.304);ctx.fillStyle='#8bc99b';ctx.fillRect(x,y+h*(1-.86),30,h*.16);
   ctx.fillStyle='#e8f6ee';ctx.fillRect(x-9,y+h*(1-s.powerPos)-2,48,4);
   ctx.font='17px sans-serif';ctx.fillText('힘',x+4,y-18);
  }
  if(!ok&&s.roundMisses){ctx.strokeStyle='#c8dbd4aa';ctx.lineWidth=2;for(let j=0;j<Math.min(3,s.roundMisses);j++){ctx.beginPath();ctx.moveTo(cx-28+j*22,cy+130+j*45);for(let i=1;i<6;i++)ctx.lineTo(cx-28+j*22+Math.sin(i*2+j)*19,cy+130+j*45+i*10);ctx.stroke();}}
  if(s.openPhase==='broken'){const age=1.2-s.openDelay;for(let i=0;i<36;i++){ctx.fillStyle=i%3?'#61432e':'#a2c5cb';ctx.fillRect(cx+Math.sin(i*2.4)*age*220,cy+90+i*8-age*180+age*age*160,4+i%3*2,7);}}
  const label=root.querySelector('[data-open-feedback]');if(label){label.textContent=ok?(fx.perfect?'PERFECT!':'POP!'):s.openPhase==='broken'?'다시 시도':miss?'MISS':'';label.classList.toggle('miss',miss);label.classList.toggle('perfect',!!fx?.perfect);}
 }
 return {html,sync,unlockAudio};
};
})();
