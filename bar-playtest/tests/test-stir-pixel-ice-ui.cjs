const assert = require('node:assert/strict');
const path = require('node:path');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
const sharp = runtime.load('sharp');
const assets = require('../data/presentation/runtime-assets.json').assets;

(async () => {
  const sources = new Set();
  for (let index = 0; index < 6; index++) {
    const art = assets['stir_ice_' + index];
    sources.add(art.src);
    const file = path.resolve(__dirname, '..', art.src);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, art.frameWidth * 72);
    assert.equal(metadata.height, art.frameHeight);
    assert(metadata.hasAlpha);
    const hashes = new Set();
    for (let frame = 0; frame < 72; frame++) {
      const { data, info } = await sharp(file).extract({
        left: frame * art.frameWidth, top: 0,
        width: art.frameWidth, height: art.frameHeight
      }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Every angle has transparent padding: no clipped corner or adjacent cel.
      for (let x = 0; x < info.width; x++) {
        assert.equal(data[x * 4 + 3], 0);
        assert.equal(data[((info.height - 1) * info.width + x) * 4 + 3], 0);
      }
      for (let y = 0; y < info.height; y++) {
        assert.equal(data[y * info.width * 4 + 3], 0);
        assert.equal(data[(y * info.width + info.width - 1) * 4 + 3], 0);
      }
      hashes.add(require('node:crypto').createHash('sha256').update(data).digest('hex'));
    }
    assert(hashes.size >= 68, 'Individually drawn angle cels');
  }
  assert.equal(sources.size, 6, 'Separate artwork for all six sizes');

  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) missing.push(response.url());
    });
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
    await page.locator('.updates-confirm').click();
    await page.locator('[data-act="miniStart"][data-id="stir"]').click();
    await page.locator('.mix-lesson-next').click();
    await page.locator('.mix-lesson-next').click();
    await page.locator('.mix-tutorial').waitFor({ state: 'hidden' });
    const cubes = page.locator('.stir-live-glass [data-ice-cube]');
    assert.equal(await cubes.count(), 6);
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('.stir-ice-sprite image')].map(async el => {
        const img = new Image();
        img.src = el.getAttribute('href');
        await img.decode();
      }));
      window.iceBefore = [...document.querySelectorAll('.stir-live-glass [data-ice-cube]')];
    });
    await page.screenshot({ path: '/tmp/stir-pixel-ice-idle.png' });
    await page.keyboard.press('KeyW');
    const before = await cubes.locator('svg').evaluateAll(els => els.map(el => el.getAttribute('viewBox')));
    for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
      await page.waitForTimeout(220);
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(100);
    const motion = await page.evaluate(() => ({
      success: barGame.gimmick.success,
      failures: barGame.gimmick.failures,
      cubes: [...document.querySelectorAll('.stir-live-glass [data-ice-cube]')].map((el, i) => ({
        same: el === iceBefore[i],
        transform: el.getAttribute('transform'),
        position: [Math.round(100 + barGame.gimmick.ice[i].x), Math.round(100 - barGame.gimmick.ice[i].y)],
        frame: el.querySelector('svg').getAttribute('viewBox'),
        sampling: getComputedStyle(el.querySelector('image')).imageRendering
      }))
    }));
    assert.equal(motion.success, 1);
    assert.equal(motion.failures, 0);
    for (const [index, cube] of motion.cubes.entries()) {
      assert(cube.same, 'Keep the sprite element while stirring');
      assert.equal(cube.transform, 'translate(' + cube.position.join(' ') + ') scale(1)');
      assert.equal(cube.sampling, 'pixelated');
      assert.notEqual(cube.frame, before[index], 'Rotate by selecting a baked cel');
    }
    await page.screenshot({ path: '/tmp/stir-pixel-ice-motion.png' });
    await page.keyboard.press('Escape');
    const paused = await cubes.evaluateAll(els => els.map(el => el.outerHTML));
    await page.waitForTimeout(250);
    assert.deepEqual(await cubes.evaluateAll(els => els.map(el => el.outerHTML)), paused);
    await page.keyboard.press('Escape');

    // The campaign renders the same ice set through the shared crafting view.
    await page.evaluate(() => {
      barGame.minigame = null;
      lunaCampaign.session.active = true;
      lunaCampaign.session.developer = false;
      lunaCampaign.storyVersion = 'A';
      lunaCampaign.screen('game');
      lunaCampaign.render(true);
    });
    assert.equal(await cubes.count(), 6);
    assert.deepEqual(new Set(await cubes.locator('image').evaluateAll(els => els.map(el => el.getAttribute('href')))), sources);
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 820, height: 650 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const glass = await page.locator('.stir-live-glass').boundingBox();
      const stage = await page.locator('.stir-screen').boundingBox();
      const portrait = await page.locator('.mix-cinematic').boundingBox();
      const board = await page.locator('.stir-board').boundingBox();
      assert(Math.abs(portrait.width / stage.width - 552 / 1280) < .001);
      assert(Math.abs(board.width / stage.width - 666 / 1280) < .001);
      assert(Math.abs(portrait.y - board.y) < 1);
      assert(Math.abs(portrait.height - board.height) < 1);
      assert(Math.abs(glass.width - glass.height) < 1, 'Circular vessel at every viewport');
      for (const selector of ['.mix-direction', '.mix-timer', '.stir-resource-gauge']) {
        for (const node of await page.locator(selector + ':visible').all()) {
          const box = await node.boundingBox();
          assert(box.x >= board.x && box.y >= board.y);
          assert(box.x + box.width <= board.x + board.width && box.y + box.height <= board.y + board.height);
        }
      }
      const bounds = await cubes.evaluateAll(els => els.map(el => {
        // SVG getBoundingClientRect includes the off-viewport atlas image.
        // Measure the clipped cel's viewport in its parent's screen coordinates.
        const sprite = el.querySelector('svg'), matrix = el.getScreenCTM();
        const x = sprite.x.baseVal.value, y = sprite.y.baseVal.value;
        const start = new DOMPoint(x, y).matrixTransform(matrix);
        const end = new DOMPoint(x + sprite.width.baseVal.value, y + sprite.height.baseVal.value).matrixTransform(matrix);
        return { left: start.x, top: start.y, right: end.x, bottom: end.y };
      }));
      for (const box of bounds) {
        assert(box.left >= glass.x && box.top >= glass.y);
        assert(box.right <= glass.x + glass.width && box.bottom <= glass.y + glass.height);
      }
      await page.screenshot({ path: '/tmp/stir-pixel-ice-' + viewport.width + '.png' });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    console.log('STIR_PIXEL_ICE_OK: six sizes, 432 cels, real keyboard input, pause, campaign, responsive bounds, no missing art.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
