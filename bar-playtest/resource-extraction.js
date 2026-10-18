/* Graphic-only exports. Screen captures and dialogue copy never enter this inventory. */
(function(W){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=['UI · 분리 그래픽','UI · 원본 조각','캐릭터 · 애니메이션','재료 · 잔 · 칵테일','배경 · 오브젝트','기타 그래픽','UI · 팝업 분리','UI · 기타 분리'];
const view=document.createElement('section');view.id='extraction-view';view.hidden=true;
view.innerHTML='<h2>리소스 추출</h2><p>화면 캡처가 아닌, 재사용할 수 있는 그래픽 요소를 개별 PNG로 저장합니다.</p><p class="extract-note">대사·설명 문구와 게임 화면은 포함하지 않습니다. E · W · S 같은 키 아이콘의 글자는 아이콘 디자인으로 유지합니다. 원본 크기와 투명도를 보존하며, 애니메이션은 레이어별 프레임을 선택할 수 있습니다.</p><div class="extract-tools"><label>그래픽 분류<select id="extract-category"><option value="all">전체</option>'+groups.map(g=>'<option>'+g+'</option>').join('')+'</select></label><label>리소스 검색<input id="extract-search" type="search" placeholder="상호작용, 선택지, 말풍선, 파일명…"></label></div><p id="extract-count" role="status"></p><div class="extract-grid"></div><div class="extract-pages"><button data-extract-page="-1">이전</button><span></span><button data-extract-page="1">다음</button></div>';
document.querySelector('main').append(view);
const partNames={all:'모든 요소',background:'배경',border:'테두리',icon:'아이콘',shadow:'그림자',decoration:'장식',original:'원본 이미지'};
view.querySelector('.extract-tools').insertAdjacentHTML('beforeend','<label>요소 종류<select id="extract-part">'+Object.entries(partNames).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label>');
view.querySelector('.extract-tools').insertAdjacentHTML('beforebegin','<div class="extract-shortcuts" role="group" aria-label="팝업 빠른 찾기">'+['전체 그래픽','새로운 목표','목표 달성','이벤트 발생','인물정보 등록','호감도 상승','호감도 하락'].map((t,i)=>'<button data-extract-shortcut="'+(i?t:'')+'">'+t+'</button>').join('')+'</div>');
let entries=[],page=0,epoch=0,observer,signature='';const pageSize=36,images=new Map();
const search=view.querySelector('#extract-search'),category=view.querySelector('#extract-category'),part=view.querySelector('#extract-part');
search.value=new URLSearchParams(location.search).get('q')||'';
function classify(row){return /ui|popup/.test(row.group)?groups[1]:/character/.test(row.group)?groups[2]:/drink|item|serve/.test(row.group)?groups[3]:/background/.test(row.group)?groups[4]:groups[5];}
function collect(rows,assets={}){
 const all=[],seen=new Map();
 function add(item){
  if(!item.src||/resource-(exports|previews)/.test(item.src)||item.src==='assets/exterior-textbox/GRD_textbox.png'||item.src.startsWith('data:image/svg'))return;
  const l=item.layer||{},key=JSON.stringify([item.src,l.frames||1,l.rects,l.fw,l.fh,l.cols,l.sx,l.sy,l.dx,l.dy]);
  const old=seen.get(key);if(old){old.search+=' '+item.title+' '+(item.usage||'');return;}
  item.id='graphic-'+all.length;item.search=[item.title,item.src,item.category,item.usage,item.contexts,l.key].join(' ');all.push(item);seen.set(key,item);
 }
 for(const a of W.ResourceExtractionAssets||[])add(a);
 for(const a of W.ResourceUISources||[])add({...a,title:a.src.split('/').pop(),category:groups[1],layer:{...a,frames:1}});
 for(const r of rows)for(const l of r.layers||[])add({src:l.src,title:r.title+' · '+l.key,category:classify(r),usage:r.usage,layer:l});
 // Some reusable graphics (coaster, mixing nodes, generic guest parts) are
 // intentionally hidden in the review cards. Include their original layers here.
 for(const [key,a]of Object.entries(assets)){
  const category=/^(dialogue|choice|next$|money|logo|coaster|expr_|mix_|prep_)/.test(key)?groups[1]:/^(guest_|char_)/.test(key)?groups[2]:/^(item_|recipe_item_|inventory_item_|cocktail_|recipe_cocktail_|table_cocktail_)/.test(key)?groups[3]:groups[5];
  add({src:a.src,title:key==='coaster'?'코스터 · 원본 그래픽':key,category,layer:{key,src:a.src,w:a.w,h:a.h,frames:a.frames||1,fw:a.frameWidth,fh:a.frameHeight}});
 }
 return all;
}
function load(src){if(!images.has(src)){const im=new Image();im.src=src;const promise=im.decode().then(()=>im).catch(e=>{images.delete(src);throw e;});images.set(src,promise);}return images.get(src);}
function frames(a){return a.layer?.rects?.length||a.layer?.frames||1;}
function geometry(a,n,im){
 const l=a.layer||{};
 if(l.rects){const f=l.rects[n%l.rects.length];return {src:f.src||a.src,x:f.x||0,y:f.y||0,w:f.w,h:f.h,ox:f.ox||0,oy:f.oy||0,cw:f.cw||f.w,ch:f.ch||f.h};}
 const cols=l.cols||l.frames||1,w=l.fw||(l.w?l.w/cols:im.naturalWidth/cols),h=l.fh||l.h||im.naturalHeight;
 return {src:a.src,x:(l.sx||0)+n%cols*(l.dx||w),y:(l.sy||0)+Math.floor(n/cols)*(l.dy||h),w,h,ox:0,oy:0,cw:w,ch:h};
}
async function raster(a,n=0,raw=false){
 let im=await load(a.src);const f=raw?{src:a.src,x:0,y:0,w:im.naturalWidth,h:im.naturalHeight,cw:im.naturalWidth,ch:im.naturalHeight,ox:0,oy:0}:geometry(a,n,im);
 if(f.src!==a.src)im=await load(f.src);
 if(![f.w,f.h,f.cw,f.ch].every(v=>Number.isFinite(v)&&v>0&&v<=16384)||f.cw*f.ch>67108864)throw Error('이미지가 너무 큽니다. 원본 PNG를 이용해 주세요.');
 if(f.x<0||f.y<0||f.x+f.w>im.naturalWidth+.5||f.y+f.h>im.naturalHeight+.5)throw Error('프레임 범위가 원본 이미지와 맞지 않습니다.');
 const c=document.createElement('canvas');c.width=Math.round(f.cw);c.height=Math.round(f.ch);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(im,f.x,f.y,f.w,f.h,f.ox,f.oy,f.w,f.h);return c;
}
function trim(c){const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 if(x1<0)return c;const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;out.getContext('2d').drawImage(c,x0,y0,out.width,out.height,0,0,out.width,out.height);return out;
}
function save(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
const filename=a=>(a.src.startsWith('data:')?a.id:a.src.split('/').pop().split('?')[0]).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9가-힣_.-]/g,'_');
async function download(a,n,raw,trimmed){
 if(raw&&/\.png(?:\?|$)/i.test(a.src)){save(a.src,filename(a)+'.png');return;}
 let c=await raster(a,n,raw);if(trimmed)c=trim(c);
 const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG를 생성하지 못했습니다.');
 const url=URL.createObjectURL(blob);save(url,filename(a)+(raw?'':'--frame-'+String(n+1).padStart(3,'0'))+(trimmed?'--trimmed':'')+'.png');setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const filtered=()=>entries.filter(a=>(category.value==='all'||a.category===category.value)&&(part.value==='all'||(a.partKind||'original')===part.value)&&search.value.toLowerCase().split(/\s+/).filter(Boolean).every(word=>a.search.toLowerCase().includes(word)));
async function preview(card,a,token){try{
 const request=(card.previewRequest||0)+1;card.previewRequest=request;
 const n=Math.max(0,Math.min(frames(a)-1,Number(card.querySelector('[data-frame]')?.value||1)-1));
 const c=await raster(a,n);if(token!==epoch||!card.isConnected||card.previewRequest!==request)return;
 const small=document.createElement('canvas'),scale=Math.min(1,220/c.width,146/c.height);small.width=Math.max(1,Math.round(c.width*scale));small.height=Math.max(1,Math.round(c.height*scale));small.getContext('2d').imageSmoothingEnabled=false;small.getContext('2d').drawImage(c,0,0,small.width,small.height);card.querySelector('.extract-art').replaceChildren(small);card.querySelector('[data-size]').textContent=c.width+' × '+c.height+' px';
 }catch(e){if(token===epoch&&card.isConnected)card.querySelector('.extract-message').textContent='미리보기 실패 · '+e.message;}}
function render(){
 const token=++epoch;observer?.disconnect();const list=filtered(),pages=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(page,pages-1);
 view.querySelector('#extract-count').textContent=list.length+'개 그래픽 / 전체 '+entries.length+'개 · 같은 원본은 중복 제거';
 view.querySelector('.extract-grid').innerHTML=list.slice(page*pageSize,(page+1)*pageSize).map(a=>{
 const animated=frames(a)>1,framed=animated||a.layer?.rects||a.layer?.sx||a.layer?.sy||a.layer?.fw||a.layer?.fh;
 return '<article class="extract-card" data-graphic="'+a.id+'"><div class="extract-art">'+(framed?'<small>프레임 미리보기</small>':'<img src="'+esc(a.src)+'" alt="'+esc(a.title)+'" loading="lazy">')+'</div><div class="extract-copy"><small>'+esc(a.category)+'</small><h3>'+esc(a.title)+'</h3><p data-size>'+esc(a.w&&a.h?a.w+' × '+a.h+' px':'원본 크기')+'</p>'+(a.note?'<p>'+esc(a.note)+'</p>':'')+'<span class="extract-file">'+esc(a.src.startsWith('data:')?'내장 그래픽':a.src)+'</span><div class="extract-actions"><button data-extract="raw">'+(animated?'원본 시트 PNG':a.partKind?(partNames[a.partKind]||'요소')+' PNG':'원본 PNG')+'</button>'+(framed?'<label>프레임 <input data-frame type="number" min="1" max="'+frames(a)+'" value="1" aria-label="'+esc(a.title)+' 프레임"> / '+frames(a)+'</label><button data-extract="frame">이 프레임 PNG</button><label><input type="checkbox" data-trim>투명 여백 제거</label>':'')+'</div><div class="extract-message" role="status"></div></div></article>';
 }).join('')||'<p>일치하는 그래픽이 없습니다. 검색어나 분류를 바꿔 주세요.</p>';
 view.querySelector('.extract-pages span').textContent=(page+1)+' / '+pages;view.querySelector('[data-extract-page="-1"]').disabled=page===0;view.querySelector('[data-extract-page="1"]').disabled=page===pages-1;
 observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){observer.unobserve(item.target);const a=entries.find(a=>a.id===item.target.dataset.graphic);void preview(item.target,a,token);}},{rootMargin:'150px'});
 for(const card of view.querySelectorAll('[data-graphic]')){
  const im=card.querySelector('img');if(im){im.onload=()=>{card.querySelector('[data-size]').textContent=im.naturalWidth+' × '+im.naturalHeight+' px';};im.onerror=()=>{card.querySelector('.extract-message').textContent='이미지를 불러오지 못했습니다. 경로를 확인해 주세요.';};if(im.complete&&im.naturalWidth)im.onload();}
  else observer.observe(card);
 }
}
view.addEventListener('click',async e=>{
 const shortcut=e.target.closest('[data-extract-shortcut]');if(shortcut){search.value=shortcut.dataset.extractShortcut;category.value=search.value?'UI · 팝업 분리':'all';part.value='all';page=0;render();return;}
 const pager=e.target.closest('[data-extract-page]');if(pager){page+=Number(pager.dataset.extractPage);render();view.scrollIntoView({block:'start'});return;}
 const b=e.target.closest('[data-extract]');if(!b)return;const card=b.closest('[data-graphic]'),a=entries.find(a=>a.id===card.dataset.graphic),input=card.querySelector('[data-frame]'),n=Math.max(0,Math.min(frames(a)-1,Math.floor(Number(input?.value)||1)-1));if(input)input.value=n+1;
 b.disabled=true;const status=card.querySelector('.extract-message');status.textContent='PNG 준비 중…';
 try{await download(a,n,b.dataset.extract==='raw',b.dataset.extract!=='raw'&&!!card.querySelector('[data-trim]')?.checked);status.textContent='다운로드를 시작했습니다.';}catch(error){status.textContent='다운로드 실패 · '+error.message;}finally{b.disabled=false;}
});
view.addEventListener('change',e=>{if(e.target.matches('[data-frame]')){const card=e.target.closest('[data-graphic]'),a=entries.find(a=>a.id===card.dataset.graphic);e.target.value=Math.max(1,Math.min(frames(a),Math.floor(Number(e.target.value)||1)));void preview(card,a,epoch);}});
search.oninput=category.onchange=part.onchange=()=>{page=0;render();};
function show(rows,assets={}){const stamp=rows.map(r=>r.id).join('|')+'|'+Object.keys(assets).join('|');if(stamp!==signature){signature=stamp;entries=collect(rows,assets);}view.hidden=false;render();}
function hide(){view.hidden=true;++epoch;observer?.disconnect();}
W.ResourceExtraction={show,hide,collect,raster,get entries(){return entries;}};
})(window);
