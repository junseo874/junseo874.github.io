const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['data/runtime/game-data.js','data/runtime/campaign-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
require('../src/shared/ui/story-notices.js');
const C=require('../src/core/core.js'),D=C.millilitreData(W.LUNA_DATA);
const rows=id=>D.tables.steps.filter(s=>s.context===id).sort((a,b)=>a.seq-b.seq);
const opening=rows('campaign_d1_bar_open'),bar=rows('campaign_d1_bar');
for(const [steps,actor,preceding,following]of [
 [opening,'chris','여기 있어요.','나쁘지 않네, 잘했다.'],
 [bar,'shiba','흠 보기엔 그럴듯한데.','뭐야, 이 개똥만도 못한 건?!'],
 [bar,'tom','오호.','원하시던 맛인가요?'],
 [bar,'aili','...아하, 스크류드라이버는 예전에 팔던 거랑 똑같은 걸 쓰나 보네.','다행이네요.']
]){
 const index=steps.findIndex(s=>s.type==='empty_glass'&&s.actor===actor);
 assert(index>0);assert.equal(steps[index-1]['text.ko'],preceding);assert.equal(steps[index+1]['text.ko'],following);
}
assert.equal(opening.find(s=>s.type==='order').payment,'none');
assert.equal(opening[opening.findIndex(s=>s.type==='coaster')+1]['text.ko'],'그냥 맥주가 드시고 싶으신 거 아닌가요?');
assert.equal(bar[1]['text.ko'],'나 왔다. 일은 좀 어때.','No coaster gate for the first brief Chris visit');
const shibaGate=bar.findIndex(s=>s.type==='coaster'&&s.actor==='shiba');assert.equal(bar[shibaGate-1]['text.ko'],'주문 안 받을 거야?');
const ailiGate=bar.findIndex(s=>s.type==='coaster'&&s.actor==='aili');assert.equal(bar[ailiGate+1]['text.ko'],'그렇군요. 그럼 주문은 어떻게 하시겠어요?');assert.equal(bar.filter(s=>s.type==='coaster'&&s.actor==='aili').length,1);
const name=bar.find(s=>s['text.ko']==='내 이름이야, 톰 거너. 이름으로 불러줄래?');assert.equal(name.effects,'flag.tom_name_known = true');
{
 const g=new C.Game(D);g.reset(1,'regular',123,false);g.overlay=null;g.tutorial=null;g.startStoryPhase('bar_open');
 let coaster=0,served=false,emptied=false;
 for(let guard=0;guard<15000&&g.phase==='opening';guard++){
  assert.equal(g.error,null);
  if(g.transition||g.cameraLeft||g.cameraMoving){g.cameraMoving=false;g.tick(.1);continue;}
  if(g.storyCoaster){assert(g.coaster(g.storyCoaster.seat,'drag'));coaster++;continue;}
  if(g.dialogue){
   if(g.dialogue.text==='여기 있어요.')assert.equal(g.seats.R.glassEmpty,false);
   if(g.dialogue.text==='나쁘지 않네, 잘했다.'){assert.equal(g.seats.R.glassEmpty,true);emptied=true;}
   g.dialogue.chars=g.dialogue.text.length;g.advance();continue;
  }
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   assert(g.tutorial.beer);assert(g.openTutorialService());assert(g.openRecipes());assert(g.selectCocktail('bottle_beer'));
   // Skip skill execution only; serve and subsequent authored triggers run normally.
   g.tutorial=null;g.debugCraft('good');g.offer();assert(g.serve('R','drag'));served=true;continue;
  }
  g.tick(.1);
 }
 assert.equal(g.phase,'general');assert.equal(coaster,1);assert(served&&emptied);assert.equal(g.transactions.length,1);assert.equal(g.transactions[0].net,0,'Chris tutorial beer has no payment');
}
// Run all combinations, not just choosing the same answer in both groups.
for(const answers of [[1,1],[1,2],[2,1],[2,2]]){
 const g=new C.Game(D);g.reset(1,'regular',123,false);g.overlay=null;g.tutorial=null;g.startStoryPhase('bar');
 const seen=[],coasters=[],orders=[];let choices=0;
 for(let guard=0;guard<15000&&!g.finished;guard++){
  assert.equal(g.error,null);
  if(g.transition||g.cameraLeft||g.cameraMoving){g.cameraMoving=false;g.tick(.1);continue;}
  if(g.storyCoaster){coasters.push(g.seats[g.storyCoaster.seat].actor);assert(g.coaster(g.storyCoaster.seat,'drag'));continue;}
  if(g.choice){g.choose(answers[choices++]);continue;}
  if(g.dialogue){
   const text=g.dialogue.text;seen.push(text);const guest=actor=>Object.values(g.seats).find(s=>s?.actor===actor);
   if(text==='흠 보기엔 그럴듯한데.')assert.equal(guest('shiba').glassEmpty,false);
   if(text==='뭐야, 이 개똥만도 못한 건?!')assert.equal(guest('shiba').glassEmpty,true);
   if(text==='오호.')assert.equal(guest('tom').glassEmpty,false);
   if(text==='원하시던 맛인가요?')assert.equal(guest('tom').glassEmpty,true);
   if(text==='다행이네요.')assert.equal(guest('aili').glassEmpty,true);
   if(text===name['text.ko'])assert(g.progress.flags.tom_name_known);
   g.dialogue.chars=text.length;g.advance();continue;
  }
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   const order=g.currentOrder;orders.push(order.cocktail);assert(g.openRecipes());assert(g.selectCocktail(order.cocktail));g.debugCraft('good');g.offer();assert(g.serve(order.seat,'drag'));continue;
  }
  g.tick(.1);
 }
 assert(g.finished);assert.equal(choices,2);assert.deepEqual(coasters,['shiba','tom','aili']);assert.deepEqual(orders,['bottle_beer','dry_martini','screwdriver']);
 assert(g.progress.flags.tom_introduction_notified);assert.equal(g.progress.flags.campaign_d1_bar_answer_1,answers[0]===1);assert.equal(g.progress.flags.campaign_d1_bar_answer_2,answers[1]===1);
 assert.equal(seen.some(t=>t.includes('힘들었던 날에')),answers[0]===1);assert.equal(seen.some(t=>t.includes('위로가 말도')),answers[0]===2);
}
const night=W.LUNA_CAMPAIGN_DATA.scenes.night1;
assert(night.some(s=>s.text==='... 물론 우리가 찾는 기록이 온전할지는 모르지만.'));
assert.deepEqual(Array.from(night.find(s=>s.emphasis?.length).emphasis),['와일드 독','비터스','각설탕']);
assert(W.LUNA_DATA.sharedStory['neighborhood/repairPaid'].some(s=>s.text==='자 이제 고쳐졌을 거야'));
assert(W.LUNA_DATA.sharedStory['neighborhood/repairPaid'].some(s=>s.action==='repair'));
console.log('DAY1_NOTION_SCRIPT_OK: authored coaster positions, four empty-glass timings, all choice combinations, orders/name alert and preserved terrace/repair actions');
