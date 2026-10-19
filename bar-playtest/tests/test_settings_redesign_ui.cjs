const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const load=async suffix=>{await page.goto('http://127.0.0.1:8123/bar-playtest/'+suffix);if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();};
  const set=async(id,v)=>page.locator(`[data-setting="${id}"]`).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(v));
  const tab=async id=>page.locator(`[data-settings-tab="${id}"]`).click();
  await load('');await page.evaluate(()=>lunaCampaign.action('title'));await page.locator('[data-campaign="options"]').click();
  await page.waitForSelector('.luna-settings');assert.equal(await page.locator('[role="tab"]').count(),3);
  assert.deepEqual(await page.locator('.ls-nav [role="tab"]').allTextContents(),['사운드›','게임 설정›','조작 안내›']);
  assert.equal(await page.locator('.ls-section-heading,.ls-tag,.ls-state,.ls-nav-note,.ls-brand small,.ls-nav button small,.ls-confirm small').count(),0,'No decorative headings, badges, branding or tab numbers in any panel');
  assert.equal(await page.locator('.ls-feedback').textContent(),'','No default footer copy');
  assert(await page.locator('#ls-sound').evaluate(el=>el.parentElement.scrollHeight<=el.parentElement.clientHeight+1),'Sound settings fit without a redundant heading or scrollbar');
  await page.screenshot({path:'/private/tmp/settings-sound.png'});
  await set('bgm',47);await set('sfx',64);await set('street',32);
  assert.deepEqual(await page.evaluate(()=>[barBgm.volume,LunaSfx.volume,LunaStreetAudio.volume]),[.47,.64,.32]);
  assert(await page.locator('.ls-feedback').evaluate(el=>getComputedStyle(el).clipPath==='inset(50%)'),'Apply feedback remains screen-reader-only after editing');
  const slider=page.locator('[data-setting="bgm"]');await slider.focus();await page.keyboard.press('ArrowRight');assert.equal(await slider.inputValue(),'48');assert(await slider.evaluate(el=>el===document.activeElement),'slider keeps focus while adjusting');
  await page.locator('[data-setting-toggle="music"]').click();assert.equal(await page.evaluate(()=>barBgm.enabled),false);
  await page.locator('[data-setting="voice"]').selectOption('off');assert(await page.locator('[data-settings-action="preview"]').isDisabled());
  await tab('game');await page.locator('[data-setting="focus"]').selectOption('off');await page.locator('[data-setting="speed"]').selectOption('2');
  await page.screenshot({path:'/private/tmp/settings-game.png'});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>lunaCampaign.view),'title');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.campaign),'options','return focus to title settings');
  await page.reload();if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  assert.deepEqual(await page.evaluate(()=>[barGame.dialogSpeed,LunaFocusSettings.enabled,barBgm.volume,LunaSfx.volume,LunaStreetAudio.volume]),[2,false,.48,.64,.32]);
  await page.evaluate(()=>lunaCampaign.action('options'));await tab('controls');await page.screenshot({path:'/private/tmp/settings-controls.png'});
  await page.keyboard.press('ArrowUp');assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-settings-tab'),'game');
  await page.locator('[data-settings-action="reset"]').click();assert(await page.locator('.ls-confirm').isVisible());await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>barGame.dialogSpeed),2);
  await page.locator('[data-settings-action="reset"]').click();await page.locator('[data-settings-action="confirm"]').click();assert.equal(await page.evaluate(()=>barGame.dialogSpeed),1);assert.equal(await page.evaluate(()=>barBgm.volume),.48);
  await page.locator('.ls-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.settingsAction),'close');
  await load('?mode=minigames');await page.evaluate(()=>barGame.startMinigame('shake','original'));await page.waitForTimeout(200);await page.keyboard.press('Escape');
  assert.equal(await page.locator('.luna-settings').getAttribute('data-settings-context'),'practice');const time=await page.evaluate(()=>barGame.realTime);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>barGame.realTime),time);
  await page.screenshot({path:'/private/tmp/settings-practice.png'});
  await page.locator('[data-settings-action="exit"]').click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>barGame.overlay),'settings');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>barGame.overlay),null);
  await load('?dev=1');await page.keyboard.press('Escape');assert.equal(await page.locator('.luna-settings').getAttribute('data-settings-context'),'bar');await tab('game');await page.locator('[data-setting-toggle="auto"]').click();assert.equal(await page.evaluate(()=>lunaCampaign.ui.auto),true);await page.keyboard.press('Escape');
  await load('?dev=1');await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:99,place:'bar',flow:'out'});await outsidePlaytest.start();});await page.keyboard.press('Escape');
  assert.equal(await page.locator('.luna-settings').getAttribute('data-settings-context'),'outside');const x=await page.evaluate(()=>outsidePlaytest.model.x);await page.keyboard.press('KeyD');assert.equal(await page.evaluate(()=>outsidePlaytest.model.x),x);
  await page.screenshot({path:'/private/tmp/settings-outside.png'});
  await tab('game');await page.locator('[data-setting="focus"]').selectOption('off');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>outsidePlaytest.model.paused),false);
  await page.keyboard.press('Escape');await page.locator('[data-settings-action="restart"]').click();await page.locator('[data-settings-action="confirm"]').click();assert.equal(await page.evaluate(()=>outsidePlaytest.model.paused),false);assert.equal(await page.locator('.luna-settings').count(),0);
  await page.keyboard.press('Escape');await page.locator('[data-settings-action="exit"]').click();await page.locator('[data-settings-action="confirm"]').click();assert.equal(await page.evaluate(()=>outsidePlaytest.active),false);
  for(const [width,height] of [[960,600],[1920,1080],[800,600]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);await page.evaluate(()=>lunaCampaign.action('options'));const b=await page.locator('.luna-settings').boundingBox();assert(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,JSON.stringify(b));await page.keyboard.press('Escape');}
  assert.deepEqual(errors,[]);console.log('SETTINGS_UI_OK: shared title/practice/outside, live sliders and focus, persistence, pause/input isolation, tabs/trap/Escape, reset scope and exit confirmation, responsive bounds');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
