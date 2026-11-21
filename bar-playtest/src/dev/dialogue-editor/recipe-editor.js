(async function(W){
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let source,book,table='cocktails',id,peek='detail',busy=false;
const state=t=>$('state').textContent=t,dirty=()=>book&&Object.values(book.edits).some(o=>Object.keys(o).length),tabDrinks=()=>table==='cocktails';
const info=()=>book.row(table,id),items=()=>book.base.shelf_items.filter(r=>r.kind==='ingredient').map(r=>book.row('shelf_items',r.id));
const mix={build:'빌드',shake:'쉐이킹',stir:'스터',none:'혼합 없음'},actions={pour:'따르기',fill_up:'필업',add:'넣기'},unit=u=>u==='count'?'개':u;
const opt=(v,t,selected)=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(t)+'</option>';
function controls(){const changed=dirty();$('save').hidden=!W.LunaEditorStorage.local;$('save').disabled=busy||!changed;$('export').disabled=busy||!changed;}
function mark(){const changed=dirty();state(changed?'저장하지 않은 변경':'변경 없음');controls();}
function thumb(id){const a=source.presentation.assets['item_'+id]||source.presentation.assets.item_dummy;if(!a)return '';const [x,y,r,b]=a.alphaBBox||[0,0,a.w,a.h];return '<svg class="ingredient-thumb" aria-hidden="true" viewBox="'+[x,y,Math.max(1,r-x),Math.max(1,b-y)].join(' ')+'"><image href="'+esc(a.src)+'" width="'+a.w+'" height="'+a.h+'"/></svg>';}
function list(){
 const q=$('search').value.trim().toLowerCase(),rows=tabDrinks()?book.base.cocktails.map(r=>book.row(table,r.id)):items();
 $('list').innerHTML=rows.filter(r=>[r.id,r['name.ko'],r['name.en']].some(v=>v.toLowerCase().includes(q))).map(r=>'<button data-id="'+esc(r.id)+'" aria-pressed="'+(id===r.id)+'">'+(tabDrinks()?'':thumb(r.id))+esc(r['name.ko'])+'<small>'+esc(r.id)+'</small></button>').join('')||'검색 결과 없음';
}
function form(){
 const r=info(),field=(k,title,kind='text',opts)=>{const v=r[k]==='\\N'?'':r[k],attr='data-field="'+k+'"';return '<label class="field"><span>'+title+'</span>'+(opts?'<select '+attr+'>'+Object.entries(opts).map(([k,t])=>opt(k,t,v)).join('')+'</select>':kind==='textarea'?'<textarea '+attr+'>'+esc(v)+'</textarea>':'<input '+attr+' type="'+kind+'" value="'+esc(v)+'">')+'</label>';},group=(title,inner)=>'<fieldset><legend>'+title+'</legend>'+inner+'</fieldset>';
 $('identity').textContent=(tabDrinks()?'칵테일':'재료')+' / '+id;$('title').textContent=r['name.ko'];let html=group('이름',field('name.ko','한국어')+field('name.en','English'));
 if(tabDrinks()){
  const lines=book.lines(id);
  html+=group('칵테일 설명',field('flavor.ko','설명','textarea')+'<details><summary>영어 설명</summary>'+field('flavor.en','English','textarea')+'</details>')+
  group('제조법',field('mix','제조 방식','',mix)+field('glass','사용할 잔','',Object.fromEntries(book.base.shelf_items.filter(i=>i.kind==='glass').map(i=>[i.id,i['name.ko']])))+
  field('recipe_desc.ko','제조법 문구','textarea')+'<details><summary>영어 제조법</summary>'+field('recipe_desc.en','English','textarea')+'</details><small>설명문은 직접 작성합니다. 실제 제조 용량은 아래 재료 목록에서 바꾸세요.</small>')+
  group('재료 선택','<div class="chips">'+items().map(i=>{const on=lines.some(l=>l.ingredient===i.id);return '<button data-pick="'+esc(i.id)+'" aria-pressed="'+on+'">'+thumb(i.id)+(on?'✓ ':'＋ ')+esc(i['name.ko'])+'</button>';}).join('')+'</div>')+
  group('제조 순서와 용량',lines.map((l,i)=>{const it=book.row('shelf_items',l.ingredient);return '<div class="step" data-step="'+i+'"><strong>'+esc(it['name.ko'])+'</strong><input aria-label="'+esc(it['name.ko'])+' 용량" type="number" min="0" step="'+(it.default_target_unit==='count'?'1':'any')+'" data-line="qty" value="'+esc(l.qty)+'"><small>'+unit(it.default_target_unit)+'</small><select aria-label="재료 동작" data-line="action">'+(it.default_target_unit==='count'?['add']:['pour','fill_up']).map(k=>opt(k,actions[k],l.action)).join('')+'</select><label><input type="checkbox" data-line="is_core" '+(l.is_core==='true'?'checked':'')+'> 핵심</label><button data-shift="-1" aria-label="앞 순서로" '+(!i?'disabled':'')+'>↑</button><button data-shift="1" aria-label="뒤 순서로" '+(i===lines.length-1?'disabled':'')+'>↓</button></div>';}).join(''))+
  group('기본 정보',field('price','판매가 (G)','number')+field('abv','도수 (%)','number')+field('time_limit_sec','제한 시간 (초)','number'));
 }else{
  html+=group('선반 호버 설명',field('desc.ko','설명','textarea')+'<details><summary>영어 설명</summary>'+field('desc.en','English','textarea')+'</details>')+
  group('제조 기본값',field('default_target_qty','기본량 ('+unit(r.default_target_unit)+')','number')+'<small>개별 레시피에 지정한 용량과는 별개입니다.</small>')+
  group('이 재료를 쓰는 칵테일','<div class="chips">'+(book.base.cocktails.filter(c=>book.lines(c.id).some(l=>l.ingredient===id)).map(c=>'<button data-drink="'+esc(c.id)+'">'+esc(book.row('cocktails',c.id)['name.ko'])+' →</button>').join('')||'없음')+'</div>');
 }
 $('fields').innerHTML=html;
}
function preview(){
 const lang=$('lang').value,L=(k,e)=>lang==='ko'?k:e,D=source.presentation,a=k=>D.assets[k]?.src||'',t={shelf_items:book.base.shelf_items.map(i=>book.row('shelf_items',i.id)),cocktail_tags:book.tags};
 const g={lang,t,text:(r,k)=>!r?'':r[k+'.'+lang]==='\\N'?'':r[k+'.'+lang]||'',cocktail:k=>book.row('cocktails',k),name:k=>{const r=book.base.cocktails.some(c=>c.id===k)?book.row('cocktails',k):t.shelf_items.find(s=>s.id===k);return g.text(r,'name')||k;}};
 const art=W.LunaCocktailArt.presentation({D,g,L,esc,a,paintSource:s=>s||''}),views=W.LunaBarViews({D,g,ui:{},L,esc,a,button:(label,act,attrs)=>'<button tabindex="-1" '+attrs+'>'+label+'</button>',...art});
 const before=$('preview').querySelector('.prep-recipe-scroll')?.scrollTop||0;
 if(tabDrinks()){
  t.recipes=book.lines(id).map(l=>({...l,context:id,qty:+l.qty||0,unit:unit(book.row('shelf_items',l.ingredient).default_target_unit)}));
  $('preview').innerHTML='<div class="switch"><button data-peek="detail" aria-pressed="'+(peek==='detail')+'">상세 레시피</button><button data-peek="hover" aria-pressed="'+(peek==='hover')+'">목록 호버</button></div><div class="stage-box prep-screen">'+(peek==='detail'?'':'<span class="resource-recipe-list" hidden></span>')+views.recipePanel(info(),{preview:peek==='hover'})+'</div>';
  $('preview').querySelector('.prep-recipe-scroll').scrollTop=before;
 }else $('preview').innerHTML='<div class="tip-box prep-screen"><h3>재료 선반 호버</h3>'+art.itemArt(id)+views.shelfTip(info())+'</div><div class="tip-box"><h3>레시피 아이콘 호버</h3>'+art.itemArt(id,'','recipe')+'<div class="ingredient-tip recipe-item-tip"><strong>'+esc(art.itemName(id))+'</strong></div></div>';
}
function choose(t,k){table=t;id=k;peek='detail';document.querySelectorAll('[data-table]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.table===table));list();form();preview();}
$('search').oninput=()=>book&&list();$('lang').onchange=()=>book&&preview();
document.addEventListener('click',e=>{if(!book||busy)return;const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.table){$('search').value='';choose(d.table,d.table==='shelf_items'?items()[0].id:book.base.cocktails[0].id);}else if(d.id)choose(table,d.id);else if(d.drink){$('search').value='';choose('cocktails',d.drink);}
 else if(d.peek){peek=d.peek;preview();}else if(d.pick||d.shift){const ls=structuredClone(book.lines(id));if(d.pick){const i=ls.findIndex(l=>l.ingredient===d.pick);if(i>=0)ls.splice(i,1);else{const r=book.row('shelf_items',d.pick);ls.push(book.originalLines(id).find(l=>l.ingredient===d.pick)||{ingredient:d.pick,qty:r.default_target_qty,is_core:ls.length?'false':'true',action:r.default_action});}}else{const i=+b.closest('[data-step]').dataset.step,j=i+Number(d.shift);[ls[i],ls[j]]=[ls[j],ls[i]];}book.setLines(id,ls);form();preview();mark();}
});
$('fields').oninput=e=>{if(busy)return;const el=e.target;
 if(el.dataset.field)book.set(table,id,el.dataset.field,el.value);
 else if(el.dataset.line){const ls=structuredClone(book.lines(id));ls[+el.closest('[data-step]').dataset.step][el.dataset.line]=el.type==='checkbox'?String(el.checked):el.value;book.setLines(id,ls);}else return;
 $('title').textContent=info()['name.ko'];if(el.dataset.field?.startsWith('name.'))list();preview();mark();
};
async function save(exporting){if(!book||busy)return;busy=true;document.querySelector('.book').inert=true;controls();
 try{const changes=book.output(),files={...source.files,...changes};if(exporting){
  const catalog=await W.LunaCsv.load(p=>Promise.resolve(files[p])),result=W.LunaRuntimeProjection.project(catalog,JSON.parse(files['web-views.json']),source.presentation);
  const pack=await W.LunaDialogueExport.packageFiles({files:source.files,output:()=>changes},result),url=URL.createObjectURL(W.LunaDialogueExport.zip(pack)),a=document.createElement('a');a.href=url;a.download='luna-craft-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);state('ZIP 내보내기 완료 · 원본은 그대로입니다.');
 }else{const reply=await W.LunaEditorStorage.save({output:()=>book.edits},source.revision,'craft');source={...source,files,revision:reply.revision};book=new W.LunaRecipeBook.Book(files);state('CSV 저장 완료 · 본편을 새로 열면 적용됩니다.');}
 }catch(err){state(err.message);}finally{busy=false;document.querySelector('.book').inert=false;controls();}}
$('save').onclick=()=>save(false);$('export').onclick=()=>save(true);W.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
try{source=await W.LunaEditorStorage.load();book=new W.LunaRecipeBook.Book(source.files);choose(table,book.base.cocktails[0].id);controls();state(source.local?'로컬 CSV 연결됨':W.LunaEditorStorage.local?'저장 서버 미연결 · ZIP 가능':'GitHub Pages · ZIP 내보내기');}catch(e){state(e.message);}
})(window);
