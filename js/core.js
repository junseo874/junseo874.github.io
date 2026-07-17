// ===== L.U.N.A 웹 프로토타입 — core: 상태·DSL·유틸 =====
"use strict";
const DATA = window.LUNA;
const CFG = DATA.balance.config;

// ---------- 게임 상태 ----------
const S = {
  lang: "ko",
  day: 1,
  gold: CFG.gold_start,
  rep: CFG.reputation_start,
  affinity: {},
  alive: { samho: true, haru: true },
  flags: new Set(),
  quests: {},          // quest_id -> stage
  questRewarded: new Set(),
  inventory: {},       // 구매 재료 수량 (연출용)
  extraRecipes: [],
  lastGrade: null,     // 소문자 등급 ('excellent'..)
  lastPct: 0,
  usedPoints: new Set(), // "day:pointId"
  stats: { servedTotal: 0, angryTotal: 0 },
  today: { sales: 0, tips: 0, served: 0, angry: 0, repDelta: 0 },
};

// ---------- 유틸 ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function T(t) { if (!t) return ""; if (typeof t === "string") return t; return t[S.lang] || t.ko || ""; }
function UI(key) { const u = DATA.master.ui_strings[key]; return u ? T(u) : key; }

// ---------- 데이터 조회 ----------
function charOf(id) { return DATA.master.characters.find(c => c.id === id); }
function cocktailOf(id) { return DATA.master.cocktails.find(c => c.id === id); }
function ingOf(id) { return DATA.master.ingredients.find(i => i.id === id); }
function itemOf(id) { return DATA.master.items.find(i => i.id === id); }
function dayMeta(d) { return DATA.schedule.days.find(x => x.day === d); }
function unlockedCocktails() {
  return DATA.master.cocktails.filter(c =>
    (c.unlock_day <= S.day || S.extraRecipes.includes(c.id)) &&
    (!c.unlock_when || evalWhen(c.unlock_when)));
}
function unlockedIngredients() { return DATA.master.ingredients.filter(i => i.unlock_day <= S.day); }
function scriptOf(day) { return DATA.scripts[String(day)]; }
function scenesFor(day, phase, trigger) {
  const sc = scriptOf(day); if (!sc) return [];
  return sc.scenes.filter(s => s.phase === phase && (!trigger || s.trigger === trigger) && evalWhen(s.when))
    .sort((a, b) => a.seq - b.seq);
}
function sceneById(id) {
  for (const d of Object.values(DATA.scripts)) { const s = d.scenes.find(x => x.id === id); if (s) return s; }
  return null;
}
function choicesOf(cid) {
  for (const d of Object.values(DATA.scripts)) { if (d.choices && d.choices[cid]) return d.choices[cid]; }
  return [];
}

// ---------- 등급 ----------
const GRADE_RANK = { excellent: 5, good: 4, decent: 3, poor: 2, sewage: 1 };
function gradeForPct(pct) {
  for (const g of DATA.balance.grade_cuts) if (pct >= g.min_pct) return g.grade;
  return "sewage";
}

