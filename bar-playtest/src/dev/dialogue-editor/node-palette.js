/* Shared, searchable canvas creation menu. Screen and graph coordinates are separate. */
(function(W){'use strict';
function create(){
 const dialog=document.createElement('dialog');dialog.className='node-palette';dialog.setAttribute('aria-label','노드 생성');
 dialog.innerHTML='<header><strong>＋ 노드 생성</strong><button type="button" aria-label="닫기">×</button></header><input type="search" aria-label="노드 종류 검색" placeholder="노드 종류 검색…"><div class="palette-results"></div>';
 document.body.append(dialog);const input=dialog.querySelector('input'),results=dialog.lastElementChild;let entries=[],selection,origin;
 function paint(){results.replaceChildren();let category='';const q=input.value.trim().toLowerCase();
  for(const o of entries.filter(o=>[o.name,o.hint,o.group,o.key].join(' ').toLowerCase().includes(q))){
   if(category!==o.group){category=o.group;const h=document.createElement('small');h.textContent=category;results.append(h);}
   const b=document.createElement('button');b.type='button';b.dataset.nodeType=o.key;b.disabled=!!o.disabled;
   const i=document.createElement('i'),name=document.createElement('b'),hint=document.createElement('span');i.textContent=o.icon||'◇';name.textContent=o.name;hint.textContent=o.disabled||o.hint||'';b.append(i,name,hint);
   b.onclick=()=>{dialog.close();selection(o.key);};results.append(b);
  }if(!results.children.length)results.textContent='일치하는 노드가 없습니다.';
 }
 input.oninput=paint;dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.onkeydown=e=>{const buttons=[...results.querySelectorAll('button:enabled')],i=buttons.indexOf(document.activeElement);if(e.key==='Enter'&&document.activeElement===input){e.preventDefault();buttons[0]?.click();}if(['ArrowDown','ArrowUp'].includes(e.key)&&buttons.length){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}};
 dialog.onclick=e=>{const b=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))dialog.close();};
 dialog.onclose=()=>{if(!document.querySelector('dialog[open]')&&document.activeElement===document.body)origin?.focus({preventScroll:true});};
 return {open(x,y,items,fn){entries=items;selection=fn;origin=document.activeElement;input.value='';paint();dialog.showModal();dialog.style.left=Math.max(6,Math.min(x,innerWidth-dialog.offsetWidth-8))+'px';dialog.style.top=Math.max(6,Math.min(y,innerHeight-dialog.offsetHeight-8))+'px';input.focus();}};
}
// When the cursor is in a narrow gutter, keep the new card near it without
// covering an existing port. Geometry is in unscaled canvas coordinates.
function vacant(point,width,height,cards,margin=16){
 const targets=[...cards].map(c=>({x:c.offsetLeft,y:c.offsetTop,w:c.offsetWidth,h:c.offsetHeight})),origin={x:Math.max(margin,point.x),y:Math.max(margin,point.y)};
 const overlaps=(x,y)=>targets.some(b=>x<b.x+b.w+margin&&x+width+margin>b.x&&y<b.y+b.h+margin&&y+height+margin>b.y);
 const xs=new Set([origin.x,margin]),ys=new Set([origin.y,margin]);for(const b of targets){xs.add(b.x+b.w+margin);xs.add(Math.max(margin,b.x-width-margin));ys.add(b.y+b.h+margin);ys.add(Math.max(margin,b.y-height-margin));}
 let best=Infinity,p=origin;for(const x of xs)for(const y of ys){const d=(x-origin.x)**2+(y-origin.y)**2;if(d<best&&!overlaps(x,y)){best=d;p={x:Math.round(x),y:Math.round(y)};}}return p;
}
// If the former first line was removed, the surviving card can acquire a new ID.
function inheritPositions(previous,next,positions){
 if(!previous?.length||!positions)return false;
 const used=new Set(next.map(n=>n.id)),oldByRow=new Map();
 for(const n of previous)if(!used.has(n.id)&&positions[n.id])for(const r of n.rows)oldByRow.set(r.row_id,n.id);
 let changed=false;
 for(const n of next)if(!positions[n.id]){const owner=n.rows.map(r=>oldByRow.get(r.row_id)).find(id=>id&&!used.has(id));
  if(owner){positions[n.id]={...positions[owner]};used.add(owner);changed=true;}}
 return changed;
}
W.LunaNodePalette={create,vacant,inheritPositions};
})(window);
