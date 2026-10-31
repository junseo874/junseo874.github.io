/* Deterministic random selection and CSV condition/effect expressions. No UI or per-session state. */
(function (root) {
  'use strict';
  function create({ GRADES, n, root }) {
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
    return { seeded, weighted, condition, applyEffects };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaRuleParts ||= {}).conditions = create;
})(typeof window === 'undefined' ? globalThis : window);