// ---------- when DSL ----------
function resolveToken(tok, ctx) {
  tok = tok.trim();
  if (tok === "day") return S.day;
  if (tok === "money") return S.gold;
  if (tok === "reputation") return S.rep;
  if (tok === "grade") return GRADE_RANK[S.lastGrade] || 0;
  let m;
  if ((m = tok.match(/^flag\.(\w+)$/))) return S.flags.has(m[1]);
  if ((m = tok.match(/^affinity\.(\w+)$/))) return S.affinity[m[1]] || 0;
  if ((m = tok.match(/^alive\.(\w+)$/))) return S.alive[m[1]] !== false;
  if ((m = tok.match(/^quest\.(\w+)\.stage$/))) return S.quests[m[1]] || 0;
  if ((m = tok.match(/^cocktail\.tag\((.+)\)$/))) return !!(ctx.cocktail && ctx.cocktail.tags.includes(m[1].trim()));
  if (tok === "cocktail.abv") return ctx.cocktail ? ctx.cocktail.abv : 0;
  if (tok === "cocktail.id") return ctx.cocktail ? ctx.cocktail.id : "";
  if (tok === "phase") return ctx.phase || "";
  if (/^-?\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (GRADE_RANK[tok]) return GRADE_RANK[tok];
  return tok; // 문자열 리터럴 취급
}
function evalWhen(expr, ctx) {
  if (!expr) return true;
  ctx = ctx || {};
  return expr.split("&&").every(raw => {
    let clause = raw.trim(), neg = false;
    while (clause.startsWith("!")) { neg = !neg; clause = clause.slice(1).trim(); }
    const m = clause.match(/^(.+?)(==|!=|>=|<=|>|<)(.+)$/);
    let val;
    if (m) {
      const a = resolveToken(m[1], ctx), b = resolveToken(m[3], ctx), op = m[2];
      val = op === "==" ? a == b : op === "!=" ? a != b : op === ">=" ? a >= b :
            op === "<=" ? a <= b : op === ">" ? a > b : a < b;
    } else {
      val = !!resolveToken(clause, ctx);
    }
    return neg ? !val : val;
  });
}

// ---------- effects DSL ----------
function applyEffects(str) {
  if (!str) return;
  str.split(";").forEach(raw => {
    const e = raw.trim(); if (!e) return;
    let m;
    if ((m = e.match(/^affinity\.(\w+)\s*([+-]=)\s*(\d+)$/))) {
      S.affinity[m[1]] = (S.affinity[m[1]] || 0) + (m[2] === "+=" ? 1 : -1) * +m[3];
      toast(`💛 ${T(charOf(m[1])?.name) || m[1]} ${m[2] === "+=" ? "+" : "-"}${m[3]}`);
    } else if ((m = e.match(/^flag\.(\w+)\s*=\s*(true|false)$/))) {
      m[2] === "true" ? S.flags.add(m[1]) : S.flags.delete(m[1]);
    } else if ((m = e.match(/^money\s*([+-]=)\s*(\d+)$/))) {
      S.gold += (m[1] === "+=" ? 1 : -1) * +m[2];
      toast(`💰 ${m[1] === "+=" ? "+" : "-"}${m[2]}G`);
    } else if ((m = e.match(/^reputation\s*([+-]=)\s*(\d+)$/))) {
      const d = (m[1] === "+=" ? 1 : -1) * +m[2];
      S.rep += d; S.today.repDelta += d;
    } else if ((m = e.match(/^give\((\w+)\s*,\s*(\d+)\)$/))) {
      S.inventory[m[1]] = (S.inventory[m[1]] || 0) + +m[2];
      toast(`🎁 ${T(ingOf(m[1])?.name) || m[1]} ×${m[2]}`);
    } else if ((m = e.match(/^unlock_recipe\((\w+)\)$/))) {
      S.extraRecipes.push(m[1]);
    } else if ((m = e.match(/^quest\((\w+)\)\.advance$/))) {
      const qid = m[1];
      S.quests[qid] = (S.quests[qid] || 0) + 1;
      const stages = DATA.quests.stages.filter(s => s.quest_id === qid);
      if (S.quests[qid] >= stages.length && !S.questRewarded.has(qid)) {
        S.questRewarded.add(qid);
        const q = DATA.quests.quests.find(x => x.id === qid);
        if (q) { toast(`✅ ${T(q.title)}`); applyEffects(q.reward_effects); }
      }
    }
  });
  updateHUD();
}

// ---------- 대사 풀 (Barks) ----------
function bark(voice, situation) {
  const all = DATA.master.barks.filter(b => b.situation === situation);
  let pool = all.filter(b => b.voice_id === voice);
  if (!pool.length) pool = all.filter(b => !b.voice_id);
  if (!pool.length) return "";
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let r = Math.random() * total;
  for (const b of pool) { r -= (b.weight || 1); if (r <= 0) return T(b.text); }
  return T(pool[0].text);
}

// ---------- HUD / 화면 전환 ----------
function updateHUD() {
  $("#hud-day").textContent = `DAY ${S.day}`;
  $("#hud-gold").textContent = S.gold + "G";
  $("#hud-rep").textContent = `${UI("ui_reputation")} ${S.rep}`;
  $("#hud-lang").textContent = S.lang === "ko" ? "EN" : "한";
}
function showScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
}
async function phaseBanner(title, sub) {
  const b = $("#phase-banner");
  b.querySelector(".pb-title").textContent = title;
  b.querySelector(".pb-sub").textContent = sub || "";
  b.classList.add("show");
  await sleep(1400);
  b.classList.remove("show");
  await sleep(300);
}
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

