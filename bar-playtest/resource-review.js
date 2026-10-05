(function(){
'use strict';
const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frame=$('#game'),lab=$('#lab'),C=ResourceCatalog,R=ResourceFilters,cache=new Map(),facetsByGroup=new Map();
const loadingStarted=performance.now();$('#export').disabled=true;
let F,rows=[],group='bar-characters',selected=null,playing=true,step=0,fps=6,disabled=new Set(),last=0,age=0,activeLaunch=null,busy=false,redrawPending=false,launchEpoch=0;
const badge=r=>'<span class="badge '+r.status+'">'+C.statusNames[r.status]+'</span>';
const count=r=>Math.max(1,...(r.layers||[]).map(l=>l.frames||1));
function image(src){if(!src)return null;if(!cache.has(src)){const im=new Image();cache.set(src,im);im.onload=()=>{if(!redrawPending){redrawPending=true;requestAnimationFrame(()=>{redrawPending=false;drawThumbs();drawPreview();});}};im.onerror=()=>{if(selected?.layers?.some(l=>l.src===src))$('#preview-status').textContent='파일을 불러오지 못했습니다. 원본 경로를 확인해 주세요.';};im.src=src;}return cache.get(src);}
function geometry(l,n){if(l.rects){const f=l.rects[n%l.rects.length];return {src:f.src||l.src,x:f.x||0,y:f.y||0,w:f.w,h:f.h,ox:f.ox||0,oy:f.oy||0,cw:f.cw||f.w,ch:f.ch||f.h};}const im=image(l.src),cols=l.cols||l.frames||1,w=l.fw||l.w/cols||im?.naturalWidth/cols||1,h=l.fh||l.h||im?.naturalHeight||1;return{src:l.src,x:(l.sx||0)+n%cols*(l.dx||w),y:(l.sy||0)+Math.floor(n/cols)*(l.dy||h),w,h,ox:0,oy:0,cw:w,ch:h};}
function paint(canvas,r,n,muted=new Set()){
 if(!canvas)return;const ctx=canvas.getContext('2d');let sw=r.stage?.[0]||1,sh=r.stage?.[1]||1;
 const ls=(r.layers||[]).filter(l=>!muted.has(l.key)).map(l=>({l,f:geometry(l,n%(l.frames||1))}));
 if(!r.stage)for(const {f}of ls){sw=Math.max(sw,f.cw);sh=Math.max(sh,f.ch);}
 const k=canvas.dataset.thumb?Math.min(1,220/sw,180/sh):1;canvas.width=Math.max(1,Math.round(sw*k));canvas.height=Math.max(1,Math.round(sh*k));ctx.setTransform(k,0,0,k,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,sw,sh);
 for(const {l,f}of ls){const im=image(f.src);if(!im?.complete||!im.naturalWidth)continue;const scale=r.stage?l.scale||1:1,ox=r.stage?(sw-f.w*scale)/2+(l.offset?.[0]||0):f.ox,oy=r.stage?sh-f.h*scale-(l.offset?.[1]||0):f.oy;ctx.drawImage(im,f.x,f.y,f.w,f.h,ox,oy,f.w*scale,f.h*scale);}
}
function drawThumbs(){for(const c of document.querySelectorAll('canvas[data-thumb]')){const r=rows.find(r=>r.id===c.dataset.thumb);if(r)paint(c,r,0);}}
function drawPreview(){if(!selected)return;paint($('#preview-canvas'),selected,step,disabled);const label=$('#frame-label');if(label)label.textContent=(step+1)+' / '+count(selected)+' 프레임';const slider=$('#frame-slider');if(slider)slider.value=step;}
function picked(){if(!facetsByGroup.has(group))facetsByGroup.set(group,{});return facetsByGroup.get(group);}
function baseFiltered(){const q=$('#search').value.trim().toLowerCase(),s=$('#status').value;return rows.filter(r=>r.group===group&&(s==='all'||s==='attention'&&['dummy','shared','missing'].includes(r.status)||r.status===s)&&(!q||[r.title,r.usage,r.wanted,r.key,r.note,...(r.layers||[]).map(l=>l.key+' '+l.src+' '+l.source)].join(' ').toLowerCase().includes(q)));}
function filtered(){return baseFiltered().filter(r=>R.matches(r,picked()));}
function filterHTML(){
 const base=baseFiltered(),all=rows.filter(r=>r.group===group),p=picked();
 return R.schema(group).map(([key,label])=>{
  const candidates=base.filter(r=>R.matches(r,p,key));
  return '<div class="facet-row" role="group" aria-label="'+label+'"><strong>'+label+'</strong><div class="facet-options">'+[['all','전체'],...R.options(all,key)].map(([value,title])=>{
   const n=value==='all'?candidates.length:candidates.filter(r=>R.values(r,key).includes(value)).length,active=(p[key]||'all')===value;
   return '<button data-facet="'+key+'" data-value="'+E(value)+'" aria-pressed="'+active+'" '+(!n&&!active?'disabled':'')+'>'+E(title)+'<span>'+n+'</span></button>';
  }).join('')+'</div></div>';
 }).join('')+'<div class="filter-foot"><small>분류끼리 함께 적용됩니다. 이미지 형태는 실제 프레임 수 기준입니다.</small><button data-filter-reset '+(!Object.values(p).some(v=>v!=='all')&&!$('#search').value&&$('#status').value==='all'?'disabled':'')+'>필터 초기화</button></div>';
}
function clearFilters(){facetsByGroup.set(group,{});$('#search').value='';$('#status').value='all';render();}

function render(){
 $('#nav').innerHTML=['바 내부','외부'].map(area=>'<h3>'+area+'</h3>'+C.groups.filter(g=>g[1]===area).map(([id,,label])=>'<button data-group="'+id+'" aria-current="'+(id===group)+'">'+label+'<em>'+rows.filter(r=>r.group===id).length+'</em></button>').join('')).join('');
 const gs=C.groups.find(g=>g[0]===group);$('#heading').textContent=gs[1]+' · '+gs[2];const list=filtered();$('#resource-filters').innerHTML=filterHTML();if(selected&&!list.some(r=>r.id===selected.id)){selected=null;$('#inspector').innerHTML='<p class="empty">리소스를 선택하면<br>미리보기와 사용 정보를 표시합니다.</p>';}$('#count').textContent=list.length+'개 표시 / '+rows.filter(r=>r.group===group).length+'개';
 $('#totals').innerHTML=[['전체 항목',rows.length],['더미·대체·미등록',rows.filter(r=>['dummy','shared','missing'].includes(r.status)).length],['실제 화면 테스트',rows.filter(r=>r.launch).length]].map(([t,n])=>'<span><b>'+n+'</b>'+t+'</span>').join('');
 $('#grid').innerHTML=list.map(r=>'<button class="card '+(selected?.id===r.id?'selected':'')+'" data-id="'+E(r.id)+'"><div class="thumb">'+(r.preview?'<img class="ui-shot" src="'+E(r.preview)+'" alt="'+E(r.title)+' 실제 화면 미리보기" loading="lazy" decoding="async"><span class="shot-label">실제 화면</span>':r.layers?.length?'<canvas data-thumb="'+E(r.id)+'" aria-label="'+E(r.title)+'"></canvas>':'<span class="symbol">'+(r.status==='missing'?'—':'▣')+'</span>')+'</div><div class="card-copy"><strong>'+E(r.title)+'</strong><p>'+E(r.usage)+'</p>'+badge(r)+'</div></button>').join('')||'<p class="empty">일치하는 항목이 없습니다.</p>';
 drawThumbs();
}
function select(id){selected=rows.find(r=>r.id===id);if(!selected)return;step=age=0;playing=true;disabled=new Set();fps=selected.layers?.[0]?.fps||6;const r=selected;
 $('#inspector').innerHTML='<small>'+E(C.groups.find(g=>g[0]===r.group)?.[1])+' / RESOURCE DETAIL</small><h2>'+E(r.title)+'</h2><p>'+E(r.usage)+'</p>'+badge(r)+
 (r.preview?'<figure class="ui-preview"><img src="'+E(r.preview)+'" alt="'+E(r.title)+' 실제 화면 미리보기"><figcaption>'+E(r.previewNote)+'</figcaption></figure>':r.layers?.length?'<div class="preview"><canvas id="preview-canvas"></canvas></div><div class="controls"><button data-action="play">일시정지</button><button data-action="prev" aria-label="이전 프레임">◀</button><button data-action="next" aria-label="다음 프레임">▶</button><label>FPS<input id="fps" type="number" min="1" max="60" value="'+fps+'"></label><button data-action="background">배경 변경</button></div><input class="scrub" id="frame-slider" aria-label="프레임" type="range" min="0" max="'+(count(r)-1)+'" value="0"><small id="frame-label"></small><p id="preview-status"></p>':'<p class="empty">'+(r.status==='missing'?'전용 이미지 미등록':'실제 화면에서 확인하는 UI입니다.')+'</p>')+
 (r.launch?'<button class="primary" data-action="launch">실제 화면 테스트 ↗</button>':'')+
 '<dl class="meta"><dt>사용 / 확인 방법</dt><dd>'+E(r.note||'현재 등록된 게임 리소스입니다. 최종 제작 여부는 담당자 확인이 필요합니다.')+'</dd>'+(r.wanted?'<dt>요청 키 → 실제 사용 키</dt><dd>'+E(r.wanted)+' → '+E(r.key||'없음')+'</dd>':'')+'<dt>레이어 / 원본 출처</dt><dd class="layers">'+(r.layers?.length?r.layers.map(l=>'<label><input type="checkbox" data-layer="'+E(l.key)+'" checked> '+E(l.key)+'</label><span>'+E(l.source||'출처 메타데이터 없음')+'</span><span>'+(l.src?.startsWith('data:')?'cinematic/assets.js 내장 PNG': '<a href="'+E(l.src)+'" target="_blank" rel="noopener">'+E(l.src)+'</a>')+'<br>'+E((l.fw||l.w||'자동')+' × '+(l.fh||l.h||'자동'))+' · '+(l.frames||1)+'프레임</span>').join(''):'별도 이미지 없음 · 게임 코드에서 구성')+'</dd></dl>';
 document.querySelectorAll('.card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));drawPreview();
 if(innerWidth<900)$('#inspector').scrollIntoView({behavior:'smooth',block:'start'});
}
function reset(){F.lunaQA.close();F.lunaCampaign.developer();F.document.querySelector('.updates-confirm')?.click();F.barGame.pendingDailyUnlocks=null;F.barGame.tutorial=null;F.barGame.paused=false;F.lunaCampaign.ui.auto=false;F.lunaQA.runSituation('prep');F.barGame.cancelCraft();F.barGame.overlay=null;}
async function launch(d,title,note){
 if(busy)return;const token=++launchEpoch;busy=true;activeLaunch={d,title,note};lab.classList.remove('parked');$('#lab-title').textContent=title;$('#lab-note').textContent=note||'실제 UI를 직접 조작하세요.';$('#lab-note').classList.remove('error');
 try{
  // Focus before opening a test dialog. Refocusing the iframe afterwards blurs
  // its focused button and closes the exterior P drawer via loseFocus().
  frame.focus();F.focus();
  reset();const g=F.barGame,c=F.lunaCampaign,q=F.lunaQA,ui=c.ui;const qa=id=>q.runSituation(id);const prep=id=>{q.state.cocktail=id||'gin_tonic';qa('prep');};
  if(d.type==='qa')qa(d.id);
  else if(d.type==='drink'||d.type==='serve'){q.state.cocktail=d.id;qa(d.type==='serve'?'result':'prep');if(d.type==='drink'){g.cancelCraft();g.openRecipes();ui.peek=d.id;}}
  else if(d.type==='prep'||d.type==='prep-recipe'){prep(d.id==='opener'?'bottle_beer':'gin_tonic');if(d.type==='prep'){const it=g.t.shelf_items.find(i=>i.id===d.id);ui.tab=it?.kind==='glass'?'glass':it?.kind==='tool'||d.id==='opener'?'tool':it?.shelf_group||'liquor';}else ui.recipeOpen=true;}
  else if(d.type==='recipes'){g.day=1;g.openRecipes();}
  else if(d.type==='overlay'){if(d.id==='serveDetails')qa('result');else if(['recipe','openerWarning','ingredientWarning'].includes(d.id)){prep();if(d.id==='recipe'){g.debugFill();g.startCraft();}}else qa('wait');if(d.id==='history')g.history.push({actor:'luna',text:'오늘도 한 잔을 준비하겠습니다.'});g.overlay=d.id;}
  else if(['solo','pair'].includes(d.type)){g.day=3;g.screen='bar';g.phase='regular';g.seats={L:{id:'review-left',actor:d.type==='pair'?'samho':'chris',state:'STORY'},M:null,R:d.type==='pair'?{id:'review-right',actor:'tom',state:'STORY'}:null};g.focus='L';g.currentOrder=null;g.dialogue=g.makeLine(d.type==='pair'?'luna':'chris',d.type==='pair'?'삼호는 톰 걸 만들고 나서 주문을 받도록 하겠습니다.':'어서 와. 오늘도 잘 부탁하지.');g.dialogue.chars=g.dialogue.text.length;}
  else if(d.type==='scene'||d.type==='choices'){q.state.scene=d.id||'t99_dialogue';q.state.step='0';if(d.type==='choices'){const choice=g.t.steps.find(r=>r.type==='choice');if(!choice)throw Error('등록된 선택지 스텝이 없습니다.');q.state.scene=choice.context;q.state.step=String(g.t.steps.filter(r=>r.context===choice.context).sort((a,b)=>+a.seq-+b.seq).indexOf(choice));}q.runScene();}
  else if(d.type==='tutorial'){g.reset(0,'full',1,true,{variant:'original',serviceVersion:'A'});}
  else if(d.type==='mini'){ui.minigames=true;g.startMinigame(d.id,'original');}
  else if(d.type==='terrace'){c.scene(d.id,'리소스 확인',d.id==='workshop'?'black':'terrace',()=>closeLab());}
  else if(d.type==='door'){c.runDoorTransition(d.id,()=>Promise.resolve(),()=>{c.screen('developer');c.render(true);});}
  else if(d.type==='day-transition'){c.beginDayTransition(0,1,()=>c.screen('developer'));}
  else if(d.type==='johnny-memory'){c.playJohnnyMemory(()=>closeLab());}
  else if(d.type==='qa-panel'){q.open('scenes');}
  else if(d.type==='updates'){await new Promise(resolve=>F.requestAnimationFrame(resolve));if(token!==launchEpoch)return;F.LunaUpdates.mount({preview:true});}
  else if(d.type==='outside'||d.type==='exterior'){
   const o=F.outsidePlaytest;ui.outside=true;Object.assign(o.config,{day:d.type==='outside'?99:1,flow:'out',place:d.id==='home'?'home':'bar',qaCase:d.id});await o.start({showDevHint:d.id==='entry-hint'});if(token!==launchEpoch)return;
   if(d.type==='outside'){o.model.start({day:99,flow:'out',place:'bar',qaCase:d.id,qaActivation:'source'});const t=F.LunaOutsideQA.target(o.model);o.model.x=t.x-.1;o.model.tick(.05);o.model.updateNear();o.model.interact();}
   o.snapCamera();o.model.paused=false;o.refreshHUD?.();
   if(d.type==='exterior'){
    const m=o.model;
    if(['purchase','poor'].includes(d.id)){g.progress.money=d.id==='poor'?0:1000;g.progress.inventory={};g.progress.flags={shiba_shop_met:true,shiba_allowance_received:true};m.x=-2.87;m.updateNear();o.snapCamera();o.tick(0);
     if(d.id==='purchase'){g.progress.money-=300;o.notifyItem(m,'bitters');o.tick(0);}
     else{const drain=()=>{for(let i=0;i<30&&m.story.speech&&!m.story.speech.choice;i++){m.story.speech.elapsed=99;m.story.advance();}};F.LunaOutsideShop.begin(m,{x:-2.68,y:-.596},false);drain();m.story.choose('shop-yes');drain();m.story.choose('shop-allowance-no');drain();o.tick(0);}
    }
    if(d.id==='bd'){m.x=5.5;m.updateNear();o.snapCamera();F.LunaBDVendor.interact(m,{id:'bd-vendor',x:5.65,y:-.7});}
    if(d.id==='panorama'){m.x=F.LunaOutside.viewpoint.x;m.updateNear();o.snapCamera();o.refreshHUD();}
   }
   if(['settings','console'].includes(d.id)){const code=d.id==='settings'?'Escape':'KeyP';F.document.dispatchEvent(new F.KeyboardEvent('keydown',{code,key:d.id==='settings'?'Escape':'p',bubbles:true}));}
  }
  if(token!==launchEpoch)return;c.render(true);
 }catch(e){if(token!==launchEpoch)return;$('#lab-note').textContent='이 테스트를 시작하지 못했습니다: '+e.message+' · 목록으로 돌아간 뒤 다른 항목을 선택해 주세요.';$('#lab-note').classList.add('error');console.error(e);}
 finally{if(token===launchEpoch)busy=false;}
}
function closeLab(){launchEpoch++;busy=false;if(F){F.lunaCampaign.developer();F.barGame.paused=true;}lab.classList.add('parked');$('#inspector [data-action="launch"]')?.focus();}
$('#close-lab').onclick=closeLab;$('#replay').onclick=()=>activeLaunch&&launch(activeLaunch.d,activeLaunch.title,activeLaunch.note);
$('#nav').onclick=e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;render();}};
$('#resource-filters').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-filter-reset')){clearFilters();$('#resource-filters [data-facet]')?.focus({preventScroll:true});return;}const key=b.dataset.facet,value=b.dataset.value;picked()[key]=value;render();[...document.querySelectorAll('[data-facet]')].find(el=>el.dataset.facet===key&&el.dataset.value===value)?.focus({preventScroll:true});};
$('#grid').onclick=e=>{const b=e.target.closest('[data-id]');if(b)select(b.dataset.id);};
$('#search').oninput=render;$('#status').onchange=render;
$('#inspector').onclick=e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;if(a==='launch')launch(selected.launch,selected.title,selected.note);else if(a==='play'){playing=!playing;e.target.textContent=playing?'일시정지':'재생';}else if(a==='next'||a==='prev'){playing=false;step=(step+(a==='next'?1:-1)+count(selected))%count(selected);$('#inspector [data-action="play"]').textContent='재생';drawPreview();}else if(a==='background'){const p=$('.preview');if(p.classList.contains('light')){p.classList.remove('light');p.classList.add('black');}else if(p.classList.contains('black'))p.classList.remove('black');else p.classList.add('light');}};
$('#inspector').oninput=e=>{if(e.target.id==='frame-slider'){step=+e.target.value;playing=false;$('#inspector [data-action="play"]').textContent='재생';drawPreview();}if(e.target.id==='fps')fps=Math.max(1,Math.min(60,+e.target.value||6));if(e.target.dataset.layer){e.target.checked?disabled.delete(e.target.dataset.layer):disabled.add(e.target.dataset.layer);drawPreview();}};
$('#export').onclick=()=>{const csv=[['분류','이름','용도','상태','요청 키','사용 키','파일','원본 출처','비고'],...rows.map(r=>[C.groups.find(g=>g[0]===r.group).slice(1).join(' / '),r.title,r.usage,C.statusNames[r.status],r.wanted,r.key,(r.layers||[]).map(l=>l.src?.startsWith('data:')?'cinematic/assets.js#'+l.key:l.src).join(' | '),(r.layers||[]).map(l=>l.source).join(' | '),r.note])].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='unknown-resource-review.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function tick(t){if(selected&&playing&&lab.classList.contains('parked')){age+=Math.min(.1,(t-last)/1000)*fps;if(age>=1){step=(step+Math.floor(age))%count(selected);age%=1;drawPreview();}}last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
async function init(){try{F=frame.contentWindow;if(!F.lunaCampaign||!F.lunaQA){if(performance.now()-loadingStarted>45000)throw Error('시뮬레이터 로딩이 지연되고 있습니다. 웹 서버 연결을 확인한 뒤 새로고침해 주세요.');setTimeout(init,150);return;}F.document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&!/^(blob:|data:|#)/.test(a.getAttribute('href'))){e.preventDefault();$('#lab-note').textContent='테스트 안에서는 다른 페이지로 이동하지 않습니다. 목록으로 돌아가 다른 테스트를 선택하세요.';}},true);F.document.querySelector('.updates-confirm')?.click();F.lunaCampaign.developer();F.barGame.paused=true;rows=C.build(F).map(R.decorate);$('#notice').textContent='카드별 용도와 대체 여부를 확인하세요. 컷씬 캐릭터 데이터를 추가로 불러오고 있습니다.';render();await F.lunaCampaign.script('assets');rows.push(...C.cinema(F).map(R.decorate));$('#notice').textContent='0–3일차 출연 캐릭터 + 부비(등장 예정) · UI는 실제 화면 캡처 제공 · 하운드·코라테크 병력 제외.';render();window.resourceReview.ready=true;$('#export').disabled=false;}catch(e){$('#notice').textContent='데이터를 불러오지 못했습니다: '+e.message;$('#notice').classList.add('error');}}
window.resourceReview={get rows(){return rows;},get selected(){return selected;},select,launch,close:closeLab,ready:false};
init();
})();
