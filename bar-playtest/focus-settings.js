(function(W){
'use strict';
const key='luna.autoPauseOnFocusLoss.v1';
let enabled=true;
try{enabled=localStorage.getItem(key)!=='off';}catch{}
function sync(){
 document.querySelectorAll('[data-focus-pause]').forEach(el=>{el.value=enabled?'on':'off';});
 W.dispatchEvent(new Event('luna-focus-settings-change'));
}
function setEnabled(value){enabled=!!value;try{localStorage.setItem(key,enabled?'on':'off');}catch{}sync();}
function settingsHTML(lang='ko'){
 const en=lang==='en';
 return '<label class="settings-row"><span>'+(en?'Auto-pause when switching windows / tabs':'다른 창·탭으로 전환 시 자동 일시정지')+'</span><select data-focus-pause aria-label="'+(en?'Auto-pause on window switch':'창 전환 자동 일시정지')+'"><option value="on" '+(enabled?'selected':'')+'>'+(en?'On · pause':'켜짐 · 자동 일시정지')+'</option><option value="off" '+(!enabled?'selected':'')+'>'+(en?'Off · keep playing':'꺼짐 · 계속 진행')+'</option></select></label>';
}
// Save before the bar's change handler rebuilds the options DOM.
document.addEventListener('change',e=>{if(e.target.matches('[data-focus-pause]'))setEnabled(e.target.value==='on');},true);
W.addEventListener('storage',e=>{if(e.key===key||e.key===null){try{enabled=localStorage.getItem(key)!=='off';}catch{}sync();}});
// Hidden tabs may suspend animation frames. Use a throttling-tolerant timer,
// with small simulation steps and no large catch-up after sleep/tab discard.
function startLoop(frame){
 let raf=0,timer=0,last=performance.now();
 function schedule(){if(document.hidden)timer=setTimeout(pulse,enabled?250:50);else raf=requestAnimationFrame(pulse);}
 function pulse(){
  const now=performance.now(),elapsed=Math.max(0,Math.min(1,(now-last)/1000));last=now;
  if(document.hidden){
   if(!enabled){const steps=Math.max(1,Math.ceil(elapsed/.05));for(let i=0;i<steps;i++)frame(now,elapsed/steps);}
  }else frame(now,Math.min(.05,elapsed));
  schedule();
 }
 function reset(){cancelAnimationFrame(raf);clearTimeout(timer);last=performance.now();schedule();}
 document.addEventListener('visibilitychange',reset);
 W.addEventListener('luna-focus-settings-change',reset);
 schedule();
}
W.LunaFocusSettings={get enabled(){return enabled;},get hiddenPaused(){return enabled&&document.hidden;},setEnabled,settingsHTML,startLoop};
})(window);
