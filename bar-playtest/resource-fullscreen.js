/* Resource viewer only. Keep real game UI in the iframe at its actual viewport size. */
(function(){
'use strict';
const lab=document.querySelector('#lab'),wrap=lab.querySelector('.frame-wrap'),frame=document.querySelector('#game');
const button=document.createElement('button');button.id='lab-fullscreen';button.textContent='전체화면 보기';button.setAttribute('aria-pressed','false');
document.querySelector('#replay').before(button);
const controls=document.createElement('div');controls.className='fullscreen-controls';controls.hidden=true;
controls.setAttribute('aria-label','전체화면 테스트 조작');
controls.innerHTML='<button id="fullscreen-replay">다시 실행</button><button id="fullscreen-exit">전체화면 닫기 · Esc</button>';
wrap.append(controls);
let active=false,epoch=0;
function layout(on){
 active=on;lab.classList.toggle('review-fullscreen',on);controls.hidden=!on;
 button.setAttribute('aria-pressed',String(on));
 button.textContent=on?'전체화면 닫기':'전체화면 보기';
}
function leave(){
 if(!active)return;
 epoch++;layout(false);
 if(document.fullscreenElement===wrap)document.exitFullscreen().catch(()=>{});
 if(!lab.classList.contains('parked'))button.focus({preventScroll:true});
}
async function enter(){
 if(active){leave();return;}if(lab.classList.contains('parked'))return;
 const token=++epoch;layout(true);
 // Fall back to a viewport-filling preview in embedded browsers without the API.
 try{if(wrap.requestFullscreen)await wrap.requestFullscreen();}catch{}
 if(token!==epoch||lab.classList.contains('parked')){
  if(document.fullscreenElement===wrap)void document.exitFullscreen().catch(()=>{});
  return;
 }
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(token===epoch&&active)document.querySelector('#replay').click();
 }));
}
function escape(e){
 if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();leave();}
}
button.onclick=enter;
document.querySelector('#fullscreen-exit').onclick=leave;
document.querySelector('#fullscreen-replay').onclick=()=>document.querySelector('#replay').click();
window.addEventListener('keydown',escape,true);
const bound=new WeakSet();
function bindFrame(){try{const w=frame.contentWindow;if(!bound.has(w.document)){w.addEventListener('keydown',escape,true);bound.add(w.document);}}catch{}}
frame.addEventListener('load',bindFrame);bindFrame();
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&active)leave();});
new MutationObserver(()=>{if(lab.classList.contains('parked'))leave();}).observe(lab,{attributes:true,attributeFilter:['class']});
})();
