/* Authored bar dialogue, choices, story orders and recipe unlocks. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ TEXT_SPEED_BASE, applyEffects, clean, condition, n, root, sortSeq }) {
    return class GameStory {
    // Possession is a story prerequisite, not a consumable bottle count per craft.
    seedJohnnyPrerequisites() {
      if (this.day < 3 || this.day === 99) return;
      this.progress.inventory = {
        ...this.progress.inventory,
        wild_dog: Math.max(1, Number(this.progress.inventory?.wild_dog) || 0),
        bitters: Math.max(1, Number(this.progress.inventory?.bitters) || 0)
      };
      this.progress.flags.campaign_observation = true;
    }
    johnnyMissing({
      memory = true,
      sugar = false
    } = {}) {
      const missing = ['wild_dog', 'bitters'].filter(id => !(Number(this.progress.inventory?.[id]) > 0));
      if (memory && !this.progress.flags.campaign_observation) missing.push('johnny_memory');
      if (sugar && !this.progress.flags.day3_sugar_received) missing.push('sugar_cube');
      return missing;
    }
    checkJohnnyUnlock() {
      if (this.day !== 3 || this.progress.flags.johnny_recipe_unlocked || this.johnnyMissing({
        sugar: true
      }).length) return false;
      this.progress.inventory ||= {};
      this.progress.inventory.sugar_cube = Math.max(1, Number(this.progress.inventory.sugar_cube) || 0);
      this.progress.flags.johnny_recipe_unlocked = true;
      this.overlay = 'johnnyUnlock';
      this.log('recipe_unlocked', {
        cocktail: 'johnny_old_fashioned',
        ingredients: ['wild_dog', 'bitters', 'sugar_cube']
      });
      this.changed();
      return true;
    }
    confirmJohnnyUnlock() {
      if (this.overlay !== 'johnnyUnlock') return false;
      this.overlay = null;
      this.pump();
      this.changed();
      return true;
    }
    dailyUnlocks() {
      return {
        ingredients: this.t.shelf_items.filter(r => r.kind === 'ingredient' && n(r.unlock_day) === this.day && !['wild_dog', 'bitters', 'sugar_cube'].includes(r.id) && this.available(r)),
        cocktails: this.t.cocktails.filter(r => r.status === 'confirmed' && n(r.unlock_day) === this.day && r.id !== 'johnny_old_fashioned' && this.available(r))
      };
    }
    confirmDailyUnlocks() {
      if (!this.pendingDailyUnlocks || this.overlay !== 'dailyUnlocks') return false;
      this.pendingDailyUnlocks = false;
      this.overlay = null;
      this.startStoryPhase('bar_open');
      this.changed();
      return true;
    }
    startStoryPhase(phase) {
      this.storyCoaster = null;
      this.phase = phase === 'bar_open' ? 'opening' : 'regular';
      this.progress.phase = phase;
      this.screen = 'bar';
      this.seats = {
        L: null,
        M: null,
        R: null
      };
      this.dialogue = null;
      this.choice = null;
      this.resultContext = {};
      this.currentOrder = null;
      this.story = {
        phase,
        autos: sortSeq(this.t.scenes.filter(s => n(s.day) === this.day && s.phase === phase && s.trigger === 'auto')),
        cursor: 0,
        scene: null,
        index: 0,
        steps: []
      };
      this.log('phase_start', {
        phase: this.phase
      });
      this.nextScene();
    }
    nextScene() {
      this.resultContext = {};
      this.dialogue = null;
      this.choice = null;
      while (this.story.cursor < this.story.autos.length) {
        const s = this.story.autos[this.story.cursor++];
        if (!condition(s.when, this.ctx())) continue;
        this.loadScene(s);
        return;
      }
      if (this.phase === 'opening') {
        this.story = null;
        this.startGeneral();
      } else {
        if (this.currentOrder) throw Error('미처리 주문 상태에서 대본 종료');
        this.finishDay();
      }
    }
    loadScene(scene) {
      this.storyCoaster = null;
      this.lastStoryLine = null;
      this.craftReminder = null;
      this.story.scene = scene;
      this.story.steps = sortSeq(this.t.steps.filter(s => s.context === scene.id));
      this.story.index = 0;
      this.resultContext = {};
      this.log('scene', {
        id: scene.id
      });
      this.pump();
    }
    stepDone(step) {
      applyEffects(step.effects, this.progress);
      this.story.index++;
      if (!this.checkJohnnyUnlock()) this.pump();
    }
    pump() {
      for (let guard = 0; guard < 1000; guard++) {
        if (!this.story || this.storyCoaster || this.error || this.tutorial || this.overlay === 'johnnyUnlock') return;
        const s = this.story.steps[this.story.index];
        if (!s) {
          this.nextScene();
          return;
        }
        if (!condition(s.when, this.ctx())) {
          this.log('step_skipped', {
            scene: this.story.scene.id,
            seq: s.seq,
            when: s.when
          });
          this.story.index++;
          continue;
        }
        this.log('step', {
          scene: this.story.scene.id,
          seq: s.seq,
          type: s.type
        });
        if (s.type === 'story_cue') {
          this.onStoryCue?.(s.arg);
          this.log('story_cue', {
            kind: s.arg
          });
          this.setTransition(s.arg === 'door' ? .9 : .35, () => this.stepDone(s));
          return;
        }
        if (this.campaignStep?.(s)) return;
        if (s.type === 'say' || s.type === 'order' && this.text(s)) {
          this.dialogue = this.makeLine(s.actor, this.text(s), s.dialogue_id, s.arg);
          this.dialogue.step = s;
          root.LunaStoryNotices?.dialogueStarted(this.progress, this.dialogue);
          if (this.storyCoasterEligible(s.actor)) {
            const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor && !this.seats[k].coaster);
            if (seat) this.storyCoaster = {
              seat,
              step: s,
              kind: 'line'
            };
          }
          return;
        }
        if (s.type === 'order') {
          if (this.waitForStoryCoaster(s, 'step')) return;
          this.createStoryOrder(s);
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'enter') {
          const first = this.story.index,
            group = [s];
          if (s.sync === 'no_wait') {
            const next = this.story.steps[first + 1];
            if (!next || next.type !== 'enter' || next.sync !== 'wait') throw Error('동시 입장 쌍 오류');
            group.push(next);
          }
          const reserved = new Set(Object.keys(this.seats).filter(k => this.seats[k]));
          for (const e of group) {
            if (!['L', 'R'].includes(e.arg) || reserved.has(e.arg)) throw Error('단골 좌석 충돌: ' + e.actor + ' / ' + e.arg);
            reserved.add(e.arg);
          }
          for (const e of group) {
            this.seats[e.arg] = {
              id: e.actor,
              actor: e.actor,
              seated: e.entrance === 'seated',
              state: 'STORY',
              coaster: false,
              glass: null,
              expression: 'default'
            };
            if (root.LunaStoryNotices?.roster.includes(e.actor)) root.LunaStoryNotices.meet(this.progress, e.actor);else this.progress.flags[e.actor + '_met'] = true;
            applyEffects(e.effects, this.progress);
          }
          this.focus = s.arg;
          this.story.index += group.length;
          if (group.every(e => e.entrance === 'seated')) continue;
          this.setTransition(0.8, () => this.pump());
          return;
        }
        if (s.type === 'exit') {
          const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
          if (!seat) throw Error('퇴장 대상 없음: ' + s.actor);
          this.seats[seat].state = 'EXITING';
          this.setTransition(0.5, () => {
            const fade = this.clearDepartedSeat(seat);
            if (fade) this.setTransition(fade, () => this.stepDone(s));else this.stepDone(s);
          });
          return;
        }
        if (s.type === 'tutorial') {
          if (this.day === 0 && this.variant !== 'gpt' && !this.progress.flags.day0_skip_tutorial) {
            this.progress.flags.day0_seats_revealed = true;
            this.tutorial = {
              kind: s.arg,
              step: s,
              origin: this.focus,
              visited: [],
              moved: false
            };
            this.log('tutorial_wait', {
              kind: s.arg
            });
            this.changed();
            return;
          }
          this.stepDone(s);
          return;
        }
        if (s.type === 'coaster') {
          if (!this.storyHasUpcomingOrder(s.actor)) {
            this.stepDone(s);
            return;
          }
          if (this.waitForStoryCoaster(s, 'step')) return;
          const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
          if (!seat) throw Error('코스터 대상 없음: ' + s.actor);
          if (this.seats[seat].coaster) {
            this.stepDone(s);
            return;
          }
          if (s.arg === 'tutorial' && this.day === 0 && !this.progress.flags.day0_skip_tutorial) {
            this.tutorial = {
              kind: 'coaster',
              seat,
              step: s
            };
            this.log('tutorial_wait', {
              kind: 'coaster',
              seat
            });
            return;
          }
          this.seats[seat].coaster = true;
          this.log('story_coaster', {
            actor: s.actor,
            seat
          });
          this.setTransition(.45, () => this.stepDone(s));
          return;
        }
        if (s.type === 'choice') {
          const rows = sortSeq(this.t.bar_choices.filter(c => c.context === s.arg));
          if (!rows.length) throw Error('선택지 세트 없음: ' + s.arg);
          this.choice = {
            step: s,
            rows
          };
          return;
        }
        if (s.type === 'craft') {
          if (!this.currentOrder) throw Error('제조 전 주문 없음');
          this.screen = 'bar';
          this.craftReminder = this.lastStoryLine ? {
            ...this.lastStoryLine,
            chars: this.lastStoryLine.text.length
          } : null;
          this.craftStep = s;
          if (s.arg === 'tutorial_beer' && this.day === 1) {
            this.tutorial = {
              kind: 'recipe',
              beer: true,
              serviceOpened: false
            };
            this.log('tutorial_wait', {
              kind: 'beer'
            });
          }
          if (s.arg === 'tutorial_recipe' && this.day === 0 && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_recipe_taught) {
            this.tutorial = {
              kind: 'recipe',
              serviceOpened: false
            };
            this.log('tutorial_wait', {
              kind: 'recipe'
            });
          }
          return;
        }
        if (s.type === 'serve') {
          throw Error('제조 결과/서빙 입력 없이 serve에 도착');
        }
        if (s.type === 'effect' || s.type === 'set_state') {
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'fx' || s.type === 'sfx') {
          const duration = s.arg === 'hard_cut' ? 0.2 : 0.7;
          this.effectVisual = {
            kind: s.type,
            id: s.arg,
            until: this.realTime + duration
          };
          this.log('effect_preview', {
            type: s.type,
            id: s.arg,
            dummy: true
          });
          if (s.sync === 'wait') {
            this.setTransition(duration, () => this.stepDone(s));
            return;
          }
          applyEffects(s.effects, this.progress);
          this.story.index++;
          continue;
        }
        if (s.type === 'end_part') {
          if (this.currentOrder) throw Error('end_part 앞 미처리 주문');
          this.finishDay();
          return;
        }
        throw Error('미지원 바 스텝: ' + s.type);
      }
      throw Error('대본 무한 진행 차단');
    }
    // Only guests ordering during this visit need a coaster. Do not look past
    // their departure/re-entry or an unresolved choice into a different visit.
    storyHasUpcomingOrder(actor, index = this.story?.index) {
      for (const s of this.story?.steps.slice(index) || []) {
        if (!['choice', 'end_part'].includes(s.type) && (s.actor !== actor || !['enter', 'exit', 'order'].includes(s.type))) continue;
        // A future result/branch is not known yet; defer the gate until it resolves.
        try {
          if (!condition(s.when, this.ctx())) continue;
        } catch {
          return false;
        }
        if (s.type === 'choice' || s.type === 'end_part' || s.actor === actor && ['exit', 'enter'].includes(s.type)) return false;
        if (s.actor === actor && s.type === 'order') return true;
      }
      return false;
    }
    storyCoasterEligible(actor, index = this.story?.index) {
      return this.phase === 'regular' && this.storyHasUpcomingOrder(actor, index) && !(this.day === 0 && actor === 'chris' && !this.progress.flags.day0_skip_tutorial && this.story?.steps.some(s => s.type === 'coaster' && s.arg === 'tutorial'));
    }
    waitForStoryCoaster(step, kind) {
      if (!this.storyCoasterEligible(step.actor)) return false;
      const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === step.actor && !this.seats[k].coaster);
      if (!seat) return false;
      this.storyCoaster = {
        seat,
        step,
        kind
      };
      this.focus = seat;
      this.changed();
      return true;
    }
    storyCoasterReady() {
      return !!this.storyCoaster && (this.storyCoaster.kind !== 'line' || this.dialogue?.step === this.storyCoaster.step && this.dialogue.chars >= this.dialogue.text.length);
    }
    setTransition(sec, fn) {
      this.dialogue = null;
      this.transition = sec;
      this.pendingTransition = fn;
    }
    speakerName(actor) {
      return actor === 'tom' && this.day === 1 && this.phase === 'regular' && !this.progress.flags.tom_name_known ? '???' : this.name(actor);
    }
    makeLine(actor, text, id = null, expression = 'default') {
      const timings = [],
        speedStack = [this.c('typing_interval_ms', 50)];
      for (const part of String(text).split(/(<\/?[a-z]+>)/g)) {
        const tag = part.match(/^<(\/?)([a-z]+)>$/);
        if (tag) {
          const rule = this.t.text_tags.find(t => t.tag === tag[2] && t.kind === 'speed_ms');
          if (rule) {
            if (tag[1] && speedStack.length > 1) speedStack.pop();else if (!tag[1]) speedStack.push(n(rule.value));
          }
        } else for (let i = 0; i < part.length; i++) timings.push(speedStack.at(-1));
      }
      return {
        actor,
        text: clean(text),
        raw: text,
        id,
        expression: expression || 'default',
        chars: 0,
        hold: 0,
        seen: false,
        timings,
        typeMs: 0
      };
    }
    typeLine(line, dt, audible = true) {
      const before = line.chars;
      line.typeMs += dt * this.dialogSpeed * TEXT_SPEED_BASE * 1000;
      while (line.chars < line.text.length) {
        const delay = line.timings?.[Math.floor(line.chars)] || this.c('typing_interval_ms', 50);
        if (line.typeMs < delay) break;
        line.typeMs -= delay;
        line.chars++;
      }
      if (audible && this.screen === 'bar' && this.currentDialogue() === line) root.LunaDialogueAudio?.reveal(line.text, before, line.chars);
    }
    finishLine() {
      const d = this.dialogue;
      if (!d || this.storyCoaster) return;
      if (d.id) this.read.add(d.id);
      this.history.push({
        actor: d.actor,
        text: d.text,
        scene: this.story?.scene?.id,
        id: d.id,
        anonymous: d.actor === 'tom' && this.speakerName(d.actor) === '???'
      });
      const s = d.step;
      this.lastStoryLine = {
        ...d,
        chars: d.text.length
      };
      this.dialogue = null;
      if (s.type === 'order') this.createStoryOrder(s);
      this.stepDone(s);
    }
    advance() {
      if (this.isPaused() || this.transition > 0 || this.cameraLeft > 0 || this.cameraMoving || this.screen !== 'bar' || !this.dialogue || this.phase === 'general') return false;
      const d = this.dialogue;
      if (d.chars < d.text.length) d.chars = d.text.length;else {
        if (this.storyCoaster) return false;
        this.safe(() => this.finishLine());
      }
      this.changed();
      return true;
    }
    choose(seq) {
      if (!this.choice || this.isPaused() || this.cameraMoving || this.cameraLeft > 0 || this.transition > 0) return false;
      return this.safe(() => {
        const c = this.choice.rows.find(c => n(c.seq) === Number(seq));
        if (!c || !condition(c.when, this.ctx())) return false;
        const target = c.goto ? this.t.scenes.find(s => s.id === c.goto && n(s.day) === this.day) : null;
        if (c.goto && !target) throw Error('분기 씬 없음: ' + c.goto);
        const step = this.choice.step;
        if (this.day === 0) this.progress.flags.day0_choice_hold_learned = true;
        applyEffects(c.effects, this.progress);
        applyEffects(step.effects, this.progress);
        this.log('choice', {
          id: step.arg,
          seq: c.seq,
          goto: c.goto
        });
        this.choice = null;
        if (target) this.loadScene(target);else {
          this.story.index++;
          this.pump();
        }
        this.changed();
        return true;
      });
    }
    createStoryOrder(s) {
      const freeChoice = s.arg === 'free',
        id = freeChoice ? this.cocktailsAvailable()[0]?.id : s.arg?.match(/^exact:(.+)$/)?.[1];
      if (!id) throw Error('미지원 주문 형식: ' + s.arg);
      this.cocktail(id);
      const seat = Object.keys(this.seats).find(k => this.seats[k]?.actor === s.actor);
      if (!seat) throw Error('주문자 착석 정보 없음: ' + s.actor);
      if (this.currentOrder) throw Error('앞 주문이 미완료');
      this.resultContext = {};
      this.currentOrder = {
        id: 'order_' + ++this.serial,
        actor: s.actor,
        seat,
        cocktail: id,
        ...(freeChoice ? {
          freeChoice: true
        } : {}),
        ...(s.payment ? {
          payment: s.payment
        } : {})
      };
      this.resultContext.ordered = id;
      if (this.phase === 'opening') this.seats[seat].coaster = true;
      this.seats[seat].order = this.currentOrder;
      this.log('order', {
        ...this.currentOrder
      });
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaGameParts ||= {}).story = create;
})(typeof window === 'undefined' ? globalThis : window);
