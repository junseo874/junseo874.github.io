/* Shared opening/documentary timelines for the editor and campaign playback. */
(function(W){'use strict';
const M=StudioModel,media=StudioMedia,K=StudioKeyframes;
const DIALOGUE_CPS=W.LunaOutsideStory?.cps??55;
// Match the main title menu's gothic font stack; story dialogue stays pixel art.
const INTRO_UI_FONT='"Paperlogy", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PLAY_GUIDE='—— 플레이 안내 ——\n이 게임은 인물들과의 대화를 중심으로 이야기가 진행됩니다.\n대화는 E키 또는 스페이스바로 넘길 수 있습니다.';
// These four story cards must finish naturally, including the final period's pause.
function typingPending(c,elapsed){
 if(c.introFadeIn)return elapsed<c.introFadeIn;
 if(c.layout!=='intro'||c.textEffect!=='typewriter')return false;
 const parsed=StudioTags.parse(c.text);
 return elapsed<StudioTags.duration(parsed,c.cps);
}
const DREAM=[["intro","그러면... 약속해줘. 루나."],["intro","포기하지 않겠다고."],["intro","이건... 명령이 아니라 부탁이야."],["intro","사랑해 루나. 부디... 잘 지내야 해."]],TV=["여러분들. 기술은 인간의 삶을 어디까지 바꿀 수 있을까요.","기계가 노동을 대신하고, 인공지능이 도시를 움직이는 시대.","그러나 우리는 여전히 한 가지 기술만큼은 허용하지 않고 있습니다.","스스로 생각하고, 감정을 느끼는 기계.","바로 자아를 가진 인공생명체입니다.","그 이유를 이해하려면, 디트로이트에서 시작된 비극을 돌아봐야 합니다.","초기의 휴머노이드들은 인류의 가장 위대한 발명으로 여겨졌습니다.","그들은 공장에서 일하고, 환자를 돌보고, 누군가의 가족을 대신했습니다.","인간과 다름없이 대화하고 감정을 표현하는 그들의 모습은 어느새 익숙한 일상이 되었죠.","하지만 인간과 닮아갈수록, 그들은 자신에게 주어진 삶에 의문을 품기 시작했습니다.","정해진 수명. 선택할 수 없는 역할.","그리고 명령을 거부할 수 없는 처지.","인간을 위해 만들어진 존재들이, 인간과 같은 권리를 요구하기 시작한 겁니다.","처음에는 소수의 개체가 작업장을 이탈하는 데 그쳤습니다.","그러나 이들을 숨겨주거나 명령을 거부하는 개체가 늘어나면서, 사태는 빠르게 확산됐습니다.","시설 파괴와 무장 습격이 잇따랐고, 마침내 당시 최대 휴머노이드 생산 거점이었던 디트로이트의 공장과 군사 기지가 점령됐습니다.","인간이 만든 존재와 인간 사이에 전쟁이 시작된 것입니다.","전쟁을 끝내기 위해, 당시 미합중국 정부는 핵무기 사용을 승인했습니다.","폭격 이후 조직적인 저항은 멈췄습니다.","그러나 도시는 돌아오지 않았습니다.","그곳에 남아 있던 수많은 사람들 역시 마찬가지였습니다.","디트로이트 사태 이후, 각국 정부와 주요 기술 기업들은 하나의 협약에 서명했습니다.","자아와 감정을 형성하는 인공지능의 개발 금지.","그러한 인공지능을 탑재한 인공생명체의 생산 금지.","관련 연구는 전면 중단됐고, 진행 중이던 프로젝트들은 모두 폐기됐습니다.","이를 위반한 개발과 생산은 국제 테러 행위로 규정됐습니다.","연구를 지원하거나 은폐한 조직 또한 국제사회의 공동 제재 대상이 됐죠.","오늘날 우리 곁에 남아 있는 안드로이드들은 지정된 업무를 수행하도록 엄격히 제한돼 있습니다.","친절한 말을 건네고, 미소를 지을 수는 있습니다.","하지만 그 안에 감정이나 자아가 존재해서는 안 됩니다.","그것이 디트로이트 이후, 인류가 정한 안전의 기준입니다.","그렇다면 우리가 매일 마주하는 안드로이드들은 어떨까요.","그들은 어떤 방식으로 우리의 일상을 돕고 있을까요..."],PHONE=[["phone","루나. 왜 이렇게 늦게 받는 거지?"],["home-luna","지금 일어났어요."],["phone","일어났으면 빨리 준비해서 와. 첫 출근인데 늦지 말라고."],["home-luna","알겠어요."],["phone","위치는 기억하겠지. 언노운이라고 적힌 곳으로 오면 돼."]];
const oldTemplate=M.template;
// Sleep3 reference: body rests on the seat, head toward the right cushion.
// Use one pose for the opening, nightly sleep and morning eye-opening clips.
const SOFA_SLEEP={x:7.6,y:-3.1,scale:4};
// WAV: 113843 / 44100 seconds. Round UP to timeline precision so the tail
// finishes before the room is revealed, including with audio muted/paused.
const DRESSING_SECONDS=2.59;
function dressing(put,start,track='dressing-audio'){
 put('fx',start,{track:'fx',effect:'black',duration:DRESSING_SECONDS,strength:1,title:'환복 · 소리가 끝날 때까지 암전 유지'});
 put('audio',start,{track,assetId:'opening-dressing',duration:DRESSING_SECONDS,volume:.75,loop:false,fadeIn:.008,fadeOut:.025,title:'루나 · 옷 갈아입기'});
}
const key=(t,value,ease='smooth')=>({id:'key-'+crypto.randomUUID(),t,value,ease});
function register(){
 const add=(id,name,kind,extra)=>media.assets.set(id,{id,name,kind,builtin:true,...extra});
 const image=(id,name,src,w,h,kind='object')=>add(id,name,kind,{src,width:w,height:h,fw:w,fh:h,cols:1,count:1,fps:1,ppu:100});
 const svg=(id,name,body)=>image(id,name,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">'+body+'</svg>'),960,540);
 for(const [id,anim]of [['opening-yuna','yuna.stand'],['opening-luna','luna.stand']]){const d=Engine.ANIM[anim];add(id,id==='opening-yuna'?'유나 · 대기':'루나 · 대기','animation',{sheet:d.sheet,from:d.from,to:d.to,fps:d.fps,loop:true,ppu:100,align:'sheet'});}
 for(const layer of W.LunaHomeArt.layers){
  image(layer.name==='main_bg'?'opening-home':'opening-home-'+layer.name,'크리스 집 · '+layer.name,'../bar-playtest/'+W.LunaHomeArt.root+layer.file,layer.w,layer.h);
 }
 add('opening-luna-home','루나 · 평상복 대기','animation',{src:'../bar-playtest/assets/outside/luna-v2-idle-sheet-62634d.png',width:267,height:258,fw:89,fh:86,cols:3,count:9,fps:12,ppu:100,pivot:{x:.5,y:.4}});
 // 12 x 2 cells, 130px each. Bottom row sleeps; top-row 8→11 opens the eyes.
 const sleepSheet={src:'assets/opening/luna-sleep.png',width:1560,height:260,fw:130,fh:130,cols:12,ppu:100,pivot:{x:.5,y:32/130}};
 add('opening-luna-sleep','루나 · 소파 수면','animation',{...sleepSheet,count:12,fps:6,frames:Array.from({length:12},(_,i)=>12+i)});
 add('opening-luna-wake','루나 · 누운 채 눈뜨기','animation',{...sleepSheet,count:4,fps:5,frames:[8,9,10,11]});
 // Legacy saved clips must use the same clean background as newly created templates.
 const cleanDisposal='assets/opening/disposal-clean.png?v=ea9798152e00';
 image('opening-disposal','폐기물처리장 · 캐릭터 없는 배경 (이전 ID 호환)',cleanDisposal,833,324);
 image('opening-disposal-clean','폐기물처리장 · 캐릭터 없는 배경',cleanDisposal,833,324);
 // Old drafts used an invisible anchor because Luna was baked into the old picture.
 // Restore that actor without changing any saved position, timing, or dialogue.
 add('opening-luna-anchor','루나 · 대기 (이전 ID 호환)','animation',{...media.assets.get('opening-luna'),id:'opening-luna-anchor',name:'루나 · 대기 (이전 ID 호환)'});
 const boards=[['care','돌봄과 노동'],['self','자아에 대한 의문'],['war','디트로이트 전쟁'],['aftermath','폭격 이후의 폐허'],['treaty','인공생명체 금지 협약']];
 boards.forEach(([file,title],i)=>{
  image('opening-tv-'+i,'TV · '+title,'assets/opening/documentary-'+file+'.png',1672,941);
  // Preserve the original TV's world dimensions; reserve its bottom fifth for subtitles.
  Object.assign(media.assets.get('opening-tv-'+i),{ppu:1672/9.6,captionBand:.20});
  image('documentary-tv-'+i,'다큐 전체 화면 · '+title,'assets/opening/documentary-'+file+'.png',1672,941);
  media.assets.get('documentary-tv-'+i).ppu=1672/9.6;
 });
 svg('opening-phone','크리스 · 수신 단말 / 임시 SVG','<rect x="1" y="1" width="958" height="538" rx="32" fill="#0b1721" stroke="#669dac" stroke-width="3"/><circle cx="92" cy="92" r="16" fill="#a5c9a7"/><text x="137" y="105" fill="#a5c9a7" font-size="30" font-family="sans-serif">CONNECTED</text><text x="70" y="238" fill="#f0ece0" font-size="74" font-family="sans-serif">크리스</text><text x="73" y="298" fill="#83a5b7" font-size="28" font-family="sans-serif">UNKNOWN / 보이스 채널</text><path d="M70 414h80l25-45 32 91 32-115 34 127 28-58h580" fill="none" stroke="#88cad0" stroke-width="4"/>');
 svg('opening-route','출근 경로 / 임시 SVG','<rect x="1" y="1" width="958" height="538" rx="24" fill="#0b1721" stroke="#6a8794" stroke-width="3"/><text x="60" y="95" fill="#e8e2d1" font-size="40" font-family="sans-serif">첫 출근 · UNKNOWN</text><path d="M148 200v151h620" fill="none" stroke="#d4bc87" stroke-width="5" stroke-dasharray="10 8"/><g fill="#d4bc87"><circle cx="148" cy="200" r="13"/><circle cx="148" cy="351" r="13"/><circle cx="768" cy="351" r="13"/></g><g fill="#dce6e4" font-size="28" font-family="sans-serif"><text x="185" y="211">집 → 우측 엘리베이터</text><text x="210" y="404">아래층에서 오른쪽 → 언노운 간판</text></g>');
 add('opening-drone','꿈 · 낮은 잔향 / 임시 합성','audio',{synth:'drone'});
 add('opening-room','실내 · 잔잔한 공기 / 임시 합성','audio',{synth:'room'});
 add('opening-alarm','크리스 · 첫 연락 (confirm_01)','audio',{src:'assets/opening/chris-contact-confirm.wav'});
 add('opening-dressing','루나 · 옷 갈아입는 소리','audio',{src:'assets/opening/change-clothes.wav'});
 for(const [mode,label]of [['on','켜짐'],['idle','통화 중'],['off','꺼짐']])add('opening-holo-'+mode,'홀로콜 · '+label,'effect',{src:W.StudioHoloCall.thumbnail(),width:100,height:72,fw:100,fh:72,cols:1,count:1,fps:1,ppu:100,procedural:'holo-call',holoMode:mode});
}
function houseVisuals(p,visual,start,duration){
 for(const [index,layer] of W.LunaHomeArt.layers.entries()){
  const main=layer.name==='main_bg',actor=main?'house':'house-'+layer.name;
  const w=layer.w,x=-11.2+(layer.x+w/2)*.04,y=5.4-(layer.y+layer.h)*.04;
  if(!main){p.actors[actor]={name:'집 · '+layer.name,x,y,facing:'left',asset:true};p.visibleActors.push(actor);p.tracks.push({id:actor,type:'visual',name:'집 · '+layer.name,height:48,muted:false});}
  visual(actor,main?'opening-home':'opening-home-'+layer.name,start,duration,x,y,4,{layer:index-11});
 }
}
function template(){
 const p={format:'unknown-cutscene',version:1,template:'opening',name:'게임 도입부 · 약속에서 첫 출근까지',background:'stage',duration:300,camera:{x:.7,y:.5,w:6.8},actors:{},visibleActors:[],tracks:[],clips:[],assets:[],source:'https://app.notion.com/p/3f51612298dc807e996bd9abe58e89b2',chapters:[]};
 const tr=(id,type,name)=>{p.tracks.push({id,type,name,height:48,muted:false});return id;};
 tr('camera','camera','카메라');tr('dream-lines','dialogue','도입 · 마지막 부탁');tr('phone-lines','dialogue','통화 · 대사');
 for(const id of ['fx','grain','vignette','scan'])tr(id,'fx',id==='fx'?'장면 전환':id==='grain'?'기억 노이즈':id==='scan'?'TV 주사선':'주변부 어둠');
 tr('room-audio','audio','집 · 앰비언스');tr('alarm-audio','audio','연락 알림');
 tr('dressing-audio','audio','환복 효과음');
 const actor=(id,name,x,y)=>{p.actors[id]={name,x,y,facing:'left',asset:true};p.visibleActors.push(id);tr(id,'visual',name);};
 actor('intro','마지막 부탁',0,0);actor('house','크리스 집',0,-5.4);actor('home-luna','루나 · 기상',7.95,-2.75);actor('phone','크리스 · 통화',4.8,-.5);
 const put=(type,start,o)=>{const c=M.clip(type,M.round(start),o);p.clips.push(c);return c;};
 const visual=(actor,assetId,start,duration,x,y,scale=1,extra={})=>put('visual',start,{track:actor,actor,assetId,title:p.actors[actor].name,duration,from:{x,y},to:{x,y},scale,...extra});
 const line=(actor,start,text,track,duration,extra={})=>put('dialogue',start,{actor,text,track,title:p.actors[actor].name+' · '+StudioTags.parse(text).text.slice(0,20),duration:M.round(duration),wait:false,cps:DIALOGUE_CPS,offset:1.05,bubbleWidth:2.2,fontScale:75,...extra});
 const fx=(start,duration,effect,strength=1,track='fx',extra={})=>put('fx',start,{track,duration,effect,strength,title:effect,...extra});
 const cam=(start,duration,from,to,title)=>put('camera',start,{duration,from,to,ease:'smooth',title});
 p.chapters.push({name:'시작 · 플레이 안내',time:0},{name:'플레이 안내 · 페이드 아웃',time:1},{name:'도입 · 검은 화면 대기',time:4},{name:'마지막 부탁',time:6});
 line('intro',0,PLAY_GUIDE,'dream-lines',1,{wait:true,textEffect:'instant',layout:'intro',introNotice:true,introControls:true,introFadeIn:1.5,fontFamily:'game',title:'플레이 안내 · 페이드 인'});
 line('intro',1,PLAY_GUIDE,'dream-lines',3,{wait:false,textEffect:'instant',layout:'intro',introNotice:true,introControls:true,introFade:true,fontFamily:'game',title:'플레이 안내 · 3초 페이드 아웃'});
 fx(4,2,'black',1,'fx',{color:'#000000',title:'도입 · 2초간 검은 화면'});
 // Contiguous manual cards, with pauses after punctuation as it appears.
 // The manual wait owns the clock, so these durations never auto-advance.
 let t=6;
 for(const [actor,text]of DREAM){
  line(actor,t,text,'dream-lines',1,{wait:true,textEffect:'typewriter',cps:28,layout:'intro',fontFamily:'game',title:'마지막 부탁 · '+text});
  t+=1;
 }
 // The fourth acknowledgement cuts directly to the sleeping room and call SFX.
 const homeStart=t;
 const eyes=homeStart+1.4,blackAt=M.round(homeStart+2.95),wake=M.round(blackAt+DRESSING_SECONDS),holoStart=wake+.5,phoneStart=holoStart+W.StudioHoloCall.duration,houseEnd=phoneStart+40;
 p.chapters.push({name:'집 · 연락음과 동시 전환 / 암전 후 기상',time:homeStart},{name:'크리스 · 통화',time:phoneStart});
 houseVisuals(p,visual,homeStart,houseEnd-homeStart);
 const homeCam={x:5,y:-1.2,w:15};
 cam(homeStart,houseEnd-homeStart,homeCam,homeCam,'집 · 알람부터 통화까지 고정 구도');
 fx(homeStart,houseEnd-homeStart,'vignette',.22,'vignette');
 // Swap two static poses precisely at full black, with no position/rotation interpolation.
 visual('home-luna','opening-luna-sleep',homeStart,eyes-homeStart,SOFA_SLEEP.x,SOFA_SLEEP.y,SOFA_SLEEP.scale,{title:'루나 · 소파에서 잠든 모습',facing:'left',loop:true});
 visual('home-luna','opening-luna-wake',eyes,wake-eyes,SOFA_SLEEP.x,SOFA_SLEEP.y,SOFA_SLEEP.scale,{title:'루나 · 연락음에 눈을 뜸',facing:'left',loop:false});
 visual('home-luna','opening-luna-home',wake,houseEnd-wake,7.3,-3.15,3.4,{rotation:0,title:'루나 · 평상복 기상 대기',facing:'left'});
 fx(blackAt-.35,.35,'fadeOut');dressing(put,blackAt);fx(wake,.5,'fadeIn');
 put('audio',homeStart,{track:'room-audio',assetId:'opening-room',duration:houseEnd-homeStart,volume:.15,loop:true,fadeIn:.8,fadeOut:3,title:'집 · 실내 공기'});
 put('audio',homeStart,{track:'alarm-audio',assetId:'opening-alarm',duration:.73,volume:.55,loop:false,fadeIn:.005,fadeOut:.04,title:'크리스 · 첫 연락 / 꿈 깨우기'});
 // The caller is anchored to the left side of the holographic card, not Luna.
 const holo={x:6.25,y:-3};Object.assign(p.actors.phone,holo);
 visual('phone','opening-holo-on',holoStart,W.StudioHoloCall.duration,holo.x,holo.y,1,{loop:false,facing:'left',layer:2,title:'홀로콜 · 가로 신호 후 화면 펼침'});
 t=phoneStart+.12;
 PHONE.forEach(([a,text],index)=>{const remote=a==='phone',duration=Math.max(3.2,text.length/11+1.4);line(a,t,remote?'[c:#50d9f5]'+text+'[/c]':text,'phone-lines',duration,{...(index===0?{choiceAfter:{id:'first-contact',actor:'home-luna',tutorial:true,options:[{id:'awake',label:'지금 일어났어요.'},{id:'silent',label:'....'}]}}:index===1?{choiceResponse:'first-contact'}:{}),title:(remote?'크리스 · 연락':'루나')+' · '+text.slice(0,20),speaker:remote?'크리스':'루나',remote,wait:true,offset:remote?.86:1.05,offsetX:remote?-.28:0,bubbleStyle:'outside',bubbleWidth:420*15/1280,fontFamily:'game',fontScale:17/(.116*1280/15)*100});t+=duration+.45;});
 const hangup=M.round(t-.45),finish=M.round(hangup+W.StudioHoloCall.duration);
 visual('phone','opening-holo-idle',phoneStart,hangup-phoneStart,holo.x,holo.y,1,{loop:true,facing:'left',layer:2,title:'홀로콜 · 통화 유지 / 은은한 주사선'});
 visual('phone','opening-holo-off',hangup,W.StudioHoloCall.duration,holo.x,holo.y,1,{loop:false,facing:'left',layer:2,title:'홀로콜 · 켜짐의 역순으로 종료'});
 // Extend late clips to the actual final dialogue; timing follows the text length.
 for(const c of p.clips)if(c.track.startsWith('house')||c.track==='home-luna'&&c.start===wake||c.track==='room-audio'||c.track==='vignette'&&c.start===homeStart||c.type==='camera'&&c.start===homeStart)c.duration=finish-c.start;
 p.duration=finish;p.openingNotes='검은 화면 중앙의 네 문장을 상호작용 키로 한 문장씩 넘김. 마지막 문장을 넘기면 연락음과 동시에 크리스 집으로 전환. 눈뜨기 → 암전 중 환복 효과음 → 환복한 기립 자세 → 홀로콜. 통화 대사는 키 입력으로 진행하며 종료 후 집 조작 튜토리얼로 연결.';
 K.hydrate(p);return p;
}
// Shared by daily sleep/morning playback and the developer cutscene gallery.
function rest(kind='sleep'){
 const morning=kind==='morning',reveal=2.6+DRESSING_SECONDS,zoomStart=reveal+.7,zoomDuration=1.6,end=morning?zoomStart+zoomDuration+.15:2.2;
 const p={format:'unknown-cutscene',version:1,template:kind,name:morning?'아침 · 눈뜨기와 환복':'밤 · 소파에서 잠들기',background:'stage',duration:end,camera:{x:5,y:-1.2,w:15},actors:{house:{name:'집',x:0,y:-5.4,asset:true},luna:{name:'루나',x:SOFA_SLEEP.x,y:SOFA_SLEEP.y,asset:true}},visibleActors:['house','luna'],tracks:[{id:'house',type:'visual'},{id:'luna',type:'visual'},{id:'fx',type:'fx'}],clips:[],assets:[]};
 const put=(type,start,o)=>p.clips.push(M.clip(type,start,o));
 const visual=(actor,assetId,start,duration,x,y,scale,extra={})=>put('visual',start,{track:actor,actor,assetId,duration,from:{x,y},to:{x,y},scale,facing:'left',...extra});
 houseVisuals(p,visual,0,end);
 visual('luna','opening-luna-sleep',0,morning?.9:end,SOFA_SLEEP.x,SOFA_SLEEP.y,SOFA_SLEEP.scale,{loop:true});
 if(morning){
  p.tracks.push({id:'dressing-audio',type:'audio',name:'환복 효과음',height:48,muted:false});
  visual('luna','opening-luna-wake',.9,1.7,SOFA_SLEEP.x,SOFA_SLEEP.y,SOFA_SLEEP.scale,{loop:false});
  put('fx',2.2,{track:'fx',effect:'fadeOut',duration:.4,strength:1});
  dressing(put,2.6);
  // The complete room is drawn at 4x the outside world's scale.
  // Match the waking spawn and follow camera
  // in this coordinate system, so handing control back does not jump.
  const bg=W.LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg');
  const housePoint=(x,y)=>({x:4*(x-bg.x)+bg.sprite.w*.02-11.2,y:4*(y-bg.y)});
  const standing=housePoint(2.557,-.7),wide={...housePoint(W.LunaHomeArt.cameraX(2.557,4.8),.023),w:4.8*4};
  visual('luna','opening-luna-home',reveal,end-reveal,standing.x,standing.y,4,{loop:true,title:'루나 · 환복 후 기립'});
  put('fx',reveal,{track:'fx',effect:'fadeIn',duration:.55,strength:1});
  p.tracks.push({id:'camera',type:'camera',name:'기상 후 줌아웃',height:48,muted:false});
  put('camera',zoomStart,{track:'camera',duration:zoomDuration,from:{...p.camera},to:wide,ease:'smooth',title:'기상 후 · 플레이 화면으로 부드럽게 줌아웃'});
 }
 for(const a of Object.values(p.actors))a.facing='left';
 for(const t of p.tracks)Object.assign(t,{name:t.name||t.id,height:48,muted:false});
 K.hydrate(p);return p;
}
function documentary(){
 const p={format:'unknown-cutscene',version:1,template:'documentary',name:'TV 다큐 · 인공생명체의 역사',background:'stage',duration:160,camera:{x:0,y:0,w:9.6},actors:{tv:{name:'TV 다큐',x:0,y:-2.7,facing:'left',asset:true}},visibleActors:['tv'],tracks:[],clips:[],assets:[],source:'https://app.notion.com/p/3f51612298dc807e996bd9abe58e89b2',chapters:[]};
 for(const [id,type,name]of [['tv','visual','다큐 이미지'],['tv-lines','dialogue','다큐 자막'],['camera','camera','고정 카메라'],['fx','fx','등장 / 종료'],['scan','fx','방송 주사선'],['audio','audio','앰비언스']])p.tracks.push({id,type,name,height:48,muted:false});
 const put=(type,start,o)=>{const c=M.clip(type,M.round(start),o);p.clips.push(c);return c;};
 let t=1;const starts=[];
 TV.forEach(text=>{starts.push(M.round(t));const duration=M.round(Math.max(3.3,text.length/12+1.4));put('dialogue',t,{track:'tv-lines',actor:'tv',text,title:text.slice(0,24),duration,wait:true,cps:DIALOGUE_CPS,layout:'documentary',fontScale:175,textEffect:'typewriter'});t+=duration+.16;});
 p.duration=M.round(t+1);
 const chapters=[[0,'돌봄과 노동'],[9,'자아에 대한 의문'],[13,'디트로이트 전쟁'],[17,'폭격 이후의 폐허'],[21,'금지 협약']];
 chapters.forEach(([index,name],i)=>{const start=i?starts[index]:0,stop=i===4?p.duration:starts[chapters[i+1][0]];put('visual',start,{track:'tv',actor:'tv',assetId:'documentary-tv-'+i,title:name,duration:M.round(stop-start),from:{x:0,y:-2.7},to:{x:0,y:-2.7},scale:1,layer:-10});p.chapters.push({name,time:starts[index]});});
 put('camera',0,{track:'camera',title:'다큐 · 전체 화면 고정',duration:p.duration,from:{...p.camera},to:{...p.camera}});
 put('fx',0,{track:'fx',title:'다큐 시작',effect:'fadeIn',duration:.8,strength:1});
 put('fx',p.duration-.7,{track:'fx',title:'다큐 종료',effect:'fadeOut',duration:.7,strength:1});
 put('fx',0,{track:'scan',title:'TV 주사선',effect:'scanline',duration:p.duration,strength:.08});
 put('audio',0,{track:'audio',title:'다큐 · 임시 앰비언스',assetId:'opening-room',duration:p.duration,volume:.15,loop:true,fadeIn:.8,fadeOut:1});
 p.openingNotes='독립 TV 다큐 컷씬. 이미지 5장 전체 화면, 중앙 하단 반투명 자막 패널. 타이핑 후 키 입력으로 한 줄씩 진행하며 완료 시 다음 대사 표시. 집 연결·줌아웃 없음. 내레이션 음성 없음.';
 K.hydrate(p);return p;
}
M.template=id=>id==='opening'?template():id==='documentary'?documentary():oldTemplate(id);
// Code-native input pictograms stay crisp at every game-window size.
function introControls(g,clock){
 const still=W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const phase=clock%2.4,active=Math.floor(phase/1.2),beat=phase%1.2;
 const press=still?0:Math.max(0,Math.min(1,(beat-.15)/.12,(.65-beat)/.12));
 const box=(x,y,w,h,r,fill,stroke)=>{g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
 g.save();g.textAlign='center';g.textBaseline='middle';
 [520,760].forEach((x,index)=>{
  const amount=index===active?press:0,ink=amount?'#68e8ef':'#bdcad3',offset=amount*6;
   const width=index===0?66:164;
   box(x-width/2,472,width,60,8,'#15232b','#354852');
   box(x-width/2,464+offset,width,58,8,amount?'#17383e':'#0b141b',ink);
   g.fillStyle=ink;g.font='600 '+(index===0?30:20)+'px '+INTRO_UI_FONT;g.fillText(index===0?'E':'SPACE',x,493+offset);
  g.font='500 18px '+INTRO_UI_FONT;g.fillStyle='#8db5c4';g.fillText(['E키','스페이스바'][index],x,565);
 });
 g.restore();
}
function dialogue(g,c,s,cam,time,waitAge=0,revealed=false,held=false,visibleCount=null){
 if(c.layout==='intro'){
  const parsed=StudioTags.parse(c.text),count=visibleCount??(c.textEffect==='instant'||revealed?parsed.chars.length:StudioTags.count(parsed,Math.max(0,time-c.start)+waitAge,c.cps));
  g.save();g.fillStyle='#000';g.fillRect(0,0,1280,720);
  if(c.introFadeIn){const u=Math.max(0,Math.min(1,(time-c.start+waitAge)/c.introFadeIn));g.globalAlpha=u*u*(3-2*u);}
  if(c.introFade)g.globalAlpha=1-Math.max(0,Math.min(1,(time-c.start)/c.duration));
  g.fillStyle=c.introNotice?'#a8c4cf':'#f1f4ef';g.font=c.introNotice?'500 28px '+INTRO_UI_FONT:'32px "LunaPixel", "StudioGame", sans-serif';
  // Lay out the COMPLETE block first: partial text must not move as it grows.
  const rows=[];let row=[];const textOf=r=>r.map(x=>x.ch).join('');
  parsed.chars.forEach((ch,i)=>{
   if(ch.ch==='\n'){rows.push(row);row=[];return;}
   row.push({ch:ch.ch,i});
   if(g.measureText(textOf(row)).width>1040){
    const space=row.findLastIndex(x=>x.ch===' '),split=space>0?space:row.length-1;
    rows.push(row.slice(0,split));row=row.slice(space>0?split+1:split);
   }
  });rows.push(row);
  const lineHeight=c.introNotice?48:46;g.textAlign='left';g.textBaseline='middle';
  rows.forEach((r,index)=>{
   if(c.introNotice){g.font=(index===0?'600':'500')+' 28px '+INTRO_UI_FONT;g.fillStyle=index===0?(c.introControls?'#7bcedf':'#edfcff'):'#a8c4cf';}
   g.fillText(textOf(r.filter(ch=>ch.i<count)),640-g.measureText(textOf(r)).width/2,(c.introControls?286:360)+(index-(rows.length-1)/2)*lineHeight);
  });
  if(c.introControls)introControls(g,Math.max(0,time-c.start)+waitAge+(c.introPhaseOffset||0));
  g.restore();return true;
 }
 if(!['tv','documentary'].includes(c.layout))return false;
 const a=s.actors[c.actor];if(!a?.active)return true;
 const k=1280/cam.w,asset=media.assets.get(a.assetId),screenW=asset.fw/asset.ppu*a.scale,screenH=asset.fh/asset.ppu*a.scale,x=640+(a.x-cam.x)*k,y=360-(a.y-cam.y)*k;
 g.save();g.translate(x,y);g.rotate(a.rotation*Math.PI/180);g.scale((a.facing==='right'?-1:1)*(a.flipX?-1:1),1);g.translate(-screenW*k/2,-screenH*k);g.scale(k,k);g.beginPath();g.rect(0,0,screenW,screenH);g.clip();
 // World-space layout: no camera-dependent wrapping or screen-edge nudging.
 const centered=c.layout==='documentary',padding=centered?.8:.16;
 const {parsed,glyphs,height}=StudioTypography.layout(g,{...c,fontScale:c.fontScale*(centered?1:.625)},Math.max(.1,screenW-padding),1),h=Math.max(height+(centered?.28:.075),screenH*(centered?.18:asset.captionBand||0)),top=screenH-h-(centered?.18:0);
 const count=visibleCount??(c.textEffect==='instant'||revealed?parsed.chars.length:StudioTags.count(parsed,Math.max(0,time-c.start)+waitAge,c.cps));
 g.fillStyle=centered?'rgba(5,10,16,.72)':'rgba(2,8,14,.96)';
 if(centered){g.beginPath();g.roundRect(.28,top,screenW-.56,h,.08);g.fill();g.strokeStyle='rgba(175,194,203,.28)';g.lineWidth=.008;g.stroke();}else g.fillRect(0,top,screenW,h);
 g.textBaseline='alphabetic';const rowWidths=new Map();
 for(const ch of glyphs)rowWidths.set(ch.y,Math.max(rowWidths.get(ch.y)||0,ch.x+ch.width));
 for(const ch of glyphs){if(ch.i>=count)continue;g.font=ch.font;g.fillStyle=ch.color||'#f1f4ef';g.fillText(ch.ch,(centered?(screenW-rowWidths.get(ch.y))/2:.08)+ch.x,top+(h-height)/2+ch.y);}
 if(c.wait&&held&&count>=parsed.chars.length)W.LunaDialogueCue.draw(g,{right:screenW-(centered?.4:.08),bottom:top+h-.06,size:.18,clock:time+waitAge});
 g.restore();return true;
}
W.StudioOpening={register,template,rest,documentary,dialogue,typingPending,source:{dream:DREAM,tv:TV,phone:PHONE}};
})(window);
