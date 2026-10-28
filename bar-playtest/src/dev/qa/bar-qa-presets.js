/* QA-only recipes for the real bar interpreter. Never append to shared CSV tables. */
(function(W){
'use strict';
const row=(type,extra={})=>({type,...extra});
const say=(actor,text,arg='idle')=>row('say',{actor,arg,'text.ko':text,'text.en':text});
const CHOICE_LIMIT=4;
function checkedChoices(choices){
 if(!Array.isArray(choices)||choices.length<1||choices.length>CHOICE_LIMIT)throw Error('QA 선택지는 이동 항목을 포함해 1~4개여야 합니다.');
 return choices;
}
const menu=choices=>row('qa_menu',{choices:checkedChoices(choices)});
const action=id=>row('qa_action',{arg:id});
const option=(text,effects='',when=null,reason='')=>({'text.ko':text,'text.en':text,effects,when,'lock_reason.ko':reason,'lock_reason.en':reason});
const command=(text,id)=>option(text,'flag.qa_'+id+' = true');
const enter=(actor,slot,sync)=>row('enter',{actor,arg:slot,sync});
const service=(actor,cocktail)=>[
 say(actor,'[QA] 코스터를 받은 뒤 주문·제조·제공을 확인해 주세요.'),
 row('order',{actor,arg:'exact:'+cocktail}),row('craft',{actor}),row('serve',{actor}),
 say(actor,'[QA] 제공 완료. 다음 손님 또는 테스트 종료로 이어집니다.')
];
function catalog(D){
 const cases=[
  {id:'coaster-one',group:'코스터·좌석',title:'1인 · 코스터 1개',note:'입장 → 대사 완독 → 코스터 드래그 → 주문·제조·제공',steps:()=>[enter('port','L'),...service('port','gin_tonic')]},
  {id:'coaster-two',group:'코스터·좌석',title:'2인 · 둘 다 코스터 필요',note:'동시 입장. 포트 제공 후 아일리 코스터·제조로 진행',steps:()=>[enter('port','L','no_wait'),enter('aili','R','wait'),...service('port','gin_tonic'),...service('aili','gin_fizz')]},
  {id:'coaster-mixed',group:'코스터·좌석',title:'2인 · 한 명만 코스터 필요',note:'포트만 주문. 부비는 대화만 하므로 코스터 없이 진행',steps:()=>[enter('port','L','no_wait'),enter('bubi','R','wait'),say('bubi','[QA] 야옹. (주문하지 않는 동행 손님)'),...service('port','gin_tonic'),say('bubi','[QA] 코스터 없이 마지막 대사까지 진행됩니다.')]},
  {id:'seat-change',group:'코스터·좌석',title:'1인 → 2인 → 퇴장 → 재입장',note:'좌석·카메라·잔/코스터 정리 확인',steps:()=>[enter('chris','L'),say('chris','[QA] 혼자 입장.'),enter('port','R'),say('port','[QA] 두 번째 입장.'),row('exit',{actor:'chris'}),say('port','[QA] 혼자 남은 상태.'),enter('aili','L'),say('aili','[QA] 비워진 좌석으로 입장.')]},
  {id:'choice-money',group:'선택지·알림',title:'선택지 · 돈 받기 / 지불 / 잔액 부족',note:'실제 재화 증감 UI와 조건 차단. 한 번 실행할 때 잔액 1,000원',steps:()=>[say('luna','[QA] 선택한 금액이 실제 QA 잔액에 반영됩니다.'),menu([option('300원 받기','money += 300'),option('400원 지불','money -= 400','money >= 400','돈이 부족합니다.'),option('2,000원 지불','money -= 2000','money >= 2000','돈이 부족합니다.'),option('취소')]),say('luna','[QA] 재화 알림을 확인하세요.')]},
  {id:'choice-affinity',group:'선택지·알림',title:'선택지 · 호감도 상승 / 하락',note:'포트 호감도 10에서 시작. ±1 실제 알림',setup:g=>{g.progress.flags.port_met=true;g.progress.affinity.port=10;},steps:()=>[enter('port','L'),say('port','[QA] 답변에 따라 호감도가 바뀝니다.'),menu([option('호감도 상승','affinity.port += 1'),option('호감도 하락','affinity.port -= 1'),option('변화 없음')]),say('port','[QA] 관계 변화 알림을 확인하세요.')]},
  {id:'choice-combined',group:'선택지·알림',title:'선택지 · 재화 + 인물 + 호감도 동시',note:'서로 다른 알림이 겹칠 때 큐 순서와 누락 확인',steps:()=>[say('luna','[QA] 보상과 인물 정보를 한 번에 받습니다.'),menu([option('보상 받기','money += 300; flag.aili_met = true; affinity.aili += 1'),option('취소')]),say('luna','[QA] 재화 → 인물·호감도 알림을 확인하세요.')]},
  {id:'choice-goals',group:'선택지·알림',title:'선택지 · 새 목표 / 목표 달성 / 이벤트',note:'엘레베이터 수리·재료 구하기 알림과 동일 UI',steps:()=>[say('luna','[QA] 알림 종류를 선택하세요.'),menu([command('새로운 목표','goal_new'),command('엘레베이터 수리!','goal_repair'),command('올드패션드 재료 구하기!','goal_materials'),command('새로운 이벤트','event')]),action('notices'),say('luna','[QA] 진행 알림을 확인하세요.')]},
  {id:'profiles-all',group:'인물 정보',title:'선택지 · 모든 캐릭터 정보 해금',note:'등록된 단골 전원·정보 3단계. 미작성 원고는 대기 표시 유지',steps:()=>[say('luna','[QA] 모든 인물 정보를 QA 안에서만 해금합니다.'),menu([command('모든 캐릭터 정보 등록·해금','profiles_all'),command('모두 미등록 상태 보기','profiles_none'),option('취소')]),action('profiles'),say('luna','[QA] 서비스 패널에서도 동일한 인물 목록을 볼 수 있습니다.')]},
  ...[0,1,2,3].map(stage=>({id:'profiles-stage-'+stage,group:'인물 정보',title:stage?'전원 정보 '+stage+'단계':'전원 미등록',note:'목록 → 상세 → Esc 복귀 / 단계별 잠금 상태 비교',steps:()=>[action('profiles_stage_'+stage),say('luna','[QA] 인물 정보 화면을 닫고 돌아왔습니다.')]})),
  {id:'memory-choice',group:'대화·회상',title:'선택지 → 조니의 기억 → 바 복귀',note:'본편 회상 이미지·대사·페이드 재사용. 본편 해금/진행에는 영향 없음',steps:()=>[enter('tom','R'),say('tom','[QA] 조니의 기억을 확인하겠어?'),menu([command('기억을 본다','memory'),option('나중에')]),action('memory_choice'),say('tom','[QA] 회상 뒤 이어지는 바 대사입니다.')]},
  {id:'memory-dialogue',group:'대화·회상',title:'대사 진행 → 조니의 기억 → 바 복귀',note:'다음 대사를 진행하면 회상 시작. 종료 후 같은 좌석·재화 유지',steps:()=>[enter('tom','R'),say('tom','[QA] 이 대사를 넘기면 조니의 기억이 시작됩니다.'),action('memory'),say('tom','[QA] 기억에서 돌아왔습니다.')]},
  {id:'tom-introduction',group:'인물 정보',title:'톰 · 이름 소개 시점 등록 알림',note:'등장 시 무알림 → 실제 이름 소개 대사에서 한 번 알림',steps:()=>[enter('tom','R'),say('tom','[QA] 처음 만났지만 아직 소개 전입니다.'),{...say('tom','톰이라고. 톰 거너. 내 이름이야.'),dialogue_id:'campaign_d1_bar_77'},say('tom','[QA] 이제 새 인물 알림을 확인하세요.')]}
 ];
 for(const id of W.LunaStoryNotices.roster)cases.push({id:'register-'+id,group:'인물 정보',title:(D.tables.characters.find(c=>c.id===id)?.['name.ko']||id)+' · 선택지로 등록',note:id==='chris'?'기존 지인: 목록 등록만, 신규 알림 없음':id==='tom'?'목록 등록 후 이름 소개 대사에서 알림':'선택 후 새 인물 알림 및 서비스 패널 목록 등록',steps:()=>[say('luna','[QA] 인물 정보를 등록할까요?'),menu([option('인물 정보 등록','flag.'+id+'_met = true'),option('취소')]),...(id==='tom'?[{...say('tom','톰이라고. 톰 거너. 내 이름이야.'),dialogue_id:'campaign_d1_bar_77',when:'flag.tom_met'}]:[]),say('luna','[QA] 서비스 패널의 단골 손님 정보를 확인하세요.') ]});
 for(const [id,poses]of Object.entries(D.characterLayers)){
  const expressions=[...new Set(Object.keys(poses).map(p=>p.replace(new RegExp('^'+id+'_','i'),'').replace(/_(default|talk)$/,'')))];
  cases.push({id:'actor-'+id,actor:id,expressions,group:'캐릭터·표정',title:(D.tables.characters.find(c=>c.id===id)?.['name.ko']||id)+' · 표정 선택',note:'대사를 쓰는 동안 말하기, 완독 후 대기. '+expressions.join(' / '),steps:()=>[enter(id,'L'),...expressions.map(p=>say(id,'[QA] '+p+' 표정입니다. 글자가 나오는 동안 말하기 동작, 문장이 완성되면 대기 동작을 확인하세요.',p))]});
 }
 for(const gender of ['m','f'])cases.push({id:'actor-guest-'+gender,group:'캐릭터·표정',title:'일반 손님 · '+(gender==='m'?'남성':'여성'),note:'실제 일반 손님 합성 리소스로 말하기·대기 확인',setup:g=>{let appearance;for(let i=0;i<100;i++){appearance=g.appearance();if(appearance.gender===gender)break;}g.seats.L={id:'qa-guest',actor:'gentle',state:'STORY',coaster:false,appearance};},steps:()=>[say('gentle','[QA] 일반 손님입니다. 대사 중에는 입이 움직이고, 완독하면 대기 동작으로 돌아갑니다.'),say('gentle','[QA] 완독한 뒤 대기 동작을 확인하고, 다음 대화 선택지로 돌아갑니다.')]});
 if(!D.characterLayers.shiba)cases.push({id:'actor-shiba',group:'캐릭터·표정',title:'개시바 · 리소스 상태',note:'바 전용 표정은 미등록. 외부 대기 동작은 외부 QA에서 확인',steps:()=>[say('luna','[QA] 개시바의 바 전용 표정은 아직 등록되지 않았습니다. 외부 대기 애니메이션은 외부 QA에 있습니다. 다른 캐릭터 이미지로 대체하지 않습니다.')]});
 for(const [id,title]of [['service','서비스 패널'],['settings','설정 / 복귀'],['history','대화 기록'],['help','조작 안내'],['johnnyUnlock','올드패션드 레시피 해금 팝업']])cases.push({id:'popup-'+id,group:'선택지·알림',title:'선택지 · '+title,note:'실제 화면 열기 → 닫기 → 다음 대사·조작 복귀',steps:()=>[say('luna','[QA] '+title+' 화면을 엽니다.'),menu([command('열기','popup'),option('취소')]),action('popup_'+id),say('luna','[QA] 팝업을 닫았습니다. 입력이 이어지는지 확인하세요.')]});
 return cases;
}
function create({g,D,ui,reset,finish}){
 const cases=catalog(D);let originalHook=null,hook=null,owner=null,current=null,serial=0;
 function detach(){if(hook&&g.campaignStep===hook)g.campaignStep=originalHook;hook=null;owner=null;}
 function attach(){owner=g.progress;originalHook=g.campaignStep;hook=intercept;g.campaignStep=hook;g.mode='full';}
 function allowed(){return W.lunaCampaign?.session.developer&&W.lunaCampaign.view==='developer';}
 function story(id,steps){
  g.dialogue=null;g.choice=null;g.lastStoryLine=null;g.storyCoaster=null;
  g.phase='regular';g.screen='bar';const context='qa99_'+id+'_'+(++serial);
  g.story={phase:'bar',scene:{id:context,day:'99'},index:0,autos:[],cursor:0,steps:steps.map((s,i)=>({context,seq:String(i+1),dialogue_id:context+'_'+i,arg:context+'_'+i,...s}))};
  g.safe(()=>g.pump());g.changed();
 }
 // Navigation is data interpreted by the same bar choice/hold/effects path.
 // No modal, launcher, alternate button handlers, or writes to shared tables.
 function navigation(id,choices){story('menu_'+id,[menu(choices.map((c,i)=>({...command(c.label,'route_'+i),qaRoute:c.route}))),row('qa_route',{routes:choices.map(c=>c.route)})]);}
 const link=(label,route)=>({label,route});
 function list(id,entries,page=0,back={kind:'root'}){
  // Reserve slots BEFORE slicing: previous, next and back are real choices too.
  // First/last pages can fit more content than middle pages. Never truncate cases.
  const pages=[];let offset=0;
  do{
   const capacity=CHOICE_LIMIT-(id==='root'?0:1)-(pages.length?1:0);
   const size=entries.length-offset>capacity?capacity-1:capacity;
   pages.push(entries.slice(offset,offset+size));offset+=size;
  }while(offset<entries.length);
  const last=pages.length-1;page=Math.max(0,Math.min(page,last));
  const rows=pages[page].slice();
  if(page>0)rows.push(link('이전 항목',{kind:'page',id,page:page-1}));
  if(page<last)rows.push(link('다음 항목',{kind:'page',id,page:page+1}));
  if(id!=='root')rows.push(link('뒤로',back));
  navigation(id+'_'+page,rows);
 }
 function show(id='root',page=0){
  if(id==='root')return list(id,[...[...new Set(cases.map(c=>c.group))].map(group=>link(group,{kind:'group',group})),link('기존 QA 대사·일반 영업',{kind:'legacy'})],page);
  if(id.startsWith('actor:')){
   const test=cases.find(c=>c.id===id.slice(6));
   return list(id,[link('모든 표정 이어 보기',{kind:'run',id:test.id}),...test.expressions.map(p=>link(p,{kind:'pose',id:test.id,pose:p}))],page,{kind:'group',group:test.group});
  }
  return list(id,cases.filter(c=>c.group===id).map(c=>link(c.title,{kind:c.expressions?'actor':'run',id:c.id})),page);
 }
 function route(r){
  if(r.kind==='run')return run(r.id);
  if(r.kind==='pose')return run(r.id,r.pose);
  if(r.kind==='actor')return show('actor:'+r.id);
  if(r.kind==='group')return show(r.group);
  if(r.kind==='page')return show(r.id,r.page);
  if(r.kind==='legacy'){navigation('legacy',[link('개점 · 대사·분기·일반 영업',{kind:'legacyScene',phase:'bar_open'}),link('단골 · 주문·제공·정산',{kind:'legacyScene',phase:'bar'}),link('뒤로',{kind:'root'})]);return;}
  if(r.kind==='legacyScene'){
   // Keep the authored QA branches and real general service reachable.
   g.seats={L:null,M:null,R:null};g.currentOrder=null;g.phase=r.phase==='bar'?'regular':'opening';
   g.story={phase:r.phase,scene:{id:'qa99_legacy',day:'99'},index:0,autos:[],cursor:0,steps:[{type:'choice',arg:r.phase==='bar'?'ch_t99_bar':'ch_t99_main',qaLegacy:true}]};
   g.pump();return;
  }
  show();
 }
 function completed(){
  navigation('complete',[link('다시 테스트',{kind:current.pose?'pose':'run',id:current.id,pose:current.pose}),link('다른 테스트 선택',{kind:'group',group:current.group}),link('처음으로',{kind:'root'})]);
 }
 function start(){
  if(!allowed())throw Error('개발자 시뮬레이션에서 실행해 주세요.');
  reset();attach();current=null;show();finish('대화 선택지 · QA 시작');
 }
 function profiles(stage){
  for(const id of W.LunaStoryNotices.roster){g.progress.flags[id+'_met']=stage>0;g.progress.affinity[id]=stage>=3?30:stage===2?10:0;}
  g.progress.flags.qa_profiles_all=stage===3;g.progress.flags.qa_profiles_two=stage===2;
  ui.dossierPreview=null;ui.dossierDetail=null;g.overlay='dossier';
 }
 function memory(step){
  const c=W.lunaCampaign,expected=owner,story=g.story;
  const valid=()=>owner===expected&&g.progress===expected&&g.day===99&&g.story===story&&c.session.developer;
  c.resetInput();
  c.retryLoad=()=>{if(valid())memory(step);};
  c.beginMemoryTransition(()=>W.LunaJohnnyMemory.prepare(D),()=>{
   if(!valid())return;
   c.scene('johnny','QA · 조니의 기억','johnny-memory',()=>{
    if(!valid())return;
    c.beginMemoryTransition(()=>null,()=>{
     if(!valid())return;
     c.dialog=null;c.screen('developer');g.stepDone(step);g.changed();
    });
   });
  });
 }
 function intercept(s){
  if(g.day!==99||g.progress!==owner||!W.lunaCampaign?.session.developer)return originalHook?.(s)||false;
  if(s.type==='choice'&&['ch_t99_main','ch_t99_bar'].includes(s.arg)&&!s.qaLegacy){show();return true;}
  if(s.type==='qa_menu'){
   for(const key of Object.keys(g.progress.flags))if(key.startsWith('qa_')&&!['qa_profiles_all','qa_profiles_two'].includes(key))delete g.progress.flags[key];
   g.choice={step:s,rows:checkedChoices(s.choices).map((c,i)=>({...c,seq:String(i+1),context:s.arg,row_id:s.arg+'_'+i}))};return true;
  }
  if(s.type==='qa_route'){
   const i=s.routes.findIndex((_,i)=>g.progress.flags['qa_route_'+i]);
   if(i<0)throw Error('QA 선택 경로가 없습니다.');
   delete g.progress.flags['qa_route_'+i];route(s.routes[i]);return true;
  }
  if(s.type==='qa_end'){completed();return true;}
  if(s.type!=='qa_action')return originalHook?.(s)||false;
  const f=g.progress.flags,n=W.LunaStoryNotices;
  if(s.arg==='memory'||s.arg==='memory_choice'&&f.qa_memory){memory(s);return true;}
  if(s.arg==='notices'){
   if(f.qa_goal_new)n.startGoal(g.progress,'qa_goal','QA · 목표 확인');
   for(const [flag,id,title]of [['qa_goal_repair','qa_repair','엘레베이터 수리!'],['qa_goal_materials','qa_materials','올드패션드 재료 구하기!']])if(f[flag]){n.startGoal(g.progress,id,title,{silent:true});n.completeGoal(g.progress,id);}
   if(f.qa_event)n.forced({encounter:{}});
  }
  if(s.arg==='profiles'&&(f.qa_profiles_all||f.qa_profiles_none))profiles(f.qa_profiles_all?3:0);
  if(s.arg.startsWith('profiles_stage_'))profiles(Number(s.arg.at(-1)));
  if(s.arg.startsWith('popup_')&&f.qa_popup)g.overlay=s.arg.slice(6);
  g.stepDone(s);return true;
 }
 function run(id,pose=null){
  if(!allowed())throw Error('개발자 시뮬레이션에서 실행해 주세요.');
  const test=cases.find(c=>c.id===id);if(!test)throw Error('알 수 없는 QA 프리셋: '+id);
  if(pose&&!test.expressions?.includes(pose))throw Error('등록되지 않은 표정입니다.');
  reset();attach();current={...test,pose};test.setup?.(g);
  const steps=pose?[enter(test.actor,'L'),say(test.actor,'[QA] '+pose+' 표정입니다. 완독한 뒤 대기 동작도 확인하세요.',pose)]:test.steps();
  story(id,[...steps,row('qa_end')]);finish('프리셋: '+test.title);
 }
 return{cases,run,start,detach,tick(){if(owner&&(g.progress!==owner||g.day!==99||!W.lunaCampaign?.session.developer))detach();}};
}
W.LunaBarQAPresets={catalog,create};
})(window);
