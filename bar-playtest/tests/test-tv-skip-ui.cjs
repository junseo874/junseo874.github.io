const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await runtime.load('playwright').chromium.launch({executablePath: runtime.chrome, headless: true, args: ['--mute-audio']});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.waitForFunction(() => window.outsidePlaytest);
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(async () => {
      LunaFocusSettings.setEnabled(false);
      const c = lunaCampaign;
      c.session.uninstall(); c.session.install({developer: false}); c.session.beginCommute(0); c.screen(c.playView);
      Object.assign(outsidePlaytest.config, {day: 0, flow: 'in', place: 'home'});
      await outsidePlaytest.start();
      const m = outsidePlaytest.model;
      m.controlsTutorial = false; m.story.cancel(); m.backgroundStory.cancel();
      m.x = 1.22; m.updateNear(); outsidePlaytest.tick(0);
    });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => lunaCampaign.cinema?.dialogueWait && !lunaCampaign.memoryTransition, null, {timeout: 60000});
    assert(await page.evaluate(() => lunaCampaign.canSkipCinema()));
    // Scanline pixels must move while the actual caption/image timeline waits.
    const frame = () => page.evaluate(() => {
      const c = lunaCampaign;
      const pixels = c.host.querySelector('canvas').getContext('2d').getImageData(100, 100, 400, 60).data;
      let hash = 0; for (const byte of pixels) hash = (Math.imul(hash, 31) + byte) | 0;
      return {time: c.cinema.time, effectTime: c.cinema.effectTime, id: c.cinema.dialogueWait?.id, hash};
    });
    const firstFrame = await frame();
    let movingFrame;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(37); movingFrame = await frame();
      if (movingFrame.hash !== firstFrame.hash) break;
    }
    assert.notEqual(movingFrame.hash, firstFrame.hash, 'TV scanline pixels cannot freeze during typing');
    assert.equal(movingFrame.time, firstFrame.time);
    assert.equal(movingFrame.id, firstFrame.id);
    assert(movingFrame.effectTime > firstFrame.effectTime);
    // Finished captions still wait; redraw must preserve the reception phase.
    assert(await page.evaluate(() => {
      const c = lunaCampaign; c.cinema.dialogueWait.revealed = true;
      const before = c.cinema.effectTime; c.draw();
      return c.cinema.effectTime === before;
    }));
    const completedFrame = await frame();
    await page.waitForTimeout(137);
    const laterFrame = await frame();
    assert(laterFrame.effectTime > completedFrame.effectTime);
    assert.equal(laterFrame.time, completedFrame.time);
    // Short Space remains normal dialogue input; releasing cancels the skip.
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'prologue');
    assert.equal(await page.evaluate(() => lunaCampaign.cinemaHoldStart), null);
    await page.keyboard.down('Space'); await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'prologue');
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => lunaCampaign.cinemaHoldStart), null);
    // Settings cancel a partially completed hold without skipping on resume.
    await page.keyboard.down('Space'); await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'options');
    assert.equal(await page.evaluate(() => lunaCampaign.cinemaHoldStart), null);
    const pausedClock = await page.evaluate(() => lunaCampaign.cinema.effectTime);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => lunaCampaign.cinema.effectTime), pausedClock, 'settings pause reception too');
    await page.keyboard.up('Space'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'prologue');
    assert(await page.evaluate(() => lunaCampaign.canSkipCinema()));
    await page.keyboard.down('Space'); await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'prologue');
    await page.waitForFunction(() => !lunaCampaign.cinema && !lunaCampaign.memoryTransition && lunaCampaign.view === lunaCampaign.playView, null, {timeout: 15000});
    await page.keyboard.up('Space');
    assert(await page.evaluate(() => barGame.progress.flags.day0_tv_seen));
    assert(await page.evaluate(() => lunaCampaign.session.carry.flags.day0_tv_seen));
    assert.equal(await page.evaluate(() => outsidePlaytest.model.paused), false);
    const x = await page.evaluate(() => outsidePlaytest.model.x);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
    assert(await page.evaluate(old => outsidePlaytest.model.x > old, x));
    // Archive playback must return to its list without changing progress.
    await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=cutscenes');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.locator('.cutscene-list').waitFor();
    await page.evaluate(() => LunaFocusSettings.setEnabled(false));
    const before = await page.evaluate(() => JSON.stringify(barGame.progress));
    const tvId = await page.evaluate(() => LunaCutsceneLibrary.catalog.find(x => x.key === 'documentary').id);
    await page.locator('[data-act="cutscenePlay"][data-id="' + tvId + '"]').click();
    await page.waitForFunction(() => lunaCampaign.cinema?.dialogueWait && !lunaCampaign.memoryTransition, null, {timeout: 60000});
    await page.keyboard.down('Space');
    await page.waitForFunction(() => !LunaCutsceneLibrary.active && lunaCampaign.view === 'developer', null, {timeout: 15000});
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => JSON.stringify(barGame.progress)), before);
    // A real non-TV cinematic still rejects the shortcut and finish API.
    await page.locator('[data-act="cutscenePlay"][data-id="opening-a"]').click();
    await page.waitForFunction(() => lunaCampaign.view === 'prologue' && !!lunaCampaign.cinema, null, {timeout: 60000});
    assert.equal(await page.evaluate(() => lunaCampaign.canSkipCinema()), false);
    assert(await page.evaluate(() => {const c = lunaCampaign, original = c.cinema; c.finishCinema(true); return c.cinema === original;}));
    await page.keyboard.down('Space'); await page.waitForTimeout(2200); await page.keyboard.up('Space');
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'prologue');
    await page.keyboard.press('Escape'); await page.locator('.cutscene-list').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS TV moving scanline pixels during captions / timeline held / redraw phase / settings pause / TV-only 2s hold / seen flag / home movement / archive state / non-TV skip blocked');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
