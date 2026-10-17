const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(root+'/data.js','utf8'),ctx);
const C=require('../core.js'),R=require('../remix.js'),D=ctx.window.LUNA_DATA;
const line=(actor,text)=>({type:'say',actor,'text.ko':text});
function fixture(variant='original',steps=[line('tom','첫 대사'),line('luna','다음 대사'),{type:'coaster',actor:'tom'},line('tom','주문해도 될까?'),{type:'order',actor:'tom',arg:'exact:dry_martini'}]){
 const g=new C.Game(D);R.attach(g);g.reset(1,'regular',42,false,{variant});g.phase='regular';g.seats={L:{actor:'tom',coaster:false,state:'STORY'},M:null,R:{actor:'chris',coaster:false,state:'STORY'}};
 g.story={scene:{id:'coaster-test'},steps,index:0};g.pump();return g;
}
// Real campaign scripts, not just fixtures: first seated regular on each later day.
for(const file of ['campaign-data.js','campaign-engine.js'])vm.runInNewContext(fs.readFileSync(root+'/'+file,'utf8'),ctx);
for(const day of [1,2,3]){
 const data=C.millilitreData(structuredClone(D)),g=new C.Game(data),session=new ctx.window.LunaCampaignEngine.Session(g,data,ctx.window.LUNA_CAMPAIGN_DATA);
 session.install();g.reset(day,'regular',42,false);g.progress.flags.campaign_selected_drink='gin_tonic';g.seedJohnnyPrerequisites();g.startStoryPhase('bar');
 for(let n=0;n<1000&&!g.storyCoaster;n++){if(g.overlay==='johnnyUnlock')g.confirmJohnnyUnlock();else if(session.pendingStep)session.finishStep();else if(g.choice)g.choose(1);else if(g.dialogue){g.advance();g.advance();}g.tick(.1);assert.equal(g.error,null);}
 assert(g.storyCoaster,'No first-guest coaster gate on campaign day '+day);assert.equal(g.storyCoaster.step.actor,{1:'shiba',2:'samho',3:'tom'}[day],'Skip non-ordering visitors');const seat=g.storyCoaster.seat;g.cameraMoving=false;g.cameraLeft=0;g.transition=0;if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;
 assert.equal(g.seats[seat].coaster,false);assert(g.coaster(seat,'drag'));assert(g.seats[seat].coaster);assert.equal(g.error,null);console.log('PASS real campaign day',day,'first guest requires manual coaster');
}
for(const variant of ['original','gpt']){
 const g=fixture(variant);assert.equal(g.storyCoaster.seat,'L');assert(!g.storyCoasterReady());assert.equal(g.coaster('L','drag'),false);
 g.advance();assert(g.storyCoasterReady());for(let i=0;i<20;i++)g.advance();g.finishLine();g.pump();assert.equal(g.story.index,0);assert.equal(g.seats.L.coaster,false);
 assert.equal(g.coaster('R','drag'),false);assert.equal(g.coaster('L'),false);
 for(const key of ['paused','hidden','cameraMoving','cameraLeft','transition','overlay']){g[key]=key==='overlay'?'settings':true;assert.equal(g.coaster('L','drag'),false,key);g[key]=key==='overlay'?null:false;}
 assert(g.coaster('L','drag'));assert.equal(g.story.index,1);assert.equal(g.history.length,1);assert.equal(g.dialogue.text,'다음 대사');assert.equal(g.storyCoaster,null);assert.equal(g.coaster('L','drag'),false);
 g.advance();g.advance();assert.equal(g.story.index,3);assert.equal(g.logs.filter(e=>e.event==='story_coaster').length,1);assert.equal(g.storyCoaster,null);
 const pair=fixture(variant,[line('tom','톰'),line('chris','크리스'),line('luna','둘 다 드렸어요.'),{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'order',actor:'chris',arg:'exact:bottle_beer'}]);pair.advance();pair.coaster('L','drag');assert.equal(pair.storyCoaster.seat,'R');pair.advance();assert(pair.coaster('R','drag'));assert.equal(pair.dialogue.actor,'luna');
 for(const actor of ['chris','tom']){
  const visitor=fixture(variant,[line(actor,'잠깐 들렀어요.'),{type:'coaster',actor},line(actor,'다음에 또 올게요.'),{type:'exit',actor},{type:'enter',actor,arg:actor==='tom'?'L':'R'},{type:'order',actor,arg:'exact:bottle_beer'}]);
  assert.equal(visitor.storyCoaster,null,'A future visit must not trigger a coaster now');visitor.advance();visitor.advance();
  assert.equal(visitor.story.index,2);assert.equal(visitor.storyCoaster,null);assert.equal(Object.values(visitor.seats).find(s=>s?.actor===actor).coaster,false,'Skip stale explicit coaster step');
 }
 const conditional=fixture(variant,[line('tom','인사만 할게.'),{type:'order',actor:'tom',arg:'exact:dry_martini',when:'flag.wants_drink'}]);assert.equal(conditional.storyCoaster,null,'Inactive order is not an order');
 const undecided=fixture(variant,[line('tom','마실지 고민 중이야.'),{type:'choice',arg:'test'},{type:'order',actor:'tom',arg:'exact:dry_martini'}]);assert.equal(undecided.storyCoaster,null,'Wait until order branch is resolved');
 const order=fixture(variant,[{type:'order',actor:'tom',arg:'exact:dry_martini'},{type:'craft',actor:'tom'}]);assert.equal(order.currentOrder,null);assert(order.coaster('L','drag'));assert.equal(order.currentOrder.cocktail,'dry_martini');assert(order.seats.L.coaster);
 const reset=fixture(variant);reset.reset(1,'general',4);assert.equal(reset.storyCoaster,null);
 console.log('PASS',variant,'first greeting gate, invalid input/pause, exactly-once dialogue/effects, explicit coaster dedupe, paired guests, no-text orders and reset');
}
