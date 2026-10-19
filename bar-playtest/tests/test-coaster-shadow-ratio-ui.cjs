const assert = require('node:assert/strict');
const { load, chrome } = require('../../tools/lib/test-runtime.cjs');
const { chromium } = load('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--mute-audio'] });
  try {
    const errors = [];
    for (const viewport of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1200 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.waitForFunction(() => window.barGame && window.lunaCampaign);
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.addStyleTag({ content: '.qa-launch{display:none!important}' });

      await page.evaluate(() => {
        const c = lunaCampaign, g = barGame;
        c.session.uninstall();
        c.session.install({ developer: true });
        g.reset(99, 'general', 7, true, { variant: 'original' });
        g.spawn();
        const base = Object.values(g.seats).find(Boolean);
        g.queue = [];
        g.queueIndex = 0;
        g.seats = Object.fromEntries(['L', 'M', 'R'].map(seat => [seat, {
          ...base, id: 'shadow-' + seat, seat, coaster: false, glass: null,
          state: 'WAIT_COASTER', left: 999, limit: 999, lines: [], lineIndex: 0, lineDone: null,
        }]));
        g.focus = 'L';
        g.overview = false;
        g.cameraLeft = 0;
        g.transition = 0;
        c.screen(c.playView);
        g.changed();
      });
      // Let the first render start its queued camera transition before checking its guard.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const seat of ['L', 'M', 'R']) {
        if (seat !== 'L') await page.keyboard.press('KeyD');
        await page.waitForFunction(seat => barGame.focus === seat && !barGame.cameraMoving && !barGame.cameraLeft && !barGame.transition, seat);
        const card = page.locator('[data-drag="coaster"]');
        const target = page.locator(`[data-drop="${seat}"]`);
        await card.waitFor();
        const source = await card.boundingBox();
        await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await page.mouse.down();
        assert(await page.locator('#drag-ghost').isVisible(), JSON.stringify(await page.evaluate(({ source, seat, viewport }) => ({
          viewport, seat, hit: document.elementFromPoint(source.x + source.width / 2, source.y + source.height / 2)?.outerHTML,
          paused: barGame.isPaused(), screen: barGame.screen, view: lunaCampaign.view, camera: barGame.cameraMoving,
          drag: lunaCampaign.ui.drag,
        }), { source, seat, viewport })));
        const shadow = target.locator('.delivery-shadow');
        await shadow.waitFor({ state: 'visible' });
        const geometry = await shadow.evaluate(element => {
          const style = getComputedStyle(element), zone = getComputedStyle(element.closest('.coaster-zone'));
          const box = element.getBoundingClientRect();
          return { width: parseFloat(style.width), height: parseFloat(style.height), left: style.left,
            top: style.top, fit: style.objectFit, pointerEvents: style.pointerEvents,
            zoneWidth: zone.width, zoneHeight: zone.height, ratio: box.width / box.height };
        });
        assert.equal(geometry.width, 100, 'Keep the existing shadow width');
        assert(Math.abs(geometry.height - 100 * 27 / 83) < 0.03);
        assert(Math.abs(geometry.ratio - 83 / 27) < 0.01, 'Perspective survives viewport scaling');
        assert.equal(geometry.left, '10px');
        assert.equal(geometry.top, '110px');
        assert.equal(geometry.fit, 'fill', 'Compress Y without shrinking X');
        assert.equal(geometry.pointerEvents, 'none');
        assert.equal(geometry.zoneWidth, '120px');
        assert.equal(geometry.zoneHeight, '140px');
        const zone = await target.boundingBox();
        await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height * 0.8, { steps: 5 });
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-drop]')?.dataset.drop, { x: zone.x + zone.width / 2, y: zone.y + zone.height * 0.8 });
        assert.equal(hit, seat, `Drop target: ${viewport.width}/${seat}`);
        if (viewport.width === 1280 && seat === 'M') {
          await page.screenshot({ path: '/private/tmp/coaster-shadow-ratio.png' });
        }
        await page.mouse.up();
        await page.waitForFunction(seat => barGame.seats[seat].coaster, seat);
        const coaster = await target.locator('img.coaster').boundingBox();
        assert(Math.abs(coaster.width / coaster.height - geometry.ratio) < 0.01);
        assert.equal(await shadow.count(), 0, 'Shadow disappears after a successful drop');
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS coaster shadow: 83:27 ratio, unchanged width/centre/drop zone, L/M/R drag placement at three viewport sizes');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
