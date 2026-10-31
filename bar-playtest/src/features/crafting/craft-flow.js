/* Craft queue, gimmick input, completion, serving and waste. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ GRADES, MIX, OPEN, POUR, applyEffects, buildQueue, scoreCraft }) {
    return class GameCraft {
    startCraft() {
      if (this.screen !== 'prep' || this.isPaused()) return false;
      if (this.tutorial?.beer) {
        if (this.tutorial.kind !== 'beerStart' || this.prep?.glass !== this.cocktail('bottle_beer').glass || !this.prep.opener || !this.prep.ingredients.includes('beer')) return false;
        this.tutorial = null;
      }
      if (this.tutorial && (this.variant === 'gpt' || this.tutorial.kind !== 'prepStart' || this.prep?.glass !== 'long_drink' || !['gin', 'soda_water'].every(id => this.prep.ingredients.includes(id)))) return false;
      if (this.screen !== 'prep' || !this.prep?.glass || !this.prep.ingredients.length || this.isPaused()) return false;
      if (this.prep.ingredients.includes('beer') && !this.prep.opener) {
        this.overlay = 'openerWarning';
        this.changed();
        return false;
      }
      return this.safe(() => {
        this.craft = {
          id: 'craft_attempt_' + ++this.serial,
          actual: structuredClone(this.prep),
          queue: buildQueue(this.data, this.cocktail(this.prep.selected), this.prep),
          index: 0,
          results: [],
          elapsed: 0
        };
        this.screen = 'gimmick';
        this.nextGimmick();
        if (this.tutorial?.kind === 'prepStart') {
          this.tutorial = null;
          this.progress.flags.day0_recipe_taught = true;
          this.log('tutorial_complete', {
            kind: 'prep'
          });
        }
        this.changed();
        return true;
      });
    }
    nextGimmick() {
      const step = this.craft.queue[this.craft.index];
      if (!step) {
        this.result = scoreCraft(this.data, this.cocktail(this.craft.actual.selected), this.craft.actual, this.craft.results, this.craft.elapsed);
        this.result.id = this.craft.id;
        this.resultContext.craft_grade = this.result.grade;
        this.screen = 'result';
        this.gimmick = null;
        this.log('craft_result', {
          id: this.craft.id,
          score: this.result.score,
          grade: this.result.grade
        });
        return;
      }
      if (step.type === 'add') {
        this.craft.results.push({
          ...step,
          value: step.target,
          completed: true,
          failures: 0,
          completion: 1
        });
        this.craft.index++;
        return this.nextGimmick();
      }
      this.gimmick = {
        ...step,
        started: false,
        elapsed: 0,
        value: 0,
        held: false,
        angle: 0,
        failures: 0,
        completed: false,
        success: 0,
        completionAge: 0,
        attempts: 0,
        beatTime: 0,
        hit: false,
        beatSuccess: false,
        outcomes: [],
        stirPos: 0,
        stirStep: 0,
        circleTime: 0,
        message: '',
        targetStacks: step.type === 'shake' ? MIX.shakeTargetStacks : this.c('stir_target_stacks', 10)
      };
      MIX.init(this.gimmick);
      OPEN.init(this.gimmick);
      POUR.init(this.gimmick, this);
      if (step.type === 'open' && this.day === 1 && this.phase === 'opening' && this.craftStep?.arg === 'tutorial_beer') this.gimmick.openTutorial = true;
      if (this.gimmick.fluid && this.day === 0 && this.variant !== 'gpt' && !this.minigame && this.currentOrder?.actor === 'chris' && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_pour_taught) this.gimmick.pourTutorial = {
        step: 'target'
      };
    }
    startGimmick() {
      return this.gimmickInput(this.gimmick?.type === 'stir' ? 'KeyW' : 'Space');
    }
    holdPour(held) {
      if (this.screen !== 'gimmick' || this.isPaused()) return;
      if (['pour', 'fill_up'].includes(this.gimmick.type) && !this.gimmick.fluid?.finishRequested) {
        this.gimmick.held = held;
        if (held) this.gimmick.started = true;
      }
    }
    gimmickInput(key) {
      const g = this.gimmick;
      if (this.screen !== 'gimmick' || !g || this.isPaused() || g.completed || g.fluid?.finishRequested) return false;
      // Reject unrelated keys before they can start the clock or change a score.
      if (['pour', 'fill_up'].includes(g.type)) {
        if (key !== 'Space') return false;
        this.holdPour(true);
        return true;
      }
      if (g.type === 'stir') {
        if (!g.started) {
          if (!['KeyW', 'ArrowUp'].includes(key)) return false;
          g.started = true;
          g.message = '시계 방향으로 D → S → A → W';
          return true;
        }
        const keyMap = {
            KeyW: 0,
            ArrowUp: 0,
            KeyD: 1,
            ArrowRight: 1,
            KeyS: 2,
            ArrowDown: 2,
            KeyA: 3,
            ArrowLeft: 3
          },
          dir = keyMap[key];
        if (dir == null) return false;
        if (dir === (g.stirPos + 1) % 4) {
          g.stirPos = dir;
          g.stirStep++;
          g.spoonTarget += 90;
          g.stirMotionPending = Math.min(6, g.stirMotionPending + 5);
          g.swirlSpeed = Math.min(420, g.swirlSpeed + 160);
          g.message = '';
          if (g.stirStep === 4) this.finishStirCircle(true);
        } else this.finishStirCircle(false);
        this.changed();
        return true;
      }
      if (!['open', 'shake'].includes(g.type) || !(key === 'Space' || g.type === 'shake' && key === 'MouseLeft')) return false;
      if (g.type === 'open') {
        const accepted = OPEN.press(g);
        this.changed();
        return accepted;
      }
      if (!g.started) {
        g.started = true;
        this.changed();
        return true;
      }
      if (g.type === 'shake') {
        MIX.shakeHit(g);
      }
      this.changed();
      return true;
    }
    finishStirCircle(ok) {
      const g = this.gimmick;
      g.outcomes.push(ok);
      g.attempts++;
      if (ok) g.success++;else g.failures++;
      g.attemptStartPos = g.stirPos;
      g.stirStep = 0;
      g.circleTime = 0;
      g.feedbackLeft = .35;
      g.message = ok ? 'GOOD' : 'MISS';
      if (g.attempts >= g.targetStacks) g.completed = true;
    }
    endGimmick() {
      const g = this.gimmick;
      if (!g || this.screen !== 'gimmick' || this.isPaused() || !g.started) return false;
      if (['stir', 'shake'].includes(g.type) && g.completed && (g.completionAge || 0) + 1e-9 < MIX.completionHoldSec) return false;
      if (g.fluid && !g.fluid.ready) {
        g.fluid.requestFinish(g);
        this.changed();
        return true;
      }
      if (g.fluid?.ready) {
        if (!g.pourFinishFx) {
          const errorMl = g.fluid.caughtMl - g.fluid.targetMl;
          g.pourFinishFx = {
            errorMl,
            perfect: Math.abs(errorMl) <= 5 + 1e-8,
            age: 0
          };
        }
        if (g.pourFinishFx.age < .8) return true;
      }
      if (g.type === "open" && g.completed && (g.openFx?.age || 0) < OPEN.carbonationSec) return false;
      if (g.openTutorial) {
        if (!g.completed || (g.openFx?.age || 0) < OPEN.carbonationSec) return false;
        this.progress.flags.day1_open_taught = true;
        this.log('tutorial_complete', {
          kind: 'beerOpen'
        });
      }
      let result = {
        type: g.type,
        ingredient: g.ingredient,
        value: g.value,
        failures: g.failures,
        completed: g.completed,
        completion: g.success / (g.targetStacks + (g.rhythm?.extraPresses || 0)),
        endType: g.completed ? 'AutoTarget' : 'ManualNext'
      };
      if (g.rhythm) result.rhythm = {
        mode: g.rhythm.mode,
        extraPresses: g.rhythm.extraPresses
      };
      if (['pour', 'fill_up'].includes(g.type)) {
        result.completed = true;
        if (g.fluid) result.liquid = {
          ...g.fluid.audit()
        };
      }
      if (g.fluid && g.pourTutorial) {
        this.progress.flags.day0_pour_taught = true;
        this.log('tutorial_complete', {
          kind: 'pour'
        });
      }
      this.craft.results.push(result);
      this.craft.index++;
      this.safe(() => this.nextGimmick());
      this.changed();
    }
    retryDataError() {
      if (!this.craft) return;
      this.error = null;
      this.craft.id = 'craft_attempt_' + ++this.serial;
      this.craft.index = 0;
      this.craft.results = [];
      this.craft.elapsed = 0;
      this.screen = 'gimmick';
      this.safe(() => {
        this.craft.queue = buildQueue(this.data, this.cocktail(this.craft.actual.selected), this.craft.actual);
        this.nextGimmick();
      });
      this.changed();
    }
    cancelCraft() {
      this.error = null;
      this.gimmick = null;
      this.craft = null;
      this.result = null;
      this.prep = null;
      this.screen = 'recipe';
      this.changed();
    }
    discard() {
      if (this.screen !== 'result' || !this.result || this.isPaused()) return false;
      const r = this.result,
        price = Number(this.cocktail(r.selected).price);
      if (!Number.isFinite(price) || price < 0) {
        this.error = '칵테일 가격 오류: ' + r.selected;
        this.changed();
        return false;
      }
      const before = this.progress.money;
      this.progress.money -= price;
      this.discardFeedback = {
        id: r.id,
        selected: r.selected,
        price,
        before,
        after: this.progress.money,
        startedAt: this.realTime,
        until: this.realTime + 2.6
      };
      this.log('discard', {
        id: r.id,
        selected: r.selected,
        price,
        before,
        after: this.progress.money
      });
      this.screen = 'discarding';
      this.drink = null;
      this.gimmick = null;
      delete this.resultContext.craft_grade;
      this.changed();
      return true;
    }
    offer() {
      if (this.screen !== 'result' || !this.result) return;
      this.drink = this.result;
      this.result = null;
      this.screen = 'bar';
      if (this.currentOrder) {
        this.focus = this.currentOrder.seat;
        this.seats[this.focus].glass = null;
      } else this.cleanOldGlass();
      if (this.day === 0 && this.variant !== 'gpt' && !this.progress.flags.day0_skip_tutorial && !this.progress.flags.day0_drink_taught && this.currentOrder?.actor === 'chris' && this.drink.selected === this.currentOrder.cocktail) {
        this.tutorial = {
          kind: 'serveDrink',
          seat: this.currentOrder.seat
        };
        this.log('tutorial_wait', {
          kind: 'serveDrink'
        });
      }
      this.log('offer', {
        id: this.drink.id
      });
      this.changed();
    }
    resolveServe(order, drink) {
      const match = order.cocktail === drink.selected;
      const sewage = !match ? 'order_mismatch' : drink.missingCore.length ? 'missing_core' : null;
      const grade = sewage ? 'sewage' : drink.grade;
      return {
        orderId: order.id,
        drinkId: drink.id,
        ordered: order.cocktail,
        served: drink.selected,
        match,
        grade,
        craftGrade: drink.grade,
        score: drink.score,
        sewage,
        ...(order.payment ? {
          payment: order.payment
        } : {})
      };
    }
    serve(seat, input) {
      if (this.tutorial && (this.tutorial.kind !== 'serveDrink' || seat !== this.tutorial.seat || !['drag', 'keyboard'].includes(input))) return false;
      if (!this.drink || this.screen !== 'bar' || this.isPaused() || this.cameraLeft > 0 || this.transition > 0) return false;
      return this.safe(() => {
        if (this.phase === 'practice') {
          this.settle(this.resolveServe({
            id: 'practice_' + ++this.serial,
            cocktail: this.drink.selected
          }, this.drink));
          this.drink = null;
          this.openRecipes();
          return true;
        }
        const g = this.seats[seat];
        if (!g?.coaster) return false;
        if (this.phase === 'general') {
          if (seat !== this.focus || g.state !== 'WAIT_SERVE' || !g.order || g.left <= 0) return false;
          const result = this.resolveServe(g.order, this.drink);
          g.glass = this.drink.selected;
          this.drink = null;
          g.reasking = false;
          g.state = 'REACTION';
          g.lastGrade = result.grade;
          this.setBarks(g, result.match ? ['serve_thanks', 'react_' + result.grade] : ['wrong_receive', 'wrong_drink'], () => {
            const t = this.settle(result, g);
            applyEffects(g.slot.serve_effects, this.progress);
            g.order = null;
            if (g.round < g.maxRounds && t.refund === 0) {
              g.state = 'REORDER_WAIT';
              g.reorderLeft = this.c('next_round_delay_sec', 3);
            } else {
              g.state = 'EXITING';
              this.setBarks(g, [GRADES.indexOf(result.grade) >= 2 ? 'bye_good' : 'bye_bad']);
              g.exitLeft = 3;
            }
          });
        } else {
          if (!this.currentOrder || seat !== this.currentOrder.seat) return false;
          const craftStep = this.story.steps[this.story.index],
            serve = this.story.steps[this.story.index + 1];
          if (craftStep?.type !== 'craft' || serve?.type !== 'serve' || serve.actor !== this.currentOrder.actor) throw Error('order → craft → serve 연결 오류');
          const result = this.resolveServe(this.currentOrder, this.drink);
          g.glass = this.drink.selected;
          this.drink = null;
          this.resultContext = {
            grade: result.grade,
            final_grade: result.grade,
            craft_grade: result.craftGrade,
            order_match: result.match,
            ordered: result.ordered,
            served: result.served,
            cocktail: this.cocktail(result.served),
            tags: this.t.cocktail_tags.filter(t => t.context === result.served).map(t => t.ko)
          };
          if (this.tutorial?.kind === 'serveDrink') {
            this.tutorial = null;
            this.progress.flags.day0_drink_taught = true;
            this.log('tutorial_complete', {
              kind: 'serveDrink',
              input
            });
          }
          this.settle(result);
          this.applyAffinity(this.currentOrder.actor, result);
          applyEffects(craftStep.effects, this.progress);
          applyEffects(serve.effects, this.progress);
          this.currentOrder = null;
          g.order = null;
          this.story.index += 2;
          this.setTransition(1, () => this.pump());
        }
        this.changed();
        return true;
      });
    }
    tickMixCompletion(dt) {
      const g = this.gimmick;
      if (!g?.completed || !['stir', 'shake'].includes(g.type)) return false;
      // Simulation time only: pause freezes the hold. Final animation continues,
      // but neither score nor the craft clock advances during this feedback.
      if (!this.isPaused()) {
        g.completionAge = (g.completionAge || 0) + dt;
        if (g.completionAge + 1e-9 >= MIX.completionHoldSec) this.endGimmick();
      }
      return true;
    }
    tickGimmick(dt) {
      const g = this.gimmick;
      if (!g) return;
      if (g.fluid) {
        if (!g.started) return;
        if (!g.fluid.finishRequested || g.angle > 0) {
          g.elapsed += dt;
          this.craft.elapsed += dt;
        }
        g.fluid.tick(g, dt);
        this.chargePourOverflow(g.fluid);
        if (g.fluid.ready) {
          if (g.pourFinishFx) g.pourFinishFx.age += dt;
          this.endGimmick();
        }
        return;
      }
      MIX.visual(g, dt);
      OPEN.visual(g, dt);
      if (this.tickMixCompletion(dt)) return;
      if (!g.started || g.completed) return;
      g.elapsed += dt;
      if (g.type !== 'open') this.craft.elapsed += dt;
      if (g.type === 'open') {
        OPEN.tick(g, dt);
      } else if (g.type === 'shake') {
        MIX.updatePath(g, this.rng);
        if (!g.feedbackLeft) {
          g.hit = false;
          g.message = '';
        }
      } else if (g.type === 'stir') {
        g.circleTime += dt;
        if (g.circleTime >= this.c('stir_circle_limit_sec', 1.5)) this.finishStirCircle(false);
      }
    }
    chargePourOverflow(fluid) {
      const whole = Math.floor(fluid.overflowMl + 1e-8),
        cost = Math.max(0, whole - fluid.overflowCharged);
      if (!cost) return;
      fluid.overflowCharged = whole;
      this.progress.money -= cost;
      // Monotonic receipt lets the HUD show individual -1 ticks without audio.
      this.progress.pourWaste = (this.progress.pourWaste || 0) + cost;
      this.changed();
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaGameParts ||= {}).craft = create;
})(typeof window === 'undefined' ? globalThis : window);
