const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('.updates-confirm').click();
await p.evaluate(()=>barGame.reset(0,'full',7,true,{variant:'original'}));
const settled=()=>p.waitForFunction(()=>!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
const skipUntil=async fn=>{await p.keyboard.down('Control');await p.waitForFunction(fn);await p.keyboard.up('Control');};
await settled();await skipUntil(()=>!!barGame.choice);await p.locator('.choices button').first().click();await skipUntil(()=>barGame.tutorial?.kind==='seatExplore');await settled();
await p.locator('[data-guide="seatExplore"]').waitFor();assert.equal(await p.locator('.seat-indicators button').count(),3);
const origin=await p.evaluate(()=>barGame.focus),initial=await p.locator('.counter-plane').getAttribute('style');assert.equal(origin,'R');
await p.screenshot({path:'/private/tmp/day0-seat-explore.png'});
// Dots do not bypass the direction-key lesson.
await p.locator('.seat-indicators [data-id="L"]').click();assert.equal(await p.evaluate(()=>barGame.focus),'R');
await p.keyboard.press('KeyA');await p.keyboard.press('KeyA');assert.equal(await p.evaluate(()=>barGame.focus),'M');await settled();
await p.locator('.view-key.prev').click();await settled();assert.equal(await p.evaluate(()=>barGame.focus),'L');
await p.screenshot({path:'/private/tmp/day0-seat-left.png'});assert.notEqual(await p.locator('.counter-plane').getAttribute('style'),initial);
assert.equal(await p.evaluate(()=>barGame.dialogue),null);
await p.keyboard.press('Escape');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>barGame.overlay),'settings');await p.keyboard.press('Escape');
await p.keyboard.press('KeyD');await settled();await p.locator('.view-key.next').click();
assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'seatExplore');assert.equal(await p.evaluate(()=>barGame.dialogue),null);
await p.waitForFunction(()=>!barGame.tutorial&&!!barGame.dialogue);await settled();assert.equal(await p.evaluate(()=>barGame.focus),origin);assert.equal(await p.locator('.counter-plane').getAttribute('style'),initial);
assert.equal(await p.evaluate(()=>barGame.dialogue.text),'총 3개로 보입니다.');
await skipUntil(()=>barGame.tutorial?.kind==='seatIndicator');await p.locator('[data-guide="seatIndicator"]').waitFor();await p.screenshot({path:'/private/tmp/day0-seat-highlight.png'});
await p.locator('[data-act="tutorialBarContinue"]').click();await p.getByRole('dialog',{name:'좌석 알림'}).waitFor();
assert.equal(await p.locator('.day0-seat-legend-row').count(),6);assert.equal(await p.locator('.demo-blink').count(),2);assert.equal(await p.locator('.day0-seat-current .selected').count(),1);
const index=await p.evaluate(()=>barGame.story.index);await p.keyboard.down('Control');await p.waitForTimeout(400);await p.keyboard.up('Control');assert.equal(await p.evaluate(()=>barGame.story.index),index);
for(const vp of [{width:1280,height:720},{width:960,height:540},{width:600,height:800}]){await p.setViewportSize(vp);await p.waitForTimeout(150);assert(await p.locator('.day0-seat-legend').evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.left>=0&&b.bottom<=innerHeight&&b.right<=innerWidth;}));}
await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(150);await p.screenshot({path:'/private/tmp/day0-seat-legend.png'});
await p.keyboard.press('Space');await p.waitForFunction(()=>!!barGame.dialogue);assert.equal(await p.evaluate(()=>barGame.dialogue.text),'좋아, 이제 다음으로 넘어가자.');
await skipUntil(()=>barGame.tutorial?.kind==='coaster');
const drag=async(source,target,valid=true)=>{const a=await p.locator(source).boundingBox(),z=valid?await p.locator(target).boundingBox():{x:80,y:220,width:20,height:20};await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(z.x+z.width/2,z.y+z.height*.8,{steps:12});await p.mouse.up();};
await drag('[data-drag="coaster"]','[data-drop="R"]');await p.waitForFunction(()=>!!barGame.dialogue);await skipUntil(()=>barGame.tutorial?.kind==='recipe');
// Preparation is covered by the full tutorial UI test; produce its matching result here.
await p.evaluate(()=>{const g=barGame;g.tutorial=null;g.openRecipes();g.selectCocktail('gin_tonic');g.debugCraft();});
await p.locator('[data-act="offer"]:enabled').waitFor();await p.locator('[data-act="offer"]').click();await settled();await p.locator('[data-guide="serveDrink"]').waitFor();
assert.equal(await p.locator('[data-act="serve"]').count(),0);assert.equal(await p.evaluate(()=>barGame.serve('R')),false);
const transactions=await p.evaluate(()=>barGame.transactions.length);await drag('[data-drag="drink"]','[data-drop="R"]',false);assert.equal(await p.evaluate(()=>barGame.tutorial.kind),'serveDrink');assert.equal(await p.evaluate(()=>barGame.transactions.length),transactions);
assert.match(await p.locator('[data-guide="serveDrink"] .day0-drag-route').getAttribute('d'),/^M [\d. -]+ L [\d. -]+$/);await p.screenshot({path:'/private/tmp/day0-serve-drink.png'});await drag('[data-drag="drink"]','[data-drop="R"]');
await p.waitForFunction(()=>!barGame.tutorial&&!!barGame.dialogue);assert.equal(await p.evaluate(()=>barGame.dialogue.text),'음…');assert.equal(await p.evaluate(()=>barGame.transactions.length),transactions+1);assert.equal(await p.evaluate(()=>barGame.progress.flags.day0_drink_taught),true);
assert.deepEqual(errors,[]);console.log('DAY0_NEW_UI_OK: actual keyboard/arrows, both ends and return, camera wait, indicator legend, 3 viewport sizes, real drink drag, wrong-drop rejection and single settlement');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
