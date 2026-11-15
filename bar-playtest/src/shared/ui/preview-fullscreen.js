/* Keep the live preview mounted so fullscreen never restarts an iframe or animation. */
(function () {
  let current = null;
  function leave() {
    if (!current) return;
    const {host, opener, exit, frameWindow, observer} = current;
    current = null;
    observer.disconnect();
    frameWindow?.removeEventListener('keydown', onKey, true);
    host.classList.remove('preview-expanded');
    exit.remove();
    if (document.fullscreenElement === host) document.exitFullscreen().catch(()=>{});
    opener.focus({preventScroll:true});
  }
  function onKey(event) {
    if (current && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      leave();
    }
  }
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-expand-preview]');
    if (!opener || current) return;
    const host = document.getElementById(opener.dataset.expandPreview);
    if (!host) return;
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'preview-exit';
    exit.textContent = '전체화면 닫기';
    exit.onclick = leave;
    const frameWindow = host.querySelector('iframe')?.contentWindow;
    const observer = new MutationObserver(() => {
      if (!host.isConnected || host.closest('dialog:not([open])')) leave();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    current = {host,opener,exit,frameWindow,observer};
    frameWindow?.addEventListener('keydown', onKey, true);
    host.classList.add('preview-expanded');
    host.append(exit);
    exit.focus();
    host.requestFullscreen?.().catch(()=>{}); // CSS fills the viewport if native fullscreen is unavailable.
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) leave();
  });
  window.addEventListener('keydown', onKey, true);
})();
