const assert = require('node:assert/strict');
const {load, chrome} = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await load('playwright').chromium.launch({executablePath: chrome, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.locator('.updates-confirm').click();
    for (const seat of ['L', 'R']) {
      await page.evaluate(seat => {
        const g = barGame;
        g.reset(99, 'practice', 1, true);
        g.startGeneral();
        g.queue = [{personality: 'gentle', order: 'gin_tonic', max_rounds: 2, delay_sec: 0}];
        g.queueIndex = 0;
        g.spawn();
        const source = Object.keys(g.seats).find(k => g.seats[k]);
        const guest = g.seats[source];
        g.seats[source] = null;
        g.seats[seat] = guest;
        guest.seat = seat;
        guest.coaster = true;
        g.focus = seat;
        g.beginOrder(guest, false);
        guest.lineDone();
        guest.lineDone = null;
        guest.lines = [];
        guest.left = guest.limit;
        g.queue = [];
        g.qaKeepGeneral = true;
        g.currentOrder = {seat, cocktail: 'gin_tonic'};
        g.openRecipes();
        g.selectCocktail('gin_tonic');
        g.debugCraft('excellent');
        lunaCampaign.render(true);
      }, seat);
      await page.locator('[data-act="offer"]:enabled').waitFor();
      // The opaque serving screen can cover a different/pending camera pose.
      // Offer restores the order's seat; that correction must never be visible.
      await page.evaluate(seat => {
        barGame.focus = seat === 'L' ? 'R' : 'L';
        lunaCampaign.render(true);
      }, seat);
      await page.waitForTimeout(650);
      const frames = await page.evaluate(async () => {
        document.querySelector('[data-act="offer"]').click();
        const frames = [];
        for (let i = 0; i < 40; i++) {
          frames.push([...document.querySelectorAll('.bar-scene-layer')].map(el => {
            const actual = new DOMMatrixReadOnly(getComputedStyle(el).transform);
            const target = new DOMMatrixReadOnly(el.style.transform);
            return {error: Math.max(...['a', 'd', 'e', 'f'].map(k => Math.abs(actual[k] - target[k])))};
          }));
          await new Promise(requestAnimationFrame);
        }
        return frames;
      });
      assert(frames[0].length >= 5, 'All parallax layers are inspected');
      assert(frames.every(layers => layers.every(layer => layer.error < .02)),
        `Return to ${seat} must start at the destination without a visible camera slide: ${JSON.stringify(frames[0])}`);
      assert.equal(await page.evaluate(() => barGame.focus), seat);
    }
    assert.deepEqual(errors, []);
    console.log('PASS serving return: left/right order cameras settle before first paint across every parallax layer');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
