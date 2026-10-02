const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home',variant:'original'});await outsidePlaytest.start();const m=outsidePlaytest.model;m.x=3.364;m.backgroundStory.cancel();m.story.cancel();m.updateNear();});
 await p.keyboard.press('KeyE');await p.locator('.terrace-scene').waitFor();await p.waitForFunction(()=>!lunaCampaign.memoryTransition);assert.equal(await p.locator('.campaign-portrait').count(),0);assert.equal(await p.locator('#campaign-root.over-outside').count(),0);
 assert.equal(await p.locator('.terrace-scene').getAttribute('data-terrace-speaker'),'chris');await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});
 let x=await p.locator('.terrace-bubble').evaluate(e=>e.getBoundingClientRect().x+e.getBoundingClientRect().width/2);assert(Math.abs(x-381.333)<1);
 await p.keyboard.press('KeyE');assert.equal(await p.locator('.terrace-scene').getAttribute('data-terrace-speaker'),'luna');x=await p.locator('.terrace-bubble').evaluate(e=>e.getBoundingClientRect().x+e.getBoundingClientRect().width/2);assert(Math.abs(x-472)<1);
 const outline=await p.locator('.terrace-bubble').evaluate(e=>getComputedStyle(e).outlineStyle);assert.equal(outline,'none');await p.locator('.terrace-bubble').hover();assert.equal(await p.locator('.terrace-bubble').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.dialog.background),'terrace');
 await p.evaluate(()=>{while(lunaCampaign.view==='scene'){lunaCampaign.dialog.chars=1e5;lunaCampaign.next();}});assert(await p.evaluate(()=>outsidePlaytest.active));assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),3.364);
 // Developer sofa preview uses the same terrace view, with the entrance prelude removed.
 await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=2.557;m.updateNear();});await p.keyboard.press('KeyE');await p.waitForFunction(()=>!lunaCampaign.memoryTransition);assert.equal(await p.evaluate(()=>lunaCampaign.dialog.rows[0].text),'오래 기다렸나?');
 await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});await p.screenshot({path:'/private/tmp/terrace-final-chris.png'});
 // Every retained night line stays above its seated actor, including the longest lines.
 for(const key of ['night0','night1','ending'])for(const [width,height] of [[1280,720],[960,540]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(120);await p.evaluate(key=>lunaCampaign.scene(key,'테라스','terrace',()=>lunaCampaign.screen('developer')),key);await p.waitForFunction(()=>!lunaCampaign.memoryTransition);
  const count=await p.evaluate(()=>lunaCampaign.dialog.rows.length);for(let i=0;i<count;i++){
   const box=await p.locator('.terrace-speech').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   if(await p.locator('.terrace-bubble').count())assert(box.y+box.height<height*165/270);
   await p.evaluate(()=>{lunaCampaign.dialog.chars=1e5;lunaCampaign.next();});
   if(key==='night0'&&i===12){await p.waitForFunction(()=>lunaCampaign.view==='prologue'&&!lunaCampaign.memoryTransition);await p.evaluate(()=>lunaCampaign.finishCinema(true));await p.waitForFunction(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);}
  }
 }
 // Verify only terrace night keys are queued; original source scenes remain intact for QA.
 const routes=await p.evaluate(()=>{const c=lunaCampaign,oldScene=c.scene,oldStreet=c.street,oldEnd=c.session.endDay,oldTransition=c.beginDayTransition;let current;const out=[];c.beginDayTransition=(from,to,prepare)=>prepare();c.street=()=>{current.nextDay=true;};c.session.endDay=()=>{c.session.day++;return true;};c.scene=(key,title,bg,done)=>{current.keys.push(key);current.backgrounds.push(bg);done();};for(let day=0;day<4;day++){current={day,keys:[],backgrounds:[],nextDay:false};c.session.day=day;c.nightStarted=false;c.sleep();out.push(current);}c.scene=oldScene;c.street=oldStreet;c.session.endDay=oldEnd;c.beginDayTransition=oldTransition;return out;});
 assert.deepEqual(routes.map(r=>r.keys),[['night0'],['workshop','night1'],[],['ending']]);assert.deepEqual(routes.map(r=>r.nextDay),[true,true,true,false]);assert(await p.evaluate(()=>LUNA_CAMPAIGN_DATA.scenes.night1.length===19&&LUNA_CAMPAIGN_DATA.scenes.workshop.length===12));
 assert.deepEqual(errors,[]);console.log('TERRACE_UI_OK: normal entry, left/right speech anchors, no portrait/double outline, ESC/resume, developer sleep preview, all line bounds, sleep-only terrace routing, source preservation');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
