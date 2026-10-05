const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  async function boot(day,flow,main=false,qaCase){
   await p.evaluate(async v=>{
    const c=lunaCampaign;c.toPicker();c.session.install({developer:!v.main});
    barGame.reset(v.day===99?2:v.day,'full',10,false);
    Object.assign(barGame.progress,{money:2000,flags:{},inventory:{}});
    c.session.day=v.day;c.session.route=v.flow;c.session.carry=structuredClone(barGame.progress);
    Object.assign(outsidePlaytest.config,{day:v.day,flow:v.flow,place:'bar',qaCase:v.qaCase});
    await outsidePlaytest.start();c.screen(c.playView);outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
   },{day,flow,main,qaCase});
  }
  const drain=()=>p.evaluate(()=>{
   const m=outsidePlaytest.model,lines=[];
   for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){
    if(!m.story.speech.line)break;lines.push(m.story.speech.line.text);m.story.speech.elapsed=99;m.story.advance();
   }
   outsidePlaytest.tick(0);return lines;
  });
  // Exact data changes, plus all day/flow/height gates.
  assert.deepEqual(await p.evaluate(()=>({
   port:LUNA_OUTSIDE_DIALOGUES.outside_day0_port_pair.length,
   news:LUNA_OUTSIDE_DIALOGUES[LunaOutsideNotion.news].map(r=>r.text).join(' ').includes('2056'),
   reopen:LUNA_OUTSIDE_DIALOGUES[LunaOutsideNotion.reopening].length,
   contract:LunaOutsideNotion.contractRows.filter(r=>r.type==='say').length,
   cost:LunaBDVendor.cost
  })),{port:10,news:false,reopen:13,contract:20,cost:300});
  const guards=await p.evaluate(()=>{
   const results=[],event=LunaOutsideContent.events.find(e=>e.id===LunaOutsideNotion.reopening);
   for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const level of [0,1]){
    const m=new LunaOutside.Model({day,flow,place:'bar'});m.level=level;
    results.push(LunaOutsideContent.active(m,event)===(day===2&&flow==='in'&&level===0));
   }
   return results;
  });assert(guards.every(Boolean));
  for(const main of [false,true]){
   await boot(2,'in',main);
   await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=-4.55;m.tick(.05);outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.backgroundStory.speech?.id),'outside_day2_commute_reopening');
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.blocking),false);
   assert.deepEqual(await p.evaluate(()=>{const ps=LunaOutsideAmbient.placements.filter(p=>p.id.startsWith('reopening'));return ps.map(a=>LunaOutsideAmbient.faceTarget(a.x,ps.find(o=>o.id===a.faces).x));}),[true,false]);
   await p.evaluate(()=>{outsidePlaytest.model.backgroundStory.speech.elapsed=99;outsidePlaytest.refreshHUD();});
   if(main)await p.screenshot({path:'/private/tmp/outside-new-passers.png'});
   // The forced trade begins without E, locks motion, returns and does not repeat.
   await boot(1,'out',main);
   await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=2.8;m.tick(.05);outsidePlaytest.snapCamera();});
   await p.waitForFunction(()=>outsidePlaytest.model.encounter?.stage==='active');
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech?.id),'outside_day1_samho_smuggler');
   const x=await p.evaluate(()=>outsidePlaytest.model.x);
   await p.keyboard.down('KeyD');await p.waitForTimeout(180);await p.keyboard.up('KeyD');
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x);
   if(main){await p.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=99;outsidePlaytest.refreshHUD();});await p.screenshot({path:'/private/tmp/outside-forced-trade.png'});}
   assert.equal((await drain()).length,8);
   await p.waitForFunction(()=>!outsidePlaytest.model.encounter);
   await p.evaluate(()=>outsidePlaytest.model.tick(.05));
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.encounter),null);
   if(main)assert(await p.evaluate(()=>lunaCampaign.session.carry.flags.day1_trade_done));
   console.log('PASS new passers + forced trade',main?'main':'developer');
  }
  // Revisit greeting is completed before the standalone choice panel.
  await boot(2,'out');
  await p.evaluate(()=>{barGame.progress.flags.shiba_shop_met=true;const m=outsidePlaytest.model;m.x=-2.85;m.updateNear();m.interact();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  assert.equal(await p.locator('[data-choice="shop-yes"]').count(),0);
  assert.deepEqual(await drain(),['뭐야? 살 거 아니면 꺼져, 시바.']);
  assert.equal(await p.locator('[data-choice="shop-yes"]').innerText(),'한번 볼게요.');
  assert.equal(await p.locator('.outside-speech p').isVisible(),false);
  await p.screenshot({path:'/private/tmp/outside-shop-separated-choice.png'});
  await p.locator('[data-choice="shop-no"]').click();assert.deepEqual(await drain(),['뭐야. 그럼 꺼져.']);
  // Residents start once they are visible while riding, without corridor proximity.
  await boot(0,'out');
  const resident=await p.evaluate(()=>{
   const m=outsidePlaytest.model,r=LunaOutsideResidents;
   m.x=LunaResidence.layout.elevatorX;m.level=0;m.ride={call:false};
   r.tickView(m,{x:-16,y:10,w:12});
   const started=m.backgroundStory.speech?.id;m.backgroundStory.cancel();
   r.tickView(m,{x:-16,y:10,w:12});const repeat=!!m.backgroundStory.speech;
   return{started,repeat,blocked:m.story.blocking,dummies:r.dummies.length};
  });
  assert.deepEqual(resident,{started:'outside_day0_building_residents',repeat:false,blocked:false,dummies:2});
  // Day 99 shares both new cases, preserves real progress.
  for(const qaCase of ['outside_day1_samho_smuggler','outside_day2_commute_reopening']){
   await boot(99,'out',false,qaCase);
   const before=await p.evaluate(()=>JSON.stringify(barGame.progress));
   await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=0;m.tick(.05);outsidePlaytest.snapCamera();});
   if(qaCase.includes('smuggler')){
    await p.waitForFunction(()=>outsidePlaytest.model.encounter?.stage==='active');
    assert.equal((await drain()).length,8);await p.waitForFunction(()=>!outsidePlaytest.model.encounter);
   }else assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech.id),qaCase);
   assert.equal(await p.evaluate(()=>JSON.stringify(barGame.progress)),before);
  }
  assert.deepEqual(errors,[]);console.log('OUTSIDE_REVISION_UI_OK text, conditions, facing, forced scene, separated choices, lift visibility and QA isolation');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
