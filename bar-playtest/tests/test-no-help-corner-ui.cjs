const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    for (const variant of ['original', 'gpt']) {
      for (const screen of ['bar', 'prep', 'gimmick']) {
        await page.evaluate(({ variant, screen }) => {
          const g = barGame;
          g.reset(99, screen === 'bar' ? 'general' : 'practice', 1, true, { variant });
          if (screen === 'prep') g.selectCocktail('gin_tonic');
          if (screen === 'gimmick') g.startMinigame('shake', variant);
          g.changed();
        }, { variant, screen });
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.help-corner').count(), 0);
        assert.equal(await page.getByRole('button', { name: '?', exact: true }).count(), 0);
        await page.keyboard.press('Escape');
        await page.locator('[data-settings-tab="controls"]').click();
        assert.equal(await page.evaluate(() => barGame.overlay), 'settings');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => barGame.overlay), null);
      }
    }
    console.log('NO_HELP_CORNER_OK: original/remix bar, prep, gimmick; ESC controls and return preserved');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
