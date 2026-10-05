/* Review the same live manifests as the simulator. No copied cocktail/pose tables. */
(function(W){
'use strict';
const groups=[['bar-characters','바 내부','캐릭터 / 애니메이션'],['bar-drinks','바 내부','칵테일 · 용도별 이미지'],['bar-items','바 내부','재료 / 도구 / 잔'],['bar-serve','바 내부','제공하기 컷씬'],['bar-ui','바 내부','UI / 화면 테스트'],['out-characters','외부','캐릭터 / 컷씬 동작'],['out-ui','외부','UI / 이벤트 테스트']];
const statusNames={registered:'등록됨',dummy:'더미·임시',shared:'대체·공용',missing:'미등록',code:'코드 UI·연출'};
function build(F){
 const D=F.barData,g=F.barGame,A=D.assets,O=F.LUNA_OUTSIDE_DATA,rows=[];
 const name=id=>g.name(id)||id;
 const add=r=>rows.push({status:'registered',note:'등록 여부를 보여 줍니다. 최종 아트 승인 여부는 별도 확인이 필요합니다.',...r});
 const state=a=>!a?'missing':/더미|dummy|임시|user supplied/i.test(a.source||'')||/campaign\/(johnny-|tom-|shiba-)/i.test(a.src||'')?'dummy':'registered';
 function layer(key,a,extra={}){if(!a)return null;return {key,src:a.src,source:a.source||'',w:a.w,h:a.h,frames:a.frames||1,fw:a.frameWidth,fh:a.frameHeight,fps:a.fps||6,scale:a.displayScale||1,...extra};}
 const layers=keys=>keys.map(k=>layer(k,A[k])).filter(Boolean);
 function imageRecord(id,group,title,usage,wanted,fallback,extra={}){
  extra=Object.fromEntries(Object.entries(extra).filter(([,v])=>v!==undefined));
  const key=[wanted,...fallback].find(k=>A[k]),a=A[key];
  add({id,group,title,usage,status:!a?'missing':a.sharedFrom||key!==wanted?'shared':state(a),wanted,key:a?.sharedFrom||key,layers:a?[layer(key,a)]:[],note:!a?'전용 이미지와 대체 이미지가 등록되지 않았습니다.':a.sharedFrom?'같은 종류의 등록 이미지 '+a.sharedFrom+'를 공용으로 사용합니다. 더미가 아니며 용도별 전용 이미지를 따로 만들 필요가 없습니다.':key!==wanted?'전용 키 '+wanted+' 미등록. 현재 '+key+' 이미지로 대체됩니다.':undefined,...extra});
 }
 const ignored=new Set(['hound','soldier','radio','luna','yuna','johnny','message','street_citizen_a','street_citizen_b','street_citizen_c','street_citizen_d']);
 add({id:'actor:luna:pov',group:'bar-characters',title:'루나 · 바텐더 시점',usage:'바 내부 전신 이미지 사용 안 함',status:'code',layers:[],note:'바 내부에서는 플레이어 시점의 화자입니다. 외부 루나 동작은 외부 캐릭터 분류에서 확인하세요.',launch:{type:'pair'}});
 add({id:'actor:johnny:pov',group:'bar-characters',title:'조니 · 회상 시점',usage:'회상 전신 이미지 사용 안 함',status:'code',layers:[],note:'조니의 기억은 조니의 시점으로 진행됩니다. 말풍선 이름과 맞은편 톰 이미지를 사용합니다.',launch:{type:'johnny-memory'}});
 const storyScenes=new Set(D.tables.scenes.filter(s=>Number(s.day)>=0&&Number(s.day)<=3).map(s=>s.id));
 const cast=new Set(['bubi',...D.tables.steps.filter(s=>storyScenes.has(s.context)).map(s=>s.actor)]);
 for(const id of new Set([...Object.keys(D.characterLayers),...D.tables.characters.map(c=>c.id)].filter(id=>cast.has(id)&&!ignored.has(id)))){
  const poses=Object.entries(D.characterLayers[id]||{});
  if(!poses.length)add({id:'actor:'+id,group:'bar-characters',title:name(id),usage:'바 캐릭터 · 포즈 미등록',status:'missing',layers:[],note:'캐릭터 데이터는 있으나 바 전용 포즈가 등록되지 않았습니다. 실제 출연 예정 여부는 기획 확인이 필요합니다.'});
  for(const [pose,keys]of poses){const ls=keys.map(k=>layer(k,A[k],{offset:D.webPoseOffsets?.[id]?.[pose]||[0,0]})).filter(Boolean);add({id:'actor:'+id+':'+pose,group:'bar-characters',title:name(id),usage:pose+(id==='bubi'?' · 등장 예정':''),status:keys.some(k=>!A[k])?'missing':ls.some(l=>state(A[l.key])==='dummy')||['tom','shiba'].includes(id)?'dummy':'registered',layers:ls,stage:[551,530],note:id==='bubi'?'0–3일차에는 아직 등장하지 않지만 출연 예정이므로 유지합니다. 등록된 모든 표정·레이어를 확인할 수 있습니다.':['tom','shiba'].includes(id)?'현재 정적 임시 손님 이미지입니다. talk 포즈도 동일 이미지를 사용하며 애니메이션이 아닙니다.':'레이어를 원래 위치에 합성합니다. 아래에서 부위별 표시를 켜거나 끌 수 있습니다.'});}
 }
 for(const sex of ['m','f']){const keys=Object.keys(A).filter(k=>k.startsWith('guest_'+sex+'_'));const base=keys.filter(k=>/_(body|top_1|eyes_1|eyebrow_1|mouth_1|hair_1)$/.test(k));add({id:'guest:'+sex,group:'bar-characters',title:'일반 손님 · '+(sex==='m'?'남성':'여성'),usage:'기본 부위 합성',layers:layers(base),stage:[551,530]});for(const k of keys)add({id:k,group:'bar-characters',title:'일반 손님 · '+(sex==='m'?'남성':'여성'),usage:k.replace('guest_'+sex+'_',''),layers:layers([k]),status:state(A[k])});}
 for(const c of D.tables.cocktails){
  const fallback=['cocktail_'+c.id,'recipe_cocktail_'+c.id,'item_'+c.glass];
  for(const [kind,prefix,label] of [['hero','cocktail_','완성 / 대표'],['recipe','recipe_cocktail_','레시피 목록'],['table','table_cocktail_','테이블 위 잔']])imageRecord('drink:'+c.id+':'+kind,'bar-drinks',name(c.id),label,prefix+c.id,fallback,{launch:{type:'drink',id:c.id},note:A[prefix+c.id]?.src&&kind!=='hero'&&A[prefix+c.id]?.src===A['cocktail_'+c.id]?.src?'대표 이미지와 같은 파일을 공용으로 사용합니다.':undefined,...(kind!=='hero'&&A[prefix+c.id]&&A[prefix+c.id].src===A['cocktail_'+c.id]?.src?{status:'shared'}:{})});
  const sheet=F.LUNA_SERVE_SHEETS?.[c.id];
  add({id:'serve:'+c.id,group:'bar-serve',title:name(c.id),usage:sheet?'30프레임 · 20 FPS · 1.5초':'전용 컷씬 없음 · 정적 이미지 연출',status:sheet?'registered':'shared',layers:sheet?[{key:c.id,src:sheet.src,frames:30,fps:20,w:sheet.w*sheet.cols,h:sheet.h*Math.ceil(30/sheet.cols),fw:sheet.w,fh:sheet.h,cols:sheet.cols,sx:sheet.sx||0,sy:sheet.sy||0,dx:sheet.dx||sheet.w,dy:sheet.dy||sheet.h}]:layers([fallback.find(k=>A[k])]),launch:{type:'serve',id:c.id},note:sheet?'아래는 원본 시트 재생입니다. 배경 합성·완성 등급·제공·버리기 버튼은 실제 화면 테스트에서 확인하세요.':'전용 제공 애니메이션 미등록. 실제 게임은 완성 이미지를 사용하는 대체 연출을 재생합니다.'});
 }
 const items=[...D.tables.shelf_items];if(!items.some(x=>x.id==='opener'))items.push({id:'opener',kind:'tool'});
 for(const it of items)for(const [kind,prefix,label]of [['shelf','item_','선반'],['recipe','recipe_item_','레시피 상세'],['inventory','inventory_item_','담은 재료']])imageRecord('item:'+it.id+':'+kind,'bar-items',name(it.id),(it.kind||'재료')+' · '+label,prefix+it.id,['item_'+it.id,'item_dummy'],{launch:{type:'prep',id:it.id},itemKind:it.kind});
 const ui=(id,title,note,launch,group='bar-ui')=>add({id:'ui:'+id,group,title,usage:'실제 화면 · 직접 조작',status:'code',layers:[],note,launch,preview:'assets/resource-previews/'+('ui:'+id).replace(/[^a-z0-9_-]/gi,'_')+'.jpg',previewNote:'실제 게임 화면 캡처 · 2026-10-05 · 정적 미리보기'});
 for(const [id,title]of F.LunaQALab.STATES)ui(id,title,'실제 '+title+' 상태를 재현합니다. 손님·잔·버튼에 마우스를 올리거나 클릭해 보세요.',{type:'qa',id});
 for(const [id,title,note]of [
  ['recipes','레시피 목록 / 상세 / 잠김','레시피 카드 호버·클릭, 상세 보기와 제조 진입. 1일차 해금 기준으로 잠금 상태도 확인합니다.'],
  ['pair','단골 2명 / 루나 말풍선','삼호·톰 2인 구도에서 루나의 중앙 말풍선. 실제 장면별 대화는 아래 일차별 장면 카드에서 확인하세요.'],
  ['solo','단골 1명 / 손님 말풍선','단골 1인 카메라와 화자 말풍선. 크리스의 대기·대화 리소스 사용.'],
  ['choices','바 대화 / 선택지','기존 QA 장면의 실제 선택지에 진입합니다.'],
  ['tutorial','0일차 / 튜토리얼 강조','실제 0일차 튜토리얼 시작. 대사를 진행하면 어두운 배경·화살표·코스터·제조 안내를 순서대로 확인할 수 있습니다.'],
  ['prep-recipe','재료 화면 / 레시피 상세 패널','좌측 상단 간단 레시피를 클릭해 상세 패널을 열고, 선반 이동·체크 표시·도구 소개 호버를 확인하세요.']
 ])ui(id,title,note,{type:id});
 for(const [id,title]of [['service','서비스 패널'],['settings','설정 / 볼륨 / 언어'],['help','조작 설명'],['history','대사 기록'],['sales','매출'],['restart','일차 변경 확인'],['recipe','제조 중 레시피'],['openerWarning','병따개 누락 경고'],['ingredientWarning','재료 초과 경고'],['johnnyUnlock','히든 칵테일 해금'],['serveDetails','제조 점수 상세']])ui('overlay:'+id,title,'게임의 실제 팝업을 표시합니다. 버튼 호버·포커스·닫기를 확인하세요.',{type:'overlay',id});
 for(const [id,title]of [['open','병따기'],['pour','따르기'],['fill_up','필업'],['shake','쉐이킹'],['stir','스터']])ui('mini:'+id,title+' / 제조 기믹',id==='shake'?'실제 기믹 테스트. 버전 선택·시작 안내·노드·콤보 단계·실패 상태를 직접 조작합니다.':'실제 기믹의 안내·버튼·진행·판정·설정을 직접 확인합니다.',{type:'mini',id});
 ui('updates','업데이트 내역','현재 업데이트 팝업을 다시 열어 스크롤·닫기·버튼을 확인합니다.',{type:'updates'});
 ui('qa-panel','단골 장면 / 중간 스텝 선택','실제 QA 패널에서 일차·장면·스텝·분기 조건을 선택할 수 있습니다.',{type:'qa-panel'});
 for(const s of D.tables.scenes)ui('scene:'+s.id,s.day+'일차 · '+(s.title||s.id),'장면 ID: '+s.id+' · 등록된 대사·분기·표정을 실제 진행기로 재생합니다. QA 패널에서 중간 스텝도 선택할 수 있습니다.',{type:'scene',id:s.id});
 // Raw UI art remains inspectable separately from code-rendered UI.
 for(const [key,a] of Object.entries(A).filter(([k])=>/^(bar($|_)|prep_|gimmick|dialogue|choice|next$|coaster|money|logo|expr_|mix_)/.test(k)))add({id:'ui-art:'+key,group:'bar-ui',title:key,usage:'화면 구성 리소스 · 원본',status:state(a),layers:[layer(key,a)]});
 const outsideLayer=(sp)=>{const a=O.assets[sp.asset];return{key:sp.asset,src:typeof a==='string'?a:a.src,source:a.source||a.path||'',rects:[{x:sp.x,y:sp.y,w:sp.w,h:sp.h}],frames:1,w:sp.w,h:sp.h};};
 for(const [key,anim]of Object.entries(O.animations)){const base=outsideLayer(anim.frames[0]);add({id:'outside:'+key,group:'out-characters',title:key==='shiba'?'시바견':'루나',usage:key,layers:[{...base,rects:anim.frames.map(f=>({...f,src:typeof O.assets[f.asset]==='string'?O.assets[f.asset]:O.assets[f.asset].src})),frames:anim.frames.length,fps:anim.fps}],note:'외부 런타임에 등록된 프레임을 직접 재생합니다. 원본 방향을 유지합니다.'});}
 for(const kind of ['M1','M2','W1']){const a=O.assets['ambient-'+kind];add({id:'outside:'+kind,group:'out-characters',title:'거리 NPC · '+kind,usage:'6프레임 · 더미 실루엣',status:'dummy',layers:[{key:'ambient-'+kind,src:a?.src||'assets/outside/NPC_idle_'+kind+'.png',w:774,h:138,fw:129,fh:138,frames:6,fps:3.5}],note:'거리 행인·주민·불량배 등의 대체 캐릭터로 사용하는 실루엣입니다. 전용 인물 아트가 아닙니다.'});}
 const roles=new Map();for(const c of F.LunaOutsideEncounters.cases)for(const id of c.members||[]){const a=F.LunaOutsideEncounters.actor(id);if(a&&['M1','M2','W1'].includes(a.kind))roles.set(id,{...a,id});}
 for(const a of [{id:'bd-vendor',name:'BD 칩 판매상',kind:'M1'},{id:'thug',name:'복도 불량배',kind:'M2'},...roles.values()]){const base=rows.find(r=>r.id==='outside:'+a.kind);add({id:'outside-role:'+a.id,group:'out-characters',title:a.name,usage:a.id+' · '+a.kind+' 대체',status:'dummy',layers:base.layers,note:'전용 인물 아트 미등록. 현재 '+a.kind+' 실루엣 애니메이션을 재사용합니다.'});}
 const samho=O.scenes.street.nodes.find(n=>n.name==='Samho')?.sprite;
 if(samho){const l=outsideLayer(samho);add({id:'outside:samho',group:'out-characters',title:'삼호',usage:'대기 / 눈 깜빡임 · 3프레임',layers:[{...l,rects:Array.from({length:3},(_,i)=>({...samho,x:i*84})),frames:3,fps:10}],note:'원본 프레임 반복 미리보기. 실제 게임은 눈 깜빡임 사이에 대기 간격을 둡니다.'});}
 add({id:'outside:terrace',group:'out-characters',title:'테라스 · 크리스 / 루나',usage:'배경에 합쳐진 정적 착석 이미지',status:'shared',layers:[{key:'terrace-reference',src:F.LunaTerrace.asset,frames:1}],note:'두 인물이 배경 이미지에 포함되어 있습니다. 분리된 착석·대화 애니메이션은 사용하지 않습니다.',launch:{type:'terrace',id:'night0'}});
 for(const c of F.LunaOutsideQA.catalog())ui('outside:'+c.id,c.label,(c.note||'')+' · '+(c.auto?'범위 접근 자동 재생':'대상 근처에서 E / 선택지 클릭')+' · 가상 QA 무대에서 확인합니다.',{type:'outside',id:c.id},'out-ui');
 for(const [id,title,note]of [['entry-hint','탐색 시작 / P 설정 안내','탐색 시작 시 표시되는 안내 팝업입니다. P로 일차·출퇴근·위치 설정 패널을 바로 열 수 있습니다.'],['street','거리 / E 표시 / 말풍선','실제 거리 배치·상호작용 표시. A/D 이동, E 상호작용, Y 전경, ESC 설정, P 콘솔.'],['home','집 / TV / 소파','실제 집 화면에서 TV 자동 말풍선·소파·출입 UI를 확인합니다.'],['settings','외부 설정 / 조작 설명','ESC로 닫거나 여세요.'],['console','외부 개발자 콘솔','P로 닫거나 여세요. 위치·일차·출퇴근 상태·소지금 테스트.']])ui('exterior:'+id,title,note,{type:'exterior',id},'out-ui');
 for(const [id,title]of [['night0','0일차 테라스'],['night1','1일차 테라스'],['night2','2일차 테라스'],['ending','3일차 테라스'],['workshop','포트 작업장 / 검은 화면']])ui('terrace:'+id,title,'실제 대화 화면·진입 페이드·말풍선·후속 회상을 확인합니다. 테스트 종료 시 목록으로 돌아갑니다.',{type:'terrace',id},'out-ui');
 for(const [id,title,note]of [['purchase','구매 / 재료 추가 알림','소지금 차감은 우측 상단, 획득 재료는 좌측 상단. 테스트용 재화·재료 알림을 재생합니다.'],['poor','상점 / 금액 부족 선택지','선택지를 숨기지 않고 비활성화하는 상태를 확인합니다.'],['bd','BD 칩 판매 / 구매 선택','현재 판매상의 실제 대사·구매 선택지입니다. 구매하면 실제 컷씬으로 이어집니다.'],['panorama','전경 보기 / Y 표시','전경 관찰 지점에 배치합니다. Y로 확대·복귀를 확인하세요.']])ui('exterior:'+id,title,note,{type:'exterior',id},'out-ui');
 for(const [id,title]of [['in','바 입장 / 문 열림 로딩'],['out','바 퇴장 / 문 닫힘 로딩']])ui('door:'+id,title,'실제 문·간판·주변 오브젝트·빛·전환 연출. 최소 대기 시간도 동일합니다.',{type:'door',id},'out-ui');
 ui('day-transition','일차 전환 / Day 숫자','검은 화면과 Day 0 → 1 숫자 전환을 실제 연출로 재생합니다.',{type:'day-transition'},'out-ui');
 ui('johnny-memory','조니의 기억 / 화자 이름','실제 바 구도의 회상 대사·이름·말풍선·전환을 확인합니다.',{type:'johnny-memory'},'out-ui');
 for(const area of ['bar','out'])groups.some(g=>g[0]===area+'-fx')||groups.splice(groups.findIndex(g=>g[0]===area+'-ui')+1,0,[area+'-fx',area==='bar'?'바 내부':'외부','연출 / 이펙트']);
 const fx=(id,area,title,category,source,launch,previewId,note,status='code')=>add({id:'fx:'+id,group:area+'-fx',title,usage:source,status,layers:[],effectCategory:category,launch,preview:'assets/resource-previews/'+(previewId||'fx:'+id).replace(/[^a-z0-9_-]/gi,'_')+'.jpg',previewNote:previewId?'관련 실제 화면 · 동작은 실제 화면 테스트에서 확인':'효과 재생 중 실제 화면 캡처',note:note+' · 구현: '+source+' · 검수용 상태 설정이며 본편 진행에는 반영되지 않습니다.'});
 for(const [id,title]of [['arrival','손님 입장 · 페이드 / 이동'],['exit','손님 퇴장'],['red','좌석 위험 · 점멸']])fx(id,'bar',title,id==='red'?'guidance':'transition','bar-views.js / bar-views.css',{type:'qa',id},'ui:'+id,'실제 손님 상태와 표시 효과를 확인합니다. 다시 실행하면 처음부터 재생합니다.');
 fx('tutorial','bar','튜토리얼 · 암전 / 강조 / 화살표','guidance','tutorial-view.js / tutorial-view.css',{type:'tutorial'},'ui:tutorial','대화를 진행해 코스터·선반·드래그 안내의 움직임과 주변 암전을 확인하세요.');
 fx('camera','bar','단골 1인 ↔ 2인 · 카메라 전환','camera','bar-views.js / bar-views.css',{type:'effect',id:'camera'},'ui:pair','1인 구도에서 2인 구도로 전환한 뒤 1인으로 돌아갑니다. 말풍선도 같은 월드 변환을 사용합니다.');
 for(const combo of [5,10])fx('shake-'+combo,'bar','쉐이킹 · '+combo+'콤보 / '+(combo===5?'1':'2')+'단계','judgement','shake-rhythm.js / shake-polish.js',{type:'effect',id:'shake',combo},null,'실제 성공 입력으로 해당 콤보에 진입합니다. 불꽃·발광·속도선·애니메이션 가속을 비교하세요. 이후 직접 입력하거나 다시 실행할 수 있습니다.');
 fx('shake-miss','bar','쉐이킹 · MISS / 콤보 초기화','judgement','shake-rhythm.js / shake-polish.js',{type:'effect',id:'shake',combo:5,miss:true},null,'5콤보 이후 실제 오입력을 재현합니다. MISS 피드백·불꽃 해제·캐릭터 정지와 다음 성공 시 재개를 확인하세요.');
 for(const success of [true,false])fx('open-'+(success?'hit':'miss'),'bar','병따기 · '+(success?'성공 / 캡 튕김 / 섬광':'실패 / 반동'),'judgement','open-view.js / core.js',{type:'effect',id:'open',success},null,'실제 병따기 판정과 캡·병따개·고리 효과를 바로 재생합니다. 짧은 효과는 다시 실행으로 반복 확인하세요.');
 for(const ingredient of ['gin','beer'])fx('pour-'+ingredient,'bar','따르기 · '+(ingredient==='gin'?'푸어러 / 가는 물줄기':'미장착 / 굵은 물줄기'),'fluid','pour-fluid.js / pour-view.js',{type:'effect',id:'pour',ingredient},null,'실제 재료별 입구·유량·잔에 쌓이는 액체를 재생합니다. 자동 시연 뒤 Space로 직접 따를 수 있습니다.');
 fx('stir','bar','스터 · 얼음 / 스푼 / 회전 잔상','fluid','stir-polish.js / bar-views.js',{type:'effect',id:'stir'},null,'실제 W → D → S → A → W 입력으로 한 바퀴를 재생합니다. 이후 직접 젓거나 다시 실행하세요.');
 fx('serve','bar','완성 · 제공 애니메이션 / 등급 등장','judgement','serve-view.js / serve-view.css',{type:'serve',id:'gin_tonic'},'ui:result','진토닉 결과 연출입니다. 칵테일별 원본 시트와 대체 이미지는 제공하기 컷씬 분류에서 확인하세요.');
 for(const id of ['income','expense','unlock'])fx(id,'bar',{income:'소지금 증가 · 일시 알림',expense:'소지금 차감 · 일시 알림',unlock:'신규 재료 / 레시피 · 해금 안내'}[id],'notice','currency-view.js / app.js',{type:'qa',id},'ui:'+id,'실제 알림의 등장·유지·사라짐과 팝업을 확인합니다.');
 fx('placeholder','bar','대본 FX / SFX · 더미 효과','placeholder','core.js / app.js',{type:'scene',id:'t99_fxsfx'},'ui:scene:t99_fxsfx','대본을 넘기며 공용 플래시와 더미 효과음을 확인합니다. 전용 이펙트·음향이 완성된 상태가 아닙니다.','dummy');
 for(const id of ['in','out'])fx('door-'+id,'out','바 문 · '+(id==='in'?'열림 / 따뜻한 빛':'닫힘 / 암전'),'transition','bar-door-transition.js / campaign.js',{type:'door',id},'ui:door:'+id,'실제 로딩 전환입니다. 최소 3초 대기 후 문 동작과 화면 전환을 재생합니다.');
 fx('day','out','일차 종료 · 암전 / Day 숫자 전환','transition','campaign.js / campaign.css',{type:'day-transition'},'ui:day-transition','Day 0 → 1 전환을 재생합니다.');
 fx('terrace','out','테라스 · 서서히 나타나는 진입','transition','terrace-view.js / campaign.js',{type:'terrace',id:'night0'},'ui:terrace:night0','테라스 페이드 인과 대화를 재생합니다. 대사를 진행하면 연결된 회상도 확인할 수 있습니다.');
 fx('memory','out','기억 회상 · 전환 / 화면 노이즈','transition','johnny-memory.js / campaign.js',{type:'johnny-memory'},'ui:johnny-memory','조니의 기억에 진입해 실제 회상 연출을 확인합니다.');
 fx('lift','out','엘리베이터 · 로고 / 그라디언트 / 팀명','transition','outside-qa.js / campaign.css',{type:'outside',id:'lift-logo'},'ui:outside:lift-logo','QA 승강 연출의 로고·우측 음영·Team. SimChung 표시를 확인합니다.');
 fx('panorama','out','전경 관찰 · 카메라 줌 / 복귀','camera','outside.js',{type:'exterior',id:'panorama'},'ui:exterior:panorama','관찰 지점에서 Y를 눌러 전경 확대와 복귀를 비교하세요.');
 fx('purchase','out','구매 · 재화 차감 / 재료 슬라이드 알림','notice','currency-view.js / outside.js',{type:'exterior',id:'purchase'},'ui:exterior:purchase','우측 재화 알림과 좌측 재료 획득 알림을 동시에 재생합니다.');
 fx('street','out','거리 · 원경 / 중경 / 근경 / 전광판','environment','outside.js / outside-data.js',{type:'exterior',id:'street'},'ui:exterior:street','A/D 이동으로 레이어·가림·거리 전광판을 확인합니다. 코드와 기존 이미지로 구성된 현재 표현이며 별도 셰이더 원본이 등록됐다는 의미는 아닙니다.');
 for(const area of ['bar','out'])if(!groups.some(g=>g[0]===area+'-backgrounds'))groups.splice(groups.findIndex(g=>g[0]===area+'-ui'),0,[area+'-backgrounds',area==='bar'?'바 내부':'외부','배경 / 화면별 레이어']);
 rows.push(...W.ResourceBackgrounds.build(F));
 return rows;
}
function cinema(F){return Object.entries(F.SHEETS||{}).filter(([k])=>/^(luna|yuna)/i.test(k)).map(([k,a])=>({id:'cinema:'+k,group:'out-characters',title:k.startsWith('luna')?'루나 · 컷씬':'유나 · 컷씬',usage:k,status:'registered',note:'컷씬 원본 프레임입니다. 하운드·코라테크 병력은 목록에서 제외합니다.',layers:[{key:k,source:'cinematic/assets.js · '+k,src:a.png,frames:a.frames.length,fps:8,rects:a.frames.map(f=>({x:f.sx,y:f.sy,w:f.sw,h:f.sh,ox:f.ox,oy:f.oy,cw:f.cw,ch:f.ch}))}]}));}
W.ResourceCatalog={build,cinema,groups,statusNames};
})(window);
