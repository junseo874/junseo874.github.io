// Exercise the saved editor graph AND the shipped game's serve/advance pipeline.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Model}=require('../src/dev/dialogue-editor/editor-model.js'),F=require('../src/dev/dialogue-editor/flow-model.js');
const C=require('../src/core/core.js'),remix=require('../src/features/bar/remix.js');
const preview=require('../src/dev/dialogue-editor/bar-preview-route.js');
const {snapshot}=require('../../tools/dialogue-editor-storage.cjs');
const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../data/runtime/game-data.js'),'utf8'),{window});
(async()=>{
 const snap=await snapshot(),model=await new Model(snap.files,snap.presentation).init();
 assert.deepEqual((await model.validate()).errors,[]);
 const grades=['sewage','poor','decent','good','excellent'];let drinks=0,cases=0;
 for(const scene of ['d1_tutorial_chris','campaign_d1_bar_open','campaign_d1_bar']){
  const graph=F.compile(model,scene),nodes=graph.nodes.filter(n=>n.rows.at(-1).type==='serve');
  assert.deepEqual(graph.errors,[]);
  for(const node of nodes){
   drinks++;
   const next=n=>graph.connections.filter(e=>e.from===n.id&&e.to).map(e=>graph.nodes.find(n=>n.id===e.to));
   const [hand]=next(node),[glass]=next(hand),pins=graph.connections.filter(e=>e.from===glass.id),actor=node.rows.at(-1).actor;
   assert.equal(hand.rows[0].actor,'luna');assert.equal(glass.type,'빈잔');
   const reactions=next(glass),joins=reactions.map(r=>next(r).map(n=>n.id));assert.deepEqual(joins,Array(4).fill(joins[0]));assert.equal(joins[0].length,1);
   const common=graph.nodes.find(n=>n.id===joins[0][0]).rows[0];
   assert.equal(pins.length,4);assert.match(pins[0].guard,/!order_match/);
   const trial=settings=>preview.create({model,graphFor:()=>graph,scene,node:glass,settings:{affinity:{[actor]:12,sentinel:37},...settings}});
   const defaultTrial=trial(),choices=defaultTrial.branches();
   assert.equal(choices.length,4);assert.deepEqual(defaultTrial.branches(),choices);
   for(const match of [false,true])for(const grade of grades){
    const g=new C.Game(window.LUNA_DATA);remix.attach(g);
    const day=scene==='d1_tutorial_chris'?0:1;
    g.reset(day,'practice',4,true,{variant:'original'});
    const steps=g.t.steps.filter(r=>r.context===scene).sort((a,b)=>a.seq-b.seq);
    const index=steps.findIndex(r=>r.row_id===node.rows.at(-1).web_row_id)-1;
    assert.equal(steps[index]?.type,'craft');
    const ordered=steps[index-1].arg.split(':')[1],selected=match?ordered:ordered==='gin_tonic'?'gin_fizz':'gin_tonic';
    const ctx={flags:{},order_match:match,final_grade:match?grade:'sewage'};
    const pin=pins.filter(e=>C.condition(e.guard,ctx));assert.equal(pin.length,1);
    const first=graph.nodes.find(n=>n.id===pin[0].to).rows[0];
    g.progress.flags.day0_skip_tutorial=true;g.progress.affinity[actor]=12;
    g.selectCocktail(selected);g.debugCraft(grade);g.phase=scene.endsWith('_open')?'opening':'regular';
    const seat=steps.slice(0,index).findLast(r=>r.type==='enter'&&r.actor===actor).arg;
    g.seats[seat]={actor,coaster:true};g.currentOrder={id:'test',actor,seat,cocktail:ordered};
    g.story={scene:{id:scene},steps,index,autos:[],cursor:0};
    g.offer();assert(g.serve(seat,'drag'));assert(!g.serve(seat,'drag'));
    const good=match&&grades.indexOf(grade)>=3,want=match?(good?5:grade==='decent'?0:-5):(scene==='d1_tutorial_chris'&&actor==='chris'?-5:0);
    let started=false,reacted=false,continued=false;
    for(let i=0;i<100;i++){
     assert(!g.error,String(g.error));
     if(g.logs.some(l=>l.event==='step'&&Number(l.seq)===Number(common.seq))){continued=true;break;}
     if(g.dialogue){
      if(!started){assert.equal(g.dialogue.step.row_id,hand.rows[0].web_row_id);assert.equal(g.seats[seat].glassEmpty,false);assert.equal(g.logs.filter(l=>l.event==='affinity').length,0);started=true;}
      else if(!reacted){assert.equal(g.dialogue.step.row_id,first.web_row_id);assert.equal(g.seats[seat].glassEmpty,true);assert.equal(g.progress.affinity[actor],12+want);reacted=true;}
      g.dialogue.chars=g.dialogue.text.length;g.advance();
     }else if(started&&!g.story)break;else g.tick(.1);
    }
    assert(started&&reacted&&continued);assert.equal(g.transactions.length,1);
    assert(g.logs.findIndex(l=>l.event==='affinity')>g.logs.findIndex(l=>l.event==='empty_glass'));
    assert.deepEqual(g.logs.filter(l=>l.event==='affinity').map(l=>[l.actor,l.delta]),[[actor,want]]);
    assert.equal(g.progress.affinity[actor],12+want);
    const sim=trial({craft_grade:grade,final_grade:g.resultContext.final_grade,order_match:match});
    const arm=choices.find(p=>p.target.node.id===pin[0].to);
    const delta=g.logs.find(l=>l.event==='affinity').delta;
    for(const [route,dest] of [[sim,sim.next()],[defaultTrial,arm.target]]){
     const source=route.current;
     assert.deepEqual(dest.affinityChange,{actor,delta});assert.equal(dest.node.id,pin[0].to);
     assert(route.enter(dest));
     const state=route.payload(dest.entry).previewState;
     assert.equal(state.affinity[actor],g.progress.affinity[actor]);assert.equal(state.affinity.sentinel,37);
     assert.equal(state.order_match,match);if(!match)assert.equal(state.final_grade,'sewage');
     const joined=route.next();assert.equal(joined.node.id,joins[0][0]);assert.equal(joined.ctx.affinity[actor],state.affinity[actor]);
     route.enter(source);assert.equal(route.current.ctx.affinity[actor],12);
    }
    assert.equal(g.logs.filter(l=>l.event==='empty_glass'&&l.actor===actor).length,1);
    cases++;
   }
  }
 }
 assert.equal(drinks,6);assert.equal(cases,60);
 console.log('PASS: six shared handoffs and empty glasses, 24 reactions, 60 real serve paths, exact affinity at the empty glass and six common joins.');
})().catch(e=>{console.error(e);process.exitCode=1;});
