/* Review-only fixtures use the current game's renderers. No save/story mutations outside the lab. */
(function(W){
'use strict';
const version='20261018',root='assets/reference/exports/',revision='preview-paths-20261019';
const safe=s=>String(s).replace(/[^a-z0-9_-]/gi,'_');
const stem=(row,variant)=>safe(row.id)+'--'+safe(variant||row.variants?.[0]?.id||'default');
const previewRevision=r=>r.id==='ui:income'?'money-art-20261025':revision;
const screen=(r,v)=>root+stem(r,v)+'.png?v='+previewRevision(r);
const popup=(r,v)=>root+stem(r,v)+'--popup.png?v='+previewRevision(r);
const isScreen=r=>!!r.launch&&(['bar-ui','out-ui','common-popups','bar-fx','out-fx'].includes(r.group)||!r.layers?.length);
function collect(rows){
 const dialog=(id,title,variants,selector)=>rows.push({id:'popup:'+id,group:'common-popups',title,usage:'최신 게임 UI · 상태별 PNG 다운로드',status:'code',layers:[],popupKind:'dialog',exportSelector:selector,variants,launch:variants[0].launch,note:'현재 게임의 실제 UI로 표시합니다. PNG는 1280×720 화면 기준으로 생성한 기본 인물·문구의 정적 이미지입니다. 선택 상태별 팝업만 / 전체 화면을 각각 다운로드할 수 있습니다.'});
 const variants=(type,items)=>items.map(([id,label,extra])=>({id,label,launch:{type,id,...extra}}));
 dialog('controls','0일차 · 이동 / 달리기 튜토리얼',variants('review-controls',[['movement','걷기 · A / D + 달리기 · Shift']]),'.outside-controls-tutorial');
 rows.at(-1).note+=' 첫 이동 안내: 원본 루나 걷기·달리기 이미지, A / D 이동 키, Shift를 누른 채 이동하는 달리기 안내, E키 진행 안내를 확인합니다.';
 dialog('controls-interaction','0일차 · 상호작용 튜토리얼',variants('review-controls',[['interaction','상호작용 · E']]),'.outside-controls-tutorial');
 rows.at(-1).note+=' 최신 TV / NPC 이미지와 빨간 상호작용 대상 표시, E키 안내를 확인합니다.';
 dialog('seat-legend','좌석 알림 · 4가지 색상',variants('review-bar-tutorial',[['seatLegend','좌석 알림']]),'.day0-seat-legend');
 dialog('serving-hud','코스터 / 칵테일 드래그 팝업',variants('review-serving',[['coaster','단골 첫 대사 · 코스터 제공'],['drink','완성 칵테일 제공']]),'.service-popup[data-drag]');
 for(const kind of ['stir','shake'])dialog('lesson-'+kind,(kind==='stir'?'스터':'쉐이킹')+' 이미지 튜토리얼',variants('review-mix',(kind==='stir'?['stir']:['path','fall','cross']).flatMap(mode=>[0,1].map(page=>[mode+'-'+page,({stir:'스터',path:'왕복 노드',fall:'세로 2레인',cross:'중앙 교대'})[mode]+' · '+(page?'타이밍 안내':'노드 / 조작 안내'),{kind,mode,page}]))),'.mix-lesson-card');
 dialog('lesson-pour','따르기 튜토리얼',variants('review-pour',[['target','목표량 확인'],['finish','현재량 / 마치기']]),'.pour-tutorial-card');
 dialog('lesson-open','병따기 튜토리얼',variants('review-open',[['intro','시작 안내'],['retry','다시 시도'],['done','완료']]),'.opening-lesson-copy');
 const hints=['seatExplore','seatIndicator','coaster','recipe','recipeSelect','prepRecipeOpen','prepRecipeRead','prepRecipeClose','prepGlass','prepNavigate','prepHover','prepAdd','prepRemove','prepGinAgain','prepSodaNavigate','prepSodaHover','prepSodaAdd','prepStart','serveDrink'];
 dialog('bar-guides','바 튜토리얼 · 단계별 안내',variants('review-bar-tutorial',hints.map(id=>[id,({seatExplore:'좌석 이동',seatIndicator:'좌석 인디케이터',coaster:'코스터 제공',recipe:'서비스 패널',recipeSelect:'레시피 선택',prepRecipeOpen:'레시피 열기',prepRecipeRead:'레시피 읽기',prepRecipeClose:'레시피 닫기',prepGlass:'잔 선택',prepNavigate:'술 선반 이동',prepHover:'재료 설명',prepAdd:'재료 담기',prepRemove:'재료 빼기',prepGinAgain:'진 다시 담기',prepSodaNavigate:'냉장고 이동',prepSodaHover:'탄산수 설명',prepSodaAdd:'탄산수 담기',prepStart:'제조 시작',serveDrink:'칵테일 제공'})[id]])),'.day0-guide-copy');
 dialog('beer-guides','맥주 제조 튜토리얼',variants('review-bar-tutorial',['recipeSelect','beerGlass','beerToolNavigate','beerOpener','beerFridgeNavigate','beerAdd','beerStart'].map(id=>[id,({recipeSelect:'맥주 레시피',beerGlass:'맥주 잔',beerToolNavigate:'도구 선반 이동',beerOpener:'병따개 선택',beerFridgeNavigate:'냉장고 이동',beerAdd:'병맥주 선택',beerStart:'제조 시작'})[id],{beer:true}])),'.day0-guide-copy');
 dialog('campaign-dialogs','본편 · 확인 / 안내 팝업',variants('review-campaign',[['sleep','하루 마치기'],['confirm-exit','타이틀 복귀'],['retry-drink','주문 재확인'],['notice','안내'],['options','본편 설정'],['observation','조니의 관찰 메모'],['response','대화 응답'],['menu','추천 칵테일'],['load-error','로딩 오류']]),'.campaign-card');
 rows.push({id:'ui:opening-guide',group:'out-ui',title:'게임 시작 · 플레이 안내',usage:'최신 안내 / 키 아이콘',status:'code',layers:[],launch:{type:'review-opening'},note:'감사 문구와 타이틀 전환이 제거된 최신 플레이 안내입니다. 실제 페이드 인과 키 아이콘을 재생합니다.'});
 for(const a of W.ResourceUISources||[])rows.push({id:'ui-source:'+a.src,group:'bar-ui',title:a.src.split('/').at(-1),usage:'원본 PNG · '+a.src.split('/')[2],status:'registered',layers:[{...a,key:a.src,frames:1,source:a.src}],note:'현재 웹의 UI 원본 파일입니다. PNG 다운로드는 원본 크기와 투명도를 유지합니다.'});
 for(const [id,title,frames]of [['sleep','수면',Array.from({length:12},(_,i)=>12+i)],['wake','눈뜨기',[8,9,10,11]]])rows.push({id:'outside:sofa-'+id,group:'out-characters',title:'루나 · 소파 '+title,usage:'최신 수면 / 기상 컷씬',status:'registered',layers:[{key:'opening-luna-'+id,src:'../cutscene-studio/assets/opening/luna-sleep.png',frames:frames.length,fps:id==='sleep'?6:5,rects:frames.map(n=>({x:n%12*130,y:Math.floor(n/12)*130,w:130,h:130})),source:'opening-template.js · 최신 luna_sleep 원본'}],note:'도입부와 다른 일차의 수면·기상에서 공통으로 사용하는 최신 프레임입니다.'});
 for(const r of rows){
  if(['ui:recipes','ui:dossier','ui:overlay:service','ui:mini:stir'].includes(r.id)){
   r.uiArtPending=false;r.status='registered';r.usage='원본 UI 아트 적용 · 실제 화면 테스트';
   r.note='현재 웹에 전용 UI PNG가 적용되어 있습니다. 텍스트·배치·일부 효과는 코드로 구성하며 최종 아트 승인 여부와는 별개입니다.';
  }
  if(r.id.startsWith('actor:tom:')){r.status='registered';r.note='2026-10-18 Tom_Idle 원본. 정적 이미지이며 대화 중에도 같은 포즈를 사용합니다. 팔이 카운터에 놓이도록 본편에서 y=420 기준으로 정렬합니다.';}
  if(r.id==='ui:exterior:street'){r.title='상호작용 키 안내 / E';r.note='제공된 IMG_interaction 사각 E 키와 페이퍼로지 Bold 상호작용 텍스트를 화면 좌측 하단에서 확인합니다. 대상의 시안색 윤곽선도 함께 표시합니다.';r.variants=r.variants.filter(v=>v.id==='e');}
  if(r.id==='ui:prep')r.needsRevision=false;
  if(r.id==='outside:terrace-chris')r.previewNote='최신 테라스 배경 · 오른쪽 크리스 / 왼쪽 루나 · 배경 합성 이미지';
  if(isScreen(r)){r.preview=screen(r);r.previewNote='최신 게임 화면 · '+version+' · PNG 다운로드 가능';}
 }
 return rows;
}
async function play(F,d){
 const g=F.barGame,c=F.lunaCampaign,q=F.lunaQA,o=F.outsidePlaytest;
 if(d.type==='review-serving'){
  if(d.id==='drink'){q.state.cocktail='bottle_beer';q.runSituation('serve');return;}
  g.reset(1,'regular',42,false,{variant:'original'});g.phase='regular';g.focus='R';g.seats={L:null,M:null,R:{id:'tom',actor:'tom',state:'STORY',seated:true,coaster:false}};
  g.story={scene:{id:'review-coaster'},index:0,steps:[{type:'say',actor:'tom','text.ko':'안녕. 오늘도 한 잔 부탁할게.'},{type:'say',actor:'luna','text.ko':'어서 오세요. 무엇으로 드릴까요?'},{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'craft',actor:'tom'}]};g.pump();g.dialogue.chars=g.dialogue.text.length;return;
 }
 if(d.type==='review-controls'){
  c.ui.outside=true;Object.assign(o.config,{day:0,flow:'in',place:'home'});await o.start({showDevHint:false});o.model.story.cancel();o.model.backgroundStory.cancel();o.model.paused=false;o.showControlsTutorial();o.refreshHUD();
  if(d.id==='interaction'){await new Promise(r=>F.setTimeout(r,2050));o.controlsTutorialKey({code:'KeyE',repeat:false,preventDefault(){},stopImmediatePropagation(){}});F.dispatchEvent(new F.KeyboardEvent('keyup',{code:'KeyE',key:'e',bubbles:true}));o.refreshHUD();}return;
 }
 if(d.type==='review-opening'){await c.newGame();return;}
 if(d.type==='review-campaign'){c.resumeView='developer';c.noticeTitle='안내';c.noticeText='현재 진행 중인 일을 마친 뒤 다시 시도해 주세요.';c.drinkIssues=['주문한 칵테일과 재료를 다시 확인해 주세요.'];c.loadError='리소스를 불러오지 못했습니다. 연결 상태를 확인해 주세요.';c.screen(d.id);return;}
 if(['review-mix','review-pour','review-open'].includes(d.type)){
  const kind=d.type==='review-mix'?d.kind:d.type==='review-open'?'open':'pour';
  delete g.progress.flags['mix_tutorial_'+kind];c.ui.shakeMode=d.mode||'path';g.startMinigame(kind,'original');
  if(d.type==='review-mix')g.gimmick.mixTutorial={kind,mode:kind==='stir'?'stir':c.ui.shakeMode,page:d.page||0};
  else if(d.type==='review-pour'){g.gimmick.pourTutorial={step:d.id};if(d.id==='finish'){g.gimmick.started=true;g.gimmick.fluid.caughtMl=10;}}
  else {g.gimmick.openTutorial=true;if(d.id==='retry'){g.gimmick.started=true;g.gimmick.failures=1;}if(d.id==='done'){g.gimmick.started=true;g.gimmick.completed=true;}}
  return;
 }
 if(d.type==='review-bar-tutorial'){
  q.state.cocktail=d.beer?'bottle_beer':'gin_tonic';q.runSituation(d.id==='serveDrink'?'serve':'prep');
  g.day=d.beer?1:0;g.finished=false;g.dialogue=null;g.choice=null;g.overlay=null;g.transition=0;g.cameraLeft=0;g.cameraMoving=false;
  if(!/^(prep|beer)/.test(d.id)){g.screen=d.id==='recipeSelect'?'recipe':'bar';if(d.id==='recipe')g.overlay='service';}
  c.ui.tab=d.id.includes('Soda')||['beerAdd','beerStart'].includes(d.id)?'fridge':['beerOpener','beerFridgeNavigate'].includes(d.id)?'tool':/Hover|Add|Remove|Again|SodaNavigate/.test(d.id)?'liquor':'glass';
  c.ui.recipeOpen=['prepRecipeRead','prepRecipeClose'].includes(d.id);if(['prepRemove','prepGinAgain','prepStart','beerStart'].includes(d.id))g.debugFill();
  g.tutorial={kind:d.id,beer:!!d.beer,seat:'R',visited:['R']};
 }
}
function selector(r,d){
 if(r.exportSelector)return r.exportSelector;
 if(r.popupKind){
  if(d.type==='popup-story')return d.kind==='event'?'.story-notice-event':'.story-notice-people';
  if(d.type==='popup-goal')return '.story-notice-event';
  if(d.type==='popup-money'||r.id==='ui:income')return '.currency-hud';
  if(r.id==='ui:exterior:purchase')return '.outside-item-notice';
  if(r.id==='ui:dossier')return '.resource-profile';
  if(d.id==='service')return '#service-panel';
  return '.campaign-card, .daily-unlocks, .modal, .resource-profile';
 }
 return null;
}
W.ResourceLatest={version,collect,play,stem,screen,popup,isScreen,selector};
})(window);
