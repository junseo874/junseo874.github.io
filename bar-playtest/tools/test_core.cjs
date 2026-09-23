const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(dir+'/data.js','utf8'),ctx);const D=ctx.window.LUNA_DATA,C=require(dir+'/core.js');let passed=0;
function test(name,fn){try{fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
function game(day=99,mode='full'){const g=new C.Game(D);g.reset(day,mode,42);g.dialogSpeed=20;return g;}
function ticks(g,seconds){for(let t=0;t<seconds;t+=.1)g.tick(.1);assert.equal(g.error,null,g.error);}
function actual(c){return {selected:c.id,glass:c.glass,tool:c.mix==='shake'?'shaker':c.mix==='stir'?'mixing_glass':null,ingredients:D.tables.recipes.filter(r=>r.context===c.id&&!r.auto_apply).map(r=>r.ingredient)};}
function perfect(c,a=actual(c)){return C.buildQueue(D,c,a).map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));}
function completeCraft(g,grade='excellent',id){g.selectCocktail(id||g.currentOrder?.cocktail);assert.equal(g.screen,'prep');g.debugCraft(grade);assert.equal(g.error,null,g.error);g.offer();g.serve(g.currentOrder?.seat||g.focus);assert.equal(g.error,null,g.error);}
function drive(g,choiceStrategy=()=>1,gradeStrategy=()=> 'excellent',limit=5000){let crafts=0;for(let i=0;i<limit&&!g.finished;i++){
 assert.equal(g.error,null,g.error);if(g.transition){ticks(g,1);continue;}
 if(g.screen==='recipe'){completeCraft(g,gradeStrategy(crafts++));continue;}
 if(g.phase==='general'){
  const entries=Object.entries(g.seats).filter(([k,v])=>v);const target=entries.find(([k,v])=>v.state==='REACTION'||v.state==='ORDER_DIALOGUE')||entries.find(([k,v])=>v.state==='WAIT_COASTER'||v.state==='WAIT_SERVE')||entries[0];
  if(target){const [seat,x]=target;if(g.focus!==seat){g.focusSeat(seat);ticks(g,.7);}if(x.state==='WAIT_COASTER')g.coaster();else if(x.state==='WAIT_SERVE'){g.openRecipes();completeCraft(g,'excellent',x.order.cocktail);}}
  ticks(g,.2);continue;
 }
 if(g.dialogue){g.advance();g.advance();continue;}if(g.choice){g.choose(choiceStrategy(g.choice.step.arg,g));continue;}ticks(g,.2);
 }
 assert.equal(g.error,null,g.error);assert.equal(g.finished,true,'did not terminate: '+g.phase+' '+g.story?.scene?.id+' / '+g.story?.index);return crafts;}
