/* Exercise drawn wires after a real isolated save, through the game runner.
   Never write the authored CSV or runtime files. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {snapshot,save,runtimeSnapshot}=require('../../tools/dialogue-editor-storage.cjs');
const {Model}=require('../src/dev/dialogue-editor/editor-model.js'),F=require('../src/dev/dialogue-editor/flow-model.js'),R=require('../src/dev/dialogue-editor/flow-wiring.js'),C=require('../src/core/core.js');
(async()=>{
 const original=await snapshot(),m=await new Model(original.files,original.presentation).init(),scene='d1_tutorial_chris',g=()=>F.compile(m,scene);
 const first=g().nodes,menu=first.find(n=>n.type==='선택지'),opts=m.choices(menu.rows[0].arg),serve=first.find(n=>n.rows.at(-1).type==='serve');
 const response=first.find(n=>n.id===g().connections.find(e=>e.from===first.find(n=>n.type==='빈잔').id&&e.guard.includes('final_grade >= good')).to),dest=first.find(n=>n.index>response.index&&n.type==='대화'&&!n.when.includes('final_grade')),oldAnswer=first.find(n=>n.when==='flag.day0_skip_tutorial'),common=first.find(n=>n.index>oldAnswer.index&&!n.when&&!R.block(n.rows[0])&&n.type==='대화');
 const describe=({id,source,target,choice,predicate})=>({id,source,target,choice,predicate});
 const originalRoutes=R.scan(m,scene).routes.map(describe),originalEffects=opts[1].effects,answer={choice:opts[1].row_id,predicate:''},grade={predicate:'order_match && craft_grade == excellent'};
 assert.match(R.problem(m,scene,menu,dest,answer),/좌석|주문/);assert.match(R.problem(m,scene,menu,first[0],answer),/반복|순환/);
 R.wire(m,scene,menu,common,answer);assert(opts[1].effects.includes(originalEffects));assert.equal(g().nodes.length,first.length);
 let liveServe=g().nodes.find(n=>n.id===serve.id);
 R.wire(m,scene,liveServe,g().nodes.find(n=>n.id===dest.id),grade);
 assert.equal(R.scan(m,scene).routes.length,originalRoutes.length+2);
 const routes=()=>R.scan(m,scene).routes,forService=()=>routes().find(r=>r.source===serve.rows.at(-1).row_id);
 // Rewire, then undo to the previous target. Nothing visual-only in a wire.
 m.checkpoint();R.wire(m,scene,g().nodes.find(n=>n.id===serve.id),g().nodes.find(n=>n.id===response.id),{...grade,routeId:forService().id});
 assert.equal(forService().target,response.id);m.undo();assert.equal(forService().target,dest.id);
 m.checkpoint();R.disconnect(m,scene,forService());assert.equal(routes().length,originalRoutes.length+1);assert(!m.row(response.id).when.includes('bp_'));m.undo();
 // Overlapping conditions: an unconditional fallback must be last, and
 // unlinking it may not change any other wire or its original row conditions.
 m.checkpoint();R.wire(m,scene,g().nodes.find(n=>n.id===serve.id),g().nodes.find(n=>n.id===response.id),{predicate:''});
 const latest=g().nodes,third={predicate:'order_match && craft_grade == good'};R.wire(m,scene,latest.find(n=>n.id===serve.id),latest.find(n=>n.id===dest.id),third);
 const serviceRoutes=routes().filter(r=>r.source===serve.rows.at(-1).row_id);assert.deepEqual(serviceRoutes.map(r=>r.predicate),[grade.predicate,third.predicate,'']);assert(serviceRoutes[2].steps[1].when.includes('!'+serviceRoutes[0].gate));m.undo();
 assert.deepEqual((await m.validate()).errors,[]);
 // One physical destination per socket even if a guarded target can fall through.
 m.checkpoint();
 const wires=()=>g().connections,onePerPin=()=>assert.equal(new Set(wires().map(e=>e.from+'|'+e.pinKey)).size,wires().length);
 const liveNode=id=>g().nodes.find(n=>n.id===id),originalGradeId=forService().id;
 R.wire(m,scene,liveNode(serve.id),liveNode(response.id),{predicate:'craft_grade == excellent && order_match'});
 assert.equal(forService().id,originalGradeId);assert.equal(forService().target,response.id);assert.equal(routes().length,originalRoutes.length+2);onePerPin();
 const beforeBad=JSON.stringify(m.output());assert.throws(()=>R.wire(m,scene,liveNode(serve.id),liveNode(serve.id),grade));assert.equal(JSON.stringify(m.output()),beforeBad);
 R.wire(m,scene,liveNode(serve.id),liveNode(response.id),grade);assert.equal(JSON.stringify(m.output()),beforeBad);
 const guarded=liveNode(oldAnswer.id);R.wire(m,scene,liveNode(menu.id),guarded,answer);
 const answerLines=wires().filter(e=>e.from===menu.id&&e.choice===answer.choice);assert.equal(answerLines.length,1);assert.equal(answerLines[0].to,oldAnswer.id);
 assert.equal(routes().find(r=>r.choice===answer.choice).target,oldAnswer.id);
 m.undo();assert.equal(forService().target,dest.id);onePerPin();
 // A choice is enabled before it is picked; its separate cable predicate is evaluated afterwards.
 const currentChoice=()=>routes().find(r=>r.choice===answer.choice),oldChoice={...currentChoice()},otherEffects=liveNode(menu.id).rows[0].effects;
 R.revise(m,scene,liveNode(menu.id),currentChoice(),liveNode(common.id),'flag.studio_cable_open');
 assert.equal(currentChoice().id,oldChoice.id);assert.equal(currentChoice().target,oldChoice.target);assert.equal(m.row(menu.id).effects,otherEffects);
 m.checkpoint();R.wire(m,scene,liveNode(serve.id),liveNode(response.id),{predicate:''});
 const def=routes().find(r=>r.source===serve.rows.at(-1).row_id&&!r.predicate);
 assert.throws(()=>R.revise(m,scene,liveNode(serve.id),forService(),liveNode(dest.id),''),/동일/);
 R.revise(m,scene,liveNode(serve.id),def,liveNode(response.id),'flag.studio_alt');R.revise(m,scene,liveNode(serve.id),forService(),liveNode(dest.id),'');
 const sorted=routes().filter(r=>r.source===serve.rows.at(-1).row_id);assert.deepEqual(sorted.map(r=>r.predicate),['flag.studio_alt','']);assert(sorted[1].steps[1].when.includes('!'+sorted[0].gate));assert.equal(sorted[1].target,dest.id);m.undo();
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-pin-save-')),base=path.join(tmp,'csv'),runtime=path.join(tmp,'runtime');await require('./helpers/copy-editor-source.cjs')(base);await fs.mkdir(runtime);
 for(const file of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',file),path.join(runtime,file));
 await save({revision:original.revision,files:m.output()},{base,runtime,backupRoot:path.join(tmp,'backups')});
 const saved=await snapshot(base),after=await new Model(saved.files,saved.presentation).init();assert.deepEqual(after.headers,m.headers);
 assert.deepEqual(R.scan(after,scene).routes.map(r=>[r.choice,r.predicate,r.target]),routes().map(r=>[r.choice,r.predicate,r.target]));
 assert.deepEqual(R.scan(after,scene).routes.filter(r=>originalRoutes.some(old=>old.id===r.id)).map(describe),originalRoutes);
 const live=await runtimeSnapshot(base),D=C.millilitreData(after.projected.data);Object.assign(D.tables,live.tables);
 const typeIds=m=>new Set(m.rows(scene).map(r=>r.type));assert.deepEqual(typeIds(after),new Set(first.flatMap(n=>n.rows.map(r=>r.type))));
 function play(answer,quality,cableOpen=true){
  const game=new C.Game(D);game.reset(0,'regular',123,false);game.overlay=null;game.tutorial=null;game.progress.flags.studio_cable_open=cableOpen;game.startStoryPhase('bar');const seen=[];
  for(let i=0;i<5000;i++){
   assert(!game.error,String(game.error));
   if(game.overlay==='johnnyUnlock'){game.confirmJohnnyUnlock();continue;}
   if(game.transition||game.cameraLeft||game.cameraMoving){game.cameraMoving=false;game.tick(.1);continue;}
   if(game.choice){game.choose(answer);continue;}
   if(game.dialogue){
    const id=game.dialogue.step.dialogue_id;seen.push(id);
    if(id===dest.rows[0].dialogue_id||answer===1&&id===first[first.indexOf(menu)+1].rows[0].dialogue_id)return seen;
    game.dialogue.chars=game.dialogue.text.length;game.advance();continue;
   }
   if(game.storyCoaster){assert(game.coaster(game.storyCoaster.seat,'drag'));continue;}
   if(game.currentOrder&&game.story?.steps[game.story.index]?.type==='craft'){const o=game.currentOrder;assert(game.openRecipes());assert(game.selectCocktail(o.cocktail));game.debugCraft(quality);game.offer();assert(game.serve(o.seat,'drag'));continue;}
   game.tick(.1);
  }throw Error('실제 본편 대화가 도착 노드에 도달하지 않았습니다.');
 }
 assert(play(2,'good',false).includes(oldAnswer.rows[0].dialogue_id),'false cable must fall through the selected option, without disabling it');
 assert(!play(1,'good').includes(common.rows[0].dialogue_id),'unselected choice wire was taken');
 for(const quality of ['good','excellent']){const seen=play(2,quality);assert(!seen.includes(oldAnswer.rows[0].dialogue_id));assert(seen.includes(common.rows[0].dialogue_id));assert.equal(seen.includes(response.rows[0].dialogue_id),quality==='good');assert(seen.includes(dest.rows[0].dialogue_id));}
 assert.equal((await snapshot()).revision,original.revision);
 console.log('FLOW_WIRING_OK: native choice + cocktail-grade routes, priority, rewire, undo/unlink, isolated CSV save/reload and actual in-game paths for both grades');
})().catch(e=>{console.error(e);process.exitCode=1;});
