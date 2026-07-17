// ===== 제조 미니게임 — 시뮬레이터 방식 계승 (메뉴→잔→재료→기믹 큐→가니시→판정) =====
// 채점: 칵테일_등급_산출서 §2~3 그대로 — 항목 단순 평균, 컷은 balance.grade_cuts
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
    unlockedCocktails().forEach(c => {
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
    this.attempt = { glass: null, pours: {}, fill: null, mixDone: false, capDone: false };
    this.selPours = []; this.selSqueezes = []; this.selPowders = []; this.selFill = null;
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
    // 재료 스테이지
    const needed = new Set(c.recipe.map(r => r.action + ":" + r.ingredient));
    if (c.fill) needed.add("fill:" + c.fill);
    $$("#craft-stage .ing-cell").forEach(cell => {
      if (needed.has(cell.dataset.key) && !cell.classList.contains("sel")) cell.classList.add("glow");
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
      cell.addEventListener("click", () => { this.attempt.glass = g.id; this.showIngredients(); });
      grid.appendChild(cell);
    });
    // 병맥주(잔 없음) 대응 — "잔 없이(병째)" 선택지
    const none = el("div", "glass-cell");
    none.dataset.id = "null";
    none.innerHTML = `${glassSVG("bottle", null, 0)}<span>${S.lang === "ko" ? "병째로" : "In the bottle"}</span>`;
    none.addEventListener("click", () => { this.attempt.glass = null; this.showIngredients(); });
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
    const mixName = { none: "-", build: S.lang === "ko" ? "빌드" : "Build", stir: S.lang === "ko" ? "스터" : "Stir", shake: S.lang === "ko" ? "셰이크" : "Shake", bottle_open: S.lang === "ko" ? "병따기" : "Cap open" }[c.mix];
    const glassName = c.glass ? T(itemOf(c.glass).name) : (S.lang === "ko" ? "병째로" : "In the bottle");
    $("#note-body").innerHTML = `
      <h3>${T(c.name)}</h3>
      <ul>${lines || "<li>-</li>"}</ul>
      <p>🥃 ${glassName} / 🔀 ${mixName}${c.fill ? ` / ⬆ ${T(ingOf(c.fill).name)}` : ""}${c.garnish ? ` / 🌿 ${T(itemOf(c.garnish).name)}` : ""}</p>`;
    $("#ov-note").classList.add("show");
    this.notePeeked = true; // 이후 필요한 아이템이 깜빡임
    this.applyGlow();
  },

  // ---------- 4) 재료 선택 ----------
  showIngredients() {
    const c = this.chosen;
    const wrap = el("div", "craft-ing");
    wrap.appendChild(el("h3", "", S.lang === "ko" ? "재료 담기" : "Pick Ingredients"));
    const grid = el("div", "ing-grid");
    const groups = [
      { key: "pour", label: S.lang === "ko" ? "따르기" : "Pour", filter: i => ["base", "liqueur", "juice", "dairy", "wine_beer", "syrup"].includes(i.category), sel: this.selPours },
      { key: "squeeze", label: S.lang === "ko" ? "스퀴즈" : "Squeeze", filter: i => i.category === "fruit", sel: this.selSqueezes },
      { key: "powder", label: S.lang === "ko" ? "파우더" : "Powder", filter: i => i.category === "powder", sel: this.selPowders },
    ];
    groups.forEach(g => {
      grid.appendChild(el("div", "ing-group-label", g.label));
      const row = el("div", "ing-row");
      unlockedIngredients().filter(g.filter).forEach(ing => {
        const cell = el("div", "ing-cell");
        cell.dataset.key = g.key + ":" + ing.id;
        const color = ing.color ? `background:linear-gradient(180deg,transparent 30%,rgba(${ing.color},.75) 30%)` : "";
        cell.innerHTML = `<div class="ing-bottle" style="${color}"></div><span>${T(ing.name)}</span>`;
        cell.addEventListener("click", () => {
          const i = g.sel.indexOf(ing.id);
          if (i >= 0) g.sel.splice(i, 1); else g.sel.push(ing.id);
          cell.classList.toggle("sel", i < 0);
          this.applyGlow();
        });
        row.appendChild(cell);
      });
      grid.appendChild(row);
    });
    // 필업
    grid.appendChild(el("div", "ing-group-label", S.lang === "ko" ? "필업 (잔 채우기)" : "Fill-up"));
    const fillRow = el("div", "ing-row");
    unlockedIngredients().filter(i => i.category === "mixer").forEach(ing => {
      const cell = el("div", "ing-cell");
      cell.dataset.key = "fill:" + ing.id;
      cell.innerHTML = `<div class="ing-bottle" style="background:linear-gradient(180deg,transparent 30%,rgba(${ing.color},.75) 30%)"></div><span>${T(ing.name)}</span>`;
      cell.addEventListener("click", () => {
        this.selFill = this.selFill === ing.id ? null : ing.id;
        fillRow.querySelectorAll(".ing-cell").forEach(x => x.classList.remove("sel"));
        if (this.selFill) cell.classList.add("sel");
        this.applyGlow();
      });
      fillRow.appendChild(cell);
    });
    grid.appendChild(fillRow);
    wrap.appendChild(grid);

    const btns = el("div", "btn-row");
    btns.appendChild(this.noteButton());
    const start = el("button", "btn primary", S.lang === "ko" ? "기믹 시작 ▶" : "Start Gimmicks ▶");
    start.addEventListener("click", () => this.beginGimmicks());
    btns.appendChild(start);
    wrap.appendChild(btns);
    this.setStage(wrap);
    this.applyGlow();
  },

  // ---------- 5) 기믹 큐 ----------
  beginGimmicks() {
    const c = this.chosen;
    this.gimmicks = [];
    // 선택한 재료들이 레시피 순서대로 기믹 큐에 들어간다 (레시피에 없는 선택은 뒤에 붙음 — 시간 낭비 페널티)
    const lineFor = (id, act) => c.recipe.find(r => r.ingredient === id && r.action === act);
    this.selPours.forEach(id => this.gimmicks.push({ kind: "pour", id, target: (lineFor(id, "pour") || {}).qty || 0, unit: (lineFor(id, "pour") || {}).unit || "oz" }));
    this.selSqueezes.forEach(id => this.gimmicks.push({ kind: "squeeze", id, target: (lineFor(id, "squeeze") || {}).qty || 0, unit: "oz" }));
    this.selPowders.forEach(id => this.gimmicks.push({ kind: "powder", id, target: (lineFor(id, "powder") || {}).qty || 0, unit: "tsp" }));
    if (c.mix === "bottle_open") this.gimmicks.push({ kind: "cap" });
    if (this.selFill) this.gimmicks.push({ kind: "fill", id: this.selFill });
    if (["build", "stir", "shake"].includes(c.mix)) this.gimmicks.push({ kind: "mix", mix: c.mix });
    this.gi = 0;
    this.nextGimmick();
  },

  nextGimmick() {
    if (this.gi >= this.gimmicks.length) return this.garnishInfo();
    const g = this.gimmicks[this.gi++];
    if (g.kind === "pour") this.pourGimmick(g);
    else if (g.kind === "squeeze") this.squeezeGimmick(g);
    else if (g.kind === "powder") this.tapGimmick(g);
    else if (g.kind === "cap") this.capGimmick(g);
    else if (g.kind === "fill") this.fillGimmick(g);
    else if (g.kind === "mix") this.mixGimmick(g);
  },

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
      this.attempt.pours["pour:" + g.id] = Math.round(amount * 100) / 100;
      setTimeout(() => this.nextGimmick(), 320);
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
      this.attempt.pours["squeeze:" + g.id] = Math.round(amount * 100) / 100;
      setTimeout(() => this.nextGimmick(), 320);
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
      this.attempt.pours["powder:" + g.id] = count;
      this.nextGimmick();
    });
  },

  // 병따기 — 3연타
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
      if (taps >= 3) { btn.textContent = "🍺"; this.attempt.capDone = true; setTimeout(() => this.nextGimmick(), 450); }
    });
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
      setTimeout(() => this.nextGimmick(), 420);
    });
  },

  // 믹스 — 시뮬레이터 방식: 셰이크=위아래 드래그 스트로크 / 스터·빌드=원형 다이얼 드래그
  mixGimmick(g) {
    if (g.mix === "shake") return this.shakeGimmick();
    return this.stirGimmick(g.mix);
  },

  // 셰이크 — 셰이커를 잡고 위아래로 흔든다 (방향 전환 8회)
  shakeGimmick() {
    const NEED = 8;
    let strokes = 0, dragging = false, lastY = 0, dir = 0;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🍸 ${S.lang === "ko" ? "셰이킹! 위아래로 흔들어라" : "Shake! Drag up & down"}</h3>
      <div class="shake-track"><div class="shake-puck">🥤</div></div>
      <div class="tap-count">0 / ${NEED}</div>`;
    this.setStage(wrap);
    const track = wrap.querySelector(".shake-track"), puck = wrap.querySelector(".shake-puck"),
      count = wrap.querySelector(".tap-count");
    let travel = 0;
    const onDown = (e) => { dragging = true; lastY = e.clientY; dir = 0; travel = 0; };
    const onMove = (e) => {
      if (!dragging) return;
      const dy = e.clientY - lastY; lastY = e.clientY;
      if (!dy) return;
      // 퍽이 포인터를 따라감
      const rect = track.getBoundingClientRect();
      const ratio = track.offsetHeight / rect.height || 1;
      const y = Math.min(Math.max((e.clientY - rect.top) * ratio, 24), track.offsetHeight - 24);
      puck.style.top = (y - 24) + "px";
      // 한 스트로크 = 같은 방향으로 26px 이상 이동 후 방향 반전
      const nd = dy > 0 ? 1 : -1;
      if (nd === dir) { travel += Math.abs(dy); return; }
      if (dir !== 0 && travel > 26) {
        strokes++;
        count.textContent = `${strokes} / ${NEED}`;
        if (strokes >= NEED) {
          this.attempt.mixDone = true;
          window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
          count.textContent = "✓";
          setTimeout(() => this.nextGimmick(), 420);
          return;
        }
      }
      dir = nd; travel = Math.abs(dy);
    };
    const onUp = () => dragging = false;
    track.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  },

  // 스터/빌드 — 다이얼을 원을 그리며 돌린다 (스터 3바퀴, 빌드 1바퀴)
  stirGimmick(mix) {
    const turnsNeed = mix === "stir" ? 3 : 1;
    const label = mix === "stir"
      ? (S.lang === "ko" ? "스터 — 원을 그리며 3바퀴" : "Stir — 3 smooth circles")
      : (S.lang === "ko" ? "빌드 — 잔에서 1바퀴 젓기" : "Build — one circle in the glass");
    let total = 0, lastAng = null, dragging = false;
    const wrap = el("div", "gimmick");
    wrap.innerHTML = `<h3>🥄 ${label}</h3>
      <div class="stir-dial"><div class="stir-rod"></div><div class="stir-center">🥄</div></div>
      <div class="tap-count">0.0 / ${turnsNeed}</div>`;
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
      const turns = total / (Math.PI * 2);
      count.textContent = `${turns.toFixed(1)} / ${turnsNeed}`;
      if (turns >= turnsNeed) {
        this.attempt.mixDone = true;
        window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
        count.textContent = "✓";
        setTimeout(() => this.nextGimmick(), 420);
      }
    };
    const onUp = () => { dragging = false; lastAng = null; };
    dial.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
    // 믹스
    if (c.mix !== "none") {
      const mixOk = c.mix === "bottle_open" ? a.capDone : a.mixDone;
      add(S.lang === "ko" ? "믹스" : "Mix", mixOk ? 1 : 0, mixOk ? "✓" : "✗");
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
