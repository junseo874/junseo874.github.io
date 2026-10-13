// Compile a separate story pack. Never rewrite A or the shared manufacturing rules.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const actors={'루나':'luna','크리스':'chris','포트':'port','아일리':'aili','삼호':'samho','톰':'tom','조니':'johnny','유나':'yuna','개시바':'shiba','시바견':'shiba'};
const names=Object.fromEntries(Object.entries(actors).map(([n,id])=>[id,n]));
const raw=[0,1,2,3].map(i=>fs.readFileSync(path.join(__dirname,`version-b-day${i}.notion.txt`),'utf8'));
const plain=t=>t.replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]*>/g,'').replace(/\*\*/g,'').replace(/\\([~\[\]])/g,'$1');
const sections=(day,start,end)=>{const t=raw[day],i=t.indexOf(start);assert(i>=0,start);const j=end?t.indexOf(end,i+start.length):t.length;return plain(t.slice(i+start.length,j<0?t.length:j));};
const choices=[];
function parse(text,key){
 const out=[];let actor=null,buf=[],when=null,currentChoice=null,serial=0;
 const flush=()=>{if(actor&&buf.length)out.push({type:'say',actor,who:names[actor],text:buf.join('\n').trim(),...(when?{when}:{})});buf=[];actor=null;};
 const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const l=lines[i].trim();if(!l||l==='본문'||l==='영업 준비')continue;
  if(actors[l]){flush();actor=actors[l];continue;}
  if(/^#\s*선택지\s*(등장|제공)/.test(l)){
   flush();currentChoice=`story_b_${key}_${++serial}`;const row={type:'choice',actor:'luna',arg:currentChoice,options:[]};out.push(row);
   while(i+1<lines.length){const n=lines[i+1].trim();if(!n){i++;continue;}const m=n.match(/^(\d+)\.\s*(.*)$/);if(!m)break;i++;row.options.push({seq:+m[1],text:m[2]});choices.push({context:currentChoice,seq:m[1],'text.ko':m[2],'text.en':m[2],effects:key==='day0'?`flag.day0_skip_tutorial = ${m[1]==='2'}`:`flag.${currentChoice} = ${m[1]==='1'}`,row_id:currentChoice+'_'+m[1]});}
   assert(row.options.length===2,currentChoice);when=key==='day0'?'!flag.day0_skip_tutorial':null;continue;
  }
  if(/^(#\s*선택지.*공통|공통 진행)/.test(l)){flush();when=null;continue;}
  const branch=l.match(/^#\s*선택지\s*([12])\s*[:：]/);
  if(branch){flush();when=key==='day0'?(branch[1]==='2'?'flag.day0_skip_tutorial':'!flag.day0_skip_tutorial'):`${branch[1]==='1'?'':'!'}flag.${currentChoice}`;continue;}
  if(/^(#\s*)?주문한.*다른 경우/.test(l)){flush();when='!order_match';continue;}
  if(/^\(?주문한.*완성된 경우/.test(l)){flush();when='order_match';continue;}
  if(l.startsWith('#')||l==='—'||l.startsWith('---')){flush();continue;}
  if(l.startsWith('—회상')){flush();out.push({type:'stage',text:l});continue;}
  if(l.startsWith('(')&&l.endsWith(')')&&!(['luna','johnny'].includes(actor)&&buf.length===0&&!/(등장|입장|퇴장|제조|제공|튜토리얼|화면|회상|확인한다|디스플레이를|둘러본다|인디케이터|소리|종료|모션|장착)/.test(l))){flush();out.push({type:'stage',text:l,...(when?{when}:{})});continue;}
  if(actor)buf.push(l);
 }
 flush();return out;
}
function compileBar(rows,day,opening=false){
 const out=[],seated=new Map();let orderActor=null;
 const add=(type,actor='',arg='',extra={})=>out.push({type,actor,arg,...extra});
 const enter=(actor,extra={})=>{if(!['chris','port','aili','tom','samho','shiba'].includes(actor)||seated.has(actor))return;const seat=actor==='chris'||day===3&&['aili','samho'].includes(actor)?'R':'L';for(const [a,s] of seated)if(s===seat){add('exit',a);seated.delete(a);}add('enter',actor,seat,extra);seated.set(actor,seat);};
 const craft=(actor,id,tutorial='')=>{enter(actor);add('coaster',actor);add('order',actor,'exact:'+id,actor==='shiba'?{payment:'none'}:{});add('craft',actor,tutorial);add('serve',actor);};
 if(day===0)enter('chris',{entrance:'seated',effects:'flag.d1_tutorial_retry = false'});
 for(const row of rows){const t=row.text||'';
  if(row.type==='stage'){
   if(day===0){
    if(t.includes('주변을 둘러본다'))add('tutorial','chris','seatExplore',{when:row.when});
    else if(t.includes('좌석 인디케이터 알림'))add('tutorial','chris','seatIndicator',{when:row.when});
    else if(t.includes('루나가 코스터를 제공'))add('coaster','chris','tutorial',{when:row.when});
    else if(t.includes('출입문이 열리고 포트'))enter('port');
    else if(t.includes('진토닉 제조 시작')){add('order','chris','exact:gin_tonic');add('craft','chris','tutorial_recipe');add('serve','chris');}
    else if(t.includes('진 피즈 제조 시작'))craft('port','gin_fizz');
    continue;
   }
   if(opening&&t.includes('병맥주 따기 튜토리얼')){craft('chris','bottle_beer','tutorial_beer');continue;}
   if(/제조.*제공|샴페인을 잔에 따라 제공/.test(t)){
    if(day===1)craft(orderActor,orderActor==='shiba'?'bottle_beer':orderActor==='tom'?'dry_martini':'champagne');
    if(day===2){if(orderActor==='samho'){add('campaign_menu','samho');craft('samho','@selected');}else craft('port','bottle_beer');}
    if(day===3)craft(orderActor,orderActor==='tom'?'johnny_old_fashioned':'bottle_beer');continue;
   }
   if(/톰&삼호 퇴장/.test(t)){for(const a of ['tom','samho']){add('exit',a);seated.delete(a);}continue;}
   for(const [n,a]of Object.entries(actors))if(a!=='luna'&&t.includes(n)){
    if(new RegExp(n+' ?(등장|입장)').test(t))enter(a);
    if(new RegExp(n+' ?퇴장').test(t)){add('exit',a);seated.delete(a);}
   }
   continue;
  }
  if(row.type==='say'){
   enter(row.actor);if(['shiba','tom','aili','port','samho'].includes(row.actor))orderActor=row.actor;
   if(day===1&&t.includes('내 이름이야, 톰'))row.effects='flag.tom_name_known = true';
   if(day===3&&row.actor==='aili'&&t.includes('각설탕 배달'))row.effects='flag.day3_sugar_received = true';
   if(day===0&&t.includes('어디서 달라졌는지 확인해보겠습니다'))row.effects='flag.d1_tutorial_retry = true';
   if(day===0&&t.startsWith('제게 다른 재능')){for(const type of ['order','craft','serve'])add(type,'chris',type==='order'?'exact:gin_tonic':'',{when:'flag.d1_tutorial_retry',...(type==='serve'?{effects:'flag.d1_tutorial_retry = false'}:{})});}
  }
  out.push(row);
 }
 if(day===0)add('end_part','luna');
 return out;
}
const data={version:'B',source:'https://app.notion.com/p/3ef1612298dc8016864be134bcc832e8',actors,opening:{},bar:{},scenes:{},choices};
data.day0Steps=compileBar(parse(sections(0,'### 바 · 튜토리얼과 첫 손님','### 크리스의 집'),'day0'),0);
data.day0Bar=data.day0Steps.filter(r=>r.type==='say');
for(const day of [1,2,3]){
 data.opening[day]=compileBar(parse(sections(day,'### 오픈 전',day===3?'### 1부':'### 단골 손님').split('맥주 만들기 튜토리얼')[0],`open${day}`),day,true);
 data.bar[day]=compileBar(parse(sections(day,day===3?'### 1부 · 약속한 손님':'### 단골 손님 영업',day===1?'### 영업 후':day===2?'### 크리스의 집':'## 테라스 대화'),`bar${day}`),day);
}
const speech=rows=>rows.filter(r=>r.type!=='stage');
function memorySplit(rows,start,end,memoryKey){const before=[],memory=[],after=[];let phase=0;for(const r of rows){if(r.type==='stage'){if(r.text.includes(start))phase=1;else if(r.text.includes(end))phase=2;continue;}(phase===0?before:phase===1?memory:after).push(r);}assert(before.length&&memory.length&&after.length,memoryKey);before.at(-1).cinemaAfter='terrace-memory';before.at(-1).memoryKey=memoryKey;data.scenes[memoryKey]=memory;return [...before,...after];}
data.scenes.night0=memorySplit(parse(sections(0,'### 크리스의 집 · 테라스 대화','### 다음 일차'),'night0'),'짧은 회상','회상 컷씬 종료','terraceMemory');
data.scenes.night1=speech(parse(sections(1,'### 크리스의 집 · 테라스 대화','</content>'),'night1'));
for(const row of data.scenes.night1)row.text=row.text.replace(/\[([^\]]+)\]/g,(_,s)=>{row.emphasis=s.split(',').map(s=>s.trim());return s;});
for(const day of [2,3])data.scenes['commute'+day]=speech(parse(sections(day,'### 출근 전','### 오픈 전'),'commute'+day));
const memory2=parse(sections(2,'### 크리스의 집 · 테라스 대화 시작 직후 + 조니의 기억','### 크리스의 집 · 테라스 대화 ( 재료 보유 O )'),'memory2');
const first=memory2.findIndex(r=>r.actor==='tom');data.scenes.memoryLead=speech(memory2.slice(0,first));data.scenes.johnny=speech(memory2.slice(first));
let served=false;for(const row of data.scenes.johnny){if(row.actor==='johnny'&&row.text.startsWith('한 번 마셔보게'))served=true;row.tomPresent=true;row.served=served;}
data.scenes.night2=speech(parse(sections(2,'### 크리스의 집 · 테라스 대화 ( 재료 보유 O )','---'),'night2'));
data.scenes.night2=[...data.scenes.memoryLead.map((r,i)=>({...r,...(i===data.scenes.memoryLead.length-1?{cinemaAfter:'johnny-memory'}:{})})),...data.scenes.night2];
data.scenes.ending=memorySplit(parse(sections(3,'## 테라스 대화','<details>'),'ending'),'—회상—','—회상 끝','terraceMemory3');
data.scenes.workshop=[];
for(const [day,count]of [[1,3],[2,2],[3,2]])assert.equal(data.bar[day].filter(r=>r.type==='craft').length,count,`Day ${day} orders`);
assert.equal(data.opening[1].filter(r=>r.type==='craft').length,1);
// Source snapshots are deliberately unchanged; only a generated B pack is emitted.
fs.writeFileSync(path.join(root,'campaign-story-b.js'),'/* Separate Notion story B. Generated by tools/build_story_b.cjs. */\nwindow.LUNA_CAMPAIGN_STORY_B='+JSON.stringify(data,null,2)+';\n');
console.log('STORY_B',Object.fromEntries(Object.entries(data.bar).map(([d,r])=>[d,r.length])),choices.length,'options');
