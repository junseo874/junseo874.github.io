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
      if (this.view === 'bar-door') body = global.LunaBarDoor.html(this.doorTransition?.direction || 'in');
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
      if (this.view === 'sleep') body = this.card('하루를 마칠까요?', '<p>오늘의 이야기를 마치고 휴식을 취합니다.</p>' + button('조금 더 둘러보기', 'resume') + button('하루 마치기', 'sleep-confirm', 'primary'));
      if (this.view === 'notice') body = this.card(this.noticeTitle || '안내', '<p>' + esc(this.noticeText).replace(/\n/g, '<br>') + '</p>' + button('확인', 'resume', 'primary'));
      if (this.view === 'retry-drink') body = this.card('주문을 다시 확인해 주세요', '<ul>' + this.drinkIssues.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' + button('판정 화면으로', 'resume') + button('다시 만들기', 'remake', 'primary'));
      if (this.view === 'menu') body = this.card('어떤 한 잔을 추천할까요?', '<p>' + esc(this.g.name(this.session.pendingStep?.actor || 'samho')) + '에게 제공할 칵테일을 골라 주세요.</p><div class="campaign-menu">' + this.g.cocktailsAvailable().map(c => button('<img src="' + esc(this.drinkSrc(c.id)) + '" alt=""><span>' + esc(this.g.name(c.id)) + '</span>', 'drink:' + c.id)).join('') + '</div>');
      if (this.view === 'response') body = this.card('어떻게 이야기를 이어갈까요?', button('삼호가 확인한 조건부터 들어볼까요?', 'response:A') + button('그쪽에서는 애니멀이 맡는 일이라고 생각하고 있나요?', 'response:B'));
      if (this.view === 'observation') body = this.card('조니의 관찰 메모', '<p>기억에서 직접 본 내용만 정리해 주세요.</p><div class="observation-fields"><label>고른 베이스<select id="observation-base"><option value="">선택</option><option value="gin">진</option><option value="rye">라이 위스키</option><option value="vodka">보드카</option></select></label><label>재료를 넣은 순서<select id="observation-order"><option value="">선택</option><option value="wrong">시럽 → 비터스 → 위스키</option><option value="right">위스키 → 시럽 → 비터스 → 스터</option></select></label></div><p class="campaign-error" role="alert">' + esc(this.observationError || '') + '</p>' + button('제조 기록 다시 보기', 'replay-memory') + button('준비 목록 완성', 'confirm-observation', 'primary'));
      if (this.view === 'scene') body = this.sceneHTML();
      if (this.view === 'prologue') body = '<canvas class="campaign-prologue" width="480" height="270" aria-label="' + esc(this.cinema?.title || '루나의 꿈 회상 컷씬') + '"></canvas><div class="campaign-cinema-ui"><div class="bubble"><div class="txt"><span class="ghost"></span><span class="vis"></span></div><i class="tail"></i></div></div><aside class="campaign-skip" aria-label="스페이스 바를 2초간 누르면 컷씬을 건너뜁니다"><span>스페이스 바를 눌러 스킵</span><div class="campaign-skip-track" role="progressbar" aria-label="컷씬 스킵" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></aside>';
      if (this.view === 'ending') body = '<div class="campaign-ending"><img src="' + path('title-logo.png') + '" alt="Project LUNA"><p>…조금 더 해보고 싶어요.</p><span>0—3일차 플레이 완료</span>' + button('타이틀로', 'exit-run') + '</div>';
      this.cinemaChoices?.dispose();
      this.cinemaChoices = null;
      this.host.innerHTML = '<div class="campaign-stage view-' + this.view + '">' + body + '</div>';
      this.titleLogo = this.view === 'title' ? global.LunaTitleLogo.mount(this.host.querySelector('.title-logo')) : null;
      if (this.view === 'prologue' && this.cinema) {
        const c = this.cinema;
        c.player?.dispose();
        c.player = (c.studio ? global.LunaStudioCinema.player : global.LunaCinemaPlayer)(this.host.querySelector('canvas'), this.host.querySelector('.campaign-cinema-ui'), c.scene);
        c.renderer = c.player.renderer;
        c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait);
        this.paintCinemaChoices();
        this.paintCinemaSkip();
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
        this.retryLoad = () => this.scene(key, title, background, done, extra);
        this.beginMemoryTransition(() => global.LunaTerrace.prepare(), () => this.screen('scene'), {
          terrace: true,
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
        if (this.view === 'scene') this.draw();else this.screen('scene');
        return;
      }
      this.dialog = null;
      c.done();
    }
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
      return new Promise((resolve, reject) => {
        const im = new Image(),
          timer = setTimeout(() => reject(Error(src)), 20000);
        im.onload = () => {
          clearTimeout(timer);
          this.loaded.add(src);
          resolve();
        };
        im.onerror = () => {
          clearTimeout(timer);
          reject(Error(src));
        };
        im.src = src;
      });
    }
    script(name) {
      if (this.scriptPromises.has(name)) return this.scriptPromises.get(name);
      const p = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'src/cinema/' + name + '.js?v=' + (name === 'studio-player' ? 'ink-fit-20261019' : name === 'player' ? 'ink-fit-20261019' : name === 'terrace-memory' ? 'day3-notion-20261004' : 'dream-opening-1');
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
    // A single overlay owns both halves of a memory transition; scene redraws cannot reset it.
    beginMemoryTransition(prepare, commit, {
      terrace = false,
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
        const amount = smooth(d.time / d.revealDuration);
        d.host.style.opacity = 1 - amount;
        this.bgm.setTransitionGain(amount, 0);
        if (d.time >= d.revealDuration) {
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
      const c = this.cinema;
      return !!c && (c.skipUntil == null || c.time < c.skipUntil);
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
      c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait);
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
        c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, null);
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
          c.player.render(c.time, null, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait);
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
    startBar(day, carry) {
      this.runDoorTransition('in', () => Promise.all(Object.values(this.D.assets).map(a => a.src).filter(src => /\.(png|webp|gif|jpe?g)(?:\?|$)/i.test(src)).map(src => this.image(src))), () => {
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
      Promise.all([Promise.all(global.LunaBarDoor.assets.map(src => this.image(src))), Promise.resolve().then(() => {
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
        this.playDayZeroTV(model);
        return true;
      }
      // Check on boarding the upward homeward lift, not when calling it or leaving home.
      if ((this.active || this.session.developer) && target.id === 'elevator' && model.scene === 'street' && model.level === 0 && model.config.flow === 'out' && Math.abs(model.elevatorY - global.LunaResidence.layout.elevatorBottom) <= .01) {
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
        if (this.session.route === 'out') {
          this.resumeView = 'game';
          this.screen('sleep');
        }
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
      this.notice('아직 해야 할 일이 남아 있습니다.\n확인할 항목: ' + labels.join(' · ') + '\n필요한 재료는 거리의 시BAR에게서 구할 수 있습니다.', '집에 올라가기 전에');
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
      const complete = () => {
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
      // Player-only interlude: no Luna knowledge/relationship flags are changed here.
      if (day === 1 && this.data.scenes.workshop?.length) this.beginMemoryTransition(() => null, () => this.scene('workshop', '포트의 작업장', 'black', terrace));else terrace();
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
      if (this.nightStarted || !this.active || this.view !== 'sleep' || this.session.route !== 'out' || this.dayTransition) return;
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
        this.dialog.chars += dt * 60 * this.g.dialogSpeed;
        global.LunaDialogueAudio?.reveal(this.dialog.rows[this.dialog.index].text, before, this.dialog.chars);
        this.paintLine();
        if (this.dialog.background === 'johnny-memory') global.LunaJohnnyMemory.sync(this.host, this.dialog, this.D, dt);
        if (this.control) {
          this.skipAge += dt;
          if (this.skipAge > .12) {
            this.skipAge = 0;
            this.next();
          }
        }
      }
      if (this.view === 'prologue' && !global.LunaFocusSettings.hiddenPaused) {
        const c = this.cinema,
          previous = c.time;
        this.tickCinemaDialogue(c, dt);
        // A completed holo shutdown returns before drawing the timeline's empty end frame.
        if (c.returnTransition === 'cut' && !c.dialogueWait && c.time >= c.scene.end) {
          this.finishCinema();
          return this.blocking;
        }
        c.player.render(c.time, previous, this.ui.gimmickAudio, global.LunaSfx.volume * .55, c.dialogueWait);
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
      if (a === 'sleep-confirm') {
        this.sleep();
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
      if (this.view === 'prologue') {
        global.Sfx?.resume();
        if (this.cinema?.studio) global.LunaStudioCinema.unlock();
      }
      if (!this.active && !this.blocking) return false;
      if (e.code === 'F2') return true;
      if (e.code === 'Escape') {
        if (!e.repeat) {
          if (['options', 'notice', 'sleep', 'retry-drink'].includes(this.view)) this.action('resume');else if (this.view === 'confirm-exit') this.action('resume');else if (this.view === 'title') this.toPicker();else if (!['picker', 'loading', 'load-error', 'ending'].includes(this.view)) {
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
  global.LunaCampaign = {
    create: a => new Campaign(a)
  };
})(window);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJnbG9iYWwiLCJlc2MiLCJzIiwiU3RyaW5nIiwicmVwbGFjZSIsImMiLCJidXR0b24iLCJsYWJlbCIsImFjdGlvbiIsImNscyIsInBhdGgiLCJuIiwiQ0lORU1BX1NLSVBfSE9MRF9NUyIsIkNJTkVNQV9TS0lQX1JFVkVBTF9NUyIsIkNJTkVNQV9TS0lQX0lOVFJPX1NFQ09ORFMiLCJDYW1wYWlnbiIsImNvbnN0cnVjdG9yIiwiYWRhcHRlciIsIk9iamVjdCIsImFzc2lnbiIsInNlc3Npb24iLCJMdW5hQ2FtcGFpZ25FbmdpbmUiLCJTZXNzaW9uIiwiZyIsIkQiLCJMVU5BX0NBTVBBSUdOX0RBVEEiLCJvblN0ZXAiLCJzdG9yeVN0ZXAiLCJkYXRhIiwic2VydmljZVZlcnNpb24iLCJ2aWV3IiwiZGlhbG9nIiwidG9rZW4iLCJsb2FkZWQiLCJTZXQiLCJzY3JpcHRQcm9taXNlcyIsIk1hcCIsImNvbnRyb2wiLCJza2lwQWdlIiwiZmlyc3RMaWZ0IiwibW9ybmluZ1NlZW4iLCJuaWdodFN0YXJ0ZWQiLCJob3N0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiaWQiLCJzZXRBdHRyaWJ1dGUiLCJib2R5IiwiYXBwZW5kIiwicmV0dXJuQnV0dG9uIiwidGV4dENvbnRlbnQiLCJkYXRhc2V0IiwiY2FtcGFpZ24iLCJoaWRkZW4iLCJhZGRFdmVudExpc3RlbmVyIiwiZSIsImIiLCJ0YXJnZXQiLCJjbG9zZXN0IiwiZGlzYWJsZWQiLCJjaW5lbWEiLCJkaWFsb2d1ZVdhaXQiLCJwcmV2ZW50RGVmYXVsdCIsImFkdmFuY2VDaW5lbWFEaWFsb2d1ZSIsIm9uY2xpY2siLCJ0b1BpY2tlciIsImsiLCJjYW1wYWlnbklucHV0IiwiYmdtIiwic2V0Vm9sdW1lIiwiTnVtYmVyIiwidmFsdWUiLCJMdW5hU2Z4IiwiZGlhbG9nU3BlZWQiLCJvdXQiLCJwYXJlbnRFbGVtZW50IiwicXVlcnlTZWxlY3RvciIsImZpdCIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJNYXRoIiwibWluIiwiaW5uZXJXaWR0aCIsImlubmVySGVpZ2h0Iiwid2luZG93IiwicSIsIlVSTFNlYXJjaFBhcmFtcyIsImxvY2F0aW9uIiwic2VhcmNoIiwiaGFzIiwiZ2V0IiwiZGV2ZWxvcGVyIiwiZHJhdyIsImFjdGl2ZSIsInBsYXlWaWV3IiwiYmxvY2tpbmciLCJkYXlUcmFuc2l0aW9uIiwicmVzZXRJbnB1dCIsInJlbGVhc2VDaW5lbWFTa2lwIiwiY2xlYXJJbnB1dCIsIm91dHNpZGUiLCJnaW1taWNrIiwiaGVsZCIsInNjcmVlbiIsInBsYXllciIsInBhdXNlIiwiU2Z4Iiwic2lsZW5jZSIsInNldEVuYWJsZWQiLCJzZXRMb3dwYXNzIiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwiaW5jbHVkZXMiLCJiYWNrZ3JvdW5kIiwiYXBwIiwiaW5lcnQiLCJvdXRzaWRlUm9vdCIsInBoYXNlIiwiTHVuYUJhckRvb3IiLCJodG1sIiwiZG9vclRyYW5zaXRpb24iLCJkaXJlY3Rpb24iLCJyIiwicm93cyIsImluZGV4IiwiY2FyZCIsIm9wdGlvbnMiLCJtYXAiLCJvIiwidGV4dCIsInNlcSIsImpvaW4iLCJsb2FkRXJyb3IiLCJvcHRpb25zSFRNTCIsImRldkNvbnNvbGVIVE1MIiwibm90aWNlVGl0bGUiLCJub3RpY2VUZXh0IiwiZHJpbmtJc3N1ZXMiLCJ0IiwibmFtZSIsInBlbmRpbmdTdGVwIiwiYWN0b3IiLCJjb2NrdGFpbHNBdmFpbGFibGUiLCJkcmlua1NyYyIsIm9ic2VydmF0aW9uRXJyb3IiLCJzY2VuZUhUTUwiLCJ0aXRsZSIsImNpbmVtYUNob2ljZXMiLCJkaXNwb3NlIiwiaW5uZXJIVE1MIiwidGl0bGVMb2dvIiwiTHVuYVRpdGxlTG9nbyIsIm1vdW50Iiwic3R1ZGlvIiwiTHVuYVN0dWRpb0NpbmVtYSIsIkx1bmFDaW5lbWFQbGF5ZXIiLCJzY2VuZSIsInJlbmRlcmVyIiwicmVuZGVyIiwidGltZSIsInVpIiwiZ2ltbWlja0F1ZGlvIiwidm9sdW1lIiwicGFpbnRDaW5lbWFDaG9pY2VzIiwicGFpbnRDaW5lbWFTa2lwIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJlbCIsIkx1bmFFeHRlcmlvclRleHRib3giLCJhdHRhY2giLCJ0YWlsIiwicGFpbnRMaW5lIiwiTHVuYUpvaG5ueU1lbW9yeSIsInN5bmMiLCJwYWludEF3YWtlbmluZyIsImZvY3VzIiwicHJldmVudFNjcm9sbCIsImNvbnRlbnQiLCJkYXkiLCJtYXgiLCJwcm9ncmVzcyIsIm1vbmV5IiwidG9Mb2NhbGVTdHJpbmciLCJkZXZDb25zb2xlQWN0aW9uIiwiZGV2UmVzdW1lVmlldyIsImJlZm9yZSIsImFmdGVyIiwiY2FycnkiLCJsb2ciLCJzb3VyY2UiLCJjaGFuZ2VkIiwicm91dGUiLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJsaWZ0TG9nb1BlbmRpbmciLCJsb2FkTGFiZWwiLCJjb25maWciLCJmbG93IiwicGxhY2UiLCJ2YXJpYW50IiwicmV0cnlMb2FkIiwiZXhpdCIsInN0YXJ0IiwiRXJyb3IiLCJvcGVuRGV2IiwiZGV2QWN0aW9uIiwibWVzc2FnZSIsIkx1bmFTZXR0aW5ncyIsImNvbnRleHQiLCJyZXN1bWVWaWV3Iiwib25DbG9zZSIsImV4aXRMYWJlbCIsIm9uRXhpdCIsImFzc2V0cyIsIml0ZW1fb2xkX2Zhc2hpb25lZCIsInNyYyIsInBvcnRyYWl0Iiwic3RhdGVzIiwiY2hhcmFjdGVyTGF5ZXJzIiwia2V5cyIsImZpbmQiLCJlbmRzV2l0aCIsImEiLCJmcmFtZXMiLCJ0ZXh0T25seSIsIndobyIsIkx1bmFUZXJyYWNlIiwiaW1hZ2UiLCJob21lQmFja2Ryb3AiLCJjaXR5QmFja2Ryb3AiLCJzdHJlZXRCYWNrZHJvcCIsImJhciIsIm1lbW9yeSIsImVudHJpZXMiLCJhY3RvcnMiLCJwYWludCIsInBhcmFncmFwaCIsImxpbmUiLCJtb3VudFRleHQiLCJlbXBoYXNpcyIsInJldmVhbFRleHQiLCJBcnJheSIsImZyb20iLCJzbGljZSIsImZsb29yIiwiY2hhcnMiLCJsZW5ndGgiLCJMdW5hRGlhbG9ndWVDdWUiLCJrZXkiLCJkb25lIiwiZXh0cmEiLCJ0ZXJyYWNlIiwiaXNBcnJheSIsInNjZW5lcyIsImhvbWVUb1RlcnJhY2UiLCJiZWdpbk1lbW9yeVRyYW5zaXRpb24iLCJwcmVwYXJlIiwicmV2ZWFsRHVyYXRpb24iLCJuZXh0IiwibWVtb3J5VHJhbnNpdGlvbiIsImNpbmVtYUFmdGVyIiwicGxheUpvaG5ueU1lbW9yeSIsImNvbnRpbnVlU2NlbmUiLCJwbGF5VGVycmFjZU1lbW9yeSIsIm1lbW9yeUtleSIsIndoZW4iLCJMdW5hQ29yZSIsImNvbmRpdGlvbiIsImN0eCIsInR5cGUiLCJwcmVsb2FkIiwidXJscyIsImxvYWRQZXJjZW50IiwidW5pcXVlIiwiZmlsdGVyIiwiQm9vbGVhbiIsInJldHJ5IiwiUHJvbWlzZSIsImFsbCIsInRoZW4iLCJyZXNvbHZlIiwicmVqZWN0IiwiaW0iLCJJbWFnZSIsInRpbWVyIiwic2V0VGltZW91dCIsIm9ubG9hZCIsImNsZWFyVGltZW91dCIsImFkZCIsIm9uZXJyb3IiLCJzY3JpcHQiLCJwIiwiZGVsZXRlIiwicmVtb3ZlIiwiaGVhZCIsInNldCIsInByZXBhcmVTdHVkaW8iLCJTcHJpdGVzIiwibG9hZCIsIkVuZ2luZSIsImluaXRBbmNob3JzIiwibmV3R2FtZSIsImNhbmNlbE1lbW9yeVRyYW5zaXRpb24iLCJjYW5jZWxEYXlUcmFuc2l0aW9uIiwiY2FuY2VsRG9vclRyYW5zaXRpb24iLCJkaXNwb3NlQ2luZW1hIiwiYXdha2VuaW5nIiwidW5pbnN0YWxsIiwic3RvcnlWZXJzaW9uIiwiaW5zdGFsbCIsImJlZ2luQ29tbXV0ZSIsImNsZWFyIiwibGFuZyIsIm1pbmlnYW1lcyIsImN1dHNjZW5lcyIsImluc3BlY3RvciIsImF1dG8iLCJzcGVlZCIsIndha2VBdFNvZmEiLCJtb2RlbCIsInBhdXNlZCIsInJldHVyblRyYW5zaXRpb24iLCJza2lwVW50aWwiLCJyZXR1cm5UbyIsInVwZGF0ZU5lYXIiLCJ0aWNrIiwic2hvd0NvbnRyb2xzVHV0b3JpYWwiLCJzZXRTdXBwcmVzc2VkIiwidW5sb2NrIiwicGxheURheVplcm9UViIsImJhY2tncm91bmRTdG9yeSIsImNhbmNlbCIsImNvbW1pdCIsImNsYXNzTmFtZSIsIm9wYWNpdHkiLCJkIiwiYmdtRnJvbSIsInRyYW5zaXRpb25HYWluIiwicmVhZHkiLCJlcnJvciIsInNldFRyYW5zaXRpb25HYWluIiwiY2F0Y2giLCJ0aWNrTWVtb3J5VHJhbnNpdGlvbiIsImR0IiwiTHVuYUZvY3VzU2V0dGluZ3MiLCJoaWRkZW5QYXVzZWQiLCJzbW9vdGgiLCJ4IiwiYWxwaGEiLCJhbW91bnQiLCJqb2hubnkiLCJmbGFncyIsImNhbXBhaWduX29ic2VydmF0aW9uIiwic2NyaXB0cyIsInNldExpbmVPdmVycmlkZXMiLCJzZXRUeXBpbmdTY2FsZSIsImJ1aWxkVGVycmFjZU1lbW9yeSIsImRheTMiLCJyZXN1bWUiLCJjaW5lbWFIb2xkU3RhcnQiLCJjYW5Ta2lwQ2luZW1hIiwidGlja0NpbmVtYURpYWxvZ3VlIiwiYWdlIiwiZW5kIiwiY2xpcHMiLCJsIiwid2FpdCIsImR1cmF0aW9uIiwic29ydCIsInJldmVhbGVkIiwidyIsImRpYWxvZ3VlQ2hvaWNlIiwicGFyc2VkIiwiU3R1ZGlvVGFncyIsIlN0dWRpb09wZW5pbmciLCJ0eXBpbmdQZW5kaW5nIiwiY291bnQiLCJkaWFsb2d1ZUNvdW50IiwidGV4dEVmZmVjdCIsImNob2ljZUFmdGVyIiwiaW50cm9Db250cm9scyIsImludHJvRmFkZSIsImZhZGUiLCJpbnRyb1BoYXNlT2Zmc2V0IiwiZmluaXNoQ2luZW1hIiwic3RhdGUiLCJsaW5lSWQiLCJjaG9pY2UiLCJ1cGRhdGUiLCJjaW5lbWFDaG9pY2VPd25lciIsIkx1bmFXb3JsZENob2ljZXMiLCJjcmVhdGUiLCJvcHRpb24iLCJyZXNwb25zZSIsImNob2ljZVJlc3BvbnNlIiwic2FtcGxlIiwiY2FtIiwiY2FtZXJhIiwieSIsImZhY2luZyIsImFsbG93ZWQiLCJwbGF5aW5nIiwic2tpcEhpbnRBZ2UiLCJpbnRybyIsImVsYXBzZWQiLCJwZXJmb3JtYW5jZSIsIm5vdyIsImhvbGRWaXNpYmxlIiwidmlzaWJsZSIsInRyYW5zZm9ybSIsInJvdW5kIiwia2VlcE11c2ljR2FpbiIsInNraXBwZWQiLCJiZWdpbkRheSIsInN0YXJ0U3RvcnlQaGFzZSIsImZyb21XaGl0ZSIsImRhcmsiLCJ3aGl0ZSIsInN0YXJ0QmFyIiwicnVuRG9vclRyYW5zaXRpb24iLCJ2YWx1ZXMiLCJ0ZXN0IiwiTHVuYVN0b3J5Tm90aWNlcyIsImNvbXBsZXRlR29hbCIsImNoZWNrcG9pbnQiLCJvYmplY3RpdmVzIiwiZmlyc3RfY29tbXV0ZSIsInN0YXJ0ZWRBdCIsIm1vdGlvbkF0IiwicmV2ZWFsQXQiLCJ0aWNrRG9vclRyYW5zaXRpb24iLCJjb21taXR0aW5nIiwic3RyZWV0IiwiZGVidWdPdXRzaWRlRGF5IiwiaXNJbnRlZ2VyIiwic3RydWN0dXJlZENsb25lIiwicmVzZXQiLCJsZWF2ZUJhciIsInNldHRsZSIsInN0ZXAiLCJtZW1vcnlRdWl6IiwiY29tcGxldGVNZW1vcnkiLCJmaW5pc2hTdGVwIiwicHJldmlld0NvbW11dGUiLCJMdW5hT3V0c2lkZVNhbWhvQ29tbXV0ZSIsIm5vdGlvbkNvbW11dGVTZWVuIiwic3RvcnkiLCJzbmFwc2hvdCIsImludGVyYWN0T3V0c2lkZSIsInFhIiwibGV2ZWwiLCJhYnMiLCJlbGV2YXRvclkiLCJMdW5hUmVzaWRlbmNlIiwibGF5b3V0IiwiZWxldmF0b3JCb3R0b20iLCJtaXNzaW5nIiwiZGF5RW5kUmVxdWlyZW1lbnRzIiwic2hvd0hvbWV3YXJkUmVxdWlyZW1lbnRzIiwic2xlZXBPdXRzaWRlVGVzdCIsIm5vdGljZSIsInF1aWV0TGlmdCIsInJpZGUiLCJjYWxsIiwidG8iLCJ0aXRsZVJldmVhbCIsImxpZnRMb2dvU2VlbiIsImJlZ2luRGF5VHJhbnNpdGlvbiIsInN0YXJ0ZWQiLCJwYWludERheVRyYW5zaXRpb24iLCJyb2xsIiwicmV2ZWFsIiwib2xkIiwidGlja0RheVRyYW5zaXRpb24iLCJkYWlseVdha2UiLCJqb2hubnlNaXNzaW5nIiwibGFiZWxzIiwib3V0c2lkZVNsZWVwIiwiZmluaXNoIiwidHJhbnNpdGlvbiIsImFkdmFuY2VEYXkiLCJzdGFydFJlc3RDaW5lbWEiLCJmaW5pc2hNb3JuaW5nIiwicGxheVNsZWVwU2NlbmVzIiwiY29tcGxldGUiLCJuaWdodEtleSIsInBsYXlSZXN0Q2luZW1hIiwid29ya3Nob3AiLCJraW5kIiwic2xlZXAiLCJlbmREYXkiLCJkZXZDb25zb2xlT3BlbiIsIkx1bmFEaWFsb2d1ZUF1ZGlvIiwicHJldmlvdXMiLCJsb2FkaW5nIiwibSIsInNob3ciLCJzaGFkZSIsImxvZ28iLCJhbHQiLCJ0ZWFtIiwiaW50ZXJjZXB0IiwiaXNzdWVzIiwicHJvYmxlbXMiLCJyZXN1bHQiLCJtb2RlIiwic2VlZCIsIkx1bmFVcGRhdGVzIiwiTHVuYUN1dHNjZW5lTGlicmFyeSIsInN0YXJ0c1dpdGgiLCJzb21lIiwiYXJnIiwiZW5hYmxlZCIsImNhbmNlbENyYWZ0Iiwic2VsZWN0Q29ja3RhaWwiLCJjdXJyZW50T3JkZXIiLCJjb2NrdGFpbCIsInRhYiIsInJlY2lwZU9wZW4iLCJob3Zlckl0ZW0iLCJjYW1wYWlnbl9zZWxlY3RlZF9kcmluayIsImNhbXBhaWduX3Jlc3BvbnNlIiwiY29udHJvbHNUdXRvcmlhbEtleSIsIm92ZXJsYXkiLCJjb2RlIiwibWV0YUtleSIsImN0cmxLZXkiLCJhbHRLZXkiLCJyZXBlYXQiLCJjbGljayIsInBvdXJUZXN0c09wZW4iLCJ0ZW1wbGF0ZSIsImxpc3QiLCJnZXRDbGllbnRSZWN0cyIsImkiLCJpbmRleE9mIiwiYWN0aXZlRWxlbWVudCIsInNoaWZ0S2V5IiwibHVuYUNhbXBhaWduIiwib3V0c2lkZUFjdGlvbiIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsIkx1bmFDYW1wYWlnbiJdLCJzb3VyY2VzIjpbImNhbXBhaWduLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuY29uc3QgZXNjPXM9PlN0cmluZyhzPz8nJykucmVwbGFjZSgvWyY8PlwiJ10vZyxjPT4oeycmJzonJmFtcDsnLCc8JzonJmx0OycsJz4nOicmZ3Q7JywnXCInOicmcXVvdDsnLFwiJ1wiOicmIzM5Oyd9W2NdKSk7XG5jb25zdCBidXR0b249KGxhYmVsLGFjdGlvbixjbHM9JycpPT4nPGJ1dHRvbiBjbGFzcz1cIicrY2xzKydcIiBkYXRhLWNhbXBhaWduPVwiJythY3Rpb24rJ1wiPicrKGNscz09PSd0aXRsZS1jaG9pY2UnPyc8c3BhbiBjbGFzcz1cInRpdGxlLWxhYmVsXCIgZGF0YS10ZXh0PVwiJytlc2MobGFiZWwpKydcIj4nK2VzYyhsYWJlbCkrJzwvc3Bhbj4nOmxhYmVsKSsnPC9idXR0b24+JztcbmNvbnN0IHBhdGg9bj0+J2Fzc2V0cy9iYWNrZ3JvdW5kcy9jYW1wYWlnbi8nK247XG5jb25zdCBDSU5FTUFfU0tJUF9IT0xEX01TPTIwMDAsQ0lORU1BX1NLSVBfUkVWRUFMX01TPTMwMCxDSU5FTUFfU0tJUF9JTlRST19TRUNPTkRTPTEuNTtcbmNsYXNzIENhbXBhaWdue1xuIGNvbnN0cnVjdG9yKGFkYXB0ZXIpe09iamVjdC5hc3NpZ24odGhpcyxhZGFwdGVyKTt0aGlzLnNlc3Npb249bmV3IGdsb2JhbC5MdW5hQ2FtcGFpZ25FbmdpbmUuU2Vzc2lvbih0aGlzLmcsdGhpcy5ELGdsb2JhbC5MVU5BX0NBTVBBSUdOX0RBVEEpO3RoaXMuc2Vzc2lvbi5vblN0ZXA9cz0+dGhpcy5zdG9yeVN0ZXAocyk7dGhpcy5kYXRhPWdsb2JhbC5MVU5BX0NBTVBBSUdOX0RBVEE7dGhpcy5zZXJ2aWNlVmVyc2lvbj0nQSc7dGhpcy52aWV3PSdwaWNrZXInO3RoaXMuZGlhbG9nPW51bGw7dGhpcy50b2tlbj0wO3RoaXMubG9hZGVkPW5ldyBTZXQoKTt0aGlzLnNjcmlwdFByb21pc2VzPW5ldyBNYXAoKTt0aGlzLmNvbnRyb2w9ZmFsc2U7dGhpcy5za2lwQWdlPTA7dGhpcy5maXJzdExpZnQ9ZmFsc2U7dGhpcy5tb3JuaW5nU2Vlbj1uZXcgU2V0KCk7dGhpcy5uaWdodFN0YXJ0ZWQ9ZmFsc2U7XG4gIHRoaXMuaG9zdD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWN0aW9uJyk7dGhpcy5ob3N0LmlkPSdjYW1wYWlnbi1yb290Jzt0aGlzLmhvc3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywnTFVOQSDrs7jtjrgnKTtkb2N1bWVudC5ib2R5LmFwcGVuZCh0aGlzLmhvc3QpO3RoaXMucmV0dXJuQnV0dG9uPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO3RoaXMucmV0dXJuQnV0dG9uLmlkPSdjYW1wYWlnbi1kZXZlbG9wZXItYmFjayc7dGhpcy5yZXR1cm5CdXR0b24udGV4dENvbnRlbnQ9J+KGkCDtlIzroIjsnbQg66qo65OcIOyEoO2DnSc7dGhpcy5yZXR1cm5CdXR0b24uZGF0YXNldC5jYW1wYWlnbj0ncGlja2VyJzt0aGlzLnJldHVybkJ1dHRvbi5oaWRkZW49dHJ1ZTtkb2N1bWVudC5ib2R5LmFwcGVuZCh0aGlzLnJldHVybkJ1dHRvbik7XG4gIHRoaXMuaG9zdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsZT0+e2NvbnN0IGI9ZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY2FtcGFpZ25dJyk7aWYoYil7aWYoIWIuZGlzYWJsZWQpdGhpcy5hY3Rpb24oYi5kYXRhc2V0LmNhbXBhaWduKTtyZXR1cm47fWlmKGUuYnV0dG9uPT09MCYmdGhpcy52aWV3PT09J3Byb2xvZ3VlJyYmdGhpcy5jaW5lbWE/LmRpYWxvZ3VlV2FpdCYmZS50YXJnZXQuY2xvc2VzdCgnLmNhbXBhaWduLXByb2xvZ3VlLC5zdHVkaW8tc3BlZWNoLWxheWVyJykpe2UucHJldmVudERlZmF1bHQoKTt0aGlzLmFkdmFuY2VDaW5lbWFEaWFsb2d1ZSgpO319KTt0aGlzLnJldHVybkJ1dHRvbi5vbmNsaWNrPSgpPT50aGlzLnRvUGlja2VyKCk7XG4gIHRoaXMuaG9zdC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsZT0+e2NvbnN0IGs9ZS50YXJnZXQuZGF0YXNldC5jYW1wYWlnbklucHV0O2lmKGs9PT0nYmdtJyl0aGlzLmJnbS5zZXRWb2x1bWUoTnVtYmVyKGUudGFyZ2V0LnZhbHVlKS8xMDApO2lmKGs9PT0nc2Z4JylnbG9iYWwuTHVuYVNmeC5zZXRWb2x1bWUoTnVtYmVyKGUudGFyZ2V0LnZhbHVlKS8xMDApO2lmKGs9PT0nc3BlZWQnKXRoaXMuZy5kaWFsb2dTcGVlZD1OdW1iZXIoZS50YXJnZXQudmFsdWUpO2NvbnN0IG91dD1lLnRhcmdldC5wYXJlbnRFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ291dHB1dCcpO2lmKG91dClvdXQudGV4dENvbnRlbnQ9az09PSdzcGVlZCc/ZS50YXJnZXQudmFsdWUrJ8OXJzplLnRhcmdldC52YWx1ZSsnJSc7fSk7XG4gIHRoaXMuZml0PSgpPT50aGlzLmhvc3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tY2FtcGFpZ24tc2NhbGUnLE1hdGgubWluKGlubmVyV2lkdGgvMTI4MCxpbm5lckhlaWdodC83MjApKTt3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJyx0aGlzLmZpdCk7dGhpcy5maXQoKTtcbiAgLy8gRXhwbGljaXQgc2ltdWxhdG9yIGRlZXAgbGlua3MgcmVtYWluIHVzZWZ1bDsgdGhlIG5vcm1hbCBlbnRyeSBhbHdheXMgc2hvd3MgdGhlIHR3byBjaG9pY2VzLlxuICBjb25zdCBxPW5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKTtpZihxLmhhcygnbW9kZScpfHxxLmhhcygndmVyc2lvbicpfHxxLmdldCgnZGV2Jyk9PT0nMScpdGhpcy5kZXZlbG9wZXIoKTtlbHNlIHRoaXMuZHJhdygpO1xuIH1cbiBnZXQgYWN0aXZlKCl7cmV0dXJuIHRoaXMuc2Vzc2lvbi5hY3RpdmUmJiF0aGlzLnNlc3Npb24uZGV2ZWxvcGVyO31cbiBnZXQgcGxheVZpZXcoKXtyZXR1cm4gdGhpcy5zZXNzaW9uLmRldmVsb3Blcj8nZGV2ZWxvcGVyJzonZ2FtZSc7fVxuIGdldCBibG9ja2luZygpe3JldHVybiAhIXRoaXMuZGF5VHJhbnNpdGlvbnx8dGhpcy52aWV3IT09J2dhbWUnJiZ0aGlzLnZpZXchPT0nZGV2ZWxvcGVyJzt9XG4gcmVzZXRJbnB1dCgpe3RoaXMucmVsZWFzZUNpbmVtYVNraXAoKTt0aGlzLmNsZWFySW5wdXQoKTt0aGlzLm91dHNpZGUuY2xlYXJJbnB1dD8uKCk7dGhpcy5jb250cm9sPWZhbHNlO3RoaXMuZy5naW1taWNrJiYodGhpcy5nLmdpbW1pY2suaGVsZD1mYWxzZSk7fVxuIHNjcmVlbih2aWV3KXt0aGlzLnJlc2V0SW5wdXQoKTtpZih2aWV3IT09J3Byb2xvZ3VlJyl7dGhpcy5jaW5lbWE/LnBsYXllcj8ucGF1c2U/LigpO2dsb2JhbC5TZng/LnNpbGVuY2UoKTtnbG9iYWwuU2Z4Py5zZXRFbmFibGVkKGZhbHNlKTtnbG9iYWwuU2Z4Py5zZXRMb3dwYXNzKDApO310aGlzLnZpZXc9dmlldzt0aGlzLmhvc3QuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtZGV2LWNvbnNvbGUnLHZpZXc9PT0nZGV2LWNvbnNvbGUnKTt0aGlzLmhvc3QuY2xhc3NMaXN0LnRvZ2dsZSgnb3Zlci1vdXRzaWRlJyx2aWV3PT09J3NjZW5lJyYmdGhpcy5vdXRzaWRlLmFjdGl2ZSYmIVsndGVycmFjZScsJ2JsYWNrJywnam9obm55LW1lbW9yeSddLmluY2x1ZGVzKHRoaXMuZGlhbG9nPy5iYWNrZ3JvdW5kKSk7dGhpcy5ob3N0LmhpZGRlbj0hdGhpcy5ibG9ja2luZztkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC50b2dnbGUoJ2NhbXBhaWduLW1haW4nLHRoaXMuYWN0aXZlKTtkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC50b2dnbGUoJ2NhbXBhaWduLWF3YWtlbmluZycsdmlldz09PSdhd2FrZW5pbmcnKTt0aGlzLmhvc3QuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtYXdha2VuaW5nJyx2aWV3PT09J2F3YWtlbmluZycpO3RoaXMuYXBwLmluZXJ0PXRoaXMuYmxvY2tpbmc7Y29uc3Qgb3V0c2lkZVJvb3Q9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI291dHNpZGUtcm9vdCcpO2lmKG91dHNpZGVSb290KW91dHNpZGVSb290LmluZXJ0PXRoaXMuYmxvY2tpbmc7dGhpcy5yZXR1cm5CdXR0b24uaGlkZGVuPXZpZXchPT0nZGV2ZWxvcGVyJ3x8dGhpcy5vdXRzaWRlLmFjdGl2ZXx8dGhpcy5nLnBoYXNlIT09J3JlYWR5Jzt0aGlzLmRyYXcoKTt9XG4gZHJhdygpe2lmKHRoaXMudmlldz09PSdnYW1lJ3x8dGhpcy52aWV3PT09J2RldmVsb3Blcicpe3RoaXMuaG9zdC5oaWRkZW49dHJ1ZTtyZXR1cm47fXRoaXMuaG9zdC5oaWRkZW49ZmFsc2U7XG4gIC8vIFByb2dyZXNzIGNhbGxiYWNrcyBtdXN0IG5vdCByZWNyZWF0ZSB0aGUgZG90cyBhbmQgcmVzdGFydCB0aGVpciBhbmltYXRpb24uXG4gIGlmKHRoaXMudmlldz09PSdsb2FkaW5nJyYmdGhpcy5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy52aWV3LWxvYWRpbmcgLnJlc291cmNlLWxvYWRpbmcnKSlyZXR1cm47XG4gIGxldCBib2R5PScnO1xuICBpZih0aGlzLnZpZXc9PT0ncGlja2VyJylib2R5PSc8ZGl2IGNsYXNzPVwiY2FtcGFpZ24tcGlja2VyXCI+PGltZyBjbGFzcz1cInBpY2tlci1sb2dvXCIgc3JjPVwiJytwYXRoKCd0aXRsZS1sb2dvLnBuZycpKydcIiBhbHQ9XCJQcm9qZWN0IExVTkFcIj48aDE+7Ja065akIOuwqeyLneycvOuhnCDtlIzroIjsnbTtlaDquYzsmpQ/PC9oMT48ZGl2IGNsYXNzPVwiY2FtcGFpZ24tcGF0aHNcIj4nK2J1dHRvbignPHNwYW4+MDEgLyBTVE9SWTwvc3Bhbj48c3Ryb25nPuuzuO2OuCDtlIzroIjsnbQ8L3N0cm9uZz48cD7ro6jrgpjsnZgg7LKrIOy2nOq3vOu2gO2EsCwg64SkIOuyiOydmCDrsKTquYzsp4AuPC9wPicsJ3RpdGxlJywnc3RvcnktcGF0aCcpK2J1dHRvbignPHNwYW4+MDIgLyBQTEFZVEVTVDwvc3Bhbj48c3Ryb25nPuqwnOuwnOyekCDsi5zrrqzroIjsnbTthLA8L3N0cm9uZz48cD7rsJQg7JiB7JeFIMK3IOq4sOuvuSDCtyDsmbjrtoAg6rO16rCE7J2EIOyekOycoOuhreqyjCDthYzsiqTtirjtlanri4jri6QuPC9wPicsJ2RldmVsb3BlcicsJ2Rldi1wYXRoJykrJzwvZGl2PjwvZGl2Pic7XG4gIGlmKHRoaXMudmlldz09PSdiYXItZG9vcicpYm9keT1nbG9iYWwuTHVuYUJhckRvb3IuaHRtbCh0aGlzLmRvb3JUcmFuc2l0aW9uPy5kaXJlY3Rpb258fCdpbicpO1xuICBpZih0aGlzLnZpZXc9PT0nYXdha2VuaW5nJylib2R5PSc8ZGl2IGNsYXNzPVwiY2FtcGFpZ24td2FrZS1kYXJrXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9kaXY+PGRpdiBjbGFzcz1cImNhbXBhaWduLXdha2Utd2hpdGVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L2Rpdj4nO1xuICBpZih0aGlzLnZpZXc9PT0ndGl0bGUnKWJvZHk9JzxkaXYgY2xhc3M9XCJjYW1wYWlnbi10aXRsZVwiPjxkaXYgY2xhc3M9XCJ0aXRsZS1sb2dvXCI+PGltZyBzcmM9XCInK3BhdGgoJ3RpdGxlLWxvZ28ucG5nJykrJ1wiIGFsdD1cIlByb2plY3QgTFVOQVwiPjxjYW52YXMgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9jYW52YXM+PC9kaXY+JysnPG5hdiBhcmlhLWxhYmVsPVwi7YOA7J207YuAIOuplOuJtFwiPicrYnV0dG9uKCfsg4gg6rKM7J6EJywnbmV3JywndGl0bGUtY2hvaWNlJykrJzxidXR0b24gY2xhc3M9XCJ0aXRsZS1jaG9pY2VcIiBkYXRhLWNhbXBhaWduPVwiY29udGludWVcIiBkaXNhYmxlZCBhcmlhLWRpc2FibGVkPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCLsnbTslrTtlZjquLAgKOyVhOyngSDsp4Dsm5DtlZjsp4Ag7JWK7J2MKVwiPjxzcGFuIGNsYXNzPVwidGl0bGUtbGFiZWxcIiBkYXRhLXRleHQ9XCLsnbTslrTtlZjquLBcIj7snbTslrTtlZjquLA8L3NwYW4+PC9idXR0b24+JytidXR0b24oJ+yEpOyglScsJ29wdGlvbnMnLCd0aXRsZS1jaG9pY2UnKStidXR0b24oJ+yiheujjCcsJ3BpY2tlcicsJ3RpdGxlLWNob2ljZScpKyc8c3BhbiBjbGFzcz1cInRpdGxlLW1lbnUtaW5kZXhcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4wMDQ8L3NwYW4+PC9uYXY+PC9kaXY+JztcblxuICBpZih0aGlzLnZpZXc9PT0nc2NlbmUtY2hvaWNlJyl7Y29uc3Qgcj10aGlzLmRpYWxvZy5yb3dzW3RoaXMuZGlhbG9nLmluZGV4XTtib2R5PXRoaXMuY2FyZCgn64yA64u1IOyEoO2DnScsci5vcHRpb25zLm1hcChvPT5idXR0b24oZXNjKG8udGV4dCksJ3NjZW5lLWNob2ljZTonK28uc2VxKSkuam9pbignJykpO31cbiAgaWYodGhpcy52aWV3PT09J2xvYWRpbmcnKWJvZHk9JzxkaXYgY2xhc3M9XCJyZXNvdXJjZS1sb2FkaW5nXCIgcm9sZT1cInN0YXR1c1wiIGFyaWEtbGFiZWw9XCLroZzrlKkg7KSRXCI+PHNwYW4gY2xhc3M9XCJyZXNvdXJjZS1sb2FkaW5nLWNvcHlcIiBhcmlhLWhpZGRlbj1cInRydWVcIj7roZzrlKkg7KSRPHNwYW4gY2xhc3M9XCJyZXNvdXJjZS1sb2FkaW5nLWRvdHNcIj48L3NwYW4+PC9zcGFuPjwvZGl2Pic7XG4gIGlmKHRoaXMudmlldz09PSdsb2FkLWVycm9yJylib2R5PXRoaXMuY2FyZCgn66as7IaM7Iqk66W8IOu2iOufrOyYpOyngCDrqrvtlojslrTsmpQnLCc8cD4nK2VzYyh0aGlzLmxvYWRFcnJvcikrJzwvcD4nK2J1dHRvbign64uk7IucIOyLnOuPhCcsJ3JldHJ5LWxvYWQnKStidXR0b24oJ+2DgOydtO2LgOuhnCcsJ3RpdGxlJykpO1xuICBpZih0aGlzLnZpZXc9PT0nb3B0aW9ucycpYm9keT10aGlzLm9wdGlvbnNIVE1MKCk7XG4gIGlmKHRoaXMudmlldz09PSdkZXYtY29uc29sZScpYm9keT10aGlzLmRldkNvbnNvbGVIVE1MKCk7XG4gIGlmKHRoaXMudmlldz09PSdjb25maXJtLWV4aXQnKWJvZHk9dGhpcy5jYXJkKCftg4DsnbTti4DroZwg64+M7JWE6rCI6rmM7JqUPycsJzxwPuynhO2WiSDsg4HtmansnYAg7KCA7J6l65CY7KeAIOyViuyKteuLiOuLpC48L3A+JytidXR0b24oJ+qzhOyGjSDtlIzroIjsnbQnLCdyZXN1bWUnKStidXR0b24oJ+2DgOydtO2LgOuhnCDrj4zslYTqsIDquLAnLCdleGl0LXJ1bicpKTtcbiAgaWYodGhpcy52aWV3PT09J3NsZWVwJylib2R5PXRoaXMuY2FyZCgn7ZWY66Oo66W8IOuniOy5oOq5jOyalD8nLCc8cD7smKTripjsnZgg7J207JW86riw66W8IOuniOy5mOqzoCDtnLTsi53snYQg7Leo7ZWp64uI64ukLjwvcD4nK2J1dHRvbign7KGw6riIIOuNlCDrkZjrn6zrs7TquLAnLCdyZXN1bWUnKStidXR0b24oJ+2VmOujqCDrp4jsuZjquLAnLCdzbGVlcC1jb25maXJtJywncHJpbWFyeScpKTtcbiAgaWYodGhpcy52aWV3PT09J25vdGljZScpYm9keT10aGlzLmNhcmQodGhpcy5ub3RpY2VUaXRsZXx8J+yViOuCtCcsJzxwPicrZXNjKHRoaXMubm90aWNlVGV4dCkucmVwbGFjZSgvXFxuL2csJzxicj4nKSsnPC9wPicrYnV0dG9uKCftmZXsnbgnLCdyZXN1bWUnLCdwcmltYXJ5JykpO1xuICBpZih0aGlzLnZpZXc9PT0ncmV0cnktZHJpbmsnKWJvZHk9dGhpcy5jYXJkKCfso7zrrLjsnYQg64uk7IucIO2ZleyduO2VtCDso7zshLjsmpQnLCc8dWw+Jyt0aGlzLmRyaW5rSXNzdWVzLm1hcCh0PT4nPGxpPicrZXNjKHQpKyc8L2xpPicpLmpvaW4oJycpKyc8L3VsPicrYnV0dG9uKCftjJDsoJUg7ZmU66m07Jy866GcJywncmVzdW1lJykrYnV0dG9uKCfri6Tsi5wg66eM65Ok6riwJywncmVtYWtlJywncHJpbWFyeScpKTtcbiAgaWYodGhpcy52aWV3PT09J21lbnUnKWJvZHk9dGhpcy5jYXJkKCfslrTrlqQg7ZWcIOyelOydhCDstpTsspztlaDquYzsmpQ/JywnPHA+Jytlc2ModGhpcy5nLm5hbWUodGhpcy5zZXNzaW9uLnBlbmRpbmdTdGVwPy5hY3Rvcnx8J3NhbWhvJykpKyfsl5Dqsowg7KCc6rO17ZWgIOy5te2FjOydvOydhCDqs6jrnbwg7KO87IS47JqULjwvcD48ZGl2IGNsYXNzPVwiY2FtcGFpZ24tbWVudVwiPicrdGhpcy5nLmNvY2t0YWlsc0F2YWlsYWJsZSgpLm1hcChjPT5idXR0b24oJzxpbWcgc3JjPVwiJytlc2ModGhpcy5kcmlua1NyYyhjLmlkKSkrJ1wiIGFsdD1cIlwiPjxzcGFuPicrZXNjKHRoaXMuZy5uYW1lKGMuaWQpKSsnPC9zcGFuPicsJ2RyaW5rOicrYy5pZCkpLmpvaW4oJycpKyc8L2Rpdj4nKTtcbiAgaWYodGhpcy52aWV3PT09J3Jlc3BvbnNlJylib2R5PXRoaXMuY2FyZCgn7Ja065a76rKMIOydtOyVvOq4sOulvCDsnbTslrTqsIjquYzsmpQ/JyxidXR0b24oJ+yCvO2YuOqwgCDtmZXsnbjtlZwg7KGw6rG067aA7YSwIOuTpOyWtOuzvOq5jOyalD8nLCdyZXNwb25zZTpBJykrYnV0dG9uKCfqt7jsqr3sl5DshJzripQg7JWg64uI66mA7J20IOunoeuKlCDsnbzsnbTrnbzqs6Ag7IOd6rCB7ZWY6rOgIOyeiOuCmOyalD8nLCdyZXNwb25zZTpCJykpO1xuICBpZih0aGlzLnZpZXc9PT0nb2JzZXJ2YXRpb24nKWJvZHk9dGhpcy5jYXJkKCfsobDri4jsnZgg6rSA7LCwIOuplOuqqCcsJzxwPuq4sOyWteyXkOyEnCDsp4HsoJEg67O4IOuCtOyaqeunjCDsoJXrpqztlbQg7KO87IS47JqULjwvcD48ZGl2IGNsYXNzPVwib2JzZXJ2YXRpb24tZmllbGRzXCI+PGxhYmVsPuqzoOuluCDrsqDsnbTsiqQ8c2VsZWN0IGlkPVwib2JzZXJ2YXRpb24tYmFzZVwiPjxvcHRpb24gdmFsdWU9XCJcIj7shKDtg508L29wdGlvbj48b3B0aW9uIHZhbHVlPVwiZ2luXCI+7KeEPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT1cInJ5ZVwiPuudvOydtCDsnITsiqTtgqQ8L29wdGlvbj48b3B0aW9uIHZhbHVlPVwidm9ka2FcIj7rs7Trk5zsubQ8L29wdGlvbj48L3NlbGVjdD48L2xhYmVsPjxsYWJlbD7snqzro4zrpbwg64Sj7J2AIOyInOyEnDxzZWxlY3QgaWQ9XCJvYnNlcnZhdGlvbi1vcmRlclwiPjxvcHRpb24gdmFsdWU9XCJcIj7shKDtg508L29wdGlvbj48b3B0aW9uIHZhbHVlPVwid3JvbmdcIj7si5zrn70g4oaSIOu5hO2EsOyKpCDihpIg7JyE7Iqk7YKkPC9vcHRpb24+PG9wdGlvbiB2YWx1ZT1cInJpZ2h0XCI+7JyE7Iqk7YKkIOKGkiDsi5zrn70g4oaSIOu5hO2EsOyKpCDihpIg7Iqk7YSwPC9vcHRpb24+PC9zZWxlY3Q+PC9sYWJlbD48L2Rpdj48cCBjbGFzcz1cImNhbXBhaWduLWVycm9yXCIgcm9sZT1cImFsZXJ0XCI+Jytlc2ModGhpcy5vYnNlcnZhdGlvbkVycm9yfHwnJykrJzwvcD4nK2J1dHRvbign7KCc7KGwIOq4sOuhnSDri6Tsi5wg67O06riwJywncmVwbGF5LW1lbW9yeScpK2J1dHRvbign7KSA67mEIOuqqeuhnSDsmYTshLEnLCdjb25maXJtLW9ic2VydmF0aW9uJywncHJpbWFyeScpKTtcbiAgaWYodGhpcy52aWV3PT09J3NjZW5lJylib2R5PXRoaXMuc2NlbmVIVE1MKCk7XG4gIGlmKHRoaXMudmlldz09PSdwcm9sb2d1ZScpYm9keT0nPGNhbnZhcyBjbGFzcz1cImNhbXBhaWduLXByb2xvZ3VlXCIgd2lkdGg9XCI0ODBcIiBoZWlnaHQ9XCIyNzBcIiBhcmlhLWxhYmVsPVwiJytlc2ModGhpcy5jaW5lbWE/LnRpdGxlfHwn66Oo64KY7J2YIOq/iCDtmozsg4Eg7Lu37JSsJykrJ1wiPjwvY2FudmFzPjxkaXYgY2xhc3M9XCJjYW1wYWlnbi1jaW5lbWEtdWlcIj48ZGl2IGNsYXNzPVwiYnViYmxlXCI+PGRpdiBjbGFzcz1cInR4dFwiPjxzcGFuIGNsYXNzPVwiZ2hvc3RcIj48L3NwYW4+PHNwYW4gY2xhc3M9XCJ2aXNcIj48L3NwYW4+PC9kaXY+PGkgY2xhc3M9XCJ0YWlsXCI+PC9pPjwvZGl2PjwvZGl2Pjxhc2lkZSBjbGFzcz1cImNhbXBhaWduLXNraXBcIiBhcmlhLWxhYmVsPVwi7Iqk7Y6Y7J207IqkIOuwlOulvCAy7LSI6rCEIOuIhOultOuptCDsu7fslKzsnYQg6rG064SI65yB64uI64ukXCI+PHNwYW4+7Iqk7Y6Y7J207IqkIOuwlOulvCDriIzrn6wg7Iqk7YK1PC9zcGFuPjxkaXYgY2xhc3M9XCJjYW1wYWlnbi1za2lwLXRyYWNrXCIgcm9sZT1cInByb2dyZXNzYmFyXCIgYXJpYS1sYWJlbD1cIuy7t+yUrCDsiqTtgrVcIiBhcmlhLXZhbHVlbWluPVwiMFwiIGFyaWEtdmFsdWVtYXg9XCIxMDBcIiBhcmlhLXZhbHVlbm93PVwiMFwiPjxpPjwvaT48L2Rpdj48L2FzaWRlPic7XG4gIGlmKHRoaXMudmlldz09PSdlbmRpbmcnKWJvZHk9JzxkaXYgY2xhc3M9XCJjYW1wYWlnbi1lbmRpbmdcIj48aW1nIHNyYz1cIicrcGF0aCgndGl0bGUtbG9nby5wbmcnKSsnXCIgYWx0PVwiUHJvamVjdCBMVU5BXCI+PHA+4oCm7KGw6riIIOuNlCDtlbTrs7Tqs6Ag7Iu27Ja07JqULjwvcD48c3Bhbj4w4oCUM+ydvOywqCDtlIzroIjsnbQg7JmE66OMPC9zcGFuPicrYnV0dG9uKCftg4DsnbTti4DroZwnLCdleGl0LXJ1bicpKyc8L2Rpdj4nO1xuICB0aGlzLmNpbmVtYUNob2ljZXM/LmRpc3Bvc2UoKTt0aGlzLmNpbmVtYUNob2ljZXM9bnVsbDtcbiAgdGhpcy5ob3N0LmlubmVySFRNTD0nPGRpdiBjbGFzcz1cImNhbXBhaWduLXN0YWdlIHZpZXctJyt0aGlzLnZpZXcrJ1wiPicrYm9keSsnPC9kaXY+JztcbiAgdGhpcy50aXRsZUxvZ289dGhpcy52aWV3PT09J3RpdGxlJz9nbG9iYWwuTHVuYVRpdGxlTG9nby5tb3VudCh0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignLnRpdGxlLWxvZ28nKSk6bnVsbDtcbiAgaWYodGhpcy52aWV3PT09J3Byb2xvZ3VlJyYmdGhpcy5jaW5lbWEpe2NvbnN0IGM9dGhpcy5jaW5lbWE7Yy5wbGF5ZXI/LmRpc3Bvc2UoKTtjLnBsYXllcj0oYy5zdHVkaW8/Z2xvYmFsLkx1bmFTdHVkaW9DaW5lbWEucGxheWVyOmdsb2JhbC5MdW5hQ2luZW1hUGxheWVyKSh0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignY2FudmFzJyksdGhpcy5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5jYW1wYWlnbi1jaW5lbWEtdWknKSxjLnNjZW5lKTtjLnJlbmRlcmVyPWMucGxheWVyLnJlbmRlcmVyO2MucGxheWVyLnJlbmRlcihjLnRpbWUsbnVsbCx0aGlzLnVpLmdpbW1pY2tBdWRpbyxnbG9iYWwuTHVuYVNmeC52b2x1bWUqLjU1LGMuZGlhbG9ndWVXYWl0KTt0aGlzLnBhaW50Q2luZW1hQ2hvaWNlcygpO3RoaXMucGFpbnRDaW5lbWFTa2lwKCk7fVxuICBpZih0aGlzLnZpZXc9PT0nc2NlbmUnKXtpZih0aGlzLmRpYWxvZz8uYmFja2dyb3VuZCE9PSd0ZXJyYWNlJyl0aGlzLmhvc3QucXVlcnlTZWxlY3RvckFsbCgnLmNhbXBhaWduLXNwZWVjaCcpLmZvckVhY2goZWw9Pmdsb2JhbC5MdW5hRXh0ZXJpb3JUZXh0Ym94LmF0dGFjaChlbCx7dGFpbDp0aGlzLmRpYWxvZy5iYWNrZ3JvdW5kPT09J2pvaG5ueS1tZW1vcnknfSkpO3RoaXMucGFpbnRMaW5lKCk7aWYodGhpcy5kaWFsb2c/LmJhY2tncm91bmQ9PT0nam9obm55LW1lbW9yeScpZ2xvYmFsLkx1bmFKb2hubnlNZW1vcnkuc3luYyh0aGlzLmhvc3QsdGhpcy5kaWFsb2csdGhpcy5EKTt9aWYodGhpcy52aWV3PT09J2F3YWtlbmluZycpdGhpcy5wYWludEF3YWtlbmluZygpO1xuICAodGhpcy5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy53b3JsZC1jaG9pY2VzIC5pcy1zZWxlY3RlZCcpfHx0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignYnV0dG9uLHNlbGVjdCxpbnB1dCcpKT8uZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO1xuIH1cbiBjYXJkKHRpdGxlLGNvbnRlbnQpe3JldHVybic8ZGl2IGNsYXNzPVwiY2FtcGFpZ24tbW9kYWwtc2hhZGVcIj48c2VjdGlvbiBjbGFzcz1cImNhbXBhaWduLWNhcmRcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIj48aDE+Jytlc2ModGl0bGUpKyc8L2gxPicrY29udGVudCsnPC9zZWN0aW9uPjwvZGl2Pic7fVxuIGRldkNvbnNvbGVIVE1MKCl7cmV0dXJuICc8YXNpZGUgY2xhc3M9XCJvdXRzaWRlLWRldi1jb25zb2xlIGNhbXBhaWduLWRldi1jb25zb2xlXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIuuzuO2OuCDqsJzrsJzsnpAg7L2Y7IaUXCI+PGhlYWRlcj48ZGl2PjxzbWFsbD5ERVZFTE9QRVIgwrcgJyt0aGlzLnNlc3Npb24uZGF5KyfsnbzssKg8L3NtYWxsPjxoMj7rs7jtjrgg6rCc67Cc7J6QIOy9mOyGlDwvaDI+PC9kaXY+JytidXR0b24oJ1Agwrcg64ur6riwJywnZGV2LWNsb3NlJykrJzwvaGVhZGVyPjxzZWN0aW9uPjxoMz7smbjrtoAg7JyE7LmY66GcIOydtOuPmTwvaDM+JytidXR0b24oJ+ynkSDslYgnLCdkZXYtaG9tZScpK2J1dHRvbign7JeY66as67Kg7J207YSwIOyVniDCtyDslYTrnpjsuLUnLCdkZXYtZWxldmF0b3InKStidXR0b24oJ+uwlCDrrLgg7JWeJywnZGV2LWJhcicpKyc8L3NlY3Rpb24+PHNlY3Rpb24+PGgzPu2YhOyerCDshozsp4DquIg8L2gzPjxvdXRwdXQgY2xhc3M9XCJvdXRzaWRlLWRldi1tb25leVwiIGFyaWEtbGl2ZT1cInBvbGl0ZVwiPicrTWF0aC5tYXgoMCxOdW1iZXIodGhpcy5nLnByb2dyZXNzLm1vbmV5KXx8MCkudG9Mb2NhbGVTdHJpbmcoJ2tvLUtSJykrJ+ybkDwvb3V0cHV0PjxkaXYgY2xhc3M9XCJvdXRzaWRlLWRldi1tb25leS1hY3Rpb25zXCI+JytidXR0b24oJ+KIkjEsMDAw7JuQJywnZGV2LW1pbnVzJykrYnV0dG9uKCcrMSwwMDDsm5AnLCdkZXYtcGx1cycpKyc8L2Rpdj48L3NlY3Rpb24+PHAgY2xhc3M9XCJvdXRzaWRlLWRldi1ub3RlXCI+7L2Y7IaU7J2EIOyXsCDrj5nslYgg7ZSM66CI7J206rCAIOydvOyLnCDsoJXsp4DrkKnri4jri6QuPGJyPuyZuOu2gCDsnbTrj5kg7IucIOynhO2WiSDspJHsnbgg7JiB7JeF7J2EIOykkeuLqO2VmOqzoCDqsJnsnYAg7J287LCo7J2YIO2HtOq3vOq4uOuhnCDsnbTrj5ntlanri4jri6QuIOuzhOuPhCDsoJXsgrDsnYAg7ZWY7KeAIOyViuyKteuLiOuLpC48YnI+7Jm467aAIOy9mOyGlOyXkOyEnCDstpzqt7zquLjCt+2HtOq3vOq4uOydhCDrs4Dqsr3tlaAg7IiYIOyeiOyKteuLiOuLpC48L3A+PC9hc2lkZT4nO31cbiBhc3luYyBkZXZDb25zb2xlQWN0aW9uKGFjdGlvbil7XG4gIGlmKHRoaXMudmlldyE9PSdkZXYtY29uc29sZScpcmV0dXJuO1xuICBpZihhY3Rpb249PT0nZGV2LWNsb3NlJyl7dGhpcy5zY3JlZW4odGhpcy5kZXZSZXN1bWVWaWV3fHwnZ2FtZScpO3RoaXMucmVuZGVyKHRydWUpO3JldHVybjt9XG4gIGlmKGFjdGlvbj09PSdkZXYtcGx1cyd8fGFjdGlvbj09PSdkZXYtbWludXMnKXtcbiAgIGNvbnN0IGJlZm9yZT1NYXRoLm1heCgwLE51bWJlcih0aGlzLmcucHJvZ3Jlc3MubW9uZXkpfHwwKSxhZnRlcj1NYXRoLm1heCgwLGJlZm9yZSsoYWN0aW9uPT09J2Rldi1wbHVzJz8xMDAwOi0xMDAwKSk7dGhpcy5nLnByb2dyZXNzLm1vbmV5PWFmdGVyO2lmKHRoaXMuc2Vzc2lvbi5jYXJyeSl0aGlzLnNlc3Npb24uY2FycnkubW9uZXk9YWZ0ZXI7dGhpcy5nLmxvZygnZGVidWdfbW9uZXknLHtiZWZvcmUsYWZ0ZXIsc291cmNlOidtYWluLWNvbnNvbGUnfSk7dGhpcy5nLmNoYW5nZWQoKTt0aGlzLmRyYXcoKTt0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignW2RhdGEtY2FtcGFpZ249XCInK2FjdGlvbisnXCJdJykuZm9jdXMoKTtyZXR1cm47XG4gIH1cbiAgaWYoIVsnZGV2LWhvbWUnLCdkZXYtZWxldmF0b3InLCdkZXYtYmFyJ10uaW5jbHVkZXMoYWN0aW9uKSlyZXR1cm47XG4gIGNvbnN0IHRva2VuPSsrdGhpcy50b2tlbjt0aGlzLnJlc2V0SW5wdXQoKTt0aGlzLmRpYWxvZz1udWxsO3RoaXMuc2Vzc2lvbi5wZW5kaW5nU3RlcD1udWxsO3RoaXMuc2Vzc2lvbi5yb3V0ZT0nb3V0Jzt0aGlzLnNlc3Npb24uY2Fycnk9SlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLmcucHJvZ3Jlc3MpKTt0aGlzLm5pZ2h0U3RhcnRlZD1mYWxzZTt0aGlzLmxpZnRMb2dvUGVuZGluZz1mYWxzZTtcbiAgdGhpcy5sb2FkTGFiZWw9J+yZuOu2gCDthYzsiqTtirgg7JyE7LmY66GcIOydtOuPme2VmOqzoCDsnojsirXri4jri6QnO3RoaXMuc2NyZWVuKCdsb2FkaW5nJyk7T2JqZWN0LmFzc2lnbih0aGlzLm91dHNpZGUuY29uZmlnLHtkYXk6dGhpcy5zZXNzaW9uLmRheSxmbG93OidvdXQnLHBsYWNlOidiYXInLHZhcmlhbnQ6J29yaWdpbmFsJ30pO1xuICB0aGlzLnJldHJ5TG9hZD0oKT0+e3RoaXMub3V0c2lkZS5leGl0KHRydWUpO3RoaXMuc2NyZWVuKCdkZXYtY29uc29sZScpO3RoaXMuZGV2Q29uc29sZUFjdGlvbihhY3Rpb24pO307XG4gIHRyeXthd2FpdCB0aGlzLm91dHNpZGUuc3RhcnQoKTtpZih0b2tlbiE9PXRoaXMudG9rZW4pcmV0dXJuO2lmKHRoaXMub3V0c2lkZS5sb2FkRXJyb3IpdGhyb3cgRXJyb3IodGhpcy5vdXRzaWRlLmxvYWRFcnJvcik7dGhpcy5zY3JlZW4oJ2dhbWUnKTt0aGlzLm91dHNpZGUub3BlbkRldigpO3RoaXMub3V0c2lkZS5kZXZBY3Rpb24oYWN0aW9uKTt9Y2F0Y2goZSl7aWYodG9rZW4hPT10aGlzLnRva2VuKXJldHVybjt0aGlzLmxvYWRFcnJvcj1lLm1lc3NhZ2U7dGhpcy5zY3JlZW4oJ2xvYWQtZXJyb3InKTt9XG4gfVxuIG9wdGlvbnNIVE1MKCl7cmV0dXJuIGdsb2JhbC5MdW5hU2V0dGluZ3MuaHRtbCh7Y29udGV4dDp0aGlzLnJlc3VtZVZpZXc9PT0ndGl0bGUnfHx0aGlzLnJlc3VtZVZpZXc9PT0ncGlja2VyJz8ndGl0bGUnOidjYW1wYWlnbicsb25DbG9zZTooKT0+e3RoaXMuYWN0aW9uKCdyZXN1bWUnKTtpZih0aGlzLnZpZXc9PT0ndGl0bGUnKXRoaXMuaG9zdC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1jYW1wYWlnbj1vcHRpb25zXScpPy5mb2N1cygpO30sZXhpdExhYmVsOiftg4DsnbTti4DroZwnLG9uRXhpdDp0aGlzLmFjdGl2ZT8oKT0+dGhpcy5hY3Rpb24oJ2V4aXQtcnVuJyk6bnVsbH0pO31cbiBkcmlua1NyYyhpZCl7cmV0dXJuKHRoaXMuRC5hc3NldHNbJ3JlY2lwZV9jb2NrdGFpbF8nK2lkXXx8dGhpcy5ELmFzc2V0c1snY29ja3RhaWxfJytpZF18fHRoaXMuRC5hc3NldHMuaXRlbV9vbGRfZmFzaGlvbmVkKS5zcmM7fVxuIHBvcnRyYWl0KGFjdG9yKXtjb25zdCBzdGF0ZXM9dGhpcy5ELmNoYXJhY3RlckxheWVyc1thY3Rvcl07aWYoIXN0YXRlcylyZXR1cm4gJyc7Y29uc3Qga2V5cz1zdGF0ZXNbT2JqZWN0LmtleXMoc3RhdGVzKS5maW5kKGs9PmsuZW5kc1dpdGgoJ2lkbGVfZGVmYXVsdCcpKXx8T2JqZWN0LmtleXMoc3RhdGVzKVswXV07cmV0dXJuICc8ZGl2IGNsYXNzPVwiY2FtcGFpZ24tcG9ydHJhaXRcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4nK2tleXMubWFwKGs9Pntjb25zdCBhPXRoaXMuRC5hc3NldHNba107cmV0dXJuJzxzcGFuIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTp1cmwoJytlc2MoYS5zcmMpKycpO2JhY2tncm91bmQtc2l6ZTonKygoYS5mcmFtZXN8fDEpKjEwMCkrJyUgMTAwJVwiPjwvc3Bhbj4nO30pLmpvaW4oJycpKyc8L2Rpdj4nO31cbiBzY2VuZUhUTUwoKXtjb25zdCBjPXRoaXMuZGlhbG9nO2lmKGMuYmFja2dyb3VuZD09PSdqb2hubnktbWVtb3J5JylyZXR1cm4gZ2xvYmFsLkx1bmFKb2hubnlNZW1vcnkuaHRtbChjLHRoaXMuRCk7Y29uc3Qgcj1jLnJvd3NbYy5pbmRleF0sdGV4dE9ubHk9WydzdHJlZXQnLCdjaXR5JywnaG9tZSddLmluY2x1ZGVzKGMuYmFja2dyb3VuZCk7aWYoYy5iYWNrZ3JvdW5kPT09J2JsYWNrJylyZXR1cm4gJzxkaXYgY2xhc3M9XCJjYW1wYWlnbi1ibGFjay1zY2VuZVwiPjxidXR0b24gY2xhc3M9XCJjYW1wYWlnbi1zcGVlY2hcIiBkYXRhLWNhbXBhaWduPVwibmV4dFwiIGFyaWEtbGFiZWw9XCLri6TsnYwg64yA7IKsXCI+PHN0cm9uZz4nK2VzYyhyLndob3x8dGhpcy5nLm5hbWUoci5hY3RvcikpKyc8L3N0cm9uZz48cD48c3BhbiBjbGFzcz1cImNhbXBhaWduLW1lYXN1cmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4nK2VzYyhyLnRleHQpKyc8L3NwYW4+PHNwYW4gY2xhc3M9XCJjYW1wYWlnbi1pbmtcIj48L3NwYW4+PC9wPjwvYnV0dG9uPjwvZGl2Pic7aWYoYy5iYWNrZ3JvdW5kPT09J3RlcnJhY2UnKXJldHVybiBnbG9iYWwuTHVuYVRlcnJhY2UuaHRtbChjKTtsZXQgaW1hZ2U9Yy5iYWNrZ3JvdW5kPT09J2hvbWUnJiZ0aGlzLmhvbWVCYWNrZHJvcD90aGlzLmhvbWVCYWNrZHJvcDpjLmJhY2tncm91bmQ9PT0nY2l0eScmJnRoaXMuY2l0eUJhY2tkcm9wP3RoaXMuY2l0eUJhY2tkcm9wOmMuYmFja2dyb3VuZD09PSdzdHJlZXQnJiZ0aGlzLnN0cmVldEJhY2tkcm9wP3RoaXMuc3RyZWV0QmFja2Ryb3A6Yy5iYWNrZ3JvdW5kPT09J2xhYic/cGF0aCgnbGFiLnBuZycpOmMuYmFja2dyb3VuZD09PSdiYXInPyh0aGlzLkQuYXNzZXRzLmJhcj8uc3JjfHxwYXRoKCd0aXRsZS1iZy5wbmcnKSk6cGF0aCgndGl0bGUtYmcucG5nJyk7cmV0dXJuICc8ZGl2IGNsYXNzPVwiY2FtcGFpZ24tc3RvcnktYmcgJytlc2MoYy5iYWNrZ3JvdW5kKSsnXCIgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOnVybCgnK2VzYyhpbWFnZSkrJylcIj48L2Rpdj48ZGl2IGNsYXNzPVwiY2FtcGFpZ24tc2NlbmUtbGFiZWxcIj4nK2VzYyhjLnRpdGxlKSsnPC9kaXY+Jyt0aGlzLnBvcnRyYWl0KHIuYWN0b3IpKyhjLm1lbW9yeT8nPGFzaWRlIGNsYXNzPVwiY2FtcGFpZ24tbWVtb3J5LW5vdGVcIj48c21hbGw+7KGw64uI7J2YIOygnOyhsCDquLDroZ0gwrcg67Cw7ZWpIOqwgOyViDwvc21hbGw+PHN0cm9uZz7rnbzsnbQg7JyE7Iqk7YKkIDQ1bWwg4oaSIOyLrO2UjCDsi5zrn70gNW1sPGJyPuKGkiDslYTroZzrp4jti7Eg67mE7YSw7IqkIDJtbCDihpIg7Iqk7YSwPC9zdHJvbmc+PHNwYW4+7Jis65Oc7Yyo7IWY65OcIOyelCDCtyDqsIEg6rOE65+JIO2XiOyaqSDsmKTssKggwrE1bWw8L3NwYW4+PC9hc2lkZT4nOicnKSsnPGJ1dHRvbiBjbGFzcz1cImNhbXBhaWduLXNwZWVjaCAnKyh0ZXh0T25seT8ndGV4dC1vbmx5ICc6JycpKyhyLmFjdG9yPT09J2x1bmEnPydsdW5hJzonJykrJ1wiIGRhdGEtY2FtcGFpZ249XCJuZXh0XCIgYXJpYS1sYWJlbD1cIuuLpOydjCDrjIDsgqxcIj4nKyh0ZXh0T25seT8nJzonPHN0cm9uZz4nK2VzYyhyLndob3x8T2JqZWN0LmVudHJpZXModGhpcy5kYXRhLmFjdG9ycykuZmluZCgoW24saWRdKT0+aWQ9PT1yLmFjdG9yKT8uWzBdfHwnJykrJzwvc3Ryb25nPicpKyc8cD48c3BhbiBjbGFzcz1cImNhbXBhaWduLW1lYXN1cmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4nK2VzYyhyLnRleHQpKyc8L3NwYW4+PHNwYW4gY2xhc3M9XCJjYW1wYWlnbi1pbmtcIj48L3NwYW4+PC9wPjwvYnV0dG9uPic7fVxuIHBhaW50TGluZSgpe2lmKCF0aGlzLmRpYWxvZylyZXR1cm47aWYodGhpcy5kaWFsb2cuYmFja2dyb3VuZD09PSd0ZXJyYWNlJyl7Z2xvYmFsLkx1bmFUZXJyYWNlLnBhaW50KHRoaXMuZGlhbG9nLHRoaXMuaG9zdCk7cmV0dXJuO31jb25zdCByPXRoaXMuZGlhbG9nLnJvd3NbdGhpcy5kaWFsb2cuaW5kZXhdLHBhcmFncmFwaD10aGlzLmhvc3QucXVlcnlTZWxlY3RvcignLmNhbXBhaWduLXNwZWVjaCBwJyk7aWYocGFyYWdyYXBoKXtpZihwYXJhZ3JhcGguZGF0YXNldC5saW5lIT09ci50ZXh0KXtwYXJhZ3JhcGguZGF0YXNldC5saW5lPXIudGV4dDtnbG9iYWwuTHVuYUV4dGVyaW9yVGV4dGJveC5tb3VudFRleHQocGFyYWdyYXBoLHIudGV4dCxyLmVtcGhhc2lzfHxbXSk7fWdsb2JhbC5MdW5hRXh0ZXJpb3JUZXh0Ym94LnJldmVhbFRleHQocGFyYWdyYXBoLEFycmF5LmZyb20oci50ZXh0LnNsaWNlKDAsTWF0aC5mbG9vcih0aGlzLmRpYWxvZy5jaGFycykpKS5sZW5ndGgpO2dsb2JhbC5MdW5hRGlhbG9ndWVDdWUuc3luYyhwYXJhZ3JhcGguY2xvc2VzdCgnLmNhbXBhaWduLXNwZWVjaCcpLCEhci50ZXh0JiZ0aGlzLmRpYWxvZy5jaGFycz49ci50ZXh0Lmxlbmd0aCk7fX1cbiBzY2VuZShrZXksdGl0bGUsYmFja2dyb3VuZCxkb25lLGV4dHJhPXt9KXtjb25zdCB0ZXJyYWNlPWtleT09PSduaWdodDAnfHxrZXk9PT0nZW5kaW5nJ3x8YmFja2dyb3VuZD09PSd0ZXJyYWNlJztpZih0ZXJyYWNlKWJhY2tncm91bmQ9J3RlcnJhY2UnO2NvbnN0IHJvd3M9QXJyYXkuaXNBcnJheShrZXkpP2tleTp0ZXJyYWNlP2dsb2JhbC5MdW5hVGVycmFjZS5yb3dzKGtleSx0aGlzLmRhdGEpOnRoaXMuZGF0YS5zY2VuZXNba2V5XTtpZighcm93cz8ubGVuZ3RoKXRocm93IEVycm9yKCfsl4bripQg67O47Y64IOyepeuptDogJytrZXkpO3RoaXMuZGlhbG9nPXtyb3dzLHRpdGxlLGJhY2tncm91bmQsZG9uZSxpbmRleDowLGNoYXJzOjAsLi4uZXh0cmEsaG9tZVRvVGVycmFjZTpmYWxzZX07aWYodGVycmFjZSl7dGhpcy5yZXRyeUxvYWQ9KCk9PnRoaXMuc2NlbmUoa2V5LHRpdGxlLGJhY2tncm91bmQsZG9uZSxleHRyYSk7dGhpcy5iZWdpbk1lbW9yeVRyYW5zaXRpb24oKCk9Pmdsb2JhbC5MdW5hVGVycmFjZS5wcmVwYXJlKCksKCk9PnRoaXMuc2NyZWVuKCdzY2VuZScpLHt0ZXJyYWNlOnRydWUscmV2ZWFsRHVyYXRpb246MS44fSk7fWVsc2UgdGhpcy5zY3JlZW4oJ3NjZW5lJyk7fVxuIG5leHQoKXtpZih0aGlzLmRheVRyYW5zaXRpb258fHRoaXMubWVtb3J5VHJhbnNpdGlvbilyZXR1cm47aWYodGhpcy52aWV3PT09J3Byb2xvZ3VlJylyZXR1cm47aWYodGhpcy52aWV3IT09J3NjZW5lJylyZXR1cm47Y29uc3QgYz10aGlzLmRpYWxvZyxyPWMucm93c1tjLmluZGV4XTtpZihjLmNoYXJzPHIudGV4dC5sZW5ndGgpe2MuY2hhcnM9ci50ZXh0Lmxlbmd0aDt0aGlzLnBhaW50TGluZSgpO3JldHVybjt9Yy5pbmRleCsrO2MuY2hhcnM9MDtpZihyLmNpbmVtYUFmdGVyPT09J2pvaG5ueS1tZW1vcnknKXt0aGlzLnBsYXlKb2hubnlNZW1vcnkoKCk9PntpZih0aGlzLmRpYWxvZz09PWMpdGhpcy5jb250aW51ZVNjZW5lKCk7fSk7cmV0dXJuO31pZihyLmNpbmVtYUFmdGVyPT09J3RlcnJhY2UtbWVtb3J5Jyl7dGhpcy5wbGF5VGVycmFjZU1lbW9yeSgoKT0+e2lmKHRoaXMuZGlhbG9nPT09Yyl0aGlzLmNvbnRpbnVlU2NlbmUoKTt9LHIubWVtb3J5S2V5fHwndGVycmFjZU1lbW9yeScpO3JldHVybjt9dGhpcy5jb250aW51ZVNjZW5lKCk7fVxuIGNvbnRpbnVlU2NlbmUoKXtjb25zdCBjPXRoaXMuZGlhbG9nO2lmKCFjKXJldHVybjt3aGlsZShjLmluZGV4PGMucm93cy5sZW5ndGgpe2NvbnN0IHI9Yy5yb3dzW2MuaW5kZXhdO2lmKHIud2hlbil7aWYoIWdsb2JhbC5MdW5hQ29yZS5jb25kaXRpb24oci53aGVuLHRoaXMuZy5jdHgoKSkpe2MuaW5kZXgrKztjb250aW51ZTt9fWlmKHIudHlwZT09PSdjaG9pY2UnKXt0aGlzLnNjcmVlbignc2NlbmUtY2hvaWNlJyk7cmV0dXJuO31pZih0aGlzLnZpZXc9PT0nc2NlbmUnKXRoaXMuZHJhdygpO2Vsc2UgdGhpcy5zY3JlZW4oJ3NjZW5lJyk7cmV0dXJuO310aGlzLmRpYWxvZz1udWxsO2MuZG9uZSgpO31cbiBhc3luYyBwcmVsb2FkKGxhYmVsLHVybHMsZG9uZSl7Y29uc3QgdG9rZW49Kyt0aGlzLnRva2VuO3RoaXMubG9hZExhYmVsPWxhYmVsO3RoaXMubG9hZFBlcmNlbnQ9MDt0aGlzLnNjcmVlbignbG9hZGluZycpO2NvbnN0IHVuaXF1ZT1bLi4ubmV3IFNldCh1cmxzLmZpbHRlcihCb29sZWFuKSldO2NvbnN0IHJldHJ5PSgpPT50aGlzLnByZWxvYWQobGFiZWwsdXJscyxkb25lKTt0aGlzLnJldHJ5TG9hZD1yZXRyeTt0cnl7bGV0IG49MDthd2FpdCBQcm9taXNlLmFsbCh1bmlxdWUubWFwKHNyYz0+dGhpcy5pbWFnZShzcmMpLnRoZW4oKCk9PntpZih0b2tlbj09PXRoaXMudG9rZW4pe3RoaXMubG9hZFBlcmNlbnQ9KytuL3VuaXF1ZS5sZW5ndGgqMTAwO3RoaXMuZHJhdygpO319KSkpO2lmKHRva2VuIT09dGhpcy50b2tlbilyZXR1cm47ZG9uZSgpO31jYXRjaChlKXtpZih0b2tlbiE9PXRoaXMudG9rZW4pcmV0dXJuO3RoaXMubG9hZEVycm9yPSfrhKTtirjsm4ztgawg7Jew6rKw7J2EIO2ZleyduO2VtCDso7zshLjsmpQuIOyLpO2MqO2VnCDrpqzshozsiqQ6ICcrZS5tZXNzYWdlO3RoaXMuc2NyZWVuKCdsb2FkLWVycm9yJyk7fX1cbiBpbWFnZShzcmMpe2lmKHRoaXMubG9hZGVkLmhhcyhzcmMpKXJldHVybiBQcm9taXNlLnJlc29sdmUoKTtyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KT0+e2NvbnN0IGltPW5ldyBJbWFnZSgpLHRpbWVyPXNldFRpbWVvdXQoKCk9PnJlamVjdChFcnJvcihzcmMpKSwyMDAwMCk7aW0ub25sb2FkPSgpPT57Y2xlYXJUaW1lb3V0KHRpbWVyKTt0aGlzLmxvYWRlZC5hZGQoc3JjKTtyZXNvbHZlKCk7fTtpbS5vbmVycm9yPSgpPT57Y2xlYXJUaW1lb3V0KHRpbWVyKTtyZWplY3QoRXJyb3Ioc3JjKSk7fTtpbS5zcmM9c3JjO30pO31cbiBzY3JpcHQobmFtZSl7aWYodGhpcy5zY3JpcHRQcm9taXNlcy5oYXMobmFtZSkpcmV0dXJuIHRoaXMuc2NyaXB0UHJvbWlzZXMuZ2V0KG5hbWUpO2NvbnN0IHA9bmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KT0+e2NvbnN0IHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7cy5zcmM9J3NyYy9jaW5lbWEvJytuYW1lKycuanM/dj0nKyhuYW1lPT09J3N0dWRpby1wbGF5ZXInPydpbmstZml0LTIwMjYxMDE5JzpuYW1lPT09J3BsYXllcic/J2luay1maXQtMjAyNjEwMTknOm5hbWU9PT0ndGVycmFjZS1tZW1vcnknPydkYXkzLW5vdGlvbi0yMDI2MTAwNCc6J2RyZWFtLW9wZW5pbmctMScpO3Mub25sb2FkPXJlc29sdmU7cy5vbmVycm9yPSgpPT57dGhpcy5zY3JpcHRQcm9taXNlcy5kZWxldGUobmFtZSk7cy5yZW1vdmUoKTtyZWplY3QoRXJyb3Iocy5zcmMpKTt9O2RvY3VtZW50LmhlYWQuYXBwZW5kKHMpO30pO3RoaXMuc2NyaXB0UHJvbWlzZXMuc2V0KG5hbWUscCk7cmV0dXJuIHA7fVxuIGFzeW5jIHByZXBhcmVTdHVkaW8oaWQpe1xuICBmb3IoY29uc3QgbmFtZSBvZiBbJ2Fzc2V0cycsJ3Nwcml0ZXMnLCdzdGFnZScsJ3N0YWdlMycsJ3N0YWdlNCcsJ2VuZ2luZScsJ3N0dWRpby1wbGF5ZXInXSlhd2FpdCB0aGlzLnNjcmlwdChuYW1lKTtcbiAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZT0+Z2xvYmFsLlNwcml0ZXMubG9hZChyZXNvbHZlKSk7Z2xvYmFsLkVuZ2luZS5pbml0QW5jaG9ycz8uKCk7XG4gIHJldHVybiBnbG9iYWwuTHVuYVN0dWRpb0NpbmVtYS5wcmVwYXJlKGlkKTtcbiB9XG4gYXN5bmMgbmV3R2FtZSgpe1xuICB0aGlzLnNlcnZpY2VWZXJzaW9uPSdBJzt0aGlzLmNhbmNlbE1lbW9yeVRyYW5zaXRpb24oKTt0aGlzLmNhbmNlbERheVRyYW5zaXRpb24oKTt0aGlzLmNhbmNlbERvb3JUcmFuc2l0aW9uKCk7dGhpcy5kaXNwb3NlQ2luZW1hKCk7Y29uc3QgdG9rZW49Kyt0aGlzLnRva2VuO1xuICB0aGlzLm91dHNpZGUuZXhpdCh0cnVlKTt0aGlzLmRpYWxvZz1udWxsO3RoaXMuYXdha2VuaW5nPW51bGw7dGhpcy5saWZ0TG9nb1BlbmRpbmc9ZmFsc2U7XG4gIGlmKHRoaXMuc2Vzc2lvbi5hY3RpdmUpdGhpcy5zZXNzaW9uLnVuaW5zdGFsbCgpO3RoaXMuc3RvcnlWZXJzaW9uPSdBJzt0aGlzLmRhdGE9Z2xvYmFsLkxVTkFfQ0FNUEFJR05fREFUQTt0aGlzLnNlc3Npb249bmV3IGdsb2JhbC5MdW5hQ2FtcGFpZ25FbmdpbmUuU2Vzc2lvbih0aGlzLmcsdGhpcy5ELHRoaXMuZGF0YSk7dGhpcy5zZXNzaW9uLm9uU3RlcD1zPT50aGlzLnN0b3J5U3RlcChzKTt0aGlzLnNlc3Npb24uaW5zdGFsbCh7c2VydmljZVZlcnNpb246J0EnfSk7dGhpcy5zZXNzaW9uLmJlZ2luQ29tbXV0ZSgwKTtcbiAgdGhpcy5maXJzdExpZnQ9ZmFsc2U7dGhpcy5tb3JuaW5nU2Vlbi5jbGVhcigpO3RoaXMubmlnaHRTdGFydGVkPWZhbHNlO3RoaXMuY2xlYXJJbnB1dCgpO3RoaXMuZy5sYW5nPSdrbyc7dGhpcy51aS5kYXk9MDt0aGlzLnVpLnZhcmlhbnQ9J29yaWdpbmFsJzt0aGlzLnVpLnNlcnZpY2VWZXJzaW9uPSdBJzt0aGlzLnVpLm1pbmlnYW1lcz1mYWxzZTt0aGlzLnVpLm91dHNpZGU9ZmFsc2U7dGhpcy51aS5jdXRzY2VuZXM9ZmFsc2U7dGhpcy51aS5pbnNwZWN0b3I9ZmFsc2U7dGhpcy51aS5hdXRvPWZhbHNlO3RoaXMuZy5zcGVlZD0xO1xuICB0aGlzLmxvYWRMYWJlbD0n64+E7J6F67aAIMK3IOyyqyDstpzqt7zsnYQg7KSA67mE7ZWY6rOgIOyeiOyKteuLiOuLpCc7dGhpcy5sb2FkUGVyY2VudD0wO3RoaXMuc2NyZWVuKCdsb2FkaW5nJyk7dGhpcy5yZXRyeUxvYWQ9KCk9PnRoaXMubmV3R2FtZSgpO1xuICB0cnl7XG4gICBjb25zdCBzY2VuZT1hd2FpdCB0aGlzLnByZXBhcmVTdHVkaW8oJ29wZW5pbmcnKTtpZih0b2tlbiE9PXRoaXMudG9rZW4pcmV0dXJuO3RoaXMubG9hZFBlcmNlbnQ9ODA7dGhpcy5kcmF3KCk7XG4gICBPYmplY3QuYXNzaWduKHRoaXMub3V0c2lkZS5jb25maWcse2RheTowLGZsb3c6J2luJyxwbGFjZTonaG9tZSd9KTthd2FpdCB0aGlzLm91dHNpZGUuc3RhcnQoe3dha2VBdFNvZmE6dHJ1ZX0pO2lmKHRva2VuIT09dGhpcy50b2tlbilyZXR1cm47aWYodGhpcy5vdXRzaWRlLmxvYWRFcnJvcil0aHJvdyBFcnJvcih0aGlzLm91dHNpZGUubG9hZEVycm9yKTtcbiAgIGNvbnN0IG1vZGVsPXRoaXMub3V0c2lkZS5tb2RlbDttb2RlbC5wYXVzZWQ9dHJ1ZTtcbiAgIHRoaXMuY2luZW1hPXtzdHVkaW86dHJ1ZSxtZW1vcnk6dHJ1ZSxyZXR1cm5UcmFuc2l0aW9uOidjdXQnLHNraXBVbnRpbDowLHRpdGxlOifrp4jsp4Drp4kg67aA7YOBIMK3IOyyqyDstpzqt7wnLHNjZW5lczpbc2NlbmVdLGluZGV4OjAsc2NlbmUsdGltZTowLHBsYXllcjpudWxsLHJldHVyblRvOigpPT57XG4gICAgaWYobW9kZWwhPT10aGlzLm91dHNpZGUubW9kZWwpcmV0dXJuO21vZGVsLnBhdXNlZD1mYWxzZTt0aGlzLm91dHNpZGUuY2xlYXJJbnB1dCgpO21vZGVsLnVwZGF0ZU5lYXIoKTt0aGlzLm91dHNpZGUudGljaygwKTt0aGlzLnNjcmVlbih0aGlzLnBsYXlWaWV3KTt0aGlzLnJlbmRlcih0cnVlKTt0aGlzLm91dHNpZGUuc2hvd0NvbnRyb2xzVHV0b3JpYWwoKTtcbiAgIH19O1xuICAgdGhpcy5iZ20uc2V0U3VwcHJlc3NlZCgnY2luZW1hJyx0cnVlKTt0aGlzLnNjcmVlbigncHJvbG9ndWUnKTtnbG9iYWwuTHVuYVN0dWRpb0NpbmVtYS51bmxvY2soKTtcbiAgfWNhdGNoKGUpe2lmKHRva2VuIT09dGhpcy50b2tlbilyZXR1cm47dGhpcy5sb2FkRXJyb3I9ZS5tZXNzYWdlO3RoaXMuc2NyZWVuKCdsb2FkLWVycm9yJyk7fVxuIH1cbiBwbGF5RGF5WmVyb1RWKG1vZGVsKXtcbiAgaWYobW9kZWwhPT10aGlzLm91dHNpZGUubW9kZWx8fG1vZGVsLmNvbmZpZy5kYXkhPT0wfHx0aGlzLm1lbW9yeVRyYW5zaXRpb24pcmV0dXJuO1xuICBtb2RlbC5wYXVzZWQ9dHJ1ZTt0aGlzLm91dHNpZGUuY2xlYXJJbnB1dCgpO21vZGVsLmJhY2tncm91bmRTdG9yeS5jYW5jZWwoKTt0aGlzLmRpc3Bvc2VDaW5lbWEoKTtcbiAgdGhpcy5yZXRyeUxvYWQ9KCk9PnRoaXMucGxheURheVplcm9UVihtb2RlbCk7XG4gIHRoaXMuYmVnaW5NZW1vcnlUcmFuc2l0aW9uKCgpPT50aGlzLnByZXBhcmVTdHVkaW8oJ2RvY3VtZW50YXJ5Jyksc2NlbmU9PntcbiAgIHRoaXMuY2luZW1hPXtzdHVkaW86dHJ1ZSxtZW1vcnk6dHJ1ZSx0aXRsZTonVFYg64uk7YGQIMK3IOyduOqzteyDneuqheyytOydmCDsl63sgqwnLHNjZW5lczpbc2NlbmVdLGluZGV4OjAsc2NlbmUsdGltZTowLHBsYXllcjpudWxsLHJldHVyblRvOigpPT57XG4gICAgaWYobW9kZWwhPT10aGlzLm91dHNpZGUubW9kZWwpcmV0dXJuO21vZGVsLnBhdXNlZD1mYWxzZTt0aGlzLm91dHNpZGUuY2xlYXJJbnB1dCgpO21vZGVsLnVwZGF0ZU5lYXIoKTt0aGlzLm91dHNpZGUudGljaygwKTt0aGlzLnNjcmVlbih0aGlzLnBsYXlWaWV3KTtcbiAgIH19O1xuICAgdGhpcy5iZ20uc2V0U3VwcHJlc3NlZCgnY2luZW1hJyx0cnVlKTt0aGlzLnNjcmVlbigncHJvbG9ndWUnKTtnbG9iYWwuTHVuYVN0dWRpb0NpbmVtYS51bmxvY2soKTtcbiAgfSx7cmV2ZWFsRHVyYXRpb246Ljh9KTtcbiB9XG4gLy8gQSBzaW5nbGUgb3ZlcmxheSBvd25zIGJvdGggaGFsdmVzIG9mIGEgbWVtb3J5IHRyYW5zaXRpb247IHNjZW5lIHJlZHJhd3MgY2Fubm90IHJlc2V0IGl0LlxuIGJlZ2luTWVtb3J5VHJhbnNpdGlvbihwcmVwYXJlLGNvbW1pdCx7dGVycmFjZT1mYWxzZSxyZXZlYWxEdXJhdGlvbj0xLjE1fT17fSl7XG4gIGlmKHRoaXMubWVtb3J5VHJhbnNpdGlvbilyZXR1cm47XG4gIHRoaXMucmVzZXRJbnB1dCgpO2NvbnN0IGhvc3Q9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7aG9zdC5jbGFzc05hbWU9J2NhbXBhaWduLW1lbW9yeS10cmFuc2l0aW9uJztob3N0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsdGVycmFjZT8n7YWM65287IqkIOyepeuptCDsoITtmZgnOiftmozsg4Eg7J6l66m0IOyghO2ZmCcpO3RoaXMuaG9zdC5jbGFzc0xpc3QudG9nZ2xlKCd0ZXJyYWNlLWVudGVyaW5nJyx0ZXJyYWNlKTtob3N0LnNldEF0dHJpYnV0ZSgncm9sZScsJ3N0YXR1cycpO2hvc3Quc3R5bGUub3BhY2l0eT0nMCc7ZG9jdW1lbnQuYm9keS5hcHBlbmQoaG9zdCk7XG4gIGNvbnN0IGQ9e2hvc3QsdGVycmFjZSxyZXZlYWxEdXJhdGlvbixiZ21Gcm9tOnRoaXMuYmdtLnRyYW5zaXRpb25HYWluLHBoYXNlOidvdXQnLHRpbWU6MCxyZWFkeTpmYWxzZSxjb21taXQsdmFsdWU6bnVsbCxlcnJvcjpudWxsfTt0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbihkLmJnbUZyb20sMCk7dGhpcy5tZW1vcnlUcmFuc2l0aW9uPWQ7dGhpcy52aWV3PSdtZW1vcnktdHJhbnNpdGlvbic7dGhpcy5ob3N0LmluZXJ0PXRydWU7XG4gIFByb21pc2UucmVzb2x2ZSgpLnRoZW4ocHJlcGFyZSkudGhlbih2YWx1ZT0+e2lmKHRoaXMubWVtb3J5VHJhbnNpdGlvbj09PWQpe2QudmFsdWU9dmFsdWU7ZC5yZWFkeT10cnVlO319KS5jYXRjaChlcnJvcj0+e2lmKHRoaXMubWVtb3J5VHJhbnNpdGlvbj09PWQpe2QuZXJyb3I9ZXJyb3I7ZC5yZWFkeT10cnVlO319KTtcbiB9XG4gY2FuY2VsTWVtb3J5VHJhbnNpdGlvbigpe3RoaXMubWVtb3J5VHJhbnNpdGlvbj8uaG9zdC5yZW1vdmUoKTt0aGlzLm1lbW9yeVRyYW5zaXRpb249bnVsbDt0aGlzLmhvc3QuY2xhc3NMaXN0LnJlbW92ZSgndGVycmFjZS1lbnRlcmluZycpO3RoaXMuaG9zdC5pbmVydD1mYWxzZTt0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbigxKTt9XG4gdGlja01lbW9yeVRyYW5zaXRpb24oZHQpe1xuICBjb25zdCBkPXRoaXMubWVtb3J5VHJhbnNpdGlvbjtpZighZClyZXR1cm4gZmFsc2U7aWYoZ2xvYmFsLkx1bmFGb2N1c1NldHRpbmdzLmhpZGRlblBhdXNlZClyZXR1cm4gdHJ1ZTtcbiAgY29uc3Qgc21vb3RoPXg9Pnt4PU1hdGgubWF4KDAsTWF0aC5taW4oMSx4KSk7cmV0dXJuIHgqeCooMy0yKngpO307ZC50aW1lKz1kdDtcbiAgaWYoZC5waGFzZT09PSdvdXQnKXtcbiAgIGNvbnN0IGFscGhhPXNtb290aChkLnRpbWUvLjkpO2QuaG9zdC5zdHlsZS5vcGFjaXR5PWFscGhhO3RoaXMuYmdtLnNldFRyYW5zaXRpb25HYWluKGQuYmdtRnJvbSooMS1hbHBoYSksMCk7XG4gICBpZihkLnRpbWU+PS45KXtkLnBoYXNlPSdob2xkJztkLnRpbWU9MDtkLmhvc3Quc3R5bGUub3BhY2l0eT0nMSc7fVxuICB9ZWxzZSBpZihkLnBoYXNlPT09J2hvbGQnJiZkLnRpbWU+PS4yJiZkLnJlYWR5KXtcbiAgIGlmKGQuZXJyb3Ipe3RoaXMuY2FuY2VsTWVtb3J5VHJhbnNpdGlvbigpO3RoaXMubG9hZEVycm9yPShkLnRlcnJhY2U/J+2FjOudvOyKpOulvCDrtojrn6zsmKTsp4Ag66q77ZaI7Ja07JqULiAnOiftmozsg4HsnYQg67aI65+s7Jik7KeAIOuqu+2WiOyWtOyalC4gJykrZC5lcnJvci5tZXNzYWdlO3RoaXMuc2NyZWVuKCdsb2FkLWVycm9yJyk7cmV0dXJuIHRydWU7fVxuICAgdHJ5e2QuY29tbWl0KGQudmFsdWUpO31jYXRjaChlcnJvcil7dGhpcy5jYW5jZWxNZW1vcnlUcmFuc2l0aW9uKCk7dGhpcy5sb2FkRXJyb3I9ZXJyb3IubWVzc2FnZTt0aGlzLnNjcmVlbignbG9hZC1lcnJvcicpO3JldHVybiB0cnVlO31cbiAgIGlmKHRoaXMubWVtb3J5VHJhbnNpdGlvbiE9PWQpcmV0dXJuIHRydWU7ZC5waGFzZT0naW4nO2QudGltZT0wO2QuaG9zdC5zdHlsZS5vcGFjaXR5PScxJzt0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbigwLDApO1xuICB9ZWxzZSBpZihkLnBoYXNlPT09J2luJyl7XG4gICBjb25zdCBhbW91bnQ9c21vb3RoKGQudGltZS9kLnJldmVhbER1cmF0aW9uKTtkLmhvc3Quc3R5bGUub3BhY2l0eT0xLWFtb3VudDt0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbihhbW91bnQsMCk7XG4gICBpZihkLnRpbWU+PWQucmV2ZWFsRHVyYXRpb24pe3RoaXMuY2FuY2VsTWVtb3J5VHJhbnNpdGlvbigpO3RoaXMucmVzZXRJbnB1dCgpO2lmKHRoaXMudmlldz09PSdwcm9sb2d1ZScpKHRoaXMuaG9zdC5xdWVyeVNlbGVjdG9yKCcud29ybGQtY2hvaWNlcyAuaXMtc2VsZWN0ZWQnKXx8dGhpcy5ob3N0LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbixzZWxlY3QsaW5wdXQnKSk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG4gfVxuIHBsYXlKb2hubnlNZW1vcnkoZG9uZSl7Y29uc3QgdGVycmFjZT10aGlzLmRpYWxvZzt0aGlzLnJldHJ5TG9hZD0oKT0+e3RoaXMuZGlhbG9nPXRlcnJhY2U7dGhpcy5wbGF5Sm9obm55TWVtb3J5KGRvbmUpO307dGhpcy5iZWdpbk1lbW9yeVRyYW5zaXRpb24oKCk9Pmdsb2JhbC5MdW5hSm9obm55TWVtb3J5LnByZXBhcmUodGhpcy5EKSwoKT0+e3RoaXMuZGlhbG9nPXtyb3dzOnRoaXMuZGF0YS5zY2VuZXMuam9obm55LHRpdGxlOifsobDri4jsnZgg6riw7Ja1JyxiYWNrZ3JvdW5kOidqb2hubnktbWVtb3J5JyxpbmRleDowLGNoYXJzOjAsZG9uZTooKT0+e3RoaXMuYmVnaW5NZW1vcnlUcmFuc2l0aW9uKCgpPT5udWxsLCgpPT57dGhpcy5nLnByb2dyZXNzLmZsYWdzLmNhbXBhaWduX29ic2VydmF0aW9uPXRydWU7aWYodGhpcy5zZXNzaW9uLmNhcnJ5KXRoaXMuc2Vzc2lvbi5jYXJyeS5mbGFncy5jYW1wYWlnbl9vYnNlcnZhdGlvbj10cnVlO3RoaXMuZGlhbG9nPXRlcnJhY2U7ZG9uZSgpO30se3RlcnJhY2U6dHJ1ZSxyZXZlYWxEdXJhdGlvbjoxLjh9KTt9fTt0aGlzLnNjcmVlbignc2NlbmUnKTt9KTt9XG4gcGxheVRlcnJhY2VNZW1vcnkoZG9uZSxtZW1vcnlLZXk9J3RlcnJhY2VNZW1vcnknKXtcbiAgdGhpcy5kaXNwb3NlQ2luZW1hKCk7dGhpcy50b2tlbisrO3RoaXMucmV0cnlMb2FkPSgpPT50aGlzLnBsYXlUZXJyYWNlTWVtb3J5KGRvbmUsbWVtb3J5S2V5KTtcbiAgdGhpcy5iZWdpbk1lbW9yeVRyYW5zaXRpb24oYXN5bmMoKT0+e1xuICAgY29uc3Qgc2NyaXB0cz1bJ2Fzc2V0cycsJ3Nwcml0ZXMnLCdzdGFnZScsJ3N0YWdlMycsJ2VuZ2luZScsJ3NmeCcsJ3RlcnJhY2UtbWVtb3J5JywncGxheWVyJ107Zm9yKGNvbnN0IG5hbWUgb2Ygc2NyaXB0cylhd2FpdCB0aGlzLnNjcmlwdChuYW1lKTtcbiAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmU9Pmdsb2JhbC5TcHJpdGVzLmxvYWQocmVzb2x2ZSkpO2dsb2JhbC5FbmdpbmUuaW5pdEFuY2hvcnM/LigpO2dsb2JhbC5FbmdpbmUuc2V0TGluZU92ZXJyaWRlcyh7fSk7Z2xvYmFsLkVuZ2luZS5zZXRUeXBpbmdTY2FsZSgxKTtcbiAgIHJldHVybiBnbG9iYWwuYnVpbGRUZXJyYWNlTWVtb3J5KHRoaXMuZGF0YS5zY2VuZXNbbWVtb3J5S2V5XSx7ZGF5MzptZW1vcnlLZXk9PT0ndGVycmFjZU1lbW9yeTMnfSk7XG4gIH0sc2NlbmU9PntcbiAgIHRoaXMuY2luZW1hPXtzY2VuZXM6W3NjZW5lXSxpbmRleDowLHNjZW5lLHRpbWU6MCxwbGF5ZXI6bnVsbCxyZW5kZXJlcjpudWxsLHRpdGxlOifsnKDrgpjsmYDsnZgg6riw7Ja1IMK3IO2PkOq4sOusvCDsspjrpqzshownLG1lbW9yeUtleSxtZW1vcnk6dHJ1ZSxyZXR1cm5Ubzpkb25lfTtcbiAgIHRoaXMuYmdtLnNldFN1cHByZXNzZWQoJ2NpbmVtYScsdHJ1ZSk7dGhpcy5zY3JlZW4oJ3Byb2xvZ3VlJyk7Z2xvYmFsLlNmeD8ucmVzdW1lKCk7XG4gIH0pO1xuIH1cbiByZWxlYXNlQ2luZW1hU2tpcCgpe3RoaXMuY2luZW1hSG9sZFN0YXJ0PW51bGw7fVxuIGNhblNraXBDaW5lbWEoKXtjb25zdCBjPXRoaXMuY2luZW1hO3JldHVybiAhIWMmJihjLnNraXBVbnRpbD09bnVsbHx8Yy50aW1lPGMuc2tpcFVudGlsKTt9XG4gdGlja0NpbmVtYURpYWxvZ3VlKGMsZHQpe1xuICAvLyBNYW51YWwgbGluZXMgb3duIHRoZWlyIGNsb2NrLiBLZWVwIHRoZSBzY2VuZSBhbGl2ZSwgYnV0IG5ldmVyIGNyb3NzIGFcbiAgLy8gZGlhbG9ndWUgYm91bmRhcnkgdW50aWwgYSBmcmVzaCBrZXkgcHJlc3MgYWNrbm93bGVkZ2VzIHRoYXQgbGluZS5cbiAgaWYoYy5kaWFsb2d1ZVdhaXQpe2MuZGlhbG9ndWVXYWl0LmFnZSs9ZHQ7cmV0dXJuO31cbiAgY29uc3QgbmV4dD1NYXRoLm1pbihjLnNjZW5lLmVuZCxjLnRpbWUrZHQpO1xuICBjb25zdCBsaW5lPWMuc3R1ZGlvJiZjLnNjZW5lLmNsaXBzLmZpbHRlcihsPT5sLnR5cGU9PT0nZGlhbG9ndWUnJiZsLndhaXQmJmwuc3RhcnQrbC5kdXJhdGlvbj5jLnRpbWUmJmwuc3RhcnQ8PW5leHQpLnNvcnQoKGEsYik9PmEuc3RhcnQtYi5zdGFydClbMF07XG4gIGlmKGxpbmUpe2MudGltZT1NYXRoLm1heChjLnRpbWUsbGluZS5zdGFydCk7Yy5kaWFsb2d1ZVdhaXQ9e2lkOmxpbmUuaWQsYWdlOjAscmV2ZWFsZWQ6ZmFsc2V9O31cbiAgZWxzZSBjLnRpbWU9bmV4dDtcbiB9XG4gYWR2YW5jZUNpbmVtYURpYWxvZ3VlKCl7XG4gIGNvbnN0IGM9dGhpcy5jaW5lbWEsdz1jPy5kaWFsb2d1ZVdhaXQ7aWYoIXd8fGMuZGlhbG9ndWVDaG9pY2UpcmV0dXJuO1xuICBjb25zdCBsaW5lPWMuc2NlbmUuY2xpcHMuZmluZChsPT5sLmlkPT09dy5pZCkscGFyc2VkPWdsb2JhbC5TdHVkaW9UYWdzLnBhcnNlKGxpbmUudGV4dCk7XG4gIGlmKGdsb2JhbC5TdHVkaW9PcGVuaW5nPy50eXBpbmdQZW5kaW5nKGxpbmUsTWF0aC5tYXgoMCxjLnRpbWUtbGluZS5zdGFydCkrdy5hZ2UpKXJldHVybjtcbiAgY29uc3QgY291bnQ9Yy5wbGF5ZXIuZGlhbG9ndWVDb3VudChsaW5lKTtcbiAgaWYoIXcucmV2ZWFsZWQmJmxpbmUudGV4dEVmZmVjdCE9PSdpbnN0YW50JyYmY291bnQ8cGFyc2VkLmNoYXJzLmxlbmd0aCl3LnJldmVhbGVkPXRydWU7XG4gIGVsc2UgaWYobGluZS5jaG9pY2VBZnRlcil7dGhpcy5wYWludENpbmVtYUNob2ljZXMoKTtyZXR1cm47fVxuICBlbHNle1xuICAgaWYobGluZS5pbnRyb0NvbnRyb2xzJiYhbGluZS5pbnRyb0ZhZGUpe2NvbnN0IGZhZGU9Yy5zY2VuZS5jbGlwcy5maW5kKGw9PmwuaW50cm9GYWRlKTtpZihmYWRlKWZhZGUuaW50cm9QaGFzZU9mZnNldD1NYXRoLm1heCgwLGMudGltZS1saW5lLnN0YXJ0KSt3LmFnZTt9XG4gICBjLnRpbWU9bGluZS5zdGFydCtsaW5lLmR1cmF0aW9uKy4wMDE7Yy5kaWFsb2d1ZVdhaXQ9bnVsbDtcbiAgfVxuICAvLyBGaW5pc2ggaW4gdGhpcyBpbnB1dCBldmVudCwgYmVmb3JlIGRyYXdpbmcgdGhlIHRpbWVsaW5lJ3MgZW1wdHkgZW5kIGZyYW1lLlxuICBpZihjLnJldHVyblRyYW5zaXRpb249PT0nY3V0JyYmIWMuZGlhbG9ndWVXYWl0JiZjLnRpbWU+PWMuc2NlbmUuZW5kKXt0aGlzLmZpbmlzaENpbmVtYSgpO3JldHVybjt9XG4gIGMucGxheWVyLnJlbmRlcihjLnRpbWUsbnVsbCx0aGlzLnVpLmdpbW1pY2tBdWRpbyxnbG9iYWwuTHVuYVNmeC52b2x1bWUqLjU1LGMuZGlhbG9ndWVXYWl0KTtcbiAgdGhpcy5wYWludENpbmVtYUNob2ljZXMoKTtcbiB9XG4gcGFpbnRDaW5lbWFDaG9pY2VzKCl7XG4gIGNvbnN0IGM9dGhpcy5jaW5lbWE7aWYodGhpcy52aWV3IT09J3Byb2xvZ3VlJ3x8IWM/LnN0dWRpbylyZXR1cm47XG4gIGNvbnN0IGxpbmU9Yy5kaWFsb2d1ZVdhaXQmJmMuc2NlbmUuY2xpcHMuZmluZChsPT5sLmlkPT09Yy5kaWFsb2d1ZVdhaXQuaWQpO1xuICBpZihsaW5lPy5jaG9pY2VBZnRlciYmIWMuZGlhbG9ndWVDaG9pY2UmJmMucGxheWVyLmRpYWxvZ3VlQ291bnQobGluZSk+PWdsb2JhbC5TdHVkaW9UYWdzLnBhcnNlKGxpbmUudGV4dCkuY2hhcnMubGVuZ3RoKWMuZGlhbG9ndWVDaG9pY2U9ey4uLmxpbmUuY2hvaWNlQWZ0ZXIsc3RhdGU6e30sbGluZUlkOmxpbmUuaWR9O1xuICBjb25zdCBjaG9pY2U9Yy5kaWFsb2d1ZUNob2ljZTtpZighY2hvaWNlKXt0aGlzLmNpbmVtYUNob2ljZXM/LnVwZGF0ZShudWxsKTtyZXR1cm47fVxuICBpZih0aGlzLmNpbmVtYUNob2ljZU93bmVyIT09Y2hvaWNlKXt0aGlzLmNpbmVtYUNob2ljZXM/LmRpc3Bvc2UoKTt0aGlzLmNpbmVtYUNob2ljZXM9bnVsbDt0aGlzLmNpbmVtYUNob2ljZU93bmVyPWNob2ljZTt9XG4gIGlmKCF0aGlzLmNpbmVtYUNob2ljZXMpdGhpcy5jaW5lbWFDaG9pY2VzPWdsb2JhbC5MdW5hV29ybGRDaG9pY2VzLmNyZWF0ZSh0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignLmNhbXBhaWduLXN0YWdlJyksaWQ9PntcbiAgIGlmKHRoaXMuY2luZW1hIT09Y3x8dGhpcy52aWV3IT09J3Byb2xvZ3VlJ3x8Yy5kaWFsb2d1ZUNob2ljZSE9PWNob2ljZSlyZXR1cm47XG4gICBjb25zdCBvcHRpb249Y2hvaWNlLm9wdGlvbnMuZmluZChvPT5vLmlkPT09aWQpO2lmKCFvcHRpb24pcmV0dXJuO1xuICAgY29uc3QgcmVzcG9uc2U9Yy5zY2VuZS5jbGlwcy5maW5kKGw9PmwuY2hvaWNlUmVzcG9uc2U9PT1jaG9pY2UuaWQpO2lmKHJlc3BvbnNlKXJlc3BvbnNlLnRleHQ9b3B0aW9uLmxhYmVsO1xuICAgY29uc3Qgc291cmNlPWMuc2NlbmUuY2xpcHMuZmluZChsPT5sLmlkPT09Y2hvaWNlLmxpbmVJZCk7XG4gICBjLmRpYWxvZ3VlQ2hvaWNlPW51bGw7Yy5kaWFsb2d1ZVdhaXQ9bnVsbDtjLnRpbWU9c291cmNlLnN0YXJ0K3NvdXJjZS5kdXJhdGlvbisuMDAxO1xuICAgdGhpcy5jaW5lbWFDaG9pY2VzLnVwZGF0ZShudWxsKTt0aGlzLnJlc2V0SW5wdXQoKTtcbiAgIGMucGxheWVyLnJlbmRlcihjLnRpbWUsbnVsbCx0aGlzLnVpLmdpbW1pY2tBdWRpbyxnbG9iYWwuTHVuYVNmeC52b2x1bWUqLjU1LG51bGwpO1xuICB9LGNob2ljZS5zdGF0ZSk7XG4gIGNvbnN0IHNhbXBsZT1jLnJlbmRlcmVyLnNhbXBsZShjLnRpbWUpLGFjdG9yPXNhbXBsZS5hY3RvcnNbY2hvaWNlLmFjdG9yXSxjYW09c2FtcGxlLmNhbWVyYTtcbiAgaWYoIWFjdG9yKXJldHVybjtcbiAgY29uc3Qgaz0xMjgwL2NhbS53LGhlYWQ9e3g6NjQwKyhhY3Rvci54LWNhbS54KSprLHk6MzYwLShhY3Rvci55Ky44LWNhbS55KSprfTtcbiAgdGhpcy5jaW5lbWFDaG9pY2VzLnVwZGF0ZSh7Li4uY2hvaWNlLGtleTpjaG9pY2UuaWQsaGVhZCxmYWNpbmc6YWN0b3IuZmFjaW5nfSk7XG4gfVxuIHBhaW50Q2luZW1hU2tpcChkdD0wKXtcbiAgY29uc3QgYWxsb3dlZD10aGlzLmNhblNraXBDaW5lbWEoKTtpZighYWxsb3dlZCl7dGhpcy5yZWxlYXNlQ2luZW1hU2tpcCgpO31cbiAgY29uc3QgcGxheWluZz10aGlzLnZpZXc9PT0ncHJvbG9ndWUnJiYhdGhpcy5tZW1vcnlUcmFuc2l0aW9uJiYhdGhpcy5kYXlUcmFuc2l0aW9uJiYhZ2xvYmFsLkx1bmFGb2N1c1NldHRpbmdzLmhpZGRlblBhdXNlZDtcbiAgLy8gVGhpcyBjbG9jayBiZWxvbmdzIHRvIHRoZSBjaW5lbWF0aWMsIG5vdCBpdHMgRE9NIG9yIHRpbWVsaW5lLiBSZWRyYXdzIGFuZFxuICAvLyBwYXVzZS9yZXN1bWUgY2Fubm90IHJlc3RhcnQgaXQsIGFuZCBsb2FkaW5nL2ZhZGVzIGRvIG5vdCBjb25zdW1lIHRoZSBoaW50LlxuICBpZihhbGxvd2VkJiZwbGF5aW5nKXRoaXMuY2luZW1hLnNraXBIaW50QWdlPU1hdGgubWluKENJTkVNQV9TS0lQX0lOVFJPX1NFQ09ORFMsKHRoaXMuY2luZW1hLnNraXBIaW50QWdlfHwwKStNYXRoLm1heCgwLGR0KSk7XG4gIGNvbnN0IGludHJvPWFsbG93ZWQmJnBsYXlpbmcmJih0aGlzLmNpbmVtYS5za2lwSGludEFnZXx8MCk8Q0lORU1BX1NLSVBfSU5UUk9fU0VDT05EUztcbiAgY29uc3QgaGVsZD1hbGxvd2VkJiZ0aGlzLmNpbmVtYUhvbGRTdGFydCE9bnVsbCxlbGFwc2VkPWhlbGQ/TWF0aC5tYXgoMCxwZXJmb3JtYW5jZS5ub3coKS10aGlzLmNpbmVtYUhvbGRTdGFydCk6MCxob2xkVmlzaWJsZT1oZWxkJiZlbGFwc2VkPj1DSU5FTUFfU0tJUF9SRVZFQUxfTVMsdmlzaWJsZT1pbnRyb3x8aG9sZFZpc2libGU7XG4gIC8vIEhvbGQgcHJvZ3Jlc3Mgd2FpdHMgMzAwIG1zIGV2ZW4gd2hlbiB0aGUgaW50cm9kdWN0aW9uIGlzIHZpc2libGU7IHRvdGFsXG4gIC8vIGhvbGQgdGltZSByZW1haW5zIDIgc2Vjb25kcy4gTWVyZWx5IGRpc3BsYXlpbmcgdGhlIGhpbnQgY2Fubm90IHNraXAuXG4gIGNvbnN0IHByb2dyZXNzPWhvbGRWaXNpYmxlP01hdGgubWluKDEsKGVsYXBzZWQtQ0lORU1BX1NLSVBfUkVWRUFMX01TKS8oQ0lORU1BX1NLSVBfSE9MRF9NUy1DSU5FTUFfU0tJUF9SRVZFQUxfTVMpKTowLGVsPXRoaXMuaG9zdC5xdWVyeVNlbGVjdG9yKCcuY2FtcGFpZ24tc2tpcCcpO1xuICBpZihlbCl7ZWwuY2xhc3NMaXN0LmFkZCgnaXMtY29tcGFjdCcpO2VsLmhpZGRlbj0hYWxsb3dlZDtlbC5jbGFzc0xpc3QudG9nZ2xlKCdpcy12aXNpYmxlJyx2aXNpYmxlKTtlbC5xdWVyeVNlbGVjdG9yKCdzcGFuJykudGV4dENvbnRlbnQ9J+yKpO2OmOydtOyKpCDrsJTrpbwgMuy0iOqwhCDriIzrn6wg7Iqk7YK1JztlbC5xdWVyeVNlbGVjdG9yKCdpJykuc3R5bGUudHJhbnNmb3JtPSdzY2FsZVgoJytwcm9ncmVzcysnKSc7ZWwucXVlcnlTZWxlY3RvcignW3JvbGU9XCJwcm9ncmVzc2JhclwiXScpLnNldEF0dHJpYnV0ZSgnYXJpYS12YWx1ZW5vdycsTWF0aC5yb3VuZChwcm9ncmVzcyoxMDApKTt9XG4gIHJldHVybiBwcm9ncmVzcz49MTtcbiB9XG4gZGlzcG9zZUNpbmVtYShrZWVwTXVzaWNHYWluPWZhbHNlKXt0aGlzLmNpbmVtYUNob2ljZXM/LmRpc3Bvc2UoKTt0aGlzLmNpbmVtYUNob2ljZXM9bnVsbDtpZigha2VlcE11c2ljR2Fpbil0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbigxKTt0aGlzLnJlbGVhc2VDaW5lbWFTa2lwKCk7dGhpcy5jaW5lbWE/LnBsYXllcj8uZGlzcG9zZSgpO3RoaXMuY2luZW1hPW51bGw7Z2xvYmFsLlNmeD8uc2lsZW5jZSgpO2dsb2JhbC5TZng/LnNldEVuYWJsZWQoZmFsc2UpO2dsb2JhbC5TZng/LnNldExvd3Bhc3MoMCk7dGhpcy5iZ20uc2V0U3VwcHJlc3NlZCgnY2luZW1hJyxmYWxzZSk7fVxuIGZpbmlzaENpbmVtYShza2lwcGVkPWZhbHNlKXtpZih0aGlzLm1lbW9yeVRyYW5zaXRpb258fHRoaXMudmlldyE9PSdwcm9sb2d1ZSd8fCF0aGlzLmNpbmVtYSlyZXR1cm47XG4gIGlmKHNraXBwZWQpe1xuICAgaWYoIXRoaXMuY2FuU2tpcENpbmVtYSgpKXJldHVybjtcbiAgIGlmKHRoaXMuY2luZW1hLnNraXBVbnRpbCE9bnVsbCl7XG4gICAgLy8gU2tpcCB0aGUgZHJlYW0gb25seS4gUmVzdGFydCBhdCB0aGUgaGFyZCBjdXQgdG8gaG9tZSwgaW5jbHVkaW5nIHRoZSBhbGFybSxcbiAgICAvLyBibGFja291dCB3YWtlLXVwIGFuZCBldmVyeSBjb250YWN0IGxpbmU7IGhvbGRpbmcgU3BhY2UgY2Fubm90IHNraXAgYWdhaW4uXG4gICAgY29uc3QgYz10aGlzLmNpbmVtYTtjLnBsYXllci5wYXVzZT8uKCk7Yy50aW1lPWMuc2tpcFVudGlsO3RoaXMucmVsZWFzZUNpbmVtYVNraXAoKTtcbiAgICBjLnBsYXllci5yZW5kZXIoYy50aW1lLG51bGwsdGhpcy51aS5naW1taWNrQXVkaW8sZ2xvYmFsLkx1bmFTZngudm9sdW1lKi41NSxjLmRpYWxvZ3VlV2FpdCk7dGhpcy5wYWludENpbmVtYVNraXAoKTtyZXR1cm47XG4gICB9XG4gIH1cbiAgaWYodGhpcy5jaW5lbWEucmV0dXJuVHJhbnNpdGlvbj09PSdjdXQnJiZ0aGlzLmNpbmVtYS5yZXR1cm5Ubyl7Y29uc3QgZG9uZT10aGlzLmNpbmVtYS5yZXR1cm5Ubzt0aGlzLnJlc2V0SW5wdXQoKTt0aGlzLmRpc3Bvc2VDaW5lbWEoKTtkb25lKCk7cmV0dXJuO31cbiAgaWYodGhpcy5jaW5lbWEubWVtb3J5KXtjb25zdCBkb25lPXRoaXMuY2luZW1hLnJldHVyblRvO3RoaXMuYmVnaW5NZW1vcnlUcmFuc2l0aW9uKCgpPT5udWxsLCgpPT57dGhpcy5kaXNwb3NlQ2luZW1hKHRydWUpO2RvbmUoKTt9KTtyZXR1cm47fWNvbnN0IHJldHVyblRvPXRoaXMuY2luZW1hLnJldHVyblRvO2lmKHJldHVyblRvKXt0aGlzLmRpc3Bvc2VDaW5lbWEoKTtyZXR1cm5UbygpO3JldHVybjt9dGhpcy5iZ20uc2V0VHJhbnNpdGlvbkdhaW4oMCk7dGhpcy5kaXNwb3NlQ2luZW1hKHRydWUpO3RoaXMuc2Vzc2lvbi5iZWdpbkRheSgwKTt0aGlzLmcuc3RhcnRTdG9yeVBoYXNlKCdiYXInKTt0aGlzLmF3YWtlbmluZz17dGltZTowLGR1cmF0aW9uOjMuMyxmcm9tV2hpdGU6IXNraXBwZWR9O3RoaXMuc2NyZWVuKCdhd2FrZW5pbmcnKTt0aGlzLnJlbmRlcih0cnVlKTt9XG4gcGFpbnRBd2FrZW5pbmcoKXtjb25zdCB3PXRoaXMuYXdha2VuaW5nO2lmKCF3KXJldHVybjtjb25zdCBzbW9vdGg9eD0+e3g9TWF0aC5tYXgoMCxNYXRoLm1pbigxLHgpKTtyZXR1cm4geCp4KigzLTIqeCk7fTt0aGlzLmJnbS5zZXRUcmFuc2l0aW9uR2FpbihzbW9vdGgody50aW1lL3cuZHVyYXRpb24pLDApO2NvbnN0IGRhcms9dGhpcy5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5jYW1wYWlnbi13YWtlLWRhcmsnKSx3aGl0ZT10aGlzLmhvc3QucXVlcnlTZWxlY3RvcignLmNhbXBhaWduLXdha2Utd2hpdGUnKTtpZihkYXJrKWRhcmsuc3R5bGUub3BhY2l0eT0xLXNtb290aCgody50aW1lLTEpLzIuMyk7aWYod2hpdGUpd2hpdGUuc3R5bGUub3BhY2l0eT13LmZyb21XaGl0ZT8xLXNtb290aCh3LnRpbWUvLjcpOjA7fVxuXG4gc3RhcnRCYXIoZGF5LGNhcnJ5KXt0aGlzLnJ1bkRvb3JUcmFuc2l0aW9uKCdpbicsKCk9PlByb21pc2UuYWxsKE9iamVjdC52YWx1ZXModGhpcy5ELmFzc2V0cykubWFwKGE9PmEuc3JjKS5maWx0ZXIoc3JjPT4vXFwuKHBuZ3x3ZWJwfGdpZnxqcGU/ZykoPzpcXD98JCkvaS50ZXN0KHNyYykpLm1hcChzcmM9PnRoaXMuaW1hZ2Uoc3JjKSkpLCgpPT57XG4gIC8vIEtlZXAgdGhlIG91dHNpZGUgc2NlbmUgdW50aWwgdGhlIG9wYXF1ZSBkb29yIG93bnMgdGhlIHNjcmVlbi4gUHJlcGFyZSB0aGVcbiAgLy8gcmVhbCBiYXIgdW5kZXJuZWF0aCBpdCBiZWZvcmUgYmVnaW5uaW5nIHRoZSByZXZlYWwsIG5ldmVyIHRoZSBzZXR1cCBsb2JieS5cbiAgaWYodGhpcy5vdXRzaWRlLmFjdGl2ZSl0aGlzLm91dHNpZGUuZXhpdCh0cnVlKTtcbiAgT2JqZWN0LmFzc2lnbih0aGlzLnVpLHtkYXksdmFyaWFudDonb3JpZ2luYWwnLG91dHNpZGU6ZmFsc2UsbWluaWdhbWVzOmZhbHNlLGN1dHNjZW5lczpmYWxzZX0pO1xuICB0aGlzLnNlc3Npb24uYmVnaW5EYXkoZGF5LGNhcnJ5KTtcbiAgaWYoZGF5PT09MCYmZ2xvYmFsLkx1bmFTdG9yeU5vdGljZXM/LmNvbXBsZXRlR29hbCh0aGlzLmcucHJvZ3Jlc3MsJ2ZpcnN0X2NvbW11dGUnKSl7XG4gICAvLyBQZXJzaXN0IGNvbXBsZXRpb24gaW4gdGhlIHJldHJ5IGNoZWNrcG9pbnQgYXMgd2VsbCBhcyB0aGUgbmV4dCBjb21tdXRlIGNhcnJ5LlxuICAgZm9yKGNvbnN0IHByb2dyZXNzIG9mIFt0aGlzLnNlc3Npb24uY2hlY2twb2ludCx0aGlzLnNlc3Npb24uY2FycnldKWlmKHByb2dyZXNzKXtcbiAgICBwcm9ncmVzcy5vYmplY3RpdmVzPz89e307cHJvZ3Jlc3Mub2JqZWN0aXZlcy5maXJzdF9jb21tdXRlPXsuLi50aGlzLmcucHJvZ3Jlc3Mub2JqZWN0aXZlcy5maXJzdF9jb21tdXRlfTtcbiAgIH1cbiAgfVxuICB0aGlzLnJlbmRlcih0cnVlKTtcbiB9KTt9XG4gcnVuRG9vclRyYW5zaXRpb24oZGlyZWN0aW9uLHByZXBhcmUsY29tbWl0KXtcbiAgaWYodGhpcy5kb29yVHJhbnNpdGlvbilyZXR1cm47dGhpcy5yZXNldElucHV0KCk7Y29uc3QgZD17ZGlyZWN0aW9uLHByZXBhcmUsY29tbWl0LHN0YXJ0ZWRBdDpwZXJmb3JtYW5jZS5ub3coKSx0aW1lOjAscmVhZHk6ZmFsc2UsbW90aW9uQXQ6bnVsbCxyZXZlYWxBdDpudWxsfTt0aGlzLmRvb3JUcmFuc2l0aW9uPWQ7dGhpcy5zY3JlZW4oJ2Jhci1kb29yJyk7Z2xvYmFsLkx1bmFCYXJEb29yLnBhaW50KHRoaXMuaG9zdCxkKTtcbiAgdGhpcy5yZXRyeUxvYWQ9KCk9PnRoaXMucnVuRG9vclRyYW5zaXRpb24oZGlyZWN0aW9uLHByZXBhcmUsY29tbWl0KTtcbiAgUHJvbWlzZS5hbGwoW1Byb21pc2UuYWxsKGdsb2JhbC5MdW5hQmFyRG9vci5hc3NldHMubWFwKHNyYz0+dGhpcy5pbWFnZShzcmMpKSksUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKT0+e2lmKHRoaXMuZG9vclRyYW5zaXRpb249PT1kKXJldHVybiBwcmVwYXJlKCk7fSldKS50aGVuKCgpPT57aWYodGhpcy5kb29yVHJhbnNpdGlvbiE9PWQpcmV0dXJuO2QucmVhZHk9dHJ1ZTtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjb3V0c2lkZS1yb290Jyk/LnNldEF0dHJpYnV0ZSgnaW5lcnQnLCcnKTt9KS5jYXRjaChlPT57aWYodGhpcy5kb29yVHJhbnNpdGlvbiE9PWQpcmV0dXJuO3RoaXMuY2FuY2VsRG9vclRyYW5zaXRpb24oKTt0aGlzLmxvYWRFcnJvcj0n66y4IOuEiOuouOydmCDqs7XqsITsnYQg67aI65+s7Jik7KeAIOuqu+2WiOyWtOyalC4gJytlLm1lc3NhZ2U7dGhpcy5zY3JlZW4oJ2xvYWQtZXJyb3InKTt9KTtcbiB9XG4gY2FuY2VsRG9vclRyYW5zaXRpb24oKXt0aGlzLmRvb3JUcmFuc2l0aW9uPW51bGw7dGhpcy5ob3N0LnN0eWxlLm9wYWNpdHk9Jyc7fVxuIHRpY2tEb29yVHJhbnNpdGlvbihkdCl7Y29uc3QgZD10aGlzLmRvb3JUcmFuc2l0aW9uO2lmKCFkKXJldHVybiBmYWxzZTtpZihnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuaGlkZGVuUGF1c2VkKXJldHVybiB0cnVlO2QudGltZSs9ZHQ7XG4gIC8vIFRoZSBkb29yIGNhbm5vdCBtb3ZlIHVudGlsIGJvdGggdGhlIHZpc2libGUgdGhyZWUtc2Vjb25kIGhvbGQgYW5kIHJlYWwgbG9hZGluZyBjb21wbGV0ZS5cbiAgaWYoZC5yZWFkeSYmZC50aW1lPj0zJiZwZXJmb3JtYW5jZS5ub3coKS1kLnN0YXJ0ZWRBdD49MzAwMCYmZC5tb3Rpb25BdD09bnVsbClkLm1vdGlvbkF0PWQudGltZTtcbiAgaWYoZC5tb3Rpb25BdCE9bnVsbCYmZC50aW1lPj1kLm1vdGlvbkF0KzEuNyYmZC5yZXZlYWxBdD09bnVsbCl7dHJ5e2QuY29tbWl0dGluZz10cnVlO2QuY29tbWl0KCk7ZC5jb21taXR0aW5nPWZhbHNlO2QucmV2ZWFsQXQ9ZC50aW1lO31jYXRjaChlKXt0aGlzLmNhbmNlbERvb3JUcmFuc2l0aW9uKCk7dGhpcy5sb2FkRXJyb3I9ZS5tZXNzYWdlO3RoaXMuc2NyZWVuKCdsb2FkLWVycm9yJyk7cmV0dXJuIHRydWU7fX1cbiAgZ2xvYmFsLkx1bmFCYXJEb29yLnBhaW50KHRoaXMuaG9zdCxkKTtcbiAgaWYoZC5yZXZlYWxBdCE9bnVsbCYmZC50aW1lPj1kLnJldmVhbEF0Ky44KXt0aGlzLmNhbmNlbERvb3JUcmFuc2l0aW9uKCk7aWYodGhpcy5vdXRzaWRlLmFjdGl2ZSl0aGlzLm91dHNpZGUubW9kZWwucGF1c2VkPWZhbHNlO3RoaXMuc2NyZWVuKHRoaXMucGxheVZpZXcpO3RoaXMucmVuZGVyKHRydWUpO31yZXR1cm4gdHJ1ZTtcbiB9XG4gYXN5bmMgc3RyZWV0KGZsb3cscGxhY2U9J2Jhcicsd2FrZUF0U29mYT1mYWxzZSl7aWYoZmxvdz09PSdvdXQnJiZwbGFjZT09PSdiYXInKXt0aGlzLnNlc3Npb24ucm91dGU9Zmxvdzt0aGlzLnJ1bkRvb3JUcmFuc2l0aW9uKCdvdXQnLGFzeW5jKCk9PntpZih0aGlzLm91dHNpZGUuYWN0aXZlKXRoaXMub3V0c2lkZS5leGl0KHRydWUpO09iamVjdC5hc3NpZ24odGhpcy5vdXRzaWRlLmNvbmZpZyx7ZmxvdyxwbGFjZSxkYXk6dGhpcy5zZXNzaW9uLmRheSx2YXJpYW50OidvcmlnaW5hbCd9KTthd2FpdCB0aGlzLm91dHNpZGUuc3RhcnQoKTtpZih0aGlzLm91dHNpZGUubG9hZEVycm9yKXRocm93IEVycm9yKHRoaXMub3V0c2lkZS5sb2FkRXJyb3IpO30sKCk9Pnt0aGlzLm91dHNpZGUudGljaygwKTt9KTtyZXR1cm47fWNvbnN0IGRheVRyYW5zaXRpb249dGhpcy5kYXlUcmFuc2l0aW9uLHRva2VuPXRoaXMudG9rZW47dGhpcy5zZXNzaW9uLnJvdXRlPWZsb3c7dGhpcy5zY3JlZW4oJ2xvYWRpbmcnKTt0aGlzLmxvYWRMYWJlbD1mbG93PT09J291dCc/J+usuOydhCDri6vqs6AsIOynkeycvOuhnCc6J+yDiOuhnOyatCDtlZjro6gnO3RoaXMuZHJhdygpO09iamVjdC5hc3NpZ24odGhpcy5vdXRzaWRlLmNvbmZpZyx7ZmxvdyxwbGFjZSxkYXk6dGhpcy5zZXNzaW9uLmRheSx2YXJpYW50OidvcmlnaW5hbCd9KTthd2FpdCB0aGlzLm91dHNpZGUuc3RhcnQoe3dha2VBdFNvZmF9KTtpZih0b2tlbiE9PXRoaXMudG9rZW58fGRheVRyYW5zaXRpb24mJnRoaXMuZGF5VHJhbnNpdGlvbiE9PWRheVRyYW5zaXRpb24pcmV0dXJuO3RoaXMub3V0c2lkZS50aWNrKDApO3RoaXMuc2NyZWVuKHRoaXMucGxheVZpZXcpO31cbiBkZWJ1Z091dHNpZGVEYXkoZGF5LGZsb3cpe1xuICBpZighdGhpcy5hY3RpdmV8fCFOdW1iZXIuaXNJbnRlZ2VyKGRheSl8fGRheTwwfHxkYXk+MylyZXR1cm47XG4gIGNvbnN0IGNhcnJ5PXN0cnVjdHVyZWRDbG9uZSh0aGlzLmcucHJvZ3Jlc3MpO1xuICB0aGlzLmcucmVzZXQoZGF5LCdmdWxsJywxMTAwK2RheSxmYWxzZSx7dmFyaWFudDonb3JpZ2luYWwnLHNlcnZpY2VWZXJzaW9uOidBJ30pO1xuICB0aGlzLmcucHJvZ3Jlc3M9ey4uLmNhcnJ5LGRheSxwaGFzZTonY29tbXV0ZSd9O1xuICB0aGlzLnNlc3Npb24uZGF5PWRheTt0aGlzLnNlc3Npb24ucm91dGU9Zmxvdzt0aGlzLnNlc3Npb24uc2VydmljZVZlcnNpb249J0EnO1xuICB0aGlzLnNlc3Npb24uY2Fycnk9c3RydWN0dXJlZENsb25lKHRoaXMuZy5wcm9ncmVzcyk7dGhpcy5zZXNzaW9uLmNoZWNrcG9pbnQ9bnVsbDt0aGlzLnNlc3Npb24ucGVuZGluZ1N0ZXA9bnVsbDtcbiAgdGhpcy5tb3JuaW5nU2Vlbi5kZWxldGUoZGF5KTt0aGlzLm5pZ2h0U3RhcnRlZD1mYWxzZTt0aGlzLmRpYWxvZz1udWxsO3RoaXMuZmlyc3RMaWZ0PWRheSE9PTA7XG4gIHRoaXMudWkuZGF5PWRheTt0aGlzLnVpLnZhcmlhbnQ9J29yaWdpbmFsJzt0aGlzLnVpLnNlcnZpY2VWZXJzaW9uPSdBJzt0aGlzLmcuY2hhbmdlZCgpO1xuIH1cbiBsZWF2ZUJhcigpe2lmKCF0aGlzLnNlc3Npb24uc2V0dGxlKCkpe3RoaXMucmVuZGVyKHRydWUpO3JldHVybjt9dGhpcy5zdHJlZXQoJ291dCcpO31cbiBzdG9yeVN0ZXAoc3RlcCl7aWYoc3RlcC50eXBlPT09J2NhbXBhaWduX21lbnUnKXt0aGlzLnNjcmVlbignbWVudScpO3JldHVybjt9aWYoc3RlcC50eXBlPT09J2NhbXBhaWduX3Jlc3BvbnNlJyl7dGhpcy5zY3JlZW4oJ3Jlc3BvbnNlJyk7cmV0dXJuO31pZihzdGVwLnR5cGU9PT0nY2FtcGFpZ25fbWVtb3J5Jyl7dGhpcy5zY2VuZSgnam9obm55Jywn7KGw64uI7J2YIOq4sOyWtScsJ2JhcicsKCk9PnRoaXMubWVtb3J5UXVpeigpLHttZW1vcnk6dHJ1ZX0pO319XG4gbWVtb3J5UXVpeigpe3RoaXMub2JzZXJ2YXRpb25FcnJvcj0nJzt0aGlzLnNjcmVlbignb2JzZXJ2YXRpb24nKTt9XG4gY29tcGxldGVNZW1vcnkoKXt0aGlzLmcucHJvZ3Jlc3MuZmxhZ3MuY2FtcGFpZ25fb2JzZXJ2YXRpb249dHJ1ZTt0aGlzLnNjZW5lKCdwcmVwYXJlJywn67CUIMK3IOuCtOydvOydmCDspIDruYQnLCdiYXInLCgpPT57dGhpcy5zY3JlZW4odGhpcy5wbGF5Vmlldyk7dGhpcy5zZXNzaW9uLmZpbmlzaFN0ZXAoKTt0aGlzLnJlbmRlcih0cnVlKTt9KTt9XG4gcHJldmlld0NvbW11dGUobW9kZWwpe2lmKFsyLDNdLmluY2x1ZGVzKG1vZGVsLmNvbmZpZy5kYXkpKXJldHVybiBnbG9iYWwuTHVuYU91dHNpZGVTYW1ob0NvbW11dGUuc3RhcnQobW9kZWwpO21vZGVsLm5vdGlvbkNvbW11dGVTZWVuPXRydWU7bW9kZWwuc3RvcnkuY2FuY2VsKCk7bW9kZWwuYmFja2dyb3VuZFN0b3J5LmNhbmNlbCgpO3RoaXMuc3RyZWV0QmFja2Ryb3A9dGhpcy5vdXRzaWRlLnNuYXBzaG90KCk7dGhpcy5zY2VuZSgnY29tbXV0ZScrbW9kZWwuY29uZmlnLmRheSwn7Lac6re86ri4IMK3IOyCvO2YuCcsJ3N0cmVldCcsKCk9PnRoaXMuc2NyZWVuKCdkZXZlbG9wZXInKSk7fVxuIGludGVyYWN0T3V0c2lkZShtb2RlbCx0YXJnZXQpe2lmKG1vZGVsIT09dGhpcy5vdXRzaWRlLm1vZGVsfHxtb2RlbC5xYSlyZXR1cm4gZmFsc2U7XG4gIGlmKHRhcmdldC5pZD09PSdzb2ZhJyYmbW9kZWwuY29uZmlnLmZsb3chPT0nb3V0JylyZXR1cm4gdHJ1ZTtcbiAgaWYodGFyZ2V0LmlkPT09J3R2JyYmbW9kZWwuY29uZmlnLmRheT09PTApe3RoaXMucGxheURheVplcm9UVihtb2RlbCk7cmV0dXJuIHRydWU7fVxuICAvLyBDaGVjayBvbiBib2FyZGluZyB0aGUgdXB3YXJkIGhvbWV3YXJkIGxpZnQsIG5vdCB3aGVuIGNhbGxpbmcgaXQgb3IgbGVhdmluZyBob21lLlxuICBpZigodGhpcy5hY3RpdmV8fHRoaXMuc2Vzc2lvbi5kZXZlbG9wZXIpJiZ0YXJnZXQuaWQ9PT0nZWxldmF0b3InJiZtb2RlbC5zY2VuZT09PSdzdHJlZXQnJiZtb2RlbC5sZXZlbD09PTAmJm1vZGVsLmNvbmZpZy5mbG93PT09J291dCcmJk1hdGguYWJzKG1vZGVsLmVsZXZhdG9yWS1nbG9iYWwuTHVuYVJlc2lkZW5jZS5sYXlvdXQuZWxldmF0b3JCb3R0b20pPD0uMDEpe2NvbnN0IG1pc3Npbmc9dGhpcy5kYXlFbmRSZXF1aXJlbWVudHMobW9kZWwuY29uZmlnLmRheSk7aWYobWlzc2luZy5sZW5ndGgpe3RoaXMub3V0c2lkZS5jbGVhcklucHV0KCk7dGhpcy5zaG93SG9tZXdhcmRSZXF1aXJlbWVudHMobWlzc2luZyk7cmV0dXJuIHRydWU7fX1cbiAgaWYoIXRoaXMuYWN0aXZlKXtpZighdGhpcy5zZXNzaW9uLmRldmVsb3BlcilyZXR1cm4gZmFsc2U7XG4gICBpZih0YXJnZXQuaWQ9PT0nc29mYScpe3RoaXMuc2xlZXBPdXRzaWRlVGVzdChtb2RlbCk7cmV0dXJuIHRydWU7fVxuICAgaWYobW9kZWwuY29uZmlnLmRheTwyKXJldHVybiBmYWxzZTtcbiAgIGlmKHRhcmdldC5pZD09PSdzdG9yeS1zYW1obycpe3RoaXMucHJldmlld0NvbW11dGUobW9kZWwpO3JldHVybiB0cnVlO31cbiAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZih0YXJnZXQuaWQ9PT0nYmFyJyl7aWYodGhpcy5zZXNzaW9uLnJvdXRlPT09J2luJyl7dGhpcy5zdGFydEJhcih0aGlzLnNlc3Npb24uZGF5LHRoaXMuc2Vzc2lvbi5jYXJyeSk7fWVsc2UgdGhpcy5ub3RpY2UoJ+yYpOuKmCDsmIHsl4XsnYAg64Gd64Ks7Ja07JqULiDsmbzsqr0g7JeY66as67Kg7J207YSw66W8IO2DgOqzoCDsp5HsnLzroZwg64+M7JWE6rCA7IS47JqULicpO3JldHVybiB0cnVlO31cbiAgaWYodGFyZ2V0LmlkPT09J3NvZmEnKXtpZih0aGlzLnNlc3Npb24ucm91dGU9PT0nb3V0Jyl7dGhpcy5yZXN1bWVWaWV3PSdnYW1lJzt0aGlzLnNjcmVlbignc2xlZXAnKTt9cmV0dXJuIHRydWU7fVxuICByZXR1cm4gZmFsc2U7XG4gfVxuIHF1aWV0TGlmdChtb2RlbCl7XG4gIGNvbnN0IHJpZGU9bW9kZWwucmlkZTtcbiAgaWYoISh0aGlzLmFjdGl2ZXx8dGhpcy5zZXNzaW9uLmRldmVsb3Blcil8fG1vZGVsLmNvbmZpZy5kYXkhPT0wfHxtb2RlbC5jb25maWcuZmxvdyE9PSdvdXQnfHxtb2RlbC5zY2VuZSE9PSdzdHJlZXQnfHxtb2RlbC5sZXZlbCE9PTB8fCFyaWRlfHxyaWRlLmNhbGx8fHJpZGUudG88PXJpZGUuZnJvbXx8cmlkZS50aXRsZVJldmVhbHx8KHRoaXMuYWN0aXZlP3RoaXMuZmlyc3RMaWZ0Om1vZGVsLmxpZnRMb2dvU2VlbikpcmV0dXJuIGZhbHNlO1xuICAvLyBNYXJrIHRoaXMgcmlkZSwgbm90IGFuIGVhcmxpZXIgY29tbXV0ZS9jYWxsLiBBbiBpbnRlcnJ1cHRlZCByaWRlIGJlZm9yZVxuICAvLyB0aGUgdGl0bGUgYXBwZWFycyBtdXN0IG5vdCBjb25zdW1lIHRoZSBmaXJzdCBob21ld2FyZCByZXZlYWwuXG4gIHJpZGUudGl0bGVSZXZlYWw9dHJ1ZTt0aGlzLmxpZnRMb2dvUGVuZGluZz10cnVlO21vZGVsLmJhY2tncm91bmRTdG9yeS5jYW5jZWwoKTttb2RlbC5zdG9yeS5jYW5jZWwoKTtyZXR1cm4gdHJ1ZTtcbiB9XG4gbm90aWNlKHRleHQsdGl0bGU9J+ujqOuCmCcpe3RoaXMucmVzdW1lVmlldz10aGlzLnZpZXc9PT0nZ2FtZSc/J2dhbWUnOnRoaXMudmlldzt0aGlzLm5vdGljZVRleHQ9dGV4dDt0aGlzLm5vdGljZVRpdGxlPXRpdGxlO3RoaXMuc2NyZWVuKCdub3RpY2UnKTt9XG4gYmVnaW5EYXlUcmFuc2l0aW9uKGZyb20sdG8scHJlcGFyZSl7XG4gIGlmKHRoaXMuZGF5VHJhbnNpdGlvbilyZXR1cm47XG4gIGNvbnN0IGhvc3Q9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VjdGlvbicpO2hvc3QuY2xhc3NOYW1lPSdjYW1wYWlnbi1kYXktdHJhbnNpdGlvbic7aG9zdC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCdzdGF0dXMnKTtob3N0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsJ0RheSAnK2Zyb20rJyDihpIgRGF5ICcrdG8pO1xuICBob3N0LmlubmVySFRNTD0nPGRpdiBjbGFzcz1cImRheS10cmFuc2l0aW9uLXNoYWRlXCI+PC9kaXY+PGRpdiBjbGFzcz1cImRheS10cmFuc2l0aW9uLXRpdGxlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PHNwYW4+RGF5PC9zcGFuPjxzcGFuIGNsYXNzPVwiZGF5LXRyYW5zaXRpb24tZGlnaXRzXCI+PHNwYW4gY2xhc3M9XCJkYXktZGlnaXQtb2xkXCI+Jytmcm9tKyc8L3NwYW4+PHNwYW4gY2xhc3M9XCJkYXktZGlnaXQtbmV3XCI+Jyt0bysnPC9zcGFuPjwvc3Bhbj48L2Rpdj4nO1xuICB0aGlzLmRheVRyYW5zaXRpb249e2Zyb20sdG8sdGltZTowLGhvc3QscHJlcGFyZSxzdGFydGVkOmZhbHNlLHJlYWR5OmZhbHNlLHJldmVhbEF0Om51bGx9O2RvY3VtZW50LmJvZHkuYXBwZW5kKGhvc3QpO3RoaXMucmVzZXRJbnB1dCgpO3RoaXMuYXBwLmluZXJ0PXRydWU7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI291dHNpZGUtcm9vdCcpPy5zZXRBdHRyaWJ1dGUoJ2luZXJ0JywnJyk7dGhpcy5wYWludERheVRyYW5zaXRpb24oKTtcbiB9XG4gY2FuY2VsRGF5VHJhbnNpdGlvbigpe3RoaXMuZGF5VHJhbnNpdGlvbj8uaG9zdC5yZW1vdmUoKTt0aGlzLmRheVRyYW5zaXRpb249bnVsbDt9XG4gcGFpbnREYXlUcmFuc2l0aW9uKCl7XG4gIGNvbnN0IGQ9dGhpcy5kYXlUcmFuc2l0aW9uO2lmKCFkKXJldHVybjtjb25zdCBzbW9vdGg9eD0+e3g9TWF0aC5tYXgoMCxNYXRoLm1pbigxLHgpKTtyZXR1cm4geCp4KigzLTIqeCk7fTtcbiAgY29uc3Qgcm9sbD1zbW9vdGgoKGQudGltZS0xLjU1KS8uNjUpLHJldmVhbD1kLnJldmVhbEF0PT1udWxsPzA6c21vb3RoKChkLnRpbWUtZC5yZXZlYWxBdCkvLjkpO1xuICBkLmhvc3QucXVlcnlTZWxlY3RvcignLmRheS10cmFuc2l0aW9uLXNoYWRlJykuc3R5bGUub3BhY2l0eT1zbW9vdGgoZC50aW1lLy42NSkqKDEtcmV2ZWFsKTtcbiAgZC5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5kYXktdHJhbnNpdGlvbi10aXRsZScpLnN0eWxlLm9wYWNpdHk9c21vb3RoKChkLnRpbWUtLjcpLy4zKSooMS1zbW9vdGgoKGQudGltZS0zKS8uMykpO1xuICBjb25zdCBvbGQ9ZC5ob3N0LnF1ZXJ5U2VsZWN0b3IoJy5kYXktZGlnaXQtb2xkJyksbmV4dD1kLmhvc3QucXVlcnlTZWxlY3RvcignLmRheS1kaWdpdC1uZXcnKTtvbGQuc3R5bGUudHJhbnNmb3JtPSd0cmFuc2xhdGVZKCcrKC1yb2xsKjExMCkrJyUpJztvbGQuc3R5bGUub3BhY2l0eT0xLXJvbGw7bmV4dC5zdHlsZS50cmFuc2Zvcm09J3RyYW5zbGF0ZVkoJysoKDEtcm9sbCkqMTEwKSsnJSknO25leHQuc3R5bGUub3BhY2l0eT1yb2xsO1xuIH1cbiB0aWNrRGF5VHJhbnNpdGlvbihkdCl7XG4gIGNvbnN0IGQ9dGhpcy5kYXlUcmFuc2l0aW9uO2lmKCFkKXJldHVybiBmYWxzZTtpZihnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuaGlkZGVuUGF1c2VkKXJldHVybiB0cnVlO2QudGltZSs9ZHQ7XG4gIGlmKGQudGltZT49Mi4yNSYmIWQuc3RhcnRlZCl7ZC5zdGFydGVkPXRydWU7UHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKT0+e2lmKHRoaXMuZGF5VHJhbnNpdGlvbj09PWQpcmV0dXJuIGQucHJlcGFyZSgpO30pLnRoZW4oKCk9PntpZih0aGlzLmRheVRyYW5zaXRpb249PT1kKWQucmVhZHk9dHJ1ZTt9KS5jYXRjaChlPT57aWYodGhpcy5kYXlUcmFuc2l0aW9uIT09ZClyZXR1cm47dGhpcy5jYW5jZWxEYXlUcmFuc2l0aW9uKCk7dGhpcy5uaWdodFN0YXJ0ZWQ9ZmFsc2U7dGhpcy5sb2FkRXJyb3I9ZS5tZXNzYWdlO3RoaXMucmV0cnlMb2FkPSgpPT50aGlzLmJlZ2luRGF5VHJhbnNpdGlvbihkLmZyb20sZC50byxkLnByZXBhcmUpO3RoaXMuc2NyZWVuKCdsb2FkLWVycm9yJyk7fSk7fVxuICBpZihkLnJlYWR5JiZkLnRpbWU+PTMuNCYmZC5yZXZlYWxBdD09bnVsbClkLnJldmVhbEF0PWQudGltZTtcbiAgdGhpcy5wYWludERheVRyYW5zaXRpb24oKTtcbiAgaWYoZC5yZXZlYWxBdCE9bnVsbCYmZC50aW1lPj1kLnJldmVhbEF0Ky45KXt0aGlzLmNhbmNlbERheVRyYW5zaXRpb24oKTt0aGlzLnNjcmVlbih0aGlzLmNpbmVtYT8uZGFpbHlXYWtlPydwcm9sb2d1ZSc6dGhpcy5wbGF5Vmlldyk7dGhpcy5yZW5kZXIodHJ1ZSk7fVxuICByZXR1cm4gdHJ1ZTtcbiB9XG4gZGF5RW5kUmVxdWlyZW1lbnRzKGRheSx7bWVtb3J5PWZhbHNlfT17fSl7cmV0dXJuIGRheT09PTI/dGhpcy5nLmpvaG5ueU1pc3Npbmcoe21lbW9yeX0pOltdO31cbiBzaG93SG9tZXdhcmRSZXF1aXJlbWVudHMobWlzc2luZyl7Y29uc3QgbGFiZWxzPW1pc3NpbmcubWFwKGlkPT5pZD09PSdqb2hubnlfbWVtb3J5Jz8n7KGw64uI7J2YIOugiOyLnO2UvCDtmozsg4EnOnRoaXMuZy5uYW1lKGlkKSk7dGhpcy5ub3RpY2UoJ+yVhOyngSDtlbTslbwg7ZWgIOydvOydtCDrgqjslYQg7J6I7Iq164uI64ukLlxcbu2ZleyduO2VoCDtla3rqqk6ICcrbGFiZWxzLmpvaW4oJyDCtyAnKSsnXFxu7ZWE7JqU7ZWcIOyerOujjOuKlCDqsbDrpqzsnZgg7IucQkFS7JeQ6rKM7IScIOq1rO2VoCDsiJgg7J6I7Iq164uI64ukLicsJ+ynkeyXkCDsmKzrnbzqsIDquLAg7KCE7JeQJyk7dGhpcy5yZXN1bWVWaWV3PXRoaXMucGxheVZpZXc7fVxuIHNsZWVwT3V0c2lkZVRlc3QobW9kZWwpe1xuICBpZihtb2RlbCE9PXRoaXMub3V0c2lkZS5tb2RlbHx8bW9kZWwucWF8fCF0aGlzLm91dHNpZGUuYWN0aXZlfHxtb2RlbC5zY2VuZSE9PSdob21lJ3x8dGhpcy52aWV3IT09J2RldmVsb3Blcid8fHRoaXMuZGF5VHJhbnNpdGlvbnx8dGhpcy5tZW1vcnlUcmFuc2l0aW9uKXJldHVybjtcbiAgaWYobW9kZWwuY29uZmlnLmZsb3chPT0nb3V0Jyl7dGhpcy5ub3RpY2UoJ+yngOq4iOydgCDstpzqt7zquLjsnoXri4jri6QuIOuwlOyXkCDri6TrhYDsmKgg65KkIO2HtOq3vOq4uCDsg4Htg5zsl5DshJwg7ZWY66Oo66W8IOuniOy5oCDsiJgg7J6I7Ja07JqULicsJ+yGjO2MjCcpO3JldHVybjt9XG4gIGlmKHRoaXMub3V0c2lkZVNsZWVwPT09bW9kZWwpcmV0dXJuO1xuICBjb25zdCBkYXk9bW9kZWwuY29uZmlnLmRheTtpZihkYXk8MHx8ZGF5PjMpcmV0dXJuO1xuICB0aGlzLm91dHNpZGVTbGVlcD1tb2RlbDttb2RlbC5zdG9yeS5jYW5jZWwoKTttb2RlbC5iYWNrZ3JvdW5kU3RvcnkuY2FuY2VsKCk7dGhpcy5vdXRzaWRlLmNsZWFySW5wdXQoKTtcbiAgY29uc3QgZmluaXNoPSgpPT57XG4gICBpZih0aGlzLm91dHNpZGVTbGVlcCE9PW1vZGVsKXJldHVybjt0aGlzLm91dHNpZGVTbGVlcD1udWxsO1xuICAgLy8gQSBjYW5jZWxsZWQgcHJldmlldyBvciBhIHJlc3RhcnRlZCB0ZXN0IG11c3Qgbm90IGFkdmFuY2UgYSBkaWZmZXJlbnQgcnVuLlxuICAgaWYoIXRoaXMuc2Vzc2lvbi5kZXZlbG9wZXJ8fCF0aGlzLm91dHNpZGUuYWN0aXZlfHx0aGlzLm91dHNpZGUubW9kZWwhPT1tb2RlbHx8bW9kZWwuY29uZmlnLmRheSE9PWRheSlyZXR1cm47XG4gICBpZihkYXk9PT0zKXt0aGlzLnNjcmVlbignZGV2ZWxvcGVyJyk7dGhpcy5vdXRzaWRlLmV4aXQoKTt0aGlzLm5vdGljZSgnM+ydvOywqCDthYzrnbzsiqQg64yA7ZmU6rmM7KeAIOuniOyzpOyKteuLiOuLpC4g7YOQ7IOJ7J2EIOuLpOyLnCDsi5zsnpHtlZwg65KkIFAg7Yyo64SQ7JeQ7IScIOydvOywqOulvCDrsJTqv4Ag7IiYIOyeiOyWtOyalC4nLCfsmbjrtoAg7J287LCoIO2FjOyKpO2KuCDsmYTro4wnKTtyZXR1cm47fVxuICAgdGhpcy5iZWdpbkRheVRyYW5zaXRpb24oZGF5LGRheSsxLGFzeW5jKCk9Pntjb25zdCB0cmFuc2l0aW9uPXRoaXMuZGF5VHJhbnNpdGlvbixzY2VuZT1hd2FpdCB0aGlzLnByZXBhcmVTdHVkaW8oJ21vcm5pbmcnKTtpZih0aGlzLmRheVRyYW5zaXRpb24hPT10cmFuc2l0aW9uKXJldHVybjtpZighdGhpcy5zZXNzaW9uLmRldmVsb3Blcnx8dGhpcy5vdXRzaWRlLm1vZGVsIT09bW9kZWwpdGhyb3cgRXJyb3IoJ+yZuOu2gCDthYzsiqTtirjqsIAg67OA6rK965CY7JeI7Iq164uI64ukLicpO2lmKCF0aGlzLm91dHNpZGUuYWR2YW5jZURheSgpKXRocm93IEVycm9yKCfri6TsnYwg7J287LCo66GcIOydtOuPme2VmOyngCDrqrvtlojsirXri4jri6QuJyk7dGhpcy5zdGFydFJlc3RDaW5lbWEoc2NlbmUsKCk9PnRoaXMuZmluaXNoTW9ybmluZygpLHRydWUpO30pO1xuICB9O1xuICB0aGlzLnBsYXlTbGVlcFNjZW5lcyhkYXksZmluaXNoKTtcbiB9XG4gcGxheVNsZWVwU2NlbmVzKGRheSxmaW5pc2gpe1xuICBjb25zdCBjb21wbGV0ZT0oKT0+e2lmKHRoaXMuZGF5RW5kUmVxdWlyZW1lbnRzKGRheSx7bWVtb3J5OnRydWV9KS5pbmNsdWRlcygnam9obm55X21lbW9yeScpKXt0aGlzLnBsYXlKb2hubnlNZW1vcnkoZmluaXNoKTtyZXR1cm47fWZpbmlzaCgpO307XG4gIGNvbnN0IHRlcnJhY2U9KCk9Pntjb25zdCBrZXk9Z2xvYmFsLkx1bmFUZXJyYWNlLm5pZ2h0S2V5KGRheSk7aWYoa2V5JiZ0aGlzLmRhdGEuc2NlbmVzW2tleV0/Lmxlbmd0aCl0aGlzLnNjZW5lKGtleSwn7YWM65287IqkJywndGVycmFjZScsY29tcGxldGUpO2Vsc2UgdGhpcy5wbGF5UmVzdENpbmVtYSgnc2xlZXAnLGNvbXBsZXRlKTt9O1xuICAvLyBQbGF5ZXItb25seSBpbnRlcmx1ZGU6IG5vIEx1bmEga25vd2xlZGdlL3JlbGF0aW9uc2hpcCBmbGFncyBhcmUgY2hhbmdlZCBoZXJlLlxuICBpZihkYXk9PT0xJiZ0aGlzLmRhdGEuc2NlbmVzLndvcmtzaG9wPy5sZW5ndGgpdGhpcy5iZWdpbk1lbW9yeVRyYW5zaXRpb24oKCk9Pm51bGwsKCk9PnRoaXMuc2NlbmUoJ3dvcmtzaG9wJywn7Y+s7Yq47J2YIOyekeyXheyepScsJ2JsYWNrJyx0ZXJyYWNlKSk7ZWxzZSB0ZXJyYWNlKCk7XG4gfVxuIHN0YXJ0UmVzdENpbmVtYShzY2VuZSxkb25lLGRhaWx5V2FrZT1mYWxzZSl7XG4gIHRoaXMuZGlzcG9zZUNpbmVtYSgpO3RoaXMuZGlhbG9nPW51bGw7aWYodGhpcy5vdXRzaWRlLmFjdGl2ZSl0aGlzLm91dHNpZGUubW9kZWwucGF1c2VkPXRydWU7XG4gIHRoaXMuY2luZW1hPXtzdHVkaW86dHJ1ZSxkYWlseVdha2Usc2tpcFVudGlsOjAscmV0dXJuVHJhbnNpdGlvbjonY3V0Jyx0aXRsZTpzY2VuZS5uYW1lLHNjZW5lczpbc2NlbmVdLGluZGV4OjAsc2NlbmUsdGltZTowLHBsYXllcjpudWxsLHJldHVyblRvOmRvbmV9O1xuICB0aGlzLnNjcmVlbigncHJvbG9ndWUnKTtcbiB9XG4gcGxheVJlc3RDaW5lbWEoa2luZCxkb25lKXtcbiAgdGhpcy5yZXRyeUxvYWQ9KCk9PnRoaXMucGxheVJlc3RDaW5lbWEoa2luZCxkb25lKTtcbiAgdGhpcy5iZWdpbk1lbW9yeVRyYW5zaXRpb24oKCk9PnRoaXMucHJlcGFyZVN0dWRpbyhraW5kKSxzY2VuZT0+dGhpcy5zdGFydFJlc3RDaW5lbWEoc2NlbmUsZG9uZSkse3JldmVhbER1cmF0aW9uOi42NX0pO1xuIH1cbiBmaW5pc2hNb3JuaW5nKCl7XG4gIGlmKHRoaXMub3V0c2lkZS5hY3RpdmUpe3RoaXMub3V0c2lkZS5tb2RlbC5wYXVzZWQ9ZmFsc2U7dGhpcy5vdXRzaWRlLmNsZWFySW5wdXQoKTt0aGlzLm91dHNpZGUubW9kZWwudXBkYXRlTmVhcigpO3RoaXMub3V0c2lkZS50aWNrKDApO31cbiAgdGhpcy5uaWdodFN0YXJ0ZWQ9ZmFsc2U7dGhpcy5zY3JlZW4odGhpcy5wbGF5Vmlldyk7dGhpcy5yZW5kZXIodHJ1ZSk7XG4gfVxuIHNsZWVwKCl7XG4gIGlmKHRoaXMubmlnaHRTdGFydGVkfHwhdGhpcy5hY3RpdmV8fHRoaXMudmlldyE9PSdzbGVlcCd8fHRoaXMuc2Vzc2lvbi5yb3V0ZSE9PSdvdXQnfHx0aGlzLmRheVRyYW5zaXRpb24pcmV0dXJuO3RoaXMubmlnaHRTdGFydGVkPXRydWU7dGhpcy5vdXRzaWRlLm1vZGVsPy5zdG9yeS5jYW5jZWwoKTt0aGlzLm91dHNpZGUubW9kZWw/LmJhY2tncm91bmRTdG9yeS5jYW5jZWwoKTt0aGlzLm91dHNpZGUuY2xlYXJJbnB1dCgpO1xuICBjb25zdCBkPXRoaXMuc2Vzc2lvbi5kYXk7XG4gIGNvbnN0IGZpbmlzaD0oKT0+e2lmKGQ9PT0zKXt0aGlzLnNlc3Npb24uZW5kRGF5KCk7dGhpcy5uaWdodFN0YXJ0ZWQ9ZmFsc2U7dGhpcy5vdXRzaWRlLmV4aXQodHJ1ZSk7dGhpcy5zY3JlZW4oJ2VuZGluZycpO3JldHVybjt9dGhpcy5iZWdpbkRheVRyYW5zaXRpb24oZCxkKzEsYXN5bmMoKT0+e2NvbnN0IHRyYW5zaXRpb249dGhpcy5kYXlUcmFuc2l0aW9uLHNjZW5lPWF3YWl0IHRoaXMucHJlcGFyZVN0dWRpbygnbW9ybmluZycpO2lmKHRoaXMuZGF5VHJhbnNpdGlvbiE9PXRyYW5zaXRpb24pcmV0dXJuO2lmKHRoaXMuc2Vzc2lvbi5kYXk9PT1kJiYhdGhpcy5zZXNzaW9uLmVuZERheSgpKXRocm93IEVycm9yKCfsnbzssKgg7KKF66OMIOyDge2DnOulvCDtmZXsnbjtlbQg7KO87IS47JqULicpO2lmKHRoaXMuc2Vzc2lvbi5kYXkhPT1kKzEpdGhyb3cgRXJyb3IoJ+uLpOydjCDsnbzssKgg7IOB7YOc66W8IO2ZleyduO2VtCDso7zshLjsmpQuJyk7dGhpcy5vdXRzaWRlLmV4aXQodHJ1ZSk7YXdhaXQgdGhpcy5zdHJlZXQoJ2luJywnaG9tZScsdHJ1ZSk7aWYodGhpcy5kYXlUcmFuc2l0aW9uIT09dHJhbnNpdGlvbilyZXR1cm47dGhpcy5zdGFydFJlc3RDaW5lbWEoc2NlbmUsKCk9PnRoaXMuZmluaXNoTW9ybmluZygpLHRydWUpO30pO307XG4gIHRoaXMucGxheVNsZWVwU2NlbmVzKGQsZmluaXNoKTtcbiB9XG5cbiB0aWNrKGR0KXtpZih0aGlzLnZpZXc9PT0ndGl0bGUnKXRoaXMudGl0bGVMb2dvPy50aWNrKE1hdGgubWluKC4wNSxNYXRoLm1heCgwLGR0KSkpO2R0PU1hdGgubWluKC4wNSxNYXRoLm1heCgwLGR0KSk7aWYodGhpcy5tZW1vcnlUcmFuc2l0aW9uKXJldHVybiB0aGlzLnRpY2tNZW1vcnlUcmFuc2l0aW9uKGR0KTtpZih0aGlzLm91dHNpZGUuYWN0aXZlJiZ0aGlzLm91dHNpZGUuZGV2Q29uc29sZU9wZW4mJiF0aGlzLmJsb2NraW5nKXJldHVybiBmYWxzZTtpZih0aGlzLmRvb3JUcmFuc2l0aW9uKXJldHVybiB0aGlzLnRpY2tEb29yVHJhbnNpdGlvbihkdCk7aWYodGhpcy5kYXlUcmFuc2l0aW9uKXJldHVybiB0aGlzLnRpY2tEYXlUcmFuc2l0aW9uKGR0KTt0aGlzLnJldHVybkJ1dHRvbi5oaWRkZW49dGhpcy52aWV3IT09J2RldmVsb3Blcid8fHRoaXMub3V0c2lkZS5hY3RpdmV8fHRoaXMuZy5waGFzZSE9PSdyZWFkeSc7aWYodGhpcy52aWV3PT09J3NjZW5lJyYmIWdsb2JhbC5MdW5hRm9jdXNTZXR0aW5ncy5oaWRkZW5QYXVzZWQpe2lmKHRoaXMuZGlhbG9nLmJhY2tncm91bmQ9PT0ndGVycmFjZScpZ2xvYmFsLkx1bmFUZXJyYWNlLnRpY2sodGhpcy5kaWFsb2csZHQpO2NvbnN0IGJlZm9yZT10aGlzLmRpYWxvZy5jaGFyczt0aGlzLmRpYWxvZy5jaGFycys9ZHQqNjAqdGhpcy5nLmRpYWxvZ1NwZWVkO2dsb2JhbC5MdW5hRGlhbG9ndWVBdWRpbz8ucmV2ZWFsKHRoaXMuZGlhbG9nLnJvd3NbdGhpcy5kaWFsb2cuaW5kZXhdLnRleHQsYmVmb3JlLHRoaXMuZGlhbG9nLmNoYXJzKTt0aGlzLnBhaW50TGluZSgpO2lmKHRoaXMuZGlhbG9nLmJhY2tncm91bmQ9PT0nam9obm55LW1lbW9yeScpZ2xvYmFsLkx1bmFKb2hubnlNZW1vcnkuc3luYyh0aGlzLmhvc3QsdGhpcy5kaWFsb2csdGhpcy5ELGR0KTtpZih0aGlzLmNvbnRyb2wpe3RoaXMuc2tpcEFnZSs9ZHQ7aWYodGhpcy5za2lwQWdlPi4xMil7dGhpcy5za2lwQWdlPTA7dGhpcy5uZXh0KCk7fX19XG4gIGlmKHRoaXMudmlldz09PSdwcm9sb2d1ZScmJiFnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuaGlkZGVuUGF1c2VkKXtcbiAgIGNvbnN0IGM9dGhpcy5jaW5lbWEscHJldmlvdXM9Yy50aW1lO3RoaXMudGlja0NpbmVtYURpYWxvZ3VlKGMsZHQpO1xuICAgLy8gQSBjb21wbGV0ZWQgaG9sbyBzaHV0ZG93biByZXR1cm5zIGJlZm9yZSBkcmF3aW5nIHRoZSB0aW1lbGluZSdzIGVtcHR5IGVuZCBmcmFtZS5cbiAgIGlmKGMucmV0dXJuVHJhbnNpdGlvbj09PSdjdXQnJiYhYy5kaWFsb2d1ZVdhaXQmJmMudGltZT49Yy5zY2VuZS5lbmQpe3RoaXMuZmluaXNoQ2luZW1hKCk7cmV0dXJuIHRoaXMuYmxvY2tpbmc7fVxuICAgYy5wbGF5ZXIucmVuZGVyKGMudGltZSxwcmV2aW91cyx0aGlzLnVpLmdpbW1pY2tBdWRpbyxnbG9iYWwuTHVuYVNmeC52b2x1bWUqLjU1LGMuZGlhbG9ndWVXYWl0KTt0aGlzLnBhaW50Q2luZW1hQ2hvaWNlcygpO1xuICAgaWYodGhpcy5wYWludENpbmVtYVNraXAoZHQpKXt0aGlzLmZpbmlzaENpbmVtYSh0cnVlKTtyZXR1cm4gdGhpcy5ibG9ja2luZzt9XG4gICBpZihjLnRpbWU+PWMuc2NlbmUuZW5kKXtpZigrK2MuaW5kZXg8Yy5zY2VuZXMubGVuZ3RoKXtjLnNjZW5lPWMuc2NlbmVzW2MuaW5kZXhdO2MudGltZT0wO2dsb2JhbC5TZng/LnNpbGVuY2UoKTt0aGlzLmRyYXcoKTt9ZWxzZSB0aGlzLmZpbmlzaENpbmVtYSgpO31cbiAgfVxuICBpZih0aGlzLnZpZXc9PT0nYXdha2VuaW5nJyYmIWdsb2JhbC5MdW5hRm9jdXNTZXR0aW5ncy5oaWRkZW5QYXVzZWQpe3RoaXMuYXdha2VuaW5nLnRpbWUrPWR0O3RoaXMucGFpbnRBd2FrZW5pbmcoKTtpZih0aGlzLmF3YWtlbmluZy50aW1lPj10aGlzLmF3YWtlbmluZy5kdXJhdGlvbil7dGhpcy5hd2FrZW5pbmc9bnVsbDt0aGlzLnNjcmVlbih0aGlzLnBsYXlWaWV3KTt0aGlzLnJlbmRlcih0cnVlKTt9fVxuICBpZih0aGlzLnNlc3Npb24uZGV2ZWxvcGVyJiZ0aGlzLnZpZXc9PT0nZGV2ZWxvcGVyJyYmdGhpcy5vdXRzaWRlLmFjdGl2ZSYmIXRoaXMub3V0c2lkZS5sb2FkaW5nKXtjb25zdCBtPXRoaXMub3V0c2lkZS5tb2RlbDtpZighbS5xYSYmIW0ucGF1c2VkJiYhbS5yaWRlJiYhbS50cmFuc2l0aW9uJiYhbS5kaWFsb2cmJiFtLnN0b3J5LmJsb2NraW5nJiZtLmNvbmZpZy5mbG93PT09J2luJyYmbS5jb25maWcuZGF5PT09MyYmbS5zY2VuZT09PSdzdHJlZXQnJiZtLmxldmVsPT09MCYmTWF0aC5hYnMobS54KzUuOTkpPC43JiYhbS5ub3Rpb25Db21tdXRlU2Vlbil0aGlzLnByZXZpZXdDb21tdXRlKG0pO31cbiAgaWYoKHRoaXMuYWN0aXZlfHx0aGlzLnNlc3Npb24uZGV2ZWxvcGVyKSYmdGhpcy52aWV3PT09dGhpcy5wbGF5VmlldyYmdGhpcy5vdXRzaWRlLmFjdGl2ZSYmIXRoaXMub3V0c2lkZS5sb2FkaW5nKXtjb25zdCBtPXRoaXMub3V0c2lkZS5tb2RlbDtcbiAgIGxldCByZXZlYWw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NhbXBhaWduLWxpZnQtcmV2ZWFsJyk7Y29uc3Qgc2hvdz10aGlzLmxpZnRMb2dvUGVuZGluZyYmbS5jb25maWcuZGF5PT09MCYmbS5jb25maWcuZmxvdz09PSdvdXQnJiZtLnJpZGU/LnRpdGxlUmV2ZWFsJiYhbS5yaWRlLmNhbGwmJm0ucmlkZS50bz5tLnJpZGUuZnJvbSYmbS5yaWRlLnRpbWU+MyYmbS5yaWRlLnRpbWU8MTA7XG4gICBpZihzaG93JiYhcmV2ZWFsKXtyZXZlYWw9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7cmV2ZWFsLmlkPSdjYW1wYWlnbi1saWZ0LXJldmVhbCc7Y29uc3Qgc2hhZGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7c2hhZGUuY2xhc3NOYW1lPSdjYW1wYWlnbi1saWZ0LXNoYWRlJztzaGFkZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywndHJ1ZScpO2NvbnN0IGxvZ289ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7bG9nby5pZD0nY2FtcGFpZ24tbGlmdC1sb2dvJztsb2dvLnNyYz1wYXRoKCd0aXRsZS1sb2dvLnBuZycpO2xvZ28uYWx0PSdQcm9qZWN0IExVTkEnO2NvbnN0IHRlYW09ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7dGVhbS5jbGFzc05hbWU9J2NhbXBhaWduLWxpZnQtdGVhbSc7dGVhbS50ZXh0Q29udGVudD0nVGVhbS4gU2ltQ2h1bmcnO3JldmVhbC5hcHBlbmQoc2hhZGUsbG9nbyx0ZWFtKTtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcub3V0c2lkZS1zdGFnZScpLmFwcGVuZChyZXZlYWwpO31cbiAgIGlmKHNob3cpe3RoaXMuZmlyc3RMaWZ0PXRydWU7bS5saWZ0TG9nb1NlZW49dHJ1ZTtyZXZlYWwuc3R5bGUub3BhY2l0eT1NYXRoLm1heCgwLE1hdGgubWluKDEsKG0ucmlkZS50aW1lLTMpLzEuNSwoMTAtbS5yaWRlLnRpbWUpLzEuNSkpO31lbHNlIHJldmVhbD8ucmVtb3ZlKCk7aWYodGhpcy5saWZ0TG9nb1BlbmRpbmcmJiFtLnJpZGUpdGhpcy5saWZ0TG9nb1BlbmRpbmc9ZmFsc2U7XG4gIH1lbHNlIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjYW1wYWlnbi1saWZ0LXJldmVhbCcpPy5yZW1vdmUoKTtcbiAgcmV0dXJuIHRoaXMuYmxvY2tpbmc7XG4gfVxuIGludGVyY2VwdChuYW1lKXtpZighdGhpcy5hY3RpdmUpe2lmKHRoaXMuc2Vzc2lvbi5kZXZlbG9wZXImJm5hbWU9PT0nb2ZmZXInKXtjb25zdCBpc3N1ZXM9dGhpcy5zZXNzaW9uLnByb2JsZW1zKHRoaXMuZy5yZXN1bHQpO2lmKGlzc3Vlcy5sZW5ndGgpe3RoaXMuZHJpbmtJc3N1ZXM9aXNzdWVzO3RoaXMucmVzdW1lVmlldz0nZGV2ZWxvcGVyJzt0aGlzLnNjcmVlbigncmV0cnktZHJpbmsnKTtyZXR1cm4gdHJ1ZTt9fXJldHVybiBmYWxzZTt9aWYoWydpbnNwZWN0b3InLCdkZWJ1Z0VuZERheScsJ2RlYnVnRmlsbCcsJ2RlYnVnQ3JhZnQnLCd2ZXJzaW9uJywnc3RhcnQnLCdhcHBseVVwa2VlcCcsJ2V4cG9ydCddLmluY2x1ZGVzKG5hbWUpKXJldHVybiB0cnVlO1xuICBpZihuYW1lPT09J3NldHRpbmdzJ3x8bmFtZT09PSdoZWxwJyl7dGhpcy5yZXN1bWVWaWV3PSdnYW1lJzt0aGlzLnNjcmVlbignb3B0aW9ucycpO3JldHVybiB0cnVlO31cbiAgaWYobmFtZT09PSdzZXR1cCcpe3RoaXMucmVzdW1lVmlldz0nZ2FtZSc7dGhpcy5zY3JlZW4oJ2NvbmZpcm0tZXhpdCcpO3JldHVybiB0cnVlO31cbiAgaWYobmFtZT09PSdjb25maXJtU2V0dGxlbWVudCcpe3RoaXMubGVhdmVCYXIoKTtyZXR1cm4gdHJ1ZTt9aWYobmFtZT09PSdyZXRyeURheScpe3RoaXMuc2Vzc2lvbi5yZXRyeSgpO3RoaXMuc2NyZWVuKHRoaXMucGxheVZpZXcpO3RoaXMucmVuZGVyKHRydWUpO3JldHVybiB0cnVlO31cbiAgaWYobmFtZT09PSdvZmZlcicpe2NvbnN0IGlzc3Vlcz10aGlzLnNlc3Npb24ucHJvYmxlbXModGhpcy5nLnJlc3VsdCk7aWYoaXNzdWVzLmxlbmd0aCl7dGhpcy5kcmlua0lzc3Vlcz1pc3N1ZXM7dGhpcy5yZXN1bWVWaWV3PSdnYW1lJzt0aGlzLnNjcmVlbigncmV0cnktZHJpbmsnKTtyZXR1cm4gdHJ1ZTt9fVxuICByZXR1cm4gZmFsc2U7XG4gfVxuIHRvUGlja2VyKCl7dGhpcy5jYW5jZWxNZW1vcnlUcmFuc2l0aW9uKCk7dGhpcy5jYW5jZWxEYXlUcmFuc2l0aW9uKCk7dGhpcy5jYW5jZWxEb29yVHJhbnNpdGlvbigpO3RoaXMuZGlzcG9zZUNpbmVtYSgpO3RoaXMudG9rZW4rKzt0aGlzLm91dHNpZGUuZXhpdCh0cnVlKTt0aGlzLnNlc3Npb24udW5pbnN0YWxsKCk7dGhpcy5zdG9yeVZlcnNpb249J0EnO3RoaXMuZGF0YT1nbG9iYWwuTFVOQV9DQU1QQUlHTl9EQVRBO3RoaXMuZGlhbG9nPW51bGw7dGhpcy5jaW5lbWE9bnVsbDt0aGlzLmF3YWtlbmluZz1udWxsO3RoaXMuZy5yZXNldCgwLCdmdWxsJywxLGZhbHNlLHt2YXJpYW50OidvcmlnaW5hbCd9KTt0aGlzLmFwcC5oaWRkZW49ZmFsc2U7dGhpcy5zY3JlZW4oJ3BpY2tlcicpO31cbiBkZXZlbG9wZXIoKXt0aGlzLmNhbmNlbE1lbW9yeVRyYW5zaXRpb24oKTt0aGlzLmNhbmNlbERheVRyYW5zaXRpb24oKTt0aGlzLmNhbmNlbERvb3JUcmFuc2l0aW9uKCk7dGhpcy5kaXNwb3NlQ2luZW1hKCk7dGhpcy50b2tlbisrO2lmKHRoaXMub3V0c2lkZS5hY3RpdmUpdGhpcy5vdXRzaWRlLmV4aXQodHJ1ZSk7dGhpcy5zZXNzaW9uLnVuaW5zdGFsbCgpO3RoaXMuc3RvcnlWZXJzaW9uPSdBJzt0aGlzLmRhdGE9Z2xvYmFsLkxVTkFfQ0FNUEFJR05fREFUQTt0aGlzLnNlc3Npb24uc3Rvcnk9dGhpcy5kYXRhO3RoaXMuc2Vzc2lvbi5pbnN0YWxsKHtkZXZlbG9wZXI6dHJ1ZSxzZXJ2aWNlVmVyc2lvbjp0aGlzLnVpLnNlcnZpY2VWZXJzaW9ufSk7dGhpcy5nLnJlc2V0KHRoaXMudWkuZGF5LHRoaXMudWkubW9kZSx0aGlzLnVpLnNlZWQsZmFsc2Use3ZhcmlhbnQ6dGhpcy51aS52YXJpYW50LHNlcnZpY2VWZXJzaW9uOnRoaXMudWkuc2VydmljZVZlcnNpb259KTt0aGlzLmFwcC5oaWRkZW49ZmFsc2U7dGhpcy5zY3JlZW4oJ2RldmVsb3BlcicpO3RoaXMucmVuZGVyKHRydWUpO2dsb2JhbC5MdW5hVXBkYXRlcy5tb3VudCgpO31cbiBhY3Rpb24oYSl7aWYoZ2xvYmFsLkx1bmFDdXRzY2VuZUxpYnJhcnk/LmFjdGlvbihhKSlyZXR1cm47aWYodGhpcy5tZW1vcnlUcmFuc2l0aW9uJiZhIT09J3BpY2tlcicpcmV0dXJuO2lmKGEuc3RhcnRzV2l0aCgnc2NlbmUtY2hvaWNlOicpKXtjb25zdCBjPXRoaXMuZGlhbG9nLHI9Yz8ucm93c1tjLmluZGV4XSxzZXE9TnVtYmVyKGEuc2xpY2UoMTMpKTtpZih0aGlzLnZpZXchPT0nc2NlbmUtY2hvaWNlJ3x8IXIub3B0aW9ucy5zb21lKG89Pm8uc2VxPT09c2VxKSlyZXR1cm47dGhpcy5nLnByb2dyZXNzLmZsYWdzW3IuYXJnXT1zZXE9PT0xO2MuaW5kZXgrKztjLmNoYXJzPTA7dGhpcy5jb250aW51ZVNjZW5lKCk7cmV0dXJuO31pZihhLnN0YXJ0c1dpdGgoJ2Rldi0nKSl7dGhpcy5kZXZDb25zb2xlQWN0aW9uKGEpO3JldHVybjt9aWYoYT09PSd0aXRsZScpe3RoaXMuc2NyZWVuKCd0aXRsZScpO3JldHVybjt9aWYoYT09PSdwaWNrZXInKXt0aGlzLnRvUGlja2VyKCk7cmV0dXJuO31pZihhPT09J2RldmVsb3Blcicpe3RoaXMuZGV2ZWxvcGVyKCk7cmV0dXJuO31pZihhPT09J25ldycpe3RoaXMubmV3R2FtZSgpO3JldHVybjt9aWYoYT09PSdyZXRyeS1sb2FkJyl7dGhpcy5yZXRyeUxvYWQoKTtyZXR1cm47fWlmKGE9PT0nb3B0aW9ucycpe3RoaXMucmVzdW1lVmlldz10aGlzLnZpZXc7dGhpcy5zY3JlZW4oJ29wdGlvbnMnKTtyZXR1cm47fWlmKGE9PT0nbXVzaWMtdG9nZ2xlJyl7dGhpcy5iZ20uc2V0RW5hYmxlZCghdGhpcy5iZ20uZW5hYmxlZCk7dGhpcy5kcmF3KCk7cmV0dXJuO31pZihhPT09J3Jlc3VtZScpe2lmKHRoaXMub3V0c2lkZS5hY3RpdmUpdGhpcy5vdXRzaWRlLm1vZGVsLnBhdXNlZD1mYWxzZTt0aGlzLnNjcmVlbih0aGlzLnJlc3VtZVZpZXd8fCd0aXRsZScpO3JldHVybjt9aWYoYT09PSdhc2stZXhpdCcpe3RoaXMuc2NyZWVuKCdjb25maXJtLWV4aXQnKTtyZXR1cm47fWlmKGE9PT0nZXhpdC1ydW4nKXt0aGlzLnRvUGlja2VyKCk7dGhpcy5zY3JlZW4oJ3RpdGxlJyk7cmV0dXJuO31pZihhPT09J25leHQnKXt0aGlzLm5leHQoKTtyZXR1cm47fWlmKGE9PT0nc2xlZXAtY29uZmlybScpe3RoaXMuc2xlZXAoKTtyZXR1cm47fVxuICBpZihhPT09J3JlbWFrZScpe3RoaXMuZy5jYW5jZWxDcmFmdCgpO3RoaXMuZy5zZWxlY3RDb2NrdGFpbCh0aGlzLmcuY3VycmVudE9yZGVyLmNvY2t0YWlsKTt0aGlzLnVpLnRhYj0nZ2xhc3MnO3RoaXMudWkucmVjaXBlT3Blbj1mYWxzZTt0aGlzLnVpLmhvdmVySXRlbT1udWxsO3RoaXMuc2NyZWVuKHRoaXMucGxheVZpZXcpO3RoaXMucmVuZGVyKHRydWUpO3JldHVybjt9XG4gIGlmKGEuc3RhcnRzV2l0aCgnZHJpbms6Jykpe2NvbnN0IGlkPWEuc2xpY2UoNik7aWYoIXRoaXMuZy5jb2NrdGFpbHNBdmFpbGFibGUoKS5zb21lKGM9PmMuaWQ9PT1pZCkpcmV0dXJuO3RoaXMuZy5wcm9ncmVzcy5mbGFncy5jYW1wYWlnbl9zZWxlY3RlZF9kcmluaz1pZDt0aGlzLnNjcmVlbih0aGlzLnBsYXlWaWV3KTt0aGlzLnNlc3Npb24uZmluaXNoU3RlcCgpO3RoaXMucmVuZGVyKHRydWUpO3JldHVybjt9XG4gIGlmKGEuc3RhcnRzV2l0aCgncmVzcG9uc2U6Jykpe3RoaXMuZy5wcm9ncmVzcy5mbGFncy5jYW1wYWlnbl9yZXNwb25zZT1hLnNsaWNlKDkpO3RoaXMuc2NlbmUoJ3Jlc3BvbnNlJythLnNsaWNlKDkpLCfrsJQgwrcg7IK87Zi47J2YIOyEoO2DnScsJ2JhcicsKCk9Pnt0aGlzLnNjcmVlbih0aGlzLnBsYXlWaWV3KTt0aGlzLnNlc3Npb24uZmluaXNoU3RlcCgpO3RoaXMucmVuZGVyKHRydWUpO30pO3JldHVybjt9XG4gIGlmKGE9PT0ncmVwbGF5LW1lbW9yeScpe3RoaXMuc2NlbmUoJ2pvaG5ueScsJ+yhsOuLiOydmCDquLDslrUnLCdiYXInLCgpPT50aGlzLm1lbW9yeVF1aXooKSx7bWVtb3J5OnRydWV9KTtyZXR1cm47fVxuICBpZihhPT09J2NvbmZpcm0tb2JzZXJ2YXRpb24nKXtpZih0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignI29ic2VydmF0aW9uLWJhc2UnKS52YWx1ZSE9PSdyeWUnfHx0aGlzLmhvc3QucXVlcnlTZWxlY3RvcignI29ic2VydmF0aW9uLW9yZGVyJykudmFsdWUhPT0ncmlnaHQnKXt0aGlzLm9ic2VydmF0aW9uRXJyb3I9J+q4sOuhneqzvCDri6Trpbgg7ZWt66qp7J20IOyeiOyWtOyalC4g7KCc7KGwIOq4sOuhneydhCDri6Tsi5wg7ZmV7J247ZW0IOyjvOyEuOyalC4nO3RoaXMuZHJhdygpO3JldHVybjt9dGhpcy5jb21wbGV0ZU1lbW9yeSgpO31cbiB9XG4ga2V5KGUpe2lmKGdsb2JhbC5MdW5hQ3V0c2NlbmVMaWJyYXJ5Py5rZXkoZSkpcmV0dXJuIHRydWU7aWYodGhpcy5tZW1vcnlUcmFuc2l0aW9ufHx0aGlzLmRheVRyYW5zaXRpb258fHRoaXMuZG9vclRyYW5zaXRpb24pcmV0dXJuIHRydWU7aWYoWydnYW1lJywnZGV2ZWxvcGVyJ10uaW5jbHVkZXModGhpcy52aWV3KSYmdGhpcy5vdXRzaWRlLmNvbnRyb2xzVHV0b3JpYWxLZXk/LihlKSlyZXR1cm4gdHJ1ZTtpZih0aGlzLmcub3ZlcmxheT09PSdqb2hubnlVbmxvY2snJiYhdGhpcy5ibG9ja2luZylyZXR1cm4gZmFsc2U7XG4gIGlmKHRoaXMuYWN0aXZlJiZlLmNvZGU9PT0nS2V5UCcmJiFlLm1ldGFLZXkmJiFlLmN0cmxLZXkmJiFlLmFsdEtleSYmWydnYW1lJywnZGV2LWNvbnNvbGUnXS5pbmNsdWRlcyh0aGlzLnZpZXcpJiYhdGhpcy5vdXRzaWRlLmFjdGl2ZSl7aWYoIWUucmVwZWF0KXtpZih0aGlzLnZpZXc9PT0nZGV2LWNvbnNvbGUnKXRoaXMuZGV2Q29uc29sZUFjdGlvbignZGV2LWNsb3NlJyk7ZWxzZXt0aGlzLmRldlJlc3VtZVZpZXc9dGhpcy52aWV3O3RoaXMuc2NyZWVuKCdkZXYtY29uc29sZScpO319cmV0dXJuIHRydWU7fVxuICBpZih0aGlzLnZpZXc9PT0nZGV2LWNvbnNvbGUnJiZbJ1NwYWNlJywnRW50ZXInXS5pbmNsdWRlcyhlLmNvZGUpKXtpZighZS5yZXBlYXQpZS50YXJnZXQuY2xvc2VzdCgnI2NhbXBhaWduLXJvb3QgYnV0dG9uJyk/LmNsaWNrKCk7cmV0dXJuIHRydWU7fVxuICBpZih0aGlzLnZpZXc9PT0nZGV2LWNvbnNvbGUnJiZlLmNvZGU9PT0nRXNjYXBlJyl7aWYoIWUucmVwZWF0KXRoaXMuZGV2Q29uc29sZUFjdGlvbignZGV2LWNsb3NlJyk7cmV0dXJuIHRydWU7fVxuaWYodGhpcy5vdXRzaWRlLmFjdGl2ZSYmdGhpcy5vdXRzaWRlLmRldkNvbnNvbGVPcGVuJiYhdGhpcy5ibG9ja2luZylyZXR1cm4gZmFsc2U7aWYodGhpcy52aWV3PT09J2dhbWUnJiZlLmNvZGU9PT0nRXNjYXBlJyYmdGhpcy5nLmdpbW1pY2s/LnBvdXJUZXN0c09wZW4pcmV0dXJuIGZhbHNlO2lmKHRoaXMudmlldz09PSdwcm9sb2d1ZScpe2dsb2JhbC5TZng/LnJlc3VtZSgpO2lmKHRoaXMuY2luZW1hPy5zdHVkaW8pZ2xvYmFsLkx1bmFTdHVkaW9DaW5lbWEudW5sb2NrKCk7fWlmKCF0aGlzLmFjdGl2ZSYmIXRoaXMuYmxvY2tpbmcpcmV0dXJuIGZhbHNlO2lmKGUuY29kZT09PSdGMicpcmV0dXJuIHRydWU7aWYoZS5jb2RlPT09J0VzY2FwZScpe2lmKCFlLnJlcGVhdCl7aWYoWydvcHRpb25zJywnbm90aWNlJywnc2xlZXAnLCdyZXRyeS1kcmluayddLmluY2x1ZGVzKHRoaXMudmlldykpdGhpcy5hY3Rpb24oJ3Jlc3VtZScpO2Vsc2UgaWYodGhpcy52aWV3PT09J2NvbmZpcm0tZXhpdCcpdGhpcy5hY3Rpb24oJ3Jlc3VtZScpO2Vsc2UgaWYodGhpcy52aWV3PT09J3RpdGxlJyl0aGlzLnRvUGlja2VyKCk7ZWxzZSBpZighWydwaWNrZXInLCdsb2FkaW5nJywnbG9hZC1lcnJvcicsJ2VuZGluZyddLmluY2x1ZGVzKHRoaXMudmlldykpe3RoaXMucmVzdW1lVmlldz10aGlzLnZpZXc7dGhpcy5zY3JlZW4oJ29wdGlvbnMnKTt9fXJldHVybiB0cnVlO31cbiAgaWYoIXRoaXMuYmxvY2tpbmcpcmV0dXJuIGZhbHNlO2lmKHRoaXMudmlldz09PSdwcm9sb2d1ZScmJnRoaXMuY2luZW1hPy5kaWFsb2d1ZUNob2ljZSl7dGhpcy5jaW5lbWFDaG9pY2VzPy5rZXkoZSk7cmV0dXJuIHRydWU7fWlmKHRoaXMudmlldz09PSdwcm9sb2d1ZScpe2lmKCFlLnJlcGVhdCYmWydLZXlFJywnU3BhY2UnLCdFbnRlciddLmluY2x1ZGVzKGUuY29kZSkmJnRoaXMuY2luZW1hPy5kaWFsb2d1ZVdhaXQpe3RoaXMuYWR2YW5jZUNpbmVtYURpYWxvZ3VlKCk7aWYoZS5jb2RlPT09J1NwYWNlJyYmdGhpcy5jaW5lbWE/LnNjZW5lLnRlbXBsYXRlPT09J2RvY3VtZW50YXJ5JyYmdGhpcy5jYW5Ta2lwQ2luZW1hKCkpe3RoaXMuY2luZW1hSG9sZFN0YXJ0PXBlcmZvcm1hbmNlLm5vdygpO3RoaXMucGFpbnRDaW5lbWFTa2lwKCk7fXJldHVybiB0cnVlO31pZihlLmNvZGU9PT0nU3BhY2UnJiYhZS5yZXBlYXQmJnRoaXMuY2FuU2tpcENpbmVtYSgpKXt0aGlzLmNpbmVtYUhvbGRTdGFydD1wZXJmb3JtYW5jZS5ub3coKTt0aGlzLnBhaW50Q2luZW1hU2tpcCgpO31yZXR1cm4gdHJ1ZTt9aWYoZS5jb2RlLnN0YXJ0c1dpdGgoJ0NvbnRyb2wnKSl7dGhpcy5jb250cm9sPXRydWU7cmV0dXJuIHRydWU7fWlmKGUuY29kZT09PSdUYWInKXtjb25zdCBsaXN0PVsuLi50aGlzLmhvc3QucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uOm5vdCg6ZGlzYWJsZWQpLGlucHV0LHNlbGVjdCxzdW1tYXJ5JyldLmZpbHRlcih4PT54LmdldENsaWVudFJlY3RzKCkubGVuZ3RoKTtjb25zdCBpPWxpc3QuaW5kZXhPZihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtpZihsaXN0Lmxlbmd0aClsaXN0WyhpKyhlLnNoaWZ0S2V5Py0xOjEpK2xpc3QubGVuZ3RoKSVsaXN0Lmxlbmd0aF0uZm9jdXMoKTtyZXR1cm4gdHJ1ZTt9XG4gIGlmKFsnS2V5RScsJ1NwYWNlJywnRW50ZXInXS5pbmNsdWRlcyhlLmNvZGUpJiZbJ3NjZW5lJywncHJvbG9ndWUnXS5pbmNsdWRlcyh0aGlzLnZpZXcpKXtpZighZS5yZXBlYXQpdGhpcy5uZXh0KCk7cmV0dXJuIHRydWU7fWlmKFsnQXJyb3dVcCcsJ0Fycm93RG93biddLmluY2x1ZGVzKGUuY29kZSkmJlsndGl0bGUnLCdwaWNrZXInXS5pbmNsdWRlcyh0aGlzLnZpZXcpKXtjb25zdCBsaXN0PVsuLi50aGlzLmhvc3QucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uJyldLGk9bGlzdC5pbmRleE9mKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO2xpc3RbKGkrKGUuY29kZT09PSdBcnJvd0Rvd24nPzE6LTEpK2xpc3QubGVuZ3RoKSVsaXN0Lmxlbmd0aF0/LmZvY3VzKCk7cmV0dXJuIHRydWU7fVxuICByZXR1cm4gIVsnRW50ZXInLCdTcGFjZScsJ0Fycm93TGVmdCcsJ0Fycm93UmlnaHQnLCdBcnJvd1VwJywnQXJyb3dEb3duJ10uaW5jbHVkZXMoZS5jb2RlKXx8IWUudGFyZ2V0LmNsb3Nlc3QoJyNjYW1wYWlnbi1yb290Jyk7XG4gfVxufVxuLy8gUmVnaXN0ZXJlZCBiZWZvcmUgdGhlIHNpbXVsYXRvcidzIGNhcHR1cmUgaGFuZGxlcnMsIHNvIGhpZGRlbiBzY2VuZXMgbmV2ZXIgY29uc3VtZSBpbnB1dC5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxlPT57Y29uc3QgYz1nbG9iYWwubHVuYUNhbXBhaWduLGI9ZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3V0c2lkZS1hY3Rpb25dJyk7aWYoIWM/LmFjdGl2ZXx8IWIpcmV0dXJuO2lmKGIuZGF0YXNldC5vdXRzaWRlQWN0aW9uPT09J2V4aXQnKXtlLnByZXZlbnREZWZhdWx0KCk7ZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtjLnJlc3VtZVZpZXc9J2dhbWUnO2Muc2NyZWVuKCdjb25maXJtLWV4aXQnKTt9ZWxzZSBpZihiLmRhdGFzZXQub3V0c2lkZUFjdGlvbj09PSdyZXRyeScpe2UucHJldmVudERlZmF1bHQoKTtlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO2Mub3V0c2lkZS5leGl0KHRydWUpO2Mub3V0c2lkZS5zdGFydCgpO319LHRydWUpO1xud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGU9PntpZihnbG9iYWwubHVuYUNhbXBhaWduPy5rZXkoZSkpe2UucHJldmVudERlZmF1bHQoKTtlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO319LHRydWUpO1xud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJyxlPT57aWYoZS5jb2RlPT09J1NwYWNlJyYmZ2xvYmFsLmx1bmFDYW1wYWlnbil7Z2xvYmFsLmx1bmFDYW1wYWlnbi5yZWxlYXNlQ2luZW1hU2tpcCgpO2lmKGdsb2JhbC5sdW5hQ2FtcGFpZ24udmlldz09PSdwcm9sb2d1ZScpZ2xvYmFsLmx1bmFDYW1wYWlnbi5wYWludENpbmVtYVNraXAoKTt9aWYoZS5jb2RlLnN0YXJ0c1dpdGgoJ0NvbnRyb2wnKSYmZ2xvYmFsLmx1bmFDYW1wYWlnbilnbG9iYWwubHVuYUNhbXBhaWduLmNvbnRyb2w9ZmFsc2U7fSx0cnVlKTtcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdibHVyJywoKT0+e2NvbnN0IGM9Z2xvYmFsLmx1bmFDYW1wYWlnbjtpZighYylyZXR1cm47Yy5jb250cm9sPWZhbHNlO2lmKGdsb2JhbC5MdW5hRm9jdXNTZXR0aW5ncy5lbmFibGVkJiZjLmFjdGl2ZSYmIWMubWVtb3J5VHJhbnNpdGlvbiYmWydnYW1lJywnc2NlbmUnLCdwcm9sb2d1ZScsJ2F3YWtlbmluZyddLmluY2x1ZGVzKGMudmlldykpe2MucmVzdW1lVmlldz1jLnZpZXc7Yy5zY3JlZW4oJ29wdGlvbnMnKTt9fSk7XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywoKT0+e2NvbnN0IGM9Z2xvYmFsLmx1bmFDYW1wYWlnbjtpZihkb2N1bWVudC5oaWRkZW4mJmMpe2MucmVsZWFzZUNpbmVtYVNraXAoKTtpZihnbG9iYWwuTHVuYUZvY3VzU2V0dGluZ3MuZW5hYmxlZCYmYy5hY3RpdmUmJiFjLm1lbW9yeVRyYW5zaXRpb24mJlsnZ2FtZScsJ3NjZW5lJywncHJvbG9ndWUnLCdhd2FrZW5pbmcnXS5pbmNsdWRlcyhjLnZpZXcpKXtjLnJlc3VtZVZpZXc9Yy52aWV3O2Muc2NyZWVuKCdvcHRpb25zJyk7fX19KTtcbmdsb2JhbC5MdW5hQ2FtcGFpZ249e2NyZWF0ZTphPT5uZXcgQ2FtcGFpZ24oYSl9O1xufSkod2luZG93KTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFDLFVBQVNBLE1BQU0sRUFBQztFQUNqQixZQUFZOztFQUNaLE1BQU1DLEdBQUcsR0FBQ0MsQ0FBQyxJQUFFQyxNQUFNLENBQUNELENBQUMsSUFBRSxFQUFFLENBQUMsQ0FBQ0UsT0FBTyxDQUFDLFVBQVUsRUFBQ0MsQ0FBQyxJQUFHO0lBQUMsR0FBRyxFQUFDLE9BQU87SUFBQyxHQUFHLEVBQUMsTUFBTTtJQUFDLEdBQUcsRUFBQyxNQUFNO0lBQUMsR0FBRyxFQUFDLFFBQVE7SUFBQyxHQUFHLEVBQUM7RUFBTyxDQUFDLEVBQUNBLENBQUMsQ0FBRSxDQUFDO0VBQ25ILE1BQU1DLE1BQU0sR0FBQ0EsQ0FBQ0MsS0FBSyxFQUFDQyxNQUFNLEVBQUNDLEdBQUcsR0FBQyxFQUFFLEtBQUcsaUJBQWlCLEdBQUNBLEdBQUcsR0FBQyxtQkFBbUIsR0FBQ0QsTUFBTSxHQUFDLElBQUksSUFBRUMsR0FBRyxLQUFHLGNBQWMsR0FBQyx1Q0FBdUMsR0FBQ1IsR0FBRyxDQUFDTSxLQUFLLENBQUMsR0FBQyxJQUFJLEdBQUNOLEdBQUcsQ0FBQ00sS0FBSyxDQUFDLEdBQUMsU0FBUyxHQUFDQSxLQUFLLENBQUMsR0FB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
