const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await runtime.load('playwright').chromium.launch({
    executablePath: runtime.chrome, headless: true, args: ['--mute-audio']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
    await page.locator('.updates-confirm').click();
    await page.locator('[data-act="miniStart"][data-id="stir"]').click();
    await page.keyboard.press('KeyW');
    assert.equal(await page.evaluate(() => barGame.gimmick.started), false, 'Tutorial blocks play input');
    await page.locator('.mix-lesson-next').click();
    await page.locator('.mix-lesson-next').click();
    const visibleKeys = () => page.locator('.mix-direction:visible').evaluateAll(els => els.map(el => el.dataset.id));
    const snapshot = () => page.evaluate(() => {
      const s = barGame.gimmick;
      return { failures: s.failures, success: s.success, step: s.stirStep, target: s.spoonTarget, wait: s.stirCueLeft };
    });
    await page.evaluate(() => { window.stirTick = barGame.tick.bind(barGame); barGame.tick = () => {}; });
    assert.deepEqual(await visibleKeys(), ['KeyW']);
    await page.locator('[data-id="KeyW"]').click();
    assert.deepEqual(await visibleKeys(), ['KeyW']);
    assert.match(await page.locator('[data-id="KeyW"]').getAttribute('class'), /pressed/);
    const before = await snapshot();
    await page.keyboard.press('KeyD');
    const early = await snapshot();
    assert.equal(early.failures, before.failures + 1);
    assert.equal(early.target, before.target);
    assert.equal(early.step, before.step);
    await page.waitForFunction(() => document.querySelector('[data-stir-feedback]')?.textContent === '너무 빨라..');
    assert.equal(await page.locator('[data-stir-round="miss"]').count(), 1);
    assert.equal(await page.locator('.stir-resource-gauge .miss').count(), 1);
    await page.screenshot({ path: '/tmp/stir-key-too-early.png' });
    // Browser key repeat must not add a stream of failures.
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', repeat: true, bubbles: true })));
    assert.equal((await snapshot()).failures, early.failures);
    await page.evaluate(() => { barGame.paused = true; stirTick(.5); });
    await page.keyboard.press('KeyS');
    assert.deepEqual(await snapshot(), early, 'Pause freezes cue and score');
    await page.evaluate(() => { barGame.paused = false; for (let i = 0; i < 20; i++) stirTick(.01); });
    await page.locator('[data-id="KeyD"]:visible').waitFor();
    assert.deepEqual(await visibleKeys(), ['KeyW', 'KeyD']);
    assert.match(await page.locator('[data-id="KeyD"]').getAttribute('class'), /next/);
    assert(await page.locator('[data-id="KeyD"] .stir-key-corners').evaluate(el => +getComputedStyle(el).opacity > 0));
    await page.locator('[data-id="KeyD"]').click();
    assert.equal((await snapshot()).step, 1);
    assert.deepEqual(await visibleKeys(), ['KeyD']);
    await page.keyboard.press('ArrowDown');
    assert.equal((await snapshot()).failures, 2, 'Arrow alias shares the early-input guard');
    assert.equal((await snapshot()).target, 90);

    for (const main of [false, true]) {
      await page.evaluate(main => {
        barGame.retryMinigame();
        barGame.tick = stirTick;
        if (main) {
          barGame.minigame = null;
          lunaCampaign.session.active = true;
          lunaCampaign.session.developer = false;
          lunaCampaign.storyVersion = 'A';
          lunaCampaign.screen('game');
          lunaCampaign.render(true);
        }
      }, main);
      if (await page.locator('.mix-tutorial').isVisible()) {
        await page.locator('.mix-lesson-next').click();
        await page.locator('.mix-lesson-next').click();
      }
      await page.locator('[data-id="KeyW"].next:visible').waitFor();
      assert.deepEqual(await visibleKeys(), ['KeyW']);
      await page.keyboard.press('KeyW');
      for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
        await page.locator('[data-id="' + key + '"].next:visible').waitFor();
        await page.keyboard.press(key);
      }
      assert.equal((await snapshot()).success, 1);
      assert.equal((await snapshot()).failures, 0);
      await page.locator('[data-id="KeyD"].next:visible').waitFor();
      assert.deepEqual(await visibleKeys(), ['KeyW', 'KeyD']);
      await page.screenshot({ path: '/tmp/stir-key-cues-' + (main ? 'main' : 'simulator') + '.png' });
    }
    await page.evaluate(() => {
      barGame.startMinigame('stir');
      delete barGame.gimmick.mixTutorial;
      barGame.tick = () => {};
      barGame.gimmickInput('KeyW');
      for (let i = 0; i < 249; i++) stirTick(.01);
    });
    assert.equal((await snapshot()).failures, 0, 'No timeout before 2.5 seconds');
    await page.evaluate(() => { stirTick(.01); stirTick(.01); });
    assert.equal((await snapshot()).failures, 1, 'Timeout after 2.5 seconds');
    assert.deepEqual(errors, []);
    console.log('STIR_KEY_CUES_OK: visible-only input cues, pulse/glow, early failure, arrows, repeat, pause, retry and real input in campaign/simulator.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
