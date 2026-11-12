/* Simulator-only audio audition. Reuses the shipped serving renderer; no campaign/CSV writes. */
(function(){'use strict';
const $=s=>document.querySelector(s),stage=$('#stage'),profiles=[
 {file:'glass_slide_01.wav',offset:.40,duration:1.50,gain:1.65},
 {file:'glass_slide_02.wav',offset:.85,duration:1.35,gain:1.29},
 {file:'glass_slide_03.wav',offset:.20,duration:1.25,gain:.24}
];
const animationSpeed=1,soundDelay=.02;
const g={screen:'result',result:{selected:'gin_tonic',grade:'excellent'},realTime:0,isPaused:()=>false,name:id=>id};
let context,master,source,envelope,version=0,running=false,armed=false,startPending=false,epoch=0,generation=0,ready=false,frame=0;
const buffers=new Map(),images=new Map();
const status=text=>$('#status').textContent=text;
function audio(){if(!context){context=new AudioContext();master=context.createGain();master.gain.value=+$('#volume').value/100;master.connect(context.destination);}return context;}
function silence(){if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}envelope?.disconnect();envelope=null;}
function stop(){generation++;running=armed=startPending=false;silence();status('정지됨 · 버전을 선택하면 처음부터 재생합니다.');}
function startSound(){
 stage.querySelector('.serve-loading')?.remove();
 if(!armed)return;armed=startPending=false;epoch=context.currentTime;const profile=profiles[version],buffer=buffers.get(version);
 source=context.createBufferSource();source.buffer=buffer;envelope=context.createGain();source.connect(envelope);envelope.connect(master);
 const t=context.currentTime+soundDelay,d=Math.min(profile.duration,buffer.duration-profile.offset);
 // Original samples at native speed. No time stretching, looping, filters or compression.
 source.playbackRate.value=1;
 envelope.gain.setValueAtTime(0,t);
 envelope.gain.linearRampToValueAtTime(profile.gain,t+.015);
 envelope.gain.setValueAtTime(profile.gain,t+d-.08);
 envelope.gain.linearRampToValueAtTime(0,t+d);
 source.start(t,profile.offset,d);stage.dataset.audioStartFrame='0';stage.dataset.soundVersion=String(version+1);
 status('버전 '+(version+1)+' · 잔 밀기 재생 중');
}
const view=LunaServeView({g,D:{},L:ko=>ko,esc:s=>String(s),button:()=>'',drinkArt:()=>'',onStart:()=>{stage.querySelector('.serve-loading')?.remove();if(armed)startPending=true;}});
function sync(){view.sync(stage);if(startPending)startSound();}
function draw(){stage.innerHTML=view.html();sync();}
function loadImage(src){if(!images.has(src))images.set(src,(async()=>{const img=new Image();img.src=src;await img.decode();return img;})().catch(e=>{images.delete(src);throw Error('이미지 준비 실패: '+src,{cause:e});}));return images.get(src);}
async function prepare(){
 const ctx=audio();
 await Promise.all([loadImage(LUNA_SERVE_BACKGROUND.src),loadImage(LUNA_SERVE_SHEETS[$('#drink').value].src),...profiles.map(async(p,i)=>{
  if(buffers.has(i))return;const response=await fetch('assets/audio/effects/glass-slide/'+p.file);if(!response.ok)throw Error(p.file+' 다운로드 실패');buffers.set(i,await ctx.decodeAudioData(await response.arrayBuffer()));
 })]);
}
function select(){document.querySelectorAll('[data-version]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.version===version)));}
async function play(index=version){
 stop();version=index;select();const token=generation;status('소리와 제공 화면 준비 중…');
 try{await audio().resume();await prepare();if(token!==generation)return;
  g.result={selected:$('#drink').value,grade:'excellent'};g.realTime=0;running=armed=true;epoch=context.currentTime;draw();
 }catch(e){if(token===generation){running=armed=false;status(e.message+' · 다시 재생을 눌러 재시도하세요.');}}
}
$('#open-serve').onclick=async()=>{
 $('#welcome').hidden=true;$('#lab').hidden=false;$('#open-serve').setAttribute('aria-pressed','true');resize();status('소리와 화면을 준비합니다…');
 try{await prepare();ready=true;draw();status('버전 1·2·3 중 하나를 눌러 비교하세요.');}
 catch(e){status(e.message+' · 제공하기를 다시 눌러 재시도하세요.');}
 document.querySelectorAll('[data-version],#replay').forEach(b=>b.disabled=false);
};
document.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>play(+b.dataset.version));
$('#replay').onclick=()=>play();$('#stop').onclick=stop;$('#drink').onchange=()=>play();
$('#volume').oninput=()=>{const v=+$('#volume').value;$('#volume-value').value=v+'%';if(master)master.gain.setTargetAtTime(v/100,context.currentTime,.02);};
document.addEventListener('keydown',e=>{if(e.target.matches('select,input,button,a'))return;if(e.code==='Escape')stop();if(e.code==='Space'&&!e.repeat&&!$('#lab').hidden){e.preventDefault();play();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{stop();cancelAnimationFrame(frame);context?.close();});
function resize(){stage.style.transform='scale('+($('#viewport').clientWidth/1280)+')';if(ready)view.sync(stage);}
new ResizeObserver(resize).observe($('#viewport'));
function tick(){
 if(running){g.realTime=armed?0:(context.currentTime-epoch)*animationSpeed;sync();if(!armed&&g.realTime>=1.5){running=false;draw();status('버전 '+(version+1)+' 재생 완료 · 다른 버전과 비교해 보세요.');}}
 else if(ready)view.sync(stage);
 frame=requestAnimationFrame(tick);
}select();tick();
window.LunaSoundLab={play,stop,get playing(){return running;},profiles,animationSpeed,soundDelay};
})();
