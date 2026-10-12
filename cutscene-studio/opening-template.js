/* Shared opening/documentary timelines for the editor and campaign playback. */
(function(W){'use strict';
const M=StudioModel,media=StudioMedia,K=StudioKeyframes;
const DREAM=[["dream-luna","…이해가 안 돼요."],["yuna","뭐가?"],["dream-luna","왜 제가 살아야 하죠? 유나가 아니라…"],["dream-luna","수석 연구원인 당신이 저보다 귀한 인력이잖아요."],["dream-luna","저 같은 대체 가능한 인공지능은"],["yuna","아니. 루나, 잘 들어."],["yuna","넌 대체할 수 없는 존재야."],["yuna","넌 밥도 먹고, 잠도 자고, 꿈도 꾸잖아."],["yuna","스스로 생각해서 말하고… 행동하기도 하고."],["yuna","내가… 보증할 수 있어. 넌 사람이라고."],["dream-luna","하지만…"],["yuna","그리고… 너도 무섭잖아. 죽는 게."],["yuna","그러니까 살아, 루나. 넌 찾을 수 있을 거야."],["yuna","너의 목표인…"]],TV=["여러분들. 기술은 인간의 삶을 어디까지 바꿀 수 있을까요.","기계가 노동을 대신하고, 인공지능이 도시를 움직이는 시대.","그러나 우리는 여전히 한 가지 기술만큼은 허용하지 않고 있습니다.","스스로 생각하고, 감정을 느끼는 기계.","바로 자아를 가진 인공생명체입니다.","그 이유를 이해하려면, 디트로이트에서 시작된 비극을 돌아봐야 합니다.","초기의 휴머노이드들은 인류의 가장 위대한 발명으로 여겨졌습니다.","그들은 공장에서 일하고, 환자를 돌보고, 누군가의 가족을 대신했습니다.","인간과 다름없이 대화하고 감정을 표현하는 그들의 모습은 어느새 익숙한 일상이 되었죠.","하지만 인간과 닮아갈수록, 그들은 자신에게 주어진 삶에 의문을 품기 시작했습니다.","정해진 수명. 선택할 수 없는 역할.","그리고 명령을 거부할 수 없는 처지.","인간을 위해 만들어진 존재들이, 인간과 같은 권리를 요구하기 시작한 겁니다.","처음에는 소수의 개체가 작업장을 이탈하는 데 그쳤습니다.","그러나 이들을 숨겨주거나 명령을 거부하는 개체가 늘어나면서, 사태는 빠르게 확산됐습니다.","시설 파괴와 무장 습격이 잇따랐고, 마침내 당시 최대 휴머노이드 생산 거점이었던 디트로이트의 공장과 군사 기지가 점령됐습니다.","인간이 만든 존재와 인간 사이에 전쟁이 시작된 것입니다.","전쟁을 끝내기 위해, 당시 미합중국 정부는 핵무기 사용을 승인했습니다.","폭격 이후 조직적인 저항은 멈췄습니다.","그러나 도시는 돌아오지 않았습니다.","그곳에 남아 있던 수많은 사람들 역시 마찬가지였습니다.","디트로이트 사태 이후, 각국 정부와 주요 기술 기업들은 하나의 협약에 서명했습니다.","자아와 감정을 형성하는 인공지능의 개발 금지.","그러한 인공지능을 탑재한 인공생명체의 생산 금지.","관련 연구는 전면 중단됐고, 진행 중이던 프로젝트들은 모두 폐기됐습니다.","이를 위반한 개발과 생산은 국제 테러 행위로 규정됐습니다.","연구를 지원하거나 은폐한 조직 또한 국제사회의 공동 제재 대상이 됐죠.","오늘날 우리 곁에 남아 있는 안드로이드들은 지정된 업무를 수행하도록 엄격히 제한돼 있습니다.","친절한 말을 건네고, 미소를 지을 수는 있습니다.","하지만 그 안에 감정이나 자아가 존재해서는 안 됩니다.","그것이 디트로이트 이후, 인류가 정한 안전의 기준입니다.","그렇다면 우리가 매일 마주하는 안드로이드들은 어떨까요.","그들은 어떤 방식으로 우리의 일상을 돕고 있을까요…"],PHONE=[["phone","루나. 왜 연락을 안 받지?"],["home-luna","…지금 일어났어요."],["phone","…깨워서 미안하지만 지금은 일어나야 돼."],["phone","빨리 준비해서 와. 첫 출근이다."],["home-luna","알겠어요."],["phone","오는 길은 우측 엘리베이터를 타고 쭉 오른쪽으로 걸어와서 ‘언노운’이라는 간판 쪽으로 오면 돼."]];
const oldTemplate=M.template;
const key=(t,value,ease='smooth')=>({id:'key-'+crypto.randomUUID(),t,value,ease});
function register(){
 const add=(id,name,kind,extra)=>media.assets.set(id,{id,name,kind,builtin:true,...extra});
 const image=(id,name,src,w,h,kind='object')=>add(id,name,kind,{src,width:w,height:h,fw:w,fh:h,cols:1,count:1,fps:1,ppu:100});
 const svg=(id,name,body)=>image(id,name,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">'+body+'</svg>'),960,540);
 for(const [id,anim]of [['opening-yuna','yuna.stand'],['opening-luna','luna.stand']]){const d=Engine.ANIM[anim];add(id,id==='opening-yuna'?'유나 · 대기':'루나 · 대기','animation',{sheet:d.sheet,from:d.from,to:d.to,fps:d.fps,loop:true,ppu:100,align:'sheet'});}
 image('opening-home','크리스 집 · 기존 배경','../bar-playtest/assets/outside/outside_629b82812402bc.png',560,270);
 add('opening-luna-home','루나 · 평상복 대기','animation',{src:'../bar-playtest/assets/outside/outside_62634d34afb444.png',width:267,height:258,fw:89,fh:86,cols:3,count:9,fps:12,ppu:100,pivot:{x:.5,y:.4}});
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
 add('opening-alarm','통화 알림 / 임시 합성','audio',{synth:'alarm'});
}
function template(){
 const p={format:'unknown-cutscene',version:1,template:'opening',name:'게임 도입부 · 꿈에서 첫 출근까지',background:'stage',duration:300,camera:{x:.7,y:.5,w:6.8},actors:{},visibleActors:[],tracks:[],clips:[],assets:[],source:'https://app.notion.com/p/3f51612298dc807e996bd9abe58e89b2',chapters:[]};
 const tr=(id,type,name)=>{p.tracks.push({id,type,name,height:48,muted:false});return id;};
 tr('camera','camera','카메라');tr('dream-lines','dialogue','꿈 · 대사');tr('interruption','dialogue','유나 · 말 끊기');tr('phone-lines','dialogue','통화 · 대사');
 for(const id of ['fx','grain','vignette','scan'])tr(id,'fx',id==='fx'?'장면 전환':id==='grain'?'기억 노이즈':id==='scan'?'TV 주사선':'주변부 어둠');
 tr('dream-audio','audio','꿈 · 앰비언스');tr('room-audio','audio','집 · 앰비언스');tr('alarm-audio','audio','연락 알림');
 const actor=(id,name,x,y)=>{p.actors[id]={name,x,y,facing:'left',asset:true};p.visibleActors.push(id);tr(id,'visual',name);};
 actor('disposal','폐기처리장',0,0);actor('dream-luna','루나 · 꿈',1.815,-.94);actor('yuna','유나',.92,-.94);actor('house','크리스 집',0,-5.4);actor('home-luna','루나 · 기상',7.95,-2.75);actor('phone','크리스 · 통화',4.8,-.5);
 const put=(type,start,o)=>{const c=M.clip(type,M.round(start),o);p.clips.push(c);return c;};
 const visual=(actor,assetId,start,duration,x,y,scale=1,extra={})=>put('visual',start,{track:actor,actor,assetId,title:p.actors[actor].name,duration,from:{x,y},to:{x,y},scale,...extra});
 const line=(actor,start,text,track,duration,extra={})=>put('dialogue',start,{actor,text,track,title:p.actors[actor].name+' · '+StudioTags.parse(text).text.slice(0,20),duration:M.round(duration),wait:false,cps:24,offset:1.05,bubbleWidth:2.2,fontScale:75,...extra});
 const fx=(start,duration,effect,strength=1,track='fx',extra={})=>put('fx',start,{track,duration,effect,strength,title:effect,...extra});
 const cam=(start,duration,from,to,title)=>put('camera',start,{duration,from,to,ease:'smooth',title});
 p.chapters.push({name:'꿈 · 마지막 대화',time:0});
 let t=2.3;
 DREAM.forEach(([a,text],i)=>{let duration=Math.max(2.6,text.length/11+1.5);if(i===4)duration=4.4;
 // Center the tail on its speaker, just above their head. Only the interruption uses an upper row.
 const c=line(a,t,text,i===5?'interruption':'dream-lines',duration,{offset:i===5?1.30:.68,offsetX:0,overlay:i===4});
 if(i===5){c.text='[c:#eacb9c]아니.[/c] 루나, 잘 들어.';c.title='유나 · 루나의 말을 끊는다';}
 t+=duration+.35;if(i===4)t-=1.8;
 });
 const dreamEnd=M.round(t+1.2),homeStart=dreamEnd+1.5;
 // Enlarge only the room; keep the floor's source pixel (y=256) at the actors' feet.
 const roomScale=1.30,roomY=-.94-(324-256)/100*roomScale;
 visual('disposal','opening-disposal-clean',0,homeStart,0,roomY,roomScale,{layer:-10});
 visual('dream-luna','opening-luna',0,homeStart,1.815,-.94,1,{facing:'left',title:'루나 · 꿈 대기 애니메이션'});
 visual('yuna','opening-yuna',0,homeStart,.92,-.94,1,{facing:'right'});
 // Frame the midpoint of the two actors, with headroom for the interruption bubble.
 const dreamCam={x:(p.actors.yuna.x+p.actors['dream-luna'].x)/2,y:-.05,w:4.8};p.camera={...dreamCam};
 cam(0,dreamEnd,dreamCam,dreamCam,'꿈 · 폐기처리장 고정 구도');
 fx(0,2.2,'fadeIn');fx(0,homeStart,'noise',.18,'grain');fx(0,homeStart,'vignette',.5,'vignette');
 fx(dreamEnd-1,1,'noise',.5,'scan');fx(dreamEnd-1,2.5,'fadeOut');
 put('audio',0,{track:'dream-audio',assetId:'opening-drone',duration:homeStart,volume:.22,loop:true,fadeIn:2.2,fadeOut:3,title:'기억 · 낮은 잔향'});
 const wake=homeStart+2.75,phoneStart=homeStart+5,houseEnd=phoneStart+40;
 p.chapters.push({name:'집 · 알람 / 암전 후 기상',time:homeStart},{name:'크리스 · 통화',time:phoneStart});
 visual('house','opening-home',homeStart,houseEnd-homeStart,0,-5.4,4,{layer:-10});
 const homeCam={x:5,y:-1.2,w:15};
 cam(homeStart,houseEnd-homeStart,homeCam,homeCam,'집 · 알람부터 통화까지 고정 구도');
 fx(homeStart,.8,'fadeIn');
 fx(homeStart,houseEnd-homeStart,'vignette',.22,'vignette');
 // Swap two static poses precisely at full black, with no position/rotation interpolation.
 visual('home-luna','opening-luna-home',homeStart,wake-homeStart,7.95,-2.75,3.4,{rotation:-90,title:'루나 · 평상복 수면 자세',facing:'right',loop:false});
 visual('home-luna','opening-luna-home',wake,houseEnd-wake,7.3,-3.15,3.4,{rotation:0,title:'루나 · 평상복 기상 대기',facing:'right'});
 fx(wake-.35,.35,'fadeOut');fx(wake,.5,'fadeIn');
 put('audio',homeStart,{track:'room-audio',assetId:'opening-room',duration:houseEnd-homeStart,volume:.15,loop:true,fadeIn:.8,fadeOut:3,title:'집 · 실내 공기'});
 put('audio',homeStart+.8,{track:'alarm-audio',assetId:'opening-alarm',duration:3.6,volume:.55,loop:true,fadeIn:.12,fadeOut:.5,title:'알림 · 기상'});
 t=phoneStart+.8;
 PHONE.forEach(([a,text])=>{const remote=a==='phone',duration=Math.max(3.2,text.length/11+1.4);line('home-luna',t,remote?'[c:#50d9f5]'+text+'[/c]':text,'phone-lines',duration,{title:(remote?'크리스 · 연락':'루나')+' · '+text.slice(0,20),speaker:remote?'크리스':'루나',remote,wait:true,offset:1.05,offsetX:0,bubbleWidth:5.2,fontScale:170});t+=duration+.45;});
 const finish=M.round(t+2);
 // Extend late clips to the actual final dialogue; timing follows the text length.
 for(const c of p.clips)if(['house','phone'].includes(c.track)||c.track==='home-luna'&&c.start===wake||c.track==='room-audio'||c.track==='vignette'&&c.start===homeStart||c.type==='camera'&&c.start===homeStart)c.duration=finish-c.start;
 delete p.actors.phone;p.visibleActors=p.visibleActors.filter(id=>id!=='phone');p.tracks=p.tracks.filter(tr=>tr.id!=='phone');
 fx(finish-2,2,'fadeOut');
 p.duration=finish;p.openingNotes='폐기물처리장 → 크리스 집 알람 → 짧은 암전 후 기상 → 통화. TV 다큐는 별도 템플릿으로 분리. 기상은 암전 중 수면/기립 자세 교체이며 위치·회전 보간이나 TV 줌아웃 없음. 연구소 배경 1.30배, 두 인물 중앙에 화면 폭 4.8로 고정. 화자 머리 위 말풍선 유지. 집에서는 평상복 루나 대기 애니메이션 사용. 크리스 연락은 루나 위 검정 테두리·시안 글자 말풍선. 통화 대사는 키 입력으로 한 줄씩 진행. 경로 안내 카드 없음. 소리는 임시 리소스.';
 K.hydrate(p);return p;
}
function documentary(){
 const p={format:'unknown-cutscene',version:1,template:'documentary',name:'TV 다큐 · 인공생명체의 역사',background:'stage',duration:160,camera:{x:0,y:0,w:9.6},actors:{tv:{name:'TV 다큐',x:0,y:-2.7,facing:'left',asset:true}},visibleActors:['tv'],tracks:[],clips:[],assets:[],source:'https://app.notion.com/p/3f51612298dc807e996bd9abe58e89b2',chapters:[]};
 for(const [id,type,name]of [['tv','visual','다큐 이미지'],['tv-lines','dialogue','다큐 자막'],['camera','camera','고정 카메라'],['fx','fx','등장 / 종료'],['scan','fx','방송 주사선'],['audio','audio','앰비언스']])p.tracks.push({id,type,name,height:48,muted:false});
 const put=(type,start,o)=>{const c=M.clip(type,M.round(start),o);p.clips.push(c);return c;};
 let t=1;const starts=[];
 TV.forEach(text=>{starts.push(M.round(t));const duration=M.round(Math.max(3.3,text.length/12+1.4));put('dialogue',t,{track:'tv-lines',actor:'tv',text,title:text.slice(0,24),duration,wait:true,cps:24,layout:'documentary',fontScale:175,textEffect:'typewriter'});t+=duration+.16;});
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
function dialogue(g,c,s,cam,time,waitAge=0,revealed=false,held=false){
 if(!['tv','documentary'].includes(c.layout))return false;
 const a=s.actors[c.actor];if(!a?.active)return true;
 const k=1280/cam.w,asset=media.assets.get(a.assetId),screenW=asset.fw/asset.ppu*a.scale,screenH=asset.fh/asset.ppu*a.scale,x=640+(a.x-cam.x)*k,y=360-(a.y-cam.y)*k;
 g.save();g.translate(x,y);g.rotate(a.rotation*Math.PI/180);g.scale((a.facing==='right'?-1:1)*(a.flipX?-1:1),1);g.translate(-screenW*k/2,-screenH*k);g.scale(k,k);g.beginPath();g.rect(0,0,screenW,screenH);g.clip();
 // World-space layout: no camera-dependent wrapping or screen-edge nudging.
 const centered=c.layout==='documentary',padding=centered?.8:.16;
 const {parsed,glyphs,height}=StudioTypography.layout(g,{...c,fontScale:c.fontScale*(centered?1:.625)},Math.max(.1,screenW-padding),1),h=Math.max(height+(centered?.28:.075),screenH*(centered?.18:asset.captionBand||0)),top=screenH-h-(centered?.18:0);
 const count=c.textEffect==='instant'||revealed?parsed.chars.length:StudioTags.count(parsed,Math.max(0,time-c.start)+waitAge,c.cps);
 g.fillStyle=centered?'rgba(5,10,16,.72)':'rgba(2,8,14,.96)';
 if(centered){g.beginPath();g.roundRect(.28,top,screenW-.56,h,.08);g.fill();g.strokeStyle='rgba(175,194,203,.28)';g.lineWidth=.008;g.stroke();}else g.fillRect(0,top,screenW,h);
 g.textBaseline='alphabetic';const rowWidths=new Map();
 for(const ch of glyphs)rowWidths.set(ch.y,Math.max(rowWidths.get(ch.y)||0,ch.x+ch.width));
 for(const ch of glyphs){if(ch.i>=count)continue;g.font=ch.font;g.fillStyle=ch.color||'#f1f4ef';g.fillText(ch.ch,(centered?(screenW-rowWidths.get(ch.y))/2:.08)+ch.x,top+(h-height)/2+ch.y);}
 if(c.wait&&held&&count>=parsed.chars.length)W.LunaDialogueCue.draw(g,{right:screenW-(centered?.4:.08),bottom:top+h-.06,size:.18,clock:time+waitAge});
 g.restore();return true;
}
W.StudioOpening={register,template,documentary,dialogue,source:{dream:DREAM,tv:TV,phone:PHONE}};
})(window);
