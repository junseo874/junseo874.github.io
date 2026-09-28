function guide(g){switch(g.tutorial.kind){case 'coaster':g.coaster(g.tutorial.seat,'drag');break;case 'recipe':g.openTutorialService();g.openRecipes();break;case 'recipeSelect':g.selectCocktail('gin_tonic');break;case 'prepRecipeOpen':g.tutorialEvent('recipeOpen');break;case 'prepRecipeRead':g.tutorialEvent('read');break;case 'prepRecipeClose':g.tutorialEvent('recipeClose');break;case 'prepGlass':g.pickItem('long_drink');break;case 'prepNavigate':g.tutorialEvent('shelf','liquor');break;case 'prepHover':g.tutorialEvent('hover');break;case 'prepAdd':g.pickItem('gin');break;case 'prepRemove':g.pickItem('gin');if(!g.tutorial)g.prepBack();break;case 'prepGinAgain':g.pickItem('gin');break;case 'prepSodaNavigate':g.tutorialEvent('shelf','fridge');break;case 'prepSodaHover':g.tutorialEvent('hover');break;case 'prepSodaAdd':g.pickItem('soda_water');break;case 'prepStart':assert.equal(g.startCraft(),true);assert.equal(g.screen,'gimmick');g.cancelCraft();break;default:throw Error('Unknown tutorial stage: '+g.tutorial.kind);}}
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);
const D=ctx.window.LUNA_DATA,C=require(dir+'/core.js'),R=require(dir+'/remix.js');
const scene='d1_tutorial_chris',steps=D.tables.steps.filter(s=>s.context===scene);
assert.equal(steps.filter(s=>s.type==='say').length,106);
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

  if(g.choice){assert.equal(g.choice.step.arg,'ch_day0_notion_tutorial');g.choose(choice);continue;}
  if(g.dialogue){if(g.dialogue.id==='dlg_day0_notion_bar_122'){assert.equal(g.seats.R.actor,'chris');assert.equal(g.seats.L.actor,'port');}g.advance();g.advance();continue;}
  if(g.currentOrder&&g.story.steps[g.story.index]?.type==='craft'){
   const order=g.currentOrder,isChris=order.actor==='chris';
   const wrong=isChris?chrisWrong&&chrisAttempts++===0:portWrong;
   if(!isChris)portAttempts++;
   const selected=wrong?(order.cocktail==='gin_tonic'?'gin_fizz':'gin_tonic'):order.cocktail;
   g.openRecipes();g.selectCocktail(selected);assert.equal(g.screen,'prep');
   // A poor matching cocktail must still take the matching-recipe dialogue.
   g.debugCraft(wrong?'excellent':'poor');tick(g,1.4);assert.notEqual(g.offer(),false);tick(g,1);
   assert.equal(g.serve(order.seat),true);continue;
  }
  tick(g,.2);
 }
 assert.equal(g.finished,true,JSON.stringify({variant,lang,choice,chrisWrong,portWrong,index:g.story?.index}));
 const ids=g.history.map(h=>h.id),has=i=>ids.includes('dlg_day0_notion_bar_'+i);
 assert.equal(has(7),choice===1);assert.equal(has(19),choice===2);assert.equal(has(21),true);
 assert.equal(has(27),!chrisWrong);assert.equal(has(31),chrisWrong);assert.equal(has(34),chrisWrong);
 assert.equal(has(75),!portWrong);assert.equal(has(78),!portWrong);assert.equal(has(80),portWrong);assert.equal(has(82),portWrong);
 assert(has(36)&&has(85)&&has(120)&&has(122));assert.equal(portAttempts,1);
 assert.equal(g.transactions.length,chrisWrong?3:2);assert.equal(g.progress.flags.d1_tutorial_retry,false);
 assert.equal(g.transactionIds.size,g.transactions.length);assert.equal(g.currentOrder,null);
 assert(!g.logs.some(e=>e.event==='step'&&e.type==='exit'));
 assert.equal(g.logs.filter(e=>e.event==='story_coaster').length,choice===1?2:1);
 const before=g.progress.money;g.confirmDailySettlement();assert.equal(g.progress.money,before);
 runs++;
}
// Repeated failure is bounded to the same one-remake opportunity as the previous tutorial.
{
 const g=new C.Game(D);g.reset(0,'regular',3);let attempts=0;
 for(let i=0;i<1500&&!g.finished;i++){
  if(g.transition){tick(g,1.1);continue;}if(g.choice){g.choose(2);continue;}if(g.dialogue){g.advance();g.advance();continue;}
  if(g.currentOrder){const o=g.currentOrder;g.openRecipes();g.selectCocktail(o.cocktail==='gin_tonic'?'gin_fizz':'gin_tonic');g.debugCraft();g.offer();g.serve(o.seat);attempts++;continue;}tick(g,.2);
 }
 assert(g.finished);assert.equal(attempts,3);assert.equal(g.error,null);
}
console.log('DAY0_NOTION_OK',runs,'branch/language/version combinations + bounded repeated failure');
