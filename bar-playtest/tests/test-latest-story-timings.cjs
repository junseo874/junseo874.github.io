const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['data/runtime/game-data.js','data/runtime/campaign-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
const C=require('../src/core/core.js'),D=C.millilitreData(W.LUNA_DATA);
const rows=id=>D.tables.steps.filter(r=>r.context===id).sort((a,b)=>a.seq-b.seq);
const specs=[
 ['d1_tutorial_chris','empty_glass','port','어떤가요?','크으... 솜씨는 나쁘지 않네. 쓰던 재료는 예전이랑 똑같나 보구만.'],
 ['campaign_d2_bar','coaster','samho','뭐?','우선 주문하시겠어요?'],
 ['campaign_d2_bar','coaster','port','아, 루나. 영업 시간 끝났나? 한 잔만 부탁하고 싶은데.','주문하고 싶으신 거 있으신가요?'],
 ['campaign_d2_bar','empty_glass','samho',null,'크흐, 하! 이거 괜찮은데!'],
 ['campaign_d3_bar','coaster','tom',null,'네. 지금 만들어 드릴까요?'],
 ['campaign_d3_bar','coaster','samho','루나, 나도 톰처럼 술 한 잔 줘!','뭐로 드릴까요?'],
 ['campaign_d3_bar','empty_glass','tom',null,'믿고 부탁하셨으니까요.'],
 ['campaign_d3_bar','empty_glass','samho','여기 있어요.',null]
];
for(const [scene,type,actor,prev,next]of specs){const a=rows(scene),hits=a.filter(r=>r.type===type&&r.actor===actor);assert.equal(hits.length,1);const i=a.indexOf(hits[0]);if(prev)assert.equal(a[i-1]['text.ko'],prev);if(next)assert(a[i+1]['text.ko'].startsWith(next));}
assert(!rows('campaign_d1_bar').some(r=>r.type==='coaster'&&r.actor==='chris'));
assert.equal(rows('d1_tutorial_chris').find(r=>r.type==='empty_glass'&&r.actor==='port').when,'order_match');
for(const answer of [1,2])for(const day of [0,1,2,3]){
 const g=new C.Game(D);g.reset(day,'regular',123,false);g.overlay=null;g.tutorial=null;g.progress.flags.day0_skip_tutorial=true;
 if(day===3){g.progress.inventory={wild_dog:1,bitters:1};g.progress.flags.campaign_observation=true;}
 g.startStoryPhase('bar');const coasters=[],empties=[],orders=[];
 // Observe the real pump; assertions happen at the authored line boundaries.
 for(let n=0;n<15000&&!g.finished;n++){
  assert.equal(g.error,null);
  if(g.overlay==='johnnyUnlock'){g.confirmJohnnyUnlock();continue;}
  if(g.transition||g.cameraLeft||g.cameraMoving){g.cameraMoving=false;g.tick(.1);continue;}
  if(g.storyCoaster){coasters.push(g.seats[g.storyCoaster.seat].actor);assert(g.coaster(g.storyCoaster.seat,'drag'));continue;}
  if(g.choice){g.choose(day===0?2:answer);continue;}
  if(g.dialogue){
   const text=g.dialogue.text,guest=a=>Object.values(g.seats).find(s=>s?.actor===a);
   if(day===0&&text.startsWith('크으... 솜씨는')){assert.equal(guest('port').glassEmpty,true);empties.push('port');}
   if(day===2&&text==='크흐, 하! 이거 괜찮은데!'){assert.equal(guest('samho').glassEmpty,true);empties.push('samho');}
   if(day===3&&text.startsWith('정말 똑같잖아?'))assert.equal(guest('tom').glassEmpty,false);
   if(day===3&&text==='믿고 부탁하셨으니까요.'){assert.equal(guest('tom').glassEmpty,true);empties.push('tom');}
   if(day===3&&text==='이렇게 주량이 약해서... 삼호, 일어나 볼래?'){assert.equal(guest('samho').glassEmpty,true);assert.equal(guest('samho').expression,'drunk');}
   if(day===3&&text==='으음, 한 잔만 더! 딸꾹.'){assert.equal(guest('samho').glassEmpty,true);assert.equal(guest('tom').glassEmpty,true);empties.push('samho');}
   g.dialogue.chars=text.length;g.advance();continue;
  }
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   const o=g.currentOrder;orders.push(o.actor);assert(g.openRecipes());assert(g.selectCocktail(o.cocktail));g.debugCraft('good');g.offer();assert(g.serve(o.seat,'drag'));assert.equal(g.seats[o.seat].glassEmpty,false);continue;
  }
  g.tick(.1);
 }
 assert(g.finished,`day ${day}, answer ${answer}`);
 assert.deepEqual(coasters,[['chris','port'],['shiba','tom','aili'],['samho','port'],['tom','samho']][day]);
 assert.deepEqual(empties,[['port'],[],['samho'],['tom','samho']][day]);
 assert.equal(g.transactions.length,orders.length,'No extra settlement from empty-glass triggers');
}
console.log('LATEST_STORY_TIMINGS_OK: days 0–3, both choices, exact coaster/empty-glass boundaries and no duplicate payments');
