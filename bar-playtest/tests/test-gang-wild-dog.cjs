const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const W={LunaResidence:{layout:{homeX:-18,elevatorX:-12.645}},LunaOutsideContent:{events:[]}};W.window=W;
for(const file of ['data/runtime/game-data.js','data/runtime/outside-scene-data.js','src/features/outside/events/outside-ambient.js','src/features/outside/events/outside-neighborhood.js','src/features/outside/events/outside-story.js','src/features/outside/events/outside-shop.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),W);
let notices=[];W.outsidePlaytest={clearInput(){},notifyItem(m,id){notices.push(id);}};
function setup(flags={},money=1000,inventory={}){notices=[];const p={flags:{gang_pass_granted:true,...flags},money,inventory};W.barGame={progress:p,changed(){},log(){}};W.lunaCampaign={session:{carry:structuredClone(p)}};const m={config:{day:2,flow:'out'},scene:'street',level:0,x:-15.1,backgroundStory:{cancel(){}},updateNear(){}};m.story=new W.LunaOutsideStory.Story(m);return {m,p};}
const N=W.LunaOutsideNeighborhood;
function open(m){const t=N.targets(m).find(t=>t.actor==='boss');assert(t);assert(N.interact(m,t));}
function drain(m){const lines=[];for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){assert(m.story.speech.line,'instant effects must continue');lines.push(m.story.speech.line);m.story.speech.elapsed=99;m.story.advance();}return lines;}
function introduction(m){open(m);const rows=drain(m);assert.equal(rows.length,21);assert.equal(rows.filter(r=>r.actor==='gangmate').length,2);assert.equal(m.story.speech.line.stage,'boss-first');assert(W.barGame.progress.flags.gang_boss_met);}
{
 const {m,p}=setup({},499);m.config.day=0;assert(!N.targets(m).some(t=>t.actor==='boss'));m.config.day=1;m.config.flow='in';assert(!N.targets(m).some(t=>t.actor==='boss'));m.config.flow='out';delete p.flags.gang_pass_granted;assert(!N.targets(m).some(t=>t.actor==='boss'));p.flags.gang_pass_granted=true;assert(!N.targets(m).some(t=>t.actor==='boss'));m.config.day=2;
 introduction(m);assert.deepEqual(Array.from(N.choiceView(m).options,o=>o.id),['boss-wait','boss-repair','boss-pay']);assert(!m.story.choose('boss-repair'));assert(!m.story.choose('boss-pay'));assert.equal(p.money,499);
 assert(m.story.choose('boss-wait'));assert.deepEqual(drain(m).map(r=>r.text),['조금만 기다려주세요.','그래 알아서 재주것 해보라고']);assert(!m.story.speech);
 m.config.day=3;open(m);assert.equal(m.story.speech.line.stage,'boss-repeat');assert(m.story.choose('boss-wait'));assert(!m.story.speech,'repeat wait ends immediately');
}
for(const repeat of [false,true])for(const repaired of [false,true]){
 const {m,p}=setup(repeat?{gang_boss_met:true}: {},500);if(repaired)p.flags.elevator_repaired=true;
 if(repeat)open(m);else introduction(m);
 const before=p.money;assert(m.story.choose(repaired?'boss-repair':'boss-pay'));assert.equal(p.money,repaired?before:0);assert.equal(p.inventory.wild_dog,undefined,'reward only at authored handover');assert(!m.story.choose('boss-pay'),'double click cannot charge again');
 // Leaving and returning after accepting must resume the same branch, without another charge.
 m.story.cancel();m.config.day=2;open(m);assert.equal(m.story.speech.id,'neighborhood/boss'+(repaired?'Repair':'Pay')+(repeat?'Repeat':'First'));
 const lines=drain(m).map(r=>r.text);assert.equal(lines.at(-2),'감사해요.');assert.equal(lines.at(-1),'이제 일 끝났으면 여기서 썩 꺼져.');assert.equal(p.inventory.wild_dog,1);assert(p.flags.gang_wild_dog_received);assert(!p.flags.gang_wild_dog_paid);assert(!p.flags.gang_wild_dog_repair_promised);assert.deepEqual(notices,['wild_dog']);assert.equal(W.lunaCampaign.session.carry.inventory.wild_dog,1);assert.equal(W.lunaCampaign.session.carry.money,p.money);
 // Consuming the item cannot reopen either reward route.
 p.inventory.wild_dog=0;open(m);assert.equal(m.story.speech.id,'neighborhood/bossDone');drain(m);assert.equal(p.inventory.wild_dog,0);assert.equal(notices.length,1);
}
for(const [flags,inventory]of [[{shiba_bought_wild_dog:true},{}],[{},{wild_dog:1}]]){const {m,p}=setup(flags,800,inventory);open(m);assert.equal(m.story.speech.id,'neighborhood/bossDone');drain(m);assert.equal(p.money,800);assert.equal(notices.length,0);}
assert.deepEqual(Array.from(W.LunaOutsideShop.items,i=>i.id),['bitters']);
assert.equal(N.scripts.bossIntro.at(-1).text,'저 망할 수리공 새끼 좀 설득해서 옆에 엘레베이터 좀 고쳐 오면 주는 걸로 하지.');
console.log('GANG_WILD_DOG_OK: authored CSV dialogue, 4 reward branches, day/gate conditions, 499/500, repair requirement, wait/revisit, interruption recovery, single charge/reward, carry and legacy saves');
