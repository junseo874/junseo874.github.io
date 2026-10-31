const assert = require('node:assert/strict');
const rt = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await rt.load('playwright').chromium.launch({executablePath: rt.chrome, headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(async () => {
      const image = new Image(); image.src = LunaBirdSprites.assets.pigeon; await image.decode();
      // Keep this test on each loading host; CSS must not depend on campaign ticks.
      lunaCampaign.tick = () => false;
      lunaCampaign.screen('loading');
      await document.fonts.load('400 22px LunaPixel', 'Loading....');
    });
    assert.equal(await page.locator('.resource-loading-copy').textContent(), 'Loading');
    assert(await page.evaluate(() => getComputedStyle(document.querySelector('.resource-loading-copy')).fontFamily.startsWith('LunaPixel') && document.fonts.check('400 22px LunaPixel', 'Loading....')), 'Use the original Stardust regular face');
    const frames = await page.evaluate(() => {
      const root = document.querySelector('.resource-loading');
      const animation = root.getAnimations({subtree: true}).find(a => a.animationName === 'luna-loading-pigeon');
      animation.pause();
      const sheet = LunaBirdSprites.sheet, crop = LunaBirdSprites.crops.pigeon;
      return Array.from({length: sheet.frames}, (_, frame) => {
        animation.currentTime = (frame + .1) * 1000 / sheet.fps;
        const css = getComputedStyle(root, '::before');
        return {actual: css.backgroundPosition.split(' ').map(parseFloat), expected: [-(crop.x + frame * sheet.width) * 4.2, -crop.y * 4.2], width: parseFloat(css.width), height: parseFloat(css.height)};
      });
    });
    for (const frame of frames) {
      assert(frame.actual.every((v,i)=>Math.abs(v-frame.expected[i])<.02));
      assert(Math.abs(frame.width-102*.7)<.02); assert(Math.abs(frame.height-84*.7)<.02);
    }
    const dots = await page.evaluate(() => {
      const root = document.querySelector('.resource-loading'), label = root.querySelector('.resource-loading-copy');
      const animation = root.getAnimations({subtree: true}).find(a => a.animationName === 'luna-loading-dots');
      animation.pause();
      return [0, 100, 200, 300, 400, 500, 600].map(time => {
        animation.currentTime = time + 1;
        const rect = label.getBoundingClientRect();
        return {content: getComputedStyle(root.querySelector('.resource-loading-dots'), '::after').content, x: rect.x, width: rect.width};
      });
    });
    assert.deepEqual(dots.map(v => v.content), ['', '.', '..', '...', '....', '', '.'].map(JSON.stringify));
    assert(dots.every(v => v.x === dots[0].x && v.width === dots[0].width), 'Dot changes must not shift the label');
    assert(await page.evaluate(() => {
      const root = document.querySelector('.resource-loading'), animation = root.getAnimations({subtree:true})[0];
      for (let i=0;i<10;i++) {lunaCampaign.loadPercent=i*10;lunaCampaign.draw();}
      return root === document.querySelector('.resource-loading') && root.getAnimations({subtree:true})[0] === animation;
    }), 'Progress callbacks must not recreate the loading animation');
    for (const viewport of [{width:1280,height:720},{width:960,height:600}]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const centered = await page.evaluate(() => {
        const root=document.querySelector('.resource-loading'), r=root.getBoundingClientRect(), label=root.querySelector('.resource-loading-copy').getBoundingClientRect();
        const scale=r.width/root.offsetWidth;
        return {x:Math.abs((label.left+label.right-r.left-r.right)/2), y:Math.abs((label.bottom-(58.8+16+label.height/scale)*scale/2)-(r.top+r.height/2))};
      });
      assert(centered.x < 1 && centered.y < 1, 'Pigeon + label group should be centered');
    }
    await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:'/private/tmp/loading-pigeon-small-stardust.png'});
    // Door-art fallback uses the same presentation, then leaves cleanly when art is ready.
    await page.evaluate(() => {lunaCampaign.doorTransition={artReady:false};lunaCampaign.screen('bar-door');});
    assert.equal(await page.locator('.resource-loading-copy').textContent(), 'Loading');
    await page.evaluate(() => {lunaCampaign.doorTransition.artReady=true;lunaCampaign.doorTransition.direction='in';lunaCampaign.draw();});
    assert.equal(await page.locator('.resource-loading').count(), 0);
    assert.equal(await page.locator('.bar-door-scene').count(), 1);
    // Hold an actual exterior preparation promise: movement/scene ticking is paused,
    // but both CSS animations must keep advancing until loading finishes.
    await page.evaluate(() => {
      lunaCampaign.doorTransition=null;lunaCampaign.screen('developer');
      window.originalLoadingPrepare=LunaResources.prepare;
      LunaResources.prepare=()=>new Promise(resolve=>{window.releaseLoading=resolve;});
      void outsidePlaytest.start();
    });
    await page.waitForSelector('#outside-root .resource-loading');
    const readTimes = () => page.evaluate(() => document.querySelector('#outside-root .resource-loading').getAnimations({subtree:true}).map(a=>a.currentTime));
    const before = await readTimes(); await page.waitForTimeout(250); const after = await readTimes();
    assert.equal(before.length,2); assert(after.every((time,i)=>time>before[i]+100));
    assert.equal(await page.locator('#outside-root .resource-loading-copy').textContent(), 'Loading');
    await page.evaluate(() => {LunaResources.prepare=originalLoadingPrepare;releaseLoading();});
    await page.waitForFunction(() => !outsidePlaytest.loading, null, {timeout:60000});
    assert.equal(await page.locator('.resource-loading').count(),0);
    assert.equal(await page.evaluate(()=>outsidePlaytest.loadError),'');
    assert.deepEqual(errors,[]);
    console.log('PASS loading: original 12-frame pigeon at 6fps; 100ms dots; fixed center; progress continuity; campaign/door/exterior; paused-game animation; completion cleanup');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
