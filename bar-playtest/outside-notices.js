/* Screen-space transaction notices; no gameplay state or dialogue focus changes. */
(function(W){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
W.LunaOutsideNotices={create(host,currency){
 const layer=document.createElement('div');layer.className='outside-notices';layer.innerHTML='<div class="outside-money-notice"></div><div class="outside-item-notice" role="status" aria-live="polite" aria-atomic="true" hidden></div>';host.querySelector('.outside-stage').append(layer);
 const money=layer.firstElementChild,item=layer.lastElementChild,reduced=W.matchMedia('(prefers-reduced-motion: reduce)'),qaCurrency=W.LunaCurrencyView();
 let owner=null,story=null,model=null,queue=[],current=null,age=0;
 function sync(m){const p=m.qa?.shopProgress||W.barGame.progress;if(model!==m||owner!==p||story!==m.story){model=m;owner=p;story=m.story;queue=[];current=null;age=0;money.replaceChildren();item.hidden=true;(m.qa?qaCurrency:currency).reset(p);}return p;}
 function next(){current=queue.shift()||null;age=0;item.hidden=!current;if(!current)return;const g=W.barGame,row=g.t.shelf_items.find(i=>i.id===current),assets=g.data.assets,art=assets['recipe_item_'+current]||assets['item_'+current];item.dataset.item=current;item.innerHTML='<img src="'+esc(art.src)+'" alt="" draggable="false"><span><strong>'+esc(g.text(row,'name'))+'</strong> '+(g.lang==='ko'?'추가':'added')+'</span>';}
 function showMoney(f,p){let el=money.firstElementChild;if(!f.active){money.replaceChildren();return;}if(!el){money.innerHTML=W.LunaCurrencyView.html(f,p,{lang:W.barGame.lang,reducedMotion:reduced.matches});return;}
  const income=f.delta>0,fmt=n=>Math.round(n).toLocaleString(),ko=W.barGame.lang==='ko';el.className='currency-hud '+(income?'currency-income':'currency-spending');el.style.opacity=f.opacity;el.setAttribute('aria-label',(income?(ko?'수입':'Income'):(ko?'차감':'Spent'))+' '+fmt(Math.abs(f.delta))+', '+(ko?'소지금':'Balance')+' '+fmt(p.money));el.querySelector('.currency-value').textContent=fmt(reduced.matches?p.money:f.displayed);const d=el.querySelector('.currency-delta');d.textContent=(income?'+':'−')+fmt(Math.abs(f.delta));d.style.transform='translateY('+(reduced.matches?0:-Math.min(12,f.elapsed*7))+'px)';
 }
 function update(m,dt=0){const p=sync(m),paused=document.hidden,t=paused?0:Math.min(.1,Math.max(0,dt));showMoney((m.qa?qaCurrency:currency).update(p,dt,paused),p);
  if(!current&&queue.length)next();if(!current)return;age+=t;if(age>=2.8){next();if(!current)return;}
  const enter=Math.min(1,age/.24),leave=Math.max(0,(age-2.5)/.3),visible=enter*(1-leave);item.style.opacity=String(visible);item.style.transform=reduced.matches?'none':'translateX('+(-240*(1-(1-Math.pow(1-enter,3)))*(1-leave)-240*leave)+'px)';
 }
 return{update,add(m,id){sync(m);const g=W.barGame,row=g.t.shelf_items.find(i=>i.id===id);if(row?.kind!=='ingredient'||!(g.data.assets['recipe_item_'+id]||g.data.assets['item_'+id]))return false;queue.push(id);update(m);return true;},dispose(){queue=[];current=null;layer.remove();currency.reset(W.barGame.progress);}};
}};
})(window);
