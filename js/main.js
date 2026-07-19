// ===== 메인 — 하루 페이즈 머신 + 출퇴근/집/꿈/입고/정산 =====
// 페이즈 순서(설계서 §1): commute_in → stock_in → bar(1부→2부) → settlement → commute_out → home → sleep
"use strict";

// ---------- 출퇴근 횡스크롤 (짧은 두 블록 — 26.07.17 피드백으로 축소) ----------
const SPOT_X = { home_door: 80, street_mid: 430, street_board: 700, street_stall: 980, alley_in: 1210, alley_deep: 1360, elevator: 1480, bar_door: 1560 };
const STRIP_W = 1640;

const Commute = {
  phase: null, lunaX: 70, goal: null, resolveFn: null, keys: {}, rafHandle: null,

  async run(phase) {
    this.phase = phase;
    showScreen("screen-commute");
    const goingIn = phase === "commute_in";
    this.lunaX = goingIn ? SPOT_X.home_door : SPOT_X.bar_door;
    this.goal = goingIn ? "bar_door" : "home_door";
    $("#commute-label").textContent = goingIn
      ? `🌃 ${UI("ui_stock_in") && ""}${S.lang === "ko" ? "출근길" : "To work"} — ${CFG.commute_in_time}`
      : `🌌 ${S.lang === "ko" ? "퇴근길" : "Heading home"} — ${CFG.commute_out_time}`;
    this.renderStrip();
    await Dlg.runPhaseScenes(S.day, phase); // auto 씬
    this.renderStrip();
    if (window.DEV_SKIPWALK) return; // 개발용: 걷기 구간 생략
    return new Promise(resolve => {
      this.resolveFn = resolve;
      this.loop();
    });
  },

  finish() {
    clearInterval(this.rafHandle);
    this.keys = {};
    const fn = this.resolveFn; this.resolveFn = null;
    if (fn) fn();
  },

  activePoints() {
    return DATA.schedule.points.filter(p =>
      (p.phase === this.phase || p.phase === "both") &&
      !S.usedPoints.has(S.day + ":" + p.id) &&
      evalWhen(p.when, { phase: this.phase }));
  },

  renderStrip() {
    const strip = $("#commute-strip");
    strip.innerHTML = "";
    // 배경 건물 실루엣
    for (let i = 0; i < 10; i++) {
      const b = el("div", "bldg");
      b.style.left = (i * 168 + 10) + "px";
      b.style.height = (80 + ((i * 53) % 120)) + "px";
      strip.appendChild(b);
    }
    // 지형지물: 바 / 집
    const barD = el("div", "landmark", "🍸<span>UNKNOWN</span>"); barD.style.left = SPOT_X.bar_door + "px"; strip.appendChild(barD);
    const homeD = el("div", "landmark", "🏠<span>HOME</span>"); homeD.style.left = SPOT_X.home_door + "px"; strip.appendChild(homeD);
    // 인터랙션 포인트
    this.activePoints().forEach(p => {
      const icon = p.kind === "shop" ? "🛒" : p.kind === "npc" ? "💬" : "❔";
      const m = el("div", "point-marker", `${icon}<span>${p.id.startsWith("p_news") ? (S.lang === "ko" ? "전광판" : "Board") : ""}</span>`);
      m.style.left = (SPOT_X[p.spot] || 400) + "px";
      m.dataset.point = p.id;
      strip.appendChild(m);
    });
    // 루나
    const luna = el("div", "luna-fig", `<div class="luna-body"></div><span>LUNA</span>`);
    luna.id = "luna-fig";
    luna.style.left = this.lunaX + "px";
    strip.appendChild(luna);
  },

  loop() { // setInterval — 백그라운드 탭에서도 동작 (RAF는 hidden에서 정지)
    const step = () => {
      const spd = 4.4;
      if (this.keys.left) this.lunaX = Math.max(30, this.lunaX - spd);
      if (this.keys.right) this.lunaX = Math.min(STRIP_W - 40, this.lunaX + spd);
      const luna = $("#luna-fig");
      if (luna) {
        luna.style.left = this.lunaX + "px";
        luna.classList.toggle("walking", !!(this.keys.left || this.keys.right));
        luna.classList.toggle("flip", !!this.keys.left);
      }
      // 카메라
      const view = $("#commute-view");
      const target = Math.max(0, Math.min(STRIP_W - view.clientWidth, this.lunaX - view.clientWidth / 2));
      $("#commute-strip").style.transform = `translateX(${-target}px)`;
      // 근처 포인트 / 목적지
      const near = this.activePoints().find(p => Math.abs((SPOT_X[p.spot] || 0) - this.lunaX) < 60);
      const nearGoal = Math.abs(SPOT_X[this.goal] - this.lunaX) < 70;
      const act = $("#btn-interact");
      if (near) {
        act.style.display = "block";
        act.textContent = near.kind === "shop" ? "🛒 " + (S.lang === "ko" ? "노점 보기" : "Shop") : "🔍 " + (S.lang === "ko" ? "조사하기" : "Look");
        act.dataset.point = near.id;
      } else if (nearGoal) {
        act.style.display = "block";
        act.textContent = this.goal === "bar_door" ? "🍸 " + (S.lang === "ko" ? "바에 들어가기" : "Enter the bar") : "🏠 " + (S.lang === "ko" ? "집에 들어가기" : "Go inside");
        act.dataset.point = "";
      } else act.style.display = "none";
    };
    this.rafHandle = setInterval(step, 28);
  },

  async interact(pointId) {
    if (!pointId) { this.finish(); return; }
    const p = DATA.schedule.points.find(x => x.id === pointId);
    if (!p) return;
    if (p.scene_or_shop.startsWith("shop:")) { openShop(); return; }
    if (!p.repeatable) S.usedPoints.add(S.day + ":" + p.id);
    this.renderStrip();
    await Dlg.runScene(p.scene_or_shop);
    this.renderStrip();
  },

  moveToSpot(spotId) { // move 스텝
    return new Promise(resolve => {
      const target = SPOT_X[spotId] || this.lunaX;
      const t = setInterval(() => {
        const d = target - this.lunaX;
        const luna = $("#luna-fig");
        if (Math.abs(d) < 6) { clearInterval(t); if (luna) luna.classList.remove("walking"); resolve(); return; }
        this.lunaX += Math.sign(d) * 5;
        if (luna) { luna.style.left = this.lunaX + "px"; luna.classList.add("walking"); luna.classList.toggle("flip", d < 0); }
      }, 28);
    });
  },
};

