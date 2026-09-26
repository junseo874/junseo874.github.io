(function(){
'use strict';
// Original project bottle pixels, enlarged around the cap. No replacement artwork.
window.LunaOpenView=function({g,D,L,esc,button,ui}){
 const images=new Map(),seen=new WeakMap();let audio=null;
 function image(key){if(!images.has(key)){const i=new Image();i.src=D.assets[key]?.src||D.assets.item_dummy.src;images.set(key,i);}return images.get(key);}
 function unlockAudio(){if(ui.gimmickAudio===false)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
 function sound(ok){
  if(ui.gimmickAudio===false||!audio||audio.state!=='running')return;
  const now=audio.currentTime,bus=audio.createGain();bus.gain.value=.35;bus.connect(audio.destination);
  const len=ok ? .24 : .12,buf=audio.createBuffer(1,Math.ceil(audio.sampleRate*len),audio.sampleRate),data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*(ok?7:12));
  const noise=audio.createBufferSource(),filter=audio.createBiquadFilter();noise.buffer=buf;filter.type='highpass';filter.frequency.value=ok?1600:2800;noise.connect(filter);filter.connect(bus);noise.start(now);
  const ping=audio.createOscillator(),env=audio.createGain();ping.type='triangle';ping.frequency.setValueAtTime(ok?1900:480,now);ping.frequency.exponentialRampToValueAtTime(ok?820:140,now+.16);env.gain.setValueAtTime(ok ? .24 : .13,now);env.gain.exponentialRampToValueAtTime(.0001,now+.22);ping.connect(env);env.connect(bus);ping.start(now);ping.stop(now+.23);
  if(ok){const pop=audio.createOscillator(),gain=audio.createGain();pop.type='sine';pop.frequency.setValueAtTime(300,now);pop.frequency.exponentialRampToValueAtTime(75,now+.07);gain.gain.setValueAtTime(.32,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.1);pop.connect(gain);gain.connect(bus);pop.start(now);pop.stop(now+.11);pop.onended=()=>{pop.disconnect();gain.disconnect();};}
  ping.onended=()=>{ping.disconnect();env.disconnect();noise.disconnect();filter.disconnect();bus.disconnect();};
 }
 function html(s){
  const ready=s.completed&&(s.openFx?.age||0)>=.65;
  return '<div class="craft-screen opening-screen">'+(g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):'')+
   '<canvas class="opening-stage" data-opening-stage width="1280" height="720" role="img" aria-label="'+L('맥주병 뚜껑에 초점을 맞춘 병따기','Bottle opening focused on the cap')+'"></canvas>'+
   '<div class="opening-caption"><small>'+esc(g.name(s.ingredient))+'</small><h2>'+L('병따기','OPEN THE BOTTLE')+'</h2><p>'+L('두 원이 겹치는 순간, Space','Press Space when the rings meet')+'</p></div>'+
   '<div class="opening-feedback" role="status" data-open-feedback></div>'+
   '<div class="opening-misses">'+L('실패','Misses')+' '+s.failures+'</div>'+
   button(s.completed?L('OPEN!','OPEN!'):s.started?'<kbd>Space</kbd> '+L('뚜껑 따기','Pop the cap'):'<kbd>Space</kbd> '+L('시작','Start'),'gimmickInput',s.completed?'disabled':'','primary opening-hit')+
   button(g.minigame?L('마치기 →','Finish →'):L('다음 →','Next →'),'endGimmick',(!ready||g.remix?.hold?'disabled':''),'primary gimmick-finish')+'</div>';
 }
 function sync(root){
  const canvas=root.querySelector('[data-opening-stage]'),s=g.gimmick;if(!canvas||s?.type!=='open')return;
  const fx=s.openFx,t=fx?.age||0,ok=fx?.kind==='success',miss=fx?.kind==='miss'&&t<.55;
  if(fx&&seen.get(s)!==fx.serial&&!g.isPaused()){seen.set(s,fx.serial);sound(ok);}
  canvas.dataset.state=ok?'success':miss?'miss':s.started?'playing':'ready';
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1280,720);
  const bg=image('gimmick');if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,1280,720);
  ctx.fillStyle='#060d19dc';ctx.fillRect(0,0,1280,720);
  const halo=ctx.createRadialGradient(640,310,25,640,310,450);halo.addColorStop(0,ok?'#124e47aa':'#193649aa');halo.addColorStop(1,'#080e1700');ctx.fillStyle=halo;ctx.fillRect(0,0,1280,720);
  ctx.strokeStyle='#77d8e509';ctx.lineWidth=1;for(let x=0;x<1280;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,720);ctx.stroke();}
  const bottle=image('item_'+s.ingredient),scale=4.2,cx=640,cy=310;
  const kick=ok&&t<.24?Math.sin(t*42)*Math.exp(-t*18)*6:miss?Math.sin(t*48)*Math.exp(-t*10)*5:0;
  ctx.save();ctx.translate(cx+kick,cy);ctx.imageSmoothingEnabled=false;
  if(bottle.complete&&bottle.naturalWidth){
   // beer.png: cap x33..54, y66..72. Body retains the native alpha and neck.
   ctx.drawImage(bottle,22,72,43,150,-21*scale,3*scale,43*scale,150*scale);
   if(ok){ctx.fillStyle='#38291c';ctx.beginPath();ctx.ellipse(0,3*scale,8*scale,1.5*scale,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#af9669';ctx.lineWidth=2;ctx.stroke();}
   ctx.save();
   if(ok){ctx.translate(260*t,-690*t+300*t*t);ctx.rotate(-12*t);ctx.globalAlpha=Math.max(0,1-(t-.65)*2);}
   else if(miss){const decay=Math.exp(-t*9);ctx.translate(-10*Math.sin(t*36)*decay,4*decay);ctx.rotate(-.24*Math.sin(t*28)*decay);ctx.transform(1,0,.25*decay,1-.22*decay,0,0);}
   ctx.drawImage(bottle,33,66,21,6,-10*scale,-3*scale,21*scale,6*scale);ctx.restore();
  }
  ctx.restore();
  // Opener lever reacts only to a hit; a miss slips back instead of detaching the cap.
  const tool=image('item_opener'),strike=fx&&t<.45;
  if(tool.complete&&tool.naturalWidth){ctx.save();ctx.translate(cx+48+(strike?Math.sin(t*15)*35:35),cy+36+(strike?Math.sin(t*15)*20:35));ctx.rotate(-.9+(strike?(ok?-1:1)*Math.sin(t*13)*.6:0));ctx.globalAlpha=ok?Math.max(0,1-t*3):.85;ctx.imageSmoothingEnabled=false;ctx.drawImage(tool,13,63,45,44,-25,-15,135,132);ctx.restore();}
  if(!ok){
   const target=g.c('open_target_radius_px',44),start=g.c('open_start_radius_px',165),radius=Math.max(12,start-(start-target)*s.beatTime/g.c('open_approach_sec',1.6));
   ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='#7cf3c6';ctx.lineWidth=3;ctx.shadowColor='#60edc0';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,target,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle=miss?'#f18d89':'#e1faff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
  }else if(t<.65){
   ctx.save();ctx.globalAlpha=1-t/.65;ctx.strokeStyle='#a4ffdd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,44+t*210,0,Math.PI*2);ctx.stroke();
   for(let i=0;i<16;i++){const a=i*2.399,r=30+t*(110+i*8);ctx.fillStyle=i%3?'#9cffe1':'#ffe7a8';ctx.fillRect(cx+Math.cos(a)*r,cy+Math.sin(a)*r-t*80,3,5);}ctx.restore();
  }
  const label=root.querySelector('[data-open-feedback]');if(label){label.textContent=ok?'POP!':miss?L('삐끗! 다시 맞춰 보세요','SLIP! Try again'):'';label.classList.toggle('miss',miss);}
 }
 return {html,sync,unlockAudio};
};
})();
