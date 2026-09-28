const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);const D=ctx.window.LUNA_DATA,C=require(dir+'/core.js'),R=require(dir+'/remix.js');
function ticks(g,sec=1){for(let i=0;i<sec*10;i++)g.tick(.1);assert.equal(g.error,null);}
function reach(g,predicate,choice=1){for(let i=0;i<1000;i++){if(predicate(g))return;if(['seatExplore','seatIndicator','seatLegend'].includes(g.tutorial?.kind)){if(g.tutorial.kind==='seatExplore'){const seats=['L','M','R'],delta=Math.sign(seats.indexOf(g.tutorialSeatTarget())-seats.indexOf(g.focus));g.focusSeat(seats[seats.indexOf(g.focus)+delta]);ticks(g);}else g.continueBarTutorial();continue;}if(g.transition){ticks(g);continue;}if(g.choice)g.choose(choice);else if(g.dialogue){g.advance();g.advance();}else ticks(g,.2);}throw Error('State not reached: '+g.story?.index);}
for(const variant of ['original','gpt']){
 const g=new C.Game(D);R.attach(g);g.reset(0,'full',4,true,{variant});reach(g,g=>g.tutorial?.kind==='coaster');const index=g.story.index;
 assert.equal(g.seats.R.coaster,false);ticks(g,10);assert.equal(g.story.index,index);assert.equal(g.advance(),false);assert.equal(g.openRecipes(),false);assert.equal(g.openTutorialService(),false);
 assert.equal(g.coaster('L','drag'),false);assert.equal(g.coaster('R'),false);assert.equal(g.story.index,index);
 for(const blocker of ['overlay','paused','hidden','cameraMoving','cameraLeft','transition']){g[blocker]=blocker==='overlay'?'settings':true;assert.equal(g.coaster('R','drag'),false,blocker);g[blocker]=blocker==='overlay'?null:blocker==='cameraLeft'||blocker==='transition'?0:false;}
 assert.equal(g.coaster('R','drag'),true);assert.equal(g.coaster('R','drag'),false);assert.equal(g.tutorial,null);ticks(g);assert.equal(g.dialogue.text,'이렇게요?');
 reach(g,g=>g.tutorial?.kind==='recipe');assert.equal(g.currentOrder.cocktail,'gin_tonic');assert.equal(g.openRecipes(),false);const rindex=g.story.index;g.advance();ticks(g,5);assert.equal(g.story.index,rindex);
 g.overlay='settings';assert.equal(g.openTutorialService(),false);g.overlay=null;assert.equal(g.openTutorialService(),true);g.overlay='service';assert.equal(g.openRecipes(),false);g.overlay=null;assert.equal(g.openRecipes(),true);
 assert.equal(g.tutorial.kind,'recipeSelect');assert.equal(g.closeRecipes(),false);assert.equal(g.selectCocktail('gin_fizz'),false);assert.equal(g.selectCocktail('gin_tonic'),true);assert.equal(g.tutorial.kind,'prepRecipeOpen');
 assert.equal(g.startCraft(),false);assert.equal(g.prepBack(),false);assert.equal(g.pickItem('gin'),false);assert.equal(g.tutorialEvent('read'),false);
 for(const [event,next] of [['recipeOpen','prepRecipeRead'],['read','prepRecipeClose'],['recipeClose',variant==='gpt'?'prepNavigate':'prepGlass']]){g.overlay='settings';assert.equal(g.tutorialEvent(event),false);g.overlay=null;assert.equal(g.tutorialEvent(event),true);assert.equal(g.tutorial.kind,next);}
 if(variant!=='gpt'){assert.equal(g.pickItem('soda_water'),false);g.pickItem('long_drink');assert.equal(g.tutorial.kind,'prepNavigate');assert.equal(g.tutorialEvent('shelf','tool'),false);}
 assert(g.tutorialEvent('shelf','liquor'));assert(g.tutorialEvent('hover'));
 assert.equal(g.pickItem('rum'),false);g.pickItem('gin');assert.equal(g.tutorial.kind,'prepRemove');assert(g.prep.ingredients.includes('gin'));g.pickItem('gin');assert(!g.prep.ingredients.includes('gin'));
 if(variant!=='gpt'){assert.equal(g.tutorial.kind,'prepGinAgain');g.pickItem('gin');assert.equal(g.tutorial.kind,'prepSodaNavigate');assert(g.tutorialEvent('shelf','fridge'));assert(g.tutorialEvent('hover'));g.pickItem('soda_water');assert.equal(g.tutorial.kind,'prepStart');g.overlay='settings';assert.equal(g.startCraft(),false);g.overlay=null;assert(g.startCraft());assert.equal(g.screen,'gimmick');assert.deepEqual(g.craft.actual.ingredients,['gin','soda_water']);assert.equal(g.craft.actual.glass,'long_drink');}
 assert.equal(g.tutorial,null);assert.equal(g.progress.flags.day0_recipe_taught,true);
 assert.equal(g.logs.filter(x=>x.event==='tutorial_complete').length,variant==='original'?5:3);
 g.reset(0,'full',4,true,{variant});reach(g,g=>g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft',2);assert.equal(g.tutorial,null);assert(g.openRecipes());
 g.reset(0,'full',4,true,{variant});reach(g,g=>g.tutorial?.kind==='coaster');g.reset(1,'regular',4,true,{variant});assert.equal(g.tutorial,null);
 g.reset(0,'full',4,true,{variant});reach(g,g=>g.tutorial?.kind==='coaster');assert.equal(g.coaster('R','keyboard'),true);ticks(g);assert.equal(g.dialogue.text,'이렇게요?');
 console.log('TUTORIAL_CORE_OK',variant,'waits, invalid inputs, pause/camera, idempotency, skip, reset, keyboard fallback');
}
const normal=new C.Game(D);normal.reset(99,'general',4);ticks(normal,6);assert.equal(normal.tutorial,null);assert.equal(normal.coaster(),true);
console.log('GENERAL_COASTER_UNCHANGED');
