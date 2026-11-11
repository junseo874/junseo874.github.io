/* Presentation adapter: V2 owns input/animation; the existing craft queue owns results.
 * No CSV command, recipe or save schema is introduced here. */
(function (W) {
  'use strict';
  function attach(g, { sound = () => true } = {}) {
    const base = Object.fromEntries(['tickGimmick', 'gimmickInput', 'endGimmick'].map(k => [k, g[k].bind(g)]));
    let session = null, committing = false;
    const uses = () => g.screen === 'gimmick' && g.gimmick?.type === 'shake' && !!g.craft && !g.minigame;
    const current = s => uses() && s.craft === g.craft && s.step === g.gimmick;
    function layers(craft) {
      return craft.results.filter(r => r.ingredient && r.value > 0).map(r => {
        const item = g.t.shelf_items.find(i => i.id === r.ingredient);
        const rgb = String(item?.color || '200,230,240').split(',').map(Number);
        const color = '#' + [0, 1, 2].map(i => Math.round(Math.max(0, Math.min(255, Number.isFinite(rgb[i]) ? rgb[i] : 220))).toString(16).padStart(2, '0')).join('');
        return [g.name(r.ingredient), color, r.value];
      });
    }
    const send = (s, action, data = {}) => s.frame.contentWindow?.postMessage({ type: 'luna-shake-craft', token: s.token, action, ...data }, location.origin);
    function close() {
      if (!session) return;
      const s = session; session = null;
      W.removeEventListener('message', s.receive);
      s.dialog.close(); s.dialog.remove();
    }
    function commit(s) {
      if (!current(s) || !s.result || g.isPaused()) return;
      const result = s.result, step = s.step;
      delete step.rhythm; delete step.mixTutorial;
      step.started = true; step.completed = true;
      step.success = result.score / 100 * step.targetStacks;
      step.failures = result.failures;
      // V2 has already played its full ending; don't add the old 0.9s hold.
      step.completionAge = W.LunaCore.MIX.completionHoldSec;
      committing = true;
      try { base.endGimmick(); } finally { committing = false; }
      if (!current(s)) close();
    }
    function open() {
      const dialog = document.createElement('dialog'), frame = document.createElement('iframe');
      const s = { dialog, frame, craft: g.craft, step: g.gimmick, baseTime: g.craft.elapsed, token: crypto.randomUUID(), blocked: null };
      session = s;
      dialog.className = 'wine-practice-dialog shake-craft-dialog';
      dialog.setAttribute('aria-label', '쉐이킹'); frame.title = '쉐이킹';
      frame.src = 'src/dev/shaking/version-2.html?mode=craft&token=' + s.token + '&sound=' + (sound() ? '1' : '0');
      s.receive = event => {
        const m = event.data;
        if (event.origin !== location.origin || event.source !== frame.contentWindow || m?.type !== 'luna-shake-craft' || m.token !== s.token || !current(s)) return;
        if (m.action === 'ready') {
          send(s, 'init', { baseTime: s.baseTime, name: g.name(s.craft.actual.selected), layers: layers(s.craft), taught: !!g.progress.flags.mix_tutorial_shake, blocked: g.isPaused() });
          frame.focus(); return;
        }
        if (m.action === 'taught') { g.progress.flags.mix_tutorial_shake = true; return; }
        if (!['progress', 'complete'].includes(m.action) || !Number.isFinite(m.elapsed) || m.elapsed < 0) return;
        s.step.started = !!m.started;
        s.step.elapsed = Math.max(s.step.elapsed, m.elapsed);
        s.craft.elapsed = s.baseTime + s.step.elapsed;
        if (m.action === 'complete' && !s.result && Number.isFinite(m.score) && Number.isInteger(m.failures) && m.failures >= 0) {
          s.result = { score: Math.max(0, Math.min(100, m.score)), failures: m.failures };
          commit(s);
        }
      };
      W.addEventListener('message', s.receive);
      dialog.append(frame); document.body.append(dialog);
      // ESC belongs to the embedded settings, never to dialog cancellation.
      dialog.addEventListener('cancel', e => { e.preventDefault(); send(s, 'settings'); });
      dialog.addEventListener('keydown', e => e.stopPropagation());
      dialog.showModal(); frame.focus();
    }
    function sync() {
      if (session && !current(session)) close();
      if (!uses()) return;
      if (!session) open();
      const s = session, blocked = !!g.isPaused();
      if (s.blocked !== blocked) { s.blocked = blocked; send(s, 'pause', { blocked }); }
      commit(s);
    }
    // Prevent the legacy shake clock, tutorial and auto-completion from racing V2.
    g.tickGimmick = dt => uses() ? undefined : base.tickGimmick(dt);
    g.gimmickInput = key => uses() ? false : base.gimmickInput(key);
    g.endGimmick = () => uses() && !committing ? false : base.endGimmick();
    return { uses, sync, active: () => !!session };
  }
  W.LunaShakeV2 = { attach };
})(window);
