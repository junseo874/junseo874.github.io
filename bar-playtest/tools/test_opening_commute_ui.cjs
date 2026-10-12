const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[];
  p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();
  await p.waitForFunction(()=>['prologue','load-error'].includes(lunaCampaign.view),null,{timeout:60000});
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue',await p.evaluate(()=>lunaCampaign.loadError));
  const state=await p.evaluate(()=>{const c=lunaCampaign,p=c.cinema.scene;return{template:p.template,lines:p.clips.filter(c=>c.type==='dialogue').length,phone:p.clips.filter(c=>c.track==='phone-lines'),visuals:p.clips.filter(c=>c.type==='visual'),day:c.session.day,route:c.session.route,home:outsidePlaytest.model.scene};});
  assert.equal(state.template,'opening');assert.equal(state.lines,20);assert.equal(state.day,0);assert.equal(state.route,'in');assert.equal(state.home,'home');
  assert.equal(state.visuals.find(c=>c.actor==='dream-luna').assetId,'opening-luna');
  assert(state.visuals.filter(c=>c.actor==='home-luna').every(c=>c.assetId==='opening-luna-home'&&c.from.x===c.to.x&&c.from.y===c.to.y));
  assert(!state.visuals.some(c=>c.actor==='phone'));assert(state.phone.every(c=>c.actor==='home-luna'&&c.offsetX===0));assert.equal(state.phone.filter(c=>c.remote&&c.text.includes('#50d9f5')).length,4);
  for(const [name,t] of [['dream',10],['sleep',54.8],['home',state.phone[0].start+2],['contact-long',state.phone.at(-1).start+5]]){
   await p.evaluate(t=>{const c=lunaCampaign;c.cinema.time=t;c.cinema.player.render(t,null,false);},t);
   await p.locator('.campaign-stage').screenshot({path:'/private/tmp/main-opening-'+name+'.png'});
  }
  await p.evaluate(()=>{lunaCampaign.cinema.time=10;});
  await p.keyboard.down('Space');await p.waitForTimeout(800);await p.keyboard.press('Escape');await p.keyboard.up('Space');
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');assert.equal(await p.evaluate(()=>StudioMedia.activeVoices),0);
  const paused=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused);
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.cinemaHoldStart),null);
  await p.keyboard.down('Space');await p.waitForTimeout(3200);await p.keyboard.up('Space');
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
  assert(await p.evaluate(()=>lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil&&lunaCampaign.cinema.time<lunaCampaign.cinema.skipUntil+1));
  assert.equal(await p.evaluate(()=>lunaCampaign.canSkipCinema()),false);assert(await p.locator('.campaign-skip').isHidden());
  const homeTime=await p.evaluate(()=>lunaCampaign.cinema.time);
  await p.keyboard.down('Space');await p.waitForTimeout(3300);await p.keyboard.up('Space');
  assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
  assert(await p.evaluate(t=>lunaCampaign.cinema.time<t+5,homeTime));
  await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  assert(await p.locator('.campaign-skip').isHidden());assert.equal(await p.evaluate(()=>lunaCampaign.cinemaHoldStart),null);
  await p.evaluate(()=>{const c=lunaCampaign;const before=c.cinema.time;c.finishCinema(true);if(c.cinema.time!==before)throw Error('contact skipped');c.cinema.time=c.cinema.scene.end-.01;});
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
  assert.deepEqual(await p.evaluate(()=>({day:barGame.day,route:lunaCampaign.session.route,scene:outsidePlaytest.model.scene,x:outsidePlaytest.model.x,flow:outsidePlaytest.model.config.flow,paused:outsidePlaytest.model.paused})),{day:0,route:'in',scene:'home',x:2.557,flow:'in',paused:false});
  await p.locator('#outside-root').screenshot({path:'/private/tmp/main-opening-commute.png'});
  for(const flow of ['in','out','in']){
   await p.evaluate(flow=>{const m=outsidePlaytest.model;m.config.flow=flow;m.x=1.22;m.updateNear();},flow);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.near.id),'tv');
   const before=await p.evaluate(()=>JSON.stringify({money:barGame.progress.money,flags:barGame.progress.flags,flow:outsidePlaytest.model.config.flow,x:outsidePlaytest.model.x}));
   await p.keyboard.press('KeyE');assert(await p.evaluate(()=>!!lunaCampaign.memoryTransition));
   await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.template),'documentary');
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue').length),33);
   assert.equal(await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='visual').length),5);
   await p.evaluate(()=>{lunaCampaign.cinema.time=7;lunaCampaign.cinema.player.render(7,null,false);});
   await p.locator('.campaign-stage').screenshot({path:'/private/tmp/main-opening-documentary.png'});
   if(flow==='out')await p.evaluate(()=>{lunaCampaign.cinema.time=lunaCampaign.cinema.scene.end-.01;});
   else {await p.keyboard.down('Space');await p.waitForTimeout(3200);await p.keyboard.up('Space');}
   await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
   assert.equal(await p.evaluate(()=>JSON.stringify({money:barGame.progress.money,flags:barGame.progress.flags,flow:outsidePlaytest.model.config.flow,x:outsidePlaytest.model.x})),before);
   assert.equal(await p.evaluate(()=>StudioMedia.activeVoices),0);
  }
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.config.day=1;});assert.equal(await p.evaluate(()=>outsidePlaytest.model.targets().some(t=>t.id==='tv')),false);
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.config.day=0;m.scene='street';m.level=0;m.x=1.0086;m.y=-.7;m.story.cancel();m.backgroundStory.cancel();m.updateNear();});
  await p.keyboard.press('KeyE');await p.waitForFunction(()=>lunaCampaign.session.route==='bar'&&!lunaCampaign.doorTransition,null,{timeout:60000});
  assert.equal(await p.evaluate(()=>outsidePlaytest.active),false);assert.equal(await p.evaluate(()=>barGame.story?.scene?.id),'d1_tutorial_chris');
  await p.evaluate(()=>{lunaCampaign.toPicker();lunaCampaign.action('title');});await p.locator('[data-campaign="new"]').click();
  await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
  await p.evaluate(()=>{const c=lunaCampaign;c.cinema.time=c.cinema.skipUntil-.01;c.cinemaHoldStart=performance.now()-2900;c.tick(.02);if(c.canSkipCinema()||c.cinemaHoldStart!==null)throw Error('natural wake retained skip');
   for(const line of c.cinema.scene.clips.filter(c=>c.track==='phone-lines')){c.cinema.time=line.start+.1;const before=c.cinema.time;c.finishCinema(true);if(c.cinema.time!==before)throw Error('phone line skipped');}
   c.cinema.time=c.cinema.scene.end-.01;
  });
  await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
  assert.equal(await p.evaluate(()=>lunaCampaign.session.route),'in');assert.equal(await p.evaluate(()=>outsidePlaytest.model.scene),'home');
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS opening / costumes / phone / ESC pause / hold skip / day0 commute / TV in-out-repeat + natural end / bar tutorial',JSON.stringify(state.phone.map(c=>({start:c.start,speaker:c.speaker}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