test('all 29 recipes: correct Actual Craft → 100 / Excellent',()=>{for(const c of D.tables.cocktails){const a=actual(c),r=C.scoreCraft(D,c,a,perfect(c),2);assert.equal(r.score,100,c.id);assert.equal(r.grade,'excellent',c.id);}});
test('quantity half-open bands and overtime boundaries',()=>{assert.equal(C.band(D.tables.score_bands,'quantity',.04999),100);assert.equal(C.band(D.tables.score_bands,'quantity',.05),90);assert.equal(C.band(D.tables.score_bands,'quantity',.35),0);assert.equal(C.band(D.tables.score_bands,'overtime',0),0);});
test('mix omission scores zero for mix plus tool penalty',()=>{const c=D.tables.cocktails.find(c=>c.id==='gin_fizz'),a=actual(c);a.tool=null;const r=C.scoreCraft(D,c,a,perfect(c,a),2);assert.equal(r.penalties.tool,10);assert.equal(r.representatives.find(x=>x.family==='shake').mean,0);assert(r.score<60);});
test('build is a recipe method, not an extra gimmick',()=>{const c=D.tables.cocktails.find(c=>c.id==='gin_tonic');assert.deepEqual(C.buildQueue(D,c,actual(c)).map(q=>q.type),['pour','fill_up']);});
test('build rejects extra mixing tools once, but never the auxiliary bottle opener',()=>{
 for(const c of D.tables.cocktails.filter(c=>(c.target_mix_method||c.mix)==='build')){
  for(const tool of [null,'shaker','mixing_glass'])for(const opener of [false,true]){
   const a={...actual(c),tool,opener},r=C.scoreCraft(D,c,a,perfect(c,a),2);
   assert.equal(r.penalties.tool,tool?10:0,c.id+' / '+tool);assert.equal(r.penalties.gimmick,0);
   assert.equal(r.score,tool?90:100);
  }
 }
 for(const c of D.tables.cocktails.filter(c=>['shake','stir'].includes(c.target_mix_method||c.mix))){
  const a=actual(c);a.tool=a.tool==='shaker'?'mixing_glass':'shaker';
  const r=C.scoreCraft(D,c,a,perfect(c,a),2);assert.equal(r.penalties.tool,10);
  assert.equal(r.representatives.find(x=>x.family===(c.target_mix_method||c.mix)).mean,0);
 }
});
test('gimmick keys reject unrelated inputs before starting clocks or changing judgments',()=>{
 for(const type of ['open','pour','fill_up','shake','stir']){
  const g=game(99,'practice');g.selectCocktail(type==='open'?'bottle_beer':type==='shake'?'gin_fizz':type==='stir'?'dry_martini':'gin_tonic');g.debugFill();g.startCraft();
  g.craft.index=g.craft.queue.findIndex(q=>q.type===type);assert(g.craft.index>=0);g.nextGimmick();
  const wrong=type==='stir'?['Space','Enter','KeyE']:['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'];
  const initial=JSON.stringify(g.gimmick);
  for(const key of wrong)assert.equal(g.gimmickInput(key),false,type+' / '+key);
  ticks(g,.5);assert.equal(JSON.stringify(g.gimmick),initial);assert.equal(g.craft.elapsed,0);
  assert.equal(g.gimmickInput(type==='stir'?'KeyW':'Space'),true);ticks(g,.1);
  const started=JSON.stringify(g.gimmick);for(const key of wrong)assert.equal(g.gimmickInput(key),false);
  assert.equal(JSON.stringify(g.gimmick),started);assert(g.craft.elapsed>0);
  g.overlay='settings';assert.equal(g.gimmickInput(type==='stir'?'KeyD':'Space'),false);assert.equal(JSON.stringify(g.gimmick),started);
  g.overlay=null;g.gimmick.completed=true;assert.equal(g.gimmickInput(type==='stir'?'KeyD':'Space'),false);
 }
});
test('opening failure penalty and score normalisation',()=>{const c=D.tables.cocktails.find(c=>c.id==='bottle_beer'),a=actual(c),results=perfect(c);results.find(r=>r.type==='open').failures=2;const r=C.scoreCraft(D,c,a,results,2);assert.equal(r.representatives.find(r=>r.family==='open').mean,70);assert.equal(r.score,90);});
test('atomic effects failure leaves original progress untouched',()=>{const s={money:300,flags:{},affinity:{}};assert.throws(()=>C.applyEffects('money += 10; arbitrary = 1',s));assert.equal(s.money,300);C.applyEffects('money += 10; flag.x = true; affinity.chris += 2',s);assert.equal(s.money,310);assert.equal(s.flags.x,true);});
test('day 0 complete normal flow and stable settlement IDs',()=>{const g=game(0);drive(g);assert(g.transactions.length>=2);assert.equal(g.transactionIds.size,g.transactions.length);assert(g.progress.flags.chris_met);console.log('  Day 0 orders',g.transactions.length,'lines',g.history.length);});
test('day 0 Poor first attempt triggers remake, then completes',()=>{const g=game(0);drive(g,()=>1,i=>i===0?'poor':'excellent');assert.equal(g.progress.flags.d1_tutorial_retry,false);assert(g.transactions.length>=3);assert(g.logs.some(e=>e.event==='step'&&e.seq==='75'));});
test('day 1 opening → general guests → regular guests → settlement',()=>{const g=game(1);drive(g);assert(g.logs.some(e=>e.phase==='general'));assert(g.transactions.some(t=>t.phase==='general'));assert(g.transactions.some(t=>t.phase==='regular'));console.log('  Day 1 orders',g.transactions.length,'lines',g.history.length);});
test('day 2 existing general content and empty regular script',()=>{const g=game(2);drive(g);assert(g.transactions.length>0);assert(!g.transactions.some(t=>t.phase==='regular'));});
test('empty day 3 is not filled with invented story',()=>{const g=game(3);assert.equal(g.finished,true);assert.equal(g.history.length,0);});
test('all Day 99 main branches, paired seats, normal/retry order',()=>{const g=game(99);const visited=new Set();drive(g,(id)=>{if(id==='ch_t99_main'){for(const x of [1,2,3])if(!visited.has('main'+x)){visited.add('main'+x);return x;}return 4;}if(id==='ch_t99_branch'){for(const x of [1,2,3])if(!visited.has('branch'+x)){visited.add('branch'+x);return x;}return 4;}if(id==='ch_t99_stage'){for(const x of [1,2])if(!visited.has('stage'+x)){visited.add('stage'+x);return x;}return 3;}if(id==='ch_t99_bar'){for(const x of [1,2,3])if(!visited.has('bar'+x)){visited.add('bar'+x);return x;}return 4;}if(id==='ch_t99_back2'||id==='ch_t99_back3')return 1;if(id==='ch_t99_back4'||id==='ch_t99_back5')return 1;return 1;});assert(g.logs.some(e=>e.scene==='t99_two_guests'));assert.equal(g.logs.filter(e=>e.event==='effect_preview').length,3);assert(g.transactions.length>=4);console.log('  QA orders',g.transactions.length,'lines',g.history.length);});
test('general coaster focus, reask, menu pause and timeout wins',()=>{const g=game(99,'general');ticks(g,5.2);const guest=g.seats.L;assert(guest);assert.equal(g.coaster('M'),false);assert.equal(g.coaster(),true);ticks(g,7);assert.equal(guest.state,'WAIT_SERVE');const before=guest.left;assert.equal(g.reask(),true);assert(Math.abs(guest.left-(before-guest.limit*.1))<1e-8);const charged=guest.left;assert.equal(g.reask(),false);assert.equal(guest.left,charged);g.overlay='sales';ticks(g,5);assert.equal(guest.left,charged);g.overlay=null;g.openRecipes();g.selectCocktail(guest.order.cocktail);g.debugCraft();g.offer();guest.left=.01;ticks(g,.1);assert.equal(guest.state,'EXITING');assert.equal(g.serve('L'),false);ticks(g,3.2);assert.equal(g.seats.L,null);});
test('preparation Back clears every actual choice but keeps recipes open',()=>{const g=game(99,'practice');g.selectCocktail('gin_fizz');g.debugFill();g.prepBack();assert.equal(g.screen,'recipe');assert.equal(g.prep,null);g.selectCocktail('gin_fizz');assert.equal(g.prep.glass,null);assert.equal(g.prep.ingredients.length,0);});
test('order mismatch and missing core are serving-only Sewage',()=>{const g=game(99,'practice'),c=g.cocktail('gin_tonic'),a=actual(c),r=C.scoreCraft(D,c,a,perfect(c),2);r.id='test';assert.equal(r.grade,'excellent');assert.equal(g.resolveServe({id:'a',cocktail:'gin_fizz'},r).grade,'sewage');a.ingredients=['soda_water'];const missing=C.scoreCraft(D,c,a,perfect(c,a),2);assert.notEqual(missing.grade,'sewage');assert.equal(g.resolveServe({id:'b',cocktail:c.id},missing).grade,'sewage');});
test('menus and transitions never add craft manual time',()=>{const g=game(99,'practice');g.selectCocktail('gin_tonic');g.debugFill();g.startCraft();ticks(g,2);assert.equal(g.craft.elapsed,0);g.holdPour(true);ticks(g,1);assert(g.craft.elapsed>=.9);const t=g.craft.elapsed;g.overlay='recipe';ticks(g,4);assert.equal(g.craft.elapsed,t);});
test('opening ring, shake rhythm and clockwise stirring accept real inputs',()=>{
 const opener=game(99,'practice');opener.selectCocktail('bottle_beer');opener.debugFill();opener.startCraft();assert.equal(opener.gimmick.type,'open');opener.gimmickInput('Space');for(let i=0;i<16;i++)opener.tick(.1);opener.gimmickInput('Space');assert.equal(opener.gimmick.completed,true);assert.equal(opener.gimmick.failures,0);opener.endGimmick();assert.equal(opener.gimmick.type,'pour');
 const shaker=game(99,'practice');shaker.selectCocktail('gin_fizz');shaker.debugFill();shaker.startCraft();shaker.craft.index=shaker.craft.queue.findIndex(q=>q.type==='shake');shaker.nextGimmick();shaker.gimmickInput('Space');for(let i=0;i<1100&&!shaker.gimmick.completed;i++){shaker.tick(.02);if(shaker.gimmick.beatTime>=.72&&!shaker.gimmick.hit)shaker.gimmickInput('Space');}assert.equal(shaker.gimmick.success,20);assert.equal(shaker.gimmick.attempts,20);
 const stir=game(99,'practice'),recipe=D.tables.cocktails.find(c=>c.mix==='stir');stir.selectCocktail(recipe.id);stir.debugFill();stir.startCraft();stir.craft.index=stir.craft.queue.findIndex(q=>q.type==='stir');stir.nextGimmick();stir.gimmickInput('KeyW');for(let i=0;i<10;i++)for(const key of ['KeyD','KeyS','KeyA','KeyW']){stir.tick(.15);stir.gimmickInput(key);}assert.equal(stir.gimmick.success,10);assert.equal(stir.gimmick.completed,true);
});
test('multi-order settlement and old glass is removed only at offering',()=>{const g=game(99,'general');ticks(g,5.2);const guest=g.seats.L;guest.maxRounds=2;g.coaster();ticks(g,6);g.openRecipes();completeCraft(g,'excellent',guest.order.cocktail);assert(guest.glass);ticks(g,7);assert.equal(guest.state,'WAIT_SERVE');assert.equal(g.transactions.length,1);const old=guest.glass;g.openRecipes();g.selectCocktail(guest.order.cocktail);g.debugCraft();assert.equal(guest.glass,old);g.offer();assert.equal(guest.glass,null);assert.equal(guest.coaster,true);g.serve('L');ticks(g,5);assert.equal(g.transactions.length,2);});
test('2,000 guest appearances obey all exclusion pairs after art fallback',()=>{const g=game(99,'practice');for(let i=0;i<2000;i++){const a=g.appearance();for(const e of D.tables.guest_exclusions)assert(!(a.ids.includes(e.a)&&a.ids.includes(e.b)));assert.equal(a.layers.length>=6,true);}});
test('dialogue speed tags and complete-text reveal',()=>{const g=game();g.dialogSpeed=1;const d=g.makeLine('chris','<slow>가나</slow><fast>다라</fast>');assert.deepEqual(d.timings,[120,120,20,20]);g.typeLine(d,.08);assert.equal(d.chars,1);g.typeLine(d,.107);assert.equal(d.chars,4);});
test('faster default typing leaves source timing and automatic read hold unchanged',()=>{
 const g=new C.Game(D);assert.equal(g.dialogSpeed,1);const interval=g.c('typing_interval_ms',50),d=g.makeLine('chris','가나다라마바사아자차');g.typeLine(d,interval*2/1000);assert.equal(d.chars,3);assert(d.timings.every(t=>t===interval));
 g.reset(99,'general',7);ticks(g,5.2);const guest=g.seats.L,line=g.makeLine(guest.actor,'주문을 기다리고 있습니다.');line.chars=line.text.length;guest.lines=[line];guest.lineIndex=0;guest.lineDone=null;g.typeLine(g.makeLine('chris','확인'),.1);g.tick(.1);assert(Math.abs(line.hold-.1)<1e-8);
});
test('recipe menu cannot discard a live gimmick or finished drink',()=>{const g=game(99,'practice');g.selectCocktail('gin_tonic');g.debugFill();g.startCraft();assert.equal(g.openRecipes(),false);assert.equal(g.screen,'gimmick');});
test('upkeep uses day data, QA fallback, and a separate validated web override',()=>{const g=game(0);assert.deepEqual(g.upkeepInfo(),{amount:0,source:'days.csv'});g.setUpkeepOverride('600');assert.deepEqual(g.upkeepInfo(),{amount:600,source:'web_test'});g.setUpkeepOverride('');assert.equal(g.upkeepInfo().amount,0);for(const value of [-1,1.5,'not-money',Infinity])assert.throws(()=>g.setUpkeepOverride(value));assert.equal(D.tables.days.find(x=>x.day==='0').upkeep_gold,'0');const qa=game(99);assert.deepEqual(qa.upkeepInfo(),{amount:0,source:'qa_default'});});
test('daily ledger includes already-committed revenue without adding it twice',()=>{const g=game(99,'practice');g.setUpkeepOverride(100);g.selectCocktail('gin_tonic');g.debugCraft();g.offer();g.serve('L');const before=g.progress.money,net=g.totals().net;g.finishDay();assert.equal(g.progress.money,before);assert.equal(g.dailySettlement.status,'pending');assert.equal(g.dailySettlement.balanceBefore,300+net);assert.equal(g.confirmDailySettlement(),true);assert.equal(g.progress.money,before-100);assert.equal(g.dailySettlement.status,'paid');assert.equal(g.screen,'settlement');});
test('exact upkeep balance can pay down to zero, not game over',()=>{const g=game(99,'practice');g.setUpkeepOverride(300);g.finishDay();g.confirmDailySettlement();assert.equal(g.progress.money,0);assert.equal(g.dailySettlement.status,'paid');assert.equal(g.phase,'complete');});
test('one G short shows settlement before game over, without partial deduction',()=>{const g=game(99,'practice');g.setUpkeepOverride(301);g.finishDay();assert.equal(g.screen,'settlement');assert.equal(g.dailySettlement.shortfall,1);assert.equal(g.progress.money,300);g.confirmDailySettlement();assert.equal(g.screen,'gameover');assert.equal(g.phase,'gameover');assert.equal(g.progress.money,300);assert.equal(g.dailySettlement.status,'failed');const time=g.realTime;g.tick(.2);assert.equal(g.realTime,time);});
test('zero upkeep completes normally and cannot be committed twice',()=>{const g=game(99,'practice');g.finishDay();g.confirmDailySettlement();assert.equal(g.progress.money,300);assert.equal(g.dailySettlement.status,'paid');assert.equal(g.confirmDailySettlement(),false);assert.equal(g.finishDay(),false);assert.equal(g.logs.filter(e=>e.event==='daily_upkeep_paid').length,1);});
test('positive upkeep and game over are both idempotent',()=>{for(const fee of [100,400]){const g=game(99,'practice');g.setUpkeepOverride(fee);g.finishDay();g.confirmDailySettlement();const balance=g.progress.money,status=g.dailySettlement.status;g.finishDay();g.confirmDailySettlement();assert.equal(g.progress.money,balance);assert.equal(g.dailySettlement.status,status);assert.equal(g.logs.filter(e=>e.event.startsWith('daily_upkeep_')).length,1);assert.equal(g.setUpkeepOverride(0),false);}});
test('retry clears the terminal state and uses explicitly passed upkeep settings',()=>{const g=game(99,'regular');g.setUpkeepOverride(999);g.finishDay();g.confirmDailySettlement();g.reset(g.day,g.mode,g.seed,true,{upkeepOverride:g.upkeepOverride});assert.equal(g.dailySettlement,null);assert.equal(g.finished,false);assert.equal(g.progress.money,300);assert.equal(g.upkeepInfo().amount,999);g.reset(0);assert.equal(g.upkeepInfo().amount,0);});
console.log(`\n${passed} test groups passed.`);
