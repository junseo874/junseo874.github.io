const assert = require('node:assert/strict');
const rt = require('../../tools/lib/test-runtime.cjs');
(async () => {
 const browser = await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:false});
   Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});
   await outsidePlaytest.start();lunaCampaign.screen('game');
  });
  await page.keyboard.press('KeyP');
  await page.locator('[data-capture-ui]').click();
  assert.equal(await page.locator('[data-capture-ui]').getAttribute('aria-pressed'),'true');
  assert(await page.locator('.outside-dev-console').isVisible());
  await page.waitForTimeout(250);
  await page.screenshot({path:'/private/tmp/capture-developer-panel.png'});
  await page.locator('[data-outside-action="dev-plus"]').click();
  await page.keyboard.press('KeyP');
  assert(await page.locator('.outside-dev-console').isHidden());
  assert(await page.locator('.outside-interact').isHidden());
  assert(await page.locator('#outside-root canvas').first().isVisible());
  // Fresh notifications and speech inserted after the toggle stay hidden too.
  await page.evaluate(()=>{
   LunaStoryNotices.affinity(barGame.progress,'tom',1);
   const speech=document.querySelector('.outside-speech');speech.hidden=false;
   speech.innerHTML='<span style="visibility:visible">촬영 중 말풍선</span>';
  });
  assert.equal(await page.locator('.outside-speech span').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert(await page.locator('#story-notices').isHidden());
  for(const [width,height] of [[960,540],[390,844],[1920,800]]){
   await page.setViewportSize({width,height});await page.keyboard.press('KeyP');
   assert(await page.locator('[data-capture-ui]').isVisible());
   await page.locator('[data-capture-ui]').click();
   assert.equal(await page.evaluate(()=>LunaCaptureMode.hidden),false);
   await page.locator('[data-capture-ui]').click();await page.keyboard.press('KeyP');
  }
  await page.setViewportSize({width:1280,height:720});
  await page.screenshot({path:'/private/tmp/capture-outside-hidden.png'});
  // Esc restores UI instead of opening an invisible settings overlay.
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>LunaCaptureMode.hidden||outsidePlaytest.model.paused),false);
  await page.keyboard.press('KeyP');await page.locator('[data-capture-ui]').click();
  await page.keyboard.press('KeyP');
  await page.evaluate(()=>{
   outsidePlaytest.exit(true);barGame.reset(1,'general',1,false);lunaCampaign.screen('game');
  });
  await page.locator('.bar-stage').waitFor();
  await page.keyboard.press('KeyP');
  assert(await page.locator('.campaign-dev-console [data-capture-ui]').isVisible());
  assert.equal(await page.locator('.campaign-dev-console [data-capture-ui]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('KeyP');
  assert(await page.locator('.bar-stage').isVisible());
  assert(await page.locator('.corner-tools').isHidden());
  assert(await page.locator('.service-handle').isHidden());
  await page.screenshot({path:'/private/tmp/capture-bar-hidden.png'});
  // A cutscene/blocked screen has a P recovery console without changing its state.
  await page.evaluate(()=>{lunaCampaign.noticeText='capture test';lunaCampaign.screen('notice');});
  await page.keyboard.press('KeyP');
  assert(await page.locator('.capture-console [data-capture-ui]').isVisible());
  await page.locator('.capture-console [data-capture-ui]').click();
  assert.equal(await page.evaluate(()=>lunaCampaign.view),'notice');
  await page.keyboard.press('KeyP');
  assert(await page.locator('.campaign-card').isVisible());
  assert.equal(await page.evaluate(()=>LunaCaptureMode.hidden),false);
  // Craft art remains visible while counters, guides and controls disappear.
  await page.evaluate(()=>{lunaCampaign.developer();LunaCaptureMode.set(true);});
  for (const [kind,art,hud] of [
   ['pour','[data-pixel-pour]','.pour-top-readout'],
   ['open','[data-opening-stage]','.opening-phase'],
   ['stir','.mix-cinema','.mix-board'],
   ['shake','.mix-cinema','.mix-board']
  ]) {
   await page.evaluate(kind=>barGame.startMinigame(kind),kind);
   await page.locator(art).waitFor();
   assert(await page.locator(hud).isHidden(),kind+' guide hidden');
   if (['stir','shake'].includes(kind)) {
    assert.notEqual(await page.locator(art).evaluate(el=>getComputedStyle(el).backgroundImage),'none',kind+' background retained');
   } else assert(await page.locator('.gimmick-room-background').isVisible(),kind+' background retained');
  }
  // The memory world shares a bar-view class, but is scenery, not a HUD.
  const memory = await page.evaluate(()=>{
   const fixture=document.createElement('div');fixture.className='johnny-memory bar-view';
   fixture.innerHTML='<div class="johnny-memory-world">world</div><div class="campaign-speech">speech</div>';
   document.body.append(fixture);
   const result=[...fixture.children].map(el=>getComputedStyle(el).visibility);fixture.remove();return result;
  });
  assert.deepEqual(memory,['visible','hidden']);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(250);
  // Keyboard activation must only toggle capture, not advance the underlying screen.
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>LunaCaptureMode.hidden),false);
  await page.keyboard.press('KeyP');
  assert.deepEqual(errors,[]);
  console.log('CAPTURE_UI_OK outside/bar/crafting, late HUDs, console exception, resize, scene carry, retained memory art, P/Esc/keyboard recovery');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
