/* Dialogue choices confirm only after 0.8 uninterrupted seconds of input. */
(function(W){
 'use strict';
 W.LunaChoiceHold=function({root,choice,allowed,commit}){
  let hold=null,raf=0,pointer=null,suppressClickUntil=0;
  const keys=new Set(),confirmKeys=new Set(['Enter','Space']);
  const button=target=>target?.closest?.('.choices button[data-act="choice"]');
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  function paint(){
   for(const el of root.querySelectorAll('.choices button')){
    const active=hold?.el===el;
    el.classList.toggle('choice-holding',active);
    el.style.setProperty('--choice-progress',active?String(hold.progress):'0');
   }
  }
  function cancel(){hold=null;cancelAnimationFrame(raf);raf=0;paint();}
  function valid(){return hold&&hold.choice===choice()&&allowed()&&hold.el.isConnected&&!hold.el.disabled&&!hold.el.closest('[inert]')&&document.activeElement===hold.el;}
  function tick(now){
   if(!valid()){cancel();return;}
   // A suspended/throttled tab never earns confirmation time on returning.
   hold.progress+=Math.min(50,Math.max(0,now-hold.last))/800;hold.last=now;
   paint();
   if(hold.progress>=1){const id=hold.el.dataset.id;cancel();commit(id);return;}
   raf=requestAnimationFrame(tick);
  }
  function start(el,source){
   if(hold||!el||el.disabled||el.closest('[inert]')||!allowed())return;
   el.focus({preventScroll:true});
   hold={el,source,choice:choice(),progress:0,last:performance.now()};paint();raf=requestAnimationFrame(tick);
  }
  root.addEventListener('pointerdown',e=>{
   const el=button(e.target);if(!el||e.button!==0)return;
   stop(e);if(pointer!==null||keys.size)return;
   pointer=e.pointerId;suppressClickUntil=Infinity;start(el,'pointer');
  },true);
  W.addEventListener('pointermove',e=>{
   if(hold?.source!=='pointer'||e.pointerId!==pointer)return;
   if(button(document.elementFromPoint(e.clientX,e.clientY))!==hold.el)cancel();
  },true);
  function releasePointer(e){if(e.pointerId!==pointer)return;pointer=null;suppressClickUntil=performance.now()+500;cancel();}
  W.addEventListener('pointerup',releasePointer,true);W.addEventListener('pointercancel',releasePointer,true);
  root.addEventListener('pointerout',e=>{if(hold?.source==='pointer'&&button(e.target)===hold.el&&button(e.relatedTarget)!==hold.el)cancel();},true);
  // Includes native keyboard clicks and the release click after the choice DOM vanished.
  W.addEventListener('click',e=>{if(button(e.target)||performance.now()<suppressClickUntil){stop(e);suppressClickUntil=0;}},true);
  W.addEventListener('keydown',e=>{
   if(keys.has(e.code)){stop(e);return;}
   if(!confirmKeys.has(e.code)){if(hold)cancel();return;}
   if(!choice()||!allowed()||e.target?.matches?.('input,textarea,select')||e.target?.isContentEditable)return;
   stop(e);if(e.repeat||pointer!==null||keys.size)return;
   keys.add(e.code);
   // Confirm the visibly hovered option, or the keyboard-focused option.
   const el=root.querySelector('.choices button:not(:disabled):hover')||button(document.activeElement)||root.querySelector('.choices button:not(:disabled)');
   start(el,'key');
  },true);
  W.addEventListener('keyup',e=>{if(!keys.has(e.code))return;stop(e);keys.delete(e.code);cancel();},true);
  root.addEventListener('focusout',e=>{if(hold?.el===e.target)cancel();},true);
  root.addEventListener('pointerover',e=>{if(hold&&button(e.target)&&button(e.target)!==hold.el)cancel();},true);
  function reset(){cancel();keys.clear();pointer=null;suppressClickUntil=0;}
  W.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  return {sync(){if(hold&&!valid())cancel();else paint();},cancel};
 };
})(window);
