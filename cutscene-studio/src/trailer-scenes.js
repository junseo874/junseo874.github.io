/* Promotional presentation only. Not a campaign dataset or an engine CSV type. */
(function(W){'use strict';
const scenes=[];
function add(kind,duration,title,extra={}){scenes.push({kind,duration,title,...extra});}
function card(text){add('card',3,text,{text});}
function clip(file,title,duration,montage,offset=0){add('video',duration,title,{file,montage,offset});}
add('terrace',5,'테라스 · 야경',{silent:true,panDuration:2,montage:'arrival'});
clip('team','심청단',6,'arrival');
clip('seoul-puddle','서울 거리 · 물웅덩이',5.1,'arrival');
clip('street-run','서울 거리 · 달리는 루나',6,'arrival');
add('identity',5,'루나 · 정체 글리치',{text:'바 ‘언노운’의 바텐더, 루나',alternate:'휴머노이드 실험체, LUNA-1185'});
add('bar',4,'크리스 · 시작',{actor:'chris',text:'그럼, 시작해 보자고. 루나.'});
card('당신이 선택한 한잔');
clip('ingredients','재료 담기',2,'craft');
add('open',2,'병따기',{montage:'craft'});
clip('pour-soda','따르기',2,'craft');
clip('stir','스터',2,'craft',.3);
clip('shake','쉐이킹',2,'craft',.5);
add('serve',3.3,'칵테일 제공 · 드라이 마티니로 마무리',{montage:'craft'});
card('바를 찾는 손님들');
for(const [actor,name,drink,glassEmpty,line] of [
 ['port','포트','gin_fizz',false,'어때, 내가 한번 재밌는 이야기 좀 해 줄까?'],
 ['aili','아일리','cosmopolitan',false,'안녕, 예쁜이! 일 잘하고 있었어?'],
 ['tom','톰 거너','dry_martini',true,'아, 처음 보는 얼굴이네. 안녕.'],
 ['samho','삼호','godfather',false,'어이! 이봐, 나 기억해?'],
 ['shiba','개시바','bottle_beer',true,'주문 안 받을 거야?'],
 ['bubi','부비','kahlua_milk',true,'야옹.'],
 ['haru','송하루','champagne',false,'예쁘고 잘생긴 사람들은 뭘 해도 다 되잖아.']
])add('bar',2,name,{actor,drink,glassEmpty,text:line,montage:'guests'});
card('당신이 만들어 가는 이야기');
for(const [npc,name] of [['boss','갱두목'],['believer','기신교 신도'],['newspaper','신문 읽는 남자'],['shiba','시바견']])
 add('outside',2,'거리의 인연 · '+name,{npc,montage:'outside'});
clip('boobi','부비 · 박스에서 등장',2,'outside',.5);
clip('yuna-memory','유나와 루나 · 폐기물 처리소의 기억',2,'outside');
add('terrace',3,'크리스 · 마지막 질문',{actor:'chris',text:'...앞으로 어떻게 하고 싶은거지?',montage:'terrace-ending',speechDelay:.65});
add('terrace',2.5,'루나 · 저는...',{actor:'luna',text:'저는...',montage:'terrace-ending'});
let total=0;for(const s of scenes){s.start=total;total+=s.duration;s.end=total;}
W.LunaTrailerSequence={scenes,total,emotions:['기쁨','슬픔','짜증','분노','공포','욕망','사랑','희망']};
})(window);
