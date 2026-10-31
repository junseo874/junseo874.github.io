(function (global) {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  const button = (label, action, cls = '') => '<button class="' + cls + '" data-campaign="' + action + '">' + (cls === 'title-choice' ? '<span class="title-label" data-text="' + esc(label) + '">' + esc(label) + '</span>' : label) + '</button>';
  const path = n => 'assets/backgrounds/campaign/' + n;
  const CINEMA_SKIP_HOLD_MS = 2000,
    CINEMA_SKIP_REVEAL_MS = 300,
    CINEMA_SKIP_INTRO_SECONDS = 1.5;
  class Campaign {
    constructor(adapter) {
      Object.assign(this, adapter);
      this.session = new global.LunaCampaignEngine.Session(this.g, this.D, global.LUNA_CAMPAIGN_DATA);
      this.session.onStep = s => this.storyStep(s);
      this.data = global.LUNA_CAMPAIGN_DATA;
      this.serviceVersion = 'A';
      this.view = 'picker';
      this.dialog = null;
      this.token = 0;
      this.loaded = new Set();
      this.scriptPromises = new Map();
      this.control = false;
      this.skipAge = 0;
      this.firstLift = false;
      this.morningSeen = new Set();
      this.nightStarted = false;
      this.host = document.createElement('section');
      this.host.id = 'campaign-root';
      this.host.setAttribute('aria-label', 'LUNA 본편');
      document.body.append(this.host);
      this.returnButton = document.createElement('button');
      this.returnButton.id = 'campaign-developer-back';
      this.returnButton.textContent = '← 플레이 모드 선택';
      this.returnButton.dataset.campaign = 'picker';
      this.returnButton.hidden = true;
      document.body.append(this.returnButton);
      this.host.addEventListener('click', e => {
        const b = e.target.closest('[data-campaign]');
        if (b) {
          if (!b.disabled) this.action(b.dataset.campaign);
          return;
        }
        if (e.button === 0 && this.view === 'prologue' && this.cinema?.dialogueWait && e.target.closest('.campaign-prologue,.studio-speech-layer')) {
          e.preventDefault();
          this.advanceCinemaDialogue();
        }
      });
      this.returnButton.onclick = () => this.toPicker();
      this.host.addEventListener('input', e => {
        const k = e.target.dataset.campaignInput;
        if (k === 'bgm') this.bgm.setVolume(Number(e.target.value) / 100);
        if (k === 'sfx') global.LunaSfx.setVolume(Number(e.target.value) / 100);
        if (k === 'speed') this.g.dialogSpeed = Number(e.target.value);
        const out = e.target.parentElement.querySelector('output');
        if (out) out.textContent = k === 'speed' ? e.target.value + '×' : e.target.value + '%';
      });
      this.fit = () => this.host.style.setProperty('--campaign-scale', Math.min(innerWidth / 1280, innerHeight / 720));
      window.addEventListener('resize', this.fit);
      this.fit();
      // Explicit simulator deep links remain useful; the normal entry always shows the two choices.
      const q = new URLSearchParams(location.search);
      if (q.has('mode') || q.has('version') || q.get('dev') === '1') this.developer();else this.draw();
    }
    get active() {
      return this.session.active && !this.session.developer;
    }
    get playView() {
      return this.session.developer ? 'developer' : 'game';
    }
    get blocking() {
      return !!this.dayTransition || this.view !== 'game' && this.view !== 'developer';
    }
    resetInput() {
      this.releaseCinemaSkip();
      this.clearInput();
      this.outside.clearInput?.();
      this.control = false;
      this.g.gimmick && (this.g.gimmick.held = false);
    }
    screen(view) {
      this.resetInput();
      if (view !== 'prologue') {
        this.cinema?.player?.pause?.();
        global.Sfx?.silence();
        global.Sfx?.setEnabled(false);
        global.Sfx?.setLowpass(0);
      }
      this.view = view;
      document.body.classList.toggle('campaign-cinematic', ['awakening', 'bar-door'].includes(view)||view==='prologue'&&!this.cinema?.dialogueWait&&!this.cinema?.dialogueChoice);
      this.host.classList.toggle('is-dev-console', view === 'dev-console');
      this.host.classList.toggle('over-outside', view === 'scene' && this.outside.active && !['terrace', 'black', 'johnny-memory'].includes(this.dialog?.background));
      this.host.hidden = !this.blocking;
      document.body.classList.toggle('campaign-main', this.active);
      document.body.classList.toggle('campaign-awakening', view === 'awakening');
      this.host.classList.toggle('is-awakening', view === 'awakening');
      this.app.inert = this.blocking;
      const outsideRoot = document.querySelector('#outside-root');
      if (outsideRoot) outsideRoot.inert = this.blocking;
      this.returnButton.hidden = view !== 'developer' || this.outside.active || this.g.phase !== 'ready';
      this.draw();
    }
    draw() {
      if (this.view === 'game' || this.view === 'developer') {
        this.host.hidden = true;
        return;
      }
      this.host.hidden = false;
      // Progress callbacks must not recreate the dots and restart their animation.
      if (this.view === 'loading' && this.host.querySelector('.view-loading .resource-loading')) return;
      let body = '';
      if (this.view === 'picker') body = '<div class="campaign-picker"><img class="picker-logo" src="' + path('title-logo.png') + '" alt="Project LUNA"><h1>어떤 방식으로 플레이할까요?</h1><div class="campaign-paths">' + button('<span>01 / STORY</span><strong>본편 플레이</strong><p>루나의 첫 출근부터, 네 번의 밤까지.</p>', 'title', 'story-path') + button('<span>02 / PLAYTEST</span><strong>개발자 시뮬레이터</strong><p>바 영업 · 기믹 · 외부 공간을 자유롭게 테스트합니다.</p>', 'developer', 'dev-path') + '</div></div>';
      if (this.view === 'bar-door') body = this.doorTransition?.artReady ? global.LunaBarDoor.html(this.doorTransition.direction) : '<div class="resource-loading" role="status" aria-label="로딩 중"><span class="resource-loading-copy">로딩 중<span class="resource-loading-dots"></span></span></div>';
      if (this.view === 'awakening') body = '<div class="campaign-wake-dark" aria-hidden="true"></div><div class="campaign-wake-white" aria-hidden="true"></div>';
      if (this.view === 'title') body = '<div class="campaign-title"><div class="title-logo"><img src="' + path('title-logo.png') + '" alt="Project LUNA"><canvas aria-hidden="true"></canvas></div>' + '<nav aria-label="타이틀 메뉴">' + button('새 게임', 'new', 'title-choice') + '<button class="title-choice" data-campaign="continue" disabled aria-disabled="true" aria-label="이어하기 (아직 지원하지 않음)"><span class="title-label" data-text="이어하기">이어하기</span></button>' + button('설정', 'options', 'title-choice') + button('종료', 'picker', 'title-choice') + '<span class="title-menu-index" aria-hidden="true">004</span></nav></div>';
      if (this.view === 'scene-choice') {
        const r = this.dialog.rows[this.dialog.index];
        body = this.card('대답 선택', r.options.map(o => button(esc(o.text), 'scene-choice:' + o.seq)).join(''));
      }
      if (this.view === 'loading') body = '<div class="resource-loading" role="status" aria-label="로딩 중"><span class="resource-loading-copy" aria-hidden="true">로딩 중<span class="resource-loading-dots"></span></span></div>';
      if (this.view === 'load-error') body = this.card('리소스를 불러오지 못했어요', '<p>' + esc(this.loadError) + '</p>' + button('다시 시도', 'retry-load') + button('타이틀로', 'title'));
      if (this.view === 'options') body = this.optionsHTML();
      if (this.view === 'dev-console') body = this.devConsoleHTML();
      if (this.view === 'confirm-exit') body = this.card('타이틀로 돌아갈까요?', '<p>진행 상황은 저장되지 않습니다.</p>' + button('계속 플레이', 'resume') + button('타이틀로 돌아가기', 'exit-run'));
      if (this.view === 'notice') body = this.card(this.noticeTitle || '안내', '<p>' + esc(this.noticeText).replace(/\n/g, '<br>') + '</p>' + button('확인', 'resume', 'primary'));
      if (this.view === 'retry-drink') body = this.card('주문을 다시 확인해 주세요', '<ul>' + this.drinkIssues.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' + button('판정 화면으로', 'resume') + button('다시 만들기', 'remake', 'primary'));
      if (this.view === 'menu') body = this.card('어떤 한 잔을 추천할까요?', '<p>' + esc(this.g.name(this.session.pendingStep?.actor || 'samho')) + '에게 제공할 칵테일을 골라 주세요.</p><div class="campaign-menu">' + this.g.cocktailsAvailable().map(c => button('<img src="' + esc(this.drinkSrc(c.id)) + '" alt=""><span>' + esc(this.g.name(c.id)) + '</span>', 'drink:' + c.id)).join('') + '</div>');
      if (this.view === 'response') body = this.card('어떻게 이야기를 이어갈까요?', button('삼호가 확인한 조건부터 들어볼까요?', 'response:A') + button('그쪽에서는 애니멀이 맡는 일이라고 생각하고 있나요?', 'response:B'));
      if (this.view === 'observation') body = this.card('조니의 관찰 메모', '<p>기억에서 직접 본 내용만 정리해 주세요.</p><div class="observation-fields"><label>고른 베이스<select id="observation-base"><option value="">선택</option><option value="gin">진</option><option value="rye">라이 위스키</option><option value="vodka">보드카</option></select></label><label>재료를 넣은 순서<select id="observation-order"><option value="">선택</option><option value="wrong">시럽 → 비터스 → 위스키</option><option value="right">위스키 → 시럽 → 비터스 → 스터</option></select></label></div><p class="campaign-error" role="alert">' + esc(this.observationError || '') + '</p>' + button('제조 기록 다시 보기', 'replay-memory') + button('준비 목록 완성', 'confirm-observation', 'primary'));
      if (this.view === 'scene') body = this.sceneHTML();
      if (this.view === 'prologue') body = '<canvas class="campaign-prologue" width="480" height="270" aria-label="' + esc(this.cinema?.title || '루나의 꿈 회상 컷씬') + '"></canvas><div class="campaign-cinema-ui"><div class="bubble"><div class="txt"><span class="ghost"></span><span class="vis"></span></div><i class="tail"></i></div></div><aside class="campaign-skip" aria-label="스페이스 바를 2초간 누르면 컷씬을 건너뜁니다"><span>스페이스 바를 눌러 스킵</span><div class="campaign-skip-track" role="progressbar" aria-label="컷씬 스킵" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></aside>';
      if (this.view === 'ending') body = '<div class="campaign-ending"><img src="' + path('title-logo.png') + '" alt="Project LUNA"><p>...조금 더 해보고 싶어요.</p><span>0—3일차 플레이 완료</span>' + button('타이틀로', 'exit-run') + '</div>';
      this.cinemaChoices?.dispose();
      this.cinemaChoices = null;
      this.host.innerHTML = '<div class="campaign-stage view-' + this.view + '">' + body + '</div>';
      if (this.view === 'dev-console') global.LunaCaptureMode?.mount(this.host.querySelector('.campaign-dev-console'));
      this.titleLogo = this.view === 'title' ? global.LunaTitleLogo.mount(this.host.querySelector('.title-logo')) : null;
      if (this.view === 'prologue' && this.cinema) {
        const c = this.cinema;
        c.player?.dispose();
        c.player = (c.studio ? global.LunaStudioCinema.player : global.LunaCinemaPlayer)(this.host.querySelector('canvas'), this.host.querySelector('.campaign-cinema-ui'), c.scene);
        c.renderer = c.player.renderer;
        c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait, c.effectTime);
        this.paintCinemaChoices();
        this.paintCinemaSkip();
        document.body.classList.toggle('campaign-cinematic', !c.dialogueWait&&!c.dialogueChoice);
      }
      if (this.view === 'scene') {
        if (this.dialog?.background !== 'terrace') this.host.querySelectorAll('.campaign-speech').forEach(el => global.LunaExteriorTextbox.attach(el, {
          tail: this.dialog.background === 'johnny-memory'
        }));
        this.paintLine();
        if (this.dialog?.background === 'johnny-memory') global.LunaJohnnyMemory.sync(this.host, this.dialog, this.D);
      }
      if (this.view === 'awakening') this.paintAwakening();
      (this.host.querySelector('.world-choices .is-selected') || this.host.querySelector('button,select,input'))?.focus({
        preventScroll: true
      });
    }
    card(title, content) {
      return '<div class="campaign-modal-shade"><section class="campaign-card" role="dialog" aria-modal="true"><h1>' + esc(title) + '</h1>' + content + '</section></div>';
    }
    devConsoleHTML() {
      return '<aside class="outside-dev-console campaign-dev-console" role="dialog" aria-modal="true" aria-label="본편 개발자 콘솔"><header><div><small>DEVELOPER · ' + this.session.day + '일차</small><h2>본편 개발자 콘솔</h2></div>' + button('P · 닫기', 'dev-close') + '</header><section><h3>외부 위치로 이동</h3>' + button('집 안', 'dev-home') + button('엘리베이터 앞 · 아래층', 'dev-elevator') + button('바 문 앞', 'dev-bar') + '</section><section><h3>현재 소지금</h3><output class="outside-dev-money" aria-live="polite">' + Math.max(0, Number(this.g.progress.money) || 0).toLocaleString('ko-KR') + '원</output><div class="outside-dev-money-actions">' + button('−1,000원', 'dev-minus') + button('+1,000원', 'dev-plus') + '</div></section><p class="outside-dev-note">콘솔을 연 동안 플레이가 일시 정지됩니다.<br>외부 이동 시 진행 중인 영업을 중단하고 같은 일차의 퇴근길로 이동합니다. 별도 정산은 하지 않습니다.<br>외부 콘솔에서 출근길·퇴근길을 변경할 수 있습니다.</p></aside>';
    }
    async devConsoleAction(action) {
      if (this.view !== 'dev-console') return;
      if (action === 'dev-close') {
        this.screen(this.devResumeView || 'game');
        this.render(true);
        return;
      }
      if (action === 'dev-plus' || action === 'dev-minus') {
        const before = Math.max(0, Number(this.g.progress.money) || 0),
          after = Math.max(0, before + (action === 'dev-plus' ? 1000 : -1000));
        this.g.progress.money = after;
        if (this.session.carry) this.session.carry.money = after;
        this.g.log('debug_money', {
          before,
          after,
          source: 'main-console'
        });
        this.g.changed();
        this.draw();
        this.host.querySelector('[data-campaign="' + action + '"]').focus();
        return;
      }
      if (!['dev-home', 'dev-elevator', 'dev-bar'].includes(action)) return;
      const token = ++this.token;
      this.resetInput();
      this.dialog = null;
      this.session.pendingStep = null;
      this.session.route = 'out';
      this.session.carry = JSON.parse(JSON.stringify(this.g.progress));
      this.nightStarted = false;
      this.liftLogoPending = false;
      this.loadLabel = '외부 테스트 위치로 이동하고 있습니다';
      this.screen('loading');
      Object.assign(this.outside.config, {
        day: this.session.day,
        flow: 'out',
        place: 'bar',
        variant: 'original'
      });
      this.retryLoad = () => {
        this.outside.exit(true);
        this.screen('dev-console');
        this.devConsoleAction(action);
      };
      try {
        await this.outside.start();
        if (token !== this.token) return;
        if (this.outside.loadError) throw Error(this.outside.loadError);
        this.screen('game');
        this.outside.openDev();
        this.outside.devAction(action);
      } catch (e) {
        if (token !== this.token) return;
        this.loadError = e.message;
        this.screen('load-error');
      }
    }
    optionsHTML() {
      return global.LunaSettings.html({
        context: this.resumeView === 'title' || this.resumeView === 'picker' ? 'title' : 'campaign',
        onClose: () => {
          this.action('resume');
          if (this.view === 'title') this.host.querySelector('[data-campaign=options]')?.focus();
        },
        exitLabel: '타이틀로',
        onExit: this.active ? () => this.action('exit-run') : null
      });
    }
    drinkSrc(id) {
      return (this.D.assets['recipe_cocktail_' + id] || this.D.assets['cocktail_' + id] || this.D.assets.item_old_fashioned).src;
    }
    portrait(actor) {
      const states = this.D.characterLayers[actor];
      if (!states) return '';
      const keys = states[Object.keys(states).find(k => k.endsWith('idle_default')) || Object.keys(states)[0]];
      return '<div class="campaign-portrait" aria-hidden="true">' + keys.map(k => {
        const a = this.D.assets[k];
        return '<span style="background-image:url(' + esc(a.src) + ');background-size:' + (a.frames || 1) * 100 + '% 100%"></span>';
      }).join('') + '</div>';
    }
    sceneHTML() {
      const c = this.dialog;
      if (c.background === 'johnny-memory') return global.LunaJohnnyMemory.html(c, this.D);
      const r = c.rows[c.index],
        textOnly = ['street', 'city', 'home'].includes(c.background);
      if (c.background === 'black') return '<div class="campaign-black-scene"><button class="campaign-speech" data-campaign="next" aria-label="다음 대사"><strong>' + esc(r.who || this.g.name(r.actor)) + '</strong><p><span class="campaign-measure" aria-hidden="true">' + esc(r.text) + '</span><span class="campaign-ink"></span></p></button></div>';
      if (c.background === 'terrace') return global.LunaTerrace.html(c);
      let image = c.background === 'home' && this.homeBackdrop ? this.homeBackdrop : c.background === 'city' && this.cityBackdrop ? this.cityBackdrop : c.background === 'street' && this.streetBackdrop ? this.streetBackdrop : c.background === 'lab' ? path('lab.png') : c.background === 'bar' ? this.D.assets.bar?.src || path('title-bg.png') : path('title-bg.png');
      return '<div class="campaign-story-bg ' + esc(c.background) + '" style="background-image:url(' + esc(image) + ')"></div><div class="campaign-scene-label">' + esc(c.title) + '</div>' + this.portrait(r.actor) + (c.memory ? '<aside class="campaign-memory-note"><small>조니의 제조 기록 · 배합 가안</small><strong>라이 위스키 45ml → 심플 시럽 5ml<br>→ 아로마틱 비터스 2ml → 스터</strong><span>올드패션드 잔 · 각 계량 허용 오차 ±5ml</span></aside>' : '') + '<button class="campaign-speech ' + (textOnly ? 'text-only ' : '') + (r.actor === 'luna' ? 'luna' : '') + '" data-campaign="next" aria-label="다음 대사">' + (textOnly ? '' : '<strong>' + esc(r.who || Object.entries(this.data.actors).find(([n, id]) => id === r.actor)?.[0] || '') + '</strong>') + '<p><span class="campaign-measure" aria-hidden="true">' + esc(r.text) + '</span><span class="campaign-ink"></span></p></button>';
    }
    paintLine() {
      if (!this.dialog) return;
      if (this.dialog.background === 'terrace') {
        global.LunaTerrace.paint(this.dialog, this.host);
        return;
      }
      const r = this.dialog.rows[this.dialog.index],
        paragraph = this.host.querySelector('.campaign-speech p');
      if (paragraph) {
        if (paragraph.dataset.line !== r.text) {
          paragraph.dataset.line = r.text;
          global.LunaExteriorTextbox.mountText(paragraph, r.text, r.emphasis || []);
        }
        global.LunaExteriorTextbox.revealText(paragraph, Array.from(r.text.slice(0, Math.floor(this.dialog.chars))).length);
        global.LunaDialogueCue.sync(paragraph.closest('.campaign-speech'), !!r.text && this.dialog.chars >= r.text.length);
      }
    }
    scene(key, title, background, done, extra = {}) {
      const terrace = key === 'night0' || key === 'ending' || background === 'terrace';
      if (terrace) background = 'terrace';
      const rows = Array.isArray(key) ? key : terrace ? global.LunaTerrace.rows(key, this.data) : this.data.scenes[key];
      if (!rows?.length) throw Error('없는 본편 장면: ' + key);
      this.dialog = {
        rows,
        title,
        background,
        done,
        index: 0,
        chars: 0,
        ...extra,
        homeToTerrace: false
      };
      if (terrace) {
        const source = this.outside.active ? this.outside.model : null;
        this.dialog.terraceWeather = {scene:'street',config:{day:source?.config.day ?? this.session.day,flow:source?.config.flow ?? 'in'}};
        this.dialog.terraceWeatherTime = source?.time || 0;
        this.retryLoad = () => this.scene(key, title, background, done, extra);
        this.beginMemoryTransition(() => global.LunaTerrace.prepare(), () => {
          global.LunaTerrace.beginEntrance(this.dialog);
          this.screen('scene');
        }, {
          terrace: true,
          terraceIntro: true,
          revealDuration: 1.8
        });
      } else this.screen('scene');
    }
    next() {
      if (this.dayTransition || this.memoryTransition) return;
      if (this.view === 'prologue') return;
      if (this.view !== 'scene') return;
      const c = this.dialog,
        r = c.rows[c.index];
      if (c.chars < r.text.length) {
        c.chars = r.text.length;
        this.paintLine();
        return;
      }
      c.index++;
      c.chars = 0;
      if (r.cinemaAfter === 'johnny-memory') {
        this.playJohnnyMemory(() => {
          if (this.dialog === c) this.continueScene();
        });
        return;
      }
      if (r.cinemaAfter === 'terrace-memory') {
        this.playTerraceMemory(() => {
          if (this.dialog === c) this.continueScene();
        }, r.memoryKey || 'terraceMemory');
        return;
      }
      this.continueScene();
    }
    continueScene() {
      const c = this.dialog;
      if (!c) return;
      while (c.index < c.rows.length) {
        const r = c.rows[c.index];
        if (r.when) {
          if (!global.LunaCore.condition(r.when, this.g.ctx())) {
            c.index++;
            continue;
          }
        }
        if (r.type === 'choice') {
          this.screen('scene-choice');
          return;
        }
        // Keep the terrace's live canvases when only the spoken line changes.
        if (this.view === 'scene' && c.background === 'terrace' && this.host.querySelector('.terrace-scene')) this.paintLine();
        else if (this.view === 'scene') this.draw();else this.screen('scene');
        return;
      }
      this.dialog = null;
      c.done();
    }

    // A single overlay owns both halves of a memory transition; scene redraws cannot reset it.

    tick(dt) {
      if (this.view === 'title') this.titleLogo?.tick(Math.min(.05, Math.max(0, dt)));
      dt = Math.min(.05, Math.max(0, dt));
      if (this.memoryTransition) return this.tickMemoryTransition(dt);
      if (this.outside.active && this.outside.devConsoleOpen && !this.blocking) return false;
      if (this.doorTransition) return this.tickDoorTransition(dt);
      if (this.dayTransition) return this.tickDayTransition(dt);
      this.returnButton.hidden = this.view !== 'developer' || this.outside.active || this.g.phase !== 'ready';
      if (this.view === 'scene' && !global.LunaFocusSettings.hiddenPaused) {
        if (this.dialog.background === 'terrace') global.LunaTerrace.tick(this.dialog, dt);
        const before = this.dialog.chars;
        global.LunaOutsideStory.sceneTyping(this.dialog, dt);
        global.LunaDialogueAudio?.reveal(this.dialog.rows[this.dialog.index].text, before, this.dialog.chars);
        this.paintLine();
        if (this.dialog.background === 'johnny-memory') global.LunaJohnnyMemory.sync(this.host, this.dialog, this.D, dt);
        // D08: campaign/exterior scenes advance through next(), not Ctrl repeat.
      }
      if (this.view === 'prologue' && !global.LunaFocusSettings.hiddenPaused) {
        const c = this.cinema,
          previous = c.time;
        // Persist on the cinematic so redraws and settings resume keep the
        // same TV reception phase. Only active gameplay advances this clock.
        if (c.scene.template === 'documentary') c.effectTime = (c.effectTime ?? c.time) + Math.max(0, dt);
        this.tickCinemaDialogue(c, dt);
        document.body.classList.toggle('campaign-cinematic', !c.dialogueWait&&!c.dialogueChoice);
        // A completed holo shutdown returns before drawing the timeline's empty end frame.
        if (c.returnTransition === 'cut' && !c.dialogueWait && c.time >= c.scene.end) {
          this.finishCinema();
          return this.blocking;
        }
        c.player.render(c.time, previous, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait, c.effectTime);
        this.paintCinemaChoices();
        if (this.paintCinemaSkip(dt)) {
          this.finishCinema(true);
          return this.blocking;
        }
        if (c.time >= c.scene.end) {
          if (++c.index < c.scenes.length) {
            c.scene = c.scenes[c.index];
            c.time = 0;
            global.Sfx?.silence();
            this.draw();
          } else this.finishCinema();
        }
      }
      if (this.view === 'awakening' && !global.LunaFocusSettings.hiddenPaused) {
        this.awakening.time += dt;
        this.paintAwakening();
        if (this.awakening.time >= this.awakening.duration) {
          this.awakening = null;
          this.screen(this.playView);
          this.render(true);
        }
      }
      if (this.session.developer && this.view === 'developer' && this.outside.active && !this.outside.loading) {
        const m = this.outside.model;
        if (!m.qa && !m.paused && !m.ride && !m.transition && !m.dialog && !m.story.blocking && m.config.flow === 'in' && m.config.day === 3 && m.scene === 'street' && m.level === 0 && Math.abs(m.x + 5.99) < .7 && !m.notionCommuteSeen) this.previewCommute(m);
      }
      if ((this.active || this.session.developer) && this.view === this.playView && this.outside.active && !this.outside.loading) {
        const m = this.outside.model;
        let reveal = document.querySelector('#campaign-lift-reveal');
        const show = this.liftLogoPending && m.config.day === 0 && m.config.flow === 'out' && m.ride?.titleReveal && !m.ride.call && m.ride.to > m.ride.from && m.ride.time > 3 && m.ride.time < 10;
        if (show && !reveal) {
          reveal = document.createElement('div');
          reveal.id = 'campaign-lift-reveal';
          const shade = document.createElement('div');
          shade.className = 'campaign-lift-shade';
          shade.setAttribute('aria-hidden', 'true');
          const logo = document.createElement('img');
          logo.id = 'campaign-lift-logo';
          logo.src = path('title-logo.png');
          logo.alt = 'Project LUNA';
          const team = document.createElement('div');
          team.className = 'campaign-lift-team';
          team.textContent = 'Team. SimChung';
          reveal.append(shade, logo, team);
          document.querySelector('.outside-stage').append(reveal);
        }
        if (show) {
          this.firstLift = true;
          m.liftLogoSeen = true;
          reveal.style.opacity = Math.max(0, Math.min(1, (m.ride.time - 3) / 1.5, (10 - m.ride.time) / 1.5));
        } else reveal?.remove();
        if (this.liftLogoPending && !m.ride) this.liftLogoPending = false;
      } else document.querySelector('#campaign-lift-reveal')?.remove();
      return this.blocking;
    }
    intercept(name) {
      if (!this.active) {
        if (this.session.developer && name === 'offer') {
          const issues = this.session.problems(this.g.result);
          if (issues.length) {
            this.drinkIssues = issues;
            this.resumeView = 'developer';
            this.screen('retry-drink');
            return true;
          }
        }
        return false;
      }
      if (['inspector', 'debugEndDay', 'debugFill', 'debugCraft', 'version', 'start', 'applyUpkeep', 'export'].includes(name)) return true;
      if (name === 'settings' || name === 'help') {
        this.resumeView = 'game';
        this.screen('options');
        return true;
      }
      if (name === 'setup') {
        this.resumeView = 'game';
        this.screen('confirm-exit');
        return true;
      }
      if (name === 'confirmSettlement') {
        this.leaveBar();
        return true;
      }
      if (name === 'retryDay') {
        this.session.retry();
        this.screen(this.playView);
        this.render(true);
        return true;
      }
      if (name === 'offer') {
        const issues = this.session.problems(this.g.result);
        if (issues.length) {
          this.drinkIssues = issues;
          this.resumeView = 'game';
          this.screen('retry-drink');
          return true;
        }
      }
      return false;
    }
    toPicker() {
      this.cancelMemoryTransition();
      this.cancelDayTransition();
      this.cancelDoorTransition();
      this.disposeCinema();
      this.token++;
      this.outside.exit(true);
      this.session.uninstall();
      this.storyVersion = 'A';
      this.data = global.LUNA_CAMPAIGN_DATA;
      this.dialog = null;
      this.cinema = null;
      this.awakening = null;
      this.g.reset(0, 'full', 1, false, {
        variant: 'original'
      });
      this.app.hidden = false;
      this.screen('picker');
    }
    developer() {
      this.cancelMemoryTransition();
      this.cancelDayTransition();
      this.cancelDoorTransition();
      this.disposeCinema();
      this.token++;
      if (this.outside.active) this.outside.exit(true);
      this.session.uninstall();
      this.storyVersion = 'A';
      this.data = global.LUNA_CAMPAIGN_DATA;
      this.session.story = this.data;
      this.session.install({
        developer: true,
        serviceVersion: this.ui.serviceVersion
      });
      this.g.reset(this.ui.day, this.ui.mode, this.ui.seed, false, {
        variant: this.ui.variant,
        serviceVersion: this.ui.serviceVersion
      });
      this.app.hidden = false;
      this.screen('developer');
      this.render(true);
      global.LunaUpdates.mount();
    }
    action(a) {
      if (global.LunaCutsceneLibrary?.action(a)) return;
      if (this.memoryTransition && a !== 'picker') return;
      if (a.startsWith('scene-choice:')) {
        const c = this.dialog,
          r = c?.rows[c.index],
          seq = Number(a.slice(13));
        if (this.view !== 'scene-choice' || !r.options.some(o => o.seq === seq)) return;
        this.g.progress.flags[r.arg] = seq === 1;
        c.index++;
        c.chars = 0;
        this.continueScene();
        return;
      }
      if (a.startsWith('dev-')) {
        this.devConsoleAction(a);
        return;
      }
      if (a === 'title') {
        this.screen('title');
        return;
      }
      if (a === 'picker') {
        this.toPicker();
        return;
      }
      if (a === 'developer') {
        this.developer();
        return;
      }
      if (a === 'new') {
        this.newGame();
        return;
      }
      if (a === 'retry-load') {
        this.retryLoad();
        return;
      }
      if (a === 'options') {
        this.resumeView = this.view;
        this.screen('options');
        return;
      }
      if (a === 'music-toggle') {
        this.bgm.setEnabled(!this.bgm.enabled);
        this.draw();
        return;
      }
      if (a === 'resume') {
        if (this.outside.active) this.outside.model.paused = false;
        this.screen(this.resumeView || 'title');
        return;
      }
      if (a === 'ask-exit') {
        this.screen('confirm-exit');
        return;
      }
      if (a === 'exit-run') {
        this.toPicker();
        this.screen('title');
        return;
      }
      if (a === 'next') {
        this.next();
        return;
      }
      if (a === 'remake') {
        this.g.cancelCraft();
        this.g.selectCocktail(this.g.currentOrder.cocktail);
        this.ui.tab = 'glass';
        this.ui.recipeOpen = false;
        this.ui.hoverItem = null;
        this.screen(this.playView);
        this.render(true);
        return;
      }
      if (a.startsWith('drink:')) {
        const id = a.slice(6);
        if (!this.g.cocktailsAvailable().some(c => c.id === id)) return;
        this.g.progress.flags.campaign_selected_drink = id;
        this.screen(this.playView);
        this.session.finishStep();
        this.render(true);
        return;
      }
      if (a.startsWith('response:')) {
        this.g.progress.flags.campaign_response = a.slice(9);
        this.scene('response' + a.slice(9), '바 · 삼호의 선택', 'bar', () => {
          this.screen(this.playView);
          this.session.finishStep();
          this.render(true);
        });
        return;
      }
      if (a === 'replay-memory') {
        this.scene('johnny', '조니의 기억', 'bar', () => this.memoryQuiz(), {
          memory: true
        });
        return;
      }
      if (a === 'confirm-observation') {
        if (this.host.querySelector('#observation-base').value !== 'rye' || this.host.querySelector('#observation-order').value !== 'right') {
          this.observationError = '기록과 다른 항목이 있어요. 제조 기록을 다시 확인해 주세요.';
          this.draw();
          return;
        }
        this.completeMemory();
      }
    }
    key(e) {
      if (global.LunaCutsceneLibrary?.key(e)) return true;
      if (this.memoryTransition || this.dayTransition || this.doorTransition) return true;
      if (['game', 'developer'].includes(this.view) && this.outside.controlsTutorialKey?.(e)) return true;
      if (this.g.overlay === 'johnnyUnlock' && !this.blocking) return false;
      if (this.active && e.code === 'KeyP' && !e.metaKey && !e.ctrlKey && !e.altKey && ['game', 'dev-console'].includes(this.view) && !this.outside.active) {
        if (!e.repeat) {
          if (this.view === 'dev-console') this.devConsoleAction('dev-close');else {
            this.devResumeView = this.view;
            this.screen('dev-console');
          }
        }
        return true;
      }
      if (this.view === 'dev-console' && ['Space', 'Enter'].includes(e.code)) {
        if (!e.repeat) e.target.closest('#campaign-root button')?.click();
        return true;
      }
      if (this.view === 'dev-console' && e.code === 'Escape') {
        if (!e.repeat) this.devConsoleAction('dev-close');
        return true;
      }
      if (this.outside.active && this.outside.devConsoleOpen && !this.blocking) return false;
      if (this.view === 'game' && e.code === 'Escape' && this.g.gimmick?.pourTestsOpen) return false;
      // The exterior owns its topmost cancellable interaction, then its menu.
      if (this.outside.active && !this.blocking && e.code === 'Escape') return false;
      // Let the bar close the visible recipe before the capture-phase campaign
      // handler opens options. The next distinct Escape can open settings.
      if (this.view === 'game' && !this.outside.active && e.code === 'Escape' &&
          (this.g.screen === 'recipe' || this.g.overlay || this.g.screen === 'prep' && this.ui.recipeOpen)) return false;
      if (this.view === 'prologue') {
        global.Sfx?.resume();
        if (this.cinema?.studio) global.LunaStudioCinema.unlock();
      }
      if (!this.active && !this.blocking) return false;
      if (e.code === 'F2') return true;
      if (e.code === 'Escape') {
        if (!e.repeat) {
          if (['options', 'notice', 'retry-drink'].includes(this.view)) this.action('resume');else if (this.view === 'confirm-exit') this.action('resume');else if (this.view === 'title') this.toPicker();else if (!['picker', 'loading', 'load-error', 'ending'].includes(this.view)) {
            this.resumeView = this.view;
            this.screen('options');
          }
        }
        return true;
      }
      if (!this.blocking) return false;
      if (this.view === 'prologue' && this.cinema?.dialogueChoice) {
        this.cinemaChoices?.key(e);
        return true;
      }
      if (this.view === 'prologue') {
        if (!e.repeat && ['KeyE', 'Space', 'Enter'].includes(e.code) && this.cinema?.dialogueWait) {
          this.advanceCinemaDialogue();
          if (e.code === 'Space' && this.cinema?.scene.template === 'documentary' && this.canSkipCinema()) {
            this.cinemaHoldStart = performance.now();
            this.paintCinemaSkip();
          }
          return true;
        }
        if (e.code === 'Space' && !e.repeat && this.canSkipCinema()) {
          this.cinemaHoldStart = performance.now();
          this.paintCinemaSkip();
        }
        return true;
      }
      if (e.code.startsWith('Control')) {
        this.control = true;
        return true;
      }
      if (e.code === 'Tab') {
        const list = [...this.host.querySelectorAll('button:not(:disabled),input,select,summary')].filter(x => x.getClientRects().length);
        const i = list.indexOf(document.activeElement);
        if (list.length) list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
        return true;
      }
      if (['KeyE', 'Space', 'Enter'].includes(e.code) && ['scene', 'prologue'].includes(this.view)) {
        if (!e.repeat) this.next();
        return true;
      }
      if (['ArrowUp', 'ArrowDown'].includes(e.code) && ['title', 'picker'].includes(this.view)) {
        const list = [...this.host.querySelectorAll('button')],
          i = list.indexOf(document.activeElement);
        list[(i + (e.code === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
        return true;
      }
      return !['Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) || !e.target.closest('#campaign-root');
    }
  }
  // Registered before the simulator's capture handlers, so hidden scenes never consume input.
  document.addEventListener('click', e => {
    const c = global.lunaCampaign,
      b = e.target.closest('[data-outside-action]');
    if (!c?.active || !b) return;
    if (b.dataset.outsideAction === 'exit') {
      e.preventDefault();
      e.stopImmediatePropagation();
      c.resumeView = 'game';
      c.screen('confirm-exit');
    } else if (b.dataset.outsideAction === 'retry') {
      e.preventDefault();
      e.stopImmediatePropagation();
      c.outside.exit(true);
      c.outside.start();
    }
  }, true);
  window.addEventListener('keydown', e => {
    if (global.lunaCampaign?.key(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener('keyup', e => {
    if (e.code === 'Space' && global.lunaCampaign) {
      global.lunaCampaign.releaseCinemaSkip();
      if (global.lunaCampaign.view === 'prologue') global.lunaCampaign.paintCinemaSkip();
    }
    if (e.code.startsWith('Control') && global.lunaCampaign) global.lunaCampaign.control = false;
  }, true);
  window.addEventListener('blur', () => {
    const c = global.lunaCampaign;
    if (!c) return;
    c.control = false;
    if (global.LunaFocusSettings.enabled && c.active && !c.memoryTransition && ['game', 'scene', 'prologue', 'awakening'].includes(c.view)) {
      c.resumeView = c.view;
      c.screen('options');
    }
  });
  document.addEventListener('visibilitychange', () => {
    const c = global.lunaCampaign;
    if (document.hidden && c) {
      c.releaseCinemaSkip();
      if (global.LunaFocusSettings.enabled && c.active && !c.memoryTransition && ['game', 'scene', 'prologue', 'awakening'].includes(c.view)) {
        c.resumeView = c.view;
        c.screen('options');
      }
    }
  });

  // Feature methods are installed once, before any instance is created.
  {
    const create = typeof module === 'undefined' ? global.LunaCampaignParts.cinema : require('./cinema-flow.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ CINEMA_SKIP_HOLD_MS, CINEMA_SKIP_INTRO_SECONDS, CINEMA_SKIP_REVEAL_MS, global }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Campaign.prototype, descriptors);
  }
  {
    const create = typeof module === 'undefined' ? global.LunaCampaignParts.day : require('./day-flow.js');
    const descriptors = Object.getOwnPropertyDescriptors(create({ global }).prototype);
    delete descriptors.constructor;
    Object.defineProperties(Campaign.prototype, descriptors);
  }
  global.LunaCampaign = {
    create: a => new Campaign(a)
  };
})(window);
