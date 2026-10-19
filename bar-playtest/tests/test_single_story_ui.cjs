const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();
 await p.locator('[data-campaign="new"]').click();
 await p.waitForFunction(()=>['prologue','load-error'].includes(lunaCampaign.view),null,{timeout:60000});
 assert.equal(await p.evaluate(()=>lunaCampaign.view),'prologue');
 assert(await p.evaluate(()=>lunaCampaign.data===LUNA_CAMPAIGN_DATA&&lunaCampaign.session.story===LUNA_CAMPAIGN_DATA));
 assert.equal(await p.evaluate(()=>lunaCampaign.storyVersion),'A');assert.equal(await p.evaluate(()=>typeof LUNA_CAMPAIGN_STORY_B),'undefined');
 assert.equal(await p.locator('[data-campaign^="story:"]').count(),0);
 assert(await p.evaluate(()=>outsidePlaytest.active&&outsidePlaytest.model.scene==='home'&&lunaCampaign.cinema.studio));
 assert(!requests.some(url=>/campaign-story-b|cinematic\/scene5/.test(url)));
 // Removed entry actions cannot switch back to the retired script.
 await p.evaluate(()=>lunaCampaign.action('story:B'));assert.equal(await p.evaluate(()=>lunaCampaign.storyVersion),'A');
 await p.evaluate(()=>lunaCampaign.finishCinema(true));
 assert(await p.evaluate(()=>lunaCampaign.cinema.time>=lunaCampaign.cinema.skipUntil&&!lunaCampaign.canSkipCinema()));
 await p.evaluate(()=>{const c=lunaCampaign,last=c.cinema.scene.clips.filter(x=>x.track==='phone-lines').at(-1);c.cinema.time=last.start;c.cinema.dialogueWait={id:last.id,age:99,revealed:true};c.advanceCinemaDialogue();});
 await p.waitForFunction(()=>lunaCampaign.view==='game'&&outsidePlaytest.model.controlsTutorial);
 await p.waitForTimeout(1600);await p.keyboard.press('KeyE');
 assert.equal(await p.evaluate(()=>barGame.progress.objectives.first_commute.status),'active');
 await p.evaluate(()=>lunaCampaign.developer());
 if(await p.locator('.updates-confirm').isVisible()){await p.locator('.updates-dismiss input').check();await p.locator('.updates-confirm').click();}
 await p.locator('[data-act="version"][data-id="cutscenes"]').click();assert.equal(await p.locator('.cutscene-card').count(),12);
 assert(!/버전 B|VERSION B|A \/ B/.test(await p.locator('.cutscene-panel').innerText()));
 // Even an old caller supplying B to the public start method gets the canonical story.
 await p.evaluate(()=>lunaCampaign.newGame('B'));await p.waitForFunction(()=>lunaCampaign.view==='prologue');
 assert.equal(await p.evaluate(()=>lunaCampaign.storyVersion),'A');assert(await p.evaluate(()=>lunaCampaign.cinema.studio));
 assert.deepEqual(errors,[]);console.log('PASS single canonical story: title → A, no version picker/B resources, dream skip retains contact, controls/goal, gallery cleanup, stale-call safety');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
