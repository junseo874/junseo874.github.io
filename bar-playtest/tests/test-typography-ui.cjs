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
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
