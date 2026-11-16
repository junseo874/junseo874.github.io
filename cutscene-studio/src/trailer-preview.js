(function(W){'use strict';
const $=id=>document.getElementById(id),{scenes,total,emotions}=W.LunaTrailerSequence;
const stage=$('stage'),composition=$('composition'),frame=$('game'),card=$('card'),title=card.querySelector('h2'),logo=card.querySelector('img'),canvas=$('serve'),ctx=canvas.getContext('2d');
let video=$('footage');const videoPlayers=new Map();
const bridge=new W.LunaTrailerGame(frame),rain=new Audio('../bar-playtest/assets/audio/effects/ambience/rain-loop.ogg'),noise=new Audio('assets/opening/memory-noise.wav');rain.loop=true;noise.loop=true;
const effects=new W.LunaTrailerEffects(card,logo),fxAudio=new W.LunaTrailerAudio();
let ready=false,playing=false,loading=false,time=0,index=-1,last=0,generation=0,raf=0;const media=new Map(),images=new Map();
const clamp=v=>Math.max(0,Math.min(1,v)),stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const assetRoot='../bar-playtest/';
function fit(){const r=stage.getBoundingClientRect();composition.style.transform=`scale(${Math.min(r.width/1280,r.height/720)})`;}
new ResizeObserver(fit).observe(stage);document.addEventListener('fullscreenchange',fit);
function show(el,value){el.style.visibility=value?'visible':'hidden';}
function audio(a,volume){a.volume=clamp(volume*Number($('volume').value));if(playing&&!loading&&volume>0){if(a.paused)a.play().catch(()=>{});}else a.pause();}
function sound(){const s=scenes[index],t=time-(s?.start||0);
 const rainy=s?.file==='street-run'||s?.kind==='terrace'||s?.kind==='outside';
 audio(rain,rainy?.55:0);
 audio(noise,s?.kind==='identity'&&t>1.8&&t<2.65?.3:s?.kind==='logo'&&effects.canvas.dataset.glitch==='true'?.22:0);
 if(!s)return;
 fxAudio.paint(s,t,playing&&!loading,Number($('volume').value),['bar','terrace','outside'].includes(s.kind)?bridge.speech:null);
}
function syncControls(){ $('clock').textContent=`${stamp(time)} / ${stamp(total)}`;$('seek').value=time;$('play').textContent=playing?'일시정지':'재생';}
function stop(){playing=false;video.pause();rain.pause();noise.pause();fxAudio.stop();fxAudio.dialogue(null,false,0);syncControls();}
function failure(error){stop();loading=false;$('loading').hidden=false;$('loading').textContent='불러오지 못했습니다: '+error.message+' · 새로고침해 주세요.';console.error(error);}
function sourceTime(s,t,player){
 const held=s.holdAt==null?0:Math.max(0,Math.min(t-s.holdAt,s.holdDuration));
 const elapsed=t-held;
 return Math.min((s.offset||0)+elapsed*(s.playbackRate||1),Math.max(0,player.duration-.04));
}
async function prepareVideo(s,t){
 const next=videoPlayers.get(s.file);
 if(video!==next){video.removeAttribute('id');video=next;video.id='footage';}
 video.playbackRate=s.playbackRate||1;
 const target=sourceTime(s,t,video);
 if(Math.abs(video.currentTime-target)>.04){
  const reset=new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));video.currentTime=target;await reset;
 }
}
let stagedScene=null,stagedWork=Promise.resolve();
function stageGame(s){
 if(stagedScene!==s){
  stagedScene=s;
  stagedWork=stagedWork.catch(()=>{}).then(()=>bridge.enter(s));
 }
 return stagedWork;
}
async function enter(next){
 const ticket=++generation;index=next;const s=scenes[index];loading=true;video.pause();sound();
 try{
  if(['bar','terrace','outside','open'].includes(s.kind)){await stageGame(s);}
  if(s.kind==='video')await prepareVideo(s,Math.max(0,time-s.start));
  if(ticket!==generation)return;
  for(const player of videoPlayers.values())show(player,s.kind==='video'&&player===video);
  const onCard=['black','card','identity','emotions','logo'].includes(s.kind);
  show(canvas,s.kind==='serve');show(card,onCard);
  title.hidden=false;logo.hidden=true;effects.canvas.hidden=true;title.classList.toggle('emotion-card',s.kind==='emotions');delete title.dataset.emotion;
  if(onCard){title.textContent=s.text||'';if(s.kind==='logo'){title.hidden=true;logo.hidden=false;}}
  show(frame,['bar','terrace','outside','open'].includes(s.kind));
  loading=false;$('loading').hidden=true;
  $('status').textContent=s.title+(s.kind==='video'?' · 기존 촬영본':' · 트레일러 전용 연출');
  for(const [i,b]of [...$('chapters').children].entries())b.setAttribute('aria-current',String(i===index));
  paint(true);sound();
  const following=scenes[next+1];
  if(s.kind==='card'&&following?.kind==='outside')stageGame(following).catch(error=>{if(index===next)failure(error);});
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
function paint(seek=false){
 const s=scenes[index];if(!s||loading)return;const t=Math.max(0,time-s.start);
 if(['bar','terrace','outside','open'].includes(s.kind))bridge.paint(t);
 if(s.kind==='video'){
  const holding=s.holdAt!=null&&t>=s.holdAt&&t<s.holdAt+s.holdDuration;
  const target=sourceTime(s,t,video);
  if(Math.abs(video.currentTime-target)>(seek||holding?.025:.18))video.currentTime=target;
  if(playing&&!holding){if(video.paused)video.play().catch(()=>{});}else video.pause();
 }
 if(s.kind==='serve')serve(t,s);
 let glitch=false;
 if(s.kind==='identity'){glitch=t>1.8&&t<2.65;title.textContent=glitch?s.alternate:s.text;title.dataset.text=title.textContent;}
 if(s.kind==='emotions')effects.emotions(title,t,s.duration,emotions);
 if(s.kind==='logo')effects.logo(t);
 const signal=glitch&&Math.floor(t*24)%3!==0;
 composition.classList.toggle('glitch',s.kind==='logo'&&signal);
 composition.classList.toggle('text-glitch',s.kind==='identity'&&signal);
 title.style.setProperty('--slice-shift',`${Math.floor(t*30)%2?11:-9}px`);
 sound();syncControls();
}
async function seek(value){if(!ready||loading)return;time=Math.max(0,Math.min(total-.001,value));const next=scenes.findIndex(s=>time<s.end);if(next!==index)await enter(next);else paint(true);syncControls();}
function loop(now){
 const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(playing&&!loading){time+=dt;if(time>=total){time=total;paint(true);stop();}else {const next=scenes.findIndex(s=>time<s.end);if(next!==index)enter(next);}}
 // Repaint the frozen frame as asynchronous sprite decodes complete, too.
 if(!loading&&time<total)paint();
 raf=requestAnimationFrame(loop);
}
$('seek').max=total;
scenes.forEach((s,i)=>{const b=document.createElement('button'),small=document.createElement('small');small.textContent=stamp(s.start);b.append(small,document.createTextNode(s.title));b.onclick=()=>seek(s.start);$('chapters').append(b);});
$('play').onclick=()=>{if(!ready||loading)return;if(playing)stop();else{if(time>=total)seek(0);playing=true;last=performance.now();sound();syncControls();}};
$('restart').onclick=()=>{stop();seek(0);};$('seek').oninput=e=>seek(Number(e.target.value));$('volume').oninput=sound;
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():stage.requestFullscreen();
document.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.code==='ArrowRight'){e.preventDefault();seek(time+5);}if(e.code==='ArrowLeft'){e.preventDefault();seek(time-5);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();cancelAnimationFrame(raf);for(const url of media.values())URL.revokeObjectURL(url);});
async function init(){
 await bridge.init();
 await Promise.all([fxAudio.prepare(),document.fonts.load('38px LunaPixel')]);
 const sheets={background:bridge.w.LUNA_SERVE_BACKGROUND,...bridge.w.LUNA_SERVE_SHEETS};
 for(const [key,s]of Object.entries(sheets)){const img=new Image();img.src=assetRoot+s.src;await img.decode();images.set(key,img);}
 // Cache the small edited clips before playback so cuts do not buffer midway.
 await Promise.all([...new Set(scenes.filter(s=>s.file).map(s=>s.file))].map(async file=>{
  const src=`assets/trailer/${file}.mp4?v=${file==='seoul-puddle'?6:file==='pour-soda'?3:2}`,r=await fetch(src);if(!r.ok)throw Error(file+' 영상 없음');
  const url=URL.createObjectURL(await r.blob());media.set(file,url);
  // Decode each first frame up front as well as fetching bytes: hard cuts must
  // not wait on a new source load or expose a black/loading frame.
  const player=document.createElement('video');player.className='trailer-footage';player.muted=true;player.playsInline=true;player.preload='auto';show(player,false);
  const loaded=new Promise((resolve,reject)=>{player.addEventListener('loadeddata',resolve,{once:true});player.addEventListener('error',()=>reject(Error(file+' 영상 디코딩 실패')),{once:true});});
  composition.insertBefore(player,canvas);player.src=url;player.load();await loaded;
  const offset=scenes.find(s=>s.file===file)?.offset||0;
  if(offset){const primed=new Promise(resolve=>player.addEventListener('seeked',resolve,{once:true}));player.currentTime=offset;await primed;}
  videoPlayers.set(file,player);
 }));
 await enter(0);ready=true;$('play').disabled=false;$('restart').disabled=false;raf=requestAnimationFrame(loop);
}
W.lunaTrailerPreview={scenes,total,seek,fxAudio,get time(){return time;},get ready(){return ready;},get loading(){return loading;},get playing(){return playing;},stop};
init().catch(failure);
})(window);
