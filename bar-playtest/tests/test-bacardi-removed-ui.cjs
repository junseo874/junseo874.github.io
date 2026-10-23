const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const rt = require('../../tools/lib/test-runtime.cjs');
const { load } = require('../src/shared/data/csv-catalog.js');
(async () => {
  const base = path.resolve(__dirname, '../data/shared-csv');
  const catalog = await load(file => fs.readFile(path.join(base, file), 'utf8'));
  for (const [table, rows] of catalog.rawTables)
    assert(!rows.some(row => /bacardi|바카디/.test(JSON.stringify(row))), 'Retired cocktail in CSV: ' + table);
  const manifest = JSON.parse(await fs.readFile(path.resolve(__dirname, '../data/presentation/preload-manifest.json'), 'utf8'));
  assert(!JSON.stringify(manifest).includes('bacardi'), 'Retired art must not be preloaded');
  const browser = await rt.load('playwright').chromium.launch({ executablePath: rt.chrome, headless: true });
  try {
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    const result = await page.evaluate(() => {
      const g = barGame, c = lunaCampaign, checks = [];
      for (const developer of [true, false]) {
        c.session.uninstall(); c.session.install({ developer });
        for (const day of [0, 1, 2, 3, 99]) {
          g.reset(day, 'general', 42, true);
          g.progress.flags.bacardi_unlocked = true; // Obsolete flags must not restore the recipe.
          const allowed = g.cocktailsAvailable().map(row => row.id);
          if (allowed.includes('bacardi') || g.dailyUnlocks().cocktails.some(row => row.id === 'bacardi')) throw Error('Retired recipe unlocked');
          const bark = g.setBarks; g.setBarks = () => {};
          try {
            for (let i = 0; i < 250; i++) {
              const guest = { slot: {}, personality: { think_chance: 0 } };
              g.beginOrder(guest, false);
              if (!allowed.includes(guest.nextCocktail) || guest.nextCocktail === 'bacardi') throw Error('Invalid random order');
            }
          } finally { g.setBarks = bark; }
          checks.push({ developer, day });
        }
      }
      g.reset(99, 'practice', 1, true); c.screen(c.playView);
      if (g.selectCocktail('bacardi')) throw Error('Retired recipe selectable');
      if (!g.selectCocktail('gin_tonic')) throw Error('Other recipes broken');
      g.debugFill(); g.startCraft();
      if (g.screen !== 'gimmick') throw Error('Other recipes cannot start');
      return { checks, assets: Object.keys(g.data.assets).filter(key => key.includes('bacardi')),
        tableReferences: Object.values(g.data.tables).flat().filter(row => /bacardi|바카디/.test(JSON.stringify(row))).length,
        sharedIngredients: ['rum', 'grenadine'].every(id => g.t.shelf_items.some(row => row.id === id)),
        sharedArt: !!g.data.assets.item_rum && !!g.data.assets.item_grenadine };
    });
    assert.equal(result.checks.length, 10); assert.equal(result.tableReferences, 0);
    assert.deepEqual(result.assets, []); assert(result.sharedIngredients && result.sharedArt);
    await page.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');
    await page.waitForFunction(() => resourceReview.ready);
    assert.equal(await page.evaluate(() => resourceReview.rows.filter(row => /bacardi|바카디/.test(row.id + ' ' + row.title)).length), 0);
    await page.goto('http://127.0.0.1:8123/bar-playtest/data-review.html');
    await page.waitForFunction(() => !document.getElementById('table').disabled);
    await page.locator('#table').selectOption('Cocktails');
    await page.locator('#search').fill('바카디');
    assert.equal(await page.locator('#rows tr').count(), 0);
    assert(!requests.some(url => /cocktail-bacardi\.png/.test(url)), 'No gameplay or review request for retired art');
    assert.deepEqual(errors, []);
    console.log('BACARDI_REMOVED_OK: source CSV, runtime, 2500 random orders, unlocks, recipe selection, shared ingredients, review cards, CSV review and preload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
