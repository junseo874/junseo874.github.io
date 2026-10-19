const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await p.locator('.updates-confirm').isVisible()) await p.locator('.updates-confirm').click();
    const state = () => p.evaluate(() => ({ view: lunaCampaign.view, overlay: barGame.overlay, paused: barGame.paused, hidden: barGame.hidden, focus: document.activeElement?.outerHTML.slice(0, 180), outsidePaused: outsidePlaytest.model?.paused, appInert: document.querySelector('#app').inert }));
    for (const main of [false, true]) for (const close of ['escape', 'button', 'x']) {
      await p.evaluate(main => {
        const c = lunaCampaign, g = barGame;
        c.session.uninstall(); c.session.install({ developer: !main });
        g.reset(99, 'general', 7, true, { variant: 'original' });
        g.focus = 'L'; g.overview = false; g.cameraLeft = 0; g.transition = 0;
        c.screen(c.playView); g.changed();
      }, main);
      await p.keyboard.down('ControlLeft');
      await p.keyboard.press('Escape');
      await p.locator('.luna-settings:visible').waitFor();
      await p.keyboard.up('ControlLeft');
      await p.locator('.luna-settings:visible [data-settings-tab="game"]').click();
      await p.locator('.luna-settings:visible [data-setting="speed"]').selectOption('2');
      await p.waitForTimeout(180);
      assert(await p.locator('.luna-settings:visible #ls-game').isVisible(), 'game tab survives background redraws');
      if (main) await p.evaluate(() => {
        window.wrongSettingsClose = 0;
        // Background scene rendering must not replace the active menu's owner.
        LunaSettings.html({ context: 'outside', onClose: () => window.wrongSettingsClose++ });
      });
      if (close === 'escape') await p.keyboard.press('Escape');
      else await p.locator('.luna-settings:visible ' + (close === 'x' ? '.ls-close' : '.ls-primary[data-settings-action="close"]')).click();
      await p.keyboard.press('KeyD');
      await p.waitForTimeout(450);
      assert.equal(await p.evaluate(() => lunaCampaign.ui.readSkip), false, 'released Control must not remain held after settings');
      if (main) assert.equal(await p.evaluate(() => window.wrongSettingsClose), 0);
      assert.equal(await p.evaluate(() => barGame.focus), 'M', JSON.stringify({ main, close, state: await state() }));
      console.log('PASS bar resume', main, close);
    }
    for (const main of [false, true]) for (const close of ['escape', 'button']) for (const loseFocus of [false, true]) {
      await p.evaluate(async main => {
        const c = lunaCampaign;
        c.session.uninstall(); c.session.install({ developer: !main });
        c.screen(c.playView);
        Object.assign(outsidePlaytest.config, { place: 'bar', day: 3, flow: 'out' });
        await outsidePlaytest.start();
        outsidePlaytest.model.story.cancel(); outsidePlaytest.model.backgroundStory.cancel();
      }, main);
      await p.waitForFunction(() => !outsidePlaytest.loading);
      const walkingStart = await p.evaluate(() => outsidePlaytest.model.x);
      await p.keyboard.down('KeyD'); await p.waitForTimeout(200);
      assert(await p.evaluate(x => outsidePlaytest.model.x > x + .02, walkingStart), 'street fixture must actually be walking before opening settings');
      await p.keyboard.press('Escape'); await p.locator('.luna-settings:visible').waitFor();
      await p.keyboard.up('KeyD'); // Key release happens while the settings modal owns input.
      if (loseFocus) await p.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      });
      await p.waitForTimeout(150);
      if (close === 'escape') await p.keyboard.press('Escape');
      else await p.locator('.luna-settings:visible .ls-primary[data-settings-action="close"]').click();
      const before = await p.evaluate(() => outsidePlaytest.model.x);
      await p.waitForTimeout(200);
      assert.equal(await p.evaluate(() => outsidePlaytest.model.x), before, 'movement released in settings must not remain stuck on');
      await p.keyboard.down('KeyD'); await p.waitForTimeout(300); await p.keyboard.up('KeyD');
      assert(await p.evaluate(x => outsidePlaytest.model.x > x + .02, before), JSON.stringify({ main, close, loseFocus, state: await state() }));
      console.log('PASS street walking resume', main, close, { loseFocus });
      await p.evaluate(() => outsidePlaytest.exit(true));
    }
    await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
    if (await p.locator('.updates-confirm').isVisible()) await p.locator('.updates-confirm').click();
    await p.evaluate(() => {
      barGame.startMinigame('stir');
      barGame.progress.flags.mix_tutorial_stir = true; delete barGame.gimmick.mixTutorial;
    });
    await p.keyboard.press('Escape'); await p.locator('.luna-settings:visible').waitFor();
    await p.locator('.luna-settings:visible [data-settings-action="reset"]').click();
    await p.waitForTimeout(250); // normal renderer runs several times while reading confirmation
    await p.keyboard.press('Escape');
    assert(await p.locator('.luna-settings:visible').count(), 'Esc must cancel confirmation, not lose the settings session after a redraw');
    assert(await p.locator('.luna-settings:visible .ls-confirm').isHidden());
    await p.locator('.luna-settings:visible [data-settings-action="reset"]').click();
    await p.waitForTimeout(250);
    await p.locator('.luna-settings:visible [data-settings-action="confirm"]').click();
    assert(await p.locator('.luna-settings:visible').count(), 'reset confirmation must not accidentally run exit');
    assert.equal(await p.evaluate(() => barGame.screen), 'gimmick');
    await p.keyboard.press('Escape');
    await p.keyboard.press('KeyW'); await p.keyboard.press('KeyD');
    assert.equal(await p.evaluate(() => barGame.gimmick.stirStep), 1, JSON.stringify(await state()));
    assert.deepEqual(errors, []);
    console.log('SETTINGS_RESUME_OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
