// ===== 바 내부 — 포커스 카메라 + 좌석 3 상태머신 =====
// 1부: 한 화면에 손님 1명(포커스), 좌우는 잘린 실루엣. 플레이어가 슬롯을 옮겨 다니며 응대.
// 2부: 슬롯 3개 중 최대 2명 — 1명이면 포커스 줌, 2명이면 자동으로 카메라가 넓어져 둘 다 프레이밍.
"use strict";

const VIEW_W = 1280;
const SLOT_X = [640, 1300, 1960];   // 좌석 간격 660 → 포커스 시 이웃 손님 실루엣이 화면 가장자리에 ~45px 걸림

const BarCam = {
  cx: SLOT_X[1], zoom: 1,
  apply(cx, zoom, instant) {
    this.cx = cx; this.zoom = zoom;
    const w = $("#bar-world");
    w.style.transition = instant ? "none" : "transform .55s cubic-bezier(.4,0,.2,1)";
    w.style.transform = `translateX(${VIEW_W / 2 - cx * zoom}px) scale(${zoom})`;
  },
};

function makeSeat(i) {
  return { index: i, state: "empty", guest: null, result: null, discontent: 0, threshold: 0, callStage: 1, nextIdleAt: 0, idleUntil: 0 };
}

const Bar = {
  seats: [makeSeat(0), makeSeat(1), makeSeat(2)],
  slots: [], slotIdx: 0, nextSpawnAt: 0,
  paused: false, active: false, mode: "part1",
  focus: 1,
  pendingSeat: null, resolveDay: null, tickHandle: null,

  // ---------- 모드/카메라 ----------
  setMode(mode) {
    this.mode = mode;
    if (mode === "story") {
      this.focus = 1;
      this.renderSeats(); // 1부 실루엣(dim) 해제
      this.storyFrame();
      $("#slot-nav").style.display = "none";
    } else {
      $("#slot-nav").style.display = this.active ? "flex" : "none";
      this.focusSlot(this.focus, true);
    }
    this.updateIndicator();
  },

  focusSlot(i, instant) {
    if (this.mode !== "part1") return;
    this.focus = Math.max(0, Math.min(2, i));
    BarCam.apply(SLOT_X[this.focus], 1, instant);
    this.renderSeats();
    this.updateIndicator();
  },

  // 2부 — 스탠디가 있는 좌석들을 자동 프레이밍 (1명: 줌인 / 2명+: 줌아웃해 모두 보이게)
  storyFrame() {
    const occupied = this.seats.map(s => s.index).filter(i =>
      $(`.seat[data-seat="${i}"] .standee`));
    this.updateIndicator();
    if (!occupied.length) { BarCam.apply(SLOT_X[1], 0.92); return; }
    if (occupied.length === 1) { BarCam.apply(SLOT_X[occupied[0]], 1); return; }
    const xs = occupied.map(i => SLOT_X[i]);
    const min = Math.min(...xs), max = Math.max(...xs);
    const span = (max - min) + 760;                    // 좌우 손님 몸통 여유
    const zoom = Math.min(1, VIEW_W / span);
    BarCam.apply((min + max) / 2, zoom);
  },

  // ---------- 진입점: 그날의 1부 ----------
  runPart1(day) {
    return new Promise(resolve => {
      this.resolveDay = resolve;
      this.slots = DATA.schedule.guest_slots.filter(g => g.day === day).sort((a, b) => a.seq - b.seq);
      if (!this.slots.length) { resolve(); return; }
      this.slotIdx = 0;
      this.nextSpawnAt = performance.now() + 2500;
      this.seats = [makeSeat(0), makeSeat(1), makeSeat(2)];
      this.active = true; this.paused = false; this.pendingSeat = null;
      this.setMode("part1");
      this.renderSeats(); this.renderCoaster(); this.renderGlassTray();
      $("#btn-close-early").style.display = "block";
      $("#slot-nav").style.display = "flex";
      this.tickHandle = setInterval(() => this.tick(), 200);
      this.updateRemain(); this.updateIndicator();
    });
  },

  endPart1() {
    this.active = false;
    clearInterval(this.tickHandle);
    $("#btn-close-early").style.display = "none";
    $("#slot-nav").style.display = "none";
    $("#hud-remain").textContent = "";
    const fn = this.resolveDay; this.resolveDay = null;
    if (fn) fn();
  },

  closeEarly() {
    if (!this.active) return;
    this.slotIdx = this.slots.length;
    this.seats.forEach(s => { if (s.state !== "empty") Object.assign(s, makeSeat(s.index)); });
    this.renderSeats(); this.renderGlassTray(); this.updateIndicator();
    this.checkEnd();
  },

  updateRemain() {
    const seated = this.seats.filter(s => s.state !== "empty").length;
    const remain = (this.slots.length - this.slotIdx) + seated;
    $("#hud-remain").textContent = this.active ? `👥 ${remain}` : "";
  },

  // ---------- 스폰 ----------
  trySpawn(now) {
    if (this.slotIdx >= this.slots.length || now < this.nextSpawnAt) return;
    const seat = this.seats.find(s => s.state === "empty");
    if (!seat) return;
    const slot = this.slots[this.slotIdx++];
    if (this.slotIdx < this.slots.length)
      this.nextSpawnAt = now + this.slots[this.slotIdx].delay_sec * 1000;
    const pool = unlockedCocktails().filter(c => c.tier === slot.tier);
    const cocktail = pool.length ? pick(pool) : pick(unlockedCocktails());
    const isCameo = !!slot.character;
    const ch = isCameo ? charOf(slot.character) : null;
    const personality = slot.personality || pick(DATA.master.personalities).id;
    seat.state = "entering";
    seat.guest = {
      name: isCameo ? T(ch.name) : pick(GUEST_NAMES),
      color: isCameo ? ch.name_color : pick(GUEST_COLORS),
      voice: isCameo ? slot.character : personality,
      personality,
      cameoScene: slot.cameo_scene || null,
      target: cocktail,
      round: 1, maxRounds: slot.max_rounds || 1,
      isCorrect: null,
    };
    toast(S.lang === "ko" ? "🚪 손님이 들어왔다" : "🚪 A guest walked in");
    this.renderSeats(); this.updateRemain(); this.updateIndicator();
    setTimeout(() => {
      if (seat.state !== "entering") return;
      seat.state = "waitingCoaster";
      seat.discontent = 0;
      seat.threshold = Math.max(CFG.coaster_min_sec, CFG.coaster_base_sec - S.day * CFG.coaster_per_tier_sec);
      seat.callStage = 1;
      seat.float = bark(seat.guest.voice, "call");
      this.renderSeats(); this.updateIndicator();
    }, 1100);
  },

  // ---------- 코스터 → 주문 3박자 플로우 (루나 질문 → 손님 고민 → 주문) ----------
  onCoasterDrop(seatIndex) {
    if (seatIndex === null || seatIndex !== this.focus) return; // 포커스한 손님만 응대 가능
    const s = this.seats[seatIndex];
    if (!s || s.state !== "waitingCoaster") return;
    this.startOrder(s);
  },

  async startOrder(s) {
    s.state = "ordering"; // 대화 박자 동안은 인내심 정지
    s.float = "";
    this.renderSeats();
    lunaSay(bark("luna", "ask_order"));
    await sleep(1100);
    if (s.state !== "ordering") return;
    s.float = bark(s.guest.voice, "order_think");
    this.renderSeats();
    await sleep(1300 + Math.random() * 900);
    if (s.state !== "ordering") return;
    s.state = "waitingMake";
    s.discontent = 0;
    s.threshold = Math.max(
      s.guest.target.time_limit_sec + CFG.serve_min_bonus_sec,
      s.guest.target.time_limit_sec + CFG.serve_bonus_sec - S.day * CFG.serve_per_tier_sec);
    s.callStage = 1;
    s.nextIdleAt = performance.now() + 8000 + Math.random() * 5000;
    const situ = s.guest.round > 1 ? "reorder" : "order";
    s.float = bark(s.guest.voice, situ).replace("{cocktail}", T(s.guest.target.name));
    this.renderSeats(); this.updateIndicator();
  },

  async onSeatTap(seatIndex) {
    if (this.mode !== "part1") return;
    if (seatIndex !== this.focus) { this.focusSlot(seatIndex); return; } // 다른 슬롯 클릭 = 이동
    const s = this.seats[seatIndex];
    if (!s || s.state !== "waitingMake" || this.paused || Dlg.running) return;
    this.pendingSeat = seatIndex;
    s.state = "making";
    this.paused = true; // §3.5 제조 중 전 좌석 인내심 정지
    this.renderSeats(); this.updateIndicator();
    const res = await Craft.open({ target: s.guest.target.id });
    this.paused = false;
    s.result = res;
    s.guest.isCorrect = res.isCorrect;
    this.showReview(s);
  },

  showReview(s) {
    const ov = $("#ov-review");
    const r = s.result;
    $("#review-body").innerHTML = `
      <div class="result-glass">${glassSVG(r.cocktail.glass || "bottle", r.cocktail.color, 0.8)}</div>
      <h3>${T(r.cocktail.name)} · <span class="grade-${r.grade}">${r.grade.toUpperCase()} ${r.pct}%</span></h3>
      <p class="critic">${this.criticLine(r.grade)}</p>`;
    ov.classList.add("show");
    $("#btn-review-serve").onclick = () => { ov.classList.remove("show"); this.confirmDrink(s); };
    $("#btn-review-discard").onclick = () => {
      ov.classList.remove("show");
      s.result = null; s.state = "waitingMake"; this.pendingSeat = null;
      toast(S.lang === "ko" ? "🗑 잔을 버렸다 — 다시 제조" : "🗑 Discarded — make it again");
      this.renderSeats(); this.updateIndicator();
    };
  },
  criticLine(grade) {
    const ko = { excellent: "크리스: \"…제법이군. 금방 유명해지겠는데?\"", good: "크리스: \"나쁘지 않은 솜씨야.\"", decent: "크리스: \"음… 그럭저럭이군.\"", poor: "크리스: \"다시 연습이 필요해 보여.\"", sewage: "크리스: \"손님한테 이걸 낼 순 없지 않나?\"" };
    const en = { excellent: "Chris: \"...Not bad at all. You'll be famous soon.\"", good: "Chris: \"Decent work.\"", decent: "Chris: \"Hm... passable.\"", poor: "Chris: \"You need more practice.\"", sewage: "Chris: \"You can't serve THIS to a customer.\"" };
    return (S.lang === "ko" ? ko : en)[grade];
  },

  confirmDrink(s) {
    s.state = "waitingServe";
    this.pendingSeat = null;
    this.renderSeats(); this.renderGlassTray(); this.updateIndicator();
  },

  onGlassDrop(fromSeat, dropSeat) {
    if (fromSeat !== dropSeat || dropSeat !== this.focus) return;
    const s = this.seats[fromSeat];
    if (!s || s.state !== "waitingServe") return;
    this.serve(s);
  },

  // ---------- 서빙 → 반응 → 정산/퇴장 ----------
  async serve(s) {
    s.state = "reacting"; s.float = "";
    this.renderSeats(); this.renderGlassTray(); this.updateIndicator();
    const g = s.guest, r = s.result;
    const say = (txt) => { s.float = txt; this.renderSeats(); };
    say(g.isCorrect ? bark(g.voice, "react_" + r.grade) : bark(g.voice, "wrong_receive"));
    await sleep(1400);
    say(S.lang === "ko" ? "( 마시는 중… )" : "( drinking... )");
    await sleep(1200);
    if (!g.isCorrect) { say(bark(g.voice, "wrong_drink")); await sleep(1400); }

    const price = r.cocktail.price;
    const pers = DATA.master.personalities.find(p => p.id === g.personality);
    let revenue, tip = 0, positive;
    if (!g.isCorrect || r.grade === "sewage") { revenue = -price; positive = false; }
    else {
      revenue = price;
      const rate = DATA.balance.tip_rates[r.grade] || 1;
      tip = Math.max(0, Math.round(price * (rate - 1) * (pers ? pers.tip_mult : 1)));
      positive = true;
    }
    S.gold += revenue + tip;
    S.today.sales += revenue; S.today.tips += tip;
    const repD = positive ? (r.grade === "excellent" ? 2 : r.grade === "good" ? 1 : 0) : -2;
    S.rep += repD; S.today.repDelta += repD;
    updateHUD();

    // 다회 주문 — 코스터 없이 곧장 다음 잔 (§3.8)
    if (positive && g.round < g.maxRounds) {
      g.round++;
      const pool = unlockedCocktails().filter(c => c.tier === r.cocktail.tier);
      g.target = pool.length ? pick(pool) : g.target;
      s.result = null;
      await sleep(800);
      this.startOrder(s);
      return;
    }

    say((positive ? bark(g.voice, "bye_good") : bark(g.voice, "bye_bad")) + ` (${revenue + tip >= 0 ? "+" : ""}${revenue + tip}G)`);
    await sleep(1400);

    if (g.cameoScene) { // 카메오 — 퇴장 전 짧은 씬
      this.paused = true;
      await Dlg.runScene(g.cameoScene);
      this.paused = false;
    }
    S.today.served++; S.stats.servedTotal++;
    this.clearSeat(s);
  },

  angryLeave(s) {
    const kind = s.state === "waitingCoaster" ? "coaster" : "serve";
    const repD = kind === "coaster" ? CFG.leave_coaster_rep : CFG.leave_serve_rep;
    S.rep += repD; S.today.repDelta += repD;
    S.today.angry++; S.stats.angryTotal++;
    s.float = bark(s.guest.voice, kind === "coaster" ? "leave_coaster" : "leave_serve");
    s.state = "angryLeft";
    this.renderSeats(); this.renderGlassTray(); updateHUD(); this.updateIndicator();
    setTimeout(() => this.clearSeat(s), 1400);
  },

  clearSeat(s) {
    Object.assign(s, makeSeat(s.index));
    this.renderSeats(); this.renderGlassTray(); this.updateRemain(); this.updateIndicator();
    this.checkEnd();
  },

  checkEnd() {
    if (!this.active) return;
    if (this.slotIdx >= this.slots.length && this.seats.every(s => s.state === "empty")) this.endPart1();
  },

  // ---------- 틱 ----------
  tick() {
    if (!this.active) return;
    const now = performance.now();
    if (!this.paused && !Dlg.running) this.trySpawn(now);
    if (this.paused || Dlg.running) return; // §3.5
    this.seats.forEach(s => {
      if (!["waitingCoaster", "waitingMake", "waitingServe"].includes(s.state)) return;
      const pers = DATA.master.personalities.find(p => p.id === s.guest.personality);
      s.discontent += 0.2 / (pers ? pers.patience_mult : 1);
      if (s.discontent >= s.threshold) { this.angryLeave(s); return; }
      const pct = s.discontent / s.threshold;
      const stage = pct >= CFG.warn_red_ratio ? 3 : pct >= CFG.warn_yellow_ratio ? 2 : 1;
      if (stage !== s.callStage) {
        s.callStage = stage; s.idleUntil = 0;
        if (s.state === "waitingCoaster")
          s.float = bark(s.guest.voice, stage === 3 ? "call_final" : stage === 2 ? "call_urge" : "call");
        else
          s.float = bark(s.guest.voice, stage === 3 ? "serve_final" : "serve_urge");
        this.renderSeats();
      } else if (stage === 1 && s.state !== "waitingCoaster" && now >= s.nextIdleAt) {
        // 한적한 바의 공기 — 기다리는 손님이 이따금 혼잣말을 한다
        s.nextIdleAt = now + 9000 + Math.random() * 7000;
        s.idleUntil = now + 3200;
        s.prevFloat = s.float;
        s.float = bark(s.guest.voice, "idle");
        this.renderSeats();
      } else if (s.idleUntil && now >= s.idleUntil) {
        s.idleUntil = 0;
        s.float = s.prevFloat || s.float;
        this.renderSeats();
      } else {
        this.renderBar(s);
      }
    });
    this.updateIndicator();
  },

  // ---------- 렌더 ----------
  renderSeats() {
    this.seats.forEach(s => {
      const elm = $(`.seat[data-seat="${s.index}"]`);
      elm.classList.toggle("dim", this.mode === "part1" && s.index !== this.focus);
      const guestEl = elm.querySelector(".seat-guest");
      const floatEl = elm.querySelector(".float-text");
      const barEl = elm.querySelector(".discontent-bar");
      const coasterEl = elm.querySelector(".seat-coaster");
      if (guestEl.querySelector(".standee")) return; // 2부 스탠디 보호
      guestEl.innerHTML = "";
      floatEl.classList.remove("show");
      barEl.style.visibility = "hidden";
      coasterEl.className = "seat-coaster";
      if (s.state === "empty") return;
      if (s.state === "entering") {
        guestEl.innerHTML = `<div class="guest-fig entering" style="--gc:#666"><span class="guest-face">…</span></div>`;
        return;
      }
      const g = s.guest;
      guestEl.innerHTML = `<div class="guest-fig ${s.state === "angryLeft" ? "angry" : ""}" style="--gc:${g.color}">
        <span class="guest-face">${g.cameoScene ? "★" : "●"}</span>
        <span class="guest-name" style="color:${g.color}">${g.name}</span></div>`;
      if (s.float && s.index === this.focus) { floatEl.textContent = s.float; floatEl.classList.add("show"); }
      if (["waitingCoaster", "waitingMake", "waitingServe"].includes(s.state) && s.index === this.focus) {
        barEl.style.visibility = "visible"; this.renderBar(s);
      }
      if (["ordering", "waitingMake", "making", "waitingServe", "reacting"].includes(s.state)) {
        coasterEl.classList.add("placed");
        if ((s.state === "waitingServe" || s.state === "reacting") && s.result)
          coasterEl.classList.add("with-glass");
      }
    });
  },
  renderBar(s) {
    if (s.index !== this.focus) return;
    const fill = $(`.seat[data-seat="${s.index}"] .discontent-fill`);
    if (!fill) return;
    const pct = Math.min(100, s.discontent / s.threshold * 100);
    fill.style.width = pct + "%";
    fill.style.background = pct >= 80 ? "#e04a3a" : pct >= 50 ? "#e0c23a" : "#3ad13a";
  },

  // 슬롯 인디케이터 — ①문서 §3.2: 색/점멸로 곁눈질 판단
  updateIndicator() {
    const wrap = $("#slot-indicator");
    if (!wrap.children.length) {
      for (let i = 0; i < 3; i++) {
        const cell = el("div", "ind-cell");
        cell.dataset.slot = i;
        cell.innerHTML = `<div class="ind-dot"></div><span class="ind-label">${i + 1}</span>`;
        cell.addEventListener("click", () => this.focusSlot(i));
        wrap.appendChild(cell);
      }
    }
    this.seats.forEach(s => {
      const cell = wrap.children[s.index];
      const dot = cell.querySelector(".ind-dot");
      cell.classList.toggle("focused", this.mode === "part1" && s.index === this.focus);
      let cls = "ind-dot";
      if (this.mode === "story") {
        if ($(`.seat[data-seat="${s.index}"] .standee`)) cls += " on";
      } else if (s.state === "entering") cls += " on blink";
      else if (s.state !== "empty") {
        const pct = s.threshold ? s.discontent / s.threshold : 0;
        if (["waitingCoaster", "waitingMake", "waitingServe"].includes(s.state) && pct >= CFG.warn_red_ratio) cls += " danger blink";
        else if (["waitingCoaster", "waitingMake", "waitingServe"].includes(s.state) && pct >= CFG.warn_yellow_ratio) cls += " warn";
        else cls += " on";
      }
      dot.className = cls;
    });
  },

  renderCoaster() {
    const tray = $("#coaster-tray");
    tray.innerHTML = `<div class="coaster-pile"></div>`;
    const top = el("div", "coaster-top", "◯");
    top.title = S.lang === "ko" ? "코스터 — 손님에게 드래그" : "Coaster — drag to the guest";
    makeDraggable(top, idx => this.onCoasterDrop(idx));
    tray.appendChild(top);
  },
  renderGlassTray() {
    const tray = $("#glass-tray");
    tray.innerHTML = "";
    this.seats.forEach(s => {
      if (s.state !== "waitingServe" || !s.result) return;
      const chip = el("div", "glass-chip");
      chip.innerHTML = glassSVG(s.result.cocktail.glass || "bottle", s.result.cocktail.color, 0.78);
      chip.title = (S.lang === "ko" ? "드래그해서 서빙: " : "Drag to serve: ") + s.guest.name;
      makeDraggable(chip, idx => this.onGlassDrop(s.index, idx));
      tray.appendChild(chip);
    });
  },
};

