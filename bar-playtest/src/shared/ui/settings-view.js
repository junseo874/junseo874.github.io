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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJXIiwiS0VZIiwidGFicyIsImNhbGxiYWNrcyIsImNvbnRleHQiLCJwZW5kaW5nIiwicmV0dXJuRm9jdXMiLCJtb3VudGVkIiwiZXNjIiwicyIsIlN0cmluZyIsInJlcGxhY2UiLCJjIiwicGFuZWwiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJzdGF0ZSIsImciLCJiYXJHYW1lIiwidWkiLCJsdW5hQ2FtcGFpZ24iLCJiZ20iLCJiYXJCZ20iLCJzYXZlIiwibG9jYWxTdG9yYWdlIiwic2V0SXRlbSIsIkpTT04iLCJzdHJpbmdpZnkiLCJsYW5nIiwic3BlZWQiLCJkaWFsb2dTcGVlZCIsImdpbW1pY2siLCJnaW1taWNrQXVkaW8iLCJyZXN0b3JlIiwicCIsInBhcnNlIiwiZ2V0SXRlbSIsImluY2x1ZGVzIiwicm93IiwidGl0bGUiLCJoZWxwIiwiY29udHJvbCIsInJhbmdlIiwiaWQiLCJ2YWx1ZSIsIm4iLCJNYXRoIiwicm91bmQiLCJ0b2dnbGUiLCJvbiIsInNlbGVjdCIsIm9wdGlvbnMiLCJtYXAiLCJ2IiwidCIsImpvaW4iLCJzb3VuZEhUTUwiLCJ2b2x1bWUiLCJMdW5hU2Z4IiwiTHVuYVN0cmVldEF1ZGlvIiwiTHVuYURpYWxvZ3VlQXVkaW8iLCJ2ZXJzaW9uIiwiZW5hYmxlZCIsImdhbWVIVE1MIiwiTHVuYUZvY3VzU2V0dGluZ3MiLCJhdXRvIiwiY29udHJvbHNIVE1MIiwiZ3JvdXBzIiwicm93cyIsImtleSIsImxhYmVsIiwiaHRtbCIsImkiLCJvblJlc3RhcnQiLCJvbkV4aXQiLCJleGl0TGFiZWwiLCJ0YWIiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImIiLCJkYXRhc2V0Iiwic2V0dGluZ3NUYWIiLCJzZXRBdHRyaWJ1dGUiLCJ0YWJJbmRleCIsImhpZGRlbiIsInNjcm9sbFRvcCIsImZlZWRiYWNrIiwidGV4dCIsImVsIiwidGV4dENvbnRlbnQiLCJ1cGRhdGVDb250cm9sIiwic2V0dGluZyIsInNldFZvbHVtZSIsInNldEVuYWJsZWQiLCJzZXRWZXJzaW9uIiwiZGlzYWJsZWQiLCJ0eXBlIiwic3R5bGUiLCJzZXRQcm9wZXJ0eSIsIm5leHRFbGVtZW50U2libGluZyIsImFzayIsImFjdGlvbiIsImJveCIsImluZXJ0IiwiZm9jdXMiLCJjYW5jZWwiLCJyZXNldCIsImlubmVySFRNTCIsImFkZEV2ZW50TGlzdGVuZXIiLCJlIiwidGFyZ2V0IiwiY2xvc2VzdCIsInNldHRpbmdzQWN0aW9uIiwic2V0dGluZ1RvZ2dsZSIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsImdldEF0dHJpYnV0ZSIsIm9uQ2xvc2UiLCJwcmV2aWV3IiwiYSIsIm5hbWUiLCJtYXRjaGVzIiwiY29kZSIsInByZXZlbnREZWZhdWx0IiwicmVwZWF0Iiwic2NvcGUiLCJpdGVtcyIsImZpbHRlciIsImdldENsaWVudFJlY3RzIiwibGVuZ3RoIiwiaW5kZXhPZiIsImFjdGl2ZUVsZW1lbnQiLCJzaGlmdEtleSIsImZpbmRJbmRleCIsIngiLCJNdXRhdGlvbk9ic2VydmVyIiwicHJldmVudFNjcm9sbCIsImlzQ29ubmVjdGVkIiwib2JzZXJ2ZSIsImRvY3VtZW50RWxlbWVudCIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJMdW5hU2V0dGluZ3MiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJzZXR0aW5ncy12aWV3LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihXKXtcbid1c2Ugc3RyaWN0JztcbmNvbnN0IEtFWT0nbHVuYS5nYW1lUHJlZmVyZW5jZXMudjEnO1xuY29uc3QgdGFicz1bWydzb3VuZCcsJ+yCrOyatOuTnCddLFsnZ2FtZScsJ+qyjOyehCDshKTsoJUnXSxbJ2NvbnRyb2xzJywn7KGw7J6RIOyViOuCtCddXTtcbmxldCBjYWxsYmFja3M9e30sY29udGV4dD0nJyxwZW5kaW5nPW51bGwscmV0dXJuRm9jdXM9bnVsbCxtb3VudGVkPW51bGw7XG5jb25zdCBlc2M9cz0+U3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+XCInXS9nLGM9Pih7JyYnOicmYW1wOycsJzwnOicmbHQ7JywnPic6JyZndDsnLCdcIic6JyZxdW90OycsXCInXCI6JyYjMzk7J31bY10pKTtcbmNvbnN0IHBhbmVsPSgpPT5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubHVuYS1zZXR0aW5ncycpO1xuY29uc3Qgc3RhdGU9KCk9Pih7ZzpXLmJhckdhbWUsdWk6Vy5sdW5hQ2FtcGFpZ24/LnVpfHx7fSxiZ206Vy5iYXJCZ219KTtcbmZ1bmN0aW9uIHNhdmUoKXtjb25zdCB7Zyx1aX09c3RhdGUoKTt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oS0VZLEpTT04uc3RyaW5naWZ5KHtsYW5nOmcubGFuZyxzcGVlZDpnLmRpYWxvZ1NwZWVkLGdpbW1pY2s6dWkuZ2ltbWlja0F1ZGlvIT09ZmFsc2V9KSk7fWNhdGNoe319XG5mdW5jdGlvbiByZXN0b3JlKCl7dHJ5e2NvbnN0IHA9SlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShLRVkpfHwne30nKSx7Zyx1aX09c3RhdGUoKTtpZihbJ2tvJywnZW4nXS5pbmNsdWRlcyhwLmxhbmcpKWcubGFuZz1wLmxhbmc7aWYoWy41LDEsMS41LDIsMyw0XS5pbmNsdWRlcyhwLnNwZWVkKSlnLmRpYWxvZ1NwZWVkPXAuc3BlZWQ7aWYodHlwZW9mIHAuZ2ltbWljaz09PSdib29sZWFuJyl1aS5naW1taWNrQXVkaW89cC5naW1taWNrO31jYXRjaHt9fVxuZnVuY3Rpb24gcm93KHRpdGxlLGhlbHAsY29udHJvbCl7cmV0dXJuIGA8ZGl2IGNsYXNzPVwibHMtcm93XCI+PGRpdiBjbGFzcz1cImxzLWxhYmVsXCI+PHN0cm9uZz4ke3RpdGxlfTwvc3Ryb25nPjxzbWFsbD4ke2hlbHB9PC9zbWFsbD48L2Rpdj48ZGl2IGNsYXNzPVwibHMtY29udHJvbFwiPiR7Y29udHJvbH08L2Rpdj48L2Rpdj5gO31cbmZ1bmN0aW9uIHJhbmdlKGlkLHRpdGxlLGhlbHAsdmFsdWUpe2NvbnN0IG49TWF0aC5yb3VuZCh2YWx1ZSoxMDApO3JldHVybiByb3codGl0bGUsaGVscCxgPGlucHV0IHR5cGU9XCJyYW5nZVwiIG1pbj1cIjBcIiBtYXg9XCIxMDBcIiBzdGVwPVwiMVwiIHZhbHVlPVwiJHtufVwiIGRhdGEtc2V0dGluZz1cIiR7aWR9XCIgYXJpYS1sYWJlbD1cIiR7dGl0bGV9XCIgc3R5bGU9XCItLWxldmVsOiR7bn0lXCI+PG91dHB1dD4ke259JTwvb3V0cHV0PmApO31cbmZ1bmN0aW9uIHRvZ2dsZShpZCx0aXRsZSxoZWxwLG9uKXtyZXR1cm4gcm93KHRpdGxlLGhlbHAsYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibHMtdG9nZ2xlXCIgcm9sZT1cInN3aXRjaFwiIGFyaWEtY2hlY2tlZD1cIiR7ISFvbn1cIiBkYXRhLXNldHRpbmctdG9nZ2xlPVwiJHtpZH1cIiBhcmlhLWxhYmVsPVwiJHt0aXRsZX1cIj48aT48L2k+PHNwYW4+JHtvbj8n7Lyc7KeQJzon6rq87KeQJ308L3NwYW4+PC9idXR0b24+YCk7fVxuZnVuY3Rpb24gc2VsZWN0KGlkLHRpdGxlLGhlbHAsdmFsdWUsb3B0aW9ucyl7cmV0dXJuIHJvdyh0aXRsZSxoZWxwLGA8c2VsZWN0IGRhdGEtc2V0dGluZz1cIiR7aWR9XCIgYXJpYS1sYWJlbD1cIiR7dGl0bGV9XCI+JHtvcHRpb25zLm1hcCgoW3YsdF0pPT5gPG9wdGlvbiB2YWx1ZT1cIiR7dn1cIiAke1N0cmluZyh2KT09PVN0cmluZyh2YWx1ZSk/J3NlbGVjdGVkJzonJ30+JHt0fTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PmApO31cbmZ1bmN0aW9uIHNvdW5kSFRNTCgpe2NvbnN0IHtiZ20sdWl9PXN0YXRlKCk7cmV0dXJuIHJhbmdlKCdiZ20nLCfsnYzslYUg7J2M65+JJywn67Cw6rK9IOydjOyVheydmCDtgazquLDrpbwg7KGw7KCI7ZWp64uI64ukLicsYmdtLnZvbHVtZSkrcmFuZ2UoJ3NmeCcsJ+2aqOqzvOydjCDsnYzrn4knLCdVSSDCtyDsg4HtmLjsnpHsmqkgwrcg7KCc7KGwIO2aqOqzvOydjCcsVy5MdW5hU2Z4LnZvbHVtZSkrcmFuZ2UoJ3N0cmVldCcsJ+qxsOumrCDtmZjqsr3snYwnLCfrj4Tsi5zsnZgg7IaM7J2M6rO8IOu5l+yGjOumrCcsVy5MdW5hU3RyZWV0QXVkaW8udm9sdW1lKStcbiBzZWxlY3QoJ3ZvaWNlJywn64yA7IKsIOy2nOugpeydjCcsJ+q4gOyekOqwgCDrgpjtg4DrgqAg65WMIOyerOyDneuQmOuKlCDshozrpqwnLFcuTHVuYURpYWxvZ3VlQXVkaW8udmVyc2lvbixbWydtYWluJywn6riw67O47J2MJ10sWydsb3cnLCfrgq7qs6Ag67aA65Oc65+s7Jq0IOydjCddLFsnb2ZmJywn64GE6riwJ11dKStcbiBgPGRpdiBjbGFzcz1cImxzLXByZXZpZXdcIj48c3Bhbj7shKDtg53tlZwg7Lac66Cl7J2M7J2EIO2ZleyduO2VtCDrs7TshLjsmpQuPC9zcGFuPjxidXR0b24gZGF0YS1zZXR0aW5ncy1hY3Rpb249XCJwcmV2aWV3XCIgJHtXLkx1bmFEaWFsb2d1ZUF1ZGlvLnZlcnNpb249PT0nb2ZmJz8nZGlzYWJsZWQnOicnfT7ilrcg66+466asIOuTo+q4sDwvYnV0dG9uPjwvZGl2PmArXG4gJzxkaXYgY2xhc3M9XCJscy1zd2l0Y2gtcGFpclwiPicrdG9nZ2xlKCdtdXNpYycsJ+uwsOqyvSDsnYzslYUnLCfsnqXshozrs4Qg7J2M7JWFIOyerOyDnScsYmdtLmVuYWJsZWQpK3RvZ2dsZSgnZ2ltbWljaycsJ+ygnOyhsCDtmqjqs7zsnYwnLCfrlLDrpbTquLAgwrcg67OR65Sw6riwIMK3IOuvueyKpCcsdWkuZ2ltbWlja0F1ZGlvIT09ZmFsc2UpKyc8L2Rpdj4nO31cbmZ1bmN0aW9uIGdhbWVIVE1MKCl7Y29uc3Qge2d9PXN0YXRlKCk7cmV0dXJuIHNlbGVjdCgnZm9jdXMnLCfssL0g7KCE7ZmYIOyLnCDsnbzsi5zsoJXsp4AnLCfri6Trpbgg7LC97J2064KYIO2DreycvOuhnCDsnbTrj5ntlZjrqbQg6rKM7J6E7J2EIOupiOy2peuLiOuLpC4nLFcuTHVuYUZvY3VzU2V0dGluZ3MuZW5hYmxlZD8nb24nOidvZmYnLFtbJ29uJywn7Lyc7KeQIMK3IOq2jOyepSddLFsnb2ZmJywn6rq87KeQJ11dKStcbiBzZWxlY3QoJ3NwZWVkJywn64yA7IKsIOy2nOugpSDsho3rj4QnLCfrjIDsgqzqsIAg64KY7YOA64KY64qUIOyGjeuPhOyeheuLiOuLpC4g64uk7J2MIOuMgOyCrOu2gO2EsCDsoIHsmqnrkKnri4jri6QuJyxnLmRpYWxvZ1NwZWVkLFtbLjUsJ+uKkOumrOqyjCDCtyAwLjXDlyddLFsxLCfquLDrs7ggwrcgMcOXJ10sWzEuNSwn7KGw6riIIOu5oOultOqyjCDCtyAxLjXDlyddLFsyLCfruaDrpbTqsowgwrcgMsOXJ10sWzMsJ+unpOyasCDruaDrpbTqsowgwrcgM8OXJ10sWzQsJ+qwgOyepSDruaDrpbTqsowgwrcgNMOXJ11dKStcbiBzZWxlY3QoJ2xhbmd1YWdlJywn7ZGc7IucIOyWuOyWtCcsJ+uLpOydjCDrjIDsgqzrtoDthLAg7KCB7Jqp65Cp64uI64ukLiDrs7jtjrgg7J2867aAIOuCtOyaqeydgCDtlZzqta3slrTroZwg7ZGc7Iuc65Cp64uI64ukLicsZy5sYW5nLFtbJ2tvJywn7ZWc6rWt7Ja0J10sWydlbicsJ0VuZ2xpc2gnXV0pK1xuIChjb250ZXh0PT09J2Jhcic/dG9nZ2xlKCdhdXRvJywn64uo6rOoIOuMgOyCrCDsnpDrj5kg7KeE7ZaJJywn67CUIOuMgOyCrOulvCDrqqjrkZAg7ZGc7Iuc7ZWcIOuSpCAy7LSIIO2bhCDsp4Ttlontlanri4jri6QuIOydtOuyiCDsmIHsl4Xsl5Drp4wg7KCB7Jqp65Cp64uI64ukLicsc3RhdGUoKS51aS5hdXRvKTonJykrXG4gYDxkaXYgY2xhc3M9XCJscy1pbmZvXCI+PHNwYW4+ITwvc3Bhbj48cD7shKTsoJXsnYQg7JewIOuPmeyViCDtlIzroIjsnbTripQg7J287Iuc7KCV7KeA65Cp64uI64ukLjxicj7tmZjqsr0g7ISk7KCV7J2AIOydtCDruIzrnbzsmrDsoIDsl5Ag67O06rSA65CY66mwLCDqsozsnoQg7KeE7ZaJIOyggOyepeqzvOuKlCDrs4TqsJzsnoXri4jri6QuPC9wPjwvZGl2PmA7fVxuZnVuY3Rpb24gY29udHJvbHNIVE1MKCl7Y29uc3QgZ3JvdXBzPVtbJ+qzte2GtSDsobDsnpEnLFtbJ0VzYycsJ+yEpOyglSDsl7TquLAgLyDri6vquLAnXSxbJ0UgwrcgRW50ZXIgwrcgU3BhY2UnLCfrjIDsgqwg7KeE7ZaJJ10sWydDb250cm9sIOuIhOultOq4sCcsJ+uMgOyCrCDruaDrpbTqsowg64SY6riw6riwJ11dXSxbJ+yZuOu2gCDtg5Dsg4knLFtbJ0EgLyBEIMK3IOKGkCAvIOKGkicsJ+ydtOuPmSddLFsnU2hpZnQnLCfri6zrpqzquLAnXSxbJ0UnLCfsg4HtmLjsnpHsmqknXSxbJ1knLCftkZzsi5zrkJwg6rOz7JeQ7IScIOqxsOumrCDsoITqsr0g67O06riwJ11dXSxbJ+uwlCDCtyDshKDtg53sp4AnLFtbJ1RhYicsJ+yEnOu5hOyKpCDtjKjrhJAgLyBRQSDsg4Htmakg7ISg7YOdJ10sWydXIC8gUyDCtyDtnKAnLCfshKDtg53sp4Ag7J2064+ZJ10sWydFIMK3IO2BtOumrScsJ+yEoO2DneyngCDtmZXsoJUnXSxbJ+uTnOuemOq3uCcsJ+y9lOyKpO2EsCDrsLDsuZggwrcg7Lm17YWM7J28IOygnOqztSddXV1dO3JldHVybiBgPGRpdiBjbGFzcz1cImxzLWtleS1ncm91cHNcIj4ke2dyb3Vwcy5tYXAoKFt0aXRsZSxyb3dzXSk9PmA8c2VjdGlvbj48aDM+JHt0aXRsZX08L2gzPiR7cm93cy5tYXAoKFtrZXksbGFiZWxdKT0+YDxkaXY+PGtiZD4ke2tleX08L2tiZD48c3Bhbj4ke2xhYmVsfTwvc3Bhbj48L2Rpdj5gKS5qb2luKCcnKX08L3NlY3Rpb24+YCkuam9pbignJyl9PC9kaXY+PHAgY2xhc3M9XCJscy1mb290bm90ZVwiPuygnOyhsCDquLDrr7nsnZgg7IS467aAIOyhsOyekeydgCDtlbTri7kg7ZmU66m07J2YIOyViOuCtOulvCDtmZXsnbjtlbQg7KO87IS47JqULjwvcD5gO31cbmZ1bmN0aW9uIGh0bWwob3B0aW9ucyl7Y2FsbGJhY2tzPW9wdGlvbnM7Y29udGV4dD1vcHRpb25zLmNvbnRleHQ7cGVuZGluZz1udWxsO3JldHVybiBgPHNlY3Rpb24gY2xhc3M9XCJsdW5hLXNldHRpbmdzXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbGxlZGJ5PVwibHMtdGl0bGVcIiBkYXRhLXNldHRpbmdzLWNvbnRleHQ9XCIke2VzYyhjb250ZXh0KX1cIj48aGVhZGVyIGNsYXNzPVwibHMtaGVhZGVyXCI+PGRpdiBjbGFzcz1cImxzLWJyYW5kXCI+PGltZyBzcmM9XCJhc3NldHMvdWkvc2VydmljZV9wYW5lbC9CVE5fc2VydmljZV9wYW5lbC5wbmdcIiBhbHQ9XCJcIj48ZGl2PjxoMSBpZD1cImxzLXRpdGxlXCI+7ISk7KCVPC9oMT48L2Rpdj48L2Rpdj48YnV0dG9uIGNsYXNzPVwibHMtY2xvc2VcIiBkYXRhLXNldHRpbmdzLWFjdGlvbj1cImNsb3NlXCIgYXJpYS1sYWJlbD1cIuyEpOyglSDri6vquLBcIj48aW1nIHNyYz1cImFzc2V0cy91aS9wcm9maWxlL0JUTl9wcm9maWxlX2Nsb3NlLnBuZ1wiIGFsdD1cIlwiPjwvYnV0dG9uPjwvaGVhZGVyPjxkaXYgY2xhc3M9XCJscy1ib2R5XCI+PG5hdiBjbGFzcz1cImxzLW5hdlwiIHJvbGU9XCJ0YWJsaXN0XCIgYXJpYS1sYWJlbD1cIuyEpOyglSDrtoTrpZhcIiBhcmlhLW9yaWVudGF0aW9uPVwidmVydGljYWxcIj4ke3RhYnMubWFwKChbaWQsdGl0bGVdLGkpPT5gPGJ1dHRvbiBpZD1cImxzLXRhYi0ke2lkfVwiIHJvbGU9XCJ0YWJcIiBhcmlhLXNlbGVjdGVkPVwiJHshaX1cIiBhcmlhLWNvbnRyb2xzPVwibHMtJHtpZH1cIiB0YWJpbmRleD1cIiR7aT8tMTowfVwiIGRhdGEtc2V0dGluZ3MtdGFiPVwiJHtpZH1cIj4ke3RpdGxlfTxiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPuKAujwvYj48L2J1dHRvbj5gKS5qb2luKCcnKX08L25hdj48ZGl2IGNsYXNzPVwibHMtY29udGVudFwiPjxzZWN0aW9uIGlkPVwibHMtc291bmRcIiByb2xlPVwidGFicGFuZWxcIiBhcmlhLWxhYmVsbGVkYnk9XCJscy10YWItc291bmRcIj4ke3NvdW5kSFRNTCgpfTwvc2VjdGlvbj48c2VjdGlvbiBpZD1cImxzLWdhbWVcIiByb2xlPVwidGFicGFuZWxcIiBhcmlhLWxhYmVsbGVkYnk9XCJscy10YWItZ2FtZVwiIGhpZGRlbj4ke2dhbWVIVE1MKCl9PC9zZWN0aW9uPjxzZWN0aW9uIGlkPVwibHMtY29udHJvbHNcIiByb2xlPVwidGFicGFuZWxcIiBhcmlhLWxhYmVsbGVkYnk9XCJscy10YWItY29udHJvbHNcIiBoaWRkZW4+JHtjb250cm9sc0hUTUwoKX08L3NlY3Rpb24+PC9kaXY+PC9kaXY+PGZvb3RlciBjbGFzcz1cImxzLWZvb3RlclwiPjxzcGFuIGNsYXNzPVwibHMtZmVlZGJhY2tcIiByb2xlPVwic3RhdHVzXCIgYXJpYS1saXZlPVwicG9saXRlXCI+PC9zcGFuPjxkaXY+PGJ1dHRvbiBjbGFzcz1cImxzLXJlc2V0XCIgZGF0YS1zZXR0aW5ncy1hY3Rpb249XCJyZXNldFwiPuydtCDtla3rqqkg7LSI6riw7ZmUPC9idXR0b24+JHtvcHRpb25zLm9uUmVzdGFydD8nPGJ1dHRvbiBjbGFzcz1cImxzLWV4aXRcIiBkYXRhLXNldHRpbmdzLWFjdGlvbj1cInJlc3RhcnRcIj7ri6Tsi5wg7Iuc7J6RPC9idXR0b24+JzonJ30ke29wdGlvbnMub25FeGl0Pyc8YnV0dG9uIGNsYXNzPVwibHMtZXhpdFwiIGRhdGEtc2V0dGluZ3MtYWN0aW9uPVwiZXhpdFwiPicrZXNjKG9wdGlvbnMuZXhpdExhYmVsfHwn7YOA7J207YuA66GcJykrJzwvYnV0dG9uPic6Jyd9PGJ1dHRvbiBjbGFzcz1cImxzLXByaW1hcnlcIiBkYXRhLXNldHRpbmdzLWFjdGlvbj1cImNsb3NlXCI+64+M7JWE6rCA6riwIDxrYmQ+RXNjPC9rYmQ+PC9idXR0b24+PC9kaXY+PC9mb290ZXI+PGRpdiBjbGFzcz1cImxzLWNvbmZpcm1cIiBoaWRkZW4+PGRpdiByb2xlPVwiYWxlcnRkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImxzLWNvbmZpcm0tdGl0bGVcIj48aDIgaWQ9XCJscy1jb25maXJtLXRpdGxlXCI+PC9oMj48cD48L3A+PGRpdj48YnV0dG9uIGRhdGEtc2V0dGluZ3MtYWN0aW9uPVwiY2FuY2VsXCI+7Leo7IaMPC9idXR0b24+PGJ1dHRvbiBjbGFzcz1cImxzLXByaW1hcnlcIiBkYXRhLXNldHRpbmdzLWFjdGlvbj1cImNvbmZpcm1cIj7tmZXsnbg8L2J1dHRvbj48L2Rpdj48L2Rpdj48L2Rpdj48L3NlY3Rpb24+YDt9XG5mdW5jdGlvbiB0YWIoaWQpe2NvbnN0IHA9cGFuZWwoKTtwLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tyb2xlPVwidGFiXCJdJykuZm9yRWFjaChiPT57Y29uc3Qgb249Yi5kYXRhc2V0LnNldHRpbmdzVGFiPT09aWQ7Yi5zZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnLG9uKTtiLnRhYkluZGV4PW9uPzA6LTE7fSk7cC5xdWVyeVNlbGVjdG9yQWxsKCdbcm9sZT1cInRhYnBhbmVsXCJdJykuZm9yRWFjaChzPT5zLmhpZGRlbj1zLmlkIT09J2xzLScraWQpO3AucXVlcnlTZWxlY3RvcignLmxzLXJlc2V0JykuaGlkZGVuPWlkPT09J2NvbnRyb2xzJztwLnF1ZXJ5U2VsZWN0b3IoJy5scy1jb250ZW50Jykuc2Nyb2xsVG9wPTA7fVxuZnVuY3Rpb24gZmVlZGJhY2sodGV4dD0n67OA6rK9IOyCrO2VreydhCDsoIHsmqntlojsirXri4jri6QuJyl7Y29uc3QgZWw9cGFuZWwoKT8ucXVlcnlTZWxlY3RvcignLmxzLWZlZWRiYWNrJyk7aWYoZWwpZWwudGV4dENvbnRlbnQ9dGV4dDt9XG5mdW5jdGlvbiB1cGRhdGVDb250cm9sKGVsKXtjb25zdCB7ZyxiZ219PXN0YXRlKCksaWQ9ZWwuZGF0YXNldC5zZXR0aW5nLHY9ZWwudmFsdWU7aWYoaWQ9PT0nYmdtJyliZ20uc2V0Vm9sdW1lKCt2LzEwMCk7aWYoaWQ9PT0nc2Z4JylXLkx1bmFTZnguc2V0Vm9sdW1lKCt2LzEwMCk7aWYoaWQ9PT0nc3RyZWV0JylXLkx1bmFTdHJlZXRBdWRpby5zZXRWb2x1bWUoK3YvMTAwKTtpZihpZD09PSdmb2N1cycpVy5MdW5hRm9jdXNTZXR0aW5ncy5zZXRFbmFibGVkKHY9PT0nb24nKTtpZihpZD09PSd2b2ljZScpe1cuTHVuYURpYWxvZ3VlQXVkaW8uc2V0VmVyc2lvbih2KTtwYW5lbCgpLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXNldHRpbmdzLWFjdGlvbj1cInByZXZpZXdcIl0nKS5kaXNhYmxlZD12PT09J29mZic7fWlmKGlkPT09J3NwZWVkJylnLmRpYWxvZ1NwZWVkPSt2O2lmKGlkPT09J2xhbmd1YWdlJylnLmxhbmc9djtpZihlbC50eXBlPT09J3JhbmdlJyl7ZWwuc3R5bGUuc2V0UHJvcGVydHkoJy0tbGV2ZWwnLHYrJyUnKTtlbC5uZXh0RWxlbWVudFNpYmxpbmcudGV4dENvbnRlbnQ9disnJSc7fXNhdmUoKTtmZWVkYmFjaygpO31cbmZ1bmN0aW9uIGFzayhhY3Rpb24pe3BlbmRpbmc9YWN0aW9uO2NvbnN0IHA9cGFuZWwoKSxib3g9cC5xdWVyeVNlbGVjdG9yKCcubHMtY29uZmlybScpO2JveC5oaWRkZW49ZmFsc2U7cC5xdWVyeVNlbGVjdG9yKCcubHMtYm9keScpLmluZXJ0PXRydWU7cC5xdWVyeVNlbGVjdG9yKCcubHMtZm9vdGVyJykuaW5lcnQ9dHJ1ZTtwLnF1ZXJ5U2VsZWN0b3IoJy5scy1oZWFkZXInKS5pbmVydD10cnVlO2JveC5xdWVyeVNlbGVjdG9yKCdoMicpLnRleHRDb250ZW50PWFjdGlvbj09PSdyZXNldCc/J+ydtCDtla3rqqnsnYQg6riw67O46rCS7Jy866GcIOuwlOq/gOq5jOyalD8nOmFjdGlvbj09PSdyZXN0YXJ0Jz8n6rCZ7J2AIOychOy5mOyXkOyEnCDri6Tsi5wg7Iuc7J6R7ZWg6rmM7JqUPyc6KGNhbGxiYWNrcy5leGl0TGFiZWx8fCftg4DsnbTti4DroZwnKSsnIOydtOuPme2VoOq5jOyalD8nO2JveC5xdWVyeVNlbGVjdG9yKCdwJykudGV4dENvbnRlbnQ9YWN0aW9uPT09J3Jlc2V0Jz8n7ZiE7J6sIOu2hOulmOydmCDshKTsoJXrp4wg7LSI6riw7ZmU65Cp64uI64ukLiDri6Trpbgg7ISk7KCV6rO8IOqyjOyehCDsp4TtlonsnYAg7Jyg7KeA65Cp64uI64ukLic6J+2YhOyerCDtlIzroIjsnbTqsIAg7KKF66OM65CY66mwIOynhO2WiSDsg4HtmansnYAg7KCA7J6l65CY7KeAIOyViuyKteuLiOuLpC4nO2JveC5xdWVyeVNlbGVjdG9yKCdidXR0b24nKS5mb2N1cygpO31cbmZ1bmN0aW9uIGNhbmNlbCgpe2NvbnN0IHA9cGFuZWwoKSxhY3Rpb249cGVuZGluZztwZW5kaW5nPW51bGw7cC5xdWVyeVNlbGVjdG9yKCcubHMtY29uZmlybScpLmhpZGRlbj10cnVlO1snLmxzLWJvZHknLCcubHMtZm9vdGVyJywnLmxzLWhlYWRlciddLmZvckVhY2gocz0+cC5xdWVyeVNlbGVjdG9yKHMpLmluZXJ0PWZhbHNlKTtwLnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLXNldHRpbmdzLWFjdGlvbj1cIiR7YWN0aW9ufVwiXWApPy5mb2N1cygpO31cbmZ1bmN0aW9uIHJlc2V0KCl7Y29uc3QgaWQ9cGFuZWwoKS5xdWVyeVNlbGVjdG9yKCdbcm9sZT1cInRhYlwiXVthcmlhLXNlbGVjdGVkPVwidHJ1ZVwiXScpLmRhdGFzZXQuc2V0dGluZ3NUYWIse2csdWksYmdtfT1zdGF0ZSgpO2lmKGlkPT09J3NvdW5kJyl7YmdtLnNldEVuYWJsZWQodHJ1ZSk7YmdtLnNldFZvbHVtZSguMyk7Vy5MdW5hU2Z4LnNldFZvbHVtZSguOCk7Vy5MdW5hU3RyZWV0QXVkaW8uc2V0Vm9sdW1lKC41NSk7Vy5MdW5hRGlhbG9ndWVBdWRpby5zZXRWZXJzaW9uKCdtYWluJyk7dWkuZ2ltbWlja0F1ZGlvPXRydWU7cGFuZWwoKS5xdWVyeVNlbGVjdG9yKCcjbHMtc291bmQnKS5pbm5lckhUTUw9c291bmRIVE1MKCk7fWVsc2V7Vy5MdW5hRm9jdXNTZXR0aW5ncy5zZXRFbmFibGVkKHRydWUpO2cubGFuZz0na28nO2cuZGlhbG9nU3BlZWQ9MTtpZihjb250ZXh0PT09J2JhcicpdWkuYXV0bz1mYWxzZTtwYW5lbCgpLnF1ZXJ5U2VsZWN0b3IoJyNscy1nYW1lJykuaW5uZXJIVE1MPWdhbWVIVE1MKCk7fXNhdmUoKTtmZWVkYmFjaygn7J20IO2VreuqqeydhCDquLDrs7jqsJLsnLzroZwg65CY64+M66C47Iq164uI64ukLicpO31cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJyxlPT57Y29uc3QgcD1lLnRhcmdldC5jbG9zZXN0KCcubHVuYS1zZXR0aW5ncycpO2lmKCFwKXJldHVybjtjb25zdCBiPWUudGFyZ2V0LmNsb3Nlc3QoJ2J1dHRvbicpO2lmKCFiKXJldHVybjtjb25zdCBhY3Rpb249Yi5kYXRhc2V0LnNldHRpbmdzQWN0aW9uLGlkPWIuZGF0YXNldC5zZXR0aW5nVG9nZ2xlO2lmKCFhY3Rpb24mJiFpZCYmIWIuZGF0YXNldC5zZXR0aW5nc1RhYilyZXR1cm47ZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtpZihiLmRhdGFzZXQuc2V0dGluZ3NUYWIpe3RhYihiLmRhdGFzZXQuc2V0dGluZ3NUYWIpO3JldHVybjt9aWYoaWQpe2NvbnN0IHtiZ20sdWl9PXN0YXRlKCksb249Yi5nZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcpIT09J3RydWUnO2lmKGlkPT09J211c2ljJyliZ20uc2V0RW5hYmxlZChvbik7aWYoaWQ9PT0nZ2ltbWljaycpdWkuZ2ltbWlja0F1ZGlvPW9uO2lmKGlkPT09J2F1dG8nKXVpLmF1dG89b247Yi5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsb24pO2IucXVlcnlTZWxlY3Rvcignc3BhbicpLnRleHRDb250ZW50PW9uPyfsvJzsp5AnOifqurzsp5AnO3NhdmUoKTtmZWVkYmFjaygpO3JldHVybjt9aWYoYWN0aW9uPT09J2Nsb3NlJyljYWxsYmFja3Mub25DbG9zZT8uKCk7aWYoYWN0aW9uPT09J3ByZXZpZXcnKXZvaWQgVy5MdW5hRGlhbG9ndWVBdWRpby5wcmV2aWV3KCk7aWYoYWN0aW9uPT09J3Jlc2V0J3x8YWN0aW9uPT09J2V4aXQnfHxhY3Rpb249PT0ncmVzdGFydCcpYXNrKGFjdGlvbik7aWYoYWN0aW9uPT09J2NhbmNlbCcpY2FuY2VsKCk7aWYoYWN0aW9uPT09J2NvbmZpcm0nKXtjb25zdCBhPXBlbmRpbmc7Y2FuY2VsKCk7aWYoYT09PSdyZXNldCcpcmVzZXQoKTtlbHNlIGlmKGE9PT0ncmVzdGFydCcpY2FsbGJhY2tzLm9uUmVzdGFydD8uKCk7ZWxzZSBjYWxsYmFja3Mub25FeGl0Py4oKTt9fSx0cnVlKTtcbmZvcihjb25zdCBuYW1lIG9mIFsnaW5wdXQnLCdjaGFuZ2UnXSlkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKG5hbWUsZT0+e2lmKCFlLnRhcmdldC5tYXRjaGVzKCcubHVuYS1zZXR0aW5ncyBbZGF0YS1zZXR0aW5nXScpKXJldHVybjtlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO3VwZGF0ZUNvbnRyb2woZS50YXJnZXQpO30sdHJ1ZSk7XG4vLyBJbnRlcmNlcHQgYmVmb3JlIGdhbWUgaG90a2V5cywgYnV0IHByZXNlcnZlIG5hdGl2ZSBzbGlkZXIvc2VsZWN0IGtleWJvYXJkIGJlaGF2aW9yLlxuVy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxlPT57Y29uc3QgcD1wYW5lbCgpO2lmKCFwKXJldHVybjtlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO2lmKGUuY29kZT09PSdFc2NhcGUnKXtlLnByZXZlbnREZWZhdWx0KCk7aWYoIWUucmVwZWF0KXtpZihwZW5kaW5nKWNhbmNlbCgpO2Vsc2UgY2FsbGJhY2tzLm9uQ2xvc2U/LigpO31yZXR1cm47fWlmKGUuY29kZT09PSdUYWInKXtjb25zdCBzY29wZT1wZW5kaW5nP3AucXVlcnlTZWxlY3RvcignLmxzLWNvbmZpcm0nKTpwLGl0ZW1zPVsuLi5zY29wZS5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b246bm90KDpkaXNhYmxlZCksc2VsZWN0LGlucHV0LFt0YWJpbmRleD1cIjBcIl0nKV0uZmlsdGVyKGVsPT5lbC5nZXRDbGllbnRSZWN0cygpLmxlbmd0aCYmIWVsLmNsb3Nlc3QoJ1toaWRkZW5dLFtpbmVydF0nKSYmZWwudGFiSW5kZXg+PTApO2NvbnN0IGk9aXRlbXMuaW5kZXhPZihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtlLnByZXZlbnREZWZhdWx0KCk7aXRlbXNbKGkrKGUuc2hpZnRLZXk/LTE6MSkraXRlbXMubGVuZ3RoKSVpdGVtcy5sZW5ndGhdPy5mb2N1cygpO3JldHVybjt9Y29uc3QgdD1lLnRhcmdldC5jbG9zZXN0KCdbcm9sZT1cInRhYlwiXScpO2lmKHQmJlsnQXJyb3dVcCcsJ0Fycm93RG93bicsJ0hvbWUnLCdFbmQnXS5pbmNsdWRlcyhlLmtleSkpe2UucHJldmVudERlZmF1bHQoKTtjb25zdCBpPXRhYnMuZmluZEluZGV4KHg9PnhbMF09PT10LmRhdGFzZXQuc2V0dGluZ3NUYWIpLG49ZS5rZXk9PT0nSG9tZSc/MDplLmtleT09PSdFbmQnPzI6KGkrKGUua2V5PT09J0Fycm93RG93bic/MToyKSklMzt0YWIodGFic1tuXVswXSk7cC5xdWVyeVNlbGVjdG9yKCcjbHMtdGFiLScrdGFic1tuXVswXSkuZm9jdXMoKTt9fSx0cnVlKTtcblcuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLGU9PntpZihwYW5lbCgpKWUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7fSx0cnVlKTtcbm5ldyBNdXRhdGlvbk9ic2VydmVyKCgpPT57Y29uc3QgcD1wYW5lbCgpO2lmKHA9PT1tb3VudGVkKXJldHVybjtpZihwKXtpZighbW91bnRlZClyZXR1cm5Gb2N1cz1kb2N1bWVudC5hY3RpdmVFbGVtZW50O3AucXVlcnlTZWxlY3RvcignW3JvbGU9XCJ0YWJcIl1bYXJpYS1zZWxlY3RlZD1cInRydWVcIl0nKT8uZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO31lbHNlIGlmKHJldHVybkZvY3VzPy5pc0Nvbm5lY3RlZCYmIXJldHVybkZvY3VzLmNsb3Nlc3QoJ1toaWRkZW5dLFtpbmVydF0nKSlyZXR1cm5Gb2N1cy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7bW91bnRlZD1wO30pLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LHtjaGlsZExpc3Q6dHJ1ZSxzdWJ0cmVlOnRydWV9KTtcblcuTHVuYVNldHRpbmdzPXtodG1sLHJlc3RvcmV9O1xufSkod2luZG93KTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFDLFVBQVNBLENBQUMsRUFBQztFQUNaLFlBQVk7O0VBQ1osTUFBTUMsR0FBRyxHQUFDLHlCQUF5QjtFQUNuQyxNQUFNQyxJQUFJLEdBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBQyxLQUFLLENBQUMsRUFBQyxDQUFDLE1BQU0sRUFBQyxPQUFPLENBQUMsRUFBQyxDQUFDLFVBQVUsRUFBQyxPQUFPLENBQUMsQ0FBQztFQUNsRSxJQUFJQyxTQUFTLEdBQUMsQ0FBQyxDQUFDO0lBQUNDLE9BQU8sR0FBQyxFQUFFO0lBQUNDLE9BQU8sR0FBQyxJQUFJO0lBQUNDLFdBQVcsR0FBQyxJQUFJO0lBQUNDLE9BQU8sR0FBQyxJQUFJO0VBQ3RFLE1BQU1DLEdBQUcsR0FBQ0MsQ0FBQyxJQUFFQyxNQUFNLENBQUNELENBQUMsSUFBRSxFQUFFLENBQUMsQ0FBQ0UsT0FBTyxDQUFDLFVBQVUsRUFBQ0MsQ0FBQyxJQUFHO0lBQUMsR0FBRyxFQUFDLE9BQU87SUFBQyxHQUFHLEVBQUMsTUFBTTtJQUFDLEdBQUcsRUFBQyxNQUFNO0lBQUMsR0FBRyxFQUFDLFFBQVE7SUFBQyxHQUFHLEVBQUM7RUFBTyxDQUFDLEVBQUNBLENBQUMsQ0FBRSxDQUFDO0VBQ25ILE1BQU1DLEtBQUssR0FBQ0EsQ0FBQSxLQUFJQyxRQUFRLENBQUNDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQztFQUN4RCxNQUFNQyxLQUFLLEdBQUNBLENBQUEsTUFB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
