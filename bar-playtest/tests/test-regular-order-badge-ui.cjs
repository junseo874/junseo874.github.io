const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
(async () => {
  const browser = await runtime.load('playwright').chromium.launch({executablePath: runtime.chrome, headless: true, args: ['--mute-audio']});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.locator('.updates-confirm').click();
    await page.evaluate(() => LunaFocusSettings.setEnabled(false));
    for (const developer of [false, true]) for (const arg of ['exact:gin_tonic', 'free']) {
      const order = await page.evaluate(({developer, arg}) => {
        const c = lunaCampaign, g = barGame;
        c.session.uninstall(); c.session.install({developer});
        g.reset(0, 'practice', 1, true); g.phase = 'regular'; g.story = {steps: [{type: 'craft'}], index: 0};
        g.speed = 0; g.tutorial = null; g.dialogue = null; g.choice = null;
        g.cameraMoving = false; g.cameraLeft = 0; g.transition = 0; g.screen = 'bar';
        g.seats = {L: null, M: {actor: 'chris', coaster: true, state: 'WAIT_SERVE'}, R: null};
        g.focus = 'M'; g.currentOrder = null; g.createStoryOrder({actor: 'chris', arg});
        c.screen(c.playView); g.changed();
        return JSON.stringify(g.currentOrder);
      }, {developer, arg});
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.hud-right').count(), 0, 'no order label or empty HUD container');
      assert.equal(await page.evaluate(() => JSON.stringify(barGame.currentOrder)), order);
      assert(await page.evaluate(() => barGame.seats.M.order === barGame.currentOrder));
      assert(await page.evaluate(() => barGame.openRecipes()), 'recipes remain available');
      assert(await page.evaluate(() => barGame.selectCocktail(barGame.currentOrder.cocktail)), 'ordered drink can still be prepared');
      assert.equal(await page.evaluate(() => JSON.stringify(barGame.currentOrder)), order);
    }
    assert.deepEqual(errors, []);
    console.log('PASS main/developer exact/free orders: no top-right badge; order/seat/preparation preserved');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
