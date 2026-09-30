const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const put=(name,text)=>fs.writeFileSync(path.join(root,name),text);
const source=JSON.parse(fs.readFileSync(root+'/tools/campaign-notion-source.json','utf8'));
const actors={'루나':'luna','크리스':'chris','톰':'tom','아일리':'aili','포트':'port','삼호':'samho','조니':'johnny','과거의 톰':'tom','기억 속 루나':'luna','연구원':'researcher','주거층 주민':'resident','의뢰 연락 메시지':'message','삼호가 보내는 메시지':'samho','보안부 3팀 팀장':'captain','진입조｜무전':'radio','보안부 대원 A':'soldier','경계조 A｜무전':'radio'};
const clean=s=>s.replace(/\*\*/g,'').trim().replace(/한잔/g,'한 잔').replace(/할 만한 거 같아/g,'할 만한 것 같아').replace(/아직까진/g,'아직까지는').replace(/시작해보자/g,'시작해 보자').replace(/받아줘/g,'받아 줘').replace(/꺼야/g,'거야');
function section(day,start,end){const t=source.days[day];const i=t.indexOf(start);if(i<0)throw Error(start);const j=end?t.indexOf(end,i+start.length):t.length;return t.slice(i+start.length,j<0?t.length:j);}
function parse(t){let actor=null,who='',buf=[],out=[];function flush(){if(actor&&buf.length)out.push({type:'say',actor,who,text:clean(buf.join('\n'))});buf=[];}
 for(let line of t.split('\n')){line=clean(line).replace(/\s*\|\s*$/,'').trim();if(!line||line==='본문')continue;
  if(actors[line]){flush();who=line;actor=actors[line];continue;}
  if(line.startsWith('(')&&line.endsWith(')')&&!(actor==='luna'&&/^\((?:\.{0,3}퇴근|아까 본|지금 DB|이따|흠|시작|재료는|기록에서 확인한 것과 달라|돌아온 이유)/.test(line))){flush();out.push({type:'stage',text:line});actor=null;continue;}
  if(line.startsWith('#')||/^(본문|영업 준비|등장인물|진행 기준|다음 장면|게임 화면|게임 대사)/.test(line)){flush();actor=null;continue;}
  if(actor)buf.push(line);
 }
 flush();return out;
}
const speech=t=>parse(t).filter(r=>r.type==='say');
function compileBar(day){let input;if(day<3)input=section(day,'### 단골 손님 영업',day===1?'### 영업 후':'### 교대 후');else input=section(3,'### 1부 · 약속한 손님','### 귀가 후');
 // Failure is a retry screen, not dialogue on the successful path; branches stay exclusive.
 if(day===3){input=input.replace(/\*\*제조 결과가 복원 조건과 일치하지 않을 때\*\*[\s\S]*?\*\*복원 조건에 맞게 완성했을 때 · 공통 진행\*\*/,'(본편 제조 체크포인트)');
 input=input.replace(/\*\*응대 선택 · A\*\*[\s\S]*?\*\*공통 진행\*\*/,'(본편 응대 선택)');}
 const parsed=parse(input),out=[],seated=new Map();let crafted=0,chosen=false;
 const add=(type,actor='',arg='')=>out.push({type,actor,arg});
 function enter(actor){if(seated.has(actor)||!['chris','port','aili','tom','samho'].includes(actor))return;if(day===3&&actor==='chris'&&!out.some(r=>r.type==='exit'&&r.actor==='tom'))return;const seat=actor==='chris'||day===3&&actor==='samho'?'R':'L';const old=[...seated].find(([a,s])=>s===seat);if(old){add('exit',old[0]);seated.delete(old[0]);}add('enter',actor,seat);add('coaster',actor);seated.set(actor,seat);}
 function craft(actor,id){enter(actor);add('order',actor,'exact:'+id);add('craft',actor);add('serve',actor);crafted++;}
 for(const r of parsed){if(r.type==='stage'){
  const t=r.text;
  if(t.includes('본편 응대 선택')){add('campaign_response');continue;}
  if(day===1&&/제작 후 제공|칵테일 제조 후 제공/.test(t)){craft(crafted===0?'tom':'aili',crafted===0?'dry_martini':'gin_fizz');continue;}
  if(day===2&&t.startsWith('(드라이 마티니 제조')){craft('port','dry_martini');continue;}
  if(day===2&&t.includes('플레이어가 현재 만들 수 있는 메뉴')){add('campaign_menu','samho');chosen=true;continue;}
  if(day===2&&t.startsWith('(선택한 칵테일을 제조')){add('order','samho','exact:@selected');add('craft','samho');add('serve','samho');crafted++;continue;}
  if(day===3&&t.includes('본편 제조 체크포인트')){craft('tom','johnny_old_fashioned');continue;}
  for(const [name,actor] of Object.entries(actors)){if(['luna','message','johnny'].includes(actor))continue;
   if(new RegExp(name+' (퇴장|등장|입장)').test(t)){if(t.includes(name+' 퇴장')){if(seated.has(actor)){add('exit',actor);seated.delete(actor);}}else enter(actor);}
  }
  if(day===3&&t.includes('톰이 루나에게 손을 들어 보이고')){for(const actor of ['tom','samho'])if(seated.has(actor)){add('exit',actor);seated.delete(actor);}}
  continue;
 }
 if(day===1)r.text=r.text.replace('진 피즈, 진토닉, 드라이 마티니, 코스모폴리탄이 가능합니다.','진피즈, 진토닉, 드라이 마티니가 가능합니다.').replace('코스모폴리탄 돼?','진피즈 돼?');
 enter(r.actor);out.push(r);
 }
 if(crafted!== (day===3?1:2))throw Error('Missing crafts day '+day+': '+crafted);
 if(day===2&&!chosen)throw Error('Missing Samho choice');
 if(day===2)add('campaign_memory');
 return out;
}
const prologue=speech(section(0,'### 프롤로그 · 연구소','### 바 ·')).map(r=>({...r,text:r.text.replace(/\(노이즈 효과\)/g,'')}));
// Keep visual directions out of spoken copy. The last attack is a separate visual beat.
const data={source:source.source,revision:source.fetched,actors,
 prologue,opening:{},bar:{},scenes:{
  resident:speech(section(0,'### 귀가길 · 거리 탐색','### 첫 귀가')),
  night0:speech(section(0,'### 크리스의 집 · 앞으로 해볼 일','### 다음 일차')),
  workshop:speech(section(1,'### 영업 후 · 포트의 작업장','### 귀가 후')),
  night1:speech(section(1,'### 귀가 후 · 첫 번째 기억 단편')),
  commute2:speech(section(2,'### 출근 전 · 삼호와 첫 만남','### 오픈 전')),
  johnny:speech(section(2,'### 교대 후 · 조니의 기억','### 기억 확인 후')),
  prepare:speech(section(2,'### 기억 확인 후 · 내일의 준비','### 귀가 후')),
  night2:speech(section(2,'### 귀가 후 · 두 번째 기억 단편','### 집필·')),
  commute3:speech(section(3,'### 출근 전 · 외부 거리','### 오픈 전')),
  night3:speech(section(3,'### 귀가 후 · 루나 자신의 기억','## 테라스 대화')),
  ending:speech(section(3,'## 테라스 대화','### 앞선 일차')),
  responseA:speech(section(3,'**응대 선택 · A**','**응대 선택 · B**')),
  responseB:speech(section(3,'**응대 선택 · B**','**공통 진행**'))
 }};
// The ending has prose narration, not dialogue belonging to the last speaker.
data.scenes.ending=[
  {
    "actor": "narrator",
    "who": "",
    "text": "루나는 기억을 돌아보는 곳에서 벗어나 다시금 눈을 떴다. 테라스 너머 높은 빌딩들과 화려한 야경이 보였다."
  },
  {
    "actor": "chris",
    "who": "크리스",
    "text": "왜, 무슨 생각이라도 났어?"
  },
  {
    "actor": "luna",
    "who": "루나",
    "text": "…기뻤던 것 같아서요.\n지금 생각해 본 거지만."
  },
  {
    "actor": "narrator",
    "who": "",
    "text": "크리스는 잠시 허공을 보며 생각하다 말을 이었다."
  },
  {
    "actor": "chris",
    "who": "크리스",
    "text": "…그렇게 생각한다면 그런 거겠지."
  },
  {
    "actor": "narrator",
    "who": "",
    "text": "루나가 떠올린 일들이 정확히 무엇인지 크리스는 알지 못했다.\n문득 한 여자가 했던 말이 떠올랐다."
  },
  {
    "actor": "woman",
    "who": "기억 속 목소리",
    "text": "이 아이들을 그저 인공지능이라고 생각하지 마.\n너 같은 놈이랑은 달라. 얘들은… 가능성을 품고 있다고."
  },
  {
    "actor": "narrator",
    "who": "",
    "text": "화를 내듯 자신에게 쏘아붙이던 목소리였다.\n그 시절 자신은 이해하지 못한 말이었다."
  },
  {
    "actor": "narrator",
    "who": "",
    "text": "크리스는 잠시 하늘을 바라보다가 다시 도심 쪽으로 시선을 돌렸다.\n마침 어렸을 적 좋아하던 열차가 지나가고 있었다."
  },
  {
    "actor": "narrator",
    "who": "",
    "text": "크리스는 젊은 시절 품었다가 잊고 지냈던 자신의 꿈이 문득 떠올랐다.\n두 사람은 한동안 말없이 앉아 있었다."
  }
];
for(const day of [1,2,3]){data.opening[day]=speech(section(day,'### 오픈 전',day===3?'### 1부':'### 단골 손님'));data.bar[day]=compileBar(day);}
// Remove production notes between the opening dialogue and the next section.
for(const rows of Object.values(data.opening))for(const r of rows)r.text=r.text.split('오늘 추가되는')[0].split('오늘 확인할')[0].trim();
put('campaign-data.js','/* Current Notion main story. Generated by tools/build_campaign_data.cjs. Other is not a dialogue source. */\n(function(root){root.LUNA_CAMPAIGN_DATA='+JSON.stringify(data,null,2)+';})(typeof window===\'undefined\'?globalThis:window);\n');
