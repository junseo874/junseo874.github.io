const assert = require('node:assert/strict'), runtime = require('../../tools/lib/test-runtime.cjs');
(async () => {
  const browser = await runtime.load('playwright').chromium.launch({ executablePath: runtime.chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('/shaking/')) missing.push(r.url()); });
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=minigames');
    await page.locator('.updates-confirm').click();
    await page.evaluate(() => { lunaCampaign.session.install({ developer: false }); lunaCampaign.screen('game'); });
    async function craft(id, taught = false) {
      await page.evaluate(({ id, taught }) => {
        const g = barGame;
        g.reset(2, 'practice', 1, false); g.overlay = null; g.paused = false; g.hidden = false;
        g.progress.flags.mix_tutorial_shake = taught;
        const drink = g.cocktail(id);
        g.prep = { selected: id, glass: drink.glass, tool: 'shaker', ingredients: g.t.recipes.filter(r => r.context === id && !r.auto_apply).map(r => r.ingredient) };
        g.screen = 'prep'; g.startCraft();
        // Use the real recipe queue. Fixture only supplies already-poured amounts.
        const shake = g.craft.queue.findIndex(s => s.type === 'shake');
        if (shake < 0) throw Error('Missing shake: ' + id);
        g.craft.results = g.craft.queue.slice(0, shake).map(s => ({ ...s, value: s.target, completion: 1, completed: true, failures: 0 }));
        g.craft.index = shake; g.craft.elapsed = 62.4; g.nextGimmick(); g.changed();
      }, { id, taught });
      await page.locator('.shake-craft-dialog iframe').waitFor();
      const f = page.frames().find(f => f.url().includes('/shaking/'));
      await f.waitForFunction(() => R.id === 'craft'); return f;
    }
    const f = await craft('gin_fizz');
    assert.equal(await page.evaluate(() => lunaCampaign.view), 'game', 'Iframe focus must not open campaign options');
    assert.equal(await f.locator('#timer').textContent(), '01:02');
    assert.equal(await f.locator('#sMenu').isVisible(), false);
    assert.equal(await f.locator('#oDiff').isVisible(), false);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => barGame.craft.elapsed), 62.4);
    assert.equal(await page.evaluate(() => barGame.endGimmick()), false);
    assert.equal(await page.locator('.mix-tutorial').count(), 0, 'No legacy guide behind the V2 guide');
    assert(await f.evaluate(() => R.layers.every(l => /^#[a-f\d]{6}$/i.test(l[1])) && R.layers.length === 1));
    assert.equal(await f.evaluate(() => R.layers[0][2]), 45, 'Only the gin already poured, not the later soda fill-up');
    await f.locator('#tutNext').click(); await f.locator('#tutNext').click();
    await f.waitForFunction(() => GT - S.startT > 350);
    assert(await page.evaluate(() => barGame.craft.elapsed > 62.6 && barGame.progress.flags.mix_tutorial_shake));
    await f.press('body', 'Escape');
    const paused = await f.evaluate(() => GT);
    await page.waitForTimeout(250); assert.equal(await f.evaluate(() => GT), paused);
    await f.press('body', 'Escape');
    await page.evaluate(() => { barGame.paused = true; });
    await page.waitForTimeout(100); const parentPause = await f.evaluate(() => GT);
    await page.waitForTimeout(250); assert.equal(await f.evaluate(() => GT), parentPause);
    await page.evaluate(() => { barGame.paused = false; });
    await f.waitForFunction(() => pauseAt === null);
    await f.evaluate(() => { S.angDeg = 5; press('Space'); });
    await f.waitForFunction(() => S.phase === 'shake');
    for (let i = 0; i < 10; i++) {
      await f.press('body', 'KeyA'); await f.press('body', 'KeyD');
    }
    await f.waitForFunction(() => S.phase === 'unseal');
    const elapsed = await f.evaluate(() => (S.endT - S.startT) / 1000);
    await f.press('body', 'Escape');
    const endingPause = await f.evaluate(() => GT);
    await page.waitForTimeout(300);
    assert.equal(await f.evaluate(() => GT), endingPause, 'Ending is pause-safe too');
    assert.equal(await page.evaluate(() => barGame.gimmick.type), 'shake');
    await f.press('body', 'Escape');
    await page.screenshot({ path: '/private/tmp/shaking-main-finish.png' });
    assert.equal(await page.evaluate(() => barGame.gimmick.type), 'shake');
    await page.waitForFunction(() => barGame.gimmick?.type === 'fill_up');
    assert.equal(await page.locator('.shake-craft-dialog').count(), 0);
    const result = await page.evaluate(() => ({ rows: barGame.craft.results.filter(r => r.type === 'shake'), elapsed: barGame.craft.elapsed }));
    assert.equal(result.rows.length, 1); assert.equal(result.rows[0].completion, 1);
    assert.equal(result.rows[0].failures, 0); assert.equal(result.rows[0].completed, true);
    assert.ok(Math.abs(result.elapsed - 62.4 - elapsed) < .001, 'Single shared clock, ending excluded');
    // Failure uses the same queue/result contract, with no practice result/retry screen.
    const fail = await craft('whiskey_sour', true);
    await fail.waitForFunction(() => S.phase === 'close');
    assert.equal(await fail.locator('#tut').isVisible(), false);
    await fail.evaluate(() => { S.angDeg = 5; press('Space'); });
    await fail.waitForFunction(() => S.phase === 'shake');
    await page.screenshot({ path: '/private/tmp/shaking-main-play.png' });
    for (let i = 0; i < 3; i++) {
      await fail.evaluate(() => { S.waitT = 0; S.pending = false; press('D'); });
      if (i < 2) await fail.waitForTimeout(300);
    }
    await fail.waitForFunction(() => S.phase === 'pop');
    await page.waitForFunction(() => barGame.gimmick?.type === 'fill_up').catch(async e => {
      console.error(await page.evaluate(() => ({ screen: barGame.screen, paused: barGame.isPaused(), error: barGame.error, queue: barGame.craft?.queue, index: barGame.craft?.index, results: barGame.craft?.results })), errors);
      throw e;
    });
    assert.equal(await page.evaluate(() => barGame.craft.results.find(r => r.type === 'shake').completion), 0);
    assert.equal(await page.evaluate(() => barGame.craft.results.filter(r => r.type === 'shake').length), 1);
    assert.equal(await page.locator('.shake-craft-dialog').count(), 0);
    // End of a real queue: choose the actual shake recipe with no post-shake fill.
    const lastId = await page.evaluate(() => {
      const g = barGame;
      return g.t.cocktails.find(c => {
        if (c.mix !== 'shake') return false;
        const actual = { selected: c.id, glass: c.glass, tool: 'shaker', ingredients: g.t.recipes.filter(r => r.context === c.id && !r.auto_apply).map(r => r.ingredient) };
        return LunaCore.buildQueue(g.data, c, actual).at(-1)?.type === 'shake';
      })?.id;
    });
    if (!lastId) throw Error('Expected an existing recipe ending with shake');
    const last = await craft(lastId, true);
    await last.waitForFunction(() => S.phase === 'close');
    await last.evaluate(() => { S.angDeg = 10; press('Space'); });
    await last.waitForFunction(() => S.phase === 'shake');
    for (let i = 0; i < 10; i++) { await last.press('body', 'KeyA'); await last.press('body', 'KeyD'); }
    await page.waitForFunction(() => barGame.screen === 'result');
    assert.equal(await page.evaluate(() => barGame.craft.results.filter(r => r.type === 'shake').length), 1);
    assert.equal(await page.evaluate(() => barGame.craft.results.find(r => r.type === 'shake').completion), .97, 'Existing completion field preserves V2 closing penalty');
    // Queue cancellation removes the frame/listener; a stale token cannot finish another craft.
    const stale = await craft('gin_fizz', true), token = await stale.evaluate(() => query.get('token'));
    await page.evaluate(() => barGame.cancelCraft());
    await page.locator('.shake-craft-dialog').waitFor({ state: 'detached' });
    await page.evaluate(token => window.postMessage({ type: 'luna-shake-craft', token, action: 'complete', elapsed: 5, score: 100, failures: 0 }, location.origin), token);
    await page.waitForTimeout(100); assert.equal(await page.evaluate(() => barGame.craft), null);
    await page.evaluate(() => barGame.startMinigame('shake'));
    await page.locator('.shake-screen').waitFor();
    assert.equal(await page.locator('.shake-craft-dialog').count(), 0, 'Simulator V1 is unchanged');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    console.log('PASS main V2: real craft queues, cumulative timer, guides, pauses, full ending, failure scoring, cancellation and V1 isolation');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
