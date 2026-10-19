const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(async()=>{const c=lunaCampaign;c.session.uninstall();c.session.install();c.session.beginCommute(0);await c.street('in','bar');window.entryFrames=[];window.observeEntry=true;function watch(){if(!observeEntry)return;const d=c.doorTransition;if(d?.revealAt!=null)entryFrames.push({setup:!!document.querySelector('#app .start-screen'),hidden:document.querySelector('#app').hidden,phase:barGame.phase,screen:barGame.screen});requestAnimationFrame(watch);}requestAnimationFrame(watch);c.startBar(0,c.session.carry);});
 await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.doorTransition,null,{timeout:60000});
 const frames=await p.evaluate(()=>{observeEntry=false;return entryFrames;});assert(frames.length>5);assert(frames.every(f=>!f.setup&&!f.hidden&&f.phase!=='ready'&&f.screen==='bar'),JSON.stringify(frames));
 await p.screenshot({path:'/private/tmp/day0-entry-no-lobby.png'});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(()=>{barGame.reset(0,'practice',7,true,{variant:'original'});barGame.tutorial=null;barGame.screen='recipe';});await p.locator('[data-act="selectRecipe"][data-id="gin_tonic"]').click();
 await p.evaluate(()=>{barGame.tutorial={kind:'prepRecipeOpen'};});await p.waitForTimeout(120);await p.locator('.prep-recipe-brief').hover();await p.waitForTimeout(250);
 assert.equal(+(await p.locator('[data-guide-ring="source"]').getAttribute('width')),0);assert(+(await p.locator('[data-guide-hole="source"]').getAttribute('width'))>0);
 await p.evaluate(()=>{barGame.tutorial=null;});await p.locator('.shelf-arrow.next').click();await p.waitForTimeout(550);await p.locator('.shelf-arrow.next').click();await p.waitForTimeout(550);
 await p.evaluate(()=>{barGame.tutorial={kind:'prepHover'};});await p.waitForTimeout(120);const gin=p.locator('.shelf-slide[data-current="true"] [data-hover-item="gin"]');await gin.hover();await p.waitForTimeout(120);
 assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'prepAdd');assert(+(await p.locator('[data-guide-ring="source"]').getAttribute('width'))>0);assert.equal(+(await p.locator('[data-guide-ring="target"]').getAttribute('width')),0);assert(+(await p.locator('[data-guide-hole="target"]').getAttribute('width'))>0);
 await p.screenshot({path:'/private/tmp/tutorial-static-glow-only.png'});await gin.click();assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'prepRemove');
 assert.deepEqual(errors,[]);console.log('PASS day0 reveal has actual bar on every frame, recipe preview/hover tip have no glow, fixed ingredient target and tutorial progression preserved');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
