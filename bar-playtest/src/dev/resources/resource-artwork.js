/* Supplements composed review cards with individually reusable, current artwork.
 * Read live registries; never inventory an asset merely because it is on disk. */
(function(W){'use strict';
function collect(rows,F){
 const known=new Set(rows.flatMap(r=>(r.layers||[]).flatMap(l=>[l.src,...(l.rects||[]).map(f=>f.src)])));
 for(const a of W.ResourceUISources||[])known.add(a.src);
 function add(key,title,group,a,extra={}){
  if(!a?.src||known.has(a.src))return;known.add(a.src);
  rows.push({id:'art:'+key,title,group,status:'registered',usage:'개별 원본 이미지',
   layers:[{...a,key,frames:a.frames||1,fw:a.frameWidth||a.fw,fh:a.frameHeight||a.fh}],
   note:'현재 사용 중인 그래픽 원본입니다. 원본 다운로드는 파일 크기·투명도·바이트를 유지하며, 시트는 프레임별로도 추출할 수 있습니다.',...extra});
 }
 const A=F.barData.assets;
 for(const [key,a]of Object.entries(A)){
  if(key.startsWith('table_empty_glass_'))add(key,'빈 잔 · '+({beer:'맥주 잔',cocktail:'칵테일 잔',long_drink:'롱드링크 잔'}[key.slice(18)]||key),'bar-items',a,{itemKind:'glass',artUsage:'table',note:'손님이 마신 뒤 테이블의 칵테일을 교체하는 빈 잔 원본입니다. 없는 잔 종류의 대체 연결은 본편의 tableDrinkArt가 결정합니다.'});
  if(key.startsWith('guest_')){
   const [,sex,...parts]=key.split('_');add(key,'일반 손님 · '+(sex==='m'?'남성':'여성')+' · '+parts.join(' '),'bar-characters',a);
  }
 }
 // UI artwork loaded directly by CSS is not part of the bar asset registry.
 for(const a of W.ResourceExtractionAssets||[]){
  if(a.partKind==='surface'){add(a.src,a.title,a.category==='UI · 팝업 분리'?'common-popups':'bar-ui',a,{usage:'배경+윤곽선 PNG',note:a.note});continue;}
  if(a.category!=='UI · 원본 조각'||a.src.includes('/extracted/'))continue;
  add(a.src,a.title,/exterior[-_]textbox/.test(a.src)?'out-ui':'bar-ui',a);
 }
 for(const [file,title,source]of [['title-logo','로고','IMG_logo'],['title-button','버튼 기본','BTN_Disable'],['title-button-active','버튼 활성','BTN_Enable'],['title-deco','버튼 장식','IMG_Deco_button'],['title-dots','점 장식','PTN_Dot']])
  add(file,'타이틀 · '+title,'bar-ui',{src:'assets/01.ArtResources/05.UI/02.Title/01.Sprites/'+source+'.png'});
 for(const [key,a]of Object.entries(F.LunaMixExamples||{}))add('mix-example:'+key,'제조 튜토리얼 · '+key,'bar-ui',a);
 for(const [file,title]of [['interaction-npc','인물'],['interaction-tv','TV']])add(file,'상호작용 튜토리얼 · '+title,'out-ui',{src:'assets/tutorials/controls/'+file+'.png'});
 add('wanted-poster','개시바 · 현상 수배 포스터','out-ui',{src:'assets/01.ArtResources/05.UI/06.Ect/ImageViewer/Interaction_Test_image.png'});
 add('wine-opener','와인 개봉 연습 · 오프너','bar-items',{src:'assets/items/wine-practice-opener.png'},{itemKind:'tool',note:'시뮬레이터 전용 와인 개봉 연습에서 사용하는 원본입니다. 본편 리소스와 구분합니다.'});
 add('campaign-lab','연구소 · 이야기 배경','out-backgrounds',{src:'assets/01.ArtResources/02.Environments/05.Cutscenes/01.Lab/90.PreviousVersions/LAB_BG_room.png'},{backgroundScreen:'컷씬',backgroundKind:'풀샷'});
 for(const manifest of [F.LUNA_BARREL_FIRE,F.LUNA_STREET_EFFECTS])for(const [key,a]of Object.entries(manifest?.assets||{}))
  add(key,'거리 효과 · '+key,'out-fx',a,{effectCategory:'environment',note:'거리 효과에 쓰는 원본 텍스처·마스크입니다. 이미지 단독으로는 최종 발광·왜곡 효과가 보이지 않습니다.'});
 return rows;
}
W.ResourceArtwork={collect};
})(window);
