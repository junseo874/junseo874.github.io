function guide(g){switch(g.tutorial.kind){case 'seatExplore':{const seats=['L','M','R'],delta=Math.sign(seats.indexOf(g.tutorialSeatTarget())-seats.indexOf(g.focus));g.focusSeat(seats[seats.indexOf(g.focus)+delta]);for(let i=0;i<8;i++)g.tick(.1);break;}case 'seatIndicator':case 'seatLegend':g.continueBarTutorial();break;case 'serveDrink':g.serve(g.tutorial.seat,'drag');break;case 'coaster':g.coaster(g.tutorial.seat,'drag');break;case 'recipe':g.openTutorialService();g.openRecipes();break;case 'recipeSelect':g.selectCocktail('gin_tonic');break;case 'prepRecipeOpen':g.tutorialEvent('recipeOpen');break;case 'prepRecipeRead':g.tutorialEvent('read');break;case 'prepRecipeClose':g.tutorialEvent('recipeClose');break;case 'prepGlass':g.pickItem('long_drink');break;case 'prepNavigate':g.tutorialEvent('shelf','liquor');break;case 'prepHover':g.tutorialEvent('hover');break;case 'prepAdd':g.pickItem('gin');break;case 'prepRemove':g.pickItem('gin');if(!g.tutorial)g.prepBack();break;case 'prepGinAgain':g.pickItem('gin');break;case 'prepSodaNavigate':g.tutorialEvent('shelf','fridge');break;case 'prepSodaHover':g.tutorialEvent('hover');break;case 'prepSodaAdd':g.pickItem('soda_water');break;case 'prepStart':assert.equal(g.startCraft(),true);assert.equal(g.screen,'gimmick');g.cancelCraft();break;default:throw Error('Unknown tutorial stage: '+g.tutorial.kind);}}
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(dir+'/data/runtime/game-data.js','utf8'),ctx);
const D=ctx.window.LUNA_DATA,C=require(dir+'/src/core/core.js'),R=require(dir+'/src/features/bar/remix.js');
const scene='d1_tutorial_chris',steps=D.tables.steps.filter(s=>s.context===scene);
assert.equal(steps.find(s=>s.type==='say')['text.ko'],'루나, 듣고 있는 거 맞지?');
assert.equal(steps.filter(s=>s.type==='choice').length,1,'Only the revised tutorial choice remains');
assert.equal(new Set(steps.map(s=>s.row_id)).size,steps.length);
assert(steps.filter(s=>s.type==='say').every(s=>s['text.ko']&&s['text.en']));
assert(!steps.some(s=>/grade/.test(s.when||'')));
assert(!steps.some(s=>s.type==='exit'&&s.actor==='port'));
assert.equal(steps.at(-1).type,'end_part');assert.equal(steps.at(-1).actor,'luna');
function tick(g,sec){for(let t=0;t<sec;t+=.1)g.tick(.1);assert.equal(g.error,null);}
let runs=0;
for(const variant of ['original','gpt'])for(const lang of ['ko','en'])for(const choice of [1,2])for(const chrisWrong of [false,true])for(const portWrong of [false,true]){
 const g=new C.Game(D);R.attach(g);g.lang=lang;g.reset(0,'full',31,true,{variant});let chrisAttempts=0,portAttempts=0;
 for(let i=0;i<2000&&!g.finished;i++){
  assert.equal(g.error,null);
  if(g.transition){tick(g,1.2);continue;}
  if(g.tutorial){guide(g);continue;}

  if(g.storyCoaster){if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;assert(g.coaster(g.storyCoaster.seat,'drag'));continue;}
  if(g.choice){assert.equal(g.choice.step.arg,'ch_day0_notion_tutorial');g.choose(choice);continue;}
  if(g.dialogue){
   if(g.dialogue.text==='먼저 가보겠습니다.'){assert.equal(g.seats.R.actor,'chris');assert.equal(g.seats.L.actor,'port');}
   const tip=g.dialogue.text==='그래. 네 몫이니까 편하게 받아.',money=g.progress.money;
   g.advance();g.advance();
   if(tip){assert.equal(g.progress.money,money+100);assert.equal(g.progress.flags.day0_port_tip_received,true);}
   continue;
  }
  if(g.currentOrder&&g.story.steps[g.story.index]?.type==='craft'){
   const order=g.currentOrder,isChris=order.actor==='chris';
   const wrong=isChris?chrisWrong&&chrisAttempts++===0:portWrong;
   if(!isChris)portAttempts++;
   const selected=wrong?(order.cocktail==='gin_tonic'?'gin_fizz':'gin_tonic'):order.cocktail;
   g.openRecipes();g.selectCocktail(selected);assert.equal(g.screen,'prep');
   // A poor matching cocktail must still take the matching-recipe dialogue.
   g.debugCraft(wrong?'excellent':'poor');tick(g,1.4);assert.notEqual(g.offer(),false);tick(g,1);
   assert.equal(g.serve(order.seat,'drag'),true);continue;
  }
  tick(g,.2);
 }
 assert.equal(g.finished,true,JSON.stringify({variant,lang,choice,chrisWrong,portWrong,index:g.story?.index}));
 const texts=g.history.map(h=>h.text),has=t=>texts.some(s=>s.includes(t));
 assert.equal(has('제대로 들어, 네가 안 외우면'),choice===1);assert.equal(has('잘 듣고 있었군.'),choice===2);
 assert.equal(has('네가 재능이 하나만 있는 게 아니라'),!chrisWrong);assert.equal(has('내가 지시한 건 진 토닉이야.'),chrisWrong);
 assert.equal(has('솜씨는 나쁘지 않네.'),!portWrong);assert.equal(has('맛이 다른데?'),portWrong);
 assert(has('제게 다른 재능도 있나요?')&&has('먼저 가보겠습니다.'));assert.equal(portAttempts,1);
 assert.equal(texts.filter(t=>t==='그래. 네 몫이니까 편하게 받아.').length,1);
 assert.equal(g.progress.flags.day0_port_tip_received,true);
 assert(!has('진 피즈의 역사'));
 assert.equal(g.transactions.length,chrisWrong?3:2);assert.equal(g.progress.flags.d1_tutorial_retry,false);
 assert.equal(g.transactionIds.size,g.transactions.length);assert.equal(g.currentOrder,null);
 assert(!g.logs.some(e=>e.event==='step'&&e.type==='exit'));
 assert(g.logs.some(e=>e.event==='story_coaster'));
 const before=g.progress.money;g.confirmDailySettlement();assert.equal(g.progress.money,before);
 runs++;
}
// Repeated failure is bounded to the same one-remake opportunity as the previous tutorial.
{
 const g=new C.Game(D);g.reset(0,'regular',3);let attempts=0;
 for(let i=0;i<1500&&!g.finished;i++){
  if(g.transition){tick(g,1.1);continue;}if(g.storyCoaster){if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;g.coaster(g.storyCoaster.seat,'drag');continue;}if(g.choice){g.choose(2);continue;}if(g.dialogue){g.advance();g.advance();continue;}
  if(g.currentOrder){const o=g.currentOrder;g.openRecipes();g.selectCocktail(o.cocktail==='gin_tonic'?'gin_fizz':'gin_tonic');g.debugCraft();g.offer();g.serve(o.seat);attempts++;continue;}tick(g,.2);
 }
 assert(g.finished);assert.equal(attempts,3);assert.equal(g.error,null);
}
console.log('DAY0_NOTION_OK',runs,'branch/language/version combinations + bounded repeated failure');
