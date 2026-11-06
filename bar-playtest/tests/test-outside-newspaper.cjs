const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const W={};W.window=W;const root=path.resolve(__dirname,'..');
for(const file of ['data/runtime/game-data.js','src/features/outside/events/newspaper-progress.js','src/features/outside/events/newspaper-dialogue.js','src/features/outside/events/outside-newspaper.js','src/shared/dialogue/dialogue-rhythm.js','src/features/outside/events/outside-story.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const N=W.LunaOutsideNewspaper;
function setup(day=1,flow='in'){
 W.barGame={progress:{money:700,flags:{},inventory:{}},changed(){},log(){}};
 W.lunaCampaign={session:{carry:structuredClone(W.barGame.progress)}};W.LunaOutsideContent={events:[]};
 const notices=[];W.outsidePlaytest={clearInput(){},notifyItem(m,id){notices.push(id);}};
 const m={scene:'street',level:0,config:{day,flow},x:N.place.x+.3,updateNear(){},notices};m.story=new W.LunaOutsideStory.Story(m);return m;
}
function talk(m){return m.story.interact(N.targets(m)[0]||{id:'absent'});}
function drain(m,stopAtGift=false){const said=[];for(let i=0;i<70&&m.story.speech&&!m.story.speech.choice;i++){if(stopAtGift&&W.barGame.progress.flags.newspaper_gear_received)break;said.push(m.story.speech.line.text);m.story.speech.elapsed=999;m.story.advance();}return said;}
for(const day of [0,1,2,3,99])for(const flow of ['in','out']){
 const m=setup(day,flow);assert.equal(N.targets(m).length,day===1?1:0);m.level=1;assert.equal(N.targets(m).length,0);m.level=0;m.scene='home';assert.equal(N.targets(m).length,0);m.scene='street';m.qa={};assert.equal(N.targets(m).length,0);
}
for(const flow of ['in','out'])for(const answer of ['wrong','right']){
 const m=setup(1,flow);assert(talk(m));assert.equal(drain(m).length,12);assert.equal(m.story.view().purchase.options.length,2);assert(m.story.view().full.includes('자살률'));
 assert(!m.story.choose('bad-id'));assert(m.story.choose('newspaper-'+answer));assert.equal(m.story.speech.line.actor,N.id,'selection immediately starts the NPC response');assert(!m.story.choose('newspaper-'+answer));
 const said=drain(m);assert(said.some(s=>s.includes(answer==='wrong'?'아쉽구먼':'정답일세')));assert(said.some(s=>s.includes('50년')));assert.equal(W.barGame.progress.inventory.gear_part,1);assert.equal(W.barGame.progress.money,700);assert(W.barGame.progress.flags.newspaper_conversation_done);assert.equal(W.lunaCampaign.session.carry.inventory.gear_part,1);assert.equal(m.notices.length,1);
 assert(talk(m));assert.equal(drain(m).length,1);assert.equal(W.barGame.progress.inventory.gear_part,1);
 m.config.flow='out';assert.equal(N.targets(m).length,flow==='in'?0:1);m.config.day=2;assert.equal(N.targets(m).length,0);
}
const cancelled=setup();talk(cancelled);drain(cancelled);cancelled.story.cancel();assert(!W.barGame.progress.flags.newspaper_conversation_done);cancelled.config.flow='out';assert(talk(cancelled));drain(cancelled);cancelled.story.choose('newspaper-right');drain(cancelled,true);assert.equal(W.barGame.progress.inventory.gear_part,1);assert(!W.barGame.progress.flags.newspaper_conversation_done);cancelled.story.cancel();assert(talk(cancelled));assert.equal(cancelled.story.speech.line.text,'감사해요.');drain(cancelled);assert.equal(W.barGame.progress.inventory.gear_part,1);assert(W.barGame.progress.flags.newspaper_conversation_done);
const owned=setup();W.barGame.progress.inventory.gear_part=2;W.barGame.progress.flags.elevator_repaired=true;talk(owned);drain(owned);owned.story.choose('newspaper-wrong');drain(owned);assert.equal(W.barGame.progress.inventory.gear_part,3);assert.equal(owned.notices.length,1);
// Pin the observable timing, not just the final inventory count.
for(const answer of ['wrong','right']){
 const m=setup();talk(m);drain(m);m.story.choose('newspaper-'+answer);
 const transcript=[];
 while(m.story.speech){
  const text=m.story.speech.line.text;transcript.push(text);
  if(text.includes('말동무 해 준 대가')){assert.equal(m.notices.length,0);assert(!W.barGame.progress.flags.newspaper_gear_received);}
  if(text==='감사해요.'){assert.equal(m.notices.length,1);assert.equal(W.barGame.progress.inventory.gear_part,1);}
  m.story.speech.elapsed=999;m.story.advance();
 }
 assert.deepEqual(transcript,[answer,'common','finish'].flatMap(k=>Array.from(W.LUNA_DATA.sharedStory['newspaper/'+k]).filter(r=>r.type==='say').map(r=>r.text)));
}
console.log('NEWSPAPER_OK day/route gates, both answers, retained question, one-time gear, interruption/resume, carry and unchanged money.');
