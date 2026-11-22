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
 for(const [id,art] of Object.entries(F.LunaPour.CONTAINERS)){
  if(art.src)add('pour-open-'+id,'따르기 · 개봉한 '+F.barGame.name(id),'bar-items',art,{
   itemKind:'ingredient',usage:id==='beer'?'병따기 성공 · 따르기 개봉 원본':'따르기 전용 개봉 원본',launch:{type:'mini',id:'pour',ingredient:id}
  });
 }
 add('pour-spout','따르기 · 푸어러','bar-items',F.LunaPour.POURER_ART,{
  itemKind:'tool',usage:'병목에 장착하는 푸어러 원본',launch:{type:'mini',id:'pour',ingredient:'gin'}
 });
 for(const [id,a]of Object.entries(F.LunaServeGrade?.assets||{}))add('serve-grade-'+id,'제공하기 · '+id.toUpperCase()+' 등급','bar-ui',a,{launch:{type:'serve',id:'cosmopolitan',grade:id},note:'Unity GradeColorSet 원본 등급 PNG. 실제 화면 테스트는 엔진 파티클·셰이더의 등장 연출을 3.4초 재생한 뒤 광채와 작은 반짝임을 유지하며, 글자가 펼쳐진 0.42초부터 버튼이 나타납니다.'});
 for(let index=0;index<6;index++)add('stir-ice-'+index,'스터 · 픽셀 얼음 '+(index+1),'bar-items',A['stir_ice_'+index],{usage:'스터 미니게임 · 크기별 72방향 프레임',note:'크기별로 직접 그린 픽셀 얼음입니다. 회전 프레임은 5도 간격이며, 본편과 시뮬레이터가 같은 시트를 사용합니다.'});
 for(const [id,a]of Object.entries(F.LunaBubiArt?.clips||{}))add('bubi-'+id,'부비 · '+id,'out-characters',a);
 for(const id of ['decrease','increase','ingredient','new_character','new_event','objective','objective_complete'])add('notice-'+id,'진행 알림 · '+({decrease:'호감도 상승',increase:'호감도 하락',ingredient:'신규 재료 획득',new_character:'새로운 인물',new_event:'외부 이벤트',objective:'새로운 목표',objective_complete:'목표 달성'}[id]),'bar-ui',{src:'assets/01.ArtResources/05.UI/01.Shared/MainScreen/notify/IMG_'+id+'.png',w:762,h:232});
 add('lab-waste','연구소 · 폐기물처리장','out-backgrounds',{src:'assets/01.ArtResources/02.Environments/05.Cutscenes/01.Lab/Lab_Wastedisposalsite.png',w:720,h:480},{backgroundScreen:'컷씬',backgroundKind:'풀샷'});
 const flameRoot='assets/01.ArtResources/05.UI/02.Title/02.Logo/simchung_dark_flame_alpha_2160p60/';
 const flameFrames=Array.from({length:348},(_,i)=>({src:flameRoot+'simchung_dark_flame_alpha_2160p60_'+String(i).padStart(4,'0')+'.png',x:0,y:0,w:3840,h:2160}));
 add('title-flame','팀 로고 · 불꽃 알파 애니메이션','bar-ui',{src:flameFrames[0].src,w:3840,h:2160,frames:348,fps:60,rects:flameFrames},{usage:'신규 원본 · 348프레임 / 60fps',note:'UI_Logo_Fire_flame_alpha.zip의 원본 PNG 시퀀스입니다. 프레임별 원본 다운로드가 가능합니다. 게임 로고와 다른 신규 효과이므로 기존 로고를 대체하거나 시작 연출을 임의로 추가하지 않습니다.'});
 for(const [key,title] of [['home-wardrobe-weapon','집 내부 · 열린 무기 옷장'],['home-sofa-uncovered','집 내부 · 침구를 치운 소파']])add(key,title,'out-backgrounds',F.LUNA_OUTSIDE_DATA.assets[key],{backgroundScreen:'집 내부',backgroundKind:'오브젝트'});
 add('home-current-fullshot','집 내부 · 최신 풀샷 참고','out-backgrounds',F.LUNA_OUTSIDE_DATA.assets['home-current-fullshot'],{backgroundScreen:'집 내부',backgroundKind:'풀샷',note:'현재 집의 합성 참고 원본입니다. 본편은 분리된 배경·침대·옷장·소파·TV·책을 사용합니다.'});
 for(const [key,art] of Object.entries(F.LUNA_OUTSIDE_DATA.assets)){
  if(!art.lightingMap)continue;
  const [actor,motion]=art.lightingClip.split('_');
  const character={luna:'루나',Chris:'크리스',samho:'삼호'}[actor],action={idle:'대기',walk:'걷기',run:'달리기'}[motion];
  const type=art.lightingMap==='normal'?'노멀 맵':'마스크';
  add(key,character+' · '+action+' · '+type,'out-fx',art,{usage:'캐릭터 조명 · '+art.frames+'프레임',note:'동작에 맞춰 재생하는 조명 원본입니다.'});
 }
 for(const [key,a]of Object.entries(A)){
  if(key.startsWith('table_empty_glass_'))add(key,'빈 잔 · '+({sour:'사워 잔',beer:'맥주 잔',cocktail:'칵테일 잔',long_drink:'롱드링크 잔',wine:'와인 잔',flute:'샴페인 잔',old_fashioned:'올드패션드 잔'}[key.slice(18)]||key),'bar-items',a,{itemKind:'glass',artUsage:'table',note:'손님이 마신 뒤 테이블의 칵테일을 해당 종류의 빈 잔 원본으로 교체합니다.'});
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