// ---------- 잔 SVG (시뮬레이터 방식 계승 — 절차적 렌더링) ----------
function rgbOf(colorStr) {
  if (!colorStr) return "200,200,200";
  if (colorStr.startsWith("grad:")) return colorStr.slice(5).split(">")[0];
  return colorStr;
}
function glassSVG(glassId, colorStr, level) {
  const fill = colorStr ? `rgba(${rgbOf(colorStr)},0.88)` : "none";
  const lv = level === undefined ? 0.72 : level;
  const st = "#cfe3ee", body = "#ffffff22";
  const shapes = {
    cocktail: `<path d="M15 12 h70 l-33 42 v24 h-4 v-24 z" fill="${body}" stroke="${st}"/><path d="M21 16 h58 l-26.5 35 h-5 z" fill="${fill}"/><rect x="37" y="80" width="26" height="5" fill="${body}" stroke="${st}"/>`,
    highball: `<path d="M33 8 h34 l-3 82 h-28 z" fill="${body}" stroke="${st}"/><path d="M${34.5} ${8 + 82 * (1 - lv) + 2} h31 l-2.6 ${82 * lv - 3} h-25 z" fill="${fill}"/>`,
    collins: `<path d="M36 6 h28 l-2 88 h-24 z" fill="${body}" stroke="${st}"/><path d="M37.5 ${6 + 88 * (1 - lv) + 2} h25 l-1.8 ${88 * lv - 3} h-21 z" fill="${fill}"/>`,
    rocks: `<path d="M27 42 h46 l-3 44 h-40 z" fill="${body}" stroke="${st}"/><path d="M29 ${42 + 44 * (1 - lv)} h42 l-2.4 ${44 * lv - 2} h-37 z" fill="${fill}"/>`,
    wine: `<path d="M50 8 c15 0 21 13 13 25 c-5 8 -9 13 -9 22 v20 h-8 v-20 c0 -9 -4 -14 -9 -22 c-8 -12 -2 -25 13 -25z" fill="${body}" stroke="${st}"/><path d="M50 14 c10 0 14 9 8 17 c-4 6 -6 9 -6 15 h-4 c0 -6 -2 -9 -6 -15 c-6 -8 -2 -17 8 -17z" fill="${fill}"/><rect x="45" y="76" width="10" height="5" fill="${body}"/>`,
    flute: `<path d="M50 6 c8 8 13 17 13 28 c0 13 -8 21 -13 27 c-5 -6 -13 -14 -13 -27 c0 -11 5 -20 13 -28z" fill="${body}" stroke="${st}"/><path d="M50 ${14 + 40 * (1 - lv)} c5 5 9 10 9 15 c0 6 -4 10 -9 14 c-5 -4 -9 -8 -9 -14 c0 -5 4 -10 9 -15z" fill="${fill}"/><rect x="47" y="64" width="6" height="16" fill="${body}"/>`,
    mug: `<path d="M24 18 q-13 4 -9 19 q3 11 13 11 v26 h34 v-56 z" fill="${body}" stroke="${st}"/><path d="M26 ${18 + 56 * (1 - lv) + 2} h30 v${56 * lv - 4} h-30z" fill="${fill}"/>`,
    bottle: `<path d="M44 8 h12 v14 q8 6 8 18 v42 h-28 v-42 q0 -12 8 -18z" fill="${body}" stroke="${st}"/><path d="M38 46 h24 v34 h-24z" fill="${fill}"/>`,
  };
  return `<svg viewBox="0 0 100 100">${shapes[glassId] || shapes.bottle}</svg>`;
}
function charChip(id, size) {
  const c = charOf(id) || { name: { ko: id }, name_color: "#999" };
  const s = size || 44;
  return `<span class="char-chip" style="width:${s}px;height:${s}px;background:${c.name_color}33;border-color:${c.name_color};font-size:${Math.round(s * 0.42)}px">${T(c.name).charAt(0)}</span>`;
}

// ---------- 세이브 (집 저장 오브젝트 + 크래시 복구는 프로토에선 일일 자동만) ----------
const SAVE_KEY = "luna_proto_save_v1";
function saveGame() {
  const snap = { ...S, flags: [...S.flags], usedPoints: [...S.usedPoints], questRewarded: [...S.questRewarded] };
  localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const snap = JSON.parse(raw);
    Object.assign(S, snap);
    S.flags = new Set(snap.flags); S.usedPoints = new Set(snap.usedPoints); S.questRewarded = new Set(snap.questRewarded);
    return true;
  } catch (e) { return false; }
}
function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
function clearSave() { localStorage.removeItem(SAVE_KEY); }
