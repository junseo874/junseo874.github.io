const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>resourceReview?.ready);
  await p.click('[data-group="common-popups"]');await p.click('[data-id="popup:meet"]');
  const f=p.frames().find(f=>f.url().includes('resourceReview=1')),card=f.locator('.story-notice-people');
  for(const actor of ['port','aili','bubi','shiba','samho','tom']){
   await p.selectOption('#popup-actor',actor);await f.waitForFunction(id=>document.querySelector('.story-notice-people:not([hidden])')?.dataset.actor===id,actor);
   assert.equal(await card.locator('small').innerText(),'새로운 인물!');assert.equal(await card.locator('strong').innerText(),await f.evaluate(id=>barGame.name(id),actor));assert.equal(await card.locator('.story-notice-icon').count(),0);
  }
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.emulateMedia({reducedMotion:'reduce'});
  for(const width of [390,1280]){
   await p.setViewportSize({width,height:720});
   await p.evaluate(()=>{barGame.reset(99,'practice',1,true);barGame.screen='bar';LunaStoryNotices.clear();delete barGame.progress.flags.shiba_met;LunaStoryNotices.meet(barGame.progress,'shiba');});
   const c=p.locator('.story-notice-people');await c.waitFor({state:'visible'});await p.waitForTimeout(300);
   const box=await c.boundingBox(),scale=Math.min(width/1280,720/720);assert(box.x>=0&&box.x+box.width<=width);assert(box.width/scale>=220&&box.width/scale<300&&box.height/scale<100);
   assert(await c.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.querySelector('strong').scrollWidth<=el.querySelector('strong').clientWidth));
   await p.screenshot({path:'/private/tmp/new-person-'+width+'.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS six character names in resource preview, iconless two-line content, compact desktop/mobile fit, reduced motion and no errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
