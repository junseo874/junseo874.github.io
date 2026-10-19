const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/');await page.evaluate(()=>lunaCampaign.newGame('A'));
  await page.waitForFunction(()=>lunaCampaign.view==='prologue');
  const setup=await page.evaluate(()=>{
   const c=lunaCampaign,p=c.cinema.scene,last=p.clips.filter(c=>c.track==='phone-lines').at(-1);
   window.returnProbe={fades:0,endFrames:0};const transition=c.beginMemoryTransition;
   c.beginMemoryTransition=function(...args){returnProbe.fades++;return transition.apply(this,args);};
   const render=c.cinema.player.render;c.cinema.player.render=function(t,...args){if(t>=p.end)returnProbe.endFrames++;return render.call(this,t,...args);};
   c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:0,revealed:false};
   c.cinema.player.render(last.start,null,false,0,c.cinema.dialogueWait);
   return {lastEnd:last.start+last.duration,end:p.end,exitFade:p.clips.some(c=>c.type==='fx'&&c.effect==='fadeOut'&&c.start>=last.start)};
  });
  assert(Math.abs(setup.end-setup.lastEnd-.8)<.001);assert.equal(setup.exitFade,false);
  await page.keyboard.press('KeyE');assert(await page.evaluate(()=>lunaCampaign.cinema.dialogueWait.revealed));
  await page.keyboard.down('KeyE');
  assert.equal(await page.evaluate(()=>lunaCampaign.view),'prologue');
  await page.waitForFunction(()=>lunaCampaign.view==='game'&&outsidePlaytest.model.controlsTutorial);
  const result=await page.evaluate(()=>({view:lunaCampaign.view,cinema:lunaCampaign.cinema,transition:!!lunaCampaign.memoryTransition,
   overlay:!!document.querySelector('.campaign-memory-transition'),tutorial:outsidePlaytest.model.controlsTutorial,
   paused:outsidePlaytest.model.paused,goal:!!barGame.progress.objectives?.first_commute,probe:returnProbe,
   location:outsidePlaytest.model.x}));
  assert.equal(result.view,'game');assert.equal(result.cinema,null);assert.equal(result.transition,false);assert.equal(result.overlay,false);
  assert(result.tutorial&&!result.paused&&!result.goal);assert.deepEqual(result.probe,{fades:0,endFrames:0});
  await page.keyboard.down('KeyE');assert(await page.evaluate(()=>outsidePlaytest.model.controlsTutorial));
  await page.keyboard.up('KeyE');assert(await page.locator('.outside-controls-tutorial').isVisible());
  await page.screenshot({path:'/private/tmp/contact-direct-tutorial.png'});
  await page.waitForTimeout(2100);await page.keyboard.press('KeyD');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.controlsTutorial),true,'Movement does not dismiss the E-only controls guide');
  await page.keyboard.press('KeyE');assert.equal(await page.locator('.outside-controls-tutorial').getAttribute('data-step'),'1');
  await page.waitForTimeout(1600);await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.controlsTutorial),false);
  assert.equal(await page.evaluate(()=>outsidePlaytest.model.x),result.location);
  // Documentary entry/exit retains its own fade policy.
  await page.evaluate(()=>lunaCampaign.playDayZeroTV(outsidePlaytest.model));
  await page.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition);
  assert.equal(await page.evaluate(()=>lunaCampaign.cinema.returnTransition),undefined);
  assert.deepEqual(errors,[]);console.log('PASS: last line acknowledgement -> reverse holo shutdown -> tutorial, no fade/empty canvas frame, no accidental tutorial dismissal or movement, TV transition retained.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
