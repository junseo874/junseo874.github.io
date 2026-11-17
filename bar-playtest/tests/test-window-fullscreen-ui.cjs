const assert = require('node:assert/strict');
const {pages} = require('../../tools/lib/site-entrypoints.cjs');
const {load, chrome} = require('../../tools/lib/test-runtime.cjs');
const base = process.env.EDITOR_URL || 'http://127.0.0.1:8123';

(async () => {
  const browser = await load('playwright').chromium.launch({executablePath:chrome, headless:true});
  try {
    const page = await browser.newPage();
    await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    async function check(on) {
      await page.waitForFunction(on => document.fullscreenElement === (on ? document.documentElement : null), on, {timeout:5000});
    }
    for (const file of pages) {
      await page.goto(base + '/' + file, {waitUntil:'commit'});
      await page.waitForFunction(() => window.LunaWindowFullscreen && document.body);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('KeyO'); await check(true);
      await page.keyboard.press('KeyO'); await check(false);
    }

    await page.goto(base + '/bar-playtest/?dev=1&mode=minigames');
    await page.waitForFunction(() => window.LunaMinigames);
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(() => LunaMinigames.openShakePractice({sound:false}));
    const frame = page.frameLocator('.wine-practice-dialog iframe');
    await frame.locator('body').waitFor();
    await page.locator('.wine-practice-dialog iframe').focus();
    await page.keyboard.down('KeyO');
    try {
      await check(true);
      await page.keyboard.down('KeyO'); // Physical key held: no second toggle.
      await check(true);
    } finally { await page.keyboard.up('KeyO'); }
    assert.equal(await frame.locator('html').evaluate(el => !!el.ownerDocument.fullscreenElement), false);
    assert(await page.locator('.wine-practice-dialog').evaluate(d => {
      const box = d.getBoundingClientRect();
      return d.matches(':modal') && d.contains(document.elementFromPoint(box.x + box.width/2, box.y + box.height/2));
    }), 'the open minigame stays visible and interactive in window fullscreen');
    await page.keyboard.press('KeyO'); await check(false);

    await page.goto(base + '/bar-playtest/outside-dialogue-editor.html');
    const search = page.locator('input:not([type]), input[type="search"], input[type="text"]').filter({visible:true}).first();
    await search.fill(''); await search.press('o');
    assert.equal(await search.inputValue(), 'o'); await check(false);
    assert(await page.evaluate(() => ['ctrlKey','altKey','metaKey','shiftKey','isComposing'].every(mod =>
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'o',code:'KeyO',cancelable:true,[mod]:true})))));
    console.log('WINDOW_FULLSCREEN_OK:', pages.length, 'pages, including the focused simulator iframe, held key and editor typing');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
