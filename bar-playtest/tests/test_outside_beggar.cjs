const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const W={};W.window=W;const dir=path.resolve(__dirname,'..');
for(const file of ['data/runtime/game-data.js','src/features/outside/events/outside-beggar.js','src/features/outside/events/outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(dir,file),'utf8'),W);
const B=W.LunaOutsideBeggar;
function setup(money=500){W.barGame={progress:{money,flags:{},inventory:{}},changed(){},log(){}};W.lunaCampaign={active:true,session:{carry:structuredClone(W.barGame.progress)}};W.LunaOutsideContent={events:[]};const m={scene:'street',level:0,config:{day:0,flow:'out'},x:-7.45,updateNear(){}};m.story=new W.LunaOutsideStory.Story(m);m.backgroundStory=new W.LunaOutsideStory.BackgroundStories(m);return m;}
function talk(m,id=B.id){return m.story.interact(B.targets(m).find(t=>t.id===id));}
function drain(m){const lines=[];for(let i=0;i<40&&m.story.speech&&!m.story.speech.choice;i++){lines.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();}return lines;}
for(const day of [0,1,2,3,99])for(const flow of ['in','out']){const m=setup();m.config={day,flow};assert.equal(B.targets(m).length,(day===0&&flow==='out'||day===1&&flow==='in')?2:0);m.level=1;assert.equal(B.targets(m).length,0);m.level=0;m.scene='home';assert.equal(B.targets(m).length,0);m.scene='street';m.qa={};assert.equal(B.targets(m).length,0);}
for(const day of [0,1]){
 const m=setup(200);m.config={day,flow:day?'in':'out'};assert(talk(m));const lines=drain(m);assert(lines.some(t=>t.includes('10배'))&&lines.some(t=>t.includes('임플란트')));
 assert.equal(lines[0],'...어이 잠깐만.');assert.equal(m.story.speech.line.text,lines.at(-1));
 assert.equal(B.choiceView(m).options.length,3);assert.equal(B.choiceView(m).options[2].label,'???');assert(B.choiceView(m).options[2].disabled);assert(!m.story.choose('beggar-question'));
 assert(m.story.speech.choice);assert.equal(B.choiceView().options[0].disabled,false);assert(m.story.choose('beggar-pay'));assert.equal(W.barGame.progress.money,0);assert.equal(W.lunaCampaign.session.carry.money,0);assert(W.lunaCampaign.session.carry.flags.street_beggar_paid);
 assert.equal(m.story.choose('beggar-pay'),false);assert(B.visible(m,B.id),'Still present during thanks');drain(m);assert(m.beggarDeparture);const x=m.beggarDeparture.x;B.tick(m,1);assert(m.beggarDeparture.x<x);B.tick(m,3);assert(!m.beggarDeparture);assert(!B.visible(m,B.id));
 assert(talk(m,B.witness));assert(drain(m).some(t=>t.includes('설마')));m.config={day:1,flow:'in'};assert.equal(B.targets(m).filter(t=>t.id===B.id).length,0);assert.equal(W.barGame.progress.money,0);assert.deepEqual(W.barGame.progress.inventory,{});
}
const refused=setup();assert(talk(refused));drain(refused);assert(refused.story.choose('beggar-refuse'));drain(refused);assert.equal(W.barGame.progress.money,500);assert(!refused.beggarDeparture);assert(talk(refused));assert.deepEqual(drain(refused),['뭐야? 돈 줄거야?']);assert(refused.story.speech.choice);assert.equal(B.choiceView(refused).options[0].label,'네 드릴게요 (200원을 준다.)');refused.story.choose('beggar-refuse');drain(refused);
assert(talk(refused,B.witness));refused.story.cancel();assert(!W.barGame.progress.flags.street_beggar_warned);assert(talk(refused,B.witness));assert.equal(drain(refused).length,5);assert(W.barGame.progress.flags.street_beggar_warned);assert(talk(refused,B.witness));assert.equal(drain(refused).length,2);
refused.config={day:1,flow:'in'};assert(talk(refused));drain(refused);assert(refused.story.speech.choice);assert.equal(B.choiceView(refused).options[2].label,'혹시 사기꾼인가요?');assert(refused.story.choose('beggar-question'));assert.equal(drain(refused).length,5);assert.equal(W.barGame.progress.money,500);
talk(refused);drain(refused);assert(refused.story.choose('beggar-pay'));drain(refused);B.tick(refused,4);talk(refused,B.witness);assert.equal(drain(refused).length,6);talk(refused,B.witness);assert.equal(drain(refused).length,2);
const poor=setup(199);talk(poor);drain(poor);assert(B.choiceView().options[0].disabled);assert(!poor.story.choose('beggar-pay'));assert.equal(W.barGame.progress.money,199);assert(poor.story.choose('beggar-refuse'));drain(poor);
for(const leave of ['home','next-day','reload']){
 const m=setup();talk(m);drain(m);m.story.choose('beggar-pay');drain(m);B.tick(m,4);assert(B.visible(m,B.witness));
 if(leave==='home'){m.scene='home';B.tick(m,0);m.scene='street';}
 if(leave==='next-day')m.config={day:1,flow:'in'};
 if(leave==='reload')delete m.beggarWitnessPaidVisit;
 assert(!B.visible(m,B.witness),leave);assert(!B.targets(m).some(t=>t.id===B.witness),leave);assert(!B.interact(m,{id:B.witness}),leave);
}
const unpaid=setup();unpaid.scene='home';B.tick(unpaid,0);unpaid.scene='street';assert(B.visible(unpaid,B.witness));unpaid.config={day:1,flow:'in'};assert(B.visible(unpaid,B.witness));
const before=setup();talk(before,B.witness);assert(drain(before).some(t=>t.includes('전기함')));assert.equal(W.barGame.progress.money,500);
assert(W.lunaCampaign.session.carry.flags.street_beggar_warned);talk(before);assert.equal(before.story.speech.line.text,'...어이 잠깐만.');drain(before);assert(!B.choiceView(before).options[2].disabled,'Hearing the warning before meeting the beggar unlocks the first choice too');
const ambient=setup();ambient.backgroundStory.beginRows('nearby',{x:-7,y:-.94},[{type:'say',actor:'passer',text:'주변 대화'}]);talk(ambient);const elapsed=ambient.backgroundStory.speech.elapsed;ambient.backgroundStory.tick(1);assert.equal(ambient.backgroundStory.speech.elapsed,elapsed);assert.equal(ambient.backgroundStory.views().length,0);drain(ambient);ambient.story.choose('beggar-refuse');drain(ambient);assert.equal(ambient.backgroundStory.suspended,false);
console.log('BEGGAR_OK CSV first/repeat, 3 choices, information lock/cancel, 200 boundary, duplicate protection, carry, witness one-offs/repeats, persistence and no reward grant');
