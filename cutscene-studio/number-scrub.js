(function(W){'use strict';
function install(root,api){
 let gesture=null,suppressClick=false;
 const key=el=>el.dataset.field?'field:'+el.dataset.field:'id:'+el.id;
 const find=id=>[...root.querySelectorAll('input[type=number]')].find(el=>key(el)===id);
 function decorate(){for(const input of root.querySelectorAll('input[type=number]')){
  const parent=input.closest('label')||input.parentElement;if(parent.querySelector('[data-number-scrub]'))continue;
  let label=[...parent.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
  const handle=document.createElement('span');handle.className='number-scrub-label';handle.dataset.numberScrub=key(input);handle.title='좌우 드래그로 조절 · Shift 미세 조절 · Esc 취소';
  if(label){handle.textContent=label.textContent;label.replaceWith(handle);}else{label=parent.querySelector('span');if(label&&!label.contains(input)){handle.textContent=label.textContent;label.replaceWith(handle);}else{handle.textContent='↔';parent.insertBefore(handle,input);}}
 }}
 const observer=new MutationObserver(decorate);observer.observe(root,{childList:true,subtree:true});decorate();
 const sensitivity=input=>{const path=input.dataset.field||input.id;if(['fontScale','tag-size'].includes(path))return .5;if(path==='cps')return .2;if(path==='rotation')return .5;if(path==='layer')return .125;if(/strength|volume|opacity/.test(path))return .005;if(path.includes('.')&&path!=='project.duration')return .01;return .02;};
 const quantum=input=>['fontScale','cps','layer','tag-size'].includes(input.dataset.field||input.id)?1:.01;
 function finish(cancel=false){const g=gesture;if(!g)return;gesture=null;document.body.classList.remove('numeric-scrubbing');root.querySelectorAll('.is-scrubbing').forEach(el=>el.classList.remove('is-scrubbing'));
  if(g.transaction){if(cancel)g.transaction.cancel();else g.transaction.commit();}
  else if(g.dragging){const input=find(g.id);if(input){if(cancel)input.value=g.original;else input.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(root.hasPointerCapture(g.pointer))root.releasePointerCapture(g.pointer);if(g.dragging){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}
 }
 root.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||gesture)return;const handle=e.target.closest('[data-number-scrub]');let input=handle?find(handle.dataset.numberScrub):e.target.closest('input[type=number]');
  // A focused input keeps normal caret/selection behaviour; its label always scrubs.
  if(!input||input.disabled||input.readOnly||(!handle&&document.activeElement===input))return;
  const id=key(input);if(handle){e.preventDefault();document.activeElement?.blur();input=find(id);if(!input)return;}
  const value=Number(input.value);if(!Number.isFinite(value)||input.value==='')return;
  gesture={id,pointer:e.pointerId,startX:e.clientX,lastX:e.clientX,raw:value,original:input.value,dragging:false,transaction:null,rate:sensitivity(input),quantum:quantum(input)};
 });
 document.addEventListener('pointermove',e=>{const g=gesture;if(!g||e.pointerId!==g.pointer)return;let input=find(g.id);if(!input){finish(true);return;}if(!g.dragging&&Math.abs(e.clientX-g.startX)<3)return;
  e.preventDefault();if(!g.dragging){g.dragging=true;root.setPointerCapture(g.pointer);document.body.classList.add('numeric-scrubbing');input.classList.add('is-scrubbing');}
  g.raw+=(e.clientX-g.lastX)*g.rate*(e.shiftKey?.1:1);g.lastX=e.clientX;
  const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);g.raw=Math.min(max,Math.max(min,g.raw));const value=Math.min(max,Math.max(min,Math.round(g.raw/g.quantum)*g.quantum));
  if(Number(input.value)===Number(value.toFixed(4)))return;
  if(input.dataset.field){g.transaction??=api.begin();g.transaction.change(input.dataset.field,value);}
  else input.value=String(Number(value.toFixed(4)));
 },{passive:false});
 document.addEventListener('pointerup',e=>{if(gesture?.pointer===e.pointerId)finish();});
 document.addEventListener('pointercancel',e=>{if(gesture?.pointer===e.pointerId)finish(true);});
 root.addEventListener('lostpointercapture',e=>{if(gesture?.pointer===e.pointerId)finish(true);});
 root.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',e=>{if(!gesture?.dragging)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);}else if(!['Shift','Control','Alt','Meta'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('blur',()=>finish(true));
 root.addEventListener('keydown',e=>{if(!e.target.matches('input[type=number]')||gesture?.dragging)return;if(e.key==='Enter'){e.preventDefault();e.target.blur();}});
}
W.StudioNumberScrub={install};
})(window);
