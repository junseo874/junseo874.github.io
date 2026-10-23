const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    for (const main of [false, true]) {
      for (const recipe of ['list', 'detail', 'overlay']) {
        await page.evaluate(({ main, recipe }) => {
          const c = lunaCampaign, g = barGame;
          c.session.uninstall(); c.session.install({ developer: !main });
          g.reset(99, 'practice', 1, true); c.ui.recipeOpen = false;
          if (recipe !== 'list') g.selectCocktail('gin_tonic');
          if (recipe === 'detail') c.ui.recipeOpen = true;
          if (recipe === 'overlay') { g.debugFill(); g.startCraft(); g.overlay = 'recipe'; }
          c.screen(c.playView); g.changed();
        }, { main, recipe });
        await page.waitForTimeout(100);
        const before = await page.evaluate(() => barGame.screen);
        await page.keyboard.down('Escape');
        await page.keyboard.down('Escape'); // OS key-repeat must not open settings after closing.
        await page.keyboard.up('Escape');
        const state = await page.evaluate(() => ({ view: lunaCampaign.view, play: lunaCampaign.playView,
          screen: barGame.screen, overlay: barGame.overlay, detail: lunaCampaign.ui.recipeOpen }));
        assert.equal(state.view, state.play, JSON.stringify({ main, recipe, state }));
        assert.equal(await page.locator('.luna-settings:visible').count(), 0);
        assert.equal(state.screen, recipe === 'list' ? 'bar' : before);
        assert(!state.overlay && !state.detail, JSON.stringify(state));
        await page.keyboard.press('Escape');
        await page.locator('.luna-settings:visible').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.luna-settings:visible').waitFor({ state: 'hidden' });
        console.log('PASS recipe Esc priority', { main, recipe });
      }
      await page.evaluate(async main => {
        const c = lunaCampaign;
        c.session.uninstall(); c.session.install({ developer: !main }); c.screen(c.playView);
        Object.assign(outsidePlaytest.config, { day: 3, flow: 'out', place: 'homeDoor' });
        await outsidePlaytest.start();
      }, main);
      await page.waitForFunction(() => !outsidePlaytest.loading);
      for (const level of [0, 1]) for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']) {
        await page.evaluate(level => {
          const o = outsidePlaytest, m = o.model, r = LunaResidence.layout;
          o.clearInput(); m.story.cancel(); m.backgroundStory.cancel();
          Object.assign(m, { scene: 'street', level, x: r.elevatorX, y: level ? r.upperY : -.7,
            elevatorY: level ? r.elevatorTop : r.elevatorBottom, ride: null, dialog: null, encounter: null });
          m.updateNear();
        }, level);
        await page.keyboard.down(code); // Already walking when boarding.
        await page.evaluate(() => outsidePlaytest.model.startLift());
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down(code);
        const ride = await page.evaluate(() => {
          const o = outsidePlaytest, m = o.model, r = LunaResidence.layout;
          const original = m.ride;
          m.startLift();
          if (m.ride !== original) throw Error('Repeated boarding reset active lift');
          let frames = 0;
          while (m.ride && frames++ < 400) {
            o.tick(.05);
            if (m.x !== r.elevatorX) throw Error('Passenger escaped cabin horizontally');
            if (m.ride && Math.abs(m.y - m.elevatorY - r.passengerOffset) > 1e-8) throw Error('Passenger detached vertically');
          }
          return { frames, level: m.level, riding: !!m.ride };
        });
        assert(!ride.riding && ride.level === 1 - level && ride.frames > 200, JSON.stringify(ride));
        await page.keyboard.down(code); // Still-held key must not become a new movement on landing.
        await page.waitForTimeout(120);
        assert.equal(await page.evaluate(() => outsidePlaytest.model.x), await page.evaluate(() => LunaResidence.layout.elevatorX));
        await page.keyboard.up(code); await page.keyboard.up('ShiftLeft');
        await page.keyboard.down('KeyD'); await page.waitForTimeout(120); await page.keyboard.up('KeyD');
        assert(await page.evaluate(() => outsidePlaytest.model.x > LunaResidence.layout.elevatorX + .01), 'Fresh input must work after landing');
      }
      console.log('PASS lift lock: both directions, four movement keys, held input and fresh landing input', { main });
      await page.evaluate(() => {
        const o = outsidePlaytest, m = o.model, r = LunaResidence.layout;
        o.clearInput(); m.story.cancel(); m.backgroundStory.cancel();
        Object.assign(m, { level: 1, x: r.elevatorX, y: r.upperY,
          elevatorY: r.elevatorTop, ride: null, dialog: null, encounter: null });
        m.startLift(); m.tick(.05);
      });
      await page.keyboard.press('Escape');
      await page.locator('.luna-settings:visible').waitFor();
      const paused = await page.evaluate(() => outsidePlaytest.model.ride.time);
      await page.keyboard.press('KeyA'); await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => outsidePlaytest.model.ride.time), paused, 'Settings must pause the cabin');
      await page.keyboard.press('Escape');
      await page.locator('.luna-settings:visible').waitFor({ state: 'hidden' });
      await page.keyboard.down('KeyD'); await page.waitForTimeout(120); await page.keyboard.up('KeyD');
      assert(await page.evaluate(() => outsidePlaytest.model.ride.time > 0 && outsidePlaytest.model.x === LunaResidence.layout.elevatorX));
      const call = await page.evaluate(() => {
        const m = outsidePlaytest.model, r = LunaResidence.layout;
        Object.assign(m, { level: 1, x: r.elevatorX - .2, y: r.upperY,
          elevatorY: r.elevatorBottom, ride: null, dialog: null });
        m.startLift();
        const waitingX = m.x;
        let frames = 0;
        while (m.ride?.call && frames++ < 200) {
          m.tick(.05, { move: 1, run: true });
          if (m.ride?.call && m.x !== waitingX) throw Error('Empty lift moved the waiting passenger');
        }
        if (!m.ride || m.ride.call || m.x !== r.elevatorX) throw Error('Automatic boarding failed');
        while (m.ride && frames++ < 500) {
          m.tick(.05, { move: -1, run: true });
          if (m.x !== r.elevatorX) throw Error('Called lift passenger escaped');
        }
        return { level: m.level, riding: !!m.ride };
      });
      assert.equal(call.level, 0); assert(!call.riding);
      console.log('PASS lift settings pause/resume and empty-cabin call/boarding', { main });
      await page.evaluate(() => outsidePlaytest.exit(true));
    }
    assert.deepEqual(errors, []);
    console.log('LIFT_LOCK_RECIPE_ESCAPE_OK');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
