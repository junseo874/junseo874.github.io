// Current exterior child-page additions, reviewed 2026-10-05. No legacy scenes.
(function(W){
'use strict';
const D=W.LUNA_OUTSIDE_DIALOGUES,C=W.LunaOutsideContent,R=W.LunaResidence.layout;
const say=(actor,text,extra={})=>({type:'say',actor,text,...extra});
const rows=(actors,lines)=>lines.map(([i,text])=>say(actors[i],text));
D.outside_day0_port_pair=rows(['bar-pair-left','bar-pair-right'],[
 [0,'저기 언노운에 불 켜져 있는데? 다시 영업하는 건가?'],[1,'아직 그런 얘긴 없던데. 그냥 잠깐 켜 둔 거 아니야?'],[0,'하긴… 운영하던 마스터도 없는데, 다시 열 리가 없지.'],[1,'그러고 보니 그 영감, 어떻게 됐더라?'],[0,'…기억 안 나? 갱 놈들이 다른 사람이랑 착각해서 죽였잖아.'],[1,'아… 맞다. 그놈들도 나중에 애니멀한테 털려서 해체됐었지?'],[0,'그랬지. 하여간 그 새끼들, 사람을 봐 가면서 실수를 해야 하는데 말이야.'],[1,'그래도 다시 열었으면 좋겠네. 그만한 가게가 또 생기겠어?'],[0,'…그러게 말이야.']
]);
const news='outside_day1_tv_news2',passers='outside_day1_commute_passers2';
D[news]=[
 '…최근 코라테크가 출시한 범용형 안드로이드가 논란이 되고 있습니다.',
 '해당 안드로이드는 현재 환경 미화, 운송, 하수도 정비 등의 업무에 시범 투입되고 있는데요.',
 '저소득층 시민들은 굳이 사람을 대체할 필요가 없는 업무에까지 안드로이드를 투입해 자신들의 일자리를 빼앗고 빈곤을 심화시키고 있다며 반발하고 있습니다.',
 '또한 업무에 필요한 수준을 넘어서는 지능과 성능을 갖추고 있어, 국제법으로 금지된 ‘고성능 인공지능’에 해당하는 것 아니냐는 의혹도 제기되고 있습니다.',
 '신미합중국 역시 이를 강하게 비판했습니다. 시범 운용 중인 안드로이드를 즉각 회수하고 프로젝트를 전면 폐기하지 않을 경우, 제4차 세계 대전으로 이어질 수도 있다는 경고까지 내놓았습니다.',
 '이 같은 반발의 배경에는 2056년 범용 인공지능 안드로이드가 일으킨 무력 폭동이 재발할 수 있다는 우려가 깔려 있습니다.',
 '이에 코라테크 측은 “해당 안드로이드의 인공지능 시스템은 통제하에 작동하고 있으므로 우려할 필요가 없다”며 반대 여론을 일축했으며…'
].map(t=>say('tv',t));
D[passers]=rows(['commute-pair-left','commute-pair-right'],[
 [0,'뉴스 봤냐?'],[1,'뭐, 코라테크 그 개새끼들이 만든 깡통 말하는 거야?'],[0,'그래. 그 시발 새끼들이 만든 인공지능이 무력 폭동을 일으킨 지 10년도 안 지났는데, 또 그딴 걸 내놨다니까?'],[0,'그건 둘째 치고, 우리 써 주던 곳에도 그걸 시범으로 들여놓는다더라. 이젠 나오지 말래.'],[0,'하… 곧 애도 태어나는데, 이제 어디 가서 일하냐.'],[1,'하… 좆같네. 세상이 어떻게 되려고 이러냐.']
]);
C.events.push({id:news,label:'1일차 출근길 · TV 뉴스 2 · 집 안',day:1,flow:'in',scene:'home',auto:true,kind:'broadcast',title:'TV 뉴스 2'},{id:passers,label:'1일차 출근길 · 행인 대사 2 · 엘리베이터 오른쪽',day:1,flow:'in',auto:true,kind:'pair'});
C.source.lastEdited='2026-10-04T18:31:02.264Z';
const pair=[{id:'commute-pair-left',kind:'M1',x:R.elevatorX+1.45,y:-.94,faces:'commute-pair-right',fps:3.4,phase:1},{id:'commute-pair-right',kind:'M2',x:R.elevatorX+2.15,y:-.94,faces:'commute-pair-left',fps:3.7,phase:3}];
W.LunaOutsideAmbient.placements.push(...pair);
for(const p of pair)W.LUNA_OUTSIDE_DATA.scenes.street.nodes.push({id:'ambient-'+p.id,name:p.id,x:p.x,y:p.y,z:0,sx:1,sy:1,active:true,ancestry:['Ambient'],layer:9,order:0,notionEvent:passers,ambient:{fps:p.fps,phase:p.phase},sprite:{asset:'ambient-'+p.kind,x:0,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100}});
W.LunaOutsideEncounters.cases.push({id:passers,activation:'proximity',kind:'pair',members:pair.map(p=>p.id)});

const thug='day2-corridor-thug',info='day2-thug-information',contract='day3-samho-contract',samho='contract-samho',dealer='contract-smuggler';
const n=t=>say(thug,t),l=t=>say('luna',t),s=t=>say(samho,t),d=t=>say(dealer,t);
const intro=[n('…또 만났네?'),l('…'),n('그래도 이웃인데 인사는 하고 지내자고.'),l('안녕하세요.'),n('그래, 반갑다.'),n('혹시라도 물어볼 거 있으면 물어봐. 물론 맨입으로는 힘들겠지만.')];
const infoRows={
 gang:[l('갱에 대해서 알려 주실 수 있나요?'),...['그냥 돈만 되면 뭐든 하는 인간 말종 같은 새끼들이라고 생각해.','이 동네엔 갱도 여럿 있어서 다른 동네보다 위험한 편이지.','유명한 놈들은 애니멀 갱, 하이드럭 갱, 나이트 러너 갱 정도야.','애니멀은 자기네 사람만 안 건드리면 웬만해선 문제없어.','나머지 놈들은 그냥 보이면 피하는 게 상책이고.','너같이 예쁘장한 애는 잘못 걸리면 납치돼서 어디로 팔려 갈지도 모른다고.'].map(n),l('…알려 주셔서 감사해요.')],
 coratech:[l('코라테크에 대해서 알려 주실 수 있나요?'),...['…대체 어디서 왔길래 그런 걸 물어보는 거야?','그냥 우리나라 산업은 전부 그놈들 손에 있다고 생각해.','무역, 물류, 군수, 기술 연구, 바이오… 손 안 댄 분야가 없지.','정부랑 계약 맺고 일하는 기업이라는데, 행정 업무까지 맡아서 하고 있으니.','사실상 정부나 다름없어.','하지만 그런 놈들도 이쪽 나이트타운으로는 영향력이 잘 안 닿긴 하지. 워낙 무법지대라서 말이야.'].map(n),l('…알려 주셔서 감사해요.')],
 chris:[l('크리스에 대해서 알려 주실 수 있나요?'),...['…그놈은 나도 잘 몰라.','이 동네에 들어온 지 그렇게 오래되진 않았는데, 온 지 얼마 안 돼서 갱 패거리랑 시비가 붙었거든.','그때 혼자서 일곱 놈을 상대했어. 몇은 죽고, 나머지는 반병신이 됐지.','그 뒤로 한동안은 아무도 그놈한테 말조차 못 걸었어.','그런데 어느 날 보니까 바에서 일하고 있더라고. 무슨 바람이 불었는지는 몰라도.','누구는 살아서 은퇴한 전설적인 용병이라 하고, 누구는 코라테크가 몰래 키운 암살자라 하던데.'].map(n),l('…알려 주셔서 감사해요.')]
};
const action=action=>({type:'notion-action',action});
const contractRows=[s('그렇게 돼서 의뢰는 못 할 것 같아. 미안하게 됐어.'),d('…그러면 돈은 대체 어떻게 갚을 거지? 장기를 팔아도 그만한 돈은 안 나올 텐데.'),s('못 들었나 본데, 나 이제 갱 소속이야. 이번 건 우리 보스가 먼저 갚아 주기로 했어.'),d('하. 절대 안 될 줄 알았는데, 결국 들어갔나 보군.'),d('그럼 믿고 기다리지. 의뢰는 없었던 걸로 하자고.'),s('그래. 내일 보낼 테니까 기다려.'),d('그러지.'),action('dealer-exit'),action('approach'),s('루나? 퇴근했나 보네?'),l('맞아요. 그나저나 의뢰는 잘 안된 것 같네요.'),s('음… 난 오히려 이쪽이 더 잘된 것 같아.'),say(samho,'계속 꺼림칙했거든. 그 일을 맡았으면 안 좋은 일이 생겼을지도 몰라.',{emphasis:['안 좋은 일']}),s('덕분이야, 루나. 네가 보스랑 얘기할 수 있게 도와줘서, 나도 이제 애니멀에 들어가기로 했어.'),s('물론 어디 가서 자랑할 만한 곳은 아니지만… 여긴 나이트타운이니까.'),l('전 그저 술만 만들었는걸요.'),s('하하. 그렇게 말 안 해도 돼. 너 덕분에 잘 풀린 건데, 뭐.'),s('아무튼 나도 이제 할 일이 생겨서, 먼저 가 볼게.'),s('다음에 또 놀러 갈 테니까 그때 보자!'),l('안녕히 가세요.'),action('samho-exit')];
const qaCases=[{id:'runtime:thug2',label:'2일차 출근길 · 불량배 재회',notion:thug,auto:true},{id:'runtime:thug-info',label:'2일차 출근길 · 불량배 정보 구매 (50원)',notion:info,auto:false},{id:'runtime:samho-contract',label:'3일차 퇴근길 · 삼호의 계약 종료',notion:contract,auto:true}];
const mode=m=>qaCases.find(c=>c.id===m.qa?.caseId)?.notion;
const state=m=>m.qa?(m.qa.shopProgress??={money:1000,flags:{},inventory:{}}):W.barGame.progress;
const flags=m=>m.qa?state(m).flags:W.lunaCampaign?.active?(W.barGame.progress.flags??={}):(m.notionFlags??={});
function save(m,key){flags(m)[key]=true;const c=W.lunaCampaign;if(!m.qa&&c?.active&&c.session.carry){c.session.carry.flags??={};c.session.carry.flags[key]=true;}}
const visibleThug=m=>[thug,info].includes(mode(m))||!m.qa&&m.scene==='street'&&m.level===1&&m.config.day===2&&m.config.flow==='in';
const visibleContract=m=>mode(m)===contract||!m.qa&&m.scene==='street'&&!m.level&&m.config.day===3&&m.config.flow==='out'&&!flags(m).day3_contract_done;
const tx=m=>m.qa?.25:R.homeX+.7;
const base=m=>m.qa?-.45:R.elevatorX+1.35;
function targets(m){return visibleThug(m)&&flags(m).day2_thug_done?[{id:info,x:tx(m),y:m.y,top:m.y+.4,label:'불량배'}]:[];}
function infoStart(m,target){m.story.beginRows(info,target,[{type:'notion-choice',actor:thug,text:'뭐야? 물어볼 거라도 있어?',stage:'topic'}]);return true;}
function interact(m,t){return t.id===info&&infoStart(m,t);}
function start(m,kind=mode(m)){
 if(m.encounter)return false;
 m.story.cancel();m.backgroundStory.cancel();W.outsidePlaytest?.clearInput();m.anim='idle';m.animTime=0;
 if(kind===info){save(m,'day2_thug_done');return infoStart(m,{id:info,x:tx(m),y:m.y});}
 const x=kind===contract?base(m)+.7:tx(m),to=kind===contract?x+1.0:Math.min(m.x,x-.55);
 m.encounter={kind,stage:'entering',elapsed:0,from:m.x,to,npcX:x,dealerX:base(m),alpha:1,dealerAlpha:1,camera:{x:kind===contract?x+.2:(x+to)/2,y:m.y+.65,w:4.8},cameraReady:false,target:{id:kind,x,y:m.y}};
 m.facing=kind===contract?-1:1;m.updateNear();return true;
}
function runAction(m,row){const e=m.encounter;if(e?.kind!==contract)return false;e.stage=row.action;e.elapsed=0;e.actionX=row.action==='dealer-exit'?e.dealerX:e.npcX;if(row.action==='approach')e.camera={x:(e.npcX+m.x)/2,y:m.y+.65,w:4.8};return true;}
function tick(m,dt){let e=m.encounter;
 if(![thug,contract].includes(e?.kind)){
  if(m.qa||m.encounter||m.paused||m.transition||m.ride||m.dialog||m.story.blocking)return false;
  if(visibleThug(m)&&!flags(m).day2_thug_done&&m.x>=R.homeX+.12&&m.x<=R.upperMax)return start(m,thug);
  if(visibleContract(m)&&Math.abs(m.x-(base(m)+1.7))<.8)return start(m,contract);
  return false;
 }
 e.elapsed+=dt;m.anim='idle';m.animTime+=dt;
 if(e.stage==='entering'){const p=Math.min(1,e.elapsed/.65);m.x=e.from+(e.to-e.from)*p*p*(3-2*p);if(p<1&&Math.abs(e.to-e.from)>.02)m.anim='walk';if(p===1&&e.cameraReady){e.stage='active';m.story.beginRows(e.kind,e.target,e.kind===thug?intro:contractRows);}}
 else if(['dealer-exit','approach','samho-exit'].includes(e.stage)){
  const p=Math.min(1,e.elapsed/(e.stage==='approach'?.95:1.8)),smooth=p*p*(3-2*p);
  if(e.stage==='dealer-exit'){e.dealerX=e.actionX-p*1.8;e.dealerAlpha=1-Math.max(0,(p-.7)/.3);}
  if(e.stage==='approach'){e.npcX=e.actionX+(m.x-.75-e.actionX)*smooth;}
  if(e.stage==='samho-exit'){e.npcX=e.actionX+p*2;e.alpha=1-Math.max(0,(p-.7)/.3);}
  e.target.x=e.npcX;
  if(p===1){e.stage='active';m.story.speech.index++;m.story.seek();}
 }else if(e.stage==='active'&&!m.story.speech){e.stage='leaving';e.elapsed=0;e.cameraReady=false;}
 else if(e.stage==='leaving'&&e.cameraReady&&e.elapsed>.4){save(m,e.kind===thug?'day2_thug_done':'day3_contract_done');m.encounter=null;if(m.qa){m.qa.done=true;m.qa.camera=null;}W.outsidePlaytest?.clearInput();m.updateNear();}
 return true;
}
function choiceView(m){const line=m.story.speech?.line,money=Number(state(m).money)||0;return{label:'정보 구매',money,options:line.stage==='topic'?[{id:'info-gang',label:'갱에 대해서'},{id:'info-coratech',label:'코라테크에 대해서'},{id:'info-chris',label:'크리스에 대해서'},{id:'info-cancel',label:'대화 그만하기'}]:[{id:'info-pay',label:'네. (50원)',disabled:money<50},{id:'info-cancel',label:'아니요.'}]};}
function choose(m,id){const sp=m.story.speech;if(sp?.id!==info||!sp.choice)return false;
 if(id==='info-cancel'){m.story.cancel();return true;}
 if(sp.line.stage==='topic'&&infoRows[id.slice(5)]){m.story.beginRows(info,sp.target,[{type:'notion-choice',actor:thug,text:'…맨입으로는 안 돼. 50원만 주면 알려 주지.',stage:'payment',topic:id.slice(5)}]);return true;}
 if(id!=='info-pay'||sp.line.stage!=='payment'||!infoRows[sp.line.topic]||state(m).money<50)return false;
 const progress=state(m),before=progress.money;sp.choice=false;progress.money-=50;
 if(!m.qa){const c=W.lunaCampaign;if(c?.active&&c.session.carry)c.session.carry.money=progress.money;W.barGame.log('thug_information_purchase',{topic:sp.line.topic,price:50,before,after:progress.money});W.barGame.changed();}
 m.story.beginRows(info,sp.target,infoRows[sp.line.topic]);return true;
}
function anchor(m,actor){const e=m.encounter;
 if(actor===thug)return{x:e?.kind===thug?e.npcX:tx(m),y:m.y+.43};
 if(e?.kind===contract&&[samho,dealer].includes(actor))return{x:actor===samho?e.npcX:e.dealerX,y:m.y+.44};
 return null;
}
function draw(m,sprite,ctx,position){
 const e=m.encounter;
 const idle=(kind,x,y,target,alpha=1)=>sprite({asset:'ambient-'+kind,x:Math.floor(m.time*3.6)%6*129,y:0,w:129,h:138,pivot:{x:.5,y:24/138},ppu:100},x,y,1,1,W.LunaOutsideAmbient.faceTarget(x,target),alpha);
 if(visibleThug(m)){if(!m.qa){ctx.save();ctx.beginPath();ctx.rect(-2048,-2048,position(-13.70,0).x+2048,4096);ctx.clip();}idle('M2',e?.kind===thug?e.npcX:tx(m),m.y-.24,m.x);if(!m.qa)ctx.restore();}
 if(visibleContract(m)&&(!m.qa||!m.qa.done||e?.kind===contract)){
  const x=e?.kind===contract?e.npcX:base(m)+.7,dx=e?.kind===contract?e.dealerX:base(m),stage=e?.kind===contract?e.stage:'',toward=['approach','samho-exit'].includes(stage)||e?.dealerAlpha===0?m.x:dx;
  const source=W.LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='Samho'),phase=m.time%4;
  sprite({...source.sprite,x:(phase<.3?Math.floor(phase*10)%3:0)*84},x,-.7,1,1,W.LunaOutsideAmbient.faceTarget(x,stage==='samho-exit'?x+1:toward),e?.kind===contract?e.alpha:1);
  idle('M1',dx,-.94,stage==='dealer-exit'?dx-1:x,e?.kind===contract?e.dealerAlpha:1);
 }
}
W.LunaOutsideNotion={news,passers,thug,info,contract,intro,infoRows,contractRows,qaCases,targets,interact,start,tick,action:runAction,choose,choiceView,anchor,draw,visibleThug,visibleContract};
})(window);
