// Scoped, repeatable data migration. All other days/art/settings are preserved.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),spec=require('./day0-notion-20261013.json');
const ctx={window:{}};for(const file of ['data.js','campaign-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const data=ctx.window.LUNA_DATA,campaign=ctx.window.LUNA_CAMPAIGN_DATA,scene='d1_tutorial_chris',choiceId='ch_day0_port_history';
const stable=d=>JSON.stringify({...d,tables:{...d.tables,steps:d.tables.steps.filter(r=>r.context!==scene),bar_choices:d.tables.bar_choices.filter(r=>!['ch_day0_notion_tutorial',choiceId].includes(r.context)),bar_choice_groups:d.tables.bar_choice_groups.filter(r=>r.choice_group!==choiceId)},source:{...d.source,webDay0Bar:undefined}});
const before=stable(data),otherCampaign=JSON.stringify({...campaign,day0Bar:undefined});
let steps=data.tables.steps.filter(r=>r.context===scene).map(r=>({...r}));
const edits={
 dlg_day0_notion_bar_3:['…그럼 이제 한번 시작해 볼까?','…Shall we get started, then?'],
 dlg_day0_notion_bar_7:['네. 준비됐습니다.','Yes. I am ready.'],
 dlg_day0_notion_bar_8:['…좋아. 한번 해 보자고.','…Good. Let’s give it a try.'],
 dlg_day0_notion_bar_29:['나쁘지 않아. 뭐… 만들기 어려운 칵테일도 아니긴 하지만.','Not bad. Well… it is not a particularly difficult cocktail.'],
 dlg_day0_notion_bar_34:['처음이니까 그럴 수 있어. 만드는 것도 익숙해지면 나아지겠지.','It is your first time. You will get better at making drinks with practice.'],
 dlg_day0_notion_bar_36:['제가요?','Me?'],
 dlg_day0_notion_bar_37:['…넌 비호감으로 여겨질 외모는 아니니까 말이지.','…You are hardly someone people would dislike on looks alone.'],
 dlg_day0_notion_bar_41:['말했잖아. 전에 사고가 터져서 반년 동안 영업을 못 했다고.','I told you. We could not open for half a year after that incident.'],
 dlg_day0_notion_bar_88:['자고로 바텐더란 칵테일에 담긴 이야기, 그 칵테일이 탄생한 배경, 그런 역사도 알아야…','A bartender ought to know the stories behind cocktails, how they came to be, all that history…']
};
for(const [id,[ko,en]]of Object.entries(edits)){const s=steps.find(r=>r.dialogue_id===id);assert(s,id);s['text.ko']=ko;s['text.en']=en;}
steps=steps.filter(r=>!['dlg_day0_notion_bar_4','dlg_day0_notion_bar_5'].includes(r.dialogue_id)&&!r.row_id.startsWith('day0_revision_20261013_'));
steps.find(s=>s.dialogue_id==='dlg_day0_tutorial_recipe_display').when='flag.day0_skip_tutorial';
steps.find(s=>s.dialogue_id==='dlg_day0_notion_bar_88').when='!flag.day0_port_history_listen';
const base=steps.find(s=>s.type==='say'),make=(id,actor,ko,en,when=null)=>({...base,actor,arg:'default','text.ko':ko,'text.en':en,when,effects:null,row_id:'day0_revision_20261013_'+id,dialogue_id:'dlg_day0_revision_20261013_'+id});
function insertBefore(id,rows){const i=steps.findIndex(s=>s.dialogue_id===id);assert(i>=0,id);steps.splice(i,0,...rows);}
insertBefore('dlg_day0_notion_bar_36',[make('chris_reassure','chris','너라면 손님들한테 호감을 얻기 쉬울 테니 약간의 실수 정도는 해도 괜찮을 거야.','Guests should warm to you easily, so a few small mistakes will be all right.')]);
insertBefore('dlg_day0_notion_bar_88',[
 make('port_invite','port','어때, 내가 한번 재밌는 이야기 좀 해 줄까?','How about I tell you an interesting story?'),
 {...base,type:'choice',actor:'luna',arg:choiceId,'text.ko':null,'text.en':null,dialogue_id:null,when:null,effects:null,row_id:'day0_revision_20261013_port_choice'},
 make('port_yes','luna','네, 듣고 싶어요.','Yes, I would like to hear it.','flag.day0_port_history_listen'),
 make('port_history','port','좋아, 그러면 알려 주지. 칵테일에 담긴 이야기, 그 칵테일이 탄생한 배경, 그런 역사에 대해서…','Good, then let me tell you. The stories behind cocktails, how they came to be, all that history…','flag.day0_port_history_listen'),
 make('port_no','luna','괜찮을 것 같아요.','I think I will pass.','!flag.day0_port_history_listen'),
 make('port_insist','port','에이, 난 괜찮으니까 사양 말라고.','Come on, I do not mind. No need to be polite.','!flag.day0_port_history_listen')
]);
const historyIntro=steps.find(s=>s['text.ko']==='루나, 진 피즈에 대해서 알고 있나?'||s['text.ko']==='그나저나.. 루나, 진 피즈에 대해서 알고 있나?');
assert(historyIntro);historyIntro['text.ko']='그나저나.. 루나, 진 피즈에 대해서 알고 있나?';
historyIntro['text.en']='By the way… Luna, do you know about the Gin Fizz?';
const ginReply=steps.find(s=>s['text.ko']==='진을 베이스로 하는 칵테일 아닙니까?'||s['text.ko']==='진을 베이스로 하는 칵테일 아닌가요?');
assert(ginReply);ginReply['text.ko']='진을 베이스로 하는 칵테일 아닌가요?';
ginReply['text.en']='Isn’t it a gin-based cocktail?';
insertBefore(historyIntro.dialogue_id,[
 make('port_tip_offer','port','좋아 이건 팁이니까 받아 두라고.','All right, take this as a tip.'),
 {...base,type:'effect',actor:'port',arg:null,'text.ko':null,'text.en':null,dialogue_id:null,
  when:'!flag.day0_port_tip_received',effects:'money += 100; flag.day0_port_tip_received = true',row_id:'day0_revision_20261013_port_tip_reward'},
 make('port_tip_question','luna','..? 제가 갖는 돈인가요?','…? Is this money for me to keep?'),
 make('port_tip_answer','port','그래. 루나 너가 이뻐서 주는 거니까 필요할 때 쓰라고.','Yes. It is for you, Luna. Spend it when you need it.'),
 make('port_tip_thanks','luna','감사합니다.','Thank you.'),
 make('port_tip_work','port','루나 너가 앞으로 성실하게만 일한다면 아무리 이 그지같은 동네라도 팁 정도는 챙겨줄테니 열심히 해봐.','Keep working hard, Luna. Even in this lousy neighborhood, people will leave you a tip.'),
 make('port_tip_money','luna','네 돈은 늘 중요하니까요.','Yes. Money is always important.'),
 make('port_tip_laugh','port','껄껄. 잘 알고있구만.','Ha ha. You know it.')
]);
// Reconcile every spoken line with the fetched table, ignoring only wrapping.
const norm=s=>s.replace(/\s/g,''),spoken=steps.filter(s=>s.type==='say');
assert.equal(spoken.length,spec.lines.length);
for(let i=0;i<spoken.length;i++){
 const actual=spoken[i],expected=spec.lines[i];assert.equal(actual.actor,expected.actor,'speaker '+i);
 assert.equal(norm(actual['text.ko']),norm(expected.text),'Notion text mismatch '+i+' / '+actual.dialogue_id);
 actual['text.ko']=expected.text;
}
steps.forEach((s,i)=>s.seq=String(i+1));
const first=data.tables.steps.findIndex(s=>s.context===scene);data.tables.steps=data.tables.steps.filter(s=>s.context!==scene);data.tables.steps.splice(first,0,...steps);
const tutorial=data.tables.bar_choices.filter(c=>c.context==='ch_day0_notion_tutorial');
Object.assign(tutorial.find(c=>+c.seq===1),{'text.ko':'네.','text.en':'Yes.'});
Object.assign(tutorial.find(c=>+c.seq===2),{'text.ko':'이미 알고 있어서 배울 필요는 없네요. (튜토리얼 대사 스킵)','text.en':'I already know how, so there is no need to teach me. (Skip tutorial dialogue)'});
data.tables.bar_choices=data.tables.bar_choices.filter(c=>c.context!==choiceId);
for(const [seq,ko,en,effects]of [
 [1,'네, 들려주세요.','Yes, please tell me.','flag.day0_port_history_listen = true; affinity.port += 1'],
 [2,'괜찮을 것 같아요.','I think I will pass.','flag.day0_port_history_listen = false; affinity.port -= 1']
])data.tables.bar_choices.push({...tutorial[0],context:choiceId,seq:String(seq),'text.ko':ko,'text.en':en,effects,row_id:choiceId+'_'+seq});
if(!data.tables.bar_choice_groups.some(g=>g.choice_group===choiceId))data.tables.bar_choice_groups.push({choice_group:choiceId,row_id:'choice_group_'+choiceId});
data.source.webDay0Bar={url:spec.source,revision:'2026-10-13',scope:spec.scope,dialogues:spoken.length,portChoiceAffinity:{accept:1,decline:-1}};
const names={chris:'크리스',luna:'루나',port:'포트'};
campaign.day0Bar=spoken.map(s=>({type:'say',actor:s.actor,who:names[s.actor],text:s['text.ko']}));
assert.equal(stable(data),before,'Unexpected changes outside day-zero bar data');assert.equal(JSON.stringify({...campaign,day0Bar:undefined}),otherCampaign);
// Mechanical serialization of generated data only; authoring lives in this migration/spec.
fs.writeFileSync(path.join(root,'data.js'),'window.LUNA_DATA='+JSON.stringify(data)+';\n');
fs.writeFileSync(path.join(root,'campaign-data.js'),'window.LUNA_CAMPAIGN_DATA='+JSON.stringify(campaign,null,2)+';\n');
console.log('DAY0_UPDATED',spoken.length,'spoken lines, tutorial choice + two exclusive Port affinity branches; unrelated data preserved.');
