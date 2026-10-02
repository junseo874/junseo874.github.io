// Current optional exterior content. Main-story commutes/terrace are separate.
// Source: Notion 외부 이야기, edited 2026-10-02. Empty day sections add no events.
(function(g){
'use strict';
const source={url:'https://app.notion.com/p/3df1612298dc8008bc34da446a92d2d2',lastEdited:'2026-10-02T13:16:38.273Z'};
const pair='outside_day0_port_pair',poster='outside_day0_shiba_wanted';
const rows=(id,lines)=>lines.map(([actor,text,en],i)=>({type:'say',actor,text,en,sourceId:id+'_'+(i+1)}));
g.LUNA_OUTSIDE_DIALOGUES={
 [pair]:rows(pair,[
  ['bar-pair-left','저기 언노운에 불 켜져 있는데? 영업 다시 시작하는 건가?','The lights are on at Unknown. Are they opening again?'],
  ['bar-pair-right','아직 그런 말은 없었는데. 그냥 잠깐 켜 둔 거 아니야?','I haven’t heard anything. Maybe they just turned them on for a bit?'],
  ['bar-pair-left','하긴… 전에 운영하던 영감이 없는데. 다시 시작할 리가 없지.','True… The old man who ran it is gone. No way they’re opening again.'],
  ['bar-pair-left','그래도 다시 열었으면 좋겠네. 그만한 가게는 다시 생길 것 같지 않단 말이지.','Still, I wish they would. I don’t think we’ll get another place like that.'],
  ['bar-pair-right','…그러게 말이야.','…Yeah. Me too.']
 ]),
 [poster]:rows(poster,[
  ['sign','지명수배. 이름: 개시바.','WANTED. Name: Gaeshiba.'],
  ['sign','공공질서 혼란, 공무집행 방해, 사기, 무전취식, 인종차별…','Disturbing public order, obstructing official duties, fraud, dining and dashing, racial discrimination…'],
  ['sign','…의 혐의로 수배 중이오니 발견하시면 1119로 연락 주세요.','…Wanted on these charges. If spotted, please call 1119.'],
  ['sign','- 코라테크 치안관리부 -','— CoraTech Public Security Department —']
 ])
};
const events=[
 {id:pair,label:'0일차 퇴근길 · 포트 가게 앞 NPC 대화',day:0,flow:'out',auto:true,kind:'pair'},
 {id:poster,label:'상시 · 개시바 지명수배 포스터',persistent:true,auto:false,kind:'object',title:'지명수배',object:'wanted-poster',node:'5 poster_shiba_wanted_day1',x:-1.9849996,y:-.7}
];
const active=(m,e)=>m.scene==='street'&&!m.level&&(e.persistent?m.config.day>=0&&m.config.day<=3:m.config.day===e.day&&m.config.flow===e.flow);
// Keep original atlases for animation QA, but retired street props never render.
const retired=new Set(['1 experiment_recruit','3 poster_help_wanted','7 poster_human_trafficking','10 real_estate_posting']);
g.LunaOutsideContent={source,events,active,
 targets:m=>events.filter(e=>e.kind==='object'&&active(m,e)).map(e=>({id:e.object,source:e.id,nodeName:e.node,label:e.title+' 살펴보기',x:e.x,y:e.y})),
 visibleNode:(m,n)=>!retired.has(n.name)&&(!events.some(e=>e.node===n.name)||events.some(e=>e.node===n.name&&active(m,e)))
};
})(typeof window==='undefined'?globalThis:window);
