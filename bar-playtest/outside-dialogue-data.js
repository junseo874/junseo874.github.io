// Current optional exterior content. Main-story commutes/terrace are separate.
// Source: Notion 외부 이야기, edited 2026-10-02. Empty day sections add no events.
(function(g){
'use strict';
const source={url:'https://app.notion.com/p/3df1612298dc8008bc34da446a92d2d2',lastEdited:'2026-10-02T18:19:00.861Z'};
const pair='outside_day0_port_pair',poster='outside_day0_shiba_wanted',trade='outside_day1_samho_smuggler';
const rows=(id,lines)=>lines.map(([actor,text,en],i)=>({type:'say',actor,text,en,sourceId:id+'_'+(i+1)}));
g.LUNA_OUTSIDE_DIALOGUES={
 // 행인 대사 1: source checked 2026-10-02T18:33:54.151Z; other sections unchanged.
 outside_day0_store_passers:rows("outside_day0_store_passers",[
  [
    "store-pair-left",
    "다시 잠잠해진 줄 알았는데 요즘 또 왜 이러는 거야?",
    "I thought things had quieted down. What’s going on again lately?"
  ],
  [
    "store-pair-right",
    "너 못 들었어?",
    "You haven’t heard?"
  ],
  [
    "store-pair-left",
    "뭘?",
    "Heard what?"
  ],
  [
    "store-pair-right",
    "이번에 코라테크 연구소 하나 털렸잖아.",
    "One of CoraTech’s labs got hit recently."
  ],
  [
    "store-pair-left",
    "그게 무슨 상관인데?",
    "What’s that got to do with it?"
  ],
  [
    "store-pair-right",
    "소문이긴 한데, 거기서 비밀리에 연구하던 강력한 군용 실험체가 송파구 쪽으로 넘어왔다고 하던데?",
    "It’s just a rumor, but apparently some powerful military test subject they were secretly working on there has made its way into Songpa."
  ],
  [
    "store-pair-left",
    "…너 요즘 판타지 BD 보냐?",
    "…You been watching fantasy BDs lately?"
  ],
  [
    "store-pair-right",
    "지랄. 말해 줘도 안 믿네.",
    "Bullshit. I tell you, and you still don’t believe me."
  ]
]),
 outside_day0_building_residents:rows('outside_day0_building_residents',[
  ['resident-left','…또 올렸다고?','…They raised it again?'],
  ['resident-right','그렇다니까.','That’s what I’m saying.'],
  ['resident-right','거기다 이젠 승강기 이용할 때마다 돈을 받겠다는 말까지 했다고.','They even said they’d start charging us every time we use the elevator.'],
  ['resident-left','하… 진짜 그렇게 바뀌면 관리인 새끼 죽여 버린다.','Fuck… If they really do that, I’ll kill that bastard.']
 ]),
 [pair]:rows(pair,[
  ['bar-pair-left','저기 언노운에 불 켜져 있는데? 영업 다시 시작하는 건가?','The lights are on at Unknown. Are they opening again?'],
  ['bar-pair-right','아직 그런 말은 없었는데. 그냥 잠깐 켜 둔 거 아니야?','I haven’t heard anything. Maybe they just turned them on for a bit?'],
  ['bar-pair-left','하긴… 전에 운영하던 영감이 없는데. 다시 시작할 리가 없지.','True… The old man who ran it is gone. No way they’re opening again.'],
  ['bar-pair-left','그래도 다시 열었으면 좋겠네. 그만한 가게는 다시 생길 것 같지 않단 말이지.','Still, I wish they would. I don’t think we’ll get another place like that.'],
  ['bar-pair-right','…그러게 말이야.','…Yeah. Me too.']
 ]),
 [trade]:rows(trade,[
  ['trade-smuggler','…그 정도 스펙이면 웬만한 놈들은 상대도 안 될걸.','…With specs like that, most people wouldn’t stand a chance.'],
  ['trade-samho','확실히… 그럴 것 같긴 해.','Yeah… I suppose you’re right.'],
  ['trade-smuggler','그럼 빨리 의뢰부터 처리하라고.','Then hurry up and finish the job.'],
  ['trade-smuggler','내가 알기론 지금 네 상황에서 그 의뢰 말고는 대금을 치를 방법이 없는 걸로 아는데.','As far as I know, that job is your only way to pay, given your situation.'],
  ['trade-samho','…사람 뒷조사도 하는 거야?','…You run background checks on people too?'],
  ['trade-smuggler','그런 것도 우리 일에 포함되니까. 클클.','That’s part of our work too. Heh heh.'],
  ['trade-samho','돈 떼먹을 일은 없으니까 걱정하지 마.','I’m not going to stiff you, so don’t worry.'],
  ['trade-smuggler','그래. 기간 안에만 주면 우리도 귀찮게 하지 않을 거라고.','Good. Pay on time, and we won’t bother you.']
 ]),
 [poster]:rows(poster,[
  ['sign','지명수배. 이름: 개시바.','WANTED. Name: Gaeshiba.'],
  ['sign','공공질서 혼란, 공무집행 방해, 사기, 무전취식, 인종차별…','Disturbing public order, obstructing official duties, fraud, dining and dashing, racial discrimination…'],
  ['sign','…의 혐의로 수배 중이오니 발견하시면 1119로 연락 주세요.','…Wanted on these charges. If spotted, please call 1119.'],
  ['sign','- 코라테크 치안관리부 -','— CoraTech Public Security Department —']
 ])
};
// TV 뉴스 1: Notion checked 2026-10-02T18:49:00.035Z; no other source sections changed.
g.LUNA_OUTSIDE_DIALOGUES.outside_day0_tv_news1=rows('outside_day0_tv_news1',[
  [
    "tv",
    "…이라고 발표했습니다.",
    "…the announcement stated."
  ],
  [
    "tv",
    "다음 소식입니다. 북한산 인근에 위치한 코라테크 연구 시설에서 발생한 화재가 주변으로 번져 산불이 일어났다고 합니다.",
    "In other news, a fire at a CoraTech research facility near Bukhansan has reportedly spread to the surrounding area, sparking a forest fire."
  ],
  [
    "tv",
    "현재까지 보고된 인명 피해는 없지만, 인근 주민들은 연구 시설의 관리 부주의로 불이 났다고 주장하며,",
    "No casualties have been reported so far. However, nearby residents claim the fire was caused by negligence at the facility,"
  ],
  [
    "tv",
    "코라테크 측에 책임 규명과 피해 보상을 요구하고 있습니다.",
    "and are demanding that CoraTech establish responsibility and provide compensation for the damage."
  ],
  [
    "tv",
    "다음 소식입니다…",
    "Moving on to our next story…"
  ]
]);
const events=[
 {id:'outside_day0_tv_news1',label:'0일차 퇴근길 · TV 뉴스 1 · 집 안',day:0,flow:'out',scene:'home',auto:true,kind:'broadcast',title:'TV 뉴스 1'},
 {id:'outside_day0_store_passers',label:'0일차 퇴근길 · 행인 대사 1 · 편의점 앞',day:0,flow:'out',auto:true,kind:'pair'},
 {id:'outside_day0_building_residents',label:'0일차 퇴근길 · 빌딩 주민 1',day:0,flow:'out',auto:true,kind:'pair',trigger:'upper-corridor-visible'},
 {id:trade,label:'1일차 퇴근길 · 삼호와 밀수업자',day:1,flow:'out',auto:false,kind:'pair'},
 {id:pair,label:'0일차 퇴근길 · 포트 가게 앞 NPC 대화',day:0,flow:'out',auto:true,kind:'pair'},
 {id:poster,label:'상시 · 개시바 지명수배 포스터',persistent:true,auto:false,kind:'object',title:'지명수배',object:'wanted-poster',node:'5 poster_shiba_wanted_day1',x:-1.9849996,y:-.7}
];
const active=(m,e)=>m.scene===(e.scene||'street')&&(e.scene==='home'||!m.level)&&(e.persistent?m.config.day>=0&&m.config.day<=3:m.config.day===e.day&&m.config.flow===e.flow);
// Keep original atlases for animation QA, but retired street props never render.
const retired=new Set(['1 experiment_recruit','3 poster_help_wanted','7 poster_human_trafficking','10 real_estate_posting']);
g.LunaOutsideContent={source,events,active,
 targets:m=>events.filter(e=>e.kind==='object'&&active(m,e)).map(e=>({id:e.object,source:e.id,nodeName:e.node,label:e.title+' 살펴보기',x:e.x,y:e.y})),
 visibleNode:(m,n)=>!retired.has(n.name)&&(!events.some(e=>e.node===n.name)||events.some(e=>e.node===n.name&&active(m,e)))
};
})(typeof window==='undefined'?globalThis:window);
