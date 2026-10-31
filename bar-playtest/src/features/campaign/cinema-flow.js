/* Cinematic loading, memory transitions, dialogue gates and skip lifecycle. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ CINEMA_SKIP_HOLD_MS, CINEMA_SKIP_INTRO_SECONDS, CINEMA_SKIP_REVEAL_MS, global }) {
    return class CampaignCinema {
    async preload(label, urls, done) {
      const token = ++this.token;
      this.loadLabel = label;
      this.loadPercent = 0;
      this.screen('loading');
      const unique = [...new Set(urls.filter(Boolean))];
      const retry = () => this.preload(label, urls, done);
      this.retryLoad = retry;
      try {
        let n = 0;
        await Promise.all(unique.map(src => this.image(src).then(() => {
          if (token === this.token) {
            this.loadPercent = ++n / unique.length * 100;
            this.draw();
          }
        })));
        if (token !== this.token) return;
        done();
      } catch (e) {
        if (token !== this.token) return;
        this.loadError = '네트워크 연결을 확인해 주세요. 실패한 리소스: ' + e.message;
        this.screen('load-error');
      }
    }
    image(src) {
      if (this.loaded.has(src)) return Promise.resolve();
      this.imageJobs ||= new Map();
      if(!this.imageJobs.has(src))this.imageJobs.set(src,global.LunaResources.image(src).then(()=>{this.loaded.add(src);}).catch(error=>{this.imageJobs.delete(src);throw error;}));
      return this.imageJobs.get(src);
    }
    script(name) {
      if (this.scriptPromises.has(name)) return this.scriptPromises.get(name);
      const p = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        const source = name === 'assets' ? 'data/runtime/cinema-assets.js' : 'src/cinema/' + name + '.js';
        s.src = source + '?v=' + (['studio-player', 'engine'].includes(name) ? 'cinema-period-pause-20261031' : name === 'player' ? 'memory-layout-20261020' : name === 'terrace-memory' ? 'day3-notion-20261004' : 'dialogue-periods-20261029');
        s.onload = resolve;
        s.onerror = () => {
          this.scriptPromises.delete(name);
          s.remove();
          reject(Error(s.src));
        };
        document.head.append(s);
      });
      this.scriptPromises.set(name, p);
      return p;
    }
    async prepareStudio(id) {
      for (const name of ['assets', 'sprites', 'stage', 'stage3', 'stage4', 'engine', 'studio-player']) await this.script(name);
      await new Promise(resolve => global.Sprites.load(resolve));
      global.Engine.initAnchors?.();
      return global.LunaStudioCinema.prepare(id);
    }
    async newGame() {
      this.serviceVersion = 'A';
      this.cancelMemoryTransition();
      this.cancelDayTransition();
      this.cancelDoorTransition();
      this.disposeCinema();
      const token = ++this.token;
      this.outside.exit(true);
      this.dialog = null;
      this.awakening = null;
      this.liftLogoPending = false;
      if (this.session.active) this.session.uninstall();
      this.storyVersion = 'A';
      this.data = global.LUNA_CAMPAIGN_DATA;
      this.session = new global.LunaCampaignEngine.Session(this.g, this.D, this.data);
      this.session.onStep = s => this.storyStep(s);
      this.session.install({
        serviceVersion: 'A'
      });
      this.session.beginCommute(0);
      this.firstLift = false;
      this.morningSeen.clear();
      this.nightStarted = false;
      this.clearInput();
      this.g.lang = 'ko';
      this.ui.day = 0;
      this.ui.variant = 'original';
      this.ui.serviceVersion = 'A';
      this.ui.minigames = false;
      this.ui.outside = false;
      this.ui.cutscenes = false;
      this.ui.inspector = false;
      this.ui.auto = false;
      this.g.speed = 1;
      this.loadLabel = '도입부 · 첫 출근을 준비하고 있습니다';
      this.loadPercent = 0;
      this.screen('loading');
      this.retryLoad = () => this.newGame();
      try {
        await global.LunaResources.prepare('common');
        if (token !== this.token) return;
        const scene = await this.prepareStudio('opening');
        if (token !== this.token) return;
        this.loadPercent = 80;
        this.draw();
        Object.assign(this.outside.config, {
          day: 0,
          flow: 'in',
          place: 'home'
        });
        await this.outside.start({
          wakeAtSofa: true
        });
        if (token !== this.token) return;
        if (this.outside.loadError) throw Error(this.outside.loadError);
        const model = this.outside.model;
        model.paused = true;
        this.cinema = {
          studio: true,
          memory: true,
          returnTransition: 'cut',
          skipUntil: 0,
          title: '마지막 부탁 · 첫 출근',
          scenes: [scene],
          index: 0,
          scene,
          time: 0,
          player: null,
          returnTo: () => {
            if (model !== this.outside.model) return;
            model.paused = false;
            this.outside.clearInput();
            model.updateNear();
            this.outside.tick(0);
            this.screen(this.playView);
            this.render(true);
            this.outside.showControlsTutorial();
          }
        };
        this.bgm.setSuppressed('cinema', true);
        this.screen('prologue');
        global.LunaStudioCinema.unlock();
      } catch (e) {
        if (token !== this.token) return;
        this.loadError = e.message;
        this.screen('load-error');
      }
    }
    playDayZeroTV(model) {
      if (model !== this.outside.model || model.config.day !== 0 || this.memoryTransition) return;
      model.paused = true;
      this.outside.clearInput();
      model.backgroundStory.cancel();
      this.disposeCinema();
      this.retryLoad = () => this.playDayZeroTV(model);
      this.beginMemoryTransition(() => this.prepareStudio('documentary'), scene => {
        this.cinema = {
          studio: true,
          memory: true,
          title: 'TV 다큐 · 인공생명체의 역사',
          scenes: [scene],
          index: 0,
          scene,
          time: 0,
          player: null,
          returnTo: () => {
            if (model !== this.outside.model) return;
            this.g.progress.flags.day0_tv_seen=true;
            if(this.session.carry)this.session.carry.flags={...this.g.progress.flags};
            this.g.changed();
            model.paused = false;
            this.outside.clearInput();
            model.updateNear();
            this.outside.tick(0);
            this.screen(this.playView);
          }
        };
        this.bgm.setSuppressed('cinema', true);
        this.screen('prologue');
        global.LunaStudioCinema.unlock();
      }, {
        revealDuration: .8
      });
    }
    beginMemoryTransition(prepare, commit, {
      terrace = false,
      terraceIntro = false,
      revealDuration = 1.15
    } = {}) {
      if (this.memoryTransition) return;
      this.resetInput();
      const host = document.createElement('div');
      host.className = 'campaign-memory-transition';
      host.setAttribute('aria-label', terrace ? '테라스 장면 전환' : '회상 장면 전환');
      this.host.classList.toggle('terrace-entering', terrace);
      host.setAttribute('role', 'status');
      host.style.opacity = '0';
      document.body.append(host);
      const d = {
        host,
        terrace,
        terraceIntro,
        revealDuration,
        bgmFrom: this.bgm.transitionGain,
        phase: 'out',
        time: 0,
        ready: false,
        commit,
        value: null,
        error: null
      };
      this.bgm.setTransitionGain(d.bgmFrom, 0);
      this.memoryTransition = d;
      this.view = 'memory-transition';
      this.host.inert = true;
      Promise.resolve().then(prepare).then(value => {
        if (this.memoryTransition === d) {
          d.value = value;
          d.ready = true;
        }
      }).catch(error => {
        if (this.memoryTransition === d) {
          d.error = error;
          d.ready = true;
        }
      });
    }
    cancelMemoryTransition() {
      this.memoryTransition?.host.remove();
      this.memoryTransition = null;
      this.host.classList.remove('terrace-entering');
      this.host.inert = false;
      this.bgm.setTransitionGain(1);
    }
    tickMemoryTransition(dt) {
      const d = this.memoryTransition;
      if (!d) return false;
      if (global.LunaFocusSettings.hiddenPaused) return true;
      const smooth = x => {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      };
      d.time += dt;
      if (d.phase === 'out') {
        const alpha = smooth(d.time / .9);
        d.host.style.opacity = alpha;
        this.bgm.setTransitionGain(d.bgmFrom * (1 - alpha), 0);
        if (d.time >= .9) {
          d.phase = 'hold';
          d.time = 0;
          d.host.style.opacity = '1';
        }
      } else if (d.phase === 'hold' && d.time >= .2 && d.ready) {
        if (d.error) {
          this.cancelMemoryTransition();
          this.loadError = (d.terrace ? '테라스를 불러오지 못했어요. ' : '회상을 불러오지 못했어요. ') + d.error.message;
          this.screen('load-error');
          return true;
        }
        try {
          d.commit(d.value);
        } catch (error) {
          this.cancelMemoryTransition();
          this.loadError = error.message;
          this.screen('load-error');
          return true;
        }
        if (this.memoryTransition !== d) return true;
        d.phase = 'in';
        d.time = 0;
        d.host.style.opacity = '1';
        this.bgm.setTransitionGain(0, 0);
      } else if (d.phase === 'in') {
        if (d.terraceIntro) {
          this.dialog.terraceEntryTime = Math.min(d.time, this.dialog.terraceEntryDuration);
          global.LunaTerrace.tick(this.dialog, dt);
          this.paintLine();
        }
        const amount = smooth(d.time / d.revealDuration);
        d.host.style.opacity = 1 - amount;
        this.bgm.setTransitionGain(amount, 0);
        if (d.time >= Math.max(d.revealDuration, d.terraceIntro ? this.dialog.terraceEntryDuration : 0)) {
          this.cancelMemoryTransition();
          this.resetInput();
          if (this.view === 'prologue') (this.host.querySelector('.world-choices .is-selected') || this.host.querySelector('button,select,input'))?.focus({
            preventScroll: true
          });
        }
      }
      return true;
    }
    playJohnnyMemory(done) {
      const terrace = this.dialog;
      this.retryLoad = () => {
        this.dialog = terrace;
        this.playJohnnyMemory(done);
      };
      this.beginMemoryTransition(() => global.LunaJohnnyMemory.prepare(this.D), () => {
        this.dialog = {
          rows: this.data.scenes.johnny,
          title: '조니의 기억',
          background: 'johnny-memory',
          index: 0,
          chars: 0,
          done: () => {
            this.beginMemoryTransition(() => null, () => {
              this.g.progress.flags.campaign_observation = true;
              if (this.session.carry) this.session.carry.flags.campaign_observation = true;
              this.dialog = terrace;
              done();
            }, {
              terrace: true,
              revealDuration: 1.8
            });
          }
        };
        this.screen('scene');
      });
    }
    playTerraceMemory(done, memoryKey = 'terraceMemory') {
      this.disposeCinema();
      this.token++;
      this.retryLoad = () => this.playTerraceMemory(done, memoryKey);
      this.beginMemoryTransition(async () => {
        const scripts = ['assets', 'sprites', 'stage', 'stage3', 'engine', 'sfx', 'terrace-memory', 'player'];
        for (const name of scripts) await this.script(name);
        await new Promise(resolve => global.Sprites.load(resolve));
        global.Engine.initAnchors?.();
        global.Engine.setLineOverrides({});
        global.Engine.setTypingScale(1);
        return global.buildTerraceMemory(this.data.scenes[memoryKey], {
          day3: memoryKey === 'terraceMemory3'
        });
      }, scene => {
        this.cinema = {
          scenes: [scene],
          index: 0,
          scene,
          time: 0,
          player: null,
          renderer: null,
          title: '유나와의 기억 · 폐기물 처리소',
          memoryKey,
          memory: true,
          returnTo: done
        };
        this.bgm.setSuppressed('cinema', true);
        this.screen('prologue');
        global.Sfx?.resume();
      });
    }
    releaseCinemaSkip() {
      this.cinemaHoldStart = null;
    }
    canSkipCinema() {
      // TV is the only exception to the no whole-cutscene-skip rule.
      return this.view === 'prologue' && !!this.cinema?.studio &&
        this.cinema.scene?.template === 'documentary' &&
        !this.memoryTransition && !this.dayTransition && !global.LunaFocusSettings.hiddenPaused;
    }
    tickCinemaDialogue(c, dt) {
      // Manual lines own their clock. Keep the scene alive, but never cross a
      // dialogue boundary until a fresh key press acknowledges that line.
      if (c.dialogueWait) {
        c.dialogueWait.age += dt;
        return;
      }
      const next = Math.min(c.scene.end, c.time + dt);
      const line = c.studio && c.scene.clips.filter(l => l.type === 'dialogue' && l.wait && l.start + l.duration > c.time && l.start <= next).sort((a, b) => a.start - b.start)[0];
      if (line) {
        c.time = Math.max(c.time, line.start);
        c.dialogueWait = {
          id: line.id,
          age: 0,
          revealed: false
        };
      } else c.time = next;
    }
    advanceCinemaDialogue() {
      const c = this.cinema,
        w = c?.dialogueWait;
      if (!w || c.dialogueChoice) return;
      const line = c.scene.clips.find(l => l.id === w.id),
        parsed = global.StudioTags.parse(line.text);
      if (global.StudioOpening?.typingPending(line, Math.max(0, c.time - line.start) + w.age)) return;
      const count = c.player.dialogueCount(line);
      if (!w.revealed && line.textEffect !== 'instant' && count < parsed.chars.length) w.revealed = true;else if (line.choiceAfter) {
        this.paintCinemaChoices();
        return;
      } else {
        if (line.introControls && !line.introFade) {
          const fade = c.scene.clips.find(l => l.introFade);
          if (fade) fade.introPhaseOffset = Math.max(0, c.time - line.start) + w.age;
        }
        c.time = line.start + line.duration + .001;
        c.dialogueWait = null;
      }
      // Finish in this input event, before drawing the timeline's empty end frame.
      if (c.returnTransition === 'cut' && !c.dialogueWait && c.time >= c.scene.end) {
        this.finishCinema();
        return;
      }
      c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait, c.effectTime);
      this.paintCinemaChoices();
    }
    paintCinemaChoices() {
      const c = this.cinema;
      if (this.view !== 'prologue' || !c?.studio) return;
      const line = c.dialogueWait && c.scene.clips.find(l => l.id === c.dialogueWait.id);
      if (line?.choiceAfter && !c.dialogueChoice && c.player.dialogueCount(line) >= global.StudioTags.parse(line.text).chars.length) c.dialogueChoice = {
        ...line.choiceAfter,
        state: {},
        lineId: line.id
      };
      const choice = c.dialogueChoice;
      if (!choice) {
        this.cinemaChoices?.update(null);
        return;
      }
      if (this.cinemaChoiceOwner !== choice) {
        this.cinemaChoices?.dispose();
        this.cinemaChoices = null;
        this.cinemaChoiceOwner = choice;
      }
      if (!this.cinemaChoices) this.cinemaChoices = global.LunaWorldChoices.create(this.host.querySelector('.campaign-stage'), id => {
        if (this.cinema !== c || this.view !== 'prologue' || c.dialogueChoice !== choice) return;
        const option = choice.options.find(o => o.id === id);
        if (!option) return;
        const response = c.scene.clips.find(l => l.choiceResponse === choice.id);
        if (response) response.text = option.label;
        const source = c.scene.clips.find(l => l.id === choice.lineId);
        c.dialogueChoice = null;
        c.dialogueWait = null;
        c.time = source.start + source.duration + .001;
        this.cinemaChoices.update(null);
        this.resetInput();
        c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, null, c.effectTime);
      }, choice.state);
      const sample = c.renderer.sample(c.time),
        actor = sample.actors[choice.actor],
        cam = sample.camera;
      if (!actor) return;
      const k = 1280 / cam.w,
        head = {
          x: 640 + (actor.x - cam.x) * k,
          y: 360 - (actor.y + .8 - cam.y) * k
        };
      this.cinemaChoices.update({
        ...choice,
        key: choice.id,
        head,
        facing: actor.facing
      });
    }
    paintCinemaSkip(dt = 0) {
      const allowed = this.canSkipCinema();
      if (!allowed) {
        this.releaseCinemaSkip();
      }
      const playing = this.view === 'prologue' && !this.memoryTransition && !this.dayTransition && !global.LunaFocusSettings.hiddenPaused;
      // This clock belongs to the cinematic, not its DOM or timeline. Redraws and
      // pause/resume cannot restart it, and loading/fades do not consume the hint.
      if (allowed && playing) this.cinema.skipHintAge = Math.min(CINEMA_SKIP_INTRO_SECONDS, (this.cinema.skipHintAge || 0) + Math.max(0, dt));
      const intro = allowed && playing && (this.cinema.skipHintAge || 0) < CINEMA_SKIP_INTRO_SECONDS;
      const held = allowed && this.cinemaHoldStart != null,
        elapsed = held ? Math.max(0, performance.now() - this.cinemaHoldStart) : 0,
        holdVisible = held && elapsed >= CINEMA_SKIP_REVEAL_MS,
        visible = intro || holdVisible;
      // Hold progress waits 300 ms even when the introduction is visible; total
      // hold time remains 2 seconds. Merely displaying the hint cannot skip.
      const progress = holdVisible ? Math.min(1, (elapsed - CINEMA_SKIP_REVEAL_MS) / (CINEMA_SKIP_HOLD_MS - CINEMA_SKIP_REVEAL_MS)) : 0,
        el = this.host.querySelector('.campaign-skip');
      if (el) {
        el.classList.add('is-compact');
        el.hidden = !allowed;
        el.classList.toggle('is-visible', visible);
        el.querySelector('span').textContent = '스페이스 바를 2초간 눌러 스킵';
        el.querySelector('i').style.transform = 'scaleX(' + progress + ')';
        el.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', Math.round(progress * 100));
      }
      return progress >= 1;
    }
    disposeCinema(keepMusicGain = false) {
      this.cinemaChoices?.dispose();
      this.cinemaChoices = null;
      if (!keepMusicGain) this.bgm.setTransitionGain(1);
      this.releaseCinemaSkip();
      this.cinema?.player?.dispose();
      this.cinema = null;
      global.Sfx?.silence();
      global.Sfx?.setEnabled(false);
      global.Sfx?.setLowpass(0);
      this.bgm.setSuppressed('cinema', false);
    }
    finishCinema(skipped = false) {
      if (this.memoryTransition || this.view !== 'prologue' || !this.cinema) return;
      if (skipped) {
        if (!this.canSkipCinema()) return;
        if (this.cinema.skipUntil != null) {
          // Skip the dream only. Restart at the hard cut to home, including the alarm,
          // blackout wake-up and every contact line; holding Space cannot skip again.
          const c = this.cinema;
          c.player.pause?.();
          c.time = c.skipUntil;
          this.releaseCinemaSkip();
          c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait, c.effectTime);
          this.paintCinemaSkip();
          return;
        }
      }
      if (this.cinema.returnTransition === 'cut' && this.cinema.returnTo) {
        const done = this.cinema.returnTo;
        this.resetInput();
        this.disposeCinema();
        done();
        return;
      }
      if (this.cinema.memory) {
        const done = this.cinema.returnTo;
        this.beginMemoryTransition(() => null, () => {
          this.disposeCinema(true);
          done();
        });
        return;
      }
      const returnTo = this.cinema.returnTo;
      if (returnTo) {
        this.disposeCinema();
        returnTo();
        return;
      }
      this.bgm.setTransitionGain(0);
      this.disposeCinema(true);
      this.session.beginDay(0);
      this.g.startStoryPhase('bar');
      this.awakening = {
        time: 0,
        duration: 3.3,
        fromWhite: !skipped
      };
      this.screen('awakening');
      this.render(true);
    }
    paintAwakening() {
      const w = this.awakening;
      if (!w) return;
      const smooth = x => {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
      };
      this.bgm.setTransitionGain(smooth(w.time / w.duration), 0);
      const dark = this.host.querySelector('.campaign-wake-dark'),
        white = this.host.querySelector('.campaign-wake-white');
      if (dark) dark.style.opacity = 1 - smooth((w.time - 1) / 2.3);
      if (white) white.style.opacity = w.fromWhite ? 1 - smooth(w.time / .7) : 0;
    }
    };
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaCampaignParts ||= {}).cinema = create;
})(typeof window === 'undefined' ? globalThis : window);
