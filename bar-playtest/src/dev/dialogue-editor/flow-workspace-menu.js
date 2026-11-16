/* Right-click / Shift+F10 menus. No gameplay or clipboard mutations here. */
(function(W){
'use strict';
const $=id=>document.getElementById(id);
function attach(area,menu,resolve){
 let origin=null,rootEntries=[],sub=false,pos=[0,0],parentId='';
 function close(focus=false){if(menu.hidden)return;menu.hidden=true;menu.replaceChildren();if(focus)origin?.()?.focus({preventScroll:true});}
 function render(entries,backTo=''){
  menu.replaceChildren();menu.hidden=false;
  for(const item of entries){
   if(!item){const hr=document.createElement('hr');hr.setAttribute('role','separator');menu.append(hr);continue;}
   const [id,name,fn,hint,checked]=item,b=document.createElement('button'),nested=Array.isArray(fn);
   b.type='button';b.dataset.menu=id;b.setAttribute('role',checked==null?'menuitem':'menuitemradio');if(checked!=null)b.setAttribute('aria-checked',String(checked));
   const pict={inspect:'edit',wire:'link',unlink:'unlink','drop-pin':'trash','drop-option':'trash','add-sibling':'plus','goto-pin':'arrow'}[id];
   if(pict){b.innerHTML=W.LunaBarCanvas.icon(pict);b.append(document.createTextNode(' '+name));}else b.textContent=name+(nested?'　›':'');b.disabled=!fn;b.title=hint||name;if(nested)b.setAttribute('aria-haspopup','menu');
   b.onclick=()=>{if(nested){parentId=id;sub=true;render([['back','← 이전 메뉴',up],null,...fn]);return;}if(id==='back'){up();return;}close(true);fn?.();};menu.append(b);
  }
  menu.style.left=Math.max(4,Math.min(pos[0],innerWidth-menu.offsetWidth-6))+'px';menu.style.top=Math.max(4,Math.min(pos[1],innerHeight-menu.offsetHeight-6))+'px';
  (backTo&&menu.querySelector('[data-menu="'+CSS.escape(backTo)+'"]')||menu.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
 }
 function up(){sub=false;render(rootEntries,parentId);}
 function open(e,keyboard){
  // A row may be redrawn when selected; restore focus by identity, not its old element.
  const r=e.target.getBoundingClientRect(),ctx=resolve(e.target,keyboard,e);if(!ctx?.entries.length)return;
  e.preventDefault();close();origin=ctx.focus;rootEntries=ctx.entries;sub=false;pos=keyboard?[r.left+Math.min(24,r.width/2),r.top+Math.min(24,r.height/2)]:[e.clientX,e.clientY];render(rootEntries);
 }
 area.addEventListener('contextmenu',e=>open(e,false));
 area.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')open(e,true);});
 menu.addEventListener('keydown',e=>{
  const opts=[...menu.querySelectorAll('button:not(:disabled)')],i=opts.indexOf(document.activeElement);
  if(e.key==='Escape'||e.key==='ArrowLeft'&&sub){e.preventDefault();e.stopPropagation();if(sub)up();else close(true);return;}
  if(e.key==='Tab'){close(true);return;}if(e.key==='ArrowRight'&&opts[i]?.hasAttribute('aria-haspopup')){e.preventDefault();opts[i].click();return;}
  const n={ArrowDown:(i+1)%opts.length,ArrowUp:(i+opts.length-1)%opts.length,Home:0,End:opts.length-1}[e.key];if(n!==undefined){e.preventDefault();opts[n]?.focus();}
 });
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close();},true);
 area.addEventListener('wheel',()=>close(),{passive:true});W.addEventListener('resize',()=>close());W.addEventListener('popstate',()=>close());
 return {close};
}
function create(commands,empty){
 const area=$('map-port');return attach(area,$('map-menu'),(el,keyboard,e)=>{
  if(!area.querySelector('.flow-card'))return;
  const line=el.closest('[data-line-pin]'),card=el.closest('[data-node]'),pin=el.closest('[data-port],[data-pin-label],[data-pin-trash]');
  if(!card&&!line&&empty){e.preventDefault();const b=area.getBoundingClientRect();empty(keyboard?b.left+b.width/2:e.clientX,keyboard?b.top+b.height/2:e.clientY);return;}
  const index=pin?Number(pin.dataset.port??pin.dataset.pinLabel??pin.dataset.pinTrash):null;
  return {entries:commands(line?.dataset.lineFrom||card?.dataset.node,index,line?.dataset.linePin),focus:()=>[pin,line,card,area].find(n=>n?.isConnected)};
 });
}
function naming(){
 const dlg=$('section-dialog'),name=$('section-name'),error=$('section-error');let run;
 $('section-cancel').onclick=()=>dlg.close();$('section-form').onsubmit=e=>{e.preventDefault();try{run(name.value);dlg.close();}catch(err){error.textContent=err.message;name.focus();}};
 return (caption,note,value,commit)=>{run=commit;$('section-title').textContent=caption;$('section-summary').textContent=note;$('section-confirm').textContent=caption;name.value=value;error.textContent='';dlg.showModal();name.focus();name.select();};
}
W.LunaFlowWorkspaceMenu={create,naming,attach};
})(window);
