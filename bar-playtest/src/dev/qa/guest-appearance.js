/* Preview the live guest generator; never changes seated guests or story state. */
(function(W){
'use strict';
W.LunaGuestAppearance=function({g,D,esc,button}){
 const state={gender:'f',looks:{}};
 const groups=[['body','몸체'],['top','상의'],['accessory','액세서리'],['eyebrow','눈썹'],['eyes','눈'],['mouth','입'],['hair','머리']];
 const group=key=>/_(Acc|cyberware)_\d+$/.test(key)?'accessory':key.replace(/^guest_[mf]_/,'').replace(/_\d+$/,'');
 const current=()=>state.looks[state.gender] ||= g.appearance(state.gender);
 const filename=key=>key?D.assets[key].src.split('/').pop():'없음';
 function thumb(key){
  if(!key)return '<span class="guest-look-none">—</span>';
  const a=D.assets[key],box=a.alphaBBox||[0,0,a.w,a.h],scale=Math.min(68/Math.max(1,box[2]-box[0]),58/Math.max(1,box[3]-box[1]));
  return `<span class="guest-look-thumb"><img src="${esc(a.src)}" alt="" style="width:${a.w*scale}px;height:${a.h*scale}px;left:${(76-(box[2]-box[0])*scale)/2-box[0]*scale}px;top:${(66-(box[3]-box[1])*scale)/2-box[1]*scale}px"></span>`;
 }
 function html(tabs){
  const look=current(),pool=g.appearanceParts(state.gender),top=look.layers.find(k=>group(k)==='top');
  return `<div class="start-screen guest-look-screen">${tabs}<section class="guest-look-layout"><aside class="guest-look-preview"><h2>손님 외형</h2><p>실제 게임과 같은 파츠 · 성별별 선택 유지</p><div class="row">${['f','m'].map(gender=>button(gender==='f'?'여성':'남성','guestLooksGender',`data-id="${gender}" aria-pressed="${state.gender===gender}"`,state.gender===gender?'selected':'')).join('')}</div><div class="guest-look-stage" aria-label="${state.gender==='f'?'여성':'남성'} 손님 합성 미리보기">${look.layers.map(key=>`<img src="${esc(D.assets[key].src)}" data-look-layer="${key}" alt="">`).join('')}</div>${button('랜덤 다시 생성','guestLooksRandom','','primary')}<p class="guest-look-rule">남성 팔 밴드 Acc_2와 사이버웨어 1·3은 민소매 top_3에만 사용합니다. 미리보기는 정적 파츠이며 게임의 눈·입 애니메이션과 구분됩니다.</p><dl>${groups.map(([id,label])=>`<div><dt>${label}</dt><dd>${esc(filename(look.layers.find(k=>group(k)===id)))}</dd></div>`).join('')}</dl></aside><div class="guest-look-parts">${groups.map(([id,label])=>{
   const options=pool.filter(k=>group(k)===id);if(id==='accessory')options.unshift(null);
   const selected=look.layers.find(k=>group(k)===id)||null;
   return `<section><h3>${label} <small>${options.length}종${id==='accessory'?' · 없음 포함':''}</small></h3><div class="guest-look-options">${options.map(key=>button(thumb(key)+`<span>${esc(filename(key))}</span>`,'guestLooksPart',`data-id="${key||'none'}" aria-label="${label} ${esc(filename(key))}" aria-pressed="${selected===key}" ${!g.appearanceAllowed(key,top)?'disabled title="민소매 top_3 전용"':''}`,selected===key?'selected':'')).join('')}</div></section>`;
  }).join('')}</div></section></div>`;
 }
 function act(name,id){
  if(!['guestLooksGender','guestLooksRandom','guestLooksPart'].includes(name))return false;
  if(name==='guestLooksGender'){if(['m','f'].includes(id))state.gender=id;current();}
  else if(name==='guestLooksRandom')state.looks[state.gender]=g.appearance(state.gender);
  else {
   const look=current(),key=id==='none'?null:id;if(key&&!g.appearanceParts(state.gender).includes(key))return true;
   if(!g.appearanceAllowed(key,look.layers.find(k=>group(k)==='top')))return true;
   const slot=key?group(key):'accessory';look.layers=look.layers.filter(k=>group(k)!==slot);if(key)look.layers.push(key);
   const top=look.layers.find(k=>group(k)==='top');look.layers=look.layers.filter(k=>g.appearanceAllowed(k,top));
   look.layers.sort((a,b)=>groups.findIndex(([id])=>id===group(a))-groups.findIndex(([id])=>id===group(b)));
   look.ids=[...look.layers];
  }return true;
 }
 return {html,act};
};
})(window);
