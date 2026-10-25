// Current CSV/content defines a once-only forced encounter, not the old manual conversation.
const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 const id='outside_day1_samho_smuggler';
 for(const [main,variant]of [[false,'original'],[false,'gpt'],[true,'original']]){
  await p.evaluate(async({main,variant})=>{const c=lunaCampaign,a=outsidePlaytest;a.exit(true);c.session.uninstall();c.session.install({developer:!main});barGame.reset(1,'full',1,false);c.session.day=1;c.session.route='out';c.session.carry=structuredClone(barGame.progress);Object.assign(a.config,{day:1,flow:'out',place:'bar',variant});await a.start();c.screen(c.playView);a.model.x=2.5;a.snapCamera();},{main,variant});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.encounter),null);
  assert.equal(await p.evaluate(id=>outsidePlaytest.model.targets().some(t=>t.id===id),id),false);
  await p.keyboard.down('KeyD');await p.waitForFunction(()=>outsidePlaytest.model.encounter?.kind==='smuggler-trade');await p.keyboard.up('KeyD');
  await p.waitForFunction(id=>outsidePlaytest.model.story.speech?.id===id,id);
  const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyD');await p.waitForTimeout(200);await p.keyboard.up('KeyD');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
  const signs=await p.evaluate(()=>{const a=outsidePlaytest,ctx=document.querySelector('#outside-root canvas').getContext('2d'),old=ctx.drawImage,records=[];ctx.drawImage=function(im,...v){const kind=im.src?.includes('samho-idle.png')?'samho':im.src?.includes('NPC_idle_M1')?'smuggler':null;if(kind)records.push({kind,sign:Math.sign(this.getTransform().a)});return old.call(this,im,...v);};try{a.tick(0);}finally{ctx.drawImage=old;}return records;});
  assert.equal(signs.find(s=>s.kind==='samho').sign,-1);assert(signs.some(s=>s.kind==='smuggler'&&s.sign===1));
  const dialogue=await p.evaluate(id=>{const s=outsidePlaytest.model.story,seen=[];for(let i=0;s.speech&&i<100;i++){seen.push(s.speech.line.text);s.speech.elapsed=99;s.advance();}return {seen,expected:LUNA_OUTSIDE_DIALOGUES[id].filter(row=>['say','timeline'].includes(row.type)).map(row=>row.text)};},id);
  assert(dialogue.expected.length>0);assert.deepEqual(dialogue.seen,dialogue.expected);
  await p.waitForFunction(()=>outsidePlaytest.model.encounter===null);
  assert(await p.evaluate(()=>lunaCampaign.active?barGame.progress.flags.day1_trade_done:outsidePlaytest.model.notionFlags.day1_trade_done));
  if(main)assert(await p.evaluate(()=>lunaCampaign.session.carry.flags.day1_trade_done));
  await p.evaluate(()=>{outsidePlaytest.model.x=3.96;outsidePlaytest.tick(.05);});assert.equal(await p.evaluate(()=>outsidePlaytest.model.encounter),null);
 }
 const gates=await p.evaluate(()=>{const m=outsidePlaytest.model,result=[];for(const day of [0,1,2,3])for(const flow of ['in','out']){m.start({day,flow});result.push({day,flow,visible:LunaOutsideEncounters.tradeVisible(m)});}return result;});
 for(const g of gates)assert.equal(g.visible,g.day===1&&g.flow==='out');
 assert.deepEqual(errors,[]);console.log('SAMHO_SMUGGLER_OK current CSV, automatic day1 return encounter, main/developer variants, movement lock, facing, once-only completion/carry');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
