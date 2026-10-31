(function (root) {
  'use strict';

  const POUR = typeof module === 'undefined' ? root.LunaPour : require('../features/crafting/pour-fluid.js');
  const GRADES = ['sewage', 'poor', 'decent', 'good', 'excellent'];
  // Web-only typing baseline; keep source timings, read holds, patience and animation clocks unchanged.
  const TEXT_SPEED_BASE = 3;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const n = (v, d = 0) => v == null || v === '' ? d : Number(v);
  const sortSeq = a => [...a].sort((a, b) => n(a.seq) - n(b.seq));
  const clean = s => String(s ?? '').replace(/<[^>]*>/g, '');
  // Engine input/animation contract, inspected against Play.unity's NEW prefabs.
  // The web board normalizes the 960x540 (PPU100 / ortho2.7) craft view; see README.
  const { OPEN, MIX } = (typeof module === 'undefined' ? root.LunaRuleParts.mechanics : require('../features/crafting/gimmick-mechanics.js'))({ clamp, root });
  const { seeded, weighted, condition, applyEffects } = (typeof module === 'undefined' ? root.LunaRuleParts.conditions : require('./story-conditions.js'))({ GRADES, n, root });
  const { band, millilitreData, buildQueue, scoreCraft } = (typeof module === 'undefined' ? root.LunaRuleParts.craft : require('../features/crafting/craft-rules.js'))({ clamp, n });
  class Game {
    constructor(data, options = {}) {
      this.data = data;
      this.t = data.tables;
      this.cfg = Object.fromEntries(this.t.balance_config.map(r => [r.setting, r.value]));
      this.cfg.stir_circle_limit_sec = 1.5; /* Web playtest tuning; source CSV unchanged. */
      this.onChange = () => {};
      this.lang = 'ko';
      this.speed = 1;
      this.dialogSpeed = 1;
      this.read = new Set();
      this.reset(options.day ?? 0, options.mode ?? 'full', options.seed ?? 1, false);
    }
    c(key, fallback = 0) {
      return n(this.cfg[key], fallback);
    }
    text(row, key = 'text') {
      return row?.[key + '.' + this.lang] || row?.[key + '.ko'] || '';
    }
    cocktail(id) {
      const c = this.t.cocktails.find(c => c.id === id);
      if (!c) throw Error('칵테일 없음: ' + id);
      return c;
    }
    name(id) {
      const r = this.t.characters.find(x => x.id === id) || this.t.cocktails.find(x => x.id === id) || this.t.shelf_items.find(x => x.id === id) || this.t.personalities.find(x => x.id === id);
      return this.text(r, 'name') || id || '';
    }
    reset(day = 0, mode = 'full', seed = 1, run = true, settings = {}) {
      const upkeepOverride = this.parseUpkeepOverride(settings.upkeepOverride);
      this.serviceVersion = 'A';
      this.qaKeepGeneral = false;
      this.day = Number(day);
      this.mode = mode;
      this.seed = Number(seed);
      this.rng = seeded(this.seed);
      // Seat arrivals vary between plays, independently of reproducible order/art RNG.
      this.seatRng = settings.seatRng || Math.random;
      this.progress = {
        day: this.day,
        money: this.c('gold_start', 300),
        reputation: 0,
        phase: 'bar_open',
        flags: {},
        affinity: {}
      };
      this.openingBalance = this.progress.money;
      this.upkeepOverride = upkeepOverride;
      this.dailySettlement = null;
      this.tableFades = {};
      this.pourTool = 'pourer';
      this.tutorial = null;
      this.storyCoaster = null;
      this.pendingDailyUnlocks = false;
      this.lastStoryLine = null;
      this.craftReminder = null;
      this.phase = 'ready';
      this.screen = 'bar';
      this.overlay = null;
      this.paused = false;
      this.hidden = false;
      this.cameraLeft = 0;
      this.cameraMoving = false;
      this.focus = 'L';
      this.overview = false;
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.logs = [];
      this.history = [];
      this.transactions = [];
      this.transactionIds = new Set();
      this.serial = 0;
      this.barTime = 0;
      this.realTime = 0;
      this.served = 0;
      this.lost = 0;
      this.prep = null;
      this.drink = null;
      this.gimmick = null;
      this.result = null;
      this.discardFeedback = null;
      this.error = null;
      this.dialogue = null;
      this.choice = null;
      this.transition = 0;
      this.pendingTransition = null;
      this.story = null;
      this.currentOrder = null;
      this.resultContext = {};
      this.effectVisual = null;
      this.barkLast = {};
      this.finished = false;
      if (settings.storyPrerequisites) this.seedJohnnyPrerequisites();
      if (run) {
        if (mode === 'general') this.startGeneral();else if (mode === 'regular') this.startStoryPhase('bar');else if (mode === 'practice') {
          this.phase = 'practice';
          this.openRecipes();
        } else {
          const fresh = this.dailyUnlocks();
          if (mode === 'full' && this.day > 0 && this.day !== 99 && (fresh.ingredients.length || fresh.cocktails.length)) {
            this.pendingDailyUnlocks = true;
            this.phase = 'arrival';
            this.overlay = 'dailyUnlocks';
          } else this.startStoryPhase('bar_open');
        }
      }
      this.changed();
    }
    log(event, details = {}) {
      this.logs.push({
        time: Math.round(this.realTime * 100) / 100,
        barTime: Math.round(this.barTime * 100) / 100,
        event,
        ...details
      });
      if (this.logs.length > 5000) this.logs.shift();
    }
    changed() {
      this.onChange(this);
    }
    clearDepartedSeat(seat) {
      const guest = this.seats[seat];
      if (guest && (guest.coaster || guest.glass)) this.tableFades[seat] = {
        coaster: guest.coaster,
        glass: guest.glass,
        glassEmpty: guest.glassEmpty,
        glassKind: guest.glassKind,
        baseline: this.phase === 'general' ? 548 : 560,
        elapsed: 0,
        duration: .8
      };
      this.seats[seat] = null;
      return this.tableFades[seat]?.duration || 0;
    }
    ctx(extra = {}) {
      return {
        ...this.progress,
        ...this.resultContext,
        ...extra
      };
    }
    safe(fn) {
      try {
        return fn();
      } catch (e) {
        this.error = e.message;
        this.log('DATA_ERROR', {
          message: e.message
        });
        this.changed();
        return false;
      }
    }
    isPaused() {
      return this.paused || this.hidden || !!this.error || !!this.overlay;
    }
    available(c) {
      return this.day === 99 || n(c.unlock_day) <= this.day && condition(c.unlock_when, this.ctx());
    }
    cocktailsAvailable() {
      return this.t.cocktails.filter(c => c.status === 'confirmed' && (this.available(c) || c.id !== 'johnny_old_fashioned' && this.currentOrder?.cocktail === c.id));
    }
    itemsAvailable() {
      const needed = this.currentOrder ? this.t.recipes.filter(r => r.context === this.currentOrder.cocktail).map(r => r.ingredient) : [];
      return this.t.shelf_items.filter(r => this.available(r) || !['wild_dog', 'bitters', 'sugar_cube'].includes(r.id) && needed.includes(r.id));
    }
    debugFill() {
      if (this.screen !== 'prep') return;
      const c = this.cocktail(this.prep.selected);
      this.prep.glass = c.glass;
      this.prep.tool = c.mix === 'shake' ? 'shaker' : c.mix === 'stir' ? 'mixing_glass' : null;
      this.prep.ingredients = this.t.recipes.filter(r => r.context === c.id && !r.auto_apply).map(r => r.ingredient);
      this.prep.opener = this.prep.ingredients.includes('beer');
      this.log('debug_recipe_fill');
      this.changed();
    }
    debugCraft(grade = 'excellent') {
      if (!['prep', 'gimmick'].includes(this.screen)) return;
      this.debugFill();
      if (this.screen === 'prep') this.startCraft();
      const actual = this.craft.actual,
        selected = this.cocktail(actual.selected),
        queue = this.craft.queue;
      const results = queue.map(q => ({
        ...q,
        value: q.target,
        completion: 1,
        completed: true,
        failures: 0
      }));
      this.result = scoreCraft(this.data, selected, actual, results, 2);
      this.result.id = this.craft.id;
      this.result.grade = grade;
      this.result.score = {
        excellent: 100,
        good: 85,
        decent: 70,
        poor: 45,
        sewage: 0
      }[grade];
      this.result.debug = true;
      this.gimmick = null;
      this.screen = 'result';
      this.log('debug_craft', {
        grade
      });
      this.changed();
    }
    tick(dt, {
      holdSpeech = false
    } = {}) {
      if (this.isPaused() || this.finished) return;
      dt = Math.max(0, Math.min(dt, 0.2));
      this.realTime += dt;
      for (const [seat, fade] of Object.entries(this.tableFades)) {
        fade.elapsed += dt;
        if (fade.elapsed >= fade.duration) delete this.tableFades[seat];
      }
      if (this.transition > 0) {
        this.transition = Math.max(0, this.transition - dt);
        if (!this.transition) {
          const fn = this.pendingTransition;
          this.pendingTransition = null;
          this.safe(fn);
        }
        return;
      }
      if (this.cameraLeft > 0) {
        this.cameraLeft = Math.max(0, this.cameraLeft - dt);
        if (!this.cameraLeft) {
          if (!this.cameraSame) this.afterCamera();
          this.cameraSame = false;
        }
      }
      this.updateSeatTutorial();
      if (this.screen === 'discarding') {
        if (this.realTime - this.discardFeedback.startedAt >= 1.3) {
          this.prep = {
            selected: this.discardFeedback.selected,
            glass: null,
            tool: null,
            ingredients: []
          };
          this.result = null;
          this.craft = null;
          this.screen = 'prep';
          this.changed();
        }
        return;
      }
      if (this.screen === 'gimmick') {
        this.tickGimmick(dt);
        return;
      }
      if (this.screen !== 'bar') return;
      if (this.phase === 'general') this.safe(() => this.tickGeneral(dt, holdSpeech));else if (!holdSpeech && this.dialogue && !this.cameraMoving && this.cameraLeft === 0) {
        this.typeLine(this.dialogue, dt);
      }
    }

    currentDialogue() {
      if (this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return null;
      if (this.phase === 'general') {
        const g = this.seats[this.focus];
        return !this.cameraLeft ? g?.lines?.[g.lineIndex] : null;
      }
      return this.dialogue;
    }

  }

  // Feature methods are installed once, before any instance is created.
  {
    const create = typeof module === 'undefined' ? root.LunaGameParts.story : require('../features/story/story-flow.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ TEXT_SPEED_BASE, applyEffects, clean, condition, n, root, sortSeq }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Game.prototype, descriptors);
  }
  {
    const create = typeof module === 'undefined' ? root.LunaGameParts.guests : require('../features/bar/guest-service.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ clamp, n, sortSeq, weighted }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Game.prototype, descriptors);
  }
  {
    const create = typeof module === 'undefined' ? root.LunaGameParts.preparation : require('../features/crafting/preparation-flow.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({}).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Game.prototype, descriptors);
  }
  {
    const create = typeof module === 'undefined' ? root.LunaGameParts.craft : require('../features/crafting/craft-flow.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ GRADES, MIX, OPEN, POUR, applyEffects, buildQueue, scoreCraft }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Game.prototype, descriptors);
  }
  {
    const create = typeof module === 'undefined' ? root.LunaGameParts.settlement : require('../features/bar/settlement.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ condition, n, root, sortSeq }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Game.prototype, descriptors);
  }
  const api = {
    Game,
    MIX,
    OPEN,
    POUR,
    GRADES,
    millilitreData,
    condition,
    applyEffects,
    scoreCraft,
    buildQueue,
    band,
    seeded,
    clean,
    n,
    clamp
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.LunaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
