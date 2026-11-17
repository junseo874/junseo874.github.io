/* O toggles the whole site window, including when a simulator iframe has focus. */
(function (win) {
  'use strict';
  if (win.LunaWindowFullscreen) return;
  const doc = win.document;
  let pending = false;

  async function toggle() {
    if (pending) return;
    pending = true;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        await (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      } else {
        const root = doc.documentElement;
        await (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
      }
    } catch (error) {
      // The embedding browser may explicitly block native fullscreen.
      console.warn('전체화면 전환을 허용하지 않는 브라우저 환경입니다.', error);
    } finally {
      pending = false;
    }
  }
  win.LunaWindowFullscreen = {toggle};
  win.addEventListener('keydown', event => {
    if (!(event.code === 'KeyO' || event.key?.toLowerCase() === 'o') ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
    if (event.composedPath().some(el => el.isContentEditable ||
      el.matches?.('textarea, select, [role="textbox"], [role="searchbox"]') ||
      (el.tagName === 'INPUT' && !['button','submit','reset','image','checkbox','radio','range','color','file'].includes(el.type)))) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    // Delegate synchronously to retain this keystroke's user activation.
    let host = win;
    try {
      while (host.parent !== host && host.parent.LunaWindowFullscreen) host = host.parent;
    } catch { /* A foreign embedding page does not own our shortcut. */ }
    void host.LunaWindowFullscreen.toggle();
  }, true);
})(window);
