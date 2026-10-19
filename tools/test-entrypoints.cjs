const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, chrome } = require('./lib/test-runtime.cjs');
const { chromium } = load('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.LUNA_SITE_URL || 'http://127.0.0.1:8123/';

(async () => {
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--mute-audio'] });
  try {
    let assetCount = 0;
    for (const route of ['', 'intro.html', 'direction.html', 'simulator.html', 'LUNA_TestTool.html',
      'bar-playtest/', 'bar-playtest/?dev=1', 'bar-playtest/?mode=minigames',
      'bar-playtest/resource-review.html', 'bar-playtest/story-guide.html', 'cutscene-studio/']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(base) && response.status() >= 400) errors.push(response.status() + ' ' + response.url());
      });
      await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
      if (route === 'cutscene-studio/') await page.waitForFunction(() => window.cutsceneStudio?.ready);
      if (route.includes('resource-review')) await page.waitForFunction(() => window.resourceReview?.ready);
      if (/^bar-playtest\/(?:\?|$)/.test(route)) {
        await page.waitForFunction(() => !!window.barGame && !!window.lunaCampaign);
        const urls = await page.evaluate(() => [window.LUNA_DATA, window.LUNA_OUTSIDE_DATA]
          .flatMap(data => Object.values(data?.assets || {}).map(asset => new URL(asset.src, document.baseURI).href)));
        for (const url of urls) {
          if (!url.startsWith(base)) continue;
          const relative = decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length));
          assert(fs.existsSync(path.join(root, relative)), route + ': missing registered asset ' + relative);
          assetCount++;
        }
      }
      const broken = await page.evaluate(() => [...document.images]
        .filter(image => image.getAttribute('src') && !image.getAttribute('src').includes('${') && image.complete && !image.naturalWidth)
        .map(image => image.getAttribute('src')));
      assert.deepEqual(broken, [], route + ': broken rendered images');
      assert.deepEqual(errors, [], route + ': browser/network errors');
      assert((await page.locator('body').innerText()).trim().length > 10, route + ': blank page');
      console.log('PASS entry point: /' + route);
      await page.close();
    }
    console.log('ENTRYPOINTS_OK: 11 public routes and ' + assetCount + ' registered asset references');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