// ---------- 상점 ----------
function openShop() {
  const ov = $("#ov-shop");
  const list = $("#shop-list");
  list.innerHTML = "";
  unlockedIngredients().filter(i => i.shop_price).forEach(ing => {
    const row = el("div", "shop-row");
    row.innerHTML = `<span>${T(ing.name)}</span><span>${ing.shop_price}G</span>`;
    const btn = el("button", "btn small", S.lang === "ko" ? "구매" : "Buy");
    btn.addEventListener("click", () => {
      if (S.gold < ing.shop_price) { toast(S.lang === "ko" ? "골드 부족" : "Not enough gold"); return; }
      S.gold -= ing.shop_price;
      S.inventory[ing.id] = (S.inventory[ing.id] || 0) + 1;
      toast(`🛒 ${T(ing.name)} +1`);
      updateHUD();
    });
    row.appendChild(btn);
    list.appendChild(row);
  });
  ov.classList.add("show");
}

// ---------- 입고 (stock_in — 그날 바 오픈 직전, 결정 H) ----------
async function stockIn() {
  if (S.day === 1) return; // 초기 재고
  // 신규 입고 = 오늘 일차 해금 + 퀘스트/이벤트 해금(unlock_when, 아직 입고 연출 안 본 것)
  // 입고 대상 = 소모품(재료·가니시)만. 잔·도구는 상시 비치라 입고 연출에 안 나온다 (v1.9)
  const newIngs = DATA.master.shelf_items.filter(i =>
    (i.kind === "ingredient" || i.kind === "garnish") &&
    (i.unlock_day === S.day ||
     (i.unlock_when && evalWhen(i.unlock_when) && !S.flags.has("stocked_" + i.id))));
  newIngs.forEach(i => { if (i.unlock_when) S.flags.add("stocked_" + i.id); });
  if (!newIngs.length) return;
  const newCks = DATA.master.cocktails.filter(c => c.unlock_day === S.day);
  $("#stock-body").innerHTML = `
    <h2>📦 ${UI("ui_stock_in")}</h2>
    <div class="stock-chips">${newIngs.map(i =>
      `<div class="stock-chip"><div class="ing-bottle big" style="background:linear-gradient(180deg,transparent 25%,rgba(${i.color || "150,150,150"},.8) 25%)"></div><b>${T(i.name)}</b><small>${T(i.desc)}</small></div>`).join("")}</div>
    ${newCks.length ? `<p class="stock-new">🍸 ${S.lang === "ko" ? "새로 만들 수 있는 칵테일" : "Newly available"}: <b>${newCks.map(c => T(c.name)).join(", ")}</b></p>` : ""}`;
  await overlayConfirm("#ov-stock");
}

