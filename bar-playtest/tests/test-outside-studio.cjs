const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const S=require('../../tools/dialogue-editor-storage.cjs'),{Model}=require('../src/dev/dialogue-editor/outside-model.js'),M=require('../src/dev/dialogue-editor/outside-flow-map.js'),P=require('../src/features/outside/npc-placement.js');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'outside-studio-contract-')),base=path.join(temp,'csv'),runtime=path.join(temp,'runtime'),backupRoot=path.join(temp,'backup');
 await fs.cp(path.join(__dirname,'../data/shared-csv'),base,{recursive:true});await fs.mkdir(runtime);
 for(const f of ['game-data.js','campaign-data.js'])await fs.copyFile(path.join(__dirname,'../data/runtime',f),path.join(runtime,f));
 const original=await S.snapshot(),initial=await S.snapshot(base);
 const load=async()=>{const source=await S.snapshot(base);const m=await new Model(source.files,source.presentation).init();m.refreshChoiceFlows();return{m,source};};
 const persist=async(a)=>S.save({revision:a.source.revision,mode:'outside',files:a.m.output()},{base,runtime,backupRoot});
 let a=await load(),m=a.m;assert(m.visibleFlows().every(f=>M.site(m,f).id!=='other'));for(const s of M.sites)assert(s.pins.every(id=>Object.hasOwn(P.specs,id)));
 let g=M.graph(m,'newspaper');assert.equal(new Set(g.nodes.flatMap(n=>n.rows.map(r=>r.row_id))).size,g.nodes.flatMap(n=>n.rows).length);assert(g.nodes.some(n=>n.kind==='join'));assert(g.nodes.some(n=>m.step(n.rows[0]).action==='grant-gear'));
 const q=m.row(m.projected.data.newspaperRoutes.parent);m.wire(q,0,'flow:newspaper/right');m.addMenuOption(q);m.setMenuField(q,2,'text.ko','세 번째 답변');m.wire(q,2,'flow:newspaper/wrong');assert.deepEqual((await m.validate()).errors,[]);await persist(a);
 a=await load();m=a.m;const s=m.projected.data.newspaperRoutes,third=m.menu(m.row(s.parent))[2];assert.equal(s.routes['newspaper-wrong'][0],'newspaper/right');assert.equal(s.routes[third.id][0],'newspaper/wrong');
 m.removeMenuOption(m.row(s.parent),third.row.row_id);const menu=m.addMenu('home/wardrobePressed',1);m.addMenuOption(menu);let cfg=m.menuConfig(menu);m.moveMenuOption(menu,cfg.active[1],-1);assert.deepEqual(m.choices(menu.row_id).map(c=>c.row_id),cfg.active);
 m.wire(menu,0,'flow:home/bed');assert(m.safeJump(m.optionJump(m.menu(menu)[0].row)));const branch=m.addOptionBranch(menu,1);assert.equal(M.site(m,branch).id,'room');assert.deepEqual((await m.validate()).errors,[]);await persist(a);
 a=await load();m=a.m;const savedMenu=m.row(menu.row_id);m.removeMenuOption(savedMenu,m.menu(savedMenu)[1].row.row_id);assert(!m.flow(branch.id));await persist(a);
 a=await load();m=a.m;for(const s of Object.values(P.specs)){const v=P.empty();P.write(v,s.id,1e6);P.validate(v);assert.equal(P.position(v,s.id),P.snap(s.id,1e6,v).x);}
 m.setPlacement('store-pair-partner',-4.68);m.setPlacement('store-pair',1);assert.equal(P.position(m.placement,'store-pair-partner'),2.1);m.setPlacement('store-pair-partner',1.45);m.setPlacement('believer',1.02);assert.deepEqual((await persist(a)).files,['presentation/npc-placements.json']);await assert.rejects(persist(a),/변경/);
 a=await load();m=a.m;assert.equal(P.position(m.placement,'store-pair-partner'),1.45);assert(!m.dirty());
 for(const data of [{version:1,positions:{believer:{x:0,y:999}}},{version:1,positions:{unknown:{x:0,y:0}}},{version:1,positions:{'store-pair-partner':{x:4,y:-.94}}}])await assert.rejects(S.save({mode:'outside',revision:a.source.revision,files:{[P.file]:JSON.stringify(data)}},{base,runtime,backupRoot}));
 await assert.rejects(S.save({mode:'bar',revision:a.source.revision,files:{[P.file]:P.defaultText}},{base,runtime,backupRoot}));
 assert.notEqual(initial.revision,a.source.revision);assert.equal(original.revision,(await S.snapshot()).revision);
 console.log('OUTSIDE_STUDIO_OK: NPC ownership, shared reward, real native wires/new choices, disk round-trip/delete, formation and individual bounds, stale saves and unsafe fields blocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
