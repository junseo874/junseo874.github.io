(function (root) {
  'use strict';

  const POUR = typeof module === 'undefined' ? root.LunaPour : require('../features/crafting/pour-fluid.js');
  const GRADES = ['sewage', 'poor', 'decent', 'good', 'excellent'];
  // Web-only typing baseline; keep source timings, read holds, patience and animation clocks unchanged.
  const TEXT_SPEED_BASE = 3;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const n = (v, d = 0) => v == null || v === '' ? d : Number(v);
  const sortSeq = a => [...a].sort((a, b) => n(a.seq) - n(b.seq));
  const clean = s => String(s ?? '').replace(/<[^>]*>/g, '');
  // Engine input/animation contract, inspected against Play.unity's NEW prefabs.
  // The web board normalizes the 960x540 (PPU100 / ortho2.7) craft view; see README.
  const OPEN = {
    init(s) {
      if (s.type !== 'open') return;
      Object.assign(s, {
        openPhase: 'ready',
        powerPos: 0,
        powerDirection: 1,
        powerPerfect: false,
        roundMisses: 0,
        openDelay: 0
      });
    },
    fail(s, offset = 0) {
      s.failures++;
      s.roundMisses++;
      s.beatTime = 0;
      this.hit(s, false, offset);
      s.message = '다시 타이밍을 맞춰 주세요';
      if (s.roundMisses >= 3) {
        s.openPhase = 'broken';
        s.openDelay = 1.2;
        s.message = '병이 깨졌어요 · 다시 시도';
      } else if (s.openPhase === 'power') s.powerPos = 0;
    },
    press(s) {
      if (s.completed || ['broken', 'power-done'].includes(s.openPhase)) return false;
      if (!s.started || s.openPhase === 'ready') {
        s.started = true;
        s.openPhase = 'power';
        s.powerPos = 0;
        s.message = '초록 구간에서 힘을 맞춰 주세요';
        return true;
      }
      if (s.openPhase === 'power') {
        const d = Math.abs(s.powerPos - .78);
        if (d <= .152) {
          s.powerPerfect = d <= .08;
          s.openPhase = 'power-done';
          s.openDelay = .45;
          s.message = '힘 조절 성공 · 다음은 링 타이밍';
        } else this.fail(s, s.powerPos - .78);
        return true;
      }
      const error = s.beatTime - 1.1;
      if (Math.abs(error) <= .14) {
        s.completed = true;
        s.openPhase = 'pop';
        s.message = 'OPEN';
        this.hit(s, true, error, .2167);
        s.openFx.perfect = s.powerPerfect && Math.abs(error) <= .065;
      } else this.fail(s, error);
      return true;
    },
    tick(s, dt) {
      if (s.openPhase === 'power') {
        s.powerPos += s.powerDirection * 1.1 * dt;
        if (s.powerPos >= 1) {
          s.powerPos = 1;
          s.powerDirection = -1;
        }
        if (s.powerPos <= 0) {
          s.powerPos = 0;
          s.powerDirection = 1;
        }
      } else if (s.openPhase === 'power-done' || s.openPhase === 'broken') {
        s.openDelay -= dt;
        if (s.openDelay <= 0) {
          if (s.openPhase === 'broken') {
            s.roundMisses = 0;
            s.openPhase = 'power';
            s.powerPos = 0;
            s.message = '초록 구간에서 다시 시작';
          } else {
            s.openPhase = 'rhythm';
            s.beatTime = 0;
            s.message = '원이 링에 겹칠 때 누르세요';
          }
        }
      } else if (s.openPhase === 'rhythm') {
        s.beatTime += dt;
        if (s.beatTime > 1.24) this.fail(s, s.beatTime - 1.1);
      }
    },
    minigameHoldSec: 4.1,
    // Allow 450ms delay + 3.5s fizz and a small render margin.
    carbonationSec: 2.05,
    // Let the rising bottle bubble cluster finish before the next step.
    hit(s, ok, offset = 0, window = 10) {
      s.openFx = {
        kind: ok ? 'success' : 'miss',
        perfect: ok && Math.abs(offset) <= window * .3 + 1e-8,
        offset,
        age: 0,
        serial: (s.openFx?.serial || 0) + 1
      };
    },
    visual(s, dt) {
      if (s.type === 'open' && s.openFx) s.openFx.age = Math.min(OPEN.minigameHoldSec, s.openFx.age + dt);
    }
  };
  const MIX = {
    shakeTargetStacks: 20,
    completionHoldSec: .9,
    // Web playtest tuning; source CSV and stir counts remain unchanged.
    points: [[0, 0], [2.61, 1.206875], [0, 2.56], [2.61, 3.766875]],
    route: [0, 1, 2, 3, 2, 1],
    patterns: [[[0, .37], [2, .47]], [[0, .28], [0, .38], [1, .38], [2, .49], [2, .56]], [[0, .39], [0, .57], [1, .32], [1, .48], [2, .55], [2, .82]], [[0, .28], [1, .32], [2, .55]]],
    radius: .25,
    delay: .1,
    frameSeconds: .125,
    stirFrameSeconds: 1 / 12,
    shakeClips: [[1, 2, 3, 0], [5, 6, 7, 4]],
    init(s) {
      if (!['shake', 'stir'].includes(s.type)) return;
      s.shakeEffects = [];
      s.motionFrame = 0;
      s.motionAge = null;
      s.motionClip = 0;
      s.nextMotionClip = 0;
      s.feedbackLeft = 0;
      s.hitEffect = null;
      s.beatIndex = -1;
      s.pathPoint = [...this.points[0]];
      s.patternIndex = -1;
      s.patternTurn = -1;
      s.nodes = [];
      s.pathFixedHits = [];
      s.attemptStartPos = 0;
      s.spoonAngle = 0;
      s.spoonTarget = 0;
      s.swirlSpeed = 0;
      s.stirMotionPending = 0;
      s.stirMotionClock = 0;
      const layout = [[-28.49, 22.33, 41.58, .9], [30.03, 19.25, 38.2536, -.75], [-.77, -31.57, 34.9272, .65], [-30.03, -20.79, 27.442802, -.85], [31.57, -26.95, 29.106, .6], [3.85, 37.73, 24.1164, -.62]];
      s.ice = layout.map(([x, y, size, factor], i) => ({
        x,
        y,
        size,
        factor,
        spin: 0,
        sideSpin: 0,
        rest: Math.min(Math.hypot(x, y), 72.5 - size * .5),
        sideY: [28.2, 29.208, 30.216, 32.484, 31.98, 33.492][i]
      }));
      s.iceAverage = s.ice.reduce((n, c) => n + Math.hypot(c.x, c.y), 0) / s.ice.length;
      s.iceRadius = Math.max(...s.ice.map(c => Math.hypot(c.x, c.y)));
      this.resolveIce(s, 0);
    },
    resolveIce(s, dt) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < s.ice.length; i++) for (let j = i + 1; j < s.ice.length; j++) {
          const a = s.ice[i],
            b = s.ice[j],
            dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy),
            min = (a.size + b.size) * .5;
          if (d >= min) continue;
          const nx = d > .0001 ? dx / d : 1,
            ny = d > .0001 ? dy / d : 0,
            push = (min - d) * .5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
        for (const c of s.ice) {
          const r = Math.hypot(c.x, c.y),
            limit = 72.5 - c.size * .5;
          if (r > limit) {
            c.x *= limit / r;
            c.y *= limit / r;
          }
        }
      }
      if (dt > 0) for (const c of s.ice) {
        const r = Math.hypot(c.x, c.y);
        if (r > .0001) {
          const f = (r + (c.rest - r) * (1 - Math.exp(-4 * dt))) / r;
          c.x *= f;
          c.y *= f;
        }
      }
    },
    visual(s, dt) {
      if (!['shake', 'stir'].includes(s.type)) return;
      s.feedbackLeft = Math.max(0, s.feedbackLeft - dt);
      if (s.hitEffect) {
        s.hitEffect.age += dt;
        if (s.hitEffect.age >= .5) s.hitEffect = null;
      }
      if (s.type === 'shake') {
        s.shakeEffects = s.shakeEffects.filter(e => (e.age += dt) < .55);
        if (s.rhythm) {
          root.LunaShakeRhythm.visual(s, dt);
          return;
        }
        if (s.motionAge !== null) {
          s.motionAge += dt;
          s.motionFrame = this.shakeClips[s.motionClip][Math.min(3, Math.floor(s.motionAge / this.frameSeconds))];
        }
        return;
      }
      s.spoonAngle += (s.spoonTarget - s.spoonAngle) * (1 - Math.exp(-10 * dt));
      if (Math.abs(s.spoonTarget - s.spoonAngle) < .01) s.spoonAngle = s.spoonTarget;
      // Correct inputs fund a short 12 FPS hand gesture. Preserve its phase across inputs;
      // never quantize the exponentially eased spoon angle or accumulate a long autoplay tail.
      if (s.stirMotionPending) {
        s.stirMotionClock += dt;
        while (s.stirMotionPending && s.stirMotionClock + 1e-9 >= this.stirFrameSeconds) {
          s.stirMotionClock = Math.max(0, s.stirMotionClock - this.stirFrameSeconds);
          s.motionFrame = (s.motionFrame + 1) % 6;
          s.stirMotionPending--;
        }
        if (!s.stirMotionPending) s.stirMotionClock = 0;
      }
      s.swirlSpeed *= Math.exp(-1.2 * dt);
      if (s.swirlSpeed < .05) s.swirlSpeed = 0;
      if (!s.swirlSpeed) return;
      for (const c of s.ice) {
        const radius = Math.hypot(c.x, c.y),
          factor = radius <= .01 ? 1.35 : clamp((s.iceAverage / radius) ** .8, 1 / 1.35, 1.35),
          rad = -s.swirlSpeed * factor * dt * Math.PI / 180;
        const x = c.x * Math.cos(rad) - c.y * Math.sin(rad);
        c.y = c.x * Math.sin(rad) + c.y * Math.cos(rad);
        c.x = x;
        c.spin -= s.swirlSpeed * c.factor * dt;
        c.sideSpin -= s.swirlSpeed * c.factor * dt;
      }
      this.resolveIce(s, dt);
    },
    updatePath(s, rng) {
      const beats = Math.max(0, s.elapsed - this.delay),
        index = Math.floor(beats),
        t = beats - index;
      s.beatTime = t;
      s.beatIndex = index;
      const turn = Math.floor(index / 3);
      if (s.elapsed >= this.delay && turn !== s.patternTurn) {
        s.patternTurn = turn;
        if (turn % 2 === 0 || s.patternIndex < 0) s.patternIndex = Math.floor(rng() * this.patterns.length);
        const down = turn % 2 === 0;
        s.nodes = this.patterns[s.patternIndex].map(([line, f], i) => {
          const from = down ? line : 3 - line,
            to = down ? from + 1 : from - 1,
            a = this.points[from],
            b = this.points[to];
          return {
            id: turn + ':' + i,
            x: a[0] + (b[0] - a[0]) * f,
            y: a[1] + (b[1] - a[1]) * f,
            born: s.elapsed
          };
        });
      }
      s.nodes = s.nodes.filter(n => s.elapsed - n.born < 10);
      const a = this.points[this.route[index % 6]],
        b = this.points[this.route[(index + 1) % 6]];
      // Serialized ease=1 (Linear), not the C# field's default InOutQuad.
      s.pathPoint = s.elapsed < this.delay ? [...this.points[0]] : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      // A fixed node rearms only after the marker has left its hit area.
      s.pathFixedHits = (s.pathFixedHits || []).filter(id => {
        const [x, y] = this.points[Number(id.split(':')[1])];
        return Math.hypot(x - s.pathPoint[0], y - s.pathPoint[1]) <= this.radius;
      });
    },
    nearest(s) {
      const candidates = [...s.nodes, ...this.points.map(([x, y], i) => ({
        id: 'fixed:' + i,
        x,
        y,
        fixed: true
      }))];
      return candidates.filter(n => !n.fixed || !(s.pathFixedHits || []).includes(n.id)).map(n => ({
        ...n,
        distance: Math.hypot(n.x - s.pathPoint[0], n.y - s.pathPoint[1])
      })).filter(n => n.distance <= this.radius).sort((a, b) => a.distance - b.distance)[0] || null;
    },
    consumePathNode(s, node) {
      if (!node) return;
      if (node.fixed) {
        s.pathFixedHits ||= [];
        if (!s.pathFixedHits.includes(node.id)) s.pathFixedHits.push(node.id);
      } else s.nodes = s.nodes.filter(n => n.id !== node.id);
    },
    shakeHit(s) {
      const node = this.nearest(s),
        ok = !!node;
      this.consumePathNode(s, node);
      s.attempts++;
      s.success += ok ? 1 : 0;
      s.failures += ok ? 0 : 1;
      s.outcomes.push(ok);
      s.hit = true;
      s.beatSuccess = ok;
      s.message = ok ? 'GOOD' : 'MISS';
      s.feedbackLeft = .35;
      s.hitEffect = {
        x: node?.x ?? s.pathPoint[0],
        y: node?.y ?? s.pathPoint[1],
        ok,
        age: 0
      };
      if (ok) {
        s.motionClip = s.nextMotionClip;
        s.nextMotionClip = 1 - s.nextMotionClip;
        s.motionAge = 0;
        s.motionFrame = this.shakeClips[s.motionClip][0];
      }
      s.shakeEffects.push({
        ...s.hitEffect,
        id: s.attempts
      });
      if (s.shakeEffects.length > 12) s.shakeEffects.shift();
      if (s.attempts >= s.targetStacks) s.completed = true;
      return ok;
    }
  };
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(1664525, s) + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  function weighted(rows, rng) {
    let sum = rows.reduce((a, r) => a + n(r.weight, 1), 0),
      x = rng() * sum;
    for (const r of rows) {
      x -= n(r.weight, 1);
      if (x <= 0) return r;
    }
    return rows.at(-1);
  }
  function contextValue(key, c) {
    if (key === 'true') return true;
    if (key === 'false') return false;
    if (/^[-+]?\d+(\.\d+)?$/.test(key)) return Number(key);
    if (/^(['"]).*\1$/.test(key)) return key.slice(1, -1);
    if (GRADES.includes(key)) return GRADES.indexOf(key);
    if (key.startsWith('flag.')) return c.flags[key.slice(5)] ?? false;
    if (key.startsWith('affinity.')) return c.affinity[key.slice(9)] ?? 0;
    if (['day', 'money', 'phase', 'reputation'].includes(key)) return c[key] ?? 0;
    if (['grade', 'final_grade', 'craft_grade', 'order_match'].includes(key)) {
      if (c[key] == null) throw Error('결과 문맥 없음: ' + key);
      return key === 'order_match' ? c[key] : GRADES.indexOf(c[key]);
    }
    if (key === 'cocktail.id') return c.cocktail?.id;
    if (key === 'cocktail.abv') return n(c.cocktail?.abv);
    if (key === 'ordered_cocktail.id') return c.ordered;
    if (key === 'served_cocktail.id') return c.served;
    const tag = key.match(/^cocktail\.tag\((.+)\)$/);
    if (tag) return (c.tags || []).includes(tag[1]);
    if (/^[A-Za-z가-힣_][\w가-힣-]*$/.test(key)) return key;
    throw Error('지원하지 않는 조건 값: ' + key);
  }
  function condition(expr, c) {
    if (!expr) return true;
    if (expr.includes('||')) throw Error('지원하지 않는 OR 조건: ' + expr);
    return expr.split('&&').every(raw => {
      const s = raw.trim();
      const m = s.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
      if (m) {
        const a = contextValue(m[1].trim(), c),
          b = contextValue(m[3].trim(), c);
        return {
          '==': () => a === b,
          '!=': () => a !== b,
          '>=': () => a >= b,
          '<=': () => a <= b,
          '>': () => a > b,
          '<': () => a < b
        }[m[2]]();
      }
      return s.startsWith('!') ? !contextValue(s.slice(1), c) : !!contextValue(s, c);
    });
  }
  function applyEffects(expr, state) {
    if (!expr) return;
    const before = {
        flags: state.flags,
        affinity: state.affinity
      },
      next = {
        ...state,
        flags: {
          ...state.flags
        },
        affinity: {
          ...state.affinity
        }
      };
    for (const raw of expr.split(';').filter(s => s.trim())) {
      const m = raw.trim().match(/^(flag\.[\w]+|affinity\.[\w]+|money|reputation)\s*(\+=|-=|=)\s*(true|false|[-+]?\d+(?:\.\d+)?)$/);
      if (!m) throw Error('상태 변경 해석 실패: ' + raw);
      const [_, key, op, value] = m;
      const v = value === 'true' ? true : value === 'false' ? false : Number(value);
      let obj = next,
        k = key;
      if (key.startsWith('flag.')) {
        obj = next.flags;
        k = key.slice(5);
      }
      if (key.startsWith('affinity.')) {
        obj = next.affinity;
        k = key.slice(9);
      }
      if (key.startsWith('flag.') && (typeof v !== 'boolean' || op !== '=')) throw Error('플래그에는 true/false 대입만 허용');
      obj[k] = op === '=' ? v : n(obj[k]) + (op === '+=' ? 1 : -1) * v;
    }
    Object.assign(state, next);
    root.LunaStoryNotices?.effects(state, before);
  }
  function band(rows, type, x) {
    // Unit conversion must not move an exact boundary across a score band via floating-point noise.
    x = Math.round(x * 1e12) / 1e12;
    const row = rows.find(r => r.band_type === type && (r.min_ratio == null || (r.min_inclusive ? x >= n(r.min_ratio) : x > n(r.min_ratio))) && (r.max_ratio == null || (r.max_inclusive ? x <= n(r.max_ratio) : x < n(r.max_ratio))));
    if (!row) throw Error('판정 구간 누락: ' + type + ' ' + x);
    return n(row.score_or_penalty);
  }
  // Convert a web-only copy once, so recipes, default pours, queues and scoring agree.
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
  class Game {
    constructor(data, options = {}) {
      this.data = data;
      this.t = data.tables;
      this.cfg = Object.fromEntries(this.t.balance_config.map(r => [r.setting, r.value]));
      this.cfg.stir_circle_limit_sec = 1.5; /* Web playtest tuning; source CSV unchanged. */
      this.onChange = () => {};
      this.lang = 'ko';
      this.speed = 1;
      this.dialogSpeed = 1;
      this.read = new Set();
      this.reset(options.day ?? 0, options.mode ?? 'full', options.seed ?? 1, false);
    }
    c(key, fallback = 0) {
      return n(this.cfg[key], fallback);
    }
    text(row, key = 'text') {
      return row?.[key + '.' + this.lang] || row?.[key + '.ko'] || '';
    }
    cocktail(id) {
      const c = this.t.cocktails.find(c => c.id === id);
      if (!c) throw Error('칵테일 없음: ' + id);
      return c;
    }
    name(id) {
      const r = this.t.characters.find(x => x.id === id) || this.t.cocktails.find(x => x.id === id) || this.t.shelf_items.find(x => x.id === id) || this.t.personalities.find(x => x.id === id);
      return this.text(r, 'name') || id || '';
    }
    reset(day = 0, mode = 'full', seed = 1, run = true, settings = {}) {
      const upkeepOverride = this.parseUpkeepOverride(settings.upkeepOverride);
      this.serviceVersion = 'A';
      this.qaKeepGeneral = false;
      this.day = Number(day);
      this.mode = mode;
      this.seed = Number(seed);
      this.rng = seeded(this.seed);
      // Seat arrivals vary between plays, independently of reproducible order/art RNG.
      this.seatRng = settings.seatRng || Math.random;
      this.progress = {
        day: this.day,
        money: this.c('gold_start', 300),
        reputation: 0,
        phase: 'bar_open',
        flags: {},
        affinity: {}
      };
      this.openingBalance = this.progress.money;
      this.upkeepOverride = upkeepOverride;
      this.dailySettlement = null;
      this.tableFades = {};
      this.pourTool = 'pourer';
      this.tutorial = null;
      this.storyCoaster = null;
      this.pendingDailyUnlocks = false;
      this.lastStoryLine = null;
      this.craftReminder = null;
      this.phase = 'ready';
      this.screen = 'bar';
      this.overlay = null;
      this.paused = false;
      this.hidden = false;
      this.cameraLeft = 0;
      this.cameraMoving = false;
      this.focus = 'L';
      this.overview = false;
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.logs = [];
      this.history = [];
      this.transactions = [];
      this.transactionIds = new Set();
      this.serial = 0;
      this.barTime = 0;
      this.realTime = 0;
      this.served = 0;
      this.lost = 0;
      this.prep = null;
      this.drink = null;
      this.gimmick = null;
      this.result = null;
      this.discardFeedback = null;
      this.error = null;
      this.dialogue = null;
      this.choice = null;
      this.transition = 0;
      this.pendingTransition = null;
      this.story = null;
      this.currentOrder = null;
      this.resultContext = {};
      this.effectVisual = null;
      this.barkLast = {};
      this.finished = false;
      if (settings.storyPrerequisites) this.seedJohnnyPrerequisites();
      if (run) {
        if (mode === 'general') this.startGeneral();else if (mode === 'regular') this.startStoryPhase('bar');else if (mode === 'practice') {
          this.phase = 'practice';
          this.openRecipes();
        } else {
          const fresh = this.dailyUnlocks();
          if (mode === 'full' && this.day > 0 && this.day !== 99 && (fresh.ingredients.length || fresh.cocktails.length)) {
            this.pendingDailyUnlocks = true;
            this.phase = 'arrival';
            this.overlay = 'dailyUnlocks';
          } else this.startStoryPhase('bar_open');
        }
      }
      this.changed();
    }
    log(event, details = {}) {
      this.logs.push({
        time: Math.round(this.realTime * 100) / 100,
        barTime: Math.round(this.barTime * 100) / 100,
        event,
        ...details
      });
      if (this.logs.length > 5000) this.logs.shift();
    }
    changed() {
      this.onChange(this);
    }
    clearDepartedSeat(seat) {
      const guest = this.seats[seat];
      if (guest && (guest.coaster || guest.glass)) this.tableFades[seat] = {
        coaster: guest.coaster,
        glass: guest.glass,
        glassEmpty: guest.glassEmpty,
        glassKind: guest.glassKind,
        baseline: this.phase === 'general' ? 548 : 560,
        elapsed: 0,
        duration: .8
      };
      this.seats[seat] = null;
      return this.tableFades[seat]?.duration || 0;
    }
    ctx(extra = {}) {
      return {
        ...this.progress,
        ...this.resultContext,
        ...extra
      };
    }
    safe(fn) {
      try {
        return fn();
      } catch (e) {
        this.error = e.message;
        this.log('DATA_ERROR', {
          message: e.message
        });
        this.changed();
        return false;
      }
    }
    isPaused() {
      return this.paused || this.hidden || !!this.error || !!this.overlay;
    }
    available(c) {
      return this.day === 99 || n(c.unlock_day) <= this.day && condition(c.unlock_when, this.ctx());
    }
    cocktailsAvailable() {
      return this.t.cocktails.filter(c => c.status === 'confirmed' && (this.available(c) || c.id !== 'johnny_old_fashioned' && this.currentOrder?.cocktail === c.id));
    }
    itemsAvailable() {
      const needed = this.currentOrder ? this.t.recipes.filter(r => r.context === this.currentOrder.cocktail).map(r => r.ingredient) : [];
      return this.t.shelf_items.filter(r => this.available(r) || !['wild_dog', 'bitters', 'sugar_cube'].includes(r.id) && needed.includes(r.id));
    }
    // Possession is a story prerequisite, not a consumable bottle count per craft.
    seedJohnnyPrerequisites() {
      if (this.day < 3 || this.day === 99) return;
      this.progress.inventory = {
        ...this.progress.inventory,
        wild_dog: Math.max(1, Number(this.progress.inventory?.wild_dog) || 0),
        bitters: Math.max(1, Number(this.progress.inventory?.bitters) || 0)
      };
      this.progress.flags.campaign_observation = true;
    }
    johnnyMissing({
      memory = true,
      sugar = false
    } = {}) {
      const missing = ['wild_dog', 'bitters'].filter(id => !(Number(this.progress.inventory?.[id]) > 0));
      if (memory && !this.progress.flags.campaign_observation) missing.push('johnny_memory');
      if (sugar && !this.progress.flags.day3_sugar_received) missing.push('sugar_cube');
      return missing;
    }
    checkJohnnyUnlock() {
      if (this.day !== 3 || this.progress.flags.johnny_recipe_unlocked || this.johnnyMissing({
        sugar: true
      }).length) return false;
      this.progress.inventory ||= {};
      this.progress.inventory.sugar_cube = Math.max(1, Number(this.progress.inventory.sugar_cube) || 0);
      this.progress.flags.johnny_recipe_unlocked = true;
      this.overlay = 'johnnyUnlock';
      this.log('recipe_unlocked', {
        cocktail: 'johnny_old_fashioned',
        ingredients: ['wild_dog', 'bitters', 'sugar_cube']
      });
      this.changed();
      return true;
    }
    confirmJohnnyUnlock() {
      if (this.overlay !== 'johnnyUnlock') return false;
      this.overlay = null;
      this.pump();
      this.changed();
      return true;
    }
    dailyUnlocks() {
      return {
        ingredients: this.t.shelf_items.filter(r => r.kind === 'ingredient' && n(r.unlock_day) === this.day && !['wild_dog', 'bitters', 'sugar_cube'].includes(r.id) && this.available(r)),
        cocktails: this.t.cocktails.filter(r => r.status === 'confirmed' && n(r.unlock_day) === this.day && r.id !== 'johnny_old_fashioned' && this.available(r))
      };
    }
    confirmDailyUnlocks() {
      if (!this.pendingDailyUnlocks || this.overlay !== 'dailyUnlocks') return false;
      this.pendingDailyUnlocks = false;
      this.overlay = null;
      this.startStoryPhase('bar_open');
      this.changed();
      return true;
    }
    startStoryPhase(phase) {
      this.storyCoaster = null;
      this.phase = phase === 'bar_open' ? 'opening' : 'regular';
      this.progress.phase = phase;
      this.screen = 'bar';
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.dialogue = null;
      this.choice = null;
      this.resultContext = {};
      this.currentOrder = null;
      this.story = {
        phase,
        autos: sortSeq(this.t.scenes.filter(s => n(s.day) === this.day && s.phase === phase && s.trigger === 'auto')),
        cursor: 0,
        scene: null,
        index: 0,
        steps: []
      };
      this.log('phase_start', {
        phase: this.phase
      });
      this.nextScene();
    }
    nextScene() {
      this.resultContext = {};
      this.dialogue = null;
      this.choice = null;
      while (this.story.cursor < this.story.autos.length) {
        const s = this.story.autos[this.story.cursor++];
        if (!condition(s.when, this.ctx())) continue;
        this.loadScene(s);
        return;
      }
      if (this.phase === 'opening') {
        this.story = null;
        this.startGeneral();
      } else {
        if (this.currentOrder) throw Error('미처리 주문 상태에서 대본 종료');
        this.finishDay();
      }
    }
    loadScene(scene) {
      this.storyCoaster = null;
      this.lastStoryLine = null;
      this.craftReminder = null;
      this.story.scene = scene;
      this.story.steps = sortSeq(this.t.steps.filter(s => s.context === scene.id));
      this.story.index = 0;
      this.resultContext = {};
      this.log('scene', {
        id: scene.id
      });
      this.pump();
    }
    stepDone(step) {
      applyEffects(step.effects, this.progress);
      this.story.index++;
      if (!this.checkJohnnyUnlock()) this.pump();
    }
    pump() {
      for (let guard = 0; guard < 1000; guard++) {
        if (!this.story || this.storyCoaster || this.error || this.tutorial || this.overlay === 'johnnyUnlock') return;
        const s = this.story.steps[this.story.index];
        if (!s) {
          this.nextScene();
          return;
        }
        if (!condition(s.when, this.ctx())) {
          this.log('step_skipped', {
            scene: this.story.scene.id,
            seq: s.seq,
            when: s.when
          });
          this.story.index++;
          continue;
        }
        this.log('step', {
          scene: this.story.scene.id,
          seq: s.seq,
          type: s.type
        });
        if (s.type === 'story_cue') {
          this.onStoryCue?.(s.arg);
          this.log('story_cue', {
            kind: s.arg
          });
          this.setTransition(s.arg === 'door' ? .9 : .35, () => this.stepDone(s));
          return;
        }
        if (this.campaignStep?.(s)) return;
        if (s.type === 'say' || s.type === 'order' && this.text(s)) {
          this.dialogue = this.makeLine(s.actor, this.text(s), s.dialogue_id, s.arg);
          this.dialogue.step = s;
          root.LunaStoryNotices?.dialogueStarted(this.progress, this.dialogue);
          if (this.storyCoasterEligible(s.actor)) {
            const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor && !this.seats[k].coaster);
            if (seat) this.storyCoaster = {
              seat,
              step: s,
              kind: 'line'
            };
          }
          return;
        }
        if (s.type === 'order') {
          if (this.waitForStoryCoaster(s, 'step')) return;
          this.createStoryOrder(s);
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'enter') {
          const first = this.story.index,
            group = [s];
          if (s.sync === 'no_wait') {
            const next = this.story.steps[first + 1];
            if (!next || next.type !== 'enter' || next.sync !== 'wait') throw Error('동시 입장 쌍 오류');
            group.push(next);
          }
          const reserved = new Set(Object.keys(this.seats).filter(k => this.seats[k]));
          for (const e of group) {
            if (!['L', 'R'].includes(e.arg) || reserved.has(e.arg)) throw Error('단골 좌석 충돌: ' + e.actor + ' / ' + e.arg);
            reserved.add(e.arg);
          }
          for (const e of group) {
            this.seats[e.arg] = {
              id: e.actor,
              actor: e.actor,
              seated: e.entrance === 'seated',
              state: 'STORY',
              coaster: false,
              glass: null,
              expression: 'default'
            };
            if (root.LunaStoryNotices?.roster.includes(e.actor)) root.LunaStoryNotices.meet(this.progress, e.actor);else this.progress.flags[e.actor + '_met'] = true;
            applyEffects(e.effects, this.progress);
          }
          this.focus = s.arg;
          this.story.index += group.length;
          if (group.every(e => e.entrance === 'seated')) continue;
          this.setTransition(0.8, () => this.pump());
          return;
        }
        if (s.type === 'exit') {
          const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
          if (!seat) throw Error('퇴장 대상 없음: ' + s.actor);
          this.seats[seat].state = 'EXITING';
          this.setTransition(0.5, () => {
            const fade = this.clearDepartedSeat(seat);
            if (fade) this.setTransition(fade, () => this.stepDone(s));else this.stepDone(s);
          });
          return;
        }
        if (s.type === 'tutorial') {
          if (this.day === 0 && this.variant !== 'gpt' && !this.progress.flags.day0_skip_tutorial) {
            this.progress.flags.day0_seats_revealed = true;
            this.tutorial = {
              kind: s.arg,
              step: s,
              origin: this.focus,
              visited: [],
              moved: false
            };
            this.log('tutorial_wait', {
              kind: s.arg
            });
            this.changed();
            return;
          }
          this.stepDone(s);
          return;
        }
        if (s.type === 'coaster') {
          if (!this.storyHasUpcomingOrder(s.actor)) {
            this.stepDone(s);
            return;
          }
          if (this.waitForStoryCoaster(s, 'step')) return;
          const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
          if (!seat) throw Error('코스터 대상 없음: ' + s.actor);
          if (this.seats[seat].coaster) {
            this.stepDone(s);
            return;
          }
          if (s.arg === 'tutorial' && this.day === 0 && !this.progress.flags.day0_skip_tutorial) {
            this.tutorial = {
              kind: 'coaster',
              seat,
              step: s
            };
            this.log('tutorial_wait', {
              kind: 'coaster',
              seat
            });
            return;
          }
          this.seats[seat].coaster = true;
          this.log('story_coaster', {
            actor: s.actor,
            seat
          });
          this.setTransition(.45, () => this.stepDone(s));
          return;
        }
        if (s.type === 'choice') {
          const rows = sortSeq(this.t.bar_choices.filter(c => c.context === s.arg));
          if (!rows.length) throw Error('선택지 세트 없음: ' + s.arg);
          this.choice = {
            step: s,
            rows
          };
          return;
        }
        if (s.type === 'craft') {
          if (!this.currentOrder) throw Error('제조 전 주문 없음');
          this.screen = 'bar';
          this.craftReminder = this.lastStoryLine ? {
            ...this.lastStoryLine,
            chars: this.lastStoryLine.text.length
          } : null;
          this.craftStep = s;
          if (s.arg === 'tutorial_beer' && this.day === 1) {
            this.tutorial = {
              kind: 'recipe',
              beer: true,
              serviceOpened: false
            };
            this.log('tutorial_wait', {
              kind: 'beer'
            });
          }
          if (s.arg === 'tutorial_recipe' && this.day === 0 && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_recipe_taught) {
            this.tutorial = {
              kind: 'recipe',
              serviceOpened: false
            };
            this.log('tutorial_wait', {
              kind: 'recipe'
            });
          }
          return;
        }
        if (s.type === 'serve') {
          throw Error('제조 결과/서빙 입력 없이 serve에 도착');
        }
        if (s.type === 'effect' || s.type === 'set_state') {
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'fx' || s.type === 'sfx') {
          const duration = s.arg === 'hard_cut' ? 0.2 : 0.7;
          this.effectVisual = {
            kind: s.type,
            id: s.arg,
            until: this.realTime + duration
          };
          this.log('effect_preview', {
            type: s.type,
            id: s.arg,
            dummy: true
          });
          if (s.sync === 'wait') {
            this.setTransition(duration, () => this.stepDone(s));
            return;
          }
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'end_part') {
          if (this.currentOrder) throw Error('end_part 앞 미처리 주문');
          this.finishDay();
          return;
        }
        throw Error('미지원 바 스텝: ' + s.type);
      }
      throw Error('대본 무한 진행 차단');
    }
    // Only guests ordering during this visit need a coaster. Do not look past
    // their departure/re-entry or an unresolved choice into a different visit.
    storyHasUpcomingOrder(actor, index = this.story?.index) {
      for (const s of this.story?.steps.slice(index) || []) {
        if (!['choice', 'end_part'].includes(s.type) && (s.actor !== actor || !['enter', 'exit', 'order'].includes(s.type))) continue;
        // A future result/branch is not known yet; defer the gate until it resolves.
        try {
          if (!condition(s.when, this.ctx())) continue;
        } catch {
          return false;
        }
        if (s.type === 'choice' || s.type === 'end_part' || s.actor === actor && ['exit', 'enter'].includes(s.type)) return false;
        if (s.actor === actor && s.type === 'order') return true;
      }
      return false;
    }
    storyCoasterEligible(actor, index = this.story?.index) {
      return this.phase === 'regular' && this.storyHasUpcomingOrder(actor, index) && !(this.day === 0 && actor === 'chris' && !this.progress.flags.day0_skip_tutorial && this.story?.steps.some(s => s.type === 'coaster' && s.arg === 'tutorial'));
    }
    waitForStoryCoaster(step, kind) {
      if (!this.storyCoasterEligible(step.actor)) return false;
      const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === step.actor && !this.seats[k].coaster);
      if (!seat) return false;
      this.storyCoaster = {
        seat,
        step,
        kind
      };
      this.focus = seat;
      this.changed();
      return true;
    }
    storyCoasterReady() {
      return !!this.storyCoaster && (this.storyCoaster.kind !== 'line' || this.dialogue?.step === this.storyCoaster.step && this.dialogue.chars >= this.dialogue.text.length);
    }
    setTransition(sec, fn) {
      this.dialogue = null;
      this.transition = sec;
      this.pendingTransition = fn;
    }
    speakerName(actor) {
      return actor === 'tom' && this.day === 1 && this.phase === 'regular' && !this.progress.flags.tom_name_known ? '???' : this.name(actor);
    }
    makeLine(actor, text, id = null, expression = 'default') {
      const timings = [],
        speedStack = [this.c('typing_interval_ms', 50)];
      for (const part of String(text).split(/(<\/?[a-z]+>)/g)) {
        const tag = part.match(/^<(\/?)([a-z]+)>$/);
        if (tag) {
          const rule = this.t.text_tags.find(t => t.tag === tag[2] && t.kind === 'speed_ms');
          if (rule) {
            if (tag[1] && speedStack.length > 1) speedStack.pop();else if (!tag[1]) speedStack.push(n(rule.value));
          }
        } else for (let i = 0; i < part.length; i++) timings.push(speedStack.at(-1));
      }
      return {
        actor,
        text: clean(text),
        raw: text,
        id,
        expression: expression || 'default',
        chars: 0,
        hold: 0,
        seen: false,
        timings,
        typeMs: 0
      };
    }
    typeLine(line, dt, audible = true) {
      const before = line.chars;
      line.typeMs += dt * this.dialogSpeed * TEXT_SPEED_BASE * 1000;
      while (line.chars < line.text.length) {
        const delay = line.timings?.[Math.floor(line.chars)] || this.c('typing_interval_ms', 50);
        if (line.typeMs < delay) break;
        line.typeMs -= delay;
        line.chars++;
      }
      if (audible && this.screen === 'bar' && this.currentDialogue() === line) root.LunaDialogueAudio?.reveal(line.text, before, line.chars);
    }
    finishLine() {
      const d = this.dialogue;
      if (!d || this.storyCoaster) return;
      if (d.id) this.read.add(d.id);
      this.history.push({
        actor: d.actor,
        text: d.text,
        scene: this.story?.scene?.id,
        id: d.id,
        anonymous: d.actor === 'tom' && this.speakerName(d.actor) === '???'
      });
      const s = d.step;
      this.lastStoryLine = {
        ...d,
        chars: d.text.length
      };
      this.dialogue = null;
      if (s.type === 'order') this.createStoryOrder(s);
      this.stepDone(s);
    }
    advance() {
      if (this.isPaused() || this.transition > 0 || this.cameraLeft > 0 || this.cameraMoving || this.screen !== 'bar' || !this.dialogue || this.phase === 'general') return false;
      const d = this.dialogue;
      if (d.chars < d.text.length) d.chars = d.text.length;else {
        if (this.storyCoaster) return false;
        this.safe(() => this.finishLine());
      }
      this.changed();
      return true;
    }
    choose(seq) {
      if (!this.choice || this.isPaused() || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return false;
      return this.safe(() => {
        const c = this.choice.rows.find(c => n(c.seq) === Number(seq));
        if (!c || !condition(c.when, this.ctx())) return false;
        const target = c.goto ? this.t.scenes.find(s => s.id === c.goto && n(s.day) === this.day) : null;
        if (c.goto && !target) throw Error('분기 씬 없음: ' + c.goto);
        const step = this.choice.step;
        if (this.day === 0) this.progress.flags.day0_choice_hold_learned = true;
        applyEffects(c.effects, this.progress);
        applyEffects(step.effects, this.progress);
        this.log('choice', {
          id: step.arg,
          seq: c.seq,
          goto: c.goto
        });
        this.choice = null;
        if (target) this.loadScene(target);else {
          this.story.index++;
          this.pump();
        }
        this.changed();
        return true;
      });
    }
    createStoryOrder(s) {
      const freeChoice = s.arg === 'free',
        id = freeChoice ? this.cocktailsAvailable()[0]?.id : s.arg?.match(/^exact:(.+)$/)?.[1];
      if (!id) throw Error('미지원 주문 형식: ' + s.arg);
      this.cocktail(id);
      const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
      if (!seat) throw Error('주문자 착석 정보 없음: ' + s.actor);
      if (this.currentOrder) throw Error('앞 주문이 미완료');
      this.resultContext = {};
      this.currentOrder = {
        id: 'order_' + ++this.serial,
        actor: s.actor,
        seat,
        cocktail: id,
        ...(freeChoice ? {
          freeChoice: true
        } : {}),
        ...(s.payment ? {
          payment: s.payment
        } : {})
      };
      this.resultContext.ordered = id;
      if (this.phase === 'opening') this.seats[seat].coaster = true;
      this.seats[seat].order = this.currentOrder;
      this.log('order', {
        ...this.currentOrder
      });
    }
    finishGeneralService() {
      this.startStoryPhase('bar');
    }
    startGeneral() {
      this.storyCoaster = null;
      this.phase = 'general';
      this.progress.phase = 'bar_open';
      this.screen = 'bar';
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.story = null;
      this.dialogue = null;
      this.queue = sortSeq([...this.t.random_waves, ...this.t.regular_slots].filter(s => n(s.day) === this.day));
      this.queueIndex = 0;
      this.spawnBlocked = false;
      this.spawnLeft = this.c('first_spawn_delay_sec', 5) + n(this.queue[0]?.delay_sec);
      this.focus = 'L';
      this.log('phase_start', {
        phase: 'general',
        slots: this.queue.length
      });
      if (!this.queue.length) this.finishGeneralService();
    }
    appearance() {
      const gender = this.rng() < 0.5 ? 'm' : 'f';
      const slots = ['body', 'outfit', 'eyes', 'eyebrows', 'mouth', 'hair'];
      let ids = [],
        layers = [];
      // CSV IDs are retained; art filenames are a view mapping, not a schema change.
      for (const slot of slots) {
        const list = this.t.guest_parts.filter(p => p.gender === gender && p.id.startsWith(slot + '_' + gender));
        const p = weighted(list, this.rng);
        const id = p?.id || slot + '_' + gender + (slot === 'body' ? '' : '_1');
        ids.push(id);
      }
      const optional = this.t.guest_parts.filter(p => p.gender === gender && /^(arm_accessory|necklace|outerwear)_/.test(p.id));
      if (optional.length && this.rng() > 0.5) {
        const p = weighted(optional, this.rng);
        if (!this.t.guest_exclusions.some(e => e.a === p.id && ids.includes(e.b) || e.b === p.id && ids.includes(e.a))) ids.push(p.id);
      }
      const map = {
        outfit: 'top',
        eyebrows: 'eyebrow',
        arm_accessory: 'Acc',
        necklace: 'Acc',
        outerwear: 'cyberware'
      };
      const artKey = id => {
        const m = id.match(/^(.*)_[mf](?:_(\d+))?$/);
        return m ? 'guest_' + gender + '_' + (map[m[1]] || m[1]) + (m[2] ? '_' + m[2] : '') : '';
      };
      const requested = [...ids],
        missing = ids.filter(id => !this.data.assets[artKey(id)]);
      // A missing outfit must not silently turn into an incompatible sleeved top
      // while keeping an arm accessory. Use the CSV's whole safe default set.
      if (missing.length) {
        const defaults = this.t.guest_settings[0];
        ids = slots.map(slot => defaults['defaults.' + gender + '.' + slot]);
        this.log('appearance_fallback', {
          requested,
          missing,
          used: ids
        });
      }
      for (const id of ids) {
        const k = artKey(id);
        if (this.data.assets[k]) layers.push(k);
      }
      return {
        gender,
        ids,
        layers,
        requested,
        missing
      };
    }
    spawn() {
      const slot = this.queue[this.queueIndex];
      if (!slot) return;
      const free = Object.keys(this.seats).filter(k => !this.seats[k] && !this.tableFades[k]);
      if (!free.length) {
        this.spawnBlocked = true;
        return;
      }
      // Preserve the existing seeded sequence for appearance, orders and dialogue.
      this.rng();
      const seat = free[Math.floor(this.seatRng() * free.length)];
      // Guest arrivals preserve the player's selected seat and camera view.
      const p = this.t.personalities.find(p => p.id === (slot.personality || 'gentle'));
      const limit = clamp(this.c('coaster_base_sec') * n(p.patience_mult, 1), this.c('coaster_min_sec'), this.c('coaster_max_sec'));
      const g = {
        id: 'guest_' + ++this.serial,
        actor: slot.character || slot.personality,
        slot,
        personality: p,
        appearance: slot.character ? null : this.appearance(),
        seat,
        state: 'WAIT_COASTER',
        coaster: false,
        glass: null,
        round: 0,
        maxRounds: n(slot.max_rounds, 1),
        coasterLimit: limit,
        left: limit,
        limit,
        warn: 0,
        pendingWarn: 0,
        reasking: false,
        lines: [],
        lineIndex: 0,
        order: null,
        idleLeft: 10,
        lastGrade: null
      };
      this.seats[seat] = g;
      this.setBarks(g, ['call']);
      this.queueIndex++;
      this.spawnLeft = n(this.queue[this.queueIndex]?.delay_sec, this.c('spawn_delay_default_sec'));
      this.spawnBlocked = false;
      this.log('guest_enter', {
        guest: g.id,
        seat,
        personality: p.id,
        appearance: g.appearance?.ids
      });
    }
    bark(g, situation, actor = null) {
      const voice = actor || g.slot.character || g.personality.id;
      let rows = this.t.barks.filter(r => r.situation === situation && r.voice_id === voice);
      if (!rows.length) rows = this.t.barks.filter(r => r.situation === situation && r.voice_id == null);
      const key = voice + ':' + situation,
        old = this.barkLast[key];
      if (rows.length > 1) rows = rows.filter(r => r.row_id !== old);
      const row = weighted(rows, this.rng);
      if (row) this.barkLast[key] = row.row_id;
      let txt = row ? this.text(row) : '';
      if (!txt && situation === 'ask_order') txt = this.lang === 'ko' ? '주문하시겠어요?' : 'What would you like?';
      if (!txt) {
        this.log('bark_missing', {
          voice,
          situation
        });
        txt = this.lang === 'ko' ? '…' : '…';
      }
      txt = txt.replace(/\{cocktail\}/g, this.name(g.order?.cocktail || g.nextCocktail));
      return {
        ...this.makeLine(actor || g.actor, txt, row?.row_id, row?.expression),
        situation
      };
    }
    setBarks(g, situations, onDone = null) {
      g.lines = situations.map(s => this.bark(g, s, s === 'ask_order' ? 'luna' : null));
      g.lineIndex = 0;
      g.lineDone = onDone;
    }
    coaster(seat = this.focus, input = 'shortcut') {
      if (this.storyCoaster) {
        const pending = this.storyCoaster;
        if (seat !== pending.seat || !['drag', 'keyboard'].includes(input) || !this.storyCoasterReady() || this.isPaused() || this.screen !== 'bar' || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return false;
        const guest = this.seats[seat];
        if (!guest || guest.actor !== pending.step.actor || guest.coaster) return false;
        guest.coaster = true;
        this.storyCoaster = null;
        this.log('story_coaster', {
          actor: guest.actor,
          seat,
          input
        });
        if (pending.kind === 'line') this.safe(() => this.finishLine());else this.safe(() => this.pump());
        this.changed();
        return true;
      }
      if (this.tutorial?.kind === 'coaster') {
        const t = this.tutorial;
        if (this.isPaused() || this.screen !== 'bar' || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0 || seat !== t.seat || !['drag', 'keyboard'].includes(input)) return false;
        this.seats[seat].coaster = true;
        this.tutorial = null;
        this.log('story_coaster', {
          actor: t.step.actor,
          seat,
          input
        });
        this.log('tutorial_complete', {
          kind: 'coaster'
        });
        this.setTransition(.45, () => this.stepDone(t.step));
        this.changed();
        return true;
      }
      if (this.phase !== 'general' || !['drag', 'keyboard'].includes(input) || this.screen !== 'bar' || this.isPaused() || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0 || seat !== this.focus) return false;
      const g = this.seats[seat];
      if (!g || g.coaster || g.state !== 'WAIT_COASTER' || g.left <= 0) return false;
      g.coaster = true;
      g.state = 'ORDER_DIALOGUE';
      this.beginOrder(g, false);
      this.log('coaster', {
        guest: g.id,
        seat,
        input
      });
      this.changed();
      return true;
    }
    beginOrder(g, reorder) {
      const candidates = this.cocktailsAvailable();
      if (!candidates.length) throw Error('무작위 주문 후보 없음');
      g.nextCocktail = g.slot.order || candidates[Math.floor(this.rng() * candidates.length)].id;
      const situations = reorder ? ['reorder'] : ['ask_order', ...(this.rng() < n(g.personality.think_chance) ? ['order_think'] : []), 'order'];
      this.setBarks(g, situations, () => {
        g.round++;
        const c = this.cocktail(g.nextCocktail);
        g.order = {
          id: 'order_' + ++this.serial,
          cocktail: c.id,
          actor: g.id,
          seat: g.seat
        };
        g.limit = n(c.time_limit_sec) + Math.max(this.c('serve_min_bonus_sec'), this.c('serve_bonus_sec') - n(c.unlock_day) * this.c('serve_grace_per_day_sec'));
        g.left = g.limit;
        g.state = 'WAIT_SERVE';
        g.warn = 0;
        g.pendingWarn = 0;
        g.idleLeft = this.c('idle_min_sec');
        this.log('order', {
          guest: g.id,
          ...g.order
        });
      });
    }
    reask() {
      if (this.phase !== 'general' || this.screen !== 'bar' || this.isPaused() || this.cameraLeft > 0) return false;
      const g = this.seats[this.focus];
      if (!g || g.state !== 'WAIT_SERVE' || !g.order || g.reasking || g.left <= 0) return false;
      const cost = g.limit * 0.10;
      g.left = Math.max(0, g.left - cost);
      this.log('reask', {
        guest: g.id,
        cost,
        remaining: g.left,
        order: g.order.id
      });
      if (g.left <= 0) {
        this.leave(g, 'leave_serve');
        this.changed();
        return true;
      }
      g.reasking = true;
      g.lines = [this.makeLine('luna', this.lang === 'ko' ? "주문하신 메뉴가 어떤 거였죠?" : "Could you remind me what you ordered?"), this.bark(g, 'order')];
      g.lineIndex = 0;
      g.lineDone = () => {
        g.reasking = false;
        if (g.state === 'WAIT_SERVE' && g.pendingWarn > g.warn) this.warn(g, g.pendingWarn);
      };
      this.changed();
      return true;
    }
    warn(g, level) {
      if (g.reasking) {
        g.pendingWarn = Math.max(g.pendingWarn, level);
        return;
      }
      if (level <= g.warn) return;
      g.warn = level;
      this.setBarks(g, [(g.state === 'WAIT_COASTER' ? 'call_' : 'serve_') + (level === 2 ? 'final' : 'urge')]);
    }
    leave(g, situation) {
      g.reasking = false;
      g.state = 'EXITING';
      g.left = 0;
      g.order = null;
      this.setBarks(g, [situation]);
      g.exitLeft = 3;
      this.lost++;
      this.log('timeout', {
        guest: g.id,
        situation
      });
    }
    tutorialSeatTarget() {
      const t = this.tutorial;
      if (t?.kind !== 'seatExplore') return null;
      return !t.visited.includes('L') ? 'L' : !t.visited.includes('R') ? 'R' : t.origin;
    }
    updateSeatTutorial() {
      const t = this.tutorial;
      if (t?.kind !== 'seatExplore' || !t.moved || this.isPaused() || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return;
      if (!t.visited.includes(this.focus)) t.visited.push(this.focus);
      if (['L', 'R'].every(s => t.visited.includes(s)) && this.focus === t.origin) {
        this.tutorial = null;
        this.log('tutorial_complete', {
          kind: 'seatExplore'
        });
        this.stepDone(t.step);
        this.changed();
      }
    }
    continueBarTutorial() {
      const t = this.tutorial;
      if (!t || this.screen !== 'bar' || this.isPaused() || this.cameraMoving || this.cameraLeft || this.transition) return false;
      if (t.kind === 'seatIndicator') {
        t.kind = 'seatLegend';
        this.changed();
        return true;
      }
      if (t.kind === 'seatLegend') {
        this.tutorial = null;
        this.log('tutorial_complete', {
          kind: 'seatIndicator'
        });
        this.stepDone(t.step);
        this.changed();
        return true;
      }
      return false;
    }
    focusSeat(seat) {
      const exploring = this.tutorial?.kind === 'seatExplore';
      if (!['L', 'M', 'R'].includes(seat) || this.phase !== 'general' && !exploring || this.screen !== 'bar' || this.isPaused()) return false;
      if (this.focus === seat) return false;
      if (exploring) {
        if (this.cameraMoving || this.cameraLeft > 0 || this.transition > 0 || Math.abs(['L', 'M', 'R'].indexOf(this.focus) - ['L', 'M', 'R'].indexOf(seat)) !== 1) return false;
        this.tutorial.moved = true;
      }
      this.focus = seat;
      this.overview = false;
      this.cameraSame = false;
      this.cameraLeft = 0.55;
      this.log('focus', {
        seat
      });
      this.changed();
      return true;
    }
    afterCamera() {
      const g = this.seats[this.focus],
        line = g?.lines?.[g.lineIndex];
      if (line?.seen && this.phase !== 'general') {
        line.chars = line.text.length;
        line.hold = 0;
      }
      this.cleanOldGlass();
    }
    toggleOverview() {
      if (this.phase !== 'general' || this.screen !== 'bar' || this.isPaused()) return;
      this.overview = !this.overview;
      this.cameraLeft = 0.55;
      this.cameraSame = true;
      this.changed();
    }
    cleanOldGlass() {
      if (!this.drink || this.screen !== 'bar') return;
      const g = this.seats[this.focus];
      if (g?.state === 'WAIT_SERVE' && g.order && g.glass) {
        g.glass = null;
        this.log('old_glass_cleared', {
          guest: g.id,
          seat: this.focus
        });
      }
    }
    openTutorialService() {
      if (this.tutorial?.kind !== 'recipe' || this.isPaused() || this.screen !== 'bar' || this.cameraMoving || this.cameraLeft || this.transition) return false;
      this.tutorial.serviceOpened = true;
      this.log('tutorial_service_open');
      return true;
    }
    openRecipes() {
      if (this.tutorial && (this.tutorial.kind !== 'recipe' || !this.tutorial.serviceOpened)) return false;
      if (this.screen !== 'bar' || this.error || this.isPaused() || this.transition > 0) return false;
      if (this.phase === 'general' || this.phase === 'practice' || this.currentOrder && this.story?.steps[this.story.index]?.type === 'craft') {
        if (this.drink) return false;
        if (this.tutorial?.kind === 'recipe') {
          this.tutorial = {
            kind: 'recipeSelect',
            beer: !!this.tutorial.beer
          };
          this.log('tutorial_complete', {
            kind: 'recipe'
          });
        }
        this.screen = 'recipe';
        this.changed();
        return true;
      }
      return false;
    }
    closeRecipes() {
      if (this.tutorial) return false;
      if (this.screen !== 'recipe') return;
      this.screen = 'bar';
      this.changed();
    }
    selectCocktail(id) {
      if (this.tutorial && (this.tutorial.kind !== 'recipeSelect' || id !== (this.tutorial.beer ? 'bottle_beer' : 'gin_tonic'))) return false;
      if (this.screen !== 'recipe' || !this.cocktailsAvailable().some(c => c.id === id)) return false;
      if (this.currentOrder?.freeChoice) {
        this.currentOrder.cocktail = id;
        this.resultContext.ordered = id;
      }
      this.prep = {
        selected: id,
        glass: null,
        tool: null,
        ingredients: []
      };
      this.screen = 'prep';
      if (this.tutorial?.kind === 'recipeSelect') this.tutorial = this.tutorial.beer ? {
        kind: 'beerGlass',
        beer: true
      } : {
        kind: 'prepRecipeOpen'
      };
      this.changed();
      return true;
    }
    tutorialEvent(event, value) {
      const t = this.tutorial;
      if (!t || this.screen !== 'prep' || this.isPaused()) return false;
      if (t.beer) {
        const route = {
          beerToolNavigate: ['tool', 'beerOpener'],
          beerFridgeNavigate: ['fridge', 'beerAdd']
        };
        const next = route[t.kind];
        if (event !== 'shelf' || !next || value !== next[0]) return false;
        t.kind = next[1];
        this.changed();
        return true;
      }
      const route = {
        prepRecipeOpen: ['recipeOpen', 'prepRecipeRead'],
        prepRecipeRead: ['read', 'prepRecipeClose'],
        prepRecipeClose: ['recipeClose', 'prepNavigate'],
        prepNavigate: ['shelf', 'prepHover'],
        prepHover: ['hover', 'prepAdd']
      };
      if (this.variant !== 'gpt') {
        route.prepRecipeClose = ['recipeClose', 'prepGlass'];
        route.prepNavigate = ['shelf', 'prepHover'];
        route.prepSodaNavigate = ['shelf', 'prepSodaHover'];
        route.prepSodaHover = ['hover', 'prepSodaAdd'];
        if (event === 'shelf' && value !== (t.kind === 'prepNavigate' ? 'liquor' : 'fridge')) return false;
      }
      const next = route[t.kind];
      if (!next || next[0] !== event) return false;
      this.log('tutorial_action', {
        kind: t.kind,
        event
      });
      t.kind = next[1];
      this.changed();
      return true;
    }
    pickItem(id) {
      if (this.tutorial) {
        const allowed = this.tutorial.beer ? {
          beerGlass: this.cocktail('bottle_beer').glass,
          beerAdd: 'beer'
        } : this.variant === 'gpt' ? {
          prepAdd: 'gin',
          prepRemove: 'gin'
        } : {
          prepGlass: 'long_drink',
          prepAdd: 'gin',
          prepRemove: 'gin',
          prepGinAgain: 'gin',
          prepSodaAdd: 'soda_water'
        };
        if (allowed[this.tutorial.kind] !== id) return false;
      }
      if (this.screen !== 'prep' || this.isPaused()) return;
      const item = this.itemsAvailable().find(i => i.id === id);
      if (!item) return;
      if (item.kind === 'ingredient') {
        const i = this.prep.ingredients.indexOf(id);
        if (i >= 0) this.prep.ingredients.splice(i, 1);else {
          const before = this.prep.ingredients.length;
          this.prep.ingredients.push(id);
          if (before < 10 && this.prep.ingredients.length >= 10) this.overlay = 'ingredientWarning';
        }
      } else if (item.kind === 'glass') this.prep.glass = this.prep.glass === id ? null : id;else if (item.kind === 'tool') {
        this.prep.tool = this.prep.tool === id ? null : id;
        if (this.prep.tool) this.prep.opener = false;
      }
      if (this.tutorial?.beer) {
        this.tutorial.kind = this.tutorial.kind === 'beerGlass' ? 'beerToolNavigate' : 'beerStart';
        this.changed();
        return true;
      }
      if (this.tutorial?.kind === 'prepAdd' && this.prep.ingredients.includes('gin')) {
        this.tutorial.kind = 'prepRemove';
        this.log('tutorial_action', {
          event: 'add',
          ingredient: id
        });
      } else if (this.tutorial?.kind === 'prepRemove' && !this.prep.ingredients.includes('gin')) {
        if (this.variant === 'gpt') {
          this.tutorial = null;
          this.progress.flags.day0_recipe_taught = true;
          this.log('tutorial_complete', {
            kind: 'prep'
          });
        } else this.tutorial.kind = 'prepGinAgain';
      } else if (this.variant !== 'gpt' && this.tutorial) {
        const next = {
          prepGlass: 'prepNavigate',
          prepGinAgain: 'prepSodaNavigate',
          prepSodaAdd: 'prepStart'
        }[this.tutorial.kind];
        if (next) {
          this.log('tutorial_action', {
            kind: this.tutorial.kind,
            event: 'pick',
            ingredient: id
          });
          this.tutorial.kind = next;
        }
      }
      this.changed();
    }
    pickOpener() {
      if (this.screen !== 'prep' || this.isPaused() || this.tutorial && (!this.tutorial.beer || this.tutorial.kind !== 'beerOpener')) return false;
      this.prep.opener = !this.prep.opener;
      if (this.prep.opener) this.prep.tool = null;
      if (this.tutorial?.beer) this.tutorial.kind = 'beerFridgeNavigate';
      this.changed();
      return true;
    }
    prepBack() {
      if (this.tutorial) return false;
      if (this.screen !== 'prep') return;
      this.prep = null;
      this.screen = 'recipe';
      this.log('prep_reset');
      this.changed();
    }
    startCraft() {
      if (this.screen !== 'prep' || this.isPaused()) return false;
      if (this.tutorial?.beer) {
        if (this.tutorial.kind !== 'beerStart' || this.prep?.glass !== this.cocktail('bottle_beer').glass || !this.prep.opener || !this.prep.ingredients.includes('beer')) return false;
        this.tutorial = null;
      }
      if (this.tutorial && (this.variant === 'gpt' || this.tutorial.kind !== 'prepStart' || this.prep?.glass !== 'long_drink' || !['gin', 'soda_water'].every(id => this.prep.ingredients.includes(id)))) return false;
      if (this.screen !== 'prep' || !this.prep?.glass || !this.prep.ingredients.length || this.isPaused()) return false;
      if (this.prep.ingredients.includes('beer') && !this.prep.opener) {
        this.overlay = 'openerWarning';
        this.changed();
        return false;
      }
      return this.safe(() => {
        this.craft = {
          id: 'craft_attempt_' + ++this.serial,
          actual: structuredClone(this.prep),
          queue: buildQueue(this.data, this.cocktail(this.prep.selected), this.prep),
          index: 0,
          results: [],
          elapsed: 0
        };
        this.screen = 'gimmick';
        this.nextGimmick();
        if (this.tutorial?.kind === 'prepStart') {
          this.tutorial = null;
          this.progress.flags.day0_recipe_taught = true;
          this.log('tutorial_complete', {
            kind: 'prep'
          });
        }
        this.changed();
        return true;
      });
    }
    nextGimmick() {
      const step = this.craft.queue[this.craft.index];
      if (!step) {
        this.result = scoreCraft(this.data, this.cocktail(this.craft.actual.selected), this.craft.actual, this.craft.results, this.craft.elapsed);
        this.result.id = this.craft.id;
        this.resultContext.craft_grade = this.result.grade;
        this.screen = 'result';
        this.gimmick = null;
        this.log('craft_result', {
          id: this.craft.id,
          score: this.result.score,
          grade: this.result.grade
        });
        return;
      }
      if (step.type === 'add') {
        this.craft.results.push({
          ...step,
          value: step.target,
          completed: true,
          failures: 0,
          completion: 1
        });
        this.craft.index++;
        return this.nextGimmick();
      }
      this.gimmick = {
        ...step,
        started: false,
        elapsed: 0,
        value: 0,
        held: false,
        angle: 0,
        failures: 0,
        completed: false,
        success: 0,
        completionAge: 0,
        attempts: 0,
        beatTime: 0,
        hit: false,
        beatSuccess: false,
        outcomes: [],
        stirPos: 0,
        stirStep: 0,
        circleTime: 0,
        message: '',
        targetStacks: step.type === 'shake' ? MIX.shakeTargetStacks : this.c('stir_target_stacks', 10)
      };
      MIX.init(this.gimmick);
      OPEN.init(this.gimmick);
      POUR.init(this.gimmick, this);
      if (step.type === 'open' && this.day === 1 && this.phase === 'opening' && this.craftStep?.arg === 'tutorial_beer') this.gimmick.openTutorial = true;
      if (this.gimmick.fluid && this.day === 0 && this.variant !== 'gpt' && !this.minigame && this.currentOrder?.actor === 'chris' && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_pour_taught) this.gimmick.pourTutorial = {
        step: 'target'
      };
    }
    startGimmick() {
      return this.gimmickInput(this.gimmick?.type === 'stir' ? 'KeyW' : 'Space');
    }
    holdPour(held) {
      if (this.screen !== 'gimmick' || this.isPaused()) return;
      if (['pour', 'fill_up'].includes(this.gimmick.type) && !this.gimmick.fluid?.finishRequested) {
        this.gimmick.held = held;
        if (held) this.gimmick.started = true;
      }
    }
    gimmickInput(key) {
      const g = this.gimmick;
      if (this.screen !== 'gimmick' || !g || this.isPaused() || g.completed || g.fluid?.finishRequested) return false;
      // Reject unrelated keys before they can start the clock or change a score.
      if (['pour', 'fill_up'].includes(g.type)) {
        if (key !== 'Space') return false;
        this.holdPour(true);
        return true;
      }
      if (g.type === 'stir') {
        if (!g.started) {
          if (!['KeyW', 'ArrowUp'].includes(key)) return false;
          g.started = true;
          g.message = '시계 방향으로 D → S → A → W';
          return true;
        }
        const keyMap = {
            KeyW: 0,
            ArrowUp: 0,
            KeyD: 1,
            ArrowRight: 1,
            KeyS: 2,
            ArrowDown: 2,
            KeyA: 3,
            ArrowLeft: 3
          },
          dir = keyMap[key];
        if (dir == null) return false;
        if (dir === (g.stirPos + 1) % 4) {
          g.stirPos = dir;
          g.stirStep++;
          g.spoonTarget += 90;
          g.stirMotionPending = Math.min(6, g.stirMotionPending + 5);
          g.swirlSpeed = Math.min(420, g.swirlSpeed + 160);
          g.message = '';
          if (g.stirStep === 4) this.finishStirCircle(true);
        } else this.finishStirCircle(false);
        this.changed();
        return true;
      }
      if (!['open', 'shake'].includes(g.type) || !(key === 'Space' || g.type === 'shake' && key === 'MouseLeft')) return false;
      if (g.type === 'open') {
        const accepted = OPEN.press(g);
        this.changed();
        return accepted;
      }
      if (!g.started) {
        g.started = true;
        this.changed();
        return true;
      }
      if (g.type === 'shake') {
        MIX.shakeHit(g);
      }
      this.changed();
      return true;
    }
    finishStirCircle(ok) {
      const g = this.gimmick;
      g.outcomes.push(ok);
      g.attempts++;
      if (ok) g.success++;else g.failures++;
      g.attemptStartPos = g.stirPos;
      g.stirStep = 0;
      g.circleTime = 0;
      g.feedbackLeft = .35;
      g.message = ok ? 'GOOD' : 'MISS';
      if (g.attempts >= g.targetStacks) g.completed = true;
    }
    endGimmick() {
      const g = this.gimmick;
      if (!g || this.screen !== 'gimmick' || this.isPaused() || !g.started) return false;
      if (['stir', 'shake'].includes(g.type) && g.completed && (g.completionAge || 0) + 1e-9 < MIX.completionHoldSec) return false;
      if (g.fluid && !g.fluid.ready) {
        g.fluid.requestFinish(g);
        this.changed();
        return true;
      }
      if (g.fluid?.ready) {
        if (!g.pourFinishFx) {
          const errorMl = g.fluid.caughtMl - g.fluid.targetMl;
          g.pourFinishFx = {
            errorMl,
            perfect: Math.abs(errorMl) <= 5 + 1e-8,
            age: 0
          };
        }
        if (g.pourFinishFx.age < .8) return true;
      }
      if (g.type === "open" && g.completed && (g.openFx?.age || 0) < OPEN.carbonationSec) return false;
      if (g.openTutorial) {
        if (!g.completed || (g.openFx?.age || 0) < OPEN.carbonationSec) return false;
        this.progress.flags.day1_open_taught = true;
        this.log('tutorial_complete', {
          kind: 'beerOpen'
        });
      }
      let result = {
        type: g.type,
        ingredient: g.ingredient,
        value: g.value,
        failures: g.failures,
        completed: g.completed,
        completion: g.success / (g.targetStacks + (g.rhythm?.extraPresses || 0)),
        endType: g.completed ? 'AutoTarget' : 'ManualNext'
      };
      if (g.rhythm) result.rhythm = {
        mode: g.rhythm.mode,
        extraPresses: g.rhythm.extraPresses
      };
      if (['pour', 'fill_up'].includes(g.type)) {
        result.completed = true;
        if (g.fluid) result.liquid = {
          ...g.fluid.audit()
        };
      }
      if (g.fluid && g.pourTutorial) {
        this.progress.flags.day0_pour_taught = true;
        this.log('tutorial_complete', {
          kind: 'pour'
        });
      }
      this.craft.results.push(result);
      this.craft.index++;
      this.safe(() => this.nextGimmick());
      this.changed();
    }
    retryDataError() {
      if (!this.craft) return;
      this.error = null;
      this.craft.id = 'craft_attempt_' + ++this.serial;
      this.craft.index = 0;
      this.craft.results = [];
      this.craft.elapsed = 0;
      this.screen = 'gimmick';
      this.safe(() => {
        this.craft.queue = buildQueue(this.data, this.cocktail(this.craft.actual.selected), this.craft.actual);
        this.nextGimmick();
      });
      this.changed();
    }
    cancelCraft() {
      this.error = null;
      this.gimmick = null;
      this.craft = null;
      this.result = null;
      this.prep = null;
      this.screen = 'recipe';
      this.changed();
    }
    discard() {
      if (this.screen !== 'result' || !this.result || this.isPaused()) return false;
      const r = this.result,
        price = Number(this.cocktail(r.selected).price);
      if (!Number.isFinite(price) || price < 0) {
        this.error = '칵테일 가격 오류: ' + r.selected;
        this.changed();
        return false;
      }
      const before = this.progress.money;
      this.progress.money -= price;
      this.discardFeedback = {
        id: r.id,
        selected: r.selected,
        price,
        before,
        after: this.progress.money,
        startedAt: this.realTime,
        until: this.realTime + 2.6
      };
      this.log('discard', {
        id: r.id,
        selected: r.selected,
        price,
        before,
        after: this.progress.money
      });
      this.screen = 'discarding';
      this.drink = null;
      this.gimmick = null;
      delete this.resultContext.craft_grade;
      this.changed();
      return true;
    }
    offer() {
      if (this.screen !== 'result' || !this.result) return;
      this.drink = this.result;
      this.result = null;
      this.screen = 'bar';
      if (this.currentOrder) {
        this.focus = this.currentOrder.seat;
        this.seats[this.focus].glass = null;
      } else this.cleanOldGlass();
      if (this.day === 0 && this.variant !== 'gpt' && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_drink_taught && this.currentOrder?.actor === 'chris' && this.drink.selected === this.currentOrder.cocktail) {
        this.tutorial = {
          kind: 'serveDrink',
          seat: this.currentOrder.seat
        };
        this.log('tutorial_wait', {
          kind: 'serveDrink'
        });
      }
      this.log('offer', {
        id: this.drink.id
      });
      this.changed();
    }
    resolveServe(order, drink) {
      const match = order.cocktail === drink.selected;
      const sewage = !match ? 'order_mismatch' : drink.missingCore.length ? 'missing_core' : null;
      const grade = sewage ? 'sewage' : drink.grade;
      return {
        orderId: order.id,
        drinkId: drink.id,
        ordered: order.cocktail,
        served: drink.selected,
        match,
        grade,
        craftGrade: drink.grade,
        score: drink.score,
        sewage,
        ...(order.payment ? {
          payment: order.payment
        } : {})
      };
    }
    settle(result, guest = null) {
      if (this.transactionIds.has(result.orderId)) return;
      const c = this.cocktail(result.served),
        rule = this.t.settlement_rules.find(r => r.setting === result.grade);
      if (!rule) throw Error('정산 규칙 누락');
      const price = result.payment === 'none' ? 0 : n(c.price),
        sale = Math.round(price * n(rule.sale_rate)),
        tip = Math.round(price * n(rule.tip_rate) * n(guest?.personality?.tip_mult, 1)),
        refund = Math.round(price * n(rule.refund_rate));
      const trx = {
        ...result,
        sale,
        tip,
        refund,
        net: sale + tip - refund,
        phase: this.phase
      };
      this.transactions.push(trx);
      this.transactionIds.add(result.orderId);
      this.progress.money += trx.net;
      this.served++;
      this.log('settlement', trx);
      return trx;
    }
    serve(seat, input) {
      if (this.tutorial && (this.tutorial.kind !== 'serveDrink' || seat !== this.tutorial.seat || !['drag', 'keyboard'].includes(input))) return false;
      if (!this.drink || this.screen !== 'bar' || this.isPaused() || this.cameraLeft > 0 || this.transition > 0) return false;
      return this.safe(() => {
        if (this.phase === 'practice') {
          this.settle(this.resolveServe({
            id: 'practice_' + ++this.serial,
            cocktail: this.drink.selected
          }, this.drink));
          this.drink = null;
          this.openRecipes();
          return true;
        }
        const g = this.seats[seat];
        if (!g?.coaster) return false;
        if (this.phase === 'general') {
          if (seat !== this.focus || g.state !== 'WAIT_SERVE' || !g.order || g.left <= 0) return false;
          const result = this.resolveServe(g.order, this.drink);
          g.glass = this.drink.selected;
          this.drink = null;
          g.reasking = false;
          g.state = 'REACTION';
          g.lastGrade = result.grade;
          this.setBarks(g, result.match ? ['serve_thanks', 'react_' + result.grade] : ['wrong_receive', 'wrong_drink'], () => {
            const t = this.settle(result, g);
            applyEffects(g.slot.serve_effects, this.progress);
            g.order = null;
            if (g.round < g.maxRounds && t.refund === 0) {
              g.state = 'REORDER_WAIT';
              g.reorderLeft = this.c('next_round_delay_sec', 3);
            } else {
              g.state = 'EXITING';
              this.setBarks(g, [GRADES.indexOf(result.grade) >= 2 ? 'bye_good' : 'bye_bad']);
              g.exitLeft = 3;
            }
          });
        } else {
          if (!this.currentOrder || seat !== this.currentOrder.seat) return false;
          const craftStep = this.story.steps[this.story.index],
            serve = this.story.steps[this.story.index + 1];
          if (craftStep?.type !== 'craft' || serve?.type !== 'serve' || serve.actor !== this.currentOrder.actor) throw Error('order → craft → serve 연결 오류');
          const result = this.resolveServe(this.currentOrder, this.drink);
          g.glass = this.drink.selected;
          this.drink = null;
          this.resultContext = {
            grade: result.grade,
            final_grade: result.grade,
            craft_grade: result.craftGrade,
            order_match: result.match,
            ordered: result.ordered,
            served: result.served,
            cocktail: this.cocktail(result.served),
            tags: this.t.cocktail_tags.filter(t => t.context === result.served).map(t => t.ko)
          };
          if (this.tutorial?.kind === 'serveDrink') {
            this.tutorial = null;
            this.progress.flags.day0_drink_taught = true;
            this.log('tutorial_complete', {
              kind: 'serveDrink',
              input
            });
          }
          this.settle(result);
          this.applyAffinity(this.currentOrder.actor, result);
          applyEffects(craftStep.effects, this.progress);
          applyEffects(serve.effects, this.progress);
          this.currentOrder = null;
          g.order = null;
          this.story.index += 2;
          this.setTransition(1, () => this.pump());
        }
        this.changed();
        return true;
      });
    }
    applyAffinity(actor, result) {
      const c = this.t.characters.find(c => c.id === actor);
      if (!c?.affinity) return;
      const taste = sortSeq(this.t.tastes.filter(t => t.character_id === actor)).find(t => condition(t.when, this.ctx()));
      const tier = !result.match ? 'miss' : taste?.tier || 'ok';
      const row = this.t.affinity_matrix.find(r => r.taste_tier === tier);
      const delta = n(row?.[result.grade]);
      this.progress.affinity[actor] = n(this.progress.affinity[actor]) + delta;
      this.log('affinity', {
        actor,
        tier,
        delta
      });
      root.LunaStoryNotices?.affinity(this.progress, actor, delta);
    }
    parseUpkeepOverride(value) {
      if (value == null || String(value).trim() === '') return null;
      const amount = Number(value);
      if (!Number.isSafeInteger(amount) || amount < 0) throw Error('유지비는 0 이상의 정수 G로 입력해 주세요.');
      return amount;
    }
    upkeepInfo() {
      if (this.upkeepOverride != null) return {
        amount: this.upkeepOverride,
        source: 'web_test'
      };
      const row = this.t.days.find(d => n(d.day) === this.day);
      if (!row && this.day === 99) return {
        amount: 0,
        source: 'qa_default'
      };
      if (!row || row.upkeep_gold == null || String(row.upkeep_gold).trim() === '') throw Error('일차 유지비 데이터 누락: Day ' + this.day);
      const amount = this.parseUpkeepOverride(row.upkeep_gold);
      return {
        amount,
        source: 'days.csv'
      };
    }
    setUpkeepOverride(value) {
      if (this.finished) return false;
      const amount = this.parseUpkeepOverride(value);
      this.upkeepOverride = amount;
      this.log('debug_upkeep_override', {
        amount,
        restoredDataDefault: amount == null
      });
      this.changed();
      return true;
    }
    finishDay() {
      if (this.finished) return false;
      const upkeep = this.upkeepInfo(),
        totals = this.totals(),
        before = this.progress.money;
      // Order revenue is already committed. Never add the displayed totals again.
      this.dailySettlement = {
        id: 'day_' + this.day + '_settlement',
        day: this.day,
        status: 'pending',
        totals: {
          ...totals
        },
        openingBalance: this.openingBalance,
        otherChanges: before - this.openingBalance - totals.net,
        balanceBefore: before,
        upkeep: upkeep.amount,
        source: upkeep.source,
        projectedBalance: before - upkeep.amount,
        shortfall: Math.max(0, upkeep.amount - before),
        balanceAfter: null
      };
      this.tutorial = null;
      this.phase = 'complete';
      this.screen = 'settlement';
      this.dialogue = null;
      this.choice = null;
      this.story = null;
      this.currentOrder = null;
      this.drink = null;
      this.prep = null;
      this.gimmick = null;
      this.overlay = null;
      this.paused = false;
      this.transition = 0;
      this.pendingTransition = null;
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.tableFades = {};
      this.finished = true;
      this.log('day_complete', {
        day: this.day,
        orders: this.transactions.length,
        upkeep: upkeep.amount,
        upkeepSource: upkeep.source
      });
      this.changed();
      return true;
    }
    confirmDailySettlement() {
      const s = this.dailySettlement;
      if (!s || s.status !== 'pending' || this.screen !== 'settlement' || this.error) return false;
      if (s.balanceBefore < s.upkeep) {
        s.status = 'failed';
        s.balanceAfter = s.balanceBefore;
        this.phase = 'gameover';
        this.screen = 'gameover';
        this.log('daily_upkeep_failed', {
          settlementId: s.id,
          available: s.balanceBefore,
          required: s.upkeep,
          shortfall: s.shortfall
        });
        this.log('game_over', {
          reason: 'upkeep_unpaid',
          day: this.day
        });
      } else {
        this.progress.money = s.balanceBefore - s.upkeep;
        s.balanceAfter = this.progress.money;
        s.status = 'paid';
        this.log('daily_upkeep_paid', {
          settlementId: s.id,
          before: s.balanceBefore,
          amount: s.upkeep,
          after: s.balanceAfter
        });
      }
      this.changed();
      return true;
    }
    debugFill() {
      if (this.screen !== 'prep') return;
      const c = this.cocktail(this.prep.selected);
      this.prep.glass = c.glass;
      this.prep.tool = c.mix === 'shake' ? 'shaker' : c.mix === 'stir' ? 'mixing_glass' : null;
      this.prep.ingredients = this.t.recipes.filter(r => r.context === c.id && !r.auto_apply).map(r => r.ingredient);
      this.prep.opener = this.prep.ingredients.includes('beer');
      this.log('debug_recipe_fill');
      this.changed();
    }
    debugCraft(grade = 'excellent') {
      if (!['prep', 'gimmick'].includes(this.screen)) return;
      this.debugFill();
      if (this.screen === 'prep') this.startCraft();
      const actual = this.craft.actual,
        selected = this.cocktail(actual.selected),
        queue = this.craft.queue;
      const results = queue.map(q => ({
        ...q,
        value: q.target,
        completion: 1,
        completed: true,
        failures: 0
      }));
      this.result = scoreCraft(this.data, selected, actual, results, 2);
      this.result.id = this.craft.id;
      this.result.grade = grade;
      this.result.score = {
        excellent: 100,
        good: 85,
        decent: 70,
        poor: 45,
        sewage: 0
      }[grade];
      this.result.debug = true;
      this.gimmick = null;
      this.screen = 'result';
      this.log('debug_craft', {
        grade
      });
      this.changed();
    }
    tick(dt, {
      holdSpeech = false
    } = {}) {
      if (this.isPaused() || this.finished) return;
      dt = Math.max(0, Math.min(dt, 0.2));
      this.realTime += dt;
      for (const [seat, fade] of Object.entries(this.tableFades)) {
        fade.elapsed += dt;
        if (fade.elapsed >= fade.duration) delete this.tableFades[seat];
      }
      if (this.transition > 0) {
        this.transition = Math.max(0, this.transition - dt);
        if (!this.transition) {
          const fn = this.pendingTransition;
          this.pendingTransition = null;
          this.safe(fn);
        }
        return;
      }
      if (this.cameraLeft > 0) {
        this.cameraLeft = Math.max(0, this.cameraLeft - dt);
        if (!this.cameraLeft) {
          if (!this.cameraSame) this.afterCamera();
          this.cameraSame = false;
        }
      }
      this.updateSeatTutorial();
      if (this.screen === 'discarding') {
        if (this.realTime - this.discardFeedback.startedAt >= 1.3) {
          this.prep = {
            selected: this.discardFeedback.selected,
            glass: null,
            tool: null,
            ingredients: []
          };
          this.result = null;
          this.craft = null;
          this.screen = 'prep';
          this.changed();
        }
        return;
      }
      if (this.screen === 'gimmick') {
        this.tickGimmick(dt);
        return;
      }
      if (this.screen !== 'bar') return;
      if (this.phase === 'general') this.safe(() => this.tickGeneral(dt, holdSpeech));else if (!holdSpeech && this.dialogue && !this.cameraMoving && this.cameraLeft === 0) {
        this.typeLine(this.dialogue, dt);
      }
    }
    tickGeneral(realDt, holdSpeech = false) {
      const dt = realDt * this.speed;
      this.barTime += dt;
      if (this.queueIndex < this.queue.length) {
        if (this.spawnBlocked) {
          if (Object.keys(this.seats).some(k => !this.seats[k] && !this.tableFades[k])) {
            this.spawnBlocked = false;
            this.spawnLeft = this.c('reseat_delay_sec', 10);
          }
        } else {
          this.spawnLeft -= dt;
          if (this.spawnLeft <= 0) this.spawn();
        }
      }
      for (const g of Object.values(this.seats).filter(Boolean)) {
        if (g.state === 'WAIT_COASTER' || g.state === 'WAIT_SERVE') {
          g.left -= dt;
          if (g.left <= 0) {
            this.leave(g, g.state === 'WAIT_COASTER' ? 'leave_coaster' : 'leave_serve');
            continue;
          }
          const used = 1 - g.left / g.limit,
            level = used >= this.c('warn_red_ratio', 0.8) ? 2 : used >= this.c('warn_yellow_ratio', 0.5) ? 1 : 0;
          if (level > g.warn) this.warn(g, level);
        }
        if (g.state === 'EXITING') {
          g.exitLeft -= dt;
          if (g.exitLeft <= 0) {
            this.log('guest_exit', {
              guest: g.id,
              seat: g.seat
            });
            this.clearDepartedSeat(g.seat);
            continue;
          }
        }
        if (g.state === 'REORDER_WAIT') {
          g.reorderLeft -= dt;
          if (g.reorderLeft <= 0) {
            g.state = 'ORDER_DIALOGUE';
            this.beginOrder(g, true);
          }
        }
        // Looking elsewhere hides speech, but must not stall orders, settlement
        // callbacks or reorders. Global pauses are handled by tick().
        const visible = g.seat === this.focus && this.cameraLeft === 0 && !this.cameraMoving && !holdSpeech;
        const line = g.lines[g.lineIndex];
        if (line) {
          if (line.chars < line.text.length) this.typeLine(line, realDt, visible);
          if (visible) {
            line.seen = true;
            line.visibleChars = line.chars;
          }
          if (line.chars >= line.text.length) {
            line.hold += realDt * this.dialogSpeed;
            if (line.hold >= this.c('order_bark_gap_sec', 1.5)) {
              if (line.visibleChars > 0) this.history.push({
                actor: line.actor,
                text: line.text.slice(0, line.visibleChars),
                id: line.id
              });
              g.lineIndex++;
              if (g.lineIndex >= g.lines.length) {
                const fn = g.lineDone;
                g.lineDone = null;
                if (fn) fn();
              }
            }
          }
        } else if (g.state === 'WAIT_SERVE' && !g.reasking) {
          g.idleLeft -= dt;
          if (g.idleLeft <= 0) {
            this.setBarks(g, ['idle']);
            g.idleLeft = this.c('idle_min_sec', 8) + this.rng() * (this.c('idle_max_sec', 13) - this.c('idle_min_sec', 8));
          }
        }
      }
      if (!this.qaKeepGeneral && this.queueIndex >= this.queue.length && Object.values(this.seats).every(g => !g) && !Object.keys(this.tableFades).length) {
        this.drink = null;
        this.finishGeneralService();
      }
    }
    tickMixCompletion(dt) {
      const g = this.gimmick;
      if (!g?.completed || !['stir', 'shake'].includes(g.type)) return false;
      // Simulation time only: pause freezes the hold. Final animation continues,
      // but neither score nor the craft clock advances during this feedback.
      if (!this.isPaused()) {
        g.completionAge = (g.completionAge || 0) + dt;
        if (g.completionAge + 1e-9 >= MIX.completionHoldSec) this.endGimmick();
      }
      return true;
    }
    tickGimmick(dt) {
      const g = this.gimmick;
      if (!g) return;
      if (g.fluid) {
        if (!g.started) return;
        if (!g.fluid.finishRequested || g.angle > 0) {
          g.elapsed += dt;
          this.craft.elapsed += dt;
        }
        g.fluid.tick(g, dt);
        this.chargePourOverflow(g.fluid);
        if (g.fluid.ready) {
          if (g.pourFinishFx) g.pourFinishFx.age += dt;
          this.endGimmick();
        }
        return;
      }
      MIX.visual(g, dt);
      OPEN.visual(g, dt);
      if (this.tickMixCompletion(dt)) return;
      if (!g.started || g.completed) return;
      g.elapsed += dt;
      if (g.type !== 'open') this.craft.elapsed += dt;
      if (g.type === 'open') {
        OPEN.tick(g, dt);
      } else if (g.type === 'shake') {
        MIX.updatePath(g, this.rng);
        if (!g.feedbackLeft) {
          g.hit = false;
          g.message = '';
        }
      } else if (g.type === 'stir') {
        g.circleTime += dt;
        if (g.circleTime >= this.c('stir_circle_limit_sec', 1.5)) this.finishStirCircle(false);
      }
    }
    currentDialogue() {
      if (this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return null;
      if (this.phase === 'general') {
        const g = this.seats[this.focus];
        return !this.cameraLeft ? g?.lines?.[g.lineIndex] : null;
      }
      return this.dialogue;
    }
    chargePourOverflow(fluid) {
      const whole = Math.floor(fluid.overflowMl + 1e-8),
        cost = Math.max(0, whole - fluid.overflowCharged);
      if (!cost) return;
      fluid.overflowCharged = whole;
      this.progress.money -= cost;
      // Monotonic receipt lets the HUD show individual -1 ticks without audio.
      this.progress.pourWaste = (this.progress.pourWaste || 0) + cost;
      this.changed();
    }
    totals() {
      return this.transactions.reduce((a, t) => ({
        sale: a.sale + t.sale,
        tip: a.tip + t.tip,
        refund: a.refund + t.refund,
        net: a.net + t.net
      }), {
        sale: 0,
        tip: 0,
        refund: 0,
        net: 0
      });
    }
  }
  const api = {
    Game,
    MIX,
    OPEN,
    POUR,
    GRADES,
    millilitreData,
    condition,
    applyEffects,
    scoreCraft,
    buildQueue,
    band,
    seeded,
    clean,
    n,
    clamp
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.LunaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJyb290IiwiUE9VUiIsIm1vZHVsZSIsIkx1bmFQb3VyIiwicmVxdWlyZSIsIkdSQURFUyIsIlRFWFRfU1BFRURfQkFTRSIsImNsYW1wIiwibiIsImEiLCJiIiwiTWF0aCIsIm1heCIsIm1pbiIsInYiLCJkIiwiTnVtYmVyIiwic29ydFNlcSIsInNvcnQiLCJzZXEiLCJjbGVhbiIsInMiLCJTdHJpbmciLCJyZXBsYWNlIiwiT1BFTiIsImluaXQiLCJ0eXBlIiwiT2JqZWN0IiwiYXNzaWduIiwib3BlblBoYXNlIiwicG93ZXJQb3MiLCJwb3dlckRpcmVjdGlvbiIsInBvd2VyUGVyZmVjdCIsInJvdW5kTWlzc2VzIiwib3BlbkRlbGF5IiwiZmFpbCIsIm9mZnNldCIsImZhaWx1cmVzIiwiYmVhdFRpbWUiLCJoaXQiLCJtZXNzYWdlIiwicHJlc3MiLCJjb21wbGV0ZWQiLCJpbmNsdWRlcyIsInN0YXJ0ZWQiLCJhYnMiLCJlcnJvciIsIm9wZW5GeCIsInBlcmZlY3QiLCJ0aWNrIiwiZHQiLCJtaW5pZ2FtZUhvbGRTZWMiLCJjYXJib25hdGlvblNlYyIsIm9rIiwid2luZG93Iiwia2luZCIsImFnZSIsInNlcmlhbCIsInZpc3VhbCIsIk1JWCIsInNoYWtlVGFyZ2V0U3RhY2tzIiwicG9pbnRzIiwicm91dGUiLCJwYXR0ZXJucyIsInJhZGl1cyIsImRlbGF5IiwiZnJhbWVTZWNvbmRzIiwic3RpckZyYW1lU2Vjb25kcyIsInNoYWtlQ2xpcHMiLCJzaGFrZUVmZmVjdHMiLCJtb3Rpb25GcmFtZSIsIm1vdGlvbkFnZSIsIm1vdGlvbkNsaXAiLCJuZXh0TW90aW9uQ2xpcCIsImZlZWRiYWNrTGVmdCIsImhpdEVmZmVjdCIsImJlYXRJbmRleCIsInBhdGhQb2ludCIsInBhdHRlcm5JbmRleCIsInBhdHRlcm5UdXJuIiwibm9kZXMiLCJwYXRoRml4ZWRIaXRzIiwiYXR0ZW1wdFN0YXJ0UG9zIiwic3Bvb25BbmdsZSIsInNwb29uVGFyZ2V0Iiwic3dpcmxTcGVlZCIsInN0aXJNb3Rpb25QZW5kaW5nIiwic3Rpck1vdGlvbkNsb2NrIiwibGF5b3V0IiwiaWNlIiwibWFwIiwieCIsInkiLCJzaXplIiwiZmFjdG9yIiwiaSIsInNwaW4iLCJzaWRlU3BpbiIsInJlc3QiLCJoeXBvdCIsInNpZGVZIiwiaWNlQXZlcmFnZSIsInJlZHVjZSIsImMiLCJsZW5ndGgiLCJpY2VSYWRpdXMiLCJyZXNvbHZlSWNlIiwicGFzcyIsImoiLCJkeCIsImR5IiwibngiLCJueSIsInB1c2giLCJyIiwibGltaXQiLCJmIiwiZXhwIiwiZmlsdGVyIiwiZSIsInJoeXRobSIsIkx1bmFTaGFrZVJoeXRobSIsImZsb29yIiwicmFkIiwiUEkiLCJjb3MiLCJzaW4iLCJ1cGRhdGVQYXRoIiwicm5nIiwiYmVhdHMiLCJlbGFwc2VkIiwiaW5kZXgiLCJ0IiwidHVybiIsImRvd24iLCJsaW5lIiwiZnJvbSIsInRvIiwiaWQiLCJib3JuIiwic3BsaXQiLCJuZWFyZXN0IiwiY2FuZGlkYXRlcyIsImZpeGVkIiwiZGlzdGFuY2UiLCJjb25zdW1lUGF0aE5vZGUiLCJub2RlIiwic2hha2VIaXQiLCJhdHRlbXB0cyIsInN1Y2Nlc3MiLCJvdXRjb21lcyIsImJlYXRTdWNjZXNzIiwic2hpZnQiLCJ0YXJnZXRTdGFja3MiLCJzZWVkZWQiLCJzZWVkIiwiaW11bCIsIndlaWdodGVkIiwicm93cyIsInN1bSIsIndlaWdodCIsImF0IiwiY29udGV4dFZhbHVlIiwia2V5IiwidGVzdCIsInNsaWNlIiwiaW5kZXhPZiIsInN0YXJ0c1dpdGgiLCJmbGFncyIsImFmZmluaXR5IiwiRXJyb3IiLCJjb2NrdGFpbCIsImFidiIsIm9yZGVyZWQiLCJzZXJ2ZWQiLCJ0YWciLCJtYXRjaCIsInRhZ3MiLCJjb25kaXRpb24iLCJleHByIiwiZXZlcnkiLCJyYXciLCJ0cmltIiwibSIsIj09IiwiIT0iLCI+PSIsIjw9IiwiPiIsIjwiLCJhcHBseUVmZmVjdHMiLCJzdGF0ZSIsImJlZm9yZSIsIm5leHQiLCJfIiwib3AiLCJ2YWx1ZSIsIm9iaiIsImsiLCJMdW5hU3RvcnlOb3RpY2VzIiwiZWZmZWN0cyIsImJhbmQiLCJyb3VuZCIsInJvdyIsImZpbmQiLCJiYW5kX3R5cGUiLCJtaW5fcmF0aW8iLCJtaW5faW5jbHVzaXZlIiwibWF4X3JhdGlvIiwibWF4X2luY2x1c2l2ZSIsInNjb3JlX29yX3BlbmFsdHkiLCJtaWxsaWxpdHJlRGF0YSIsImRhdGEiLCJjZmciLCJmcm9tRW50cmllcyIsInRhYmxlcyIsImJhbGFuY2VfY29uZmlnIiwic2V0dGluZyIsImZhY3RvcnMiLCJtbCIsIm96IiwidW5pdF9vel90b19tbCIsInRzcCIsInVuaXRfdHNwX3RvX21sIiwiY29udmVydCIsInF0eSIsInVuaXQiLCJtYXJ0aW5pIiwiZ2luIiwiZHJ5X3Zlcm1vdXRoIiwiY29ja3RhaWxzIiwidW5sb2NrX2RheSIsInJlY2lwZXMiLCJjb250ZXh0IiwiaGFzT3duIiwiaW5ncmVkaWVudCIsInNoZWxmX2l0ZW1zIiwiYnVpbGRRdWV1ZSIsInNlbGVjdGVkIiwiYWN0dWFsIiwicmVjaXBlIiwiaXRlbXMiLCJxdWV1ZSIsImluZ3JlZGllbnRzIiwiaXRlbSIsImF1dG9fYXBwbHkiLCJhY3Rpb24iLCJkZWZhdWx0X2FjdGlvbiIsInByZXBfYWN0aW9uIiwidGFyZ2V0IiwiZGVmYXVsdF90YXJnZXRfcXR5IiwiZGVmYXVsdF90YXJnZXRfdW5pdCIsImluUmVjaXBlIiwidG9vbCIsInJhbmsiLCJvcGVuIiwicG91ciIsInNxdWVlemUiLCJwb3dkZXIiLCJhZGQiLCJzaGFrZSIsInN0aXIiLCJmaWxsX3VwIiwic2NvcmVDcmFmdCIsInJlc3VsdHMiLCJleHBlY3RlZCIsIm1pc3NpbmciLCJleHRyYSIsInNvbWUiLCJzY29yZWQiLCJtaXgiLCJ0YXJnZXRfbWl4X21ldGhvZCIsImJ1Y2tldHMiLCJzY29yZSIsImNvbXBsZXRpb24iLCJpc0Zpbml0ZSIsInNjb3JlX2JhbmRzIiwiZmFtaWx5Iiwid2VpZ2h0ZWRTdW0iLCJ0b3RhbFdlaWdodCIsInJlcHJlc2VudGF0aXZlcyIsInZhbHVlcyIsImVudHJpZXMiLCJtZWFuIiwiY291bnQiLCJyZXByZXNlbnRhdGl2ZVNjb3JlIiwidGFyZ2V0VG9vbCIsInBlbmFsdGllcyIsImdpbW1pY2siLCJnbGFzcyIsImdsYXNzX21pc21hdGNoX3BlbmFsdHkiLCJ0b29sX21pc21hdGNoX3BlbmFsdHkiLCJtaXNzaW5nX2luZ3JlZGllbnRfcGVuYWx0eSIsImV4dHJhX2luZ3JlZGllbnRfcGVuYWx0eSIsIm92ZXJ0aW1lIiwidGltZV9saW1pdF9zZWMiLCJncmFkZSIsImdyYWRlX2N1dHMiLCJtaW5fcGN0IiwiZyIsIm1pc3NpbmdDb3JlIiwiaXNfY29yZSIsInN0cnVjdHVyZWRDbG9uZSIsIkdhbWUiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJzdGlyX2NpcmNsZV9saW1pdF9zZWMiLCJvbkNoYW5nZSIsImxhbmciLCJzcGVlZCIsImRpYWxvZ1NwZWVkIiwicmVhZCIsIlNldCIsInJlc2V0IiwiZGF5IiwibW9kZSIsImZhbGxiYWNrIiwidGV4dCIsIm5hbWUiLCJjaGFyYWN0ZXJzIiwicGVyc29uYWxpdGllcyIsInJ1biIsInNldHRpbmdzIiwidXBrZWVwT3ZlcnJpZGUiLCJwYXJzZVVwa2VlcE92ZXJyaWRlIiwic2VydmljZVZlcnNpb24iLCJxYUtlZXBHZW5lcmFsIiwicHJvZ3Jlc3MiLCJtb25leSIsInJlcHV0YXRpb24iLCJwaGFzZSIsIm9wZW5pbmdCYWxhbmNlIiwiZGFpbHlTZXR0bGVtZW50IiwidGFibGVGYWRlcyIsInBvdXJUb29sIiwidHV0b3JpYWwiLCJzdG9yeUNvYXN0ZXIiLCJwZW5kaW5nRGFpbHlVbmxvY2tzIiwibGFzdFN0b3J5TGluZSIsImNyYWZ0UmVtaW5kZXIiLCJzY3JlZW4iLCJvdmVybGF5IiwicGF1c2VkIiwiaGlkZGVuIiwiY2FtZXJhTGVmdCIsImNhbWVyYU1vdmluZyIsImZvY3VzIiwib3ZlcnZpZXciLCJzZWF0cyIsIkwiLCJNIiwiUiIsImxvZ3MiLCJoaXN0b3J5IiwidHJhbnNhY3Rpb25zIiwidHJhbnNhY3Rpb25JZHMiLCJiYXJUaW1lIiwicmVhbFRpbWUiLCJsb3N0IiwicHJlcCIsImRyaW5rIiwicmVzdWx0IiwiZGlzY2FyZEZlZWRiYWNrIiwiZGlhbG9ndWUiLCJjaG9pY2UiLCJ0cmFuc2l0aW9uIiwicGVuZGluZ1RyYW5zaXRpb24iLCJzdG9yeSIsImN1cnJlbnRPcmRlciIsInJlc3VsdENvbnRleHQiLCJlZmZlY3RWaXN1YWwiLCJiYXJrTGFzdCIsImZpbmlzaGVkIiwic3RvcnlQcmVyZXF1aXNpdGVzIiwic2VlZEpvaG5ueVByZXJlcXVpc2l0ZXMiLCJzdGFydEdlbmVyYWwiLCJzdGFydFN0b3J5UGhhc2UiLCJvcGVuUmVjaXBlcyIsImZyZXNoIiwiZGFpbHlVbmxvY2tzIiwiY2hhbmdlZCIsImxvZyIsImV2ZW50IiwiZGV0YWlscyIsInRpbWUiLCJjbGVhckRlcGFydGVkU2VhdCIsInNlYXQiLCJndWVzdCIsImNvYXN0ZXIiLCJnbGFzc0VtcHR5IiwiZ2xhc3NLaW5kIiwiYmFzZWxpbmUiLCJkdXJhdGlvbiIsImN0eCIsInNhZmUiLCJmbiIsImlzUGF1c2VkIiwiYXZhaWxhYmxlIiwidW5sb2NrX3doZW4iLCJjb2NrdGFpbHNBdmFpbGFibGUiLCJzdGF0dXMiLCJpdGVtc0F2YWlsYWJsZSIsIm5lZWRlZCIsImludmVudG9yeSIsIndpbGRfZG9nIiwiYml0dGVycyIsImNhbXBhaWduX29ic2VydmF0aW9uIiwiam9obm55TWlzc2luZyIsIm1lbW9yeSIsInN1Z2FyIiwiZGF5M19zdWdhcl9yZWNlaXZlZCIsImNoZWNrSm9obm55VW5sb2NrIiwiam9obm55X3JlY2lwZV91bmxvY2tlZCIsInN1Z2FyX2N1YmUiLCJjb25maXJtSm9obm55VW5sb2NrIiwicHVtcCIsImNvbmZpcm1EYWlseVVubG9ja3MiLCJhdXRvcyIsInNjZW5lcyIsInRyaWdnZXIiLCJjdXJzb3IiLCJzY2VuZSIsInN0ZXBzIiwibmV4dFNjZW5lIiwid2hlbiIsImxvYWRTY2VuZSIsImZpbmlzaERheSIsInN0ZXBEb25lIiwic3RlcCIsImd1YXJkIiwib25TdG9yeUN1ZSIsImFyZyIsInNldFRyYW5zaXRpb24iLCJjYW1wYWlnblN0ZXAiLCJtYWtlTGluZSIsImFjdG9yIiwiZGlhbG9ndWVfaWQiLCJzdG9yeUNvYXN0ZXJFbGlnaWJsZSIsImtleXMiLCJ3YWl0Rm9yU3RvcnlDb2FzdGVyIiwiY3JlYXRlU3RvcnlPcmRlciIsImZpcnN0IiwiZ3JvdXAiLCJzeW5jIiwicmVzZXJ2ZWQiLCJoYXMiLCJzZWF0ZWQiLCJlbnRyYW5jZSIsImV4cHJlc3Npb24iLCJyb3N0ZXIiLCJtZWV0IiwiZmFkZSIsInZhcmlhbnQiLCJkYXkwX3NraXBfdHV0b3JpYWwiLCJkYXkwX3NlYXRzX3JldmVhbGVkIiwib3JpZ2luIiwidmlzaXRlZCIsIm1vdmVkIiwic3RvcnlIYXNVcGNvbWluZ09yZGVyIiwiYmFyX2Nob2ljZXMiLCJjaGFycyIsImNyYWZ0U3RlcCIsImJlZXIiLCJzZXJ2aWNlT3BlbmVkIiwiZGF5MF9yZWNpcGVfdGF1Z2h0IiwidW50aWwiLCJkdW1teSIsInN0b3J5Q29hc3RlclJlYWR5Iiwic2VjIiwic3BlYWtlck5hbWUiLCJ0b21fbmFtZV9rbm93biIsInRpbWluZ3MiLCJzcGVlZFN0YWNrIiwicGFydCIsInJ1bGUiLCJ0ZXh0X3RhZ3MiLCJwb3AiLCJob2xkIiwic2VlbiIsInR5cGVNcyIsInR5cGVMaW5lIiwiY3VycmVudERpYWxvZ3VlIiwiTHVuYURpYWxvZ3VlQXVkaW8iLCJyZXZlYWwiLCJmaW5pc2hMaW5lIiwiYW5vbnltb3VzIiwiYWR2YW5jZSIsImNob29zZSIsImdvdG8iLCJmcmVlQ2hvaWNlIiwicGF5bWVudCIsIm9yZGVyIiwiZmluaXNoR2VuZXJhbFNlcnZpY2UiLCJyYW5kb21fd2F2ZXMiLCJyZWd1bGFyX3Nsb3RzIiwicXVldWVJbmRleCIsInNwYXduQmxvY2tlZCIsInNwYXduTGVmdCIsImRlbGF5X3NlYyIsInNsb3RzIiwiYXBwZWFyYW5jZSIsImdlbmRlciIsImlkcyIsImxheWVycyIsInNsb3QiLCJsaXN0IiwiZ3Vlc3RfcGFydHMiLCJwIiwib3B0aW9uYWwiLCJndWVzdF9leGNsdXNpb25zIiwib3V0Zml0IiwiZXllYnJvd3MiLCJhcm1fYWNjZXNzb3J5IiwibmVja2xhY2UiLCJvdXRlcndlYXIiLCJhcnRLZXkiLCJyZXF1ZXN0ZWQiLCJhc3NldHMiLCJkZWZhdWx0cyIsImd1ZXN0X3NldHRpbmdzIiwidXNlZCIsInNwYXduIiwiZnJlZSIsInBlcnNvbmFsaXR5IiwicGF0aWVuY2VfbXVsdCIsImNoYXJhY3RlciIsIm1heFJvdW5kcyIsIm1heF9yb3VuZHMiLCJjb2FzdGVyTGltaXQiLCJsZWZ0Iiwid2FybiIsInBlbmRpbmdXYXJuIiwicmVhc2tpbmciLCJsaW5lcyIsImxpbmVJbmRleCIsImlkbGVMZWZ0IiwibGFzdEdyYWRlIiwic2V0QmFya3MiLCJiYXJrIiwic2l0dWF0aW9uIiwidm9pY2UiLCJiYXJrcyIsInZvaWNlX2lkIiwib2xkIiwicm93X2lkIiwidHh0IiwibmV4dENvY2t0YWlsIiwic2l0dWF0aW9ucyIsIm9uRG9uZSIsImxpbmVEb25lIiwiaW5wdXQiLCJwZW5kaW5nIiwiYmVnaW5PcmRlciIsInJlb3JkZXIiLCJ0aGlua19jaGFuY2UiLCJyZWFzayIsImNvc3QiLCJyZW1haW5pbmciLCJsZWF2ZSIsImxldmVsIiwiZXhpdExlZnQiLCJ0dXRvcmlhbFNlYXRUYXJnZXQiLCJ1cGRhdGVTZWF0VHV0b3JpYWwiLCJjb250aW51ZUJhclR1dG9yaWFsIiwiZm9jdXNTZWF0IiwiZXhwbG9yaW5nIiwiY2FtZXJhU2FtZSIsImFmdGVyQ2FtZXJhIiwiY2xlYW5PbGRHbGFzcyIsInRvZ2dsZU92ZXJ2aWV3Iiwib3BlblR1dG9yaWFsU2VydmljZSIsImNsb3NlUmVjaXBlcyIsInNlbGVjdENvY2t0YWlsIiwidHV0b3JpYWxFdmVudCIsImJlZXJUb29sTmF2aWdhdGUiLCJiZWVyRnJpZGdlTmF2aWdhdGUiLCJwcmVwUmVjaXBlT3BlbiIsInByZXBSZWNpcGVSZWFkIiwicHJlcFJlY2lwZUNsb3NlIiwicHJlcE5hdmlnYXRlIiwicHJlcEhvdmVyIiwicHJlcFNvZGFOYXZpZ2F0ZSIsInByZXBTb2RhSG92ZXIiLCJwaWNrSXRlbSIsImFsbG93ZWQiLCJiZWVyR2xhc3MiLCJiZWVyQWRkIiwicHJlcEFkZCIsInByZXBSZW1vdmUiLCJwcmVwR2xhc3MiLCJwcmVwR2luQWdhaW4iLCJwcmVwU29kYUFkZCIsInNwbGljZSIsIm9wZW5lciIsInBpY2tPcGVuZXIiLCJwcmVwQmFjayIsInN0YXJ0Q3JhZnQiLCJjcmFmdCIsIm5leHRHaW1taWNrIiwiY3JhZnRfZ3JhZGUiLCJoZWxkIiwiYW5nbGUiLCJzdGlyUG9zIiwic3RpclN0ZXAiLCJjaXJjbGVUaW1lIiwib3BlblR1dG9yaWFsIiwiZmx1aWQiLCJtaW5pZ2FtZSIsImRheTBfcG91cl90YXVnaHQiLCJwb3VyVHV0b3JpYWwiLCJzdGFydEdpbW1pY2siLCJnaW1taWNrSW5wdXQiLCJob2xkUG91ciIsImZpbmlzaFJlcXVlc3RlZCIsImtleU1hcCIsIktleVciLCJBcnJvd1VwIiwiS2V5RCIsIkFycm93UmlnaHQiLCJLZXlTIiwiQXJyb3dEb3duIiwiS2V5QSIsIkFycm93TGVmdCIsImRpciIsImZpbmlzaFN0aXJDaXJjbGUiLCJhY2NlcHRlZCIsImVuZEdpbW1pY2siLCJyZWFkeSIsInJlcXVlc3RGaW5pc2giLCJwb3VyRmluaXNoRngiLCJlcnJvck1sIiwiY2F1Z2h0TWwiLCJ0YXJnZXRNbCIsImRheTFfb3Blbl90YXVnaHQiLCJleHRyYVByZXNzZXMiLCJlbmRUeXBlIiwibGlxdWlkIiwiYXVkaXQiLCJyZXRyeURhdGFFcnJvciIsImNhbmNlbENyYWZ0IiwiZGlzY2FyZCIsInByaWNlIiwiYWZ0ZXIiLCJzdGFydGVkQXQiLCJvZmZlciIsImRheTBfZHJpbmtfdGF1Z2h0IiwicmVzb2x2ZVNlcnZlIiwic2V3YWdlIiwib3JkZXJJZCIsImRyaW5rSWQiLCJjcmFmdEdyYWRlIiwic2V0dGxlIiwic2V0dGxlbWVudF9ydWxlcyIsInNhbGUiLCJzYWxlX3JhdGUiLCJ0aXAiLCJ0aXBfcmF0ZSIsInRpcF9tdWx0IiwicmVmdW5kIiwicmVmdW5kX3JhdGUiLCJ0cngiLCJuZXQiLCJzZXJ2ZSIsInNlcnZlX2VmZmVjdHMiLCJyZW9yZGVyTGVmdCIsImZpbmFsX2dyYWRlIiwib3JkZXJfbWF0Y2giLCJjb2NrdGFpbF90YWdzIiwia28iLCJhcHBseUFmZmluaXR5IiwidGFzdGUiLCJ0YXN0ZXMiLCJjaGFyYWN0ZXJfaWQiLCJ0aWVyIiwiYWZmaW5pdHlfbWF0cml4IiwidGFzdGVfdGllciIsImRlbHRhIiwiYW1vdW50IiwiaXNTYWZlSW50ZWdlciIsInVwa2VlcEluZm8iLCJzb3VyY2UiLCJkYXlzIiwidXBrZWVwX2dvbGQiLCJzZXRVcGtlZXBPdmVycmlkZSIsInJlc3RvcmVkRGF0YURlZmF1bHQiLCJ1cGtlZXAiLCJ0b3RhbHMiLCJvdGhlckNoYW5nZXMiLCJiYWxhbmNlQmVmb3JlIiwicHJvamVjdGVkQmFsYW5jZSIsInNob3J0ZmFsbCIsImJhbGFuY2VBZnRlciIsIm9yZGVycyIsInVwa2VlcFNvdXJjZSIsImNvbmZpcm1EYWlseVNldHRsZW1lbnQiLCJzZXR0bGVtZW50SWQiLCJyZXF1aXJlZCIsInJlYXNvbiIsImRlYnVnRmlsbCIsImRlYnVnQ3JhZnQiLCJxIiwiZXhjZWxsZW50IiwiZ29vZCIsImRlY2VudCIsInBvb3IiLCJkZWJ1ZyIsImhvbGRTcGVlY2giLCJ0aWNrR2ltbWljayIsInRpY2tHZW5lcmFsIiwicmVhbER0IiwiQm9vbGVhbiIsImNoYXJnZVBvdXJPdmVyZmxvdyIsIndob2xlIiwib3ZlcmZsb3dNbCIsIm92ZXJmbG93Q2hhcmdlZCIsInBvdXJXYXN0ZSIsImFwaSIsImV4cG9ydHMiLCJMdW5hQ29yZSIsImdsb2JhbFRoaXMiXSwic291cmNlcyI6WyJjb3JlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihyb290KXtcbid1c2Ugc3RyaWN0JztcbmNvbnN0IFBPVVI9dHlwZW9mIG1vZHVsZT09PSd1bmRlZmluZWQnP3Jvb3QuTHVuYVBvdXI6cmVxdWlyZSgnLi9zcmMvZmVhdHVyZXMvY3JhZnRpbmcvcG91ci1mbHVpZC5qcycpO1xuY29uc3QgR1JBREVTPVsnc2V3YWdlJywncG9vcicsJ2RlY2VudCcsJ2dvb2QnLCdleGNlbGxlbnQnXTtcbi8vIFdlYi1vbmx5IHR5cGluZyBiYXNlbGluZTsga2VlcCBzb3VyY2UgdGltaW5ncywgcmVhZCBob2xkcywgcGF0aWVuY2UgYW5kIGFuaW1hdGlvbiBjbG9ja3MgdW5jaGFuZ2VkLlxuY29uc3QgVEVYVF9TUEVFRF9CQVNFPTM7XG5jb25zdCBjbGFtcD0obixhLGIpPT5NYXRoLm1heChhLE1hdGgubWluKGIsbikpO1xuY29uc3Qgbj0odixkPTApPT52PT1udWxsfHx2PT09Jyc/ZDpOdW1iZXIodik7XG5jb25zdCBzb3J0U2VxPWE9PlsuLi5hXS5zb3J0KChhLGIpPT5uKGEuc2VxKS1uKGIuc2VxKSk7XG5jb25zdCBjbGVhbj1zPT5TdHJpbmcocz8/JycpLnJlcGxhY2UoLzxbXj5dKj4vZywnJyk7XG4vLyBFbmdpbmUgaW5wdXQvYW5pbWF0aW9uIGNvbnRyYWN0LCBpbnNwZWN0ZWQgYWdhaW5zdCBQbGF5LnVuaXR5J3MgTkVXIHByZWZhYnMuXG4vLyBUaGUgd2ViIGJvYXJkIG5vcm1hbGl6ZXMgdGhlIDk2MHg1NDAgKFBQVTEwMCAvIG9ydGhvMi43KSBjcmFmdCB2aWV3OyBzZWUgUkVBRE1FLlxuY29uc3QgT1BFTj17XG4gaW5pdChzKXtpZihzLnR5cGUhPT0nb3BlbicpcmV0dXJuO09iamVjdC5hc3NpZ24ocyx7b3BlblBoYXNlOidyZWFkeScscG93ZXJQb3M6MCxwb3dlckRpcmVjdGlvbjoxLHBvd2VyUGVyZmVjdDpmYWxzZSxyb3VuZE1pc3NlczowLG9wZW5EZWxheTowfSk7fSxcbiBmYWlsKHMsb2Zmc2V0PTApe3MuZmFpbHVyZXMrKztzLnJvdW5kTWlzc2VzKys7cy5iZWF0VGltZT0wO3RoaXMuaGl0KHMsZmFsc2Usb2Zmc2V0KTtzLm1lc3NhZ2U9J+uLpOyLnCDtg4DsnbTrsI3snYQg66ee7LawIOyjvOyEuOyalCc7aWYocy5yb3VuZE1pc3Nlcz49Myl7cy5vcGVuUGhhc2U9J2Jyb2tlbic7cy5vcGVuRGVsYXk9MS4yO3MubWVzc2FnZT0n67OR7J20IOq5qOyhjOyWtOyalCDCtyDri6Tsi5wg7Iuc64+EJzt9ZWxzZSBpZihzLm9wZW5QaGFzZT09PSdwb3dlcicpcy5wb3dlclBvcz0wO30sXG4gcHJlc3Mocyl7XG4gIGlmKHMuY29tcGxldGVkfHxbJ2Jyb2tlbicsJ3Bvd2VyLWRvbmUnXS5pbmNsdWRlcyhzLm9wZW5QaGFzZSkpcmV0dXJuIGZhbHNlO1xuICBpZighcy5zdGFydGVkfHxzLm9wZW5QaGFzZT09PSdyZWFkeScpe3Muc3RhcnRlZD10cnVlO3Mub3BlblBoYXNlPSdwb3dlcic7cy5wb3dlclBvcz0wO3MubWVzc2FnZT0n7LSI66GdIOq1rOqwhOyXkOyEnCDtnpjsnYQg66ee7LawIOyjvOyEuOyalCc7cmV0dXJuIHRydWU7fVxuICBpZihzLm9wZW5QaGFzZT09PSdwb3dlcicpe2NvbnN0IGQ9TWF0aC5hYnMocy5wb3dlclBvcy0uNzgpO2lmKGQ8PS4xNTIpe3MucG93ZXJQZXJmZWN0PWQ8PS4wODtzLm9wZW5QaGFzZT0ncG93ZXItZG9uZSc7cy5vcGVuRGVsYXk9LjQ1O3MubWVzc2FnZT0n7Z6YIOyhsOygiCDshLHqs7Ugwrcg64uk7J2M7J2AIOungSDtg4DsnbTrsI0nO31lbHNlIHRoaXMuZmFpbChzLHMucG93ZXJQb3MtLjc4KTtyZXR1cm4gdHJ1ZTt9XG4gIGNvbnN0IGVycm9yPXMuYmVhdFRpbWUtMS4xO1xuICBpZihNYXRoLmFicyhlcnJvcik8PS4xNCl7cy5jb21wbGV0ZWQ9dHJ1ZTtzLm9wZW5QaGFzZT0ncG9wJztzLm1lc3NhZ2U9J09QRU4nO3RoaXMuaGl0KHMsdHJ1ZSxlcnJvciwuMjE2Nyk7cy5vcGVuRngucGVyZmVjdD1zLnBvd2VyUGVyZmVjdCYmTWF0aC5hYnMoZXJyb3IpPD0uMDY1O31cbiAgZWxzZSB0aGlzLmZhaWwocyxlcnJvcik7cmV0dXJuIHRydWU7XG4gfSxcbiB0aWNrKHMsZHQpe1xuICBpZihzLm9wZW5QaGFzZT09PSdwb3dlcicpe3MucG93ZXJQb3MrPXMucG93ZXJEaXJlY3Rpb24qMS4xKmR0O2lmKHMucG93ZXJQb3M+PTEpe3MucG93ZXJQb3M9MTtzLnBvd2VyRGlyZWN0aW9uPS0xO31pZihzLnBvd2VyUG9zPD0wKXtzLnBvd2VyUG9zPTA7cy5wb3dlckRpcmVjdGlvbj0xO319XG4gIGVsc2UgaWYocy5vcGVuUGhhc2U9PT0ncG93ZXItZG9uZSd8fHMub3BlblBoYXNlPT09J2Jyb2tlbicpe3Mub3BlbkRlbGF5LT1kdDtpZihzLm9wZW5EZWxheTw9MCl7aWYocy5vcGVuUGhhc2U9PT0nYnJva2VuJyl7cy5yb3VuZE1pc3Nlcz0wO3Mub3BlblBoYXNlPSdwb3dlcic7cy5wb3dlclBvcz0wO3MubWVzc2FnZT0n7LSI66GdIOq1rOqwhOyXkOyEnCDri6Tsi5wg7Iuc7J6RJzt9ZWxzZXtzLm9wZW5QaGFzZT0ncmh5dGhtJztzLmJlYXRUaW1lPTA7cy5tZXNzYWdlPSfsm5DsnbQg66eB7JeQIOqyuey5oCDrlYwg64iE66W07IS47JqUJzt9fX1cbiAgZWxzZSBpZihzLm9wZW5QaGFzZT09PSdyaHl0aG0nKXtzLmJlYXRUaW1lKz1kdDtpZihzLmJlYXRUaW1lPjEuMjQpdGhpcy5mYWlsKHMscy5iZWF0VGltZS0xLjEpO31cbiB9LFxuIG1pbmlnYW1lSG9sZFNlYzo0LjEsIC8vIEFsbG93IDQ1MG1zIGRlbGF5ICsgMy41cyBmaXp6IGFuZCBhIHNtYWxsIHJlbmRlciBtYXJnaW4uXG4gY2FyYm9uYXRpb25TZWM6Mi4wNSwgLy8gTGV0IHRoZSByaXNpbmcgYm90dGxlIGJ1YmJsZSBjbHVzdGVyIGZpbmlzaCBiZWZvcmUgdGhlIG5leHQgc3RlcC5cbiBoaXQocyxvayxvZmZzZXQ9MCx3aW5kb3c9MTApe3Mub3BlbkZ4PXtraW5kOm9rPydzdWNjZXNzJzonbWlzcycscGVyZmVjdDpvayYmTWF0aC5hYnMob2Zmc2V0KTw9d2luZG93Ki4zKzFlLTgsb2Zmc2V0LGFnZTowLHNlcmlhbDoocy5vcGVuRng/LnNlcmlhbHx8MCkrMX07fSxcbiB2aXN1YWwocyxkdCl7aWYocy50eXBlPT09J29wZW4nJiZzLm9wZW5GeClzLm9wZW5GeC5hZ2U9TWF0aC5taW4oT1BFTi5taW5pZ2FtZUhvbGRTZWMscy5vcGVuRnguYWdlK2R0KTt9XG59O1xuY29uc3QgTUlYPXtcbiBzaGFrZVRhcmdldFN0YWNrczoyMCwgLy8gV2ViIHBsYXl0ZXN0IHR1bmluZzsgc291cmNlIENTViBhbmQgc3RpciBjb3VudHMgcmVtYWluIHVuY2hhbmdlZC5cbiBwb2ludHM6W1swLDBdLFsyLjYxLDEuMjA2ODc1XSxbMCwyLjU2XSxbMi42MSwzLjc2Njg3NV1dLHJvdXRlOlswLDEsMiwzLDIsMV0sXG4gcGF0dGVybnM6W1tbMCwuMzddLFsyLC40N11dLFtbMCwuMjhdLFswLC4zOF0sWzEsLjM4XSxbMiwuNDldLFsyLC41Nl1dLFtbMCwuMzldLFswLC41N10sWzEsLjMyXSxbMSwuNDhdLFsyLC41NV0sWzIsLjgyXV0sW1swLC4yOF0sWzEsLjMyXSxbMiwuNTVdXV0sXG4gcmFkaXVzOi4yNSxkZWxheTouMSxmcmFtZVNlY29uZHM6LjEyNSxzdGlyRnJhbWVTZWNvbmRzOjEvMTIsc2hha2VDbGlwczpbWzEsMiwzLDBdLFs1LDYsNyw0XV0sXG4gaW5pdChzKXtcbiAgaWYoIVsnc2hha2UnLCdzdGlyJ10uaW5jbHVkZXMocy50eXBlKSlyZXR1cm47XG4gIHMuc2hha2VFZmZlY3RzPVtdO1xuICBzLm1vdGlvbkZyYW1lPTA7cy5tb3Rpb25BZ2U9bnVsbDtzLm1vdGlvbkNsaXA9MDtzLm5leHRNb3Rpb25DbGlwPTA7cy5mZWVkYmFja0xlZnQ9MDtzLmhpdEVmZmVjdD1udWxsO1xuICBzLmJlYXRJbmRleD0tMTtzLnBhdGhQb2ludD1bLi4udGhpcy5wb2ludHNbMF1dO3MucGF0dGVybkluZGV4PS0xO3MucGF0dGVyblR1cm49LTE7cy5ub2Rlcz1bXTtzLnBhdGhGaXhlZEhpdHM9W107cy5hdHRlbXB0U3RhcnRQb3M9MDtcbiAgcy5zcG9vbkFuZ2xlPTA7cy5zcG9vblRhcmdldD0wO3Muc3dpcmxTcGVlZD0wO3Muc3Rpck1vdGlvblBlbmRpbmc9MDtzLnN0aXJNb3Rpb25DbG9jaz0wO1xuICBjb25zdCBsYXlvdXQ9W1stMjguNDksMjIuMzMsNDEuNTgsLjldLFszMC4wMywxOS4yNSwzOC4yNTM2LC0uNzVdLFstLjc3LC0zMS41NywzNC45MjcyLC42NV0sWy0zMC4wMywtMjAuNzksMjcuNDQyODAyLC0uODVdLFszMS41NywtMjYuOTUsMjkuMTA2LC42XSxbMy44NSwzNy43MywyNC4xMTY0LC0uNjJdXTtcbiAgcy5pY2U9bGF5b3V0Lm1hcCgoW3gseSxzaXplLGZhY3Rvcl0saSk9Pih7eCx5LHNpemUsZmFjdG9yLHNwaW46MCxzaWRlU3BpbjowLHJlc3Q6TWF0aC5taW4oTWF0aC5oeXBvdCh4LHkpLDcyLjUtc2l6ZSouNSksc2lkZVk6WzI4LjIsMjkuMjA4LDMwLjIxNiwzMi40ODQsMzEuOTgsMzMuNDkyXVtpXX0pKTtcbiAgcy5pY2VBdmVyYWdlPXMuaWNlLnJlZHVjZSgobixjKT0+bitNYXRoLmh5cG90KGMueCxjLnkpLDApL3MuaWNlLmxlbmd0aDtcbiAgcy5pY2VSYWRpdXM9TWF0aC5tYXgoLi4ucy5pY2UubWFwKGM9Pk1hdGguaHlwb3QoYy54LGMueSkpKTt0aGlzLnJlc29sdmVJY2UocywwKTtcbiB9LFxuIHJlc29sdmVJY2UocyxkdCl7XG4gIGZvcihsZXQgcGFzcz0wO3Bhc3M8MjtwYXNzKyspe1xuICAgZm9yKGxldCBpPTA7aTxzLmljZS5sZW5ndGg7aSsrKWZvcihsZXQgaj1pKzE7ajxzLmljZS5sZW5ndGg7aisrKXtcbiAgICBjb25zdCBhPXMuaWNlW2ldLGI9cy5pY2Vbal0sZHg9Yi54LWEueCxkeT1iLnktYS55LGQ9TWF0aC5oeXBvdChkeCxkeSksbWluPShhLnNpemUrYi5zaXplKSouNTtcbiAgICBpZihkPj1taW4pY29udGludWU7Y29uc3Qgbng9ZD4uMDAwMT9keC9kOjEsbnk9ZD4uMDAwMT9keS9kOjAscHVzaD0obWluLWQpKi41O1xuICAgIGEueC09bngqcHVzaDthLnktPW55KnB1c2g7Yi54Kz1ueCpwdXNoO2IueSs9bnkqcHVzaDtcbiAgIH1cbiAgIGZvcihjb25zdCBjIG9mIHMuaWNlKXtjb25zdCByPU1hdGguaHlwb3QoYy54LGMueSksbGltaXQ9NzIuNS1jLnNpemUqLjU7aWYocj5saW1pdCl7Yy54Kj1saW1pdC9yO2MueSo9bGltaXQvcjt9fVxuICB9XG4gIGlmKGR0PjApZm9yKGNvbnN0IGMgb2Ygcy5pY2Upe2NvbnN0IHI9TWF0aC5oeXBvdChjLngsYy55KTtpZihyPi4wMDAxKXtjb25zdCBmPShyKyhjLnJlc3QtcikqKDEtTWF0aC5leHAoLTQqZHQpKSkvcjtjLngqPWY7Yy55Kj1mO319XG4gfSxcbiB2aXN1YWwocyxkdCl7XG4gIGlmKCFbJ3NoYWtlJywnc3RpciddLmluY2x1ZGVzKHMudHlwZSkpcmV0dXJuO1xuICBzLmZlZWRiYWNrTGVmdD1NYXRoLm1heCgwLHMuZmVlZGJhY2tMZWZ0LWR0KTtcbiAgaWYocy5oaXRFZmZlY3Qpe3MuaGl0RWZmZWN0LmFnZSs9ZHQ7aWYocy5oaXRFZmZlY3QuYWdlPj0uNSlzLmhpdEVmZmVjdD1udWxsO31cbiAgaWYocy50eXBlPT09J3NoYWtlJyl7XG4gICBzLnNoYWtlRWZmZWN0cz1zLnNoYWtlRWZmZWN0cy5maWx0ZXIoZT0+KGUuYWdlKz1kdCk8LjU1KTtcbiAgIGlmKHMucmh5dGhtKXtyb290Lkx1bmFTaGFrZVJoeXRobS52aXN1YWwocyxkdCk7cmV0dXJuO31cbiAgIGlmKHMubW90aW9uQWdlIT09bnVsbCl7cy5tb3Rpb25BZ2UrPWR0O3MubW90aW9uRnJhbWU9dGhpcy5zaGFrZUNsaXBzW3MubW90aW9uQ2xpcF1bTWF0aC5taW4oMyxNYXRoLmZsb29yKHMubW90aW9uQWdlL3RoaXMuZnJhbWVTZWNvbmRzKSldO31cbiAgIHJldHVybjtcbiAgfVxuICBzLnNwb29uQW5nbGUrPShzLnNwb29uVGFyZ2V0LXMuc3Bvb25BbmdsZSkqKDEtTWF0aC5leHAoLTEwKmR0KSk7XG4gIGlmKE1hdGguYWJzKHMuc3Bvb25UYXJnZXQtcy5zcG9vbkFuZ2xlKTwuMDEpcy5zcG9vbkFuZ2xlPXMuc3Bvb25UYXJnZXQ7XG4gIC8vIENvcnJlY3QgaW5wdXRzIGZ1bmQgYSBzaG9ydCAxMiBGUFMgaGFuZCBnZXN0dXJlLiBQcmVzZXJ2ZSBpdHMgcGhhc2UgYWNyb3NzIGlucHV0cztcbiAgLy8gbmV2ZXIgcXVhbnRpemUgdGhlIGV4cG9uZW50aWFsbHkgZWFzZWQgc3Bvb24gYW5nbGUgb3IgYWNjdW11bGF0ZSBhIGxvbmcgYXV0b3BsYXkgdGFpbC5cbiAgaWYocy5zdGlyTW90aW9uUGVuZGluZyl7XG4gICBzLnN0aXJNb3Rpb25DbG9jays9ZHQ7XG4gICB3aGlsZShzLnN0aXJNb3Rpb25QZW5kaW5nJiZzLnN0aXJNb3Rpb25DbG9jaysxZS05Pj10aGlzLnN0aXJGcmFtZVNlY29uZHMpe1xuICAgIHMuc3Rpck1vdGlvbkNsb2NrPU1hdGgubWF4KDAscy5zdGlyTW90aW9uQ2xvY2stdGhpcy5zdGlyRnJhbWVTZWNvbmRzKTtcbiAgICBzLm1vdGlvbkZyYW1lPShzLm1vdGlvbkZyYW1lKzEpJTY7cy5zdGlyTW90aW9uUGVuZGluZy0tO1xuICAgfVxuICAgaWYoIXMuc3Rpck1vdGlvblBlbmRpbmcpcy5zdGlyTW90aW9uQ2xvY2s9MDtcbiAgfVxuICBzLnN3aXJsU3BlZWQqPU1hdGguZXhwKC0xLjIqZHQpO2lmKHMuc3dpcmxTcGVlZDwuMDUpcy5zd2lybFNwZWVkPTA7XG4gIGlmKCFzLnN3aXJsU3BlZWQpcmV0dXJuO1xuICBmb3IoY29uc3QgYyBvZiBzLmljZSl7XG4gICBjb25zdCByYWRpdXM9TWF0aC5oeXBvdChjLngsYy55KSxmYWN0b3I9cmFkaXVzPD0uMDE/MS4zNTpjbGFtcCgocy5pY2VBdmVyYWdlL3JhZGl1cykqKi44LDEvMS4zNSwxLjM1KSxyYWQ9LXMuc3dpcmxTcGVlZCpmYWN0b3IqZHQqTWF0aC5QSS8xODA7XG4gICBjb25zdCB4PWMueCpNYXRoLmNvcyhyYWQpLWMueSpNYXRoLnNpbihyYWQpO2MueT1jLngqTWF0aC5zaW4ocmFkKStjLnkqTWF0aC5jb3MocmFkKTtjLng9eDtcbiAgIGMuc3Bpbi09cy5zd2lybFNwZWVkKmMuZmFjdG9yKmR0O2Muc2lkZVNwaW4tPXMuc3dpcmxTcGVlZCpjLmZhY3RvcipkdDtcbiAgfVxuICB0aGlzLnJlc29sdmVJY2UocyxkdCk7XG4gfSxcbiB1cGRhdGVQYXRoKHMscm5nKXtcbiAgY29uc3QgYmVhdHM9TWF0aC5tYXgoMCxzLmVsYXBzZWQtdGhpcy5kZWxheSksaW5kZXg9TWF0aC5mbG9vcihiZWF0cyksdD1iZWF0cy1pbmRleDtcbiAgcy5iZWF0VGltZT10O3MuYmVhdEluZGV4PWluZGV4O1xuICBjb25zdCB0dXJuPU1hdGguZmxvb3IoaW5kZXgvMyk7XG4gIGlmKHMuZWxhcHNlZD49dGhpcy5kZWxheSYmdHVybiE9PXMucGF0dGVyblR1cm4pe1xuICAgcy5wYXR0ZXJuVHVybj10dXJuO1xuICAgaWYodHVybiUyPT09MHx8cy5wYXR0ZXJuSW5kZXg8MClzLnBhdHRlcm5JbmRleD1NYXRoLmZsb29yKHJuZygpKnRoaXMucGF0dGVybnMubGVuZ3RoKTtcbiAgIGNvbnN0IGRvd249dHVybiUyPT09MDtcbiAgIHMubm9kZXM9dGhpcy5wYXR0ZXJuc1tzLnBhdHRlcm5JbmRleF0ubWFwKChbbGluZSxmXSxpKT0+e1xuICAgIGNvbnN0IGZyb209ZG93bj9saW5lOjMtbGluZSx0bz1kb3duP2Zyb20rMTpmcm9tLTEsYT10aGlzLnBvaW50c1tmcm9tXSxiPXRoaXMucG9pbnRzW3RvXTtcbiAgICByZXR1cm57aWQ6dHVybisnOicraSx4OmFbMF0rKGJbMF0tYVswXSkqZix5OmFbMV0rKGJbMV0tYVsxXSkqZixib3JuOnMuZWxhcHNlZH07XG4gICB9KTtcbiAgfVxuICBzLm5vZGVzPXMubm9kZXMuZmlsdGVyKG49PnMuZWxhcHNlZC1uLmJvcm48MTApO1xuICBjb25zdCBhPXRoaXMucG9pbnRzW3RoaXMucm91dGVbaW5kZXglNl1dLGI9dGhpcy5wb2ludHNbdGhpcy5yb3V0ZVsoaW5kZXgrMSklNl1dO1xuICAvLyBTZXJpYWxpemVkIGVhc2U9MSAoTGluZWFyKSwgbm90IHRoZSBDIyBmaWVsZCdzIGRlZmF1bHQgSW5PdXRRdWFkLlxuICBzLnBhdGhQb2ludD1zLmVsYXBzZWQ8dGhpcy5kZWxheT9bLi4udGhpcy5wb2ludHNbMF1dOlthWzBdKyhiWzBdLWFbMF0pKnQsYVsxXSsoYlsxXS1hWzFdKSp0XTtcbiAgLy8gQSBmaXhlZCBub2RlIHJlYXJtcyBvbmx5IGFmdGVyIHRoZSBtYXJrZXIgaGFzIGxlZnQgaXRzIGhpdCBhcmVhLlxuICBzLnBhdGhGaXhlZEhpdHM9KHMucGF0aEZpeGVkSGl0c3x8W10pLmZpbHRlcihpZD0+e2NvbnN0IFt4LHldPXRoaXMucG9pbnRzW051bWJlcihpZC5zcGxpdCgnOicpWzFdKV07cmV0dXJuIE1hdGguaHlwb3QoeC1zLnBhdGhQb2ludFswXSx5LXMucGF0aFBvaW50WzFdKTw9dGhpcy5yYWRpdXM7fSk7XG4gfSxcbiBuZWFyZXN0KHMpe1xuICBjb25zdCBjYW5kaWRhdGVzPVsuLi5zLm5vZGVzLC4uLnRoaXMucG9pbnRzLm1hcCgoW3gseV0saSk9Pih7aWQ6J2ZpeGVkOicraSx4LHksZml4ZWQ6dHJ1ZX0pKV07XG4gIHJldHVybiBjYW5kaWRhdGVzLmZpbHRlcihuPT4hbi5maXhlZHx8IShzLnBhdGhGaXhlZEhpdHN8fFtdKS5pbmNsdWRlcyhuLmlkKSkubWFwKG49Pih7Li4ubixkaXN0YW5jZTpNYXRoLmh5cG90KG4ueC1zLnBhdGhQb2ludFswXSxuLnktcy5wYXRoUG9pbnRbMV0pfSkpLmZpbHRlcihuPT5uLmRpc3RhbmNlPD10aGlzLnJhZGl1cykuc29ydCgoYSxiKT0+YS5kaXN0YW5jZS1iLmRpc3RhbmNlKVswXXx8bnVsbDtcbiB9LFxuIGNvbnN1bWVQYXRoTm9kZShzLG5vZGUpe1xuICBpZighbm9kZSlyZXR1cm47XG4gIGlmKG5vZGUuZml4ZWQpe3MucGF0aEZpeGVkSGl0c3x8PVtdO2lmKCFzLnBhdGhGaXhlZEhpdHMuaW5jbHVkZXMobm9kZS5pZCkpcy5wYXRoRml4ZWRIaXRzLnB1c2gobm9kZS5pZCk7fVxuICBlbHNlIHMubm9kZXM9cy5ub2Rlcy5maWx0ZXIobj0+bi5pZCE9PW5vZGUuaWQpO1xuIH0sXG4gc2hha2VIaXQocyl7XG4gIGNvbnN0IG5vZGU9dGhpcy5uZWFyZXN0KHMpLG9rPSEhbm9kZTtcbiAgdGhpcy5jb25zdW1lUGF0aE5vZGUocyxub2RlKTtcbiAgcy5hdHRlbXB0cysrO3Muc3VjY2Vzcys9b2s/MTowO3MuZmFpbHVyZXMrPW9rPzA6MTtzLm91dGNvbWVzLnB1c2gob2spO3MuaGl0PXRydWU7cy5iZWF0U3VjY2Vzcz1vaztzLm1lc3NhZ2U9b2s/J0dPT0QnOidNSVNTJztzLmZlZWRiYWNrTGVmdD0uMzU7XG4gIHMuaGl0RWZmZWN0PXt4Om5vZGU/Lng/P3MucGF0aFBvaW50WzBdLHk6bm9kZT8ueT8/cy5wYXRoUG9pbnRbMV0sb2ssYWdlOjB9O1xuICBpZihvayl7cy5tb3Rpb25DbGlwPXMubmV4dE1vdGlvbkNsaXA7cy5uZXh0TW90aW9uQ2xpcD0xLXMubmV4dE1vdGlvbkNsaXA7cy5tb3Rpb25BZ2U9MDtzLm1vdGlvbkZyYW1lPXRoaXMuc2hha2VDbGlwc1tzLm1vdGlvbkNsaXBdWzBdO31cbiAgcy5zaGFrZUVmZmVjdHMucHVzaCh7Li4ucy5oaXRFZmZlY3QsaWQ6cy5hdHRlbXB0c30pO2lmKHMuc2hha2VFZmZlY3RzLmxlbmd0aD4xMilzLnNoYWtlRWZmZWN0cy5zaGlmdCgpO1xuICBpZihzLmF0dGVtcHRzPj1zLnRhcmdldFN0YWNrcylzLmNvbXBsZXRlZD10cnVlO1xuICByZXR1cm4gb2s7XG4gfVxufTtcblxuZnVuY3Rpb24gc2VlZGVkKHNlZWQpe2xldCBzPXNlZWQ+Pj4wO3JldHVybigpPT57cz0oTWF0aC5pbXVsKDE2NjQ1MjUscykrMTAxMzkwNDIyMyk+Pj4wO3JldHVybiBzLzQyOTQ5NjcyOTY7fTt9XG5mdW5jdGlvbiB3ZWlnaHRlZChyb3dzLHJuZyl7bGV0IHN1bT1yb3dzLnJlZHVjZSgoYSxyKT0+YStuKHIud2VpZ2h0LDEpLDApLHg9cm5nKCkqc3VtO2Zvcihjb25zdCByIG9mIHJvd3Mpe3gtPW4oci53ZWlnaHQsMSk7aWYoeDw9MClyZXR1cm4gcjt9cmV0dXJuIHJvd3MuYXQoLTEpO31cbmZ1bmN0aW9uIGNvbnRleHRWYWx1ZShrZXksYyl7XG4gaWYoa2V5PT09J3RydWUnKXJldHVybiB0cnVlO2lmKGtleT09PSdmYWxzZScpcmV0dXJuIGZhbHNlO2lmKC9eWy0rXT9cXGQrKFxcLlxcZCspPyQvLnRlc3Qoa2V5KSlyZXR1cm4gTnVtYmVyKGtleSk7XG4gaWYoL14oWydcIl0pLipcXDEkLy50ZXN0KGtleSkpcmV0dXJuIGtleS5zbGljZSgxLC0xKTtcbiBpZihHUkFERVMuaW5jbHVkZXMoa2V5KSlyZXR1cm4gR1JBREVTLmluZGV4T2Yoa2V5KTtcbiBpZihrZXkuc3RhcnRzV2l0aCgnZmxhZy4nKSlyZXR1cm4gYy5mbGFnc1trZXkuc2xpY2UoNSldPz9mYWxzZTtcbiBpZihrZXkuc3RhcnRzV2l0aCgnYWZmaW5pdHkuJykpcmV0dXJuIGMuYWZmaW5pdHlba2V5LnNsaWNlKDkpXT8/MDtcbiBpZihbJ2RheScsJ21vbmV5JywncGhhc2UnLCdyZXB1dGF0aW9uJ10uaW5jbHVkZXMoa2V5KSlyZXR1cm4gY1trZXldPz8wO1xuIGlmKFsnZ3JhZGUnLCdmaW5hbF9ncmFkZScsJ2NyYWZ0X2dyYWRlJywnb3JkZXJfbWF0Y2gnXS5pbmNsdWRlcyhrZXkpKXtcbiAgIGlmKGNba2V5XT09bnVsbCl0aHJvdyBFcnJvcign6rKw6rO8IOusuOunpSDsl4bsnYw6ICcra2V5KTtcbiAgIHJldHVybiBrZXk9PT0nb3JkZXJfbWF0Y2gnP2Nba2V5XTpHUkFERVMuaW5kZXhPZihjW2tleV0pO1xuIH1cbiBpZihrZXk9PT0nY29ja3RhaWwuaWQnKXJldHVybiBjLmNvY2t0YWlsPy5pZDtcbiBpZihrZXk9PT0nY29ja3RhaWwuYWJ2JylyZXR1cm4gbihjLmNvY2t0YWlsPy5hYnYpO1xuIGlmKGtleT09PSdvcmRlcmVkX2NvY2t0YWlsLmlkJylyZXR1cm4gYy5vcmRlcmVkO1xuIGlmKGtleT09PSdzZXJ2ZWRfY29ja3RhaWwuaWQnKXJldHVybiBjLnNlcnZlZDtcbiBjb25zdCB0YWc9a2V5Lm1hdGNoKC9eY29ja3RhaWxcXC50YWdcXCgoLispXFwpJC8pO2lmKHRhZylyZXR1cm4oYy50YWdzfHxbXSkuaW5jbHVkZXModGFnWzFdKTtcbiBpZigvXltBLVphLXrqsIAt7Z6jX11bXFx36rCALe2eoy1dKiQvLnRlc3Qoa2V5KSlyZXR1cm4ga2V5O1xuIHRocm93IEVycm9yKCfsp4Dsm5DtlZjsp4Ag7JWK64qUIOyhsOqxtCDqsJI6ICcra2V5KTtcbn1cbmZ1bmN0aW9uIGNvbmRpdGlvbihleHByLGMpe1xuIGlmKCFleHByKXJldHVybiB0cnVlO1xuIGlmKGV4cHIuaW5jbHVkZXMoJ3x8JykpdGhyb3cgRXJyb3IoJ+yngOybkO2VmOyngCDslYrripQgT1Ig7KGw6rG0OiAnK2V4cHIpO1xuIHJldHVybiBleHByLnNwbGl0KCcmJicpLmV2ZXJ5KHJhdz0+e2NvbnN0IHM9cmF3LnRyaW0oKTtjb25zdCBtPXMubWF0Y2goL14oLis/KVxccyooPT18IT18Pj18PD18Pnw8KVxccyooLispJC8pO1xuICBpZihtKXtjb25zdCBhPWNvbnRleHRWYWx1ZShtWzFdLnRyaW0oKSxjKSxiPWNvbnRleHRWYWx1ZShtWzNdLnRyaW0oKSxjKTtyZXR1cm4oeyc9PSc6KCk9PmE9PT1iLCchPSc6KCk9PmEhPT1iLCc+PSc6KCk9PmE+PWIsJzw9JzooKT0+YTw9YiwnPic6KCk9PmE+YiwnPCc6KCk9PmE8Yn0pW21bMl1dKCk7fVxuICByZXR1cm4gcy5zdGFydHNXaXRoKCchJyk/IWNvbnRleHRWYWx1ZShzLnNsaWNlKDEpLGMpOiEhY29udGV4dFZhbHVlKHMsYyk7XG4gfSk7XG59XG5mdW5jdGlvbiBhcHBseUVmZmVjdHMoZXhwcixzdGF0ZSl7XG4gaWYoIWV4cHIpcmV0dXJuO1xuIGNvbnN0IGJlZm9yZT17ZmxhZ3M6c3RhdGUuZmxhZ3MsYWZmaW5pdHk6c3RhdGUuYWZmaW5pdHl9LG5leHQ9ey4uLnN0YXRlLGZsYWdzOnsuLi5zdGF0ZS5mbGFnc30sYWZmaW5pdHk6ey4uLnN0YXRlLmFmZmluaXR5fX07XG4gZm9yKGNvbnN0IHJhdyBvZiBleHByLnNwbGl0KCc7JykuZmlsdGVyKHM9PnMudHJpbSgpKSl7XG4gIGNvbnN0IG09cmF3LnRyaW0oKS5tYXRjaCgvXihmbGFnXFwuW1xcd10rfGFmZmluaXR5XFwuW1xcd10rfG1vbmV5fHJlcHV0YXRpb24pXFxzKihcXCs9fC09fD0pXFxzKih0cnVlfGZhbHNlfFstK10/XFxkKyg/OlxcLlxcZCspPykkLyk7XG4gIGlmKCFtKXRocm93IEVycm9yKCfsg4Htg5wg67OA6rK9IO2VtOyEnSDsi6TtjKg6ICcrcmF3KTtcbiAgY29uc3QgW18sa2V5LG9wLHZhbHVlXT1tO2NvbnN0IHY9dmFsdWU9PT0ndHJ1ZSc/dHJ1ZTp2YWx1ZT09PSdmYWxzZSc/ZmFsc2U6TnVtYmVyKHZhbHVlKTtsZXQgb2JqPW5leHQsaz1rZXk7XG4gIGlmKGtleS5zdGFydHNXaXRoKCdmbGFnLicpKXtvYmo9bmV4dC5mbGFncztrPWtleS5zbGljZSg1KTt9aWYoa2V5LnN0YXJ0c1dpdGgoJ2FmZmluaXR5LicpKXtvYmo9bmV4dC5hZmZpbml0eTtrPWtleS5zbGljZSg5KTt9XG4gIGlmKGtleS5zdGFydHNXaXRoKCdmbGFnLicpJiYodHlwZW9mIHYhPT0nYm9vbGVhbid8fG9wIT09Jz0nKSl0aHJvdyBFcnJvcign7ZSM656Y6re47JeQ64qUIHRydWUvZmFsc2Ug64yA7J6F66eMIO2XiOyaqScpO1xuICBvYmpba109b3A9PT0nPSc/djpuKG9ialtrXSkrKG9wPT09Jys9Jz8xOi0xKSp2O1xuIH1cbiBPYmplY3QuYXNzaWduKHN0YXRlLG5leHQpO3Jvb3QuTHVuYVN0b3J5Tm90aWNlcz8uZWZmZWN0cyhzdGF0ZSxiZWZvcmUpO1xufVxuZnVuY3Rpb24gYmFuZChyb3dzLHR5cGUseCl7XG4gLy8gVW5pdCBjb252ZXJzaW9uIG11c3Qgbm90IG1vdmUgYW4gZXhhY3QgYm91bmRhcnkgYWNyb3NzIGEgc2NvcmUgYmFuZCB2aWEgZmxvYXRpbmctcG9pbnQgbm9pc2UuXG4geD1NYXRoLnJvdW5kKHgqMWUxMikvMWUxMjtcbiBjb25zdCByb3c9cm93cy5maW5kKHI9PnIuYmFuZF90eXBlPT09dHlwZSYmKHIubWluX3JhdGlvPT1udWxsfHwgKHIubWluX2luY2x1c2l2ZT94Pj1uKHIubWluX3JhdGlvKTp4Pm4oci5taW5fcmF0aW8pKSkmJihyLm1heF9yYXRpbz09bnVsbHx8KHIubWF4X2luY2x1c2l2ZT94PD1uKHIubWF4X3JhdGlvKTp4PG4oci5tYXhfcmF0aW8pKSkpO1xuIGlmKCFyb3cpdGhyb3cgRXJyb3IoJ+2MkOyglSDqtazqsIQg64iE6529OiAnK3R5cGUrJyAnK3gpO3JldHVybiBuKHJvdy5zY29yZV9vcl9wZW5hbHR5KTtcbn1cbi8vIENvbnZlcnQgYSB3ZWItb25seSBjb3B5IG9uY2UsIHNvIHJlY2lwZXMsIGRlZmF1bHQgcG91cnMsIHF1ZXVlcyBhbmQgc2NvcmluZyBhZ3JlZS5cbmZ1bmN0aW9uIG1pbGxpbGl0cmVEYXRhKGRhdGEpe1xuIGNvbnN0IGNmZz1PYmplY3QuZnJvbUVudHJpZXMoZGF0YS50YWJsZXMuYmFsYW5jZV9jb25maWcubWFwKHI9PltyLnNldHRpbmcsci52YWx1ZV0pKTtcbiBjb25zdCBmYWN0b3JzPXttbDoxLG96Om4oY2ZnLnVuaXRfb3pfdG9fbWwsMzApLHRzcDpuKGNmZy51bml0X3RzcF90b19tbCw1KX07XG4gY29uc3QgY29udmVydD0ocm93LHF0eSx1bml0KT0+e1xuICBjb25zdCBmYWN0b3I9ZmFjdG9yc1tyb3dbdW5pdF1dO1xuICBpZihmYWN0b3I9PW51bGwpcmV0dXJuIHsuLi5yb3d9O1xuICBjb25zdCB2YWx1ZT1yb3dbcXR5XTtcbiAgcmV0dXJuIHsuLi5yb3csW3F0eV06dmFsdWU9PW51bGx8fHZhbHVlPT09Jyc/dmFsdWU6TWF0aC5yb3VuZChuKHZhbHVlKSpmYWN0b3IqMWU2KS8xZTYsW3VuaXRdOidtbCd9O1xuIH07XG4gLy8gVXNlci1hcHByb3ZlZCB3ZWIgcmVjaXBlICgyMDI2LTEwLTE4KS4gS2VlcCB0aGUgaW1wb3J0ZWQgQ1NWIHNuYXBzaG90XG4gLy8gaW50YWN0LCBidXQgdXNlIHRoZXNlIG1sIHZhbHVlcyBldmVyeXdoZXJlOiByZWNpcGUgVUksIHByYWN0aWNlIGFuZCBzY29yaW5nLlxuIGNvbnN0IG1hcnRpbmk9e2dpbjo2MCxkcnlfdmVybW91dGg6MjB9O1xuIHJldHVybiB7Li4uZGF0YSx0YWJsZXM6ey4uLmRhdGEudGFibGVzLFxuICBjb2NrdGFpbHM6ZGF0YS50YWJsZXMuY29ja3RhaWxzLm1hcChjPT5jLmlkPT09J2RyeV9tYXJ0aW5pJz97Li4uYyxcbiAgICdyZWNpcGVfZGVzYy5rbyc6J+uvueyLsSDquIDrnbzsiqTsl5Ag7KeEIDYwbWzsmYAg65Oc65287J20IOuyoOultOustO2KuCAyMG1s66W8IOuEo+qzoCDsiqTthLDtlZwg65KkIOy5te2FjOydvCDsnpTsl5Ag65Sw66W464ukLicsXG4gICAncmVjaXBlX2Rlc2MuZW4nOidTdGlyIDYwbWwgZ2luIHdpdGggMjBtbCBkcnkgdmVybW91dGggaW4gYSBtaXhpbmcgZ2xhc3MsIHRoZW4gc3RyYWluIGludG8gYSBjb2NrdGFpbCBnbGFzcy4nfTpjLmlkPT09J2xvbmdfaXNsYW5kJz97Li4uYyx1bmxvY2tfZGF5OicyJ306YyksXG4gIHJlY2lwZXM6ZGF0YS50YWJsZXMucmVjaXBlcy5tYXAocj0+ci5jb250ZXh0PT09J2RyeV9tYXJ0aW5pJyYmT2JqZWN0Lmhhc093bihtYXJ0aW5pLHIuaW5ncmVkaWVudCk/ey4uLnIscXR5Om1hcnRpbmlbci5pbmdyZWRpZW50XSx1bml0OidtbCd9OmNvbnZlcnQociwncXR5JywndW5pdCcpKSxcbiAgc2hlbGZfaXRlbXM6ZGF0YS50YWJsZXMuc2hlbGZfaXRlbXMubWFwKHI9PmNvbnZlcnQociwnZGVmYXVsdF90YXJnZXRfcXR5JywnZGVmYXVsdF90YXJnZXRfdW5pdCcpKX19O1xufVxuZnVuY3Rpb24gYnVpbGRRdWV1ZShkYXRhLHNlbGVjdGVkLGFjdHVhbCl7XG4gY29uc3QgcmVjaXBlPWRhdGEudGFibGVzLnJlY2lwZXMuZmlsdGVyKHI9PnIuY29udGV4dD09PXNlbGVjdGVkLmlkKSxpdGVtcz1kYXRhLnRhYmxlcy5zaGVsZl9pdGVtcztcbiBsZXQgcXVldWU9W107XG4gZm9yKGNvbnN0IGlkIG9mIGFjdHVhbC5pbmdyZWRpZW50cyl7XG4gIGNvbnN0IGl0ZW09aXRlbXMuZmluZChyPT5yLmlkPT09aWQpO2lmKCFpdGVtKXRocm93IEVycm9yKCfsl4bripQg7J6s66OMOiAnK2lkKTtcbiAgY29uc3QgbGluZT1yZWNpcGUuZmluZChyPT5yLmluZ3JlZGllbnQ9PT1pZCYmIXIuYXV0b19hcHBseSk7XG4gIGNvbnN0IHR5cGU9bGluZT8uYWN0aW9ufHxpdGVtLmRlZmF1bHRfYWN0aW9uO1xuICBpZihpdGVtLnByZXBfYWN0aW9uPT09J29wZW4nKXF1ZXVlLnB1c2goe3R5cGU6J29wZW4nLGluZ3JlZGllbnQ6aWQsdGFyZ2V0Om51bGx9KTtcbiAgaWYoIXR5cGUpdGhyb3cgRXJyb3IoJ+uPmeyekSDsl4bsnYw6ICcraWQpO1xuICBxdWV1ZS5wdXNoKHt0eXBlLGluZ3JlZGllbnQ6aWQsdGFyZ2V0Om4obGluZT8ucXR5Pz9pdGVtLmRlZmF1bHRfdGFyZ2V0X3F0eSksdW5pdDpsaW5lPy51bml0Pz9pdGVtLmRlZmF1bHRfdGFyZ2V0X3VuaXQsaW5SZWNpcGU6ISFsaW5lfSk7XG4gfVxuIGlmKGFjdHVhbC50b29sPT09J3NoYWtlcicpcXVldWUucHVzaCh7dHlwZTonc2hha2UnLGluZ3JlZGllbnQ6bnVsbH0pO1xuIGlmKGFjdHVhbC50b29sPT09J21peGluZ19nbGFzcycpcXVldWUucHVzaCh7dHlwZTonc3RpcicsaW5ncmVkaWVudDpudWxsfSk7XG4gY29uc3QgcmFuaz17b3BlbjowLHBvdXI6MSxzcXVlZXplOjIscG93ZGVyOjMsYWRkOjMsc2hha2U6NCxzdGlyOjQsZmlsbF91cDo1fTtcbiByZXR1cm4gcXVldWUuc29ydCgoYSxiKT0+cmFua1thLnR5cGVdLXJhbmtbYi50eXBlXSk7XG59XG5mdW5jdGlvbiBzY29yZUNyYWZ0KGRhdGEsc2VsZWN0ZWQsYWN0dWFsLHJlc3VsdHMsZWxhcHNlZCl7XG4gY29uc3QgY2ZnPU9iamVjdC5mcm9tRW50cmllcyhkYXRhLnRhYmxlcy5iYWxhbmNlX2NvbmZpZy5tYXAocj0+W3Iuc2V0dGluZyxyLnZhbHVlXSkpO1xuIGNvbnN0IHJlY2lwZT1kYXRhLnRhYmxlcy5yZWNpcGVzLmZpbHRlcihyPT5yLmNvbnRleHQ9PT1zZWxlY3RlZC5pZCYmIXIuYXV0b19hcHBseSk7XG4gY29uc3QgZXhwZWN0ZWQ9W10sbWlzc2luZz1yZWNpcGUuZmlsdGVyKHI9PiFhY3R1YWwuaW5ncmVkaWVudHMuaW5jbHVkZXMoci5pbmdyZWRpZW50KSksZXh0cmE9YWN0dWFsLmluZ3JlZGllbnRzLmZpbHRlcihpZD0+IXJlY2lwZS5zb21lKHI9PnIuaW5ncmVkaWVudD09PWlkKSk7XG4gZm9yKGNvbnN0IHIgb2YgcmVjaXBlKXtpZighci5zY29yZWR8fG1pc3NpbmcuaW5jbHVkZXMocikpY29udGludWU7XG4gIGlmKGRhdGEudGFibGVzLnNoZWxmX2l0ZW1zLmZpbmQoaT0+aS5pZD09PXIuaW5ncmVkaWVudCk/LnByZXBfYWN0aW9uPT09J29wZW4nKWV4cGVjdGVkLnB1c2goe3R5cGU6J29wZW4nLGluZ3JlZGllbnQ6ci5pbmdyZWRpZW50fSk7XG4gIGV4cGVjdGVkLnB1c2goe3R5cGU6ci5hY3Rpb24saW5ncmVkaWVudDpyLmluZ3JlZGllbnQsdGFyZ2V0Om4oci5xdHkpLHVuaXQ6ci51bml0fSk7XG4gfVxuIGNvbnN0IG1peD1zZWxlY3RlZC50YXJnZXRfbWl4X21ldGhvZHx8c2VsZWN0ZWQubWl4O2lmKFsnc2hha2UnLCdzdGlyJ10uaW5jbHVkZXMobWl4KSlleHBlY3RlZC5wdXNoKHt0eXBlOm1peCxpbmdyZWRpZW50Om51bGx9KTtcbiBjb25zdCBidWNrZXRzPXt9O1xuIGZvcihjb25zdCByIG9mIGV4cGVjdGVkKXtjb25zdCBhPXJlc3VsdHMuZmluZCh4PT54LnR5cGU9PT1yLnR5cGUmJnguaW5ncmVkaWVudD09PXIuaW5ncmVkaWVudCk7bGV0IHNjb3JlPTA7XG4gIGlmKGEpe2lmKHIudHlwZT09PSdvcGVuJylzY29yZT1hLmNvbXBsZXRlZD8xMDA6MDtcbiAgIGVsc2UgaWYoWydzaGFrZScsJ3N0aXInXS5pbmNsdWRlcyhyLnR5cGUpKXNjb3JlPWNsYW1wKG4oYS5jb21wbGV0aW9uKSoxMDAsMCwxMDApO1xuICAgZWxzZSB7aWYoci50YXJnZXQ8PTB8fCFOdW1iZXIuaXNGaW5pdGUoYS52YWx1ZSkpdGhyb3cgRXJyb3IoJ+uqqe2RnC/qsrDqs7wg7IiY65+JIOuIhOudvTogJytyLmluZ3JlZGllbnQpO3Njb3JlPWJhbmQoZGF0YS50YWJsZXMuc2NvcmVfYmFuZHMsJ3F1YW50aXR5JyxNYXRoLmFicyhhLnZhbHVlLXIudGFyZ2V0KS9yLnRhcmdldCk7fX1cbiAgY29uc3QgZmFtaWx5PXIudHlwZT09PSdmaWxsX3VwJz8ncG91cic6ci50eXBlOyhidWNrZXRzW2ZhbWlseV0/Pz1bXSkucHVzaChzY29yZSk7XG4gfVxuIGxldCB3ZWlnaHRlZFN1bT0wLHRvdGFsV2VpZ2h0PTA7Y29uc3QgcmVwcmVzZW50YXRpdmVzPVtdO1xuIGZvcihjb25zdCBbZmFtaWx5LHZhbHVlc11vZiBPYmplY3QuZW50cmllcyhidWNrZXRzKSl7Y29uc3QgbWVhbj12YWx1ZXMucmVkdWNlKChhLGIpPT5hK2IsMCkvdmFsdWVzLmxlbmd0aCx3ZWlnaHQ9bihjZmdbJ3dlaWdodF8nK2ZhbWlseV0pO3dlaWdodGVkU3VtKz1tZWFuKndlaWdodDt0b3RhbFdlaWdodCs9d2VpZ2h0O3JlcHJlc2VudGF0aXZlcy5wdXNoKHtmYW1pbHksbWVhbix3ZWlnaHQsY291bnQ6dmFsdWVzLmxlbmd0aH0pO31cbiBjb25zdCByZXByZXNlbnRhdGl2ZVNjb3JlPXRvdGFsV2VpZ2h0P3dlaWdodGVkU3VtL3RvdGFsV2VpZ2h0OjEwMDtcbiBjb25zdCB0YXJnZXRUb29sPW1peD09PSdzaGFrZSc/J3NoYWtlcic6bWl4PT09J3N0aXInPydtaXhpbmdfZ2xhc3MnOm51bGw7XG4gY29uc3QgcGVuYWx0aWVzPXtnaW1taWNrOjEwMC1yZXByZXNlbnRhdGl2ZVNjb3JlLGdsYXNzOmFjdHVhbC5nbGFzcyE9PXNlbGVjdGVkLmdsYXNzP24oY2ZnLmdsYXNzX21pc21hdGNoX3BlbmFsdHkpOjAsdG9vbDooYWN0dWFsLnRvb2x8fG51bGwpIT09dGFyZ2V0VG9vbD9uKGNmZy50b29sX21pc21hdGNoX3BlbmFsdHkpOjAsbWlzc2luZzptaXNzaW5nLmxlbmd0aCpuKGNmZy5taXNzaW5nX2luZ3JlZGllbnRfcGVuYWx0eSksZXh0cmE6ZXh0cmEubGVuZ3RoKm4oY2ZnLmV4dHJhX2luZ3JlZGllbnRfcGVuYWx0eSksb3ZlcnRpbWU6YmFuZChkYXRhLnRhYmxlcy5zY29yZV9iYW5kcywnb3ZlcnRpbWUnLE1hdGgubWF4KDAsZWxhcHNlZC1uKHNlbGVjdGVkLnRpbWVfbGltaXRfc2VjKSkvTWF0aC5tYXgoMSxuKHNlbGVjdGVkLnRpbWVfbGltaXRfc2VjKSkpfTtcbiBjb25zdCBzY29yZT1jbGFtcCgxMDAtT2JqZWN0LnZhbHVlcyhwZW5hbHRpZXMpLnJlZHVjZSgoYSxiKT0+YStiLDApLDAsMTAwKTtcbiBjb25zdCBncmFkZT1bLi4uZGF0YS50YWJsZXMuZ3JhZGVfY3V0c10uc29ydCgoYSxiKT0+bihiLm1pbl9wY3QpLW4oYS5taW5fcGN0KSkuZmluZChnPT5zY29yZT49bihnLm1pbl9wY3QpKT8uZ3JhZGV8fCdzZXdhZ2UnO1xuIHJldHVybntzY29yZSxncmFkZSxwZW5hbHRpZXMscmVwcmVzZW50YXRpdmVzLG1pc3NpbmdDb3JlOm1pc3NpbmcuZmlsdGVyKHI9PnIuaXNfY29yZSkubWFwKHI9PnIuaW5ncmVkaWVudCksbWlzc2luZzptaXNzaW5nLm1hcChyPT5yLmluZ3JlZGllbnQpLGV4dHJhLGVsYXBzZWQsc2VsZWN0ZWQ6c2VsZWN0ZWQuaWQsYWN0dWFsOnN0cnVjdHVyZWRDbG9uZShhY3R1YWwpLHJlc3VsdHM6c3RydWN0dXJlZENsb25lKHJlc3VsdHMpfTtcbn1cbmNsYXNzIEdhbWV7XG4gY29uc3RydWN0b3IoZGF0YSxvcHRpb25zPXt9KXt0aGlzLmRhdGE9ZGF0YTt0aGlzLnQ9ZGF0YS50YWJsZXM7dGhpcy5jZmc9T2JqZWN0LmZyb21FbnRyaWVzKHRoaXMudC5iYWxhbmNlX2NvbmZpZy5tYXAocj0+W3Iuc2V0dGluZyxyLnZhbHVlXSkpO3RoaXMuY2ZnLnN0aXJfY2lyY2xlX2xpbWl0X3NlYz0xLjU7LyogV2ViIHBsYXl0ZXN0IHR1bmluZzsgc291cmNlIENTViB1bmNoYW5nZWQuICovdGhpcy5vbkNoYW5nZT0oKT0+e307dGhpcy5sYW5nPSdrbyc7dGhpcy5zcGVlZD0xO3RoaXMuZGlhbG9nU3BlZWQ9MTt0aGlzLnJlYWQ9bmV3IFNldCgpO3RoaXMucmVzZXQob3B0aW9ucy5kYXk/PzAsb3B0aW9ucy5tb2RlPz8nZnVsbCcsb3B0aW9ucy5zZWVkPz8xLGZhbHNlKTt9XG4gYyhrZXksZmFsbGJhY2s9MCl7cmV0dXJuIG4odGhpcy5jZmdba2V5XSxmYWxsYmFjayk7fVxuIHRleHQocm93LGtleT0ndGV4dCcpe3JldHVybiByb3c/LltrZXkrJy4nK3RoaXMubGFuZ118fHJvdz8uW2tleSsnLmtvJ118fCcnO31cbiBjb2NrdGFpbChpZCl7Y29uc3QgYz10aGlzLnQuY29ja3RhaWxzLmZpbmQoYz0+Yy5pZD09PWlkKTtpZighYyl0aHJvdyBFcnJvcign7Lm17YWM7J28IOyXhuydjDogJytpZCk7cmV0dXJuIGM7fVxuIG5hbWUoaWQpe2NvbnN0IHI9dGhpcy50LmNoYXJhY3RlcnMuZmluZCh4PT54LmlkPT09aWQpfHx0aGlzLnQuY29ja3RhaWxzLmZpbmQoeD0+eC5pZD09PWlkKXx8dGhpcy50LnNoZWxmX2l0ZW1zLmZpbmQoeD0+eC5pZD09PWlkKXx8dGhpcy50LnBlcnNvbmFsaXRpZXMuZmluZCh4PT54LmlkPT09aWQpO3JldHVybiB0aGlzLnRleHQociwnbmFtZScpfHxpZHx8Jyc7fVxuIHJlc2V0KGRheT0wLG1vZGU9J2Z1bGwnLHNlZWQ9MSxydW49dHJ1ZSxzZXR0aW5ncz17fSl7XG4gIGNvbnN0IHVwa2VlcE92ZXJyaWRlPXRoaXMucGFyc2VVcGtlZXBPdmVycmlkZShzZXR0aW5ncy51cGtlZXBPdmVycmlkZSk7XG4gIHRoaXMuc2VydmljZVZlcnNpb249J0EnO3RoaXMucWFLZWVwR2VuZXJhbD1mYWxzZTt0aGlzLmRheT1OdW1iZXIoZGF5KTt0aGlzLm1vZGU9bW9kZTt0aGlzLnNlZWQ9TnVtYmVyKHNlZWQpO3RoaXMucm5nPXNlZWRlZCh0aGlzLnNlZWQpO3RoaXMucHJvZ3Jlc3M9e2RheTp0aGlzLmRheSxtb25leTp0aGlzLmMoJ2dvbGRfc3RhcnQnLDMwMCkscmVwdXRhdGlvbjowLHBoYXNlOidiYXJfb3BlbicsZmxhZ3M6e30sYWZmaW5pdHk6e319O1xuICB0aGlzLm9wZW5pbmdCYWxhbmNlPXRoaXMucHJvZ3Jlc3MubW9uZXk7dGhpcy51cGtlZXBPdmVycmlkZT11cGtlZXBPdmVycmlkZTt0aGlzLmRhaWx5U2V0dGxlbWVudD1udWxsO1xuICB0aGlzLnRhYmxlRmFkZXM9e307dGhpcy5wb3VyVG9vbD0ncG91cmVyJzt0aGlzLnR1dG9yaWFsPW51bGw7dGhpcy5zdG9yeUNvYXN0ZXI9bnVsbDt0aGlzLnBlbmRpbmdEYWlseVVubG9ja3M9ZmFsc2U7dGhpcy5sYXN0U3RvcnlMaW5lPW51bGw7dGhpcy5jcmFmdFJlbWluZGVyPW51bGw7dGhpcy5waGFzZT0ncmVhZHknO3RoaXMuc2NyZWVuPSdiYXInO3RoaXMub3ZlcmxheT1udWxsO3RoaXMucGF1c2VkPWZhbHNlO3RoaXMuaGlkZGVuPWZhbHNlO3RoaXMuY2FtZXJhTGVmdD0wO3RoaXMuY2FtZXJhTW92aW5nPWZhbHNlO3RoaXMuZm9jdXM9J0wnO3RoaXMub3ZlcnZpZXc9ZmFsc2U7dGhpcy5zZWF0cz17TDpudWxsLE06bnVsbCxSOm51bGx9O3RoaXMubG9ncz1bXTt0aGlzLmhpc3Rvcnk9W107dGhpcy50cmFuc2FjdGlvbnM9W107dGhpcy50cmFuc2FjdGlvbklkcz1uZXcgU2V0KCk7dGhpcy5zZXJpYWw9MDt0aGlzLmJhclRpbWU9MDt0aGlzLnJlYWxUaW1lPTA7dGhpcy5zZXJ2ZWQ9MDt0aGlzLmxvc3Q9MDt0aGlzLnByZXA9bnVsbDt0aGlzLmRyaW5rPW51bGw7dGhpcy5naW1taWNrPW51bGw7dGhpcy5yZXN1bHQ9bnVsbDt0aGlzLmRpc2NhcmRGZWVkYmFjaz1udWxsO3RoaXMuZXJyb3I9bnVsbDt0aGlzLmRpYWxvZ3VlPW51bGw7dGhpcy5jaG9pY2U9bnVsbDt0aGlzLnRyYW5zaXRpb249MDt0aGlzLnBlbmRpbmdUcmFuc2l0aW9uPW51bGw7dGhpcy5zdG9yeT1udWxsO3RoaXMuY3VycmVudE9yZGVyPW51bGw7dGhpcy5yZXN1bHRDb250ZXh0PXt9O3RoaXMuZWZmZWN0VmlzdWFsPW51bGw7dGhpcy5iYXJrTGFzdD17fTt0aGlzLmZpbmlzaGVkPWZhbHNlO1xuICBpZihzZXR0aW5ncy5zdG9yeVByZXJlcXVpc2l0ZXMpdGhpcy5zZWVkSm9obm55UHJlcmVxdWlzaXRlcygpO1xuICBpZihydW4pe2lmKG1vZGU9PT0nZ2VuZXJhbCcpdGhpcy5zdGFydEdlbmVyYWwoKTtlbHNlIGlmKG1vZGU9PT0ncmVndWxhcicpdGhpcy5zdGFydFN0b3J5UGhhc2UoJ2JhcicpO2Vsc2UgaWYobW9kZT09PSdwcmFjdGljZScpe3RoaXMucGhhc2U9J3ByYWN0aWNlJzt0aGlzLm9wZW5SZWNpcGVzKCk7fWVsc2Uge2NvbnN0IGZyZXNoPXRoaXMuZGFpbHlVbmxvY2tzKCk7aWYobW9kZT09PSdmdWxsJyYmdGhpcy5kYXk+MCYmdGhpcy5kYXkhPT05OSYmKGZyZXNoLmluZ3JlZGllbnRzLmxlbmd0aHx8ZnJlc2guY29ja3RhaWxzLmxlbmd0aCkpe3RoaXMucGVuZGluZ0RhaWx5VW5sb2Nrcz10cnVlO3RoaXMucGhhc2U9J2Fycml2YWwnO3RoaXMub3ZlcmxheT0nZGFpbHlVbmxvY2tzJzt9ZWxzZSB0aGlzLnN0YXJ0U3RvcnlQaGFzZSgnYmFyX29wZW4nKTt9fVxuICB0aGlzLmNoYW5nZWQoKTtcbiB9XG4gbG9nKGV2ZW50LGRldGFpbHM9e30pe3RoaXMubG9ncy5wdXNoKHt0aW1lOk1hdGgucm91bmQodGhpcy5yZWFsVGltZSoxMDApLzEwMCxiYXJUaW1lOk1hdGgucm91bmQodGhpcy5iYXJUaW1lKjEwMCkvMTAwLGV2ZW50LC4uLmRldGFpbHN9KTtpZih0aGlzLmxvZ3MubGVuZ3RoPjUwMDApdGhpcy5sb2dzLnNoaWZ0KCk7fVxuIGNoYW5nZWQoKXt0aGlzLm9uQ2hhbmdlKHRoaXMpO31cbiBjbGVhckRlcGFydGVkU2VhdChzZWF0KXtcbiAgY29uc3QgZ3Vlc3Q9dGhpcy5zZWF0c1tzZWF0XTtcbiAgaWYoZ3Vlc3QmJihndWVzdC5jb2FzdGVyfHxndWVzdC5nbGFzcykpdGhpcy50YWJsZUZhZGVzW3NlYXRdPXtjb2FzdGVyOmd1ZXN0LmNvYXN0ZXIsZ2xhc3M6Z3Vlc3QuZ2xhc3MsZ2xhc3NFbXB0eTpndWVzdC5nbGFzc0VtcHR5LGdsYXNzS2luZDpndWVzdC5nbGFzc0tpbmQsYmFzZWxpbmU6dGhpcy5waGFzZT09PSdnZW5lcmFsJz81NDg6NTYwLGVsYXBzZWQ6MCxkdXJhdGlvbjouOH07XG4gIHRoaXMuc2VhdHNbc2VhdF09bnVsbDtcbiAgcmV0dXJuIHRoaXMudGFibGVGYWRlc1tzZWF0XT8uZHVyYXRpb258fDA7XG4gfVxuIGN0eChleHRyYT17fSl7cmV0dXJuey4uLnRoaXMucHJvZ3Jlc3MsLi4udGhpcy5yZXN1bHRDb250ZXh0LC4uLmV4dHJhfTt9XG4gc2FmZShmbil7dHJ5e3JldHVybiBmbigpO31jYXRjaChlKXt0aGlzLmVycm9yPWUubWVzc2FnZTt0aGlzLmxvZygnREFUQV9FUlJPUicse21lc3NhZ2U6ZS5tZXNzYWdlfSk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIGZhbHNlO319XG4gaXNQYXVzZWQoKXtyZXR1cm4gdGhpcy5wYXVzZWR8fHRoaXMuaGlkZGVufHwhIXRoaXMuZXJyb3J8fCEhdGhpcy5vdmVybGF5O31cbiBhdmFpbGFibGUoYyl7cmV0dXJuIHRoaXMuZGF5PT09OTl8fChuKGMudW5sb2NrX2RheSk8PXRoaXMuZGF5JiZjb25kaXRpb24oYy51bmxvY2tfd2hlbix0aGlzLmN0eCgpKSk7fVxuIGNvY2t0YWlsc0F2YWlsYWJsZSgpe3JldHVybiB0aGlzLnQuY29ja3RhaWxzLmZpbHRlcihjPT5jLnN0YXR1cz09PSdjb25maXJtZWQnJiYodGhpcy5hdmFpbGFibGUoYyl8fGMuaWQhPT0nam9obm55X29sZF9mYXNoaW9uZWQnJiZ0aGlzLmN1cnJlbnRPcmRlcj8uY29ja3RhaWw9PT1jLmlkKSk7fVxuIGl0ZW1zQXZhaWxhYmxlKCl7Y29uc3QgbmVlZGVkPXRoaXMuY3VycmVudE9yZGVyP3RoaXMudC5yZWNpcGVzLmZpbHRlcihyPT5yLmNvbnRleHQ9PT10aGlzLmN1cnJlbnRPcmRlci5jb2NrdGFpbCkubWFwKHI9PnIuaW5ncmVkaWVudCk6W107cmV0dXJuIHRoaXMudC5zaGVsZl9pdGVtcy5maWx0ZXIocj0+dGhpcy5hdmFpbGFibGUocil8fCFbJ3dpbGRfZG9nJywnYml0dGVycycsJ3N1Z2FyX2N1YmUnXS5pbmNsdWRlcyhyLmlkKSYmbmVlZGVkLmluY2x1ZGVzKHIuaWQpKTt9XG4gLy8gUG9zc2Vzc2lvbiBpcyBhIHN0b3J5IHByZXJlcXVpc2l0ZSwgbm90IGEgY29uc3VtYWJsZSBib3R0bGUgY291bnQgcGVyIGNyYWZ0LlxuIHNlZWRKb2hubnlQcmVyZXF1aXNpdGVzKCl7aWYodGhpcy5kYXk8M3x8dGhpcy5kYXk9PT05OSlyZXR1cm47dGhpcy5wcm9ncmVzcy5pbnZlbnRvcnk9ey4uLnRoaXMucHJvZ3Jlc3MuaW52ZW50b3J5LHdpbGRfZG9nOk1hdGgubWF4KDEsTnVtYmVyKHRoaXMucHJvZ3Jlc3MuaW52ZW50b3J5Py53aWxkX2RvZyl8fDApLGJpdHRlcnM6TWF0aC5tYXgoMSxOdW1iZXIodGhpcy5wcm9ncmVzcy5pbnZlbnRvcnk/LmJpdHRlcnMpfHwwKX07dGhpcy5wcm9ncmVzcy5mbGFncy5jYW1wYWlnbl9vYnNlcnZhdGlvbj10cnVlO31cbiBqb2hubnlNaXNzaW5nKHttZW1vcnk9dHJ1ZSxzdWdhcj1mYWxzZX09e30pe2NvbnN0IG1pc3Npbmc9Wyd3aWxkX2RvZycsJ2JpdHRlcnMnXS5maWx0ZXIoaWQ9PiEoTnVtYmVyKHRoaXMucHJvZ3Jlc3MuaW52ZW50b3J5Py5baWRdKT4wKSk7aWYobWVtb3J5JiYhdGhpcy5wcm9ncmVzcy5mbGFncy5jYW1wYWlnbl9vYnNlcnZhdGlvbiltaXNzaW5nLnB1c2goJ2pvaG5ueV9tZW1vcnknKTtpZihzdWdhciYmIXRoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5M19zdWdhcl9yZWNlaXZlZCltaXNzaW5nLnB1c2goJ3N1Z2FyX2N1YmUnKTtyZXR1cm4gbWlzc2luZzt9XG4gY2hlY2tKb2hubnlVbmxvY2soKXtpZih0aGlzLmRheSE9PTN8fHRoaXMucHJvZ3Jlc3MuZmxhZ3Muam9obm55X3JlY2lwZV91bmxvY2tlZHx8dGhpcy5qb2hubnlNaXNzaW5nKHtzdWdhcjp0cnVlfSkubGVuZ3RoKXJldHVybiBmYWxzZTt0aGlzLnByb2dyZXNzLmludmVudG9yeXx8PXt9O3RoaXMucHJvZ3Jlc3MuaW52ZW50b3J5LnN1Z2FyX2N1YmU9TWF0aC5tYXgoMSxOdW1iZXIodGhpcy5wcm9ncmVzcy5pbnZlbnRvcnkuc3VnYXJfY3ViZSl8fDApO3RoaXMucHJvZ3Jlc3MuZmxhZ3Muam9obm55X3JlY2lwZV91bmxvY2tlZD10cnVlO3RoaXMub3ZlcmxheT0nam9obm55VW5sb2NrJzt0aGlzLmxvZygncmVjaXBlX3VubG9ja2VkJyx7Y29ja3RhaWw6J2pvaG5ueV9vbGRfZmFzaGlvbmVkJyxpbmdyZWRpZW50czpbJ3dpbGRfZG9nJywnYml0dGVycycsJ3N1Z2FyX2N1YmUnXX0pO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31cbiBjb25maXJtSm9obm55VW5sb2NrKCl7aWYodGhpcy5vdmVybGF5IT09J2pvaG5ueVVubG9jaycpcmV0dXJuIGZhbHNlO3RoaXMub3ZlcmxheT1udWxsO3RoaXMucHVtcCgpO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31cbiBkYWlseVVubG9ja3MoKXtyZXR1cm4ge2luZ3JlZGllbnRzOnRoaXMudC5zaGVsZl9pdGVtcy5maWx0ZXIocj0+ci5raW5kPT09J2luZ3JlZGllbnQnJiZuKHIudW5sb2NrX2RheSk9PT10aGlzLmRheSYmIVsnd2lsZF9kb2cnLCdiaXR0ZXJzJywnc3VnYXJfY3ViZSddLmluY2x1ZGVzKHIuaWQpJiZ0aGlzLmF2YWlsYWJsZShyKSksY29ja3RhaWxzOnRoaXMudC5jb2NrdGFpbHMuZmlsdGVyKHI9PnIuc3RhdHVzPT09J2NvbmZpcm1lZCcmJm4oci51bmxvY2tfZGF5KT09PXRoaXMuZGF5JiZyLmlkIT09J2pvaG5ueV9vbGRfZmFzaGlvbmVkJyYmdGhpcy5hdmFpbGFibGUocikpfTt9XG4gY29uZmlybURhaWx5VW5sb2Nrcygpe2lmKCF0aGlzLnBlbmRpbmdEYWlseVVubG9ja3N8fHRoaXMub3ZlcmxheSE9PSdkYWlseVVubG9ja3MnKXJldHVybiBmYWxzZTt0aGlzLnBlbmRpbmdEYWlseVVubG9ja3M9ZmFsc2U7dGhpcy5vdmVybGF5PW51bGw7dGhpcy5zdGFydFN0b3J5UGhhc2UoJ2Jhcl9vcGVuJyk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuIHN0YXJ0U3RvcnlQaGFzZShwaGFzZSl7XG4gIHRoaXMuc3RvcnlDb2FzdGVyPW51bGw7XG4gIHRoaXMucGhhc2U9cGhhc2U9PT0nYmFyX29wZW4nPydvcGVuaW5nJzoncmVndWxhcic7dGhpcy5wcm9ncmVzcy5waGFzZT1waGFzZTt0aGlzLnNjcmVlbj0nYmFyJzt0aGlzLnNlYXRzPXtMOm51bGwsTTpudWxsLFI6bnVsbH07dGhpcy5kaWFsb2d1ZT1udWxsO3RoaXMuY2hvaWNlPW51bGw7dGhpcy5yZXN1bHRDb250ZXh0PXt9O3RoaXMuY3VycmVudE9yZGVyPW51bGw7dGhpcy5zdG9yeT17cGhhc2UsYXV0b3M6c29ydFNlcSh0aGlzLnQuc2NlbmVzLmZpbHRlcihzPT5uKHMuZGF5KT09PXRoaXMuZGF5JiZzLnBoYXNlPT09cGhhc2UmJnMudHJpZ2dlcj09PSdhdXRvJykpLGN1cnNvcjowLHNjZW5lOm51bGwsaW5kZXg6MCxzdGVwczpbXX07XG4gIHRoaXMubG9nKCdwaGFzZV9zdGFydCcse3BoYXNlOnRoaXMucGhhc2V9KTt0aGlzLm5leHRTY2VuZSgpO1xuIH1cbiBuZXh0U2NlbmUoKXtcbiAgdGhpcy5yZXN1bHRDb250ZXh0PXt9O3RoaXMuZGlhbG9ndWU9bnVsbDt0aGlzLmNob2ljZT1udWxsO1xuICB3aGlsZSh0aGlzLnN0b3J5LmN1cnNvcjx0aGlzLnN0b3J5LmF1dG9zLmxlbmd0aCl7Y29uc3Qgcz10aGlzLnN0b3J5LmF1dG9zW3RoaXMuc3RvcnkuY3Vyc29yKytdO2lmKCFjb25kaXRpb24ocy53aGVuLHRoaXMuY3R4KCkpKWNvbnRpbnVlO3RoaXMubG9hZFNjZW5lKHMpO3JldHVybjt9XG4gIGlmKHRoaXMucGhhc2U9PT0nb3BlbmluZycpe3RoaXMuc3Rvcnk9bnVsbDt0aGlzLnN0YXJ0R2VuZXJhbCgpO31cbiAgZWxzZSB7aWYodGhpcy5jdXJyZW50T3JkZXIpdGhyb3cgRXJyb3IoJ+uvuOyymOumrCDso7zrrLgg7IOB7YOc7JeQ7IScIOuMgOuzuCDsooXro4wnKTt0aGlzLmZpbmlzaERheSgpO31cbiB9XG4gbG9hZFNjZW5lKHNjZW5lKXt0aGlzLnN0b3J5Q29hc3Rlcj1udWxsO3RoaXMubGFzdFN0b3J5TGluZT1udWxsO3RoaXMuY3JhZnRSZW1pbmRlcj1udWxsO3RoaXMuc3Rvcnkuc2NlbmU9c2NlbmU7dGhpcy5zdG9yeS5zdGVwcz1zb3J0U2VxKHRoaXMudC5zdGVwcy5maWx0ZXIocz0+cy5jb250ZXh0PT09c2NlbmUuaWQpKTtcbiAgdGhpcy5zdG9yeS5pbmRleD0wO3RoaXMucmVzdWx0Q29udGV4dD17fTt0aGlzLmxvZygnc2NlbmUnLHtpZDpzY2VuZS5pZH0pO3RoaXMucHVtcCgpO31cbiBzdGVwRG9uZShzdGVwKXthcHBseUVmZmVjdHMoc3RlcC5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMuc3RvcnkuaW5kZXgrKztpZighdGhpcy5jaGVja0pvaG5ueVVubG9jaygpKXRoaXMucHVtcCgpO31cbiBwdW1wKCl7XG4gIGZvcihsZXQgZ3VhcmQ9MDtndWFyZDwxMDAwO2d1YXJkKyspe1xuICAgaWYoIXRoaXMuc3Rvcnl8fHRoaXMuc3RvcnlDb2FzdGVyfHx0aGlzLmVycm9yfHx0aGlzLnR1dG9yaWFsfHx0aGlzLm92ZXJsYXk9PT0nam9obm55VW5sb2NrJylyZXR1cm47XG4gICBjb25zdCBzPXRoaXMuc3Rvcnkuc3RlcHNbdGhpcy5zdG9yeS5pbmRleF07aWYoIXMpe3RoaXMubmV4dFNjZW5lKCk7cmV0dXJuO31cbiAgIGlmKCFjb25kaXRpb24ocy53aGVuLHRoaXMuY3R4KCkpKXt0aGlzLmxvZygnc3RlcF9za2lwcGVkJyx7c2NlbmU6dGhpcy5zdG9yeS5zY2VuZS5pZCxzZXE6cy5zZXEsd2hlbjpzLndoZW59KTt0aGlzLnN0b3J5LmluZGV4Kys7Y29udGludWU7fVxuICAgdGhpcy5sb2coJ3N0ZXAnLHtzY2VuZTp0aGlzLnN0b3J5LnNjZW5lLmlkLHNlcTpzLnNlcSx0eXBlOnMudHlwZX0pO1xuICAgaWYocy50eXBlPT09J3N0b3J5X2N1ZScpe3RoaXMub25TdG9yeUN1ZT8uKHMuYXJnKTt0aGlzLmxvZygnc3RvcnlfY3VlJyx7a2luZDpzLmFyZ30pO3RoaXMuc2V0VHJhbnNpdGlvbihzLmFyZz09PSdkb29yJz8uOTouMzUsKCk9PnRoaXMuc3RlcERvbmUocykpO3JldHVybjt9XG4gICBpZih0aGlzLmNhbXBhaWduU3RlcD8uKHMpKXJldHVybjtcbiAgIGlmKHMudHlwZT09PSdzYXknfHxzLnR5cGU9PT0nb3JkZXInJiZ0aGlzLnRleHQocykpe1xuICAgIHRoaXMuZGlhbG9ndWU9dGhpcy5tYWtlTGluZShzLmFjdG9yLHRoaXMudGV4dChzKSxzLmRpYWxvZ3VlX2lkLHMuYXJnKTt0aGlzLmRpYWxvZ3VlLnN0ZXA9cztpZih0aGlzLnN0b3J5Q29hc3RlckVsaWdpYmxlKHMuYWN0b3IpKXtjb25zdCBzZWF0PU9iamVjdC5rZXlzKHRoaXMuc2VhdHMpLmZpbmQoaz0+dGhpcy5zZWF0c1trXT8uYWN0b3I9PT1zLmFjdG9yJiYhdGhpcy5zZWF0c1trXS5jb2FzdGVyKTtpZihzZWF0KXRoaXMuc3RvcnlDb2FzdGVyPXtzZWF0LHN0ZXA6cyxraW5kOidsaW5lJ307fXJldHVybjtcbiAgIH1cbiAgIGlmKHMudHlwZT09PSdvcmRlcicpe2lmKHRoaXMud2FpdEZvclN0b3J5Q29hc3RlcihzLCdzdGVwJykpcmV0dXJuO3RoaXMuY3JlYXRlU3RvcnlPcmRlcihzKTthcHBseUVmZmVjdHMocy5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMuc3RvcnkuaW5kZXgrKztjb250aW51ZTt9XG4gICBpZihzLnR5cGU9PT0nZW50ZXInKXtcbiAgICBjb25zdCBmaXJzdD10aGlzLnN0b3J5LmluZGV4LGdyb3VwPVtzXTtpZihzLnN5bmM9PT0nbm9fd2FpdCcpe2NvbnN0IG5leHQ9dGhpcy5zdG9yeS5zdGVwc1tmaXJzdCsxXTtpZighbmV4dHx8bmV4dC50eXBlIT09J2VudGVyJ3x8bmV4dC5zeW5jIT09J3dhaXQnKXRocm93IEVycm9yKCfrj5nsi5wg7J6F7J6lIOyMjSDsmKTrpZgnKTtncm91cC5wdXNoKG5leHQpO31cbiAgICBjb25zdCByZXNlcnZlZD1uZXcgU2V0KE9iamVjdC5rZXlzKHRoaXMuc2VhdHMpLmZpbHRlcihrPT50aGlzLnNlYXRzW2tdKSk7XG4gICAgZm9yKGNvbnN0IGUgb2YgZ3JvdXApe2lmKCFbJ0wnLCdSJ10uaW5jbHVkZXMoZS5hcmcpfHxyZXNlcnZlZC5oYXMoZS5hcmcpKXRocm93IEVycm9yKCfri6jqs6gg7KKM7ISdIOy2qeuPjDogJytlLmFjdG9yKycgLyAnK2UuYXJnKTtyZXNlcnZlZC5hZGQoZS5hcmcpO31cbiAgICBmb3IoY29uc3QgZSBvZiBncm91cCl7dGhpcy5zZWF0c1tlLmFyZ109e2lkOmUuYWN0b3IsYWN0b3I6ZS5hY3RvcixzZWF0ZWQ6ZS5lbnRyYW5jZT09PSdzZWF0ZWQnLHN0YXRlOidTVE9SWScsY29hc3RlcjpmYWxzZSxnbGFzczpudWxsLGV4cHJlc3Npb246J2RlZmF1bHQnfTtpZihyb290Lkx1bmFTdG9yeU5vdGljZXM/LnJvc3Rlci5pbmNsdWRlcyhlLmFjdG9yKSlyb290Lkx1bmFTdG9yeU5vdGljZXMubWVldCh0aGlzLnByb2dyZXNzLGUuYWN0b3IpO2Vsc2UgdGhpcy5wcm9ncmVzcy5mbGFnc1tlLmFjdG9yKydfbWV0J109dHJ1ZTthcHBseUVmZmVjdHMoZS5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO31cbiAgICB0aGlzLmZvY3VzPXMuYXJnO3RoaXMuc3RvcnkuaW5kZXgrPWdyb3VwLmxlbmd0aDtpZihncm91cC5ldmVyeShlPT5lLmVudHJhbmNlPT09J3NlYXRlZCcpKWNvbnRpbnVlO3RoaXMuc2V0VHJhbnNpdGlvbigwLjgsKCk9PnRoaXMucHVtcCgpKTtyZXR1cm47XG4gICB9XG4gICBpZihzLnR5cGU9PT0nZXhpdCcpe2NvbnN0IHNlYXQ9T2JqZWN0LmtleXModGhpcy5zZWF0cykuZmluZChrPT50aGlzLnNlYXRzW2tdPy5hY3Rvcj09PXMuYWN0b3IpO2lmKCFzZWF0KXRocm93IEVycm9yKCfth7TsnqUg64yA7IOBIOyXhuydjDogJytzLmFjdG9yKTt0aGlzLnNlYXRzW3NlYXRdLnN0YXRlPSdFWElUSU5HJzt0aGlzLnNldFRyYW5zaXRpb24oMC41LCgpPT57Y29uc3QgZmFkZT10aGlzLmNsZWFyRGVwYXJ0ZWRTZWF0KHNlYXQpO2lmKGZhZGUpdGhpcy5zZXRUcmFuc2l0aW9uKGZhZGUsKCk9PnRoaXMuc3RlcERvbmUocykpO2Vsc2UgdGhpcy5zdGVwRG9uZShzKTt9KTtyZXR1cm47fVxuICAgaWYocy50eXBlPT09J3R1dG9yaWFsJyl7XG4gICAgaWYodGhpcy5kYXk9PT0wJiZ0aGlzLnZhcmlhbnQhPT0nZ3B0JyYmIXRoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MF9za2lwX3R1dG9yaWFsKXtcbiAgICAgdGhpcy5wcm9ncmVzcy5mbGFncy5kYXkwX3NlYXRzX3JldmVhbGVkPXRydWU7XG4gICAgIHRoaXMudHV0b3JpYWw9e2tpbmQ6cy5hcmcsc3RlcDpzLG9yaWdpbjp0aGlzLmZvY3VzLHZpc2l0ZWQ6W10sbW92ZWQ6ZmFsc2V9O1xuICAgICB0aGlzLmxvZygndHV0b3JpYWxfd2FpdCcse2tpbmQ6cy5hcmd9KTt0aGlzLmNoYW5nZWQoKTtyZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc3RlcERvbmUocyk7cmV0dXJuO1xuICAgfVxuICAgaWYocy50eXBlPT09J2NvYXN0ZXInKXtpZighdGhpcy5zdG9yeUhhc1VwY29taW5nT3JkZXIocy5hY3Rvcikpe3RoaXMuc3RlcERvbmUocyk7cmV0dXJuO31pZih0aGlzLndhaXRGb3JTdG9yeUNvYXN0ZXIocywnc3RlcCcpKXJldHVybjtjb25zdCBzZWF0PU9iamVjdC5rZXlzKHRoaXMuc2VhdHMpLmZpbmQoaz0+dGhpcy5zZWF0c1trXT8uYWN0b3I9PT1zLmFjdG9yKTtpZighc2VhdCl0aHJvdyBFcnJvcign7L2U7Iqk7YSwIOuMgOyDgSDsl4bsnYw6ICcrcy5hY3Rvcik7aWYodGhpcy5zZWF0c1tzZWF0XS5jb2FzdGVyKXt0aGlzLnN0ZXBEb25lKHMpO3JldHVybjt9aWYocy5hcmc9PT0ndHV0b3JpYWwnJiZ0aGlzLmRheT09PTAmJiF0aGlzLnByb2dyZXNzLmZsYWdzLmRheTBfc2tpcF90dXRvcmlhbCl7dGhpcy50dXRvcmlhbD17a2luZDonY29hc3Rlcicsc2VhdCxzdGVwOnN9O3RoaXMubG9nKCd0dXRvcmlhbF93YWl0Jyx7a2luZDonY29hc3Rlcicsc2VhdH0pO3JldHVybjt9dGhpcy5zZWF0c1tzZWF0XS5jb2FzdGVyPXRydWU7dGhpcy5sb2coJ3N0b3J5X2NvYXN0ZXInLHthY3RvcjpzLmFjdG9yLHNlYXR9KTt0aGlzLnNldFRyYW5zaXRpb24oLjQ1LCgpPT50aGlzLnN0ZXBEb25lKHMpKTtyZXR1cm47fVxuICAgaWYocy50eXBlPT09J2Nob2ljZScpe2NvbnN0IHJvd3M9c29ydFNlcSh0aGlzLnQuYmFyX2Nob2ljZXMuZmlsdGVyKGM9PmMuY29udGV4dD09PXMuYXJnKSk7aWYoIXJvd3MubGVuZ3RoKXRocm93IEVycm9yKCfshKDtg53sp4Ag7IS47Yq4IOyXhuydjDogJytzLmFyZyk7dGhpcy5jaG9pY2U9e3N0ZXA6cyxyb3dzfTtyZXR1cm47fVxuICAgaWYocy50eXBlPT09J2NyYWZ0Jyl7aWYoIXRoaXMuY3VycmVudE9yZGVyKXRocm93IEVycm9yKCfsoJzsobAg7KCEIOyjvOusuCDsl4bsnYwnKTt0aGlzLnNjcmVlbj0nYmFyJzt0aGlzLmNyYWZ0UmVtaW5kZXI9dGhpcy5sYXN0U3RvcnlMaW5lP3suLi50aGlzLmxhc3RTdG9yeUxpbmUsY2hhcnM6dGhpcy5sYXN0U3RvcnlMaW5lLnRleHQubGVuZ3RofTpudWxsO3RoaXMuY3JhZnRTdGVwPXM7aWYocy5hcmc9PT0ndHV0b3JpYWxfYmVlcicmJnRoaXMuZGF5PT09MSl7dGhpcy50dXRvcmlhbD17a2luZDoncmVjaXBlJyxiZWVyOnRydWUsc2VydmljZU9wZW5lZDpmYWxzZX07dGhpcy5sb2coJ3R1dG9yaWFsX3dhaXQnLHtraW5kOidiZWVyJ30pO31pZihzLmFyZz09PSd0dXRvcmlhbF9yZWNpcGUnJiZ0aGlzLmRheT09PTAmJiF0aGlzLnByb2dyZXNzLmZsYWdzLmRheTBfc2tpcF90dXRvcmlhbCYmIXRoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MF9yZWNpcGVfdGF1Z2h0KXt0aGlzLnR1dG9yaWFsPXtraW5kOidyZWNpcGUnLHNlcnZpY2VPcGVuZWQ6ZmFsc2V9O3RoaXMubG9nKCd0dXRvcmlhbF93YWl0Jyx7a2luZDoncmVjaXBlJ30pO31yZXR1cm47fVxuICAgaWYocy50eXBlPT09J3NlcnZlJyl7dGhyb3cgRXJyb3IoJ+ygnOyhsCDqsrDqs7wv7ISc67mZIOyeheugpSDsl4bsnbQgc2VydmXsl5Ag64+E7LCpJyk7fVxuICAgaWYocy50eXBlPT09J2VmZmVjdCd8fHMudHlwZT09PSdzZXRfc3RhdGUnKXthcHBseUVmZmVjdHMocy5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMuc3RvcnkuaW5kZXgrKztjb250aW51ZTt9XG4gICBpZihzLnR5cGU9PT0nZngnfHxzLnR5cGU9PT0nc2Z4Jyl7Y29uc3QgZHVyYXRpb249cy5hcmc9PT0naGFyZF9jdXQnPzAuMjowLjc7dGhpcy5lZmZlY3RWaXN1YWw9e2tpbmQ6cy50eXBlLGlkOnMuYXJnLHVudGlsOnRoaXMucmVhbFRpbWUrZHVyYXRpb259O3RoaXMubG9nKCdlZmZlY3RfcHJldmlldycse3R5cGU6cy50eXBlLGlkOnMuYXJnLGR1bW15OnRydWV9KTtpZihzLnN5bmM9PT0nd2FpdCcpe3RoaXMuc2V0VHJhbnNpdGlvbihkdXJhdGlvbiwoKT0+dGhpcy5zdGVwRG9uZShzKSk7cmV0dXJuO31hcHBseUVmZmVjdHMocy5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMuc3RvcnkuaW5kZXgrKztjb250aW51ZTt9XG4gICBpZihzLnR5cGU9PT0nZW5kX3BhcnQnKXtpZih0aGlzLmN1cnJlbnRPcmRlcil0aHJvdyBFcnJvcignZW5kX3BhcnQg7JWeIOuvuOyymOumrCDso7zrrLgnKTt0aGlzLmZpbmlzaERheSgpO3JldHVybjt9XG4gICB0aHJvdyBFcnJvcign66+47KeA7JuQIOuwlCDsiqTthZ06ICcrcy50eXBlKTtcbiAgfVxuICB0aHJvdyBFcnJvcign64yA67O4IOustO2VnCDsp4Ttlokg7LCo64uoJyk7XG4gfVxuIC8vIE9ubHkgZ3Vlc3RzIG9yZGVyaW5nIGR1cmluZyB0aGlzIHZpc2l0IG5lZWQgYSBjb2FzdGVyLiBEbyBub3QgbG9vayBwYXN0XG4gLy8gdGhlaXIgZGVwYXJ0dXJlL3JlLWVudHJ5IG9yIGFuIHVucmVzb2x2ZWQgY2hvaWNlIGludG8gYSBkaWZmZXJlbnQgdmlzaXQuXG4gc3RvcnlIYXNVcGNvbWluZ09yZGVyKGFjdG9yLGluZGV4PXRoaXMuc3Rvcnk/LmluZGV4KXtcbiAgZm9yKGNvbnN0IHMgb2YgdGhpcy5zdG9yeT8uc3RlcHMuc2xpY2UoaW5kZXgpfHxbXSl7XG4gICBpZighWydjaG9pY2UnLCdlbmRfcGFydCddLmluY2x1ZGVzKHMudHlwZSkmJihzLmFjdG9yIT09YWN0b3J8fCFbJ2VudGVyJywnZXhpdCcsJ29yZGVyJ10uaW5jbHVkZXMocy50eXBlKSkpY29udGludWU7XG4gICAvLyBBIGZ1dHVyZSByZXN1bHQvYnJhbmNoIGlzIG5vdCBrbm93biB5ZXQ7IGRlZmVyIHRoZSBnYXRlIHVudGlsIGl0IHJlc29sdmVzLlxuICAgdHJ5e2lmKCFjb25kaXRpb24ocy53aGVuLHRoaXMuY3R4KCkpKWNvbnRpbnVlO31jYXRjaHtyZXR1cm4gZmFsc2U7fVxuICAgaWYocy50eXBlPT09J2Nob2ljZSd8fHMudHlwZT09PSdlbmRfcGFydCd8fHMuYWN0b3I9PT1hY3RvciYmWydleGl0JywnZW50ZXInXS5pbmNsdWRlcyhzLnR5cGUpKXJldHVybiBmYWxzZTtcbiAgIGlmKHMuYWN0b3I9PT1hY3RvciYmcy50eXBlPT09J29yZGVyJylyZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG4gfVxuIHN0b3J5Q29hc3RlckVsaWdpYmxlKGFjdG9yLGluZGV4PXRoaXMuc3Rvcnk/LmluZGV4KXtyZXR1cm4gdGhpcy5waGFzZT09PSdyZWd1bGFyJyYmdGhpcy5zdG9yeUhhc1VwY29taW5nT3JkZXIoYWN0b3IsaW5kZXgpJiYhKHRoaXMuZGF5PT09MCYmYWN0b3I9PT0nY2hyaXMnJiYhdGhpcy5wcm9ncmVzcy5mbGFncy5kYXkwX3NraXBfdHV0b3JpYWwmJnRoaXMuc3Rvcnk/LnN0ZXBzLnNvbWUocz0+cy50eXBlPT09J2NvYXN0ZXInJiZzLmFyZz09PSd0dXRvcmlhbCcpKTt9XG4gd2FpdEZvclN0b3J5Q29hc3RlcihzdGVwLGtpbmQpe1xuICBpZighdGhpcy5zdG9yeUNvYXN0ZXJFbGlnaWJsZShzdGVwLmFjdG9yKSlyZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHNlYXQ9T2JqZWN0LmtleXModGhpcy5zZWF0cykuZmluZChrPT50aGlzLnNlYXRzW2tdPy5hY3Rvcj09PXN0ZXAuYWN0b3ImJiF0aGlzLnNlYXRzW2tdLmNvYXN0ZXIpO1xuICBpZighc2VhdClyZXR1cm4gZmFsc2U7XG4gIHRoaXMuc3RvcnlDb2FzdGVyPXtzZWF0LHN0ZXAsa2luZH07dGhpcy5mb2N1cz1zZWF0O3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO1xuIH1cbiBzdG9yeUNvYXN0ZXJSZWFkeSgpe3JldHVybiAhIXRoaXMuc3RvcnlDb2FzdGVyJiYodGhpcy5zdG9yeUNvYXN0ZXIua2luZCE9PSdsaW5lJ3x8dGhpcy5kaWFsb2d1ZT8uc3RlcD09PXRoaXMuc3RvcnlDb2FzdGVyLnN0ZXAmJnRoaXMuZGlhbG9ndWUuY2hhcnM+PXRoaXMuZGlhbG9ndWUudGV4dC5sZW5ndGgpO31cbiBzZXRUcmFuc2l0aW9uKHNlYyxmbil7dGhpcy5kaWFsb2d1ZT1udWxsO3RoaXMudHJhbnNpdGlvbj1zZWM7dGhpcy5wZW5kaW5nVHJhbnNpdGlvbj1mbjt9XG4gc3BlYWtlck5hbWUoYWN0b3Ipe3JldHVybiBhY3Rvcj09PSd0b20nJiZ0aGlzLmRheT09PTEmJnRoaXMucGhhc2U9PT0ncmVndWxhcicmJiF0aGlzLnByb2dyZXNzLmZsYWdzLnRvbV9uYW1lX2tub3duPyc/Pz8nOnRoaXMubmFtZShhY3Rvcik7fVxuIG1ha2VMaW5lKGFjdG9yLHRleHQsaWQ9bnVsbCxleHByZXNzaW9uPSdkZWZhdWx0Jyl7XG4gIGNvbnN0IHRpbWluZ3M9W10sc3BlZWRTdGFjaz1bdGhpcy5jKCd0eXBpbmdfaW50ZXJ2YWxfbXMnLDUwKV07Zm9yKGNvbnN0IHBhcnQgb2YgU3RyaW5nKHRleHQpLnNwbGl0KC8oPFxcLz9bYS16XSs+KS9nKSl7Y29uc3QgdGFnPXBhcnQubWF0Y2goL148KFxcLz8pKFthLXpdKyk+JC8pO2lmKHRhZyl7Y29uc3QgcnVsZT10aGlzLnQudGV4dF90YWdzLmZpbmQodD0+dC50YWc9PT10YWdbMl0mJnQua2luZD09PSdzcGVlZF9tcycpO2lmKHJ1bGUpe2lmKHRhZ1sxXSYmc3BlZWRTdGFjay5sZW5ndGg+MSlzcGVlZFN0YWNrLnBvcCgpO2Vsc2UgaWYoIXRhZ1sxXSlzcGVlZFN0YWNrLnB1c2gobihydWxlLnZhbHVlKSk7fX1lbHNlIGZvcihsZXQgaT0wO2k8cGFydC5sZW5ndGg7aSsrKXRpbWluZ3MucHVzaChzcGVlZFN0YWNrLmF0KC0xKSk7fVxuICByZXR1cm57YWN0b3IsdGV4dDpjbGVhbih0ZXh0KSxyYXc6dGV4dCxpZCxleHByZXNzaW9uOmV4cHJlc3Npb258fCdkZWZhdWx0JyxjaGFyczowLGhvbGQ6MCxzZWVuOmZhbHNlLHRpbWluZ3MsdHlwZU1zOjB9O1xuIH1cbiB0eXBlTGluZShsaW5lLGR0KXtjb25zdCBiZWZvcmU9bGluZS5jaGFycztsaW5lLnR5cGVNcys9ZHQqdGhpcy5kaWFsb2dTcGVlZCpURVhUX1NQRUVEX0JBU0UqMTAwMDt3aGlsZShsaW5lLmNoYXJzPGxpbmUudGV4dC5sZW5ndGgpe2NvbnN0IGRlbGF5PWxpbmUudGltaW5ncz8uW01hdGguZmxvb3IobGluZS5jaGFycyldfHx0aGlzLmMoJ3R5cGluZ19pbnRlcnZhbF9tcycsNTApO2lmKGxpbmUudHlwZU1zPGRlbGF5KWJyZWFrO2xpbmUudHlwZU1zLT1kZWxheTtsaW5lLmNoYXJzKys7fWlmKHRoaXMuc2NyZWVuPT09J2JhcicmJnRoaXMuY3VycmVudERpYWxvZ3VlKCk9PT1saW5lKXJvb3QuTHVuYURpYWxvZ3VlQXVkaW8/LnJldmVhbChsaW5lLnRleHQsYmVmb3JlLGxpbmUuY2hhcnMpO31cbiBmaW5pc2hMaW5lKCl7Y29uc3QgZD10aGlzLmRpYWxvZ3VlO2lmKCFkfHx0aGlzLnN0b3J5Q29hc3RlcilyZXR1cm47aWYoZC5pZCl0aGlzLnJlYWQuYWRkKGQuaWQpO3RoaXMuaGlzdG9yeS5wdXNoKHthY3RvcjpkLmFjdG9yLHRleHQ6ZC50ZXh0LHNjZW5lOnRoaXMuc3Rvcnk/LnNjZW5lPy5pZCxpZDpkLmlkLGFub255bW91czpkLmFjdG9yPT09J3RvbScmJnRoaXMuc3BlYWtlck5hbWUoZC5hY3Rvcik9PT0nPz8/J30pO2NvbnN0IHM9ZC5zdGVwO3RoaXMubGFzdFN0b3J5TGluZT17Li4uZCxjaGFyczpkLnRleHQubGVuZ3RofTt0aGlzLmRpYWxvZ3VlPW51bGw7aWYocy50eXBlPT09J29yZGVyJyl0aGlzLmNyZWF0ZVN0b3J5T3JkZXIocyk7dGhpcy5zdGVwRG9uZShzKTt9XG4gYWR2YW5jZSgpe2lmKHRoaXMuaXNQYXVzZWQoKXx8dGhpcy50cmFuc2l0aW9uPjB8fHRoaXMuY2FtZXJhTGVmdD4wfHx0aGlzLmNhbWVyYU1vdmluZ3x8dGhpcy5zY3JlZW4hPT0nYmFyJ3x8IXRoaXMuZGlhbG9ndWV8fHRoaXMucGhhc2U9PT0nZ2VuZXJhbCcpcmV0dXJuIGZhbHNlO2NvbnN0IGQ9dGhpcy5kaWFsb2d1ZTtpZihkLmNoYXJzPGQudGV4dC5sZW5ndGgpZC5jaGFycz1kLnRleHQubGVuZ3RoO2Vsc2Uge2lmKHRoaXMuc3RvcnlDb2FzdGVyKXJldHVybiBmYWxzZTt0aGlzLnNhZmUoKCk9PnRoaXMuZmluaXNoTGluZSgpKTt9dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuIGNob29zZShzZXEpe2lmKCF0aGlzLmNob2ljZXx8dGhpcy5pc1BhdXNlZCgpfHx0aGlzLmNhbWVyYU1vdmluZ3x8dGhpcy5jYW1lcmFMZWZ0PjB8fHRoaXMudHJhbnNpdGlvbj4wKXJldHVybiBmYWxzZTtyZXR1cm4gdGhpcy5zYWZlKCgpPT57Y29uc3QgYz10aGlzLmNob2ljZS5yb3dzLmZpbmQoYz0+bihjLnNlcSk9PT1OdW1iZXIoc2VxKSk7aWYoIWN8fCFjb25kaXRpb24oYy53aGVuLHRoaXMuY3R4KCkpKXJldHVybiBmYWxzZTtjb25zdCB0YXJnZXQ9Yy5nb3RvP3RoaXMudC5zY2VuZXMuZmluZChzPT5zLmlkPT09Yy5nb3RvJiZuKHMuZGF5KT09PXRoaXMuZGF5KTpudWxsO2lmKGMuZ290byYmIXRhcmdldCl0aHJvdyBFcnJvcign67aE6riwIOyUrCDsl4bsnYw6ICcrYy5nb3RvKTtjb25zdCBzdGVwPXRoaXMuY2hvaWNlLnN0ZXA7YXBwbHlFZmZlY3RzKGMuZWZmZWN0cyx0aGlzLnByb2dyZXNzKTthcHBseUVmZmVjdHMoc3RlcC5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMubG9nKCdjaG9pY2UnLHtpZDpzdGVwLmFyZyxzZXE6Yy5zZXEsZ290bzpjLmdvdG99KTt0aGlzLmNob2ljZT1udWxsO2lmKHRhcmdldCl0aGlzLmxvYWRTY2VuZSh0YXJnZXQpO2Vsc2Uge3RoaXMuc3RvcnkuaW5kZXgrKzt0aGlzLnB1bXAoKTt9dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fSk7fVxuIGNyZWF0ZVN0b3J5T3JkZXIocyl7XG4gIGNvbnN0IGZyZWVDaG9pY2U9cy5hcmc9PT0nZnJlZScsaWQ9ZnJlZUNob2ljZT90aGlzLmNvY2t0YWlsc0F2YWlsYWJsZSgpWzBdPy5pZDpzLmFyZz8ubWF0Y2goL15leGFjdDooLispJC8pPy5bMV07aWYoIWlkKXRocm93IEVycm9yKCfrr7jsp4Dsm5Ag7KO866y4IO2YleyLnTogJytzLmFyZyk7dGhpcy5jb2NrdGFpbChpZCk7Y29uc3Qgc2VhdD1PYmplY3Qua2V5cyh0aGlzLnNlYXRzKS5maW5kKGs9PnRoaXMuc2VhdHNba10/LmFjdG9yPT09cy5hY3Rvcik7aWYoIXNlYXQpdGhyb3cgRXJyb3IoJ+yjvOusuOyekCDssKnshJ0g7KCV67O0IOyXhuydjDogJytzLmFjdG9yKTtcbiAgaWYodGhpcy5jdXJyZW50T3JkZXIpdGhyb3cgRXJyb3IoJ+yVniDso7zrrLjsnbQg66+47JmE66OMJyk7dGhpcy5yZXN1bHRDb250ZXh0PXt9O3RoaXMuY3VycmVudE9yZGVyPXtpZDonb3JkZXJfJysoKyt0aGlzLnNlcmlhbCksYWN0b3I6cy5hY3RvcixzZWF0LGNvY2t0YWlsOmlkLC4uLihmcmVlQ2hvaWNlP3tmcmVlQ2hvaWNlOnRydWV9Ont9KSwuLi4ocy5wYXltZW50P3twYXltZW50OnMucGF5bWVudH06e30pfTt0aGlzLnJlc3VsdENvbnRleHQub3JkZXJlZD1pZDtpZih0aGlzLnBoYXNlPT09J29wZW5pbmcnKXRoaXMuc2VhdHNbc2VhdF0uY29hc3Rlcj10cnVlO3RoaXMuc2VhdHNbc2VhdF0ub3JkZXI9dGhpcy5jdXJyZW50T3JkZXI7dGhpcy5sb2coJ29yZGVyJyx7Li4udGhpcy5jdXJyZW50T3JkZXJ9KTtcbiB9XG4gZmluaXNoR2VuZXJhbFNlcnZpY2UoKXt0aGlzLnN0YXJ0U3RvcnlQaGFzZSgnYmFyJyk7fVxuIHN0YXJ0R2VuZXJhbCgpe1xuICB0aGlzLnN0b3J5Q29hc3Rlcj1udWxsO1xuICB0aGlzLnBoYXNlPSdnZW5lcmFsJzt0aGlzLnByb2dyZXNzLnBoYXNlPSdiYXJfb3Blbic7dGhpcy5zY3JlZW49J2Jhcic7dGhpcy5zZWF0cz17TDpudWxsLE06bnVsbCxSOm51bGx9O3RoaXMuc3Rvcnk9bnVsbDt0aGlzLmRpYWxvZ3VlPW51bGw7dGhpcy5xdWV1ZT1zb3J0U2VxKFsuLi50aGlzLnQucmFuZG9tX3dhdmVzLC4uLnRoaXMudC5yZWd1bGFyX3Nsb3RzXS5maWx0ZXIocz0+bihzLmRheSk9PT10aGlzLmRheSkpO3RoaXMucXVldWVJbmRleD0wO3RoaXMuc3Bhd25CbG9ja2VkPWZhbHNlO3RoaXMuc3Bhd25MZWZ0PXRoaXMuYygnZmlyc3Rfc3Bhd25fZGVsYXlfc2VjJyw1KStuKHRoaXMucXVldWVbMF0/LmRlbGF5X3NlYyk7dGhpcy5mb2N1cz0nTCc7XG4gIHRoaXMubG9nKCdwaGFzZV9zdGFydCcse3BoYXNlOidnZW5lcmFsJyxzbG90czp0aGlzLnF1ZXVlLmxlbmd0aH0pO2lmKCF0aGlzLnF1ZXVlLmxlbmd0aCl0aGlzLmZpbmlzaEdlbmVyYWxTZXJ2aWNlKCk7XG4gfVxuIGFwcGVhcmFuY2UoKXtcbiAgY29uc3QgZ2VuZGVyPXRoaXMucm5nKCk8MC41PydtJzonZic7Y29uc3Qgc2xvdHM9Wydib2R5Jywnb3V0Zml0JywnZXllcycsJ2V5ZWJyb3dzJywnbW91dGgnLCdoYWlyJ107bGV0IGlkcz1bXSxsYXllcnM9W107XG4gIC8vIENTViBJRHMgYXJlIHJldGFpbmVkOyBhcnQgZmlsZW5hbWVzIGFyZSBhIHZpZXcgbWFwcGluZywgbm90IGEgc2NoZW1hIGNoYW5nZS5cbiAgZm9yKGNvbnN0IHNsb3Qgb2Ygc2xvdHMpe2NvbnN0IGxpc3Q9dGhpcy50Lmd1ZXN0X3BhcnRzLmZpbHRlcihwPT5wLmdlbmRlcj09PWdlbmRlciYmcC5pZC5zdGFydHNXaXRoKHNsb3QrJ18nK2dlbmRlcikpO2NvbnN0IHA9d2VpZ2h0ZWQobGlzdCx0aGlzLnJuZyk7Y29uc3QgaWQ9cD8uaWR8fHNsb3QrJ18nK2dlbmRlcisoc2xvdD09PSdib2R5Jz8nJzonXzEnKTtpZHMucHVzaChpZCk7fVxuICBjb25zdCBvcHRpb25hbD10aGlzLnQuZ3Vlc3RfcGFydHMuZmlsdGVyKHA9PnAuZ2VuZGVyPT09Z2VuZGVyJiYvXihhcm1fYWNjZXNzb3J5fG5lY2tsYWNlfG91dGVyd2VhcilfLy50ZXN0KHAuaWQpKTtpZihvcHRpb25hbC5sZW5ndGgmJnRoaXMucm5nKCk+MC41KXtjb25zdCBwPXdlaWdodGVkKG9wdGlvbmFsLHRoaXMucm5nKTtpZighdGhpcy50Lmd1ZXN0X2V4Y2x1c2lvbnMuc29tZShlPT4oZS5hPT09cC5pZCYmaWRzLmluY2x1ZGVzKGUuYikpfHwoZS5iPT09cC5pZCYmaWRzLmluY2x1ZGVzKGUuYSkpKSlpZHMucHVzaChwLmlkKTt9XG4gIGNvbnN0IG1hcD17b3V0Zml0Oid0b3AnLGV5ZWJyb3dzOidleWVicm93Jyxhcm1fYWNjZXNzb3J5OidBY2MnLG5lY2tsYWNlOidBY2MnLG91dGVyd2VhcjonY3liZXJ3YXJlJ307XG4gIGNvbnN0IGFydEtleT1pZD0+e2NvbnN0IG09aWQubWF0Y2goL14oLiopX1ttZl0oPzpfKFxcZCspKT8kLyk7cmV0dXJuIG0/J2d1ZXN0XycrZ2VuZGVyKydfJysobWFwW21bMV1dfHxtWzFdKSsobVsyXT8nXycrbVsyXTonJyk6Jyc7fTtcbiAgY29uc3QgcmVxdWVzdGVkPVsuLi5pZHNdLG1pc3Npbmc9aWRzLmZpbHRlcihpZD0+IXRoaXMuZGF0YS5hc3NldHNbYXJ0S2V5KGlkKV0pO1xuICAvLyBBIG1pc3Npbmcgb3V0Zml0IG11c3Qgbm90IHNpbGVudGx5IHR1cm4gaW50byBhbiBpbmNvbXBhdGlibGUgc2xlZXZlZCB0b3BcbiAgLy8gd2hpbGUga2VlcGluZyBhbiBhcm0gYWNjZXNzb3J5LiBVc2UgdGhlIENTVidzIHdob2xlIHNhZmUgZGVmYXVsdCBzZXQuXG4gIGlmKG1pc3NpbmcubGVuZ3RoKXtjb25zdCBkZWZhdWx0cz10aGlzLnQuZ3Vlc3Rfc2V0dGluZ3NbMF07aWRzPXNsb3RzLm1hcChzbG90PT5kZWZhdWx0c1snZGVmYXVsdHMuJytnZW5kZXIrJy4nK3Nsb3RdKTt0aGlzLmxvZygnYXBwZWFyYW5jZV9mYWxsYmFjaycse3JlcXVlc3RlZCxtaXNzaW5nLHVzZWQ6aWRzfSk7fVxuICBmb3IoY29uc3QgaWQgb2YgaWRzKXtjb25zdCBrPWFydEtleShpZCk7aWYodGhpcy5kYXRhLmFzc2V0c1trXSlsYXllcnMucHVzaChrKTt9XG4gIHJldHVybiB7Z2VuZGVyLGlkcyxsYXllcnMscmVxdWVzdGVkLG1pc3Npbmd9O1xuIH1cbiBzcGF3bigpe2NvbnN0IHNsb3Q9dGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXhdO2lmKCFzbG90KXJldHVybjtjb25zdCBmcmVlPU9iamVjdC5rZXlzKHRoaXMuc2VhdHMpLmZpbHRlcihrPT4hdGhpcy5zZWF0c1trXSYmIXRoaXMudGFibGVGYWRlc1trXSk7aWYoIWZyZWUubGVuZ3RoKXt0aGlzLnNwYXduQmxvY2tlZD10cnVlO3JldHVybjt9Y29uc3Qgc2VhdD1mcmVlW01hdGguZmxvb3IodGhpcy5ybmcoKSpmcmVlLmxlbmd0aCldO2lmKGZyZWUubGVuZ3RoPT09Myl0aGlzLmZvY3VzPXNlYXQ7XG4gIGNvbnN0IHA9dGhpcy50LnBlcnNvbmFsaXRpZXMuZmluZChwPT5wLmlkPT09KHNsb3QucGVyc29uYWxpdHl8fCdnZW50bGUnKSk7Y29uc3QgbGltaXQ9Y2xhbXAodGhpcy5jKCdjb2FzdGVyX2Jhc2Vfc2VjJykqbihwLnBhdGllbmNlX211bHQsMSksdGhpcy5jKCdjb2FzdGVyX21pbl9zZWMnKSx0aGlzLmMoJ2NvYXN0ZXJfbWF4X3NlYycpKTtcbiAgY29uc3QgZz17aWQ6J2d1ZXN0XycrKCsrdGhpcy5zZXJpYWwpLGFjdG9yOnNsb3QuY2hhcmFjdGVyfHxzbG90LnBlcnNvbmFsaXR5LHNsb3QscGVyc29uYWxpdHk6cCxhcHBlYXJhbmNlOnNsb3QuY2hhcmFjdGVyP251bGw6dGhpcy5hcHBlYXJhbmNlKCksc2VhdCxzdGF0ZTonV0FJVF9DT0FTVEVSJyxjb2FzdGVyOmZhbHNlLGdsYXNzOm51bGwscm91bmQ6MCxtYXhSb3VuZHM6bihzbG90Lm1heF9yb3VuZHMsMSksY29hc3RlckxpbWl0OmxpbWl0LGxlZnQ6bGltaXQsbGltaXQsd2FybjowLHBlbmRpbmdXYXJuOjAscmVhc2tpbmc6ZmFsc2UsbGluZXM6W10sbGluZUluZGV4OjAsb3JkZXI6bnVsbCxpZGxlTGVmdDoxMCxsYXN0R3JhZGU6bnVsbH07XG4gIHRoaXMuc2VhdHNbc2VhdF09Zzt0aGlzLnNldEJhcmtzKGcsWydjYWxsJ10pO3RoaXMucXVldWVJbmRleCsrO3RoaXMuc3Bhd25MZWZ0PW4odGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXhdPy5kZWxheV9zZWMsdGhpcy5jKCdzcGF3bl9kZWxheV9kZWZhdWx0X3NlYycpKTt0aGlzLnNwYXduQmxvY2tlZD1mYWxzZTt0aGlzLmxvZygnZ3Vlc3RfZW50ZXInLHtndWVzdDpnLmlkLHNlYXQscGVyc29uYWxpdHk6cC5pZCxhcHBlYXJhbmNlOmcuYXBwZWFyYW5jZT8uaWRzfSk7XG4gfVxuIGJhcmsoZyxzaXR1YXRpb24sYWN0b3I9bnVsbCl7XG4gIGNvbnN0IHZvaWNlPWFjdG9yfHxnLnNsb3QuY2hhcmFjdGVyfHxnLnBlcnNvbmFsaXR5LmlkO2xldCByb3dzPXRoaXMudC5iYXJrcy5maWx0ZXIocj0+ci5zaXR1YXRpb249PT1zaXR1YXRpb24mJnIudm9pY2VfaWQ9PT12b2ljZSk7XG4gIGlmKCFyb3dzLmxlbmd0aClyb3dzPXRoaXMudC5iYXJrcy5maWx0ZXIocj0+ci5zaXR1YXRpb249PT1zaXR1YXRpb24mJnIudm9pY2VfaWQ9PW51bGwpO1xuICBjb25zdCBrZXk9dm9pY2UrJzonK3NpdHVhdGlvbixvbGQ9dGhpcy5iYXJrTGFzdFtrZXldO2lmKHJvd3MubGVuZ3RoPjEpcm93cz1yb3dzLmZpbHRlcihyPT5yLnJvd19pZCE9PW9sZCk7XG4gIGNvbnN0IHJvdz13ZWlnaHRlZChyb3dzLHRoaXMucm5nKTtpZihyb3cpdGhpcy5iYXJrTGFzdFtrZXldPXJvdy5yb3dfaWQ7XG4gIGxldCB0eHQ9cm93P3RoaXMudGV4dChyb3cpOicnO2lmKCF0eHQmJnNpdHVhdGlvbj09PSdhc2tfb3JkZXInKXR4dD10aGlzLmxhbmc9PT0na28nPyfso7zrrLjtlZjsi5zqsqDslrTsmpQ/JzonV2hhdCB3b3VsZCB5b3UgbGlrZT8nO1xuICBpZighdHh0KXt0aGlzLmxvZygnYmFya19taXNzaW5nJyx7dm9pY2Usc2l0dWF0aW9ufSk7dHh0PXRoaXMubGFuZz09PSdrbyc/J+KApic6J+KApic7fVxuICB0eHQ9dHh0LnJlcGxhY2UoL1xce2NvY2t0YWlsXFx9L2csdGhpcy5uYW1lKGcub3JkZXI/LmNvY2t0YWlsfHxnLm5leHRDb2NrdGFpbCkpO1xuICByZXR1cm4gey4uLnRoaXMubWFrZUxpbmUoYWN0b3J8fGcuYWN0b3IsdHh0LHJvdz8ucm93X2lkLHJvdz8uZXhwcmVzc2lvbiksc2l0dWF0aW9ufTtcbiB9XG4gc2V0QmFya3MoZyxzaXR1YXRpb25zLG9uRG9uZT1udWxsKXtnLmxpbmVzPXNpdHVhdGlvbnMubWFwKHM9PnRoaXMuYmFyayhnLHMscz09PSdhc2tfb3JkZXInPydsdW5hJzpudWxsKSk7Zy5saW5lSW5kZXg9MDtnLmxpbmVEb25lPW9uRG9uZTt9XG4gY29hc3RlcihzZWF0PXRoaXMuZm9jdXMsaW5wdXQ9J3Nob3J0Y3V0Jyl7XG4gIGlmKHRoaXMuc3RvcnlDb2FzdGVyKXtjb25zdCBwZW5kaW5nPXRoaXMuc3RvcnlDb2FzdGVyO2lmKHNlYXQhPT1wZW5kaW5nLnNlYXR8fCFbJ2RyYWcnLCdrZXlib2FyZCddLmluY2x1ZGVzKGlucHV0KXx8IXRoaXMuc3RvcnlDb2FzdGVyUmVhZHkoKXx8dGhpcy5pc1BhdXNlZCgpfHx0aGlzLnNjcmVlbiE9PSdiYXInfHx0aGlzLmNhbWVyYU1vdmluZ3x8dGhpcy5jYW1lcmFMZWZ0PjB8fHRoaXMudHJhbnNpdGlvbj4wKXJldHVybiBmYWxzZTtjb25zdCBndWVzdD10aGlzLnNlYXRzW3NlYXRdO2lmKCFndWVzdHx8Z3Vlc3QuYWN0b3IhPT1wZW5kaW5nLnN0ZXAuYWN0b3J8fGd1ZXN0LmNvYXN0ZXIpcmV0dXJuIGZhbHNlO2d1ZXN0LmNvYXN0ZXI9dHJ1ZTt0aGlzLnN0b3J5Q29hc3Rlcj1udWxsO3RoaXMubG9nKCdzdG9yeV9jb2FzdGVyJyx7YWN0b3I6Z3Vlc3QuYWN0b3Isc2VhdCxpbnB1dH0pO2lmKHBlbmRpbmcua2luZD09PSdsaW5lJyl0aGlzLnNhZmUoKCk9PnRoaXMuZmluaXNoTGluZSgpKTtlbHNlIHRoaXMuc2FmZSgoKT0+dGhpcy5wdW1wKCkpO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31cbiAgaWYodGhpcy50dXRvcmlhbD8ua2luZD09PSdjb2FzdGVyJyl7Y29uc3QgdD10aGlzLnR1dG9yaWFsO2lmKHRoaXMuaXNQYXVzZWQoKXx8dGhpcy5zY3JlZW4hPT0nYmFyJ3x8dGhpcy5jYW1lcmFNb3Zpbmd8fHRoaXMuY2FtZXJhTGVmdD4wfHx0aGlzLnRyYW5zaXRpb24+MHx8c2VhdCE9PXQuc2VhdHx8IVsnZHJhZycsJ2tleWJvYXJkJ10uaW5jbHVkZXMoaW5wdXQpKXJldHVybiBmYWxzZTt0aGlzLnNlYXRzW3NlYXRdLmNvYXN0ZXI9dHJ1ZTt0aGlzLnR1dG9yaWFsPW51bGw7dGhpcy5sb2coJ3N0b3J5X2NvYXN0ZXInLHthY3Rvcjp0LnN0ZXAuYWN0b3Isc2VhdCxpbnB1dH0pO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J2NvYXN0ZXInfSk7dGhpcy5zZXRUcmFuc2l0aW9uKC40NSwoKT0+dGhpcy5zdGVwRG9uZSh0LnN0ZXApKTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTt9XG4gIGlmKHRoaXMucGhhc2UhPT0nZ2VuZXJhbCd8fCFbJ2RyYWcnLCdrZXlib2FyZCddLmluY2x1ZGVzKGlucHV0KXx8dGhpcy5zY3JlZW4hPT0nYmFyJ3x8dGhpcy5pc1BhdXNlZCgpfHx0aGlzLmNhbWVyYU1vdmluZ3x8dGhpcy5jYW1lcmFMZWZ0PjB8fHRoaXMudHJhbnNpdGlvbj4wfHxzZWF0IT09dGhpcy5mb2N1cylyZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGc9dGhpcy5zZWF0c1tzZWF0XTtpZighZ3x8Zy5jb2FzdGVyfHxnLnN0YXRlIT09J1dBSVRfQ09BU1RFUid8fGcubGVmdDw9MClyZXR1cm4gZmFsc2U7XG4gIGcuY29hc3Rlcj10cnVlO2cuc3RhdGU9J09SREVSX0RJQUxPR1VFJzt0aGlzLmJlZ2luT3JkZXIoZyxmYWxzZSk7dGhpcy5sb2coJ2NvYXN0ZXInLHtndWVzdDpnLmlkLHNlYXQsaW5wdXR9KTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTtcbiB9XG4gYmVnaW5PcmRlcihnLHJlb3JkZXIpe1xuICBjb25zdCBjYW5kaWRhdGVzPXRoaXMuY29ja3RhaWxzQXZhaWxhYmxlKCk7aWYoIWNhbmRpZGF0ZXMubGVuZ3RoKXRocm93IEVycm9yKCfrrLTsnpHsnIQg7KO866y4IO2bhOuztCDsl4bsnYwnKTtnLm5leHRDb2NrdGFpbD1nLnNsb3Qub3JkZXJ8fGNhbmRpZGF0ZXNbTWF0aC5mbG9vcih0aGlzLnJuZygpKmNhbmRpZGF0ZXMubGVuZ3RoKV0uaWQ7XG4gIGNvbnN0IHNpdHVhdGlvbnM9cmVvcmRlcj9bJ3Jlb3JkZXInXTpbJ2Fza19vcmRlcicsLi4uKHRoaXMucm5nKCk8bihnLnBlcnNvbmFsaXR5LnRoaW5rX2NoYW5jZSk/WydvcmRlcl90aGluayddOltdKSwnb3JkZXInXTtcbiAgdGhpcy5zZXRCYXJrcyhnLHNpdHVhdGlvbnMsKCk9PntnLnJvdW5kKys7Y29uc3QgYz10aGlzLmNvY2t0YWlsKGcubmV4dENvY2t0YWlsKTtnLm9yZGVyPXtpZDonb3JkZXJfJysoKyt0aGlzLnNlcmlhbCksY29ja3RhaWw6Yy5pZCxhY3RvcjpnLmlkLHNlYXQ6Zy5zZWF0fTtnLmxpbWl0PW4oYy50aW1lX2xpbWl0X3NlYykrTWF0aC5tYXgodGhpcy5jKCdzZXJ2ZV9taW5fYm9udXNfc2VjJyksdGhpcy5jKCdzZXJ2ZV9ib251c19zZWMnKS1uKGMudW5sb2NrX2RheSkqdGhpcy5jKCdzZXJ2ZV9ncmFjZV9wZXJfZGF5X3NlYycpKTtnLmxlZnQ9Zy5saW1pdDtnLnN0YXRlPSdXQUlUX1NFUlZFJztnLndhcm49MDtnLnBlbmRpbmdXYXJuPTA7Zy5pZGxlTGVmdD10aGlzLmMoJ2lkbGVfbWluX3NlYycpO3RoaXMubG9nKCdvcmRlcicse2d1ZXN0OmcuaWQsLi4uZy5vcmRlcn0pO30pO1xuIH1cbiByZWFzaygpe2lmKHRoaXMucGhhc2UhPT0nZ2VuZXJhbCd8fHRoaXMuc2NyZWVuIT09J2Jhcid8fHRoaXMuaXNQYXVzZWQoKXx8dGhpcy5jYW1lcmFMZWZ0PjApcmV0dXJuIGZhbHNlO2NvbnN0IGc9dGhpcy5zZWF0c1t0aGlzLmZvY3VzXTtpZighZ3x8Zy5zdGF0ZSE9PSdXQUlUX1NFUlZFJ3x8IWcub3JkZXJ8fGcucmVhc2tpbmd8fGcubGVmdDw9MClyZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNvc3Q9Zy5saW1pdCowLjEwO2cubGVmdD1NYXRoLm1heCgwLGcubGVmdC1jb3N0KTt0aGlzLmxvZygncmVhc2snLHtndWVzdDpnLmlkLGNvc3QscmVtYWluaW5nOmcubGVmdCxvcmRlcjpnLm9yZGVyLmlkfSk7aWYoZy5sZWZ0PD0wKXt0aGlzLmxlYXZlKGcsJ2xlYXZlX3NlcnZlJyk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuICBnLnJlYXNraW5nPXRydWU7Zy5saW5lcz1bdGhpcy5tYWtlTGluZSgnbHVuYScsdGhpcy5sYW5nPT09J2tvJz9cIuyjvOusuO2VmOyLoCDrqZTribTqsIAg7Ja065akIOqxsOyYgOyjoD9cIjpcIkNvdWxkIHlvdSByZW1pbmQgbWUgd2hhdCB5b3Ugb3JkZXJlZD9cIiksdGhpcy5iYXJrKGcsJ29yZGVyJyldO2cubGluZUluZGV4PTA7Zy5saW5lRG9uZT0oKT0+e2cucmVhc2tpbmc9ZmFsc2U7aWYoZy5zdGF0ZT09PSdXQUlUX1NFUlZFJyYmZy5wZW5kaW5nV2Fybj5nLndhcm4pdGhpcy53YXJuKGcsZy5wZW5kaW5nV2Fybik7fTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTtcbiB9XG4gd2FybihnLGxldmVsKXtpZihnLnJlYXNraW5nKXtnLnBlbmRpbmdXYXJuPU1hdGgubWF4KGcucGVuZGluZ1dhcm4sbGV2ZWwpO3JldHVybjt9aWYobGV2ZWw8PWcud2FybilyZXR1cm47Zy53YXJuPWxldmVsO3RoaXMuc2V0QmFya3MoZyxbKGcuc3RhdGU9PT0nV0FJVF9DT0FTVEVSJz8nY2FsbF8nOidzZXJ2ZV8nKSsobGV2ZWw9PT0yPydmaW5hbCc6J3VyZ2UnKV0pO31cbiBsZWF2ZShnLHNpdHVhdGlvbil7Zy5yZWFza2luZz1mYWxzZTtnLnN0YXRlPSdFWElUSU5HJztnLmxlZnQ9MDtnLm9yZGVyPW51bGw7dGhpcy5zZXRCYXJrcyhnLFtzaXR1YXRpb25dKTtnLmV4aXRMZWZ0PTM7dGhpcy5sb3N0Kys7dGhpcy5sb2coJ3RpbWVvdXQnLHtndWVzdDpnLmlkLHNpdHVhdGlvbn0pO31cbiB0dXRvcmlhbFNlYXRUYXJnZXQoKXtjb25zdCB0PXRoaXMudHV0b3JpYWw7aWYodD8ua2luZCE9PSdzZWF0RXhwbG9yZScpcmV0dXJuIG51bGw7cmV0dXJuICF0LnZpc2l0ZWQuaW5jbHVkZXMoJ0wnKT8nTCc6IXQudmlzaXRlZC5pbmNsdWRlcygnUicpPydSJzp0Lm9yaWdpbjt9XG4gdXBkYXRlU2VhdFR1dG9yaWFsKCl7Y29uc3QgdD10aGlzLnR1dG9yaWFsO2lmKHQ/LmtpbmQhPT0nc2VhdEV4cGxvcmUnfHwhdC5tb3ZlZHx8dGhpcy5pc1BhdXNlZCgpfHx0aGlzLmNhbWVyYU1vdmluZ3x8dGhpcy5jYW1lcmFMZWZ0PjB8fHRoaXMudHJhbnNpdGlvbj4wKXJldHVybjtcbiAgaWYoIXQudmlzaXRlZC5pbmNsdWRlcyh0aGlzLmZvY3VzKSl0LnZpc2l0ZWQucHVzaCh0aGlzLmZvY3VzKTtcbiAgaWYoWydMJywnUiddLmV2ZXJ5KHM9PnQudmlzaXRlZC5pbmNsdWRlcyhzKSkmJnRoaXMuZm9jdXM9PT10Lm9yaWdpbil7dGhpcy50dXRvcmlhbD1udWxsO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J3NlYXRFeHBsb3JlJ30pO3RoaXMuc3RlcERvbmUodC5zdGVwKTt0aGlzLmNoYW5nZWQoKTt9XG4gfVxuIGNvbnRpbnVlQmFyVHV0b3JpYWwoKXtjb25zdCB0PXRoaXMudHV0b3JpYWw7aWYoIXR8fHRoaXMuc2NyZWVuIT09J2Jhcid8fHRoaXMuaXNQYXVzZWQoKXx8dGhpcy5jYW1lcmFNb3Zpbmd8fHRoaXMuY2FtZXJhTGVmdHx8dGhpcy50cmFuc2l0aW9uKXJldHVybiBmYWxzZTtcbiAgaWYodC5raW5kPT09J3NlYXRJbmRpY2F0b3InKXt0LmtpbmQ9J3NlYXRMZWdlbmQnO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31cbiAgaWYodC5raW5kPT09J3NlYXRMZWdlbmQnKXt0aGlzLnR1dG9yaWFsPW51bGw7dGhpcy5sb2coJ3R1dG9yaWFsX2NvbXBsZXRlJyx7a2luZDonc2VhdEluZGljYXRvcid9KTt0aGlzLnN0ZXBEb25lKHQuc3RlcCk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuICByZXR1cm4gZmFsc2U7XG4gfVxuIGZvY3VzU2VhdChzZWF0KXtjb25zdCBleHBsb3Jpbmc9dGhpcy50dXRvcmlhbD8ua2luZD09PSdzZWF0RXhwbG9yZSc7aWYoIVsnTCcsJ00nLCdSJ10uaW5jbHVkZXMoc2VhdCl8fCh0aGlzLnBoYXNlIT09J2dlbmVyYWwnJiYhZXhwbG9yaW5nKXx8dGhpcy5zY3JlZW4hPT0nYmFyJ3x8dGhpcy5pc1BhdXNlZCgpKXJldHVybiBmYWxzZTtpZih0aGlzLmZvY3VzPT09c2VhdClyZXR1cm4gZmFsc2U7XG4gIGlmKGV4cGxvcmluZyl7aWYodGhpcy5jYW1lcmFNb3Zpbmd8fHRoaXMuY2FtZXJhTGVmdD4wfHx0aGlzLnRyYW5zaXRpb24+MHx8TWF0aC5hYnMoWydMJywnTScsJ1InXS5pbmRleE9mKHRoaXMuZm9jdXMpLVsnTCcsJ00nLCdSJ10uaW5kZXhPZihzZWF0KSkhPT0xKXJldHVybiBmYWxzZTt0aGlzLnR1dG9yaWFsLm1vdmVkPXRydWU7fVxuICB0aGlzLmZvY3VzPXNlYXQ7dGhpcy5vdmVydmlldz1mYWxzZTt0aGlzLmNhbWVyYVNhbWU9ZmFsc2U7dGhpcy5jYW1lcmFMZWZ0PTAuNTU7dGhpcy5sb2coJ2ZvY3VzJyx7c2VhdH0pO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO1xuIH1cbiBhZnRlckNhbWVyYSgpe2NvbnN0IGc9dGhpcy5zZWF0c1t0aGlzLmZvY3VzXSxsaW5lPWc/LmxpbmVzPy5bZy5saW5lSW5kZXhdO2lmKGxpbmU/LnNlZW4pe2xpbmUuY2hhcnM9bGluZS50ZXh0Lmxlbmd0aDtsaW5lLmhvbGQ9MDt9dGhpcy5jbGVhbk9sZEdsYXNzKCk7fVxuIHRvZ2dsZU92ZXJ2aWV3KCl7aWYodGhpcy5waGFzZSE9PSdnZW5lcmFsJ3x8dGhpcy5zY3JlZW4hPT0nYmFyJ3x8dGhpcy5pc1BhdXNlZCgpKXJldHVybjt0aGlzLm92ZXJ2aWV3PSF0aGlzLm92ZXJ2aWV3O3RoaXMuY2FtZXJhTGVmdD0wLjU1O3RoaXMuY2FtZXJhU2FtZT10cnVlO3RoaXMuY2hhbmdlZCgpO31cbiBjbGVhbk9sZEdsYXNzKCl7aWYoIXRoaXMuZHJpbmt8fHRoaXMuc2NyZWVuIT09J2JhcicpcmV0dXJuO2NvbnN0IGc9dGhpcy5zZWF0c1t0aGlzLmZvY3VzXTtpZihnPy5zdGF0ZT09PSdXQUlUX1NFUlZFJyYmZy5vcmRlciYmZy5nbGFzcyl7Zy5nbGFzcz1udWxsO3RoaXMubG9nKCdvbGRfZ2xhc3NfY2xlYXJlZCcse2d1ZXN0OmcuaWQsc2VhdDp0aGlzLmZvY3VzfSk7fX1cbiBvcGVuVHV0b3JpYWxTZXJ2aWNlKCl7aWYodGhpcy50dXRvcmlhbD8ua2luZCE9PSdyZWNpcGUnfHx0aGlzLmlzUGF1c2VkKCl8fHRoaXMuc2NyZWVuIT09J2Jhcid8fHRoaXMuY2FtZXJhTW92aW5nfHx0aGlzLmNhbWVyYUxlZnR8fHRoaXMudHJhbnNpdGlvbilyZXR1cm4gZmFsc2U7dGhpcy50dXRvcmlhbC5zZXJ2aWNlT3BlbmVkPXRydWU7dGhpcy5sb2coJ3R1dG9yaWFsX3NlcnZpY2Vfb3BlbicpO3JldHVybiB0cnVlO31cbiBvcGVuUmVjaXBlcygpe2lmKHRoaXMudHV0b3JpYWwmJih0aGlzLnR1dG9yaWFsLmtpbmQhPT0ncmVjaXBlJ3x8IXRoaXMudHV0b3JpYWwuc2VydmljZU9wZW5lZCkpcmV0dXJuIGZhbHNlO2lmKHRoaXMuc2NyZWVuIT09J2Jhcid8fHRoaXMuZXJyb3J8fHRoaXMuaXNQYXVzZWQoKXx8dGhpcy50cmFuc2l0aW9uPjApcmV0dXJuIGZhbHNlO2lmKHRoaXMucGhhc2U9PT0nZ2VuZXJhbCd8fHRoaXMucGhhc2U9PT0ncHJhY3RpY2UnfHx0aGlzLmN1cnJlbnRPcmRlciYmdGhpcy5zdG9yeT8uc3RlcHNbdGhpcy5zdG9yeS5pbmRleF0/LnR5cGU9PT0nY3JhZnQnKXtpZih0aGlzLmRyaW5rKXJldHVybiBmYWxzZTtpZih0aGlzLnR1dG9yaWFsPy5raW5kPT09J3JlY2lwZScpe3RoaXMudHV0b3JpYWw9e2tpbmQ6J3JlY2lwZVNlbGVjdCcsYmVlcjohIXRoaXMudHV0b3JpYWwuYmVlcn07dGhpcy5sb2coJ3R1dG9yaWFsX2NvbXBsZXRlJyx7a2luZDoncmVjaXBlJ30pO310aGlzLnNjcmVlbj0ncmVjaXBlJzt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTt9cmV0dXJuIGZhbHNlO31cbiBjbG9zZVJlY2lwZXMoKXtpZih0aGlzLnR1dG9yaWFsKXJldHVybiBmYWxzZTtpZih0aGlzLnNjcmVlbiE9PSdyZWNpcGUnKXJldHVybjt0aGlzLnNjcmVlbj0nYmFyJzt0aGlzLmNoYW5nZWQoKTt9XG4gc2VsZWN0Q29ja3RhaWwoaWQpe2lmKHRoaXMudHV0b3JpYWwmJih0aGlzLnR1dG9yaWFsLmtpbmQhPT0ncmVjaXBlU2VsZWN0J3x8aWQhPT0odGhpcy50dXRvcmlhbC5iZWVyPydib3R0bGVfYmVlcic6J2dpbl90b25pYycpKSlyZXR1cm4gZmFsc2U7aWYodGhpcy5zY3JlZW4hPT0ncmVjaXBlJ3x8IXRoaXMuY29ja3RhaWxzQXZhaWxhYmxlKCkuc29tZShjPT5jLmlkPT09aWQpKXJldHVybiBmYWxzZTtpZih0aGlzLmN1cnJlbnRPcmRlcj8uZnJlZUNob2ljZSl7dGhpcy5jdXJyZW50T3JkZXIuY29ja3RhaWw9aWQ7dGhpcy5yZXN1bHRDb250ZXh0Lm9yZGVyZWQ9aWQ7fXRoaXMucHJlcD17c2VsZWN0ZWQ6aWQsZ2xhc3M6bnVsbCx0b29sOm51bGwsaW5ncmVkaWVudHM6W119O3RoaXMuc2NyZWVuPSdwcmVwJztpZih0aGlzLnR1dG9yaWFsPy5raW5kPT09J3JlY2lwZVNlbGVjdCcpdGhpcy50dXRvcmlhbD10aGlzLnR1dG9yaWFsLmJlZXI/e2tpbmQ6J2JlZXJHbGFzcycsYmVlcjp0cnVlfTp7a2luZDoncHJlcFJlY2lwZU9wZW4nfTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTt9XG4gdHV0b3JpYWxFdmVudChldmVudCx2YWx1ZSl7Y29uc3QgdD10aGlzLnR1dG9yaWFsO2lmKCF0fHx0aGlzLnNjcmVlbiE9PSdwcmVwJ3x8dGhpcy5pc1BhdXNlZCgpKXJldHVybiBmYWxzZTtpZih0LmJlZXIpe2NvbnN0IHJvdXRlPXtiZWVyVG9vbE5hdmlnYXRlOlsndG9vbCcsJ2JlZXJPcGVuZXInXSxiZWVyRnJpZGdlTmF2aWdhdGU6WydmcmlkZ2UnLCdiZWVyQWRkJ119O2NvbnN0IG5leHQ9cm91dGVbdC5raW5kXTtpZihldmVudCE9PSdzaGVsZid8fCFuZXh0fHx2YWx1ZSE9PW5leHRbMF0pcmV0dXJuIGZhbHNlO3Qua2luZD1uZXh0WzFdO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31jb25zdCByb3V0ZT17cHJlcFJlY2lwZU9wZW46WydyZWNpcGVPcGVuJywncHJlcFJlY2lwZVJlYWQnXSxwcmVwUmVjaXBlUmVhZDpbJ3JlYWQnLCdwcmVwUmVjaXBlQ2xvc2UnXSxwcmVwUmVjaXBlQ2xvc2U6WydyZWNpcGVDbG9zZScsJ3ByZXBOYXZpZ2F0ZSddLHByZXBOYXZpZ2F0ZTpbJ3NoZWxmJywncHJlcEhvdmVyJ10scHJlcEhvdmVyOlsnaG92ZXInLCdwcmVwQWRkJ119O2lmKHRoaXMudmFyaWFudCE9PSdncHQnKXtyb3V0ZS5wcmVwUmVjaXBlQ2xvc2U9WydyZWNpcGVDbG9zZScsJ3ByZXBHbGFzcyddO3JvdXRlLnByZXBOYXZpZ2F0ZT1bJ3NoZWxmJywncHJlcEhvdmVyJ107cm91dGUucHJlcFNvZGFOYXZpZ2F0ZT1bJ3NoZWxmJywncHJlcFNvZGFIb3ZlciddO3JvdXRlLnByZXBTb2RhSG92ZXI9Wydob3ZlcicsJ3ByZXBTb2RhQWRkJ107aWYoZXZlbnQ9PT0nc2hlbGYnJiZ2YWx1ZSE9PSh0LmtpbmQ9PT0ncHJlcE5hdmlnYXRlJz8nbGlxdW9yJzonZnJpZGdlJykpcmV0dXJuIGZhbHNlO31jb25zdCBuZXh0PXJvdXRlW3Qua2luZF07aWYoIW5leHR8fG5leHRbMF0hPT1ldmVudClyZXR1cm4gZmFsc2U7dGhpcy5sb2coJ3R1dG9yaWFsX2FjdGlvbicse2tpbmQ6dC5raW5kLGV2ZW50fSk7dC5raW5kPW5leHRbMV07dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuIHBpY2tJdGVtKGlkKXtpZih0aGlzLnR1dG9yaWFsKXtjb25zdCBhbGxvd2VkPXRoaXMudHV0b3JpYWwuYmVlcj97YmVlckdsYXNzOnRoaXMuY29ja3RhaWwoJ2JvdHRsZV9iZWVyJykuZ2xhc3MsYmVlckFkZDonYmVlcid9OnRoaXMudmFyaWFudD09PSdncHQnP3twcmVwQWRkOidnaW4nLHByZXBSZW1vdmU6J2dpbid9OntwcmVwR2xhc3M6J2xvbmdfZHJpbmsnLHByZXBBZGQ6J2dpbicscHJlcFJlbW92ZTonZ2luJyxwcmVwR2luQWdhaW46J2dpbicscHJlcFNvZGFBZGQ6J3NvZGFfd2F0ZXInfTtpZihhbGxvd2VkW3RoaXMudHV0b3JpYWwua2luZF0hPT1pZClyZXR1cm4gZmFsc2U7fWlmKHRoaXMuc2NyZWVuIT09J3ByZXAnfHx0aGlzLmlzUGF1c2VkKCkpcmV0dXJuO2NvbnN0IGl0ZW09dGhpcy5pdGVtc0F2YWlsYWJsZSgpLmZpbmQoaT0+aS5pZD09PWlkKTtpZighaXRlbSlyZXR1cm47XG4gIGlmKGl0ZW0ua2luZD09PSdpbmdyZWRpZW50Jyl7Y29uc3QgaT10aGlzLnByZXAuaW5ncmVkaWVudHMuaW5kZXhPZihpZCk7aWYoaT49MCl0aGlzLnByZXAuaW5ncmVkaWVudHMuc3BsaWNlKGksMSk7ZWxzZSB7Y29uc3QgYmVmb3JlPXRoaXMucHJlcC5pbmdyZWRpZW50cy5sZW5ndGg7dGhpcy5wcmVwLmluZ3JlZGllbnRzLnB1c2goaWQpO2lmKGJlZm9yZTwxMCYmdGhpcy5wcmVwLmluZ3JlZGllbnRzLmxlbmd0aD49MTApdGhpcy5vdmVybGF5PSdpbmdyZWRpZW50V2FybmluZyc7fX1cbiAgZWxzZSBpZihpdGVtLmtpbmQ9PT0nZ2xhc3MnKXRoaXMucHJlcC5nbGFzcz10aGlzLnByZXAuZ2xhc3M9PT1pZD9udWxsOmlkO1xuICBlbHNlIGlmKGl0ZW0ua2luZD09PSd0b29sJyl7dGhpcy5wcmVwLnRvb2w9dGhpcy5wcmVwLnRvb2w9PT1pZD9udWxsOmlkO2lmKHRoaXMucHJlcC50b29sKXRoaXMucHJlcC5vcGVuZXI9ZmFsc2U7fWlmKHRoaXMudHV0b3JpYWw/LmJlZXIpe3RoaXMudHV0b3JpYWwua2luZD10aGlzLnR1dG9yaWFsLmtpbmQ9PT0nYmVlckdsYXNzJz8nYmVlclRvb2xOYXZpZ2F0ZSc6J2JlZXJTdGFydCc7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fWlmKHRoaXMudHV0b3JpYWw/LmtpbmQ9PT0ncHJlcEFkZCcmJnRoaXMucHJlcC5pbmdyZWRpZW50cy5pbmNsdWRlcygnZ2luJykpe3RoaXMudHV0b3JpYWwua2luZD0ncHJlcFJlbW92ZSc7dGhpcy5sb2coJ3R1dG9yaWFsX2FjdGlvbicse2V2ZW50OidhZGQnLGluZ3JlZGllbnQ6aWR9KTt9ZWxzZSBpZih0aGlzLnR1dG9yaWFsPy5raW5kPT09J3ByZXBSZW1vdmUnJiYhdGhpcy5wcmVwLmluZ3JlZGllbnRzLmluY2x1ZGVzKCdnaW4nKSl7aWYodGhpcy52YXJpYW50PT09J2dwdCcpe3RoaXMudHV0b3JpYWw9bnVsbDt0aGlzLnByb2dyZXNzLmZsYWdzLmRheTBfcmVjaXBlX3RhdWdodD10cnVlO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J3ByZXAnfSk7fWVsc2UgdGhpcy50dXRvcmlhbC5raW5kPSdwcmVwR2luQWdhaW4nO31lbHNlIGlmKHRoaXMudmFyaWFudCE9PSdncHQnJiZ0aGlzLnR1dG9yaWFsKXtjb25zdCBuZXh0PXtwcmVwR2xhc3M6J3ByZXBOYXZpZ2F0ZScscHJlcEdpbkFnYWluOidwcmVwU29kYU5hdmlnYXRlJyxwcmVwU29kYUFkZDoncHJlcFN0YXJ0J31bdGhpcy50dXRvcmlhbC5raW5kXTtpZihuZXh0KXt0aGlzLmxvZygndHV0b3JpYWxfYWN0aW9uJyx7a2luZDp0aGlzLnR1dG9yaWFsLmtpbmQsZXZlbnQ6J3BpY2snLGluZ3JlZGllbnQ6aWR9KTt0aGlzLnR1dG9yaWFsLmtpbmQ9bmV4dDt9fXRoaXMuY2hhbmdlZCgpO31cbiBwaWNrT3BlbmVyKCl7aWYodGhpcy5zY3JlZW4hPT0ncHJlcCd8fHRoaXMuaXNQYXVzZWQoKXx8dGhpcy50dXRvcmlhbCYmKCF0aGlzLnR1dG9yaWFsLmJlZXJ8fHRoaXMudHV0b3JpYWwua2luZCE9PSdiZWVyT3BlbmVyJykpcmV0dXJuIGZhbHNlO3RoaXMucHJlcC5vcGVuZXI9IXRoaXMucHJlcC5vcGVuZXI7aWYodGhpcy5wcmVwLm9wZW5lcil0aGlzLnByZXAudG9vbD1udWxsO2lmKHRoaXMudHV0b3JpYWw/LmJlZXIpdGhpcy50dXRvcmlhbC5raW5kPSdiZWVyRnJpZGdlTmF2aWdhdGUnO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO31cbiBwcmVwQmFjaygpe2lmKHRoaXMudHV0b3JpYWwpcmV0dXJuIGZhbHNlO2lmKHRoaXMuc2NyZWVuIT09J3ByZXAnKXJldHVybjt0aGlzLnByZXA9bnVsbDt0aGlzLnNjcmVlbj0ncmVjaXBlJzt0aGlzLmxvZygncHJlcF9yZXNldCcpO3RoaXMuY2hhbmdlZCgpO31cbiBzdGFydENyYWZ0KCl7aWYodGhpcy5zY3JlZW4hPT0ncHJlcCd8fHRoaXMuaXNQYXVzZWQoKSlyZXR1cm4gZmFsc2U7aWYodGhpcy50dXRvcmlhbD8uYmVlcil7aWYodGhpcy50dXRvcmlhbC5raW5kIT09J2JlZXJTdGFydCd8fHRoaXMucHJlcD8uZ2xhc3MhPT10aGlzLmNvY2t0YWlsKCdib3R0bGVfYmVlcicpLmdsYXNzfHwhdGhpcy5wcmVwLm9wZW5lcnx8IXRoaXMucHJlcC5pbmdyZWRpZW50cy5pbmNsdWRlcygnYmVlcicpKXJldHVybiBmYWxzZTt0aGlzLnR1dG9yaWFsPW51bGw7fWlmKHRoaXMudHV0b3JpYWwmJih0aGlzLnZhcmlhbnQ9PT0nZ3B0J3x8dGhpcy50dXRvcmlhbC5raW5kIT09J3ByZXBTdGFydCd8fHRoaXMucHJlcD8uZ2xhc3MhPT0nbG9uZ19kcmluayd8fCFbJ2dpbicsJ3NvZGFfd2F0ZXInXS5ldmVyeShpZD0+dGhpcy5wcmVwLmluZ3JlZGllbnRzLmluY2x1ZGVzKGlkKSkpKXJldHVybiBmYWxzZTtpZih0aGlzLnNjcmVlbiE9PSdwcmVwJ3x8IXRoaXMucHJlcD8uZ2xhc3N8fCF0aGlzLnByZXAuaW5ncmVkaWVudHMubGVuZ3RofHx0aGlzLmlzUGF1c2VkKCkpcmV0dXJuIGZhbHNlO2lmKHRoaXMucHJlcC5pbmdyZWRpZW50cy5pbmNsdWRlcygnYmVlcicpJiYhdGhpcy5wcmVwLm9wZW5lcil7dGhpcy5vdmVybGF5PSdvcGVuZXJXYXJuaW5nJzt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gZmFsc2U7fXJldHVybiB0aGlzLnNhZmUoKCk9Pnt0aGlzLmNyYWZ0PXtpZDonY3JhZnRfYXR0ZW1wdF8nKygrK3RoaXMuc2VyaWFsKSxhY3R1YWw6c3RydWN0dXJlZENsb25lKHRoaXMucHJlcCkscXVldWU6YnVpbGRRdWV1ZSh0aGlzLmRhdGEsdGhpcy5jb2NrdGFpbCh0aGlzLnByZXAuc2VsZWN0ZWQpLHRoaXMucHJlcCksaW5kZXg6MCxyZXN1bHRzOltdLGVsYXBzZWQ6MH07dGhpcy5zY3JlZW49J2dpbW1pY2snO3RoaXMubmV4dEdpbW1pY2soKTtpZih0aGlzLnR1dG9yaWFsPy5raW5kPT09J3ByZXBTdGFydCcpe3RoaXMudHV0b3JpYWw9bnVsbDt0aGlzLnByb2dyZXNzLmZsYWdzLmRheTBfcmVjaXBlX3RhdWdodD10cnVlO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J3ByZXAnfSk7fXRoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO30pO31cbiBuZXh0R2ltbWljaygpe2NvbnN0IHN0ZXA9dGhpcy5jcmFmdC5xdWV1ZVt0aGlzLmNyYWZ0LmluZGV4XTtpZighc3RlcCl7dGhpcy5yZXN1bHQ9c2NvcmVDcmFmdCh0aGlzLmRhdGEsdGhpcy5jb2NrdGFpbCh0aGlzLmNyYWZ0LmFjdHVhbC5zZWxlY3RlZCksdGhpcy5jcmFmdC5hY3R1YWwsdGhpcy5jcmFmdC5yZXN1bHRzLHRoaXMuY3JhZnQuZWxhcHNlZCk7dGhpcy5yZXN1bHQuaWQ9dGhpcy5jcmFmdC5pZDt0aGlzLnJlc3VsdENvbnRleHQuY3JhZnRfZ3JhZGU9dGhpcy5yZXN1bHQuZ3JhZGU7dGhpcy5zY3JlZW49J3Jlc3VsdCc7dGhpcy5naW1taWNrPW51bGw7dGhpcy5sb2coJ2NyYWZ0X3Jlc3VsdCcse2lkOnRoaXMuY3JhZnQuaWQsc2NvcmU6dGhpcy5yZXN1bHQuc2NvcmUsZ3JhZGU6dGhpcy5yZXN1bHQuZ3JhZGV9KTtyZXR1cm47fVxuICBpZihzdGVwLnR5cGU9PT0nYWRkJyl7dGhpcy5jcmFmdC5yZXN1bHRzLnB1c2goey4uLnN0ZXAsdmFsdWU6c3RlcC50YXJnZXQsY29tcGxldGVkOnRydWUsZmFpbHVyZXM6MCxjb21wbGV0aW9uOjF9KTt0aGlzLmNyYWZ0LmluZGV4Kys7cmV0dXJuIHRoaXMubmV4dEdpbW1pY2soKTt9XG4gIHRoaXMuZ2ltbWljaz17Li4uc3RlcCxzdGFydGVkOmZhbHNlLGVsYXBzZWQ6MCx2YWx1ZTowLGhlbGQ6ZmFsc2UsYW5nbGU6MCxmYWlsdXJlczowLGNvbXBsZXRlZDpmYWxzZSxzdWNjZXNzOjAsYXR0ZW1wdHM6MCxiZWF0VGltZTowLGhpdDpmYWxzZSxiZWF0U3VjY2VzczpmYWxzZSxvdXRjb21lczpbXSxzdGlyUG9zOjAsc3RpclN0ZXA6MCxjaXJjbGVUaW1lOjAsbWVzc2FnZTonJyx0YXJnZXRTdGFja3M6c3RlcC50eXBlPT09J3NoYWtlJz9NSVguc2hha2VUYXJnZXRTdGFja3M6dGhpcy5jKCdzdGlyX3RhcmdldF9zdGFja3MnLDEwKX07TUlYLmluaXQodGhpcy5naW1taWNrKTtPUEVOLmluaXQodGhpcy5naW1taWNrKTtQT1VSLmluaXQodGhpcy5naW1taWNrLHRoaXMpO2lmKHN0ZXAudHlwZT09PSdvcGVuJyYmdGhpcy5kYXk9PT0xJiZ0aGlzLnBoYXNlPT09J29wZW5pbmcnJiZ0aGlzLmNyYWZ0U3RlcD8uYXJnPT09J3R1dG9yaWFsX2JlZXInKXRoaXMuZ2ltbWljay5vcGVuVHV0b3JpYWw9dHJ1ZTtcbiAgaWYodGhpcy5naW1taWNrLmZsdWlkJiZ0aGlzLmRheT09PTAmJnRoaXMudmFyaWFudCE9PSdncHQnJiYhdGhpcy5taW5pZ2FtZSYmdGhpcy5jdXJyZW50T3JkZXI/LmFjdG9yPT09J2NocmlzJyYmIXRoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MF9za2lwX3R1dG9yaWFsJiYhdGhpcy5wcm9ncmVzcy5mbGFncy5kYXkwX3BvdXJfdGF1Z2h0KXRoaXMuZ2ltbWljay5wb3VyVHV0b3JpYWw9e3N0ZXA6J3RhcmdldCd9O1xuIH1cbiBzdGFydEdpbW1pY2soKXtyZXR1cm4gdGhpcy5naW1taWNrSW5wdXQodGhpcy5naW1taWNrPy50eXBlPT09J3N0aXInPydLZXlXJzonU3BhY2UnKTt9XG4gaG9sZFBvdXIoaGVsZCl7aWYodGhpcy5zY3JlZW4hPT0nZ2ltbWljayd8fHRoaXMuaXNQYXVzZWQoKSlyZXR1cm47aWYoWydwb3VyJywnZmlsbF91cCddLmluY2x1ZGVzKHRoaXMuZ2ltbWljay50eXBlKSYmIXRoaXMuZ2ltbWljay5mbHVpZD8uZmluaXNoUmVxdWVzdGVkKXt0aGlzLmdpbW1pY2suaGVsZD1oZWxkO2lmKGhlbGQpdGhpcy5naW1taWNrLnN0YXJ0ZWQ9dHJ1ZTt9fVxuIGdpbW1pY2tJbnB1dChrZXkpe2NvbnN0IGc9dGhpcy5naW1taWNrO2lmKHRoaXMuc2NyZWVuIT09J2dpbW1pY2snfHwhZ3x8dGhpcy5pc1BhdXNlZCgpfHxnLmNvbXBsZXRlZHx8Zy5mbHVpZD8uZmluaXNoUmVxdWVzdGVkKXJldHVybiBmYWxzZTtcbiAgLy8gUmVqZWN0IHVucmVsYXRlZCBrZXlzIGJlZm9yZSB0aGV5IGNhbiBzdGFydCB0aGUgY2xvY2sgb3IgY2hhbmdlIGEgc2NvcmUuXG4gIGlmKFsncG91cicsJ2ZpbGxfdXAnXS5pbmNsdWRlcyhnLnR5cGUpKXtpZihrZXkhPT0nU3BhY2UnKXJldHVybiBmYWxzZTt0aGlzLmhvbGRQb3VyKHRydWUpO3JldHVybiB0cnVlO31cbiAgaWYoZy50eXBlPT09J3N0aXInKXtcbiAgIGlmKCFnLnN0YXJ0ZWQpe2lmKCFbJ0tleVcnLCdBcnJvd1VwJ10uaW5jbHVkZXMoa2V5KSlyZXR1cm4gZmFsc2U7Zy5zdGFydGVkPXRydWU7Zy5tZXNzYWdlPSfsi5zqs4Qg67Cp7Zal7Jy866GcIEQg4oaSIFMg4oaSIEEg4oaSIFcnO3JldHVybiB0cnVlO31cbiAgIGNvbnN0IGtleU1hcD17S2V5VzowLEFycm93VXA6MCxLZXlEOjEsQXJyb3dSaWdodDoxLEtleVM6MixBcnJvd0Rvd246MixLZXlBOjMsQXJyb3dMZWZ0OjN9LGRpcj1rZXlNYXBba2V5XTtpZihkaXI9PW51bGwpcmV0dXJuIGZhbHNlO1xuICAgaWYoZGlyPT09KGcuc3RpclBvcysxKSU0KXtnLnN0aXJQb3M9ZGlyO2cuc3RpclN0ZXArKztnLnNwb29uVGFyZ2V0Kz05MDtnLnN0aXJNb3Rpb25QZW5kaW5nPU1hdGgubWluKDYsZy5zdGlyTW90aW9uUGVuZGluZys1KTtnLnN3aXJsU3BlZWQ9TWF0aC5taW4oNDIwLGcuc3dpcmxTcGVlZCsxNjApO2cubWVzc2FnZT0nJztpZihnLnN0aXJTdGVwPT09NCl0aGlzLmZpbmlzaFN0aXJDaXJjbGUodHJ1ZSk7fWVsc2UgdGhpcy5maW5pc2hTdGlyQ2lyY2xlKGZhbHNlKTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZighWydvcGVuJywnc2hha2UnXS5pbmNsdWRlcyhnLnR5cGUpfHwhKGtleT09PSdTcGFjZSd8fGcudHlwZT09PSdzaGFrZScmJmtleT09PSdNb3VzZUxlZnQnKSlyZXR1cm4gZmFsc2U7XG4gIGlmKGcudHlwZT09PSdvcGVuJyl7Y29uc3QgYWNjZXB0ZWQ9T1BFTi5wcmVzcyhnKTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gYWNjZXB0ZWQ7fVxuICBpZighZy5zdGFydGVkKXtnLnN0YXJ0ZWQ9dHJ1ZTt0aGlzLmNoYW5nZWQoKTtyZXR1cm4gdHJ1ZTt9XG4gIGlmKGcudHlwZT09PSdzaGFrZScpe01JWC5zaGFrZUhpdChnKTt9XG4gIHRoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO1xuIH1cbiBmaW5pc2hTdGlyQ2lyY2xlKG9rKXtjb25zdCBnPXRoaXMuZ2ltbWljaztnLm91dGNvbWVzLnB1c2gob2spO2cuYXR0ZW1wdHMrKztpZihvaylnLnN1Y2Nlc3MrKztlbHNlIGcuZmFpbHVyZXMrKztnLmF0dGVtcHRTdGFydFBvcz1nLnN0aXJQb3M7Zy5zdGlyU3RlcD0wO2cuY2lyY2xlVGltZT0wO2cuZmVlZGJhY2tMZWZ0PS4zNTtnLm1lc3NhZ2U9b2s/J0dPT0QnOidNSVNTJztpZihnLmF0dGVtcHRzPj1nLnRhcmdldFN0YWNrcylnLmNvbXBsZXRlZD10cnVlO31cbiBlbmRHaW1taWNrKCl7Y29uc3QgZz10aGlzLmdpbW1pY2s7aWYoIWd8fHRoaXMuc2NyZWVuIT09J2dpbW1pY2snfHx0aGlzLmlzUGF1c2VkKCl8fCFnLnN0YXJ0ZWQpcmV0dXJuIGZhbHNlO2lmKGcuZmx1aWQmJiFnLmZsdWlkLnJlYWR5KXtnLmZsdWlkLnJlcXVlc3RGaW5pc2goZyk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fWlmKGcuZmx1aWQ/LnJlYWR5KXtpZighZy5wb3VyRmluaXNoRngpe2NvbnN0IGVycm9yTWw9Zy5mbHVpZC5jYXVnaHRNbC1nLmZsdWlkLnRhcmdldE1sO2cucG91ckZpbmlzaEZ4PXtlcnJvck1sLHBlcmZlY3Q6TWF0aC5hYnMoZXJyb3JNbCk8PTUrMWUtOCxhZ2U6MH07fWlmKGcucG91ckZpbmlzaEZ4LmFnZTwuOClyZXR1cm4gdHJ1ZTt9aWYoZy50eXBlPT09XCJvcGVuXCImJmcuY29tcGxldGVkJiYoZy5vcGVuRng/LmFnZXx8MCk8T1BFTi5jYXJib25hdGlvblNlYylyZXR1cm4gZmFsc2U7aWYoZy5vcGVuVHV0b3JpYWwpe2lmKCFnLmNvbXBsZXRlZHx8KGcub3BlbkZ4Py5hZ2V8fDApPE9QRU4uY2FyYm9uYXRpb25TZWMpcmV0dXJuIGZhbHNlO3RoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MV9vcGVuX3RhdWdodD10cnVlO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J2JlZXJPcGVuJ30pO31sZXQgcmVzdWx0PXt0eXBlOmcudHlwZSxpbmdyZWRpZW50OmcuaW5ncmVkaWVudCx2YWx1ZTpnLnZhbHVlLGZhaWx1cmVzOmcuZmFpbHVyZXMsY29tcGxldGVkOmcuY29tcGxldGVkLGNvbXBsZXRpb246Zy5zdWNjZXNzLyhnLnRhcmdldFN0YWNrcysoZy5yaHl0aG0/LmV4dHJhUHJlc3Nlc3x8MCkpLGVuZFR5cGU6Zy5jb21wbGV0ZWQ/J0F1dG9UYXJnZXQnOidNYW51YWxOZXh0J307aWYoZy5yaHl0aG0pcmVzdWx0LnJoeXRobT17bW9kZTpnLnJoeXRobS5tb2RlLGV4dHJhUHJlc3NlczpnLnJoeXRobS5leHRyYVByZXNzZXN9O2lmKFsncG91cicsJ2ZpbGxfdXAnXS5pbmNsdWRlcyhnLnR5cGUpKXtyZXN1bHQuY29tcGxldGVkPXRydWU7aWYoZy5mbHVpZClyZXN1bHQubGlxdWlkPXsuLi5nLmZsdWlkLmF1ZGl0KCl9O31cbiAgaWYoZy5mbHVpZCYmZy5wb3VyVHV0b3JpYWwpe3RoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MF9wb3VyX3RhdWdodD10cnVlO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J3BvdXInfSk7fVxuICB0aGlzLmNyYWZ0LnJlc3VsdHMucHVzaChyZXN1bHQpO3RoaXMuY3JhZnQuaW5kZXgrKzt0aGlzLnNhZmUoKCk9PnRoaXMubmV4dEdpbW1pY2soKSk7dGhpcy5jaGFuZ2VkKCk7fVxuIHJldHJ5RGF0YUVycm9yKCl7aWYoIXRoaXMuY3JhZnQpcmV0dXJuO3RoaXMuZXJyb3I9bnVsbDt0aGlzLmNyYWZ0LmlkPSdjcmFmdF9hdHRlbXB0XycrKCsrdGhpcy5zZXJpYWwpO3RoaXMuY3JhZnQuaW5kZXg9MDt0aGlzLmNyYWZ0LnJlc3VsdHM9W107dGhpcy5jcmFmdC5lbGFwc2VkPTA7dGhpcy5zY3JlZW49J2dpbW1pY2snO3RoaXMuc2FmZSgoKT0+e3RoaXMuY3JhZnQucXVldWU9YnVpbGRRdWV1ZSh0aGlzLmRhdGEsdGhpcy5jb2NrdGFpbCh0aGlzLmNyYWZ0LmFjdHVhbC5zZWxlY3RlZCksdGhpcy5jcmFmdC5hY3R1YWwpO3RoaXMubmV4dEdpbW1pY2soKTt9KTt0aGlzLmNoYW5nZWQoKTt9XG4gY2FuY2VsQ3JhZnQoKXt0aGlzLmVycm9yPW51bGw7dGhpcy5naW1taWNrPW51bGw7dGhpcy5jcmFmdD1udWxsO3RoaXMucmVzdWx0PW51bGw7dGhpcy5wcmVwPW51bGw7dGhpcy5zY3JlZW49J3JlY2lwZSc7dGhpcy5jaGFuZ2VkKCk7fVxuIGRpc2NhcmQoKXtcbiAgaWYodGhpcy5zY3JlZW4hPT0ncmVzdWx0J3x8IXRoaXMucmVzdWx0fHx0aGlzLmlzUGF1c2VkKCkpcmV0dXJuIGZhbHNlO1xuICBjb25zdCByPXRoaXMucmVzdWx0LHByaWNlPU51bWJlcih0aGlzLmNvY2t0YWlsKHIuc2VsZWN0ZWQpLnByaWNlKTtcbiAgaWYoIU51bWJlci5pc0Zpbml0ZShwcmljZSl8fHByaWNlPDApe3RoaXMuZXJyb3I9J+y5te2FjOydvCDqsIDqsqkg7Jik66WYOiAnK3Iuc2VsZWN0ZWQ7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIGZhbHNlO31cbiAgY29uc3QgYmVmb3JlPXRoaXMucHJvZ3Jlc3MubW9uZXk7dGhpcy5wcm9ncmVzcy5tb25leS09cHJpY2U7XG4gIHRoaXMuZGlzY2FyZEZlZWRiYWNrPXtpZDpyLmlkLHNlbGVjdGVkOnIuc2VsZWN0ZWQscHJpY2UsYmVmb3JlLGFmdGVyOnRoaXMucHJvZ3Jlc3MubW9uZXksc3RhcnRlZEF0OnRoaXMucmVhbFRpbWUsdW50aWw6dGhpcy5yZWFsVGltZSsyLjZ9O1xuICB0aGlzLmxvZygnZGlzY2FyZCcse2lkOnIuaWQsc2VsZWN0ZWQ6ci5zZWxlY3RlZCxwcmljZSxiZWZvcmUsYWZ0ZXI6dGhpcy5wcm9ncmVzcy5tb25leX0pO1xuICB0aGlzLnNjcmVlbj0nZGlzY2FyZGluZyc7dGhpcy5kcmluaz1udWxsO3RoaXMuZ2ltbWljaz1udWxsO1xuICBkZWxldGUgdGhpcy5yZXN1bHRDb250ZXh0LmNyYWZ0X2dyYWRlO3RoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO1xuIH1cbiBvZmZlcigpe2lmKHRoaXMuc2NyZWVuIT09J3Jlc3VsdCd8fCF0aGlzLnJlc3VsdClyZXR1cm47dGhpcy5kcmluaz10aGlzLnJlc3VsdDt0aGlzLnJlc3VsdD1udWxsO3RoaXMuc2NyZWVuPSdiYXInO2lmKHRoaXMuY3VycmVudE9yZGVyKXt0aGlzLmZvY3VzPXRoaXMuY3VycmVudE9yZGVyLnNlYXQ7dGhpcy5zZWF0c1t0aGlzLmZvY3VzXS5nbGFzcz1udWxsO31lbHNlIHRoaXMuY2xlYW5PbGRHbGFzcygpO2lmKHRoaXMuZGF5PT09MCYmdGhpcy52YXJpYW50IT09J2dwdCcmJiF0aGlzLnByb2dyZXNzLmZsYWdzLmRheTBfc2tpcF90dXRvcmlhbCYmIXRoaXMucHJvZ3Jlc3MuZmxhZ3MuZGF5MF9kcmlua190YXVnaHQmJnRoaXMuY3VycmVudE9yZGVyPy5hY3Rvcj09PSdjaHJpcycmJnRoaXMuZHJpbmsuc2VsZWN0ZWQ9PT10aGlzLmN1cnJlbnRPcmRlci5jb2NrdGFpbCl7dGhpcy50dXRvcmlhbD17a2luZDonc2VydmVEcmluaycsc2VhdDp0aGlzLmN1cnJlbnRPcmRlci5zZWF0fTt0aGlzLmxvZygndHV0b3JpYWxfd2FpdCcse2tpbmQ6J3NlcnZlRHJpbmsnfSk7fXRoaXMubG9nKCdvZmZlcicse2lkOnRoaXMuZHJpbmsuaWR9KTt0aGlzLmNoYW5nZWQoKTt9XG4gcmVzb2x2ZVNlcnZlKG9yZGVyLGRyaW5rKXtjb25zdCBtYXRjaD1vcmRlci5jb2NrdGFpbD09PWRyaW5rLnNlbGVjdGVkO2NvbnN0IHNld2FnZT0hbWF0Y2g/J29yZGVyX21pc21hdGNoJzpkcmluay5taXNzaW5nQ29yZS5sZW5ndGg/J21pc3NpbmdfY29yZSc6bnVsbDtjb25zdCBncmFkZT1zZXdhZ2U/J3Nld2FnZSc6ZHJpbmsuZ3JhZGU7cmV0dXJue29yZGVySWQ6b3JkZXIuaWQsZHJpbmtJZDpkcmluay5pZCxvcmRlcmVkOm9yZGVyLmNvY2t0YWlsLHNlcnZlZDpkcmluay5zZWxlY3RlZCxtYXRjaCxncmFkZSxjcmFmdEdyYWRlOmRyaW5rLmdyYWRlLHNjb3JlOmRyaW5rLnNjb3JlLHNld2FnZSwuLi4ob3JkZXIucGF5bWVudD97cGF5bWVudDpvcmRlci5wYXltZW50fTp7fSl9O31cbiBzZXR0bGUocmVzdWx0LGd1ZXN0PW51bGwpe1xuICBpZih0aGlzLnRyYW5zYWN0aW9uSWRzLmhhcyhyZXN1bHQub3JkZXJJZCkpcmV0dXJuO2NvbnN0IGM9dGhpcy5jb2NrdGFpbChyZXN1bHQuc2VydmVkKSxydWxlPXRoaXMudC5zZXR0bGVtZW50X3J1bGVzLmZpbmQocj0+ci5zZXR0aW5nPT09cmVzdWx0LmdyYWRlKTtpZighcnVsZSl0aHJvdyBFcnJvcign7KCV7IKwIOq3nOy5mSDriITrnb0nKTtjb25zdCBwcmljZT1yZXN1bHQucGF5bWVudD09PSdub25lJz8wOm4oYy5wcmljZSksc2FsZT1NYXRoLnJvdW5kKHByaWNlKm4ocnVsZS5zYWxlX3JhdGUpKSx0aXA9TWF0aC5yb3VuZChwcmljZSpuKHJ1bGUudGlwX3JhdGUpKm4oZ3Vlc3Q/LnBlcnNvbmFsaXR5Py50aXBfbXVsdCwxKSkscmVmdW5kPU1hdGgucm91bmQocHJpY2UqbihydWxlLnJlZnVuZF9yYXRlKSk7XG4gIGNvbnN0IHRyeD17Li4ucmVzdWx0LHNhbGUsdGlwLHJlZnVuZCxuZXQ6c2FsZSt0aXAtcmVmdW5kLHBoYXNlOnRoaXMucGhhc2V9O3RoaXMudHJhbnNhY3Rpb25zLnB1c2godHJ4KTt0aGlzLnRyYW5zYWN0aW9uSWRzLmFkZChyZXN1bHQub3JkZXJJZCk7dGhpcy5wcm9ncmVzcy5tb25leSs9dHJ4Lm5ldDt0aGlzLnNlcnZlZCsrO3RoaXMubG9nKCdzZXR0bGVtZW50Jyx0cngpO3JldHVybiB0cng7XG4gfVxuIHNlcnZlKHNlYXQsaW5wdXQpe2lmKHRoaXMudHV0b3JpYWwmJih0aGlzLnR1dG9yaWFsLmtpbmQhPT0nc2VydmVEcmluayd8fHNlYXQhPT10aGlzLnR1dG9yaWFsLnNlYXR8fCFbJ2RyYWcnLCdrZXlib2FyZCddLmluY2x1ZGVzKGlucHV0KSkpcmV0dXJuIGZhbHNlO2lmKCF0aGlzLmRyaW5rfHx0aGlzLnNjcmVlbiE9PSdiYXInfHx0aGlzLmlzUGF1c2VkKCl8fHRoaXMuY2FtZXJhTGVmdD4wfHx0aGlzLnRyYW5zaXRpb24+MClyZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0aGlzLnNhZmUoKCk9PntcbiAgIGlmKHRoaXMucGhhc2U9PT0ncHJhY3RpY2UnKXt0aGlzLnNldHRsZSh0aGlzLnJlc29sdmVTZXJ2ZSh7aWQ6J3ByYWN0aWNlXycrKCsrdGhpcy5zZXJpYWwpLGNvY2t0YWlsOnRoaXMuZHJpbmsuc2VsZWN0ZWR9LHRoaXMuZHJpbmspKTt0aGlzLmRyaW5rPW51bGw7dGhpcy5vcGVuUmVjaXBlcygpO3JldHVybiB0cnVlO31cbiAgIGNvbnN0IGc9dGhpcy5zZWF0c1tzZWF0XTtpZighZz8uY29hc3RlcilyZXR1cm4gZmFsc2U7XG4gICBpZih0aGlzLnBoYXNlPT09J2dlbmVyYWwnKXtcbiAgICBpZihzZWF0IT09dGhpcy5mb2N1c3x8Zy5zdGF0ZSE9PSdXQUlUX1NFUlZFJ3x8IWcub3JkZXJ8fGcubGVmdDw9MClyZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgcmVzdWx0PXRoaXMucmVzb2x2ZVNlcnZlKGcub3JkZXIsdGhpcy5kcmluayk7Zy5nbGFzcz10aGlzLmRyaW5rLnNlbGVjdGVkO3RoaXMuZHJpbms9bnVsbDtnLnJlYXNraW5nPWZhbHNlO2cuc3RhdGU9J1JFQUNUSU9OJztnLmxhc3RHcmFkZT1yZXN1bHQuZ3JhZGU7dGhpcy5zZXRCYXJrcyhnLHJlc3VsdC5tYXRjaD9bJ3NlcnZlX3RoYW5rcycsJ3JlYWN0XycrcmVzdWx0LmdyYWRlXTpbJ3dyb25nX3JlY2VpdmUnLCd3cm9uZ19kcmluayddLCgpPT57Y29uc3QgdD10aGlzLnNldHRsZShyZXN1bHQsZyk7YXBwbHlFZmZlY3RzKGcuc2xvdC5zZXJ2ZV9lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO2cub3JkZXI9bnVsbDtpZihnLnJvdW5kPGcubWF4Um91bmRzJiZ0LnJlZnVuZD09PTApe2cuc3RhdGU9J1JFT1JERVJfV0FJVCc7Zy5yZW9yZGVyTGVmdD10aGlzLmMoJ25leHRfcm91bmRfZGVsYXlfc2VjJywzKTt9ZWxzZXtnLnN0YXRlPSdFWElUSU5HJzt0aGlzLnNldEJhcmtzKGcsW0dSQURFUy5pbmRleE9mKHJlc3VsdC5ncmFkZSk+PTI/J2J5ZV9nb29kJzonYnllX2JhZCddKTtnLmV4aXRMZWZ0PTM7fX0pO1xuICAgfWVsc2V7XG4gICAgaWYoIXRoaXMuY3VycmVudE9yZGVyfHxzZWF0IT09dGhpcy5jdXJyZW50T3JkZXIuc2VhdClyZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgY3JhZnRTdGVwPXRoaXMuc3Rvcnkuc3RlcHNbdGhpcy5zdG9yeS5pbmRleF0sc2VydmU9dGhpcy5zdG9yeS5zdGVwc1t0aGlzLnN0b3J5LmluZGV4KzFdO2lmKGNyYWZ0U3RlcD8udHlwZSE9PSdjcmFmdCd8fHNlcnZlPy50eXBlIT09J3NlcnZlJ3x8c2VydmUuYWN0b3IhPT10aGlzLmN1cnJlbnRPcmRlci5hY3Rvcil0aHJvdyBFcnJvcignb3JkZXIg4oaSIGNyYWZ0IOKGkiBzZXJ2ZSDsl7DqsrAg7Jik66WYJyk7XG4gICAgY29uc3QgcmVzdWx0PXRoaXMucmVzb2x2ZVNlcnZlKHRoaXMuY3VycmVudE9yZGVyLHRoaXMuZHJpbmspO2cuZ2xhc3M9dGhpcy5kcmluay5zZWxlY3RlZDt0aGlzLmRyaW5rPW51bGw7dGhpcy5yZXN1bHRDb250ZXh0PXtncmFkZTpyZXN1bHQuZ3JhZGUsZmluYWxfZ3JhZGU6cmVzdWx0LmdyYWRlLGNyYWZ0X2dyYWRlOnJlc3VsdC5jcmFmdEdyYWRlLG9yZGVyX21hdGNoOnJlc3VsdC5tYXRjaCxvcmRlcmVkOnJlc3VsdC5vcmRlcmVkLHNlcnZlZDpyZXN1bHQuc2VydmVkLGNvY2t0YWlsOnRoaXMuY29ja3RhaWwocmVzdWx0LnNlcnZlZCksdGFnczp0aGlzLnQuY29ja3RhaWxfdGFncy5maWx0ZXIodD0+dC5jb250ZXh0PT09cmVzdWx0LnNlcnZlZCkubWFwKHQ9PnQua28pfTtcbiAgICBpZih0aGlzLnR1dG9yaWFsPy5raW5kPT09J3NlcnZlRHJpbmsnKXt0aGlzLnR1dG9yaWFsPW51bGw7dGhpcy5wcm9ncmVzcy5mbGFncy5kYXkwX2RyaW5rX3RhdWdodD10cnVlO3RoaXMubG9nKCd0dXRvcmlhbF9jb21wbGV0ZScse2tpbmQ6J3NlcnZlRHJpbmsnLGlucHV0fSk7fXRoaXMuc2V0dGxlKHJlc3VsdCk7dGhpcy5hcHBseUFmZmluaXR5KHRoaXMuY3VycmVudE9yZGVyLmFjdG9yLHJlc3VsdCk7YXBwbHlFZmZlY3RzKGNyYWZ0U3RlcC5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO2FwcGx5RWZmZWN0cyhzZXJ2ZS5lZmZlY3RzLHRoaXMucHJvZ3Jlc3MpO3RoaXMuY3VycmVudE9yZGVyPW51bGw7Zy5vcmRlcj1udWxsO3RoaXMuc3RvcnkuaW5kZXgrPTI7dGhpcy5zZXRUcmFuc2l0aW9uKDEsKCk9PnRoaXMucHVtcCgpKTtcbiAgIH1cbiAgIHRoaXMuY2hhbmdlZCgpO3JldHVybiB0cnVlO1xuICB9KTtcbiB9XG4gYXBwbHlBZmZpbml0eShhY3RvcixyZXN1bHQpe2NvbnN0IGM9dGhpcy50LmNoYXJhY3RlcnMuZmluZChjPT5jLmlkPT09YWN0b3IpO2lmKCFjPy5hZmZpbml0eSlyZXR1cm47Y29uc3QgdGFzdGU9c29ydFNlcSh0aGlzLnQudGFzdGVzLmZpbHRlcih0PT50LmNoYXJhY3Rlcl9pZD09PWFjdG9yKSkuZmluZCh0PT5jb25kaXRpb24odC53aGVuLHRoaXMuY3R4KCkpKTtjb25zdCB0aWVyPSFyZXN1bHQubWF0Y2g/J21pc3MnOnRhc3RlPy50aWVyfHwnb2snO2NvbnN0IHJvdz10aGlzLnQuYWZmaW5pdHlfbWF0cml4LmZpbmQocj0+ci50YXN0ZV90aWVyPT09dGllcik7Y29uc3QgZGVsdGE9bihyb3c/LltyZXN1bHQuZ3JhZGVdKTt0aGlzLnByb2dyZXNzLmFmZmluaXR5W2FjdG9yXT1uKHRoaXMucHJvZ3Jlc3MuYWZmaW5pdHlbYWN0b3JdKStkZWx0YTt0aGlzLmxvZygnYWZmaW5pdHknLHthY3Rvcix0aWVyLGRlbHRhfSk7cm9vdC5MdW5hU3RvcnlOb3RpY2VzPy5hZmZpbml0eSh0aGlzLnByb2dyZXNzLGFjdG9yLGRlbHRhKTt9XG4gcGFyc2VVcGtlZXBPdmVycmlkZSh2YWx1ZSl7XG4gIGlmKHZhbHVlPT1udWxsfHxTdHJpbmcodmFsdWUpLnRyaW0oKT09PScnKXJldHVybiBudWxsO1xuICBjb25zdCBhbW91bnQ9TnVtYmVyKHZhbHVlKTtpZighTnVtYmVyLmlzU2FmZUludGVnZXIoYW1vdW50KXx8YW1vdW50PDApdGhyb3cgRXJyb3IoJ+ycoOyngOu5hOuKlCAwIOydtOyDgeydmCDsoJXsiJggR+uhnCDsnoXroKXtlbQg7KO87IS47JqULicpO3JldHVybiBhbW91bnQ7XG4gfVxuIHVwa2VlcEluZm8oKXtcbiAgaWYodGhpcy51cGtlZXBPdmVycmlkZSE9bnVsbClyZXR1cm57YW1vdW50OnRoaXMudXBrZWVwT3ZlcnJpZGUsc291cmNlOid3ZWJfdGVzdCd9O1xuICBjb25zdCByb3c9dGhpcy50LmRheXMuZmluZChkPT5uKGQuZGF5KT09PXRoaXMuZGF5KTtcbiAgaWYoIXJvdyYmdGhpcy5kYXk9PT05OSlyZXR1cm57YW1vdW50OjAsc291cmNlOidxYV9kZWZhdWx0J307XG4gIGlmKCFyb3d8fHJvdy51cGtlZXBfZ29sZD09bnVsbHx8U3RyaW5nKHJvdy51cGtlZXBfZ29sZCkudHJpbSgpPT09JycpdGhyb3cgRXJyb3IoJ+ydvOywqCDsnKDsp4DruYQg642w7J207YSwIOuIhOudvTogRGF5ICcrdGhpcy5kYXkpO1xuICBjb25zdCBhbW91bnQ9dGhpcy5wYXJzZVVwa2VlcE92ZXJyaWRlKHJvdy51cGtlZXBfZ29sZCk7cmV0dXJue2Ftb3VudCxzb3VyY2U6J2RheXMuY3N2J307XG4gfVxuIHNldFVwa2VlcE92ZXJyaWRlKHZhbHVlKXtpZih0aGlzLmZpbmlzaGVkKXJldHVybiBmYWxzZTtjb25zdCBhbW91bnQ9dGhpcy5wYXJzZVVwa2VlcE92ZXJyaWRlKHZhbHVlKTt0aGlzLnVwa2VlcE92ZXJyaWRlPWFtb3VudDt0aGlzLmxvZygnZGVidWdfdXBrZWVwX292ZXJyaWRlJyx7YW1vdW50LHJlc3RvcmVkRGF0YURlZmF1bHQ6YW1vdW50PT1udWxsfSk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7fVxuIGZpbmlzaERheSgpe1xuICBpZih0aGlzLmZpbmlzaGVkKXJldHVybiBmYWxzZTtcbiAgY29uc3QgdXBrZWVwPXRoaXMudXBrZWVwSW5mbygpLHRvdGFscz10aGlzLnRvdGFscygpLGJlZm9yZT10aGlzLnByb2dyZXNzLm1vbmV5O1xuICAvLyBPcmRlciByZXZlbnVlIGlzIGFscmVhZHkgY29tbWl0dGVkLiBOZXZlciBhZGQgdGhlIGRpc3BsYXllZCB0b3RhbHMgYWdhaW4uXG4gIHRoaXMuZGFpbHlTZXR0bGVtZW50PXtpZDonZGF5XycrdGhpcy5kYXkrJ19zZXR0bGVtZW50JyxkYXk6dGhpcy5kYXksc3RhdHVzOidwZW5kaW5nJyx0b3RhbHM6ey4uLnRvdGFsc30sb3BlbmluZ0JhbGFuY2U6dGhpcy5vcGVuaW5nQmFsYW5jZSxvdGhlckNoYW5nZXM6YmVmb3JlLXRoaXMub3BlbmluZ0JhbGFuY2UtdG90YWxzLm5ldCxiYWxhbmNlQmVmb3JlOmJlZm9yZSx1cGtlZXA6dXBrZWVwLmFtb3VudCxzb3VyY2U6dXBrZWVwLnNvdXJjZSxwcm9qZWN0ZWRCYWxhbmNlOmJlZm9yZS11cGtlZXAuYW1vdW50LHNob3J0ZmFsbDpNYXRoLm1heCgwLHVwa2VlcC5hbW91bnQtYmVmb3JlKSxiYWxhbmNlQWZ0ZXI6bnVsbH07XG4gIHRoaXMudHV0b3JpYWw9bnVsbDt0aGlzLnBoYXNlPSdjb21wbGV0ZSc7dGhpcy5zY3JlZW49J3NldHRsZW1lbnQnO3RoaXMuZGlhbG9ndWU9bnVsbDt0aGlzLmNob2ljZT1udWxsO3RoaXMuc3Rvcnk9bnVsbDt0aGlzLmN1cnJlbnRPcmRlcj1udWxsO3RoaXMuZHJpbms9bnVsbDt0aGlzLnByZXA9bnVsbDt0aGlzLmdpbW1pY2s9bnVsbDt0aGlzLm92ZXJsYXk9bnVsbDt0aGlzLnBhdXNlZD1mYWxzZTt0aGlzLnRyYW5zaXRpb249MDt0aGlzLnBlbmRpbmdUcmFuc2l0aW9uPW51bGw7dGhpcy5zZWF0cz17TDpudWxsLE06bnVsbCxSOm51bGx9O3RoaXMudGFibGVGYWRlcz17fTt0aGlzLmZpbmlzaGVkPXRydWU7dGhpcy5sb2coJ2RheV9jb21wbGV0ZScse2RheTp0aGlzLmRheSxvcmRlcnM6dGhpcy50cmFuc2FjdGlvbnMubGVuZ3RoLHVwa2VlcDp1cGtlZXAuYW1vdW50LHVwa2VlcFNvdXJjZTp1cGtlZXAuc291cmNlfSk7dGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7XG4gfVxuIGNvbmZpcm1EYWlseVNldHRsZW1lbnQoKXtcbiAgY29uc3Qgcz10aGlzLmRhaWx5U2V0dGxlbWVudDtpZighc3x8cy5zdGF0dXMhPT0ncGVuZGluZyd8fHRoaXMuc2NyZWVuIT09J3NldHRsZW1lbnQnfHx0aGlzLmVycm9yKXJldHVybiBmYWxzZTtcbiAgaWYocy5iYWxhbmNlQmVmb3JlPHMudXBrZWVwKXtcbiAgIHMuc3RhdHVzPSdmYWlsZWQnO3MuYmFsYW5jZUFmdGVyPXMuYmFsYW5jZUJlZm9yZTt0aGlzLnBoYXNlPSdnYW1lb3Zlcic7dGhpcy5zY3JlZW49J2dhbWVvdmVyJztcbiAgIHRoaXMubG9nKCdkYWlseV91cGtlZXBfZmFpbGVkJyx7c2V0dGxlbWVudElkOnMuaWQsYXZhaWxhYmxlOnMuYmFsYW5jZUJlZm9yZSxyZXF1aXJlZDpzLnVwa2VlcCxzaG9ydGZhbGw6cy5zaG9ydGZhbGx9KTt0aGlzLmxvZygnZ2FtZV9vdmVyJyx7cmVhc29uOid1cGtlZXBfdW5wYWlkJyxkYXk6dGhpcy5kYXl9KTtcbiAgfWVsc2V7XG4gICB0aGlzLnByb2dyZXNzLm1vbmV5PXMuYmFsYW5jZUJlZm9yZS1zLnVwa2VlcDtzLmJhbGFuY2VBZnRlcj10aGlzLnByb2dyZXNzLm1vbmV5O3Muc3RhdHVzPSdwYWlkJztcbiAgIHRoaXMubG9nKCdkYWlseV91cGtlZXBfcGFpZCcse3NldHRsZW1lbnRJZDpzLmlkLGJlZm9yZTpzLmJhbGFuY2VCZWZvcmUsYW1vdW50OnMudXBrZWVwLGFmdGVyOnMuYmFsYW5jZUFmdGVyfSk7XG4gIH1cbiAgdGhpcy5jaGFuZ2VkKCk7cmV0dXJuIHRydWU7XG4gfVxuIGRlYnVnRmlsbCgpe2lmKHRoaXMuc2NyZWVuIT09J3ByZXAnKXJldHVybjtjb25zdCBjPXRoaXMuY29ja3RhaWwodGhpcy5wcmVwLnNlbGVjdGVkKTt0aGlzLnByZXAuZ2xhc3M9Yy5nbGFzczt0aGlzLnByZXAudG9vbD0oYy5taXg9PT0nc2hha2UnPydzaGFrZXInOmMubWl4PT09J3N0aXInPydtaXhpbmdfZ2xhc3MnOm51bGwpO3RoaXMucHJlcC5pbmdyZWRpZW50cz10aGlzLnQucmVjaXBlcy5maWx0ZXIocj0+ci5jb250ZXh0PT09Yy5pZCYmIXIuYXV0b19hcHBseSkubWFwKHI9PnIuaW5ncmVkaWVudCk7dGhpcy5wcmVwLm9wZW5lcj10aGlzLnByZXAuaW5ncmVkaWVudHMuaW5jbHVkZXMoJ2JlZXInKTt0aGlzLmxvZygnZGVidWdfcmVjaXBlX2ZpbGwnKTt0aGlzLmNoYW5nZWQoKTt9XG4gZGVidWdDcmFmdChncmFkZT0nZXhjZWxsZW50Jyl7aWYoIVsncHJlcCcsJ2dpbW1pY2snXS5pbmNsdWRlcyh0aGlzLnNjcmVlbikpcmV0dXJuO3RoaXMuZGVidWdGaWxsKCk7aWYodGhpcy5zY3JlZW49PT0ncHJlcCcpdGhpcy5zdGFydENyYWZ0KCk7Y29uc3QgYWN0dWFsPXRoaXMuY3JhZnQuYWN0dWFsLHNlbGVjdGVkPXRoaXMuY29ja3RhaWwoYWN0dWFsLnNlbGVjdGVkKSxxdWV1ZT10aGlzLmNyYWZ0LnF1ZXVlO2NvbnN0IHJlc3VsdHM9cXVldWUubWFwKHE9Pih7Li4ucSx2YWx1ZTpxLnRhcmdldCxjb21wbGV0aW9uOjEsY29tcGxldGVkOnRydWUsZmFpbHVyZXM6MH0pKTt0aGlzLnJlc3VsdD1zY29yZUNyYWZ0KHRoaXMuZGF0YSxzZWxlY3RlZCxhY3R1YWwscmVzdWx0cywyKTt0aGlzLnJlc3VsdC5pZD10aGlzLmNyYWZ0LmlkO3RoaXMucmVzdWx0LmdyYWRlPWdyYWRlO3RoaXMucmVzdWx0LnNjb3JlPXtleGNlbGxlbnQ6MTAwLGdvb2Q6ODUsZGVjZW50OjcwLHBvb3I6NDUsc2V3YWdlOjB9W2dyYWRlXTt0aGlzLnJlc3VsdC5kZWJ1Zz10cnVlO3RoaXMuZ2ltbWljaz1udWxsO3RoaXMuc2NyZWVuPSdyZXN1bHQnO3RoaXMubG9nKCdkZWJ1Z19jcmFmdCcse2dyYWRlfSk7dGhpcy5jaGFuZ2VkKCk7fVxuIHRpY2soZHQse2hvbGRTcGVlY2g9ZmFsc2V9PXt9KXtcbiAgaWYodGhpcy5pc1BhdXNlZCgpfHx0aGlzLmZpbmlzaGVkKXJldHVybjtkdD1NYXRoLm1heCgwLE1hdGgubWluKGR0LDAuMikpO3RoaXMucmVhbFRpbWUrPWR0O1xuICBmb3IoY29uc3QgW3NlYXQsZmFkZV1vZiBPYmplY3QuZW50cmllcyh0aGlzLnRhYmxlRmFkZXMpKXtmYWRlLmVsYXBzZWQrPWR0O2lmKGZhZGUuZWxhcHNlZD49ZmFkZS5kdXJhdGlvbilkZWxldGUgdGhpcy50YWJsZUZhZGVzW3NlYXRdO31cbiAgaWYodGhpcy50cmFuc2l0aW9uPjApe3RoaXMudHJhbnNpdGlvbj1NYXRoLm1heCgwLHRoaXMudHJhbnNpdGlvbi1kdCk7aWYoIXRoaXMudHJhbnNpdGlvbil7Y29uc3QgZm49dGhpcy5wZW5kaW5nVHJhbnNpdGlvbjt0aGlzLnBlbmRpbmdUcmFuc2l0aW9uPW51bGw7dGhpcy5zYWZlKGZuKTt9cmV0dXJuO31cbiAgaWYodGhpcy5jYW1lcmFMZWZ0PjApe3RoaXMuY2FtZXJhTGVmdD1NYXRoLm1heCgwLHRoaXMuY2FtZXJhTGVmdC1kdCk7aWYoIXRoaXMuY2FtZXJhTGVmdCl7aWYoIXRoaXMuY2FtZXJhU2FtZSl0aGlzLmFmdGVyQ2FtZXJhKCk7dGhpcy5jYW1lcmFTYW1lPWZhbHNlO319XG4gIHRoaXMudXBkYXRlU2VhdFR1dG9yaWFsKCk7XG4gIGlmKHRoaXMuc2NyZWVuPT09J2Rpc2NhcmRpbmcnKXtcbiAgIGlmKHRoaXMucmVhbFRpbWUtdGhpcy5kaXNjYXJkRmVlZGJhY2suc3RhcnRlZEF0Pj0xLjMpe1xuICAgIHRoaXMucHJlcD17c2VsZWN0ZWQ6dGhpcy5kaXNjYXJkRmVlZGJhY2suc2VsZWN0ZWQsZ2xhc3M6bnVsbCx0b29sOm51bGwsaW5ncmVkaWVudHM6W119O1xuICAgIHRoaXMucmVzdWx0PW51bGw7dGhpcy5jcmFmdD1udWxsO3RoaXMuc2NyZWVuPSdwcmVwJzt0aGlzLmNoYW5nZWQoKTtcbiAgIH1cbiAgIHJldHVybjtcbiAgfVxuICBpZih0aGlzLnNjcmVlbj09PSdnaW1taWNrJyl7dGhpcy50aWNrR2ltbWljayhkdCk7cmV0dXJuO31cbiAgaWYodGhpcy5zY3JlZW4hPT0nYmFyJylyZXR1cm47XG4gIGlmKHRoaXMucGhhc2U9PT0nZ2VuZXJhbCcpdGhpcy5zYWZlKCgpPT50aGlzLnRpY2tHZW5lcmFsKGR0LGhvbGRTcGVlY2gpKTtcbiAgZWxzZSBpZighaG9sZFNwZWVjaCYmdGhpcy5kaWFsb2d1ZSYmIXRoaXMuY2FtZXJhTW92aW5nJiZ0aGlzLmNhbWVyYUxlZnQ9PT0wKXt0aGlzLnR5cGVMaW5lKHRoaXMuZGlhbG9ndWUsZHQpO31cbiB9XG4gdGlja0dlbmVyYWwocmVhbER0LGhvbGRTcGVlY2g9ZmFsc2Upe1xuICBjb25zdCBkdD1yZWFsRHQqdGhpcy5zcGVlZDt0aGlzLmJhclRpbWUrPWR0O1xuICBpZih0aGlzLnF1ZXVlSW5kZXg8dGhpcy5xdWV1ZS5sZW5ndGgpe2lmKHRoaXMuc3Bhd25CbG9ja2VkKXtpZihPYmplY3Qua2V5cyh0aGlzLnNlYXRzKS5zb21lKGs9PiF0aGlzLnNlYXRzW2tdJiYhdGhpcy50YWJsZUZhZGVzW2tdKSl7dGhpcy5zcGF3bkJsb2NrZWQ9ZmFsc2U7dGhpcy5zcGF3bkxlZnQ9dGhpcy5jKCdyZXNlYXRfZGVsYXlfc2VjJywxMCk7fX1lbHNlIHt0aGlzLnNwYXduTGVmdC09ZHQ7aWYodGhpcy5zcGF3bkxlZnQ8PTApdGhpcy5zcGF3bigpO319XG4gIGZvcihjb25zdCBnIG9mIE9iamVjdC52YWx1ZXModGhpcy5zZWF0cykuZmlsdGVyKEJvb2xlYW4pKXtcbiAgIGlmKGcuc3RhdGU9PT0nV0FJVF9DT0FTVEVSJ3x8Zy5zdGF0ZT09PSdXQUlUX1NFUlZFJyl7XG4gICAgZy5sZWZ0LT1kdDtpZihnLmxlZnQ8PTApe3RoaXMubGVhdmUoZyxnLnN0YXRlPT09J1dBSVRfQ09BU1RFUic/J2xlYXZlX2NvYXN0ZXInOidsZWF2ZV9zZXJ2ZScpO2NvbnRpbnVlO31cbiAgICBjb25zdCB1c2VkPTEtZy5sZWZ0L2cubGltaXQsbGV2ZWw9dXNlZD49dGhpcy5jKCd3YXJuX3JlZF9yYXRpbycsMC44KT8yOnVzZWQ+PXRoaXMuYygnd2Fybl95ZWxsb3dfcmF0aW8nLDAuNSk/MTowO2lmKGxldmVsPmcud2Fybil0aGlzLndhcm4oZyxsZXZlbCk7XG4gICB9XG4gICBpZihnLnN0YXRlPT09J0VYSVRJTkcnKXtnLmV4aXRMZWZ0LT1kdDtpZihnLmV4aXRMZWZ0PD0wKXt0aGlzLmxvZygnZ3Vlc3RfZXhpdCcse2d1ZXN0OmcuaWQsc2VhdDpnLnNlYXR9KTt0aGlzLmNsZWFyRGVwYXJ0ZWRTZWF0KGcuc2VhdCk7Y29udGludWU7fX1cbiAgIGlmKGcuc3RhdGU9PT0nUkVPUkRFUl9XQUlUJyl7Zy5yZW9yZGVyTGVmdC09ZHQ7aWYoZy5yZW9yZGVyTGVmdDw9MCl7Zy5zdGF0ZT0nT1JERVJfRElBTE9HVUUnO3RoaXMuYmVnaW5PcmRlcihnLHRydWUpO319XG4gICBpZihnLnNlYXQhPT10aGlzLmZvY3VzfHx0aGlzLmNhbWVyYUxlZnQ+MHx8dGhpcy5jYW1lcmFNb3Zpbmd8fGhvbGRTcGVlY2gpY29udGludWU7XG4gICBjb25zdCBsaW5lPWcubGluZXNbZy5saW5lSW5kZXhdO2lmKGxpbmUpe2xpbmUuc2Vlbj10cnVlO2lmKGxpbmUuY2hhcnM8bGluZS50ZXh0Lmxlbmd0aCl0aGlzLnR5cGVMaW5lKGxpbmUscmVhbER0KTtlbHNle2xpbmUuaG9sZCs9cmVhbER0KnRoaXMuZGlhbG9nU3BlZWQ7aWYobGluZS5ob2xkPj10aGlzLmMoJ29yZGVyX2JhcmtfZ2FwX3NlYycsMS41KSl7dGhpcy5oaXN0b3J5LnB1c2goe2FjdG9yOmxpbmUuYWN0b3IsdGV4dDpsaW5lLnRleHQsaWQ6bGluZS5pZH0pO2cubGluZUluZGV4Kys7aWYoZy5saW5lSW5kZXg+PWcubGluZXMubGVuZ3RoKXtjb25zdCBmbj1nLmxpbmVEb25lO2cubGluZURvbmU9bnVsbDtpZihmbilmbigpO319fX1cbiAgIGVsc2UgaWYoZy5zdGF0ZT09PSdXQUlUX1NFUlZFJyYmIWcucmVhc2tpbmcpe2cuaWRsZUxlZnQtPWR0O2lmKGcuaWRsZUxlZnQ8PTApe3RoaXMuc2V0QmFya3MoZyxbJ2lkbGUnXSk7Zy5pZGxlTGVmdD10aGlzLmMoJ2lkbGVfbWluX3NlYycsOCkrdGhpcy5ybmcoKSoodGhpcy5jKCdpZGxlX21heF9zZWMnLDEzKS10aGlzLmMoJ2lkbGVfbWluX3NlYycsOCkpO319XG4gIH1cbiAgaWYoIXRoaXMucWFLZWVwR2VuZXJhbCYmdGhpcy5xdWV1ZUluZGV4Pj10aGlzLnF1ZXVlLmxlbmd0aCYmT2JqZWN0LnZhbHVlcyh0aGlzLnNlYXRzKS5ldmVyeShnPT4hZykmJiFPYmplY3Qua2V5cyh0aGlzLnRhYmxlRmFkZXMpLmxlbmd0aCl7dGhpcy5kcmluaz1udWxsO3RoaXMuZmluaXNoR2VuZXJhbFNlcnZpY2UoKTt9XG4gfVxuIHRpY2tHaW1taWNrKGR0KXtjb25zdCBnPXRoaXMuZ2ltbWljaztpZighZylyZXR1cm47aWYoZy5mbHVpZCl7aWYoIWcuc3RhcnRlZClyZXR1cm47aWYoIWcuZmx1aWQuZmluaXNoUmVxdWVzdGVkfHxnLmFuZ2xlPjApe2cuZWxhcHNlZCs9ZHQ7dGhpcy5jcmFmdC5lbGFwc2VkKz1kdDt9Zy5mbHVpZC50aWNrKGcsZHQpO3RoaXMuY2hhcmdlUG91ck92ZXJmbG93KGcuZmx1aWQpO2lmKGcuZmx1aWQucmVhZHkpe2lmKGcucG91ckZpbmlzaEZ4KWcucG91ckZpbmlzaEZ4LmFnZSs9ZHQ7dGhpcy5lbmRHaW1taWNrKCk7fXJldHVybjt9TUlYLnZpc3VhbChnLGR0KTtPUEVOLnZpc3VhbChnLGR0KTtpZighZy5zdGFydGVkfHxnLmNvbXBsZXRlZClyZXR1cm47Zy5lbGFwc2VkKz1kdDtpZihnLnR5cGUhPT0nb3BlbicpdGhpcy5jcmFmdC5lbGFwc2VkKz1kdDtcbiAgaWYoZy50eXBlPT09J29wZW4nKXtPUEVOLnRpY2soZyxkdCk7fVxuICBlbHNlIGlmKGcudHlwZT09PSdzaGFrZScpe01JWC51cGRhdGVQYXRoKGcsdGhpcy5ybmcpO2lmKCFnLmZlZWRiYWNrTGVmdCl7Zy5oaXQ9ZmFsc2U7Zy5tZXNzYWdlPScnO319XG4gIGVsc2UgaWYoZy50eXBlPT09J3N0aXInKXtnLmNpcmNsZVRpbWUrPWR0O2lmKGcuY2lyY2xlVGltZT49dGhpcy5jKCdzdGlyX2NpcmNsZV9saW1pdF9zZWMnLDEuNSkpdGhpcy5maW5pc2hTdGlyQ2lyY2xlKGZhbHNlKTt9XG4gfVxuIGN1cnJlbnREaWFsb2d1ZSgpe2lmKHRoaXMuY2FtZXJhTW92aW5nfHx0aGlzLmNhbWVyYUxlZnQ+MHx8dGhpcy50cmFuc2l0aW9uPjApcmV0dXJuIG51bGw7aWYodGhpcy5waGFzZT09PSdnZW5lcmFsJyl7Y29uc3QgZz10aGlzLnNlYXRzW3RoaXMuZm9jdXNdO3JldHVybiAhdGhpcy5jYW1lcmFMZWZ0P2c/LmxpbmVzPy5bZy5saW5lSW5kZXhdOm51bGw7fXJldHVybiB0aGlzLmRpYWxvZ3VlO31cbiBjaGFyZ2VQb3VyT3ZlcmZsb3coZmx1aWQpe1xuICBjb25zdCB3aG9sZT1NYXRoLmZsb29yKGZsdWlkLm92ZXJmbG93TWwrMWUtOCksY29zdD1NYXRoLm1heCgwLHdob2xlLWZsdWlkLm92ZXJmbG93Q2hhcmdlZCk7aWYoIWNvc3QpcmV0dXJuO1xuICBmbHVpZC5vdmVyZmxvd0NoYXJnZWQ9d2hvbGU7dGhpcy5wcm9ncmVzcy5tb25leS09Y29zdDtcbiAgLy8gTW9ub3RvbmljIHJlY2VpcHQgbGV0cyB0aGUgSFVEIHNob3cgaW5kaXZpZHVhbCAtMSB0aWNrcyB3aXRob3V0IGF1ZGlvLlxuICB0aGlzLnByb2dyZXNzLnBvdXJXYXN0ZT0odGhpcy5wcm9ncmVzcy5wb3VyV2FzdGV8fDApK2Nvc3Q7dGhpcy5jaGFuZ2VkKCk7XG4gfVxuIHRvdGFscygpe3JldHVybiB0aGlzLnRyYW5zYWN0aW9ucy5yZWR1Y2UoKGEsdCk9Pih7c2FsZTphLnNhbGUrdC5zYWxlLHRpcDphLnRpcCt0LnRpcCxyZWZ1bmQ6YS5yZWZ1bmQrdC5yZWZ1bmQsbmV0OmEubmV0K3QubmV0fSkse3NhbGU6MCx0aXA6MCxyZWZ1bmQ6MCxuZXQ6MH0pO31cbn1cbmNvbnN0IGFwaT17R2FtZSxNSVgsT1BFTixQT1VSLEdSQURFUyxtaWxsaWxpdHJlRGF0YSxjb25kaXRpb24sYXBwbHlFZmZlY3RzLHNjb3JlQ3JhZnQsYnVpbGRRdWV1ZSxiYW5kLHNlZWRlZCxjbGVhbixuLGNsYW1wfTtcbmlmKHR5cGVvZiBtb2R1bGUhPT0ndW5kZWZpbmVkJyltb2R1bGUuZXhwb3J0cz1hcGk7cm9vdC5MdW5hQ29yZT1hcGk7XG59KSh0eXBlb2Ygd2luZG93PT09J3VuZGVmaW5lZCc/Z2xvYmFsVGhpczp3aW5kb3cpO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBLENBQUMsVUFBU0EsSUFBSSxFQUFDO0VBQ2YsWUFBWTs7RUFDWixNQUFNQyxJQUFJLEdBQUMsT0FBT0MsTUFBTSxLQUFHLFdBQVcsR0FBQ0YsSUFBSSxDQUFDRyxRQUFRLEdBQUNDLE9BQU8sQ0FBQyx1Q0FBdUMsQ0FBQztFQUNyRyxNQUFNQyxNQUFNLEdBQUMsQ0FBQyxRQUFRLEVBQUMsTUFBTSxFQUFDLFFBQVEsRUFBQyxNQUFNLEVBQUMsV0FBVyxDQUFDO0VBQzFEO0VBQ0EsTUFBTUMsZUFBZSxHQUFDLENBQUM7RUFDdkIsTUFBTUMsS0FBSyxHQUFDQSxDQUFDQyxDQUFDLEVBQUNDLENBQUMsRUFBQ0MsQ0FBQyxLQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQ0gsQ0FBQyxFQUFDRSxJQUFJLENBQUNFLEdBQUcsQ0FBQ0gsQ0FBQyxFQUFDRixDQUFDLENBQUMsQ0FBQztFQUM5QyxNQUFNQSxDQUFDLEdBQUNBLENBQUNNLENBQUMsRUFBQ0MsQ0FBQyxHQUFDLENBQUMsS0FBR0QsQ0FBQyxJQUFFLElBQUksSUFBRUEsQ0FBQyxLQUFHLEVBQUUsR0FBQ0MsQ0FBQyxHQUFD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STtNQUNwRyxJQUFJLENBQUNDLFVBQVUsR0FBQyxDQUFDLENBQUM7TUFBQyxJQUFJLENBQUNDLFFBQVEsR0FBQyxRQUFRO01BQUMsSUFBSSxDQUFDQyxRQUFRLEdBQUMsSUFBSTtNQUFDLElBQUksQ0FBQ0MsWUFBWSxHQUFDLElBQUk7TUFBQyxJQUFJLENBQUNDLG1CQUFtQixHQUFDLEtBQUs7TUFBQyxJQUFJLENBQUNDLGFBQWEsR0FBQyxJQUFJO01BQUMsSUFBSSxDQUFDQyxhQUFhLEdBQUMsSUFBSTtNQUFDLElBQUksQ0FBQ1QsS0FBSyxHQUFDLE9BQU87TUFBQyxJQUFJLENBQUNVLE1BQU0sR0FBQyxLQUFLO01BQUMsSUFBSSxDQUFDQyxPQUFPLEdBQUMsSUFBSTtNQUFDLElBQUksQ0FBQ0MsTUFBTSxHQUFDLEtBQUs7TUFBQyxJQUFJLENBQUNDLE1BQU0sR0FBQyxLQUFLO01BQUMsSUFBSSxDQUFDQyxVQUFVLEdBQUMsQ0FBQztNQUFDLElBQUksQ0FBQ0MsWUFBWSxHQUFDLEtBQUs7TUFBQyxJQUFJLENBQUNDLEtBQUssR0FBQyxHQUFHO01BQUMsSUFBSSxDQUFDQyxRQUFRLEdBQUMsS0FBSztNQUFDLElBQUksQ0FBQ0MsS0FBSyxHQUFDO1FBQUNDLENBQUMsRUFBQyxJQUFJO1FBQUNDLENBQUMsRUFBQyxJQUFJO1FBQUNDLENBQUMsRUFBQztNQUFJLENBQUM7TUFBQyxJQUFJLENBQUNDLElBQUksR0FBQyxFQUFFO01BQUMsSUFBSSxDQUFDQyxPQUFPLEdBQUMsRUFBRTtNQUFDLElBQUksQ0FBQ0MsWUFBWSxHQUFDLEVBQUU7TUFBQyxJQUFJLENBQUNDLGNBQWMsR0FBQyxJQUFJM0MsR0FBRyxDQUFDLENBQUM7TUFBQyxJQUFJLENBQUMvUCxNQUFNLEdBQUMsQ0FBQztNQUFDLElBQUksQ0FBQzJTLE9BQU8sR0FBQyxDQUFDO01BQUMsSUFBSSxDQUFDQyxRQUFRLEdBQUMsQ0FBQztNQUFDLElBQUksQ0FBQ3ZMLE1BQU0sR0FBQyxDQUFDO01BQUMsSUFBSSxDQUFDd0wsSUFBSSxHQUFDLENBQUM7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
