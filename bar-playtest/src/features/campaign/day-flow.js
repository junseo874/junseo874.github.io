/* Day progression, street/bar handoff, home rest and morning. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ global }) {
    return class CampaignDay {
    startBar(day, carry) {
      this.runDoorTransition('in', async () => {
        await global.LunaResources.prepare('common');
        await global.LunaResources.prepare('bar');
        await Promise.all(Object.values(this.D.assets).map(a => a.src).filter(src => /\.(png|webp|gif|jpe?g)(?:\?|$)/i.test(src)).map(src => this.image(src)));
      }, () => {
        // Keep the outside scene until the opaque door owns the screen. Prepare the
        // real bar underneath it before beginning the reveal, never the setup lobby.
        if (this.outside.active) this.outside.exit(true);
        Object.assign(this.ui, {
          day,
          variant: 'original',
          outside: false,
          minigames: false,
          cutscenes: false
        });
        this.session.beginDay(day, carry);
        if (day === 0 && global.LunaStoryNotices?.completeGoal(this.g.progress, 'first_commute')) {
          // Persist completion in the retry checkpoint as well as the next commute carry.
          for (const progress of [this.session.checkpoint, this.session.carry]) if (progress) {
            progress.objectives ??= {};
            progress.objectives.first_commute = {
              ...this.g.progress.objectives.first_commute
            };
          }
        }
        this.render(true);
      });
    }
    runDoorTransition(direction, prepare, commit) {
      if (this.doorTransition) return;
      this.resetInput();
      const d = {
        direction,
        prepare,
        commit,
        startedAt: performance.now(),
        time: 0,
        ready: false,
        motionAt: null,
        revealAt: null
      };
      this.doorTransition = d;
      this.screen('bar-door');
      global.LunaBarDoor.paint(this.host, d);
      this.retryLoad = () => this.runDoorTransition(direction, prepare, commit);
      Promise.all([Promise.all(global.LunaBarDoor.assets.map(src => this.image(src))).then(()=>{
        if(this.doorTransition!==d)return;d.artReady=true;if(this.view==='bar-door')this.draw();
      }), Promise.resolve().then(() => {
        if (this.doorTransition === d) return prepare();
      })]).then(() => {
        if (this.doorTransition !== d) return;
        d.ready = true;
        document.querySelector('#outside-root')?.setAttribute('inert', '');
      }).catch(e => {
        if (this.doorTransition !== d) return;
        this.cancelDoorTransition();
        this.loadError = '문 너머의 공간을 불러오지 못했어요. ' + e.message;
        this.screen('load-error');
      });
    }
    cancelDoorTransition() {
      this.doorTransition = null;
      this.host.style.opacity = '';
    }
    tickDoorTransition(dt) {
      const d = this.doorTransition;
      if (!d) return false;
      if (global.LunaFocusSettings.hiddenPaused) return true;
      d.time += dt;
      // The door cannot move until both the visible three-second hold and real loading complete.
      if (d.ready && d.time >= 3 && performance.now() - d.startedAt >= 3000 && d.motionAt == null) d.motionAt = d.time;
      if (d.motionAt != null && d.time >= d.motionAt + 1.7 && d.revealAt == null) {
        try {
          d.committing = true;
          d.commit();
          d.committing = false;
          d.revealAt = d.time;
        } catch (e) {
          this.cancelDoorTransition();
          this.loadError = e.message;
          this.screen('load-error');
          return true;
        }
      }
      global.LunaBarDoor.paint(this.host, d);
      if (d.revealAt != null && d.time >= d.revealAt + .8) {
        this.cancelDoorTransition();
        if (this.outside.active) this.outside.model.paused = false;
        this.screen(this.playView);
        this.render(true);
      }
      return true;
    }
    async street(flow, place = 'bar', wakeAtSofa = false) {
      if (flow === 'out' && place === 'bar') {
        this.session.route = flow;
        this.runDoorTransition('out', async () => {
          if (this.outside.active) this.outside.exit(true);
          Object.assign(this.outside.config, {
            flow,
            place,
            day: this.session.day,
            variant: 'original'
          });
          await this.outside.start();
          if (this.outside.loadError) throw Error(this.outside.loadError);
        }, () => {
          this.outside.tick(0);
        });
        return;
      }
      const dayTransition = this.dayTransition,
        token = this.token;
      this.session.route = flow;
      this.screen('loading');
      this.loadLabel = flow === 'out' ? '문을 닫고, 집으로' : '새로운 하루';
      this.draw();
      Object.assign(this.outside.config, {
        flow,
        place,
        day: this.session.day,
        variant: 'original'
      });
      await this.outside.start({
        wakeAtSofa
      });
      if (token !== this.token || dayTransition && this.dayTransition !== dayTransition) return;
      this.outside.tick(0);
      this.screen(this.playView);
    }
    debugOutsideDay(day, flow) {
      if (!this.active || !Number.isInteger(day) || day < 0 || day > 3) return;
      const carry = structuredClone(this.g.progress);
      this.g.reset(day, 'full', 1100 + day, false, {
        variant: 'original',
        serviceVersion: 'A'
      });
      this.g.progress = {
        ...carry,
        day,
        phase: 'commute'
      };
      this.session.day = day;
      this.session.route = flow;
      this.session.serviceVersion = 'A';
      this.session.carry = structuredClone(this.g.progress);
      this.session.checkpoint = null;
      this.session.pendingStep = null;
      this.morningSeen.delete(day);
      this.nightStarted = false;
      this.dialog = null;
      this.firstLift = day !== 0;
      this.ui.day = day;
      this.ui.variant = 'original';
      this.ui.serviceVersion = 'A';
      this.g.changed();
    }
    leaveBar() {
      if (!this.session.settle()) {
        this.render(true);
        return;
      }
      this.street('out');
    }
    storyStep(step) {
      if (step.type === 'campaign_menu') {
        this.screen('menu');
        return;
      }
      if (step.type === 'campaign_response') {
        this.screen('response');
        return;
      }
      if (step.type === 'campaign_memory') {
        this.scene('johnny', '조니의 기억', 'bar', () => this.memoryQuiz(), {
          memory: true
        });
      }
    }
    memoryQuiz() {
      this.observationError = '';
      this.screen('observation');
    }
    completeMemory() {
      this.g.progress.flags.campaign_observation = true;
      this.scene('prepare', '바 · 내일의 준비', 'bar', () => {
        this.screen(this.playView);
        this.session.finishStep();
        this.render(true);
      });
    }
    previewCommute(model) {
      if ([2, 3].includes(model.config.day)) return global.LunaOutsideSamhoCommute.start(model);
      model.notionCommuteSeen = true;
      model.story.cancel();
      model.backgroundStory.cancel();
      this.streetBackdrop = this.outside.snapshot();
      this.scene('commute' + model.config.day, '출근길 · 삼호', 'street', () => this.screen('developer'));
    }
    interactOutside(model, target) {
      if (model !== this.outside.model || model.qa) return false;
      if (target.id === 'sofa' && model.config.flow !== 'out') return true;
      if (target.id === 'tv' && model.config.day === 0) {
        if(this.g.progress.flags.day0_tv_seen){
          model.dialog={kind:'tv',key:'tv:'+ ++model.revision};model.anim='idle';model.animTime=0;model.updateNear();return true;
        }
        this.playDayZeroTV(model);
        return true;
      }
      // Check on boarding the upward homeward lift, not when calling it or leaving home.
      if ((this.active || this.session.developer) && target.id === 'elevator' && model.scene === 'street' && model.level === 0 && model.config.flow === 'out' && (target.fast || Math.abs(model.elevatorY - global.LunaResidence.layout.elevatorBottom) <= .01)) {
        const missing = this.dayEndRequirements(model.config.day);
        if (missing.length) {
          this.outside.clearInput();
          this.showHomewardRequirements(missing);
          return true;
        }
      }
      if (!this.active) {
        if (!this.session.developer) return false;
        if (target.id === 'sofa') {
          this.sleepOutsideTest(model);
          return true;
        }
        if (model.config.day < 2) return false;
        if (target.id === 'story-samho') {
          this.previewCommute(model);
          return true;
        }
        return false;
      }
      if (target.id === 'bar') {
        if (this.session.route === 'in') {
          this.startBar(this.session.day, this.session.carry);
        } else this.notice('오늘 영업은 끝났어요. 왼쪽 엘리베이터를 타고 집으로 돌아가세요.');
        return true;
      }
      if (target.id === 'sofa') {
        if (this.session.route === 'out') this.sleep();
        return true;
      }
      return false;
    }
    quietLift(model) {
      const ride = model.ride;
      if (!(this.active || this.session.developer) || model.config.day !== 0 || model.config.flow !== 'out' || model.scene !== 'street' || model.level !== 0 || !ride || ride.call || ride.to <= ride.from || ride.titleReveal || (this.active ? this.firstLift : model.liftLogoSeen)) return false;
      // Mark this ride, not an earlier commute/call. An interrupted ride before
      // the title appears must not consume the first homeward reveal.
      ride.titleReveal = true;
      this.liftLogoPending = true;
      model.backgroundStory.cancel();
      model.story.cancel();
      return true;
    }
    notice(text, title = '루나') {
      this.resumeView = this.view === 'game' ? 'game' : this.view;
      this.noticeText = text;
      this.noticeTitle = title;
      this.screen('notice');
    }
    beginDayTransition(from, to, prepare) {
      if (this.dayTransition) return;
      const host = document.createElement('section');
      host.className = 'campaign-day-transition';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-label', 'Day ' + from + ' → Day ' + to);
      host.innerHTML = '<div class="day-transition-shade"></div><div class="day-transition-title" aria-hidden="true"><span>Day</span><span class="day-transition-digits"><span class="day-digit-old">' + from + '</span><span class="day-digit-new">' + to + '</span></span></div>';
      this.dayTransition = {
        from,
        to,
        time: 0,
        host,
        prepare,
        started: false,
        ready: false,
        revealAt: null
      };
      document.body.append(host);
      this.resetInput();
      this.app.inert = true;
      document.querySelector('#outside-root')?.setAttribute('inert', '');
      this.paintDayTransition();
    }
    cancelDayTransition() {
      this.dayTransition?.host.remove();
      this.dayTransition = null;
    }
    paintDayTransition() {
      const d = this.dayTransition;
      if (!d) return;
      const smooth = x => {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      };
      const roll = smooth((d.time - 1.55) / .65),
        reveal = d.revealAt == null ? 0 : smooth((d.time - d.revealAt) / .9);
      d.host.querySelector('.day-transition-shade').style.opacity = smooth(d.time / .65) * (1 - reveal);
      d.host.querySelector('.day-transition-title').style.opacity = smooth((d.time - .7) / .3) * (1 - smooth((d.time - 3) / .3));
      const old = d.host.querySelector('.day-digit-old'),
        next = d.host.querySelector('.day-digit-new');
      old.style.transform = 'translateY(' + -roll * 110 + '%)';
      old.style.opacity = 1 - roll;
      next.style.transform = 'translateY(' + (1 - roll) * 110 + '%)';
      next.style.opacity = roll;
    }
    tickDayTransition(dt) {
      const d = this.dayTransition;
      if (!d) return false;
      if (global.LunaFocusSettings.hiddenPaused) return true;
      d.time += dt;
      if (d.time >= 2.25 && !d.started) {
        d.started = true;
        Promise.resolve().then(() => {
          if (this.dayTransition === d) return d.prepare();
        }).then(() => {
          if (this.dayTransition === d) d.ready = true;
        }).catch(e => {
          if (this.dayTransition !== d) return;
          this.cancelDayTransition();
          this.nightStarted = false;
          this.loadError = e.message;
          this.retryLoad = () => this.beginDayTransition(d.from, d.to, d.prepare);
          this.screen('load-error');
        });
      }
      if (d.ready && d.time >= 3.4 && d.revealAt == null) d.revealAt = d.time;
      this.paintDayTransition();
      if (d.revealAt != null && d.time >= d.revealAt + .9) {
        this.cancelDayTransition();
        this.screen(this.cinema?.dailyWake ? 'prologue' : this.playView);
        this.render(true);
      }
      return true;
    }
    dayEndRequirements(day, {
      memory = false
    } = {}) {
      return day === 2 ? this.g.johnnyMissing({
        memory
      }) : [];
    }
    showHomewardRequirements(missing) {
      const labels = missing.map(id => id === 'johnny_memory' ? '조니의 레시피 회상' : this.g.name(id));
      this.notice('아직 해야 할 일이 남아 있습니다.\n확인할 항목: ' + labels.join(' · ') + '\n와일드 독은 모닥불 옆 덩치 큰 갱단원에게, 비터스는 거리의 시BAR에게서 구할 수 있습니다.', '집에 올라가기 전에');
      this.resumeView = this.playView;
    }
    sleepOutsideTest(model) {
      if (model !== this.outside.model || model.qa || !this.outside.active || model.scene !== 'home' || this.view !== 'developer' || this.dayTransition || this.memoryTransition) return;
      if (model.config.flow !== 'out') {
        this.notice('지금은 출근길입니다. 바에 다녀온 뒤 퇴근길 상태에서 하루를 마칠 수 있어요.', '소파');
        return;
      }
      if (this.outsideSleep === model) return;
      const day = model.config.day;
      if (day < 0 || day > 3) return;
      this.outsideSleep = model;
      model.story.cancel();
      model.backgroundStory.cancel();
      this.outside.clearInput();
      const finish = () => {
        if (this.outsideSleep !== model) return;
        this.outsideSleep = null;
        // A cancelled preview or a restarted test must not advance a different run.
        if (!this.session.developer || !this.outside.active || this.outside.model !== model || model.config.day !== day) return;
        if (day === 3) {
          this.screen('developer');
          this.outside.exit();
          this.notice('3일차 테라스 대화까지 마쳤습니다. 탐색을 다시 시작한 뒤 P 패널에서 일차를 바꿀 수 있어요.', '외부 일차 테스트 완료');
          return;
        }
        this.beginDayTransition(day, day + 1, async () => {
          const transition = this.dayTransition,
            scene = await this.prepareStudio('morning');
          if (this.dayTransition !== transition) return;
          if (!this.session.developer || this.outside.model !== model) throw Error('외부 테스트가 변경되었습니다.');
          if (!this.outside.advanceDay()) throw Error('다음 일차로 이동하지 못했습니다.');
          this.startRestCinema(scene, () => this.finishMorning(), true);
        });
      };
      this.playSleepScenes(day, finish);
    }
    playSleepScenes(day, finish) {
      const discoveryModel=this.outside.model;
      const discoveryToken=discoveryModel&&global.LunaOutsideDiscovery?.objectToken(discoveryModel,'sofa');
      const complete = () => {
        if(discoveryModel)global.LunaOutsideDiscovery?.remember(discoveryModel,discoveryToken);
        if (this.dayEndRequirements(day, {
          memory: true
        }).includes('johnny_memory')) {
          this.playJohnnyMemory(finish);
          return;
        }
        finish();
      };
      const terrace = () => {
        const key = global.LunaTerrace.nightKey(day);
        if (key && this.data.scenes[key]?.length) this.scene(key, '테라스', 'terrace', complete);else this.playRestCinema('sleep', complete);
      };
      // The workshop interlude is archive-only; keep the cat/rest/terrace chain intact.
      if (!global.LunaOutsideNeighborhood?.beforeRest(this.outside.model, terrace)) terrace();
    }
    startRestCinema(scene, done, dailyWake = false) {
      this.disposeCinema();
      this.dialog = null;
      if (this.outside.active) this.outside.model.paused = true;
      this.cinema = {
        studio: true,
        dailyWake,
        skipUntil: 0,
        returnTransition: 'cut',
        title: scene.name,
        scenes: [scene],
        index: 0,
        scene,
        time: 0,
        player: null,
        returnTo: done
      };
      this.screen('prologue');
    }
    playRestCinema(kind, done) {
      this.retryLoad = () => this.playRestCinema(kind, done);
      this.beginMemoryTransition(() => this.prepareStudio(kind), scene => this.startRestCinema(scene, done), {
        revealDuration: .65
      });
    }
    finishMorning() {
      if (this.outside.active) {
        this.outside.model.paused = false;
        this.outside.clearInput();
        this.outside.model.updateNear();
        this.outside.tick(0);
      }
      this.nightStarted = false;
      this.screen(this.playView);
      this.render(true);
    }
    sleep() {
      if (this.nightStarted || !this.active || this.view !== this.playView || this.session.route !== 'out' || this.dayTransition || this.memoryTransition) return;
      this.nightStarted = true;
      this.outside.model?.story.cancel();
      this.outside.model?.backgroundStory.cancel();
      this.outside.clearInput();
      const d = this.session.day;
      const finish = () => {
        if (d === 3) {
          this.session.endDay();
          this.nightStarted = false;
          this.outside.exit(true);
          this.screen('ending');
          return;
        }
        this.beginDayTransition(d, d + 1, async () => {
          const transition = this.dayTransition,
            scene = await this.prepareStudio('morning');
          if (this.dayTransition !== transition) return;
          if (this.session.day === d && !this.session.endDay()) throw Error('일차 종료 상태를 확인해 주세요.');
          if (this.session.day !== d + 1) throw Error('다음 일차 상태를 확인해 주세요.');
          this.outside.exit(true);
          await this.street('in', 'home', true);
          if (this.dayTransition !== transition) return;
          this.startRestCinema(scene, () => this.finishMorning(), true);
        });
      };
      this.playSleepScenes(d, finish);
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaCampaignParts ||= {}).day = create;
})(typeof window === 'undefined' ? globalThis : window);
