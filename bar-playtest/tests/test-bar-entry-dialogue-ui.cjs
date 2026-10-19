const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(async () => {
      const c = lunaCampaign;
      c.session.uninstall(); c.session.install(); c.session.beginCommute(0);
      await c.street('in', 'bar');
      window.entryDialogueFrames = [];
      window.watchEntryDialogue = true;
      function watch() {
        if (!window.watchEntryDialogue) return;
        if (c.doorTransition?.revealAt != null) window.entryDialogueFrames.push({
          bubbles: document.querySelectorAll('#app .dialogue-wrap').length,
          actor: barGame.dialogue?.actor,
          cameraMoving: barGame.cameraMoving
        });
        requestAnimationFrame(watch);
      }
      requestAnimationFrame(watch);
      c.startBar(0, c.session.carry);
    });
    await page.waitForFunction(() => lunaCampaign.view === 'game' && !lunaCampaign.doorTransition, null, { timeout: 60000 });
    const frames = await page.evaluate(() => { window.watchEntryDialogue = false; return window.entryDialogueFrames; });
    assert(frames.length > 5, 'observe the actual door reveal');
    assert(frames.every(f => f.bubbles === 0), 'no premature bubble during bar reveal: ' + JSON.stringify(frames));
    await page.waitForFunction(() => !barGame.cameraMoving && barGame.currentDialogue()?.actor === 'chris');
    await page.locator('#app .dialogue-wrap').waitFor();
    assert.equal(await page.locator('#app .dialogue-wrap').count(), 1);
    assert.equal(await page.evaluate(() => barGame.dialogue.id), 'dlg_day0_notion_bar_3');
    // A later actor/camera transition must not resurrect the raw pending line either.
    await page.evaluate(() => {
      const line = barGame.dialogue;
      // Simulate a pending line while the camera is still transitioning.
      barGame.setTransition(.5, () => {});
      barGame.dialogue = line;
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#app .dialogue-wrap').count(), 0);
    await page.locator('#app .dialogue-wrap').waitFor();
    await page.evaluate(() => { barGame.dialogue.chars = 0; });
    await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(() => barGame.dialogue.chars), await page.evaluate(() => barGame.dialogue.text.length));
    const lineId = await page.evaluate(() => barGame.dialogue.id);
    await page.keyboard.press('KeyE');
    assert(await page.evaluate(id => barGame.dialogue?.id !== id || !!barGame.choice, lineId), 'E advances the fully revealed bar dialogue');
    assert.deepEqual(errors, []);
    console.log('BAR_ENTRY_DIALOGUE_OK: clean day0 reveal, one Chris line after camera settles, transition hiding and dialogue input preserved');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