// ---------- 정산 (2부 마감 후, 바에서 나가기 직전 — 결정 C) ----------
async function settlement() {
  $("#settle-body").innerHTML = `
    <h2>🧾 ${UI("ui_settlement")} — DAY ${S.day}</h2>
    <div class="settle-rows">
      <div class="srow"><span>${UI("ui_sales")}</span><b>${S.today.sales}G</b></div>
      <div class="srow"><span>${UI("ui_tips")}</span><b>+${S.today.tips}G</b></div>
      <div class="srow"><span>${S.lang === "ko" ? "정상 서빙" : "Served"}</span><b>${S.today.served}${S.lang === "ko" ? "명" : ""}</b></div>
      <div class="srow ${S.today.angry ? "bad" : ""}"><span>${S.lang === "ko" ? "화나서 이탈" : "Angry left"}</span><b>${S.today.angry}${S.lang === "ko" ? "명" : ""}</b></div>
      <div class="srow"><span>${UI("ui_reputation")}</span><b>${S.today.repDelta >= 0 ? "+" : ""}${S.today.repDelta}</b></div>
      <div class="srow total"><span>${S.lang === "ko" ? "보유 골드" : "Gold"}</span><b>${S.gold}G</b></div>
    </div>`;
  await overlayConfirm("#ov-settle");
}

function overlayConfirm(sel) {
  return new Promise(resolve => {
    const ov = $(sel);
    ov.classList.add("show");
    const btn = ov.querySelector(".ov-confirm");
    const h = () => { ov.classList.remove("show"); btn.removeEventListener("click", h); resolve(); };
    btn.addEventListener("click", h);
  });
}

// ---------- 집 / 꿈 ----------
async function homePhase() {
  showScreen("screen-home");
  $("#screen-home").classList.remove("terrace");
  const homeScenes = scenesFor(S.day, "home", "auto");
  $("#home-hint").textContent = homeScenes.length
    ? (S.lang === "ko" ? "…크리스가 아직 안 들어왔다." : "...Chris isn't back yet.")
    : (S.lang === "ko" ? "조용한 밤이다." : "A quiet night.");
  await new Promise(resolve => {
    const b = $("#btn-end-day");
    b.textContent = "🛏 " + UI("ui_end_day");
    const h = () => { b.removeEventListener("click", h); resolve(); };
    b.addEventListener("click", h);
  });
  // 결정 B — 하루 마치기 선택 시 home 씬이 있으면 강제 실행
  for (const sc of homeScenes) await Dlg.runScene(sc);
  Dlg.castClear();
  // 수면 → 꿈
  const dreams = scenesFor(S.day, "dream", "auto");
  if (dreams.length) {
    showScreen("screen-dream");
    $("#screen-dream").classList.remove("glitch");
    await sleep(700);
    for (const sc of dreams) await Dlg.runScene(sc);
    $("#screen-dream").classList.remove("glitch");
  }
}

// ---------- 하루 실행 ----------
async function runDay() {
  const meta = dayMeta(S.day);
  if (!meta) return endOfPrototype();
  S.today = { sales: 0, tips: 0, served: 0, angry: 0, repDelta: 0 };
  updateHUD();
  await phaseBanner(`DAY ${S.day}`, T(meta.label));

  const startPhase = meta.start_phase || "commute_in";
  if (startPhase !== "bar") {
    // 1. 출근길
    await phaseBanner(S.lang === "ko" ? "🌃 출근길" : "🌃 Commute", CFG.commute_in_time);
    await Commute.run("commute_in");
    // 2. 입고
    await stockIn();
  }
  // 3~4. 바 (1부 → 2부)
  showScreen("screen-bar");
  BarCam.apply(SLOT_X[1], 0.92, true); // 카메라 초기 위치 (가운데 슬롯)
  Dlg.castClear();
  const hasSlots = !window.DEV_SKIPPART1 && DATA.schedule.guest_slots.some(g => g.day === S.day);
  if (hasSlots) {
    // 개점 전 — 크리스와 짧은 대화 → OPEN 간판을 걸어야 손님이 들어온다 (v1.9)
    await Dlg.runPhaseScenes(S.day, "bar_open");
    Dlg.castClear();
    await openSign();
    await phaseBanner(S.lang === "ko" ? "🍸 1부 — 일반 영업" : "🍸 Part 1 — Open Bar", S.lang === "ko" ? "◀▶로 슬롯 이동 · 코스터를 드래그해 주문" : "◀▶ to switch slots · drag coasters to take orders");
    await Bar.runPart1(S.day);
    await phaseBanner(S.lang === "ko" ? "🌙 새벽 1시" : "🌙 1 A.M.", S.lang === "ko" ? "2부 — 단골의 시간" : "Part 2 — Regulars");
  }
  Bar.setMode("story"); // 2부: 최대 2명, 손님 수에 맞춰 카메라 자동 프레이밍
  await Dlg.runPhaseScenes(S.day, "bar");
  Dlg.castClear();
  // 5. 정산
  await settlement();
  // 6. 퇴근길
  await phaseBanner(S.lang === "ko" ? "🌌 퇴근길" : "🌌 Heading home", CFG.commute_out_time);
  await Commute.run("commute_out");
  // 7~8. 집 → 꿈
  await homePhase();
  // 다음날 (저장은 day 증가 후 — 이어하기 시 다음날부터)
  S.day++;
  saveGame();
  if (S.day > 3) return endOfPrototype();
  runDay();
}

