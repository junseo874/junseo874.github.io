const assert=require('node:assert/strict');
const dir='../src/dev/dialogue-editor/';
const {create}=require(dir+'bar-preview-route.js'),flows=require(dir+'flow-model.js'),wiring=require(dir+'flow-wiring.js');
const outside=require(dir+'outside-flow-map.js'),{Model:Outside}=require(dir+'outside-model.js');
const {Model:Bar}=require(dir+'editor-model.js'),storage=require('../../tools/dialogue-editor-storage.cjs');
(async()=>{
 const source=await storage.snapshot(),bar=await new Bar(source.files,source.presentation).init();
 const scene='d1_tutorial_chris',graphFor=id=>flows.compile(bar,id),choice=graphFor(scene).nodes.find(n=>n.rows[0].type==='choice');
 const run=create({model:bar,scene,node:choice,graphFor,picks:{}});
 const [teach,skip]=run.payload(0).choices,teachTarget=run.next(teach),skipTarget=run.next(skip);
 assert(run.next().needsChoice);assert.equal(run.node.id,choice.id,'looking or picking does not enter a node');
 assert.notEqual(teachTarget.node.id,skipTarget.node.id);assert.equal(teachTarget.ctx.flags.day0_skip_tutorial,false);assert.equal(skipTarget.ctx.flags.day0_skip_tutorial,true);
 assert.deepEqual(run.next(teach).ctx,teachTarget.ctx,'reselecting must not reapply effects');
 const alternatives=run.branches();assert.deepEqual(alternatives.map(b=>b.pick.row_id),[teach.row_id,skip.row_id]);
 assert.deepEqual(alternatives.map(b=>b.target.ctx.flags.day0_skip_tutorial),[false,true]);
 assert.equal(run.node.id,choice.id);assert.deepEqual(run.branches(),alternatives,'listing or dismissing alternatives is side-effect free');
 run.enter(skipTarget);assert.equal(run.payload(0).rows.at(run.payload(0).index).row_id,skipTarget.node.id);
 assert.equal(run.payload(0).picks[choice.id].row_id,skip.row_id);
 assert(!run.payload(0).rows.some(r=>r.row_id===teachTarget.node.id),'skipped branches must not affect the next picture');
 const direct=create({model:bar,scene,node:teachTarget.node,graphFor,settings:{flags:{day0_skip_tutorial:true}}});
 assert.equal(direct.payload(0).previewState.flags.day0_skip_tutorial,false,'opening a guarded node directly must continue its own branch');
 assert.notEqual(direct.next().node.id,skipTarget.node.id);
 const recipe=graphFor(scene).nodes.find(n=>n.type==='칵테일 제공'),served=create({model:bar,scene,node:recipe,graphFor});
 const servingOptions=served.branches();assert.deepEqual(servingOptions.map(b=>[b.guard,b.target.ctx.order_match,b.assumed]),[['order_match',true,false],['!order_match',false,true]]);
 assert.equal(served.next().ctx.order_match,true);served.enter(servingOptions[1].target);assert.equal(served.payload(0).previewState.order_match,false);
 const convergedScene='campaign_d1_bar',converged=graphFor(convergedScene).nodes.find(n=>n.id==='kihyun_campaign_d1_bar_153');
 const same=create({model:bar,scene:convergedScene,node:converged,graphFor}).branches();
 assert.equal(same.length,2);assert.equal(same[0].target.node.id,same[1].target.node.id);assert.notEqual(same[0].pick.row_id,same[1].pick.row_id);
 assert(!bar.dirty());
 // Real, unsaved forward wire: hidden effect rows must be executed, not presented as nodes.
 const choices=bar.choices(choice.rows[0].arg),target=graphFor(scene).nodes.find(n=>n.id===skipTarget.node.id);
 wiring.wire(bar,scene,choice,target,{choice:choices[1].row_id,predicate:''});
 const wired=graphFor(scene),start=wired.nodes.find(n=>n.id===choice.id);
 const route=create({model:bar,scene,node:start,graphFor}),to=route.next(route.payload(0).choices[1]);
 assert.equal(to.node.id,target.id);assert(to.before.some(r=>wiring.owns(r.effects?.split(' = ')[0]||'')));
 assert.equal(route.branches().find(p=>p.pick.row_id===choices[1].row_id).target.node.id,to.node.id);
 // A cross-script choice carries flags/economy into the destination; a missing target isn't a random fallback.
 const from='campaign_d1_bar',other=bar.scenes.find(s=>s.id==='campaign_d1_bar_open'),sourceChoice=graphFor(from).nodes.find(n=>n.rows[0].type==='choice');
 const opt=bar.choices(sourceChoice.rows[0].arg)[0];bar.set(opt,'goto',other.id);bar.set(opt,'effects','flag.preview_check = true; money += 9');
 const jump=create({model:bar,scene:from,node:sourceChoice,graphFor,settings:{money:12}});
 const firstOption=jump.payload(0).choices[0],arrival=jump.next(firstOption);assert.equal(arrival.lane.id,other.id);assert.equal(arrival.ctx.money,21);assert.equal(arrival.ctx.flags.preview_check,true);
 const cross=jump.branches().find(b=>b.pick.row_id===firstOption.row_id);assert.equal(cross.target.lane.id,other.id);assert.equal(cross.target.ctx.money,21);
 assert.equal(jump.scene,from);jump.enter(arrival);assert.equal(jump.scene,other.id);
 bar.set(opt,'when','money >= 70');
 const gated=()=>create({model:bar,scene:from,node:sourceChoice,graphFor,settings:{money:12}});
 const trial=gated(),lockedPath=trial.branches().find(b=>b.pick.row_id===opt.row_id);
 assert.equal(lockedPath.assumed,true);assert.equal(lockedPath.target.ctx.money,79);assert.equal(trial.payload(0).previewState.money,12);
 bar.set(opt,'goto','missing_draft_scene');const partial=gated().branches();
 assert(partial.find(p=>p.pick.row_id===opt.row_id).blocked);assert(partial.find(p=>p.pick.row_id!==opt.row_id).target.node,'one broken draft link must not hide valid siblings');
 bar.set(opt,'goto',other.id);bar.set(opt,'when','');
 // Two unsaved conditional pins, plus the unmodified fallback. Only the
 // chosen result changes: the two other reachable contexts remain independent.
 const scene2=other.id,serve2=graphFor(scene2).nodes.find(n=>n.type==='칵테일 제공'),after=graphFor(scene2).nodes.filter(n=>n.index>serve2.index);
 const g1='order_match && craft_grade >= good && money >= 50',g2='final_grade == excellent';
 for(const [cond,dst]of [[g1,after[1]],[g2,after[2]]]){
  const live=graphFor(scene2);wiring.wire(bar,scene2,live.nodes.find(n=>n.id===serve2.id),live.nodes.find(n=>n.id===dst.id),{predicate:cond});
 }
 const compiled=graphFor(scene2),multi=create({model:bar,scene:scene2,node:compiled.nodes.find(n=>n.id===serve2.id),graphFor});
 const arms=multi.branches();assert.deepEqual(arms.map(x=>x.target.node.id),[after[1].id,after[2].id,after[0].id]);
 assert.equal(arms[0].assumed,false);assert.equal(arms[1].assumed,true);assert.equal(arms[2].assumed,true);
 const rule=require(dir+'editor-model.js').rules;
 assert(rule.condition(g1,arms[0].target.ctx));assert(!rule.condition(g1,arms[1].target.ctx)&&rule.condition(g2,arms[1].target.ctx));assert(!rule.condition(g1,arms[2].target.ctx)&&!rule.condition(g2,arms[2].target.ctx));
 assert.equal(multi.next().node.id,after[1].id);multi.enter(arms[2].target);assert.equal(multi.node.id,after[0].id);
 const ext=await new Outside(source.files,source.presentation).init();ext.refreshChoiceFlows();
 const graph=outside.graph(ext,'newspaper'),parent=ext.projected.data.newspaperRoutes.parent,menu=graph.byRow.get(parent),[wrong,right]=ext.menu(ext.row(parent));
 assert(outside.previewNext(ext,'newspaper/intro',menu).needsChoice);
 for(const [option,answer] of [[wrong,'newspaper/wrong'],[right,'newspaper/right']]){
  let t=outside.previewNext(ext,'newspaper/intro',menu,option);assert.equal(t.flow,answer);const path=[];
  for(let i=0;i<30&&!t.end;i++){path.push(t.row);const n=graph.byRow.get(t.row);t=outside.previewNext(ext,t.flow,n,null,t.trail);}
  assert(t.end);assert.equal(new Set(path).size,path.length);assert(path.some(id=>id.includes('common')));assert(path.at(-1).includes('finish'));
 }
 const back={flow:'newspaper/intro',row:menu.id},stack=[back],end=graph.nodes.find(n=>n.flow==='newspaper/repeat');
 assert.deepEqual(outside.previewNext(ext,end.flow,end,null,stack),{...back,trail:[]});assert.deepEqual(stack,[back]);
 console.log('NODE_PREVIEW_ROUTES_OK: choices, shared targets, independent condition/grade paths, pin priority and fallback, cross-scene effects, joins; no writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
