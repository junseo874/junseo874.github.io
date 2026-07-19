// ===== 대본 실행기 — 씬/스텝 단일 문법 (2부·출퇴근·집·꿈·카메오 전부 이걸로) =====
"use strict";
const Dlg = {
  cast: {},          // actorId -> element (바 좌석 스탠디)
  currentOrder: null, // { actor, cocktailId }
  running: false,

  // ---------- 씬 실행 ----------
  async runScene(sceneId, opts) {
    const sc = typeof sceneId === "string" ? sceneById(sceneId) : sceneId;
    if (!sc) return;
    this.running = true;
    for (const st of sc.steps) {
      if (st.when && !evalWhen(st.when)) continue;
      const jump = await this.runStep(st, sc, opts || {});
      if (st.effects) applyEffects(st.effects);
      if (jump) { this.running = false; return this.runScene(jump, opts); }
    }
    this.hideDialog();
    this.running = false;
  },

  async runPhaseScenes(day, phase, opts) {
    for (const sc of scenesFor(day, phase, "auto")) {
      await this.runScene(sc, opts);
    }
  },

  // ---------- 스텝 처리 ----------
  async runStep(st, sc, opts) {
    switch (st.type) {
      case "say": {
        const c = charOf(st.actor);
        await this.say(T(c ? c.name : { ko: st.actor }), c ? c.name_color : "#ccc", T(st.text), st.actor);
        return;
      }
      case "enter": {
        this.castAdd(st.actor, st.arg);
        await sleep(450);
        return;
      }
      case "exit": {
        this.castRemove(st.actor);
        await sleep(350);
        return;
      }
      case "order": {
        const id = (st.arg || "").split(":")[1];
        this.currentOrder = { actor: st.actor, cocktailId: id };
        const c = charOf(st.actor);
        await this.say(T(c.name), c.name_color, "🍸 " + T(st.text), st.actor);
        return;
      }
      case "craft": {
        let target = null, tutorial = false;
        if (st.arg === "order") target = this.currentOrder ? this.currentOrder.cocktailId : null;
        else if (st.arg && st.arg.startsWith("tutorial:")) { target = st.arg.slice(9); tutorial = true; }
        this.hideDialog();
        let res;
        if (window.DEV_AUTOCRAFT && target) { // 개발용: 미니게임 생략, good 판정 합성
          res = { cocktail: DATA.master.cocktails.find(c => c.id === target), grade: "good", pct: 0.8 };
          await sleep(300);
        } else {
          res = await Craft.open({ target, tutorial });
        }
        S.lastGrade = res.grade; S.lastPct = res.pct;
        this.lastCraft = res;
        return;
      }
      case "serve": {
        // 스토리 씬의 서빙 — 완성 잔을 클릭해 건넨다
        await this.storyServe(st.actor);
        return;
      }
      case "choice": {
        const goPick = await this.showChoices(st.arg);
        if (goPick && goPick.effects) applyEffects(goPick.effects);
        return goPick && goPick.goto ? goPick.goto : undefined;
      }
      case "effect": return; // effects는 공통 처리
      case "fx": {
        await this.playFx(st.arg);
        return;
      }
      case "sfx": { await sleep(250); return; }
      case "bgm": return;
      case "move": {
        if (window.Commute && $("#screen-commute").classList.contains("active")) {
          await Commute.moveToSpot((st.arg || "").replace("spot:", ""));
        }
        return;
      }
      case "wait": { await sleep((parseFloat(st.arg) || 0.5) * 1000); return; }
      case "camera": return;
      case "end_part": case "end_day": return;
      default: return;
    }
  },

  // ---------- 대화 UI ----------
  say(name, color, text, actorId) {
    logDialog(name, fmtRich(text), color);   // 대화 히스토리 (v1.9.5)
    return new Promise(resolve => {
      const box = $("#dialog");
      box.classList.add("show");
      box.querySelector(".dlg-name").textContent = name;
      box.querySelector(".dlg-name").style.color = color || "#eee";
      box.querySelector(".dlg-portrait").innerHTML = charChip(actorId || "luna", 52);
      box.querySelector(".dlg-text").innerHTML = fmtRich(text);
      const done = () => { box.removeEventListener("click", done); window.removeEventListener("keydown", onKey); resolve(); };
      const onKey = (e) => { if (e.code === "Space" || e.code === "Enter") done(); };
      box.addEventListener("click", done);
      window.addEventListener("keydown", onKey);
    });
  },
  hideDialog() { $("#dialog").classList.remove("show"); },

  showChoices(choiceId) {
    return new Promise(resolve => {
      const opts = choicesOf(choiceId).filter(o => evalWhen(o.when));
      const wrap = $("#choice-box");
      wrap.innerHTML = "";
      opts.forEach(o => {
        const b = el("button", "choice-btn", "");
        b.innerHTML = fmtRich(T(o.text));
        b.addEventListener("click", () => { wrap.classList.remove("show"); resolve(o); });
        wrap.appendChild(b);
      });
      wrap.classList.add("show");
    });
  },

  // ---------- 바 스탠디(2부 등장인물) — 등장/퇴장 시 카메라 자동 프레이밍 ----------
  // 좌석 규칙(v1.9): 2부 손님은 항상 '붙어' 앉는다. 둘째 손님이 대본상 반대편(L↔R)이라도
  // 기존 손님의 옆자리로 스냅 — 카메라가 딱 2좌석 창만 비추면 되도록(3좌석 와이드 배경 불필요).
  castAdd(actorId, seatArg) {
    const seatMap = { L: 0, M: 1, R: 2 };
    let idx = seatMap[seatArg] !== undefined ? seatMap[seatArg] : 1;
    const occupied = Object.entries(this.cast)
      .filter(([a]) => a !== actorId)               // 자기 자신의 재등장은 점유로 안 침
      .map(([, d]) => +(d.closest(".seat")?.dataset.seat)).filter(n => !isNaN(n));
    if (occupied.length) {
      const base = occupied[0];
      if (Math.abs(idx - base) !== 1) {           // 같은 칸이거나 한 칸 이상 떨어짐 → 옆자리로 스냅
        const prefer = seatArg === "L" ? base - 1 : seatArg === "R" ? base + 1 : (base === 0 ? 1 : base - 1);
        const cand = [prefer, base + 1, base - 1].filter(n => n >= 0 && n <= 2 && n !== base && !occupied.includes(n));
        idx = cand.length ? cand[0] : idx;
      }
    }
    const host = $(`.seat[data-seat="${idx}"] .seat-guest`) || $("#screen-bar");
    this.castRemove(actorId);
    const c = charOf(actorId);
    if (c && c.affinity) S.met.add(actorId);   // 단골 수첩 해금 (v1.9.5)
    const d = el("div", "standee");
    d.dataset.actor = actorId;
    d.innerHTML = `${charChip(actorId, 120)}<div class="standee-name" style="color:${c ? c.name_color : "#ccc"}">${T(c ? c.name : { ko: actorId })}</div>`;
    host.appendChild(d);
    this.cast[actorId] = d;
    if (typeof Bar !== "undefined" && Bar.mode === "story") Bar.storyFrame(); // 손님 수에 맞춰 자동 이동/줌
  },
  castRemove(actorId) {
    if (this.cast[actorId]) { this.cast[actorId].remove(); delete this.cast[actorId]; }
    if (typeof Bar !== "undefined" && Bar.mode === "story") Bar.storyFrame();
  },
  castClear() { Object.keys(this.cast).forEach(a => this.castRemove(a)); },

  // ---------- 스토리 서빙 ----------
  storyServe(actorId) {
    return new Promise(resolve => {
      const res = this.lastCraft;
      const chip = el("div", "story-serve-chip");
      chip.innerHTML = `${glassSVG(res && res.cocktail ? res.cocktail.glass : "cocktail", res && res.cocktail ? res.cocktail.color : null, 0.8)}<span>${UI("ui_serve")} ▶</span>`;
      $("#screen-bar").appendChild(chip);
      chip.addEventListener("click", () => {
        chip.remove();
        // 2부도 정가 매출 반영
        if (res && res.cocktail) { S.gold += res.cocktail.price; S.today.sales += res.cocktail.price; S.today.served++; updateHUD(); }
        if (res && res.cocktail) {
          questOnServe(res.cocktail.id, res.grade);            // serve:<칵테일> 퀘스트 목표
          applyTasteAffinity(actorId, res.cocktail, res.grade); // 취향 × 등급 → 호감
        }
        resolve();
      });
    });
  },

  // ---------- 연출 ----------
  async playFx(id) {
    if (id === "terrace_night") { $("#screen-home").classList.add("terrace"); return; }
    if (id === "glitch_in") { $("#screen-dream").classList.add("glitch"); await sleep(700); return; }
    if (id === "hard_cut") {
      const f = $("#flash"); f.classList.add("on"); await sleep(180); f.classList.remove("on"); await sleep(350); return;
    }
    if (id === "cat_on_head") {
      const cat = el("div", "fx-cat", "🐱");
      $("#screen-bar").appendChild(cat);
      await sleep(1100); cat.remove(); return;
    }
    await sleep(250);
  },
};
