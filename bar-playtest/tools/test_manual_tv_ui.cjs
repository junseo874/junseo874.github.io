const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.waitForFunction(()=>window.outsidePlaytest);if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(async()=>{const c=lunaCampaign;c.session.uninstall();c.session.install({serviceVersion:'A'});c.session.beginCommute(0);c.screen('game');Object.assign(outsidePlaytest.config,{day:0,flow:'in',place:'home'});await outsidePlaytest.start();outsidePlaytest.model.x=1.22;outsidePlaytest.model.updateNear();outsidePlaytest.tick(0);});
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait&&!lunaCampaign.memoryTransition,null,{timeout:60000});
 const lines=await p.evaluate(()=>lunaCampaign.cinema.scene.clips.filter(c=>c.type==='dialogue'));assert.equal(lines.length,33);assert(lines.every(c=>c.wait&&c.textEffect==='typewriter'));
 await p.evaluate(()=>{const draw=LunaDialogueCue.draw;window.cueDraws=0;LunaDialogueCue.draw=(...args)=>{cueDraws++;return draw(...args);};});
 const first=await p.evaluate(()=>({id:lunaCampaign.cinema.dialogueWait.id,time:lunaCampaign.cinema.time}));
 await p.waitForTimeout(4200);assert.deepEqual(await p.evaluate(()=>({id:lunaCampaign.cinema.dialogueWait.id,time:lunaCampaign.cinema.time})),first);assert(await p.evaluate(()=>cueDraws>0));
 await p.screenshot({path:'/private/tmp/tv-manual-complete.png'});
 await p.keyboard.press('KeyE');await p.waitForFunction(id=>lunaCampaign.cinema.dialogueWait?.id!==id&&!!lunaCampaign.cinema.dialogueWait,first.id);
 // Capture the next line immediately: no completion cue while typing.
 const second=await p.evaluate(()=>{const c=lunaCampaign.cinema;c.dialogueWait.age=0;cueDraws=0;c.player.render(c.time,null,false,.5,c.dialogueWait);return{id:c.dialogueWait.id,cues:cueDraws};});assert.equal(second.cues,0);
 await p.keyboard.down('KeyE');assert(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.revealed));assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),second.id);
 await p.keyboard.down('KeyE');assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),second.id);await p.keyboard.up('KeyE');
 assert(await p.evaluate(()=>cueDraws>0));
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.cinema.dialogueWait.id),second.id);
 // Advance every remaining line; even elapsed clip duration cannot advance it.
 for(let i=1;i<lines.length;i++){
  await p.waitForFunction(id=>lunaCampaign.cinema?.dialogueWait?.id===id,lines[i].id);
  await p.evaluate(()=>{const c=lunaCampaign.cinema;c.dialogueWait.age=100;c.player.render(c.time,null,false,.5,c.dialogueWait);});
  await p.keyboard.press(['KeyE','Enter','Space'][i%3]);
 }
 await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
 // Whole-documentary skip remains available even while a manual line is waiting.
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>lunaCampaign.cinema?.dialogueWait&&!lunaCampaign.memoryTransition);
 await p.keyboard.down('Space');await p.waitForTimeout(3200);await p.keyboard.up('Space');await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition,null,{timeout:15000});
 assert.deepEqual(errors,[]);console.log('PASS 33 manual TV lines / typing then reveal then advance / cue / no held-key repeat / E Enter Space / ESC resume / end return / hold-to-skip');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
