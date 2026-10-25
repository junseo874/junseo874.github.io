const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const rt = require('../../tools/lib/test-runtime.cjs');
const { load } = require('../src/shared/data/csv-catalog.js');

(async () => {
  const base = path.resolve(__dirname, '../data/shared-csv');
  const catalog = await load(file => fs.readFile(path.join(base, file), 'utf8'));
  const retired = /cointreau|쿠앵트로|쿠앙트로/i;
  for (const [table, rows] of catalog.rawTables)
    assert(!retired.test(JSON.stringify(rows)), 'Retired ingredient in source CSV: ' + table);
  const legacy = { window: {} };
  vm.runInNewContext(await fs.readFile(path.resolve(__dirname, '../../js/data.js'), 'utf8'), legacy);
  assert(!retired.test(JSON.stringify(legacy.window.LUNA)));
  assert.equal(legacy.window.LUNA.master.shelf_items.filter(r => r.id === 'triple_sec').length, 1);

  const browser = await rt.load('playwright').chromium.launch({ executablePath: rt.chrome, headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    for (const developer of [false, true]) for (const variant of ['original', 'gpt']) {
      const result = await page.evaluate(({ developer, variant }) => {
        const g = barGame, c = lunaCampaign;
        c.session.uninstall(); c.session.install({ developer });
        c.ui.variant = variant; g.variant = variant;
        const unlocks = [];
        for (const day of [0, 1, 2, 3, 99]) {
          g.reset(day, 'practice', 1, true);
          unlocks.push({ day, available: g.itemsAvailable().some(r => r.id === 'triple_sec'),
            daily: g.dailyUnlocks().ingredients.filter(r => r.id === 'triple_sec').length });
        }
        const drinks = [...new Set(g.t.recipes.filter(r => r.ingredient === 'triple_sec').map(r => r.context))];
        const scores = drinks.map(id => {
          g.reset(99, 'practice', 1, true); c.screen(c.playView);
          if (!g.selectCocktail(id)) throw Error('Cannot select ' + id);
          g.debugFill(); g.startCraft();
          if (g.screen !== 'gimmick') throw Error('Cannot craft ' + id);
          const q = g.craft.queue, actual = g.craft.actual;
          const score = LunaCore.scoreCraft(g.data, g.cocktail(id), actual,
            q.map(step => ({ ...step, value: step.target, completion: 1, completed: true, failures: 0 })), 2);
          return { id, score: score.score, missing: score.missing, extra: score.extra,
            triple: q.filter(step => step.ingredient === 'triple_sec').map(step => step.target) };
        });
        g.reset(2, 'practice', 1, true); c.screen(c.playView); g.selectCocktail('cosmopolitan'); g.changed();
        return { unlocks, scores, items: g.t.shelf_items.filter(r => r.id === 'triple_sec'),
          references: /cointreau|쿠앵트로|쿠앙트로/i.test(JSON.stringify(g.data.tables)),
          recipe: g.t.recipes.find(r => r.context === 'cosmopolitan' && r.ingredient === 'triple_sec') };
      }, { developer, variant });
      assert.equal(result.references, false); assert.equal(result.items.length, 1);
      assert.equal(result.items[0]['name.ko'], '트리플섹');
      assert.equal(result.recipe.qty, 45); assert.equal(result.recipe.unit, 'ml');
      for (const row of result.unlocks) {
        assert.equal(row.available, row.day >= 2); assert.equal(row.daily, row.day === 2 ? 1 : 0);
      }
      assert(result.scores.some(r => r.id === 'cosmopolitan'));
      for (const row of result.scores) {
        assert.equal(row.score, 100, row.id); assert.deepEqual(row.missing, []); assert.deepEqual(row.extra, []);
        assert.equal(row.triple.length, 1, row.id + ' has exactly one Triple Sec step');
      }
      await page.waitForFunction(() => barGame.screen === 'prep');
      assert(!retired.test(await page.locator('body').innerText()));
    }
    await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
    await page.waitForFunction(() => resourceReview.ready);
    const cards = await page.evaluate(() => resourceReview.rows.map(r => ({ id: r.id, title: r.title })));
    assert(!retired.test(JSON.stringify(cards)));
    assert.equal(cards.filter(r => r.id.startsWith('item:triple_sec:')).length, 3);
    await page.goto('http://127.0.0.1:8123/bar-playtest/data-review.html');
    await page.waitForFunction(() => !document.getElementById('table').disabled);
    await page.locator('#table').selectOption('ShelfItems');
    await page.locator('#search').fill('쿠앵트로'); assert.equal(await page.locator('#rows tr').count(), 0);
    await page.locator('#search').fill('triple_sec'); assert.equal(await page.locator('#rows tr').count(), 1);
    assert.deepEqual(errors, []);
    console.log('TRIPLE_SEC_UNIFIED_OK: CSV, legacy simulator, main/developer original/remix, unlocks, all affected queues/scoring, resource cards and CSV review');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
