(function(W){'use strict';
const $=id=>document.getElementById(id),{scenes,total,emotions}=W.LunaTrailerSequence;
const stage=$('stage'),composition=$('composition'),video=$('footage'),frame=$('game'),card=$('card'),title=card.querySelector('h2'),logo=card.querySelector('img'),canvas=$('serve'),ctx=canvas.getContext('2d');
const bridge=new W.LunaTrailerGame(frame),rain=new Audio('../bar-playtest/assets/audio/effects/ambience/rain-loop.ogg'),noise=new Audio('assets/opening/memory-noise.wav');rain.loop=true;noise.loop=true;
const colors=['#ffe087','#92baf1','#d7e176','#ff666a','#bb94ed','#ffad69','#ff9bbb','#92e3ca'];
let ready=false,playing=false,loading=false,time=0,index=-1,last=0,generation=0,raf=0;const media=new Map(),images=new Map();
const clamp=v=>Math.max(0,Math.min(1,v)),stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
const assetRoot='../bar-playtest/';
function fit(){const r=stage.getBoundingClientRect();composition.style.transform=`scale(${Math.min(r.width/1280,r.height/720)})`;}
new ResizeObserver(fit).observe(stage);document.addEventListener('fullscreenchange',fit);
function show(el,value){el.style.visibility=value?'visible':'hidden';}
function audio(a,volume){a.volume=clamp(volume*Number($('volume').value));if(playing&&!loading&&volume>0){if(a.paused)a.play().catch(()=>{});}else a.pause();}
function sound(){const rainEnd=scenes.find(s=>s.file==='street').end;audio(rain,time<rainEnd?clamp(time/2)*clamp((rainEnd-time)/.6)*.65:0);const s=scenes[index],t=time-(s?.start||0);audio(noise,s?.kind==='identity'&&t>1.8&&t<2.65?.2:s?.kind==='logo'&&t>2.2&&t<2.7?.17:0);}
function syncControls(){ $('clock').textContent=`${stamp(time)} / ${stamp(total)}`;$('seek').value=time;$('play').textContent=playing?'일시정지':'재생';}
function stop(){playing=false;video.pause();rain.pause();noise.pause();syncControls();}
function failure(error){stop();loading=false;$('loading').hidden=false;$('loading').textContent='불러오지 못했습니다: '+error.message+' · 새로고침해 주세요.';console.error(error);}
async function prepareVideo(s){
 const src=media.get(s.file);
 if(video.getAttribute('src')!==src){video.src=src;video.load();await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error(s.title)),{once:true});});}
}
async function enter(next){
 const ticket=++generation;index=next;const s=scenes[index];loading=true;video.pause();sound();$('loading').hidden=false;$('loading').textContent='장면 준비 중...';
 show(frame,false);show(video,false);show(canvas,false);show(card,false);title.hidden=false;logo.hidden=true;
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
 const w=bridge.w,keys=Object.keys(w.LUNA_SERVE_SHEETS),key=keys[Math.min(keys.length-1,Math.floor(t/s.duration*keys.length))];
 const n=Math.min(29,Math.floor(t/s.duration*30)),sx=2+(n%6)*956,sy=2+Math.floor(n/6)*541;
 ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(images.get('background'),sx,sy,954,539,3,0,954,539);
 ctx.drawImage(images.get(key),sx,sy,954,539,3,60,954,539);
 canvas.dataset.cocktail=key;canvas.dataset.frame=String(n);
}
function paint(seek=false){
 const s=scenes[index];if(!s||loading)return;const t=Math.max(0,time-s.start);
 if(['bar','terrace','outside','open'].includes(s.kind))bridge.paint(t);
 if(s.kind==='video'){
  const target=Math.min(t,Math.max(0,video.duration-.04));
  if(seek||Math.abs(video.currentTime-target)>.18)video.currentTime=target;
  if(playing&&video.paused)video.play().catch(()=>{});else if(!playing)video.pause();
 }
 if(s.kind==='serve')serve(t,s);
 let glitch=false;
 if(s.kind==='identity'){glitch=t>1.8&&t<2.65;title.textContent=glitch?s.alternate:s.text;}
 if(s.kind==='emotions'){const i=Math.min(7,Math.floor(t/s.duration*8));title.replaceChildren(document.createTextNode('그들에게서 학습하는 ‘'));const emotion=document.createElement('span');emotion.style.color=colors[i];emotion.textContent=emotions[i];title.append(emotion,document.createTextNode('’'));}
 if(s.kind==='logo')glitch=t>2.2&&t<2.7;
 composition.classList.toggle('glitch',glitch&&Math.floor(t*24)%3!==0);
 const montage=['bar','video','serve','outside','open'].includes(s.kind);
 const fadeIn=montage?.12:.65,fadeOut=montage?.12:.55;
 $('fade').style.opacity=String(Math.max(1-clamp(t/fadeIn),1-clamp((s.duration-t)/fadeOut)));
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
 const sheets={background:bridge.w.LUNA_SERVE_BACKGROUND,...bridge.w.LUNA_SERVE_SHEETS};
 for(const [key,s]of Object.entries(sheets)){const img=new Image();img.src=assetRoot+s.src;await img.decode();images.set(key,img);}
 // Cache the small edited clips before playback so cuts do not buffer midway.
 await Promise.all([...new Set(scenes.filter(s=>s.kind==='video').map(s=>s.file))].map(async file=>{const src=`assets/trailer/${file}.mp4`,r=await fetch(src);if(!r.ok)throw Error(file+' 영상 없음');media.set(file,URL.createObjectURL(await r.blob()));}));
 ready=true;$('play').disabled=false;$('restart').disabled=false;await enter(0);raf=requestAnimationFrame(loop);
}
W.lunaTrailerPreview={scenes,total,seek,get time(){return time;},get ready(){return ready;},get loading(){return loading;},get playing(){return playing;},stop};
init().catch(failure);
})(window);
