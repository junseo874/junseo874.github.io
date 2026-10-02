const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await p.locator('.updates-confirm').click();
 for(let day=0;day<3;day++){
  await p.evaluate(async day=>{outsidePlaytest.exit(true);lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{place:'home',day,flow:'out',variant:'original'});await outsidePlaytest.start();lunaCampaign.sleepOutsideTest(outsidePlaytest.model);for(let i=0;i<80&&lunaCampaign.dialog&&!lunaCampaign.dayTransition;i++){lunaCampaign.dialog.chars=1e5;lunaCampaign.next();}window.savedTick=lunaCampaign.tick;lunaCampaign.tick=()=>true;},day);
  assert.deepEqual(await p.evaluate(()=>({from:lunaCampaign.dayTransition.from,to:lunaCampaign.dayTransition.to,day:outsidePlaytest.config.day,inert:document.querySelector('#outside-root').inert})),{from:day,to:day+1,day,inert:true});
  await p.evaluate(()=>{lunaCampaign.dayTransition.time=1.2;lunaCampaign.paintDayTransition();});
  assert.equal(await p.locator('.day-transition-shade').evaluate(e=>+e.style.opacity),1);assert.equal(await p.locator('.day-digit-old').textContent(),String(day));assert.equal(await p.locator('.day-digit-new').textContent(),String(day+1));
  if(day===0)await p.screenshot({path:'/private/tmp/day-rollover-before.png'});
  for(const key of ['Space','KeyE','Escape','Control'])await p.keyboard.press(key);
  assert.equal(await p.evaluate(()=>lunaCampaign.dayTransition.time),1.2);
  await p.evaluate(()=>{lunaCampaign.dayTransition.time=1.875;lunaCampaign.paintDayTransition();});
  assert(Math.abs(await p.locator('.day-digit-old').evaluate(e=>+e.style.opacity)-.5)<.001);
  if(day===0)await p.screenshot({path:'/private/tmp/day-rollover-number.png'});
  await p.evaluate(()=>{lunaCampaign.dayTransition.time=2.25;lunaCampaign.tickDayTransition(0);});
  await p.waitForFunction(()=>lunaCampaign.dayTransition.ready);
  assert.equal(await p.evaluate(()=>outsidePlaytest.config.day),day+1);assert.equal(await p.evaluate(()=>lunaCampaign.host.hidden),true);
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);
  if(day===0)await p.screenshot({path:'/private/tmp/day-rollover-after.png'});
  await p.evaluate(()=>{lunaCampaign.dayTransition.time=3.4;lunaCampaign.tickDayTransition(0);lunaCampaign.dayTransition.time=3.85;lunaCampaign.paintDayTransition();});
  assert(Math.abs(await p.locator('.day-transition-shade').evaluate(e=>+e.style.opacity)-.5)<.001);
  if(day===0)await p.screenshot({path:'/private/tmp/day-rollover-reveal.png'});
  await p.evaluate(()=>{lunaCampaign.dayTransition.time=4.31;lunaCampaign.tickDayTransition(0);lunaCampaign.tick=window.savedTick;});
  assert.equal(await p.locator('.campaign-day-transition').count(),0);assert.equal(await p.evaluate(()=>document.querySelector('#outside-root').inert),false);assert.equal(await p.evaluate(()=>outsidePlaytest.config.flow),'in');
 }
 // Cancellation before the queued preparation must not advance a stale day.
 assert.equal(await p.evaluate(async()=>{let n=0;lunaCampaign.beginDayTransition(1,2,()=>n++);lunaCampaign.dayTransition.time=2.3;lunaCampaign.tickDayTransition(0);lunaCampaign.cancelDayTransition();await Promise.resolve();await Promise.resolve();lunaCampaign.screen('developer');return n;}),0);
 assert.deepEqual(errors,[]);console.log('DAY_TRANSITION_OK: 0→1/1→2/2→3, black fade, centered number roll, input lock, covered preparation, soft reveal, sofa wake, cancellation');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
