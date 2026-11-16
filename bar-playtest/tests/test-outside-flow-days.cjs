const assert=require('node:assert/strict'),S=require('../../tools/dialogue-editor-storage.cjs');
const path='../src/dev/dialogue-editor/',{Model}=require(path+'outside-model'),D=require(path+'outside-flow-days'),G=require(path+'outside-flow-map'),N=require(path+'outside-node-authoring');
(async()=>{
 const s=await S.snapshot(),m=await new Model(s.files,s.presentation).init(),index=D.index(m);
 const cases={
  'believer/intro':[0,1],'believer/finish':[0,1],'newspaper/intro':[1],'newspaper/repeat':[1],
  'beggar/warning/met':[0],'neighborhood/repairMenu':[1,2,3],'neighborhood/guardBlocked':[0,1],
  'neighborhood/guardMenu':[2,3],'neighborhood/reveal':[2,3],'neighborhood/bossIntro':[2,3],
  'shop/intro':[2,3],'shop/quizIntro':[2,3],'shop/allowanceYes':[2],'notion/contract':[3],
  'home/bed':[0,1,2,3],'ambient/outside_day1_tv_news2':[1],terraceMemory:[0],johnny:[2],terraceMemory3:[3],workshop:[]
 };
 for(const [id,days] of Object.entries(cases))assert.deepEqual(index.days(id),days,id);
 // Each pair is a real visit: combining an independent set of days with an
 // independent set of routes would wrongly show the believer before work on day 0.
 const windows={
  'believer/intro':['out','both','',''],'newspaper/intro':['','both','',''],
  'beggar/warning/met':['out','','',''],'neighborhood/guardBlocked':['out','both','',''],
  'neighborhood/rest':['','','out','out'],'shop/allowanceYes':['','','both',''],
  'home/bed':['both','both','both','both'],'ambient/outside_day0_shiba_wanted':['both','both','both','both'],
  'ambient/outside_day0_tv_news1':['out','','',''],'ambient/outside_day1_tv_news2':['','in','',''],
  'ambient/outside_day1_samho_smuggler':['','out','',''],'ambient/outside_day2_commute_reopening':['','','in',''],
  'thug/intro':['','in','',''],'notion/contract':['','','','out'],
  commute2:['','','in',''],commute3:['','','','in'],
  terraceMemory:['out','','',''],johnny:['','','out',''],terraceMemory3:['','','','out']
 };
 for(const [id,days] of Object.entries(windows))days.forEach((mark,d)=>{
  assert.deepEqual(index.routes(id,d),mark==='both'?['in','out']:mark?[mark]:[],id+' @ '+d);
 });
 for(const trip of ['in','out'])for(const d of D.days){
  const visible=f=>index.has(f,d,trip),can=(rule,f)=>index.allows(f,rule,d,trip);
  for(const site of G.sites){
   const g=G.graph(m,site.id,visible,can);
   for(const f of g.flows)assert(index.sequence(f.id,d,trip).length);
   for(const n of g.nodes)assert(visible(n.owner||n.flow));for(const edge of g.edges)assert(g.byRow.has(edge.from)&&g.byRow.has(edge.to));
  }
 }
 assert.equal(D.toggle('both','out'),'in');assert.equal(D.toggle('in','in'),'none');assert.equal(D.toggle('none','out'),'out');assert.equal(D.toggle('out','in'),'both');
 assert.deepEqual(index.days('believer/intro','in'),[1]);assert.deepEqual(index.days('believer/intro','out'),[0,1]);
 assert(!index.allows('believer/intro','day == 0','all','in'));assert(index.allows('believer/intro','day == 0','all','out'));
 assert(!index.has('workshop','all','in')&&!index.has('workshop','all','out'));assert(index.allows('workshop','day == 99','all','both'));
 assert(m.visibleFlows().every(f=>!index.has(f,'all','none')&&!index.sequence(f.id,'all','none').length));
 assert.equal(D.parse(null),null);assert.equal(D.parse('99'),null);assert.equal(D.parse('0'),0);assert(index.has('workshop','all'));
 assert(!m.flow('prologue')&&!index.has('prologue','all')&&!index.days('prologue').length,'retired raid radio is not a campaign visit or archived editor flow');
 for(const f of m.visibleFlows())assert(index.days(f).length||f.id==='workshop','unclassified: '+f.id);
 for(const d of D.days)for(const site of G.sites){
  const g=G.graph(m,site.id,f=>index.has(f,d));
  for(const f of g.flows)assert(index.sequence(f.id,d).length&&index.sequence(f.id,d).every(r=>g.byRow.has(r.row_id)),d+': '+f.id);
  for(const n of g.nodes)assert(index.has(n.owner||n.flow,d));for(const e of g.edges)assert(g.byRow.has(e.from)&&g.byRow.has(e.to));
 }
 assert(!m.dirty(),'browsing should not modify the story');
 const shop=m.flow('shop/intro'),node=(type,day)=>N.newNode(m,shop,type,{title:'일차 검수',day});
 const a=node('talk',2),b=node('talk',3),join=node('choice',2),target=node('join',3);
 const opts=m.rows(join.id)[0],choice=m.menu(opts)[0].row;
 N.wire(m,a,'next',join);N.wire(m,b,'next',join);m.setMenuField(opts,0,'when','day == 3');N.wire(m,join,'option',target,choice);
 m.setMenuField(opts,1,'when','day < 3');const own=m.addOptionBranch(opts,1);
 let idx=D.index(m);assert.deepEqual(idx.days(a),[2]);assert.deepEqual(idx.days(b),[3]);assert.deepEqual(idx.days(join),[2,3]);assert.deepEqual(idx.days(target),[3]);assert.deepEqual(idx.days(own),[2]);
 const g=G.graph(m,'shop',f=>idx.has(f,2),rule=>D.allows(rule,2)),menu=g.byRow.get(opts.row_id);
 assert(menu.ports[0].outsideDay&&!menu.ports[0].to&&!menu.ports[1].outsideDay&&menu.ports[1].to,'pin indices stay aligned when another date is hidden');
 const guard=m.flow('neighborhood/guardBlocked'),lateGuard=N.newNode(m,guard,'talk',{day:3});
 N.wire(m,lateGuard,'next',guard);assert.deepEqual(D.index(m).days(guard),[0,1,3],'new caller extends a native entry without removing its original visits');
 const believer=m.flow('believer/intro'),loose=N.newNode(m,believer,'talk',{day:0}),nested=N.newNode(m,believer,'join',{day:1});
 assert.deepEqual(D.index(m).routes(loose,0),['out'],'a loose node cannot create an impossible visit');
 N.wire(m,loose,'next',nested);assert.deepEqual(D.index(m).routes(nested,0),['out']);assert.deepEqual(D.index(m).routes(nested,1),[]);
 const saved=await new Model({...s.files,...m.output()},s.presentation).init();idx=D.index(saved);
 assert.deepEqual(idx.routes(nested,0),['out']);assert.deepEqual(idx.routes(nested,1),[]);
 assert.deepEqual(idx.days(join),[2,3]);assert.deepEqual(idx.days(own),[2]);assert.deepEqual(idx.days(target),[3]);
 N.wire(m,b,'next',null);idx=D.index(m);assert.deepEqual(idx.days(join),[2]);assert.deepEqual(idx.days(target),[]);
 assert.deepEqual((await m.validate()).errors,[]);console.log('OUTSIDE_FLOW_DAYS_OK: encounter days, scoped rows/wires, shared roots, conditional branches and CSV round trip');
})().catch(e=>{console.error(e);process.exitCode=1;});
