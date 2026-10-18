// Run with Playwright on NODE_PATH; CHROME_BIN and LUNA_TEST_URL are optional.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'luna-audit-fixed-'));
const url=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||(fs.existsSync(macChrome)?macChrome:undefined),headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
  async function load(query='?dev=1'){
   await p.goto(url+query);await p.waitForFunction(()=>window.barGame&&window.lunaCampaign);
   if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
   await p.addStyleTag({content:'.qa-launch{display:none!important}'});
  }
  async function drag(source,target){const a=await p.locator(source).boundingBox(),b=await p.locator(target).boundingBox();assert(a&&b);await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height*.8,{steps:8});await p.mouse.up();}
  // Real skip choice, manual coaster delivery and manual drink delivery in the main session.
  await load();
  await p.evaluate(()=>{const c=lunaCampaign;c.session.uninstall();c.session.install({developer:false});c.session.beginDay(0);c.screen(c.playView);c.render(true);});
  await p.waitForFunction(()=>barGame.dialogue&&!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
  await p.keyboard.press('Enter');await p.keyboard.press('Enter');await p.locator('.choices').waitFor();
  await p.locator('.choices button').nth(1).hover();await p.mouse.down();
  await p.waitForFunction(()=>!barGame.choice);await p.mouse.up();
  await p.evaluate(()=>{const g=barGame;for(let i=0;i<1000&&!g.storyCoaster;i++){g.cameraMoving=false;if(g.dialogue){g.advance();g.advance();}else g.tick(.1);}if(g.dialogue)g.dialogue.chars=g.dialogue.text.length;lunaCampaign.render(true);});
  await p.waitForFunction(()=>barGame.storyCoasterReady()&&!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
  assert(await p.evaluate(()=>barGame.progress.flags.day0_skip_tutorial&&!barGame.seats.R.coaster));
  const pickup='[data-drag="coaster"]',drop='[data-drop="R"]';await p.locator(pickup).waitFor();
  const a=await p.locator(pickup).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(10,10,{steps:5});await p.mouse.up();
  assert.equal(await p.evaluate(()=>barGame.seats.R.coaster),false);await p.locator(pickup).waitFor();
  await drag(pickup,drop);await p.waitForFunction(()=>barGame.seats.R.coaster);
  await p.evaluate(()=>{const g=barGame;for(let i=0;i<1000;i++){g.cameraMoving=false;if(g.currentOrder&&g.story?.steps[g.story.index]?.type==='craft')break;if(g.dialogue){g.advance();g.advance();}else g.tick(.1);}lunaCampaign.render(true);});
  await p.waitForTimeout(1100);await p.locator('.story-craft-prompt [data-act="recipes"]').click();await p.locator('[data-act="selectRecipe"][data-id="gin_tonic"]').click();
  await p.evaluate(()=>{barGame.debugCraft('excellent');barGame.offer();lunaCampaign.render(true);});
  await drag('[data-drag="drink"]',drop);await p.waitForFunction(()=>barGame.transactions.length===1&&!barGame.drink);
  await p.screenshot({path:path.join(out,'day0-skip-served.png')});
  console.log('PASS day0 skip: coaster cancel/retry, manual coaster and drink delivery');

  // No score injection: repeated keyboard presses at the same fixed-node visit.
  await load('?dev=1&mode=minigames');
  await p.locator('[data-act="miniStart"][data-id="shake"]').click();
  while(await p.locator('.mix-tutorial').isVisible())await p.locator('[data-act="mixTutorialNext"]').click();
  await p.evaluate(()=>{window.auditTick=barGame.tick;barGame.tick=()=>{};});
  await p.keyboard.press('Space');await p.keyboard.press('Space');
  for(let i=0;i<3;i++){await p.evaluate(()=>barGame.tickGimmick(.02));await p.keyboard.press('Space');}
  assert.deepEqual(await p.evaluate(()=>({success:barGame.gimmick.success,attempts:barGame.gimmick.attempts})),{success:1,attempts:4});
  await p.evaluate(()=>{const g=barGame;for(let i=0;i<2000;i++){g.tickGimmick(.005);if(LunaCore.MIX.nearest(g.gimmick)?.id==='fixed:0')return;}throw Error('Fixed node did not rearm');});
  await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>barGame.gimmick.success),2);
  await p.screenshot({path:path.join(out,'shake-rearmed.png')});
  await p.evaluate(()=>{barGame.tick=window.auditTick;});
  console.log('PASS shake: same visit cannot score twice; return visit can score');

  // Detail panel must not intercept any part of the Back button.
  await load();
  for(const size of [{width:1280,height:720},{width:960,height:540},{width:1920,height:1080}]){
   await p.setViewportSize(size);
   for(const id of ['gin_tonic','long_island','bottle_beer']){
    await p.evaluate(id=>{const g=barGame;lunaCampaign.ui.recipeOpen=false;g.reset(99,'practice',1,true,{variant:'original'});g.selectCocktail(id);lunaCampaign.render(true);},id);
    // Let the logical-stage resize settle before comparing tray positions.
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const trayBefore=await p.locator('.inventory-slot').first().boundingBox();
    await p.locator('.prep-recipe-brief').click();await p.locator('#prep-recipe-detail').waitFor();
    const trayAfter=await p.locator('.inventory-slot').first().boundingBox();assert.equal(trayAfter.x,trayBefore.x);
    const boxes=await p.evaluate(()=>{const panel=document.querySelector('#prep-recipe-detail').getBoundingClientRect(),button=document.querySelector('.prep-back'),back=button.getBoundingClientRect(),controls=document.querySelector('.prep-controls').getBoundingClientRect();return {bottom:panel.bottom,controlsTop:controls.top,backClear:document.elementFromPoint(back.x+back.width/2,back.y+1)?.closest('.prep-back')===button};});
    assert(boxes.bottom<boxes.controlsTop);assert(boxes.backClear);
    await p.locator('#prep-recipe-detail .prep-recipe-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
    assert(await p.locator('#prep-recipe-detail .prep-recipe-scroll').evaluate(e=>e.scrollTop>0));
    if(id==='gin_tonic')await p.screenshot({path:path.join(out,'prep-clear-'+size.width+'.png')});
    await p.locator('#prep-recipe-detail [data-act="togglePrepRecipe"]').click();
   }
  }
  console.log('PASS recipe: 3 recipes × 3 viewports, clear Back button and scrollable details');

  // Stage-specific spotlight and translated instructions, including automatic phase transitions.
  await p.setViewportSize({width:1280,height:720});await load('?dev=1&mode=minigames');
  for(const lang of ['ko','en']){
   await p.evaluate(lang=>{const g=barGame;g.lang=lang;g.reset(1,'practice',8,true,{variant:'original'});g.selectCocktail('bottle_beer');g.debugFill();g.startCraft();g.gimmick.openTutorial=true;window.auditTick=g.tick;g.tick=()=>{};lunaCampaign.render(true);},lang);
   await p.keyboard.press('Space');await p.locator('[data-open-spotlight="power"]').waitFor({state:'attached'});
   const rect=await p.locator('[data-open-spotlight="power"]').evaluate(e=>({x:+e.getAttribute('x'),y:+e.getAttribute('y'),w:+e.getAttribute('width'),h:+e.getAttribute('height')}));
   assert(rect.x<=391&&rect.x+rect.w>=439&&rect.y<=205&&rect.y+rect.h>=490);
   assert((await p.locator('.opening-lesson-copy').innerText()).includes(lang==='ko'?'초록':'green zone'));
   await p.screenshot({path:path.join(out,'opening-power-'+lang+'.png')});
   await p.evaluate(()=>barGame.tickGimmick(.7));await p.keyboard.press('Space');
   assert.equal(await p.evaluate(()=>barGame.gimmick.openPhase),'power-done');
   await p.evaluate(()=>barGame.tickGimmick(.5));await p.locator('[data-open-spotlight="rhythm"]').waitFor({state:'attached'});
   assert((await p.locator('.opening-lesson-copy').innerText()).includes(lang==='ko'?'겹칠':'overlaps'));
   await p.screenshot({path:path.join(out,'opening-rhythm-'+lang+'.png')});
   await p.evaluate(()=>barGame.tickGimmick(1.1));await p.keyboard.press('Space');
   assert(await p.evaluate(()=>barGame.gimmick.completed));
   await p.waitForFunction(()=>document.querySelector('.opening-lesson-copy')?.textContent.match(/잘했어요|Well done/));
   await p.evaluate(()=>{barGame.tick=window.auditTick;});
  }
  assert.deepEqual(errors,[]);console.log('PASS opening: power/rhythm spotlight, automatic transitions and KO/EN copy');
  console.log('SCREENSHOTS '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
