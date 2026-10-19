const assert = require('node:assert/strict');
const { load, chrome } = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await load('playwright').chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('http://127.0.0.1:8123/bar-playtest/');
    // Loading a declared family alone can pass with missing Korean glyphs.
    // Check the actual fonts Chrome uses to paint Korean, Latin and digits.
    const samples = [
      ['LunaPixel', [400, 700, 800]], ['Paperlogy', [400, 500, 600, 700]],
      ['Pretendard', [400, 500, 600, 800]], ['LunaDigital', [400]],
    ].flatMap(([family, weights]) => weights.map(weight => ({ family, weight, id: family + weight })));
    await page.evaluate(async samples => {
      for (const { family, weight, id } of samples) {
        const text = family === 'LunaDigital' ? '0123456789:' : '루나 칵테일 ABC 123';
        const loaded = await document.fonts.load(`${weight} 20px ${family}`, text);
        if (!loaded.length) throw Error(`Missing font: ${family} ${weight}`);
        const span = document.createElement('span');
        span.id = id;
        span.textContent = text;
        span.style.cssText = `position:fixed;top:0;left:0;font:${weight} 20px ${family}`;
        document.body.append(span);
      }
    }, samples);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    for (const { id } of samples) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      assert(fonts.length > 0, `${id} must paint text`);
      assert(fonts.every(font => font.isCustomFont), `${id} must not silently fall back: ${JSON.stringify(fonts)}`);
    }
    console.log('PASS 12 font/weight combinations: actual Korean, Latin and numeric webfont rendering');
    await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
    await page.waitForFunction(() => resourceReview.ready);
    const cases = [
      ['ui:serve', [
        ['.drink-tray h3', 'LunaPixel', '700'],
        ['.drink-tray small', 'Paperlogy', '500'],
        ['.stack.service-popup small', 'Paperlogy', '700'],
      ]],
      ['ui:prep', [
        ['.prep-brief-heading strong', 'LunaPixel', '700'],
        ['.craft-start', 'Paperlogy', '600'],
      ]],
      ['ui:recipes', [
        ['.resource-recipe-list .panel-header h2', 'LunaPixel', '700'],
        ['.resource-recipe-list .panel-header>small', 'Paperlogy', '500'],
        ['.resource-recipe-list .panel-header>small strong', 'Paperlogy', '500'],
        ['.recipe-card strong', 'LunaPixel', '700'],
        ['.recipe-card small', 'Pretendard', '600'],
      ]],
      ['overlay:service', [
        ['.service-panel h2', 'LunaPixel', '700'],
        ['.service-actions button', 'Paperlogy', '500'],
        ['.service-eyebrow', 'Pretendard', '500'],
      ]],
    ];
    for (const [id, checks] of cases) {
      await page.evaluate(id => {
        const row = resourceReview.rows.find(row => row.id === id);
        resourceReview.launch(row ? row.launch : {type:'overlay', id:id.split(':')[1]}, id, '');
      }, id);
      const frame = page.frames().find(frame => frame.url().includes('resourceReview=1'));
      for (const [selector, family, weight] of checks) {
        await frame.locator(selector).first().waitFor({state:'attached'});
        const actual = await frame.locator(selector).first().evaluate(element => {
          const style = getComputedStyle(element);
          return {family:style.fontFamily.split(',')[0].replaceAll('"',''), weight:style.fontWeight};
        });
        assert.deepEqual(actual, {family, weight}, `${id}: ${selector}`);
      }
      await page.evaluate(() => resourceReview.close());
    }
    console.log('PASS serving, preparation, recipe and service text roles: actual scene font families and weights');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
