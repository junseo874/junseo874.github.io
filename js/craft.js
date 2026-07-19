// ===== 제조 미니게임 — 플레이어 선택 주도 (v1.9: 선반 4단계) =====
//   메뉴 → ①잔 선반 → ②도구 선반 → ③가니시 선반 → ④재료 선반 → [제조 시작] → 기믹 실행 → 완성 → 판정
//   각 선반에서 ◀이전으로 돌아가 다시 고를 수 있다 (제한 시간은 계속 흐른다).
// 레시피(RecipeLines/mix/prep/garnish)는 실행 순서가 아니라 '채점 정답'. 담은 것들이 강제된 순서
// (개봉→따르기→스퀴즈→파우더→믹스→필업)로 차례차례 실행된다 — 술을 안 따르고 젓는 일은 불가능.
// 도구: 셰이커=셰이킹 / 믹싱글라스+바스푼=스터 / 따개=병뚜껑(cap)·코르크(cork — 천천히, 급하면 부스러짐)
// 채점: 칵테일_등급_산출서 §2~3 — 항목 단순 평균, 컷은 balance.grade_cuts
"use strict";
const Craft = {
  resolveFn: null,
  target: null,       // 정답 칵테일 id (주문) — null이면 자유 제조
  tutorial: false,
  chosen: null,       // 선택한 칵테일 데이터
  attempt: null,
  stage: null,
  timeStart: 0, timerHandle: null,
  gimmicks: [], gi: 0,

  open(opts) {
    return new Promise(resolve => {
      this.resolveFn = resolve;
      this.target = opts.target || null;
      this.tutorial = !!opts.tutorial;
      this.chosen = null;
      $("#ov-craft").classList.add("show");
      const banner = $("#craft-order-banner");
      if (this.target && !this.tutorial) {
        banner.textContent = `🧾 ${UI("ui_menu")}: "${T(cocktailOf(this.target).name)}"`;
        banner.style.display = "block";
      } else if (this.tutorial) {
        banner.textContent = S.lang === "ko" ? `📖 튜토리얼: ${T(cocktailOf(this.target).name)}을(를) 만들어보자` : `📖 Tutorial: make a ${T(cocktailOf(this.target).name)}`;
        banner.style.display = "block";
      } else banner.style.display = "none";
      this.showMenu();
    });
  },

  close(result) {
    clearInterval(this.timerHandle);
    $("#ov-craft").classList.remove("show");
    const fn = this.resolveFn; this.resolveFn = null;
    fn(result);
  },

  setStage(html) {
    const c = $("#craft-stage");
    c.innerHTML = "";
    if (typeof html === "string") c.innerHTML = html; else c.appendChild(html);
  },

  // ---------- 1) 메뉴 선택 ----------
  showMenu() {
    const wrap = el("div", "craft-menu");
    wrap.appendChild(el("h3", "", UI("ui_menu")));
    const list = el("div", "menu-list");
    // 대본 지정 제조(주문·튜토리얼)는 해금 무시 — 스토리가 시키는 잔은 항상 만들 수 있다
    const pool = unlockedCocktails();
    if (this.target && !pool.some(c => c.id === this.target)) pool.unshift(cocktailOf(this.target));
    pool.forEach(c => {
      const row = el("div", "menu-row");
      row.innerHTML = `<div class="menu-glass">${glassSVG(c.glass, c.color, 0.75)}</div>
        <div class="menu-info"><b>${T(c.name)}</b><span>T${c.tier} · ${c.price}G · ${c.abv}%</span></div>`;
      row.addEventListener("click", () => this.showDesc(c));
      list.appendChild(row);
    });
    wrap.appendChild(list);
    this.setStage(wrap);
  },

  // ---------- 2) 설명 → 확정 ----------
  showDesc(c) {
    const wrap = el("div", "craft-desc");
    wrap.innerHTML = `
      <div class="desc-glass">${glassSVG(c.glass, c.color, 0.78)}</div>
      <h3>${T(c.name)}</h3>
      <p class="desc-flavor">${T(c.flavor)}</p>
      <p class="desc-meta">T${c.tier} · ${c.price}G · ${c.abv}% · ${c.tags.map(t => "#" + t).join(" ")}</p>`;
    const btns = el("div", "btn-row");
    const back = el("button", "btn ghost", "◀ " + UI("ui_menu"));
    back.addEventListener("click", () => this.showMenu());
    const go = el("button", "btn primary", UI("ui_make"));
    go.addEventListener("click", () => this.confirm(c));
    btns.append(back, go);
    wrap.appendChild(btns);
    this.setStage(wrap);
  },

  confirm(c) {
    // §3.9 — 메뉴 확정 시점에 올바른/틀린 즉시 판정 (시뮬레이터 방식)
    this.chosen = c;
    this.isCorrect = this.target ? (c.id === this.target) : true;
    this.attempt = {
      glass: null, garnish: null, pours: {}, fill: null,   // 잔·가니시도 플레이어가 선반에서 고른다 (v1.9)
      usedTool: null, stirTurns: 0, shakeStrokes: 0,
      prepDone: null, corkQuality: 1, opened: {},       // 병 개봉 상태 (cork 병은 따야 따를 수 있음)
    };
    this.pendingBottle = null;
    this.queue = [];        // 담은 재료·도구 {kind,id} — 시작 누르면 논리적 순서로 실행
    this.runList = []; this.ri = 0;
    this.notePeeked = false; // 레시피 노트를 본 뒤에만 글로우 가이드 (시뮬레이터 방식)
    this.timeStart = performance.now();
    this.startTimer(c.time_limit_sec);
    this.slot = 0;
    this.showGlassSelect();
  },

  // 레시피 노트를 본 상태면 — 필요한 잔/재료가 깜빡인다 (아직 안 담은 것만)
  applyGlow() {
    $$("#craft-stage .glow").forEach(x => x.classList.remove("glow"));
    if (!this.notePeeked) return;
    const c = this.chosen;
    // 잔·가니시 선택 스테이지 (정답 없음 = "없음" 칸이 정답)
    $$("#craft-stage .glass-cell").forEach(cell => {
      if (cell.dataset.id === String(c.glass)) cell.classList.add("glow");
    });
    $$("#craft-stage .garnish-cell").forEach(cell => {
      if (cell.dataset.id === String(c.garnish)) cell.classList.add("glow");
    });
    // 선반 스테이지 — 정답에 필요한 재료·도구 중 아직 큐에 안 담긴 것만 안내
    const queued = new Set((this.queue || []).map(x => x.kind + ":" + x.id));
    const need = new Set();
    c.recipe.forEach(r => need.add(r.action + ":" + r.ingredient));
    if (c.fill) need.add("fill:" + c.fill);
    if (c.mix === "shake") need.add("tool:shaker");
    if (c.mix === "stir" || c.mix === "build") need.add("tool:mixing_glass");
    if (c.prep) need.add("tool:opener");
    $$("#craft-stage .ing-cell").forEach(cell => {
      if (need.has(cell.dataset.key) && !queued.has(cell.dataset.key)) cell.classList.add("glow");
    });
  },

  startTimer(limit) {
    const tEl = $("#craft-timer");
    clearInterval(this.timerHandle);
    this.timerHandle = setInterval(() => {
      const t = (performance.now() - this.timeStart) / 1000;
      tEl.textContent = `⏱ ${t.toFixed(1)} / ${limit}s`;
      tEl.classList.toggle("over", t > limit);
    }, 100);
  },
  elapsed() { return (performance.now() - this.timeStart) / 1000; },

  // ---------- 3) 선반 4단계: 잔 → 도구 → 가니시 → 재료 (v1.9) ----------
  // 각 화면은 그 종류가 진열된 '선반'이고, ◀이전으로 돌아가 다시 고를 수 있다.
  // 되돌아가도 제한 시간은 계속 흐른다 — 무한정 고민하는 걸 막기 위해.
  // 선반 슬롯 — ◀▶로 좌우 이동. 마지막 슬롯에서만 '제조 시작'이 뜬다.
  SLOTS: [
    { key: "glass",   icon: "🥃", ui: "ui_shelf_glass",   show: "showGlassSelect" },
    { key: "tool",    icon: "🛠", ui: "ui_shelf_tool",    show: "showToolSelect" },
    { key: "garnish", icon: "🌿", ui: "ui_shelf_garnish", show: "showGarnishSelect" },
    { key: "ing",     icon: "🍾", ui: "ui_shelf_ing",     show: "showShelf" },
  ],
  slot: 0,

  goSlot(i) {
    if (i < 0 || i >= this.SLOTS.length) return;
    this.slot = i;
    this[this.SLOTS[i].show]();
  },

  // 상단 슬롯 인디케이터 — 지금 몇 번 선반인지 + 직접 점프
  slotBar() {
    const bar = el("div", "slot-bar");
    this.SLOTS.forEach((sl, i) => {
      const tab = el("div", "slot-tab" + (i === this.slot ? " on" : ""),
        `${sl.icon} ${UI(sl.ui)}`);
      tab.addEventListener("click", () => this.goSlot(i));
      bar.appendChild(tab);
    });
    return bar;
  },

  // 좌우 이동 버튼 — 왼쪽=이전 선반, 오른쪽=다음 선반. 마지막 칸은 '제조 시작'
  slotNav() {
    const row = el("div", "slot-nav");
    const prev = el("button", "btn slot-arrow" + (this.slot === 0 ? " off" : ""), "◀");
    prev.addEventListener("click", () => this.slot > 0 ? this.goSlot(this.slot - 1) : this.showMenu());
    prev.title = this.slot === 0 ? (S.lang === "ko" ? "메뉴로" : "Back to menu")
                                 : UI(this.SLOTS[this.slot - 1].ui);
    row.appendChild(prev);
    row.appendChild(this.noteButton());
    const last = this.slot === this.SLOTS.length - 1;
    if (last) {
      const go = el("button", "btn primary", S.lang === "ko" ? "제조 시작 ▶" : "Start ▶");
      go.addEventListener("click", () => this.startRun());
      row.appendChild(go);
    } else {
      const next = el("button", "btn slot-arrow", "▶");
      next.title = UI(this.SLOTS[this.slot + 1].ui);
      next.addEventListener("click", () => this.goSlot(this.slot + 1));
      row.appendChild(next);
    }
    return row;
  },

  // ── 3-1) 잔 선반 ──
  showGlassSelect() {
    const wrap = el("div", "craft-glass");
    wrap.appendChild(this.slotBar());
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "잔 선반 — 잔을 고른다" : "Glass Shelf"));
    if (this.tutorial) wrap.appendChild(el("p", "hint", S.lang === "ko" ? "💡 레시피 노트가 정답 잔을 알려준다" : "💡 The recipe note shows the right glass"));
    const grid = el("div", "glass-grid");
    const pick = (id, cell) => {
      this.attempt.glass = id;
      $$("#craft-stage .glass-cell").forEach(x => x.classList.remove("sel"));
      cell.classList.add("sel");
    };
    unlockedShelf("glass").forEach(g => {
      const cell = el("div", "glass-cell" + (this.attempt.glass === g.id ? " sel" : ""));
      cell.dataset.id = g.id;
      cell.innerHTML = `${glassSVG(g.id, null, 0)}<span>${T(g.name)}</span>`;
      cell.addEventListener("click", () => pick(g.id, cell));
      grid.appendChild(cell);
    });
    // 병맥주(잔 없음) 대응 — "잔 없이(병째)" 선택지
    const none = el("div", "glass-cell" + (this.attempt.glass === null ? " sel" : ""));
    none.dataset.id = "null";
    none.innerHTML = `${glassSVG("bottle", null, 0)}<span>${S.lang === "ko" ? "병째로" : "In the bottle"}</span>`;
    none.addEventListener("click", () => pick(null, none));
    grid.appendChild(none);
    wrap.appendChild(grid);
    wrap.appendChild(this.slotNav());
    this.setStage(wrap);
    this.applyGlow();
    if (this.tutorial) this.openNote();
  },

  // ── 3-2) 도구 선반 ── (담아두면 실행 순서에 맞춰 알아서 돈다)
  showToolSelect() {
    const wrap = el("div", "craft-ing");
    wrap.appendChild(this.slotBar());
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "도구 선반 — 쓸 도구를 담는다" : "Tool Shelf"));
    wrap.appendChild(el("p", "hint", S.lang === "ko"
      ? "담아두면 순서에 맞춰 실행된다 — 믹스는 재료를 다 넣은 뒤에 돈다"
      : "Stocked tools run in the right order — mixing happens after all pours"));
    const grid = el("div", "ing-grid");
    const row = el("div", "ing-row");
    const queued = new Set(this.queue.filter(x => x.kind === "tool").map(x => x.id));
    const TOOL_ICON = { shaker: "🫨", mixing_glass: "🌀", opener: "🍾" };
    unlockedShelf("tool").forEach(t => {
      const cell = el("div", "ing-cell tool-cell" + (queued.has(t.id) ? " sel" : ""));
      cell.dataset.key = "tool:" + t.id;
      cell.innerHTML = `<div class="tool-icon">${TOOL_ICON[t.id] || "🛠"}</div><span>${T(t.name)}</span>`;
      cell.addEventListener("click", () => this.toggleQueue("tool", t.id));
      row.appendChild(cell);
    });
    grid.appendChild(row);
    wrap.appendChild(grid);
    const picked = [...queued].map(id => T(shelfOf(id).name)).join(", ");
    wrap.appendChild(el("p", "hint", (S.lang === "ko" ? "담은 도구: " : "Stocked: ") +
      (picked || (S.lang === "ko" ? "없음 (도구 없이 진행)" : "none"))));
    wrap.appendChild(this.slotNav());
    this.setStage(wrap);
    this.applyGlow();
  },

  // ── 3-3) 가니시 선반 ── (v1.9: 비인터랙티브 연출 → 플레이어 선택·채점 대상)
  showGarnishSelect() {
    const wrap = el("div", "craft-glass");
    wrap.appendChild(this.slotBar());
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "가니시 선반 — 장식을 고른다" : "Garnish Shelf"));
    const grid = el("div", "glass-grid");
    const pick = (id, cell) => {
      this.attempt.garnish = id;
      $$("#craft-stage .garnish-cell").forEach(x => x.classList.remove("sel"));
      cell.classList.add("sel");
    };
    // "없음"도 하나의 선택 — 가니시 없는 칵테일인지 스스로 판단해야 한다(정답 힌트를 주지 않는다)
    const none = el("div", "glass-cell garnish-cell" + (this.attempt.garnish === null ? " sel" : ""));
    none.dataset.id = "null";
    none.innerHTML = `<div class="tool-icon">🚫</div><span>${S.lang === "ko" ? "없음" : "None"}</span>`;
    none.addEventListener("click", () => pick(null, none));
    grid.appendChild(none);
    unlockedShelf("garnish").forEach(g => {
      const cell = el("div", "glass-cell garnish-cell" + (this.attempt.garnish === g.id ? " sel" : ""));
      cell.dataset.id = g.id;
      cell.innerHTML = `<div class="tool-icon">🌿</div><span>${T(g.name)}</span>`;
      cell.addEventListener("click", () => pick(g.id, cell));
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    wrap.appendChild(this.slotNav());
    this.setStage(wrap);
    this.applyGlow();
  },

  noteButton() {
    const b = el("button", "btn note-btn", "📖 " + UI("ui_recipe_note"));
    b.addEventListener("click", () => this.openNote());
    return b;
  },
  openNote() {
    const c = this.chosen;
    const lines = c.recipe.map(r => {
      const nm = T(ingOf(r.ingredient).name);
      const act = { pour: S.lang === "ko" ? "따르기" : "pour", squeeze: S.lang === "ko" ? "스퀴즈" : "squeeze", powder: S.lang === "ko" ? "파우더" : "powder" }[r.action];
      return `<li>${nm} — ${r.qty}${r.unit} <em>(${act})</em></li>`;
    }).join("");
    const mixName = {
      none: "-",
      build: S.lang === "ko" ? "빌드 — 바 스푼 1바퀴" : "Build — 1 stir",
      stir: S.lang === "ko" ? "스터 — 믹싱 글라스 3바퀴" : "Stir — 3 turns",
      shake: S.lang === "ko" ? "셰이크 — 셰이커 8회" : "Shake — 8 strokes",
    }[c.mix];
    const prepName = c.prep ? (c.prep === "cork"
      ? (S.lang === "ko" ? " / 🍾 코르크는 천천히" : " / 🍾 cork — slowly")
      : (S.lang === "ko" ? " / 🍺 병뚜껑 따기" : " / 🍺 pop the cap")) : "";
    const glassName = c.glass ? T(itemOf(c.glass).name) : (S.lang === "ko" ? "병째로" : "In the bottle");
    $("#note-body").innerHTML = `
      <h3>${T(c.name)}</h3>
      <ul>${lines || "<li>-</li>"}</ul>
      <p>🥃 ${glassName} / 🔀 ${mixName}${prepName}${c.fill ? ` / ⬆ ${T(ingOf(c.fill).name)}` : ""}${c.garnish ? ` / 🌿 ${T(itemOf(c.garnish).name)}` : ""}</p>`;
    $("#ov-note").classList.add("show");
    this.notePeeked = true; // 이후 필요한 아이템이 깜빡임
    this.applyGlow();
  },

  // ---------- 4) 선반 — 재료·도구를 '담고' → 시작하면 순서대로 실행 (플레이어 주도) ----------
  CORK_BOTTLES: ["red_wine", "champagne"],   // 코르크 병 — 따개로 따야 딸 수 있음

  lineFor(id, act) { return this.chosen.recipe.find(r => r.ingredient === id && r.action === act); },

  // 담은 것을 클릭 = 토글 (같은 걸 또 누르면 뺀다). 믹스 도구(셰이커/믹싱글라스)는 서로 배타적
  toggleQueue(kind, id) {
    const i = this.queue.findIndex(x => x.kind === kind && x.id === id);
    if (i >= 0) { this.queue.splice(i, 1); }
    else {
      if (kind === "tool" && (id === "shaker" || id === "mixing_glass"))
        this.queue = this.queue.filter(x => !(x.kind === "tool" && (x.id === "shaker" || x.id === "mixing_glass")));
      this.queue.push({ kind, id });
    }
    this.goSlot(this.slot);
  },

  // 담은 것(queue) → 실제 실행 순서로 변환. 카테고리 순서를 강제 = 따르기 전에 젓는 일이 불가능
  //   1 개봉 → 2 따르기(베이스 먼저) → 3 스퀴즈 → 4 파우더 → 5 믹스 → 6 필업
  buildRunList() {
    const c = this.chosen, q = this.queue;
    const has = (kind, id) => q.some(x => x.kind === kind && x.id === id);
    const ids = kind => q.filter(x => x.kind === kind).map(x => x.id);
    const run = [];
    if (has("tool", "opener")) {   // 따개를 담았으면 맨 처음 병을 연다
      const corked = ids("pour").find(id => this.CORK_BOTTLES.includes(id));
      run.push({ t: "open", prep: (c.prep === "cork" || corked) ? "cork" : "cap",
                 bottle: corked || (c.recipe.find(r => r.action === "pour") || {}).ingredient });
    }
    const isBase = id => (ingOf(id) || {}).category === "base";
    ids("pour").sort((a, b) => (isBase(a) ? 0 : 1) - (isBase(b) ? 0 : 1))
      .forEach(id => run.push({ t: "pour", id }));
    ids("squeeze").forEach(id => run.push({ t: "squeeze", id }));
    ids("powder").forEach(id => run.push({ t: "powder", id }));
    const mix = ids("tool").find(id => id === "shaker" || id === "mixing_glass");
    if (mix) run.push({ t: "mix", tool: mix });
    ids("fill").forEach(id => run.push({ t: "fill", id }));   // 탄산·믹서는 마지막
    return run;
  },

  stepLabel(s) {
    const ko = S.lang === "ko";
    const nm = id => T((ingOf(id) || itemOf(id) || { name: { ko: id, en: id } }).name);
    switch (s.t) {
      case "open": return s.prep === "cork" ? "🍷 " + (ko ? "코르크 " : "cork ") + nm(s.bottle)
                                            : "🍺 " + (ko ? "병따기" : "cap");
      case "pour": return "🍾 " + nm(s.id);
      case "squeeze": return "🍋 " + nm(s.id);
      case "powder": return "🥄 " + nm(s.id);
      case "mix": return s.tool === "shaker" ? "🫨 " + (ko ? "셰이킹" : "shake") : "🌀 " + (ko ? "스터" : "stir");
      case "fill": return "⬆ " + nm(s.id);
    }
    return "";
  },

  // 큐 미리보기 칩에서 X를 누르면 그 항목을 큐에서 뺀다
  removeStep(s) {
    if (s.t === "open") this.queue = this.queue.filter(x => !(x.kind === "tool" && x.id === "opener"));
    else if (s.t === "mix") this.queue = this.queue.filter(x => !(x.kind === "tool" && x.id === s.tool));
    else this.queue = this.queue.filter(x => !(x.kind === s.t && x.id === s.id));
  },

  showShelf() {
    const c = this.chosen;
    const wrap = el("div", "craft-ing");
    wrap.appendChild(this.slotBar());
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "재료 선반 — 넣을 재료를 담는다" : "Ingredient Shelf"));

    // 담은 것 미리보기 — 탭한 순서가 아니라 '실제 실행될 순서'로 보여준다
    const tray = el("div", "craft-hist");
    const run = this.buildRunList();
    if (!run.length) {
      tray.innerHTML = `<span class="chip dim">${S.lang === "ko" ? "아직 담은 게 없다" : "Nothing stocked yet"}</span>`;
    } else {
      run.forEach((s, i) => {
        const chip = el("span", "chip rm", `${i + 1}. ${this.stepLabel(s)} ✕`);
        chip.addEventListener("click", () => { this.removeStep(s); this.goSlot(this.slot); });
        tray.appendChild(chip);
      });
    }
    wrap.appendChild(tray);

    const grid = el("div", "ing-grid");
    const queued = new Set(this.queue.map(x => x.kind + ":" + x.id));
    const ingCell = (ing, key, onClick) => {
      const cell = el("div", "ing-cell" + (queued.has(key) ? " sel" : ""));
      cell.dataset.key = key;
      const color = ing.color ? `background:linear-gradient(180deg,transparent 30%,rgba(${ing.color},.75) 30%)` : "";
      cell.innerHTML = `<div class="ing-bottle" style="${color}"></div><span>${T(ing.name)}</span>`;
      cell.addEventListener("click", onClick);
      return cell;
    };
    const section = (label, ings, keyOf, kind) => {
      if (!ings.length) return;
      grid.appendChild(el("div", "ing-group-label", label));
      const row = el("div", "ing-row");
      ings.forEach(ing => row.appendChild(ingCell(ing, keyOf(ing), () => this.toggleQueue(kind, ing.id))));
      grid.appendChild(row);
    };

    // 선반 재료 = 해금분 + 대본 지정 레시피의 잠긴 재료 (스토리가 시키는 잔은 재료도 꺼내준다)
    const avail = unlockedIngredients();
    const needIds = new Set(c.recipe.map(r => r.ingredient));
    if (c.fill) needIds.add(c.fill);
    const shelfIngs = avail.concat(
      shelfKind("ingredient").filter(i => needIds.has(i.id) && !avail.some(x => x.id === i.id)));

    section(S.lang === "ko" ? "따르기" : "Pour",
      shelfIngs.filter(i => ["base", "liqueur", "juice", "dairy", "wine_beer", "syrup"].includes(i.category)),
      i => "pour:" + i.id, "pour");
    section(S.lang === "ko" ? "스퀴즈" : "Squeeze",
      shelfIngs.filter(i => i.category === "fruit"), i => "squeeze:" + i.id, "squeeze");
    section(S.lang === "ko" ? "파우더" : "Powder",
      shelfIngs.filter(i => i.category === "powder"), i => "powder:" + i.id, "powder");
    section(S.lang === "ko" ? "필업 (잔 채우기)" : "Fill-up",
      shelfIngs.filter(i => i.category === "mixer"), i => "fill:" + i.id, "fill");

    wrap.appendChild(grid);
    // 도구는 ② 도구 선반에서 이미 골랐다 — 여기선 무엇을 담았는지만 알려준다
    const tools = this.queue.filter(x => x.kind === "tool").map(x => T(shelfOf(x.id).name));
    wrap.appendChild(el("p", "hint", (S.lang === "ko" ? "🛠 담은 도구: " : "🛠 Tools: ") +
      (tools.join(", ") || (S.lang === "ko" ? "없음" : "none")) +
      (S.lang === "ko" ? " · 🌿 가니시: " : " · 🌿 Garnish: ") +
      (this.attempt.garnish ? T(shelfOf(this.attempt.garnish).name) : (S.lang === "ko" ? "없음" : "none"))));

    wrap.appendChild(this.slotNav());
    this.setStage(wrap);
    this.applyGlow();
  },

  // 시작 — 담은 것을 순서대로 실행. 병(코르크/뚜껑)을 담았으면 따개도 있어야 한다
  startRun() {
    const c = this.chosen;
    if (!this.queue.some(x => x.kind !== "tool")) {
      toast(S.lang === "ko" ? "재료를 하나도 담지 않았다" : "No ingredients stocked"); return;
    }
    const corkedQueued = this.queue.some(x => x.kind === "pour" && this.CORK_BOTTLES.includes(x.id));
    const hasOpener = this.queue.some(x => x.kind === "tool" && x.id === "opener");
    if ((c.prep || corkedQueued) && !hasOpener) {
      toast(S.lang === "ko" ? "🔒 병을 열 '따개'를 담아야 한다" : "🔒 You need the opener to open the bottle");
      return;
    }
    this.runList = this.buildRunList();
    this.ri = 0;
    this.runNext();
  },

  // 큐의 다음 기믹을 실행. 각 기믹이 끝나면 afterGimmick()→runNext()로 이어진다
  runNext() {
    if (this.ri >= this.runList.length) return this.garnishInfo();
    const s = this.runList[this.ri++];
    if (s.t === "open") { s.prep === "cork" ? this.corkGimmick(s.bottle) : this.capGimmick(); return; }
    if (s.t === "pour") { const ln = this.lineFor(s.id, "pour") || {}; this.pourGimmick({ id: s.id, target: ln.qty || 0, unit: ln.unit || "oz" }); return; }
    if (s.t === "squeeze") { const ln = this.lineFor(s.id, "squeeze") || {}; this.squeezeGimmick({ id: s.id, target: ln.qty || 0, unit: "oz" }); return; }
    if (s.t === "powder") { const ln = this.lineFor(s.id, "powder") || {}; this.tapGimmick({ id: s.id, target: ln.qty || 0, unit: "tsp" }); return; }
    if (s.t === "mix") { s.tool === "shaker" ? this.shakeGimmick() : this.stirGimmick(); return; }
    if (s.t === "fill") { this.fillGimmick({ id: s.id }); return; }
  },

  // 기믹 하나가 끝나면 다음 기믹으로 (큐 소진 시 가니시로)
  afterGimmick() { this.runNext(); },

  // 따르기 — 시뮬레이터 방식: 자동으로 흘러나오고, 타이밍에 맞춰 탭하면 딱 멈춤
  pourGimmick(g) {
    const ing = ingOf(g.id);
    const rate = Math.max(g.unit === "ml" ? 14 : 1.0, (g.target || 2) / 2.4); // 목표까지 약 2.4초
    let amount = 0, flowing = false, last = performance.now();
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `
      <h3>🍾 ${T(ing.name)} ${S.lang === "ko" ? "따르기" : "Pour"}</h3>
      <div class="pour-scene">
        <div class="pour-bottle" style="--bc:rgba(${ing.color || "200,200,200"},.9)"></div>
        <div class="pour-stream" style="background:rgba(${ing.color || "220,220,220"},.8)"></div>
        <div class="pour-visual">${glassSVG(this.attempt.glass || "highball", ing.color || this.chosen.color, 0)}</div>
      </div>
      <div class="gauge"><div class="gauge-target"></div><div class="gauge-fill"></div></div>
      <div class="gauge-num">0.00 / ${g.target || "?"} ${g.unit}</div>
      <button class="btn primary hold-btn stop-btn">${S.lang === "ko" ? "⏹ 멈추기!" : "⏹ Stop!"}</button>
      <p class="hint">${S.lang === "ko" ? "곧 자동으로 따라진다 — 목표선에서 탭!" : "Pouring starts automatically — tap at the line!"}</p>`;
    this.setStage(wrap);
    const fillEl = wrap.querySelector(".gauge-fill"), numEl = wrap.querySelector(".gauge-num"),
      targetEl = wrap.querySelector(".gauge-target"), glassEl = wrap.querySelector(".pour-visual"),
      stream = wrap.querySelector(".pour-stream"), bottle = wrap.querySelector(".pour-bottle");
    const maxShow = (g.target || 2) * 1.6;
    targetEl.style.left = (100 * (g.target || 2) / maxShow) + "%";
    const startDelay = setTimeout(() => { // 잠깐의 예열 후 자동 따르기 시작
      flowing = true; last = performance.now();
      bottle.classList.add("tilt"); stream.classList.add("on");
    }, 650);
    const timer = setInterval(() => {
      const now = performance.now();
      if (flowing) {
        amount += rate * (now - last) / 1000;
        fillEl.style.width = Math.min(100, 100 * amount / maxShow) + "%";
        fillEl.classList.toggle("over", g.target && amount > g.target * 1.12);
        numEl.textContent = `${amount.toFixed(2)} / ${g.target || "?"} ${g.unit}`;
        glassEl.innerHTML = glassSVG(this.attempt.glass || "highball", ing.color || this.chosen.color, Math.min(0.9, amount / maxShow));
      }
      last = now;
    }, 30);
    wrap.querySelector(".stop-btn").addEventListener("click", () => {
      clearTimeout(startDelay); clearInterval(timer);
      stream.classList.remove("on"); bottle.classList.remove("tilt");
      const k = "pour:" + g.id; // 같은 재료를 또 집으면 누적
      this.attempt.pours[k] = Math.round(((this.attempt.pours[k] || 0) + amount) * 100) / 100;
      setTimeout(() => this.afterGimmick(), 320);
    });
  },

  // 스퀴즈 — 누르는 동안 즙이 나오고, 떼면 확정 (시뮬레이터 방식)
  squeezeGimmick(g) {
    const ing = ingOf(g.id);
    const rate = Math.max(g.unit === "ml" ? 10 : 0.55, (g.target || 1) / 2.2);
    let amount = 0, holding = false, last = performance.now(), touched = false;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `
      <h3>🍋 ${T(ing.name)} ${S.lang === "ko" ? "스퀴즈" : "Squeeze"}</h3>
      <div class="pour-visual">${glassSVG(this.attempt.glass || "highball", ing.color || this.chosen.color, 0.2)}</div>
      <div class="gauge"><div class="gauge-target"></div><div class="gauge-fill"></div></div>
      <div class="gauge-num">0.00 / ${g.target || "?"} ${g.unit}</div>
      <button class="btn hold-btn sqz-btn">${S.lang === "ko" ? "🤏 쥐어짜기 (떼면 완료)" : "🤏 Squeeze (release to finish)"}</button>`;
    this.setStage(wrap);
    const fillEl = wrap.querySelector(".gauge-fill"), numEl = wrap.querySelector(".gauge-num"),
      targetEl = wrap.querySelector(".gauge-target");
    const maxShow = (g.target || 1) * 1.6;
    targetEl.style.left = (100 * (g.target || 1) / maxShow) + "%";
    const timer = setInterval(() => {
      const now = performance.now();
      if (holding) {
        amount += rate * (now - last) / 1000;
        fillEl.style.width = Math.min(100, 100 * amount / maxShow) + "%";
        fillEl.classList.toggle("over", g.target && amount > g.target * 1.12);
        numEl.textContent = `${amount.toFixed(2)} / ${g.target || "?"} ${g.unit}`;
      }
      last = now;
    }, 30);
    const btn = wrap.querySelector(".sqz-btn");
    btn.addEventListener("pointerdown", () => { holding = true; touched = true; btn.classList.add("squeezing"); });
    const up = () => {
      if (!touched || !holding) return;
      holding = false;
      clearInterval(timer); window.removeEventListener("pointerup", up);
      const k = "squeeze:" + g.id;
      this.attempt.pours[k] = Math.round(((this.attempt.pours[k] || 0) + amount) * 100) / 100;
      setTimeout(() => this.afterGimmick(), 320);
    };
    window.addEventListener("pointerup", up);
  },

  // 파우더 — 탭으로 스푼 추가
  tapGimmick(g) {
    const ing = ingOf(g.id);
    let count = 0;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `
      <h3>🥄 ${T(ing.name)} (${g.target || "?"} tsp)</h3>
      <div class="tap-count">0 tsp</div>
      <button class="btn hold-btn spoon-btn">${S.lang === "ko" ? "한 스푼 넣기" : "Add a spoon"}</button>
      <button class="btn ghost done-btn">${UI("ui_confirm")}</button>`;
    this.setStage(wrap);
    wrap.querySelector(".spoon-btn").addEventListener("click", () => {
      count++; wrap.querySelector(".tap-count").textContent = count + " tsp";
    });
    wrap.querySelector(".done-btn").addEventListener("click", () => {
      const k = "powder:" + g.id;
      this.attempt.pours[k] = (this.attempt.pours[k] || 0) + count;
      this.afterGimmick();
    });
  },

  // 병따기(따개·cap) — 3연타
  capGimmick() {
    let taps = 0;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🍺 ${S.lang === "ko" ? "병따기" : "Pop the cap"}</h3>
      <button class="btn hold-btn cap-btn" style="font-size:40px">🔒</button>
      <p class="hint">${S.lang === "ko" ? "3번 두드려서 딴다" : "Tap 3 times"}</p>`;
    this.setStage(wrap);
    const btn = wrap.querySelector(".cap-btn");
    btn.addEventListener("click", () => {
      taps++;
      btn.style.transform = `rotate(${taps * 12}deg)`;
      if (taps >= 3) { btn.textContent = "🍺"; this.attempt.prepDone = "cap"; setTimeout(() => this.afterGimmick(), 450); }
    });
  },

  // 코르크 따기(따개·cork) — 조심조심 '천천히' 돌려야 한다. 급하게 돌리면 코르크가 부스러진다
  corkGimmick(bottleId) {
    const ing = ingOf(bottleId);
    const NEED = 2;                 // 2바퀴를 천천히
    const SPEED_LIMIT = 2.6;        // rad/s — 이보다 빠르면 무리가 감
    let total = 0, lastAng = null, lastT = 0, dragging = false, strainMs = 0, breaks = 0, done = false;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🍷 ${T(ing.name)} — ${S.lang === "ko" ? "코르크 따기" : "Pull the cork"}</h3>
      <div class="stir-dial cork-dial"><div class="stir-rod"></div><div class="stir-center">🍾</div><div class="cork-crumbs"></div></div>
      <div class="tap-count">0.0 / ${NEED}</div>
      <p class="hint cork-hint">${S.lang === "ko" ? "천천히, 조심조심 돌려서 뽑는다 — 급하면 부스러진다!" : "Twist slowly and gently — rush it and it crumbles!"}</p>`;
    this.setStage(wrap);
    const dial = wrap.querySelector(".cork-dial"), rod = wrap.querySelector(".stir-rod"),
      count = wrap.querySelector(".tap-count"), hint = wrap.querySelector(".cork-hint"),
      crumbs = wrap.querySelector(".cork-crumbs");
    const angleAt = (e) => {
      const r = dial.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    const crumble = () => {
      breaks++;
      this.attempt.corkQuality = Math.max(0.2, 1 - 0.4 * breaks);
      crumbs.innerHTML = "🍂".repeat(Math.min(breaks * 3, 9));
      dial.classList.add("shake-fail");
      hint.textContent = S.lang === "ko" ? "💥 코르크가 부스러졌다…! 더 천천히." : "💥 The cork crumbled...! Slower.";
      setTimeout(() => dial.classList.remove("shake-fail"), 350);
    };
    const onDown = (e) => { dragging = true; lastAng = angleAt(e); lastT = performance.now(); };
    const onMove = (e) => {
      if (!dragging || done) return;
      const now = performance.now(), a = angleAt(e);
      let d = a - lastAng;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const dt = Math.max(1, now - lastT);
      const speed = Math.abs(d) / (dt / 1000);
      if (speed > SPEED_LIMIT) {                    // 너무 빠름 — 무리 누적
        strainMs += dt;
        dial.classList.add("strain");
        if (strainMs > 420 && breaks < 2) { strainMs = 0; crumble(); }
      } else { dial.classList.remove("strain"); strainMs = Math.max(0, strainMs - dt * 0.5); }
      total += Math.abs(d);
      lastAng = a; lastT = now;
      rod.style.transform = `rotate(${a}rad)`;
      const turns = total / (Math.PI * 2);
      count.textContent = `${turns.toFixed(1)} / ${NEED}`;
      if (turns >= NEED) {
        done = true;
        window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
        this.attempt.prepDone = "cork";
        this.attempt.opened[bottleId] = true;
        this.pendingBottle = null;
        count.textContent = this.attempt.corkQuality >= 1 ? "🍾 뽕!" : "🍾…💥";
        hint.textContent = this.attempt.corkQuality >= 1
          ? (S.lang === "ko" ? "깔끔하게 열렸다." : "A clean pull.")
          : (S.lang === "ko" ? "열리긴 했는데… 부스러기가 들어갔을지도." : "It's open... but there may be crumbs.");
        setTimeout(() => this.afterGimmick(), 700);
      }
    };
    const onUp = () => { dragging = false; lastAng = null; };
    dial.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  },

  // 필업 — 원클릭
  fillGimmick(g) {
    const ing = ingOf(g.id);
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>⬆ ${T(ing.name)}</h3>
      <div class="pour-visual">${glassSVG(this.attempt.glass || "highball", this.chosen.color, 0.4)}</div>
      <button class="btn primary fill-btn">${S.lang === "ko" ? "잔 끝까지 채우기" : "Fill to the top"}</button>`;
    this.setStage(wrap);
    wrap.querySelector(".fill-btn").addEventListener("click", () => {
      this.attempt.fill = g.id;
      wrap.querySelector(".pour-visual").innerHTML = glassSVG(this.attempt.glass || "highball", this.chosen.color, 0.9);
      setTimeout(() => this.afterGimmick(), 420);
    });
  },

  // 셰이크(도구: 셰이커) — 자유형: 원하는 만큼 흔들고 스스로 멈춘다. 몇 번이 적당한지는 레시피 노트가 힌트
  shakeGimmick() {
    let strokes = 0, dragging = false, lastY = 0, dir = 0, travel = 0;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🫨 ${S.lang === "ko" ? "셰이킹! 위아래로 흔들어라" : "Shake! Drag up & down"}</h3>
      <div class="shake-track"><div class="shake-puck">🥤</div></div>
      <div class="tap-count">0</div>
      <button class="btn primary done-btn">${S.lang === "ko" ? "그만 흔들기 ✓" : "Enough ✓"}</button>
      <p class="hint">${S.lang === "ko" ? "덜 흔들면 안 섞이고, 너무 흔들면 죽는 맛이 있다" : "Too little won't mix; too much kills the drink"}</p>`;
    this.setStage(wrap);
    const track = wrap.querySelector(".shake-track"), puck = wrap.querySelector(".shake-puck"),
      count = wrap.querySelector(".tap-count");
    const onDown = (e) => { dragging = true; lastY = e.clientY; dir = 0; travel = 0; };
    const onMove = (e) => {
      if (!dragging) return;
      const dy = e.clientY - lastY; lastY = e.clientY;
      if (!dy) return;
      const rect = track.getBoundingClientRect();
      const ratio = track.offsetHeight / rect.height || 1;
      const y = Math.min(Math.max((e.clientY - rect.top) * ratio, 24), track.offsetHeight - 24);
      puck.style.top = (y - 24) + "px";
      const nd = dy > 0 ? 1 : -1;
      if (nd === dir) { travel += Math.abs(dy); return; }
      if (dir !== 0 && travel > 26) { strokes++; count.textContent = String(strokes); }
      dir = nd; travel = Math.abs(dy);
    };
    const onUp = () => dragging = false;
    track.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    wrap.querySelector(".done-btn").addEventListener("click", () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      this.attempt.usedTool = "shaker";
      this.attempt.shakeStrokes = strokes;
      this.afterGimmick();
    });
  },

  // 스터(도구: 믹싱 글라스 & 바 스푼) — 자유형: 원하는 바퀴수만큼 젓고 스스로 멈춘다 (스터 3바퀴 / 빌드 1바퀴가 정답)
  stirGimmick() {
    let total = 0, lastAng = null, dragging = false;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🌀 ${S.lang === "ko" ? "스터 — 원을 그리며 젓는다" : "Stir — draw smooth circles"}</h3>
      <div class="stir-dial"><div class="stir-rod"></div><div class="stir-center">🥄</div></div>
      <div class="tap-count">0.0</div>
      <button class="btn primary done-btn">${S.lang === "ko" ? "그만 젓기 ✓" : "Enough ✓"}</button>
      <p class="hint">${S.lang === "ko" ? "레시피마다 알맞은 바퀴 수가 있다" : "Each recipe has its right number of turns"}</p>`;
    this.setStage(wrap);
    const dial = wrap.querySelector(".stir-dial"), rod = wrap.querySelector(".stir-rod"),
      count = wrap.querySelector(".tap-count");
    const angleAt = (e) => {
      const r = dial.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    const onDown = (e) => { dragging = true; lastAng = angleAt(e); };
    const onMove = (e) => {
      if (!dragging) return;
      const a = angleAt(e);
      let d = a - lastAng;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      total += Math.abs(d);
      lastAng = a;
      rod.style.transform = `rotate(${a}rad)`;
      count.textContent = (total / (Math.PI * 2)).toFixed(1);
    };
    const onUp = () => { dragging = false; lastAng = null; };
    dial.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    wrap.querySelector(".done-btn").addEventListener("click", () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      this.attempt.usedTool = "mixing_glass";
      this.attempt.stirTurns = total / (Math.PI * 2);
      this.afterGimmick();
    });
  },

  // ---------- 6) 완성 화면 — 플레이어가 '고른' 가니시로 장식된다 (v1.9)
  // 정답 가니시가 아니라 선택한 가니시를 보여준다. 맞았는지는 판정 화면에서 알게 된다.
  garnishInfo() {
    const c = this.chosen, picked = this.attempt.garnish;
    const wrap = el("div", "gimmick garnish-info");
    const gname = picked ? T(shelfOf(picked).name) : (S.lang === "ko" ? "장식 없이" : "no garnish");
    wrap.innerHTML = `<h3>🌿 ${S.lang === "ko" ? "완성" : "Finished"}</h3>
      <div class="pour-visual">${glassSVG(this.attempt.glass || "bottle", c.color, 0.85)}</div>
      <p>${S.lang === "ko" ? "잔에 옮겨 담고 장식을 올린다." : "Poured into the glass and garnished."}</p>
      <p class="garnish-name">— ${gname}</p>
      <button class="btn primary">${UI("ui_next")} ▶</button>`;
    this.setStage(wrap);
    wrap.querySelector("button").addEventListener("click", () => this.score());
  },

  // ---------- 7) 판정 (⑧문서 공식) ----------
  score() {
    clearInterval(this.timerHandle);
    const c = this.chosen, a = this.attempt;
    const rows = [];
    let total = 0, weight = 0;
    const add = (label, s, note) => { total += s; weight += 1; rows.push({ label, s, note }); };
    const scoreQty = (target, actual) => {
      if (!target) return actual > 0 ? 0 : 1;
      return Math.max(0, 1 - Math.abs(target - actual) / target);
    };
    // 시간
    const elapsed = this.elapsed(), limit = c.time_limit_sec;
    const timeS = elapsed <= limit ? 1 : Math.max(0, limit / elapsed);
    add(S.lang === "ko" ? `제한 시간 ${limit}s` : `Time ${limit}s`, timeS, `${elapsed.toFixed(1)}s`);
    // 잔
    const glassOk = a.glass === c.glass;
    add(S.lang === "ko" ? "잔 선택" : "Glass", glassOk ? 1 : 0, glassOk ? "✓" : "✗");
    // 병 개봉(prep) — cap: 땄는가 / cork: 얼마나 조심스럽게 땄는가
    if (c.prep) {
      const s = a.prepDone !== c.prep ? 0 : (c.prep === "cork" ? a.corkQuality : 1);
      add(c.prep === "cork" ? (S.lang === "ko" ? "코르크" : "Cork") : (S.lang === "ko" ? "병따기" : "Cap"),
        s, a.prepDone !== c.prep ? "✗" : (s >= 1 ? "✓" : "💥"));
    }
    // 믹스 — 올바른 도구 + 알맞은 양 (shake 8회 / stir 3바퀴 / build 1바퀴)
    if (c.mix === "shake") {
      const s = a.usedTool === "shaker" ? scoreQty(8, a.shakeStrokes) : 0;
      add(S.lang === "ko" ? "셰이킹" : "Shake", s, a.usedTool === "shaker" ? `×${a.shakeStrokes}` : "✗");
    } else if (c.mix === "stir" || c.mix === "build") {
      const need = c.mix === "stir" ? 3 : 1;
      const s = a.usedTool === "mixing_glass" ? scoreQty(need, a.stirTurns) : 0;
      add(c.mix === "stir" ? (S.lang === "ko" ? "스터" : "Stir") : (S.lang === "ko" ? "빌드(젓기)" : "Build"),
        s, a.usedTool === "mixing_glass" ? `×${a.stirTurns.toFixed(1)}` : "✗");
    }
    // 레시피 라인
    c.recipe.forEach(r => {
      const actual = a.pours[r.action + ":" + r.ingredient] || 0;
      const s = scoreQty(r.qty, actual);
      add(`${T(ingOf(r.ingredient).name)} ${r.qty}${r.unit}`, s, `${actual}${r.unit}`);
    });
    // 필
    if (c.fill) {
      const ok = a.fill === c.fill;
      add(S.lang === "ko" ? "필업" : "Fill", ok ? 1 : 0, ok ? "✓" : "✗");
    }
    // 가니시 — v1.9부터 플레이어가 고르는 채점 항목 (정답이 '없음'인 칵테일은 없음을 골라야 맞다)
    {
      const want = c.garnish || null, got = a.garnish || null;
      const ok = want === got;
      add(S.lang === "ko" ? "가니시" : "Garnish", ok ? 1 : 0,
        ok ? "✓" : (got ? T(shelfOf(got).name) : (S.lang === "ko" ? "없음" : "none")));
    }
    // 불필요 행동 — 레시피에 없는 투입 / 안 쓰는 도구 / 안 따도 되는 병 (건당 -50%)
    const needKeys = new Set(c.recipe.map(r => r.action + ":" + r.ingredient));
    let extras = Object.keys(a.pours).filter(k => !needKeys.has(k)).length;
    if (c.mix === "none" && a.usedTool) extras++;
    if (!c.prep && a.prepDone) extras++;
    if (c.fill == null && a.fill) extras++;
    if (extras) add(S.lang === "ko" ? "불필요한 행동" : "Extras", Math.max(0, 1 - 0.5 * extras), `×${extras}`);
    const pct = weight ? Math.round(total / weight * 100) : 0;
    const grade = gradeForPct(pct);
    this.showResult(pct, grade, rows);
  },

  showResult(pct, grade, rows) {
    const c = this.chosen;
    const wrap = el("div", "craft-result");
    wrap.innerHTML = `
      <div class="result-glass">${glassSVG(this.attempt.glass || "bottle", c.color, 0.82)}</div>
      <div class="result-grade grade-${grade}">${grade.toUpperCase()}</div>
      <div class="result-pct">${T(c.name)} · ${pct}%</div>
      <div class="result-rows">${rows.map(r =>
        `<div class="rrow ${r.s > 0.85 ? "ok" : r.s > 0.4 ? "mid" : "bad"}"><span>${r.label}</span><span>${r.note} (${Math.round(r.s * 100)}%)</span></div>`).join("")}</div>`;
    const done = el("button", "btn primary", UI("ui_confirm"));
    done.addEventListener("click", () => {
      this.close({ pct, grade, cocktail: c, isCorrect: this.isCorrect });
    });
    wrap.appendChild(done);
    this.setStage(wrap);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  $("#note-close").addEventListener("click", () => $("#ov-note").classList.remove("show"));
});
