/* First-morning controls: reuse actual game sprites, never animate the stills. */
(function(W){
'use strict';
const soundURL=new URL('assets/audio/effects/controls-popup.wav',new URL('../../../',document.currentScript.src).href);
let context,buffer,loading,voice,generation=0;
async function prepare(){
 try{
  if(!context){const Audio=W.AudioContext||W.webkitAudioContext;if(!Audio)return;context=new Audio();}
  if(context.state==='suspended')void context.resume().catch(()=>{});
  if(!buffer&&!loading)loading=(async()=>{
   const response=await fetch(soundURL);if(!response.ok)throw Error('HTTP '+response.status);
   buffer=await context.decodeAudioData(await response.arrayBuffer());
  })().catch(e=>console.warn('Controls popup sound unavailable:',e.message)).finally(()=>{loading=null;});
  if(loading)await loading;
 }catch(e){console.warn('Controls popup audio:',e.message);}
}
async function play(isCurrent=()=>true){
 const token=++generation,requestedAt=performance.now();
 if(document.hidden||W.LunaSfx?.volume===0)return;
 await prepare();
 if(token!==generation||!isCurrent()||performance.now()-requestedAt>500||document.hidden||!buffer||context.state!=='running'||W.LunaSfx?.volume===0)return;
 if(voice){try{voice.stop();}catch{}}
 const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.42;
 source.connect(gain);gain.connect(W.LunaSfx.output(context));voice=source;
 source.onended=()=>{source.disconnect();gain.disconnect();if(voice===source)voice=null;};source.start();
}
function stop(){generation++;if(voice){try{voice.stop();}catch{}voice=null;}}
// Trim transparent cell padding at render time; original sprite sheets stay intact.
function drawStill(canvas,frame,images){
 const image=images.get(frame.asset);if(!image)return;
 const cell=document.createElement('canvas');cell.width=frame.w;cell.height=frame.h;
 const ctx=cell.getContext('2d');ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
 const rgba=ctx.getImageData(0,0,frame.w,frame.h).data;
 let left=frame.w,top=frame.h,right=-1,bottom=-1;
 for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++)if(rgba[(y*frame.w+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)return;
 canvas.width=right-left+1;canvas.height=bottom-top+1;
 canvas.getContext('2d').drawImage(cell,left,top,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
}
const key=letter=>'<kbd class="controls-keycap" aria-label="'+letter+'키">'+letter+'</kbd>';
// Crop the supplied screenshots through matching SVG viewports. Keep their pixels
// intact and put the target markers in a separate, resolution-independent layer.
const interactionExamples={
 object:{src:'assets/tutorials/controls/interaction-tv.png',width:605,height:431,crop:'80 22 400 310',box:[160,57,267,215],label:'상호작용 가능한 TV'},
 person:{src:'assets/tutorials/controls/interaction-npc.png',width:506,height:448,crop:'68 112 400 310',box:[202,120,142,297],label:'상호작용 가능한 거리의 인물'}
};
function example(kind){
 const e=interactionExamples[kind],[x,y,w,h]=e.box,l=19;
 const corners=`M${x+l},${y}H${x}V${y+l} M${x+w-l},${y}H${x+w}V${y+l} M${x},${y+h-l}V${y+h}H${x+l} M${x+w-l},${y+h}H${x+w}V${y+h-l}`;
 return '<svg class="controls-example controls-'+kind+'" viewBox="'+e.crop+'" role="img" aria-label="'+e.label+'"><image href="'+e.src+'" width="'+e.width+'" height="'+e.height+'"/><path class="controls-target-mark" d="'+corners+'"/></svg>';
}
function render(panel,step,images,data){
 const movement=step===0,title=movement?'이동 · 달리기':'상호작용';
 panel.dataset.step=String(step);panel.setAttribute('aria-label',title+' 안내');panel.setAttribute('aria-description','E키를 눌러 진행합니다.');
 panel.innerHTML='<header class="controls-heading"><div><small>TUTORIAL</small><h2>'+title+'</h2></div><span class="controls-page">'+(step+1)+' <i>/ 2</i></span></header>'+
  (movement?'<div class="controls-motion-cards"><section class="controls-motion-card"><h3>걷기</h3><div class="controls-motion-example"><span class="controls-arrow" aria-hidden="true">←</span><div class="controls-luna"><canvas data-motion="walk" role="img" aria-label="왼쪽으로 걷는 루나"></canvas><span class="controls-floor"></span></div><span class="controls-arrow" aria-hidden="true">→</span></div><div class="controls-motion-keys">'+key('A')+'<span>/</span>'+key('D')+'</div><p class="controls-motion-caption">A는 왼쪽 · D는 오른쪽</p></section><section class="controls-motion-card controls-run-card"><h3>달리기</h3><div class="controls-motion-example"><span class="controls-arrow" aria-hidden="true">←</span><div class="controls-luna"><canvas data-motion="run" role="img" aria-label="보폭을 넓혀 달리는 루나"></canvas><span class="controls-floor"></span></div><span class="controls-arrow" aria-hidden="true">→</span></div><div class="controls-motion-keys">'+key('Shift')+'<span>+</span>'+key('A')+'<span>/</span>'+key('D')+'</div><p class="controls-motion-caption">Shift를 누른 채 이동</p></section></div>':
   '<div class="controls-interaction"><figure>'+example('object')+'<figcaption>오브젝트</figcaption></figure><figure>'+example('person')+'<figcaption>다른 인물</figcaption></figure></div><div class="controls-interact-key">'+key('E')+'</div>')+
  '<p class="controls-description">'+(movement?'A와 D를 눌러 이동합니다.\nShift를 누른 채 이동하면 달립니다.':'E키를 눌러 오브젝트나 다른 인물들과 상호작용할 수 있습니다.')+'</p><p class="controls-progress-hint">E키를 눌러 진행</p>';
 if(movement)for(const [motion,index]of [['walk',2],['run',0]]){
  const canvas=panel.querySelector('[data-motion="'+motion+'"]');drawStill(canvas,data.animations[motion].frames[index],images);
  // Match native pixel size across both poses; do not stretch a running pose
  // to the walking silhouette's height. Keep the examples as still images.
  canvas.style.height=canvas.height*3+'px';
 }
}
document.addEventListener('pointerdown',()=>{void prepare();},{capture:true,passive:true});
W.addEventListener('keydown',e=>{if(!e.repeat)void prepare();},true);
W.addEventListener('blur',stop);W.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
W.LunaControlsTutorial={render,play,stop,get ready(){return !!buffer&&context?.state==='running';},get playing(){return !!voice;}};
})(window);
