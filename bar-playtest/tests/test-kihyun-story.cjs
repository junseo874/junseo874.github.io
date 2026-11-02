const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),W={};W.window=W;
for(const file of ['data/runtime/game-data.js','data/runtime/campaign-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),W);
require('../src/shared/ui/story-notices.js');
const C=require('../src/core/core.js'),D=C.millilitreData(W.LUNA_DATA),story=W.LUNA_CAMPAIGN_DATA;
const expected={0:['gin_tonic','gin_fizz'],1:['bottle_beer','dry_martini','screwdriver'],2:['free','bottle_beer'],3:['johnny_old_fashioned','bottle_beer']};
const tick=g=>{g.cameraMoving=false;g.tick(.1);assert.equal(g.error,null);};
for(const answer of [1,2])for(const day of [0,1,2,3]){
 const g=new C.Game(D);g.reset(day,'regular',123,false);g.overlay=null;g.tutorial=null;g.progress.flags.day0_skip_tutorial=true;
 if(day===3){g.progress.inventory={wild_dog:1,bitters:1};g.progress.flags.campaign_observation=true;}
 g.startStoryPhase('bar');const seen=[],orders=[];let tip=0;
 for(let guard=0;guard<15000&&!g.finished;guard++){
  assert.equal(g.error,null);
  if(g.overlay==='johnnyUnlock'){g.confirmJohnnyUnlock();continue;}
  if(g.transition||g.cameraLeft||g.cameraMoving){tick(g);continue;}
  if(g.storyCoaster){if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;assert(g.coaster(g.storyCoaster.seat,'drag'));continue;}
  if(g.choice){g.choose(day===0?2:answer);continue;}
  if(g.dialogue){seen.push(g.dialogue.text);g.dialogue.chars=g.dialogue.text.length;g.advance();continue;}
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   const order=g.currentOrder;orders.push(order.freeChoice?'free':order.cocktail);
   assert(g.openRecipes());assert(g.selectCocktail(order.cocktail));g.debugCraft('good');g.offer();assert(g.serve(order.seat,'drag'));continue;
  }
  tick(g);
 }
 assert(g.finished,JSON.stringify({day,answer,step:g.story?.steps[g.story.index],tutorial:g.tutorial,coaster:g.storyCoaster}));
 // Free recommendation defaults to the first available recipe, while the data
 // remains a free-order prompt rather than an authored fixed drink.
 if(day===2)orders[0]='free';assert.deepEqual(orders,expected[day]);
 if(day===0){assert(g.progress.flags.day0_port_tip_received);assert(!seen.some(t=>t.includes('진 피즈의 역사')));}
 if(day===1){assert(seen.some(t=>t.includes('내 이름이야, 톰 거너')));assert(g.progress.flags.tom_name_known);assert(g.progress.flags.tom_introduction_notified);assert(!seen.some(t=>t.includes('샴페인')));assert(seen.some(t=>t.includes(answer===1?'힘들었던 날에':'위로가 말도')));}
 if(day===2){assert(g.progress.flags.johnny_chip_received);assert(g.progress.flags.day2_luna_left);assert(seen.some(t=>t.includes('2033년식')));assert(seen.some(t=>t.includes(answer===1?'칼 한 번 맞고':'인간보단 차라리 동물')));}
 if(day===3){assert(g.progress.flags.day3_sugar_received);assert(g.progress.flags.johnny_recipe_unlocked);assert(seen.some(t=>t.includes(answer===1?'조니의 말대로':'저 팔로 누군가를')));}
}
const rows=D.tables.steps.filter(r=>r.context==='campaign_d3_bar');
assert(rows.findIndex(r=>r.type==='serve'&&r.actor==='tom')<rows.findIndex(r=>r.type==='enter'&&r.actor==='samho'));
assert.equal(story.scenes.night2[0].stage,null);assert.equal(story.scenes.night2[11].cinemaAfter,'johnny-memory');
assert.equal(story.scenes.night2[2].actor,'luna');assert.equal(story.scenes.night2.filter(r=>r.type==='choice').length,0);
assert.equal(story.scenes.night0.filter(r=>r.cinemaAfter).length,1);assert.equal(story.scenes.ending.filter(r=>r.memoryKey==='terraceMemory3').length,1);
assert.equal(story.scenes.terraceMemory.length,8);assert.equal(story.scenes.terraceMemory3.length,5);
assert(story.scenes.johnny.some(r=>r.text.includes('소형 미사일 탄환')));
for(const ingredient of ['와일드 독 45ml','비터스 5ml','각설탕 1개'])assert(story.scenes.johnny.some(r=>r.text.includes(ingredient)));
assert(!Object.values(story.scenes).flat().some(r=>r.text?.includes('#대괄호')));
assert.equal(D.tables.cocktails.find(r=>r.id==='screwdriver').unlock_day,'1');
console.log('KIHYUN_STORY_OK: all four bar days, both branches, 9 drink orders, tip/name/chip/sugar flags, terrace and memory links');
