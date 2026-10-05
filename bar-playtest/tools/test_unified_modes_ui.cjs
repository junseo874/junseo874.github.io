const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');await p.locator('.updates-confirm').click();
 assert.equal(await p.locator('[data-act="miniRules"],[data-act="miniDifficulty"]').count(),0);assert.equal(await p.locator('.minigame-card').count(),5);
 await p.screenshot({path:'/private/tmp/unified-minigames.png'});
 for(const kind of ['open','pour','fill_up','shake','stir']){
  await p.locator('[data-act="miniStart"][data-id="'+kind+'"]').click();
  assert.deepEqual(await p.evaluate(()=>({v:barGame.variant,m:barGame.minigame.variant,d:barGame.minigame.difficulty,kind:barGame.minigame.kind})),{v:'original',m:'original',d:'standard',kind});
  await p.evaluate(()=>{barGame.retryMinigame();if(barGame.variant!=='original')throw Error('retry variant');});
  await p.locator('[data-act="miniExit"]').click();
 }
 await p.locator('[data-act="version"][data-id="original"]').click();assert.equal(await p.locator('[data-act="serviceVersion"]').count(),0);
 assert.equal(await p.evaluate(()=>{barGame.reset(1,'general',1,true,{serviceVersion:'B'});return barGame.serviceVersion;}),'A');
 assert.equal(await p.evaluate(()=>barGame.queue.length),2);assert.equal(await p.evaluate(()=>barGame.queue.some(r=>r.type==='mixed_general')),false);
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();assert.equal(await p.evaluate(()=>lunaCampaign.view),'title');
 assert.equal(await p.locator('[data-campaign^="service:"],.campaign-version-switch,.campaign-day').count(),0);
 await p.screenshot({path:'/private/tmp/unified-title.png'});await p.locator('[data-campaign="new"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
 assert.equal(await p.evaluate(()=>lunaCampaign.session.day),0);assert.equal(await p.evaluate(()=>lunaCampaign.session.serviceVersion),'A');assert.equal(await p.locator('.campaign-day').count(),0);
 await p.keyboard.down('Space');await p.waitForFunction(()=>lunaCampaign.view==='awakening');await p.keyboard.up('Space');await p.waitForFunction(()=>lunaCampaign.view==='game');assert.equal(await p.evaluate(()=>barGame.day),0);
 await p.keyboard.press('KeyP');await p.locator('[data-campaign="dev-home"]').click();await p.waitForFunction(()=>outsidePlaytest.devConsoleOpen&&lunaCampaign.view==='game');
 const action=a=>p.locator('[data-outside-action="'+a+'"]');
 assert(await action('dev-day-3').isVisible());assert.equal(await action('dev-day-99').isVisible(),false);
 await p.evaluate(()=>{barGame.progress.money=1777;barGame.progress.flags.test_kept=true;});
 for(const day of [1,2,3,0,2]){await action('dev-day-'+day).click();assert.deepEqual(await p.evaluate(()=>({day:barGame.day,progress:barGame.progress.day,session:lunaCampaign.session.day,outside:outsidePlaytest.model.config.day,money:barGame.progress.money,flag:barGame.progress.flags.test_kept,scene:outsidePlaytest.model.scene})),{day,progress:day,session:day,outside:day,money:1777,flag:true,scene:'home'});}
 for(const flow of ['in','out','in']){await action('dev-flow-'+flow).click();assert.equal(await p.evaluate(()=>lunaCampaign.session.route),flow);}
 for(const place of ['elevator','home','bar']){await action('dev-'+place).click();assert.equal(await p.evaluate(()=>outsidePlaytest.model.scene),place==='home'?'home':'street');}
 await action('dev-day-99').evaluate(()=>outsidePlaytest.devAction('dev-day-99'));assert.equal(await p.evaluate(()=>lunaCampaign.session.day),2);
 await p.waitForTimeout(300);await p.screenshot({path:'/private/tmp/unified-main-console.png'});
 await p.keyboard.press('KeyP');await p.keyboard.press('KeyE');await p.waitForFunction(()=>!outsidePlaytest.active&&!lunaCampaign.doorTransition&&lunaCampaign.view==='game',null,{timeout:60000});
 assert.equal(await p.evaluate(()=>barGame.day),2);assert.equal(await p.evaluate(()=>lunaCampaign.session.route),'bar');assert.equal(await p.evaluate(()=>barGame.progress.money),1777);assert.equal(await p.evaluate(()=>barGame.serviceVersion),'A');
 // Night route follows the changed day, then normal sleep advances from that day.
 await p.keyboard.press('KeyP');await p.locator('[data-campaign="dev-home"]').click();await p.waitForFunction(()=>outsidePlaytest.devConsoleOpen);await action('dev-day-1').click();await action('dev-flow-out').click();await p.keyboard.press('KeyP');
 await p.evaluate(()=>{outsidePlaytest.model.wakeAtSofa();outsidePlaytest.snapCamera();outsidePlaytest.model.updateNear();});await p.keyboard.press('KeyE');assert.equal(await p.evaluate(()=>lunaCampaign.view),'sleep');await p.locator('[data-campaign="sleep-confirm"]').click();
 await p.waitForFunction(()=>lunaCampaign.view==='scene');assert.equal(await p.evaluate(()=>lunaCampaign.dialog.background),'black');
 for(let i=0;i<8;i++){await p.evaluate(()=>{for(let j=0;j<100&&lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition;j++)lunaCampaign.next();});if(await p.evaluate(()=>!!lunaCampaign.dayTransition))break;await p.waitForTimeout(700);}
 await p.waitForFunction(()=>outsidePlaytest.active&&lunaCampaign.view==='game'&&!lunaCampaign.dayTransition&&lunaCampaign.session.day===2,null,{timeout:20000});assert.equal(await p.evaluate(()=>outsidePlaytest.model.config.flow),'in');
 assert.deepEqual(errors,[]);console.log('UNIFIED_MODES_OK five original minigames/retry, no rule/difficulty/B/day picker, actual day0 dream+skip, main P all days/routes/locations, carry, day2 bar, day1 sleep -> day2');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
