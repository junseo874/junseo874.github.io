/* The editor is a compiler: re-open from the saved source, don't trust canvas edges. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const S=require('../../tools/dialogue-editor-storage.cjs'),d='../src/dev/dialogue-editor/';
const {Model}=require(d+'editor-model'),F=require(d+'flow-model'),R=require(d+'flow-wiring'),B=require(d+'bar-loose-nodes');
const E=require(d+'outside-model'),N=require(d+'outside-node-authoring'),MapUI=require(d+'outside-flow-map');
(async()=>{
 const original=await S.snapshot(),tmp=await fs.mkdtemp(path.join(os.tmpdir(),'luna-free-nodes-')),opts={base:path.join(tmp,'csv'),runtime:path.join(tmp,'runtime'),backupRoot:path.join(tmp,'backup')};
 // Numbered later, but on an exclusive sibling path: serialize in forward
 // order and verify the same branch and fallback after a CSV round trip.
 {
  const m=await new Model(original.files,original.presentation).init(),s='campaign_d2_bar_open';
  const add=(text,when)=>{const r=m.add(s,m.rows(s).length,'say');m.set(r,'text.ko',text);m.set(r,'when',when);m.set(r,'effects','');return r;};
  const tutor=add('tutorial','!flag.recall'),remember=add('remember','flag.recall'),menu=B.create(m,s,{type:'choice',actor:'luna'});
  const cards=r=>F.compile(m,s,[tutor.row_id,remember.row_id]).nodes.find(n=>n.rows.includes(r));
  B.bind(m,s,cards(remember),cards(menu),{});const options=m.choices(menu.arg);
  const answers=options.map((opt,i)=>{const row=B.create(m,s,{type:'say',actor:'luna',text:'reply'+i});B.bind(m,s,cards(menu),cards(row),{choice:opt.row_id});return row;});
  assert.equal(B.targetProblem(m,s,cards(answers[1]),cards(tutor),{}),'');
  B.attach(m,s,cards(answers[1]),cards(tutor),{});
  const reload=await new Model({...original.files,...m.output()},original.presentation).init(),plan=R.scan(reload,s,true);
  assert.deepEqual(plan.errors,[]);assert(plan.routes.some(r=>r.source===answers[1].row_id&&r.target===tutor.row_id));
  for(const [recall,answer,expected] of [[false,0,['tutorial']],[true,0,['remember','reply0']],[true,1,['remember','reply1','tutorial']]]){
   const flags={'flag.recall':recall},seen=[],apply=v=>F.clean(v).split(';').forEach(x=>{const a=x.trim().match(/^(flag\.\w+) = (true|false)$/);if(a)flags[a[1]]=a[2]==='true';});
   for(const r of reload.rows(s).slice(reload.rows(s).findIndex(r=>r.row_id===remember.row_id))){
    if(!F.clean(r.when).split(' && ').every(t=>!t||(t.startsWith('!')?!flags[t.slice(1)]:flags[t])))continue;
    if(r.type==='say')seen.push(r['text.ko']);apply(r.effects);if(r.row_id===menu.row_id)apply(reload.choices(r.arg)[answer].effects);
   }
   assert.deepEqual(seen,expected);
  }
 }
 await require('./helpers/copy-editor-source.cjs')(opts.base);await fs.cp(path.join(__dirname,'../data/runtime'),opts.runtime,{recursive:true});
 const bar=await new Model(original.files,original.presentation).init(),s='campaign_d2_bar_open',nodes=()=>F.compile(bar,s).nodes,card=r=>nodes().find(n=>n.rows.includes(r));
 const from=nodes().at(-1).rows.at(-1),make=type=>B.create(bar,s,{type,actor:'luna',text:'검수 '+type}),menu=make('choice'),a=make('say'),b=make('say');
 const nativeMenu=F.compile(bar,s).nodes.find(n=>n.rows[0].type==='choice'&&!R.block(n.rows[0])&&bar.choices(n.rows[0].arg).length<4);if(nativeMenu){const arg=nativeMenu.rows[0].arg,extra=bar.addChoice(arg);assert(!F.compile(bar,s).connections.some(e=>e.choice===extra.row_id));bar.removeChoice(arg,extra.row_id);}
 assert.equal(bar.choices(menu.arg).length,2);assert.deepEqual((await bar.validate()).errors,[]);assert(R.asleep(a));assert(!F.compile(bar,s).connections.some(e=>[a.row_id,b.row_id,menu.row_id].includes(e.to)));
 const choices=bar.choices(menu.arg);bar.checkpoint();
 for(const [i,dst]of [a,b].entries())B.bind(bar,s,card(menu),card(dst),{choice:choices[i].row_id});
 B.bind(bar,s,card(from),card(menu),{});const routes=()=>R.scan(bar,s).routes;
 assert.deepEqual(choices.map(o=>routes().find(r=>r.choice===o.row_id).target),[a.row_id,b.row_id]);
 const visible=F.compile(bar,s).connections;assert.deepEqual(visible.filter(e=>e.from===menu.row_id).map(e=>e.to),[a.row_id,b.row_id]);assert(!visible.some(e=>[a.row_id,b.row_id].includes(e.from)), 'Connecting the input must not connect its unassigned output');
 assert.deepEqual((await bar.validate()).errors,[]);bar.undo();assert(R.asleep(bar.row(menu.row_id)));bar.redo();
 // Both response paths can converge without making the join unconditional.
 const joined=make('say'),decision=B.create(bar,s,{type:'condition',when:'flag.independent_test'}),yes=make('say'),no=make('say'),fresh=r=>card(bar.row(r.row_id));
 B.bind(bar,s,fresh(b),fresh(joined),{});B.attach(bar,s,fresh(a),fresh(joined),{});
 assert.match(joined.when,/flag\.bp_join_/);assert.equal(routes().filter(r=>r.target===joined.row_id).length,2);
 B.bind(bar,s,fresh(decision),fresh(yes),{predicate:'flag.independent_test'});B.bind(bar,s,fresh(decision),fresh(no),{});B.bind(bar,s,fresh(joined),fresh(decision),{});
 const evalRow=(v,flags)=>!v||v==='\\N'||v.split(' && ').every(t=>t==='true'||(t.startsWith('!')?!flags[t.slice(1)]:!!flags[t]));
 for(const answer of [0,1])for(const pass of [false,true]){
  const seen=[],flags={'flag.independent_test':pass},apply=v=>String(v||'').split(';').forEach(e=>{const a=/^(flag\.\w+) = (true|false)$/.exec(e.trim());if(a)flags[a[1]]=a[2]==='true';});
  for(const r of bar.rows(s).slice(bar.rows(s).indexOf(bar.row(from.row_id)))){
   if(!evalRow(r.when,flags))continue;seen.push(r.row_id);apply(r.effects);if(r.row_id===menu.row_id)apply(bar.choices(r.arg)[answer].effects);
  }
  assert.deepEqual([a,b,joined,yes,no].filter(r=>seen.includes(r.row_id)).map(r=>r.row_id),[[a,b][answer],joined,pass?yes:no].map(r=>r.row_id));
 }
 assert.deepEqual((await bar.validate()).errors,[]);
 bar.setPreset('name','#112233');bar.setPreset('memory_glow','#CEABFF');
 await S.save({revision:original.revision,files:bar.output()},opts);
 const palette=(await S.runtimeSnapshot(opts.base)).tables.text_tags;
 for(const [tag,value]of [['name','#112233'],['memory_glow','#CEABFF']])assert.equal(palette.find(r=>r.tag===tag)?.value,value);
 const current=await S.snapshot(opts.base),again=await new Model(current.files,current.presentation).init();
 assert.deepEqual((await again.validate()).errors,[]);const line=again.row(a.row_id),opt=R.scan(again,s).routes.find(r=>r.target===a.row_id);
 const triples=m=>R.scan(m,s).routes.map(r=>[r.source,R.pinKey(r.choice,r.predicate),r.target].join('|')).sort(),touching=R.scan(again,s).routes.filter(r=>r.source===joined.row_id||r.target===joined.row_id);assert(touching.length>=3);const survivors=triples(again).filter(t=>!t.split('|').includes(joined.row_id));again.checkpoint();B.remove(again,s,again.row(joined.row_id));assert.deepEqual(triples(again),survivors);assert.deepEqual((await again.validate()).errors,[]);again.undo();assert(again.row(joined.row_id));
 R.disconnect(again,s,R.scan(again,s).routes.find(r=>r.id===opt.id));assert(R.asleep(again.row(line.row_id)));B.remove(again,s,again.row(line.row_id));assert(!again.row(a.row_id));assert.deepEqual((await again.validate()).errors,[]);
 const draft=await new Model(original.files,original.presentation).init(),pick=r=>F.compile(draft,s).nodes.find(n=>n.rows.includes(r)),origin=F.compile(draft,s).nodes.at(-1).rows.at(-1);
 const grade=B.create(draft,s,{type:'condition',when:'craft_grade >= good'}),praise=B.create(draft,s,{type:'say',actor:'luna',text:'좋은 결과'});
 B.attach(draft,s,pick(grade),pick(praise),{predicate:'craft_grade >= good'});assert.deepEqual((await draft.validate()).errors,[]);
 B.attach(draft,s,pick(origin),pick(grade),{});assert((await draft.validate()).errors.some(e=>e.includes('제공 전에 제조 결과')));
 const m=await new E.Model(current.files,current.presentation).init(),owner=m.flow('newspaper/intro'),talk=(kind,text)=>N.newNode(m,owner,kind,{title:text,text,actor:'street-newspaper',condition:'flag.test_yes == true',effect:'flag.test_yes = true'});
 const repeat=talk('repeat','두 번째 인사'),effect=talk('effect','기록'),condition=talk('condition','플래그 검사'),q=talk('choice','질문'),notice=talk('notice','알림'),join=talk('join','합류'),end=talk('talk','끝');
 N.wire(m,owner,'revisit',repeat);N.wire(m,repeat,'next',effect);N.wire(m,effect,'next',condition);N.wire(m,condition,'yes',q);N.wire(m,condition,'no',notice);N.wire(m,notice,'next',join);N.wire(m,join,'next',end);
 const menuRow=m.rows(q.id)[0];m.wire(menuRow,0,'flow:'+join.id);m.wire(menuRow,1,'flow:'+end.id);
 N.wire(m,m.flow('newspaper/finish'),'next',end);assert.equal(N.all(m,m.flow('newspaper/finish').parent).at(-2).effects,'flag.newspaper_conversation_done = true');
 assert.throws(()=>N.wire(m,end,'next',condition),/순환/);assert.throws(()=>N.wire(m,end,'next',repeat),/순환|반복/);assert.throws(()=>N.newNode(m,m.flow('believer/intro'),'repeat'),/재대화/);
 const home=m.flow('home/wardrobe'),hr=N.newNode(m,home,'repeat',{text:'다시 본 옷장'});N.wire(m,home,'revisit',hr);
 const graph=MapUI.graph(m,'newspaper'),node=graph.byRow.get(m.rows(condition.id)[0].row_id);assert.deepEqual(node.extra.map(p=>p.flow),[q.id,notice.id]);
 assert.equal(MapUI.previewNext(m,condition.id,node,{graphSlot:'no'}).flow,notice.id);
 let checked=await m.validate();assert.deepEqual(checked.errors,[]);assert.deepEqual(checked.result.data.sharedStory[owner.id],m.projected.data.sharedStory[owner.id]);assert.deepEqual(checked.result.data.newspaperRoutes,m.projected.data.newspaperRoutes);
 assert.equal(checked.result.data.sharedStory['newspaper/repeat'][0].target,repeat.id);assert.equal(checked.result.data.sharedStory['home/wardrobe'][1].type,'effect');
 await S.save({mode:'outside',revision:current.revision,files:m.output()},opts);
 // Optionally read the exact same saved fixture with the existing Unity CSV assembly,
 // before deleting any nodes. No Unity project asset or production CSV is written.
 if(process.env.INDEPENDENT_ENGINE_AUDIT){
  const stdout=require('node:child_process').execFileSync(process.env.DOTNET_BIN||'dotnet',[process.env.INDEPENDENT_ENGINE_AUDIT,opts.base],{encoding:'utf8'});
  assert.match(stdout,/PASS CompileHome production/);assert.doesNotMatch(stdout,/^FAIL .+/m);console.log('Unity CSV reader:',(stdout.match(/^PASS /gm)||[]).length,'checks passed');
 }
 const latest=await S.snapshot(opts.base),read=await new E.Model(latest.files,latest.presentation).init();assert.deepEqual((await read.validate()).errors,[]);
 const savedPopup=read.projected.data.sharedStory[notice.id][0];assert.deepEqual([savedPopup.type,savedPopup.arg,savedPopup.text],['popup','event_occurred','알림']);assert.equal(read.rows(notice.id)[0].sync,'nowait');
 const live=(await S.runtimeSnapshot(opts.base)).exterior;assert.equal(live.sharedStory[repeat.id][0].text,'두 번째 인사');assert(live.choices.find(c=>c.row_id===m.menu(menuRow)[0].row.row_id).transfer);
 read.checkpoint();N.remove(read,read.flow(repeat.id));N.remove(read,read.flow(hr.id));N.remove(read,read.flow(q.id));assert(!read.flow(repeat.id));let clean=await read.validate();assert.deepEqual(clean.errors,[]);assert.deepEqual(clean.result.data.sharedStory['newspaper/repeat'],m.projected.data.sharedStory['newspaper/repeat']);assert.deepEqual(clean.result.data.sharedStory['home/wardrobe'],m.projected.data.sharedStory['home/wardrobe']);
 read.undo();assert(read.flow(q.id));read.redo();await S.save({mode:'outside',revision:latest.revision,files:read.output()},opts);assert.equal((await S.snapshot()).revision,original.revision);
 console.log('INDEPENDENT_NODES_OK: disconnected drafts, split/rewire, real CSV save/reload, first vs repeat, both conditional exits, popup and shared join, delete/undo, untouched source.');
})().catch(e=>{console.error(e);process.exitCode=1;});
