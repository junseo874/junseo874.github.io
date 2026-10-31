/* Unit conversion, recipe queue and craft judgement. No UI or per-session state. */
(function (root) {
  'use strict';
  function create({ clamp, n }) {
  function band(rows, type, x) {
    // Unit conversion must not move an exact boundary across a score band via floating-point noise.
    x = Math.round(x * 1e12) / 1e12;
    const row = rows.find(r => r.band_type === type && (r.min_ratio == null || (r.min_inclusive ? x >= n(r.min_ratio) : x > n(r.min_ratio))) && (r.max_ratio == null || (r.max_inclusive ? x <= n(r.max_ratio) : x < n(r.max_ratio))));
    if (!row) throw Error('판정 구간 누락: ' + type + ' ' + x);
    return n(row.score_or_penalty);
  }
  function millilitreData(data) {
    const cfg = Object.fromEntries(data.tables.balance_config.map(r => [r.setting, r.value]));
    const factors = {
      ml: 1,
      oz: n(cfg.unit_oz_to_ml, 30),
      tsp: n(cfg.unit_tsp_to_ml, 5)
    };
    const convert = (row, qty, unit) => {
      const factor = factors[row[unit]];
      if (factor == null) return {
        ...row
      };
      const value = row[qty];
      return {
        ...row,
        [qty]: value == null || value === '' ? value : Math.round(n(value) * factor * 1e6) / 1e6,
        [unit]: 'ml'
      };
    };
    // User-approved web recipe (2026-10-18). Keep the imported CSV snapshot
    // intact, but use these ml values everywhere: recipe UI, practice and scoring.
    const martini = {
      gin: 60,
      dry_vermouth: 20
    };
    return {
      ...data,
      tables: {
        ...data.tables,
        cocktails: data.tables.cocktails.map(c => !data.sharedCsv && c.id === 'dry_martini' ? {
          ...c,
          'recipe_desc.ko': '믹싱 글라스에 진 60ml와 드라이 베르무트 20ml를 넣고 스터한 뒤 칵테일 잔에 따른다.',
          'recipe_desc.en': 'Stir 60ml gin with 20ml dry vermouth in a mixing glass, then strain into a cocktail glass.'
        } : !data.sharedCsv && c.id === 'long_island' ? {
          ...c,
          unlock_day: '2'
        } : c),
        recipes: data.tables.recipes.map(r => !data.sharedCsv && r.context === 'dry_martini' && Object.hasOwn(martini, r.ingredient) ? {
          ...r,
          qty: martini[r.ingredient],
          unit: 'ml'
        } : convert(r, 'qty', 'unit')),
        shelf_items: data.tables.shelf_items.map(r => convert(r, 'default_target_qty', 'default_target_unit'))
      }
    };
  }
  function buildQueue(data, selected, actual) {
    const recipe = data.tables.recipes.filter(r => r.context === selected.id),
      items = data.tables.shelf_items;
    let queue = [];
    for (const id of actual.ingredients) {
      const item = items.find(r => r.id === id);
      if (!item) throw Error('없는 재료: ' + id);
      const line = recipe.find(r => r.ingredient === id && !r.auto_apply);
      const type = line?.action || item.default_action;
      if (item.prep_action === 'open') queue.push({
        type: 'open',
        ingredient: id,
        target: null
      });
      if (!type) throw Error('동작 없음: ' + id);
      queue.push({
        type,
        ingredient: id,
        target: n(line?.qty ?? item.default_target_qty),
        unit: line?.unit ?? item.default_target_unit,
        inRecipe: !!line
      });
    }
    if (actual.tool === 'shaker') queue.push({
      type: 'shake',
      ingredient: null
    });
    if (actual.tool === 'mixing_glass') queue.push({
      type: 'stir',
      ingredient: null
    });
    const rank = {
      open: 0,
      pour: 1,
      squeeze: 2,
      powder: 3,
      add: 3,
      shake: 4,
      stir: 4,
      fill_up: 5
    };
    return queue.sort((a, b) => rank[a.type] - rank[b.type]);
  }
  function scoreCraft(data, selected, actual, results, elapsed) {
    const cfg = Object.fromEntries(data.tables.balance_config.map(r => [r.setting, r.value]));
    const recipe = data.tables.recipes.filter(r => r.context === selected.id && !r.auto_apply);
    const expected = [],
      missing = recipe.filter(r => !actual.ingredients.includes(r.ingredient)),
      extra = actual.ingredients.filter(id => !recipe.some(r => r.ingredient === id));
    for (const r of recipe) {
      if (!r.scored || missing.includes(r)) continue;
      if (data.tables.shelf_items.find(i => i.id === r.ingredient)?.prep_action === 'open') expected.push({
        type: 'open',
        ingredient: r.ingredient
      });
      expected.push({
        type: r.action,
        ingredient: r.ingredient,
        target: n(r.qty),
        unit: r.unit
      });
    }
    const mix = selected.target_mix_method || selected.mix;
    if (['shake', 'stir'].includes(mix)) expected.push({
      type: mix,
      ingredient: null
    });
    const buckets = {};
    for (const r of expected) {
      const a = results.find(x => x.type === r.type && x.ingredient === r.ingredient);
      let score = 0;
      if (a) {
        if (r.type === 'open') score = a.completed ? 100 : 0;else if (['shake', 'stir'].includes(r.type)) score = clamp(n(a.completion) * 100, 0, 100);else {
          if (r.target <= 0 || !Number.isFinite(a.value)) throw Error('목표/결과 수량 누락: ' + r.ingredient);
          score = band(data.tables.score_bands, 'quantity', Math.abs(a.value - r.target) / r.target);
        }
      }
      const family = r.type === 'fill_up' ? 'pour' : r.type;
      (buckets[family] ??= []).push(score);
    }
    let weightedSum = 0,
      totalWeight = 0;
    const representatives = [];
    for (const [family, values] of Object.entries(buckets)) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length,
        weight = n(cfg['weight_' + family]);
      weightedSum += mean * weight;
      totalWeight += weight;
      representatives.push({
        family,
        mean,
        weight,
        count: values.length
      });
    }
    const representativeScore = totalWeight ? weightedSum / totalWeight : 100;
    const targetTool = mix === 'shake' ? 'shaker' : mix === 'stir' ? 'mixing_glass' : null;
    const penalties = {
      gimmick: 100 - representativeScore,
      glass: actual.glass !== selected.glass ? n(cfg.glass_mismatch_penalty) : 0,
      tool: (actual.tool || null) !== targetTool ? n(cfg.tool_mismatch_penalty) : 0,
      missing: missing.length * n(cfg.missing_ingredient_penalty),
      extra: extra.length * n(cfg.extra_ingredient_penalty),
      overtime: band(data.tables.score_bands, 'overtime', Math.max(0, elapsed - n(selected.time_limit_sec)) / Math.max(1, n(selected.time_limit_sec)))
    };
    const score = clamp(100 - Object.values(penalties).reduce((a, b) => a + b, 0), 0, 100);
    const grade = [...data.tables.grade_cuts].sort((a, b) => n(b.min_pct) - n(a.min_pct)).find(g => score >= n(g.min_pct))?.grade || 'sewage';
    return {
      score,
      grade,
      penalties,
      representatives,
      missingCore: missing.filter(r => r.is_core).map(r => r.ingredient),
      missing: missing.map(r => r.ingredient),
      extra,
      elapsed,
      selected: selected.id,
      actual: structuredClone(actual),
      results: structuredClone(results)
    };
  }
    return { band, millilitreData, buildQueue, scoreCraft };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaRuleParts ||= {}).craft = create;
})(typeof window === 'undefined' ? globalThis : window);
