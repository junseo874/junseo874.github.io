// ===== 메인 — 하루 페이즈 머신 + 출퇴근/집/꿈/입고/정산 =====
// 페이즈 순서(설계서 §1): commute_in → stock_in → bar(1부→2부) → settlement → commute_out → home → sleep
"use strict";

// ---------- 출퇴근 횡스크롤 (짧은 두 블록 — 26.07.17 피드백으로 축소) ----------
// v1.9.6: 거리 축소(PD — 출퇴근이 너무 김) + Shift 달리기
const SPOT_X = { home_door: 70, street_mid: 330, street_board: 500, street_stall: 690, alley_in: 850, alley_deep: 960, elevator: 1060, bar_door: 1150 };
const STRIP_W = 1230;

const Commute = {
  phase: null, lunaX: 70, goal: null, resolveFn: null, keys: {}, rafHandle: null,

  async run(phase) {
    this.phase = phase;
    showScreen("screen-commute");
    $("#screen-commute").classList.toggle("rain", S.day === 1);   // day1 = 비 오는 거리 (데모 연출, 행인 없음)
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
      !S.usedPoints.has(p.id) &&                       // once 소진은 영구 (v1.9.4)
      evalWhen(p.when, { phase: this.phase }) &&
      this.resolvePointScene(p) !== null);             // conditional에 맞는 씬이 없으면 마커도 숨김
  },

  // ---------- 포인트 → 씬 해석 (Points.selection 4모드 — 구엔진 NPC flow 대응, v1.9.4) ----------
  // scene_or_shop이 "group:이름"이면 그 그룹의 씬들(seq 순) 중에서 고른다:
  //   once/repeat     : 그룹이면 when 통과한 첫 씬, 단일이면 그 씬
  //   sequential      : 볼 때마다 다음 씬(1→2→3), 다 보면 마지막 씬 반복 (구엔진 revisit_repeat 패턴)
  //   conditional     : when 통과한 첫 씬 = first-match (구엔진 시바 flow 패턴 — 1회성은 씬 when에 !flag, 폴백은 when 공란)
  resolvePointScene(p, consume) {
    const t = p.scene_or_shop;
    if (t.startsWith("shop:")) return t;
    if (!t.startsWith("group:")) return t;
    const g = t.slice(6);
    const pool = [];   // 전 스크립트에서 group 일치 + when 통과 씬 수집
    Object.values(DATA.scripts).forEach(sc => (sc.scenes || []).forEach(s => {
      if (s.group === g && evalWhen(s.when)) pool.push(s);
    }));
    pool.sort((a, b) => a.seq - b.seq);
    if (!pool.length) return null;
    if (p.selection === "sequential") {
      const i = Math.min(S.groupProgress[g] || 0, pool.length - 1);
      if (consume) S.groupProgress[g] = Math.min((S.groupProgress[g] || 0) + 1, pool.length - 1);
      return pool[i].id;
    }
    return pool[0].id;   // conditional/once/repeat: first-match
  },

  renderStrip() {
    const strip = $("#commute-strip");
    strip.innerHTML = "";
    // 배경 건물 실루엣
    for (let i = 0; i < 8; i++) {
      const b = el("div", "bldg");
      b.style.left = (i * 158 + 10) + "px";
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
      const spd = this.keys.shift ? 8.6 : 4.4;   // Shift = 달리기 (v1.9.6)
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
    const target = this.resolvePointScene(p, true);   // consume=true → sequential 진행
    if (!target) return;
    if (target.startsWith("shop:")) { openShop(); return; }
    if (p.selection === "once") S.usedPoints.add(p.id);   // once만 소진 (영구)
    this.renderStrip();
    await Dlg.runScene(target);
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

// ---------- 집 내부 (v1.9.6 — PDF 배치도: 침실|문|TV|소파|창|테라스, 테라스는 우측 가려짐) ----------
const HOME_X = { bed: 190, door: 470, tv: 700, photo: 880, sofa: 1060, note: 1180, window: 1330, terrace: 1580 };
const HOME_W = 1760;

const Home = {
  mode: null, lunaX: 0, keys: {}, handle: null, resolveFn: null,

  // mode: "morning"(소파 기상→쪽지→현관 출근) / "evening"(현관 귀가→소파 '하루 마치기')
  run(mode) {
    this.mode = mode;
    showScreen("screen-home");
    $("#home-label").textContent = mode === "morning"
      ? (S.lang === "ko" ? "🏠 집 — 아침" : "🏠 Home — Morning")
      : (S.lang === "ko" ? "🏠 집 — 밤" : "🏠 Home — Night");
    this.lunaX = mode === "morning" ? HOME_X.sofa : HOME_X.door + 60;
    this.render();
    return new Promise(resolve => { this.resolveFn = resolve; this.loop(); });
  },

  finish() { clearInterval(this.handle); this.keys = {}; const fn = this.resolveFn; this.resolveFn = null; if (fn) fn(); },

  render() {
    const strip = $("#home-strip");
    strip.innerHTML = "";
    const put = (cls, x, label, extraCls) => {
      const d = el("div", "hm-obj " + (extraCls || ""), `<div class="${cls}"></div>${label ? `<span>${label}</span>` : ""}`);
      d.style.left = x + "px"; strip.appendChild(d); return d;
    };
    put("hm-bed", HOME_X.bed - 95, S.lang === "ko" ? "크리스의 침대" : "CHRIS");
    const wall = el("div", "hm-wall"); wall.style.left = "380px"; strip.appendChild(wall);
    put("hm-door", HOME_X.door - 42, S.lang === "ko" ? "현관" : "DOOR");
    put("hm-tv", HOME_X.tv - 75, "TV").querySelector(".hm-tv") && null;
    // TV 구조가 중첩이라 직접 구성
    strip.lastChild.innerHTML = `<div class="hm-tv"><div class="tv-screen"></div><div class="tv-base"></div></div><span>TV</span>`;
    put("hm-photo", HOME_X.photo - 30, "");
    put("hm-sofa", HOME_X.sofa - 100, S.lang === "ko" ? "소파" : "SOFA");
    const tbl = put("hm-table", HOME_X.note - 37, "");
    if (this.mode === "morning" && S.day === 1 && !S.flags.has("d1_note_read"))
      tbl.firstChild.innerHTML = '<div class="hm-note">📄</div>';
    put("hm-window", HOME_X.window - 48, "");
    // 테라스 존
    const terr = el("div", "hm-terrace",
      `<div class="hm-rail"></div>
       <div class="hm-tstool" style="left:60px"></div>
       <div class="hm-ttable" style="left:130px"></div>
       <div class="hm-tstool" style="left:220px"></div>`);
    strip.appendChild(terr);
    // 루나
    const luna = el("div", "luna-fig", `<div class="luna-body"></div><span>LUNA</span>`);
    luna.id = "home-luna"; luna.style.left = this.lunaX + "px";
    luna.style.bottom = "104px"; luna.style.position = "absolute";
    strip.appendChild(luna);
  },

  // 근처 상호작용 대상 계산 — 모드별로 다르다
  nearTarget() {
    const near = (x, r) => Math.abs(x - this.lunaX) < (r || 70);
    if (this.mode === "morning") {
      if (S.day === 1 && !S.flags.has("d1_note_read") && near(HOME_X.note)) return { key: "note", label: S.lang === "ko" ? "📄 쪽지 읽기" : "📄 Read note" };
      if (near(HOME_X.tv)) return { key: "tv", label: S.lang === "ko" ? "📺 TV 보기" : "📺 Watch TV" };
      if (near(HOME_X.door, 60)) return { key: "exit", label: S.lang === "ko" ? "🚪 출근하기" : "🚪 Head to work" };
    } else {
      if (near(HOME_X.tv)) return { key: "tv", label: S.lang === "ko" ? "📺 TV 보기" : "📺 Watch TV" };
      if (near(HOME_X.sofa, 90)) return { key: "sofa", label: "🛏 " + UI("ui_end_day") };
    }
    return null;
  },

  loop() {
    const step = () => {
      const spd = this.keys.shift ? 8.6 : 4.4;
      if (this.keys.left) this.lunaX = Math.max(60, this.lunaX - spd);
      if (this.keys.right) this.lunaX = Math.min(HOME_W - 60, this.lunaX + spd);
      const luna = $("#home-luna");
      if (luna) {
        luna.style.left = this.lunaX + "px";
        luna.classList.toggle("walking", !!(this.keys.left || this.keys.right));
        luna.classList.toggle("flip", !!this.keys.left);
      }
      const view = $("#home-view");
      const target = Math.max(0, Math.min(HOME_W - view.clientWidth, this.lunaX - view.clientWidth / 2));
      $("#home-strip").style.transform = `translateX(${-target}px)`;
      const near = this.nearTarget();
      const act = $("#btn-home-act");
      if (near && !Dlg.running) { act.style.display = "block"; act.textContent = near.label; act.dataset.key = near.key; }
      else act.style.display = "none";
    };
    this.handle = setInterval(step, 28);
  },

  async interact(key) {
    if (key === "note") { await Dlg.runScene("d1_note"); this.render(); return; }
    if (key === "tv") {
      // 홀로그램 TV — home_tv 그룹 conditional (첫 시청=실종 뉴스, 이후 토크쇼 반복)
      const sc = Commute.resolvePointScene({ scene_or_shop: "group:home_tv", selection: "conditional" });
      if (sc) await Dlg.runScene(sc);
      return;
    }
    if (key === "exit") {
      if (S.day === 1 && !S.flags.has("d1_note_read")) { toast(S.lang === "ko" ? "…테이블 위에 뭔가 있다." : "...There's something on the table."); return; }
      this.finish(); return;
    }
    if (key === "sofa") { this.finish(); return; }
  },

  // 소파→테라스 자동 이동 (테라스 대화 연출용)
  walkTo(x) {
    return new Promise(resolve => {
      const t = setInterval(() => {
        const d = x - this.lunaX;
        const luna = $("#home-luna");
        if (Math.abs(d) < 8) { clearInterval(t); if (luna) luna.classList.remove("walking"); resolve(); return; }
        this.lunaX += Math.sign(d) * 6;
        if (luna) { luna.style.left = this.lunaX + "px"; luna.classList.add("walking"); luna.classList.toggle("flip", d < 0); }
        const view = $("#home-view");
        const target = Math.max(0, Math.min(HOME_W - view.clientWidth, this.lunaX - view.clientWidth / 2));
        $("#home-strip").style.transform = `translateX(${-target}px)`;
      }, 24);
    });
  },

  // 씬만 재생하는 진입 (day3 구출 루트 — 크리스의 목격)
  async sceneOnly() {
    showScreen("screen-home");
    $("#home-label").textContent = S.lang === "ko" ? "🏠 집 — 밤" : "🏠 Home — Night";
    this.mode = "evening"; this.lunaX = HOME_X.sofa; this.render();
    await sleep(500);
    for (const sc of scenesFor(S.day, "home", "auto")) await Dlg.runScene(sc);
    Dlg.castClear();
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
// ---------- 인트로 (day1 최초 1회 — 검은 화면, 루나가 처음 눈뜨던 밤) ----------
async function introPhase() {
  showScreen("screen-dream");
  await sleep(600);
  for (const sc of scenesFor(1, "intro", "auto")) await Dlg.runScene(sc);
  S.flags.add("intro_seen");
  Dlg.hideDialog();
  await sleep(400);
}

// ---------- 집 저녁 — 소파 '하루 마치기' → 테라스 대화 → 꿈 ----------
async function homeEvening() {
  await Home.run("evening");                       // 소파에서 '하루 마치기' 클릭 시 진행
  const homeScenes = scenesFor(S.day, "home", "auto");
  if (homeScenes.length) {
    await Home.walkTo(HOME_X.terrace);             // 테라스로 이동 (결정 B — 강제 이벤트)
    $("#screen-home").classList.add("terrace");
    for (const sc of homeScenes) await Dlg.runScene(sc);
    Dlg.castClear();
    $("#screen-home").classList.remove("terrace");
  }
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

  // 0. 인트로 (day1 최초 1회 — 검은 화면 대화)
  if (S.day === 1 && !S.flags.has("intro_seen")) await introPhase();
  // 1. 집 아침 — 소파 기상 → (day1 쪽지) → 현관으로 출근
  await Home.run("morning");
  // 2. 출근길 (day1 = 비 오는 거리, 행인 없음)
  await phaseBanner(S.lang === "ko" ? "🌃 출근길" : "🌃 Commute", CFG.commute_in_time);
  await Commute.run("commute_in");
  // 3. 입고 (day1은 초기 재고라 스킵됨)
  await stockIn();
  // 4~5. 바 (개점 → 1부 → 2부)
  showScreen("screen-bar");
  BarCam.apply(SLOT_X[1], 0.92, true);
  Dlg.castClear();
  const hasSlots = !window.DEV_SKIPPART1 && DATA.schedule.guest_slots.some(g => g.day === S.day);
  if (hasSlots) {
    await Dlg.runPhaseScenes(S.day, "bar_open");
    Dlg.castClear();
    await openSign();
    await phaseBanner(S.lang === "ko" ? "🍸 1부 — 일반 영업" : "🍸 Part 1 — Open Bar", S.lang === "ko" ? "◀▶로 슬롯 이동 · 코스터를 드래그해 주문" : "◀▶ to switch slots · drag coasters to take orders");
    await Bar.runPart1(S.day);
    await phaseBanner(S.lang === "ko" ? "🌙 새벽 1시" : "🌙 1 A.M.", S.lang === "ko" ? "2부 — 단골의 시간" : "Part 2 — Regulars");
  }
  Bar.setMode("story");
  await Dlg.runPhaseScenes(S.day, "bar");
  Dlg.castClear();
  // 6. 정산
  await settlement();
  // 7. 퇴근길 (day1 엘리베이터·day3 분기 씬은 auto로 재생)
  await phaseBanner(S.lang === "ko" ? "🌌 퇴근길" : "🌌 Heading home", CFG.commute_out_time);
  await Commute.run("commute_out");
  // 7.5 day3 데모 분기 엔딩 (PD 확정 흐름)
  if (S.day === 3 && S.flags.has("samho_death_route")) return endOfPrototype("death");
  if (S.day === 3 && S.flags.has("samho_refused_drink")) {
    await Home.sceneOnly();          // 집 — 크리스의 목격
    return endOfPrototype("rescue");
  }
  // 8~9. 집 저녁(소파 → 테라스) → 꿈
  await homeEvening();
  S.day++;
  saveGame();
  if (S.day > 3) return endOfPrototype();
  runDay();
}

function endOfPrototype(variant) {
  showScreen("screen-end");
  const headline = variant === "death"
    ? (S.lang === "ko" ? "🥀 삼호는 돌아오지 못했다" : "🥀 Samho never came back")
    : variant === "rescue"
      ? (S.lang === "ko" ? "🌅 삼호는 살아남았다" : "🌅 Samho survived")
      : (S.lang === "ko" ? "🌅 프로토타입 범위 끝 (Day 1~3)" : "🌅 End of prototype (Day 1–3)");
  const sub = variant
    ? (S.lang === "ko" ? "당신이 따라준 잔이, 이야기를 갈랐다.<br>데모는 여기까지 — 이야기는 계속됩니다." : "The glass you poured split the story.<br>The demo ends here — the story continues.")
    : "";
  $("#end-body").innerHTML = `
    <h2>${headline}</h2>
    ${sub ? `<p class="end-note">${sub}</p>` : ""}
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
  // 단골 수첩·대화 기록 버튼 (v1.9.5)
  const hudEl = $("#hud");
  const bDsr = el("button", "btn tiny", "📒"); bDsr.title = "단골 수첩";
  const bBlg = el("button", "btn tiny", "💬"); bBlg.title = "대화 기록";
  bDsr.addEventListener("click", openDossier);
  bBlg.addEventListener("click", openBacklog);
  hudEl.insertBefore(bBlg, $("#hud-lang")); hudEl.insertBefore(bDsr, bBlg);
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
    const inHome = $("#screen-home").classList.contains("active");
    const K = inHome ? Home.keys : Commute.keys;   // 집/거리 공용 이동 키 (v1.9.6)
    if (e.code === "ArrowLeft") K.left = true;
    if (e.code === "ArrowRight") K.right = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") K.shift = true;   // 달리기
    if (e.code === "KeyE") {
      if (inHome && $("#btn-home-act").style.display === "block") Home.interact($("#btn-home-act").dataset.key);
      else if ($("#btn-interact").style.display === "block") Commute.interact($("#btn-interact").dataset.point);
    }
  });
  window.addEventListener("keyup", e => {
    for (const K of [Commute.keys, Home.keys]) {
      if (e.code === "ArrowLeft") K.left = false;
      if (e.code === "ArrowRight") K.right = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") K.shift = false;
    }
  });
  // 모바일 이동 버튼
  const bindHold = (sel, key) => {
    const b = $(sel);
    b.addEventListener("pointerdown", () => Commute.keys[key] = true);
    window.addEventListener("pointerup", () => Commute.keys[key] = false);
  };
  bindHold("#btn-left", "left"); bindHold("#btn-right", "right");
  const bindHomeHold = (sel, key) => {
    const el2 = $(sel);
    el2.addEventListener("pointerdown", () => Home.keys[key] = true);
    window.addEventListener("pointerup", () => Home.keys[key] = false);
  };
  bindHomeHold("#home-left", "left"); bindHomeHold("#home-right", "right");
  $("#btn-home-act").addEventListener("click", () => Home.interact($("#btn-home-act").dataset.key));
  // 타이틀
  $("#btn-new-game").addEventListener("click", () => { clearSave(); runDay(); });
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