function endOfPrototype() {
  showScreen("screen-end");
  $("#end-body").innerHTML = `
    <h2>🌅 ${S.lang === "ko" ? "프로토타입 범위 끝 (Day 1~3)" : "End of prototype (Day 1–3)"}</h2>
    <div class="settle-rows">
      <div class="srow"><span>${S.lang === "ko" ? "보유 골드" : "Gold"}</span><b>${S.gold}G</b></div>
      <div class="srow"><span>${UI("ui_reputation")}</span><b>${S.rep}</b></div>
      <div class="srow"><span>${S.lang === "ko" ? "누적 서빙" : "Total served"}</span><b>${S.stats.servedTotal}</b></div>
      ${Object.entries(S.affinity).map(([k, v]) => `<div class="srow"><span>💛 ${T(charOf(k)?.name) || k}</span><b>${v}</b></div>`).join("")}
    </div>
    <p class="end-note">${S.lang === "ko" ? "day4(삼호의 밤)부터는 본편에서 —" : "Day 4 (Samho's night) continues in the full game —"}</p>`;
}

// ---------- 부팅 ----------
function boot() {
  updateHUD();
  $("#hud-lang").addEventListener("click", () => { S.lang = S.lang === "ko" ? "en" : "ko"; updateHUD(); toast(S.lang.toUpperCase()); });
  $("#btn-close-early").addEventListener("click", () => Bar.closeEarly());
  $("#btn-interact").addEventListener("click", () => Commute.interact($("#btn-interact").dataset.point));
  $("#shop-close").addEventListener("click", () => $("#ov-shop").classList.remove("show"));
  // 키 입력 — 출퇴근: 이동 / 바 1부: 슬롯 전환
  window.addEventListener("keydown", e => {
    const inBar = $("#screen-bar").classList.contains("active");
    if (inBar && Bar.active && Bar.mode === "part1" && !$("#ov-craft").classList.contains("show") && !Dlg.running) {
      if (e.code === "ArrowLeft") { Bar.focusSlot(Bar.focus - 1); return; }
      if (e.code === "ArrowRight") { Bar.focusSlot(Bar.focus + 1); return; }
    }
    if (e.code === "ArrowLeft") Commute.keys.left = true;
    if (e.code === "ArrowRight") Commute.keys.right = true;
    if (e.code === "KeyE" && $("#btn-interact").style.display === "block") Commute.interact($("#btn-interact").dataset.point);
  });
  window.addEventListener("keyup", e => {
    if (e.code === "ArrowLeft") Commute.keys.left = false;
    if (e.code === "ArrowRight") Commute.keys.right = false;
  });
  // 모바일 이동 버튼
  const bindHold = (sel, key) => {
    const b = $(sel);
    b.addEventListener("pointerdown", () => Commute.keys[key] = true);
    window.addEventListener("pointerup", () => Commute.keys[key] = false);
  };
  bindHold("#btn-left", "left"); bindHold("#btn-right", "right");
  // 타이틀
  $("#btn-new-game").addEventListener("click", () => { clearSave(); showScreen("screen-bar"); runDay(); });
  const contBtn = $("#btn-continue");
  if (hasSave()) {
    contBtn.style.display = "inline-block";
    contBtn.addEventListener("click", () => { loadGame(); updateHUD(); runDay(); });
  }
  // 스테이지 스케일 (1280×720)
  const fit = () => {
    const st = $("#stage");
    const sc = Math.min(1, (window.innerWidth - 8) / 1280, (window.innerHeight - 8) / 720);
    st.style.transform = `scale(${sc})`;
  };
  window.addEventListener("resize", fit); fit();

  // 개발용: ?day=N 해당 일차 바로 시작 / &skipwalk 출퇴근 걷기 생략
  //         &skippart1 1부 생략 / &autocraft 스토리 씬 제조 미니게임 생략(good 판정 합성)
  const params = new URLSearchParams(location.search);
  window.DEV_SKIPWALK = params.has("skipwalk");
  window.DEV_SKIPPART1 = params.has("skippart1");
  window.DEV_AUTOCRAFT = params.has("autocraft");
  const devDay = parseInt(params.get("day"), 10);
  if (devDay >= 1 && devDay <= 3) {
    clearSave(); S.day = devDay; showScreen("screen-bar"); runDay();
  }
}
document.addEventListener("DOMContentLoaded", boot);
