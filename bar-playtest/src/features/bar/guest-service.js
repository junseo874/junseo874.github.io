/* General guests, seats, coasters, patience and camera focus. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ clamp, n, sortSeq, weighted }) {
    return class GameGuests {
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
        txt = this.lang === 'ko' ? '...' : '...';
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
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaGameParts ||= {}).guests = create;
})(typeof window === 'undefined' ? globalThis : window);
