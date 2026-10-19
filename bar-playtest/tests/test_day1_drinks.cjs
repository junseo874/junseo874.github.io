const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=process.argv[2]||path.resolve(__dirname,'..');
const dataRoot=process.argv[3]||root;
const C=require(root+'/src/core/core.js');
function setup(mode){
 const ctx={window:{}};
 for(const file of ['data/runtime/game-data.js','data/runtime/campaign-data.js'])vm.runInNewContext(fs.readFileSync(dataRoot+'/'+file,'utf8'),ctx);
 vm.runInNewContext(fs.readFileSync(root+'/src/features/campaign/campaign-engine.js','utf8'),ctx);
 const D=C.millilitreData(ctx.window.LUNA_DATA),g=new C.Game(D);
 if(mode!=='base')new ctx.window.LunaCampaignEngine.Session(g,D,ctx.window.LUNA_CAMPAIGN_DATA).install({developer:mode==='developer'});
 return {D,g,story:ctx.window.LUNA_CAMPAIGN_DATA};
}
for(const mode of ['base','campaign','developer']){
 const {D,g,story}=setup(mode);
 for(const day of [0,1,2]){
  g.reset(day,'regular',42);
  for(const id of ['red_wine','champagne']){
   assert.equal(g.cocktailsAvailable().some(c=>c.id===id),day>=2,mode+' cocktail '+day+' '+id);
   assert.equal(g.itemsAvailable().some(c=>c.id===id),day>=2,mode+' ingredient '+day+' '+id);
   if(day===2){assert(g.dailyUnlocks().cocktails.some(c=>c.id===id));assert(g.dailyUnlocks().ingredients.some(c=>c.id===id));}
  }
 }
 const contexts=new Set(D.tables.scenes.filter(r=>Number(r.day)===1).map(r=>r.id));
 const order=D.tables.steps.find(r=>contexts.has(r.context)&&r.type==='order'&&r.actor==='aili');
 assert(order,'Aili order exists');assert.equal(order.arg,'exact:gin_fizz');
 const rows=D.tables.steps.filter(r=>contexts.has(r.context));
 assert(!rows.some(r=>(r['text.ko']||'').includes('샴페인')));
 assert(story.bar[1].some(r=>r.actor==='aili'&&r.arg==='exact:gin_fizz'));
 g.reset(1,'regular',42);
 g.seats.M={actor:'aili',state:'WAIT_SERVE'};g.focus='M';g.dialogue=null;g.overlay=null;
 const scene=D.tables.scenes.find(r=>r.id===order.context);
 const steps=D.tables.steps.filter(r=>r.context===order.context).sort((a,b)=>Number(a.seq)-Number(b.seq));
 g.story={scene,steps,index:steps.findIndex(r=>r===order)+1};g.transition=0;g.tutorial=null;
 g.createStoryOrder(order);assert.equal(g.currentOrder.cocktail,'gin_fizz');
 g.openRecipes();g.selectCocktail('gin_fizz');assert.equal(g.screen,'prep');
 g.debugCraft('excellent');assert.equal(g.error,null);g.offer();
 assert.equal(g.serve(g.currentOrder.seat,'drag'),true);assert.equal(g.error,null);
 console.log('PASS '+mode+': day 0–2 unlocks and Aili gin fizz preparation/serving');
}
