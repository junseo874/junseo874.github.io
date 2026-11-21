(function (W) {
  'use strict';
  const base = 'assets/backgrounds/campaign/bar-door/Door_Transition_';
  const background = base + 'BG.png';
  const door = base + 'Door.png';
  const light = base + 'Lignt.png';
  const assets = [background, door, light], art = new Map();
  let preparation;
  function prepare(){
    return preparation ||= Promise.all(assets.map(async src=>{
      if(!art.has(src))art.set(src,await W.LunaResources.image(src));
    })).catch(error=>{preparation=null;throw error;});
  }
  function srcAttr(src){
    const image=art.get(src);
    return image?' src="'+image.src.replaceAll('&','&amp;')+'"':'';
  }

  function smooth(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function html(direction, artReady) {
    const label = direction === 'in' ? '언노운 입장 준비 중' : '언노운에서 퇴근하는 중';
    return '<div class="bar-door-scene" data-direction="' + direction + '" role="status" aria-label="' + label + '">' +
      '<div class="bar-door-composition" aria-hidden="true"' + (artReady ? '' : ' hidden') + '>' +
        '<div class="bar-door-aperture"><img'+srcAttr(light)+' alt=""><img class="bar-door-leaf"'+srcAttr(door)+' alt=""></div>' +
        '<img class="bar-door-background"'+srcAttr(background)+' alt="">' +
      '</div><span class="bar-door-load-track" aria-hidden="true"><i></i></span></div>';
  }

  function paint(host, d) {
    const scene = host.querySelector('.bar-door-scene');
    if (!scene) return;
    const moving = d.motionAt != null;
    const progress = moving ? smooth((d.time - d.motionAt) / 1.45) : 0;
    const open = d.direction === 'in' ? progress : 1 - progress;
    scene.style.setProperty('--door-offset', (-100 * open) + '%');
    scene.style.setProperty('--door-arrival', smooth(d.time / .55));
    scene.dataset.phase = d.revealAt != null ? 'reveal' : moving ? (d.direction === 'in' ? 'opening' : 'closing') : 'loading';
    scene.dataset.open = String(open);
    scene.dataset.ready = String(d.ready);
    host.style.opacity = d.revealAt == null ? '1' : String(1 - smooth((d.time - d.revealAt) / .8));
  }

  W.LunaBarDoor = {assets, prepare, get ready(){return art.size===assets.length;}, html, paint};
})(window);
