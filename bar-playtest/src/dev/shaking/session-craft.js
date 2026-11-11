/* Main-game bridge only. Standalone/practice keeps its original result/navigation. */
(function () {
  'use strict';
  if (query.get('mode') !== 'craft' || parent === window) return;
  const token = query.get('token');
  let initialized = false, blocked = true, baseTime = 0, lastReport = -Infinity, taught = false;
  const send = (action, data = {}) => parent.postMessage({ type: 'luna-shake-craft', token, action, ...data }, location.origin);
  const elapsed = () => S.phase === 'tut' ? 0 : Math.max(0, ((S.endT || GT) - S.startT) / 1000);
  const report = action => send(action, { elapsed: elapsed(), started: S.phase !== 'tut' });
  const pause = setPause;
  setPause = on => pause(on || blocked);
  setPause(true);
  document.body.classList.add('craft-session');
  $('sMenu').hidden = true;
  document.querySelector('.row:has(#oDiff)').hidden = true;
  const pressBase = press;
  press = key => { if (initialized && !blocked) return pressBase(key); };
  const tutorialNext = tutNext;
  tutNext = () => {
    if (!initialized || blocked) return;
    tutorialNext();
    if (S.phase === 'close' && !taught) { taught = true; send('taught'); }
  };
  const updateBase = updateUI;
  updateUI = () => {
    updateBase();
    const total = baseTime + elapsed();
    $('timer').textContent = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(Math.floor(total % 60)).padStart(2, '0');
    if (initialized && GT - lastReport >= 80) { lastReport = GT; report('progress'); }
  };
  finish = reason => {
    if (S.done) return;
    S.done = true; S.phase = 'done'; ShakeLabAudio.stop();
    const score = reason === 'pop' ? 0 : Math.max(0, Math.min(100, Math.round(S.res.filter(x => x === 'O').length / R.rounds * 100) - (B.PEN[S.closeQ] || 0)));
    // finish is called only after separation/fade/hold or failure spill animation.
    send('complete', { elapsed: elapsed(), started: true, score, failures: S.misses });
  };
  addEventListener('message', event => {
    const m = event.data;
    if (event.origin !== location.origin || event.source !== parent || m?.type !== 'luna-shake-craft' || m.token !== token) return;
    if (m.action === 'init' && !initialized) {
      initialized = true; blocked = !!m.blocked; baseTime = Math.max(0, Number(m.baseTime) || 0);
      R = { ...RECIPES[0], name: String(m.name || ''), id: 'craft', pattern: ['AD'] };
      R.layers = m.layers?.length ? m.layers : [['음료', '#c8e6f0', 1]];
      OPT.diff = 'normal'; reset();
      if (m.taught) { taught = true; S.tutPage = TUT.length - 1; tutorialNext(); }
      setPause(!$('tut').hidden || !$('settings').hidden);
    } else if (m.action === 'pause') {
      blocked = !!m.blocked;
      setPause(blocked || !$('tut').hidden || !$('settings').hidden);
      if (blocked) ShakeLabAudio.stop();
    } else if (m.action === 'settings') toggleSettings(true);
  });
  send('ready');
})();
