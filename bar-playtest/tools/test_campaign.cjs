const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),root=path.resolve(__dirname,'..');
const ctx={window:{}};for(const f of ['data.js','campaign-data.js','campaign-engine.js'])vm.runInNewContext(fs.readFileSync(root+'/'+f,'utf8'),ctx);
const C=require(root+'/core.js'),D=C.millilitreData(ctx.window.LUNA_DATA),g=new C.Game(D),E=ctx.window.LunaCampaignEngine,s=new E.Session(g,D,ctx.window.LUNA_CAMPAIGN_DATA),original=JSON.stringify(D.tables);
const tick=()=>{g.cameraMoving=false;g.tick(.1);assert.equal(g.error,null);};
s.install();assert.equal(D.tables.cocktails.find(c=>c.id==='cosmopolitan').unlock_day,'2');assert.equal(D.tables.cocktails.find(c=>c.id==='dry_martini').unlock_day,'1');
let attempts=0;const events=[];s.onStep=step=>{events.push(step.type);if(step.type==='campaign_menu')g.progress.flags.campaign_selected_drink='gin_tonic';if(step.type==='campaign_memory')g.progress.flags.campaign_observation=true;s.finishStep();};
for(let day=0;day<=3;day++){
 s.beginDay(day,s.carry);if(day>0)assert.equal(g.progress.money,s.carry.money);if(g.pendingDailyUnlocks)g.confirmDailyUnlocks();
 // Full timeline, including ordinary service, is exercised through the core state machine.
 for(let i=0;i<30000&&!g.finished;i++){
  if(g.error)throw Error(g.error);if(g.transition||g.cameraLeft){tick();continue;}g.cameraMoving=false;
  if(g.tutorial?.beer){const t=g.tutorial.kind;if(t==='recipe'){g.openTutorialService();g.openRecipes();}else if(t==='recipeSelect')g.selectCocktail('bottle_beer');else if(t==='beerGlass')g.pickItem(g.cocktail('bottle_beer').glass);else if(t==='beerToolNavigate')g.tutorialEvent('shelf','tool');else if(t==='beerOpener')g.pickOpener();else if(t==='beerFridgeNavigate')g.tutorialEvent('shelf','fridge');else if(t==='beerAdd')g.pickItem('beer');else if(t==='beerStart')g.startCraft();continue;}if(g.gimmick?.openTutorial){g.gimmickInput('Space');g.gimmick.beatTime=g.c('open_approach_sec',1.6);g.gimmickInput('Space');g.gimmick.openFx.age=1;g.endGimmick();g.debugCraft('good');g.offer();attempts++;assert(g.serve(g.currentOrder.seat,'drag'));continue;}
  if(g.choice){g.choose(2);continue;}if(g.dialogue){g.advance();g.advance();continue;}
  if(g.phase==='general'){
   const waiting=Object.entries(g.seats).find(([seat,v])=>v&&['WAIT_COASTER','WAIT_SERVE'].includes(v.state));
   if(waiting){const [seat,v]=waiting;if(g.focus!==seat){g.focusSeat(seat);tick();continue;}if(v.state==='WAIT_COASTER'){g.coaster(seat);tick();continue;}
    if(v.order&&g.screen==='bar'){g.openRecipes();g.selectCocktail(v.order.cocktail);g.debugCraft('good');g.offer();g.serve(seat);attempts++;continue;}}
   tick();continue;
  }
  if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
   const order=g.currentOrder;g.openRecipes();g.selectCocktail(order.cocktail);g.debugCraft('good');assert.equal(s.problems(g.result).length,0,JSON.stringify(s.problems(g.result)));g.offer();assert.equal(g.serve(order.seat,'drag'),true);attempts++;continue;
  }tick();
 }
 assert(g.finished,'stalled '+JSON.stringify({day,phase:g.phase,screen:g.screen,index:g.story?.index,tutorial:g.tutorial}));assert.equal(s.settle(),true,'cannot settle day '+day);const money=g.progress.money;assert.equal(s.settle(),false);assert.equal(g.progress.money,money);assert.equal(s.endDay(),true);assert.equal(s.endDay(),false);
}
assert.equal(s.completed.join(','),'0,1,2,3');assert.equal(s.route,'ending');assert.deepEqual(events,[]);assert(attempts>=7);
// Restoration never accepts the wrong vessel, base, sequence, amount or missing stir.
g.day=3;g.phase='regular';g.currentOrder={cocktail:E.RESTORATION.id};const valid={selected:E.RESTORATION.id,actual:{glass:'old_fashioned',tool:'mixing_glass',ingredients:E.RESTORATION.ingredients.map(r=>r[0])},results:[...E.RESTORATION.ingredients.map(([ingredient,value])=>({type:ingredient==='sugar_cube'?'add':'pour',ingredient,value})),{type:'stir',completed:true}]};assert.equal(s.problems(valid).length,0);for(const mutate of [r=>r.actual.glass='mug',r=>r.actual.tool='shaker',r=>r.actual.ingredients.reverse(),r=>r.results[0].value+=6,r=>r.results.pop(),r=>r.selected='gin_tonic']){const r=JSON.parse(JSON.stringify(valid));mutate(r);assert(s.problems(r).length);}
s.uninstall();assert.equal(JSON.stringify(D.tables),original);assert.equal(g.campaignStep,null);assert(!D.assets.item_rye_whiskey);
console.log('CAMPAIGN_OK: days 0–3, ordinary+regular service, '+attempts+' drinks, carried balance, one-time settlement/sleep, script checkpoints, recipe validation, developer isolation');
