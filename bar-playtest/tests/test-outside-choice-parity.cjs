const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {snapshot}=require('../../tools/dialogue-editor-storage.cjs'),{Model}=require('../src/dev/dialogue-editor/outside-model.js');
const {compileNewspaperRoutes}=require('../src/shared/data/outside-story-compiler.js');
(async()=>{
 const W={LunaRuleParts:{conditions:require('../src/core/story-conditions.js')}};
 for(const f of ['neighborhood-choice-rules','outside-authoring'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/features/outside/events',f+'.js'),'utf8'),{window:W});
 for(const [money,gear,flags,want] of [[399,0,{},[true,true]],[400,0,{},[true,false]],[0,1,{},[false,true]],[400,1,{elevator_repaired:true},[true,true]],[400,1,{elevator_repair_paid:true},[true,true]]]){
  const p={money,inventory:{gear_part:gear},flags},before=JSON.stringify(p),line={stage:'repair'},base=W.LunaNeighborhoodChoiceRules.apply('repair',[{id:'gear'},{id:'pay'}],p);
  for(const [i,o]of base.entries()){const gate=W.LunaOutsideAuthoring.availability(line,o.id,p,2,'','');assert.equal(gate.disabled,want[i]);assert.equal(o.disabled,gate.disabled);assert.equal(o.disabledReason,gate.disabledReason);}
  assert.equal(JSON.stringify(p),before);
 }
 assert(W.LunaOutsideAuthoring.availability({},'',{},1,'day >= 2').disabled);
 assert(!W.LunaOutsideAuthoring.availability({},'',{},2,'day >= 2').disabled);
 const s=await snapshot(),m=await new Model(s.files,s.presentation).init(),q=m.rows('newspaper/intro').at(-1);
 m.ensureMenu(q);let check=await m.validate();assert.deepEqual(check.errors,[]);assert.deepEqual(check.warnings,[]);
 m.setMenuField(q,0,'route','end');check=await m.validate();assert(check.warnings.some(x=>x.includes('웹: 종료')&&x.includes('steps_shared_newspaper_wrong')));
 m.setMenuField(q,0,'route','native:newspaper-right');assert((await m.validate()).warnings.some(x=>x.includes('steps_shared_newspaper_right')&&x.includes('steps_shared_newspaper_wrong')));
 m.removeMenuOption(q,m.menuConfig(q).active[1]);assert((await m.validate()).warnings.some(x=>x.includes('목록/순서')));
 const menu=m.addMenu('believer/intro',1);assert((await m.validate()).warnings.some(x=>x.includes('editor-choice')));
 for(const [alter,expected]of [[s=>s.at(-1).when='flag.example',/무조건 goto/],[s=>s.push({...s.at(-1)}),/무조건 goto/],[s=>s.push({type:'say'}),/무조건 goto/],[s=>s.at(-1).scene_id='shared-newspaper-wrong',/Invalid newspaper goto/]]){
  const street=structuredClone(m.catalog.read('script/street'));alter(street.scenes.find(s=>s.id==='shared-newspaper-wrong').steps);
  assert.throws(()=>compileNewspaperRoutes({rawTables:m.catalog.rawTables,read:()=>street},m.views),expected);
 }
 console.log('CHOICE_PARITY_OK repair/day matrix; matching, divergent, hidden and unsupported routes; invalid gotos rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
