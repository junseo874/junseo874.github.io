/* Exterior view/controller: rendering, camera, DOM, input and developer controls. State stays on the owning instance; dependencies are explicit. */
(function (root) {
  'use strict';
  function create({ BOTTOM, EX, FLOWS, OutsideModel, PLACES, R, TOP, VIEWPOINT, atViewpoint, clamp, firstCommuteEntranceCue, global, homewardCues, interactionAnchor, interactionLabel, mix, smooth, streetDrawOrder, streetParallax }) {
  function create({
    onExit = () => {},
    currencyView = global.LunaCurrencyView()
  } = {}) {
    const glowRenderer = global.LunaInteractionGlow.create();
    let discoveryMarkers = [];
    let renderingNode = null,
      choiceUI = null;
    const data = global.LUNA_OUTSIDE_DATA,
      config = {
        place: 'bar',
        flow: 'out',
        day: 0
      },
      images = new Map(),
      keys = new Set();
    let active = false,
      loading = false,
      loadError = '',
      model = null,
      host = null,
      canvas = null,
      ctx = null,
      cam = {
        x: 1,
        y: 0,
        w: 4.8
      },
      generation = 0,
      hudSignature = '',
      lastScene = '',
      panorama = false,
      wakeSpawn = false,
      devOpen = false,
      notices = null,
      hintOpen = false,
      streetLocation = null;
    let surface = global.LunaPixelCamera.surface(1280, 720),
      renderCam = {
        ...cam
      },
      pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
    let panoramaTween = false;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
    const button = (text, action, cls = '') => `<button class="${cls}" data-outside-action="${action}">${text}</button>`;
    function lobbyHTML(tabs) {
      return `<div class="start-screen outside-start">${tabs}<section class="start-card outside-setup outside-entry"><small>OUTSIDE EXPLORATION</small><h2>외부 공간</h2><p>거리와 집을 자유롭게 둘러보세요.<br>설정은 탐색 중 <kbd>P</kbd>를 눌러 변경할 수 있습니다.</p>${button('탐색 시작 →', 'start', 'primary')}<span>0일차 · 퇴근길 · 바 문 앞에서 시작</span></section></div>`;
    }
    async function loadImages() {
      const queue=Object.entries(data.assets).filter(([id])=>!images.has(id));let index=0;
      await Promise.all(Array.from({length:Math.min(6,queue.length)},async()=>{
        while(index<queue.length){const [id,a]=queue[index++];images.set(id,await global.LunaResources.image(a.src));}
      }));
      global.LunaOutsideAmbient.prepareBounds(images,data);
    }
    function fit() {
      if (!host) return;
      const previous = surface;
      surface = global.LunaPixelCamera.surface(innerWidth, innerHeight, devicePixelRatio);
      if (previous.w !== surface.w || previous.dpr !== surface.dpr) pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
      host.style.setProperty('--outside-scale', surface.cssScale);
      host.style.setProperty('--outside-left', surface.left + 'px');
      host.style.setProperty('--outside-top', surface.top + 'px');
      // Clear any stale focus scroll from a pre-resize layout (including legacy browsers).
      host.scrollLeft = host.scrollTop = 0;
      const stage = host.querySelector('.outside-stage');
      if (stage) stage.scrollLeft = stage.scrollTop = 0;
      if (canvas && (canvas.width !== surface.w || canvas.height !== surface.h)) {
        canvas.width = surface.w;
        canvas.height = surface.h;
      }
    }
    function clearInput() {
      keys.clear();
    }
    function devMoney() {
      return Math.max(0, Number(global.barGame?.progress.money) || 0);
    }
    function devHTML() {
      return '<aside class="outside-dev-console" role="dialog" aria-label="외부 개발자 콘솔" hidden><header><div><small>DEVELOPER</small><h2>외부 개발자 콘솔</h2></div>' + button('P · 닫기', 'dev-close') + '</header><section class="outside-dev-days-section"><h3>일차</h3><div class="outside-dev-days">' + [0, 1, 2, 3, 99].map(day => button(day === 99 ? '99일차 · QA 가상 공간' : day + '일차', 'dev-day-' + day, day === 99 ? 'outside-dev-qa' : '')).join('') + '</div></section><section><h3>이동 상태 <small class="outside-dev-day"></small></h3><div class="outside-dev-flow">' + button('출근길', 'dev-flow-in') + button('퇴근길', 'dev-flow-out') + '</div></section><section><h3>위치 이동</h3>' + button('집 안', 'dev-home') + button('엘리베이터 앞 · 아래층', 'dev-elevator') + button('바 문 앞', 'dev-bar') + '</section><section><h3>현재 소지금</h3><output class="outside-dev-money" aria-live="polite"></output><div class="outside-dev-money-actions">' + button('−1,000원', 'dev-minus') + button('+1,000원', 'dev-plus') + '</div></section><p class="outside-dev-note"></p><p class="outside-dev-feedback" role="status"></p></aside>';
    }
    function paintDev() {
      const panel = host?.querySelector('.outside-dev-console');
      if (!panel) return;
      global.LunaCaptureMode?.mount(panel);
      panel.hidden = !devOpen;
      panel.querySelector('[data-outside-action="dev-day-99"]').hidden = !!global.lunaCampaign?.active;
      panel.querySelector('.outside-dev-day').textContent = model.config.day + '일차';
      for (const day of [0, 1, 2, 3, 99]) panel.querySelector('[data-outside-action="dev-day-' + day + '"]').setAttribute('aria-pressed', String(model.config.day === day));
      for (const flow of ['in', 'out']) panel.querySelector('[data-outside-action="dev-flow-' + flow + '"]').setAttribute('aria-pressed', String(model.config.flow === flow));
      for (const place of ['home', 'elevator', 'bar']) panel.querySelector('[data-outside-action="dev-' + place + '"]').disabled = !!model.qa;
      panel.querySelector('.outside-dev-note').textContent = model.qa ? '99일차는 QA 전용 공간입니다. P 패널을 닫고 Tab으로 테스트할 상황을 고르세요. 0–3일차를 선택하면 거리로 돌아갑니다.' : global.lunaCampaign?.active ? '일차 변경은 본편 진행에도 적용됩니다. 위치·소지금·보유 물품은 유지하고 진행 중인 대화·이벤트는 초기화합니다.' : '일차 변경 시 진행 중인 대화·이벤트는 초기화됩니다. 현재 위치·소지금·보유 물품은 유지됩니다. 99일차는 별도 QA 공간으로 이동합니다.';
      panel.querySelector('output').textContent = devMoney().toLocaleString('ko-KR') + '원';
      panel.querySelector('[data-outside-action="dev-minus"]').disabled = devMoney() === 0;
    }
    function toggleDev(open = !devOpen) {
      if (!active || loading || loadError) return;
      devOpen = open;
      hintOpen = false;
      clearInput();
      paintDev();
      hudSignature = '';
      updateHUD();
      if (open) {
        host.querySelector('.outside-dev-console').scrollTop = 0;
        host.querySelector('[data-capture-ui]')?.focus({preventScroll: true});
      } else host.focus({
        preventScroll: true
      });
    }
    function normalPosition(m) {
      return {
        scene: m.scene,
        level: m.level,
        x: m.ride ? EX : m.x,
        y: m.ride ? m.level ? R.upperY : -.7 : m.y,
        elevatorY: m.ride ? m.level ? TOP : BOTTOM : m.elevatorY,
        facing: m.facing,
        place: m.config.place
      };
    }
    function changeDay(day) {
      if (global.lunaCampaign?.active && day === 99 || ![0, 1, 2, 3, 99].includes(day) || model.config.day === day) return;
      const m = model,
        c = global.lunaCampaign;
      clearInput();
      m.story.cancel();
      m.backgroundStory.cancel();
      if (!m.qa) streetLocation = normalPosition(m);
      const qaCase = m.qa?.caseId || config.qaCase;
      Object.assign(config, {
        day,
        qaCase,
        place: streetLocation?.place || 'bar'
      });
      c?.debugOutsideDay(day, config.flow);
      model = new OutsideModel(config);
      if (day !== 99 && streetLocation) {
        const {
          place,
          ...position
        } = streetLocation;
        Object.assign(model, position);
        model.updateNear();
      }
      if (c) {
        c.outsideSleep = null;
        c.liftLogoPending = false;
        document.querySelector('#campaign-lift-reveal')?.remove();
      }
      wakeSpawn = false;
      panorama = false;
      snapCamera();
      draw();
      global.barGame?.log('debug_outside_day', {
        from: m.config.day,
        to: day,
        flow: config.flow
      });
      host.querySelector('.outside-dev-feedback').textContent = day === 99 ? '99일차 QA 공간으로 이동했습니다. 패널을 닫고 Tab으로 상황을 선택하세요.' : day + '일차 · ' + FLOWS[config.flow] + '로 변경했습니다.';
    }
    function dismissHint() {
      hintOpen = false;
      clearInput();
      hudSignature = '';
      updateHUD();
      host.focus({
        preventScroll: true
      });
    }
    function devAction(action) {
      if (!devOpen || loading || loadError) return;
      if (action === 'dev-close') {
        toggleDev(false);
        return;
      }
      const m = model,
        c = global.lunaCampaign,
        g = global.barGame;
      if (action.startsWith('dev-day-')) changeDay(Number(action.slice(8)));else if (action === 'dev-plus' || action === 'dev-minus') {
        const before = devMoney(),
          after = Math.max(0, before + (action === 'dev-plus' ? 1000 : -1000));
        g.progress.money = after;
        if (c?.session.active && c.session.carry) c.session.carry.money = after;
        g.log('debug_money', {
          before,
          after,
          source: 'outside-console'
        });
        g.changed();
      } else if (action === 'dev-flow-in' || action === 'dev-flow-out') {
        const flow = action === 'dev-flow-in' ? 'in' : 'out';
        if (m.config.flow === flow) return;
        clearInput();
        m.story.cancel();
        m.backgroundStory.cancel();
        m.encounter = null;
        m.dialog = null;
        m.notice = '';
        m.noticeLeft = 0;
        m.playedAmbient.clear();
        m.notionCommuteSeen = false;
        // Preserve the exact location (and any lift trip); only the route and its event state change.
        m.config.flow = flow;
        config.flow = flow;
        if (c?.active) {
          c.session.day = m.config.day;
          c.session.route = flow;
          c.session.carry = JSON.parse(JSON.stringify(g.progress));
          c.session.pendingStep = null;
          c.morningSeen.delete(m.config.day);
          c.nightStarted = false;
        }
        if (c) {
          c.outsideSleep = null;
          c.liftLogoPending = false;
          document.querySelector('#campaign-lift-reveal')?.remove();
        }
        g.log('debug_commute', {
          day: m.config.day,
          flow,
          source: 'outside-console'
        });
        m.updateNear();
        m.revision++;
        host.querySelector('.outside-dev-feedback').textContent = m.config.day + '일차 · ' + FLOWS[flow] + '로 변경했습니다.';
      } else if (['dev-home', 'dev-elevator', 'dev-bar'].includes(action)) {
        if (m.qa) return;
        clearInput();
        m.story.cancel();
        m.backgroundStory.cancel();
        m.ride = null;
        m.transition = null;
        m.encounter = null;
        m.dialog = null;
        m.paused = false;
        m.notice = '';
        m.noticeLeft = 0;
        // Keep QA isolated; select a normal day before teleporting into the city.
        const home = action === 'dev-home';
        m.scene = home ? 'home' : 'street';
        m.level = home ? 1 : 0;
        m.x = home ? -1.28 : action === 'dev-elevator' ? EX : 1.0086;
        m.y = -.7;
        m.elevatorY = home ? TOP : BOTTOM;
        m.facing = home ? 1 : action === 'dev-elevator' ? 1 : -1;
        m.anim = 'idle';
        m.animTime = 0;
        m.config.place = home ? 'home' : 'bar';
        config.place = m.config.place;
        wakeSpawn = false;
        panorama = false;
        if (c) {
          c.liftLogoPending = false;
          document.querySelector('#campaign-lift-reveal')?.remove();
        }
        m.updateNear();
        m.revision++;
        snapCamera();
        draw();
        host.querySelector('.outside-dev-feedback').textContent = home ? '집 안으로 이동했습니다.' : action === 'dev-elevator' ? '아래층 엘리베이터 앞으로 이동했습니다.' : '바 문 앞으로 이동했습니다.';
      }
      hudSignature = '';
      updateHUD();
      paintDev();
    }
    function devKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.code === 'KeyP' && !loading && !loadError && (!model.paused || devOpen || global.LunaCaptureMode?.hidden)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) toggleDev();
        return true;
      }
      if (!devOpen) return false;
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat) toggleDev(false);
      } else if (e.code === 'Tab') {
        e.preventDefault();
        const buttons = [...host.querySelectorAll('.outside-dev-console button:not(:disabled)')].filter(b => b.getClientRects().length),
          i = buttons.indexOf(document.activeElement);
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      } else if (!['Enter', 'Space'].includes(e.code) || !e.target.closest('.outside-dev-console button') || e.repeat) e.preventDefault();
      return true;
    }
    function snapCamera() {
      global.LunaStreetParallax?.notifyTeleport(model);
      panoramaTween = false;
      const arriving = model.scene === 'street' && (model.barArrival || model.transition?.barArrival);
      cam = {
        x: model.scene === 'home' ? global.LunaHomeArt.cameraX(model.x, 4.8) : arriving ? .65 : model.x,
        y: model.scene === 'home' ? .023 : model.y + .7,
        w: 4.8
      };
      Object.assign(cam,global.LunaOutsideNeighborhood?.camera(model)||{});
      lastScene = model.scene;
      pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
    }
    async function start({
      wakeAtSofa = false,
      showDevHint = false
    } = {}) {
      if (active) return;
      wakeSpawn = wakeAtSofa;
      generation++;
      const token = generation;
      active = true;
      loading = true;
      loadError = '';
      panorama = false;
      devOpen = false;
      hintOpen = false;
      streetLocation = null;
      clearInput();
      model = new OutsideModel(config);
      if (wakeSpawn) model.wakeAtSofa();
      snapCamera();
      host = document.createElement('section');
      host.id = 'outside-root';
      host.setAttribute('aria-label', '외부 공간 탐색');
      host.tabIndex = -1;
      host.innerHTML = '<div class="outside-stage"><canvas width="1280" height="720" aria-label="루나가 이동하는 거리와 집 내부" role="img"></canvas><div class="outside-hud"><div class="outside-dynamic"></div></div><div class="outside-speech" hidden></div><div class="outside-background-speech" hidden></div><div class="outside-overlay"></div>' + devHTML() + '</div>';
      document.body.append(host);
      choiceUI = global.LunaWorldChoices.create(host.querySelector('.outside-stage'), id => {
        clearInput();
        if (['sofa','elevator','tv'].includes(model.dialog?.kind)) {
          if(model.dialog.kind==='sofa')model.chooseSofa(id);else model.chooseObject(id);
          host?.focus({
            preventScroll: true
          });
        } else model.story.choose(id);
        updateHUD();
      });
      notices = global.LunaOutsideNotices.create(host, currencyView);
      notices.update(model);
      document.querySelector('#app').hidden = true;
      canvas = host.querySelector('canvas');
      ctx = canvas.getContext('2d');
      fit();
      hudSignature = '';
      draw();
      updateHUD();
      try {
        await global.LunaResources.prepare('common');
        await loadImages();
        if (token !== generation) return;
        loading = false;
        hintOpen = showDevHint && !global.lunaCampaign?.active;
        host.focus({
          preventScroll: true
        });
      } catch (e) {
        if (token !== generation) return;
        loading = false;
        loadError = '거리 리소스를 불러오지 못했습니다. 다시 시도해 주세요.';
        console.error('Outside asset load:', e.message);
      }
      updateHUD();
    }
    function exit(silent = false) {
      choiceUI?.dispose();
      choiceUI = null;
      global.LunaControlsTutorial.stop();
      global.LunaHomeDoorAudio?.stop();
      notices?.dispose();
      notices = null;
      generation++;
      active = false;
      loading = false;
      devOpen = false;
      hintOpen = false;
      clearInput();
      host?.remove();
      host = null;
      document.querySelector('#app').hidden = false;
      if (!silent) onExit();
    }
    function advanceDay() {
      if (!active || loading || loadError || model.qa || model.config.flow !== 'out' || model.config.day >= 3) return false;
      Object.assign(config, {
        day: model.config.day + 1,
        flow: 'in',
        place: 'home'
      });
      clearInput();
      model = new OutsideModel(config);
      wakeSpawn = true;
      model.wakeAtSofa();
      panorama = false;
      snapCamera();
      hudSignature = '';
      draw();
      updateHUD();
      host.focus({
        preventScroll: true
      });
      return true;
    }
    function menu() {
      if (loading || loadError) return;
      clearInput();
      model.paused = !model.paused;
      hudSignature = '';
      updateHUD();
    }
    function togglePanorama() {
      if (loading || loadError || devOpen || model.paused || !atViewpoint(model)) return false;
      panorama = !panorama;
      panoramaTween = true;
      clearInput();
      updateHUD();
      return true;
    }
    function targetCamera(dt) {
      if (!atViewpoint(model)) panorama = false;
      if (lastScene !== model.scene) snapCamera();
      const restCamera=global.LunaOutsideNeighborhood?.camera(model);
      if(restCamera){Object.assign(cam,restCamera);pixelWidth=global.LunaPixelCamera.settledWidth(restCamera.w,surface);return;}
      let w = 4.8,
        x = model.x,
        y = model.scene === 'home' ? .023 : model.y + .7,
        liftWidth = null,
        liftDisplayWidth = null;
      if (model.scene === 'street' && model.ride && !model.ride.call) {
        const r = model.ride,
          p = clamp((r.time - .45) / r.duration, 0, 1),
          zoom = smooth(clamp(r.time / 3, 0, 1)) * (1 - smooth(clamp((p - .73) / .27, 0, 1)));
        w = mix(4.8, 12.8, zoom);
        liftWidth = w;
        liftDisplayWidth = mix(global.LunaPixelCamera.settledWidth(4.8, surface), global.LunaPixelCamera.settledWidth(12.8, surface), zoom);
        // Both directions share the ascent panorama: Luna/lift at 6% of the frame, not
        // a fixed world offset. PPU-calibrated width varies with viewport/DPR.
        // Use the same easing as the zoom so boarding and arrival stay continuous.
        x = model.x + liftDisplayWidth * .44 * zoom;
        y = model.y + .7 + 1.0 * zoom;
      }
      if (model.qa?.camera) {
        ({
          w,
          x,
          y
        } = model.qa.camera);
      }
      if (model.encounter) {
        panorama = false;
        if (model.encounter.stage !== 'leaving') ({
          w,
          x,
          y
        } = model.encounter.camera);
      }
      if (model.scene === 'street' && (model.barArrival || model.transition?.barArrival)) x = .65;
      if (!panorama) ({
        w,
        x,
        y
      } = global.LunaOutsideResidents.frame(model, {
        w,
        x,
        y
      }));
      if (panorama) {
        w = VIEWPOINT.width;
        x = VIEWPOINT.x;
        y = -1.48 + w * 720 / 1280 / 2;
      }
      // Keep endpoint PPU alignment while the zoom follows the original smooth
      // cinematic curve. Quantizing this moving target caused 3x -> 2x -> 1x cuts.
      // Scale the original *visible* panorama, not its quantized logical width.
      // The tighter 2/3 framing is now 1.3x wider, without a PPU snapping jump.
      // Only Y viewing uses this framing; normal/lift PPU endpoints stay intact.
      const pixelGoal = panorama ? global.LunaPixelCamera.settledWidth(VIEWPOINT.previousWidth, surface) * VIEWPOINT.rangeScale : w === liftWidth ? liftDisplayWidth : global.LunaPixelCamera.settledWidth(w, surface);
      if (model.scene !== 'street' || model.ride || model.encounter || model.qa) panoramaTween = false;
      const rate = panorama || panoramaTween ? VIEWPOINT.easeRate : 5;
      pixelWidth = global.LunaPixelCamera.approachWidth(pixelWidth, pixelGoal, dt * rate / 5);
      if (!model.qa) {
        if (model.scene === 'home') x = global.LunaHomeArt.cameraX(x, w);else x = clamp(x, -22.25 + w / 2, 6.55 - w / 2);
      }
      // Constrain the visible bottom, not just the camera center, during zoom.
      const floor = data.scenes.street.nodes.find(n => n.name === '1F Floor').y + .02;
      if (model.scene === 'street') y = Math.max(y, floor + w * 720 / 1280 / 2);
      const t = 1 - Math.exp(-dt * rate);
      cam.x = mix(cam.x, x, t);
      cam.y = mix(cam.y, y, t);
      cam.w = mix(cam.w, w, t);
      if (model.scene === 'street') cam.y = Math.max(cam.y, floor + cam.w * 720 / 1280 / 2);
      if (!panorama && Math.abs(pixelWidth - pixelGoal) < .001 && Math.abs(cam.w - w) < .001 && Math.abs(cam.x - x) < .001 && Math.abs(cam.y - y) < .001) panoramaTween = false;
      if (model.encounter) model.encounter.cameraReady = Math.abs(cam.x - x) < .015 && Math.abs(cam.y - y) < .015 && Math.abs(cam.w - w) < .015;
    }
    function position(x, y) {
      return global.LunaPixelCamera.position(x, y, renderCam);
    }
    function discoveryPosition(x, y, target) {
      const pose=global.LunaOutsideNeighborhood?.poses(model).find(p=>p.id===target.actor)
        ||data.scenes[model.scene].nodes.find(n=>n.name===(target.nodeName||target.actor||target.id)||n.id===target.id);
      return global.LunaOutsideDiscovery.project({x,y},pose,renderCam,surface);
    }
    function drawSprite(sp, x, y, sx = 1, sy = 1, flip = false, alpha = 1, glow = false) {
      const img = images.get(sp.asset);
      if (!img) return;
      const p = global.LunaPixelCamera.sprite(sp, x, y, sx, sy, flip, renderCam, surface),
        w = p.w,
        h = p.h,
        rayReach = renderingNode?.lightRotation ? Math.abs(h * Math.sin(renderingNode.lightRotation)) : 0;
      if (p.x + w + rayReach < 0 || p.x - w - rayReach > 1280 || p.y + h < 0 || p.y - h > 720) return;
      const lit=global.LunaCharacterLighting?.shade(model,img,sp,x,y,w*renderCam.w/1280,h*renderCam.w/1280,(sx<0)!==flip,renderingNode);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (glow) ctx.globalCompositeOperation = 'screen';
      // City light cookies contain soft gradients, not sprite silhouettes.
      // Nearest-neighbor enlargement made their rotated beams look tiled.
      // Neon handles its own soft halo and crisp core separately below.
      ctx.imageSmoothingEnabled = glow && !renderingNode?.neon;
      ctx.translate(p.x, p.y);
      if (renderingNode?.lightRotation) ctx.rotate(-renderingNode.lightRotation);
      ctx.scale((sx < 0 ? -1 : 1) * (flip ? -1 : 1), sy < 0 ? -1 : 1);
      if (lit) ctx.drawImage(lit.image,lit.x,lit.y,lit.w,lit.h,-w*sp.pivot.x,-h*(1-sp.pivot.y),w,h);
      else if (renderingNode?.name === 'home-city') global.LunaHomeArt.paintCity(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h, renderCam.x - renderingNode.x);
      else if (renderingNode?.name === 'main_bg' && model.scene === 'home') global.LunaHomeArt.paintRoom(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      else if (renderingNode?.name === 'home-fence' && model.scene === 'home') global.LunaHomeArt.paintFence(ctx, img, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      else if (renderingNode?.neon) global.LunaStreetSigns.paint(ctx, img, sp, w, h, renderingNode.engineLightId || renderingNode.id, model.time, global.matchMedia?.("(prefers-reduced-motion: reduce)").matches);else ctx.drawImage(img, sp.x, sp.y, sp.w, sp.h, -w * sp.pivot.x, -h * (1 - sp.pivot.y), w, h);
      if (model.scene === 'street') global.LunaStreetEngineEffects?.paintSprite(ctx, renderingNode?.name, img, images, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaWallLighting?.paintSprite(ctx, renderingNode?.name, img, sp, w, h);
      if (model.scene === 'street') global.LunaSignScanlines?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaVentSteam?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (renderingNode?.name === 'B_Obects') global.LunaWireSpark?.paint(ctx, img, images.get('street-wire-spark'), sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (model.scene === 'street' && !model.qa) global.LunaBarrelFire?.paintSprite(ctx, renderingNode?.name, sp, w, h, model.time, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches, images);
      global.LunaLiftDust?.paintSprite(ctx, model, renderingNode?.name, sp, w, h, global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      if (!global.LunaCaptureMode?.hidden) glowRenderer.paint(ctx, img, sp, renderingNode, x, y, w, h);
      ctx.restore();
    }
    function renderNode(n) {
      const previous = renderingNode;
      renderingNode = n;
      try {
        renderSceneNode(n);
      } finally {
        renderingNode = previous;
      }
    }
    function renderSceneNode(n) {
      if(n.name==='barrel-fire'){global.LunaBarrelFire.draw(ctx,n,model,renderCam,images,surface);return;}
      if (global.LunaOutsideBeggar?.drawNode(model, n, drawSprite)) return;
      if (global.LunaOutsideResidents.drawNode(model, n, drawSprite, ctx, position)) return;
      if (global.LunaOutsideEncounters.drawNode(model, n, drawSprite)) return;
      if (!global.LunaOutsideContent.visibleNode(model, n)) return;
      if (n.name === 'shiba') {
        if (global.LunaOutsideShop.visible(model)) {
          const a = data.animations.shiba;
          drawSprite(a.frames[global.LunaOutsideAmbient.frameIndex(model.time, a.frames.length)], n.x, n.y, n.sx, n.sy, n.flip);
        }
        return;
      }
      if (n.name === 'Samho' && [2, 3].includes(model.config.day)) {
        global.LunaOutsideSamhoCommute.draw(model, drawSprite);
        return;
      }
      if (n.name === 'Samho' && global.lunaCampaign?.session.active && model.config.flow === 'in' && model.config.day >= 2) {
        const phase = model.time % 4,
          frame = phase < .3 ? Math.floor(phase * 10) % 3 : 0;
        drawSprite({
          ...n.sprite,
          x: frame * 84
        }, n.x, n.y, n.sx, n.sy, global.LunaOutsideAmbient.faceTarget(n.x, model.x));
        return;
      }
      if (!n.active || n.name === 'Luna' || n.name === 'Square' || /SAMHO|samho|Samho|Bubi/.test(n.name)) return;
      if (n.ambient && !global.LunaOutsideAmbient.visible(model, n)) return;
      let y = n.y;
      if (model.scene === 'street' && n.ancestry.includes('Elevator') && ['Elevator', 'Elevator Connector', 'Elevator Fore', 'Elevator Door'].includes(n.name)) y += model.elevatorY - BOTTOM;
      // Preserve the supplied sprite cutouts and world coordinates, including the exterior.
      const light = n.light || /City.*Light/.test(n.name);
      let sp = n.ambient ? global.LunaOutsideAmbient.frame(n, model.time) : n.sprite;
      const facing = global.LunaOutsideAmbient.facing(n, model),
        art = streetParallax(n, renderCam, model);
      drawSprite(sp, art.x, art.y + (y - n.y), n.sx, n.sy, facing, n.alpha ?? (light ? .26 : 1), light);
    }
    function drawEntranceCue() {
      if (!firstCommuteEntranceCue(model)) return;
      const door = data.scenes.street.nodes.find(n => n.name === 'Bar Spawn Point');
      if (!door) return;
      const k = 1280 / renderCam.w,
        p = position(door.x, -.98);
      if (p.x + .3 * k < 0 || p.x - .3 * k > 1280) return;
      const still = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        t = still ? 0 : model.time;
      const drift = still ? 0 : Math.sin(t * Math.PI * 2 / .9) * .012 * k;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Trace the doorway below the sign, in the entrance sprite's pixel space.
      // Keep the frame fixed to the art (only the arrow nudges), behind Luna.
      const sp = door.sprite,
        outline = [[2, 15], [36, 15], [36, 66], [2, 66], [2, 15]];
      ctx.strokeStyle = '#c9ffff';
      ctx.lineWidth = k * .008;
      ctx.globalAlpha = .96;
      ctx.shadowColor = '#4ae5f4';
      ctx.shadowBlur = 7 * k / 266.667;
      ctx.beginPath();
      outline.forEach(([x, y], i) => {
        const q = position(door.x + (x - sp.w * sp.pivot.x) * door.sx / sp.ppu, door.y + (sp.h * (1 - sp.pivot.y) - y) * door.sy / sp.ppu);
        if (i) ctx.lineTo(q.x, q.y);else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      // Match the bar tutorial's single, round-capped cyan arrow and gentle nudge.
      ctx.translate(p.x, p.y - drift);
      ctx.scale(k / 266.667, k / 266.667);
      ctx.strokeStyle = '#c9ffff';
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = .98;
      ctx.shadowColor = '#4ae5f4';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(0, 0);
      ctx.moveTo(-10, 10);
      ctx.lineTo(0, 0);
      ctx.lineTo(10, 10);
      ctx.stroke();
      ctx.restore();
    }
    function interactionTarget() {
      const m = model;
      return m && !m.paused && !loading && !loadError && !devOpen && !hintOpen && !m.controlsTutorial && !m.dialog && !m.story.blocking && !global.lunaCampaign?.blocking ? m.near : null;
    }
    function draw(advanceParallax = true) {
      discoveryMarkers = [];
      if (!ctx || !model) return;
      if (surface.dpr !== devicePixelRatio) fit();
      renderCam = global.LunaPixelCamera.view(cam, surface, {
        scene: model.scene,
        qa: !!model.qa,
        displayWidth: pixelWidth,
        floor: data.scenes.street.nodes.find(n => n.name === '1F Floor').y + .02
      });
      ctx.setTransform(surface.factor, 0, 0, surface.factor, 0, 0);
      glowRenderer.begin(model.qa || global.LunaCaptureMode?.hidden ? null : interactionTarget(), model);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1280, 720);
      if (loading || loadError) return;
      if (advanceParallax) global.LunaStreetParallax.update(model, data.scenes.street.nodes, { x: cam.x, locked: panorama || panoramaTween || !!model.ride });
      if (model.qa) {
        global.LunaOutsideQA.draw({
          m: model,
          ctx,
          position,
          sprite: drawSprite,
          data,
          player: () => {
            const a = data.animations[model.anim];
            drawSprite(a.frames[Math.floor(model.animTime * a.fps) % a.frames.length], model.x, model.y, 1, 1, model.facing > 0);
          }
        });
        if (model.transition) {
          ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, 1 - Math.abs(model.transition.time - .38) / .47) + ')';
          ctx.fillRect(0, 0, 1280, 720);
        }
        return;
      }
      const nodes = data.scenes[model.scene].nodes.slice().sort((a, b) => a.layer - b.layer || a.order - b.order || b.z - a.z);
      if (model.scene === 'home') {
        nodes.filter(n => n.name === 'home-city').forEach(renderNode);
        const bg = nodes.find(n => n.name === 'main_bg');
        global.LunaOutsideRain?.drawHome(ctx, model, renderCam, position, bg, 'rain');
        if (bg) renderNode(bg);
        global.LunaOutsideRain?.drawHome(ctx, model, renderCam, position, bg, 'glass');
        nodes.filter(n => !['home-city', 'main_bg', 'ForeFore_Object', 'home-fence'].includes(n.name)).forEach(renderNode);
      }
      const drawPlayer = () => {
        const anim = data.animations[model.anim],
          frame = anim.frames[Math.floor(model.animTime * anim.fps) % anim.frames.length];
        drawSprite(frame, model.x, model.y, 1, 1, model.facing > 0);
      };
      if (model.scene === 'home') {
        global.LunaOutsideNeighborhood?.draw(model, drawSprite, ctx, position, images, global.LunaCaptureMode?.hidden ? null : glowRenderer);
        drawPlayer();
        nodes.filter(n => ['ForeFore_Object', 'home-fence'].includes(n.name)).forEach(renderNode);
      } else {
        let farTraffic = false,
          midTraffic = false,
          nearTraffic = false,
          adCarrier = false,
          groundRain = false;
        global.LunaStreetAtmosphere?.begin(model);
        for (const n of streetDrawOrder(nodes)) {
          global.LunaStreetAtmosphere?.beforeNode(ctx, model, renderCam, n, nodes, images, position);
          // Ground impacts belong to the road, behind the frontmost silhouettes
          // (and elevator front). Falling rain gets a separate foreground pass.
          if (!groundRain && n.layer >= 10) {
            global.LunaOutsideRain?.draw(ctx, model, renderCam, position, 'splashes');
            groundRain = true;
          }
          // Traffic is part of the scene, not an overlay: skyline silhouettes,
          // foreground shops and the residence/lift naturally cover it afterwards.
          if (!farTraffic && n.name === 'C_Back_Building_2') {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'far');
            farTraffic = true;
          }
          if (!midTraffic && n.layer >= 3) {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'mid');
            midTraffic = true;
          }
          if (!nearTraffic && n.layer >= 6) {
            global.LunaOutsideTraffic?.draw(ctx, model, renderCam, position, 'near');
            nearTraffic = true;
          }
          // Middle-city buildings AND their attached display planes (layers
          // 3–5) stay behind the carrier; street/residence foreground stays ahead.
          // The advertising hull is opaque; depth is established by occlusion.
          if (!adCarrier && (n.name === 'residence-building' || n.layer >= 6)) {
            global.LunaOutsideAdCarrier?.draw(ctx, model, renderCam, position, images);
            adCarrier = true;
          }
          if (n.name === 'Luna') {
            global.LunaCharacterShadows?.draw(ctx, model, renderCam, images, surface, global.LunaStreetAtmosphere?.inspect(model)?.renderer);
            drawEntranceCue();
            global.LunaOutsideThug?.draw(model, drawSprite, ctx, position);
            global.LunaOutsideNotion?.draw(model, drawSprite, ctx, position);
            global.LunaOutsideNeighborhood?.draw(model, drawSprite, ctx, position, images, global.LunaCaptureMode?.hidden ? null : glowRenderer);
            if(!global.LunaOutsideNeighborhood?.inCamp(model))drawPlayer();
          } else renderNode(n);
        }
        global.LunaOutsideNeighborhood?.drawCamp(model,drawSprite);
        if(global.LunaOutsideNeighborhood?.inCamp(model))drawPlayer();
      }
      global.LunaOutsideRain?.draw(ctx, model, renderCam, position, 'drops');
      // OutSide's volume has no vignette; retain the old room shading only indoors.
      if (model.scene !== 'street') {
        const shade = ctx.createLinearGradient(0, 0, 0, 720);
        shade.addColorStop(0, 'rgba(0,0,0,.25)');
        shade.addColorStop(.25, 'rgba(0,0,0,0)');
        shade.addColorStop(.85, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,.3)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, 1280, 720);
      }
      global.LunaStreetAtmosphere?.post(ctx, model);
      global.LunaRainGlass?.draw(ctx, model, {camera:renderCam});
      if(interactionTarget()&&!model.qa&&!global.LunaCaptureMode?.hidden){
        discoveryMarkers=global.LunaOutsideDiscovery.draw(ctx,model,model.targets(),discoveryPosition,t=>interactionAnchor(model,t,data,true),surface.factor);
      }
      const neighborhoodFade=global.LunaOutsideNeighborhood?.fadeAlpha(model)||0;
      if(neighborhoodFade){ctx.fillStyle=`rgba(0,0,0,${neighborhoodFade})`;ctx.fillRect(0,0,1280,720);}
      if (model.transition) {
        const t = model.transition.time,
          alpha = t < .38 ? t / .38 : 1 - (t - .38) / .47;
        ctx.fillStyle = `rgba(0,0,0,${clamp(alpha, 0, 1)})`;
        ctx.fillRect(0, 0, 1280, 720);
      }
    }
    const controlsDismissKeys = new Set();
    let controlsUnlockAt = 0,
      controlsStep = 0;
    function showControlsTutorial() {
      if (!active || model.scene !== 'home' || model.config.day !== 0 || model.config.flow !== 'in' || model.controlsTutorial) return;
      clearInput();
      controlsStep = 0;
      controlsUnlockAt = performance.now() + 2000;
      model.controlsTutorial = true;
      updateHUD();
      host.querySelector('.outside-controls-tutorial')?.focus({
        preventScroll: true
      });
    }
    function dismissControlsTutorial() {
      if (!model.controlsTutorial || model.paused || loading || loadError || devOpen || performance.now() < controlsUnlockAt) return;
      if (controlsStep === 0) {
        controlsStep = 1;
        controlsUnlockAt = performance.now() + 300;
        clearInput();
        updateHUD();
        host.querySelector('.outside-controls-tutorial')?.focus({
          preventScroll: true
        });
        return;
      }
      global.LunaControlsTutorial.stop();
      model.controlsTutorial = false;
      clearInput();
      const campaign = global.lunaCampaign;
      if (model.isFirstCommute() && campaign?.active && global.LunaStoryNotices.startGoal(global.barGame.progress, 'first_commute', '첫 출근하기!') && campaign.session.carry) campaign.session.carry.objectives = structuredClone(global.barGame.progress.objectives);
      updateHUD();
      host.focus({
        preventScroll: true
      });
    }
    function controlsTutorialKey(e) {
      if (!active) return false;
      // Consume the dismissing key until release, including movement key repeats.
      if (controlsDismissKeys.has(e.code)) return true;
      if (!model.controlsTutorial || model.paused || loading || loadError || devOpen) return false;
      if (!e.repeat) {
        controlsDismissKeys.add(e.code);
        if (e.code === 'KeyE' && !e.metaKey && !e.ctrlKey && !e.altKey && performance.now() >= controlsUnlockAt) dismissControlsTutorial();
      }
      return true;
    }
    function paintControlsTutorial() {
      let panel = host.querySelector('.outside-controls-tutorial');
      if (model.scene !== 'home' || model.config.flow !== 'in' || model.config.day !== 0) model.controlsTutorial = false;
      if (model.controlsTutorial && !panel) {
        panel = document.createElement('section');
        panel.className = 'outside-controls-tutorial';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.tabIndex = -1;
        const shade = document.createElement('div');
        shade.className = 'outside-controls-shade';
        shade.append(panel);
        host.querySelector('.outside-stage').append(shade);
      }
      if (!panel) return;
      const wasVisible = panel.dataset.visible === 'true';
      panel.hidden = !model.controlsTutorial || model.paused || loading || !!loadError || devOpen || !!model.dialog || model.story.blocking;
      panel.parentElement.hidden = panel.hidden;
      panel.dataset.visible = String(!panel.hidden);
      if (panel.hidden) {
        if (wasVisible) global.LunaControlsTutorial.stop();
        if (!model.controlsTutorial) delete panel.dataset.step;
      } else {
        if (panel.dataset.step !== String(controlsStep)) {
          global.LunaControlsTutorial.render(panel, controlsStep, images, data);
          const step = controlsStep,
            owner = model;
          void global.LunaControlsTutorial.play(() => active && model === owner && model.controlsTutorial && controlsStep === step && !panel.hidden);
        }
        const locked = performance.now() < controlsUnlockAt;
        panel.dataset.locked = String(locked);
      }
      host.querySelector('.outside-hud').inert = !panel.hidden || model.paused || devOpen || !!model.dialog;
    }
    function paintHomewardGuide() {
      let el = host.querySelector('.outside-homeward-guide');
      if (!el) {
        el = document.createElement('aside');
        el.className = 'outside-homeward-guide';
        el.setAttribute('aria-label', '귀가 안내');
        el.dataset.visible = 'false';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<div class="homeward-copy"><strong>집으로 가기</strong><small></small></div>';
        host.querySelector('.outside-stage').append(el);
        // Establish the off-screen position before the first entrance transition.
        el.getBoundingClientRect();
      }
      const m = model,
        cue = homewardCues(m)[0];
      // Keep directions visible during conversations; boarding the lift hides them.
      // Do not use hidden/display:none: the exit must finish sliding off-screen.
      const visible = !!cue && !m.paused && !loading && !loadError && !devOpen && !hintOpen && !panorama && !m.controlsTutorial && !global.lunaCampaign?.blocking;
      if (el.dataset.visible !== String(visible)) {
        el.dataset.visible = String(visible);
        el.setAttribute('aria-hidden', String(!visible));
      }
      if (!cue) return;
      const atTarget = m.near?.id === (cue.id === 'lift' ? 'elevator' : 'home');
      const direction = atTarget ? 'up' : cue.direction;
      const detail = atTarget ? cue.id === 'lift' ? 'E · 엘리베이터로 위층 이동' : 'E · 집에 들어가기' : (cue.direction === 'left' ? '왼쪽 ' : '오른쪽 ') + (cue.id === 'lift' ? '엘리베이터로 이동' : '집 입구로 이동');
      if (el.dataset.direction !== direction) el.dataset.direction = direction;
      el.dataset.destination = cue.id;
      const copy = el.querySelector('small');
      if (copy.textContent !== detail) copy.textContent = detail;
    }
    function updateHUD() {
      if (!host) return;
      notices?.update(model);
      const m = model,
        near = m.near,
        actionLabel = interactionLabel(m, near),
        overlay = host.querySelector('.outside-overlay'),
        hud = host.querySelector('.outside-hud'),
        viewpoint = atViewpoint(m) && !panorama && !loading && !loadError && !m.paused && !devOpen;
      // Scripted pauses belong to the campaign/cutscene, not the outside ESC menu.
      const showPauseMenu = m.paused && !global.lunaCampaign?.blocking;
      const signature = JSON.stringify([loading, loadError, m.paused, showPauseMenu, m.dialog, m.scene, m.level, near?.id, near?.label, actionLabel, !!m.ride, m.ride?.call, panorama, viewpoint, m.story.blocking, m.encounter?.stage, devOpen, hintOpen]);
      if (signature !== hudSignature) {
        hudSignature = signature;
        host.querySelector('.outside-dynamic').innerHTML = `<button class="outside-interact" aria-label="${esc(actionLabel + (near?.label ? ' · ' + near.label : ''))}" data-outside-action="interact" ${near && !m.paused ? '' : 'hidden'}><kbd aria-hidden="true">E</kbd><span>${esc(actionLabel)}</span></button><button class="outside-viewpoint" aria-label="${panorama ? '전경 보기에서 돌아오기' : '거리 전경 보기'}" aria-pressed="${panorama}" data-outside-action="panorama" ${viewpoint ? '' : 'hidden'}><kbd aria-hidden="true">Y</kbd></button>`;
        let body = '';
        if (loading) body = '<div class="resource-loading" role="status" aria-label="로딩 중"><span class="resource-loading-copy" aria-hidden="true">로딩 중<span class="resource-loading-dots"></span></span></div>';else if (loadError) body = '<section class="outside-dialog"><h2>불러오기 실패</h2><p>' + loadError + '</p>' + button('다시 시도', 'retry') + button('로비로', 'exit') + '</section>';else if (hintOpen) body = '<section class="outside-dialog outside-entry-hint" role="dialog" aria-modal="true" aria-labelledby="outside-hint-title"><kbd>P</kbd><h2 id="outside-hint-title">탐색 중에 설정을 바꿔 보세요</h2><p>P를 누르면 위치·출근길/퇴근길·일차를 변경할 수 있습니다.<br>99일차를 선택하면 QA 전용 공간으로 이동합니다.</p>' + button('확인', 'hint-close', 'primary') + '</section>';else if (showPauseMenu) body = global.LunaSettings.html({
          context: 'outside',
          onClose: () => {
            menu();
            host.focus({
              preventScroll: true
            });
          },
          exitLabel: '탐색 시작 화면으로',
          onExit: () => exit(),
          onRestart: () => {
            clearInput();
            model.start(config);
            if (wakeSpawn) model.wakeAtSofa();
            panorama = false;
            snapCamera();
            hudSignature = '';
            updateHUD();
            host.focus({
              preventScroll: true
            });
          }
        });else if (m.dialog?.kind === 'inspection') body = global.LunaOutsideInspection.html(m.dialog);else if (m.dialog && !['sofa','elevator','tv'].includes(m.dialog.kind)) body = '<section class="outside-dialog outside-object-dialog" role="dialog" aria-modal="true" aria-label="' + esc(m.dialog.title) + '"><h2>' + esc(m.dialog.title) + '</h2><p>' + esc(m.dialog.text) + '</p>' + button('닫기 · E', 'interact', 'primary') + '</section>';
        overlay.classList.toggle('is-inspection', !showPauseMenu && !hintOpen && m.dialog?.kind === 'inspection');
        overlay.innerHTML = body;
        overlay.hidden = !body;
        hud.inert = !!body || devOpen;
        if (body) overlay.querySelector('button')?.focus({
          preventScroll: true
        });
      }
      const prompt = host.querySelector('.outside-interact');
      if (prompt) prompt.hidden = !interactionTarget();
      const lookout = host.querySelector('.outside-viewpoint');
      if (lookout && viewpoint) {
        const p = position(VIEWPOINT.x, model.y + .26);
        lookout.style.left = clamp(p.x, 24, 1256) + 'px';
        lookout.style.top = clamp(p.y - 12, 42, 696) + 'px';
      }
      paintControlsTutorial();
      updateSpeech();
      paintDev();
      paintHomewardGuide();
      host.querySelector('.outside-speech').inert = devOpen;
      host.querySelectorAll('.outside-background-speech').forEach(el => el.inert = devOpen);
      let saved = host.querySelector('.outside-save-feedback');
      if (!saved) {
        saved = document.createElement('div');
        saved.className = 'outside-save-feedback';
        saved.setAttribute('role', 'status');
        saved.setAttribute('aria-live', 'polite');
        host.querySelector('.outside-stage').append(saved);
      }
      const showSaved = m.notice === '저장 완료!' && m.noticeLeft > 0;
      if (saved.textContent !== (showSaved ? m.notice : '')) saved.textContent = showSaved ? m.notice : '';
      saved.hidden = !showSaved || m.paused || devOpen;
      saved.style.opacity = Math.min(1, m.noticeLeft / .35);
    }
    function updateSpeech() {
      host.dataset.neighborhoodCinematic = String(!model.paused&&!devOpen&&!hintOpen&&!model.story.speech?.choice&&!!(model.neighborhood?.action||model.transition||model.ride||model.barArrival||model.encounter&&!model.story.speech?.line));
      const v = model.story.view();
      renderSpeech(host.querySelector('.outside-speech'), v);
      const objectKind=model.dialog?.kind;
      const choice = ['elevator','tv'].includes(objectKind) ? {
        key:model.dialog.key,label:objectKind==='tv'?'TV':'엘리베이터',
        options:[...(objectKind==='elevator'&&!model.qa&&global.LunaOutsideNeighborhood?.repaired()?[{id:'fast',label:'빠른 이동'}]:[]),{id:'confirm',label:objectKind==='tv'?'TV를 본다':model.level?'내려간다':'올라간다'},{id:'cancel',label:objectKind==='tv'?'끈다':'취소'}]
      } : model.dialog?.kind === 'sofa' ? {
        key: model.dialog.key,
        label: '소파 선택지',
        options: [{
          id: 'sleep',
          label: '휴식'
        }, {
          id: 'save',
          label: '저장'
        }, {
          id: 'cancel',
          label: '취소'
        }]
      } : v?.choice && v.purchase ? {
        ...v.purchase,
        key: v.key
      } : null;
      choiceUI?.update(choice && !model.paused && !loading && !loadError && !devOpen && !hintOpen ? {
        ...choice,
        rejectUnavailable: true,
        entryGuardMs: 500,
        head: position(model.x, model.y + .16),
        facing: model.facing
      } : null);
      const views = model.backgroundStory.views(),
        bubbles = [...host.querySelectorAll('.outside-background-speech')],
        byStory = new Map(bubbles.filter(el => el.dataset.storyId).map(el => [el.dataset.storyId, el])),
        used = new Set();
      // A distance-filtered list is not a stable identity. Keep each channel's
      // DOM, text layout and tail when another conversation enters/leaves view.
      for (const v of views) {
        const id = v.key.split(':')[0];
        let el = byStory.get(id) || bubbles.find(b => !b.dataset.storyId && !used.has(b));
        if (!el) {
          el = document.createElement('div');
          el.className = 'outside-background-speech';
          host.querySelector('.outside-stage').insertBefore(el, host.querySelector('.outside-overlay'));
        }
        el.dataset.storyId = id;
        used.add(el);
        renderSpeech(el, v, true);
      }
      for (const el of bubbles) if (!used.has(el)) {
        // Hidden active channels resume without remounting. Retain one empty
        // placeholder, but discard completed channels rather than leaking DOM.
        if (el.dataset.storyId && !model.backgroundStory.channels.has(el.dataset.storyId)) el.remove();
        else renderSpeech(el, null, true);
      }
      if (!host.querySelector('.outside-background-speech')) {
        const el = document.createElement('div');
        el.className = 'outside-background-speech';
        el.hidden = true;
        host.querySelector('.outside-stage').insertBefore(el, host.querySelector('.outside-overlay'));
      }
    }
    function renderSpeech(el, v, background = false) {
      el.hidden = !v || !v.full?.trim() || model.paused || loading || !!loadError;
      if (!v || !v.full?.trim()) {
        if (!background) el.dataset.key = '';
        return;
      }
      const key = v.key + ':' + v.canTreat;
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        el.classList.toggle('is-auto', v.auto);
        el.setAttribute('role', v.auto ? 'status' : v.choice ? 'group' : 'button');
        el.tabIndex = !v.auto && !v.choice ? 0 : -1;
        el.setAttribute('aria-label', '대화');
        el.innerHTML = global.LunaExteriorTextbox.html() + '<p></p>';
        global.LunaExteriorTextbox.mountText(el.querySelector('p'), v.full, v.emphasis || [], background);
        if (!v.auto && !v.choice && !devOpen) el.focus({
          preventScroll: true
        });
      }
      el.querySelector('p').hidden = !v.full;
      global.LunaDialogueCue.sync(el, !v.auto && !v.choice && !!v.full && v.text === v.full);
      global.LunaExteriorTextbox.revealText(el.querySelector('p'), Array.from(v.text).length);
      const p = position(v.anchor.x, v.anchor.y);
      // Ambient NPC conversations/broadcasts are secondary to player dialogue.
      // Scale the finished layout uniformly, including text, padding and art.
      // Keep the original world-space head gap and let place clamp the new size.
      const speechScale = background ? .8 : 1;
      global.LunaWorldSpeech.place(el, {
        ...p,
        scale: 4.8 / renderCam.w * speechScale,
        gap: 22 / speechScale,
        composite: background
      });
    }
    let renderBudget = 0, renderStamp = null;
    function tick(dt) {
      if (!active) return;
      notices?.update(model, loading ? 0 : dt);
      if (!loading && !loadError && !global.LunaFocusSettings.hiddenPaused && !devOpen && !hintOpen && !model.controlsTutorial) {
        const left = keys.has('KeyA') || keys.has('ArrowLeft'),
          right = keys.has('KeyD') || keys.has('ArrowRight');
        model.tick(dt, {
          move: Number(right) - Number(left),
          run: keys.has('ShiftLeft') || keys.has('ShiftRight')
        });
        if (!model.paused) {
          targetCamera(Math.min(dt, .05));
          global.LunaOutsideResidents.tickView(model, cam);
        }
      }
      // Hidden background-play still simulates, but cannot present a frame.
      // Draw at most 60 Hz on 120/144 Hz displays; input/physics keep their clock.
      if (document.hidden) { renderBudget = 0; renderStamp = null; return; }
      renderBudget += Math.max(0, dt);
      if (dt > 0 && renderBudget + .00001 < 1 / 60) return;
      renderBudget %= 1 / 60;
      const stamp = [model.time, model.scene, model.paused, cam.x, cam.y, pixelWidth, loading, loadError, devOpen, hintOpen, model.controlsTutorial, model.near?.id, model.anim, model.animTime].join('|');
      // Explicit tick(0), resize and input-triggered draws always refresh. A
      // paused scene otherwise does not rerun its unchanged GPU effects.
      if (dt === 0 || stamp !== renderStamp) { draw(); renderStamp = stamp; }
      updateHUD();
    }
    document.addEventListener('change', e => {
      const key = e.target.dataset?.outsideSetting;
      if (!key) return;
      const value = e.target.value;
      if (key === 'place' && Object.hasOwn(PLACES, value)) config.place = value;
      if (key === 'flow' && Object.hasOwn(FLOWS, value)) config.flow = value;
      if (key === 'day') config.day = Number(value) === 99 ? 99 : clamp(Number(value) || 0, 0, 3);
    }, true);
    document.addEventListener('click', e => {
      if (active && devOpen) {
        const control = e.target.closest('.outside-dev-console [data-outside-action]');
        if (control && !control.disabled) {
          e.preventDefault();
          devAction(control.dataset.outsideAction);
        }
        return;
      }
      if (active && !model.paused && !loading && !loadError && e.target.closest('.outside-speech') && !e.target.closest('button') && model.story.blocking && !model.story.speech.choice) {
        e.preventDefault();
        clearInput();
        model.story.advance();
        updateHUD();
        return;
      }
      const b = e.target.closest('[data-outside-action]');
      if (!b) return;
      const a = b.dataset.outsideAction;
      e.preventDefault();
      if (a === 'start') {
        Object.assign(config, {
          day: 0,
          flow: 'out',
          place: 'bar'
        });
        start({
          showDevHint: true
        });
        return;
      }
      if (!active) return;
      if (a === 'hint-close') dismissHint();else if (a === 'exit') exit();else if (a === 'retry') {
        exit();
        start();
      } else if (a === 'menu') menu();else if (a === 'restart') {
        clearInput();
        model.start(config);
        if (wakeSpawn) model.wakeAtSofa();
        panorama = false;
        snapCamera();
        hudSignature = '';
      } else if (a === 'bd-choice') {
        if (b.disabled) return;
        clearInput();
        model.story.choose(b.dataset.choice);
      } else if (a === 'panorama') togglePanorama();else if (a === 'interact') {
        clearInput();
        model.interact();
      }
      updateHUD();
    });
    window.addEventListener('keydown', e => {
      if (!active) return;
      if (controlsTutorialKey(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (devKey(e)) return;
      if (hintOpen && e.code !== 'Tab') {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat && ['Escape', 'Space', 'Enter', 'KeyE'].includes(e.code)) dismissHint();
        return;
      }
      if (choiceUI?.key(e)) return;
      if (e.code === 'Tab') {
        const scope = host.querySelector('.outside-overlay:not([hidden])') || (model.story.blocking ? host.querySelector('.outside-speech') : host),
          buttons = [...(scope.matches('[tabindex="0"]') ? [scope] : []), ...scope.querySelectorAll('button:not([hidden]):not(:disabled),[tabindex="0"]')].filter(b => !b.closest('[inert]') && b.getClientRects().length),
          i = buttons.indexOf(document.activeElement);
        e.preventDefault();
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        return;
      }
      if (global.lunaQA?.opened) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyY', 'Escape', 'Space'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (e.code === 'Escape' && !e.repeat) {
        if (['inspection', 'sofa', 'elevator', 'tv'].includes(model.dialog?.kind) && !model.paused) {
          clearInput();
          model.interact();
          updateHUD();
          host.focus({
            preventScroll: true
          });
        } else menu();
        return;
      }
      if (loading || loadError || model.paused) return;
      if (model.story.speech?.choice) return;
      if (e.code === 'KeyY') {
        if (!e.repeat) togglePanorama();
        return;
      }
      if ((e.code === 'KeyE' || e.code === 'Space' && model.story.blocking || e.code === 'Enter' && e.target.matches('.outside-speech[role="button"]')) && !e.repeat) {
        e.preventDefault();
        clearInput();
        if (e.code === 'KeyE') model.controlsInteractUntil = performance.now() + 180;
        model.interact();
        updateHUD();
        return;
      }
      // A held key from the ride is not a new walking command on arrival.
      if (!model.ride && !e.repeat && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) keys.add(e.code);
    }, true);
    window.addEventListener('keyup', e => {
      keys.delete(e.code);
      controlsDismissKeys.delete(e.code);
    });
    function loseFocus() {
      controlsDismissKeys.clear();
      if (!active) return;
      if (devOpen) toggleDev(false);
      clearInput();
      if (global.LunaFocusSettings.enabled && !loading && !loadError) {
        model.paused = true;
        updateHUD();
      }
    }
    window.addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) loseFocus();
    });
    window.addEventListener('resize', fit);
    function snapshot(view = null) {
      if (!ctx || loading || loadError) return null;
      const oldCam = cam,
        oldScene = model.scene,
        oldPixelWidth = pixelWidth;
      try {
        if (view) {
          cam = {
            ...view
          };
          pixelWidth = global.LunaPixelCamera.settledWidth(cam.w, surface);
          model.scene = 'street';
        }
        draw(false);
        return canvas.toDataURL('image/png');
      } finally {
        cam = oldCam;
        model.scene = oldScene;
        pixelWidth = oldPixelWidth;
        draw(false);
      }
    }
    return {
      get interactionGlow() {
        return glowRenderer.snapshot();
      },
      get discoveryMarkers() {
        return discoveryMarkers;
      },
      get active() {
        return active;
      },
      get devConsoleOpen() {
        return devOpen;
      },
      get model() {
        return model;
      },
      get loading() {
        return loading;
      },
      get loadError() {
        return loadError;
      },
      get camera() {
        return {
          ...cam
        };
      },
      get renderCamera() {
        return {
          ...renderCam
        };
      },
      get pixelSurface() {
        return {
          ...surface
        };
      },
      config,
      lobbyHTML,
      start,
      exit,
      advanceDay,
      showControlsTutorial,
      controlsTutorialKey,
      notifyItem: (m, id) => active && m === model && notices?.add(m, id),
      tick,
      clearInput,
      snapshot,
      snapCamera,
      openDev: () => toggleDev(true),
      devAction,
      refreshHUD: updateHUD
    };
  }
    return create;
  }
  if (typeof module !== 'undefined') module.exports = create;
  (root.LunaOutsideParts ||= {}).view = create;
})(typeof window === 'undefined' ? globalThis : window);
