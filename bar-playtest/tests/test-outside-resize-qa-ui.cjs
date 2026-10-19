const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');

async function start(browser, dpr = 1) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click();
  await page.locator('[data-outside-action="start"]').click();
  await page.waitForFunction(() => outsidePlaytest.active && !outsidePlaytest.loading);
  return { page, errors };
}

async function resize(browser, dpr) {
  const { page, errors } = await start(browser, dpr);
  try {
    await page.keyboard.press('KeyP');
    for (const [width, height] of [[800, 600], [390, 844], [1920, 900], [640, 360], [1280, 720]]) {
      const money = await page.evaluate(() => barGame.progress.money);
      await page.setViewportSize({ width, height });
      // Intentionally no wait between resize and focus/click: this was the failing sequence.
      await page.locator('[data-outside-action="dev-plus"]').click();
      assert.equal(await page.evaluate(() => barGame.progress.money), money + 1000);
      await page.waitForTimeout(250);
      const geometry = await page.evaluate(() => {
        const root = document.querySelector('#outside-root');
        const stage = root.querySelector('.outside-stage');
        const rect = stage.getBoundingClientRect();
        const panel = root.querySelector('.outside-dev-console').getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          offsets: [root.scrollLeft, root.scrollTop, stage.scrollLeft, stage.scrollTop],
          panel: { x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom } };
      });
      // Exterior fits whole physical 16:9 pixel units to avoid resampling the art.
      const unit = Math.floor(Math.min(width * dpr / 16, height * dpr / 9));
      const scale = unit * 16 / (1280 * dpr);
      assert.deepEqual(geometry.offsets, [0, 0, 0, 0], `scene scrolled at ${width}x${height}, DPR ${dpr}`);
      assert(Math.abs(geometry.x - (width - 1280 * scale) / 2) < 1, JSON.stringify({ width, height, geometry }));
      assert(Math.abs(geometry.y - (height - 720 * scale) / 2) < 1);
      assert(Math.abs(geometry.width - 1280 * scale) < 1);
      assert(Math.abs(geometry.height - 720 * scale) < 1);
      assert(geometry.panel.x >= geometry.x && geometry.panel.y >= geometry.y);
      assert(geometry.panel.right <= geometry.x + geometry.width + 1);
      assert(geometry.panel.bottom <= geometry.y + geometry.height + 1);
      if (width === 800 && dpr === 1) await page.screenshot({ path: '/private/tmp/luna-outside-resize-fixed.png' });
      // Focus scrolling must not move the scene aperture even between resize callbacks.
      assert.deepEqual(await page.evaluate(() => {
        const nodes = [document.querySelector('#outside-root'), document.querySelector('.outside-stage')];
        nodes.forEach(node => node.scrollTo(400, 100));
        return nodes.flatMap(node => [node.scrollLeft, node.scrollTop]);
      }), [0, 0, 0, 0]);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.outside-dev-console').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

async function qa(browser) {
  const { page, errors } = await start(browser);
  try {
    await page.keyboard.press('KeyP');
    await page.locator('[data-outside-action="dev-day-99"]').click();
    await page.keyboard.press('KeyP');
    await page.keyboard.down('KeyD');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => lunaQA.opened && document.querySelector('[inert] .luna-settings'));
    assert(await page.evaluate(() => document.querySelector('#app').inert));
    const x = await page.evaluate(() => outsidePlaytest.model.x);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => outsidePlaytest.model.x), x);
    assert(await page.evaluate(() => lunaQA.host.contains(document.activeElement)), 'background settings must not steal focus');
    await page.keyboard.up('KeyD');
    await page.keyboard.press('Shift+Tab');
    assert(await page.evaluate(() => lunaQA.opened && lunaQA.host.contains(document.activeElement)));
    await page.keyboard.down('Tab');
    assert.equal(await page.evaluate(() => lunaQA.opened), false, 'hidden settings must not intercept QA Tab');
    await page.keyboard.down('Tab');
    assert.equal(await page.evaluate(() => lunaQA.opened), false, 'held Tab must not reopen QA');
    await page.keyboard.up('Tab');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => outsidePlaytest.model.x), x, 'movement key released while QA was open');
    assert.equal(await page.evaluate(() => outsidePlaytest.model.paused), false);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => lunaQA.opened), false, 'hidden settings must not intercept QA Escape');
    await page.locator('.qa-launch').click();
    await page.selectOption('[data-qa-field="outsideCase"]', 'lift-up');
    await page.locator('[data-qa="outside"]').click();
    assert.equal(await page.evaluate(() => outsidePlaytest.model.qa.caseId), 'lift-up');
    // A genuinely visible settings window must still own Tab/Escape.
    await page.keyboard.press('Escape');
    await page.locator('#outside-root .luna-settings').waitFor({ state: 'visible' });
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      assert(await page.evaluate(() => document.activeElement.closest('#outside-root .luna-settings') !== null));
      assert.equal(await page.evaluate(() => lunaQA.opened), false);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => outsidePlaytest.model.paused), false);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  const failures = [];
  try {
    for (const [name, run] of [['resize DPR 1', () => resize(browser, 1)], ['resize DPR 2', () => resize(browser, 2)], ['QA keyboard isolation', () => qa(browser)]]) {
      try { await run(); console.log('PASS ' + name); }
      catch (error) { failures.push(name); console.error(name, error); }
    }
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
