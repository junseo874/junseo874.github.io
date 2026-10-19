const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.locator('.updates-confirm').click();
    await page.addStyleTag({ content: '.qa-launch{display:none!important}' });
    async function setup(kind) {
      await page.evaluate(kind => {
        const c = lunaCampaign, g = barGame;
        c.session.uninstall(); c.session.install({ developer: false });
        g.reset(99, 'general', 7, true, { variant: 'original' }); g.spawn();
        const base = Object.values(g.seats).find(Boolean);
        g.queue = []; g.queueIndex = 0;
        g.seats = Object.fromEntries(['L', 'M', 'R'].map(seat => [seat, { ...base, id: 'hitbox-' + seat, seat,
          coaster: false, glass: null, state: 'WAIT_COASTER', left: 999, limit: 999, lines: [], lineIndex: 0, lineDone: null }]));
        g.focus = 'M'; g.overview = false; g.cameraLeft = 0; g.transition = 0;
        if (kind === 'drink') {
          const guest = g.seats.M; guest.coaster = true;
          g.beginOrder(guest, false); guest.lineDone(); guest.lineDone = null; guest.lines = [];
          guest.left = guest.limit = 999;
          g.openRecipes(); g.selectCocktail(guest.order.cocktail); g.debugCraft('excellent'); g.offer();
        }
        c.screen(c.playView); g.changed();
      }, kind);
      await page.locator(`[data-drag="${kind}"]`).waitFor();
      await page.waitForFunction(() => !barGame.cameraMoving && !barGame.cameraLeft && !barGame.transition);
    }
    let checks = 0;
    for (const viewport of [{ width: 1280, height: 720 }, { width: 800, height: 600 }]) {
      await page.setViewportSize(viewport);
      for (const kind of ['coaster', 'drink']) {
        for (const [name, fx, fy, accepted] of [
          ['left', -.2, .5, true], ['right', 1.2, .5, true],
          ['top', .5, -.2, true], ['bottom', .5, 1.2, true],
          ['beyond-left', -.27, .5, false], ['beyond-bottom', .5, 1.27, false]
        ]) {
          await setup(kind);
          const zone = page.locator('[data-drop="M"]');
          assert.deepEqual(await zone.evaluate(el => [getComputedStyle(el).width, getComputedStyle(el).height]), ['120px', '140px']);
          const before = await zone.boundingBox(), pickup = await page.locator(`[data-drag="${kind}"]`).boundingBox();
          await page.mouse.move(pickup.x + pickup.width / 2, pickup.y + pickup.height / 2);
          await page.mouse.down();
          assert(await page.locator('#drag-ghost').isVisible());
          assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).cursor), 'none', 'held art replaces the pointer');
          const rect = await zone.boundingBox();
          assert.deepEqual(rect, before, 'visible target must not change on grab');
          const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
          await page.mouse.move(x, y, { steps: 4 });
          const art = await page.locator('#drag-ghost > img').boundingBox();
          assert(Math.abs(art.x + art.width / 2 - x) < .5 && Math.abs(art.y + art.height / 2 - y) < .5, 'held image center follows exact pointer coordinates');
          const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 160), { x, y });
          await page.mouse.up();
          const result = await page.evaluate(kind => ({
            accepted: kind === 'coaster' ? barGame.seats.M.coaster : !barGame.drink,
            otherSeatsUntouched: !barGame.seats.L.coaster && !barGame.seats.R.coaster,
            error: barGame.error
          }), kind);
          assert.equal(result.accepted, accepted, JSON.stringify({ kind, name, viewport, hit, result }));
          assert(result.otherSeatsUntouched);
          assert(!result.error);
          assert(await page.locator('#drag-ghost').isHidden());
          assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).cursor), 'none', 'drop restores native cursor');
          checks++;
        }
      }
    }
    for (const kind of ['coaster', 'drink']) for (const end of ['cancel', 'settings', 'blur']) {
      await setup(kind);
      const pickup = await page.locator(`[data-drag="${kind}"]`).boundingBox();
      await page.mouse.move(pickup.x + pickup.width / 2, pickup.y + pickup.height / 2); await page.mouse.down();
      await page.mouse.move(400, 300);
      await page.setViewportSize({ width: 960, height: 540 });
      const art = await page.locator('#drag-ghost > img').boundingBox();
      assert(Math.abs(art.x + art.width / 2 - 400) < .5 && Math.abs(art.y + art.height / 2 - 300) < .5, 'resize preserves stationary pointer alignment');
      if (end === 'cancel') {
        await page.mouse.move(1, 1);
        const edge = await page.locator('#drag-ghost > img').boundingBox();
        assert(Math.abs(edge.x + edge.width / 2 - 1) < .5, 'edge does not clamp the object away from pointer');
        assert.equal(await page.locator('#drag-ghost').evaluate(el => getComputedStyle(el).overflow), 'hidden');
        await page.mouse.move(400, 300);
        await page.screenshot({ path: '/private/tmp/held-cursor-' + kind + '.png' });
        await page.evaluate(() => dispatchEvent(new PointerEvent('pointercancel')));
      } else if (end === 'settings') await page.keyboard.press('Escape');
      else await page.evaluate(() => dispatchEvent(new Event('blur')));
      assert(await page.locator('#drag-ghost').isHidden());
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).cursor), 'none');
      await page.mouse.up();
      if (end !== 'cancel') await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    console.log(`DELIVERY_HITBOX_OK: ${checks} actual mouse drops; expanded edges, unchanged targets, object cursor alignment, resize/clipping, release/cancel/settings/blur restoration`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
