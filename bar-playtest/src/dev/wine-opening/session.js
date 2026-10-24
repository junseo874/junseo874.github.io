/* Standalone simulator lifecycle: no campaign state, inventory or save writes. */
window.WineLab = (() => {
  'use strict';
  const el = id => document.getElementById(id);
  let game = null, paused = false, ready = false, muted = new URLSearchParams(location.search).get('sound') === '0';
  let tasks = [], previous = 0, raf = 0;
  function release() { game?.release(); }
  function pause(value) {
    if (!ready) return;
    paused = value;
    release();
    game.audio(paused || muted);
    el('pause').hidden = !paused;
    (paused ? el('resume') : el('cv')).focus({preventScroll:true});
  }
  function leave(action) {
    pause(true);
    if (parent !== window) parent.postMessage({type:'luna-wine-practice', action}, location.origin);
    else location.href = '../../../index.html?dev=1&mode=minigames';
  }
  function restart() {
    if (!ready) return;
    release(); game.mute(); game.reset(); pause(false);
  }
  function sound() {
    muted = !muted; game?.mute();
    el('bSound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    el('bSound').setAttribute('aria-pressed', String(!muted));
  }
  el('bSound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
  el('bSound').onclick = sound;
  el('bReset').onclick = restart;
  el('bPause').onclick = () => pause(!paused);
  el('resume').onclick = () => pause(false);
  for (const id of ['bVersions','pauseVersions']) el(id).onclick = () => leave('versions');
  for (const id of ['bExit','pauseExit']) el(id).onclick = () => leave('exit');
  el('reload').onclick = () => location.reload();
  addEventListener('keydown', e => {
    if (e.code === 'F11') return;
    if (e.code === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) pause(!paused);
      return;
    }
    if (!ready || paused) {
      e.stopImmediatePropagation();
      if (paused && e.code === 'Tab') {
        const buttons = [...el('pause').querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        e.preventDefault(); buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      } else if (paused && ['Enter','Space'].includes(e.code) && el('pause').contains(document.activeElement)) {
        e.preventDefault(); document.activeElement.click();
      }
    } else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code) && e.target === el('cv')) e.preventDefault();
  }, true);
  for (const type of ['pointerdown','pointermove']) el('cv').addEventListener(type, e => {
    if (!ready || paused || type === 'pointerdown' && e.button !== 0) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (type === 'pointerdown') el('cv').focus({preventScroll:true});
  }, true);
  addEventListener('blur', () => pause(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('dragstart', e => e.preventDefault());
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); tasks=[]; game?.mute(); });
  function frame(t) {
    const dt = Math.min(50, t - previous); previous = t;
    if (!paused) {
      const due = tasks.filter(task => (task.left -= dt) <= 0);
      tasks = tasks.filter(task => task.left > 0);
      for (const task of due) task.fn();
      game.draw();
    }
    raf = requestAnimationFrame(frame);
  }
  return {
    get paused() { return paused; }, get muted() { return muted; },
    delay(fn,ms) { tasks.push({fn,left:ms}); },
    reset() { tasks=[]; },
    async start(api) {
      game = api;
      try {
        await Promise.all(api.images.map(image => image.decode()));
        game.reset(); ready = true; el('loading').hidden = true;
        el('cv').focus({preventScroll:true}); previous = performance.now();
        raf = requestAnimationFrame(frame);
      } catch (error) {
        el('loadMessage').textContent = '이미지를 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.';
        el('reload').hidden = false;
      }
    }
  };
})();
