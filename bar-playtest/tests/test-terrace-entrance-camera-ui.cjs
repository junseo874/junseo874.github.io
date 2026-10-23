const assert = require('node:assert/strict');
const rt = require('../../tools/lib/test-runtime.cjs');
(async () => {
  const browser = await rt.load('playwright').chromium.launch({ executablePath: rt.chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(() => {
      window.realCampaignTick = lunaCampaign.tick; lunaCampaign.tick = () => false;
      lunaCampaign.session.day = 0;
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      const rasters = new WeakMap();
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        for (const kind of ['terrace-building','terrace-city'])
          if (image?.classList?.contains(kind)) rasters.set(this.canvas, {kind, width:image.naturalWidth});
        const raster = rasters.get(image);
        if (raster && this.canvas.width === 1920) {
          const m = this.getTransform().toFloat64Array();
          m[0] = image.width / raster.width / 4; m[12] = (m[12] + args[0]) / 4;
          if (raster.kind === 'terrace-building') window.entryGlassMatrix = m;
          else window.entryCityGlassMatrix = m;
        }
        return draw.call(this, image, ...args);
      };
    });
    async function start(key) {
      await page.evaluate(key => lunaCampaign.scene(key, '테라스', 'terrace', () => {}), key);
      await page.waitForFunction(() => lunaCampaign.memoryTransition?.ready);
      await page.evaluate(() => {
        const c = lunaCampaign;
        for (let i = 0; i < 30 && c.memoryTransition.phase !== 'in'; i++) realCampaignTick.call(c, .05);
      });
    }
    async function advance(to) {
      return page.evaluate(to => {
        const c = lunaCampaign;
        while (c.memoryTransition && c.memoryTransition.time < to) realCampaignTick.call(c, .05);
        const cam = LunaTerrace.camera(c.dialog), art = document.querySelector('.terrace-art');
        return { ...cam, chars: c.dialog.chars, index: c.dialog.index,
          hidden: getComputedStyle(document.querySelector('.terrace-speech')).visibility === 'hidden',
          artScale: new DOMMatrix(getComputedStyle(art).transform).a,
          foreground: ['.terrace-building','.terrace-characters','.terrace-balustrade'].map(selector => {
            const m = new DOMMatrix(getComputedStyle(document.querySelector(selector)).transform);
            return { scale: m.a, x: m.e, y: m.f };
          }), background: ['.terrace-city','.terrace-sign-scanlines'].map(selector => {
            const layer = document.querySelector(selector), m = new DOMMatrix(getComputedStyle(layer).transform),
              r = layer.getBoundingClientRect(), s = document.querySelector('.terrace-scene').getBoundingClientRect();
            return { scale: m.a, x: m.e, y: m.f,
              covers: r.left <= s.left + .1 && r.right >= s.right - .1 && r.top <= s.top + .1 && r.bottom >= s.bottom - .1 };
          }), glass: Array.from(entryGlassMatrix), cityGlass: Array.from(entryCityGlassMatrix), entering: !!c.memoryTransition };
      }, to);
    }
    for (const key of ['night0', 'night1', 'night2', 'ending']) {
      await start(key);
      const initial = await advance(0);
      assert.equal(initial.zoom, 1); assert.equal(initial.x, 160); assert(initial.hidden);
      assert(initial.background.every(m => m.covers), 'Initial city framing covers every edge');
      await page.keyboard.press('KeyE'); await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => lunaCampaign.dialog.index), 0);
      let previous = initial;
      for (const time of [1.8, 3.5, 5, 6.9]) {
        const frame = await advance(time);
        assert(frame.x <= previous.x && frame.x >= 0, 'Camera travels left');
        assert.equal(frame.zoom, 1); assert.equal(frame.y, 0);
        assert.equal(frame.artScale, initial.artScale, 'Original dialogue scale must remain constant');
        assert(frame.foreground.every(m => m.scale === 1 && m.y === 0 && Math.abs(m.x + frame.x) < .001),
          'Building, actors and rail translate together without any zoom');
        assert(frame.background.every((m, i) => m.scale === initial.background[i].scale && m.y === 0 &&
          Math.abs(m.x + frame.x * .2) < .001 && m.covers), 'City and sign effects move together at 20% speed, at a fixed scale with no exposed edges');
        if (time < 6.8) assert(frame.background[0].x > previous.background[0].x && frame.background[0].x < 0,
          'The distant skyline actually moves, rather than staying attached to the screen');
        assert(Math.abs(frame.cityGlass[0] - frame.background[0].scale) < 1e-6 &&
          Math.abs(frame.cityGlass[12] - (frame.background[0].x + 240 * (1-frame.background[0].scale))) < 1e-4,
          'Rain refraction matches the translated city and its fixed edge coverage');
        // Canvas stores scale components at float precision; allow < .0001 native pixel.
        assert(Math.abs(frame.glass[0] - frame.zoom) < 1e-6 && Math.abs(frame.glass[12] + frame.x * frame.zoom) < 1e-4,
          'Refracted scenery must use the same moving camera as the art: '+JSON.stringify({time,frame}));
        assert.equal(frame.index, 0); assert.equal(frame.chars, 0);
        if (time < 6.8) assert(frame.hidden && frame.entering);
        else assert(!frame.hidden && !frame.entering && frame.zoom === 1 && frame.x === 0);
        if (key === 'night0') await page.screenshot({ path: '/private/tmp/terrace-entrance-' + time + '.png' });
        if (key === 'night0' && time === 3.5) {
          for (const viewport of [{ width: 640, height: 360 }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
            await page.setViewportSize(viewport); await page.waitForTimeout(60);
            assert(await page.evaluate(() => {
              const scene = document.querySelector('.terrace-scene'), s = scene.getBoundingClientRect(),
                a = document.querySelector('.terrace-city').getBoundingClientRect();
              return getComputedStyle(scene).overflow === 'hidden' && a.left <= s.left + .1 && a.top <= s.top + .1 &&
                a.right >= s.right - .1 && a.bottom >= s.bottom - .1 && s.left >= -.1 && s.top >= -.1 &&
                s.right <= innerWidth + .1 && s.bottom <= innerHeight + .1;
            }), 'Resizing during travel keeps the 16:9 scene covered and clipped');
          }
        }
        previous = frame;
      }
      await page.evaluate(() => { lunaCampaign.dialog.chars = 1e5; lunaCampaign.next(); });
      assert.equal(await page.evaluate(() => LunaTerrace.camera(lunaCampaign.dialog).zoom), 1, 'Next line must not replay entrance');
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => LunaTerrace.camera(lunaCampaign.dialog).zoom), 1, 'Settings remount keeps settled camera');
    }
    await start('night0');
    await advance(2);
    await page.evaluate(() => {
      window.entryBeforePause = lunaCampaign.dialog.terraceEntryTime;
      window.entryFocusDescriptor = Object.getOwnPropertyDescriptor(LunaFocusSettings, 'hiddenPaused');
      Object.defineProperty(LunaFocusSettings, 'hiddenPaused', { configurable: true, value: true });
      for (let i = 0; i < 20; i++) realCampaignTick.call(lunaCampaign, .05);
    });
    assert(await page.evaluate(() => lunaCampaign.dialog.terraceEntryTime === entryBeforePause), 'Focus pause freezes entrance');
    await page.evaluate(() => { Object.defineProperty(LunaFocusSettings, 'hiddenPaused', entryFocusDescriptor); lunaCampaign.toPicker(); });
    assert.equal(await page.locator('.campaign-memory-transition,.terrace-entering').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start('night0');
    const reduced = await advance(1.9);
    assert.equal(reduced.zoom, 1); assert(!reduced.entering && !reduced.hidden, 'Reduced motion uses existing fade only');
    assert.deepEqual(errors, []);
    console.log('TERRACE_ENTRANCE_CAMERA_OK: four nights, shorter pan, 20% city/sign parallax without zoom, matched refraction, edge coverage/resize, fade/input gate, settings, cancellation and reduced motion');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
