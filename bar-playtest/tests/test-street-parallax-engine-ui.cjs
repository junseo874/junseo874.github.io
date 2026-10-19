const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
    await page.locator('.updates-confirm').click();
    await page.locator('[data-outside-action="start"]').click();
    await page.waitForFunction(() => outsidePlaytest.active && !outsidePlaytest.loading);
    await page.keyboard.press('Space'); // Dismiss the standalone developer-entry hint.
    await page.evaluate(() => {
      const o = outsidePlaytest, m = o.model;
      window.parallaxStep = o.tick; o.tick = () => {};
      window.modelStep = m.tick; m.tick = () => {};
      m.start({ day: 3, flow: 'out', place: 'bar' }); m.x = -8.78;
      m.story.cancel(); m.backgroundStory.cancel();
      o.snapCamera(); parallaxStep(0);
      window.parallaxPositions = () => Object.fromEntries(LUNA_OUTSIDE_DATA.scenes.street.nodes
        .filter(n => n.ancestry[0] === 'BG').map(n => [n.name, LunaOutside.streetParallax(n, o.renderCamera, m)]));
    });
    const initial = await page.evaluate(() => parallaxPositions());
    await page.screenshot({ path: '/private/tmp/engine-parallax-lookout.png' });
    await page.keyboard.press('KeyY');
    await page.evaluate(() => { for (let i = 0; i < 240; i++) parallaxStep(1 / 60); });
    assert(await page.evaluate(() => outsidePlaytest.camera.w > 10), JSON.stringify(await page.evaluate(() => ({ camera: outsidePlaytest.camera, x: outsidePlaytest.model.x, paused: outsidePlaytest.model.paused, story: outsidePlaytest.model.story.blocking, view: lunaCampaign.view }))));
    assert.deepEqual(await page.evaluate(() => parallaxPositions()), initial, 'camera-only zoom never moves background transforms');
    await page.screenshot({ path: '/private/tmp/engine-parallax-panorama.png' });
    await page.keyboard.press('KeyY');
    await page.evaluate(() => { for (let i = 0; i < 240; i++) { outsidePlaytest.model.x += 1 / 60; parallaxStep(1 / 60); } });
    const walked = await page.evaluate(() => parallaxPositions());
    for (const [name, ratio] of Object.entries({ C_Middle_Building_1: .2, C_Middle_Building_2: .5, C_Middle_Building_3: .05 })) {
      assert(Math.abs(walked[name].x - initial[name].x - 4 * ratio) < 1e-8, name);
      assert.equal(walked[name].y, initial[name].y);
    }
    for (const name of ['Sky', 'C_Back_Building_1', 'C_Back_Building_2', 'B_ForeFore_Object_1', 'Fence', 'CityLight'])
      assert.deepEqual(walked[name], initial[name], name + ' fixed as authored');
    await page.screenshot({ path: '/private/tmp/engine-parallax-walked.png' });
    const paint = await page.evaluate(() => {
      const o = outsidePlaytest, ctx = document.querySelector('#outside-root canvas').getContext('2d');
      const translate = ctx.translate, draw = ctx.drawImage, seen = []; let xy;
      ctx.translate = function (x, y) { xy = [x, y]; return translate.call(this, x, y); };
      ctx.drawImage = function (image, ...args) { seen.push({ src: image.src, xy }); return draw.call(this, image, ...args); };
      try { parallaxStep(0); } finally { ctx.translate = translate; ctx.drawImage = draw; }
      return ['C_Middle_Building_1', 'C_Middle_Building_2', 'C_Middle_Building_3'].map(name => {
        const n = LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n => n.name === name);
        const pos = LunaStreetParallax.position(n, o.model);
        const expected = LunaPixelCamera.sprite(n.sprite, pos.x, pos.y, n.sx, n.sy, n.flip, o.renderCamera, o.pixelSurface);
        return { name, expected: [expected.x, expected.y], actual: seen.find(s => s.src?.endsWith(LUNA_OUTSIDE_DATA.assets[n.sprite.asset].src))?.xy };
      });
    });
    for (const item of paint) assert.deepEqual(item.actual, item.expected, item.name + ' actual canvas transform');
    await page.evaluate(() => outsidePlaytest.snapshot({ x: -18, y: 8, w: 12 }));
    assert.deepEqual(await page.evaluate(() => parallaxPositions()), walked, 'snapshot is read-only');
    await page.setViewportSize({ width: 800, height: 600 });
    await page.evaluate(() => parallaxStep(0));
    assert.deepEqual(await page.evaluate(() => parallaxPositions()), walked, 'resize cannot alter world offsets');
    await page.evaluate(() => { const m = outsidePlaytest.model; m.x += 4; parallaxStep(0); });
    assert.deepEqual(await page.evaluate(() => parallaxPositions()), walked, 'teleport excluded');
    // Both directions of vertical travel, including the lift camera offset/zoom.
    for (const reverse of [false, true]) {
      await page.evaluate(reverse => {
        const o = outsidePlaytest, m = o.model, R = LunaResidence.layout;
        m.x = R.elevatorX; m.y = reverse ? R.upperY : -.7;
        m.ride = { time: 0, from: reverse ? R.elevatorTop : R.elevatorBottom, to: reverse ? R.elevatorBottom : R.elevatorTop, duration: 12, call: false };
        o.snapCamera(); parallaxStep(0);
      }, reverse);
      const before = await page.evaluate(() => parallaxPositions());
      await page.evaluate(reverse => { const m = outsidePlaytest.model; for (let i = 0; i < 180; i++) { m.y += reverse ? -.03 : .03; m.ride.time += 1 / 60; parallaxStep(1 / 60); } }, reverse);
      assert.deepEqual(await page.evaluate(() => parallaxPositions()), before, 'lift reframing does not move layers');
    }
    // Restore real game movement and ensure the runtime, not only fixtures, drives the effect.
    await page.evaluate(() => {
      const o = outsidePlaytest, m = o.model;
      m.start({ day: 3, flow: 'out', place: 'bar' }); m.x = -7; o.snapCamera(); parallaxStep(0);
      m.tick = modelStep; o.tick = parallaxStep;
    });
    const beforeWalk = await page.evaluate(() => ({ x: outsidePlaytest.model.x, layers: parallaxPositions() }));
    await page.keyboard.down('KeyD'); await page.waitForTimeout(800); await page.keyboard.up('KeyD');
    const afterWalk = await page.evaluate(() => ({ x: outsidePlaytest.model.x, layers: parallaxPositions() }));
    assert(afterWalk.x > beforeWalk.x + .2);
    assert(Math.abs(afterWalk.layers.C_Middle_Building_2.x - beforeWalk.layers.C_Middle_Building_2.x - (afterWalk.x - beforeWalk.x) * .5) <= .011);
    await page.setViewportSize({ width: 1280, height: 720 });
    // Inspect the full home-to-bar route with accumulated offsets, not fresh-spawn screenshots only.
    await page.evaluate(() => {
      const o = outsidePlaytest, m = o.model; o.tick = () => {}; m.tick = () => {};
      m.start({ day: 3, flow: 'in', place: 'homeDoor' }); m.story.cancel(); m.backgroundStory.cancel();
      o.snapCamera(); parallaxStep(0);
      m.level = 0; m.y = -.7;
    });
    for (const [name, x] of [['left', -12.8], ['lookout', -8.78], ['shop', -2.87], ['bar', 1], ['right', 6.1]]) {
      await page.evaluate(x => {
        const m = outsidePlaytest.model, from = m.x, frames = Math.ceil(Math.abs(x - from) / .02);
        for (let i = 1; i <= frames; i++) { m.x = from + (x - from) * i / frames; parallaxStep(1 / 60); }
        for (let i = 0; i < 120; i++) parallaxStep(1 / 60);
      }, x);
      await page.screenshot({ path: '/private/tmp/engine-parallax-route-' + name + '.png' });
    }
    // Real day-0 home exit -> fixed-camera auto-walk, including the final tick
    // that clears barArrival. Holding movement must not move the scenery either.
    await page.evaluate(() => {
      const o = outsidePlaytest, m = o.model;
      m.tick = modelStep;
      m.start({ day: 0, flow: 'in', place: 'home' });
      m.story.cancel(); m.backgroundStory.cancel();
      m.transition = { time: 0, to: 'street', swapped: false, barArrival: true };
      o.snapCamera();
      for (let i = 0; i < 80 && !m.barArrival; i++) parallaxStep(1 / 60);
    });
    const arrivalStart = await page.evaluate(() => ({ x: outsidePlaytest.model.x, active: !!outsidePlaytest.model.barArrival, layers: parallaxPositions() }));
    assert(arrivalStart.active && arrivalStart.x < -1);
    await page.keyboard.down('KeyD');
    const arrivalFrames = await page.evaluate(() => {
      const o = outsidePlaytest, frames = [];
      for (let i = 0; i < 300 && o.model.barArrival; i++) {
        parallaxStep(1 / 60);
        frames.push({ x: o.model.x, active: !!o.model.barArrival, cameraX: o.camera.x, layers: parallaxPositions() });
      }
      return frames;
    });
    await page.keyboard.up('KeyD');
    assert(arrivalFrames.length > 100 && !arrivalFrames.at(-1).active);
    assert.equal(arrivalFrames.at(-1).x, 0);
    for (const frame of arrivalFrames) {
      assert.deepEqual(frame.layers, arrivalStart.layers, 'day-0 automatic walk keeps all background layers fixed through completion');
      if (frame.active) assert.equal(frame.cameraX, arrivalFrames[0].cameraX, 'arrival camera stays fixed');
    }
    await page.screenshot({ path: '/private/tmp/parallax-day0-arrival-fixed.png' });
    await page.evaluate(() => {
      const o = outsidePlaytest; o.model.story.cancel(); o.model.backgroundStory.cancel();
      parallaxStep(0); o.tick = parallaxStep;
    });
    const resumedBefore = await page.evaluate(() => ({ x: outsidePlaytest.model.x, layers: parallaxPositions() }));
    await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
    const resumedAfter = await page.evaluate(() => ({ x: outsidePlaytest.model.x, layers: parallaxPositions() }));
    assert(resumedAfter.x > resumedBefore.x + .1, 'normal walking resumes after arrival');
    assert(Math.abs(resumedAfter.layers.C_Middle_Building_2.x - resumedBefore.layers.C_Middle_Building_2.x - (resumedAfter.x - resumedBefore.x) * .5) <= .011, 'only new walking contributes, with no cinematic catch-up');
    assert.deepEqual(errors, []);
    console.log('ENGINE_PARALLAX_UI_OK: real walking/render transforms, panorama, fixed layers, lift, teleport, snapshot and resize');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
