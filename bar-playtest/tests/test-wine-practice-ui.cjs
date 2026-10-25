const assert=require('node:assert/strict');
const runtime=require('../../tools/lib/test-runtime.cjs'),{chromium}=runtime.load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('wine'))errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
  await page.locator('.updates-confirm').click();
  await page.locator('[data-act="miniWine"]').click();
  assert.equal(await page.locator('[data-act="miniWinePlay"]').count(),2);
  const progress=await page.evaluate(()=>JSON.stringify(barGame.progress));
  for(const version of [1,2]){
   await page.locator('[data-act="miniWinePlay"][data-id="'+version+'"]').click();
   const frame=await (await page.locator('.wine-practice-dialog iframe').elementHandle()).contentFrame();
   // A newly attached iframe can still be about:blank; an absent loading panel is not readiness.
   await frame.waitForFunction(()=>typeof imgB!=='undefined'&&imgB.complete&&imgB.naturalWidth>0);
   await frame.locator('#loading').waitFor({state:'hidden'});
   assert.equal(await frame.evaluate(()=>imgB.src.endsWith('/assets/items/item-red-wine.png')),true);
   const state=()=>frame.evaluate(v=>v===1?{phase,dur,held,turnAcc}:({phase:S.phase,dur:S.dur,held:S.held,turnAcc:S.turnAcc,tilt:S.tilt}),version);
   async function point(x,y){const b=await frame.locator('#cv').boundingBox();return{x:b.x+(1087+(x-1087)*.72)/2184*b.width,y:b.y+(340+(y-526)*.72)/1164*b.height};}
   async function move(x,y){const q=await point(x,y);await page.mouse.move(q.x,q.y);}
   async function click(x,y){await move(x,y);await page.mouse.down();await page.mouse.up();}
   async function drag(x,y,endX,endY,steps=25,delay=20){await move(x,y);await page.mouse.down();for(let i=1;i<=steps;i++){await move(x+(endX-x)*i/steps,y+(endY-y)*i/steps);await page.waitForTimeout(delay);}await page.mouse.up();}
   // Actual pointer controls, including keyboard correction in the advanced version.
   await drag(1162,566,1014,566);
   assert.equal((await state()).phase,version===1?'screw':'aim');
   if(version===2)await click(1087,526);
   await move(1317,466);await page.mouse.down();
   for(let i=1;i<=240;i++){
    const a=i/58*Math.PI*2;await move(1087+230*Math.cos(a),466+230*Math.sin(a));
    if(version===2){const s=await state();await page.keyboard.up('a');await page.keyboard.up('d');if(s.tilt>1)await page.keyboard.down('a');else if(s.tilt< -1)await page.keyboard.down('d');}
    await page.waitForTimeout(20);
    if((await state()).phase!=='screw')break;
   }
   await page.mouse.up();await page.keyboard.up('a');await page.keyboard.up('d');
   assert.equal((await state()).phase,version===1?'pull':'hook');
   if(version===1){await drag(1087,440,1087,280,40,20);}
   else{
    for(let stage=0;stage<2;stage++){
     await click(1029,532);assert.equal((await state()).phase,'lever');
     await drag(1347,400,1347,220,90,20);
    }
    await frame.waitForFunction(()=>S.phase==='fold');
    await drag(1087,980,1087,1100);await drag(1087,980,1087,1100);
    assert.equal((await state()).phase,'wrap');
    await move(1287,656);await page.mouse.down();
    for(let i=1;i<=64;i++){const a=i/60*Math.PI*2;await move(1087+200*Math.cos(a),656+200*Math.sin(a));await page.waitForTimeout(10);}
    await page.mouse.up();
   }
   await frame.locator('#panel').waitFor({state:'visible'});
   assert.notEqual(await frame.locator('#pBig').textContent(),'실패');
   await page.screenshot({path:'/private/tmp/wine-practice-v'+version+'-result.png'});
   await frame.locator('#again').click();assert.equal((await state()).phase,'foil');
   // A previous attempt's delayed failure must never overwrite a new attempt.
   await frame.evaluate(()=>crumble());await frame.locator('#bReset').click();
   await page.waitForTimeout(1900);assert.equal((await state()).phase,'foil');assert.equal(await frame.locator('#panel').isVisible(),false);
   await drag(1162,566,1014,566);
   if(version===2)await click(1087,526);
   await move(1317,466);await page.mouse.down();await frame.evaluate(()=>dispatchEvent(new Event('blur')));
   assert.equal((await state()).held,false);const before=await state();await page.waitForTimeout(250);assert.deepEqual(await state(),before);
   await page.mouse.up();await frame.locator('#resume').click();
   await frame.locator('#cv').press('Escape');assert(await frame.locator('#pause').isVisible());
   await frame.locator('#resume').press('Escape');assert.equal(await frame.locator('#pause').isVisible(),false);
   await frame.evaluate(()=>damage(101));await frame.locator('#panel').waitFor({state:'visible'});assert.equal(await frame.locator('#pBig').textContent(),'실패');
   for(const size of [{width:640,height:360},{width:800,height:1000},{width:1600,height:700}]){
    await page.setViewportSize(size);
    const box=await page.locator('.wine-practice-dialog').boundingBox();assert(box.x>=-.1&&box.y>=-.1&&box.x+box.width<=size.width+.1&&box.y+box.height<=size.height+.1);assert(Math.abs(box.width/box.height-16/9)<.01);
    const buttons=await frame.locator('#tools button').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return b.right<=innerWidth&&b.bottom<=innerHeight&&b.x>=0;}));assert(buttons.every(Boolean));
   }
   await page.setViewportSize({width:1280,height:720});
   await frame.locator('#bVersions').click();await page.locator('.wine-practice-dialog').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>JSON.stringify(barGame.progress)),progress);
  }
  await page.locator('[data-act="miniWinePlay"][data-id="1"]').click();
  const f=page.frameLocator('.wine-practice-dialog iframe');await f.locator('#loading').waitFor({state:'hidden'});await f.locator('#bExit').click();
  await page.locator('.wine-practice-dialog').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>barGame.overlay),null);assert(await page.locator('[data-act="miniWine"]').isVisible());
  assert.deepEqual(errors,[]);
  console.log('WINE_PRACTICE_OK: both versions real-pointer full success, failure, pause/resume, restart timers, version/lobby return, responsive 16:9, original wine resource, no progression changes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