const GUEST_NAMES = ["김서준", "이하윤", "박지우", "최민준", "정예은", "강도현", "윤서아", "임태양", "한소율", "오준혁"];
const GUEST_COLORS = ["#b9a58a", "#8aa5b9", "#a58ab9", "#8ab99b", "#b98a8a", "#9b8ab9"];

// 루나(바텐더) 말풍선 — 카운터 쪽에서 뜬다
let lunaSayTimer = null;
function lunaSay(text) {
  const b = $("#luna-bubble");
  b.textContent = "LUNA — " + text;
  b.classList.add("show");
  clearTimeout(lunaSayTimer);
  lunaSayTimer = setTimeout(() => b.classList.remove("show"), 2200);
}

// 포인터 드래그 (시뮬레이터 makeDraggable 이식)
function makeDraggable(elm, onDrop) {
  elm.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const ghost = elm.cloneNode(true);
    ghost.classList.add("drag-ghost");
    document.body.appendChild(ghost);
    const place = (x, y) => { ghost.style.left = (x - 26) + "px"; ghost.style.top = (y - 26) + "px"; };
    place(e.clientX, e.clientY);
    $$(".seat").forEach(s => s.classList.add("droptarget"));
    const move = ev => place(ev.clientX, ev.clientY);
    const up = ev => {
      document.removeEventListener("pointermove", move);
      ghost.remove();
      $$(".seat").forEach(s => s.classList.remove("droptarget"));
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      const seatEl = t && t.closest(".seat");
      onDrop(seatEl ? parseInt(seatEl.dataset.seat, 10) : null);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  });
}
