(function(W){'use strict';
const $=id=>document.getElementById(id),{scenes,total,emotions}=W.LunaTrailerSequence;
const stage=$('stage'),composition=$('composition'),frame=$('game'),card=$('card'),title=card.querySelector('h2'),logo=card.querySelector('img'),canvas=$('serve'),ctx=canvas.getContext('2d');
let video=$('footage');const videoPlayers=new Map();
const bridge=new W.LunaTrailerGame(frame),rain=new Audio('../bar-playtest/assets/audio/effects/ambience/rain-loop.ogg'),noise=new Audio('assets/opening/memory-noise.wav');rain.loop=true;noise.loop=true;
const effects=new W.LunaTrailerEffects(card,logo),fxAudio=new W.LunaTrailerAudio();
const wetCanvas=document.createElement('canvas'),wetSource=document.createElement('canvas');
for(const c of [wetCanvas,wetSource]){c.width=1280;c.height=720;}
wetCanvas.id='intro-window-rain';composition.insertBefore(wetCanvas,$('fade'));
const wetState={scene:'street',config:{day:0,flow:'out'},time:0};
const teamScene=scenes.find(s=>s.file==='team'),introTerrace=scenes.find(s=>s.kind==='terrace');
let ready=false,playing=false,loading=false,time=0,index=-1,last=0,generation=0,raf=0;const media=new Map(),images=new Map();
const clamp=v=>Math.max(0,Math.min(1,v)),stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const assetRoot='../bar-playtest/';
const sameMontage=(a,b)=>!!a?.montage&&a.montage===b?.montage;
function fit(){const r=stage.getBoundingClientRect();composition.style.transform=`scale(${Math.min(r.width/1280,r.height/720)})`;}
new ResizeObserver(fit).observe(stage);document.addEventListener('fullscreenchange',fit);
function show(el,value){el.style.visibility=value?'visible':'hidden';}
function audio(a,volume){a.volume=clamp(volume*Number($('volume').value));if(playing&&!loading&&volume>0){if(a.paused)a.play().catch(()=>{});}else a.pause();}
function sound(){const s=scenes[index],t=time-(s?.start||0);
 const rise=clamp(time/4),softRise=rise*rise*(3-2*rise);
 const introRain=time<teamScene.end?softRise*clamp((teamScene.end-time)/.9)*.75:0;
 audio(rain,introRain||(s?.file==='street'||s?.kind==='terrace'||s?.kind==='outside'?.55:0));
 audio(noise,s?.kind==='identity'&&t>1.8&&t<2.65?.3:s?.kind==='logo'&&effects.canvas.dataset.glitch==='true'?.22:0);
 if(!s)return;
 fxAudio.paint(s,t,playing&&!loading,Number($('volume').value),['bar','terrace','outside'].includes(s.kind)?bridge.speech:null);
}
function syncControls(){ $('clock').textContent=`${stamp(time)} / ${stamp(total)}`;$('seek').value=time;$('play').textContent=playing?'일시정지':'재생';}
function stop(){playing=false;video.pause();rain.pause();noise.pause();fxAudio.stop();fxAudio.dialogue(null,false,0);syncControls();}
function failure(error){stop();loading=false;$('loading').hidden=false;$('loading').textContent='불러오지 못했습니다: '+error.message+' · 새로고침해 주세요.';console.error(error);}
async function prepareVideo(s){
 const next=videoPlayers.get(s.file);
 if(video!==next){video.removeAttribute('id');video=next;video.id='footage';}
 video.playbackRate=s.playbackRate||1;
}
async function enter(next){
 const hardCut=sameMontage(scenes[index],scenes[next]);
 const ticket=++generation;index=next;const s=scenes[index];loading=true;video.pause();sound();$('loading').hidden=hardCut;$('loading').textContent='장면 준비 중...';
 bridge.introRainShared=s===introTerrace;
 // Montage cuts reuse prepared views, without a fade or loading-screen flash.
 if(!hardCut)show(frame,false);show(video,false);show(canvas,false);show(card,false);title.hidden=false;logo.hidden=true;
 effects.canvas.hidden=true;title.classList.toggle('emotion-card',s.kind==='emotions');delete title.dataset.emotion;
 try{
  if(['bar','terrace','outside','open'].includes(s.kind)){await bridge.enter(s);show(frame,true);}
  if(s.kind==='video'){await prepareVideo(s);show(video,true);}
  if(s.kind==='serve')show(canvas,true);
  if(['black','card','identity','emotions','logo'].includes(s.kind)){show(card,true);title.textContent=s.text||'';if(s.kind==='logo'){title.hidden=true;logo.hidden=false;}}
  if(ticket!==generation)return;
  loading=false;$('loading').hidden=true;
  $('status').textContent=s.title+(s.kind==='video'?' · 기존 촬영본':' · 트레일러 전용 연출');
  for(const [i,b]of [...$('chapters').children].entries())b.setAttribute('aria-current',String(i===index));
  paint(true);sound();
 }catch(e){if(ticket===generation)failure(e);}
}
function serve(t,s){
 const w=bridge.w,keys=[...Object.keys(w.LUNA_SERVE_SHEETS).filter(key=>key!=='dry_martini'),'dry_martini'];
 // Source: 30 frames at 20 fps, followed by a 1.8 s final-frame hold.
 // All cocktails share the hand timing; dry martini always finishes the montage.
 const n=Math.min(29,Math.floor((t+1e-7)*20)),sx=2+(n%6)*956,sy=2+Math.floor(n/6)*541;
 const key=keys[Math.floor(n/30*keys.length)]; // Switch only on source-frame boundaries.
 ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(images.get('background'),sx,sy,954,539,3,0,954,539);
 ctx.drawImage(images.get(key),sx,sy,954,539,3,60,954,539);
 canvas.dataset.cocktail=key;canvas.dataset.frame=String(n);
}
function introBackground(ctx,team=false){
 ctx.fillStyle='#020408';ctx.fillRect(0,0,1280,720);
 const glow=ctx.createRadialGradient(team?300:1120,team?80:300,20,team?300:1120,team?80:300,team?900:720);
 glow.addColorStop(0,team?'#15232e':'#17242f');glow.addColorStop(.45,team?'#0b131a':'#0d1020');glow.addColorStop(1,'#000');
 ctx.fillStyle=glow;ctx.fillRect(0,0,1280,720);
 if(!team){const cyan=ctx.createRadialGradient(1180,450,0,1180,450,300);cyan.addColorStop(0,'#14303366');cyan.addColorStop(1,'#0000');ctx.fillStyle=cyan;ctx.fillRect(0,0,1280,720);}
}
function paintIntroRain(s,t){
 wetCanvas.hidden=time>=teamScene.end;
 if(wetCanvas.hidden)return;
 const bg=wetSource.getContext('2d'),out=wetCanvas.getContext('2d');
 introBackground(bg,s===teamScene||s===introTerrace&&t>s.duration-.9);
 if(s===introTerrace){
  const glass=bridge.c.host.querySelector('.terrace-glass'),fall=bridge.c.host.querySelector('.terrace-rain');
  if(glass){bg.save();bg.globalAlpha=clamp(t/1.25)*clamp((s.duration-t)/.9);
   bg.translate(640,360);bg.scale(1.12,1.12);bg.translate(40-80*clamp(t/s.duration),0);
   bg.drawImage(glass,-640,-360,1280,720);if(fall)bg.drawImage(fall,-640,-360,1280,720);bg.restore();}
 }
 if(s===teamScene&&video.readyState>=2){bg.save();bg.globalCompositeOperation='screen';bg.globalAlpha=clamp(t/.55);bg.drawImage(video,0,0,1280,720);bg.restore();}
 out.clearRect(0,0,1280,720);wetState.time=time;
 bridge.w.LunaRainGlass.draw(out,wetState,{source:wetSource,owner:wetState,smoothPresentation:true});
 wetCanvas.style.opacity=String(clamp(time/1.8));
}
function paint(seek=false){
 const s=scenes[index];if(!s||loading)return;const t=Math.max(0,time-s.start);
 if(['bar','terrace','outside','open'].includes(s.kind))bridge.paint(t);
 if(s.kind==='video'){
  const target=Math.min(t*(s.playbackRate||1),Math.max(0,video.duration-.04));
  if(seek||Math.abs(video.currentTime-target)>.18)video.currentTime=target;
  if(playing&&video.paused)video.play().catch(()=>{});else if(!playing)video.pause();
 }
 if(s.kind==='serve')serve(t,s);
 paintIntroRain(s,t);
 let glitch=false;
 if(s.kind==='identity'){glitch=t>1.8&&t<2.65;title.textContent=glitch?s.alternate:s.text;title.dataset.text=title.textContent;}
 if(s.kind==='emotions')effects.emotions(title,t,s.duration,emotions);
 if(s.kind==='logo')effects.logo(t);
 const signal=glitch&&Math.floor(t*24)%3!==0;
 composition.classList.toggle('glitch',s.kind==='logo'&&signal);
 composition.classList.toggle('text-glitch',s.kind==='identity'&&signal);
 title.style.setProperty('--slice-shift',`${Math.floor(t*30)%2?11:-9}px`);
 const montage=['bar','video','serve','outside','open'].includes(s.kind);
 const fadeIn=s.kind==='logo'?1.5:montage?.12:.65,fadeOut=s.kind==='logo'?.85:montage?.12:.55;
 const entering=sameMontage(scenes[index-1],s)||s===introTerrace||s===teamScene?0:1-clamp(t/fadeIn);
 const leaving=s===teamScene?1-clamp((s.duration-t)/.9):sameMontage(s,scenes[index+1])||index===0||s===introTerrace?0:1-clamp((s.duration-t)/fadeOut);
 $('fade').style.opacity=String(Math.max(entering,leaving));
 sound();syncControls();
}
async function seek(value){if(!ready||loading)return;time=Math.max(0,Math.min(total-.001,value));const next=scenes.findIndex(s=>time<s.end);if(next!==index)await enter(next);else paint(true);syncControls();}
function loop(now){
 const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(playing&&!loading){time+=dt;if(time>=total){time=total;stop();$('fade').style.opacity='1';}else {const next=scenes.findIndex(s=>time<s.end);if(next!==index)enter(next);}}
 // Repaint the frozen frame as asynchronous sprite decodes complete, too.
 if(!loading&&time<total)paint();
 raf=requestAnimationFrame(loop);
}
$('seek').max=total;
scenes.forEach((s,i)=>{const b=document.createElement('button'),small=document.createElement('small');small.textContent=stamp(s.start);b.append(small,document.createTextNode(s.title));b.onclick=()=>seek(s.start+.02);$('chapters').append(b);});
$('play').onclick=()=>{if(!ready||loading)return;if(playing)stop();else{if(time>=total)seek(0);playing=true;last=performance.now();sound();syncControls();}};
$('restart').onclick=()=>{stop();seek(0);};$('seek').oninput=e=>seek(Number(e.target.value));$('volume').oninput=sound;
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():stage.requestFullscreen();
document.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight'){e.preventDefault();seek(time+5);}if(e.code==='ArrowLeft'){e.preventDefault();seek(time-5);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();cancelAnimationFrame(raf);for(const url of media.values())URL.revokeObjectURL(url);});
async function init(){
 await bridge.init();
 await fxAudio.prepare();
 const sheets={background:bridge.w.LUNA_SERVE_BACKGROUND,...bridge.w.LUNA_SERVE_SHEETS};
 for(const [key,s]of Object.entries(sheets)){const img=new Image();img.src=assetRoot+s.src;await img.decode();images.set(key,img);}
 // Cache the small edited clips before playback so cuts do not buffer midway.
 await Promise.all([...new Set(scenes.filter(s=>s.kind==='video').map(s=>s.file))].map(async file=>{
  const src=`assets/trailer/${file}.mp4?v=2`,r=await fetch(src);if(!r.ok)throw Error(file+' 영상 없음');
  const url=URL.createObjectURL(await r.blob());media.set(file,url);
  // Decode each first frame up front as well as fetching bytes: hard cuts must
  // not wait on a new source load or expose a black/loading frame.
  const player=document.createElement('video');player.className='trailer-footage';player.muted=true;player.playsInline=true;player.preload='auto';show(player,false);
  const loaded=new Promise((resolve,reject)=>{player.addEventListener('loadeddata',resolve,{once:true});player.addEventListener('error',()=>reject(Error(file+' 영상 디코딩 실패')),{once:true});});
  composition.insertBefore(player,canvas);player.src=url;player.load();await loaded;videoPlayers.set(file,player);
 }));
 ready=true;$('play').disabled=false;$('restart').disabled=false;await enter(0);raf=requestAnimationFrame(loop);
}
W.lunaTrailerPreview={scenes,total,seek,fxAudio,get time(){return time;},get ready(){return ready;},get loading(){return loading;},get playing(){return playing;},stop};
init().catch(failure);
})(window);
