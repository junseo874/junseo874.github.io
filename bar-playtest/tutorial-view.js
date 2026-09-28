(function(root){
'use strict';
root.LunaDay0Tutorial=function({g,ui,L}){
 let lastFocus='',shelfPending=null;
 // Wait for the actual CSS transform to land, not a guessed timeout.
 function navigateShelf(tab){
  if(!navigating()){g.tutorialEvent('shelf',tab);return;}
  shelfPending={tutorial:g.tutorial,tab};ui.hoverItem=null;
 }
 function updateShelf(root){
  const pending=shelfPending;if(!pending)return;
  if(g.tutorial!==pending.tutorial||g.screen!=='prep'||!enhanced()){shelfPending=null;return;}
  if(g.isPaused())return;
  const track=root.querySelector('.shelf-track');if(!track)return;
  const expected=-['glass','tool','liquor','fridge'].indexOf(pending.tab)*track.clientWidth;
  const transform=getComputedStyle(track).transform;
  const x=transform==='none'?0:new DOMMatrixReadOnly(transform).m41;
  const moving=track.getAnimations().some(a=>a.transitionProperty==='transform'&&['running','pending'].includes(a.playState));
  if(moving||Math.abs(x-expected)>.1)return;
  shelfPending=null;g.tutorialEvent('shelf',pending.tab);
 }

 const enhanced=()=>g.variant!=='gpt';
 const navigating=()=>enhanced()&&['prepNavigate','prepSodaNavigate'].includes(stage());
 const shelfItem=id=>'.shelf-slide[data-current="true"] [data-hover-item="'+id+'"]';
 function canHover(id){if(shelfPending)return false;return ['prepHover','prepAdd'].includes(stage())&&id==='gin'||enhanced()&&['prepSodaHover','prepSodaAdd'].includes(stage())&&id==='soda_water';}
 function navigationSelector(){const tabs=['glass','tool','liquor','fridge'],destination=stage()==='prepSodaNavigate'?'fridge':'liquor';return '.shelf-arrow.'+(tabs.indexOf(ui.tab)<tabs.indexOf(destination)?'next':'prev');}
 function nearby(root,box,secondary){
  const copy=root.querySelector('.day0-guide-copy'),arrow=root.querySelector('.day0-click-arrow');if(!copy||!box)return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),w=320,h=copy.getBoundingClientRect().height/(root.querySelector('.workspace').getBoundingClientRect().height/720),gap=52;
  const right=box.x+box.width+gap,left=box.x-gap-w,cy=box.y+box.height/2;
  let x,y,dir;
  if(right+w<=1264){x=right;y=clamp(cy-h/2,16,704-h);dir='left';}
  else if(left>=16){x=left;y=clamp(cy-h/2,16,704-h);dir='right';}
  else {x=clamp(box.x+box.width/2-w/2,16,944);y=box.y>h+gap?box.y-h-gap:box.y+box.height+gap;dir=y<box.y?'down':'up';}
  // Keep the nearby explanation separate from an ingredient's own hover label.
  if(secondary&&x<secondary.x+secondary.width&&x+w>secondary.x&&y<secondary.y+secondary.height&&y+h>secondary.y)y=clamp(secondary.y-h-16,16,704-h);
  Object.assign(copy.style,{left:x+'px',top:clamp(y,16,704-h)+'px',right:'auto',bottom:'auto',transform:'none'});
  const click=stage()!=='coaster'&&!['prepHover','prepSodaHover'].includes(stage());arrow.style.display=click?'':'none';if(!click)return;
  const target=stage()==='prepRecipeRead'?root.querySelector('[data-act="tutorialContinue"]'):null;
  let ax,ay,angle;if(target){ax=x-22;ay=y+h-30;angle=0;}else if(dir==='left'){ax=box.x+box.width+27;ay=cy;angle=180;}else if(dir==='right'){ax=box.x-27;ay=cy;angle=0;}else {ax=box.x+box.width/2;ay=dir==='down'?box.y-27:box.y+box.height+27;angle=dir==='down'?90:270;}
  arrow.setAttribute('transform','translate('+ax+' '+ay+') rotate('+angle+')');
 }

 const stage=()=>g.tutorial&&g.day===0&&['bar','recipe','prep'].includes(g.screen)&&!g.finished?g.tutorial.kind:null;
 const visible=()=>stage()&&!g.paused&&!g.hidden&&!g.error&&(!g.overlay||g.overlay==='service')&&!g.cameraMoving&&!g.cameraLeft&&!g.transition;
 function selector(){if(enhanced()){if(navigating())return navigationSelector();const sel={prepGlass:shelfItem('long_drink'),prepGinAgain:shelfItem('gin'),prepSodaHover:shelfItem('soda_water'),prepSodaAdd:shelfItem('soda_water'),prepStart:'.craft-start'}[stage()];if(sel)return sel;}return {coaster:'[data-drag="coaster"]',recipe:g.overlay==='service'?'#service-panel [data-act="recipes"]':'.service-handle',recipeSelect:'[data-act="selectRecipe"][data-id="gin_tonic"]',prepRecipeOpen:'.recipe-toggle',prepRecipeRead:'.prep-recipe',prepRecipeClose:'.prep-recipe-heading [data-act="togglePrepRecipe"]',prepNavigate:'.shelf-dots [data-act="tab"][data-id="liquor"]',prepHover:'.shelf-slide[data-current="true"] [data-hover-item="gin"]',prepAdd:'.shelf-slide[data-current="true"] [data-hover-item="gin"]',prepRemove:'.prep-inventory [data-act="pick"][data-id="gin"]'}[stage()];}
 function copy(){if(enhanced()){const text={prepGlass:L('롱드링크잔을 선택하세요','Choose the long drink glass'),prepNavigate:L('A / D 또는 양쪽 화살표로 술 선반까지 이동하세요','Use A / D or the side arrows to reach the spirits shelf'),prepGinAgain:L('진을 다시 담아 제조를 준비하세요','Add Gin again to prepare your drink'),prepSodaNavigate:L('A / D 또는 양쪽 화살표로 냉장고까지 이동하세요','Use A / D or the side arrows to reach the fridge'),prepSodaHover:L('탄산수에 마우스를 올려 확인하세요','Hover over Soda water'),prepSodaAdd:L('탄산수를 클릭해 담으세요','Click Soda water to add it'),prepStart:L('준비됐어요. 제조 시작을 눌러 주세요','Ready. Select Start crafting')}[stage()];if(text)return text;}return {coaster:L('코스터를 크리스 앞으로 드래그하세요','Drag the coaster to Chris'),recipe:g.overlay==='service'?L('칵테일 레시피 보기를 눌러 주세요','Choose Cocktail recipes'):L('서비스 패널을 열어 레시피를 확인하세요','Open the service panel to find the recipes'),recipeSelect:L('진토닉 레시피를 선택하세요','Choose the Gin & Tonic recipe'),prepRecipeOpen:L('레시피 버튼을 눌러 제조 정보를 확인하세요','Open the recipe to see what you need'),prepRecipeRead:L('잔·재료·제조법과 필요한 양을 확인하세요','Check the glass, ingredients, method and amounts'),prepRecipeClose:L('확인했다면 레시피를 닫아 주세요','Close the recipe when you are ready'),prepNavigate:L('술 선반으로 이동해 재료를 살펴보세요','Go to the spirits shelf to inspect an ingredient'),prepHover:L('진에 마우스를 올려 이름과 설명을 확인하세요','Hover over Gin to see its name and description'),prepAdd:L('진을 클릭해 아래 재료 슬롯에 담아 보세요','Click Gin to add it to the tray below'),prepRemove:L('아래에 담긴 진을 클릭하면 다시 뺄 수 있어요','Click Gin in the tray to remove it')}[stage()]||'';}
 function html(){if(!visible())return '';if(shelfPending)return '<div class="day0-guide day0-guide-travel" aria-hidden="true"><svg class="day0-guide-art" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#020611" opacity=".57"/></svg></div>';const kind=stage(),coaster=kind==='coaster';return `<div class="day0-guide" data-guide="${kind}" data-nearby="${enhanced()}" aria-live="polite"><svg class="day0-guide-art" viewBox="0 0 1280 720" aria-hidden="true"><defs><mask id="day0-guide-mask"><rect width="1280" height="720" fill="white"/><rect data-guide-hole="source" rx="12" fill="black"/><rect data-guide-hole="target" rx="16" fill="black"/></mask><marker id="day0-arrow-tip" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="6" markerHeight="6" orient="auto"><path d="M 1 1 L 10 6 L 1 11" fill="none" stroke="#baffff" stroke-width="2"/></marker></defs><rect width="1280" height="720" fill="#020611" opacity=".57" mask="url(#day0-guide-mask)"/><rect class="day0-guide-outline" data-guide-ring="source" rx="12"/><rect class="day0-guide-outline" data-guide-ring="target" rx="16"/><path class="day0-drag-route" marker-end="url(#day0-arrow-tip)" ${coaster?'':'hidden'}/>${enhanced()?'<g class="day0-click-arrow"><path d="M-16 0 H12 M2 -10 L12 0 L2 10"/></g>':''}</svg><div class="day0-guide-copy">${enhanced()?'':'<small>'+L('크리스의 바텐더 수업','Chris’s bartending lesson')+'</small>'}<span>${copy()}</span>${kind==='prepRecipeRead'?'<button data-act="tutorialContinue">'+L('확인','Continue')+' <kbd>Space</kbd></button>':''}</div></div>`;}
 function allows(name,id,el){if(!stage()||g.overlay&&g.overlay!=='service')return true;if(['settings','help','closeOverlay'].includes(name))return true;const kind=stage();if(enhanced()){if(navigating())return name==='shelfCategory'&&['-1','1'].includes(String(id));const item={prepGlass:'long_drink',prepGinAgain:'gin',prepSodaAdd:'soda_water'}[kind];if(item)return name==='pick'&&id===item&&(!el||!!el.closest('.shelf-slide'));if(kind==='prepStart')return name==='craft';}if(kind==='recipe')return ['service','recipes'].includes(name);if(kind==='recipeSelect')return name==='selectRecipe'&&id==='gin_tonic';if(['prepRecipeOpen','prepRecipeClose'].includes(kind))return name==='togglePrepRecipe';if(kind==='prepRecipeRead')return name==='tutorialContinue';if(kind==='prepNavigate')return name==='tab'&&id==='liquor';if(kind==='prepAdd')return name==='pick'&&id==='gin';if(kind==='prepRemove')return name==='pick'&&id==='gin'&&(!el||!!el.closest('.prep-inventory'));return false;}
 function sync(root){const kind=stage(),key=kind+':'+(g.overlay||'');if(!kind){lastFocus='';return;}if(!visible()||shelfPending)return;
  const sel=selector(),el=root.querySelector(sel);
  if(key!==lastFocus&&!ui.drag){if(!['prepHover','prepAdd','prepSodaHover','prepSodaAdd'].includes(kind)){const focus=kind==='prepRecipeRead'?root.querySelector('[data-act="tutorialContinue"]'):el;focus?.focus({preventScroll:true});}if(kind==='recipeSelect')el?.scrollIntoView({block:'nearest'});lastFocus=key;}
  const svg=root.querySelector('.day0-guide-art'),world=root.querySelector('.workspace');if(!svg||!world)return;const w=world.getBoundingClientRect(),sx=w.width/1280,sy=w.height/720;
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:(r.left-w.left)/sx-7,y:(r.top-w.top)/sy-7,width:r.width/sx+14,height:r.height/sy+14};};
  const source=box(el),target=navigating()?box(root.querySelector('.shelf-arrow.'+(el?.classList.contains('next')?'prev':'next')+':not(:disabled)')):kind==='coaster'?box(root.querySelector('[data-drop="'+g.tutorial.seat+'"]')):['prepAdd','prepSodaAdd'].includes(kind)?box(root.querySelector('#ingredient-tip')):null;if(kind==='coaster'&&target){target.y+=target.height*.65;target.height*=.35;}
  for(const [id,b]of [['source',source],['target',target]])for(const role of ['hole','ring']){const node=svg.querySelector('[data-guide-'+role+'="'+id+'"]');for(const k of ['x','y','width','height'])node.setAttribute(k,b?b[k]:0);}
  if(enhanced())nearby(root,source,navigating()?null:target);
  if(kind==='coaster'&&source&&target){const x=source.x-12,y=source.y+source.height*.4,tx=target.x+target.width+10,ty=target.y+target.height*.75;svg.querySelector('.day0-drag-route').setAttribute('d',`M ${x} ${y} C ${x-120} ${y-75},${tx+125} ${ty+50},${tx} ${ty}`);}
 }
 function key(e,root,act){if(!stage()||g.overlay)return false;const kind=stage();if(navigating()&&['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();act('shelfCategory',['KeyA','ArrowLeft'].includes(e.code)?'-1':'1');return true;}if(e.code==='Tab'){e.preventDefault();if(kind==='recipe')act('service');else root.querySelector(kind==='prepRecipeRead'?'[data-act="tutorialContinue"]':selector())?.focus();return true;}if(['Enter','Space'].includes(e.code)){e.preventDefault();if(kind==='coaster'&&document.activeElement?.dataset.drag==='coaster')g.coaster(g.tutorial.seat,'keyboard');else if(kind==='recipe')act('service');else if(kind==='prepRecipeRead')act('tutorialContinue');else {const el=root.querySelector(selector());if(el?.dataset.act)act(el.dataset.act,el.dataset.id,el);}return true;}return true;}
 return {stage,html,sync,allows,key,canHover,navigateShelf,updateShelf};
};
})(window);
