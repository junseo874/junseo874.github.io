const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
 await page.evaluate(async()=>{const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.install({developer:false});barGame.reset(0,'full',1,false);c.session.carry=structuredClone(barGame.progress);Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'bar'});await outsidePlaytest.start();c.screen(c.playView);const m=outsidePlaytest.model;m.x=LunaOutsideBeliever.place.x-.35;m.y=-.7;m.level=0;m.story.cancel();m.backgroundStory.cancel();m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
 assert.equal(await page.evaluate(()=>outsidePlaytest.model.near.id),'street-believer');assert.equal(await page.locator('.outside-interact').innerText(),'E\n대화하기');
 const dir=path.join(__dirname,'../../artifacts/believer-npc');await fs.mkdir(dir,{recursive:true});await page.waitForTimeout(300);await page.screenshot({path:path.join(dir,'location.png')});
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>outsidePlaytest.model.story.speech?.id==='street-believer');
 await page.evaluate(()=>{outsidePlaytest.model.story.speech.elapsed=999;outsidePlaytest.refreshHUD();});await page.screenshot({path:path.join(dir,'dialogue.png')});
 await page.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<40&&m.story.speech&&!barGame.progress.flags.believer_emblem_received;i++){m.story.speech.elapsed=999;m.story.advance();}outsidePlaytest.tick(.1);});
 assert.equal(await page.evaluate(()=>barGame.progress.inventory.machine_church_emblem),1);assert.equal(await page.locator('.outside-item-notice strong').innerText(),'기신교의 엠블럼 획득!');await page.screenshot({path:path.join(dir,'reward.png')});
 assert(await page.evaluate(()=>LunaOutsideBeliever.visible(outsidePlaytest.model)));
 await page.evaluate(()=>{const m=outsidePlaytest.model;while(m.story.speech){m.story.speech.elapsed=999;m.story.advance();}outsidePlaytest.tick(0);});
 assert.equal(await page.evaluate(()=>LunaOutsideBeliever.targets(outsidePlaytest.model).length),0);assert(await page.evaluate(()=>lunaCampaign.session.carry.flags.believer_conversation_done));
 assert.equal(await page.evaluate(()=>{outsidePlaytest.model.config={day:1,flow:'in'};return LunaOutsideBeliever.visible(outsidePlaytest.model);}),false);assert.deepEqual(errors,[]);
 console.log('BELIEVER_UI_OK real interaction, anchored dialogue, emblem notice, one-time reward and disappearance.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
