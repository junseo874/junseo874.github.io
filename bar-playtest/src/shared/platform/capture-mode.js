(function (W) {
 'use strict';
 // Presentation only: never delete dialogue, alter saves, or stop scene clocks.
 let hidden = false, fallback = null;
 function sync() {
  document.documentElement.classList.toggle('capture-ui-hidden', hidden);
  for (const button of document.querySelectorAll('[data-capture-ui]')) {
   button.setAttribute('aria-pressed', String(hidden));
   button.textContent = hidden ? '게임 UI 다시 켜기' : '게임 UI 모두 숨기기';
  }
 }
 function set(value) {
  hidden = !!value;
  sync();
 }
 function mount(panel) {
  if (!panel || panel.querySelector('.capture-controls')) return;
  const section = document.createElement('section');
  section.className = 'capture-controls';
  section.innerHTML = '<h3>스크린샷 · 영상 촬영</h3><button type="button" data-capture-ui aria-pressed="false"></button><p>배경·캐릭터·효과는 유지하고 게임 UI를 숨깁니다.<br>P로 패널을 닫아 촬영하세요. 다시 P로 켜거나 Esc로 UI를 복구할 수 있습니다.</p>';
  panel.querySelector('header').after(section);
  sync();
 }
 function closeFallback() { fallback?.close(); fallback?.remove(); fallback = null; }
 function openFallback() {
  W.outsidePlaytest?.clearInput();
  W.lunaCampaign?.clearInput();
  // A native dialog keeps recovery reachable even above an update/help dialog.
  fallback = document.createElement('dialog');
  fallback.className = 'capture-console-layer';
  fallback.innerHTML = '<aside class="outside-dev-console capture-console" role="dialog" aria-label="촬영 개발자 패널"><header><h2>개발자 패널 · 촬영</h2><button type="button" data-capture-close>P · 닫기</button></header></aside>';
  document.body.append(fallback);
  mount(fallback.firstElementChild);
  fallback.showModal();
  fallback.querySelector('[data-capture-ui]').focus({preventScroll:true});
 }
 document.addEventListener('click', e => {
  if (e.target.closest('[data-capture-ui]')) { set(!hidden); e.preventDefault(); }
  if (e.target.closest('[data-capture-close]')) closeFallback();
 });
 // The usual P consoles remain unchanged. A scene entered during recording
 // still needs a way back, even if that scene normally has no developer panel.
 W.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (fallback) {
   // Do not forward panel navigation to a hidden dialogue underneath it.
   e.stopImmediatePropagation();
   if (['KeyP', 'Escape'].includes(e.code)) {
    e.preventDefault(); if (!e.repeat) closeFallback();
   } else if (['Enter', 'Space'].includes(e.code)) {
    e.preventDefault(); if (!e.repeat) (e.target.closest('.capture-console button') || fallback.querySelector('[data-capture-ui]'))?.click();
   } else if (e.code === 'Tab') {
    e.preventDefault();
    const buttons = [...fallback.querySelectorAll('button')], at = buttons.indexOf(document.activeElement);
    buttons[(at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus({preventScroll:true});
   }
   return;
  }
  if (!hidden) return;
  const outside = W.outsidePlaytest, campaign = W.lunaCampaign;
  const consoleOpen = outside?.devConsoleOpen || campaign?.view === 'dev-console';
  if (e.code === 'Escape' && !consoleOpen) {
   e.preventDefault(); e.stopImmediatePropagation();
   if (!e.repeat) set(false);
  } else if (e.code === 'KeyP' && !consoleOpen &&
    (outside?.active ? campaign?.blocking : !(campaign?.active && campaign.view === 'game'))) {
   e.preventDefault(); e.stopImmediatePropagation();
   if (!e.repeat) openFallback();
  }
 }, true);
 W.LunaCaptureMode = {get hidden() {return hidden;}, set, mount};
})(window);
