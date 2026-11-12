/* Promotional presentation only. Not a campaign dataset or an engine CSV type. */
(function(W){'use strict';
const scenes=[];
const names={chris:'크리스',port:'포트',aili:'아일리',tom:'톰 거너',samho:'삼호',shiba:'개시바',bubi:'부비',haru:'송하루',boss:'갱두목',believer:'기신교 신도',newspaper:'신문 읽는 노인'};
function add(kind,duration,title,extra={}){scenes.push({kind,duration,title,...extra});}
add('black',3,'빗소리 · 암전');
add('terrace',6,'테라스 · 대사 없는 진입',{silent:true});
add('video',3.9,'팀 로고',{file:'team'});
add('card',3.5,'2069년, 서울 언더타운',{text:'2069년, 서울 언더타운'});
add('video',5,'외부 거리 걷기',{file:'street'});
add('identity',5,'루나 · 정체 글리치',{text:'바 ‘언노운’의 바텐더, 루나',alternate:'휴머노이드 실험체, LUNA-1185'});
add('bar',4,'크리스 · 시작',{actor:'chris',text:'그럼, 시작해 보자고. 루나.'});
add('card',3,'저마다의 이야기를 지닌 손님들',{text:'저마다의 이야기를 지닌 손님들'});
for(const actor of ['chris','port','aili','tom','samho','shiba','bubi','haru'])add('bar',2.1,'단골 손님 · '+names[actor],{actor});
add('card',3,'당신의 선택을 담은 한 잔',{text:'당신의 선택을 담은 한 잔'});
for(const [file,name] of [['pour-gin','진'],['pour-tonic','토닉워터'],['pour-lemon','레몬주스']])add('video',2,'따르기 · '+name,{file});
add('open',3.5,'병뚜껑 따기');add('video',5,'쉐이킹',{file:'shake'});add('video',4,'스터',{file:'stir'});
add('serve',4.5,'칵테일 제공 · 8종 연결');
add('emotions',4.8,'그들에게서 학습하는 ‘[감정]’');
for(const [actor,expression] of [['aili','success'],['tom','anger'],['samho','drunk'],['port','joy'],['chris','fail']])add('bar',1.3,'표정 · '+names[actor],{actor,expression});
add('card',3,'당신의 선택으로 이어지는 이야기',{text:'당신의 선택으로 이어지는 이야기'});
for(const npc of ['boss','believer','newspaper','shiba'])add('outside',3,'거리의 인연 · '+names[npc],{npc});
add('video',5,'부비 · 박스에서 등장',{file:'boobi'});
add('black',1.2,'암전');
add('terrace',4,'크리스 · 마지막 질문',{actor:'chris',text:'…앞으로 어떻게 하고 싶은거지?'});
add('terrace',2.5,'루나 · 저는…',{actor:'luna',text:'저는…'});
add('logo',4,'프로젝트 루나 · 로고 글리치');
let total=0;for(const s of scenes){s.start=total;total+=s.duration;s.end=total;}
W.LunaTrailerSequence={scenes,total,emotions:['기쁨','슬픔','짜증','분노','공포','욕망','사랑','희망']};
})(window);
