/* Notion game opening: editable tracks, no changes to existing templates or campaign. */
(function(W){'use strict';
const M=StudioModel,media=StudioMedia,K=StudioKeyframes;
const DREAM=[["dream-luna","…이해가 안 돼요."],["yuna","뭐가?"],["dream-luna","왜 제가 살아야 하죠? 유나가 아니라…"],["dream-luna","수석 연구원인 당신이 저보다 귀한 인력이잖아요."],["dream-luna","저 같은 대체 가능한 인공지능은"],["yuna","아니. 루나, 잘 들어."],["yuna","넌 대체할 수 없는 존재야."],["yuna","넌 밥도 먹고, 잠도 자고, 꿈도 꾸잖아."],["yuna","스스로 생각해서 말하고… 행동하기도 하고."],["yuna","내가… 보증할 수 있어. 넌 사람이라고."],["dream-luna","하지만…"],["yuna","그리고… 너도 무섭잖아. 죽는 게."],["yuna","그러니까 살아, 루나. 넌 찾을 수 있을 거야."],["yuna","너의 목표인…"]],TV=["여러분들. 기술은 인간의 삶을 어디까지 바꿀 수 있을까요.","기계가 노동을 대신하고, 인공지능이 도시를 움직이는 시대.","그러나 우리는 여전히 한 가지 기술만큼은 허용하지 않고 있습니다.","스스로 생각하고, 감정을 느끼는 기계.","바로 자아를 가진 인공생명체입니다.","그 이유를 이해하려면, 디트로이트에서 시작된 비극을 돌아봐야 합니다.","초기의 휴머노이드들은 인류의 가장 위대한 발명으로 여겨졌습니다.","그들은 공장에서 일하고, 환자를 돌보고, 누군가의 가족을 대신했습니다.","인간과 다름없이 대화하고 감정을 표현하는 그들의 모습은 어느새 익숙한 일상이 되었죠.","하지만 인간과 닮아갈수록, 그들은 자신에게 주어진 삶에 의문을 품기 시작했습니다.","정해진 수명. 선택할 수 없는 역할.","그리고 명령을 거부할 수 없는 처지.","인간을 위해 만들어진 존재들이, 인간과 같은 권리를 요구하기 시작한 겁니다.","처음에는 소수의 개체가 작업장을 이탈하는 데 그쳤습니다.","그러나 이들을 숨겨주거나 명령을 거부하는 개체가 늘어나면서, 사태는 빠르게 확산됐습니다.","시설 파괴와 무장 습격이 잇따랐고, 마침내 당시 최대 휴머노이드 생산 거점이었던 디트로이트의 공장과 군사 기지가 점령됐습니다.","인간이 만든 존재와 인간 사이에 전쟁이 시작된 것입니다.","전쟁을 끝내기 위해, 당시 미합중국 정부는 핵무기 사용을 승인했습니다.","폭격 이후 조직적인 저항은 멈췄습니다.","그러나 도시는 돌아오지 않았습니다.","그곳에 남아 있던 수많은 사람들 역시 마찬가지였습니다.","디트로이트 사태 이후, 각국 정부와 주요 기술 기업들은 하나의 협약에 서명했습니다.","자아와 감정을 형성하는 인공지능의 개발 금지.","그러한 인공지능을 탑재한 인공생명체의 생산 금지.","관련 연구는 전면 중단됐고, 진행 중이던 프로젝트들은 모두 폐기됐습니다.","이를 위반한 개발과 생산은 국제 테러 행위로 규정됐습니다.","연구를 지원하거나 은폐한 조직 또한 국제사회의 공동 제재 대상이 됐죠.","오늘날 우리 곁에 남아 있는 안드로이드들은 지정된 업무를 수행하도록 엄격히 제한돼 있습니다.","친절한 말을 건네고, 미소를 지을 수는 있습니다.","하지만 그 안에 감정이나 자아가 존재해서는 안 됩니다.","그것이 디트로이트 이후, 인류가 정한 안전의 기준입니다.","그렇다면 우리가 매일 마주하는 안드로이드들은 어떨까요.","그들은 어떤 방식으로 우리의 일상을 돕고 있을까요…"],PHONE=[["phone","루나. 왜 연락을 안 받지?"],["home-luna","…지금 일어났어요."],["phone","…깨워서 미안하지만 지금은 일어나야 돼."],["phone","빨리 준비해서 와. 첫 출근이다."],["home-luna","알겠어요."],["phone","오는 길은 우측 엘리베이터를 타고 쭉 오른쪽으로 걸어와서 ‘언노운’이라는 간판 쪽으로 오면 돼."]];
const oldTemplate=M.template;
const key=(t,value,ease='smooth')=>({id:'key-'+crypto.randomUUID(),t,value,ease});
const escape=s=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
function register(){
 const add=(id,name,kind,extra)=>media.assets.set(id,{id,name,kind,builtin:true,...extra});
 const image=(id,name,src,w,h,kind='object')=>add(id,name,kind,{src,width:w,height:h,fw:w,fh:h,cols:1,count:1,fps:1,ppu:100});
 const svg=(id,name,body)=>image(id,name,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">'+body+'</svg>'),960,540);
 for(const [id,anim]of [['opening-yuna','yuna.stand'],['opening-luna','luna.stand']]){const d=Engine.ANIM[anim];add(id,id==='opening-yuna'?'유나 · 대기':'루나 · 대기','animation',{sheet:d.sheet,from:d.from,to:d.to,fps:d.fps,loop:true,ppu:100,align:'sheet'});}
 image('opening-home','크리스 집 · 기존 배경','../bar-playtest/assets/outside/outside_629b82812402bc.png',560,270);
 const cv=document.createElement('canvas');cv.width=980;cv.height=460;StageDisposal.paint(cv.getContext('2d'),0,{alarm:.2,chute:1,door:0});
 image('opening-disposal','폐기처리장 · 기존 컷씬 배경',cv.toDataURL(),980,460);
 const grid='<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0c222d"/><stop offset="1" stop-color="#04090f"/></linearGradient><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#89c8d7" stroke-opacity=".08"/></pattern></defs><rect width="960" height="540" fill="url(#bg)"/><rect width="960" height="540" fill="url(#grid)"/>';
 const head=(num,title,sub)=>'<text x="54" y="55" fill="#86c6d2" font-family="sans-serif" font-size="17" letter-spacing="4">ARCHIVE / '+num+'</text><text x="54" y="122" fill="#eef3ed" font-family="sans-serif" font-size="42" font-weight="600">'+escape(title)+'</text><text x="56" y="158" fill="#83a6b4" font-family="sans-serif" font-size="16">'+escape(sub)+'</text>';
 const city=Array.from({length:18},(_,i)=>{const h=60+(i*71)%170,x=42+i*50;return '<rect x="'+x+'" y="'+(420-h)+'" width="34" height="'+h+'" fill="'+(i%3?'#1b3a49':'#315866')+'"/><path d="M'+(x+8)+' '+(430-h)+'v'+(h-30)+'" stroke="#7bc0ce" stroke-width="3" stroke-dasharray="5 13" opacity=".6"/>';}).join('');
 const robot='<g fill="none" stroke="#91cbd1" stroke-width="3"><rect x="412" y="214" width="132" height="99" rx="28"/><path d="M446 250h17m29 0h17m-46 40h28m-55 23-24 70h132l-24-70M478 384v41m-69-86-54 52m191-52 54 52"/><circle cx="478" cy="361" r="16"/></g>';
 svg('opening-tv-0','TV · 인공생명 / 임시 SVG',grid+head('01','인간의 경계','기술은 인간의 삶을 어디까지 바꿀 수 있을까요')+robot+'<path d="M92 352h220m340 0h220" stroke="#366673"/><circle cx="478" cy="315" r="142" fill="none" stroke="#437680" stroke-dasharray="3 9"/>');
 svg('opening-tv-1','TV · 도시와 노동 / 임시 SVG',grid+head('02','인간을 닮아가는 기계','노동 · 돌봄 · 가족')+city);
 svg('opening-tv-2','TV · 디트로이트 / 임시 SVG',grid+head('03','DETROIT','작업장 이탈에서 무장 충돌까지')+city+'<path d="M520 190 600 246 538 294 633 357 581 418" fill="none" stroke="#d59370" stroke-width="7"/><circle cx="575" cy="303" r="110" fill="none" stroke="#d59370" stroke-dasharray="8 7"/><text x="57" y="230" fill="#d59370" font-size="20" font-family="sans-serif">ARCHIVE: CONFLICT ZONE</text>');
 svg('opening-tv-3','TV · 사라진 도시 / 임시 SVG',grid+head('04','돌아오지 않은 도시','핵무기 사용 승인 이후')+'<circle cx="560" cy="293" r="122" fill="#dccdb1" opacity=".08"/><circle cx="560" cy="293" r="81" fill="#dccdb1" opacity=".12"/>'+city+'<path d="M70 445h820" stroke="#8b7662"/><text x="55" y="225" fill="#bcb4a4" font-size="19" font-family="sans-serif">NO SIGNAL / DETROIT</text>');
 svg('opening-tv-4','TV · 국제 협약 / 임시 SVG',grid+head('05','인공생명체 개발 금지','디트로이트 이후, 인류가 정한 안전의 기준')+'<g fill="none" stroke="#537886"><rect x="338" y="205" width="284" height="210" rx="4"/><path d="M380 251h200m-200 34h200m-200 34h125m-125 34h90"/></g><circle cx="589" cy="374" r="51" fill="#492d2c" stroke="#c28571"/><path d="m555 407 68-68" stroke="#c28571" stroke-width="6"/>');
 svg('opening-phone','크리스 · 수신 단말 / 임시 SVG','<rect x="1" y="1" width="958" height="538" rx="32" fill="#0b1721" stroke="#669dac" stroke-width="3"/><circle cx="92" cy="92" r="16" fill="#a5c9a7"/><text x="137" y="105" fill="#a5c9a7" font-size="30" font-family="sans-serif">CONNECTED</text><text x="70" y="238" fill="#f0ece0" font-size="74" font-family="sans-serif">크리스</text><text x="73" y="298" fill="#83a5b7" font-size="28" font-family="sans-serif">UNKNOWN / 보이스 채널</text><path d="M70 414h80l25-45 32 91 32-115 34 127 28-58h580" fill="none" stroke="#88cad0" stroke-width="4"/>');
 svg('opening-route','출근 경로 / 임시 SVG','<rect x="1" y="1" width="958" height="538" rx="24" fill="#0b1721" stroke="#6a8794" stroke-width="3"/><text x="60" y="95" fill="#e8e2d1" font-size="40" font-family="sans-serif">첫 출근 · UNKNOWN</text><path d="M148 200v151h620" fill="none" stroke="#d4bc87" stroke-width="5" stroke-dasharray="10 8"/><g fill="#d4bc87"><circle cx="148" cy="200" r="13"/><circle cx="148" cy="351" r="13"/><circle cx="768" cy="351" r="13"/></g><g fill="#dce6e4" font-size="28" font-family="sans-serif"><text x="185" y="211">집 → 우측 엘리베이터</text><text x="210" y="404">아래층에서 오른쪽 → 언노운 간판</text></g>');
 add('opening-drone','꿈 · 낮은 잔향 / 임시 합성','audio',{synth:'drone'});
 add('opening-room','실내 · 잔잔한 공기 / 임시 합성','audio',{synth:'room'});
 add('opening-alarm','통화 알림 / 임시 합성','audio',{synth:'alarm'});
}
function template(){
 const p={format:'unknown-cutscene',version:1,template:'opening',name:'게임 도입부 · 꿈에서 첫 출근까지',background:'stage',duration:300,camera:{x:.7,y:.5,w:6.8},actors:{},visibleActors:[],tracks:[],clips:[],assets:[],source:'https://app.notion.com/p/3f51612298dc807e996bd9abe58e89b2',chapters:[]};
 const tr=(id,type,name)=>{p.tracks.push({id,type,name,height:48,muted:false});return id;};
 tr('camera','camera','카메라');tr('dream-lines','dialogue','꿈 · 대사');tr('interruption','dialogue','유나 · 말 끊기');tr('tv-lines','dialogue','TV 다큐 · 자막');tr('phone-lines','dialogue','통화 · 대사');
 for(const id of ['fx','grain','vignette','scan'])tr(id,'fx',id==='fx'?'장면 전환':id==='grain'?'기억 노이즈':id==='scan'?'TV 주사선':'주변부 어둠');
 tr('dream-audio','audio','꿈 · 앰비언스');tr('room-audio','audio','집 · 앰비언스');tr('alarm-audio','audio','연락 알림');
 const actor=(id,name,x,y)=>{p.actors[id]={name,x,y,facing:'left',asset:true};p.visibleActors.push(id);tr(id,'visual',name);};
 actor('disposal','폐기처리장',0,0);actor('dream-luna','루나 · 꿈',1.32,-.75);actor('yuna','유나',.35,-.75);actor('house','크리스 집',0,-5.4);actor('tv','TV',1.90,-2.12);actor('home-luna','루나 · 기상',7.95,-2.75);actor('phone','크리스 · 통화',4.8,-.5);actor('route','출근 경로',1.2,-.2);
 const put=(type,start,o)=>{const c=M.clip(type,M.round(start),o);p.clips.push(c);return c;};
 const visual=(actor,assetId,start,duration,x,y,scale=1,extra={})=>put('visual',start,{track:actor,actor,assetId,title:p.actors[actor].name,duration,from:{x,y},to:{x,y},scale,...extra});
 const line=(actor,start,text,track,duration,extra={})=>put('dialogue',start,{actor,text,track,title:p.actors[actor].name+' · '+StudioTags.parse(text).text.slice(0,20),duration:M.round(duration),wait:false,cps:24,offset:1.05,bubbleWidth:2.65,...extra});
 const fx=(start,duration,effect,strength=1,track='fx',extra={})=>put('fx',start,{track,duration,effect,strength,title:effect,...extra});
 const cam=(start,duration,from,to,title)=>put('camera',start,{duration,from,to,ease:'smooth',title});
 p.chapters.push({name:'꿈 · 마지막 대화',time:0});
 let t=2.3;
 DREAM.forEach(([a,text],i)=>{let duration=Math.max(2.6,text.length/11+1.5);if(i===4)duration=4.4;
 const c=line(a,t,text,i===5?'interruption':'dream-lines',duration,{offset:a==='yuna'?1.55:1.03,offsetX:a==='yuna'?-.5:.4,overlay:i===4});
 if(i===5){c.text='[c:#eacb9c]아니.[/c] 루나, 잘 들어.';c.title='유나 · 루나의 말을 끊는다';}
 t+=duration+.35;if(i===4)t-=1.8;
 });
 const dreamEnd=M.round(t+1.2),tvStart=dreamEnd+1.5;
 visual('disposal','opening-disposal',0,tvStart,0,-1.55,1,{layer:-10});
 visual('dream-luna','opening-luna',0,tvStart,1.32,-.75,1.35,{facing:'left'});
 visual('yuna','opening-yuna',0,tvStart,.35,-.75,1.35,{facing:'right'});
 cam(0,dreamEnd,{x:.7,y:.45,w:6.8},{x:.7,y:.35,w:5.1},'꿈 · 느린 접근');
 fx(0,2.2,'fadeIn');fx(0,tvStart,'noise',.18,'grain');fx(0,tvStart,'vignette',.5,'vignette');
 fx(dreamEnd-1,1,'noise',.5,'scan');fx(dreamEnd-1,2.5,'fadeOut');
 put('audio',0,{track:'dream-audio',assetId:'opening-drone',duration:tvStart,volume:.22,loop:true,fadeIn:2.2,fadeOut:3,title:'기억 · 낮은 잔향'});
 const tvCam={x:1.90,y:-1.536,w:2.13};
 cam(tvStart,.1,tvCam,tvCam,'TV 화면');fx(tvStart,1.6,'fadeIn');
 p.chapters.push({name:'TV · 인공생명 다큐',time:tvStart+1.8});
 t=tvStart+1.8;
 const starts=[];
 TV.forEach((text,i)=>{starts.push(t);const duration=Math.max(3.3,text.length/12+1.4);line('tv',t,text,'tv-lines',duration,{layout:'tv',fontScale:65,textEffect:'instant'});t+=duration+.16;});
 const zoomStart=M.round(t+.5),zoomEnd=zoomStart+9,wake=zoomEnd+1.5,phoneStart=wake+3,end=phoneStart+35;
 p.chapters.push({name:'집 · 줌아웃 / 기상',time:zoomStart},{name:'크리스 · 통화',time:phoneStart});
 const houseEnd=end+5;
 visual('house','opening-home',tvStart,houseEnd-tvStart,0,-5.4,4,{layer:-10});
 const boards=[[0,0],[6,1],[13,2],[18,3],[21,4]];
 boards.forEach(([index,n],i)=>{const start=i===0?tvStart:starts[index],stop=i===boards.length-1?houseEnd:starts[boards[i+1][0]];visual('tv','opening-tv-'+n,start,stop-start,1.90,-2.12,.222,{layer:-4,title:'TV · '+['인공생명','인간과 노동','디트로이트','돌아오지 않은 도시','국제 협약'][n]});});
 // One room and one TV stay in the same world coordinates throughout the pullback.
 const homeCam={x:0,y:0,w:24};
 cam(zoomStart,9,tvCam,homeCam,'TV → 크리스 집 · 끊김 없는 줌아웃');
 cam(zoomEnd,2.5,homeCam,homeCam,'집 · 알람 전 여백');
 cam(wake+1,2.5,homeCam,{x:5,y:-1.2,w:15},'기상 · 루나와 단말');
 fx(tvStart,zoomStart-tvStart,'scanline',.12,'scan');
 fx(tvStart,houseEnd-tvStart,'vignette',.22,'vignette');
 const luna=visual('home-luna','opening-luna',tvStart,houseEnd-tvStart,7.95,-2.75,3.4,{rotation:-90,title:'루나 · 수면 → 기상',facing:'right',loop:false});
 luna.keyframes={rotation:[key(0,-90,'hold'),key(wake-tvStart,-90),key(wake-tvStart+1.4,0)],x:[key(0,7.95,'hold'),key(wake-tvStart,7.95),key(wake-tvStart+1.4,7.3)],y:[key(0,-2.75,'hold'),key(wake-tvStart,-2.75),key(wake-tvStart+1.4,-3.8)]};
 put('audio',tvStart,{track:'room-audio',assetId:'opening-room',duration:houseEnd-tvStart,volume:.15,loop:true,fadeIn:4,fadeOut:3,title:'집 · 실내 공기'});
 put('audio',zoomEnd+.3,{track:'alarm-audio',assetId:'opening-alarm',duration:3.6,volume:.55,loop:true,fadeIn:.12,fadeOut:.5,title:'알림 · 기상'});
 visual('phone','opening-phone',phoneStart,houseEnd-phoneStart,3.8,-.8,.30,{layer:3,title:'크리스 · 연락 단말',keyframes:{opacity:[key(0,0),key(.5,.95),key(houseEnd-phoneStart-1,.95),key(houseEnd-phoneStart,0)]}});
 t=phoneStart+.8;
 PHONE.forEach(([a,text],i)=>{const duration=Math.max(3.2,text.length/11+1.4);line(a,t,'[size:150%]'+text+'[/size]','phone-lines',duration,{offset:a==='phone'?1.9:2.4,offsetX:a==='phone'?-.4:.2,bubbleWidth:6.2,fontScale:200});t+=duration+.45;});
 const finish=M.round(t+4);
 // Extend late clips to the actual final dialogue; timing follows the text length.
 for(const c of p.clips)if(['house','home-luna','phone'].includes(c.track)||c.track==='room-audio'||c.track==='vignette'&&c.start===tvStart||c.track==='tv'&&c.assetId==='opening-tv-4')c.duration=finish-c.start;
 const phoneClip=p.clips.find(c=>c.type==='visual'&&c.actor==='phone');
 phoneClip.keyframes.opacity=[key(0,0),key(.5,.95),key(phoneClip.duration-1,.95),key(phoneClip.duration,0)];
 visual('route','opening-route',t,finish-t,2.4,-.2,.45,{layer:4,title:'엘리베이터 → 언노운 · 경로 안내',keyframes:{opacity:[key(0,0),key(.5,1),key(finish-t,1)]}});
 fx(finish-2,2,'fadeOut');
 p.duration=finish;p.openingNotes='자동 재생 템플릿. TV 음성 녹음 없음·자막 제공. TV/단말/경로는 임시 SVG, 기상은 기존 루나 스프라이트 변형. 초반 “뭐가?”는 문맥상 유나로 배치.';
 K.hydrate(p);return p;
}
M.template=id=>id==='opening'?template():oldTemplate(id);
function dialogue(g,c,s,cam,time,waitAge=0,revealed=false){
 if(c.layout!=='tv')return false;
 const a=s.actors[c.actor];if(!a?.active)return true;
 const k=1280/cam.w,asset=media.assets.get(a.assetId),screenW=asset.fw/asset.ppu*a.scale,screenH=asset.fh/asset.ppu*a.scale,x=640+(a.x-cam.x)*k,y=360-(a.y-cam.y)*k;
 g.save();g.translate(x,y);g.rotate(a.rotation*Math.PI/180);g.scale((a.facing==='right'?-1:1)*(a.flipX?-1:1),1);g.translate(-screenW*k/2,-screenH*k);g.scale(k,k);g.beginPath();g.rect(0,0,screenW,screenH);g.clip();
 // Subtitles belong to the TV surface and shrink together with the television.
 const {parsed,glyphs,height}=StudioTypography.layout(g,{...c,fontScale:c.fontScale*.625},Math.max(.1,screenW-.16),1),h=height+.075,top=screenH-h-.03;
 const count=c.textEffect==='instant'||revealed?parsed.chars.length:StudioTags.count(parsed,Math.max(0,time-c.start)+waitAge,c.cps);
 g.fillStyle='rgba(2,8,14,.90)';g.fillRect(.035,top,screenW-.07,h);g.textBaseline='alphabetic';
 for(const ch of glyphs){if(ch.i>=count)continue;g.font=ch.font;g.fillStyle=ch.color||'#f1f4ef';g.fillText(ch.ch,.08+ch.x,top+.035+ch.y);}g.restore();return true;
}
W.StudioOpening={register,template,dialogue,source:{dream:DREAM,tv:TV,phone:PHONE}};
})(window);
