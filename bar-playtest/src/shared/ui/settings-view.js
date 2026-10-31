(function (W) {
  'use strict';

  const KEY = 'luna.gamePreferences.v1';
  const tabs = [['sound', '사운드'], ['game', '게임 설정'], ['controls', '조작 안내']];
  const callbacksByContext = new Map();
  let renderingContext = '',
    pending = null,
    returnFocus = null,
    mounted = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  const isInteractive = el => el?.isConnected && !el.closest('[hidden],[inert],[aria-hidden="true"]') &&
    el.getClientRects().length > 0 && !['hidden', 'collapse'].includes(getComputedStyle(el).visibility);
  // Paused background scenes can render their own settings behind another modal.
  // Only the visible, interactive instance may capture keys or receive focus.
  const panel = () => [...document.querySelectorAll('.luna-settings')].find(isInteractive);
  const state = () => ({
    g: W.barGame,
    ui: W.lunaCampaign?.ui || {},
    bgm: W.barBgm
  });
  function save() {
    const {
      g,
      ui
    } = state();
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lang: g.lang,
        speed: g.dialogSpeed,
        gimmick: ui.gimmickAudio !== false
      }));
    } catch {}
  }
  function restore() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || '{}'),
        {
          g,
          ui
        } = state();
      if (['ko', 'en'].includes(p.lang)) g.lang = p.lang;
      if ([.5, 1, 1.5, 2, 3, 4].includes(p.speed)) g.dialogSpeed = p.speed;
      if (typeof p.gimmick === 'boolean') ui.gimmickAudio = p.gimmick;
    } catch {}
  }
  function row(title, help, control) {
    return `<div class="ls-row"><div class="ls-label"><strong>${title}</strong><small>${help}</small></div><div class="ls-control">${control}</div></div>`;
  }
  function range(id, title, help, value) {
    const n = Math.round(value * 100);
    return row(title, help, `<input type="range" min="0" max="100" step="1" value="${n}" data-setting="${id}" aria-label="${title}" style="--level:${n}%"><output>${n}%</output>`);
  }
  function toggle(id, title, help, on) {
    return row(title, help, `<button type="button" class="ls-toggle" role="switch" aria-checked="${!!on}" data-setting-toggle="${id}" aria-label="${title}"><i></i><span>${on ? '켜짐' : '꺼짐'}</span></button>`);
  }
  function select(id, title, help, value, options) {
    return row(title, help, `<select data-setting="${id}" aria-label="${title}">${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('')}</select>`);
  }
  function soundHTML() {
    const {
      bgm,
      ui
    } = state();
    return range('bgm', '음악 음량', '배경 음악의 크기를 조절합니다.', bgm.volume) + range('sfx', '효과음 음량', 'UI · 상호작용 · 제조 효과음', W.LunaSfx.volume) + range('street', '거리 환경음', '도시의 소음과 빗소리', W.LunaStreetAudio.volume) + select('voice', '대사 출력음', '글자가 나타날 때 재생되는 소리', W.LunaDialogueAudio.version, [['main', '기본음'], ['low', '낮고 부드러운 음'], ['off', '끄기']]) + `<div class="ls-preview"><span>선택한 출력음을 확인해 보세요.</span><button data-settings-action="preview" ${W.LunaDialogueAudio.version === 'off' ? 'disabled' : ''}>▷ 미리 듣기</button></div>` + '<div class="ls-switch-pair">' + toggle('music', '배경 음악', '장소별 음악 재생', bgm.enabled) + toggle('gimmick', '제조 효과음', '따르기 · 병따기 · 믹스', ui.gimmickAudio !== false) + '</div>';
  }
  function gameHTML(context = renderingContext) {
    const {
      g
    } = state();
    return select('focus', '창 전환 시 일시정지', '다른 창이나 탭으로 이동하면 게임을 멈춥니다.', W.LunaFocusSettings.enabled ? 'on' : 'off', [['on', '켜짐 · 권장'], ['off', '꺼짐']]) + select('speed', '대사 출력 속도', '대사가 나타나는 속도입니다. 다음 대사부터 적용됩니다.', g.dialogSpeed, [[.5, '느리게 · 0.5×'], [1, '기본 · 1×'], [1.5, '조금 빠르게 · 1.5×'], [2, '빠르게 · 2×'], [3, '매우 빠르게 · 3×'], [4, '가장 빠르게 · 4×']]) + select('language', '표시 언어', '다음 대사부터 적용됩니다. 본편 일부 내용은 한국어로 표시됩니다.', g.lang, [['ko', '한국어'], ['en', 'English']]) + (context === 'bar' ? toggle('auto', '단골 대사 자동 진행', '바 대사를 모두 표시한 뒤 2초 후 진행합니다. 이번 영업에만 적용됩니다.', state().ui.auto) : '') + `<div class="ls-info"><span>!</span><p>설정을 연 동안 플레이는 일시정지됩니다.<br>환경 설정은 이 브라우저에 보관되며, 게임 진행 저장과는 별개입니다.</p></div>`;
  }
  function controlsHTML() {
    const groups = [['공통 조작', [['Esc', '설정 열기 / 닫기'], ['E · Enter · Space', '대사 진행'], ['Control 누르기', '대사 빠르게 넘기기']]], ['외부 탐색', [['A / D · ← / →', '이동'], ['Shift', '달리기'], ['E', '상호작용'], ['Y', '표시된 곳에서 거리 전경 보기']]], ['바 · 선택지', [['Tab', '서비스 패널 / QA 상황 선택'], ['W / S · 휠', '선택지 이동'], ['E · 클릭', '선택지 확정'], ['드래그', '코스터 배치 · 칵테일 제공']]]];
    return `<div class="ls-key-groups">${groups.map(([title, rows]) => `<section><h3>${title}</h3>${rows.map(([key, label]) => `<div><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</section>`).join('')}</div><p class="ls-footnote">제조 기믹의 세부 조작은 해당 화면의 안내를 확인해 주세요.</p>`;
  }
  function html(options) {
    callbacksByContext.set(options.context, options);
    const context = renderingContext = options.context;
    return `<section class="luna-settings" role="dialog" aria-modal="true" aria-labelledby="ls-title" data-settings-context="${esc(context)}"><header class="ls-header"><div class="ls-brand"><img src="assets/ui/service_panel/BTN_service_panel.png" alt=""><div><h1 id="ls-title">설정</h1></div></div><button class="ls-close" data-settings-action="close" aria-label="설정 닫기"><img src="assets/ui/profile/BTN_profile_close.png" alt=""></button></header><div class="ls-body"><nav class="ls-nav" role="tablist" aria-label="설정 분류" aria-orientation="vertical">${tabs.map(([id, title], i) => `<button id="ls-tab-${id}" role="tab" aria-selected="${!i}" aria-controls="ls-${id}" tabindex="${i ? -1 : 0}" data-settings-tab="${id}">${title}<b aria-hidden="true">›</b></button>`).join('')}</nav><div class="ls-content"><section id="ls-sound" role="tabpanel" aria-labelledby="ls-tab-sound">${soundHTML()}</section><section id="ls-game" role="tabpanel" aria-labelledby="ls-tab-game" hidden>${gameHTML()}</section><section id="ls-controls" role="tabpanel" aria-labelledby="ls-tab-controls" hidden>${controlsHTML()}</section></div></div><footer class="ls-footer"><span class="ls-feedback" role="status" aria-live="polite"></span><div><button class="ls-reset" data-settings-action="reset">이 항목 초기화</button>${options.onRestart ? '<button class="ls-exit" data-settings-action="restart">다시 시작</button>' : ''}${options.onExit ? '<button class="ls-exit" data-settings-action="exit">' + esc(options.exitLabel || '타이틀로') + '</button>' : ''}<button class="ls-primary" data-settings-action="close">돌아가기 <kbd>Esc</kbd></button></div></footer><div class="ls-confirm" hidden><div role="alertdialog" aria-modal="true" aria-labelledby="ls-confirm-title"><h2 id="ls-confirm-title"></h2><p></p><div><button data-settings-action="cancel">취소</button><button class="ls-primary" data-settings-action="confirm">확인</button></div></div></div></section>`;
  }
  function tab(id) {
    const p = panel();
    p.querySelectorAll('[role="tab"]').forEach(b => {
      const on = b.dataset.settingsTab === id;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    p.querySelectorAll('[role="tabpanel"]').forEach(s => s.hidden = s.id !== 'ls-' + id);
    p.querySelector('.ls-reset').hidden = id === 'controls';
    p.querySelector('.ls-content').scrollTop = 0;
  }
  function feedback(text = '변경 사항을 적용했습니다.') {
    const el = panel()?.querySelector('.ls-feedback');
    if (el) el.textContent = text;
  }
  function updateControl(el) {
    const {
        g,
        bgm
      } = state(),
      id = el.dataset.setting,
      v = el.value;
    if (id === 'bgm') bgm.setVolume(+v / 100);
    if (id === 'sfx') W.LunaSfx.setVolume(+v / 100);
    if (id === 'street') W.LunaStreetAudio.setVolume(+v / 100);
    if (id === 'focus') W.LunaFocusSettings.setEnabled(v === 'on');
    if (id === 'voice') {
      W.LunaDialogueAudio.setVersion(v);
      panel().querySelector('[data-settings-action="preview"]').disabled = v === 'off';
    }
    if (id === 'speed') g.dialogSpeed = +v;
    if (id === 'language') g.lang = v;
    if (el.type === 'range') {
      el.style.setProperty('--level', v + '%');
      el.nextElementSibling.textContent = v + '%';
    }
    save();
    feedback();
  }
  function ask(action) {
    pending = action;
    const p = panel(),
      box = p.querySelector('.ls-confirm'),
      callbacks = callbacksByContext.get(p.dataset.settingsContext) || {};
    box.hidden = false;
    p.querySelector('.ls-body').inert = true;
    p.querySelector('.ls-footer').inert = true;
    p.querySelector('.ls-header').inert = true;
    box.querySelector('h2').textContent = action === 'reset' ? '이 항목을 기본값으로 바꿀까요?' : action === 'restart' ? '같은 위치에서 다시 시작할까요?' : (callbacks.exitLabel || '타이틀로') + ' 이동할까요?';
    box.querySelector('p').textContent = action === 'reset' ? '현재 분류의 설정만 초기화됩니다. 다른 설정과 게임 진행은 유지됩니다.' : '현재 플레이가 종료되며 진행 상황은 저장되지 않습니다.';
    box.querySelector('button').focus();
  }
  function cancel() {
    const p = panel(),
      action = pending;
    pending = null;
    p.querySelector('.ls-confirm').hidden = true;
    ['.ls-body', '.ls-footer', '.ls-header'].forEach(s => p.querySelector(s).inert = false);
    p.querySelector(`[data-settings-action="${action}"]`)?.focus();
  }
  function reset() {
    const id = panel().querySelector('[role="tab"][aria-selected="true"]').dataset.settingsTab,
      context = panel().dataset.settingsContext,
      {
        g,
        ui,
        bgm
      } = state();
    if (id === 'sound') {
      bgm.setEnabled(true);
      bgm.setVolume(.3);
      W.LunaSfx.setVolume(.8);
      W.LunaStreetAudio.setVolume(.55);
      W.LunaDialogueAudio.setVersion('main');
      ui.gimmickAudio = true;
      panel().querySelector('#ls-sound').innerHTML = soundHTML();
    } else {
      W.LunaFocusSettings.setEnabled(true);
      g.lang = 'ko';
      g.dialogSpeed = 1;
      if (context === 'bar') ui.auto = false;
      panel().querySelector('#ls-game').innerHTML = gameHTML(context);
    }
    save();
    feedback('이 항목을 기본값으로 되돌렸습니다.');
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('.luna-settings');
    if (!p || p !== panel()) return;
    const callbacks = callbacksByContext.get(p.dataset.settingsContext) || {};
    const b = e.target.closest('button');
    if (!b) return;
    const action = b.dataset.settingsAction,
      id = b.dataset.settingToggle;
    if (!action && !id && !b.dataset.settingsTab) return;
    e.stopImmediatePropagation();
    if (b.dataset.settingsTab) {
      tab(b.dataset.settingsTab);
      return;
    }
    if (id) {
      const {
          bgm,
          ui
        } = state(),
        on = b.getAttribute('aria-checked') !== 'true';
      if (id === 'music') bgm.setEnabled(on);
      if (id === 'gimmick') ui.gimmickAudio = on;
      if (id === 'auto') ui.auto = on;
      b.setAttribute('aria-checked', on);
      b.querySelector('span').textContent = on ? '켜짐' : '꺼짐';
      save();
      feedback();
      return;
    }
    if (action === 'close') callbacks.onClose?.();
    if (action === 'preview') void W.LunaDialogueAudio.preview();
    if (action === 'reset' || action === 'exit' || action === 'restart') ask(action);
    if (action === 'cancel') cancel();
    if (action === 'confirm') {
      const a = pending;
      cancel();
      if (a === 'reset') reset();else if (a === 'restart') callbacks.onRestart?.();else callbacks.onExit?.();
    }
  }, true);
  for (const name of ['input', 'change']) document.addEventListener(name, e => {
    if (!e.target.matches('.luna-settings [data-setting]')) return;
    e.stopImmediatePropagation();
    updateControl(e.target);
  }, true);
  // Intercept before game hotkeys, but preserve native slider/select keyboard behavior.
  W.addEventListener('keydown', e => {
    const p = panel();
    if (!p) return;
    const callbacks = callbacksByContext.get(p.dataset.settingsContext) || {};
    e.stopImmediatePropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) {
        if (pending) cancel();else callbacks.onClose?.();
      }
      return;
    }
    if (e.code === 'Tab') {
      const scope = pending ? p.querySelector('.ls-confirm') : p,
        items = [...scope.querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[hidden],[inert]') && el.tabIndex >= 0);
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      return;
    }
    const t = e.target.closest('[role="tab"]');
    if (t && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const i = tabs.findIndex(x => x[0] === t.dataset.settingsTab),
        n = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowDown' ? 1 : 2)) % 3;
      tab(tabs[n][0]);
      p.querySelector('#ls-tab-' + tabs[n][0]).focus();
    }
  }, true);
  W.addEventListener('keyup', e => {
    if (panel()) e.stopImmediatePropagation();
  }, true);
  new MutationObserver(() => {
    const p = panel();
    if (p === mounted) return;
    pending = null;
    if (p) {
      if (!mounted) returnFocus = document.activeElement;
      p.querySelector('[role="tab"][aria-selected="true"]')?.focus({
        preventScroll: true
      });
    } else if (isInteractive(returnFocus) &&
      (document.activeElement === document.body || mounted?.contains(document.activeElement))) returnFocus.focus({
      preventScroll: true
    });
    mounted = p;
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'inert', 'aria-hidden']
  });
  W.LunaSettings = {
    html,
    restore
  };
})(window);
