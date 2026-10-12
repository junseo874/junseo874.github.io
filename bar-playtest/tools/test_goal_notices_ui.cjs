const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.click('[data-campaign="developer"]');
  if(await p.locator('.updates-confirm').isVisible())await p.click('.updates-confirm');
  for(const day of [0,1,2,3]){
   await p.evaluate(async day=>{outsidePlaytest.exit(true);barGame.reset(day,'full',1,false);Object.assign(outsidePlaytest.config,{day,flow:'out',place:'bar'});await outsidePlaytest.start({showDevHint:false});outsidePlaytest.openDev();outsidePlaytest.devAction('dev-flow-in');outsidePlaytest.devAction('dev-close');outsidePlaytest.tick(0);outsidePlaytest.model.interact();},day);
   assert.equal(await p.evaluate(()=>Object.keys(barGame.progress.objectives||{}).length),0,'No commute goal in day '+day);
   assert(!await p.evaluate(()=>LunaStoryNotices.pending.some(e=>e.kind.startsWith('goal-'))));
  }
  await p.evaluate(async()=>{const c=lunaCampaign;outsidePlaytest.exit(true);if(c.session.active)c.session.uninstall();c.session.install({developer:false});c.session.beginCommute(2);await c.street('in','bar');outsidePlaytest.model.interact();});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&lunaCampaign.session.route==='bar'&&!outsidePlaytest.active,null,{timeout:30000});
  assert.equal(await p.evaluate(()=>Object.keys(barGame.progress.objectives||{}).length),0,'No goal on actual main bar entry');
  assert(!await p.evaluate(()=>LunaStoryNotices.pending.some(e=>e.kind.startsWith('goal-'))));
  assert.deepEqual(errors,[]);console.log('PASS: goals disconnected from days 0–3, P commute changes, simulator bar arrival and main bar-door transition');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
