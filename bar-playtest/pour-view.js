(function(root){'use strict';
root.LunaPourView=function({g,D,L,esc,button,ui}){
 let audio=null,voice=null,audioState=null;
 const popSeen=new WeakSet(),popVoices=new Set();let popPlays=0;
 const buffers=new Map(),jobs=new Map(),voices=new Set();
 const raw=new Map([2].map(id=>[id,fetch(new URL('audio/pour_0'+id+'_loop.wav',document.baseURI)).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).catch(()=>null)]));
 function unlockAudio(){
  if(ui.gimmickAudio===false||g.screen!=='gimmick'||!g.gimmick?.fluid)return;
  try{
   audio??=new(window.AudioContext||window.webkitAudioContext)();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   for(const id of [2])if(!jobs.has(id))jobs.set(id,raw.get(id).then(b=>{if(!b)throw Error('Missing pour audio');return audio.decodeAudioData(b.slice(0));}).then(b=>buffers.set(id,b)).catch(()=>console.warn('Pour sound '+id+' unavailable')));
  }catch{}
 }
 function stopAudio(immediate=false){
  if(immediate){
   for(const v of popVoices){try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();v.filter?.disconnect();}popVoices.clear();
   for(const v of voices){try{v.source.stop();}catch{}v.source.disconnect();v.tone.disconnect();v.gain.disconnect();}
   voices.clear();voice=null;return;
  }
  const v=voice;if(!v)return;voice=null;
  const now=audio.currentTime;
  v.gain.gain.cancelScheduledValues(now);v.gain.gain.setValueAtTime(v.gain.gain.value,now);
  v.gain.gain.linearRampToValueAtTime(0,now+.08);v.source.stop(now+.085);
 }
 function syncAudio(s,screen){
  if(audioState!==s){stopAudio(true);audioState=s;}
  const selected=2;
  const f=s.fluid,paused=g.isPaused()||document.hidden||ui.gimmickAudio===false;
  // Match the physical emitter, including the short remaining flow while the bottle rises.
  const flowing=s.started&&f.flowNow>.01&&f.emittedMl<f.supplyMl-1e-8;
  if(f.popped&&!popSeen.has(s)){popSeen.add(s);if(!paused)playPop();}
  if(paused)stopAudio(true);
  else if(!flowing)stopAudio();
  else if(audio?.state==='running'&&buffers.has(selected)){
   if(!voice){
    const v={source:audio.createBufferSource(),gain:audio.createGain(),tone:audio.createBiquadFilter()};
    v.source.buffer=buffers.get(selected);v.source.loop=true;
    v.tone.type='highshelf';v.tone.frequency.value=1800;v.source.connect(v.tone);v.tone.connect(v.gain);v.gain.connect(window.LunaSfx.output(audio));
    v.gain.gain.setValueAtTime(0,audio.currentTime);
    v.source.onended=()=>{v.source.disconnect();v.tone.disconnect();v.gain.disconnect();voices.delete(v);if(voice===v)voice=null;};
    voice=v;voices.add(v);v.source.start();
   }
   voice.tone.gain.setTargetAtTime(-1.5+Math.min(1,f.caughtMl/f.targetMl)*2.5,audio.currentTime,.12);
   voice.gain.gain.setTargetAtTime(window.LunaSfx.level("pour"+selected)*Math.sqrt(Math.min(1.4,f.flowNow/Math.max(1,f.rate))),audio.currentTime,.035);
  }
  screen.dataset.pourSound=selected;screen.dataset.popSoundCount=String(popPlays);
  screen.dataset.pourAudioReady=String(buffers.has(selected));
  screen.dataset.pourAudioPlaying=String(!!voice);
  const status=screen.querySelector('[data-pour-audio-status]');
  if(status)status.textContent=ui.gimmickAudio===false?L('음소거','Muted'):audio&&!buffers.has(selected)?L('음원 준비 중 / 로드 실패 시 새로고침','Loading / reload if unavailable'):'';
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio(true);});
 window.addEventListener('blur',()=>stopAudio(true));
 window.addEventListener('pagehide',()=>stopAudio(true));


 const images=new Map();let dragging=null;const idleState=new WeakMap();
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),snap=v=>Math.round(v/3)*3;
 function mode(){return ui.pourPresentation==='clean'?'clean':'classic';}
 function release(){if(dragging){dragging.s.held=false;dragging.s.dragAngle=null;dragging=null;}}
 function pointer(e){
  if(!dragging||e.pointerId!==dragging.pointerId)return;const s=dragging.s;if(g.gimmick!==s||g.isPaused()||document.hidden){release();return;}
  const r=dragging.canvas.getBoundingClientRect(),scale=Math.min(r.width/1000,r.height/540);
  const x=(e.clientX-r.left-(r.width-1000*scale)/2)/scale,y=(e.clientY-r.top-(r.height-540*scale)/2)/scale;
  let angle=Math.atan2(-(x-530),y-220)*180/Math.PI;
  if(angle< -90)angle=170;else if(angle<0)angle=0;
  s.dragAngle=clamp(angle,0,s.fluid.maxAngle);
 }
 document.addEventListener('pointerdown',e=>{
  const canvas=e.target.closest('[data-pixel-pour]'),s=g.gimmick;
  if(!canvas||e.button!==0||g.screen!=='gimmick'||!s?.fluid||g.isPaused()||s.fluid.finishRequested)return;
  e.preventDefault();unlockAudio();dragging={canvas,s,pointerId:e.pointerId};g.holdPour(true);pointer(e);
  canvas.setPointerCapture?.(e.pointerId);
 });
 window.addEventListener('pointermove',pointer);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
 function act(name,id){const s=g.gimmick;if(g.screen!=='gimmick'||!s?.fluid)return false;
  if(root.LunaPourTutorial?.action(g,name,id))return true;
  return false;
 }
 function key(e){const s=g.gimmick;if(g.screen!=='gimmick'||!s?.fluid||g.isPaused())return false;
  if(e.code==='Escape'){release();g.holdPour(false);return false;}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat){release();s.dragAngle=145;g.holdPour(true);}return true;}
  if(e.code==='Enter'&&!e.target.closest('[data-pour-ui]')){e.preventDefault();if(!e.repeat)g.endGimmick();return true;}
  return false;
 }
 function html(s){const f=s.fluid;return '<div class="craft-screen fluid-screen pixel-fluid-screen">'+
  (g.minigame?button(L('다른 기믹 선택','Other minigames'),'miniExit','','gimmick-exit'):'')+
  '<img class="gimmick-room-background" src="'+esc(D.assets.gimmick.src)+'" alt="" draggable="false">'+
  '<div class="pour-perfect" data-pour-perfect role="status" hidden>PERFECT</div><div class="pour-workspace"><div class="pour-stage" data-fluid-stage><canvas data-pixel-pour width="1000" height="540" aria-label="'+L('드래그하여 병 또는 캔 기울이기','Drag to tilt the bottle or can')+'"></canvas></div>'+
  '<div class="pour-top-readout"><div><span>'+L('목표량','Target')+'</span><strong class="pour-target-value">'+s.target+' '+s.unit+'</strong></div><div><span>'+L('현재량','Current')+'</span><strong data-pour-value>0.00 '+s.unit+'</strong></div><small data-pour-detail></small></div>'+
  '<div class="pour-ingredient-readout" role="status"><span>'+L('재료 이름','Ingredient')+'</span><strong data-pour-ingredient="'+esc(s.ingredient)+'">'+esc(g.name(s.ingredient))+'</strong></div></div>'+
  '<div class="pour-tilt-meter" data-pour-tilt role="meter" aria-label="'+L('기울이기','Tilt')+'" aria-valuemin="0" aria-valuemax="'+f.maxAngle+'" aria-valuenow="0"><span>'+L('기울이기','Tilt')+'</span><div class="pour-tilt-track"><i class="pour-tilt-range"></i><i class="pour-tilt-warning"></i><i class="pour-tilt-marker"></i></div></div>'+
  button(f.finishRequested?L('마지막 방울 정리 중…','Settling final drops…'):L('따르기 마치기 →','Finish pouring →'),'endGimmick',(!s.started||f.finishRequested?'disabled':''),'pour-finish gimmick-finish')+'<div class="pour-tutorial" hidden></div></div>';
 }

 function playPop(){
  if(audio?.state!=='running')return;
  const now=audio.currentTime;
  // The supplied bottle-opening HTML's pop: 120ms high-passed noise + falling sine.
  const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.12),audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
  source.buffer=buffer;filter.type='highpass';filter.frequency.value=1200;gain.gain.value=.35;
  source.connect(filter);filter.connect(gain);gain.connect(root.LunaSfx.output(audio));
  const add=v=>{popVoices.add(v);v.source.onended=()=>{v.source.disconnect();v.filter?.disconnect();v.gain.disconnect();popVoices.delete(v);};};
  add({source,filter,gain});source.start(now);
  const tone=audio.createOscillator(),envelope=audio.createGain();tone.type='sine';tone.frequency.setValueAtTime(600,now);tone.frequency.exponentialRampToValueAtTime(180,now+.25);envelope.gain.setValueAtTime(.15,now);envelope.gain.exponentialRampToValueAtTime(.0001,now+.25);tone.connect(envelope);envelope.connect(root.LunaSfx.output(audio));add({source:tone,gain:envelope});tone.start(now);tone.stop(now+.25);popPlays++;
 }
 function idleGuide(ctx,s){
  const now=g.realTime||0,f=s.fluid;let idle=idleState.get(s);if(!idle){idle={since:now};idleState.set(s,idle);}
  if(s.held||s.angle>.1||f.airMl>.01||f.finishRequested||g.isPaused()||document.hidden){idle.since=now;s.idleGuideVisible=false;return;}
  const age=now-idle.since-.55;s.idleGuideVisible=age>0;if(age<=0)return;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches,u=reduced?.5:(age%3)/3;
  const travel=clamp((u-.16)/.65,0,1),eased=travel*travel*(3-2*travel),fade=Math.min(1,age*2);
  // A circular sweep keeps the curvature and arrowhead tangent consistent.
  // Match the main tutorial's flowing cyan dashes; adapt the grip height for cans.
  const cx=438,cy=f.can?142:175,radius=f.can?88:112,start=Math.PI/2,end=3.96,a=start+(end-start)*eased;
  const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
  ctx.save();ctx.globalAlpha=fade*.62;ctx.strokeStyle='#baffff';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor='#44d8e955';ctx.shadowBlur=4;ctx.setLineDash([10,8]);ctx.lineDashOffset=reduced?0:-age*30;
  ctx.beginPath();ctx.arc(cx,cy,radius,start,end);ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0;
  ctx.save();ctx.translate(cx+Math.cos(end)*radius,cy+Math.sin(end)*radius);ctx.rotate(end+Math.PI/2);
  ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(0,0);ctx.lineTo(-10,7);ctx.stroke();ctx.restore();
  ctx.shadowBlur=0;
  // Pause at the grip, press, drag, then fade out before returning (no backward swipe).
  const cursorAlpha=reduced?1:Math.min(clamp(u/.08,0,1),clamp((1-u)/.14,0,1)),pressed=reduced||(u>=.1&&u<.86);
  ctx.globalAlpha=fade*.9*cursorAlpha;ctx.translate(x,y);ctx.fillStyle='#101c25';ctx.beginPath();ctx.roundRect(-10,-15,20,30,8);ctx.fill();ctx.stroke();
  ctx.fillStyle=pressed?'#9ae6ea':'#29434c';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(0,-2);ctx.lineTo(-8,-2);ctx.lineTo(-8,-7);ctx.quadraticCurveTo(-8,-13,0,-13);ctx.fill();
  ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(0,-2);ctx.moveTo(-9,-2);ctx.lineTo(9,-2);ctx.stroke();ctx.restore();
 }

 const fizzStyles={
  beer:{rgb:[218,157,45],alpha:.82,bubble:'#ffedac',foam:'#f5e9c9',shade:'#c4b389',highlight:'#fff8e4'},
  soda_water:{rgb:[149,198,218],alpha:.36,bubble:'#e3faff',foam:'#e7f4f7',shade:'#9cbfc9',highlight:'#ffffff'},
  cola:{rgb:[76,36,20],alpha:.92,bubble:'#e1b278',foam:'#dec298',shade:'#a47c50',highlight:'#ffebc8'}
 };
 function appearance(id){
  if(fizzStyles[id])return fizzStyles[id];
  const item=g.t.shelf_items.find(i=>i.id===id),values=String(item?.color||'200,230,240').split(',').map(Number);
  return{rgb:values.length===3&&values.every(Number.isFinite)?values:[200,230,240],alpha:Math.max(.4,Number(item?.liquid_alpha)||.6)};
 }
 function carbonation(ctx,s,sy,t){
  const f=s.fluid,b=f.glass;if(!f.carbonated||f.liquidMl<=1)return;
  const style=fizzStyles[s.ingredient]||fizzStyles.soda_water,depth=b.bottom-sy,count=Math.min(66,Math.max(12,Math.floor(depth*.55)));
  ctx.save();ctx.beginPath();ctx.rect(b.left+4,sy,b.right-b.left-8,Math.max(0,depth-3));ctx.clip();
  for(let i=0;i<count;i++){
   // Narrow columns rise at different speeds, expanding slightly near the surface.
   const phase=(t*(.25+i%5*.065)+i*.137)%1,x=snap(b.left+9+(i*37%(b.right-b.left-22))+Math.sin(t*3+i)*2),y=snap(b.bottom-4-phase*depth),size=phase>.55&&i%3===0?5:3;
   ctx.globalAlpha=.45+phase*.45;ctx.strokeStyle=style.bubble;ctx.lineWidth=1;
   if(size===5)ctx.strokeRect(x,y,size,size);else{ctx.fillStyle=style.bubble;ctx.fillRect(x,y,2,2);}
  }
  ctx.restore();
 }
 function bottle(ctx,s){const f=s.fluid,at=root.LunaPour.nozzle(s.angle,f.tool,f.grab),art=D.assets['item_'+s.ingredient]||D.assets.item_dummy;
  let img=images.get(art.src);if(!img){img=new Image();img.src=art.src;images.set(art.src,img);}
  const box=art.alphaBBox||[0,0,art.w,art.h],bw=box[2]-box[0],bh=box[3]-box[1],h=f.can?128:210,w=bw/bh*h;
  ctx.save();ctx.translate(at.x,at.y);ctx.rotate(s.angle*Math.PI/180);ctx.imageSmoothingEnabled=false;
  const neck=f.tool==='pourer'&&!f.popped?23:0,cut=f.can?0:Math.round(bh*.065);
  if(img.complete&&img.naturalWidth)ctx.drawImage(img,box[0],box[1]+cut,bw,bh-cut,f.can?-w+12:-w/2,neck,w,h);
  if(neck){ctx.fillStyle='#52616a';ctx.fillRect(-5,0,10,26);ctx.fillStyle='#cfdddf';ctx.fillRect(-3,0,3,23);ctx.fillStyle='#14212c';ctx.fillRect(-8,22,16,8);}
  ctx.fillStyle='#101d24';ctx.fillRect(-4,0,8,3);ctx.restore();
  if(f.cap&&f.time-f.popTime<2.4){const c=f.cap;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rotation);ctx.fillStyle='#52616a';ctx.fillRect(-5,-13,10,26);ctx.fillStyle='#cfdddf';ctx.fillRect(-3,-13,3,23);ctx.fillStyle='#14212c';ctx.fillRect(-8,9,16,8);ctx.restore();}
 }
 function draw(ctx,s){
  const f=s.fluid,b=f.glass,{rgb,alpha}=appearance(s.ingredient),color='rgba('+rgb.join(',')+','+alpha+')',sy=snap(f.surfaceY),fh=snap(f.foamHeight()),t=f.time;
  ctx.clearRect(0,0,1000,540);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#0005';ctx.fillRect(b.left-20,b.bottom+6,b.right-b.left+40,6);
  ctx.fillStyle='#25344066';ctx.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
  ctx.save();ctx.beginPath();ctx.rect(b.left+3,b.top,b.right-b.left-6,b.bottom-b.top);ctx.clip();
  if(f.liquidMl>.02){ctx.fillStyle=color;ctx.fillRect(b.left+3,sy,b.right-b.left-6,b.bottom-sy);
   for(let x=b.left+3;x<b.right-3;x+=3){const wave=Math.round(Math.sin(x*.1+t*9)*f.wobble*2)*3;ctx.fillStyle='#d9e6edaa';ctx.fillRect(snap(x),sy+wave,3,3);}
  }
  carbonation(ctx,s,sy,t);
  if(fh>0){const style=fizzStyles[s.ingredient]||fizzStyles.soda_water,top=sy-fh;ctx.fillStyle=style.foam;ctx.fillRect(b.left+3,top,b.right-b.left-6,fh);
   for(let x=b.left+3;x<b.right-3;x+=3){const wave=Math.round(Math.sin(x*.3+t*5))*3;ctx.fillRect(snap(x),top+wave,3,4);}
   ctx.save();ctx.beginPath();ctx.rect(b.left+3,top,b.right-b.left-6,fh);ctx.clip();
   for(let i=0;i<Math.min(150,Math.ceil(fh*2));i++){const seed=Math.sin(i*127.1+7.3)*43758.5453,seedY=Math.sin(i*311.7+19.1)*19341.137,x=snap(b.left+6+(seed-Math.floor(seed))*(b.right-b.left-15)),y=snap(top+((seedY-Math.floor(seedY))+t*.012)%1*Math.max(3,fh));ctx.strokeStyle=style.shade;ctx.lineWidth=1;ctx.strokeRect(x,y,i%3?3:5,3);ctx.fillStyle=style.highlight;ctx.fillRect(x,y,2,1);}
   ctx.restore();
   // A few surface bubbles burst above the foam instead of reading as flat fill.
   for(let i=0;i<7;i++){const u=(t*1.7+i*.19)%1;if(u>.45)continue;const x=snap(b.left+10+i*19),y=snap(top-2-u*8);ctx.fillStyle=style.highlight;ctx.globalAlpha=(1-u/.45)*.8;ctx.fillRect(x-2-u*5,y,2,2);ctx.fillRect(x+2+u*5,y,2,2);}ctx.globalAlpha=1;
  }
  ctx.restore();
  ctx.fillStyle=color;
  for(let i=0;i<f.particles.length;i++){const a=f.particles[i],z=f.particles[i+1];const w=f.tool==='none'||f.popped?5:3;
   if(z&&z.id===a.id+1){const n=Math.min(80,Math.ceil(Math.hypot(z.x-a.x,z.y-a.y)/2));for(let k=0;k<=n;k++)ctx.fillRect(snap(a.x+(z.x-a.x)*k/Math.max(1,n)),snap(a.y+(z.y-a.y)*k/Math.max(1,n)),w,3);}
   else ctx.fillRect(snap(a.x),snap(a.y),w,3);
   if(f.carbonated&&i%7===0){ctx.fillStyle=(fizzStyles[s.ingredient]||fizzStyles.soda_water).bubble;ctx.fillRect(snap(a.x),snap(a.y),2,2);ctx.fillStyle=color;}
  }
  ctx.fillStyle='#e8f1e9bb';for(const p of f.splash)ctx.fillRect(snap(p.x),snap(p.y),3,3);
  ctx.fillStyle='#b0d1d5bb';ctx.fillRect(b.left,b.top,3,b.bottom-b.top);ctx.fillRect(b.right-3,b.top,3,b.bottom-b.top);ctx.fillRect(b.left,b.bottom-3,b.right-b.left,3);ctx.fillRect(b.left-3,b.top,b.right-b.left+6,2);ctx.fillStyle='#d6edef55';ctx.fillRect(b.left+9,b.top+10,3,b.bottom-b.top-30);
  if(mode()==='classic'){const y=snap(b.bottom-f.targetMl*f.mlPx);ctx.fillStyle='#e4c885';for(let x=b.left-9;x<b.right+12;x+=10)ctx.fillRect(x,y,6,2);}
  bottle(ctx,s);
  idleGuide(ctx,s);
  const age=f.popped?f.time-f.popTime:Infinity;
  if(age<.9){ctx.save();ctx.globalAlpha=Math.min(1,(.9-age)*2);ctx.font='bold 40px LunaPixel, sans-serif';ctx.fillStyle='#ffdf8a';ctx.textAlign='center';ctx.fillText(L('펑!','POP!'),667,110-age*37);ctx.restore();}

 }
 function sync(rootElement){
  const s=g.gimmick,stage=g.screen==='gimmick'&&s?.fluid&&rootElement.querySelector('[data-fluid-stage]');
  if(!stage){release();stopAudio(true);audioState=null;return;}
  if(g.isPaused()||document.hidden){release();s.held=false;}
  syncAudio(s,stage.closest('.fluid-screen'));
  const f=s.fluid,age=f.popped?f.time-f.popTime:Infinity,reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const strength=!reduced&&age<.35?(.35-age)*40/2.184:0,dx=Math.sin(age*173)*strength*.5||0,dy=Math.cos(age*137)*strength*.5||0;
  const transform='translate('+dx+'px,'+dy+'px)';stage.style.transform=transform;const bg=rootElement.querySelector('.fluid-screen .gimmick-room-background');if(bg)bg.style.transform=transform;
  draw(stage.querySelector('canvas').getContext('2d'),s);stage.dataset.idleGuide=String(!!s.idleGuideVisible);stage.dataset.popFx=String(age<.9);
  stage.dataset.renderer='pixel-canvas2d';stage.dataset.pourTool=f.tool;stage.dataset.carbonation=String(f.carbonated);stage.dataset.container=f.can?'can':'bottle';stage.dataset.foam=String(f.foamMl);stage.dataset.nozzle=JSON.stringify(root.LunaPour.nozzle(s.angle,f.tool,f.grab));
  stage.style.cursor=s.held?'grabbing':'grab';
  const set=(selector,value)=>{const e=rootElement.querySelector(selector);if(e)e.textContent=value;};
  set('[data-pour-value]',s.value.toFixed(2)+' '+s.unit);
  const meter=rootElement.querySelector('[data-pour-tilt]');
  if(meter){
   const start=f.can?65+85*f.emittedMl/f.supplyMl:f.popped||f.tool==='none'?80:98;
   const hasPourer=!f.can&&f.tool==='pourer'&&!f.popped,end=hasPourer?160:f.maxAngle;
   meter.style.setProperty('--tilt-position',clamp(s.angle/f.maxAngle,0,1)*100+'%');
   meter.style.setProperty('--tilt-start',clamp(start/f.maxAngle,0,1)*100+'%');
   meter.style.setProperty('--tilt-range',Math.max(0,end-start)/f.maxAngle*100+'%');
   meter.style.setProperty('--tilt-warning',hasPourer?(f.maxAngle-end)/f.maxAngle*100+'%':'0%');
   meter.setAttribute('aria-valuenow',String(Math.round(s.angle)));
  }
  set('[data-pour-detail]',(f.carbonated?L('현재량은 거품 속 음료까지 포함','Includes liquid held in foam'):'')+(f.spilledMl>.05?' · '+L('넘침 ','Spilled ')+f.spilledMl.toFixed(1)+' ml':''));
  const perfect=rootElement.querySelector('[data-pour-perfect]');if(perfect)perfect.hidden=!s.pourFinishFx?.perfect;
  root.LunaPourTutorial?.sync(g,stage.closest('.fluid-screen'),L);
 }
 return{html,sync,unlockAudio,act,key};
};
})(window);
