const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const W={};W.window=W;const root=path.resolve(__dirname,'..');
for(const file of ['data/runtime/game-data.js','src/features/outside/events/outside-believer.js','src/shared/dialogue/dialogue-rhythm.js','src/features/outside/events/outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const N=W.LunaOutsideBeliever;
function setup(day=0,flow='out'){
 W.barGame={progress:{money:700,flags:{},inventory:{}},changed(){},log(){}};W.lunaCampaign={session:{carry:structuredClone(W.barGame.progress)}};W.LunaOutsideContent={events:[]};
 const notices=[];W.outsidePlaytest={clearInput(){},notifyItem(m,id){notices.push(id);}};
 const m={scene:'street',level:0,config:{day,flow},x:N.place.x+.3,updateNear(){},notices};m.story=new W.LunaOutsideStory.Story(m);return m;
}
function talk(m){return m.story.interact(N.targets(m)[0]||{id:'absent'});}
function drain(m,stopAtGift=false){for(let i=0;i<40&&m.story.speech;i++){if(stopAtGift&&W.barGame.progress.flags.believer_emblem_received)break;m.story.speech.elapsed=999;m.story.advance();}}
for(const day of [0,1,2,3,99])for(const flow of ['in','out']){const m=setup(day,flow);assert.equal(N.targets(m).length,(day===0&&flow==='out')||day===1?1:0);m.level=1;assert.equal(N.targets(m).length,0);m.level=0;m.scene='home';assert.equal(N.targets(m).length,0);m.scene='street';m.qa={};assert.equal(N.targets(m).length,0);}
for(const [day,flow]of [[0,'out'],[1,'in'],[1,'out']]){
 const m=setup(day,flow);assert(talk(m));drain(m);assert.equal(W.barGame.progress.inventory[N.item],1);assert.equal(W.barGame.progress.money,700);assert(W.barGame.progress.flags.believer_conversation_done);assert.equal(W.lunaCampaign.session.carry.inventory[N.item],1);assert.equal(m.notices.length,1);assert.equal(N.targets(m).length,0);assert(!talk(m));m.config={day:1,flow:'out'};assert.equal(N.targets(m).length,0);
}
const m=setup();assert(talk(m));m.story.cancel();assert(!W.barGame.progress.flags.believer_conversation_done);m.config={day:1,flow:'in'};assert(talk(m));drain(m,true);assert.equal(W.barGame.progress.inventory[N.item],1);assert(!W.barGame.progress.flags.believer_conversation_done);assert.equal(m.story.speech.line.text,'그럼 다음에 뵙지요. 킬킬...');m.story.cancel();m.config.flow='out';assert(talk(m));assert.equal(m.story.speech.line.text,'그럼 다음에 뵙지요. 킬킬...');drain(m);assert.equal(W.barGame.progress.inventory[N.item],1);assert.equal(m.notices.length,1);assert.equal(N.targets(m).length,0);
console.log('BELIEVER_OK date/route/level/QA gates, one-time emblem, completion absence, interrupted reward resume and carry.');
