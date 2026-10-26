const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(() => { window.mixTestTick = barGame.tick.bind(barGame); barGame.tick = () => {}; });
    // No generic early-finish button in any crafting screen, including practice.
    for (const kind of ['open', 'pour', 'fill_up', 'stir', 'shake']) for (const practice of [true, false]) {
      await page.evaluate(({kind, practice}) => {
        barGame.startMinigame(kind);
        if (!practice) barGame.minigame = null;
        barGame.changed();
      }, {kind, practice});
      await page.waitForFunction(kind => !!document.querySelector('.' + ({open: 'opening', pour: 'fluid', fill_up: 'fluid'}[kind] || kind) + '-screen'), kind);
      assert.equal(await page.getByRole('button', {name: /현재 기믹 마치기|Finish this step/}).count(), 0);
      if (['stir', 'shake'].includes(kind)) assert.equal(await page.locator('[data-act="endGimmick"]').count(), 0);
      else assert.equal(await page.locator('[data-act="endGimmick"]').count(), 1, 'keep explicit pour/open completion');
    }
    for (const kind of ['stir', 'shake']) for (const next of [true, false]) {
      await page.evaluate(({ kind, next }) => {
        const g = barGame; g.startMinigame(kind); g.minigame = null;
        g.progress.flags['mix_tutorial_' + kind] = true; delete g.gimmick.mixTutorial;
        if (next) g.craft.queue.push(LunaMinigames.example(g, 'pour').step);
        g.startGimmick();
        const s = g.gimmick;
        for (let tries = 0; !s.completed && tries < 100; tries++) {
          if (kind === 'stir') for (const key of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) g.gimmickInput(key);
          else { s.pathPoint = [0, 0]; s.pathFixedHits = []; g.gimmickInput('Space'); }
        }
        if (!s.completed) throw Error('Mix fixture blocked: ' + JSON.stringify({ kind, paused: g.isPaused(), overlay: g.overlay, started: s.started, attempts: s.attempts }));
        window.completedMix = s;
      }, { kind, next });
      await page.locator('.' + kind + '-screen').waitFor();
      if (kind === 'stir') {
        assert.equal(await page.locator('.gimmick-finish,[data-act="endGimmick"]').count(), 0);
      } else await page.locator('[data-rhythm-finish]').waitFor({ state: 'visible' });
      await page.keyboard.press('Space'); await page.keyboard.press('KeyD'); await page.keyboard.press('Enter');
      assert(await page.evaluate(() => barGame.gimmick === completedMix && !barGame.craft.results.length));
      await page.evaluate(() => {
        for (let i = 0; i < 8; i++) mixTestTick(.1);
        barGame.paused = true; for (let i = 0; i < 20; i++) mixTestTick(.1); barGame.paused = false;
      });
      assert(await page.evaluate(() => barGame.gimmick === completedMix && !barGame.craft.results.length));
      await page.evaluate(() => mixTestTick(.11));
      await page.waitForFunction(next => barGame.screen === (next ? 'gimmick' : 'result') && barGame.gimmick !== completedMix, next);
      assert.equal(await page.evaluate(() => barGame.craft.results.length), 1);
      if (next) {
        assert.equal(await page.evaluate(() => barGame.gimmick.type), 'pour');
        await page.locator('canvas[data-pixel-pour]').waitFor();
      } else {
        await page.locator('.serve-presentation').waitFor();
        // The serving animation has its own 1.5s game-clock load gate.
        await page.evaluate(() => { barGame.tick = mixTestTick; });
        await page.locator('[data-act="offer"]').waitFor();
        await page.evaluate(() => { barGame.tick = () => {}; });
      }
    }
    assert.deepEqual(errors, []);
    console.log('MIX_COMPLETION_UI_OK: stir/shake feedback visible, .9s automatic next/serve, pause, input protection');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
