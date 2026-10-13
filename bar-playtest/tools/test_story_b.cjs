const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
for(const f of ['data','campaign-data','campaign-story-b','campaign-engine'])vm.runInNewContext(fs.readFileSync(`${root}/${f}.js`,'utf8'),ctx);
const C=require(root+'/core.js'),B=ctx.window.LUNA_CAMPAIGN_STORY_B,A=ctx.window.LUNA_CAMPAIGN_DATA;
// Reuse the existing interactive tutorial driver, without executing its test suite.
vm.runInThisContext(fs.readFileSync(__dirname+'/test_day0_notion.cjs','utf8').split("const fs=require")[0]);global.assert=assert;
for(const choice of [1,2])for(const wrong of [false,true]){
 const D=C.millilitreData(structuredClone(ctx.window.LUNA_DATA)),original=JSON.stringify(D.tables),g=new C.Game(D),s=new ctx.window.LunaCampaignEngine.Session(g,D,B);s.install();
 const tick=()=>{g.cameraMoving=false;g.cameraLeft=0;g.tick(.1);assert.equal(g.error,null);};let orders=[];s.onStep=step=>{assert.equal(step.type,'campaign_menu');g.progress.flags.campaign_selected_drink='gin_tonic';s.finishStep();};
 for(let day=0;day<4;day++){
  s.beginDay(day,s.carry);if(g.pendingDailyUnlocks)g.confirmDailyUnlocks();
  for(let i=0;i<30000&&!g.finished;i++){
   assert.equal(g.error,null);if(g.overlay==='johnnyUnlock'){g.confirmJohnnyUnlock();continue;}if(g.transition||g.cameraLeft){tick();continue;}
   if(g.tutorial?.beer){g.tutorial=null;g.progress.flags.day1_beer_taught=true;}
   if(g.tutorial){guide(g);continue;}
   if(g.choice){assert(g.choose(choice));continue;}if(g.dialogue){g.advance();g.advance();continue;}
   if(g.phase==='general'){
    const waiting=Object.entries(g.seats).find(([k,v])=>v&&['WAIT_COASTER','WAIT_SERVE'].includes(v.state));
    if(waiting){const [seat,v]=waiting;if(g.focus!==seat){g.focusSeat(seat);tick();continue;}if(v.state==='WAIT_COASTER'){g.coaster(seat);tick();continue;}if(v.order&&g.screen==='bar'){g.openRecipes();g.selectCocktail(v.order.cocktail);g.debugCraft('good');g.offer();g.serve(seat);continue;}}
    tick();continue;
   }
   if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft'){
    const o=g.currentOrder;const id=wrong&&day===0&&o.actor==='chris'&&!orders.some(x=>x.day===0&&x.actor==='chris')?'gin_fizz':o.cocktail;
    orders.push({day,actor:o.actor,id});g.openRecipes();g.selectCocktail(id);assert.equal(g.screen,'prep',id);g.debugCraft('good');g.offer();assert(g.serve(o.seat,'drag'));continue;
   }tick();
  }
  assert(g.finished,JSON.stringify({day,index:g.story?.index,step:g.story?.steps[g.story.index],tutorial:g.tutorial}));
  if(day===0)assert(g.history[0].text.includes('루나, 듣고 있나?'));
  assert(s.settle());if(day===2){g.progress.inventory={wild_dog:1,bitters:1};g.progress.flags.campaign_observation=true;s.carry=structuredClone(g.progress);}assert(s.endDay());
 }
 assert(orders.some(x=>x.day===1&&x.actor==='aili'&&x.id==='champagne'));
 assert(orders.some(x=>x.day===2&&x.actor==='port'&&x.id==='bottle_beer'));
 assert(orders.some(x=>x.day===3&&x.actor==='samho'&&x.id==='bottle_beer'));
 s.uninstall();assert.equal(JSON.stringify(D.tables),original);
 const a=new ctx.window.LunaCampaignEngine.Session(g,D,A);a.install();a.beginDay(0);assert(g.story.steps.some(r=>r['text.ko']==='…그럼 이제 한번 시작해 볼까?'));assert.equal(D.tables.cocktails.find(r=>r.id==='champagne').unlock_day,'2');a.uninstall();
 console.log('PASS B',choice,wrong,orders.length,'orders; A tables fully restored');
}
const all=[...B.day0Steps,...Object.values(B.opening).flat(),...Object.values(B.bar).flat(),...Object.values(B.scenes).flat()];
assert(all.filter(r=>r.type==='say').every(r=>r.text&&!r.text.includes('#선택지')&&!/\(출입문|\(포트가 칵테일/.test(r.text)));
assert.equal(B.scenes.johnny[0].tomPresent,true);assert(B.scenes.johnny.some(r=>r.served));
console.log('STORY_B_OK');
