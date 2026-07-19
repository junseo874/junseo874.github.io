// ===== 제조 미니게임 — 플레이어 선택 주도 (메뉴→잔→선반: 집는 대로 기믹 즉시 실행→가니시→판정) =====
// 레시피(RecipeLines/mix/prep)는 실행 순서가 아니라 '채점 정답'. 기믹은 선반에서 재료·도구를 집는 순간 발동.
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
      glass: null, pours: {}, fill: null,
      usedTool: null, stirTurns: 0, shakeStrokes: 0,   // 도구는 플레이어가 선반에서 집는다
      prepDone: null, corkQuality: 1, opened: {},       // 병 개봉 상태 (cork 병은 따야 따를 수 있음)
    };
    this.pendingBottle = null;
    this.notePeeked = false; // 레시피 노트를 본 뒤에만 글로우 가이드 (시뮬레이터 방식)
    this.timeStart = performance.now();
    this.startTimer(c.time_limit_sec);
    this.showGlassSelect();
  },

  // 레시피 노트를 본 상태면 — 필요한 잔/재료가 깜빡인다 (시뮬레이터 glowNeededItems 계승)
  applyGlow() {
    $$("#craft-stage .glow").forEach(x => x.classList.remove("glow"));
    if (!this.notePeeked) return;
    const c = this.chosen;
    // 잔 선택 스테이지
    $$("#craft-stage .glass-cell").forEach(cell => {
      if (cell.dataset.id === String(c.glass)) cell.classList.add("glow");
    });
    // 선반 스테이지 — 재료 + 도구까지 안내
    const a = this.attempt || {};
    const needed = new Set();
    c.recipe.forEach(r => {
      const k = r.action + ":" + r.ingredient;
      if (!((a.pours || {})[k])) needed.add(k);   // 아직 안 넣은 것만
    });
    if (c.fill && !a.fill) needed.add("fill:" + c.fill);
    if (c.mix === "shake" && a.usedTool !== "shaker") needed.add("tool:shaker");
    if ((c.mix === "stir" || c.mix === "build") && a.usedTool !== "mixing_glass") needed.add("tool:mixing_glass");
    if (c.prep && !a.prepDone) needed.add("tool:opener");
    $$("#craft-stage .ing-cell").forEach(cell => {
      if (needed.has(cell.dataset.key)) cell.classList.add("glow");
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

  // ---------- 3) 잔 선택 ----------
  showGlassSelect() {
    const wrap = el("div", "craft-glass");
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "잔 선택" : "Choose a Glass"));
    if (this.tutorial) wrap.appendChild(el("p", "hint", S.lang === "ko" ? "💡 레시피 노트가 정답 잔을 알려준다" : "💡 The recipe note shows the right glass"));
    const grid = el("div", "glass-grid");
    DATA.master.items.filter(i => i.type === "glass").forEach(g => {
      const cell = el("div", "glass-cell");
      cell.dataset.id = g.id;
      cell.innerHTML = `${glassSVG(g.id, null, 0)}<span>${T(g.name)}</span>`;
      cell.addEventListener("click", () => { this.attempt.glass = g.id; this.showShelf(); });
      grid.appendChild(cell);
    });
    // 병맥주(잔 없음) 대응 — "잔 없이(병째)" 선택지
    const none = el("div", "glass-cell");
    none.dataset.id = "null";
    none.innerHTML = `${glassSVG("bottle", null, 0)}<span>${S.lang === "ko" ? "병째로" : "In the bottle"}</span>`;
    none.addEventListener("click", () => { this.attempt.glass = null; this.showShelf(); });
    grid.appendChild(none);
    wrap.appendChild(grid);
    wrap.appendChild(this.noteButton());
    this.setStage(wrap);
    this.applyGlow();
    if (this.tutorial) this.openNote();
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

  // ---------- 4) 선반 — 집는 대로 기믹이 즉시 실행된다 (플레이어 주도) ----------
  CORK_BOTTLES: ["red_wine", "champagne"],   // 코르크 병 — 따개로 따야 따를 수 있음

  lineFor(id, act) { return this.chosen.recipe.find(r => r.ingredient === id && r.action === act); },

  showShelf() {
    const c = this.chosen, a = this.attempt;
    const wrap = el("div", "craft-ing");
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "선반 — 집는 대로 만든다" : "The Shelf — what you grab is what you do"));

    // 지금까지 한 행동 이력
    const hist = el("div", "craft-hist");
    const chips = [];
    Object.keys(a.pours).forEach(k => {
      const [act, id] = k.split(":");
      const icon = { pour: "🍾", squeeze: "🍋", powder: "🥄" }[act] || "";
      chips.push(`${icon} ${T(ingOf(id).name)} ${a.pours[k]}${act === "powder" ? "tsp" : "oz"}`);
    });
    if (a.prepDone === "cap") chips.push(S.lang === "ko" ? "🍺 병뚜껑 ✓" : "🍺 cap ✓");
    if (a.prepDone === "cork") chips.push((S.lang === "ko" ? "🍷 코르크 " : "🍷 cork ") + (a.corkQuality >= 1 ? "✓" : "💥"));
    if (a.fill) chips.push("⬆ " + T(ingOf(a.fill).name));
    if (a.usedTool === "shaker") chips.push(`🫨 ×${a.shakeStrokes}`);
    if (a.usedTool === "mixing_glass") chips.push(`🌀 ×${a.stirTurns.toFixed(1)}`);
    hist.innerHTML = chips.length ? chips.map(x => `<span class="chip">${x}</span>`).join("")
      : `<span class="chip dim">${S.lang === "ko" ? "아직 아무것도 안 했다" : "Nothing yet"}</span>`;
    wrap.appendChild(hist);

    const grid = el("div", "ing-grid");
    const ingCell = (ing, key, onClick) => {
      const cell = el("div", "ing-cell");
      cell.dataset.key = key;
      const color = ing.color ? `background:linear-gradient(180deg,transparent 30%,rgba(${ing.color},.75) 30%)` : "";
      cell.innerHTML = `<div class="ing-bottle" style="${color}"></div><span>${T(ing.name)}</span>`;
      cell.addEventListener("click", onClick);
      return cell;
    };
    const section = (label, ings, keyOf, onPick) => {
      grid.appendChild(el("div", "ing-group-label", label));
      const row = el("div", "ing-row");
      ings.forEach(ing => row.appendChild(ingCell(ing, keyOf(ing), () => onPick(ing))));
      grid.appendChild(row);
      return row;
    };

    // 선반 재료 = 해금분 + 대본 지정 레시피의 잠긴 재료 (스토리가 시키는 잔은 재료도 꺼내준다)
    const avail = unlockedIngredients();
    const needIds = new Set(c.recipe.map(r => r.ingredient));
    if (c.fill) needIds.add(c.fill);
    const shelfIngs = avail.concat(
      DATA.master.ingredients.filter(i => needIds.has(i.id) && !avail.some(x => x.id === i.id)));

    // 따르기 재료 (코르크 병은 따기 전엔 잠김)
    section(S.lang === "ko" ? "따르기" : "Pour",
      shelfIngs.filter(i => ["base", "liqueur", "juice", "dairy", "wine_beer", "syrup"].includes(i.category)),
      i => "pour:" + i.id,
      ing => {
        if (this.CORK_BOTTLES.includes(ing.id) && !a.opened[ing.id]) {
          this.pendingBottle = ing.id;
          toast(S.lang === "ko" ? "🔒 코르크가 닫혀 있다 — 따개를 집자" : "🔒 Corked — grab the opener");
          this.applyGlow();
          return;
        }
        this.pourGimmick({ id: ing.id, target: (this.lineFor(ing.id, "pour") || {}).qty || 0, unit: (this.lineFor(ing.id, "pour") || {}).unit || "oz" });
      });
    section(S.lang === "ko" ? "스퀴즈" : "Squeeze",
      shelfIngs.filter(i => i.category === "fruit"), i => "squeeze:" + i.id,
      ing => this.squeezeGimmick({ id: ing.id, target: (this.lineFor(ing.id, "squeeze") || {}).qty || 0, unit: "oz" }));
    section(S.lang === "ko" ? "파우더" : "Powder",
      shelfIngs.filter(i => i.category === "powder"), i => "powder:" + i.id,
      ing => this.tapGimmick({ id: ing.id, target: (this.lineFor(ing.id, "powder") || {}).qty || 0, unit: "tsp" }));
    section(S.lang === "ko" ? "필업 (잔 채우기)" : "Fill-up",
      shelfIngs.filter(i => i.category === "mixer"), i => "fill:" + i.id,
      ing => this.fillGimmick({ id: ing.id }));

    // 바텐더 도구 — 집는 순간 그 기믹
    grid.appendChild(el("div", "ing-group-label", S.lang === "ko" ? "바텐더 도구" : "Bartender Tools"));
    const toolRow = el("div", "ing-row");
    const TOOL_ICON = { shaker: "🫨", mixing_glass: "🌀", opener: "🍾" };
    DATA.master.items.filter(i => i.type === "tool").forEach(t => {
      const cell = el("div", "ing-cell tool-cell");
      cell.dataset.key = "tool:" + t.id;
      cell.innerHTML = `<div class="tool-icon">${TOOL_ICON[t.id] || "🛠"}</div><span>${T(t.name)}</span>`;
      cell.addEventListener("click", () => {
        if (t.id === "shaker") this.shakeGimmick();
        else if (t.id === "mixing_glass") this.stirGimmick();
        else if (t.id === "opener") {
          if (this.pendingBottle) this.corkGimmick(this.pendingBottle);
          else this.capGimmick();
        }
      });
      toolRow.appendChild(cell);
    });
    grid.appendChild(toolRow);
    wrap.appendChild(grid);

    const btns = el("div", "btn-row");
    btns.appendChild(this.noteButton());
    const done = el("button", "btn primary", S.lang === "ko" ? "완성 ▶" : "Finish ▶");
    done.addEventListener("click", () => this.garnishInfo());
    btns.appendChild(done);
    wrap.appendChild(btns);
    this.setStage(wrap);
    this.applyGlow();
  },

  // 기믹 하나가 끝나면 선반으로 복귀
  afterGimmick() { this.showShelf(); },

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

  // ---------- 6) 가니시 설명 화면 (비인터랙티브 — §3.6) ----------
  garnishInfo() {
    const c = this.chosen;
    if (!c.garnish) return this.score();
    const g = itemOf(c.garnish);
    const wrap = el("div", "gimmick garnish-info");
    wrap.innerHTML = `<h3>🌿 ${S.lang === "ko" ? "가니시" : "Garnish"}</h3>
      <div class="pour-visual dim">${glassSVG(c.glass || "bottle", c.color, 0.85)}</div>
      <p>${S.lang === "ko" ? `완성된 음료를 잔에 따른 후 아래의 재료로 장식합니다.` : `The finished drink is garnished with:`}</p>
      <p class="garnish-name">— ${T(g.name)}</p>
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
