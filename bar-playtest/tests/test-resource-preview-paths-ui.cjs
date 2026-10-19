const assert = require('node:assert/strict');
const { load, chrome } = require('../../tools/lib/test-runtime.cjs');
const { chromium } = load('playwright');
const sharp = load('sharp');

(async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
    await page.waitForFunction(() => resourceReview.ready);
    // Include every variant and popup download, not only the default card thumbnail.
    const inventory = await page.evaluate(() => {
      const links = [], rows = resourceReview.rows;
      for (const row of rows) {
        if (row.preview) links.push({ id: row.id, kind: 'preview', src: row.preview });
        if (!ResourceLatest.isScreen(row)) continue;
        for (const variant of row.variants || [{ id: 'default' }]) {
          links.push({ id: row.id, variant: variant.id, kind: 'screen', src: ResourceLatest.screen(row, variant.id) });
          if (row.popupKind) links.push({ id: row.id, variant: variant.id, kind: 'popup', src: ResourceLatest.popup(row, variant.id) });
        }
      }
      return { links, cards: rows.filter(row => row.preview).length };
    });
    assert(inventory.cards > 0, 'Preview catalog must not be empty');
    const links = [...new Map(inventory.links.map(link => [link.src, link])).values()], failures = [];
    let index = 0;
    async function check() {
      while (index < links.length) {
        const link = links[index++];
        try {
          const response = await page.request.get(new URL(link.src, page.url()).href);
          assert.equal(response.status(), 200, 'HTTP status');
          const metadata = await sharp(await response.body()).metadata();
          assert(metadata.width > 0 && metadata.height > 0, 'Image must decode');
        } catch (error) { failures.push({ ...link, error: error.message }); }
      }
    }
    await Promise.all(Array.from({ length: 6 }, check));
    assert.deepEqual(failures, [], 'Every preview, state image and popup download must exist and decode');
    for (const group of ['bar-ui', 'out-ui', 'common-popups', 'bar-fx', 'out-fx']) {
      await page.locator(`[data-group="${group}"]`).click();
      const id = await page.evaluate(group => resourceReview.rows.find(row => row.group === group && row.preview)?.id, group);
      assert(id, `${group} preview missing`);
      await page.evaluate(id => resourceReview.select(id), id);
      await page.locator('.ui-preview img').evaluate(image => image.decode());
      const choices = await page.locator('#inspect-state option').evaluateAll(options => options.map(option => option.value));
      if (choices.length > 1) {
        await page.selectOption('#inspect-state', choices.at(-1));
        await page.locator('.ui-preview img').evaluate(image => image.decode());
      }
    }
    await page.evaluate(() => resourceReview.select('popup:controls'));
    const downloadPending = page.waitForEvent('download');
    await page.getByRole('link', { name: '팝업 참고 PNG', exact: true }).click();
    const download = await downloadPending;
    assert.equal(await download.failure(), null);
    assert.match(download.suggestedFilename(), /--popup\.png$/);
    assert.deepEqual(errors, []);
    console.log(`RESOURCE_PREVIEW_PATHS_OK: ${inventory.cards} cards, ${links.length} decoded image URLs, five categories, variant switching and popup download`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
