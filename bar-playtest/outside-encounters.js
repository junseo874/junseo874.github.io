// Playtest-only fictional dialogue. Not imported story content or Day 99 QA.
(function(global){
'use strict';
const actors={
 'bar-pair-left':{name:'야간 노동자',color:'#d6b987'},
 'bar-pair-right':{name:'동료',color:'#a8c4d8'},
 'shop-loner':{name:'퇴근하던 행인',color:'#b3c9a1'},
 'alley-pair-left':{name:'골목의 남자',color:'#c1b1d8'},
 'alley-pair-right':{name:'건너편 남자',color:'#d5a18f'},
 'lift-loner':{name:'주민',color:'#a8cbd1'}
};
const cases=[
 {id:'demo_out_pair_neon',activation:'proximity',kind:'pair',members:['bar-pair-left','bar-pair-right'],lines:[
 ['bar-pair-left','저 간판, 어제도 고장 나지 않았어?','Wasn’t that sign broken yesterday?'],
 ['bar-pair-right','고장 아니래. 절전 모드래.','They say it’s not broken. It’s in power-saving mode.'],
 ['bar-pair-left','글자가 절반만 켜지는데?','With only half the letters lit?'],
 ['bar-pair-right','우리 월급도 절반만 들어왔잖아. 도시 전체가 절전 중인가 봐.','Only half our pay came through too. Maybe the whole city’s saving power.']]},
 {id:'demo_out_direct_shift',kind:'direct',members:['shop-loner'],lines:[
 ['shop-loner','저기, 바는 벌써 닫았어요?','Hey, is the bar closed already?'],
 ['luna','네. 오늘 영업은 끝났어요.','Yes. We’re done for tonight.'],
 ['shop-loner','딱 한 잔만 마시려고 했는데. 퇴근이 늦어져서요.','I was hoping for one drink. Got off work late.'],
 ['luna','내일 오세요. 그 한 잔, 제대로 만들어 드릴게요.','Come by tomorrow. I’ll make that drink a good one.'],
 ['shop-loner','그 말 기억할게요. 조심히 들어가요.','I’ll hold you to that. Get home safe.']]},
 {id:'demo_out_pair_delivery',kind:'pair',members:['alley-pair-left','alley-pair-right'],lines:[
 ['alley-pair-left','상자는 어디 뒀어?','Where did you put the box?'],
 ['alley-pair-right','아무도 안 건드릴 곳에.','Somewhere nobody will touch it.'],
 ['alley-pair-left','설마 또 분리수거장?','Not the recycling area again?'],
 ['alley-pair-right','거기보다 안전한 데가 어디 있어. 안에 든 건 빈 병인데.','Where could be safer? It’s full of empty bottles.'],
 ['alley-pair-left','그럼 왜 이렇게 비밀스럽게 말하는 건데.','Then why are we being so secretive?']]},
 {id:'demo_out_direct_lift',kind:'direct',members:['lift-loner'],lines:[
 ['lift-loner','위층으로 가요?','Heading upstairs?'],
 ['luna','네. 오늘은 유난히 집이 멀게 느껴지네요.','Yes. Home feels a long way off tonight.'],
 ['lift-loner','첫 야근은 원래 그래요. 저 엘리베이터만 타면 다 온 거죠.','The first late shift always does. Just that elevator ride left.'],
 ['luna','그 말 들으니까 조금 낫네요.','That actually helps.'],
 ['lift-loner','올라가면서 도시 한번 봐요. 멀리서 보면 제법 괜찮거든.','Take a look at the city on the way up. It’s not bad from a distance.']]}
];
function actor(id){const p=global.LunaOutsideAmbient.placements.find(p=>p.id===id);return p&&actors[id]?{...p,...actors[id],top:p.y+(p.kind==='M2'?.61:p.kind==='W1'?.53:.56)}:null;}
function targets(model){if(!global.LunaOutsideAmbient?.visible(model)||model.level)return[];return cases.filter(c=>c.activation!=='proximity').flatMap(c=>c.members.map(id=>{const a=actor(id);return{id:'encounter-'+id,encounter:c.id,actor:id,label:a.name+' 대화',x:a.x,y:-.7};}));}
function prepare(model,target){const c=cases.find(c=>c.id===target.encounter);if(!c||c.activation==='proximity')return null;const people=c.members.map(actor),min=Math.min(...people.map(p=>p.x)),max=Math.max(...people.map(p=>p.x)),left=Math.abs(model.x-(min-.65))<=Math.abs(model.x-(max+.65)),to=left?min-.65:max+.65;
 return{id:c.id,kind:c.kind,target,stage:'entering',elapsed:0,duration:.65,from:model.x,to,cameraReady:false,camera:{x:(Math.min(min,to)+Math.max(max,to))/2,y:-.18,w:3.6},facing:left?1:-1};}
function tickProximity(model,dt){
 const story=model.backgroundStory;
 if(model.scene!=='street'||model.transition)return;
 if(!global.LunaOutsideAmbient.visible(model)||model.level||model.ride||model.encounter||model.dialog||model.story.blocking||story.speech)return;
 const c=cases.find(c=>c.activation==='proximity'&&!model.playedAmbient.has(c.id)&&c.members.some(id=>Math.abs(actor(id).x-model.x)<=.85));
 if(c&&story.begin(c.id,{id:c.id},true))model.playedAmbient.add(c.id);
}
for(const c of cases)global.LUNA_OUTSIDE_DIALOGUES[c.id]=c.lines.map(([actor,text,en],i)=>({type:'say',actor,text,en,sourceId:c.id+'_'+(i+1),temporary:true}));
global.LunaOutsideEncounters={cases,actor,targets,prepare,tickProximity};
})(typeof window==='undefined'?globalThis:window);
