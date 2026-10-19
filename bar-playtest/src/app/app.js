(function () {
  'use strict';

  const bgm = window.barBgm = new window.LunaBarBgm();
  const C = window.LunaCore,
    D = C.millilitreData(window.LUNA_DATA),
    g = new C.Game(D),
    root = document.querySelector('#app');
  const remix = window.LunaRemix.attach(g);
  const mini = window.LunaMinigames.attach(g);
  window.barGame = g;
  window.barData = D;
  const siteHome = /\/bar-playtest\/(?:index\.html)?$/.test(location.pathname);
  try {
    g.read = new Set(JSON.parse(localStorage.getItem('luna.bar.playtest.read.v1') || '[]'));
  } catch {}
  const ui = {
    serviceVersion: 'A',
    outside: false,
    minigames: false,
    variant: 'original',
    difficulty: 'standard',
    assist: true,
    remixFilter: 'all',
    remixAudio: true,
    gimmickAudio: true,
    shakeSound: 1,
    stirSound: 1,
    pourPresentation: 'classic',
    day: 0,
    mode: 'full',
    seed: 1,
    upkeep: '',
    shelfPage: 0,
    hoverItem: null,
    tab: 'glass',
    peek: null,
    inspector: false,
    dossier: 'chris',
    dossierDetail: null,
    dossierPreview: null,
    dossierTestActor: 'chris',
    sound: false,
    auto: false,
    readSkip: false,
    drag: null,
    lastEffect: null
  };
  // Reset the previous default once; subsequent explicit choices remain persistent.
  try {
    const mode = localStorage.getItem('luna.shake.mode.v2');
    ui.shakeMode = window.LunaShakeRhythm.normalizeMode(mode);
  } catch {
    ui.shakeMode = 'path';
  }
  const shakeRhythm = window.LunaShakeRhythm.attach(g, () => ui.shakeMode);
  const mixTutorial = window.LunaMixTutorial.attach(g);
  try {
    ui.shakeSound = localStorage.getItem('luna.shake.sound.v2') === '2' ? 2 : 1;
  } catch {}
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
  const L = (ko, en) => g.lang === 'ko' ? ko : en;
  const fmt = n => Math.round(n).toLocaleString();
  const phase = () => ({
    ready: L('플레이테스트 준비', 'Playtest setup'),
    opening: L('개점 전 대화', 'Before opening'),
    general: L('일반 손님 영업', 'General guest service'),
    regular: L('단골 손님 영업', 'Regular guest service'),
    practice: L('제조 연습', 'Craft practice'),
    complete: L('영업 정산', 'Daily settlement'),
    gameover: L('게임오버', 'Game over')
  })[g.phase];
  const a = key => D.assets[key]?.src;
  const button = (label, act, more = '', cls = '') => `<button class="${cls}" data-act="${act}" ${more}>${label}</button>`;
  const pourView = window.LunaPourView({
    g,
    D,
    L,
    esc,
    button,
    ui
  });
  try {
    const mode = localStorage.getItem('luna.pour.presentation.v1');
    if (['classic', 'clean', 'bottle'].includes(mode)) ui.pourPresentation = mode;
  } catch {}
  const tutorialView = window.LunaDay0Tutorial({
    g,
    ui,
    L
  });
  const openView = window.LunaOpenView({
    g,
    D,
    L,
    esc,
    button,
    ui
  });
  const shakePolish = window.LunaShakePolish({
    g,
    D,
    ui
  });
  const stirPolish = window.LunaStirPolish({
    g,
    ui
  });
  try {
    ui.stirSound = localStorage.getItem('luna.stir.sound.v1') === '2' ? 2 : 1;
  } catch {}
  const money = n => `${fmt(n)} G`;
  const labelType = t => ({
    pour: L('따르기', 'Pour'),
    fill_up: L('필업', 'Fill-up'),
    open: L('병따기', 'Open'),
    shake: L('쉐이킹', 'Shake'),
    stir: L('스터', 'Stir'),
    add: L('넣기', 'Add'),
    squeeze: L('스퀴즈', 'Squeeze'),
    powder: L('파우더', 'Powder')
  })[t] || t;
  function itemArt(id, cls = '', usage = 'shelf') {
    const label = id === 'opener' ? L('병따개', 'Bottle opener') : g.name(id);
    const key = (usage === 'recipe' && a('recipe_item_' + id) ? 'recipe_item_' : usage === 'inventory' && a('inventory_item_' + id) ? 'inventory_item_' : 'item_') + id;
    return '<img class="' + cls + '" src="' + (a(key) || a('item_dummy')) + '" alt="' + esc(label) + '" draggable="false">';
  }
  function drinkArt(id, usage = 'hero') {
    const c = g.cocktail(id),
      key = usage === 'table' ? 'table_cocktail_' + id : usage === 'recipe' ? 'recipe_cocktail_' + id : 'cocktail_' + id;
    const src = a(key) || a('cocktail_' + id) || a('recipe_cocktail_' + id) || a('item_' + c.glass);
    return '<img class="drink-art" src="' + src + '" data-art-usage="' + usage + '" alt="' + esc(g.name(id)) + '" draggable="false">';
  }
  function layers(actor, expression, talking) {
    const states = D.characterLayers[actor];
    if (!states) return null;
    let state = expression || 'idle';
    if (state === 'default') state = 'idle';
    const keys = Object.keys(states);
    let key = keys.find(k => k.toLowerCase().endsWith(state.toLowerCase() + '_' + (talking ? 'talk' : 'default'))) || keys.find(k => k.endsWith('idle_' + (talking ? 'talk' : 'default'))) || keys.find(k => k.endsWith('idle_default')) || keys[0];
    return states[key];
  }
  function actorHTML(guest, x) {
    return views.actorHTML(guest, x);
  }
  function tagged(raw, count) {
    let used = 0,
      html = '',
      stack = [];
    const parts = String(raw).split(/(<\/?[a-z]+>)/g);
    for (const p of parts) {
      const m = p.match(/^<(\/?)([a-z]+)>$/);
      if (m) {
        const tag = D.tables.text_tags.find(t => t.tag === m[2]);
        if (!tag) continue;
        if (m[1]) {
          if (stack.length) {
            html += '</span>';
            stack.pop();
          }
        } else {
          html += `<span style="${tag.kind === 'color' ? 'color:' + tag.value : tag.kind === 'size_pct' ? 'font-size:' + tag.value + '%' : ''}">`;
          stack.push(m[2]);
        }
      } else {
        const n = Math.max(0, Math.floor(count) - used);
        html += esc(p.slice(0, n));
        used += p.length;
      }
    }
    return html + '</span>'.repeat(stack.length);
  }
  function storyCraftReminder() {
    return ['regular', 'opening'].includes(g.phase) && g.screen === 'bar' && g.currentOrder && !g.drink && !g.dialogue && !g.choice && g.story?.steps[g.story.index]?.type === 'craft' && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 ? g.craftReminder : null;
  }
  function dialogueHTML() {
    if (ui.drag) return '';
    const reminder = storyCraftReminder(),
      d = g.currentDialogue() || (g.phase === 'general' ? g.seats[g.focus]?.lines?.[g.seats[g.focus]?.lineIndex] : g.dialogue) || reminder;
    if (!d) return '';
    const interactive = g.phase !== 'general' && !reminder && !g.storyCoaster,
      player = d.actor === 'luna';
    const speaker = player ? L('루나', 'Luna') : g.phase === 'general' && g.seats[g.focus]?.appearance ? L('손님', 'Guest') : g.speakerName(d.actor);
    return `<div class="dialogue-wrap ${player ? 'player-speech' : 'guest-speech'} ${interactive ? '' : 'auto-bubble'}" ${views.dialogueAnchor(d.actor, d)}><div class="dialogue-box" ${interactive ? 'data-act="advance" role="button" tabindex="0"' : ''}><span class="dialogue-surface" aria-hidden="true"></span><div class="speaker">${esc(speaker)}</div><div class="dialogue-text"><span class="text-measure" aria-hidden="true">${tagged(d.raw || d.text, d.text.length) || '…'}</span><span class="text-ink">${tagged(d.raw || d.text, d.chars)}</span></div>${window.LunaDialogueCue.html(interactive && !g.choice && d.chars >= d.text.length)}</div></div>`;
  }
  const currencyView = window.LunaCurrencyView();
  const reducedMoneyMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Pixel-style UI icon, independent of platform emoji fonts and gameplay data.
  function currencyHTML() {
    return window.LunaCurrencyView.html(currencyView.update(g.progress, 0, g.hidden), g.progress, {
      lang: g.lang,
      reducedMotion: reducedMoneyMotion.matches
    });
  }
  function originalServiceTipHTML() {
    if (remix.active() || g.minigame || g.phase !== 'general' || g.screen !== 'bar' || g.finished || g.isPaused()) return '';
    const guest = g.seats[g.focus];
    let text = '';
    if (guest?.state === 'WAIT_COASTER') text = L('코스터를 집어 손님 앞으로 드래그하세요', 'Drag a coaster onto the table in front of the guest');else if (guest?.state === 'WAIT_SERVE' && guest.order) text = g.drink ? L('완성된 칵테일을 손님의 코스터에 놓으세요', 'Place the finished cocktail on the guest’s coaster') : L('서비스 패널 - 칵테일 레시피 보기를 누르세요', 'Service panel - select Cocktail recipes');
    return text ? '<div class="remix-context original-service-tip"><span>' + esc(text) + '</span></div>' : '';
  }
  function worldHTML() {
    return views.worldHTML();
  }
  // Simulator-only shortcut. Keep the normal craft/serve pipeline and its story effects.
  function canSkipStoryCraft() {
    return campaign?.view === 'developer' && !campaign.active && !campaign.blocking && !outside.active && !g.minigame && g.phase === 'regular' && g.screen === 'bar' && !!g.currentOrder && g.story?.steps[g.story.index]?.type === 'craft' && !g.drink && !g.dialogue && !g.choice && !g.isPaused() && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 && (!g.tutorial || g.tutorial.kind === 'recipe');
  }
  function skipStoryCraft() {
    if (!canSkipStoryCraft()) return false;
    const order = {
      ...g.currentOrder
    };
    clearControlSkip();
    ui.auto = false;
    if (g.tutorial?.kind === 'recipe') {
      g.tutorial = null;
      g.progress.flags.day0_recipe_taught = true;
      g.progress.flags.day0_pour_taught = true;
      g.log('tutorial_complete', {
        kind: 'recipe',
        skipped: true
      });
    }
    if (!g.openRecipes() || !g.selectCocktail(order.cocktail)) throw Error('테스트 주문의 레시피를 선택할 수 없습니다.');
    g.debugCraft('good');
    if (g.error) throw Error(g.error);
    if (g.remix) g.remix.resultLock = 0;
    g.offer();
    if (!g.serve(order.seat, 'keyboard')) throw Error('테스트 주문을 제공하지 못했습니다.');
    g.log('debug_skip_story_craft', {
      orderId: order.id,
      actor: order.actor,
      cocktail: order.cocktail,
      grade: 'good'
    });
    ui.hoverItem = null;
    ui.recipeOpen = false;
    ui.drag = null;
    toast(L('제조를 건너뛰고 정상 제공으로 처리했습니다.', 'Crafting skipped; drink served successfully.'));
    return true;
  }
  function skipStoryCraftHTML() {
    return canSkipStoryCraft() ? button(L('제조 스킵하기', 'Skip crafting'), 'skipStoryCraft', 'title="' + L('개발자 테스트 · 주문한 칵테일을 정상 제공 처리', 'Developer test · serve the ordered drink successfully') + '"', 'dev-craft-skip') : '';
  }
  function barHTML() {
    const guest = g.seats[g.focus],
      canCoaster = g.storyCoasterReady() || g.tutorial?.kind === 'coaster' || g.phase === 'general' && guest?.state === 'WAIT_COASTER';
    return worldHTML() + skipStoryCraftHTML() + `<div class="hud-right">${g.currentOrder ? `<span class="badge">${esc(g.speakerName(g.currentOrder.actor))} · ${esc(g.currentOrder.freeChoice ? L('자유 주문', 'Your choice') : g.name(g.currentOrder.cocktail))}</span>` : ''}</div>${g.screen === 'bar' ? dialogueHTML() : ''}${g.choice && g.screen === 'bar' && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 ? `<div class="choices">${g.choice.rows.map(c => {
      const ok = C.condition(c.when, g.ctx());
      return button(`<span class="choice-progress" aria-hidden="true"><i></i></span><span class="title-label choice-label" data-text="${esc(g.text(c))}">${esc(g.text(c))}</span>${!ok ? `<small>${esc(g.text(c, 'lock_reason'))}</small>` : ''}`, 'choice', `data-id="${c.seq}" ${ok ? '' : 'disabled'}`);
    }).join('')}</div>` : ''}${(g.phase === 'general' || g.tutorial?.kind === 'coaster' || g.storyCoasterReady() || g.currentOrder) && g.screen === 'bar' ? `<div class="stack service-popup draggable" ${canCoaster ? 'data-drag="coaster"' : ''} role="button" tabindex="${canCoaster ? 0 : -1}" aria-disabled="${!canCoaster}" aria-label="코스터 제공">${canCoaster && !ui.drag && !g.cameraMoving && !g.cameraLeft && !g.transition ? '<svg class="coaster-pickup-arrow" viewBox="0 0 40 48" aria-hidden="true"><path d="M12 2H28V23H38L20 45L2 23H12Z"/></svg>' : ''}<img src="${a('coaster')}" draggable="false" alt="코스터 묶음"><small><span>${L('코스터 드래그', 'Drag coaster')}</span></small></div>${guest?.state === 'WAIT_SERVE' && !g.drink ? `<div class="tray">${button('<span>' + L('주문 되묻기', 'Ask again') + '</span><kbd>E</kbd>', 'reask', guest.reasking ? 'disabled' : '')}</div>` : ''}` : ''}${g.drink && g.screen === 'bar' ? `<div class="tray drink-tray service-popup draggable${ui.drag === 'drink' ? ' is-dragging' : ''}" data-drag="drink" role="button" tabindex="0" aria-label="완성 칵테일 드래그">${drinkArt(g.drink.selected)}<div class="drink-tray-info"><h3>${esc(g.name(g.drink.selected))}</h3><small>${L('코스터로 드래그', 'Drag onto the coaster')}</small></div></div>` : ''}${!g.tutorial && g.currentOrder && g.screen === 'bar' && !g.drink && !g.dialogue && !g.choice && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 ? `<div class="center-hint story-craft-prompt">${button(L('레시피를 열어 제조하기', 'Open recipes to craft'), 'recipes', g.isPaused() ? 'disabled' : '', 'primary')}</div>` : ''}`;
  }
  function upkeepInputHTML() {
    const row = D.tables.days.find(d => Number(d.day) === ui.day),
      base = row?.upkeep_gold ?? 0;
    return `<div class="upkeep-setup"><label for="upkeep-test">${L('유지비 테스트값', 'Upkeep test override')} <small>${L('선택', 'optional')}</small></label><div class="row"><input id="upkeep-test" type="number" min="0" step="1" inputmode="numeric" data-input="upkeep" value="${esc(ui.upkeep)}" placeholder="${L('기본값', 'Default')} ${base}" aria-label="유지비 테스트값"><span>G</span></div><small>${L('빈칸이면 일차 데이터 사용. 원본은 변경하지 않습니다.', 'Blank uses day data. Source data stays unchanged.')}</small></div>`;
  }
  function startHTML() {
    if (ui.cutscenes) return window.LunaCutsceneLibrary.html(remixUI.tabsHTML());
    if (ui.outside) return outside.lobbyHTML(remixUI.tabsHTML());
    if (ui.minigames) return miniUI.lobbyHTML();
    if (ui.variant === 'gpt') return remixUI.startHTML();
    const notes = {
      0: L('크리스의 바텐더 튜토리얼 → 포트 첫 주문. 일반 손님 영업은 건너뜁니다.', 'Chris’s tutorial → Port’s first order. No general guest service.'),
      1: L('개점 대화 → 일반 손님 → 톰·아일리 주문과 조니의 술 복원 부탁 → 매출 정산.', 'Opening → general guests → Tom and Aili → restoration request → settlement.'),
      2: L('삼호에게 칵테일 추천 → 포트의 기억 칩 전달 → 크리스·포트 대화. 조니 회상은 귀가 후 수면·테라스에서 진행.', 'Recommend a drink to Samho → Port delivers the chip → Chris and Port talk. Johnny’s memory plays on the terrace after choosing sleep at home.'),
      3: L('아일리의 각설탕 전달 → 톰·삼호 대화와 올드 패션드 제조 → 퇴근 후 테라스·유나 회상.', 'Aili delivers sugar → Tom and Samho meet over an Old Fashioned → terrace conversation and Yuna flashback after work.'),
      99: L('분기·태그·좌석·동시 입장·재제조 테스트. 모든 재료와 칵테일이 해금됩니다.', 'QA branches, tags, seats, paired entrance and retries. All recipes unlocked.')
    };
    return `<div class="start-screen">${remixUI.tabsHTML()}<div class="start-card"><h2 style="margin:15px 0 5px">${L('영업 설정', 'Session setup')}</h2><div class="day-list">${[0, 1, 2, 3, 99].map(day => button(day === 99 ? 'QA 99' : L(day + '일차', 'Day ' + day), 'day', `data-id="${day}"`, ui.day === day ? 'selected' : '')).join('')}</div><p class="start-note">${notes[ui.day]}</p>${upkeepInputHTML()}<label for="start-mode">${L('시작 구간', 'Start at')}</label><select id="start-mode" data-change="mode"><option value="full" ${ui.mode === 'full' ? 'selected' : ''}>${L('바 내부 전체 흐름', 'Full bar flow')}</option><option value="general" ${ui.mode === 'general' ? 'selected' : ''}>${L('일반 손님 영업부터', 'General guest service')}</option><option value="regular" ${ui.mode === 'regular' ? 'selected' : ''}>${L('단골 손님 영업부터', 'Regular guest service')}</option><option value="practice" ${ui.mode === 'practice' ? 'selected' : ''}>${L('칵테일 제조 연습', 'Craft practice')}</option></select>${button(L('영업 시작 →', 'Open the bar →'), 'start', '', 'primary')}<div class="spacer"></div><div class="row spread"><small><kbd>F2</kbd> ${L('테스트 도구', 'Test tools')}</small>${button(L('조작 안내', 'Controls'), 'help', '', 'subtle')}</div></div></div>`;
  }
  function recipeLines(c) {
    return `<ul class="recipe-lines">${g.t.recipes.filter(r => r.context === c.id).map(r => `<li><span>${esc(g.name(r.ingredient))}</span><small>${r.qty ?? '—'} ${r.unit ?? ''} · ${labelType(r.action)}</small></li>`).join('')}</ul><div class="recipe-note">${L('잔', 'Glass')}: ${esc(g.name(c.glass))}<br>${L('제조 방법', 'Method')}: ${c.mix} ${c.mix === 'build' ? L('· 별도 믹스 도구 없음', '· no mixing tool') : ''}<br>${L('제한 시간', 'Time limit')}: ${c.time_limit_sec}s</div>`;
  }
  function recipesHTML() {
    if (remix.active()) return remixUI.recipesHTML();
    const available = g.cocktailsAvailable(),
      unlockedIds = new Set(available.map(c => c.id)),
      all = g.t.cocktails.slice().sort((a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id)) || (unlockedIds.has(a.id) ? String(a['name.ko'] || a.id).localeCompare(String(b['name.ko'] || b.id), 'ko') : 0));
    const peek = g.t.cocktails.find(c => c.id === ui.peek);
    return `<aside class="side-panel resource-recipe-list"><div class="panel-header"><div class="row spread"><h2>${L('칵테일 레시피', 'Recipe book')}</h2>${resourceClose('closeRecipe', 'recipe_choice')}</div><small>※ ${L('레시피를 고르면 재료 담기로 이동합니다.', 'Choose a recipe to prepare ingredients.')}</small></div><div class="recipe-list">${all.map(c => {
      const ok = available.some(x => x.id === c.id);
      return `<button class="recipe-card ${ok ? '' : 'locked'}" data-act="selectRecipe" data-id="${c.id}" data-hover-recipe="${c.id}" ${ok ? '' : 'disabled'}>${drinkArt(c.id)}<div><strong>${ok ? esc(g.text(c, 'name')) : '???'}</strong><small>${ok ? `${c.mix.toUpperCase()} · ${money(c.price)}` : c.id === 'johnny_old_fashioned' ? L('기억과 재료를 모두 모으면 해금', 'Unlock through memories and ingredients') : L(c.unlock_day + '일차 해금', 'Day ' + c.unlock_day + ' unlock')}</small></div><span class="recipe-lock-mark">${ok ? '' : '◇'}</span></button>`;
    }).join('')}</div></aside>${peek && available.includes(peek) ? views.recipePanel(peek, {
      preview: true
    }) : ''}`;
  }
  function prepHTML() {
    return views.prepHTML();
  }
  function gimmickHTML() {
    const s = g.gimmick;
    if (!s) return '';
    if (s.fluid) return pourView.html(s);
    if (s.type === 'open') return openView.html(s);
    if (['stir', 'shake'].includes(s.type)) return views.mixHTML(s) + mixTutorial.html(L);
    return '<div class="craft-screen"><p class="critical">' + L('지원하지 않는 기믹: ', 'Unsupported gimmick: ') + esc(s.type) + '</p></div>';
  }
  function resultHTML() {
    return serveView.html();
  }
  function totalsHTML() {
    const t = g.totals();
    return `<div class="totals">${[['sale', L('판매', 'Sales')], ['tip', L('팁', 'Tips')], ['refund', remix.active() ? L('배상', 'Compensation') : L('환불', 'Refunds')], ['net', L('합계', 'Net')]].map(([k, v]) => `<div><small>${v}</small><strong>${fmt(t[k])}</strong></div>`).join('')}</div>`;
  }
  function salesHTML() {
    return `<div class="sales-balance"><span>${L('현재 소지금', 'Current balance')}</span><strong>${money(g.progress.money)}</strong></div>` + totalsHTML() + `<div class="table-scroll"><table class="data-table"><thead><tr><th>${L('제공한 칵테일', 'Drink')}</th><th>${L('최종 등급', 'Final grade')}</th><th>${L('합계', 'Net')}</th></tr></thead><tbody>${g.transactions.map(t => `<tr><td>${esc(g.name(t.served))}</td><td>${t.grade.toUpperCase()}${!t.match ? ' · ' + L('주문 불일치', 'Wrong order') : ''}</td><td>${money(t.net)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${L('아직 정산된 주문이 없습니다.', 'No settled orders yet.')}</td></tr>`}</tbody></table></div>`;
  }
  function modal(title, body, wide = false, close = true) {
    return `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}"><div class="modal-title"><h2>${title}</h2>${close ? button('×', 'closeOverlay') : ''}</div>${body}</section></div>`;
  }
  // Explicit web adapters only. These do not define or rewrite the production CSV contract.
  const DOSSIER_ROSTER = window.LunaStoryNotices.roster;
  const DOSSIER_MET_FLAGS = {
    chris: 'chris_met',
    port: 'port_met',
    aili: 'aili_met',
    bubi: 'bubi_met',
    shiba: 'shiba_met',
    samho: 'samho_met',
    tom: 'tom_met'
  };
  function dossierState(id) {
    const preview = ui.dossierPreview?.id === id ? ui.dossierPreview.stage : null;
    // Real encounter flags unlock profiles; inspector previews never create meetings.
    const met = preview !== null ? preview > 0 : !!g.progress.flags[DOSSIER_MET_FLAGS[id]];
    const character = g.t.characters.find(c => c.id === id),
      aff = Number(g.progress.affinity[id] || 0);
    // Shiba's affinity feature is unconfirmed: live mode exposes stage 1 only.
    const stage = preview !== null ? preview : !met ? 0 : character?.affinity === false ? 1 : aff >= 30 ? 3 : aff >= 10 ? 2 : 1;
    return {
      met,
      stage,
      preview: preview !== null
    };
  }
  function dossierPortrait(id) {
    const keys = layers(id, 'idle', false),
      sample = keys?.length ? D.assets[keys[0]] : null;
    const fw = sample ? sample.frameWidth || sample.w / (sample.frames || 1) : 1,
      fh = sample?.h || 1;
    const boxes = (keys || []).map(k => D.assets[k].alphaBBox).filter(b => b?.length === 4);
    // Frame-space bounds remove transparent sprite margins without modifying source art.
    const x = boxes.length ? Math.min(...boxes.map(b => b[0])) : 0,
      y = boxes.length ? Math.min(...boxes.map(b => b[1])) : 0;
    const w = boxes.length ? Math.max(...boxes.map(b => b[2])) - x : fw,
      h = boxes.length ? Math.max(...boxes.map(b => b[3])) - y : fh;
    return '<div class="dossier-portrait" role="img" aria-label="' + esc(g.name(id)) + '"><div class="portrait-canvas ' + (sample ? 'portrait-cropped' : '') + '" style="--portrait-ratio:' + w / h + ';aspect-ratio:' + w + '/' + h + '">' + (keys?.length ? keys.map(k => {
      const v = D.assets[k];
      return '<span style="inset:auto;left:' + -x / w * 100 + '%;top:' + -y / h * 100 + '%;width:' + fw / w * 100 + '%;height:' + fh / h * 100 + '%;background-image:url(' + v.src + ');background-size:' + (v.frames || 1) * 100 + '% 100%"></span>';
    }).join('') : '<div class="portrait-placeholder"><span>◇</span><small>' + L('프로필 이미지 준비 중', 'Portrait pending') + '</small></div>') + '</div></div>';
  }
  function affinityBar(stage) {
    return '<div class="affinity-bar" role="img" aria-label="' + L('호감도 ' + stage + '단계', 'Affinity stage ' + stage) + '">' + [1, 2, 3].map(n => '<i class="' + (n <= stage ? 'filled' : '') + '"></i>').join('') + '</div>';
  }
  function dossierSection(ko, en, unlocked, content) {
    return '<section class="profile-section ' + (unlocked ? '' : 'locked') + '"><h3>' + L(ko, en) + '</h3>' + (unlocked ? content : '<div class="profile-locked" aria-label="' + L('미해금 정보', 'Locked information') + '">???</div>') + '</section>';
  }
  function dossierDetailHTML(id) {
    const {
        stage
      } = dossierState(id),
      pending = '<p class="profile-pending">' + L('원고 연결 대기', 'Copy not connected yet') + '</p>';
    const basic = '<dl class="profile-facts">' + [['나이', 'Age'], ['신체', 'Height / weight'], ['직업', 'Occupation'], ['거주지', 'Residence']].map(([ko, en]) => '<div><dt>' + L(ko, en) + '</dt><dd>—</dd></div>').join('') + '</dl>';
    return '<div class="dossier-detail-backdrop"><section class="dossier-detail" role="dialog" aria-modal="true" aria-labelledby="profile-name"><aside class="profile-left">' + dossierPortrait(id) + '<div class="profile-affinity"><span>' + L('호감도', 'Affinity') + '</span>' + affinityBar(stage) + '</div></aside><div class="profile-right"><header><small class="profile-english-name">' + esc(g.t.characters.find(c => c.id === id)?.['name.en'] || id.toUpperCase()) + '</small><h2 id="profile-name">' + esc(g.name(id)) + '</h2>' + profileClose(true) + '</header><div class="profile-body" tabindex="0">' + dossierSection('기본 정보', 'Basic information', true, basic) + dossierSection('루나에 대한 생각', 'Thoughts about Luna', true, pending) + dossierSection('좋아하는 칵테일', 'Favorite cocktail', stage >= 2, pending) + dossierSection('관찰 내용', 'Observations', true, '<p class="profile-pending" data-observation-stage="' + stage + '">' + L('관찰 ' + stage + ' 원고 연결 대기', 'Stage ' + stage + ' observation not connected yet') + '</p>') + dossierSection('과거사', 'Background', stage >= 3, pending) + '<p class="profile-data-note">' + L('새 UI 항목과 기존 수첩 원고의 대응은 아직 미확정입니다. 인물 설정을 임의로 채우지 않았습니다.', 'The new UI fields have not been mapped to existing dossier copy. Character details have not been invented.') + '</p></div></div></section></div>';
  }
  function profileClose(detail) {
    const folder = 'assets/ui/profile/' + (detail ? 'profile_window/' : '');
    return button('<img src="' + folder + (detail ? 'BTN_profile_window_close.png' : 'BTN_profile_close.png') + '" alt=""><img class="profile-esc" src="' + folder + 'IMG_ESC.png" alt="Esc">', 'dossierBack', 'aria-label="' + (detail ? L('목록으로', 'Back to list') : L('닫기', 'Close')) + '"', 'profile-close');
  }
  function dossierHTML() {
    const detail = ui.dossierDetail && dossierState(ui.dossierDetail).met ? ui.dossierDetail : null;
    return '<section class="dossier-screen resource-profile" data-language="' + g.lang + '" role="dialog" aria-modal="true" aria-labelledby="dossier-title"><div class="dossier-list-shell" ' + (detail ? 'inert aria-hidden="true"' : '') + '><header class="dossier-header"><div class="dossier-heading"><h2 id="dossier-title">' + L('인물 정보', 'Guest profiles') + '</h2><img class="profile-title-art" src="assets/ui/profile/IMG_title_profile.png" alt="" aria-hidden="true"></div>' + profileClose(false) + '</header><div class="dossier-list-scroll" tabindex="0"><div class="dossier-grid">' + DOSSIER_ROSTER.map(id => {
      const st = dossierState(id);
      return '<button class="guest-card ' + (!st.met ? 'unmet' : ui.dossier === id ? 'selected' : '') + '" data-act="dossier" data-id="' + id + '" ' + (!st.met ? 'disabled aria-label="' + L('아직 만나지 않은 손님', 'Guest not yet met') + '"' : 'aria-label="' + esc(g.name(id)) + '"') + '>' + (st.met ? dossierPortrait(id) + '<div class="guest-card-caption"><span>' + esc(g.name(id)) + '</span>' + affinityBar(st.stage) + '</div>' : '<div class="profile-silhouette" aria-hidden="true">' + dossierPortrait('chris') + '</div><img class="profile-unknown-icon" src="assets/ui/profile/IMG_card_A_icon.png" alt="" aria-hidden="true">') + '</button>';
    }).join('') + '</div></div><footer class="dossier-footer"><p>' + L('인물을 선택하면 자세한 정보를 확인할 수 있습니다.', 'Select a guest to view their details.') + '</p></footer></div>' + (ui.dossierPreview ? '<div class="dossier-preview-badge">' + L('UI 상태 미리보기 · 진행 데이터 변경 없음', 'UI preview · progress is unchanged') + '</div>' : '') + (detail ? dossierDetailHTML(detail) : '') + '</section>';
  }
  function dossierInspectorHTML() {
    return '<label>' + L('단골 정보 UI 검수', 'Guest profile UI test') + '</label><select data-change="dossierTestActor">' + DOSSIER_ROSTER.map(id => '<option value="' + id + '" ' + (ui.dossierTestActor === id ? 'selected' : '') + '>' + esc(g.name(id)) + '</option>').join('') + '</select><div class="row wrap">' + [0, 1, 2, 3].map(stage => button(stage ? L(stage + '단계', 'Stage ' + stage) : L('미만남', 'Unmet'), 'dossierPreview', 'data-id="' + stage + '"')).join('') + '</div>' + button(L('실제 진행 상태로 보기', 'Use live progress'), 'dossierLive') + '<small>' + L('미리보기는 플래그·호감도를 바꾸지 않습니다. 원고 매핑·시바의 추가 단계·호감도 하락 시 재잠금은 미확정입니다.', 'Preview never changes flags or affinity. Copy mapping, Shiba’s higher stages and re-locking policy remain unconfirmed.') + '</small>';
  }
  function dossierBack() {
    if (ui.dossierDetail) {
      const id = ui.dossierDetail;
      ui.dossierDetail = null;
      render(true);
      root.querySelector('.guest-card[data-id="' + id + '"]')?.focus({
        preventScroll: true
      });
    } else {
      g.overlay = null;
      ui.dossierPreview = null;
      render(true);
      root.querySelector('[data-act="service"]')?.focus({
        preventScroll: true
      });
    }
  }
  function helpHTML() {
    return `<div class="help-grid"><section><h3>${L('일반 손님 영업', 'General guests')}</h3><p><kbd>A</kbd> <kbd>D</kbd> / ← → ${L('좌석 이동', 'Move seats')}</p><p>${L('오른쪽 아래 코스터를 집어 현재 보고 있는 손님 앞으로 드래그하세요.', 'Drag the coaster from the lower right onto the table in front of the focused guest.')}</p><p><kbd>E</kbd> ${L('코스터 보조 제공 / 제공 후 주문 되묻기 · 인내심 10% 차감', 'Coaster shortcut / after ordering, ask again · patience −10%')}</p><p>${L('대사는 현재 보고 있는 좌석에서 자동 진행됩니다.', 'Barks advance automatically at the focused seat.')}</p></section><section><h3>${L('단골 손님 영업', 'Regular guests')}</h3><p><kbd>Enter</kbd> / <kbd>Space</kbd> ${L('다음 대사', 'Next dialogue')}</p><p><kbd>Ctrl</kbd> ${L('누르고 있는 동안 빠르게 넘기기 · 선택지·제조에서는 멈춤', 'Hold to fast-forward, including unread dialogue · stops at choices and crafting')}</p><p>${L('첫 대사 뒤 코스터를 손님 앞으로 드래그하면 다음 대사가 이어집니다.', 'After the greeting, drag a coaster to the guest to continue.')}</p><p><kbd>E</kbd> ${L('코스터 보조 제공', 'Coaster keyboard shortcut')}</p><p>${L('선택지는 ↑/↓ 이동, Enter/Space 또는 마우스 버튼을 0.5초간 눌러 확정. 제조는 화면 버튼을 사용합니다.', 'Choices: ↑/↓ to move; hold Enter/Space or the mouse button for 0.5 seconds to confirm. Use on-screen buttons for crafting.')}</p></section><section><h3>${L('제조·제공', 'Craft and serve')}</h3><p>${L('레시피 → 잔·도구·재료 → 기믹 → 제공하기 → 잔을 코스터로 드래그', 'Recipe → glass / tool / ingredients → gimmicks → offer → drag onto a coaster')}</p><p>${L('빌드는 도구를 선택하지 않습니다. 메뉴·제조 중에는 바 시간이 멈춥니다.', 'Build uses no mixing tool. Menus and crafting pause bar time.')}</p></section><section><h3>${L('메뉴·테스트', 'Menus and testing')}</h3><p><kbd>Tab</kbd> ${L('왼쪽 서비스 패널 · 레시피 / 매출 / 단골 정보', 'Left service panel · recipes / sales / guest profiles')}</p><p><kbd>F2</kbd> ${L('상태·타이머·분기·로그 확인', 'Inspect state, timers, branches and logs')}</p><p><kbd>Y</kbd> ${L('대사 기록 열기 / 닫기', 'Open / close dialogue history')}</p><p><kbd>Esc</kbd> ${L('옵션 · 일시정지 / 열린 메뉴 닫기', 'Options · pause / close the open menu')}</p><p>${L('F2 안의 정답 채우기·등급 강제는 검수 전용입니다.', 'Recipe fill and grade overrides in F2 are testing tools only.')}</p></section></div><div class="divider"></div><p class="recipe-note">${L('실제 CSV의 0·1·99일차 대본을 사용합니다. 2·3일차의 비어 있는 대본은 만들어 넣지 않았습니다. 일부 그래픽과 효과음은 더미이며, 쉐이킹은 브라우저용 타이밍 조작으로 재현했습니다.', 'Uses the actual Day 0, 1 and 99 scripts. Empty Day 2/3 scripts are not invented. Missing artwork/audio uses placeholders; shaking uses a browser timing interaction.')}</p>`;
  }
  function resourceClose(action, group) {
    const filename = group === 'recipe_choice' ? 'BTN_recipe_choice_close.png' : 'BTN_service_close.png';
    return button(`<img src="assets/ui/${group}/${filename}" alt=""><img class="resource-esc" src="assets/ui/${group}/IMG_ESC.png" alt="Esc">`, action, 'aria-label="' + L('닫기', 'Close') + '"', 'resource-close');
  }
  function serviceHTML() {
    return `<div class="service-layer ${g.tutorial?.kind === 'recipe' ? 'tutorial-service' : ''}"><button class="service-scrim" data-act="service" aria-label="${L('서비스 패널 닫기', 'Close service panel')}"></button><aside id="service-panel" class="service-panel resource-service-panel" role="dialog" aria-modal="true" aria-labelledby="service-title">
 <header><div><small class="service-eyebrow">SERVICE PANEL</small><h2 id="service-title">${L('서비스 패널', 'Service panel')}</h2></div>${resourceClose('service', 'service_panel')}</header>
 <div class="service-actions">${button(L('칵테일 레시피', 'Cocktail recipes'), 'recipes')}${button(L('매출 현황', 'Sales summary'), 'sales', g.tutorial ? 'disabled' : '')}${button(L('단골 손님 정보', 'Regular guest profiles'), 'dossierOpen', g.tutorial ? 'disabled' : '')}</div>
 <p>※ ${g.tutorial ? L('칵테일 레시피를 눌러 주세요.', 'Choose Cocktail recipes.') : L('패널을 열면 영업 시간이 멈춥니다.', 'Service time is paused while this panel is open.')}</p></aside></div>`;
  }
  function toggleService() {
    if (g.overlay === 'service') {
      g.overlay = null;
      render(true);
      root.querySelector('[data-act="service"]')?.focus({
        preventScroll: true
      });
      return;
    }
    if (g.screen !== 'bar' || g.phase === 'ready' || g.finished || g.isPaused() || ui.drag) return;
    if (g.tutorial && !g.openTutorialService()) return;
    clearControlSkip();
    ui.inspector = false;
    show('service');
    root.querySelector('#service-panel [data-act="recipes"]')?.focus({
      preventScroll: true
    });
  }
  function ingredientWarningHTML() {
    return `<div class="modal-backdrop"><section class="modal ingredient-warning" role="alertdialog" aria-modal="true" aria-labelledby="ingredient-warning-title" aria-describedby="ingredient-warning-copy"><h2 id="ingredient-warning-title">${L('정말 이렇게까지 재료를 담으시겠습니까?', 'Are you really going to add this many ingredients?')}</h2><div id="ingredient-warning-copy"><p>${L('전 맹새코 살면서 이렇게까지 많은 재료를 넣은 칵테일을 본 적이 없습니다.', 'I swear I have never seen a cocktail with this many ingredients in my life.')}</p><p>${L('이렇게 만들면 둘 중 하나겠죠 역사에 남을 칵테일을 만들 수 있지만 보통 개오줌같은 칵테일이 나오겠죠.', 'This can go one of two ways: you might make a cocktail that goes down in history, but usually you will end up with something that tastes like dog piss.')}</p></div><div class="ingredient-warning-actions">${button(L('확인', 'OK'), 'closeOverlay', '', 'primary')}</div></section></div>`;
  }
  function dailyUnlocksHTML() {
    const fresh = g.dailyUnlocks();
    const section = (title, rows, kind) => `<section class="unlock-section"><h3>${title}<span>${rows.length}</span></h3><div class="unlock-grid" tabindex="0" role="region" aria-label="${title}">${rows.map(row => `<article class="unlock-card" data-unlock-id="${esc(row.id)}"><div class="unlock-art">${kind === 'ingredient' ? itemArt(row.id, '', 'recipe') : drinkArt(row.id, 'recipe')}</div><div class="unlock-name">${esc(g.name(row.id))}</div></article>`).join('') || `<p class="unlock-empty">${L('오늘 새로 추가된 항목이 없습니다.', 'No new additions today.')}</p>`}</div></section>`;
    return `<div class="modal-backdrop daily-unlocks-backdrop"><section class="daily-unlocks" role="dialog" aria-modal="true" aria-labelledby="daily-unlocks-title"><header><span class="unlock-day">${L(g.day + '일차', 'DAY ' + g.day)}</span><h2 id="daily-unlocks-title">${L('오늘의 새로운 재료와 레시피', 'New ingredients & recipes')}</h2><p>${L('새로 도착한 재료로 더 다양한 한 잔을 만들어 보세요.', 'Discover new drinks with today’s additions.')}</p></header><div class="unlock-columns">${section(L('새로 들어온 재료', 'New ingredients'), fresh.ingredients, 'ingredient')}${section(L('해금된 레시피', 'Unlocked recipes'), fresh.cocktails, 'cocktail')}</div><footer>${button(L('확인 · 영업 준비하기', 'Continue · Prepare to open'), 'confirmDailyUnlocks', '', 'primary')}</footer></section></div>`;
  }
  function johnnyUnlockHTML() {
    return '<div class="modal-backdrop daily-unlocks-backdrop"><section class="daily-unlocks johnny-unlock" role="dialog" aria-modal="true" aria-labelledby="johnny-unlock-title"><header><span class="unlock-day">' + L('조니의 기억 · 히든 레시피', 'JOHNNY’S MEMORY · HIDDEN RECIPE') + '</span><h2 id="johnny-unlock-title">' + L('새로운 칵테일이 해금되었습니다', 'A new cocktail is unlocked') + '</h2><p>' + L('기억 속 레시피와 모아 온 재료, 아일리의 각설탕이 한 잔으로 이어집니다.', 'Johnny’s recipe, the ingredients you collected, and Aili’s sugar cube come together.') + '</p></header><div class="johnny-unlock-body"><div class="johnny-unlock-drink">' + drinkArt('johnny_old_fashioned', 'recipe') + '<h3>' + L('올드 패션드', 'Old Fashioned') + '</h3><p>' + L('올드패션드 잔 · 믹싱 글라스 · 스터', 'Old fashioned glass · Mixing glass · Stir') + '</p></div><div class="johnny-unlock-stock"><h3>' + L('재료 선반에 추가되었습니다', 'Added to your shelves') + '</h3>' + [['wild_dog', '45ml'], ['bitters', '5ml'], ['sugar_cube', L('1개', '1 cube')]].map(([id, qty]) => '<div class="johnny-unlock-item" data-unlock-id="' + id + '">' + itemArt(id, '', 'recipe') + '<span>' + esc(g.name(id)) + '</span><b>' + qty + '</b></div>').join('') + '<p>' + L('각설탕은 리큐어 선반 맨 끝에 있습니다.', 'The sugar cube is at the end of the liqueur shelf.') + '</p></div></div><footer>' + button(L('확인 · 대화 계속하기', 'Continue conversation'), 'confirmJohnnyUnlock', '', 'primary') + '</footer></section></div>';
  }
  function overlayHTML() {
    if (!g.overlay) return '';
    if (g.overlay === 'settings') return '<div class="modal-backdrop">' + window.LunaSettings.html({
      context: ui.minigames ? 'practice' : 'bar',
      onClose: () => act('closeOverlay'),
      exitLabel: ui.minigames ? '기믹 선택으로' : '시작 화면으로',
      onExit: () => act(ui.minigames ? 'miniLobby' : 'setup')
    }) + '</div>';
    if (g.overlay === 'miniIngredient') return miniUI.ingredientHTML();
    if (g.overlay === 'johnnyUnlock') return johnnyUnlockHTML();
    if (g.overlay === 'dailyUnlocks') return dailyUnlocksHTML();
    if (g.overlay === 'ingredientWarning') return ingredientWarningHTML();
    if (g.overlay === 'openerWarning') return `<div class="modal-backdrop"><section class="modal ingredient-warning" role="alertdialog" aria-modal="true" aria-labelledby="opener-warning-title" aria-describedby="opener-warning-copy"><h2 id="opener-warning-title">${L('병따개가 필요합니다', 'Bottle opener required')}</h2><p id="opener-warning-copy">${L('병맥주를 따르려면 먼저 뚜껑을 열어야 합니다. 도구 선반에서 병따개를 선택해 주세요.', 'Open the bottle before pouring the beer. Please select a bottle opener from the tool shelf.')}</p><div class="ingredient-warning-actions">${button(L('확인', 'OK'), 'closeOverlay', '', 'primary')}</div></section></div>`;
    if (g.overlay === 'serveDetails') return modal(L('판정 결과', 'Score details'), serveView.detailsHTML());
    if (ui.minigames && g.overlay === 'help') return modal(L('기믹 미니게임 조작', 'Minigame controls'), miniUI.helpHTML(), true);
    if (g.overlay === 'miniExit') return modal(L('기믹 선택으로 돌아갈까요?', 'Return to minigame selection?'), `<p>${L('현재 연습은 종료됩니다. 같은 기믹은 언제든 다시 시작할 수 있어요.', 'This attempt will end. You can replay any skill at any time.')}</p><div class="row">${button(L('계속 연습', 'Keep practicing'), 'closeOverlay')}${button(L('기믹 선택', 'Choose a minigame'), 'miniLobby', '', 'primary')}</div>`);
    if (g.overlay === 'remixGoals') return modal(L('이번 영업의 목표', 'Shift goals'), remixUI.goalsHTML());
    if (g.overlay === 'service') return serviceHTML();
    if (g.overlay === 'help') return modal(L('조작 안내', 'Controls'), remix.active() ? remixUI.helpHTML() : helpHTML(), true);
    if (g.overlay === 'sales') return modal(L('매출 현황', 'Sales'), salesHTML(), true);
    if (g.overlay === 'dossier') return dossierHTML();
    if (g.overlay === 'history') return modal(L('대사 기록', 'Dialogue history'), g.history.slice(-150).map(h => `<div class="history-line"><b>${esc(h.anonymous ? '???' : g.name(h.actor))}</b>${esc(h.text)}</div>`).join('') || '<div class="empty">' + L('아직 대사가 없습니다.', 'No dialogue yet.') + '</div>');
    if (g.overlay === 'recipe') return modal(esc(g.name(g.craft.actual.selected)), recipeLines(g.cocktail(g.craft.actual.selected)));
    if (g.overlay === 'restart') return modal(L('테스트를 다시 시작할까요?', 'Restart the test?'), `<p>${L('현재 영업 상태는 초기화됩니다. 필요한 경우 로그를 먼저 내보내세요.', 'Current session state will be reset. Export logs first if needed.')}</p><div class="row">${button(L('로그 내보내기', 'Export logs'), 'export')}${button(L('일차 선택으로', 'Session setup'), 'setup', '', 'primary')}</div>`);
    return '';
  }
  function upkeepInspectorHTML() {
    const info = g.upkeepInfo();
    return `<label>${L('하루 정산 테스트', 'Daily settlement test')}</label><div class="inspect-row">${L('이번 유지비', 'Upkeep')}: ${money(info.amount)} · ${info.source === 'web_test' ? L('웹 테스트값', 'Test override') : L('일차 기본값', 'Day default')}</div><div class="row upkeep-editor"><input type="number" min="0" step="1" data-input="upkeep" value="${esc(ui.upkeep)}" placeholder="${L('빈칸 = 데이터값', 'Blank = data')}" aria-label="유지비 테스트값 수정" ${g.finished ? 'disabled' : ''}>${button(L('적용', 'Apply'), 'applyUpkeep', g.finished ? 'disabled' : '')}</div>${button(L('지금 영업 끝내고 정산 보기', 'End service now and show settlement'), 'debugEndDay', g.finished || g.phase === 'ready' ? 'disabled' : '', 'danger')}<small>${L('검수용 조기 종료입니다. 미제공 주문은 매출에 넣지 않습니다.', 'Test-only early ending. Unserved orders are not counted.')}</small>`;
  }
  function inspectorHTML() {
    if (!ui.inspector) return '';
    const guest = g.seats[g.focus],
      step = g.story?.steps[g.story.index];
    return `<aside class="inspector"><header><span>F2 · ${L('테스트 도구', 'TEST TOOLS')}</span>${button('×', 'inspector')}</header><div class="inspect-body"><div class="contract-note">${L('이 패널 자체는 시간을 멈추지 않습니다. 수치 확인이 필요하면 ESC 옵션을 열어 정지하세요.', 'This panel does not pause time. Open options with ESC to pause.')}</div><div class="inspect-row">${phase()} / ${g.screen}<br>Day ${g.day} · seed ${g.seed}<br>${L('영업 경과', 'Bar time')} ${g.barTime.toFixed(1)}s · ${L('남은 스폰', 'Queued')} ${Math.max(0, (g.queue?.length || 0) - (g.queueIndex || 0))}</div>${step ? `<div class="inspect-row">scene: ${esc(g.story.scene.id)}<br>seq: ${step.seq} / ${step.type}<br>when: ${esc(step.when || '—')}<br>effects: ${esc(step.effects || '—')}</div>` : ''}${guest ? `<div class="inspect-row">${esc(guest.id)} · ${g.focus}<br>${guest.state}<br>${guest.left != null ? 'patience: ' + guest.left.toFixed(1) + ' / ' + guest.limit.toFixed(1) + 's' : ''}<br>${guest.order ? 'order: ' + guest.order.id + ' / ' + guest.order.cocktail : ''}</div>` : ''}<label>${L('시간 배속 · 일반 손님 타이머만', 'Clock speed · general guest timers only')}</label><select data-change="speed">${[.25, .5, 1, 2, 5].map(v => `<option value="${v}" ${g.speed === v ? 'selected' : ''}>×${v}</option>`).join('')}</select>${upkeepInspectorHTML()}${dossierInspectorHTML()}<label>${L('제조 검수 보조', 'Craft testing helpers')}</label>${button(L('정답 재료·잔·도구 채우기', 'Fill correct recipe'), 'debugFill', g.screen !== 'prep' ? 'disabled' : '')}<div class="row wrap">${['excellent', 'good', 'poor', 'sewage'].map(grade => button(grade, 'debugCraft', `data-id="${grade}" ${!['prep', 'gimmick'].includes(g.screen) ? 'disabled' : ''}`)).join('')}</div><label>${L('진행 상태', 'Progress')}</label><pre>${esc(JSON.stringify(g.progress, null, 2))}</pre><label>${L('최근 이벤트', 'Recent events')}</label>${g.logs.slice(-8).reverse().map(e => `<div class="inspect-row">${e.time}s · ${esc(e.event)}<br><small>${esc(JSON.stringify(e).slice(0, 190))}</small></div>`).join('')}<div class="divider"></div>${button(L('전체 로그 JSON 내보내기', 'Export log JSON'), 'export')}<p class="recipe-note">${D.source.branch}<br>${esc(D.source.importedAt)}<br>29 CSV · ${D.tables.steps.length} steps</p></div></aside>`;
  }
  function settlementHTML() {
    return window.LunaSettlementView.html({
      g,
      main: !!campaign?.active,
      challenge: !!(remix.active() && g.remix.challenge)
    });
  }
  function gameoverHTML() {
    return window.LunaSettlementView.html({
      g,
      main: !!campaign?.active,
      gameover: true
    });
  }
  function errorHTML() {
    return modal('DATA_ERROR', `<p class="critical">${esc(g.error)}</p><p>${L('잘못된 데이터나 미지원 연결을 만났습니다. 점수·주문을 임의로 확정하지 않습니다. 로그를 내보내 연결 지점을 확인할 수 있습니다.', 'Invalid data or an unsupported connection was encountered. No result will be invented; export logs to inspect the reference.')}</p><div class="row wrap">${g.craft ? button(L('같은 재료로 재시도', 'Retry same materials'), 'retry', '', 'primary') + button(L('제조 취소', 'Cancel crafting'), 'cancelCraft') : ''}${button(L('로그 내보내기', 'Export logs'), 'export')}${button(L('시작 화면', 'Session setup'), 'setup')}</div>`, false, false);
  }
  // Patch existing nodes instead of rebuilding the UI every typing frame.
  // This preserves held buttons, focus, scroll position and CSS transitions.
  function morph(parent, next) {
    for (let i = 0; i < next.childNodes.length || i < parent.childNodes.length; i++) {
      const a = parent.childNodes[i],
        b = next.childNodes[i];
      if (!b) {
        parent.removeChild(a);
        i--;
        continue;
      }
      if (!a) {
        parent.appendChild(b.cloneNode(true));
        continue;
      }
      if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) {
        a.replaceWith(b.cloneNode(true));
        continue;
      }
      if (a.nodeType === 3) {
        if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
        continue;
      }
      if (a.nodeType !== 1) continue;
      // Settings owns its tab, confirmation, focus and temporary inert state.
      // Rebuilding it every game frame can erase an active confirmation or
      // leave focus in a newly hidden tab. Remove/replace it normally on close.
      if (a.matches('.luna-settings') && b.matches('.luna-settings') && a.dataset.settingsContext === b.dataset.settingsContext) continue;
      // Hold owns this transient state. Preserve it across ordinary scene redraws
      // so the title-signal animation does not restart on every render pass.
      if (a.matches('.choices button.choice-holding[data-act="choice"]') && b.matches('button[data-act="choice"]') && a.dataset.id === b.dataset.id) {
        b.classList.add('choice-holding');
        b.style.setProperty('--choice-progress', a.style.getPropertyValue('--choice-progress'));
      }
      for (const attr of [...a.attributes]) if (!b.hasAttribute(attr.name)) a.removeAttribute(attr.name);
      for (const attr of [...b.attributes]) if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
      morph(a, b);
      if (['INPUT', 'SELECT'].includes(a.nodeName) && document.activeElement !== a && a.value !== b.value) a.value = b.value;
    }
  }
  const views = window.LunaBarViews({
    D,
    g,
    ui,
    L,
    esc,
    a,
    button,
    itemArt,
    drinkArt,
    recipeLines
  });
  const serveView = window.LunaServeView({
    g,
    D,
    C,
    L,
    esc,
    button,
    drinkArt,
    labelType
  });
  const remixUI = window.LunaRemixUI({
    g,
    D,
    ui,
    L,
    esc,
    a,
    button,
    itemArt,
    drinkArt,
    recipeLines,
    remix,
    recipePanel: views.recipePanel
  });
  if (new URLSearchParams(location.search).get('version') === 'gpt') {
    ui.variant = 'gpt';
    ui.day = 0;
    ui.mode = 'episode';
    g.reset(0, 'episode', 1, false, {
      variant: 'gpt'
    });
    try {
      g.read = new Set(JSON.parse(localStorage.getItem('luna.bar.gpt.read.v1') || '[]'));
    } catch {
      g.read = new Set();
    }
  }
  if (new URLSearchParams(location.search).get('mode') === 'outside') ui.outside = true;
  if (new URLSearchParams(location.search).get('mode') === 'cutscenes') ui.cutscenes = true;
  let campaign = null;
  const outside = window.outsidePlaytest = window.LunaOutside.create({
    currencyView,
    onExit: () => {
      ui.outside = true;
      render(true);
      root.querySelector('[data-outside-action="start"]')?.focus();
    }
  });
  const miniUI = window.LunaMinigames.createUI({
    g,
    ui,
    L,
    esc,
    button,
    itemArt,
    tabsHTML: remixUI.tabsHTML,
    mini
  });
  if (new URLSearchParams(location.search).get('mode') === 'minigames') ui.minigames = true;
  function miniLobby() {
    g.reset(99, 'practice', 1, false, {
      variant: ui.variant
    });
    ui.minigames = true;
    ui.inspector = false;
    ui.auto = false;
    clearControlSkip();
    ui.drag = null;
    g.speed = 1;
  }
  function miniStart(kind, ingredient) {
    const variant = 'original';
    try {
      localStorage.setItem(g.variant === 'gpt' ? 'luna.bar.gpt.read.v1' : 'luna.bar.playtest.read.v1', JSON.stringify([...g.read]));
    } catch {}
    g.startMinigame(kind, {
      ingredient
    });
    ui.variant = variant;
    ui.minigames = true;
    ui.inspector = false;
    ui.auto = false;
    clearControlSkip();
    g.speed = 1;
    try {
      g.read = new Set(JSON.parse(localStorage.getItem(variant === 'gpt' ? 'luna.bar.gpt.read.v1' : 'luna.bar.playtest.read.v1') || '[]'));
    } catch {
      g.read = new Set();
    }
  }
  let recipePointer = null;
  let ingredientPointer = null;
  function syncIngredientPointerTip() {
    const tip = root.querySelector('#ingredient-tip'),
      panel = tip?.parentElement;
    const item = root.querySelector('.shelf-slide[data-current="true"] [data-hover-item="' + ui.hoverItem + '"]');
    if (!tip || !panel || !item) return;
    const bounds = panel.getBoundingClientRect(),
      r = item.getBoundingClientRect();
    const sx = bounds.width / panel.offsetWidth,
      sy = bounds.height / panel.offsetHeight;
    if (!sx || !sy) return;
    // Keep client-space pointer coordinates accurate in scaled/fullscreen game views.
    const pointer = ingredientPointer?.id === ui.hoverItem ? ingredientPointer : {
      x: r.right,
      y: r.top + r.height / 2
    };
    const t = tip.getBoundingClientRect(),
      gap = 16,
      margin = 8;
    const left = Math.max(bounds.left, 0) + margin,
      right = Math.min(bounds.right, innerWidth) - margin;
    const top = Math.max(bounds.top, 0) + margin,
      bottom = Math.min(bounds.bottom, innerHeight) - margin;
    let x = pointer.x + gap,
      y = pointer.y + gap;
    if (x + t.width > right) x = pointer.x - t.width - gap;
    if (y + t.height > bottom) y = pointer.y - t.height - gap;
    x = Math.max(left, Math.min(x, right - t.width));
    y = Math.max(top, Math.min(y, bottom - t.height));
    tip.style.left = (x - bounds.left) / sx - panel.clientLeft + 'px';
    tip.style.top = (y - bounds.top) / sy - panel.clientTop + 'px';
  }
  function syncRecipePointerTip() {
    const slot = recipePointer?.slot;
    if (!slot?.isConnected || !slot.matches(':hover')) return;
    const tip = slot.querySelector('.recipe-item-tip'),
      scroll = slot.closest('.prep-recipe-scroll');
    if (!tip || !scroll) return;
    const r = slot.getBoundingClientRect(),
      bounds = scroll.getBoundingClientRect(),
      t = tip.getBoundingClientRect();
    const sx = r.width / slot.offsetWidth,
      sy = r.height / slot.offsetHeight;
    if (!sx || !sy) return;
    let x = recipePointer.x + 14,
      y = recipePointer.y + 14;
    if (x + t.width > bounds.right - 8) x = recipePointer.x - t.width - 14;
    if (y + t.height > bounds.bottom - 8) y = recipePointer.y - t.height - 14;
    x = Math.max(bounds.left + 4, Math.min(x, bounds.right - t.width - 8));
    y = Math.max(bounds.top + 4, Math.min(y, bounds.bottom - t.height - 8));
    tip.style.left = (x - r.left) / sx - slot.clientLeft + 'px';
    tip.style.top = (y - r.top) / sy - slot.clientTop + 'px';
  }
  const choiceHold = window.LunaChoiceHold({
    root,
    choice: () => g.choice,
    allowed: () => !!g.choice && g.screen === 'bar' && !g.isPaused() && !g.finished && !g.cameraMoving && !g.cameraLeft && !g.transition && !ui.inspector && !ui.drag && !outside.active && !campaign?.blocking,
    commit: id => act('choice', id)
  });
  let lastStructure = '',
    lastFocusedChoice = null;
  function render(force = false) {
    if (outside.active || campaign?.blocking && campaign.view !== 'awakening' && !(campaign.view === 'bar-door' && campaign.doorTransition?.committing)) return;
    tutorialView.updateShelf(root);
    views.syncCamera(root);
    const scrolls = [...root.querySelectorAll('.recipe-list,.items-grid,.prep-summary,.inspect-body,.modal,.table-scroll,.dossier-list-scroll,.profile-body,.prep-recipe-scroll')].map(e => [e.className, e.scrollTop]);
    const liveBar = g.screen === 'bar' && !['ready', 'arrival'].includes(g.phase) && !g.finished;
    const blocked = g.isPaused() || !liveBar;
    const html = `<div class="app-shell ${ui.variant === 'gpt' ? 'gpt-version' : ''} ${g.minigame ? 'minigame-version' : ''}"><main class="workspace">${g.phase !== 'ready' && (!g.minigame || g.gimmick?.fluid) ? currencyHTML() : ''}
  <div class="corner-tools ${g.screen === 'prep' ? 'prep-corner-tools' : ''}" ${g.overlay || g.paused || g.error ? 'inert' : ''}>
   ${['bar', 'prep'].includes(g.screen) && !g.finished ? button('?', 'help', 'aria-label="' + L('조작 안내', 'Controls') + '" title="' + L('조작 안내', 'Controls') + '"', 'help-corner') : ''}
  </div>
  <div class="bar-view" data-tutorial="${tutorialView.stage() || ''}" ${g.overlay || g.paused || g.error || !liveBar ? 'inert' : ''}>${barHTML()}
   ${liveBar && (!['regular', 'opening'].includes(g.phase) || g.tutorial?.kind === 'recipe') ? button('<span>' + L('서비스 패널', 'Service panel') + '</span><kbd>Tab</kbd>', 'service', `aria-expanded="${g.overlay === 'service'}" aria-controls="service-panel" ${g.isPaused() ? 'disabled' : ''}`, 'service-handle') : ''}
   ${liveBar && (g.phase === 'general' || g.tutorial?.kind === 'seatExplore') ? ['A', 'D'].map((key, i) => button((i ? '' : '<span class="view-chevron" aria-hidden="true">&lt;</span>') + '<span>' + key + '</span>' + (i ? '<span class="view-chevron" aria-hidden="true">&gt;</span>' : ''), 'seat', `data-id="${['L', 'M', 'R'][Math.max(0, Math.min(2, ['L', 'M', 'R'].indexOf(g.focus) + (i ? 1 : -1)))]}" aria-label="${i ? L('오른쪽 좌석 보기', 'View right seat') : L('왼쪽 좌석 보기', 'View left seat')}" ${blocked || g.focus === (i ? 'R' : 'L') || g.tutorial?.kind === 'seatExplore' && (g.cameraMoving || g.cameraLeft > 0) ? 'disabled' : ''}`, 'view-key ' + (i ? 'next' : 'prev'))).join('') : ''}
   ${liveBar && (g.phase === 'general' || g.day === 0 && g.variant !== 'gpt' && g.progress.flags.day0_seats_revealed && ['seatExplore', 'seatIndicator', 'seatLegend'].includes(g.tutorial?.kind)) ? `<nav class="seat-indicators" aria-label="${L('현재 보는 좌석', 'Current seat')}">${['L', 'M', 'R'].map(seat => {
      const indicator = views.seatIndicator(seat);
      return button('<span></span>', 'seat', `data-id="${seat}" title="${esc(indicator.label)}" aria-label="${esc(indicator.label)}" aria-pressed="${!g.overview && g.focus === seat}" ${blocked ? 'disabled' : ''}`, (!g.overview && g.focus === seat ? 'selected ' : '') + indicator.className);
    }).join('')}</nav>` : ''}
  </div>
  ${remix.active() && liveBar ? remixUI.hudHTML() : originalServiceTipHTML()}${g.phase === 'ready' ? startHTML() : ''}${g.screen === 'recipe' ? recipesHTML() : ''}${g.screen === 'prep' ? prepHTML() + (remix.active() ? remixUI.prepHTML() : '') : ''}${g.screen === 'gimmick' ? gimmickHTML() + (remix.active() ? remixUI.gimmickHTML() : '') : ''}${g.screen === 'minigame_result' ? miniUI.resultHTML() : ''}${['result', 'discarding'].includes(g.screen) ? resultHTML() : ''}${g.screen === 'settlement' ? settlementHTML() : ''}${g.screen === 'gameover' ? gameoverHTML() : ''}${g.paused ? `<div class="pause-full">${button('▶ ' + L('계속하기', 'Resume'), 'pause')}</div>` : ''}${overlayHTML()}${tutorialView.html()}${g.error ? errorHTML() : ''}${inspectorHTML()}${g.effectVisual && g.realTime < g.effectVisual.until && g.effectVisual.kind === 'fx' ? '<div class="effect-flash"></div>' : ''}
 </main></div>`;
    if (force || html !== lastStructure) {
      const template = document.createElement('template');
      template.innerHTML = html;
      morph(root, template.content);
      views.syncCamera(root);
      lastStructure = html;
      for (const [cls, top] of scrolls) {
        const e = root.getElementsByClassName(cls)[0];
        if (e) e.scrollTop = top;
      }
    }
    syncRecipePointerTip();
    syncIngredientPointerTip();
    tutorialView.sync(root);
    choiceHold.sync();
    window.LunaSettlementView.sync();
    const lesson = root.querySelector('.mix-tutorial');
    root.querySelector('.mix-screen')?.toggleAttribute('inert', !!lesson);
    if (lesson && !lesson.contains(document.activeElement)) lesson.querySelector('button')?.focus({
      preventScroll: true
    });
    if (g.overlay === 'johnnyUnlock') {
      const dialog = root.querySelector('.johnny-unlock');
      if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector('[data-act="confirmJohnnyUnlock"]')?.focus({
        preventScroll: true
      });
    }
    if (g.overlay === 'dailyUnlocks') {
      const dialog = root.querySelector('.daily-unlocks');
      if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector('[data-act="confirmDailyUnlocks"]')?.focus({
        preventScroll: true
      });
    }
    if (['ingredientWarning', 'openerWarning'].includes(g.overlay)) {
      const warning = root.querySelector('.ingredient-warning');
      if (warning && !warning.contains(document.activeElement)) warning.querySelector('button')?.focus({
        preventScroll: true
      });
    }
    // Focus a new choice only once, after staging. Never steal focus from a menu.
    if (!g.choice) lastFocusedChoice = null;else if (lastFocusedChoice !== g.choice && liveBar && !g.isPaused() && !ui.inspector && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0) {
      const first = root.querySelector('.choices button:not(:disabled)');
      if (first) {
        first.focus({
          preventScroll: true
        });
        lastFocusedChoice = g.choice;
      }
    }
  }
  function toast(msg) {
    const el = document.querySelector('#toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('visible'), 2200);
  }
  function exportLog() {
    const payload = {
      kind: 'LUNA_WEB_PLAYTEST',
      createdAt: new Date().toISOString(),
      source: D.source,
      day: g.day,
      mode: g.mode,
      variant: g.variant,
      serviceVersion: g.serviceVersion,
      difficulty: g.remix?.difficulty,
      seed: g.seed,
      progress: g.progress,
      transactions: g.transactions,
      dailySettlement: g.dailySettlement,
      upkeepOverride: g.upkeepOverride,
      logs: g.logs,
      history: g.history,
      error: g.error
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    }));
    const el = document.createElement('a');
    el.href = url;
    el.download = `luna-day${g.day}-${Date.now()}.json`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast(L('테스트 로그를 내보냈습니다.', 'Test log exported.'));
  }
  function show(name) {
    if (name === 'settings') releaseBackgroundInput();
    if (name === 'dossier') {
      ui.dossierDetail = null;
      ui.dossierPreview = null;
      ui.inspector = false;
    }
    g.overlay = name;
    g.gimmick && (g.gimmick.held = false);
    render();
  }
  function act(name, id, source) {
    if (mixTutorial.action(name, id)) {
      render(true);
      return;
    }
    if (g.overlay === 'johnnyUnlock') {
      if (name === 'confirmJohnnyUnlock') {
        clearControlSkip();
        g.safe(() => g.confirmJohnnyUnlock());
        render(true);
      }
      return;
    }
    if (name === 'skipStoryCraft') {
      if (canSkipStoryCraft()) g.safe(skipStoryCraft);
      render(true);
      return;
    }
    if (!tutorialView.allows(name, id, source)) return;
    if (g.overlay === 'dailyUnlocks') {
      if (name === 'confirmDailyUnlocks') {
        clearControlSkip();
        g.safe(() => g.confirmDailyUnlocks());
        render(true);
      }
      return;
    }
    pourView.unlockAudio();
    if (pourView.act(name, id)) {
      render(true);
      return;
    }
    if (name === 'pourPresentation') {
      if (!['classic', 'clean', 'bottle'].includes(id)) return;
      ui.pourPresentation = id;
      try {
        localStorage.setItem('luna.pour.presentation.v1', id);
      } catch {}
      render(true);
      return;
    }
    if (campaign?.intercept(name)) return;
    remixUI.unlockAudio();
    openView.unlockAudio();
    shakePolish.unlockAudio();
    stirPolish.unlockAudio();
    if (name === 'stirSound') {
      if (window.LunaShakeRhythm.mainStoryLocked(g)) return;
      ui.stirSound = id === '2' ? 2 : 1;
      try {
        localStorage.setItem('luna.stir.sound.v1', String(ui.stirSound));
      } catch {}
      render(true);
      return;
    }
    if (name === 'shakeMode') {
      if (shakeRhythm.select(id)) {
        ui.shakeMode = id;
        try {
          localStorage.setItem('luna.shake.mode.v2', id);
        } catch {}
      }
      render(true);
      return;
    }
    if (name === 'rhythmHit') {
      g.gimmickInput(id);
      render();
      return;
    }
    if (name === 'shakeSound') {
      if (window.LunaShakeRhythm.mainStoryLocked(g)) return;
      ui.shakeSound = id === '2' ? 2 : 1;
      try {
        localStorage.setItem('luna.shake.sound.v2', String(ui.shakeSound));
      } catch {}
      render(true);
      return;
    }
    if (name === 'miniStart') {
      if (['pour', 'fill_up'].includes(id)) {
        ui.miniIngredientKind = id;
        show('miniIngredient');
        root.querySelector('.mini-ingredient-card')?.focus({
          preventScroll: true
        });
      } else {
        miniStart(id);
        render(true);
      }
      return;
    }
    if (name === 'miniIngredient') {
      if (g.overlay !== 'miniIngredient' || !window.LunaMinigames.ingredients(g, ui.miniIngredientKind).some(item => item.id === id)) return;
      miniStart(ui.miniIngredientKind, id);
      render(true);
      return;
    }
    if (name === 'miniIngredientCancel' || name === 'closeOverlay' && g.overlay === 'miniIngredient') {
      g.overlay = null;
      render(true);
      root.querySelector('[data-act="miniStart"][data-id="' + ui.miniIngredientKind + '"]')?.focus({
        preventScroll: true
      });
      return;
    }
    if (name === 'miniRetry') {
      g.retryMinigame();
      render(true);
      return;
    }
    if (name === 'miniLobby') {
      miniLobby();
      render(true);
      return;
    }
    if (name === 'miniBar') {
      miniLobby();
      act('version', ui.variant);
      return;
    }
    if (name === 'miniExit') {
      if (!g.minigame || !g.gimmick?.started) {
        miniLobby();
        render(true);
      } else show('miniExit');
      return;
    }
    if (ui.minigames && name === 'inspector') return;
    if (name === 'cutscenePlay') {
      window.LunaCutsceneLibrary.play(campaign, id);
      return;
    }
    if (name === 'cutsceneFilter') {
      window.LunaCutsceneLibrary.setFilter(id);
      render(true);
      return;
    }
    if (name === 'version') {
      if (g.phase !== 'ready') return;
      ui.cutscenes = id === 'cutscenes';
      if (ui.cutscenes) {
        ui.outside = false;
        ui.minigames = false;
        render(true);
        return;
      }
      if (id === 'outside') {
        ui.outside = true;
        ui.minigames = false;
        render(true);
        return;
      }
      ui.outside = false;
      if (id === 'minigames') {
        miniLobby();
        render(true);
        return;
      }
      ui.minigames = false;
      try {
        localStorage.setItem(g.variant === 'gpt' ? 'luna.bar.gpt.read.v1' : 'luna.bar.playtest.read.v1', JSON.stringify([...g.read]));
      } catch {}
      ui.variant = id === 'gpt' ? 'gpt' : 'original';
      ui.day = 0;
      ui.mode = ui.variant === 'gpt' ? 'episode' : 'full';
      ui.upkeep = '';
      ui.peek = null;
      ui.inspector = false;
      ui.auto = false;
      clearControlSkip();
      g.speed = 1;
      g.reset(ui.day, ui.mode, ui.seed, false, {
        variant: ui.variant,
        serviceVersion: ui.serviceVersion,
        difficulty: ui.difficulty,
        assist: ui.assist
      });
      try {
        g.read = new Set(JSON.parse(localStorage.getItem(ui.variant === 'gpt' ? 'luna.bar.gpt.read.v1' : 'luna.bar.playtest.read.v1') || '[]'));
      } catch {
        g.read = new Set();
      }
      render(true);
      return;
    }
    if (remixUI.act(name, id)) {
      render(true);
      return;
    }
    if (name === 'day') {
      ui.day = Number(id);
    } else if (name === 'start') {
      ui.peek = null;
      try {
        const amount = ui.variant === 'gpt' ? null : g.parseUpkeepOverride(ui.upkeep);
        g.safe(() => g.reset(ui.day, ui.mode, ui.seed, true, {
          storyPrerequisites: !!campaign?.session.developer,
          upkeepOverride: amount,
          variant: ui.variant,
          serviceVersion: ui.serviceVersion,
          difficulty: ui.difficulty,
          assist: ui.assist
        }));
      } catch (e) {
        toast(e.message);
      }
    } else if (name === 'setup') {
      g.reset(ui.day, ui.mode, ui.seed, false, {
        variant: ui.variant,
        serviceVersion: ui.serviceVersion
      });
      ui.inspector = false;
    } else if (name === 'confirmSettlement') {
      g.confirmDailySettlement();
      remixUI.recordRun();
    } else if (name === 'retryDay') {
      g.safe(() => g.reset(g.day, g.mode, g.seed, true, {
        storyPrerequisites: !!campaign?.session.developer,
        upkeepOverride: g.upkeepOverride,
        variant: g.variant,
        serviceVersion: g.serviceVersion
      }));
      ui.inspector = false;
    } else if (name === 'applyUpkeep') {
      try {
        g.setUpkeepOverride(ui.upkeep);
        if (remix.active()) g.remix.debug = true;
        toast(L('이번 영업의 유지비 테스트값을 적용했습니다.', 'Upkeep override applied to this session.'));
      } catch (e) {
        toast(e.message);
      }
    } else if (name === 'debugEndDay') {
      if (!g.finished && g.phase !== 'ready') g.safe(() => {
        if (remix.active()) g.remix.debug = true;
        g.log('debug_end_day', {
          unservedOrder: g.currentOrder?.id || null
        });
        g.finishDay();
      });
      ui.inspector = false;
    } else if (name === 'advance') g.advance();else if (name === 'choice') g.choose(id);else if (name === 'seat') {
      if (g.overview && g.focus === id) g.toggleOverview();else g.focusSeat(id);
    } else if (name === 'overview') g.toggleOverview();else if (name === 'reask') {
      if (!g.reask()) toast(L('서빙 대기 중인 앞자리 손님에게만 가능합니다.', 'Only available for the focused guest awaiting service.'));
    } else if (name === 'service') toggleService();else if (name === 'recipes') {
      const fromService = g.overlay === 'service';
      if (fromService) g.overlay = null;
      if (!g.openRecipes()) {
        if (fromService) g.overlay = 'service';
        toast(L('지금은 제조를 시작할 수 없습니다. 대사·서빙을 먼저 마쳐 주세요.', 'Finish the current dialogue or serving first.'));
      }
    } else if (name === 'closeRecipe') g.closeRecipes();else if (name === 'selectRecipe') {
      g.selectCocktail(id);
      ui.tab = 'glass';
      ui.recipeOpen = false;
      ui.hoverItem = null;
      ui.shelfPage = 0;
    } else if (name === 'tutorialBarContinue') {
      g.continueBarTutorial();
    } else if (name === 'tutorialContinue') {
      g.tutorialEvent('read');
    } else if (name === 'togglePrepRecipe') {
      ui.recipeOpen = !ui.recipeOpen;
      ui.hoverItem = null;
      g.tutorialEvent(ui.recipeOpen ? 'recipeOpen' : 'recipeClose');
    } else if (name === 'shelfCategory') {
      ui.tab = views.categories[Math.max(0, Math.min(3, views.categories.indexOf(ui.tab) + Number(id)))];
      ui.shelfPage = 0;
      ui.hoverItem = null;
      tutorialView.navigateShelf(ui.tab);
    } else if (name === 'shelfPage') {
      ui.shelfPage = Math.max(0, (ui.shelfPage || 0) + Number(id));
      ui.hoverItem = null;
    } else if (name === 'tab') {
      ui.tab = id;
      ui.shelfPage = 0;
      ui.hoverItem = null;
      if (id === 'liquor') g.tutorialEvent('shelf');
    } else if (name === 'pickOpener') {
      g.pickOpener();
    } else if (name === 'pick') g.pickItem(id);else if (name === 'prepBack') {
      ui.hoverItem = null;
      g.prepBack();
    } else if (name === 'craft') g.startCraft();else if (name === 'gimmickInput') g.gimmickInput('Space');else if (name === 'stir') g.gimmickInput(id);else if (name === 'endGimmick') g.endGimmick();else if (name === 'serveDetails') {
      if (serveView.ready()) show('serveDetails');
    } else if (name === 'offer') {
      if (serveView.ready()) g.offer();
    } else if (name === 'discard') {
      if (serveView.ready() && g.discard()) {
        ui.tab = 'glass';
        ui.recipeOpen = false;
        ui.hoverItem = null;
        ui.shelfPage = 0;
      }
    } else if (name === 'serve') {
      if (!g.serve(g.currentOrder?.seat || g.focus)) toast(L('제공 가능한 코스터가 없습니다.', 'No valid coaster to serve.'));
    } else if (name === 'debugFill') g.debugFill();else if (name === 'debugCraft') g.debugCraft(id);else if (name === 'retry') {
      if (g.minigame) g.retryMinigame();else g.retryDataError();
    } else if (name === 'cancelCraft') {
      if (g.minigame) miniLobby();else g.cancelCraft();
    } else if (name === 'dossier') {
      if (dossierState(id).met) {
        ui.dossier = id;
        ui.dossierDetail = id;
      }
      render(true);
      root.querySelector('.profile-body')?.focus({
        preventScroll: true
      });
    } else if (name === 'dossierOpen') {
      show('dossier');
      root.querySelector('.dossier-list-scroll')?.focus({
        preventScroll: true
      });
    } else if (name === 'dossierBack') {
      dossierBack();
    } else if (name === 'dossierPreview') {
      ui.dossierPreview = {
        id: ui.dossierTestActor,
        stage: Number(id)
      };
      ui.dossierDetail = null;
      g.overlay = 'dossier';
      ui.inspector = false;
    } else if (name === 'dossierLive') {
      ui.dossierPreview = null;
      show('dossier');
    } else if (name === 'craftRecipe') show('recipe');else if (name === 'closeOverlay') {
      if (g.overlay === 'service') toggleService();else {
        g.overlay = null;
        render(true);
        root.querySelector('[data-act="service"]')?.focus({
          preventScroll: true
        });
      }
    } else if (name === 'inspector') ui.inspector = !ui.inspector;else if (name === 'pause') {
      if (g.finished || g.phase === 'ready') return;
      g.paused = !g.paused;
      g.gimmick && (g.gimmick.held = false);
    } else if (name === 'bgm') bgm.setEnabled(!bgm.enabled);else if (name === 'sound') ui.sound = !ui.sound;else if (name === 'auto') ui.auto = !ui.auto;else if (name === 'export') exportLog();else if (['help', 'sales', 'history', 'settings', 'restart'].includes(name)) show(name);
    render(true);
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b?.dataset.act === 'rhythmHit' && e.detail > 0) return;
    if (b && !b.disabled) {
      try {
        act(b.dataset.act, b.dataset.id, b);
      } catch (err) {
        g.error = err.message;
        render();
      }
    }
  });
  root.addEventListener('change', e => {
    const key = e.target.dataset.change,
      v = e.target.value;
    if (key === 'remixAssist') ui.assist = e.target.checked;
    if (key === 'remixLiveAssist') {
      g.remix.assist = e.target.checked;
      ui.assist = e.target.checked;
    }
    if (key === 'remixAudio') ui.remixAudio = e.target.checked;
    if (key === 'gimmickAudio') ui.gimmickAudio = e.target.checked;
    if (key === 'mode') ui.mode = v;
    if (key === 'dossierTestActor') ui.dossierTestActor = v;
    if (key === 'language') g.lang = v;
    if (key === 'speed') {
      g.speed = Number(v);
      if (remix.active()) g.remix.debug = true;
    }
    if (key === 'dialogSpeed') g.dialogSpeed = Number(v);
    render(true);
  });
  root.addEventListener('input', e => {
    if (e.target.dataset.input === 'sfxVolume') {
      window.LunaSfx.setVolume(Number(e.target.value) / 100);
      render();
    } else if (e.target.dataset.input === 'bgmVolume') {
      bgm.setVolume(Number(e.target.value) / 100);
      render();
    } else if (e.target.dataset.input === 'upkeep') {
      ui.upkeep = e.target.value;
    }
  });
  root.addEventListener('toggle', e => {
    if (e.target.dataset?.details === 'recipe') ui.recipeOpen = e.target.open;
  }, true);
  root.addEventListener('pointerover', e => {
    const el = e.target.closest('[data-hover-recipe]');
    if (el && ui.peek !== el.dataset.hoverRecipe) {
      ui.peek = el.dataset.hoverRecipe;
      render();
    }
  });
  root.addEventListener('focusin', e => {
    const el = e.target.closest('[data-hover-recipe]');
    if (el && ui.peek !== el.dataset.hoverRecipe) {
      ui.peek = el.dataset.hoverRecipe;
      render();
    }
  });
  function hoverIngredient(e) {
    const el = e.target.closest('[data-hover-item]');
    if (!el || g.isPaused() || el.closest('[inert]')) return;
    if (g.tutorial && !tutorialView.canHover(el.dataset.hoverItem)) return;
    ingredientPointer = e.type.startsWith('pointer') ? {
      id: el.dataset.hoverItem,
      x: e.clientX,
      y: e.clientY
    } : null;
    if (ui.hoverItem !== el.dataset.hoverItem) {
      ui.hoverItem = el.dataset.hoverItem;
      render();
    }
    syncIngredientPointerTip();
    if (['gin', 'soda_water'].includes(el.dataset.hoverItem)) g.tutorialEvent('hover');
  }
  function trackRecipePointer(e) {
    const slot = e.target.closest('.recipe-icon-slot');
    recipePointer = slot ? {
      slot,
      x: e.clientX,
      y: e.clientY
    } : null;
    syncRecipePointerTip();
  }
  root.addEventListener('pointermove', trackRecipePointer);
  root.addEventListener('pointerover', trackRecipePointer);
  root.addEventListener('pointerleave', () => {
    recipePointer = null;
  });
  root.addEventListener('pointerover', hoverIngredient);
  root.addEventListener('focusin', hoverIngredient);
  root.addEventListener('pointermove', e => {
    const el = e.target.closest('[data-hover-item]');
    if (!el || el.dataset.hoverItem !== ui.hoverItem) return;
    ingredientPointer = {
      id: ui.hoverItem,
      x: e.clientX,
      y: e.clientY
    };
    syncIngredientPointerTip();
  });
  window.LunaHoverAudio.bind(root, {
    canHoverItem: id => g.screen === 'prep' && !g.isPaused() && (!g.tutorial || tutorialView.canHover(id))
  });
  function leaveIngredient(e) {
    const from = e.target.closest('[data-hover-item]'),
      to = e.relatedTarget?.closest?.('[data-hover-item]');
    if (from && from !== to && ui.hoverItem) {
      ui.hoverItem = null;
      ingredientPointer = null;
      render();
    }
  }
  root.addEventListener('pointerout', leaveIngredient);
  root.addEventListener('focusout', leaveIngredient);
  root.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-opening-stage]') && !g.isPaused()) {
      e.preventDefault();
      openView.unlockAudio();
      g.gimmickInput('Space');
      render();
      return;
    }
    const rhythmPad = e.target.closest('[data-act="rhythmHit"]');
    if (rhythmPad && !rhythmPad.disabled) {
      e.preventDefault();
      shakePolish.unlockAudio();
      g.gimmickInput(rhythmPad.dataset.id);
      render();
      return;
    }
    if (g.tutorial && !g.overlay && ['coaster', 'serveDrink'].includes(g.tutorial.kind) && (!e.target.closest('[data-drag="' + (g.tutorial.kind === 'coaster' ? 'coaster' : 'drink') + '"]') || g.cameraMoving || g.cameraLeft || g.transition)) return;
    if (e.target.closest('[data-shake-surface]') && !g.isPaused() && !g.remix?.hold) {
      e.preventDefault();
      shakePolish.unlockAudio();
      stirPolish.unlockAudio();
      g.gimmickInput('MouseLeft');
      render();
      return;
    }
    const hold = e.target.closest('[data-hold]');
    if (hold) {
      e.preventDefault();
      pourView.unlockAudio();
      g.holdPour(true);
      render();
      return;
    }
    const drag = e.target.closest('[data-drag]');
    if (drag && !g.isPaused() && !g.cameraMoving && !g.cameraLeft && !g.transition && g.screen === 'bar') {
      e.preventDefault();
      ui.drag = drag.dataset.drag;
      clearTimeout(toast.timer);
      document.querySelector('#toast').classList.remove('visible');
      const ghost = document.querySelector('#drag-ghost');
      ghost.innerHTML = ui.drag === 'coaster' ? `<img src="${a('coaster')}" alt="">` : drinkArt(g.drink.selected);
      ghost.hidden = false;
      window.LunaGameViewport.positionDrag(e.clientX, e.clientY);
      render();
    }
  });
  window.addEventListener('pointermove', e => {
    if (!ui.drag) return;
    window.LunaGameViewport.positionDrag(e.clientX, e.clientY);
  });
  function deliveryDropTarget(x, y) {
    if (g.isPaused() || g.cameraMoving || g.cameraLeft || g.transition || g.screen !== 'bar') return null;
    const hit = document.elementFromPoint(x, y);
    // Stay inside the visible game/table, and never deliver through a popup or control.
    if (!hit?.closest('.bar-stage') || hit.closest('[inert],button,a,input,select,textarea,[role="button"]')) return null;
    const direct = hit.closest('[data-drop]');
    if (direct) return direct.classList.contains('drop-ready') ? direct : null;
    let target = null, closest = Infinity;
    for (const zone of root.querySelectorAll('.bar-stage [data-drop].drop-ready')) {
      const r = zone.getBoundingClientRect();
      if (!r.width || !r.height || zone.closest('[inert]')) continue;
      const dx = (x - r.left - r.width / 2) / r.width;
      const dy = (y - r.top - r.height / 2) / r.height;
      // 1.5× width/height around the existing center. No DOM/CSS/visible cue changes.
      if (Math.abs(dx) > .75 || Math.abs(dy) > .75) continue;
      const distance = dx * dx + dy * dy;
      if (distance < closest) { target = zone; closest = distance; }
    }
    return target;
  }
  window.addEventListener('pointerup', e => {
    g.holdPour(false);
    if (ui.drag) {
      const zone = deliveryDropTarget(e.clientX, e.clientY);
      const ok = zone && (ui.drag === 'coaster' ? g.coaster(zone.dataset.drop, 'drag') : g.serve(zone.dataset.drop, 'drag'));
      if (!ok) toast(L('현재 손님의 유효한 코스터 위치에 놓아 주세요.', 'Drop onto the focused guest’s valid coaster.'));
      ui.drag = null;
      document.querySelector('#drag-ghost').hidden = true;
      render();
    }
  });
  window.addEventListener('pointercancel', () => {
    g.holdPour(false);
    ui.drag = null;
    document.querySelector('#drag-ghost').hidden = true;
    render();
  });
  // Some embedded browsers expose the modifier name without a left/right code.
  const controlKeys = new Set();
  const isControlKey = e => e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || e.keyCode === 17;
  const controlKeyId = e => /^Control(Left|Right)$/.test(e.code) ? e.code : 'Control';
  function clearControlSkip() {
    controlKeys.clear();
    ui.readSkip = false;
  }
  window.addEventListener('keydown', e => {
    if (outside.active) return;
    if (mixTutorial.key(e)) {
      render(true);
      return;
    }
    pourView.unlockAudio();
    remixUI.unlockAudio();
    openView.unlockAudio();
    shakePolish.unlockAudio();
    stirPolish.unlockAudio();
    if (g.overlay === 'johnnyUnlock') {
      if (e.code === 'Tab') {
        e.preventDefault();
        root.querySelector('[data-act="confirmJohnnyUnlock"]')?.focus({
          preventScroll: true
        });
      } else if (e.code === 'Escape' || isControlKey(e) || e.code === 'F2') e.preventDefault();
      return;
    }
    if (g.overlay === 'dailyUnlocks') {
      if (e.code === 'Tab') {
        e.preventDefault();
        const focusable = [...root.querySelectorAll('.daily-unlocks [tabindex="0"],.daily-unlocks button')],
          i = focusable.indexOf(document.activeElement);
        focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus({
          preventScroll: true
        });
      } else if (e.code === 'Escape' || isControlKey(e) || e.code === 'F2') {
        e.preventDefault();
      }
      return;
    }
    if (pourView.key(e)) {
      render(true);
      return;
    }
    // Enter still activates focused controls; Space is reserved for pouring above.
    if (g.screen === 'gimmick' && g.gimmick?.fluid && e.target.closest('[data-pour-ui]') && e.code === 'Enter') return;
    // Global menu keys work even when an option field has focus; held keys never toggle repeatedly.
    if (e.code === 'Escape') {
      e.preventDefault();
      if (e.repeat) return;
      if (g.overlay === 'dossier') act('dossierBack');else if (g.overlay) act('closeOverlay');else if (g.screen === 'recipe') act('closeRecipe');else act('settings');
      return;
    }
    if (g.overlay === 'miniIngredient') {
      if (e.code === 'Tab') {
        const buttons = [...root.querySelectorAll('.mini-ingredient-modal button')],
          i = buttons.indexOf(document.activeElement);
        e.preventDefault();
        buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
      return;
    }
    if (['ingredientWarning', 'openerWarning'].includes(g.overlay) && e.code === 'Tab') {
      e.preventDefault();
      root.querySelector('.ingredient-warning button')?.focus();
      return;
    }
    if (e.code === 'F2') {
      e.preventDefault();
      if (!e.repeat) act('inspector');
      return;
    }
    // Track the held key independently of the current phase; playback guards live in frame().
    if (isControlKey(e)) {
      controlKeys.add(controlKeyId(e));
      ui.readSkip = true;
      return;
    }
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
    if (e.repeat) {
      if (['Enter', 'Space'].includes(e.code)) e.preventDefault();
      return;
    }
    if (g.tutorial && !g.overlay && e.code === 'KeyY') return;
    if (e.code === 'KeyY') {
      if (g.overlay === 'history') {
        e.preventDefault();
        act('closeOverlay');
      } else if (!g.overlay && !g.paused && !g.error && !g.finished && g.phase !== 'ready' && !ui.drag) {
        e.preventDefault();
        clearControlSkip();
        show('history');
      }
      return;
    }
    if (g.overlay === 'dossier' && e.code === 'Tab' && !ui.inspector) {
      const scope = root.querySelector(ui.dossierDetail ? '.dossier-detail' : '.dossier-list-shell');
      const els = [...scope.querySelectorAll('button:not([disabled]),[tabindex="0"]')];
      const i = els.indexOf(document.activeElement);
      if (i < 0 || !e.shiftKey && i === els.length - 1 || e.shiftKey && i === 0) {
        e.preventDefault();
        els[e.shiftKey ? els.length - 1 : 0]?.focus();
      }
      return;
    }
    // Drag is the primary action; E is the only coaster keyboard shortcut.
    // Consume E even when a camera guard rejects it, so it cannot also reask an order.
    if (e.code === 'KeyE' && g.screen === 'bar' && !g.isPaused()) {
      const seat = g.tutorial?.kind === 'coaster' ? g.tutorial.seat : g.storyCoasterReady() ? g.storyCoaster.seat : g.phase === 'general' && g.seats[g.focus]?.state === 'WAIT_COASTER' ? g.focus : null;
      if (seat) {
        e.preventDefault();
        if (!ui.drag && !ui.inspector) g.coaster(seat, 'keyboard');
        render();
        return;
      }
    }
    if (tutorialView.key(e, root, act)) {
      render();
      return;
    }
    if (e.code === 'Tab' && (g.overlay === 'service' || g.screen === 'bar' && g.phase !== 'ready' && !g.finished && !g.isPaused() && !ui.drag)) {
      e.preventDefault();
      act('service');
      return;
    }
    if (g.overlay === 'service' && ['ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      const buttons = [...root.querySelectorAll('#service-panel button')],
        i = buttons.indexOf(document.activeElement);
      buttons[(i + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      return;
    }
    if (g.isPaused() || g.phase === 'ready') return;
    if (g.screen === 'bar' && g.choice && ['ArrowUp', 'ArrowDown', 'Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
      if (g.cameraMoving || g.cameraLeft > 0 || g.transition > 0 || ui.inspector || ui.drag) return;
      const buttons = [...root.querySelectorAll('.choices button:not(:disabled)')],
        i = buttons.indexOf(document.activeElement);
      if (!buttons.length) return;
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') buttons[i < 0 ? e.code === 'ArrowDown' ? 0 : buttons.length - 1 : (i + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus({
        preventScroll: true
      });else if (i >= 0) buttons[i].focus({
        preventScroll: true
      });else buttons[0].focus({
        preventScroll: true
      });
      return;
    }
    if (g.screen === 'gimmick') {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        g.gimmickInput(e.code);
        render();
      }
      return;
    }
    if (g.drink && document.activeElement?.dataset.drag === 'drink' && ['Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
      g.serve(g.currentOrder?.seat || g.focus, 'keyboard');
      render();
      return;
    }
    if (g.screen === 'prep' && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      act('shelfCategory', ['KeyA', 'ArrowLeft'].includes(e.code) ? '-1' : '1');
      return;
    }
    if (g.screen !== 'bar') return;
    if (g.phase === 'general') {
      if (e.code === 'Space') {
        e.preventDefault();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        g.reask();
      } else if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        const delta = ['KeyA', 'ArrowLeft'].includes(e.code) ? -1 : 1;
        g.focusSeat(['L', 'M', 'R'][Math.max(0, Math.min(2, ['L', 'M', 'R'].indexOf(g.focus) + delta))]);
      }
    } else if (['Space', 'Enter'].includes(e.code)) {
      e.preventDefault();
      g.advance();
    }
    render();
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      if (g.screen === 'gimmick' && g.gimmick?.fluid && !g.isPaused()) e.preventDefault();
      g.holdPour(false);
    }
    if (isControlKey(e)) {
      const id = controlKeyId(e);
      if (id === 'Control') controlKeys.clear();else {
        controlKeys.delete(id);
        controlKeys.delete('Control');
      }
      ui.readSkip = controlKeys.size > 0;
    }
  });
  function releaseBackgroundInput() {
    g.holdPour(false);
    g.gimmick && (g.gimmick.held = false);
    clearControlSkip();
    ui.drag = null;
    document.querySelector('#drag-ghost').hidden = true;
  }
  function syncFocusPause() {
    g.hidden = window.LunaFocusSettings.hiddenPaused;
  }
  window.addEventListener('luna-focus-settings-change', syncFocusPause);
  syncFocusPause();
  document.addEventListener('visibilitychange', () => {
    syncFocusPause();
    if (document.hidden) releaseBackgroundInput();
  });
  window.addEventListener('blur', () => {
    releaseBackgroundInput();
    if (outside.active || campaign?.blocking) return;
    if (window.LunaFocusSettings.enabled && g.phase !== 'ready' && !g.finished && !g.overlay) show('settings');
  });
  let lastRender = 0,
    autoTimer = 0,
    lastDialogue = null,
    lastReadCount = g.read.size,
    skipTimer = 0;
  function frame(now, dt) {
    bgm.syncLocation(campaign, outside);
    window.LunaStoryNotices.tick(g, outside, campaign, dt);
    window.lunaQA?.tick(Math.min(.05, dt));
    if (campaign?.tick(dt)) return;
    if (outside.active) {
      outside.tick(dt);
      return;
    }
    tutorialView.updateShelf(root);
    remixUI.soundTick();
    views.syncCamera(root);
    g.tick(dt, {
      holdSpeech: ui.drag === 'coaster'
    });
    currencyView.update(g.progress, dt, g.hidden);
    views.syncCamera(root);
    if (ui.auto && !ui.drag && !ui.readSkip && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 && g.dialogue && g.dialogue.chars >= g.dialogue.text.length && !g.isPaused() && g.screen === 'bar') {
      if (lastDialogue !== g.dialogue) {
        autoTimer = 0;
        lastDialogue = g.dialogue;
      }
      autoTimer += dt;
      if (autoTimer >= 2) {
        g.advance();
        autoTimer = 0;
      }
    } else autoTimer = 0;
    if (ui.readSkip && ['opening', 'regular'].includes(g.phase) && !g.choice && !ui.inspector && !ui.drag && !g.finished && !g.cameraMoving && g.cameraLeft === 0 && g.transition === 0 && g.dialogue && !g.isPaused() && g.screen === 'bar' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
      skipTimer += Math.min(dt, .05);
      if (skipTimer >= .12) {
        g.advance();
        skipTimer = 0;
      }
    } else skipTimer = 0;
    if (g.read.size !== lastReadCount) {
      lastReadCount = g.read.size;
      try {
        localStorage.setItem(g.variant === 'gpt' ? 'luna.bar.gpt.read.v1' : 'luna.bar.playtest.read.v1', JSON.stringify([...g.read]));
      } catch {}
    }
    if (g.effectVisual && g.effectVisual !== ui.lastEffect) {
      ui.lastEffect = g.effectVisual;
      if (ui.sound && g.effectVisual.kind === 'sfx') {
        try {
          const context = new AudioContext(),
            osc = context.createOscillator(),
            gain = context.createGain();
          osc.connect(gain);
          gain.connect(window.LunaSfx.output(context));
          osc.frequency.value = 180;
          gain.gain.setValueAtTime(.08, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .35);
          osc.start();
          osc.stop(context.currentTime + .35);
          osc.onended = () => {
            window.LunaSfx.release(context);
            context.close();
          };
        } catch {}
      }
    }
    const renderMs = ['bar', 'result', 'discarding'].includes(g.screen) || g.screen === 'gimmick' && ['stir', 'shake'].includes(g.gimmick?.type) ? 1000 / 30 : 80;
    if (now - lastRender > renderMs) {
      render();
      lastRender = now;
    }
    views.syncStirMotion(root);
    serveView.sync(root);
    pourView.sync(root);
    openView.sync(root);
    shakePolish.sync(root);
    window.LunaShakeRhythm.sync(root, g);
    stirPolish.sync(root);
  }
  function fitViewport() {
    root.style.setProperty('--game-scale', Math.min(innerWidth / 1280, innerHeight / 720));
    syncIngredientPointerTip();
    syncRecipePointerTip();
  }
  window.addEventListener('resize', fitViewport);
  fitViewport();
  g.onStoryCue = kind => window.LunaJohnnyMemory.cue(kind, ui.gimmickAudio !== false);
  g.onChange = () => {};
  campaign = window.lunaCampaign = window.LunaCampaign.create({
    g,
    D,
    ui,
    outside,
    app: root,
    render,
    bgm,
    clearInput: releaseBackgroundInput
  });
  window.lunaQA = window.LunaQALab.create({
    g,
    D,
    ui,
    outside,
    render,
    clearInput: clearControlSkip
  });
  window.LunaSettings.restore();
  render(true);
  window.LunaFocusSettings.startLoop(frame);
  window.LunaCtrlDiagnostic(() => ({
    held: ui.readSkip,
    phase: g.phase,
    screen: g.screen,
    history: g.history.length,
    dialogue: !!g.dialogue,
    choice: !!g.choice,
    paused: g.isPaused(),
    hidden: g.hidden,
    overlay: g.overlay,
    inspector: ui.inspector,
    drag: !!ui.drag,
    camera: g.cameraMoving,
    cameraLeft: g.cameraLeft,
    transition: g.transition,
    typing: g.dialogue ? g.dialogue.chars < g.dialogue.text.length : false
  }));
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJiZ20iLCJ3aW5kb3ciLCJiYXJCZ20iLCJMdW5hQmFyQmdtIiwiQyIsIkx1bmFDb3JlIiwiRCIsIm1pbGxpbGl0cmVEYXRhIiwiTFVOQV9EQVRBIiwiZyIsIkdhbWUiLCJyb290IiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwicmVtaXgiLCJMdW5hUmVtaXgiLCJhdHRhY2giLCJtaW5pIiwiTHVuYU1pbmlnYW1lcyIsImJhckdhbWUiLCJiYXJEYXRhIiwic2l0ZUhvbWUiLCJ0ZXN0IiwibG9jYXRpb24iLCJwYXRobmFtZSIsInJlYWQiLCJTZXQiLCJKU09OIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwidWkiLCJzZXJ2aWNlVmVyc2lvbiIsIm91dHNpZGUiLCJtaW5pZ2FtZXMiLCJ2YXJpYW50IiwiZGlmZmljdWx0eSIsImFzc2lzdCIsInJlbWl4RmlsdGVyIiwicmVtaXhBdWRpbyIsImdpbW1pY2tBdWRpbyIsInNoYWtlU291bmQiLCJzdGlyU291bmQiLCJwb3VyUHJlc2VudGF0aW9uIiwiZGF5IiwibW9kZSIsInNlZWQiLCJ1cGtlZXAiLCJzaGVsZlBhZ2UiLCJob3Zlckl0ZW0iLCJ0YWIiLCJwZWVrIiwiaW5zcGVjdG9yIiwiZG9zc2llciIsImRvc3NpZXJEZXRhaWwiLCJkb3NzaWVyUHJldmlldyIsImRvc3NpZXJUZXN0QWN0b3IiLCJzb3VuZCIsImF1dG8iLCJyZWFkU2tpcCIsImRyYWciLCJsYXN0RWZmZWN0Iiwic2hha2VNb2RlIiwiTHVuYVNoYWtlUmh5dGhtIiwibm9ybWFsaXplTW9kZSIsInNoYWtlUmh5dGhtIiwibWl4VHV0b3JpYWwiLCJMdW5hTWl4VHV0b3JpYWwiLCJlc2MiLCJzIiwiU3RyaW5nIiwicmVwbGFjZSIsImMiLCJMIiwia28iLCJlbiIsImxhbmciLCJmbXQiLCJuIiwiTWF0aCIsInJvdW5kIiwidG9Mb2NhbGVTdHJpbmciLCJwaGFzZSIsInJlYWR5Iiwib3BlbmluZyIsImdlbmVyYWwiLCJyZWd1bGFyIiwicHJhY3RpY2UiLCJjb21wbGV0ZSIsImdhbWVvdmVyIiwiYSIsImtleSIsImFzc2V0cyIsInNyYyIsImJ1dHRvbiIsImxhYmVsIiwiYWN0IiwibW9yZSIsImNscyIsInBvdXJWaWV3IiwiTHVuYVBvdXJWaWV3IiwiaW5jbHVkZXMiLCJ0dXRvcmlhbFZpZXciLCJMdW5hRGF5MFR1dG9yaWFsIiwib3BlblZpZXciLCJMdW5hT3BlblZpZXciLCJzaGFrZVBvbGlzaCIsIkx1bmFTaGFrZVBvbGlzaCIsInN0aXJQb2xpc2giLCJMdW5hU3RpclBvbGlzaCIsIm1vbmV5IiwibGFiZWxUeXBlIiwidCIsInBvdXIiLCJmaWxsX3VwIiwib3BlbiIsInNoYWtlIiwic3RpciIsImFkZCIsInNxdWVlemUiLCJwb3dkZXIiLCJpdGVtQXJ0IiwiaWQiLCJ1c2FnZSIsIm5hbWUiLCJkcmlua0FydCIsImNvY2t0YWlsIiwiZ2xhc3MiLCJsYXllcnMiLCJhY3RvciIsImV4cHJlc3Npb24iLCJ0YWxraW5nIiwic3RhdGVzIiwiY2hhcmFjdGVyTGF5ZXJzIiwic3RhdGUiLCJrZXlzIiwiT2JqZWN0IiwiZmluZCIsImsiLCJ0b0xvd2VyQ2FzZSIsImVuZHNXaXRoIiwiYWN0b3JIVE1MIiwiZ3Vlc3QiLCJ4Iiwidmlld3MiLCJ0YWdnZWQiLCJyYXciLCJjb3VudCIsInVzZWQiLCJodG1sIiwic3RhY2siLCJwYXJ0cyIsInNwbGl0IiwicCIsIm0iLCJtYXRjaCIsInRhZyIsInRhYmxlcyIsInRleHRfdGFncyIsImxlbmd0aCIsInBvcCIsImtpbmQiLCJ2YWx1ZSIsInB1c2giLCJtYXgiLCJmbG9vciIsInNsaWNlIiwicmVwZWF0Iiwic3RvcnlDcmFmdFJlbWluZGVyIiwic2NyZWVuIiwiY3VycmVudE9yZGVyIiwiZHJpbmsiLCJkaWFsb2d1ZSIsImNob2ljZSIsInN0b3J5Iiwic3RlcHMiLCJpbmRleCIsInR5cGUiLCJjYW1lcmFNb3ZpbmciLCJjYW1lcmFMZWZ0IiwidHJhbnNpdGlvbiIsImNyYWZ0UmVtaW5kZXIiLCJkaWFsb2d1ZUhUTUwiLCJyZW1pbmRlciIsImQiLCJjdXJyZW50RGlhbG9ndWUiLCJzZWF0cyIsImZvY3VzIiwibGluZXMiLCJsaW5lSW5kZXgiLCJpbnRlcmFjdGl2ZSIsInN0b3J5Q29hc3RlciIsInBsYXllciIsInNwZWFrZXIiLCJhcHBlYXJhbmNlIiwic3BlYWtlck5hbWUiLCJkaWFsb2d1ZUFuY2hvciIsInRleHQiLCJjaGFycyIsIkx1bmFEaWFsb2d1ZUN1ZSIsImN1cnJlbmN5VmlldyIsIkx1bmFDdXJyZW5jeVZpZXciLCJyZWR1Y2VkTW9uZXlNb3Rpb24iLCJtYXRjaE1lZGlhIiwiY3VycmVuY3lIVE1MIiwidXBkYXRlIiwicHJvZ3Jlc3MiLCJoaWRkZW4iLCJyZWR1Y2VkTW90aW9uIiwibWF0Y2hlcyIsIm9yaWdpbmFsU2VydmljZVRpcEhUTUwiLCJhY3RpdmUiLCJtaW5pZ2FtZSIsImZpbmlzaGVkIiwiaXNQYXVzZWQiLCJvcmRlciIsIndvcmxkSFRNTCIsImNhblNraXBTdG9yeUNyYWZ0IiwiY2FtcGFpZ24iLCJ2aWV3IiwiYmxvY2tpbmciLCJ0dXRvcmlhbCIsInNraXBTdG9yeUNyYWZ0IiwiY2xlYXJDb250cm9sU2tpcCIsImZsYWdzIiwiZGF5MF9yZWNpcGVfdGF1Z2h0IiwiZGF5MF9wb3VyX3RhdWdodCIsImxvZyIsInNraXBwZWQiLCJvcGVuUmVjaXBlcyIsInNlbGVjdENvY2t0YWlsIiwiRXJyb3IiLCJkZWJ1Z0NyYWZ0IiwiZXJyb3IiLCJyZXN1bHRMb2NrIiwib2ZmZXIiLCJzZXJ2ZSIsInNlYXQiLCJvcmRlcklkIiwiZ3JhZGUiLCJyZWNpcGVPcGVuIiwidG9hc3QiLCJza2lwU3RvcnlDcmFmdEhUTUwiLCJiYXJIVE1MIiwiY2FuQ29hc3RlciIsInN0b3J5Q29hc3RlclJlYWR5IiwiZnJlZUNob2ljZSIsInJvd3MiLCJtYXAiLCJvayIsImNvbmRpdGlvbiIsIndoZW4iLCJjdHgiLCJzZXEiLCJqb2luIiwicmVhc2tpbmciLCJzZWxlY3RlZCIsInVwa2VlcElucHV0SFRNTCIsInJvdyIsImRheXMiLCJOdW1iZXIiLCJiYXNlIiwidXBrZWVwX2dvbGQiLCJzdGFydEhUTUwiLCJjdXRzY2VuZXMiLCJMdW5hQ3V0c2NlbmVMaWJyYXJ5IiwicmVtaXhVSSIsInRhYnNIVE1MIiwibG9iYnlIVE1MIiwibWluaVVJIiwibm90ZXMiLCJyZWNpcGVMaW5lcyIsInJlY2lwZXMiLCJmaWx0ZXIiLCJyIiwiY29udGV4dCIsImluZ3JlZGllbnQiLCJxdHkiLCJ1bml0IiwiYWN0aW9uIiwibWl4IiwidGltZV9saW1pdF9zZWMiLCJyZWNpcGVzSFRNTCIsImF2YWlsYWJsZSIsImNvY2t0YWlsc0F2YWlsYWJsZSIsInVubG9ja2VkSWRzIiwiYWxsIiwiY29ja3RhaWxzIiwic29ydCIsImIiLCJoYXMiLCJsb2NhbGVDb21wYXJlIiwicmVzb3VyY2VDbG9zZSIsInNvbWUiLCJ0b1VwcGVyQ2FzZSIsInByaWNlIiwidW5sb2NrX2RheSIsInJlY2lwZVBhbmVsIiwicHJldmlldyIsInByZXBIVE1MIiwiZ2ltbWlja0hUTUwiLCJnaW1taWNrIiwiZmx1aWQiLCJtaXhIVE1MIiwicmVzdWx0SFRNTCIsInNlcnZlVmlldyIsInRvdGFsc0hUTUwiLCJ0b3RhbHMiLCJ2Iiwic2FsZXNIVE1MIiwidHJhbnNhY3Rpb25zIiwic2VydmVkIiwibmV0IiwibW9kYWwiLCJ0aXRsZSIsImJvZHkiLCJ3aWRlIiwiY2xvc2UiLCJET1NTSUVSX1JPU1RFUiIsIkx1bmFTdG9yeU5vdGljZXMiLCJyb3N0ZXIiLCJET1NTSUVSX01FVF9GTEFHUyIsImNocmlzIiwicG9ydCIsImFpbGkiLCJidWJpIiwic2hpYmEiLCJzYW1obyIsInRvbSIsImRvc3NpZXJTdGF0ZSIsInN0YWdlIiwibWV0IiwiY2hhcmFjdGVyIiwiY2hhcmFjdGVycyIsImFmZiIsImFmZmluaXR5IiwiZG9zc2llclBvcnRyYWl0Iiwic2FtcGxlIiwiZnciLCJmcmFtZVdpZHRoIiwidyIsImZyYW1lcyIsImZoIiwiaCIsImJveGVzIiwiYWxwaGFCQm94IiwibWluIiwieSIsImFmZmluaXR5QmFyIiwiZG9zc2llclNlY3Rpb24iLCJ1bmxvY2tlZCIsImNvbnRlbnQiLCJkb3NzaWVyRGV0YWlsSFRNTCIsInBlbmRpbmciLCJiYXNpYyIsInByb2ZpbGVDbG9zZSIsImRldGFpbCIsImZvbGRlciIsImRvc3NpZXJIVE1MIiwic3QiLCJkb3NzaWVySW5zcGVjdG9ySFRNTCIsImRvc3NpZXJCYWNrIiwicmVuZGVyIiwicHJldmVudFNjcm9sbCIsIm92ZXJsYXkiLCJoZWxwSFRNTCIsImdyb3VwIiwiZmlsZW5hbWUiLCJzZXJ2aWNlSFRNTCIsInRvZ2dsZVNlcnZpY2UiLCJvcGVuVHV0b3JpYWxTZXJ2aWNlIiwic2hvdyIsImluZ3JlZGllbnRXYXJuaW5nSFRNTCIsImRhaWx5VW5sb2Nrc0hUTUwiLCJmcmVzaCIsImRhaWx5VW5sb2NrcyIsInNlY3Rpb24iLCJpbmdyZWRpZW50cyIsImpvaG5ueVVubG9ja0hUTUwiLCJvdmVybGF5SFRNTCIsIkx1bmFTZXR0aW5ncyIsIm9uQ2xvc2UiLCJleGl0TGFiZWwiLCJvbkV4aXQiLCJpbmdyZWRpZW50SFRNTCIsImRldGFpbHNIVE1MIiwiZ29hbHNIVE1MIiwiaGlzdG9yeSIsImFub255bW91cyIsImNyYWZ0IiwiYWN0dWFsIiwidXBrZWVwSW5zcGVjdG9ySFRNTCIsImluZm8iLCJ1cGtlZXBJbmZvIiwiYW1vdW50Iiwic291cmNlIiwiaW5zcGVjdG9ySFRNTCIsInN0ZXAiLCJiYXJUaW1lIiwidG9GaXhlZCIsInF1ZXVlIiwicXVldWVJbmRleCIsInNjZW5lIiwiZWZmZWN0cyIsImxlZnQiLCJsaW1pdCIsInNwZWVkIiwic3RyaW5naWZ5IiwibG9ncyIsInJldmVyc2UiLCJlIiwidGltZSIsImV2ZW50IiwiYnJhbmNoIiwiaW1wb3J0ZWRBdCIsInNldHRsZW1lbnRIVE1MIiwiTHVuYVNldHRsZW1lbnRWaWV3IiwibWFpbiIsImNoYWxsZW5nZSIsImdhbWVvdmVySFRNTCIsImVycm9ySFRNTCIsIm1vcnBoIiwicGFyZW50IiwibmV4dCIsImkiLCJjaGlsZE5vZGVzIiwicmVtb3ZlQ2hpbGQiLCJhcHBlbmRDaGlsZCIsImNsb25lTm9kZSIsIm5vZGVUeXBlIiwibm9kZU5hbWUiLCJyZXBsYWNlV2l0aCIsIm5vZGVWYWx1ZSIsImRhdGFzZXQiLCJjbGFzc0xpc3QiLCJzdHlsZSIsInNldFByb3BlcnR5IiwiZ2V0UHJvcGVydHlWYWx1ZSIsImF0dHIiLCJhdHRyaWJ1dGVzIiwiaGFzQXR0cmlidXRlIiwicmVtb3ZlQXR0cmlidXRlIiwiZ2V0QXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwiYWN0aXZlRWxlbWVudCIsIkx1bmFCYXJWaWV3cyIsIkx1bmFTZXJ2ZVZpZXciLCJMdW5hUmVtaXhVSSIsIlVSTFNlYXJjaFBhcmFtcyIsInNlYXJjaCIsImdldCIsInJlc2V0Iiwib3V0c2lkZVBsYXl0ZXN0IiwiTHVuYU91dHNpZGUiLCJjcmVhdGUiLCJjcmVhdGVVSSIsIm1pbmlMb2JieSIsIm1pbmlTdGFydCIsInNldEl0ZW0iLCJzdGFydE1pbmlnYW1lIiwicmVjaXBlUG9pbnRlciIsImluZ3JlZGllbnRQb2ludGVyIiwic3luY0luZ3JlZGllbnRQb2ludGVyVGlwIiwidGlwIiwicGFuZWwiLCJwYXJlbnRFbGVtZW50IiwiaXRlbSIsImJvdW5kcyIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInN4Iiwid2lkdGgiLCJvZmZzZXRXaWR0aCIsInN5IiwiaGVpZ2h0Iiwib2Zmc2V0SGVpZ2h0IiwicG9pbnRlciIsInJpZ2h0IiwidG9wIiwiZ2FwIiwibWFyZ2luIiwiaW5uZXJXaWR0aCIsImJvdHRvbSIsImlubmVySGVpZ2h0IiwiY2xpZW50TGVmdCIsImNsaWVudFRvcCIsInN5bmNSZWNpcGVQb2ludGVyVGlwIiwic2xvdCIsImlzQ29ubmVjdGVkIiwic2Nyb2xsIiwiY2xvc2VzdCIsImNob2ljZUhvbGQiLCJMdW5hQ2hvaWNlSG9sZCIsImFsbG93ZWQiLCJjb21taXQiLCJsYXN0U3RydWN0dXJlIiwibGFzdEZvY3VzZWRDaG9pY2UiLCJmb3JjZSIsImRvb3JUcmFuc2l0aW9uIiwiY29tbWl0dGluZyIsInVwZGF0ZVNoZWxmIiwic3luY0NhbWVyYSIsInNjcm9sbHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY2xhc3NOYW1lIiwic2Nyb2xsVG9wIiwibGl2ZUJhciIsImJsb2NrZWQiLCJwYXVzZWQiLCJpbmRleE9mIiwiZGF5MF9zZWF0c19yZXZlYWxlZCIsImluZGljYXRvciIsInNlYXRJbmRpY2F0b3IiLCJvdmVydmlldyIsImh1ZEhUTUwiLCJlZmZlY3RWaXN1YWwiLCJyZWFsVGltZSIsInVudGlsIiwidGVtcGxhdGUiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwiZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSIsInN5bmMiLCJsZXNzb24iLCJ0b2dnbGVBdHRyaWJ1dGUiLCJjb250YWlucyIsImRpYWxvZyIsIndhcm5pbmciLCJmaXJzdCIsIm1zZyIsImVsIiwidGV4dENvbnRlbnQiLCJjbGVhclRpbWVvdXQiLCJ0aW1lciIsInNldFRpbWVvdXQiLCJyZW1vdmUiLCJleHBvcnRMb2ciLCJwYXlsb2FkIiwiY3JlYXRlZEF0IiwiRGF0ZSIsInRvSVNPU3RyaW5nIiwiZGFpbHlTZXR0bGVtZW50IiwidXBrZWVwT3ZlcnJpZGUiLCJ1cmwiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJCbG9iIiwiaHJlZiIsImRvd25sb2FkIiwibm93IiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJoZWxkIiwic2FmZSIsImNvbmZpcm1Kb2hubnlVbmxvY2siLCJhbGxvd3MiLCJjb25maXJtRGFpbHlVbmxvY2tzIiwidW5sb2NrQXVkaW8iLCJpbnRlcmNlcHQiLCJtYWluU3RvcnlMb2NrZWQiLCJzZWxlY3QiLCJnaW1taWNrSW5wdXQiLCJtaW5pSW5ncmVkaWVudEtpbmQiLCJyZXRyeU1pbmlnYW1lIiwic3RhcnRlZCIsInBsYXkiLCJzZXRGaWx0ZXIiLCJwYXJzZVVwa2VlcE92ZXJyaWRlIiwic3RvcnlQcmVyZXF1aXNpdGVzIiwic2Vzc2lvbiIsImRldmVsb3BlciIsIm1lc3NhZ2UiLCJjb25maXJtRGFpbHlTZXR0bGVtZW50IiwicmVjb3JkUnVuIiwic2V0VXBrZWVwT3ZlcnJpZGUiLCJkZWJ1ZyIsInVuc2VydmVkT3JkZXIiLCJmaW5pc2hEYXkiLCJhZHZhbmNlIiwiY2hvb3NlIiwidG9nZ2xlT3ZlcnZpZXciLCJmb2N1c1NlYXQiLCJyZWFzayIsImZyb21TZXJ2aWNlIiwiY2xvc2VSZWNpcGVzIiwiY29udGludWVCYXJUdXRvcmlhbCIsInR1dG9yaWFsRXZlbnQiLCJjYXRlZ29yaWVzIiwibmF2aWdhdGVTaGVsZiIsInBpY2tPcGVuZXIiLCJwaWNrSXRlbSIsInByZXBCYWNrIiwic3RhcnRDcmFmdCIsImVuZEdpbW1pY2siLCJkaXNjYXJkIiwiZGVidWdGaWxsIiwicmV0cnlEYXRhRXJyb3IiLCJjYW5jZWxDcmFmdCIsInNldEVuYWJsZWQiLCJlbmFibGVkIiwiYWRkRXZlbnRMaXN0ZW5lciIsInRhcmdldCIsImRpc2FibGVkIiwiZXJyIiwiY2hhbmdlIiwiY2hlY2tlZCIsImRpYWxvZ1NwZWVkIiwiaW5wdXQiLCJMdW5hU2Z4Iiwic2V0Vm9sdW1lIiwiZGV0YWlscyIsImhvdmVyUmVjaXBlIiwiaG92ZXJJbmdyZWRpZW50IiwiY2FuSG92ZXIiLCJzdGFydHNXaXRoIiwiY2xpZW50WCIsImNsaWVudFkiLCJ0cmFja1JlY2lwZVBvaW50ZXIiLCJMdW5hSG92ZXJBdWRpbyIsImJpbmQiLCJjYW5Ib3Zlckl0ZW0iLCJsZWF2ZUluZ3JlZGllbnQiLCJmcm9tIiwidG8iLCJyZWxhdGVkVGFyZ2V0IiwicHJldmVudERlZmF1bHQiLCJyaHl0aG1QYWQiLCJob2xkIiwiaG9sZFBvdXIiLCJnaG9zdCIsIkx1bmFHYW1lVmlld3BvcnQiLCJwb3NpdGlvbkRyYWciLCJ6b25lIiwiZWxlbWVudEZyb21Qb2ludCIsImNvYXN0ZXIiLCJkcm9wIiwiY29udHJvbEtleXMiLCJpc0NvbnRyb2xLZXkiLCJjb2RlIiwia2V5Q29kZSIsImNvbnRyb2xLZXlJZCIsImNsZWFyIiwiZm9jdXNhYmxlIiwic2hpZnRLZXkiLCJidXR0b25zIiwidGFnTmFtZSIsImlzQ29udGVudEVkaXRhYmxlIiwic2NvcGUiLCJlbHMiLCJkZWx0YSIsImRlbGV0ZSIsInNpemUiLCJyZWxlYXNlQmFja2dyb3VuZElucHV0Iiwic3luY0ZvY3VzUGF1c2UiLCJMdW5hRm9jdXNTZXR0aW5ncyIsImhpZGRlblBhdXNlZCIsImxhc3RSZW5kZXIiLCJhdXRvVGltZXIiLCJsYXN0RGlhbG9ndWUiLCJsYXN0UmVhZENvdW50Iiwic2tpcFRpbWVyIiwiZnJhbWUiLCJkdCIsInN5bmNMb2NhdGlvbiIsInRpY2siLCJsdW5hUUEiLCJzb3VuZFRpY2siLCJob2xkU3BlZWNoIiwiQXVkaW9Db250ZXh0Iiwib3NjIiwiY3JlYXRlT3NjaWxsYXRvciIsImdhaW4iLCJjcmVhdGVHYWluIiwiY29ubmVjdCIsIm91dHB1dCIsImZyZXF1ZW5jeSIsInNldFZhbHVlQXRUaW1lIiwiY3VycmVudFRpbWUiLCJleHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lIiwic3RhcnQiLCJzdG9wIiwib25lbmRlZCIsInJlbGVhc2UiLCJyZW5kZXJNcyIsInN5bmNTdGlyTW90aW9uIiwiZml0Vmlld3BvcnQiLCJvblN0b3J5Q3VlIiwiTHVuYUpvaG5ueU1lbW9yeSIsImN1ZSIsIm9uQ2hhbmdlIiwibHVuYUNhbXBhaWduIiwiTHVuYUNhbXBhaWduIiwiYXBwIiwiY2xlYXJJbnB1dCIsIkx1bmFRQUxhYiIsInJlc3RvcmUiLCJzdGFydExvb3AiLCJMdW5hQ3RybERpYWdub3N0aWMiLCJjYW1lcmEiLCJ0eXBpbmciXSwic291cmNlcyI6WyJhcHAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7XG4ndXNlIHN0cmljdCc7XG5jb25zdCBiZ209d2luZG93LmJhckJnbT1uZXcgd2luZG93Lkx1bmFCYXJCZ20oKTtcbmNvbnN0IEM9d2luZG93Lkx1bmFDb3JlLEQ9Qy5taWxsaWxpdHJlRGF0YSh3aW5kb3cuTFVOQV9EQVRBKSxnPW5ldyBDLkdhbWUoRCkscm9vdD1kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYXBwJyk7XG5jb25zdCByZW1peD13aW5kb3cuTHVuYVJlbWl4LmF0dGFjaChnKTtjb25zdCBtaW5pPXdpbmRvdy5MdW5hTWluaWdhbWVzLmF0dGFjaChnKTt3aW5kb3cuYmFyR2FtZT1nO3dpbmRvdy5iYXJEYXRhPUQ7XG5jb25zdCBzaXRlSG9tZT0vXFwvYmFyLXBsYXl0ZXN0XFwvKD86aW5kZXhcXC5odG1sKT8kLy50ZXN0KGxvY2F0aW9uLnBhdGhuYW1lKTtcbnRyeXtnLnJlYWQ9bmV3IFNldChKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdsdW5hLmJhci5wbGF5dGVzdC5yZWFkLnYxJyl8fCdbXScpKTt9Y2F0Y2h7fVxuY29uc3QgdWk9e3NlcnZpY2VWZXJzaW9uOidBJyxvdXRzaWRlOmZhbHNlLG1pbmlnYW1lczpmYWxzZSx2YXJpYW50OidvcmlnaW5hbCcsZGlmZmljdWx0eTonc3RhbmRhcmQnLGFzc2lzdDp0cnVlLHJlbWl4RmlsdGVyOidhbGwnLHJlbWl4QXVkaW86dHJ1ZSxnaW1taWNrQXVkaW86dHJ1ZSxzaGFrZVNvdW5kOjEsc3RpclNvdW5kOjEscG91clByZXNlbnRhdGlvbjonY2xhc3NpYycsZGF5OjAsbW9kZTonZnVsbCcsc2VlZDoxLHVwa2VlcDonJyxzaGVsZlBhZ2U6MCxob3Zlckl0ZW06bnVsbCx0YWI6J2dsYXNzJyxwZWVrOm51bGwsaW5zcGVjdG9yOmZhbHNlLGRvc3NpZXI6J2NocmlzJyxkb3NzaWVyRGV0YWlsOm51bGwsZG9zc2llclByZXZpZXc6bnVsbCxkb3NzaWVyVGVzdEFjdG9yOidjaHJpcycsc291bmQ6ZmFsc2UsYXV0bzpmYWxzZSxyZWFkU2tpcDpmYWxzZSxkcmFnOm51bGwsbGFzdEVmZmVjdDpudWxsfTtcbi8vIFJlc2V0IHRoZSBwcmV2aW91cyBkZWZhdWx0IG9uY2U7IHN1YnNlcXVlbnQgZXhwbGljaXQgY2hvaWNlcyByZW1haW4gcGVyc2lzdGVudC5cbnRyeXtjb25zdCBtb2RlPWxvY2FsU3RvcmFnZS5nZXRJdGVtKCdsdW5hLnNoYWtlLm1vZGUudjInKTt1aS5zaGFrZU1vZGU9d2luZG93Lkx1bmFTaGFrZVJoeXRobS5ub3JtYWxpemVNb2RlKG1vZGUpO31jYXRjaHt1aS5zaGFrZU1vZGU9J3BhdGgnO31cbmNvbnN0IHNoYWtlUmh5dGhtPXdpbmRvdy5MdW5hU2hha2VSaHl0aG0uYXR0YWNoKGcsKCk9PnVpLnNoYWtlTW9kZSk7XG5jb25zdCBtaXhUdXRvcmlhbD13aW5kb3cuTHVuYU1peFR1dG9yaWFsLmF0dGFjaChnKTtcbnRyeXt1aS5zaGFrZVNvdW5kPWxvY2FsU3RvcmFnZS5nZXRJdGVtKCdsdW5hLnNoYWtlLnNvdW5kLnYyJyk9PT0nMic/MjoxO31jYXRjaHt9XG5jb25zdCBlc2M9cz0+U3RyaW5nKHM/PycnKS5yZXBsYWNlKC9bJjw+XCInXS9nLGM9Pih7JyYnOicmYW1wOycsJzwnOicmbHQ7JywnPic6JyZndDsnLCdcIic6JyZxdW90OycsXCInXCI6JyYjMzk7J31bY10pKTtcbmNvbnN0IEw9KGtvLGVuKT0+Zy5sYW5nPT09J2tvJz9rbzplbjtjb25zdCBmbXQ9bj0+TWF0aC5yb3VuZChuKS50b0xvY2FsZVN0cmluZygpO2NvbnN0IHBoYXNlPSgpPT4oe3JlYWR5OkwoJ+2UjOugiOydtO2FjOyKpO2KuCDspIDruYQnLCdQbGF5dGVzdCBzZXR1cCcpLG9wZW5pbmc6TCgn6rCc7KCQIOyghCDrjIDtmZQnLCdCZWZvcmUgb3BlbmluZycpLGdlbmVyYWw6TCgn7J2867CYIOyGkOuLmCDsmIHsl4UnLCdHZW5lcmFsIGd1ZXN0IHNlcnZpY2UnKSxyZWd1bGFyOkwoJ+uLqOqzqCDshpDri5gg7JiB7JeFJywnUmVndWxhciBndWVzdCBzZXJ2aWNlJykscHJhY3RpY2U6TCgn7KCc7KGwIOyXsOyKtScsJ0NyYWZ0IHByYWN0aWNlJyksY29tcGxldGU6TCgn7JiB7JeFIOygleyCsCcsJ0RhaWx5IHNldHRsZW1lbnQnKSxnYW1lb3ZlcjpMKCfqsozsnoTsmKTrsoQnLCdHYW1lIG92ZXInKX0pW2cucGhhc2VdO1xuY29uc3QgYT0oa2V5KT0+RC5hc3NldHNba2V5XT8uc3JjO2NvbnN0IGJ1dHRvbj0obGFiZWwsYWN0LG1vcmU9JycsY2xzPScnKT0+YDxidXR0b24gY2xhc3M9XCIke2Nsc31cIiBkYXRhLWFjdD1cIiR7YWN0fVwiICR7bW9yZX0+JHtsYWJlbH08L2J1dHRvbj5gO1xuY29uc3QgcG91clZpZXc9d2luZG93Lkx1bmFQb3VyVmlldyh7ZyxELEwsZXNjLGJ1dHRvbix1aX0pO1xudHJ5e2NvbnN0IG1vZGU9bG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2x1bmEucG91ci5wcmVzZW50YXRpb24udjEnKTtpZihbJ2NsYXNzaWMnLCdjbGVhbicsJ2JvdHRsZSddLmluY2x1ZGVzKG1vZGUpKXVpLnBvdXJQcmVzZW50YXRpb249bW9kZTt9Y2F0Y2h7fVxuY29uc3QgdHV0b3JpYWxWaWV3PXdpbmRvdy5MdW5hRGF5MFR1dG9yaWFsKHtnLHVpLEx9KTtcbmNvbnN0IG9wZW5WaWV3PXdpbmRvdy5MdW5hT3BlblZpZXcoe2csRCxMLGVzYyxidXR0b24sdWl9KTtcbmNvbnN0IHNoYWtlUG9saXNoPXdpbmRvdy5MdW5hU2hha2VQb2xpc2goe2csRCx1aX0pO1xuY29uc3Qgc3RpclBvbGlzaD13aW5kb3cuTHVuYVN0aXJQb2xpc2goe2csdWl9KTtcbnRyeXt1aS5zdGlyU291bmQ9bG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2x1bmEuc3Rpci5zb3VuZC52MScpPT09JzInPzI6MTt9Y2F0Y2h7fVxuY29uc3QgbW9uZXk9bj0+YCR7Zm10KG4pfSBHYDtjb25zdCBsYWJlbFR5cGU9dD0+KHtwb3VyOkwoJ+uUsOultOq4sCcsJ1BvdXInKSxmaWxsX3VwOkwoJ+2VhOyXhScsJ0ZpbGwtdXAnKSxvcGVuOkwoJ+uzkeuUsOq4sCcsJ09wZW4nKSxzaGFrZTpMKCfsiZDsnbTtgrknLCdTaGFrZScpLHN0aXI6TCgn7Iqk7YSwJywnU3RpcicpLGFkZDpMKCfrhKPquLAnLCdBZGQnKSxzcXVlZXplOkwoJ+yKpO2AtOymiCcsJ1NxdWVlemUnKSxwb3dkZXI6TCgn7YyM7Jqw642UJywnUG93ZGVyJyl9KVt0XXx8dDtcbmZ1bmN0aW9uIGl0ZW1BcnQoaWQsY2xzPScnLHVzYWdlPSdzaGVsZicpe2NvbnN0IGxhYmVsPWlkPT09J29wZW5lcic/TCgn67OR65Sw6rCcJywnQm90dGxlIG9wZW5lcicpOmcubmFtZShpZCk7Y29uc3Qga2V5PSh1c2FnZT09PSdyZWNpcGUnJiZhKCdyZWNpcGVfaXRlbV8nK2lkKT8ncmVjaXBlX2l0ZW1fJzp1c2FnZT09PSdpbnZlbnRvcnknJiZhKCdpbnZlbnRvcnlfaXRlbV8nK2lkKT8naW52ZW50b3J5X2l0ZW1fJzonaXRlbV8nKStpZDtyZXR1cm4gJzxpbWcgY2xhc3M9XCInK2NscysnXCIgc3JjPVwiJysoYShrZXkpfHxhKCdpdGVtX2R1bW15JykpKydcIiBhbHQ9XCInK2VzYyhsYWJlbCkrJ1wiIGRyYWdnYWJsZT1cImZhbHNlXCI+Jzt9XG5mdW5jdGlvbiBkcmlua0FydChpZCx1c2FnZT0naGVybycpe2NvbnN0IGM9Zy5jb2NrdGFpbChpZCksa2V5PXVzYWdlPT09J3RhYmxlJz8ndGFibGVfY29ja3RhaWxfJytpZDp1c2FnZT09PSdyZWNpcGUnPydyZWNpcGVfY29ja3RhaWxfJytpZDonY29ja3RhaWxfJytpZDtjb25zdCBzcmM9YShrZXkpfHxhKCdjb2NrdGFpbF8nK2lkKXx8YSgncmVjaXBlX2NvY2t0YWlsXycraWQpfHxhKCdpdGVtXycrYy5nbGFzcyk7cmV0dXJuICc8aW1nIGNsYXNzPVwiZHJpbmstYXJ0XCIgc3JjPVwiJytzcmMrJ1wiIGRhdGEtYXJ0LXVzYWdlPVwiJyt1c2FnZSsnXCIgYWx0PVwiJytlc2MoZy5uYW1lKGlkKSkrJ1wiIGRyYWdnYWJsZT1cImZhbHNlXCI+Jzt9XG5mdW5jdGlvbiBsYXllcnMoYWN0b3IsZXhwcmVzc2lvbix0YWxraW5nKXtjb25zdCBzdGF0ZXM9RC5jaGFyYWN0ZXJMYXllcnNbYWN0b3JdO2lmKCFzdGF0ZXMpcmV0dXJuIG51bGw7bGV0IHN0YXRlPWV4cHJlc3Npb258fCdpZGxlJztpZihzdGF0ZT09PSdkZWZhdWx0JylzdGF0ZT0naWRsZSc7Y29uc3Qga2V5cz1PYmplY3Qua2V5cyhzdGF0ZXMpO2xldCBrZXk9a2V5cy5maW5kKGs9PmsudG9Mb3dlckNhc2UoKS5lbmRzV2l0aChzdGF0ZS50b0xvd2VyQ2FzZSgpKydfJysodGFsa2luZz8ndGFsayc6J2RlZmF1bHQnKSkpfHxrZXlzLmZpbmQoaz0+ay5lbmRzV2l0aCgnaWRsZV8nKyh0YWxraW5nPyd0YWxrJzonZGVmYXVsdCcpKSl8fGtleXMuZmluZChrPT5rLmVuZHNXaXRoKCdpZGxlX2RlZmF1bHQnKSl8fGtleXNbMF07cmV0dXJuIHN0YXRlc1trZXldO31cbmZ1bmN0aW9uIGFjdG9ySFRNTChndWVzdCx4KXtyZXR1cm4gdmlld3MuYWN0b3JIVE1MKGd1ZXN0LHgpO31cbmZ1bmN0aW9uIHRhZ2dlZChyYXcsY291bnQpe2xldCB1c2VkPTAsaHRtbD0nJyxzdGFjaz1bXTtjb25zdCBwYXJ0cz1TdHJpbmcocmF3KS5zcGxpdCgvKDxcXC8/W2Etel0rPikvZyk7Zm9yKGNvbnN0IHAgb2YgcGFydHMpe2NvbnN0IG09cC5tYXRjaCgvXjwoXFwvPykoW2Etel0rKT4kLyk7aWYobSl7Y29uc3QgdGFnPUQudGFibGVzLnRleHRfdGFncy5maW5kKHQ9PnQudGFnPT09bVsyXSk7aWYoIXRhZyljb250aW51ZTtpZihtWzFdKXtpZihzdGFjay5sZW5ndGgpe2h0bWwrPSc8L3NwYW4+JztzdGFjay5wb3AoKTt9fWVsc2Uge2h0bWwrPWA8c3BhbiBzdHlsZT1cIiR7dGFnLmtpbmQ9PT0nY29sb3InPydjb2xvcjonK3RhZy52YWx1ZTp0YWcua2luZD09PSdzaXplX3BjdCc/J2ZvbnQtc2l6ZTonK3RhZy52YWx1ZSsnJSc6Jyd9XCI+YDtzdGFjay5wdXNoKG1bMl0pO319ZWxzZXtjb25zdCBuPU1hdGgubWF4KDAsTWF0aC5mbG9vcihjb3VudCktdXNlZCk7aHRtbCs9ZXNjKHAuc2xpY2UoMCxuKSk7dXNlZCs9cC5sZW5ndGg7fX1yZXR1cm4gaHRtbCsnPC9zcGFuPicucmVwZWF0KHN0YWNrLmxlbmd0aCk7fVxuZnVuY3Rpb24gc3RvcnlDcmFmdFJlbWluZGVyKCl7cmV0dXJuIFsncmVndWxhcicsJ29wZW5pbmcnXS5pbmNsdWRlcyhnLnBoYXNlKSYmZy5zY3JlZW49PT0nYmFyJyYmZy5jdXJyZW50T3JkZXImJiFnLmRyaW5rJiYhZy5kaWFsb2d1ZSYmIWcuY2hvaWNlJiZnLnN0b3J5Py5zdGVwc1tnLnN0b3J5LmluZGV4XT8udHlwZT09PSdjcmFmdCcmJiFnLmNhbWVyYU1vdmluZyYmZy5jYW1lcmFMZWZ0PT09MCYmZy50cmFuc2l0aW9uPT09MD9nLmNyYWZ0UmVtaW5kZXI6bnVsbDt9XG5mdW5jdGlvbiBkaWFsb2d1ZUhUTUwoKXtpZih1aS5kcmFnKXJldHVybiAnJztjb25zdCByZW1pbmRlcj1zdG9yeUNyYWZ0UmVtaW5kZXIoKSxkPWcuY3VycmVudERpYWxvZ3VlKCl8fChnLnBoYXNlPT09J2dlbmVyYWwnP2cuc2VhdHNbZy5mb2N1c10/LmxpbmVzPy5bZy5zZWF0c1tnLmZvY3VzXT8ubGluZUluZGV4XTpnLmRpYWxvZ3VlKXx8cmVtaW5kZXI7aWYoIWQpcmV0dXJuICcnO2NvbnN0IGludGVyYWN0aXZlPWcucGhhc2UhPT0nZ2VuZXJhbCcmJiFyZW1pbmRlciYmIWcuc3RvcnlDb2FzdGVyLHBsYXllcj1kLmFjdG9yPT09J2x1bmEnO2NvbnN0IHNwZWFrZXI9cGxheWVyP0woJ+ujqOuCmCcsJ0x1bmEnKTpnLnBoYXNlPT09J2dlbmVyYWwnJiZnLnNlYXRzW2cuZm9jdXNdPy5hcHBlYXJhbmNlP0woJ+yGkOuLmCcsJ0d1ZXN0Jyk6Zy5zcGVha2VyTmFtZShkLmFjdG9yKTtyZXR1cm4gYDxkaXYgY2xhc3M9XCJkaWFsb2d1ZS13cmFwICR7cGxheWVyPydwbGF5ZXItc3BlZWNoJzonZ3Vlc3Qtc3BlZWNoJ30gJHtpbnRlcmFjdGl2ZT8nJzonYXV0by1idWJibGUnfVwiICR7dmlld3MuZGlhbG9ndWVBbmNob3IoZC5hY3RvcixkKX0+PGRpdiBjbGFzcz1cImRpYWxvZ3VlLWJveFwiICR7aW50ZXJhY3RpdmU/J2RhdGEtYWN0PVwiYWR2YW5jZVwiIHJvbGU9XCJidXR0b25cIiB0YWJpbmRleD1cIjBcIic6Jyd9PjxzcGFuIGNsYXNzPVwiZGlhbG9ndWUtc3VyZmFjZVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvc3Bhbj48ZGl2IGNsYXNzPVwic3BlYWtlclwiPiR7ZXNjKHNwZWFrZXIpfTwvZGl2PjxkaXYgY2xhc3M9XCJkaWFsb2d1ZS10ZXh0XCI+PHNwYW4gY2xhc3M9XCJ0ZXh0LW1lYXN1cmVcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4ke3RhZ2dlZChkLnJhd3x8ZC50ZXh0LGQudGV4dC5sZW5ndGgpfHwn4oCmJ308L3NwYW4+PHNwYW4gY2xhc3M9XCJ0ZXh0LWlua1wiPiR7dGFnZ2VkKGQucmF3fHxkLnRleHQsZC5jaGFycyl9PC9zcGFuPjwvZGl2PiR7d2luZG93Lkx1bmFEaWFsb2d1ZUN1ZS5odG1sKGludGVyYWN0aXZlJiYhZy5jaG9pY2UmJmQuY2hhcnM+PWQudGV4dC5sZW5ndGgpfTwvZGl2PjwvZGl2PmA7fVxuY29uc3QgY3VycmVuY3lWaWV3PXdpbmRvdy5MdW5hQ3VycmVuY3lWaWV3KCk7XG5jb25zdCByZWR1Y2VkTW9uZXlNb3Rpb249d2luZG93Lm1hdGNoTWVkaWEoXCIocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKVwiKTtcbi8vIFBpeGVsLXN0eWxlIFVJIGljb24sIGluZGVwZW5kZW50IG9mIHBsYXRmb3JtIGVtb2ppIGZvbnRzIGFuZCBnYW1lcGxheSBkYXRhLlxuZnVuY3Rpb24gY3VycmVuY3lIVE1MKCl7cmV0dXJuIHdpbmRvdy5MdW5hQ3VycmVuY3lWaWV3Lmh0bWwoY3VycmVuY3lWaWV3LnVwZGF0ZShnLnByb2dyZXNzLDAsZy5oaWRkZW4pLGcucHJvZ3Jlc3Mse2xhbmc6Zy5sYW5nLHJlZHVjZWRNb3Rpb246cmVkdWNlZE1vbmV5TW90aW9uLm1hdGNoZXN9KTt9XG5mdW5jdGlvbiBvcmlnaW5hbFNlcnZpY2VUaXBIVE1MKCl7XG4gaWYocmVtaXguYWN0aXZlKCl8fGcubWluaWdhbWV8fGcucGhhc2UhPT0nZ2VuZXJhbCd8fGcuc2NyZWVuIT09J2Jhcid8fGcuZmluaXNoZWR8fGcuaXNQYXVzZWQoKSlyZXR1cm4gJyc7XG4gY29uc3QgZ3Vlc3Q9Zy5zZWF0c1tnLmZvY3VzXTtsZXQgdGV4dD0nJztcbiBpZihndWVzdD8uc3RhdGU9PT0nV0FJVF9DT0FTVEVSJyl0ZXh0PUwoJ+y9lOyKpO2EsOulvCDsp5HslrQg7IaQ64uYIOyVnuycvOuhnCDrk5zrnpjqt7jtlZjshLjsmpQnLCdEcmFnIGEgY29hc3RlciBvbnRvIHRoZSB0YWJsZSBpbiBmcm9udCBvZiB0aGUgZ3Vlc3QnKTtcbiBlbHNlIGlmKGd1ZXN0Py5zdGF0ZT09PSdXQUlUX1NFUlZFJyYmZ3Vlc3Qub3JkZXIpdGV4dD1nLmRyaW5rXG4gID9MKCfsmYTshLHrkJwg7Lm17YWM7J287J2EIOyGkOuLmOydmCDsvZTsiqTthLDsl5Ag64aT7Jy87IS47JqUJywnUGxhY2UgdGhlIGZpbmlzaGVkIGNvY2t0YWlsIG9uIHRoZSBndWVzdOKAmXMgY29hc3RlcicpXG4gIDpMKCfshJzruYTsiqQg7Yyo64SQIC0g7Lm17YWM7J28IOugiOyLnO2UvCDrs7TquLDrpbwg64iE66W07IS47JqUJywnU2VydmljZSBwYW5lbCAtIHNlbGVjdCBDb2NrdGFpbCByZWNpcGVzJyk7XG4gcmV0dXJuIHRleHQ/JzxkaXYgY2xhc3M9XCJyZW1peC1jb250ZXh0IG9yaWdpbmFsLXNlcnZpY2UtdGlwXCI+PHNwYW4+Jytlc2ModGV4dCkrJzwvc3Bhbj48L2Rpdj4nOicnO1xufVxuZnVuY3Rpb24gd29ybGRIVE1MKCl7cmV0dXJuIHZpZXdzLndvcmxkSFRNTCgpO31cbi8vIFNpbXVsYXRvci1vbmx5IHNob3J0Y3V0LiBLZWVwIHRoZSBub3JtYWwgY3JhZnQvc2VydmUgcGlwZWxpbmUgYW5kIGl0cyBzdG9yeSBlZmZlY3RzLlxuZnVuY3Rpb24gY2FuU2tpcFN0b3J5Q3JhZnQoKXtyZXR1cm4gY2FtcGFpZ24/LnZpZXc9PT0nZGV2ZWxvcGVyJyYmIWNhbXBhaWduLmFjdGl2ZSYmIWNhbXBhaWduLmJsb2NraW5nJiYhb3V0c2lkZS5hY3RpdmUmJiFnLm1pbmlnYW1lJiZnLnBoYXNlPT09J3JlZ3VsYXInJiZnLnNjcmVlbj09PSdiYXInJiYhIWcuY3VycmVudE9yZGVyJiZnLnN0b3J5Py5zdGVwc1tnLnN0b3J5LmluZGV4XT8udHlwZT09PSdjcmFmdCcmJiFnLmRyaW5rJiYhZy5kaWFsb2d1ZSYmIWcuY2hvaWNlJiYhZy5pc1BhdXNlZCgpJiYhZy5jYW1lcmFNb3ZpbmcmJmcuY2FtZXJhTGVmdD09PTAmJmcudHJhbnNpdGlvbj09PTAmJighZy50dXRvcmlhbHx8Zy50dXRvcmlhbC5raW5kPT09J3JlY2lwZScpO31cbmZ1bmN0aW9uIHNraXBTdG9yeUNyYWZ0KCl7XG4gaWYoIWNhblNraXBTdG9yeUNyYWZ0KCkpcmV0dXJuIGZhbHNlO1xuIGNvbnN0IG9yZGVyPXsuLi5nLmN1cnJlbnRPcmRlcn07Y2xlYXJDb250cm9sU2tpcCgpO3VpLmF1dG89ZmFsc2U7XG4gaWYoZy50dXRvcmlhbD8ua2luZD09PSdyZWNpcGUnKXtnLnR1dG9yaWFsPW51bGw7Zy5wcm9ncmVzcy5mbGFncy5kYXkwX3JlY2lwZV90YXVnaHQ9dHJ1ZTtnLnByb2dyZXNzLmZsYWdzLmRheTBfcG91cl90YXVnaHQ9dHJ1ZTtnLmxvZygndHV0b3JpYWxfY29tcGxldGUnLHtraW5kOidyZWNpcGUnLHNraXBwZWQ6dHJ1ZX0pO31cbiBpZighZy5vcGVuUmVjaXBlcygpfHwhZy5zZWxlY3RDb2NrdGFpbChvcmRlci5jb2NrdGFpbCkpdGhyb3cgRXJyb3IoJ+2FjOyKpO2KuCDso7zrrLjsnZgg66CI7Iuc7ZS866W8IOyEoO2Dne2VoCDsiJgg7JeG7Iq164uI64ukLicpO1xuIGcuZGVidWdDcmFmdCgnZ29vZCcpO2lmKGcuZXJyb3IpdGhyb3cgRXJyb3IoZy5lcnJvcik7aWYoZy5yZW1peClnLnJlbWl4LnJlc3VsdExvY2s9MDtcbiBnLm9mZmVyKCk7aWYoIWcuc2VydmUob3JkZXIuc2VhdCwna2V5Ym9hcmQnKSl0aHJvdyBFcnJvcign7YWM7Iqk7Yq4IOyjvOusuOydhCDsoJzqs7XtlZjsp4Ag66q77ZaI7Iq164uI64ukLicpO1xuIGcubG9nKCdkZWJ1Z19za2lwX3N0b3J5X2NyYWZ0Jyx7b3JkZXJJZDpvcmRlci5pZCxhY3RvcjpvcmRlci5hY3Rvcixjb2NrdGFpbDpvcmRlci5jb2NrdGFpbCxncmFkZTonZ29vZCd9KTtcbiB1aS5ob3Zlckl0ZW09bnVsbDt1aS5yZWNpcGVPcGVuPWZhbHNlO3VpLmRyYWc9bnVsbDt0b2FzdChMKCfsoJzsobDrpbwg6rG064SI65uw6rOgIOygleyDgSDsoJzqs7XsnLzroZwg7LKY66as7ZaI7Iq164uI64ukLicsJ0NyYWZ0aW5nIHNraXBwZWQ7IGRyaW5rIHNlcnZlZCBzdWNjZXNzZnVsbHkuJykpO3JldHVybiB0cnVlO1xufVxuZnVuY3Rpb24gc2tpcFN0b3J5Q3JhZnRIVE1MKCl7cmV0dXJuIGNhblNraXBTdG9yeUNyYWZ0KCk/YnV0dG9uKEwoJ+ygnOyhsCDsiqTtgrXtlZjquLAnLCdTa2lwIGNyYWZ0aW5nJyksJ3NraXBTdG9yeUNyYWZ0JywndGl0bGU9XCInK0woJ+qwnOuwnOyekCDthYzsiqTtirggwrcg7KO866y47ZWcIOy5te2FjOydvOydhCDsoJXsg4Eg7KCc6rO1IOyymOumrCcsJ0RldmVsb3BlciB0ZXN0IMK3IHNlcnZlIHRoZSBvcmRlcmVkIGRyaW5rIHN1Y2Nlc3NmdWxseScpKydcIicsJ2Rldi1jcmFmdC1za2lwJyk6Jyc7fVxuZnVuY3Rpb24gYmFySFRNTCgpe2NvbnN0IGd1ZXN0PWcuc2VhdHNbZy5mb2N1c10sY2FuQ29hc3Rlcj1nLnN0b3J5Q29hc3RlclJlYWR5KCl8fGcudHV0b3JpYWw/LmtpbmQ9PT0nY29hc3Rlcid8fGcucGhhc2U9PT0nZ2VuZXJhbCcmJmd1ZXN0Py5zdGF0ZT09PSdXQUlUX0NPQVNURVInO3JldHVybiB3b3JsZEhUTUwoKStza2lwU3RvcnlDcmFmdEhUTUwoKStgPGRpdiBjbGFzcz1cImh1ZC1yaWdodFwiPiR7Zy5jdXJyZW50T3JkZXI/YDxzcGFuIGNsYXNzPVwiYmFkZ2VcIj4ke2VzYyhnLnNwZWFrZXJOYW1lKGcuY3VycmVudE9yZGVyLmFjdG9yKSl9IMK3ICR7ZXNjKGcuY3VycmVudE9yZGVyLmZyZWVDaG9pY2U/TCgn7J6Q7JygIOyjvOusuCcsJ1lvdXIgY2hvaWNlJyk6Zy5uYW1lKGcuY3VycmVudE9yZGVyLmNvY2t0YWlsKSl9PC9zcGFuPmA6Jyd9PC9kaXY+JHtnLnNjcmVlbj09PSdiYXInP2RpYWxvZ3VlSFRNTCgpOicnfSR7Zy5jaG9pY2UmJmcuc2NyZWVuPT09J2JhcicmJiFnLmNhbWVyYU1vdmluZyYmZy5jYW1lcmFMZWZ0PT09MCYmZy50cmFuc2l0aW9uPT09MD9gPGRpdiBjbGFzcz1cImNob2ljZXNcIj4ke2cuY2hvaWNlLnJvd3MubWFwKGM9Pntjb25zdCBvaz1DLmNvbmRpdGlvbihjLndoZW4sZy5jdHgoKSk7cmV0dXJuIGJ1dHRvbihgPHNwYW4gY2xhc3M9XCJjaG9pY2UtcHJvZ3Jlc3NcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48aT48L2k+PC9zcGFuPjxzcGFuIGNsYXNzPVwidGl0bGUtbGFiZWwgY2hvaWNlLWxhYmVsXCIgZGF0YS10ZXh0PVwiJHtlc2MoZy50ZXh0KGMpKX1cIj4ke2VzYyhnLnRleHQoYykpfTwvc3Bhbj4keyFvaz9gPHNtYWxsPiR7ZXNjKGcudGV4dChjLCdsb2NrX3JlYXNvbicpKX08L3NtYWxsPmA6Jyd9YCwnY2hvaWNlJyxgZGF0YS1pZD1cIiR7Yy5zZXF9XCIgJHtvaz8nJzonZGlzYWJsZWQnfWApO30pLmpvaW4oJycpfTwvZGl2PmA6Jyd9JHsoZy5waGFzZT09PSdnZW5lcmFsJ3x8Zy50dXRvcmlhbD8ua2luZD09PSdjb2FzdGVyJ3x8Zy5zdG9yeUNvYXN0ZXJSZWFkeSgpfHxnLmN1cnJlbnRPcmRlcikmJmcuc2NyZWVuPT09J2Jhcic/YDxkaXYgY2xhc3M9XCJzdGFjayBzZXJ2aWNlLXBvcHVwIGRyYWdnYWJsZVwiICR7Y2FuQ29hc3Rlcj8nZGF0YS1kcmFnPVwiY29hc3RlclwiJzonJ30gcm9sZT1cImJ1dHRvblwiIHRhYmluZGV4PVwiJHtjYW5Db2FzdGVyPzA6LTF9XCIgYXJpYS1kaXNhYmxlZD1cIiR7IWNhbkNvYXN0ZXJ9XCIgYXJpYS1sYWJlbD1cIuy9lOyKpO2EsCDsoJzqs7VcIj4ke2NhbkNvYXN0ZXImJiF1aS5kcmFnJiYhZy5jYW1lcmFNb3ZpbmcmJiFnLmNhbWVyYUxlZnQmJiFnLnRyYW5zaXRpb24/JzxzdmcgY2xhc3M9XCJjb2FzdGVyLXBpY2t1cC1hcnJvd1wiIHZpZXdCb3g9XCIwIDAgNDAgNDhcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48cGF0aCBkPVwiTTEyIDJIMjhWMjNIMzhMMjAgNDVMMiAyM0gxMlpcIi8+PC9zdmc+JzonJ308aW1nIHNyYz1cIiR7YSgnY29hc3RlcicpfVwiIGRyYWdnYWJsZT1cImZhbHNlXCIgYWx0PVwi7L2U7Iqk7YSwIOustuydjFwiPjxzbWFsbD48c3Bhbj4ke0woJ+y9lOyKpO2EsCDrk5zrnpjqt7gnLCdEcmFnIGNvYXN0ZXInKX08L3NwYW4+PC9zbWFsbD48L2Rpdj4ke2d1ZXN0Py5zdGF0ZT09PSdXQUlUX1NFUlZFJyYmIWcuZHJpbms/YDxkaXYgY2xhc3M9XCJ0cmF5XCI+JHtidXR0b24oJzxzcGFuPicrTCgn7KO866y4IOuQmOusu+q4sCcsJ0FzayBhZ2FpbicpKyc8L3NwYW4+PGtiZD5FPC9rYmQ+JywncmVhc2snLGd1ZXN0LnJlYXNraW5nPydkaXNhYmxlZCc6JycpfTwvZGl2PmA6Jyd9YDonJ30ke2cuZHJpbmsmJmcuc2NyZWVuPT09J2Jhcic/YDxkaXYgY2xhc3M9XCJ0cmF5IGRyaW5rLXRyYXkgc2VydmljZS1wb3B1cCBkcmFnZ2FibGUke3VpLmRyYWc9PT0nZHJpbmsnPycgaXMtZHJhZ2dpbmcnOicnfVwiIGRhdGEtZHJhZz1cImRyaW5rXCIgcm9sZT1cImJ1dHRvblwiIHRhYmluZGV4PVwiMFwiIGFyaWEtbGFiZWw9XCLsmYTshLEg7Lm17YWM7J28IOuTnOuemOq3uFwiPiR7ZHJpbmtBcnQoZy5kcmluay5zZWxlY3RlZCl9PGRpdiBjbGFzcz1cImRyaW5rLXRyYXktaW5mb1wiPjxoMz4ke2VzYyhnLm5hbWUoZy5kcmluay5zZWxlY3RlZCkpfTwvaDM+PHNtYWxsPiR7TCgn7L2U7Iqk7YSw66GcIOuTnOuemOq3uCcsJ0RyYWcgb250byB0aGUgY29hc3RlcicpfTwvc21hbGw+PC9kaXY+PC9kaXY+YDonJ30keyFnLnR1dG9yaWFsJiZnLmN1cnJlbnRPcmRlciYmZy5zY3JlZW49PT0nYmFyJyYmIWcuZHJpbmsmJiFnLmRpYWxvZ3VlJiYhZy5jaG9pY2UmJiFnLmNhbWVyYU1vdmluZyYmZy5jYW1lcmFMZWZ0PT09MCYmZy50cmFuc2l0aW9uPT09MD9gPGRpdiBjbGFzcz1cImNlbnRlci1oaW50IHN0b3J5LWNyYWZ0LXByb21wdFwiPiR7YnV0dG9uKEwoJ+ugiOyLnO2UvOulvCDsl7TslrQg7KCc7KGw7ZWY6riwJywnT3BlbiByZWNpcGVzIHRvIGNyYWZ0JyksJ3JlY2lwZXMnLGcuaXNQYXVzZWQoKT8nZGlzYWJsZWQnOicnLCdwcmltYXJ5Jyl9PC9kaXY+YDonJ31gO1xufVxuZnVuY3Rpb24gdXBrZWVwSW5wdXRIVE1MKCl7XG4gY29uc3Qgcm93PUQudGFibGVzLmRheXMuZmluZChkPT5OdW1iZXIoZC5kYXkpPT09dWkuZGF5KSxiYXNlPXJvdz8udXBrZWVwX2dvbGQ/PzA7XG4gcmV0dXJuIGA8ZGl2IGNsYXNzPVwidXBrZWVwLXNldHVwXCI+PGxhYmVsIGZvcj1cInVwa2VlcC10ZXN0XCI+JHtMKCfsnKDsp4DruYQg7YWM7Iqk7Yq46rCSJywnVXBrZWVwIHRlc3Qgb3ZlcnJpZGUnKX0gPHNtYWxsPiR7TCgn7ISg7YOdJywnb3B0aW9uYWwnKX08L3NtYWxsPjwvbGFiZWw+PGRpdiBjbGFzcz1cInJvd1wiPjxpbnB1dCBpZD1cInVwa2VlcC10ZXN0XCIgdHlwZT1cIm51bWJlclwiIG1pbj1cIjBcIiBzdGVwPVwiMVwiIGlucHV0bW9kZT1cIm51bWVyaWNcIiBkYXRhLWlucHV0PVwidXBrZWVwXCIgdmFsdWU9XCIke2VzYyh1aS51cGtlZXApfVwiIHBsYWNlaG9sZGVyPVwiJHtMKCfquLDrs7jqsJInLCdEZWZhdWx0Jyl9ICR7YmFzZX1cIiBhcmlhLWxhYmVsPVwi7Jyg7KeA67mEIO2FjOyKpO2KuOqwklwiPjxzcGFuPkc8L3NwYW4+PC9kaXY+PHNtYWxsPiR7TCgn67mI7Lm47J2066m0IOydvOywqCDrjbDsnbTthLAg7IKs7JqpLiDsm5Drs7jsnYAg67OA6rK97ZWY7KeAIOyViuyKteuLiOuLpC4nLCdCbGFuayB1c2VzIGRheSBkYXRhLiBTb3VyY2UgZGF0YSBzdGF5cyB1bmNoYW5nZWQuJyl9PC9zbWFsbD48L2Rpdj5gO1xufVxuZnVuY3Rpb24gc3RhcnRIVE1MKCl7aWYodWkuY3V0c2NlbmVzKXJldHVybiB3aW5kb3cuTHVuYUN1dHNjZW5lTGlicmFyeS5odG1sKHJlbWl4VUkudGFic0hUTUwoKSk7aWYodWkub3V0c2lkZSlyZXR1cm4gb3V0c2lkZS5sb2JieUhUTUwocmVtaXhVSS50YWJzSFRNTCgpKTtpZih1aS5taW5pZ2FtZXMpcmV0dXJuIG1pbmlVSS5sb2JieUhUTUwoKTtpZih1aS52YXJpYW50PT09J2dwdCcpcmV0dXJuIHJlbWl4VUkuc3RhcnRIVE1MKCk7Y29uc3Qgbm90ZXM9ezA6TCgn7YGs66as7Iqk7J2YIOuwlO2FkOuNlCDtipzthqDrpqzslrwg4oaSIO2PrO2KuCDssqsg7KO866y4LiDsnbzrsJgg7IaQ64uYIOyYgeyXheydgCDqsbTrhIjrnIHri4jri6QuJywnQ2hyaXPigJlzIHR1dG9yaWFsIOKGkiBQb3J04oCZcyBmaXJzdCBvcmRlci4gTm8gZ2VuZXJhbCBndWVzdCBzZXJ2aWNlLicpLDE6TCgn6rCc7KCQIOuMgO2ZlCDihpIg7J2867CYIOyGkOuLmCDihpIg7YawwrfslYTsnbzrpqwg7KO866y46rO8IOyhsOuLiOydmCDsiKAg67O17JuQIOu2gO2DgSDihpIg66ek7LacIOygleyCsC4nLCdPcGVuaW5nIOKGkiBnZW5lcmFsIGd1ZXN0cyDihpIgVG9tIGFuZCBBaWxpIOKGkiByZXN0b3JhdGlvbiByZXF1ZXN0IOKGkiBzZXR0bGVtZW50LicpLDI6TCgn7IK87Zi47JeQ6rKMIOy5te2FjOydvCDstpTsspwg4oaSIO2PrO2KuOydmCDquLDslrUg7LmpIOyghOuLrCDihpIg7YGs66as7Iqkwrftj6ztirgg64yA7ZmULiDsobDri4gg7ZqM7IOB7J2AIOq3gOqwgCDtm4Qg7IiY66m0wrfthYzrnbzsiqTsl5DshJwg7KeE7ZaJLicsJ1JlY29tbWVuZCBhIGRyaW5rIHRvIFNhbWhvIOKGkiBQb3J0IGRlbGl2ZXJzIHRoZSBjaGlwIOKGkiBDaHJpcyBhbmQgUG9ydCB0YWxrLiBKb2hubnnigJlzIG1lbW9yeSBwbGF5cyBvbiB0aGUgdGVycmFjZSBhZnRlciBjaG9vc2luZyBzbGVlcCBhdCBob21lLicpLDM6TCgn7JWE7J2866as7J2YIOqwgeyEpO2DlSDsoITri6wg4oaSIO2GsMK37IK87Zi4IOuMgO2ZlOyZgCDsmKzrk5wg7Yyo7IWY65OcIOygnOyhsCDihpIg7Ye06re8IO2bhCDthYzrnbzsiqTCt+ycoOuCmCDtmozsg4EuJywnQWlsaSBkZWxpdmVycyBzdWdhciDihpIgVG9tIGFuZCBTYW1obyBtZWV0IG92ZXIgYW4gT2xkIEZhc2hpb25lZCDihpIgdGVycmFjZSBjb252ZXJzYXRpb24gYW5kIFl1bmEgZmxhc2hiYWNrIGFmdGVyIHdvcmsuJyksOTk6TCgn67aE6riwwrftg5zqt7jCt+yijOyEncK364+Z7IucIOyeheyepcK37J6s7KCc7KGwIO2FjOyKpO2KuC4g66qo65OgIOyerOujjOyZgCDsubXthYzsnbzsnbQg7ZW06riI65Cp64uI64ukLicsJ1FBIGJyYW5jaGVzLCB0YWdzLCBzZWF0cywgcGFpcmVkIGVudHJhbmNlIGFuZCByZXRyaWVzLiBBbGwgcmVjaXBlcyB1bmxvY2tlZC4nKX07cmV0dXJuIGA8ZGl2IGNsYXNzPVwic3RhcnQtc2NyZWVuXCI+JHtyZW1peFVJLnRhYnNIVE1MKCl9PGRpdiBjbGFzcz1cInN0YXJ0LWNhcmRcIj48aDIgc3R5bGU9XCJtYXJnaW46MTVweCAwIDVweFwiPiR7TCgn7JiB7JeFIOyEpOyglScsJ1Nlc3Npb24gc2V0dXAnKX08L2gyPjxkaXYgY2xhc3M9XCJkYXktbGlzdFwiPiR7WzAsMSwyLDMsOTldLm1hcChkYXk9PmJ1dHRvbihkYXk9PT05OT8nUUEgOTknOkwoZGF5KyfsnbzssKgnLCdEYXkgJytkYXkpLCdkYXknLGBkYXRhLWlkPVwiJHtkYXl9XCJgLHVpLmRheT09PWRheT8nc2VsZWN0ZWQnOicnKSkuam9pbignJyl9PC9kaXY+PHAgY2xhc3M9XCJzdGFydC1ub3RlXCI+JHtub3Rlc1t1aS5kYXldfTwvcD4ke3Vwa2VlcElucHV0SFRNTCgpfTxsYWJlbCBmb3I9XCJzdGFydC1tb2RlXCI+JHtMKCfsi5zsnpEg6rWs6rCEJywnU3RhcnQgYXQnKX08L2xhYmVsPjxzZWxlY3QgaWQ9XCJzdGFydC1tb2RlXCIgZGF0YS1jaGFuZ2U9XCJtb2RlXCI+PG9wdGlvbiB2YWx1ZT1cImZ1bGxcIiAke3VpLm1vZGU9PT0nZnVsbCc/J3NlbGVjdGVkJzonJ30+JHtMKCfrsJQg64K067aAIOyghOyytCDtnZDrpoQnLCdGdWxsIGJhciBmbG93Jyl9PC9vcHRpb24+PG9wdGlvbiB2YWx1ZT1cImdlbmVyYWxcIiAke3VpLm1vZGU9PT0nZ2VuZXJhbCc/J3NlbGVjdGVkJzonJ30+JHtMKCfsnbzrsJgg7IaQ64uYIOyYgeyXheu2gO2EsCcsJ0dlbmVyYWwgZ3Vlc3Qgc2VydmljZScpfTwvb3B0aW9uPjxvcHRpb24gdmFsdWU9XCJyZWd1bGFyXCIgJHt1aS5tb2RlPT09J3JlZ3VsYXInPydzZWxlY3RlZCc6Jyd9PiR7TCgn64uo6rOoIOyGkOuLmCDsmIHsl4XrtoDthLAnLCdSZWd1bGFyIGd1ZXN0IHNlcnZpY2UnKX08L29wdGlvbj48b3B0aW9uIHZhbHVlPVwicHJhY3RpY2VcIiAke3VpLm1vZGU9PT0ncHJhY3RpY2UnPydzZWxlY3RlZCc6Jyd9PiR7TCgn7Lm17YWM7J28IOygnOyhsCDsl7DsirUnLCdDcmFmdCBwcmFjdGljZScpfTwvb3B0aW9uPjwvc2VsZWN0PiR7YnV0dG9uKEwoJ+yYgeyXhSDsi5zsnpEg4oaSJywnT3BlbiB0aGUgYmFyIOKGkicpLCdzdGFydCcsJycsJ3ByaW1hcnknKX08ZGl2IGNsYXNzPVwic3BhY2VyXCI+PC9kaXY+PGRpdiBjbGFzcz1cInJvdyBzcHJlYWRcIj48c21hbGw+PGtiZD5GMjwva2JkPiAke0woJ+2FjOyKpO2KuCDrj4TqtawnLCdUZXN0IHRvb2xzJyl9PC9zbWFsbD4ke2J1dHRvbihMKCfsobDsnpEg7JWI64K0JywnQ29udHJvbHMnKSwnaGVscCcsJycsJ3N1YnRsZScpfTwvZGl2PjwvZGl2PjwvZGl2PmA7fVxuZnVuY3Rpb24gcmVjaXBlTGluZXMoYyl7cmV0dXJuIGA8dWwgY2xhc3M9XCJyZWNpcGUtbGluZXNcIj4ke2cudC5yZWNpcGVzLmZpbHRlcihyPT5yLmNvbnRleHQ9PT1jLmlkKS5tYXAocj0+YDxsaT48c3Bhbj4ke2VzYyhnLm5hbWUoci5pbmdyZWRpZW50KSl9PC9zcGFuPjxzbWFsbD4ke3IucXR5Pz8n4oCUJ30gJHtyLnVuaXQ/PycnfSDCtyAke2xhYmVsVHlwZShyLmFjdGlvbil9PC9zbWFsbD48L2xpPmApLmpvaW4oJycpfTwvdWw+PGRpdiBjbGFzcz1cInJlY2lwZS1ub3RlXCI+JHtMKCfsnpQnLCdHbGFzcycpfTogJHtlc2MoZy5uYW1lKGMuZ2xhc3MpKX08YnI+JHtMKCfsoJzsobAg67Cp67KVJywnTWV0aG9kJyl9OiAke2MubWl4fSAke2MubWl4PT09J2J1aWxkJz9MKCfCtyDrs4Trj4Qg66+57IqkIOuPhOq1rCDsl4bsnYwnLCfCtyBubyBtaXhpbmcgdG9vbCcpOicnfTxicj4ke0woJ+ygnO2VnCDsi5zqsIQnLCdUaW1lIGxpbWl0Jyl9OiAke2MudGltZV9saW1pdF9zZWN9czwvZGl2PmA7fVxuZnVuY3Rpb24gcmVjaXBlc0hUTUwoKXtpZihyZW1peC5hY3RpdmUoKSlyZXR1cm4gcmVtaXhVSS5yZWNpcGVzSFRNTCgpO2NvbnN0IGF2YWlsYWJsZT1nLmNvY2t0YWlsc0F2YWlsYWJsZSgpLHVubG9ja2VkSWRzPW5ldyBTZXQoYXZhaWxhYmxlLm1hcChjPT5jLmlkKSksYWxsPWcudC5jb2NrdGFpbHMuc2xpY2UoKS5zb3J0KChhLGIpPT5OdW1iZXIodW5sb2NrZWRJZHMuaGFzKGIuaWQpKS1OdW1iZXIodW5sb2NrZWRJZHMuaGFzKGEuaWQpKXx8KHVubG9ja2VkSWRzLmhhcyhhLmlkKT9TdHJpbmcoYVsnbmFtZS5rbyddfHxhLmlkKS5sb2NhbGVDb21wYXJlKFN0cmluZyhiWyduYW1lLmtvJ118fGIuaWQpLCdrbycpOjApKTtjb25zdCBwZWVrPWcudC5jb2NrdGFpbHMuZmluZChjPT5jLmlkPT09dWkucGVlayk7cmV0dXJuIGA8YXNpZGUgY2xhc3M9XCJzaWRlLXBhbmVsIHJlc291cmNlLXJlY2lwZS1saXN0XCI+PGRpdiBjbGFzcz1cInBhbmVsLWhlYWRlclwiPjxkaXYgY2xhc3M9XCJyb3cgc3ByZWFkXCI+PGgyPiR7TCgn7Lm17YWM7J28IOugiOyLnO2UvCcsJ1JlY2lwZSBib29rJyl9PC9oMj4ke3Jlc291cmNlQ2xvc2UoJ2Nsb3NlUmVjaXBlJywncmVjaXBlX2Nob2ljZScpfTwvZGl2PjxzbWFsbD7igLsgJHtMKCfroIjsi5ztlLzrpbwg6rOg66W066m0IOyerOujjCDri7TquLDroZwg7J2064+Z7ZWp64uI64ukLicsJ0Nob29zZSBhIHJlY2lwZSB0byBwcmVwYXJlIGluZ3JlZGllbnRzLicpfTwvc21hbGw+PC9kaXY+PGRpdiBjbGFzcz1cInJlY2lwZS1saXN0XCI+JHthbGwubWFwKGM9Pntjb25zdCBvaz1hdmFpbGFibGUuc29tZSh4PT54LmlkPT09Yy5pZCk7cmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwicmVjaXBlLWNhcmQgJHtvaz8nJzonbG9ja2VkJ31cIiBkYXRhLWFjdD1cInNlbGVjdFJlY2lwZVwiIGRhdGEtaWQ9XCIke2MuaWR9XCIgZGF0YS1ob3Zlci1yZWNpcGU9XCIke2MuaWR9XCIgJHtvaz8nJzonZGlzYWJsZWQnfT4ke2RyaW5rQXJ0KGMuaWQpfTxkaXY+PHN0cm9uZz4ke29rP2VzYyhnLnRleHQoYywnbmFtZScpKTonPz8/J308L3N0cm9uZz48c21hbGw+JHtvaz9gJHtjLm1peC50b1VwcGVyQ2FzZSgpfSDCtyAke21vbmV5KGMucHJpY2UpfWA6KGMuaWQ9PT0nam9obm55X29sZF9mYXNoaW9uZWQnP0woJ+q4sOyWteqzvCDsnqzro4zrpbwg66qo65GQIOuqqOycvOuptCDtlbTquIgnLCdVbmxvY2sgdGhyb3VnaCBtZW1vcmllcyBhbmQgaW5ncmVkaWVudHMnKTpMKGMudW5sb2NrX2RheSsn7J287LCoIO2VtOq4iCcsJ0RheSAnK2MudW5sb2NrX2RheSsnIHVubG9jaycpKX08L3NtYWxsPjwvZGl2PjxzcGFuIGNsYXNzPVwicmVjaXBlLWxvY2stbWFya1wiPiR7b2s/Jyc6J+KXhyd9PC9zcGFuPjwvYnV0dG9uPmA7fSkuam9pbignJyl9PC9kaXY+PC9hc2lkZT4ke3BlZWsmJmF2YWlsYWJsZS5pbmNsdWRlcyhwZWVrKT92aWV3cy5yZWNpcGVQYW5lbChwZWVrLHtwcmV2aWV3OnRydWV9KTonJ31gO31cbmZ1bmN0aW9uIHByZXBIVE1MKCl7cmV0dXJuIHZpZXdzLnByZXBIVE1MKCk7fVxuZnVuY3Rpb24gZ2ltbWlja0hUTUwoKXtjb25zdCBzPWcuZ2ltbWljaztpZighcylyZXR1cm4gJyc7aWYocy5mbHVpZClyZXR1cm4gcG91clZpZXcuaHRtbChzKTtpZihzLnR5cGU9PT0nb3BlbicpcmV0dXJuIG9wZW5WaWV3Lmh0bWwocyk7aWYoWydzdGlyJywnc2hha2UnXS5pbmNsdWRlcyhzLnR5cGUpKXJldHVybiB2aWV3cy5taXhIVE1MKHMpK21peFR1dG9yaWFsLmh0bWwoTCk7cmV0dXJuICc8ZGl2IGNsYXNzPVwiY3JhZnQtc2NyZWVuXCI+PHAgY2xhc3M9XCJjcml0aWNhbFwiPicrTCgn7KeA7JuQ7ZWY7KeAIOyViuuKlCDquLDrr7k6ICcsJ1Vuc3VwcG9ydGVkIGdpbW1pY2s6ICcpK2VzYyhzLnR5cGUpKyc8L3A+PC9kaXY+JzsgfVxuZnVuY3Rpb24gcmVzdWx0SFRNTCgpe3JldHVybiBzZXJ2ZVZpZXcuaHRtbCgpO31cbmZ1bmN0aW9uIHRvdGFsc0hUTUwoKXtjb25zdCB0PWcudG90YWxzKCk7cmV0dXJuIGA8ZGl2IGNsYXNzPVwidG90YWxzXCI+JHtbWydzYWxlJyxMKCftjJDrp6QnLCdTYWxlcycpXSxbJ3RpcCcsTCgn7YyBJywnVGlwcycpXSxbJ3JlZnVuZCcscmVtaXguYWN0aXZlKCk/TCgn67Cw7IOBJywnQ29tcGVuc2F0aW9uJyk6TCgn7ZmY67aIJywnUmVmdW5kcycpXSxbJ25ldCcsTCgn7ZWp6rOEJywnTmV0JyldXS5tYXAoKFtrLHZdKT0+YDxkaXY+PHNtYWxsPiR7dn08L3NtYWxsPjxzdHJvbmc+JHtmbXQodFtrXSl9PC9zdHJvbmc+PC9kaXY+YCkuam9pbignJyl9PC9kaXY+YDt9XG5mdW5jdGlvbiBzYWxlc0hUTUwoKXtyZXR1cm4gYDxkaXYgY2xhc3M9XCJzYWxlcy1iYWxhbmNlXCI+PHNwYW4+JHtMKCftmITsnqwg7IaM7KeA6riIJywnQ3VycmVudCBiYWxhbmNlJyl9PC9zcGFuPjxzdHJvbmc+JHttb25leShnLnByb2dyZXNzLm1vbmV5KX08L3N0cm9uZz48L2Rpdj5gK3RvdGFsc0hUTUwoKStgPGRpdiBjbGFzcz1cInRhYmxlLXNjcm9sbFwiPjx0YWJsZSBjbGFzcz1cImRhdGEtdGFibGVcIj48dGhlYWQ+PHRyPjx0aD4ke0woJ+ygnOqzte2VnCDsubXthYzsnbwnLCdEcmluaycpfTwvdGg+PHRoPiR7TCgn7LWc7KKFIOuTseq4iScsJ0ZpbmFsIGdyYWRlJyl9PC90aD48dGg+JHtMKCftlanqs4QnLCdOZXQnKX08L3RoPjwvdHI+PC90aGVhZD48dGJvZHk+JHtnLnRyYW5zYWN0aW9ucy5tYXAodD0+YDx0cj48dGQ+JHtlc2MoZy5uYW1lKHQuc2VydmVkKSl9PC90ZD48dGQ+JHt0LmdyYWRlLnRvVXBwZXJDYXNlKCl9JHshdC5tYXRjaD8nIMK3ICcrTCgn7KO866y4IOu2iOydvOy5mCcsJ1dyb25nIG9yZGVyJyk6Jyd9PC90ZD48dGQ+JHttb25leSh0Lm5ldCl9PC90ZD48L3RyPmApLmpvaW4oJycpfHxgPHRyPjx0ZCBjb2xzcGFuPVwiM1wiIGNsYXNzPVwiZW1wdHlcIj4ke0woJ+yVhOyngSDsoJXsgrDrkJwg7KO866y47J20IOyXhuyKteuLiOuLpC4nLCdObyBzZXR0bGVkIG9yZGVycyB5ZXQuJyl9PC90ZD48L3RyPmB9PC90Ym9keT48L3RhYmxlPjwvZGl2PmA7fVxuZnVuY3Rpb24gbW9kYWwodGl0bGUsYm9keSx3aWRlPWZhbHNlLGNsb3NlPXRydWUpe3JldHVybiBgPGRpdiBjbGFzcz1cIm1vZGFsLWJhY2tkcm9wXCI+PHNlY3Rpb24gY2xhc3M9XCJtb2RhbCAke3dpZGU/J3dpZGUnOicnfVwiPjxkaXYgY2xhc3M9XCJtb2RhbC10aXRsZVwiPjxoMj4ke3RpdGxlfTwvaDI+JHtjbG9zZT9idXR0b24oJ8OXJywnY2xvc2VPdmVybGF5Jyk6Jyd9PC9kaXY+JHtib2R5fTwvc2VjdGlvbj48L2Rpdj5gO31cbi8vIEV4cGxpY2l0IHdlYiBhZGFwdGVycyBvbmx5LiBUaGVzZSBkbyBub3QgZGVmaW5lIG9yIHJld3JpdGUgdGhlIHByb2R1Y3Rpb24gQ1NWIGNvbnRyYWN0LlxuY29uc3QgRE9TU0lFUl9ST1NURVI9d2luZG93Lkx1bmFTdG9yeU5vdGljZXMucm9zdGVyO1xuY29uc3QgRE9TU0lFUl9NRVRfRkxBR1M9e2NocmlzOidjaHJpc19tZXQnLHBvcnQ6J3BvcnRfbWV0JyxhaWxpOidhaWxpX21ldCcsYnViaTonYnViaV9tZXQnLHNoaWJhOidzaGliYV9tZXQnLHNhbWhvOidzYW1ob19tZXQnLHRvbTondG9tX21ldCd9O1xuZnVuY3Rpb24gZG9zc2llclN0YXRlKGlkKXtcbiBjb25zdCBwcmV2aWV3PXVpLmRvc3NpZXJQcmV2aWV3Py5pZD09PWlkP3VpLmRvc3NpZXJQcmV2aWV3LnN0YWdlOm51bGw7XG4gLy8gUmVhbCBlbmNvdW50ZXIgZmxhZ3MgdW5sb2NrIHByb2ZpbGVzOyBpbnNwZWN0b3IgcHJldmlld3MgbmV2ZXIgY3JlYXRlIG1lZXRpbmdzLlxuIGNvbnN0IG1ldD1wcmV2aWV3IT09bnVsbD9wcmV2aWV3PjA6ISFnLnByb2dyZXNzLmZsYWdzW0RPU1NJRVJfTUVUX0ZMQUdTW2lkXV07XG4gY29uc3QgY2hhcmFjdGVyPWcudC5jaGFyYWN0ZXJzLmZpbmQoYz0+Yy5pZD09PWlkKSxhZmY9TnVtYmVyKGcucHJvZ3Jlc3MuYWZmaW5pdHlbaWRdfHwwKTtcbiAvLyBTaGliYSdzIGFmZmluaXR5IGZlYXR1cmUgaXMgdW5jb25maXJtZWQ6IGxpdmUgbW9kZSBleHBvc2VzIHN0YWdlIDEgb25seS5cbiBjb25zdCBzdGFnZT1wcmV2aWV3IT09bnVsbD9wcmV2aWV3OiFtZXQ/MDpjaGFyYWN0ZXI/LmFmZmluaXR5PT09ZmFsc2U/MTphZmY+PTMwPzM6YWZmPj0xMD8yOjE7XG4gcmV0dXJuIHttZXQsc3RhZ2UscHJldmlldzpwcmV2aWV3IT09bnVsbH07XG59XG5mdW5jdGlvbiBkb3NzaWVyUG9ydHJhaXQoaWQpe1xuIGNvbnN0IGtleXM9bGF5ZXJzKGlkLCdpZGxlJyxmYWxzZSksc2FtcGxlPWtleXM/Lmxlbmd0aD9ELmFzc2V0c1trZXlzWzBdXTpudWxsO1xuIGNvbnN0IGZ3PXNhbXBsZT8oc2FtcGxlLmZyYW1lV2lkdGh8fHNhbXBsZS53LyhzYW1wbGUuZnJhbWVzfHwxKSk6MSxmaD1zYW1wbGU/Lmh8fDE7XG4gY29uc3QgYm94ZXM9KGtleXN8fFtdKS5tYXAoaz0+RC5hc3NldHNba10uYWxwaGFCQm94KS5maWx0ZXIoYj0+Yj8ubGVuZ3RoPT09NCk7XG4gLy8gRnJhbWUtc3BhY2UgYm91bmRzIHJlbW92ZSB0cmFuc3BhcmVudCBzcHJpdGUgbWFyZ2lucyB3aXRob3V0IG1vZGlmeWluZyBzb3VyY2UgYXJ0LlxuIGNvbnN0IHg9Ym94ZXMubGVuZ3RoP01hdGgubWluKC4uLmJveGVzLm1hcChiPT5iWzBdKSk6MCx5PWJveGVzLmxlbmd0aD9NYXRoLm1pbiguLi5ib3hlcy5tYXAoYj0+YlsxXSkpOjA7XG4gY29uc3Qgdz1ib3hlcy5sZW5ndGg/TWF0aC5tYXgoLi4uYm94ZXMubWFwKGI9PmJbMl0pKS14OmZ3LGg9Ym94ZXMubGVuZ3RoP01hdGgubWF4KC4uLmJveGVzLm1hcChiPT5iWzNdKSkteTpmaDtcbiByZXR1cm4gJzxkaXYgY2xhc3M9XCJkb3NzaWVyLXBvcnRyYWl0XCIgcm9sZT1cImltZ1wiIGFyaWEtbGFiZWw9XCInK2VzYyhnLm5hbWUoaWQpKSsnXCI+PGRpdiBjbGFzcz1cInBvcnRyYWl0LWNhbnZhcyAnKyhzYW1wbGU/J3BvcnRyYWl0LWNyb3BwZWQnOicnKSsnXCIgc3R5bGU9XCItLXBvcnRyYWl0LXJhdGlvOicrKHcvaCkrJzthc3BlY3QtcmF0aW86Jyt3KycvJytoKydcIj4nKyhrZXlzPy5sZW5ndGg/a2V5cy5tYXAoaz0+e2NvbnN0IHY9RC5hc3NldHNba107cmV0dXJuICc8c3BhbiBzdHlsZT1cImluc2V0OmF1dG87bGVmdDonKygteC93KjEwMCkrJyU7dG9wOicrKC15L2gqMTAwKSsnJTt3aWR0aDonKyhmdy93KjEwMCkrJyU7aGVpZ2h0OicrKGZoL2gqMTAwKSsnJTtiYWNrZ3JvdW5kLWltYWdlOnVybCgnK3Yuc3JjKycpO2JhY2tncm91bmQtc2l6ZTonKygodi5mcmFtZXN8fDEpKjEwMCkrJyUgMTAwJVwiPjwvc3Bhbj4nO30pLmpvaW4oJycpOic8ZGl2IGNsYXNzPVwicG9ydHJhaXQtcGxhY2Vob2xkZXJcIj48c3Bhbj7il4c8L3NwYW4+PHNtYWxsPicrTCgn7ZSE66Gc7ZWEIOydtOuvuOyngCDspIDruYQg7KSRJywnUG9ydHJhaXQgcGVuZGluZycpKyc8L3NtYWxsPjwvZGl2PicpKyc8L2Rpdj48L2Rpdj4nO1xufVxuZnVuY3Rpb24gYWZmaW5pdHlCYXIoc3RhZ2Upe3JldHVybiAnPGRpdiBjbGFzcz1cImFmZmluaXR5LWJhclwiIHJvbGU9XCJpbWdcIiBhcmlhLWxhYmVsPVwiJytMKCftmLjqsJDrj4QgJytzdGFnZSsn64uo6rOEJywnQWZmaW5pdHkgc3RhZ2UgJytzdGFnZSkrJ1wiPicrWzEsMiwzXS5tYXAobj0+JzxpIGNsYXNzPVwiJysobjw9c3RhZ2U/J2ZpbGxlZCc6JycpKydcIj48L2k+Jykuam9pbignJykrJzwvZGl2Pic7fVxuZnVuY3Rpb24gZG9zc2llclNlY3Rpb24oa28sZW4sdW5sb2NrZWQsY29udGVudCl7cmV0dXJuICc8c2VjdGlvbiBjbGFzcz1cInByb2ZpbGUtc2VjdGlvbiAnKyh1bmxvY2tlZD8nJzonbG9ja2VkJykrJ1wiPjxoMz4nK0woa28sZW4pKyc8L2gzPicrKHVubG9ja2VkP2NvbnRlbnQ6JzxkaXYgY2xhc3M9XCJwcm9maWxlLWxvY2tlZFwiIGFyaWEtbGFiZWw9XCInK0woJ+uvuO2VtOq4iCDsoJXrs7QnLCdMb2NrZWQgaW5mb3JtYXRpb24nKSsnXCI+Pz8/PC9kaXY+JykrJzwvc2VjdGlvbj4nO31cbmZ1bmN0aW9uIGRvc3NpZXJEZXRhaWxIVE1MKGlkKXtcbiBjb25zdCB7c3RhZ2V9PWRvc3NpZXJTdGF0ZShpZCkscGVuZGluZz0nPHAgY2xhc3M9XCJwcm9maWxlLXBlbmRpbmdcIj4nK0woJ+ybkOqzoCDsl7DqsrAg64yA6riwJywnQ29weSBub3QgY29ubmVjdGVkIHlldCcpKyc8L3A+JztcbiBjb25zdCBiYXNpYz0nPGRsIGNsYXNzPVwicHJvZmlsZS1mYWN0c1wiPicrW1sn64KY7J20JywnQWdlJ10sWyfsi6DssrQnLCdIZWlnaHQgLyB3ZWlnaHQnXSxbJ+yngeyXhScsJ09jY3VwYXRpb24nXSxbJ+qxsOyjvOyngCcsJ1Jlc2lkZW5jZSddXS5tYXAoKFtrbyxlbl0pPT4nPGRpdj48ZHQ+JytMKGtvLGVuKSsnPC9kdD48ZGQ+4oCUPC9kZD48L2Rpdj4nKS5qb2luKCcnKSsnPC9kbD4nO1xuIHJldHVybiAnPGRpdiBjbGFzcz1cImRvc3NpZXItZGV0YWlsLWJhY2tkcm9wXCI+PHNlY3Rpb24gY2xhc3M9XCJkb3NzaWVyLWRldGFpbFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cInByb2ZpbGUtbmFtZVwiPjxhc2lkZSBjbGFzcz1cInByb2ZpbGUtbGVmdFwiPicrZG9zc2llclBvcnRyYWl0KGlkKSsnPGRpdiBjbGFzcz1cInByb2ZpbGUtYWZmaW5pdHlcIj48c3Bhbj4nK0woJ+2YuOqwkOuPhCcsJ0FmZmluaXR5JykrJzwvc3Bhbj4nK2FmZmluaXR5QmFyKHN0YWdlKSsnPC9kaXY+PC9hc2lkZT48ZGl2IGNsYXNzPVwicHJvZmlsZS1yaWdodFwiPjxoZWFkZXI+PHNtYWxsIGNsYXNzPVwicHJvZmlsZS1lbmdsaXNoLW5hbWVcIj4nK2VzYyhnLnQuY2hhcmFjdGVycy5maW5kKGM9PmMuaWQ9PT1pZCk/LlsnbmFtZS5lbiddfHxpZC50b1VwcGVyQ2FzZSgpKSsnPC9zbWFsbD48aDIgaWQ9XCJwcm9maWxlLW5hbWVcIj4nK2VzYyhnLm5hbWUoaWQpKSsnPC9oMj4nK3Byb2ZpbGVDbG9zZSh0cnVlKSsnPC9oZWFkZXI+PGRpdiBjbGFzcz1cInByb2ZpbGUtYm9keVwiIHRhYmluZGV4PVwiMFwiPicrZG9zc2llclNlY3Rpb24oJ+q4sOuzuCDsoJXrs7QnLCdCYXNpYyBpbmZvcm1hdGlvbicsdHJ1ZSxiYXNpYykrZG9zc2llclNlY3Rpb24oJ+ujqOuCmOyXkCDrjIDtlZwg7IOd6rCBJywnVGhvdWdodHMgYWJvdXQgTHVuYScsdHJ1ZSxwZW5kaW5nKStkb3NzaWVyU2VjdGlvbign7KKL7JWE7ZWY64qUIOy5te2FjOydvCcsJ0Zhdm9yaXRlIGNvY2t0YWlsJyxzdGFnZT49MixwZW5kaW5nKStkb3NzaWVyU2VjdGlvbign6rSA7LCwIOuCtOyaqScsJ09ic2VydmF0aW9ucycsdHJ1ZSwnPHAgY2xhc3M9XCJwcm9maWxlLXBlbmRpbmdcIiBkYXRhLW9ic2VydmF0aW9uLXN0YWdlPVwiJytzdGFnZSsnXCI+JytMKCfqtIDssLAgJytzdGFnZSsnIOybkOqzoCDsl7DqsrAg64yA6riwJywnU3RhZ2UgJytzdGFnZSsnIG9ic2VydmF0aW9uIG5vdCBjb25uZWN0ZWQgeWV0JykrJzwvcD4nKStkb3NzaWVyU2VjdGlvbign6rO86rGw7IKsJywnQmFja2dyb3VuZCcsc3RhZ2U+PTMscGVuZGluZykrJzxwIGNsYXNzPVwicHJvZmlsZS1kYXRhLW5vdGVcIj4nK0woJ+yDiCBVSSDtla3rqqnqs7wg6riw7KG0IOyImOyyqSDsm5Dqs6DsnZgg64yA7J2R7J2AIOyVhOyngSDrr7jtmZXsoJXsnoXri4jri6QuIOyduOusvCDshKTsoJXsnYQg7J6E7J2Y66GcIOyxhOyasOyngCDslYrslZjsirXri4jri6QuJywnVGhlIG5ldyBVSSBmaWVsZHMgaGF2ZSBub3QgYmVlbiBtYXBwZWQgdG8gZXhpc3RpbmcgZG9zc2llciBjb3B5LiBDaGFyYWN0ZXIgZGV0YWlscyBoYXZlIG5vdCBiZWVuIGludmVudGVkLicpKyc8L3A+PC9kaXY+PC9kaXY+PC9zZWN0aW9uPjwvZGl2Pic7XG59XG5mdW5jdGlvbiBwcm9maWxlQ2xvc2UoZGV0YWlsKXtjb25zdCBmb2xkZXI9J2Fzc2V0cy91aS9wcm9maWxlLycrKGRldGFpbD8ncHJvZmlsZV93aW5kb3cvJzonJyk7cmV0dXJuIGJ1dHRvbignPGltZyBzcmM9XCInK2ZvbGRlcisoZGV0YWlsPydCVE5fcHJvZmlsZV93aW5kb3dfY2xvc2UucG5nJzonQlROX3Byb2ZpbGVfY2xvc2UucG5nJykrJ1wiIGFsdD1cIlwiPjxpbWcgY2xhc3M9XCJwcm9maWxlLWVzY1wiIHNyYz1cIicrZm9sZGVyKydJTUdfRVNDLnBuZ1wiIGFsdD1cIkVzY1wiPicsJ2Rvc3NpZXJCYWNrJywnYXJpYS1sYWJlbD1cIicrKGRldGFpbD9MKCfrqqnroZ3snLzroZwnLCdCYWNrIHRvIGxpc3QnKTpMKCfri6vquLAnLCdDbG9zZScpKSsnXCInLCdwcm9maWxlLWNsb3NlJyk7fVxuZnVuY3Rpb24gZG9zc2llckhUTUwoKXtcbiBjb25zdCBkZXRhaWw9dWkuZG9zc2llckRldGFpbCYmZG9zc2llclN0YXRlKHVpLmRvc3NpZXJEZXRhaWwpLm1ldD91aS5kb3NzaWVyRGV0YWlsOm51bGw7XG4gcmV0dXJuICc8c2VjdGlvbiBjbGFzcz1cImRvc3NpZXItc2NyZWVuIHJlc291cmNlLXByb2ZpbGVcIiBkYXRhLWxhbmd1YWdlPVwiJytnLmxhbmcrJ1wiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImRvc3NpZXItdGl0bGVcIj48ZGl2IGNsYXNzPVwiZG9zc2llci1saXN0LXNoZWxsXCIgJysoZGV0YWlsPydpbmVydCBhcmlhLWhpZGRlbj1cInRydWVcIic6JycpKyc+PGhlYWRlciBjbGFzcz1cImRvc3NpZXItaGVhZGVyXCI+PGRpdiBjbGFzcz1cImRvc3NpZXItaGVhZGluZ1wiPjxoMiBpZD1cImRvc3NpZXItdGl0bGVcIj4nK0woJ+yduOusvCDsoJXrs7QnLCdHdWVzdCBwcm9maWxlcycpKyc8L2gyPjxpbWcgY2xhc3M9XCJwcm9maWxlLXRpdGxlLWFydFwiIHNyYz1cImFzc2V0cy91aS9wcm9maWxlL0lNR190aXRsZV9wcm9maWxlLnBuZ1wiIGFsdD1cIlwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvZGl2PicrcHJvZmlsZUNsb3NlKGZhbHNlKSsnPC9oZWFkZXI+PGRpdiBjbGFzcz1cImRvc3NpZXItbGlzdC1zY3JvbGxcIiB0YWJpbmRleD1cIjBcIj48ZGl2IGNsYXNzPVwiZG9zc2llci1ncmlkXCI+JytET1NTSUVSX1JPU1RFUi5tYXAoaWQ9Pntjb25zdCBzdD1kb3NzaWVyU3RhdGUoaWQpO3JldHVybiAnPGJ1dHRvbiBjbGFzcz1cImd1ZXN0LWNhcmQgJysoIXN0Lm1ldD8ndW5tZXQnOnVpLmRvc3NpZXI9PT1pZD8nc2VsZWN0ZWQnOicnKSsnXCIgZGF0YS1hY3Q9XCJkb3NzaWVyXCIgZGF0YS1pZD1cIicraWQrJ1wiICcrKCFzdC5tZXQ/J2Rpc2FibGVkIGFyaWEtbGFiZWw9XCInK0woJ+yVhOyngSDrp4zrgpjsp4Ag7JWK7J2AIOyGkOuLmCcsJ0d1ZXN0IG5vdCB5ZXQgbWV0JykrJ1wiJzonYXJpYS1sYWJlbD1cIicrZXNjKGcubmFtZShpZCkpKydcIicpKyc+Jysoc3QubWV0P2Rvc3NpZXJQb3J0cmFpdChpZCkrJzxkaXYgY2xhc3M9XCJndWVzdC1jYXJkLWNhcHRpb25cIj48c3Bhbj4nK2VzYyhnLm5hbWUoaWQpKSsnPC9zcGFuPicrYWZmaW5pdHlCYXIoc3Quc3RhZ2UpKyc8L2Rpdj4nOic8ZGl2IGNsYXNzPVwicHJvZmlsZS1zaWxob3VldHRlXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+Jytkb3NzaWVyUG9ydHJhaXQoJ2NocmlzJykrJzwvZGl2PjxpbWcgY2xhc3M9XCJwcm9maWxlLXVua25vd24taWNvblwiIHNyYz1cImFzc2V0cy91aS9wcm9maWxlL0lNR19jYXJkX0FfaWNvbi5wbmdcIiBhbHQ9XCJcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4nKSsnPC9idXR0b24+Jzt9KS5qb2luKCcnKSsnPC9kaXY+PC9kaXY+PGZvb3RlciBjbGFzcz1cImRvc3NpZXItZm9vdGVyXCI+PHA+JytMKCfsnbjrrLzsnYQg7ISg7YOd7ZWY66m0IOyekOyEuO2VnCDsoJXrs7Trpbwg7ZmV7J247ZWgIOyImCDsnojsirXri4jri6QuJywnU2VsZWN0IGEgZ3Vlc3QgdG8gdmlldyB0aGVpciBkZXRhaWxzLicpKyc8L3A+PC9mb290ZXI+PC9kaXY+JysgKHVpLmRvc3NpZXJQcmV2aWV3Pyc8ZGl2IGNsYXNzPVwiZG9zc2llci1wcmV2aWV3LWJhZGdlXCI+JytMKCdVSSDsg4Htg5wg66+466as67O06riwIMK3IOynhO2WiSDrjbDsnbTthLAg67OA6rK9IOyXhuydjCcsJ1VJIHByZXZpZXcgwrcgcHJvZ3Jlc3MgaXMgdW5jaGFuZ2VkJykrJzwvZGl2Pic6JycpKyhkZXRhaWw/ZG9zc2llckRldGFpbEhUTUwoZGV0YWlsKTonJykrJzwvc2VjdGlvbj4nO1xufVxuZnVuY3Rpb24gZG9zc2llckluc3BlY3RvckhUTUwoKXtyZXR1cm4gJzxsYWJlbD4nK0woJ+uLqOqzqCDsoJXrs7QgVUkg6rKA7IiYJywnR3Vlc3QgcHJvZmlsZSBVSSB0ZXN0JykrJzwvbGFiZWw+PHNlbGVjdCBkYXRhLWNoYW5nZT1cImRvc3NpZXJUZXN0QWN0b3JcIj4nK0RPU1NJRVJfUk9TVEVSLm1hcChpZD0+JzxvcHRpb24gdmFsdWU9XCInK2lkKydcIiAnKyh1aS5kb3NzaWVyVGVzdEFjdG9yPT09aWQ/J3NlbGVjdGVkJzonJykrJz4nK2VzYyhnLm5hbWUoaWQpKSsnPC9vcHRpb24+Jykuam9pbignJykrJzwvc2VsZWN0PjxkaXYgY2xhc3M9XCJyb3cgd3JhcFwiPicrWzAsMSwyLDNdLm1hcChzdGFnZT0+YnV0dG9uKHN0YWdlP0woc3RhZ2UrJ+uLqOqzhCcsICdTdGFnZSAnK3N0YWdlKTpMKCfrr7jrp4zrgqgnLCdVbm1ldCcpLCdkb3NzaWVyUHJldmlldycsJ2RhdGEtaWQ9XCInK3N0YWdlKydcIicpKS5qb2luKCcnKSsnPC9kaXY+JytidXR0b24oTCgn7Iuk7KCcIOynhO2WiSDsg4Htg5zroZwg67O06riwJywnVXNlIGxpdmUgcHJvZ3Jlc3MnKSwnZG9zc2llckxpdmUnKSsnPHNtYWxsPicrTCgn66+466as67O06riw64qUIO2UjOuemOq3uMK37Zi46rCQ64+E66W8IOuwlOq+uOyngCDslYrsirXri4jri6QuIOybkOqzoCDrp6TtlZHCt+yLnOuwlOydmCDstpTqsIAg64uo6rOEwrftmLjqsJDrj4Qg7ZWY6529IOyLnCDsnqzsnqDquIjsnYAg66+47ZmV7KCV7J6F64uI64ukLicsJ1ByZXZpZXcgbmV2ZXIgY2hhbmdlcyBmbGFncyBvciBhZmZpbml0eS4gQ29weSBtYXBwaW5nLCBTaGliYeKAmXMgaGlnaGVyIHN0YWdlcyBhbmQgcmUtbG9ja2luZyBwb2xpY3kgcmVtYWluIHVuY29uZmlybWVkLicpKyc8L3NtYWxsPic7fVxuZnVuY3Rpb24gZG9zc2llckJhY2soKXtcbiBpZih1aS5kb3NzaWVyRGV0YWlsKXtjb25zdCBpZD11aS5kb3NzaWVyRGV0YWlsO3VpLmRvc3NpZXJEZXRhaWw9bnVsbDtyZW5kZXIodHJ1ZSk7cm9vdC5xdWVyeVNlbGVjdG9yKCcuZ3Vlc3QtY2FyZFtkYXRhLWlkPVwiJytpZCsnXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG4gZWxzZSB7Zy5vdmVybGF5PW51bGw7dWkuZG9zc2llclByZXZpZXc9bnVsbDtyZW5kZXIodHJ1ZSk7cm9vdC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJzZXJ2aWNlXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG59XG5mdW5jdGlvbiBoZWxwSFRNTCgpe3JldHVybiBgPGRpdiBjbGFzcz1cImhlbHAtZ3JpZFwiPjxzZWN0aW9uPjxoMz4ke0woJ+ydvOuwmCDshpDri5gg7JiB7JeFJywnR2VuZXJhbCBndWVzdHMnKX08L2gzPjxwPjxrYmQ+QTwva2JkPiA8a2JkPkQ8L2tiZD4gLyDihpAg4oaSICR7TCgn7KKM7ISdIOydtOuPmScsJ01vdmUgc2VhdHMnKX08L3A+PHA+JHtMKCfsmKTrpbjsqr0g7JWE656YIOy9lOyKpO2EsOulvCDsp5HslrQg7ZiE7J6sIOuztOqzoCDsnojripQg7IaQ64uYIOyVnuycvOuhnCDrk5zrnpjqt7jtlZjshLjsmpQuJywnRHJhZyB0aGUgY29hc3RlciBmcm9tIHRoZSBsb3dlciByaWdodCBvbnRvIHRoZSB0YWJsZSBpbiBmcm9udCBvZiB0aGUgZm9jdXNlZCBndWVzdC4nKX08L3A+PHA+PGtiZD5FPC9rYmQ+ICR7TCgn7L2U7Iqk7YSwIOuztOyhsCDsoJzqs7UgLyDsoJzqs7Ug7ZuEIOyjvOusuCDrkJjrrLvquLAgwrcg7J2464K07IusIDEwJSDssKjqsJAnLCdDb2FzdGVyIHNob3J0Y3V0IC8gYWZ0ZXIgb3JkZXJpbmcsIGFzayBhZ2FpbiDCtyBwYXRpZW5jZSDiiJIxMCUnKX08L3A+PHA+JHtMKCfrjIDsgqzripQg7ZiE7J6sIOuztOqzoCDsnojripQg7KKM7ISd7JeQ7IScIOyekOuPmSDsp4TtlonrkKnri4jri6QuJywnQmFya3MgYWR2YW5jZSBhdXRvbWF0aWNhbGx5IGF0IHRoZSBmb2N1c2VkIHNlYXQuJyl9PC9wPjwvc2VjdGlvbj48c2VjdGlvbj48aDM+JHtMKCfri6jqs6gg7IaQ64uYIOyYgeyXhScsJ1JlZ3VsYXIgZ3Vlc3RzJyl9PC9oMz48cD48a2JkPkVudGVyPC9rYmQ+IC8gPGtiZD5TcGFjZTwva2JkPiAke0woJ+uLpOydjCDrjIDsgqwnLCdOZXh0IGRpYWxvZ3VlJyl9PC9wPjxwPjxrYmQ+Q3RybDwva2JkPiAke0woJ+uIhOultOqzoCDsnojripQg64+Z7JWIIOu5oOultOqyjCDrhJjquLDquLAgwrcg7ISg7YOd7KeAwrfsoJzsobDsl5DshJzripQg66mI7LakJywnSG9sZCB0byBmYXN0LWZvcndhcmQsIGluY2x1ZGluZyB1bnJlYWQgZGlhbG9ndWUgwrcgc3RvcHMgYXQgY2hvaWNlcyBhbmQgY3JhZnRpbmcnKX08L3A+PHA+JHtMKCfssqsg64yA7IKsIOuSpCDsvZTsiqTthLDrpbwg7IaQ64uYIOyVnuycvOuhnCDrk5zrnpjqt7jtlZjrqbQg64uk7J2MIOuMgOyCrOqwgCDsnbTslrTsp5Hri4jri6QuJywnQWZ0ZXIgdGhlIGdyZWV0aW5nLCBkcmFnIGEgY29hc3RlciB0byB0aGUgZ3Vlc3QgdG8gY29udGludWUuJyl9PC9wPjxwPjxrYmQ+RTwva2JkPiAke0woJ+y9lOyKpO2EsCDrs7TsobAg7KCc6rO1JywnQ29hc3RlciBrZXlib2FyZCBzaG9ydGN1dCcpfTwvcD48cD4ke0woJ+yEoO2DneyngOuKlCDihpEv4oaTIOydtOuPmSwgRW50ZXIvU3BhY2Ug65iQ64qUIOuniOyasOyKpCDrsoTtirzsnYQgMC417LSI6rCEIOuIjOufrCDtmZXsoJUuIOygnOyhsOuKlCDtmZTrqbQg67KE7Yq87J2EIOyCrOyaqe2VqeuLiOuLpC4nLCdDaG9pY2VzOiDihpEv4oaTIHRvIG1vdmU7IGhvbGQgRW50ZXIvU3BhY2Ugb3IgdGhlIG1vdXNlIGJ1dHRvbiBmb3IgMC41IHNlY29uZHMgdG8gY29uZmlybS4gVXNlIG9uLXNjcmVlbiBidXR0b25zIGZvciBjcmFmdGluZy4nKX08L3A+PC9zZWN0aW9uPjxzZWN0aW9uPjxoMz4ke0woJ+ygnOyhsMK37KCc6rO1JywnQ3JhZnQgYW5kIHNlcnZlJyl9PC9oMz48cD4ke0woJ+ugiOyLnO2UvCDihpIg7J6Uwrfrj4TqtazCt+yerOujjCDihpIg6riw66+5IOKGkiDsoJzqs7XtlZjquLAg4oaSIOyelOydhCDsvZTsiqTthLDroZwg65Oc656Y6re4JywnUmVjaXBlIOKGkiBnbGFzcyAvIHRvb2wgLyBpbmdyZWRpZW50cyDihpIgZ2ltbWlja3Mg4oaSIG9mZmVyIOKGkiBkcmFnIG9udG8gYSBjb2FzdGVyJyl9PC9wPjxwPiR7TCgn67mM65Oc64qUIOuPhOq1rOulvCDshKDtg53tlZjsp4Ag7JWK7Iq164uI64ukLiDrqZTribTCt+ygnOyhsCDspJHsl5DripQg67CUIOyLnOqwhOydtCDrqYjstqXri4jri6QuJywnQnVpbGQgdXNlcyBubyBtaXhpbmcgdG9vbC4gTWVudXMgYW5kIGNyYWZ0aW5nIHBhdXNlIGJhciB0aW1lLicpfTwvcD48L3NlY3Rpb24+PHNlY3Rpb24+PGgzPiR7TCgn66mU64m0wrfthYzsiqTtirgnLCdNZW51cyBhbmQgdGVzdGluZycpfTwvaDM+PHA+PGtiZD5UYWI8L2tiZD4gJHtMKCfsmbzsqr0g7ISc67mE7IqkIO2MqOuEkCDCtyDroIjsi5ztlLwgLyDrp6TstpwgLyDri6jqs6gg7KCV67O0JywnTGVmdCBzZXJ2aWNlIHBhbmVsIMK3IHJlY2lwZXMgLyBzYWxlcyAvIGd1ZXN0IHByb2ZpbGVzJyl9PC9wPjxwPjxrYmQ+RjI8L2tiZD4gJHtMKCfsg4Htg5zCt+2DgOydtOuouMK367aE6riwwrfroZzqt7gg7ZmV7J24JywnSW5zcGVjdCBzdGF0ZSwgdGltZXJzLCBicmFuY2hlcyBhbmQgbG9ncycpfTwvcD48cD48a2JkPlk8L2tiZD4gJHtMKCfrjIDsgqwg6riw66GdIOyXtOq4sCAvIOuLq+q4sCcsJ09wZW4gLyBjbG9zZSBkaWFsb2d1ZSBoaXN0b3J5Jyl9PC9wPjxwPjxrYmQ+RXNjPC9rYmQ+ICR7TCgn7Ji17IWYIMK3IOydvOyLnOygleyngCAvIOyXtOumsCDrqZTribQg64ur6riwJywnT3B0aW9ucyDCtyBwYXVzZSAvIGNsb3NlIHRoZSBvcGVuIG1lbnUnKX08L3A+PHA+JHtMKCdGMiDslYjsnZgg7KCV64u1IOyxhOyasOq4sMK365Ox6riJIOqwleygnOuKlCDqsoDsiJgg7KCE7Jqp7J6F64uI64ukLicsJ1JlY2lwZSBmaWxsIGFuZCBncmFkZSBvdmVycmlkZXMgaW4gRjIgYXJlIHRlc3RpbmcgdG9vbHMgb25seS4nKX08L3A+PC9zZWN0aW9uPjwvZGl2PjxkaXYgY2xhc3M9XCJkaXZpZGVyXCI+PC9kaXY+PHAgY2xhc3M9XCJyZWNpcGUtbm90ZVwiPiR7TCgn7Iuk7KCcIENTVuydmCAwwrcxwrc5OeydvOywqCDrjIDrs7jsnYQg7IKs7Jqp7ZWp64uI64ukLiAywrcz7J287LCo7J2YIOu5hOyWtCDsnojripQg64yA67O47J2AIOunjOuTpOyWtCDrhKPsp4Ag7JWK7JWY7Iq164uI64ukLiDsnbzrtoAg6re4656Y7ZS96rO8IO2aqOqzvOydjOydgCDrjZTrr7jsnbTrqbAsIOyJkOydtO2CueydgCDruIzrnbzsmrDsoIDsmqkg7YOA7J2067CNIOyhsOyekeycvOuhnCDsnqztmITtlojsirXri4jri6QuJywnVXNlcyB0aGUgYWN0dWFsIERheSAwLCAxIGFuZCA5OSBzY3JpcHRzLiBFbXB0eSBEYXkgMi8zIHNjcmlwdHMgYXJlIG5vdCBpbnZlbnRlZC4gTWlzc2luZyBhcnR3b3JrL2F1ZGlvIHVzZXMgcGxhY2Vob2xkZXJzOyBzaGFraW5nIHVzZXMgYSBicm93c2VyIHRpbWluZyBpbnRlcmFjdGlvbi4nKX08L3A+YDt9XG5mdW5jdGlvbiByZXNvdXJjZUNsb3NlKGFjdGlvbixncm91cCl7Y29uc3QgZmlsZW5hbWU9Z3JvdXA9PT0ncmVjaXBlX2Nob2ljZSc/J0JUTl9yZWNpcGVfY2hvaWNlX2Nsb3NlLnBuZyc6J0JUTl9zZXJ2aWNlX2Nsb3NlLnBuZyc7cmV0dXJuIGJ1dHRvbihgPGltZyBzcmM9XCJhc3NldHMvdWkvJHtncm91cH0vJHtmaWxlbmFtZX1cIiBhbHQ9XCJcIj48aW1nIGNsYXNzPVwicmVzb3VyY2UtZXNjXCIgc3JjPVwiYXNzZXRzL3VpLyR7Z3JvdXB9L0lNR19FU0MucG5nXCIgYWx0PVwiRXNjXCI+YCxhY3Rpb24sJ2FyaWEtbGFiZWw9XCInK0woJ+uLq+q4sCcsJ0Nsb3NlJykrJ1wiJywncmVzb3VyY2UtY2xvc2UnKTt9XG5mdW5jdGlvbiBzZXJ2aWNlSFRNTCgpe3JldHVybiBgPGRpdiBjbGFzcz1cInNlcnZpY2UtbGF5ZXIgJHtnLnR1dG9yaWFsPy5raW5kPT09J3JlY2lwZSc/J3R1dG9yaWFsLXNlcnZpY2UnOicnfVwiPjxidXR0b24gY2xhc3M9XCJzZXJ2aWNlLXNjcmltXCIgZGF0YS1hY3Q9XCJzZXJ2aWNlXCIgYXJpYS1sYWJlbD1cIiR7TCgn7ISc67mE7IqkIO2MqOuEkCDri6vquLAnLCdDbG9zZSBzZXJ2aWNlIHBhbmVsJyl9XCI+PC9idXR0b24+PGFzaWRlIGlkPVwic2VydmljZS1wYW5lbFwiIGNsYXNzPVwic2VydmljZS1wYW5lbCByZXNvdXJjZS1zZXJ2aWNlLXBhbmVsXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbGxlZGJ5PVwic2VydmljZS10aXRsZVwiPlxuIDxoZWFkZXI+PGRpdj48c21hbGwgY2xhc3M9XCJzZXJ2aWNlLWV5ZWJyb3dcIj5TRVJWSUNFIFBBTkVMPC9zbWFsbD48aDIgaWQ9XCJzZXJ2aWNlLXRpdGxlXCI+JHtMKCfshJzruYTsiqQg7Yyo64SQJywnU2VydmljZSBwYW5lbCcpfTwvaDI+PC9kaXY+JHtyZXNvdXJjZUNsb3NlKCdzZXJ2aWNlJywnc2VydmljZV9wYW5lbCcpfTwvaGVhZGVyPlxuIDxkaXYgY2xhc3M9XCJzZXJ2aWNlLWFjdGlvbnNcIj4ke2J1dHRvbihMKCfsubXthYzsnbwg66CI7Iuc7ZS8JywnQ29ja3RhaWwgcmVjaXBlcycpLCdyZWNpcGVzJyl9JHtidXR0b24oTCgn66ek7LacIO2YhO2ZqScsJ1NhbGVzIHN1bW1hcnknKSwnc2FsZXMnLGcudHV0b3JpYWw/J2Rpc2FibGVkJzonJyl9JHtidXR0b24oTCgn64uo6rOoIOyGkOuLmCDsoJXrs7QnLCdSZWd1bGFyIGd1ZXN0IHByb2ZpbGVzJyksJ2Rvc3NpZXJPcGVuJyxnLnR1dG9yaWFsPydkaXNhYmxlZCc6JycpfTwvZGl2PlxuIDxwPuKAuyAke2cudHV0b3JpYWw/TCgn7Lm17YWM7J28IOugiOyLnO2UvOulvCDriIzrn6wg7KO87IS47JqULicsJ0Nob29zZSBDb2NrdGFpbCByZWNpcGVzLicpOkwoJ+2MqOuEkOydhCDsl7TrqbQg7JiB7JeFIOyLnOqwhOydtCDrqYjstqXri4jri6QuJywnU2VydmljZSB0aW1lIGlzIHBhdXNlZCB3aGlsZSB0aGlzIHBhbmVsIGlzIG9wZW4uJyl9PC9wPjwvYXNpZGU+PC9kaXY+YDt9XG5mdW5jdGlvbiB0b2dnbGVTZXJ2aWNlKCl7XG4gaWYoZy5vdmVybGF5PT09J3NlcnZpY2UnKXtnLm92ZXJsYXk9bnVsbDtyZW5kZXIodHJ1ZSk7cm9vdC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJzZXJ2aWNlXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtyZXR1cm47fVxuIGlmKGcuc2NyZWVuIT09J2Jhcid8fGcucGhhc2U9PT0ncmVhZHknfHxnLmZpbmlzaGVkfHxnLmlzUGF1c2VkKCl8fHVpLmRyYWcpcmV0dXJuO1xuIGlmKGcudHV0b3JpYWwmJiFnLm9wZW5UdXRvcmlhbFNlcnZpY2UoKSlyZXR1cm47XG4gY2xlYXJDb250cm9sU2tpcCgpO3VpLmluc3BlY3Rvcj1mYWxzZTtzaG93KCdzZXJ2aWNlJyk7cm9vdC5xdWVyeVNlbGVjdG9yKCcjc2VydmljZS1wYW5lbCBbZGF0YS1hY3Q9XCJyZWNpcGVzXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtcbn1cbmZ1bmN0aW9uIGluZ3JlZGllbnRXYXJuaW5nSFRNTCgpe3JldHVybiBgPGRpdiBjbGFzcz1cIm1vZGFsLWJhY2tkcm9wXCI+PHNlY3Rpb24gY2xhc3M9XCJtb2RhbCBpbmdyZWRpZW50LXdhcm5pbmdcIiByb2xlPVwiYWxlcnRkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImluZ3JlZGllbnQtd2FybmluZy10aXRsZVwiIGFyaWEtZGVzY3JpYmVkYnk9XCJpbmdyZWRpZW50LXdhcm5pbmctY29weVwiPjxoMiBpZD1cImluZ3JlZGllbnQtd2FybmluZy10aXRsZVwiPiR7TCgn7KCV66eQIOydtOugh+qyjOq5jOyngCDsnqzro4zrpbwg64u07Jy87Iuc6rKg7Iq164uI6rmMPycsJ0FyZSB5b3UgcmVhbGx5IGdvaW5nIHRvIGFkZCB0aGlzIG1hbnkgaW5ncmVkaWVudHM/Jyl9PC9oMj48ZGl2IGlkPVwiaW5ncmVkaWVudC13YXJuaW5nLWNvcHlcIj48cD4ke0woJ+yghCDrp7nsg4jsvZQg7IK066m07IScIOydtOugh+qyjOq5jOyngCDrp47snYAg7J6s66OM66W8IOuEo+ydgCDsubXthYzsnbzsnYQg67O4IOyggeydtCDsl4bsirXri4jri6QuJywnSSBzd2VhciBJIGhhdmUgbmV2ZXIgc2VlbiBhIGNvY2t0YWlsIHdpdGggdGhpcyBtYW55IGluZ3JlZGllbnRzIGluIG15IGxpZmUuJyl9PC9wPjxwPiR7TCgn7J2066CH6rKMIOunjOuTpOuptCDrkZgg7KSRIO2VmOuCmOqyoOyjoCDsl63sgqzsl5Ag64Ko7J2EIOy5te2FjOydvOydhCDrp4zrk6Qg7IiYIOyeiOyngOunjCDrs7TthrUg6rCc7Jik7KSM6rCZ7J2AIOy5te2FjOydvOydtCDrgpjsmKTqsqDso6AuJywnVGhpcyBjYW4gZ28gb25lIG9mIHR3byB3YXlzOiB5b3UgbWlnaHQgbWFrZSBhIGNvY2t0YWlsIHRoYXQgZ29lcyBkb3duIGluIGhpc3RvcnksIGJ1dCB1c3VhbGx5IHlvdSB3aWxsIGVuZCB1cCB3aXRoIHNvbWV0aGluZyB0aGF0IHRhc3RlcyBsaWtlIGRvZyBwaXNzLicpfTwvcD48L2Rpdj48ZGl2IGNsYXNzPVwiaW5ncmVkaWVudC13YXJuaW5nLWFjdGlvbnNcIj4ke2J1dHRvbihMKCftmZXsnbgnLCdPSycpLCdjbG9zZU92ZXJsYXknLCcnLCdwcmltYXJ5Jyl9PC9kaXY+PC9zZWN0aW9uPjwvZGl2PmA7fVxuZnVuY3Rpb24gZGFpbHlVbmxvY2tzSFRNTCgpe2NvbnN0IGZyZXNoPWcuZGFpbHlVbmxvY2tzKCk7Y29uc3Qgc2VjdGlvbj0odGl0bGUscm93cyxraW5kKT0+YDxzZWN0aW9uIGNsYXNzPVwidW5sb2NrLXNlY3Rpb25cIj48aDM+JHt0aXRsZX08c3Bhbj4ke3Jvd3MubGVuZ3RofTwvc3Bhbj48L2gzPjxkaXYgY2xhc3M9XCJ1bmxvY2stZ3JpZFwiIHRhYmluZGV4PVwiMFwiIHJvbGU9XCJyZWdpb25cIiBhcmlhLWxhYmVsPVwiJHt0aXRsZX1cIj4ke3Jvd3MubWFwKHJvdz0+YDxhcnRpY2xlIGNsYXNzPVwidW5sb2NrLWNhcmRcIiBkYXRhLXVubG9jay1pZD1cIiR7ZXNjKHJvdy5pZCl9XCI+PGRpdiBjbGFzcz1cInVubG9jay1hcnRcIj4ke2tpbmQ9PT0naW5ncmVkaWVudCc/aXRlbUFydChyb3cuaWQsJycsJ3JlY2lwZScpOmRyaW5rQXJ0KHJvdy5pZCwncmVjaXBlJyl9PC9kaXY+PGRpdiBjbGFzcz1cInVubG9jay1uYW1lXCI+JHtlc2MoZy5uYW1lKHJvdy5pZCkpfTwvZGl2PjwvYXJ0aWNsZT5gKS5qb2luKCcnKXx8YDxwIGNsYXNzPVwidW5sb2NrLWVtcHR5XCI+JHtMKCfsmKTripgg7IOI66GcIOy2lOqwgOuQnCDtla3rqqnsnbQg7JeG7Iq164uI64ukLicsJ05vIG5ldyBhZGRpdGlvbnMgdG9kYXkuJyl9PC9wPmB9PC9kaXY+PC9zZWN0aW9uPmA7cmV0dXJuIGA8ZGl2IGNsYXNzPVwibW9kYWwtYmFja2Ryb3AgZGFpbHktdW5sb2Nrcy1iYWNrZHJvcFwiPjxzZWN0aW9uIGNsYXNzPVwiZGFpbHktdW5sb2Nrc1wiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImRhaWx5LXVubG9ja3MtdGl0bGVcIj48aGVhZGVyPjxzcGFuIGNsYXNzPVwidW5sb2NrLWRheVwiPiR7TChnLmRheSsn7J287LCoJywnREFZICcrZy5kYXkpfTwvc3Bhbj48aDIgaWQ9XCJkYWlseS11bmxvY2tzLXRpdGxlXCI+JHtMKCfsmKTripjsnZgg7IOI66Gc7Jq0IOyerOujjOyZgCDroIjsi5ztlLwnLCdOZXcgaW5ncmVkaWVudHMgJiByZWNpcGVzJyl9PC9oMj48cD4ke0woJ+yDiOuhnCDrj4TssKntlZwg7J6s66OM66GcIOuNlCDri6TslpHtlZwg7ZWcIOyelOydhCDrp4zrk6TslrQg67O07IS47JqULicsJ0Rpc2NvdmVyIG5ldyBkcmlua3Mgd2l0aCB0b2RheeKAmXMgYWRkaXRpb25zLicpfTwvcD48L2hlYWRlcj48ZGl2IGNsYXNzPVwidW5sb2NrLWNvbHVtbnNcIj4ke3NlY3Rpb24oTCgn7IOI66GcIOuTpOyWtOyYqCDsnqzro4wnLCdOZXcgaW5ncmVkaWVudHMnKSxmcmVzaC5pbmdyZWRpZW50cywnaW5ncmVkaWVudCcpfSR7c2VjdGlvbihMKCftlbTquIjrkJwg66CI7Iuc7ZS8JywnVW5sb2NrZWQgcmVjaXBlcycpLGZyZXNoLmNvY2t0YWlscywnY29ja3RhaWwnKX08L2Rpdj48Zm9vdGVyPiR7YnV0dG9uKEwoJ+2ZleyduCDCtyDsmIHsl4Ug7KSA67mE7ZWY6riwJywnQ29udGludWUgwrcgUHJlcGFyZSB0byBvcGVuJyksJ2NvbmZpcm1EYWlseVVubG9ja3MnLCcnLCdwcmltYXJ5Jyl9PC9mb290ZXI+PC9zZWN0aW9uPjwvZGl2PmA7fVxuZnVuY3Rpb24gam9obm55VW5sb2NrSFRNTCgpe3JldHVybiAnPGRpdiBjbGFzcz1cIm1vZGFsLWJhY2tkcm9wIGRhaWx5LXVubG9ja3MtYmFja2Ryb3BcIj48c2VjdGlvbiBjbGFzcz1cImRhaWx5LXVubG9ja3Mgam9obm55LXVubG9ja1wiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWxsZWRieT1cImpvaG5ueS11bmxvY2stdGl0bGVcIj48aGVhZGVyPjxzcGFuIGNsYXNzPVwidW5sb2NrLWRheVwiPicrTCgn7KGw64uI7J2YIOq4sOyWtSDCtyDtnojrk6Ag66CI7Iuc7ZS8JywnSk9ITk5Z4oCZUyBNRU1PUlkgwrcgSElEREVOIFJFQ0lQRScpKyc8L3NwYW4+PGgyIGlkPVwiam9obm55LXVubG9jay10aXRsZVwiPicrTCgn7IOI66Gc7Jq0IOy5te2FjOydvOydtCDtlbTquIjrkJjsl4jsirXri4jri6QnLCdBIG5ldyBjb2NrdGFpbCBpcyB1bmxvY2tlZCcpKyc8L2gyPjxwPicrTCgn6riw7Ja1IOyGjSDroIjsi5ztlLzsmYAg66qo7JWEIOyYqCDsnqzro4wsIOyVhOydvOumrOydmCDqsIHshKTtg5XsnbQg7ZWcIOyelOycvOuhnCDsnbTslrTsp5Hri4jri6QuJywnSm9obm554oCZcyByZWNpcGUsIHRoZSBpbmdyZWRpZW50cyB5b3UgY29sbGVjdGVkLCBhbmQgQWlsaeKAmXMgc3VnYXIgY3ViZSBjb21lIHRvZ2V0aGVyLicpKyc8L3A+PC9oZWFkZXI+PGRpdiBjbGFzcz1cImpvaG5ueS11bmxvY2stYm9keVwiPjxkaXYgY2xhc3M9XCJqb2hubnktdW5sb2NrLWRyaW5rXCI+Jytkcmlua0FydCgnam9obm55X29sZF9mYXNoaW9uZWQnLCdyZWNpcGUnKSsnPGgzPicrTCgn7Jis65OcIO2MqOyFmOuTnCcsJ09sZCBGYXNoaW9uZWQnKSsnPC9oMz48cD4nK0woJ+yYrOuTnO2MqOyFmOuTnCDsnpQgwrcg66+57IuxIOq4gOudvOyKpCDCtyDsiqTthLAnLCdPbGQgZmFzaGlvbmVkIGdsYXNzIMK3IE1peGluZyBnbGFzcyDCtyBTdGlyJykrJzwvcD48L2Rpdj48ZGl2IGNsYXNzPVwiam9obm55LXVubG9jay1zdG9ja1wiPjxoMz4nK0woJ+yerOujjCDshKDrsJjsl5Ag7LaU6rCA65CY7JeI7Iq164uI64ukJywnQWRkZWQgdG8geW91ciBzaGVsdmVzJykrJzwvaDM+JytbWyd3aWxkX2RvZycsJzQ1bWwnXSxbJ2JpdHRlcnMnLCc1bWwnXSxbJ3N1Z2FyX2N1YmUnLEwoJzHqsJwnLCcxIGN1YmUnKV1dLm1hcCgoW2lkLHF0eV0pPT4nPGRpdiBjbGFzcz1cImpvaG5ueS11bmxvY2staXRlbVwiIGRhdGEtdW5sb2NrLWlkPVwiJytpZCsnXCI+JytpdGVtQXJ0KGlkLCcnLCdyZWNpcGUnKSsnPHNwYW4+Jytlc2MoZy5uYW1lKGlkKSkrJzwvc3Bhbj48Yj4nK3F0eSsnPC9iPjwvZGl2PicpLmpvaW4oJycpKyc8cD4nK0woJ+qwgeyEpO2DleydgCDrpqztgZDslrQg7ISg67CYIOunqCDrgZ3sl5Ag7J6I7Iq164uI64ukLicsJ1RoZSBzdWdhciBjdWJlIGlzIGF0IHRoZSBlbmQgb2YgdGhlIGxpcXVldXIgc2hlbGYuJykrJzwvcD48L2Rpdj48L2Rpdj48Zm9vdGVyPicrYnV0dG9uKEwoJ+2ZleyduCDCtyDrjIDtmZQg6rOE7IaN7ZWY6riwJywnQ29udGludWUgY29udmVyc2F0aW9uJyksJ2NvbmZpcm1Kb2hubnlVbmxvY2snLCcnLCdwcmltYXJ5JykrJzwvZm9vdGVyPjwvc2VjdGlvbj48L2Rpdj4nO31cbmZ1bmN0aW9uIG92ZXJsYXlIVE1MKCl7aWYoIWcub3ZlcmxheSlyZXR1cm4gJyc7aWYoZy5vdmVybGF5PT09J3NldHRpbmdzJylyZXR1cm4gJzxkaXYgY2xhc3M9XCJtb2RhbC1iYWNrZHJvcFwiPicrd2luZG93Lkx1bmFTZXR0aW5ncy5odG1sKHtjb250ZXh0OnVpLm1pbmlnYW1lcz8ncHJhY3RpY2UnOidiYXInLG9uQ2xvc2U6KCk9PmFjdCgnY2xvc2VPdmVybGF5JyksZXhpdExhYmVsOnVpLm1pbmlnYW1lcz8n6riw66+5IOyEoO2DneycvOuhnCc6J+yLnOyekSDtmZTrqbTsnLzroZwnLG9uRXhpdDooKT0+YWN0KHVpLm1pbmlnYW1lcz8nbWluaUxvYmJ5Jzonc2V0dXAnKX0pKyc8L2Rpdj4nO2lmKGcub3ZlcmxheT09PSdtaW5pSW5ncmVkaWVudCcpcmV0dXJuIG1pbmlVSS5pbmdyZWRpZW50SFRNTCgpO2lmKGcub3ZlcmxheT09PSdqb2hubnlVbmxvY2snKXJldHVybiBqb2hubnlVbmxvY2tIVE1MKCk7aWYoZy5vdmVybGF5PT09J2RhaWx5VW5sb2NrcycpcmV0dXJuIGRhaWx5VW5sb2Nrc0hUTUwoKTtpZihnLm92ZXJsYXk9PT0naW5ncmVkaWVudFdhcm5pbmcnKXJldHVybiBpbmdyZWRpZW50V2FybmluZ0hUTUwoKTtpZihnLm92ZXJsYXk9PT0nb3BlbmVyV2FybmluZycpcmV0dXJuIGA8ZGl2IGNsYXNzPVwibW9kYWwtYmFja2Ryb3BcIj48c2VjdGlvbiBjbGFzcz1cIm1vZGFsIGluZ3JlZGllbnQtd2FybmluZ1wiIHJvbGU9XCJhbGVydGRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbGxlZGJ5PVwib3BlbmVyLXdhcm5pbmctdGl0bGVcIiBhcmlhLWRlc2NyaWJlZGJ5PVwib3BlbmVyLXdhcm5pbmctY29weVwiPjxoMiBpZD1cIm9wZW5lci13YXJuaW5nLXRpdGxlXCI+JHtMKCfrs5HrlLDqsJzqsIAg7ZWE7JqU7ZWp64uI64ukJywnQm90dGxlIG9wZW5lciByZXF1aXJlZCcpfTwvaDI+PHAgaWQ9XCJvcGVuZXItd2FybmluZy1jb3B5XCI+JHtMKCfrs5Hrp6Xso7zrpbwg65Sw66W066Ck66m0IOuovOyggCDrmpzqu5HsnYQg7Je07Ja07JW8IO2VqeuLiOuLpC4g64+E6rWsIOyEoOuwmOyXkOyEnCDrs5HrlLDqsJzrpbwg7ISg7YOd7ZW0IOyjvOyEuOyalC4nLCdPcGVuIHRoZSBib3R0bGUgYmVmb3JlIHBvdXJpbmcgdGhlIGJlZXIuIFBsZWFzZSBzZWxlY3QgYSBib3R0bGUgb3BlbmVyIGZyb20gdGhlIHRvb2wgc2hlbGYuJyl9PC9wPjxkaXYgY2xhc3M9XCJpbmdyZWRpZW50LXdhcm5pbmctYWN0aW9uc1wiPiR7YnV0dG9uKEwoJ+2ZleyduCcsJ09LJyksJ2Nsb3NlT3ZlcmxheScsJycsJ3ByaW1hcnknKX08L2Rpdj48L3NlY3Rpb24+PC9kaXY+YDtpZihnLm92ZXJsYXk9PT0nc2VydmVEZXRhaWxzJylyZXR1cm4gbW9kYWwoTCgn7YyQ7KCVIOqysOqzvCcsJ1Njb3JlIGRldGFpbHMnKSxzZXJ2ZVZpZXcuZGV0YWlsc0hUTUwoKSk7aWYodWkubWluaWdhbWVzJiZnLm92ZXJsYXk9PT0naGVscCcpcmV0dXJuIG1vZGFsKEwoJ+q4sOuvuSDrr7jri4jqsozsnoQg7KGw7J6RJywnTWluaWdhbWUgY29udHJvbHMnKSxtaW5pVUkuaGVscEhUTUwoKSx0cnVlKTtpZihnLm92ZXJsYXk9PT0nbWluaUV4aXQnKXJldHVybiBtb2RhbChMKCfquLDrr7kg7ISg7YOd7Jy866GcIOuPjOyVhOqwiOq5jOyalD8nLCdSZXR1cm4gdG8gbWluaWdhbWUgc2VsZWN0aW9uPycpLGA8cD4ke0woJ+2YhOyerCDsl7DsirXsnYAg7KKF66OM65Cp64uI64ukLiDqsJnsnYAg6riw66+57J2AIOyWuOygnOuToCDri6Tsi5wg7Iuc7J6R7ZWgIOyImCDsnojslrTsmpQuJywnVGhpcyBhdHRlbXB0IHdpbGwgZW5kLiBZb3UgY2FuIHJlcGxheSBhbnkgc2tpbGwgYXQgYW55IHRpbWUuJyl9PC9wPjxkaXYgY2xhc3M9XCJyb3dcIj4ke2J1dHRvbihMKCfqs4Tsho0g7Jew7Iq1JywnS2VlcCBwcmFjdGljaW5nJyksJ2Nsb3NlT3ZlcmxheScpfSR7YnV0dG9uKEwoJ+q4sOuvuSDshKDtg50nLCdDaG9vc2UgYSBtaW5pZ2FtZScpLCdtaW5pTG9iYnknLCcnLCdwcmltYXJ5Jyl9PC9kaXY+YCk7aWYoZy5vdmVybGF5PT09J3JlbWl4R29hbHMnKXJldHVybiBtb2RhbChMKCfsnbTrsogg7JiB7JeF7J2YIOuqqe2RnCcsJ1NoaWZ0IGdvYWxzJykscmVtaXhVSS5nb2Fsc0hUTUwoKSk7aWYoZy5vdmVybGF5PT09J3NlcnZpY2UnKXJldHVybiBzZXJ2aWNlSFRNTCgpO2lmKGcub3ZlcmxheT09PSdoZWxwJylyZXR1cm4gbW9kYWwoTCgn7KGw7J6RIOyViOuCtCcsJ0NvbnRyb2xzJykscmVtaXguYWN0aXZlKCk/cmVtaXhVSS5oZWxwSFRNTCgpOmhlbHBIVE1MKCksdHJ1ZSk7aWYoZy5vdmVybGF5PT09J3NhbGVzJylyZXR1cm4gbW9kYWwoTCgn66ek7LacIO2YhO2ZqScsJ1NhbGVzJyksc2FsZXNIVE1MKCksdHJ1ZSk7aWYoZy5vdmVybGF5PT09J2Rvc3NpZXInKXJldHVybiBkb3NzaWVySFRNTCgpO2lmKGcub3ZlcmxheT09PSdoaXN0b3J5JylyZXR1cm4gbW9kYWwoTCgn64yA7IKsIOq4sOuhnScsJ0RpYWxvZ3VlIGhpc3RvcnknKSxnLmhpc3Rvcnkuc2xpY2UoLTE1MCkubWFwKGg9PmA8ZGl2IGNsYXNzPVwiaGlzdG9yeS1saW5lXCI+PGI+JHtlc2MoaC5hbm9ueW1vdXM/Jz8/Pyc6Zy5uYW1lKGguYWN0b3IpKX08L2I+JHtlc2MoaC50ZXh0KX08L2Rpdj5gKS5qb2luKCcnKXx8JzxkaXYgY2xhc3M9XCJlbXB0eVwiPicrTCgn7JWE7KeBIOuMgOyCrOqwgCDsl4bsirXri4jri6QuJywnTm8gZGlhbG9ndWUgeWV0LicpKyc8L2Rpdj4nKTtpZihnLm92ZXJsYXk9PT0ncmVjaXBlJylyZXR1cm4gbW9kYWwoZXNjKGcubmFtZShnLmNyYWZ0LmFjdHVhbC5zZWxlY3RlZCkpLHJlY2lwZUxpbmVzKGcuY29ja3RhaWwoZy5jcmFmdC5hY3R1YWwuc2VsZWN0ZWQpKSk7aWYoZy5vdmVybGF5PT09J3Jlc3RhcnQnKXJldHVybiBtb2RhbChMKCfthYzsiqTtirjrpbwg64uk7IucIOyLnOyeke2VoOq5jOyalD8nLCdSZXN0YXJ0IHRoZSB0ZXN0PycpLGA8cD4ke0woJ+2YhOyerCDsmIHsl4Ug7IOB7YOc64qUIOy0iOq4sO2ZlOuQqeuLiOuLpC4g7ZWE7JqU7ZWcIOqyveyasCDroZzqt7jrpbwg66i87KCAIOuCtOuztOuCtOyEuOyalC4nLCdDdXJyZW50IHNlc3Npb24gc3RhdGUgd2lsbCBiZSByZXNldC4gRXhwb3J0IGxvZ3MgZmlyc3QgaWYgbmVlZGVkLicpfTwvcD48ZGl2IGNsYXNzPVwicm93XCI+JHtidXR0b24oTCgn66Gc6re4IOuCtOuztOuCtOq4sCcsJ0V4cG9ydCBsb2dzJyksJ2V4cG9ydCcpfSR7YnV0dG9uKEwoJ+ydvOywqCDshKDtg53snLzroZwnLCdTZXNzaW9uIHNldHVwJyksJ3NldHVwJywnJywncHJpbWFyeScpfTwvZGl2PmApO3JldHVybiAnJzt9XG5mdW5jdGlvbiB1cGtlZXBJbnNwZWN0b3JIVE1MKCl7XG4gY29uc3QgaW5mbz1nLnVwa2VlcEluZm8oKTtyZXR1cm4gYDxsYWJlbD4ke0woJ+2VmOujqCDsoJXsgrAg7YWM7Iqk7Yq4JywnRGFpbHkgc2V0dGxlbWVudCB0ZXN0Jyl9PC9sYWJlbD48ZGl2IGNsYXNzPVwiaW5zcGVjdC1yb3dcIj4ke0woJ+ydtOuyiCDsnKDsp4DruYQnLCdVcGtlZXAnKX06ICR7bW9uZXkoaW5mby5hbW91bnQpfSDCtyAke2luZm8uc291cmNlPT09J3dlYl90ZXN0Jz9MKCfsm7kg7YWM7Iqk7Yq46rCSJywnVGVzdCBvdmVycmlkZScpOkwoJ+ydvOywqCDquLDrs7jqsJInLCdEYXkgZGVmYXVsdCcpfTwvZGl2PjxkaXYgY2xhc3M9XCJyb3cgdXBrZWVwLWVkaXRvclwiPjxpbnB1dCB0eXBlPVwibnVtYmVyXCIgbWluPVwiMFwiIHN0ZXA9XCIxXCIgZGF0YS1pbnB1dD1cInVwa2VlcFwiIHZhbHVlPVwiJHtlc2ModWkudXBrZWVwKX1cIiBwbGFjZWhvbGRlcj1cIiR7TCgn67mI7Lm4ID0g642w7J207YSw6rCSJywnQmxhbmsgPSBkYXRhJyl9XCIgYXJpYS1sYWJlbD1cIuycoOyngOu5hCDthYzsiqTtirjqsJIg7IiY7KCVXCIgJHtnLmZpbmlzaGVkPydkaXNhYmxlZCc6Jyd9PiR7YnV0dG9uKEwoJ+yggeyaqScsJ0FwcGx5JyksJ2FwcGx5VXBrZWVwJyxnLmZpbmlzaGVkPydkaXNhYmxlZCc6JycpfTwvZGl2PiR7YnV0dG9uKEwoJ+yngOq4iCDsmIHsl4Ug64Gd64K06rOgIOygleyCsCDrs7TquLAnLCdFbmQgc2VydmljZSBub3cgYW5kIHNob3cgc2V0dGxlbWVudCcpLCdkZWJ1Z0VuZERheScsZy5maW5pc2hlZHx8Zy5waGFzZT09PSdyZWFkeSc/J2Rpc2FibGVkJzonJywnZGFuZ2VyJyl9PHNtYWxsPiR7TCgn6rKA7IiY7JqpIOyhsOq4sCDsooXro4zsnoXri4jri6QuIOuvuOygnOqztSDso7zrrLjsnYAg66ek7Lac7JeQIOuEo+yngCDslYrsirXri4jri6QuJywnVGVzdC1vbmx5IGVhcmx5IGVuZGluZy4gVW5zZXJ2ZWQgb3JkZXJzIGFyZSBub3QgY291bnRlZC4nKX08L3NtYWxsPmA7XG59XG5mdW5jdGlvbiBpbnNwZWN0b3JIVE1MKCl7aWYoIXVpLmluc3BlY3RvcilyZXR1cm4gJyc7Y29uc3QgZ3Vlc3Q9Zy5zZWF0c1tnLmZvY3VzXSxzdGVwPWcuc3Rvcnk/LnN0ZXBzW2cuc3RvcnkuaW5kZXhdO3JldHVybiBgPGFzaWRlIGNsYXNzPVwiaW5zcGVjdG9yXCI+PGhlYWRlcj48c3Bhbj5GMiDCtyAke0woJ+2FjOyKpO2KuCDrj4TqtawnLCdURVNUIFRPT0xTJyl9PC9zcGFuPiR7YnV0dG9uKCfDlycsJ2luc3BlY3RvcicpfTwvaGVhZGVyPjxkaXYgY2xhc3M9XCJpbnNwZWN0LWJvZHlcIj48ZGl2IGNsYXNzPVwiY29udHJhY3Qtbm90ZVwiPiR7TCgn7J20IO2MqOuEkCDsnpDssrTripQg7Iuc6rCE7J2EIOupiOy2lOyngCDslYrsirXri4jri6QuIOyImOy5mCDtmZXsnbjsnbQg7ZWE7JqU7ZWY66m0IEVTQyDsmLXshZjsnYQg7Je07Ja0IOygleyngO2VmOyEuOyalC4nLCdUaGlzIHBhbmVsIGRvZXMgbm90IHBhdXNlIHRpbWUuIE9wZW4gb3B0aW9ucyB3aXRoIEVTQyB0byBwYXVzZS4nKX08L2Rpdj48ZGl2IGNsYXNzPVwiaW5zcGVjdC1yb3dcIj4ke3BoYXNlKCl9IC8gJHtnLnNjcmVlbn08YnI+RGF5ICR7Zy5kYXl9IMK3IHNlZWQgJHtnLnNlZWR9PGJyPiR7TCgn7JiB7JeFIOqyveqzvCcsJ0JhciB0aW1lJyl9ICR7Zy5iYXJUaW1lLnRvRml4ZWQoMSl9cyDCtyAke0woJ+uCqOydgCDsiqTtj7AnLCdRdWV1ZWQnKX0gJHtNYXRoLm1heCgwLChnLnF1ZXVlPy5sZW5ndGh8fDApLShnLnF1ZXVlSW5kZXh8fDApKX08L2Rpdj4ke3N0ZXA/YDxkaXYgY2xhc3M9XCJpbnNwZWN0LXJvd1wiPnNjZW5lOiAke2VzYyhnLnN0b3J5LnNjZW5lLmlkKX08YnI+c2VxOiAke3N0ZXAuc2VxfSAvICR7c3RlcC50eXBlfTxicj53aGVuOiAke2VzYyhzdGVwLndoZW58fCfigJQnKX08YnI+ZWZmZWN0czogJHtlc2Moc3RlcC5lZmZlY3RzfHwn4oCUJyl9PC9kaXY+YDonJ30ke2d1ZXN0P2A8ZGl2IGNsYXNzPVwiaW5zcGVjdC1yb3dcIj4ke2VzYyhndWVzdC5pZCl9IMK3ICR7Zy5mb2N1c308YnI+JHtndWVzdC5zdGF0ZX08YnI+JHtndWVzdC5sZWZ0IT1udWxsPydwYXRpZW5jZTogJytndWVzdC5sZWZ0LnRvRml4ZWQoMSkrJyAvICcrZ3Vlc3QubGltaXQudG9GaXhlZCgxKSsncyc6Jyd9PGJyPiR7Z3Vlc3Qub3JkZXI/J29yZGVyOiAnK2d1ZXN0Lm9yZGVyLmlkKycgLyAnK2d1ZXN0Lm9yZGVyLmNvY2t0YWlsOicnfTwvZGl2PmA6Jyd9PGxhYmVsPiR7TCgn7Iuc6rCEIOuwsOyGjSDCtyDsnbzrsJgg7IaQ64uYIO2DgOydtOuouOunjCcsJ0Nsb2NrIHNwZWVkIMK3IGdlbmVyYWwgZ3Vlc3QgdGltZXJzIG9ubHknKX08L2xhYmVsPjxzZWxlY3QgZGF0YS1jaGFuZ2U9XCJzcGVlZFwiPiR7Wy4yNSwuNSwxLDIsNV0ubWFwKHY9PmA8b3B0aW9uIHZhbHVlPVwiJHt2fVwiICR7Zy5zcGVlZD09PXY/J3NlbGVjdGVkJzonJ30+w5cke3Z9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+JHt1cGtlZXBJbnNwZWN0b3JIVE1MKCl9JHtkb3NzaWVySW5zcGVjdG9ySFRNTCgpfTxsYWJlbD4ke0woJ+ygnOyhsCDqsoDsiJgg67O07KGwJywnQ3JhZnQgdGVzdGluZyBoZWxwZXJzJyl9PC9sYWJlbD4ke2J1dHRvbihMKCfsoJXri7Ug7J6s66OMwrfsnpTCt+uPhOq1rCDssYTsmrDquLAnLCdGaWxsIGNvcnJlY3QgcmVjaXBlJyksJ2RlYnVnRmlsbCcsZy5zY3JlZW4hPT0ncHJlcCc/J2Rpc2FibGVkJzonJyl9PGRpdiBjbGFzcz1cInJvdyB3cmFwXCI+JHtbJ2V4Y2VsbGVudCcsJ2dvb2QnLCdwb29yJywnc2V3YWdlJ10ubWFwKGdyYWRlPT5idXR0b24oZ3JhZGUsJ2RlYnVnQ3JhZnQnLGBkYXRhLWlkPVwiJHtncmFkZX1cIiAkeyFbJ3ByZXAnLCdnaW1taWNrJ10uaW5jbHVkZXMoZy5zY3JlZW4pPydkaXNhYmxlZCc6Jyd9YCkpLmpvaW4oJycpfTwvZGl2PjxsYWJlbD4ke0woJ+ynhO2WiSDsg4Htg5wnLCdQcm9ncmVzcycpfTwvbGFiZWw+PHByZT4ke2VzYyhKU09OLnN0cmluZ2lmeShnLnByb2dyZXNzLG51bGwsMikpfTwvcHJlPjxsYWJlbD4ke0woJ+y1nOq3vCDsnbTrsqTtirgnLCdSZWNlbnQgZXZlbnRzJyl9PC9sYWJlbD4ke2cubG9ncy5zbGljZSgtOCkucmV2ZXJzZSgpLm1hcChlPT5gPGRpdiBjbGFzcz1cImluc3BlY3Qtcm93XCI+JHtlLnRpbWV9cyDCtyAke2VzYyhlLmV2ZW50KX08YnI+PHNtYWxsPiR7ZXNjKEpTT04uc3RyaW5naWZ5KGUpLnNsaWNlKDAsMTkwKSl9PC9zbWFsbD48L2Rpdj5gKS5qb2luKCcnKX08ZGl2IGNsYXNzPVwiZGl2aWRlclwiPjwvZGl2PiR7YnV0dG9uKEwoJ+yghOyytCDroZzqt7ggSlNPTiDrgrTrs7TrgrTquLAnLCdFeHBvcnQgbG9nIEpTT04nKSwnZXhwb3J0Jyl9PHAgY2xhc3M9XCJyZWNpcGUtbm90ZVwiPiR7RC5zb3VyY2UuYnJhbmNofTxicj4ke2VzYyhELnNvdXJjZS5pbXBvcnRlZEF0KX08YnI+MjkgQ1NWIMK3ICR7RC50YWJsZXMuc3RlcHMubGVuZ3RofSBzdGVwczwvcD48L2Rpdj48L2FzaWRlPmA7fVxuZnVuY3Rpb24gc2V0dGxlbWVudEhUTUwoKXtyZXR1cm4gd2luZG93Lkx1bmFTZXR0bGVtZW50Vmlldy5odG1sKHtnLG1haW46ISFjYW1wYWlnbj8uYWN0aXZlLGNoYWxsZW5nZTohIShyZW1peC5hY3RpdmUoKSYmZy5yZW1peC5jaGFsbGVuZ2UpfSk7fVxuZnVuY3Rpb24gZ2FtZW92ZXJIVE1MKCl7cmV0dXJuIHdpbmRvdy5MdW5hU2V0dGxlbWVudFZpZXcuaHRtbCh7ZyxtYWluOiEhY2FtcGFpZ24/LmFjdGl2ZSxnYW1lb3Zlcjp0cnVlfSk7fVxuZnVuY3Rpb24gZXJyb3JIVE1MKCl7cmV0dXJuIG1vZGFsKCdEQVRBX0VSUk9SJyxgPHAgY2xhc3M9XCJjcml0aWNhbFwiPiR7ZXNjKGcuZXJyb3IpfTwvcD48cD4ke0woJ+yemOuqu+uQnCDrjbDsnbTthLDrgpgg66+47KeA7JuQIOyXsOqysOydhCDrp4zrgqzsirXri4jri6QuIOygkOyImMK37KO866y47J2EIOyehOydmOuhnCDtmZXsoJXtlZjsp4Ag7JWK7Iq164uI64ukLiDroZzqt7jrpbwg64K067O064K0IOyXsOqysCDsp4DsoJDsnYQg7ZmV7J247ZWgIOyImCDsnojsirXri4jri6QuJywnSW52YWxpZCBkYXRhIG9yIGFuIHVuc3VwcG9ydGVkIGNvbm5lY3Rpb24gd2FzIGVuY291bnRlcmVkLiBObyByZXN1bHQgd2lsbCBiZSBpbnZlbnRlZDsgZXhwb3J0IGxvZ3MgdG8gaW5zcGVjdCB0aGUgcmVmZXJlbmNlLicpfTwvcD48ZGl2IGNsYXNzPVwicm93IHdyYXBcIj4ke2cuY3JhZnQ/YnV0dG9uKEwoJ+qwmeydgCDsnqzro4zroZwg7J6s7Iuc64+EJywnUmV0cnkgc2FtZSBtYXRlcmlhbHMnKSwncmV0cnknLCcnLCdwcmltYXJ5JykrYnV0dG9uKEwoJ+ygnOyhsCDst6jshownLCdDYW5jZWwgY3JhZnRpbmcnKSwnY2FuY2VsQ3JhZnQnKTonJ30ke2J1dHRvbihMKCfroZzqt7gg64K067O064K06riwJywnRXhwb3J0IGxvZ3MnKSwnZXhwb3J0Jyl9JHtidXR0b24oTCgn7Iuc7J6RIO2ZlOuptCcsJ1Nlc3Npb24gc2V0dXAnKSwnc2V0dXAnKX08L2Rpdj5gLGZhbHNlLGZhbHNlKTt9XG4vLyBQYXRjaCBleGlzdGluZyBub2RlcyBpbnN0ZWFkIG9mIHJlYnVpbGRpbmcgdGhlIFVJIGV2ZXJ5IHR5cGluZyBmcmFtZS5cbi8vIFRoaXMgcHJlc2VydmVzIGhlbGQgYnV0dG9ucywgZm9jdXMsIHNjcm9sbCBwb3NpdGlvbiBhbmQgQ1NTIHRyYW5zaXRpb25zLlxuZnVuY3Rpb24gbW9ycGgocGFyZW50LG5leHQpe1xuIGZvcihsZXQgaT0wO2k8bmV4dC5jaGlsZE5vZGVzLmxlbmd0aHx8aTxwYXJlbnQuY2hpbGROb2Rlcy5sZW5ndGg7aSsrKXtcbiAgY29uc3QgYT1wYXJlbnQuY2hpbGROb2Rlc1tpXSxiPW5leHQuY2hpbGROb2Rlc1tpXTtpZighYil7cGFyZW50LnJlbW92ZUNoaWxkKGEpO2ktLTtjb250aW51ZTt9aWYoIWEpe3BhcmVudC5hcHBlbmRDaGlsZChiLmNsb25lTm9kZSh0cnVlKSk7Y29udGludWU7fVxuICBpZihhLm5vZGVUeXBlIT09Yi5ub2RlVHlwZXx8YS5ub2RlTmFtZSE9PWIubm9kZU5hbWUpe2EucmVwbGFjZVdpdGgoYi5jbG9uZU5vZGUodHJ1ZSkpO2NvbnRpbnVlO31cbiAgaWYoYS5ub2RlVHlwZT09PTMpe2lmKGEubm9kZVZhbHVlIT09Yi5ub2RlVmFsdWUpYS5ub2RlVmFsdWU9Yi5ub2RlVmFsdWU7Y29udGludWU7fVxuICBpZihhLm5vZGVUeXBlIT09MSljb250aW51ZTtcbiAgLy8gSG9sZCBvd25zIHRoaXMgdHJhbnNpZW50IHN0YXRlLiBQcmVzZXJ2ZSBpdCBhY3Jvc3Mgb3JkaW5hcnkgc2NlbmUgcmVkcmF3c1xuICAvLyBzbyB0aGUgdGl0bGUtc2lnbmFsIGFuaW1hdGlvbiBkb2VzIG5vdCByZXN0YXJ0IG9uIGV2ZXJ5IHJlbmRlciBwYXNzLlxuICBpZihhLm1hdGNoZXMoJy5jaG9pY2VzIGJ1dHRvbi5jaG9pY2UtaG9sZGluZ1tkYXRhLWFjdD1cImNob2ljZVwiXScpJiZiLm1hdGNoZXMoJ2J1dHRvbltkYXRhLWFjdD1cImNob2ljZVwiXScpJiZhLmRhdGFzZXQuaWQ9PT1iLmRhdGFzZXQuaWQpe1xuICAgYi5jbGFzc0xpc3QuYWRkKCdjaG9pY2UtaG9sZGluZycpO2Iuc3R5bGUuc2V0UHJvcGVydHkoJy0tY2hvaWNlLXByb2dyZXNzJyxhLnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tY2hvaWNlLXByb2dyZXNzJykpO1xuICB9XG4gIGZvcihjb25zdCBhdHRyIG9mIFsuLi5hLmF0dHJpYnV0ZXNdKWlmKCFiLmhhc0F0dHJpYnV0ZShhdHRyLm5hbWUpKWEucmVtb3ZlQXR0cmlidXRlKGF0dHIubmFtZSk7XG4gIGZvcihjb25zdCBhdHRyIG9mIFsuLi5iLmF0dHJpYnV0ZXNdKWlmKGEuZ2V0QXR0cmlidXRlKGF0dHIubmFtZSkhPT1hdHRyLnZhbHVlKWEuc2V0QXR0cmlidXRlKGF0dHIubmFtZSxhdHRyLnZhbHVlKTtcbiAgbW9ycGgoYSxiKTtpZihbJ0lOUFVUJywnU0VMRUNUJ10uaW5jbHVkZXMoYS5ub2RlTmFtZSkmJmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQhPT1hJiZhLnZhbHVlIT09Yi52YWx1ZSlhLnZhbHVlPWIudmFsdWU7XG4gfVxufVxuY29uc3Qgdmlld3M9d2luZG93Lkx1bmFCYXJWaWV3cyh7RCxnLHVpLEwsZXNjLGEsYnV0dG9uLGl0ZW1BcnQsZHJpbmtBcnQscmVjaXBlTGluZXN9KTtcbmNvbnN0IHNlcnZlVmlldz13aW5kb3cuTHVuYVNlcnZlVmlldyh7ZyxELEMsTCxlc2MsYnV0dG9uLGRyaW5rQXJ0LGxhYmVsVHlwZX0pO1xuY29uc3QgcmVtaXhVST13aW5kb3cuTHVuYVJlbWl4VUkoe2csRCx1aSxMLGVzYyxhLGJ1dHRvbixpdGVtQXJ0LGRyaW5rQXJ0LHJlY2lwZUxpbmVzLHJlbWl4LHJlY2lwZVBhbmVsOnZpZXdzLnJlY2lwZVBhbmVsfSk7XG5pZihuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCkuZ2V0KCd2ZXJzaW9uJyk9PT0nZ3B0Jyl7dWkudmFyaWFudD0nZ3B0Jzt1aS5kYXk9MDt1aS5tb2RlPSdlcGlzb2RlJztnLnJlc2V0KDAsJ2VwaXNvZGUnLDEsZmFsc2Use3ZhcmlhbnQ6J2dwdCd9KTt0cnl7Zy5yZWFkPW5ldyBTZXQoSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbHVuYS5iYXIuZ3B0LnJlYWQudjEnKXx8J1tdJykpO31jYXRjaHtnLnJlYWQ9bmV3IFNldCgpO319XG5pZihuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCkuZ2V0KCdtb2RlJyk9PT0nb3V0c2lkZScpdWkub3V0c2lkZT10cnVlO1xuaWYobmV3IFVSTFNlYXJjaFBhcmFtcyhsb2NhdGlvbi5zZWFyY2gpLmdldCgnbW9kZScpPT09J2N1dHNjZW5lcycpdWkuY3V0c2NlbmVzPXRydWU7XG5sZXQgY2FtcGFpZ249bnVsbDtcbmNvbnN0IG91dHNpZGU9d2luZG93Lm91dHNpZGVQbGF5dGVzdD13aW5kb3cuTHVuYU91dHNpZGUuY3JlYXRlKHtjdXJyZW5jeVZpZXcsb25FeGl0OigpPT57dWkub3V0c2lkZT10cnVlO3JlbmRlcih0cnVlKTtyb290LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLW91dHNpZGUtYWN0aW9uPVwic3RhcnRcIl0nKT8uZm9jdXMoKTt9fSk7XG5jb25zdCBtaW5pVUk9d2luZG93Lkx1bmFNaW5pZ2FtZXMuY3JlYXRlVUkoe2csdWksTCxlc2MsYnV0dG9uLGl0ZW1BcnQsdGFic0hUTUw6cmVtaXhVSS50YWJzSFRNTCxtaW5pfSk7XG5pZihuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCkuZ2V0KCdtb2RlJyk9PT0nbWluaWdhbWVzJyl1aS5taW5pZ2FtZXM9dHJ1ZTtcbmZ1bmN0aW9uIG1pbmlMb2JieSgpe2cucmVzZXQoOTksJ3ByYWN0aWNlJywxLGZhbHNlLHt2YXJpYW50OnVpLnZhcmlhbnR9KTt1aS5taW5pZ2FtZXM9dHJ1ZTt1aS5pbnNwZWN0b3I9ZmFsc2U7dWkuYXV0bz1mYWxzZTtjbGVhckNvbnRyb2xTa2lwKCk7dWkuZHJhZz1udWxsO2cuc3BlZWQ9MTt9XG5mdW5jdGlvbiBtaW5pU3RhcnQoa2luZCxpbmdyZWRpZW50KXtjb25zdCB2YXJpYW50PSdvcmlnaW5hbCc7dHJ5e2xvY2FsU3RvcmFnZS5zZXRJdGVtKGcudmFyaWFudD09PSdncHQnPydsdW5hLmJhci5ncHQucmVhZC52MSc6J2x1bmEuYmFyLnBsYXl0ZXN0LnJlYWQudjEnLEpTT04uc3RyaW5naWZ5KFsuLi5nLnJlYWRdKSk7fWNhdGNoe31nLnN0YXJ0TWluaWdhbWUoa2luZCx7aW5ncmVkaWVudH0pO3VpLnZhcmlhbnQ9dmFyaWFudDt1aS5taW5pZ2FtZXM9dHJ1ZTt1aS5pbnNwZWN0b3I9ZmFsc2U7dWkuYXV0bz1mYWxzZTtjbGVhckNvbnRyb2xTa2lwKCk7Zy5zcGVlZD0xO3RyeXtnLnJlYWQ9bmV3IFNldChKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKHZhcmlhbnQ9PT0nZ3B0Jz8nbHVuYS5iYXIuZ3B0LnJlYWQudjEnOidsdW5hLmJhci5wbGF5dGVzdC5yZWFkLnYxJyl8fCdbXScpKTt9Y2F0Y2h7Zy5yZWFkPW5ldyBTZXQoKTt9fVxubGV0IHJlY2lwZVBvaW50ZXI9bnVsbDtcbmxldCBpbmdyZWRpZW50UG9pbnRlcj1udWxsO1xuZnVuY3Rpb24gc3luY0luZ3JlZGllbnRQb2ludGVyVGlwKCl7XG4gY29uc3QgdGlwPXJvb3QucXVlcnlTZWxlY3RvcignI2luZ3JlZGllbnQtdGlwJykscGFuZWw9dGlwPy5wYXJlbnRFbGVtZW50O1xuIGNvbnN0IGl0ZW09cm9vdC5xdWVyeVNlbGVjdG9yKCcuc2hlbGYtc2xpZGVbZGF0YS1jdXJyZW50PVwidHJ1ZVwiXSBbZGF0YS1ob3Zlci1pdGVtPVwiJyt1aS5ob3Zlckl0ZW0rJ1wiXScpO1xuIGlmKCF0aXB8fCFwYW5lbHx8IWl0ZW0pcmV0dXJuO1xuIGNvbnN0IGJvdW5kcz1wYW5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxyPWl0ZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gY29uc3Qgc3g9Ym91bmRzLndpZHRoL3BhbmVsLm9mZnNldFdpZHRoLHN5PWJvdW5kcy5oZWlnaHQvcGFuZWwub2Zmc2V0SGVpZ2h0O2lmKCFzeHx8IXN5KXJldHVybjtcbiAvLyBLZWVwIGNsaWVudC1zcGFjZSBwb2ludGVyIGNvb3JkaW5hdGVzIGFjY3VyYXRlIGluIHNjYWxlZC9mdWxsc2NyZWVuIGdhbWUgdmlld3MuXG4gY29uc3QgcG9pbnRlcj1pbmdyZWRpZW50UG9pbnRlcj8uaWQ9PT11aS5ob3Zlckl0ZW0/aW5ncmVkaWVudFBvaW50ZXI6e3g6ci5yaWdodCx5OnIudG9wK3IuaGVpZ2h0LzJ9O1xuIGNvbnN0IHQ9dGlwLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLGdhcD0xNixtYXJnaW49ODtcbiBjb25zdCBsZWZ0PU1hdGgubWF4KGJvdW5kcy5sZWZ0LDApK21hcmdpbixyaWdodD1NYXRoLm1pbihib3VuZHMucmlnaHQsaW5uZXJXaWR0aCktbWFyZ2luO1xuIGNvbnN0IHRvcD1NYXRoLm1heChib3VuZHMudG9wLDApK21hcmdpbixib3R0b209TWF0aC5taW4oYm91bmRzLmJvdHRvbSxpbm5lckhlaWdodCktbWFyZ2luO1xuIGxldCB4PXBvaW50ZXIueCtnYXAseT1wb2ludGVyLnkrZ2FwO1xuIGlmKHgrdC53aWR0aD5yaWdodCl4PXBvaW50ZXIueC10LndpZHRoLWdhcDtcbiBpZih5K3QuaGVpZ2h0PmJvdHRvbSl5PXBvaW50ZXIueS10LmhlaWdodC1nYXA7XG4geD1NYXRoLm1heChsZWZ0LE1hdGgubWluKHgscmlnaHQtdC53aWR0aCkpO3k9TWF0aC5tYXgodG9wLE1hdGgubWluKHksYm90dG9tLXQuaGVpZ2h0KSk7XG4gdGlwLnN0eWxlLmxlZnQ9KCh4LWJvdW5kcy5sZWZ0KS9zeC1wYW5lbC5jbGllbnRMZWZ0KSsncHgnO1xuIHRpcC5zdHlsZS50b3A9KCh5LWJvdW5kcy50b3ApL3N5LXBhbmVsLmNsaWVudFRvcCkrJ3B4Jztcbn1cbmZ1bmN0aW9uIHN5bmNSZWNpcGVQb2ludGVyVGlwKCl7XG4gY29uc3Qgc2xvdD1yZWNpcGVQb2ludGVyPy5zbG90O2lmKCFzbG90Py5pc0Nvbm5lY3RlZHx8IXNsb3QubWF0Y2hlcygnOmhvdmVyJykpcmV0dXJuO1xuIGNvbnN0IHRpcD1zbG90LnF1ZXJ5U2VsZWN0b3IoJy5yZWNpcGUtaXRlbS10aXAnKSxzY3JvbGw9c2xvdC5jbG9zZXN0KCcucHJlcC1yZWNpcGUtc2Nyb2xsJyk7aWYoIXRpcHx8IXNjcm9sbClyZXR1cm47XG4gY29uc3Qgcj1zbG90LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLGJvdW5kcz1zY3JvbGwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksdD10aXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gY29uc3Qgc3g9ci53aWR0aC9zbG90Lm9mZnNldFdpZHRoLHN5PXIuaGVpZ2h0L3Nsb3Qub2Zmc2V0SGVpZ2h0O2lmKCFzeHx8IXN5KXJldHVybjtcbiBsZXQgeD1yZWNpcGVQb2ludGVyLngrMTQseT1yZWNpcGVQb2ludGVyLnkrMTQ7XG4gaWYoeCt0LndpZHRoPmJvdW5kcy5yaWdodC04KXg9cmVjaXBlUG9pbnRlci54LXQud2lkdGgtMTQ7XG4gaWYoeSt0LmhlaWdodD5ib3VuZHMuYm90dG9tLTgpeT1yZWNpcGVQb2ludGVyLnktdC5oZWlnaHQtMTQ7XG4geD1NYXRoLm1heChib3VuZHMubGVmdCs0LE1hdGgubWluKHgsYm91bmRzLnJpZ2h0LXQud2lkdGgtOCkpO1xuIHk9TWF0aC5tYXgoYm91bmRzLnRvcCs0LE1hdGgubWluKHksYm91bmRzLmJvdHRvbS10LmhlaWdodC04KSk7XG4gdGlwLnN0eWxlLmxlZnQ9KCh4LXIubGVmdCkvc3gtc2xvdC5jbGllbnRMZWZ0KSsncHgnO3RpcC5zdHlsZS50b3A9KCh5LXIudG9wKS9zeS1zbG90LmNsaWVudFRvcCkrJ3B4Jztcbn1cbmNvbnN0IGNob2ljZUhvbGQ9d2luZG93Lkx1bmFDaG9pY2VIb2xkKHtyb290LGNob2ljZTooKT0+Zy5jaG9pY2UsYWxsb3dlZDooKT0+ISFnLmNob2ljZSYmZy5zY3JlZW49PT0nYmFyJyYmIWcuaXNQYXVzZWQoKSYmIWcuZmluaXNoZWQmJiFnLmNhbWVyYU1vdmluZyYmIWcuY2FtZXJhTGVmdCYmIWcudHJhbnNpdGlvbiYmIXVpLmluc3BlY3RvciYmIXVpLmRyYWcmJiFvdXRzaWRlLmFjdGl2ZSYmIWNhbXBhaWduPy5ibG9ja2luZyxjb21taXQ6aWQ9PmFjdCgnY2hvaWNlJyxpZCl9KTtcbmxldCBsYXN0U3RydWN0dXJlPScnLGxhc3RGb2N1c2VkQ2hvaWNlPW51bGw7XG5mdW5jdGlvbiByZW5kZXIoZm9yY2U9ZmFsc2Upe1xuIGlmKG91dHNpZGUuYWN0aXZlfHwoY2FtcGFpZ24/LmJsb2NraW5nJiZjYW1wYWlnbi52aWV3IT09J2F3YWtlbmluZycmJiEoY2FtcGFpZ24udmlldz09PSdiYXItZG9vcicmJmNhbXBhaWduLmRvb3JUcmFuc2l0aW9uPy5jb21taXR0aW5nKSkpcmV0dXJuO1xuIHR1dG9yaWFsVmlldy51cGRhdGVTaGVsZihyb290KTt2aWV3cy5zeW5jQ2FtZXJhKHJvb3QpO1xuIGNvbnN0IHNjcm9sbHM9Wy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbCgnLnJlY2lwZS1saXN0LC5pdGVtcy1ncmlkLC5wcmVwLXN1bW1hcnksLmluc3BlY3QtYm9keSwubW9kYWwsLnRhYmxlLXNjcm9sbCwuZG9zc2llci1saXN0LXNjcm9sbCwucHJvZmlsZS1ib2R5LC5wcmVwLXJlY2lwZS1zY3JvbGwnKV0ubWFwKGU9PltlLmNsYXNzTmFtZSxlLnNjcm9sbFRvcF0pO1xuIGNvbnN0IGxpdmVCYXI9Zy5zY3JlZW49PT0nYmFyJyYmIVsncmVhZHknLCdhcnJpdmFsJ10uaW5jbHVkZXMoZy5waGFzZSkmJiFnLmZpbmlzaGVkO1xuIGNvbnN0IGJsb2NrZWQ9Zy5pc1BhdXNlZCgpfHwhbGl2ZUJhcjtcbiBjb25zdCBodG1sPWA8ZGl2IGNsYXNzPVwiYXBwLXNoZWxsICR7dWkudmFyaWFudD09PSdncHQnPydncHQtdmVyc2lvbic6Jyd9ICR7Zy5taW5pZ2FtZT8nbWluaWdhbWUtdmVyc2lvbic6Jyd9XCI+PG1haW4gY2xhc3M9XCJ3b3Jrc3BhY2VcIj4ke2cucGhhc2UhPT0ncmVhZHknJiYoIWcubWluaWdhbWV8fGcuZ2ltbWljaz8uZmx1aWQpP2N1cnJlbmN5SFRNTCgpOicnfVxuICA8ZGl2IGNsYXNzPVwiY29ybmVyLXRvb2xzICR7Zy5zY3JlZW49PT0ncHJlcCc/J3ByZXAtY29ybmVyLXRvb2xzJzonJ31cIiAke2cub3ZlcmxheXx8Zy5wYXVzZWR8fGcuZXJyb3I/J2luZXJ0JzonJ30+XG4gICAke1snYmFyJywncHJlcCddLmluY2x1ZGVzKGcuc2NyZWVuKSYmIWcuZmluaXNoZWQ/YnV0dG9uKCc/JywnaGVscCcsJ2FyaWEtbGFiZWw9XCInK0woJ+yhsOyekSDslYjrgrQnLCdDb250cm9scycpKydcIiB0aXRsZT1cIicrTCgn7KGw7J6RIOyViOuCtCcsJ0NvbnRyb2xzJykrJ1wiJywnaGVscC1jb3JuZXInKTonJ31cbiAgPC9kaXY+XG4gIDxkaXYgY2xhc3M9XCJiYXItdmlld1wiIGRhdGEtdHV0b3JpYWw9XCIke3R1dG9yaWFsVmlldy5zdGFnZSgpfHwnJ31cIiAke2cub3ZlcmxheXx8Zy5wYXVzZWR8fGcuZXJyb3J8fCFsaXZlQmFyPydpbmVydCc6Jyd9PiR7YmFySFRNTCgpfVxuICAgJHtsaXZlQmFyJiYoIVsncmVndWxhcicsJ29wZW5pbmcnXS5pbmNsdWRlcyhnLnBoYXNlKXx8Zy50dXRvcmlhbD8ua2luZD09PSdyZWNpcGUnKT9idXR0b24oJzxzcGFuPicrTCgn7ISc67mE7IqkIO2MqOuEkCcsJ1NlcnZpY2UgcGFuZWwnKSsnPC9zcGFuPjxrYmQ+VGFiPC9rYmQ+Jywnc2VydmljZScsYGFyaWEtZXhwYW5kZWQ9XCIke2cub3ZlcmxheT09PSdzZXJ2aWNlJ31cIiBhcmlhLWNvbnRyb2xzPVwic2VydmljZS1wYW5lbFwiICR7Zy5pc1BhdXNlZCgpPydkaXNhYmxlZCc6Jyd9YCwnc2VydmljZS1oYW5kbGUnKTonJ31cbiAgICR7bGl2ZUJhciYmKGcucGhhc2U9PT0nZ2VuZXJhbCd8fGcudHV0b3JpYWw/LmtpbmQ9PT0nc2VhdEV4cGxvcmUnKT9bJ0EnLCdEJ10ubWFwKChrZXksaSk9PmJ1dHRvbigoaT8nJzonPHNwYW4gY2xhc3M9XCJ2aWV3LWNoZXZyb25cIiBhcmlhLWhpZGRlbj1cInRydWVcIj4mbHQ7PC9zcGFuPicpKyc8c3Bhbj4nK2tleSsnPC9zcGFuPicrKGk/JzxzcGFuIGNsYXNzPVwidmlldy1jaGV2cm9uXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+Jmd0Ozwvc3Bhbj4nOicnKSwnc2VhdCcsYGRhdGEtaWQ9XCIke1snTCcsJ00nLCdSJ11bTWF0aC5tYXgoMCxNYXRoLm1pbigyLFsnTCcsJ00nLCdSJ10uaW5kZXhPZihnLmZvY3VzKSsoaT8xOi0xKSkpXX1cIiBhcmlhLWxhYmVsPVwiJHtpP0woJ+yYpOuluOyqvSDsoozshJ0g67O06riwJywnVmlldyByaWdodCBzZWF0Jyk6TCgn7Jm87Kq9IOyijOyEnSDrs7TquLAnLCdWaWV3IGxlZnQgc2VhdCcpfVwiICR7YmxvY2tlZHx8Zy5mb2N1cz09PShpPydSJzonTCcpfHxnLnR1dG9yaWFsPy5raW5kPT09J3NlYXRFeHBsb3JlJyYmKGcuY2FtZXJhTW92aW5nfHxnLmNhbWVyYUxlZnQ+MCk/J2Rpc2FibGVkJzonJ31gLCAndmlldy1rZXkgJysoaT8nbmV4dCc6J3ByZXYnKSkpLmpvaW4oJycpOicnfVxuICAgJHtsaXZlQmFyJiYoZy5waGFzZT09PSdnZW5lcmFsJ3x8Zy5kYXk9PT0wJiZnLnZhcmlhbnQhPT0nZ3B0JyYmZy5wcm9ncmVzcy5mbGFncy5kYXkwX3NlYXRzX3JldmVhbGVkJiZbJ3NlYXRFeHBsb3JlJywnc2VhdEluZGljYXRvcicsJ3NlYXRMZWdlbmQnXS5pbmNsdWRlcyhnLnR1dG9yaWFsPy5raW5kKSk/YDxuYXYgY2xhc3M9XCJzZWF0LWluZGljYXRvcnNcIiBhcmlhLWxhYmVsPVwiJHtMKCftmITsnqwg67O064qUIOyijOyEnScsJ0N1cnJlbnQgc2VhdCcpfVwiPiR7WydMJywnTScsJ1InXS5tYXAoc2VhdD0+e2NvbnN0IGluZGljYXRvcj12aWV3cy5zZWF0SW5kaWNhdG9yKHNlYXQpO3JldHVybiBidXR0b24oJzxzcGFuPjwvc3Bhbj4nLCdzZWF0JyxgZGF0YS1pZD1cIiR7c2VhdH1cIiB0aXRsZT1cIiR7ZXNjKGluZGljYXRvci5sYWJlbCl9XCIgYXJpYS1sYWJlbD1cIiR7ZXNjKGluZGljYXRvci5sYWJlbCl9XCIgYXJpYS1wcmVzc2VkPVwiJHshZy5vdmVydmlldyYmZy5mb2N1cz09PXNlYXR9XCIgJHtibG9ja2VkPydkaXNhYmxlZCc6Jyd9YCwoIWcub3ZlcnZpZXcmJmcuZm9jdXM9PT1zZWF0PydzZWxlY3RlZCAnOicnKStpbmRpY2F0b3IuY2xhc3NOYW1lKTt9KS5qb2luKCcnKX08L25hdj5gOicnfVxuICA8L2Rpdj5cbiAgJHtyZW1peC5hY3RpdmUoKSYmbGl2ZUJhcj9yZW1peFVJLmh1ZEhUTUwoKTpvcmlnaW5hbFNlcnZpY2VUaXBIVE1MKCl9JHtnLnBoYXNlPT09J3JlYWR5Jz9zdGFydEhUTUwoKTonJ30ke2cuc2NyZWVuPT09J3JlY2lwZSc/cmVjaXBlc0hUTUwoKTonJ30ke2cuc2NyZWVuPT09J3ByZXAnP3ByZXBIVE1MKCkrKHJlbWl4LmFjdGl2ZSgpP3JlbWl4VUkucHJlcEhUTUwoKTonJyk6Jyd9JHtnLnNjcmVlbj09PSdnaW1taWNrJz9naW1taWNrSFRNTCgpKyhyZW1peC5hY3RpdmUoKT9yZW1peFVJLmdpbW1pY2tIVE1MKCk6JycpOicnfSR7Zy5zY3JlZW49PT0nbWluaWdhbWVfcmVzdWx0Jz9taW5pVUkucmVzdWx0SFRNTCgpOicnfSR7WydyZXN1bHQnLCdkaXNjYXJkaW5nJ10uaW5jbHVkZXMoZy5zY3JlZW4pP3Jlc3VsdEhUTUwoKTonJ30ke2cuc2NyZWVuPT09J3NldHRsZW1lbnQnP3NldHRsZW1lbnRIVE1MKCk6Jyd9JHtnLnNjcmVlbj09PSdnYW1lb3Zlcic/Z2FtZW92ZXJIVE1MKCk6Jyd9JHtnLnBhdXNlZD9gPGRpdiBjbGFzcz1cInBhdXNlLWZ1bGxcIj4ke2J1dHRvbign4pa2ICcrTCgn6rOE7IaN7ZWY6riwJywnUmVzdW1lJyksJ3BhdXNlJyl9PC9kaXY+YDonJ30ke292ZXJsYXlIVE1MKCl9JHt0dXRvcmlhbFZpZXcuaHRtbCgpfSR7Zy5lcnJvcj9lcnJvckhUTUwoKTonJ30ke2luc3BlY3RvckhUTUwoKX0ke2cuZWZmZWN0VmlzdWFsJiZnLnJlYWxUaW1lPGcuZWZmZWN0VmlzdWFsLnVudGlsJiZnLmVmZmVjdFZpc3VhbC5raW5kPT09J2Z4Jz8nPGRpdiBjbGFzcz1cImVmZmVjdC1mbGFzaFwiPjwvZGl2Pic6Jyd9XG4gPC9tYWluPjwvZGl2PmA7XG4gaWYoZm9yY2V8fGh0bWwhPT1sYXN0U3RydWN0dXJlKXtjb25zdCB0ZW1wbGF0ZT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZW1wbGF0ZScpO3RlbXBsYXRlLmlubmVySFRNTD1odG1sO21vcnBoKHJvb3QsdGVtcGxhdGUuY29udGVudCk7dmlld3Muc3luY0NhbWVyYShyb290KTtsYXN0U3RydWN0dXJlPWh0bWw7Zm9yKGNvbnN0IFtjbHMsdG9wXW9mIHNjcm9sbHMpe2NvbnN0IGU9cm9vdC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGNscylbMF07aWYoZSllLnNjcm9sbFRvcD10b3A7fX1cbiBzeW5jUmVjaXBlUG9pbnRlclRpcCgpO3N5bmNJbmdyZWRpZW50UG9pbnRlclRpcCgpO3R1dG9yaWFsVmlldy5zeW5jKHJvb3QpO2Nob2ljZUhvbGQuc3luYygpO3dpbmRvdy5MdW5hU2V0dGxlbWVudFZpZXcuc3luYygpO1xuIGNvbnN0IGxlc3Nvbj1yb290LnF1ZXJ5U2VsZWN0b3IoJy5taXgtdHV0b3JpYWwnKTtyb290LnF1ZXJ5U2VsZWN0b3IoJy5taXgtc2NyZWVuJyk/LnRvZ2dsZUF0dHJpYnV0ZSgnaW5lcnQnLCEhbGVzc29uKTtcbiBpZihsZXNzb24mJiFsZXNzb24uY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpbGVzc29uLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7XG4gaWYoZy5vdmVybGF5PT09J2pvaG5ueVVubG9jaycpe2NvbnN0IGRpYWxvZz1yb290LnF1ZXJ5U2VsZWN0b3IoJy5qb2hubnktdW5sb2NrJyk7aWYoZGlhbG9nJiYhZGlhbG9nLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKWRpYWxvZy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJjb25maXJtSm9obm55VW5sb2NrXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG4gaWYoZy5vdmVybGF5PT09J2RhaWx5VW5sb2Nrcycpe2NvbnN0IGRpYWxvZz1yb290LnF1ZXJ5U2VsZWN0b3IoJy5kYWlseS11bmxvY2tzJyk7aWYoZGlhbG9nJiYhZGlhbG9nLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKWRpYWxvZy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJjb25maXJtRGFpbHlVbmxvY2tzXCJdJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG4gaWYoWydpbmdyZWRpZW50V2FybmluZycsJ29wZW5lcldhcm5pbmcnXS5pbmNsdWRlcyhnLm92ZXJsYXkpKXtjb25zdCB3YXJuaW5nPXJvb3QucXVlcnlTZWxlY3RvcignLmluZ3JlZGllbnQtd2FybmluZycpO2lmKHdhcm5pbmcmJiF3YXJuaW5nLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKXdhcm5pbmcucXVlcnlTZWxlY3RvcignYnV0dG9uJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9XG4gLy8gRm9jdXMgYSBuZXcgY2hvaWNlIG9ubHkgb25jZSwgYWZ0ZXIgc3RhZ2luZy4gTmV2ZXIgc3RlYWwgZm9jdXMgZnJvbSBhIG1lbnUuXG4gaWYoIWcuY2hvaWNlKWxhc3RGb2N1c2VkQ2hvaWNlPW51bGw7XG4gZWxzZSBpZihsYXN0Rm9jdXNlZENob2ljZSE9PWcuY2hvaWNlJiZsaXZlQmFyJiYhZy5pc1BhdXNlZCgpJiYhdWkuaW5zcGVjdG9yJiYhZy5jYW1lcmFNb3ZpbmcmJmcuY2FtZXJhTGVmdD09PTAmJmcudHJhbnNpdGlvbj09PTApe1xuICBjb25zdCBmaXJzdD1yb290LnF1ZXJ5U2VsZWN0b3IoJy5jaG9pY2VzIGJ1dHRvbjpub3QoOmRpc2FibGVkKScpO1xuICBpZihmaXJzdCl7Zmlyc3QuZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO2xhc3RGb2N1c2VkQ2hvaWNlPWcuY2hvaWNlO31cbiB9XG59XG5mdW5jdGlvbiB0b2FzdChtc2cpe2NvbnN0IGVsPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0b2FzdCcpO2VsLnRleHRDb250ZW50PW1zZztlbC5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7Y2xlYXJUaW1lb3V0KHRvYXN0LnRpbWVyKTt0b2FzdC50aW1lcj1zZXRUaW1lb3V0KCgpPT5lbC5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyksMjIwMCk7fVxuZnVuY3Rpb24gZXhwb3J0TG9nKCl7Y29uc3QgcGF5bG9hZD17a2luZDonTFVOQV9XRUJfUExBWVRFU1QnLGNyZWF0ZWRBdDpuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksc291cmNlOkQuc291cmNlLGRheTpnLmRheSxtb2RlOmcubW9kZSx2YXJpYW50OmcudmFyaWFudCxzZXJ2aWNlVmVyc2lvbjpnLnNlcnZpY2VWZXJzaW9uLGRpZmZpY3VsdHk6Zy5yZW1peD8uZGlmZmljdWx0eSxzZWVkOmcuc2VlZCxwcm9ncmVzczpnLnByb2dyZXNzLHRyYW5zYWN0aW9uczpnLnRyYW5zYWN0aW9ucyxkYWlseVNldHRsZW1lbnQ6Zy5kYWlseVNldHRsZW1lbnQsdXBrZWVwT3ZlcnJpZGU6Zy51cGtlZXBPdmVycmlkZSxsb2dzOmcubG9ncyxoaXN0b3J5OmcuaGlzdG9yeSxlcnJvcjpnLmVycm9yfTtjb25zdCB1cmw9VVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkocGF5bG9hZCxudWxsLDIpXSx7dHlwZTonYXBwbGljYXRpb24vanNvbid9KSk7Y29uc3QgZWw9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO2VsLmhyZWY9dXJsO2VsLmRvd25sb2FkPWBsdW5hLWRheSR7Zy5kYXl9LSR7RGF0ZS5ub3coKX0uanNvbmA7ZWwuY2xpY2soKTtzZXRUaW1lb3V0KCgpPT5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCksMzAwMCk7dG9hc3QoTCgn7YWM7Iqk7Yq4IOuhnOq3uOulvCDrgrTrs7Trg4jsirXri4jri6QuJywnVGVzdCBsb2cgZXhwb3J0ZWQuJykpO31cbmZ1bmN0aW9uIHNob3cobmFtZSl7aWYobmFtZT09PSdkb3NzaWVyJyl7dWkuZG9zc2llckRldGFpbD1udWxsO3VpLmRvc3NpZXJQcmV2aWV3PW51bGw7dWkuaW5zcGVjdG9yPWZhbHNlO31nLm92ZXJsYXk9bmFtZTtnLmdpbW1pY2smJihnLmdpbW1pY2suaGVsZD1mYWxzZSk7cmVuZGVyKCk7fVxuZnVuY3Rpb24gYWN0KG5hbWUsaWQsc291cmNlKXtcbiBpZihtaXhUdXRvcmlhbC5hY3Rpb24obmFtZSxpZCkpe3JlbmRlcih0cnVlKTtyZXR1cm47fVxuIGlmKGcub3ZlcmxheT09PSdqb2hubnlVbmxvY2snKXtpZihuYW1lPT09J2NvbmZpcm1Kb2hubnlVbmxvY2snKXtjbGVhckNvbnRyb2xTa2lwKCk7Zy5zYWZlKCgpPT5nLmNvbmZpcm1Kb2hubnlVbmxvY2soKSk7cmVuZGVyKHRydWUpO31yZXR1cm47fVxuIGlmKG5hbWU9PT0nc2tpcFN0b3J5Q3JhZnQnKXtpZihjYW5Ta2lwU3RvcnlDcmFmdCgpKWcuc2FmZShza2lwU3RvcnlDcmFmdCk7cmVuZGVyKHRydWUpO3JldHVybjt9XG4gaWYoIXR1dG9yaWFsVmlldy5hbGxvd3MobmFtZSxpZCxzb3VyY2UpKXJldHVybjtcbiBpZihnLm92ZXJsYXk9PT0nZGFpbHlVbmxvY2tzJyl7aWYobmFtZT09PSdjb25maXJtRGFpbHlVbmxvY2tzJyl7Y2xlYXJDb250cm9sU2tpcCgpO2cuc2FmZSgoKT0+Zy5jb25maXJtRGFpbHlVbmxvY2tzKCkpO3JlbmRlcih0cnVlKTt9cmV0dXJuO31cbiBwb3VyVmlldy51bmxvY2tBdWRpbygpO1xuIGlmKHBvdXJWaWV3LmFjdChuYW1lLGlkKSl7cmVuZGVyKHRydWUpO3JldHVybjt9XG4gaWYobmFtZT09PSdwb3VyUHJlc2VudGF0aW9uJyl7aWYoIVsnY2xhc3NpYycsJ2NsZWFuJywnYm90dGxlJ10uaW5jbHVkZXMoaWQpKXJldHVybjt1aS5wb3VyUHJlc2VudGF0aW9uPWlkO3RyeXtsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbHVuYS5wb3VyLnByZXNlbnRhdGlvbi52MScsaWQpO31jYXRjaHt9cmVuZGVyKHRydWUpO3JldHVybjt9XG4gaWYoY2FtcGFpZ24/LmludGVyY2VwdChuYW1lKSlyZXR1cm47XG4gcmVtaXhVSS51bmxvY2tBdWRpbygpO29wZW5WaWV3LnVubG9ja0F1ZGlvKCk7c2hha2VQb2xpc2gudW5sb2NrQXVkaW8oKTtzdGlyUG9saXNoLnVubG9ja0F1ZGlvKCk7XG4gaWYobmFtZT09PSdzdGlyU291bmQnKXtpZih3aW5kb3cuTHVuYVNoYWtlUmh5dGhtLm1haW5TdG9yeUxvY2tlZChnKSlyZXR1cm47dWkuc3RpclNvdW5kPWlkPT09JzInPzI6MTt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2x1bmEuc3Rpci5zb3VuZC52MScsU3RyaW5nKHVpLnN0aXJTb3VuZCkpO31jYXRjaHt9cmVuZGVyKHRydWUpO3JldHVybjt9XG4gaWYobmFtZT09PSdzaGFrZU1vZGUnKXtpZihzaGFrZVJoeXRobS5zZWxlY3QoaWQpKXt1aS5zaGFrZU1vZGU9aWQ7dHJ5e2xvY2FsU3RvcmFnZS5zZXRJdGVtKCdsdW5hLnNoYWtlLm1vZGUudjInLGlkKTt9Y2F0Y2h7fX1yZW5kZXIodHJ1ZSk7cmV0dXJuO31cbiBpZihuYW1lPT09J3JoeXRobUhpdCcpe2cuZ2ltbWlja0lucHV0KGlkKTtyZW5kZXIoKTtyZXR1cm47fVxuIGlmKG5hbWU9PT0nc2hha2VTb3VuZCcpe2lmKHdpbmRvdy5MdW5hU2hha2VSaHl0aG0ubWFpblN0b3J5TG9ja2VkKGcpKXJldHVybjt1aS5zaGFrZVNvdW5kPWlkPT09JzInPzI6MTt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2x1bmEuc2hha2Uuc291bmQudjInLFN0cmluZyh1aS5zaGFrZVNvdW5kKSk7fWNhdGNoe31yZW5kZXIodHJ1ZSk7cmV0dXJuO31cbiBpZihuYW1lPT09J21pbmlTdGFydCcpe2lmKFsncG91cicsJ2ZpbGxfdXAnXS5pbmNsdWRlcyhpZCkpe3VpLm1pbmlJbmdyZWRpZW50S2luZD1pZDtzaG93KCdtaW5pSW5ncmVkaWVudCcpO3Jvb3QucXVlcnlTZWxlY3RvcignLm1pbmktaW5ncmVkaWVudC1jYXJkJyk/LmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTt9ZWxzZXttaW5pU3RhcnQoaWQpO3JlbmRlcih0cnVlKTt9cmV0dXJuO31pZihuYW1lPT09J21pbmlJbmdyZWRpZW50Jyl7aWYoZy5vdmVybGF5IT09J21pbmlJbmdyZWRpZW50J3x8IXdpbmRvdy5MdW5hTWluaWdhbWVzLmluZ3JlZGllbnRzKGcsdWkubWluaUluZ3JlZGllbnRLaW5kKS5zb21lKGl0ZW09Pml0ZW0uaWQ9PT1pZCkpcmV0dXJuO21pbmlTdGFydCh1aS5taW5pSW5ncmVkaWVudEtpbmQsaWQpO3JlbmRlcih0cnVlKTtyZXR1cm47fWlmKG5hbWU9PT0nbWluaUluZ3JlZGllbnRDYW5jZWwnfHxuYW1lPT09J2Nsb3NlT3ZlcmxheScmJmcub3ZlcmxheT09PSdtaW5pSW5ncmVkaWVudCcpe2cub3ZlcmxheT1udWxsO3JlbmRlcih0cnVlKTtyb290LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFjdD1cIm1pbmlTdGFydFwiXVtkYXRhLWlkPVwiJyt1aS5taW5pSW5ncmVkaWVudEtpbmQrJ1wiXScpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7cmV0dXJuO31pZihuYW1lPT09J21pbmlSZXRyeScpe2cucmV0cnlNaW5pZ2FtZSgpO3JlbmRlcih0cnVlKTtyZXR1cm47fWlmKG5hbWU9PT0nbWluaUxvYmJ5Jyl7bWluaUxvYmJ5KCk7cmVuZGVyKHRydWUpO3JldHVybjt9aWYobmFtZT09PSdtaW5pQmFyJyl7bWluaUxvYmJ5KCk7YWN0KCd2ZXJzaW9uJyx1aS52YXJpYW50KTtyZXR1cm47fWlmKG5hbWU9PT0nbWluaUV4aXQnKXtpZighZy5taW5pZ2FtZXx8IWcuZ2ltbWljaz8uc3RhcnRlZCl7bWluaUxvYmJ5KCk7cmVuZGVyKHRydWUpO31lbHNlIHNob3coJ21pbmlFeGl0Jyk7cmV0dXJuO31pZih1aS5taW5pZ2FtZXMmJm5hbWU9PT0naW5zcGVjdG9yJylyZXR1cm47XG4gaWYobmFtZT09PSdjdXRzY2VuZVBsYXknKXt3aW5kb3cuTHVuYUN1dHNjZW5lTGlicmFyeS5wbGF5KGNhbXBhaWduLGlkKTtyZXR1cm47fWlmKG5hbWU9PT0nY3V0c2NlbmVGaWx0ZXInKXt3aW5kb3cuTHVuYUN1dHNjZW5lTGlicmFyeS5zZXRGaWx0ZXIoaWQpO3JlbmRlcih0cnVlKTtyZXR1cm47fWlmKG5hbWU9PT0ndmVyc2lvbicpe2lmKGcucGhhc2UhPT0ncmVhZHknKXJldHVybjt1aS5jdXRzY2VuZXM9aWQ9PT0nY3V0c2NlbmVzJztpZih1aS5jdXRzY2VuZXMpe3VpLm91dHNpZGU9ZmFsc2U7dWkubWluaWdhbWVzPWZhbHNlO3JlbmRlcih0cnVlKTtyZXR1cm47fWlmKGlkPT09J291dHNpZGUnKXt1aS5vdXRzaWRlPXRydWU7dWkubWluaWdhbWVzPWZhbHNlO3JlbmRlcih0cnVlKTtyZXR1cm47fXVpLm91dHNpZGU9ZmFsc2U7aWYoaWQ9PT0nbWluaWdhbWVzJyl7bWluaUxvYmJ5KCk7cmVuZGVyKHRydWUpO3JldHVybjt9dWkubWluaWdhbWVzPWZhbHNlO3RyeXtsb2NhbFN0b3JhZ2Uuc2V0SXRlbShnLnZhcmlhbnQ9PT0nZ3B0Jz8nbHVuYS5iYXIuZ3B0LnJlYWQudjEnOidsdW5hLmJhci5wbGF5dGVzdC5yZWFkLnYxJyxKU09OLnN0cmluZ2lmeShbLi4uZy5yZWFkXSkpO31jYXRjaHt9dWkudmFyaWFudD1pZD09PSdncHQnPydncHQnOidvcmlnaW5hbCc7dWkuZGF5PTA7dWkubW9kZT11aS52YXJpYW50PT09J2dwdCc/J2VwaXNvZGUnOidmdWxsJzt1aS51cGtlZXA9Jyc7dWkucGVlaz1udWxsO3VpLmluc3BlY3Rvcj1mYWxzZTt1aS5hdXRvPWZhbHNlO2NsZWFyQ29udHJvbFNraXAoKTtnLnNwZWVkPTE7Zy5yZXNldCh1aS5kYXksdWkubW9kZSx1aS5zZWVkLGZhbHNlLHt2YXJpYW50OnVpLnZhcmlhbnQsc2VydmljZVZlcnNpb246dWkuc2VydmljZVZlcnNpb24sZGlmZmljdWx0eTp1aS5kaWZmaWN1bHR5LGFzc2lzdDp1aS5hc3Npc3R9KTt0cnl7Zy5yZWFkPW5ldyBTZXQoSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh1aS52YXJpYW50PT09J2dwdCc/J2x1bmEuYmFyLmdwdC5yZWFkLnYxJzonbHVuYS5iYXIucGxheXRlc3QucmVhZC52MScpfHwnW10nKSk7fWNhdGNoe2cucmVhZD1uZXcgU2V0KCk7fXJlbmRlcih0cnVlKTtyZXR1cm47fVxuIGlmKHJlbWl4VUkuYWN0KG5hbWUsaWQpKXtyZW5kZXIodHJ1ZSk7cmV0dXJuO31cbiBpZihuYW1lPT09J2RheScpe3VpLmRheT1OdW1iZXIoaWQpO31lbHNlIGlmKG5hbWU9PT0nc3RhcnQnKXt1aS5wZWVrPW51bGw7dHJ5e2NvbnN0IGFtb3VudD11aS52YXJpYW50PT09J2dwdCc/bnVsbDpnLnBhcnNlVXBrZWVwT3ZlcnJpZGUodWkudXBrZWVwKTtnLnNhZmUoKCk9PmcucmVzZXQodWkuZGF5LHVpLm1vZGUsdWkuc2VlZCx0cnVlLHtzdG9yeVByZXJlcXVpc2l0ZXM6ISFjYW1wYWlnbj8uc2Vzc2lvbi5kZXZlbG9wZXIsdXBrZWVwT3ZlcnJpZGU6YW1vdW50LHZhcmlhbnQ6dWkudmFyaWFudCxzZXJ2aWNlVmVyc2lvbjp1aS5zZXJ2aWNlVmVyc2lvbixkaWZmaWN1bHR5OnVpLmRpZmZpY3VsdHksYXNzaXN0OnVpLmFzc2lzdH0pKTt9Y2F0Y2goZSl7dG9hc3QoZS5tZXNzYWdlKTt9fWVsc2UgaWYobmFtZT09PSdzZXR1cCcpe2cucmVzZXQodWkuZGF5LHVpLm1vZGUsdWkuc2VlZCxmYWxzZSx7dmFyaWFudDp1aS52YXJpYW50LHNlcnZpY2VWZXJzaW9uOnVpLnNlcnZpY2VWZXJzaW9ufSk7dWkuaW5zcGVjdG9yPWZhbHNlO31cbiBlbHNlIGlmKG5hbWU9PT0nY29uZmlybVNldHRsZW1lbnQnKXtnLmNvbmZpcm1EYWlseVNldHRsZW1lbnQoKTtyZW1peFVJLnJlY29yZFJ1bigpO31lbHNlIGlmKG5hbWU9PT0ncmV0cnlEYXknKXtnLnNhZmUoKCk9PmcucmVzZXQoZy5kYXksZy5tb2RlLGcuc2VlZCx0cnVlLHtzdG9yeVByZXJlcXVpc2l0ZXM6ISFjYW1wYWlnbj8uc2Vzc2lvbi5kZXZlbG9wZXIsdXBrZWVwT3ZlcnJpZGU6Zy51cGtlZXBPdmVycmlkZSx2YXJpYW50OmcudmFyaWFudCxzZXJ2aWNlVmVyc2lvbjpnLnNlcnZpY2VWZXJzaW9ufSkpO3VpLmluc3BlY3Rvcj1mYWxzZTt9ZWxzZSBpZihuYW1lPT09J2FwcGx5VXBrZWVwJyl7dHJ5e2cuc2V0VXBrZWVwT3ZlcnJpZGUodWkudXBrZWVwKTtpZihyZW1peC5hY3RpdmUoKSlnLnJlbWl4LmRlYnVnPXRydWU7dG9hc3QoTCgn7J2067KIIOyYgeyXheydmCDsnKDsp4DruYQg7YWM7Iqk7Yq46rCS7J2EIOyggeyaqe2WiOyKteuLiOuLpC4nLCdVcGtlZXAgb3ZlcnJpZGUgYXBwbGllZCB0byB0aGlzIHNlc3Npb24uJykpO31jYXRjaChlKXt0b2FzdChlLm1lc3NhZ2UpO319ZWxzZSBpZihuYW1lPT09J2RlYnVnRW5kRGF5Jyl7aWYoIWcuZmluaXNoZWQmJmcucGhhc2UhPT0ncmVhZHknKWcuc2FmZSgoKT0+e2lmKHJlbWl4LmFjdGl2ZSgpKWcucmVtaXguZGVidWc9dHJ1ZTtnLmxvZygnZGVidWdfZW5kX2RheScse3Vuc2VydmVkT3JkZXI6Zy5jdXJyZW50T3JkZXI/LmlkfHxudWxsfSk7Zy5maW5pc2hEYXkoKTt9KTt1aS5pbnNwZWN0b3I9ZmFsc2U7fWVsc2UgaWYobmFtZT09PSdhZHZhbmNlJylnLmFkdmFuY2UoKTtlbHNlIGlmKG5hbWU9PT0nY2hvaWNlJylnLmNob29zZShpZCk7ZWxzZSBpZihuYW1lPT09J3NlYXQnKXtpZihnLm92ZXJ2aWV3JiZnLmZvY3VzPT09aWQpZy50b2dnbGVPdmVydmlldygpO2Vsc2UgZy5mb2N1c1NlYXQoaWQpO31lbHNlIGlmKG5hbWU9PT0nb3ZlcnZpZXcnKWcudG9nZ2xlT3ZlcnZpZXcoKTtlbHNlIGlmKG5hbWU9PT0ncmVhc2snKXtpZighZy5yZWFzaygpKXRvYXN0KEwoJ+yEnOu5mSDrjIDquLAg7KSR7J24IOyVnuyekOumrCDshpDri5jsl5Dqsozrp4wg6rCA64ql7ZWp64uI64ukLicsJ09ubHkgYXZhaWxhYmxlIGZvciB0aGUgZm9jdXNlZCBndWVzdCBhd2FpdGluZyBzZXJ2aWNlLicpKTt9XG4gZWxzZSBpZihuYW1lPT09J3NlcnZpY2UnKXRvZ2dsZVNlcnZpY2UoKTtcbiBlbHNlIGlmKG5hbWU9PT0ncmVjaXBlcycpe2NvbnN0IGZyb21TZXJ2aWNlPWcub3ZlcmxheT09PSdzZXJ2aWNlJztpZihmcm9tU2VydmljZSlnLm92ZXJsYXk9bnVsbDtpZighZy5vcGVuUmVjaXBlcygpKXtpZihmcm9tU2VydmljZSlnLm92ZXJsYXk9J3NlcnZpY2UnO3RvYXN0KEwoJ+yngOq4iOydgCDsoJzsobDrpbwg7Iuc7J6R7ZWgIOyImCDsl4bsirXri4jri6QuIOuMgOyCrMK37ISc67mZ7J2EIOuovOyggCDrp4jss5Ag7KO87IS47JqULicsJ0ZpbmlzaCB0aGUgY3VycmVudCBkaWFsb2d1ZSBvciBzZXJ2aW5nIGZpcnN0LicpKTt9fVxuIGVsc2UgaWYobmFtZT09PSdjbG9zZVJlY2lwZScpZy5jbG9zZVJlY2lwZXMoKTtlbHNlIGlmKG5hbWU9PT0nc2VsZWN0UmVjaXBlJyl7Zy5zZWxlY3RDb2NrdGFpbChpZCk7dWkudGFiPSdnbGFzcyc7dWkucmVjaXBlT3Blbj1mYWxzZTt1aS5ob3Zlckl0ZW09bnVsbDt1aS5zaGVsZlBhZ2U9MDt9ZWxzZSBpZihuYW1lPT09J3R1dG9yaWFsQmFyQ29udGludWUnKXtnLmNvbnRpbnVlQmFyVHV0b3JpYWwoKTt9ZWxzZSBpZihuYW1lPT09J3R1dG9yaWFsQ29udGludWUnKXtnLnR1dG9yaWFsRXZlbnQoJ3JlYWQnKTt9ZWxzZSBpZihuYW1lPT09J3RvZ2dsZVByZXBSZWNpcGUnKXt1aS5yZWNpcGVPcGVuPSF1aS5yZWNpcGVPcGVuO3VpLmhvdmVySXRlbT1udWxsO2cudHV0b3JpYWxFdmVudCh1aS5yZWNpcGVPcGVuPydyZWNpcGVPcGVuJzoncmVjaXBlQ2xvc2UnKTt9ZWxzZSBpZihuYW1lPT09J3NoZWxmQ2F0ZWdvcnknKXt1aS50YWI9dmlld3MuY2F0ZWdvcmllc1tNYXRoLm1heCgwLE1hdGgubWluKDMsdmlld3MuY2F0ZWdvcmllcy5pbmRleE9mKHVpLnRhYikrTnVtYmVyKGlkKSkpXTt1aS5zaGVsZlBhZ2U9MDt1aS5ob3Zlckl0ZW09bnVsbDt0dXRvcmlhbFZpZXcubmF2aWdhdGVTaGVsZih1aS50YWIpO31lbHNlIGlmKG5hbWU9PT0nc2hlbGZQYWdlJyl7dWkuc2hlbGZQYWdlPU1hdGgubWF4KDAsKHVpLnNoZWxmUGFnZXx8MCkrTnVtYmVyKGlkKSk7dWkuaG92ZXJJdGVtPW51bGw7fWVsc2UgaWYobmFtZT09PSd0YWInKXt1aS50YWI9aWQ7dWkuc2hlbGZQYWdlPTA7dWkuaG92ZXJJdGVtPW51bGw7aWYoaWQ9PT0nbGlxdW9yJylnLnR1dG9yaWFsRXZlbnQoJ3NoZWxmJyk7fWVsc2UgaWYobmFtZT09PSdwaWNrT3BlbmVyJyl7Zy5waWNrT3BlbmVyKCk7fWVsc2UgaWYobmFtZT09PSdwaWNrJylnLnBpY2tJdGVtKGlkKTtlbHNlIGlmKG5hbWU9PT0ncHJlcEJhY2snKXt1aS5ob3Zlckl0ZW09bnVsbDtnLnByZXBCYWNrKCk7fWVsc2UgaWYobmFtZT09PSdjcmFmdCcpZy5zdGFydENyYWZ0KCk7ZWxzZSBpZihuYW1lPT09J2dpbW1pY2tJbnB1dCcpZy5naW1taWNrSW5wdXQoJ1NwYWNlJyk7ZWxzZSBpZihuYW1lPT09J3N0aXInKWcuZ2ltbWlja0lucHV0KGlkKTtlbHNlIGlmKG5hbWU9PT0nZW5kR2ltbWljaycpZy5lbmRHaW1taWNrKCk7ZWxzZSBpZihuYW1lPT09J3NlcnZlRGV0YWlscycpe2lmKHNlcnZlVmlldy5yZWFkeSgpKXNob3coJ3NlcnZlRGV0YWlscycpO31lbHNlIGlmKG5hbWU9PT0nb2ZmZXInKXtpZihzZXJ2ZVZpZXcucmVhZHkoKSlnLm9mZmVyKCk7fWVsc2UgaWYobmFtZT09PSdkaXNjYXJkJyl7aWYoc2VydmVWaWV3LnJlYWR5KCkmJmcuZGlzY2FyZCgpKXt1aS50YWI9J2dsYXNzJzt1aS5yZWNpcGVPcGVuPWZhbHNlO3VpLmhvdmVySXRlbT1udWxsO3VpLnNoZWxmUGFnZT0wO319ZWxzZSBpZihuYW1lPT09J3NlcnZlJyl7aWYoIWcuc2VydmUoZy5jdXJyZW50T3JkZXI/LnNlYXR8fGcuZm9jdXMpKXRvYXN0KEwoJ+ygnOqztSDqsIDriqXtlZwg7L2U7Iqk7YSw6rCAIOyXhuyKteuLiOuLpC4nLCdObyB2YWxpZCBjb2FzdGVyIHRvIHNlcnZlLicpKTt9XG4gZWxzZSBpZihuYW1lPT09J2RlYnVnRmlsbCcpZy5kZWJ1Z0ZpbGwoKTtlbHNlIGlmKG5hbWU9PT0nZGVidWdDcmFmdCcpZy5kZWJ1Z0NyYWZ0KGlkKTtlbHNlIGlmKG5hbWU9PT0ncmV0cnknKXtpZihnLm1pbmlnYW1lKWcucmV0cnlNaW5pZ2FtZSgpO2Vsc2UgZy5yZXRyeURhdGFFcnJvcigpO31lbHNlIGlmKG5hbWU9PT0nY2FuY2VsQ3JhZnQnKXtpZihnLm1pbmlnYW1lKW1pbmlMb2JieSgpO2Vsc2UgZy5jYW5jZWxDcmFmdCgpO31lbHNlIGlmKG5hbWU9PT0nZG9zc2llcicpe2lmKGRvc3NpZXJTdGF0ZShpZCkubWV0KXt1aS5kb3NzaWVyPWlkO3VpLmRvc3NpZXJEZXRhaWw9aWQ7fXJlbmRlcih0cnVlKTtyb290LnF1ZXJ5U2VsZWN0b3IoJy5wcm9maWxlLWJvZHknKT8uZm9jdXMoe3ByZXZlbnRTY3JvbGw6dHJ1ZX0pO31lbHNlIGlmKG5hbWU9PT0nZG9zc2llck9wZW4nKXtzaG93KCdkb3NzaWVyJyk7cm9vdC5xdWVyeVNlbGVjdG9yKCcuZG9zc2llci1saXN0LXNjcm9sbCcpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fWVsc2UgaWYobmFtZT09PSdkb3NzaWVyQmFjaycpe2Rvc3NpZXJCYWNrKCk7fWVsc2UgaWYobmFtZT09PSdkb3NzaWVyUHJldmlldycpe3VpLmRvc3NpZXJQcmV2aWV3PXtpZDp1aS5kb3NzaWVyVGVzdEFjdG9yLHN0YWdlOk51bWJlcihpZCl9O3VpLmRvc3NpZXJEZXRhaWw9bnVsbDtnLm92ZXJsYXk9J2Rvc3NpZXInO3VpLmluc3BlY3Rvcj1mYWxzZTt9ZWxzZSBpZihuYW1lPT09J2Rvc3NpZXJMaXZlJyl7dWkuZG9zc2llclByZXZpZXc9bnVsbDtzaG93KCdkb3NzaWVyJyk7fWVsc2UgaWYobmFtZT09PSdjcmFmdFJlY2lwZScpc2hvdygncmVjaXBlJyk7ZWxzZSBpZihuYW1lPT09J2Nsb3NlT3ZlcmxheScpe2lmKGcub3ZlcmxheT09PSdzZXJ2aWNlJyl0b2dnbGVTZXJ2aWNlKCk7ZWxzZSB7Zy5vdmVybGF5PW51bGw7cmVuZGVyKHRydWUpO3Jvb3QucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwic2VydmljZVwiXScpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fX1lbHNlIGlmKG5hbWU9PT0naW5zcGVjdG9yJyl1aS5pbnNwZWN0b3I9IXVpLmluc3BlY3RvcjtlbHNlIGlmKG5hbWU9PT0ncGF1c2UnKXtpZihnLmZpbmlzaGVkfHxnLnBoYXNlPT09J3JlYWR5JylyZXR1cm47Zy5wYXVzZWQ9IWcucGF1c2VkO2cuZ2ltbWljayYmKGcuZ2ltbWljay5oZWxkPWZhbHNlKTt9ZWxzZSBpZihuYW1lPT09J2JnbScpYmdtLnNldEVuYWJsZWQoIWJnbS5lbmFibGVkKTtlbHNlIGlmKG5hbWU9PT0nc291bmQnKXVpLnNvdW5kPSF1aS5zb3VuZDtlbHNlIGlmKG5hbWU9PT0nYXV0bycpdWkuYXV0bz0hdWkuYXV0bztlbHNlIGlmKG5hbWU9PT0nZXhwb3J0JylleHBvcnRMb2coKTtlbHNlIGlmKFsnaGVscCcsJ3NhbGVzJywnaGlzdG9yeScsJ3NldHRpbmdzJywncmVzdGFydCddLmluY2x1ZGVzKG5hbWUpKXNob3cobmFtZSk7cmVuZGVyKHRydWUpO1xufVxucm9vdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsZT0+e2NvbnN0IGI9ZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0XScpO2lmKGI/LmRhdGFzZXQuYWN0PT09J3JoeXRobUhpdCcmJmUuZGV0YWlsPjApcmV0dXJuO2lmKGImJiFiLmRpc2FibGVkKXt0cnl7YWN0KGIuZGF0YXNldC5hY3QsYi5kYXRhc2V0LmlkLGIpO31jYXRjaChlcnIpe2cuZXJyb3I9ZXJyLm1lc3NhZ2U7cmVuZGVyKCk7fX19KTtcbnJvb3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJyxlPT57Y29uc3Qga2V5PWUudGFyZ2V0LmRhdGFzZXQuY2hhbmdlLHY9ZS50YXJnZXQudmFsdWU7aWYoa2V5PT09J3JlbWl4QXNzaXN0Jyl1aS5hc3Npc3Q9ZS50YXJnZXQuY2hlY2tlZDtpZihrZXk9PT0ncmVtaXhMaXZlQXNzaXN0Jyl7Zy5yZW1peC5hc3Npc3Q9ZS50YXJnZXQuY2hlY2tlZDt1aS5hc3Npc3Q9ZS50YXJnZXQuY2hlY2tlZDt9aWYoa2V5PT09J3JlbWl4QXVkaW8nKXVpLnJlbWl4QXVkaW89ZS50YXJnZXQuY2hlY2tlZDtpZihrZXk9PT0nZ2ltbWlja0F1ZGlvJyl1aS5naW1taWNrQXVkaW89ZS50YXJnZXQuY2hlY2tlZDtpZihrZXk9PT0nbW9kZScpdWkubW9kZT12O2lmKGtleT09PSdkb3NzaWVyVGVzdEFjdG9yJyl1aS5kb3NzaWVyVGVzdEFjdG9yPXY7aWYoa2V5PT09J2xhbmd1YWdlJylnLmxhbmc9djtpZihrZXk9PT0nc3BlZWQnKXtnLnNwZWVkPU51bWJlcih2KTtpZihyZW1peC5hY3RpdmUoKSlnLnJlbWl4LmRlYnVnPXRydWU7fWlmKGtleT09PSdkaWFsb2dTcGVlZCcpZy5kaWFsb2dTcGVlZD1OdW1iZXIodik7cmVuZGVyKHRydWUpO30pO1xucm9vdC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsZT0+e2lmKGUudGFyZ2V0LmRhdGFzZXQuaW5wdXQ9PT0nc2Z4Vm9sdW1lJyl7d2luZG93Lkx1bmFTZnguc2V0Vm9sdW1lKE51bWJlcihlLnRhcmdldC52YWx1ZSkvMTAwKTtyZW5kZXIoKTt9ZWxzZSBpZihlLnRhcmdldC5kYXRhc2V0LmlucHV0PT09J2JnbVZvbHVtZScpe2JnbS5zZXRWb2x1bWUoTnVtYmVyKGUudGFyZ2V0LnZhbHVlKS8xMDApO3JlbmRlcigpO31lbHNlIGlmKGUudGFyZ2V0LmRhdGFzZXQuaW5wdXQ9PT0ndXBrZWVwJyl7dWkudXBrZWVwPWUudGFyZ2V0LnZhbHVlO319KTtcbnJvb3QuYWRkRXZlbnRMaXN0ZW5lcigndG9nZ2xlJyxlPT57aWYoZS50YXJnZXQuZGF0YXNldD8uZGV0YWlscz09PSdyZWNpcGUnKXVpLnJlY2lwZU9wZW49ZS50YXJnZXQub3Blbjt9LHRydWUpO1xucm9vdC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyb3ZlcicsZT0+e2NvbnN0IGVsPWUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWhvdmVyLXJlY2lwZV0nKTtpZihlbCYmdWkucGVlayE9PWVsLmRhdGFzZXQuaG92ZXJSZWNpcGUpe3VpLnBlZWs9ZWwuZGF0YXNldC5ob3ZlclJlY2lwZTtyZW5kZXIoKTt9fSk7XG5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzaW4nLGU9Pntjb25zdCBlbD1lLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1ob3Zlci1yZWNpcGVdJyk7aWYoZWwmJnVpLnBlZWshPT1lbC5kYXRhc2V0LmhvdmVyUmVjaXBlKXt1aS5wZWVrPWVsLmRhdGFzZXQuaG92ZXJSZWNpcGU7cmVuZGVyKCk7fX0pO1xuZnVuY3Rpb24gaG92ZXJJbmdyZWRpZW50KGUpe2NvbnN0IGVsPWUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWhvdmVyLWl0ZW1dJyk7aWYoIWVsfHxnLmlzUGF1c2VkKCl8fGVsLmNsb3Nlc3QoJ1tpbmVydF0nKSlyZXR1cm47aWYoZy50dXRvcmlhbCYmIXR1dG9yaWFsVmlldy5jYW5Ib3ZlcihlbC5kYXRhc2V0LmhvdmVySXRlbSkpcmV0dXJuO1xuIGluZ3JlZGllbnRQb2ludGVyPWUudHlwZS5zdGFydHNXaXRoKCdwb2ludGVyJyk/e2lkOmVsLmRhdGFzZXQuaG92ZXJJdGVtLHg6ZS5jbGllbnRYLHk6ZS5jbGllbnRZfTpudWxsO1xuIGlmKHVpLmhvdmVySXRlbSE9PWVsLmRhdGFzZXQuaG92ZXJJdGVtKXt1aS5ob3Zlckl0ZW09ZWwuZGF0YXNldC5ob3Zlckl0ZW07cmVuZGVyKCk7fVxuIHN5bmNJbmdyZWRpZW50UG9pbnRlclRpcCgpO2lmKFsnZ2luJywnc29kYV93YXRlciddLmluY2x1ZGVzKGVsLmRhdGFzZXQuaG92ZXJJdGVtKSlnLnR1dG9yaWFsRXZlbnQoJ2hvdmVyJyk7fVxuZnVuY3Rpb24gdHJhY2tSZWNpcGVQb2ludGVyKGUpe2NvbnN0IHNsb3Q9ZS50YXJnZXQuY2xvc2VzdCgnLnJlY2lwZS1pY29uLXNsb3QnKTtyZWNpcGVQb2ludGVyPXNsb3Q/e3Nsb3QseDplLmNsaWVudFgseTplLmNsaWVudFl9Om51bGw7c3luY1JlY2lwZVBvaW50ZXJUaXAoKTt9XG5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJyx0cmFja1JlY2lwZVBvaW50ZXIpO3Jvb3QuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm92ZXInLHRyYWNrUmVjaXBlUG9pbnRlcik7XG5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJsZWF2ZScsKCk9PntyZWNpcGVQb2ludGVyPW51bGw7fSk7XG5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJvdmVyJyxob3ZlckluZ3JlZGllbnQpO3Jvb3QuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNpbicsaG92ZXJJbmdyZWRpZW50KTtcbnJvb3QuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLGU9Pntjb25zdCBlbD1lLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1ob3Zlci1pdGVtXScpO2lmKCFlbHx8ZWwuZGF0YXNldC5ob3Zlckl0ZW0hPT11aS5ob3Zlckl0ZW0pcmV0dXJuO2luZ3JlZGllbnRQb2ludGVyPXtpZDp1aS5ob3Zlckl0ZW0seDplLmNsaWVudFgseTplLmNsaWVudFl9O3N5bmNJbmdyZWRpZW50UG9pbnRlclRpcCgpO30pO1xud2luZG93Lkx1bmFIb3ZlckF1ZGlvLmJpbmQocm9vdCx7Y2FuSG92ZXJJdGVtOmlkPT5nLnNjcmVlbj09PSdwcmVwJyYmIWcuaXNQYXVzZWQoKSYmKCFnLnR1dG9yaWFsfHx0dXRvcmlhbFZpZXcuY2FuSG92ZXIoaWQpKX0pO1xuZnVuY3Rpb24gbGVhdmVJbmdyZWRpZW50KGUpe2NvbnN0IGZyb209ZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtaG92ZXItaXRlbV0nKSx0bz1lLnJlbGF0ZWRUYXJnZXQ/LmNsb3Nlc3Q/LignW2RhdGEtaG92ZXItaXRlbV0nKTtpZihmcm9tJiZmcm9tIT09dG8mJnVpLmhvdmVySXRlbSl7dWkuaG92ZXJJdGVtPW51bGw7aW5ncmVkaWVudFBvaW50ZXI9bnVsbDtyZW5kZXIoKTt9fVxucm9vdC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyb3V0JyxsZWF2ZUluZ3JlZGllbnQpO3Jvb3QuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNvdXQnLGxlYXZlSW5ncmVkaWVudCk7XG5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJyxlPT57aWYoZS5idXR0b24hPT0wKXJldHVybjtpZihlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1vcGVuaW5nLXN0YWdlXScpJiYhZy5pc1BhdXNlZCgpKXtlLnByZXZlbnREZWZhdWx0KCk7b3BlblZpZXcudW5sb2NrQXVkaW8oKTtnLmdpbW1pY2tJbnB1dCgnU3BhY2UnKTtyZW5kZXIoKTtyZXR1cm47fWNvbnN0IHJoeXRobVBhZD1lLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1hY3Q9XCJyaHl0aG1IaXRcIl0nKTtpZihyaHl0aG1QYWQmJiFyaHl0aG1QYWQuZGlzYWJsZWQpe2UucHJldmVudERlZmF1bHQoKTtzaGFrZVBvbGlzaC51bmxvY2tBdWRpbygpO2cuZ2ltbWlja0lucHV0KHJoeXRobVBhZC5kYXRhc2V0LmlkKTtyZW5kZXIoKTtyZXR1cm47fWlmKGcudHV0b3JpYWwmJiFnLm92ZXJsYXkmJlsnY29hc3RlcicsJ3NlcnZlRHJpbmsnXS5pbmNsdWRlcyhnLnR1dG9yaWFsLmtpbmQpJiYoIWUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWRyYWc9XCInKyhnLnR1dG9yaWFsLmtpbmQ9PT0nY29hc3Rlcic/J2NvYXN0ZXInOidkcmluaycpKydcIl0nKXx8Zy5jYW1lcmFNb3Zpbmd8fGcuY2FtZXJhTGVmdHx8Zy50cmFuc2l0aW9uKSlyZXR1cm47aWYoZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtc2hha2Utc3VyZmFjZV0nKSYmIWcuaXNQYXVzZWQoKSYmIWcucmVtaXg/LmhvbGQpe2UucHJldmVudERlZmF1bHQoKTtzaGFrZVBvbGlzaC51bmxvY2tBdWRpbygpO3N0aXJQb2xpc2gudW5sb2NrQXVkaW8oKTtnLmdpbW1pY2tJbnB1dCgnTW91c2VMZWZ0Jyk7cmVuZGVyKCk7cmV0dXJuO31jb25zdCBob2xkPWUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWhvbGRdJyk7aWYoaG9sZCl7ZS5wcmV2ZW50RGVmYXVsdCgpO3BvdXJWaWV3LnVubG9ja0F1ZGlvKCk7Zy5ob2xkUG91cih0cnVlKTtyZW5kZXIoKTtyZXR1cm47fWNvbnN0IGRyYWc9ZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtZHJhZ10nKTtpZihkcmFnJiYhZy5pc1BhdXNlZCgpJiYhZy5jYW1lcmFNb3ZpbmcmJiFnLmNhbWVyYUxlZnQmJiFnLnRyYW5zaXRpb24mJmcuc2NyZWVuPT09J2Jhcicpe2UucHJldmVudERlZmF1bHQoKTt1aS5kcmFnPWRyYWcuZGF0YXNldC5kcmFnO2NsZWFyVGltZW91dCh0b2FzdC50aW1lcik7ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RvYXN0JykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO2NvbnN0IGdob3N0PWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNkcmFnLWdob3N0Jyk7Z2hvc3QuaW5uZXJIVE1MPXVpLmRyYWc9PT0nY29hc3Rlcic/YDxpbWcgc3JjPVwiJHthKCdjb2FzdGVyJyl9XCIgYWx0PVwiXCI+YDpkcmlua0FydChnLmRyaW5rLnNlbGVjdGVkKTtnaG9zdC5oaWRkZW49ZmFsc2U7d2luZG93Lkx1bmFHYW1lVmlld3BvcnQucG9zaXRpb25EcmFnKGUuY2xpZW50WCxlLmNsaWVudFkpO3JlbmRlcigpO319KTtcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsZT0+e2lmKCF1aS5kcmFnKXJldHVybjt3aW5kb3cuTHVuYUdhbWVWaWV3cG9ydC5wb3NpdGlvbkRyYWcoZS5jbGllbnRYLGUuY2xpZW50WSk7fSk7XG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJyxlPT57Zy5ob2xkUG91cihmYWxzZSk7aWYodWkuZHJhZyl7Y29uc3Qgem9uZT1kb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KGUuY2xpZW50WCxlLmNsaWVudFkpPy5jbG9zZXN0KCdbZGF0YS1kcm9wXScpO2NvbnN0IG9rPXpvbmUmJih1aS5kcmFnPT09J2NvYXN0ZXInP2cuY29hc3Rlcih6b25lLmRhdGFzZXQuZHJvcCwnZHJhZycpOmcuc2VydmUoem9uZS5kYXRhc2V0LmRyb3AsJ2RyYWcnKSk7aWYoIW9rKXRvYXN0KEwoJ+2YhOyerCDshpDri5jsnZgg7Jyg7Zqo7ZWcIOy9lOyKpO2EsCDsnITsuZjsl5Ag64aT7JWEIOyjvOyEuOyalC4nLCdEcm9wIG9udG8gdGhlIGZvY3VzZWQgZ3Vlc3TigJlzIHZhbGlkIGNvYXN0ZXIuJykpO3VpLmRyYWc9bnVsbDtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZHJhZy1naG9zdCcpLmhpZGRlbj10cnVlO3JlbmRlcigpO319KTtcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywoKT0+e2cuaG9sZFBvdXIoZmFsc2UpO3VpLmRyYWc9bnVsbDtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZHJhZy1naG9zdCcpLmhpZGRlbj10cnVlO3JlbmRlcigpO30pO1xuLy8gU29tZSBlbWJlZGRlZCBicm93c2VycyBleHBvc2UgdGhlIG1vZGlmaWVyIG5hbWUgd2l0aG91dCBhIGxlZnQvcmlnaHQgY29kZS5cbmNvbnN0IGNvbnRyb2xLZXlzPW5ldyBTZXQoKTtcbmNvbnN0IGlzQ29udHJvbEtleT1lPT5lLmtleT09PSdDb250cm9sJ3x8ZS5jb2RlPT09J0NvbnRyb2xMZWZ0J3x8ZS5jb2RlPT09J0NvbnRyb2xSaWdodCd8fGUua2V5Q29kZT09PTE3O1xuY29uc3QgY29udHJvbEtleUlkPWU9Pi9eQ29udHJvbChMZWZ0fFJpZ2h0KSQvLnRlc3QoZS5jb2RlKT9lLmNvZGU6J0NvbnRyb2wnO1xuZnVuY3Rpb24gY2xlYXJDb250cm9sU2tpcCgpe2NvbnRyb2xLZXlzLmNsZWFyKCk7dWkucmVhZFNraXA9ZmFsc2U7fVxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGU9PntcbiBpZihvdXRzaWRlLmFjdGl2ZSlyZXR1cm47XG4gaWYobWl4VHV0b3JpYWwua2V5KGUpKXtyZW5kZXIodHJ1ZSk7cmV0dXJuO31cbiBwb3VyVmlldy51bmxvY2tBdWRpbygpO1xuIHJlbWl4VUkudW5sb2NrQXVkaW8oKTtvcGVuVmlldy51bmxvY2tBdWRpbygpO3NoYWtlUG9saXNoLnVubG9ja0F1ZGlvKCk7c3RpclBvbGlzaC51bmxvY2tBdWRpbygpO1xuIGlmKGcub3ZlcmxheT09PSdqb2hubnlVbmxvY2snKXtpZihlLmNvZGU9PT0nVGFiJyl7ZS5wcmV2ZW50RGVmYXVsdCgpO3Jvb3QucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwiY29uZmlybUpvaG5ueVVubG9ja1wiXScpPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fWVsc2UgaWYoZS5jb2RlPT09J0VzY2FwZSd8fGlzQ29udHJvbEtleShlKXx8ZS5jb2RlPT09J0YyJyllLnByZXZlbnREZWZhdWx0KCk7cmV0dXJuO31cbiBpZihnLm92ZXJsYXk9PT0nZGFpbHlVbmxvY2tzJyl7XG4gIGlmKGUuY29kZT09PSdUYWInKXtlLnByZXZlbnREZWZhdWx0KCk7Y29uc3QgZm9jdXNhYmxlPVsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kYWlseS11bmxvY2tzIFt0YWJpbmRleD1cIjBcIl0sLmRhaWx5LXVubG9ja3MgYnV0dG9uJyldLGk9Zm9jdXNhYmxlLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7Zm9jdXNhYmxlWyhpKyhlLnNoaWZ0S2V5Py0xOjEpK2ZvY3VzYWJsZS5sZW5ndGgpJWZvY3VzYWJsZS5sZW5ndGhdPy5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7fVxuICBlbHNlIGlmKGUuY29kZT09PSdFc2NhcGUnfHxpc0NvbnRyb2xLZXkoZSl8fGUuY29kZT09PSdGMicpe2UucHJldmVudERlZmF1bHQoKTt9XG4gIHJldHVybjtcbiB9XG4gaWYocG91clZpZXcua2V5KGUpKXtyZW5kZXIodHJ1ZSk7cmV0dXJuO31cbiAvLyBFbnRlciBzdGlsbCBhY3RpdmF0ZXMgZm9jdXNlZCBjb250cm9sczsgU3BhY2UgaXMgcmVzZXJ2ZWQgZm9yIHBvdXJpbmcgYWJvdmUuXG4gaWYoZy5zY3JlZW49PT0nZ2ltbWljaycmJmcuZ2ltbWljaz8uZmx1aWQmJmUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLXBvdXItdWldJykmJmUuY29kZT09PSdFbnRlcicpcmV0dXJuO1xuIC8vIEdsb2JhbCBtZW51IGtleXMgd29yayBldmVuIHdoZW4gYW4gb3B0aW9uIGZpZWxkIGhhcyBmb2N1czsgaGVsZCBrZXlzIG5ldmVyIHRvZ2dsZSByZXBlYXRlZGx5LlxuIGlmKGUuY29kZT09PSdFc2NhcGUnKXtlLnByZXZlbnREZWZhdWx0KCk7aWYoZS5yZXBlYXQpcmV0dXJuO2lmKGcub3ZlcmxheT09PSdkb3NzaWVyJylhY3QoJ2Rvc3NpZXJCYWNrJyk7ZWxzZSBpZihnLm92ZXJsYXkpYWN0KCdjbG9zZU92ZXJsYXknKTtlbHNlIGlmKGcuc2NyZWVuPT09J3JlY2lwZScpYWN0KCdjbG9zZVJlY2lwZScpO2Vsc2UgYWN0KCdzZXR0aW5ncycpO3JldHVybjt9XG4gaWYoZy5vdmVybGF5PT09J21pbmlJbmdyZWRpZW50Jyl7aWYoZS5jb2RlPT09J1RhYicpe2NvbnN0IGJ1dHRvbnM9Wy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbCgnLm1pbmktaW5ncmVkaWVudC1tb2RhbCBidXR0b24nKV0saT1idXR0b25zLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7ZS5wcmV2ZW50RGVmYXVsdCgpO2J1dHRvbnNbKGkrKGUuc2hpZnRLZXk/LTE6MSkrYnV0dG9ucy5sZW5ndGgpJWJ1dHRvbnMubGVuZ3RoXT8uZm9jdXMoKTt9cmV0dXJuO31pZihbJ2luZ3JlZGllbnRXYXJuaW5nJywnb3BlbmVyV2FybmluZyddLmluY2x1ZGVzKGcub3ZlcmxheSkmJmUuY29kZT09PSdUYWInKXtlLnByZXZlbnREZWZhdWx0KCk7cm9vdC5xdWVyeVNlbGVjdG9yKCcuaW5ncmVkaWVudC13YXJuaW5nIGJ1dHRvbicpPy5mb2N1cygpO3JldHVybjt9XG4gaWYoZS5jb2RlPT09J0YyJyl7ZS5wcmV2ZW50RGVmYXVsdCgpO2lmKCFlLnJlcGVhdClhY3QoJ2luc3BlY3RvcicpO3JldHVybjt9XG4gLy8gVHJhY2sgdGhlIGhlbGQga2V5IGluZGVwZW5kZW50bHkgb2YgdGhlIGN1cnJlbnQgcGhhc2U7IHBsYXliYWNrIGd1YXJkcyBsaXZlIGluIGZyYW1lKCkuXG4gaWYoaXNDb250cm9sS2V5KGUpKXtjb250cm9sS2V5cy5hZGQoY29udHJvbEtleUlkKGUpKTt1aS5yZWFkU2tpcD10cnVlO3JldHVybjt9XG4gaWYoWydJTlBVVCcsJ1NFTEVDVCcsJ1RFWFRBUkVBJ10uaW5jbHVkZXMoZS50YXJnZXQudGFnTmFtZSl8fGUudGFyZ2V0LmlzQ29udGVudEVkaXRhYmxlKXJldHVybjtcbiBpZihlLnJlcGVhdCl7aWYoWydFbnRlcicsJ1NwYWNlJ10uaW5jbHVkZXMoZS5jb2RlKSllLnByZXZlbnREZWZhdWx0KCk7cmV0dXJuO31cbiBpZihnLnR1dG9yaWFsJiYhZy5vdmVybGF5JiZlLmNvZGU9PT0nS2V5WScpcmV0dXJuO1xuIGlmKGUuY29kZT09PSdLZXlZJyl7XG4gIGlmKGcub3ZlcmxheT09PSdoaXN0b3J5Jyl7ZS5wcmV2ZW50RGVmYXVsdCgpO2FjdCgnY2xvc2VPdmVybGF5Jyk7fVxuICBlbHNlIGlmKCFnLm92ZXJsYXkmJiFnLnBhdXNlZCYmIWcuZXJyb3ImJiFnLmZpbmlzaGVkJiZnLnBoYXNlIT09J3JlYWR5JyYmIXVpLmRyYWcpe2UucHJldmVudERlZmF1bHQoKTtjbGVhckNvbnRyb2xTa2lwKCk7c2hvdygnaGlzdG9yeScpO31cbiAgcmV0dXJuO1xuIH1cbiBpZihnLm92ZXJsYXk9PT0nZG9zc2llcicmJmUuY29kZT09PSdUYWInJiYhdWkuaW5zcGVjdG9yKXtjb25zdCBzY29wZT1yb290LnF1ZXJ5U2VsZWN0b3IodWkuZG9zc2llckRldGFpbD8nLmRvc3NpZXItZGV0YWlsJzonLmRvc3NpZXItbGlzdC1zaGVsbCcpO2NvbnN0IGVscz1bLi4uc2NvcGUucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uOm5vdChbZGlzYWJsZWRdKSxbdGFiaW5kZXg9XCIwXCJdJyldO2NvbnN0IGk9ZWxzLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7aWYoaTwwfHwhZS5zaGlmdEtleSYmaT09PWVscy5sZW5ndGgtMXx8ZS5zaGlmdEtleSYmaT09PTApe2UucHJldmVudERlZmF1bHQoKTtlbHNbZS5zaGlmdEtleT9lbHMubGVuZ3RoLTE6MF0/LmZvY3VzKCk7fXJldHVybjt9XG4gLy8gRHJhZyBpcyB0aGUgcHJpbWFyeSBhY3Rpb247IEUgaXMgdGhlIG9ubHkgY29hc3RlciBrZXlib2FyZCBzaG9ydGN1dC5cbiAvLyBDb25zdW1lIEUgZXZlbiB3aGVuIGEgY2FtZXJhIGd1YXJkIHJlamVjdHMgaXQsIHNvIGl0IGNhbm5vdCBhbHNvIHJlYXNrIGFuIG9yZGVyLlxuIGlmKGUuY29kZT09PSdLZXlFJyYmZy5zY3JlZW49PT0nYmFyJyYmIWcuaXNQYXVzZWQoKSl7XG4gIGNvbnN0IHNlYXQ9Zy50dXRvcmlhbD8ua2luZD09PSdjb2FzdGVyJz9nLnR1dG9yaWFsLnNlYXQ6Zy5zdG9yeUNvYXN0ZXJSZWFkeSgpP2cuc3RvcnlDb2FzdGVyLnNlYXQ6Zy5waGFzZT09PSdnZW5lcmFsJyYmZy5zZWF0c1tnLmZvY3VzXT8uc3RhdGU9PT0nV0FJVF9DT0FTVEVSJz9nLmZvY3VzOm51bGw7XG4gIGlmKHNlYXQpe2UucHJldmVudERlZmF1bHQoKTtpZighdWkuZHJhZyYmIXVpLmluc3BlY3RvcilnLmNvYXN0ZXIoc2VhdCwna2V5Ym9hcmQnKTtyZW5kZXIoKTtyZXR1cm47fVxuIH1cbiBpZih0dXRvcmlhbFZpZXcua2V5KGUscm9vdCxhY3QpKXtyZW5kZXIoKTtyZXR1cm47fVxuIGlmKGUuY29kZT09PSdUYWInJiYoZy5vdmVybGF5PT09J3NlcnZpY2UnfHxnLnNjcmVlbj09PSdiYXInJiZnLnBoYXNlIT09J3JlYWR5JyYmIWcuZmluaXNoZWQmJiFnLmlzUGF1c2VkKCkmJiF1aS5kcmFnKSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2FjdCgnc2VydmljZScpO3JldHVybjt9XG4gaWYoZy5vdmVybGF5PT09J3NlcnZpY2UnJiZbJ0Fycm93VXAnLCdBcnJvd0Rvd24nXS5pbmNsdWRlcyhlLmNvZGUpKXtlLnByZXZlbnREZWZhdWx0KCk7Y29uc3QgYnV0dG9ucz1bLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCcjc2VydmljZS1wYW5lbCBidXR0b24nKV0saT1idXR0b25zLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7YnV0dG9uc1soaSsoZS5jb2RlPT09J0Fycm93RG93bic/MTotMSkrYnV0dG9ucy5sZW5ndGgpJWJ1dHRvbnMubGVuZ3RoXT8uZm9jdXMoKTtyZXR1cm47fVxuIGlmKGcuaXNQYXVzZWQoKXx8Zy5waGFzZT09PSdyZWFkeScpcmV0dXJuO1xuIGlmKGcuc2NyZWVuPT09J2JhcicmJmcuY2hvaWNlJiZbJ0Fycm93VXAnLCdBcnJvd0Rvd24nLCdFbnRlcicsJ1NwYWNlJ10uaW5jbHVkZXMoZS5jb2RlKSl7XG4gIGUucHJldmVudERlZmF1bHQoKTtpZihnLmNhbWVyYU1vdmluZ3x8Zy5jYW1lcmFMZWZ0PjB8fGcudHJhbnNpdGlvbj4wfHx1aS5pbnNwZWN0b3J8fHVpLmRyYWcpcmV0dXJuO1xuICBjb25zdCBidXR0b25zPVsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jaG9pY2VzIGJ1dHRvbjpub3QoOmRpc2FibGVkKScpXSxpPWJ1dHRvbnMuaW5kZXhPZihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcbiAgaWYoIWJ1dHRvbnMubGVuZ3RoKXJldHVybjtcbiAgaWYoZS5jb2RlPT09J0Fycm93VXAnfHxlLmNvZGU9PT0nQXJyb3dEb3duJylidXR0b25zW2k8MD8oZS5jb2RlPT09J0Fycm93RG93bic/MDpidXR0b25zLmxlbmd0aC0xKTooaSsoZS5jb2RlPT09J0Fycm93RG93bic/MTotMSkrYnV0dG9ucy5sZW5ndGgpJWJ1dHRvbnMubGVuZ3RoXS5mb2N1cyh7cHJldmVudFNjcm9sbDp0cnVlfSk7XG4gIGVsc2UgaWYoaT49MClidXR0b25zW2ldLmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtcbiAgZWxzZSBidXR0b25zWzBdLmZvY3VzKHtwcmV2ZW50U2Nyb2xsOnRydWV9KTtcbiAgcmV0dXJuO1xuIH1cbiBpZihnLnNjcmVlbj09PSdnaW1taWNrJyl7aWYoWydTcGFjZScsJ0tleVcnLCdLZXlBJywnS2V5UycsJ0tleUQnLCdBcnJvd1VwJywnQXJyb3dEb3duJywnQXJyb3dMZWZ0JywnQXJyb3dSaWdodCddLmluY2x1ZGVzKGUuY29kZSkpe2UucHJldmVudERlZmF1bHQoKTtnLmdpbW1pY2tJbnB1dChlLmNvZGUpO3JlbmRlcigpO31yZXR1cm47fVxuIGlmKGcuZHJpbmsmJmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ/LmRhdGFzZXQuZHJhZz09PSdkcmluaycmJlsnRW50ZXInLCdTcGFjZSddLmluY2x1ZGVzKGUuY29kZSkpe2UucHJldmVudERlZmF1bHQoKTtnLnNlcnZlKGcuY3VycmVudE9yZGVyPy5zZWF0fHxnLmZvY3VzLCdrZXlib2FyZCcpO3JlbmRlcigpO3JldHVybjt9aWYoZy5zY3JlZW49PT0ncHJlcCcmJlsnS2V5QScsJ0tleUQnLCdBcnJvd0xlZnQnLCdBcnJvd1JpZ2h0J10uaW5jbHVkZXMoZS5jb2RlKSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2FjdCgnc2hlbGZDYXRlZ29yeScsWydLZXlBJywnQXJyb3dMZWZ0J10uaW5jbHVkZXMoZS5jb2RlKT8nLTEnOicxJyk7cmV0dXJuO31pZihnLnNjcmVlbiE9PSdiYXInKXJldHVybjtpZihnLnBoYXNlPT09J2dlbmVyYWwnKXtpZihlLmNvZGU9PT0nU3BhY2UnKXtlLnByZXZlbnREZWZhdWx0KCk7fWVsc2UgaWYoZS5jb2RlPT09J0tleUUnKXtlLnByZXZlbnREZWZhdWx0KCk7Zy5yZWFzaygpO31lbHNlIGlmKFsnS2V5QScsJ0Fycm93TGVmdCcsJ0tleUQnLCdBcnJvd1JpZ2h0J10uaW5jbHVkZXMoZS5jb2RlKSl7ZS5wcmV2ZW50RGVmYXVsdCgpO2NvbnN0IGRlbHRhPVsnS2V5QScsJ0Fycm93TGVmdCddLmluY2x1ZGVzKGUuY29kZSk/LTE6MTtnLmZvY3VzU2VhdChbJ0wnLCdNJywnUiddW01hdGgubWF4KDAsTWF0aC5taW4oMixbJ0wnLCdNJywnUiddLmluZGV4T2YoZy5mb2N1cykrZGVsdGEpKV0pO319ZWxzZSBpZihbJ1NwYWNlJywnRW50ZXInXS5pbmNsdWRlcyhlLmNvZGUpKXtlLnByZXZlbnREZWZhdWx0KCk7Zy5hZHZhbmNlKCk7fXJlbmRlcigpO30pO1xud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJyxlPT57aWYoZS5jb2RlPT09J1NwYWNlJyl7aWYoZy5zY3JlZW49PT0nZ2ltbWljaycmJmcuZ2ltbWljaz8uZmx1aWQmJiFnLmlzUGF1c2VkKCkpZS5wcmV2ZW50RGVmYXVsdCgpO2cuaG9sZFBvdXIoZmFsc2UpO31pZihpc0NvbnRyb2xLZXkoZSkpe2NvbnN0IGlkPWNvbnRyb2xLZXlJZChlKTtpZihpZD09PSdDb250cm9sJyljb250cm9sS2V5cy5jbGVhcigpO2Vsc2V7Y29udHJvbEtleXMuZGVsZXRlKGlkKTtjb250cm9sS2V5cy5kZWxldGUoJ0NvbnRyb2wnKTt9dWkucmVhZFNraXA9Y29udHJvbEtleXMuc2l6ZT4wO319KTtcbmZ1bmN0aW9uIHJlbGVhc2VCYWNrZ3JvdW5kSW5wdXQoKXtnLmhvbGRQb3VyKGZhbHNlKTtnLmdpbW1pY2smJihnLmdpbW1pY2suaGVsZD1mYWxzZSk7Y2xlYXJDb250cm9sU2tpcCgpO3VpLmRyYWc9bnVsbDtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZHJhZy1naG9zdCcpLmhpZGRlbj10cnVlO31cbmZ1bmN0aW9uIHN5bmNGb2N1c1BhdXNlKCl7Zy5oaWRkZW49d2luZG93Lkx1bmFGb2N1c1NldHRpbmdzLmhpZGRlblBhdXNlZDt9XG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbHVuYS1mb2N1cy1zZXR0aW5ncy1jaGFuZ2UnLHN5bmNGb2N1c1BhdXNlKTtzeW5jRm9jdXNQYXVzZSgpO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsKCk9PntzeW5jRm9jdXNQYXVzZSgpO2lmKGRvY3VtZW50LmhpZGRlbilyZWxlYXNlQmFja2dyb3VuZElucHV0KCk7fSk7XG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsKCk9PntyZWxlYXNlQmFja2dyb3VuZElucHV0KCk7aWYob3V0c2lkZS5hY3RpdmV8fGNhbXBhaWduPy5ibG9ja2luZylyZXR1cm47aWYod2luZG93Lkx1bmFGb2N1c1NldHRpbmdzLmVuYWJsZWQmJmcucGhhc2UhPT0ncmVhZHknJiYhZy5maW5pc2hlZCYmIWcub3ZlcmxheSlzaG93KCdzZXR0aW5ncycpO30pO1xubGV0IGxhc3RSZW5kZXI9MCxhdXRvVGltZXI9MCxsYXN0RGlhbG9ndWU9bnVsbCxsYXN0UmVhZENvdW50PWcucmVhZC5zaXplLHNraXBUaW1lcj0wO1xuZnVuY3Rpb24gZnJhbWUobm93LGR0KXtiZ20uc3luY0xvY2F0aW9uKGNhbXBhaWduLG91dHNpZGUpO3dpbmRvdy5MdW5hU3RvcnlOb3RpY2VzLnRpY2soZyxvdXRzaWRlLGNhbXBhaWduLGR0KTt3aW5kb3cubHVuYVFBPy50aWNrKE1hdGgubWluKC4wNSxkdCkpO2lmKGNhbXBhaWduPy50aWNrKGR0KSlyZXR1cm47aWYob3V0c2lkZS5hY3RpdmUpe291dHNpZGUudGljayhkdCk7cmV0dXJuO310dXRvcmlhbFZpZXcudXBkYXRlU2hlbGYocm9vdCk7cmVtaXhVSS5zb3VuZFRpY2soKTt2aWV3cy5zeW5jQ2FtZXJhKHJvb3QpO2cudGljayhkdCx7aG9sZFNwZWVjaDp1aS5kcmFnPT09J2NvYXN0ZXInfSk7Y3VycmVuY3lWaWV3LnVwZGF0ZShnLnByb2dyZXNzLGR0LGcuaGlkZGVuKTt2aWV3cy5zeW5jQ2FtZXJhKHJvb3QpO2lmKHVpLmF1dG8mJiF1aS5kcmFnJiYhdWkucmVhZFNraXAmJiFnLmNhbWVyYU1vdmluZyYmZy5jYW1lcmFMZWZ0PT09MCYmZy50cmFuc2l0aW9uPT09MCYmZy5kaWFsb2d1ZSYmZy5kaWFsb2d1ZS5jaGFycz49Zy5kaWFsb2d1ZS50ZXh0Lmxlbmd0aCYmIWcuaXNQYXVzZWQoKSYmZy5zY3JlZW49PT0nYmFyJyl7aWYobGFzdERpYWxvZ3VlIT09Zy5kaWFsb2d1ZSl7YXV0b1RpbWVyPTA7bGFzdERpYWxvZ3VlPWcuZGlhbG9ndWU7fWF1dG9UaW1lcis9ZHQ7aWYoYXV0b1RpbWVyPj0yKXtnLmFkdmFuY2UoKTthdXRvVGltZXI9MDt9fWVsc2UgYXV0b1RpbWVyPTA7XG4gaWYodWkucmVhZFNraXAmJlsnb3BlbmluZycsJ3JlZ3VsYXInXS5pbmNsdWRlcyhnLnBoYXNlKSYmIWcuY2hvaWNlJiYhdWkuaW5zcGVjdG9yJiYhdWkuZHJhZyYmIWcuZmluaXNoZWQmJiFnLmNhbWVyYU1vdmluZyYmZy5jYW1lcmFMZWZ0PT09MCYmZy50cmFuc2l0aW9uPT09MCYmZy5kaWFsb2d1ZSYmIWcuaXNQYXVzZWQoKSYmZy5zY3JlZW49PT0nYmFyJyYmIVsnSU5QVVQnLCdTRUxFQ1QnLCdURVhUQVJFQSddLmluY2x1ZGVzKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ/LnRhZ05hbWUpJiYhZG9jdW1lbnQuYWN0aXZlRWxlbWVudD8uaXNDb250ZW50RWRpdGFibGUpe3NraXBUaW1lcis9TWF0aC5taW4oZHQsLjA1KTtpZihza2lwVGltZXI+PS4xMil7Zy5hZHZhbmNlKCk7c2tpcFRpbWVyPTA7fX1lbHNlIHNraXBUaW1lcj0wO1xuIGlmKGcucmVhZC5zaXplIT09bGFzdFJlYWRDb3VudCl7bGFzdFJlYWRDb3VudD1nLnJlYWQuc2l6ZTt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oZy52YXJpYW50PT09J2dwdCc/J2x1bmEuYmFyLmdwdC5yZWFkLnYxJzonbHVuYS5iYXIucGxheXRlc3QucmVhZC52MScsSlNPTi5zdHJpbmdpZnkoWy4uLmcucmVhZF0pKTt9Y2F0Y2h7fX1cbiBpZihnLmVmZmVjdFZpc3VhbCYmZy5lZmZlY3RWaXN1YWwhPT11aS5sYXN0RWZmZWN0KXt1aS5sYXN0RWZmZWN0PWcuZWZmZWN0VmlzdWFsO2lmKHVpLnNvdW5kJiZnLmVmZmVjdFZpc3VhbC5raW5kPT09J3NmeCcpe3RyeXtjb25zdCBjb250ZXh0PW5ldyBBdWRpb0NvbnRleHQoKSxvc2M9Y29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCksZ2Fpbj1jb250ZXh0LmNyZWF0ZUdhaW4oKTtvc2MuY29ubmVjdChnYWluKTtnYWluLmNvbm5lY3Qod2luZG93Lkx1bmFTZngub3V0cHV0KGNvbnRleHQpKTtvc2MuZnJlcXVlbmN5LnZhbHVlPTE4MDtnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUoLjA4LGNvbnRleHQuY3VycmVudFRpbWUpO2dhaW4uZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKC4wMDEsY29udGV4dC5jdXJyZW50VGltZSsuMzUpO29zYy5zdGFydCgpO29zYy5zdG9wKGNvbnRleHQuY3VycmVudFRpbWUrLjM1KTtvc2Mub25lbmRlZD0oKT0+e3dpbmRvdy5MdW5hU2Z4LnJlbGVhc2UoY29udGV4dCk7Y29udGV4dC5jbG9zZSgpO307fWNhdGNoe319fVxuIGNvbnN0IHJlbmRlck1zPVsnYmFyJywncmVzdWx0JywnZGlzY2FyZGluZyddLmluY2x1ZGVzKGcuc2NyZWVuKXx8Zy5zY3JlZW49PT0nZ2ltbWljaycmJlsnc3RpcicsJ3NoYWtlJ10uaW5jbHVkZXMoZy5naW1taWNrPy50eXBlKT8xMDAwLzMwOjgwO1xuIGlmKG5vdy1sYXN0UmVuZGVyPnJlbmRlck1zKXtyZW5kZXIoKTtsYXN0UmVuZGVyPW5vdzt9dmlld3Muc3luY1N0aXJNb3Rpb24ocm9vdCk7c2VydmVWaWV3LnN5bmMocm9vdCk7cG91clZpZXcuc3luYyhyb290KTtvcGVuVmlldy5zeW5jKHJvb3QpO3NoYWtlUG9saXNoLnN5bmMocm9vdCk7d2luZG93Lkx1bmFTaGFrZVJoeXRobS5zeW5jKHJvb3QsZyk7c3RpclBvbGlzaC5zeW5jKHJvb3QpO31cbmZ1bmN0aW9uIGZpdFZpZXdwb3J0KCl7cm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1nYW1lLXNjYWxlJyxNYXRoLm1pbihpbm5lcldpZHRoLzEyODAsaW5uZXJIZWlnaHQvNzIwKSk7c3luY0luZ3JlZGllbnRQb2ludGVyVGlwKCk7c3luY1JlY2lwZVBvaW50ZXJUaXAoKTt9XG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJyxmaXRWaWV3cG9ydCk7Zml0Vmlld3BvcnQoKTtcbmcub25TdG9yeUN1ZT1raW5kPT53aW5kb3cuTHVuYUpvaG5ueU1lbW9yeS5jdWUoa2luZCx1aS5naW1taWNrQXVkaW8hPT1mYWxzZSk7Zy5vbkNoYW5nZT0oKT0+e307Y2FtcGFpZ249d2luZG93Lmx1bmFDYW1wYWlnbj13aW5kb3cuTHVuYUNhbXBhaWduLmNyZWF0ZSh7ZyxELHVpLG91dHNpZGUsYXBwOnJvb3QscmVuZGVyLGJnbSxjbGVhcklucHV0OmNsZWFyQ29udHJvbFNraXB9KTt3aW5kb3cubHVuYVFBPXdpbmRvdy5MdW5hUUFMYWIuY3JlYXRlKHtnLEQsdWksb3V0c2lkZSxyZW5kZXIsY2xlYXJJbnB1dDpjbGVhckNvbnRyb2xTa2lwfSk7d2luZG93Lkx1bmFTZXR0aW5ncy5yZXN0b3JlKCk7cmVuZGVyKHRydWUpO3dpbmRvdy5MdW5hRm9jdXNTZXR0aW5ncy5zdGFydExvb3AoZnJhbWUpO1xud2luZG93Lkx1bmFDdHJsRGlhZ25vc3RpYygoKT0+KHtoZWxkOnVpLnJlYWRTa2lwLHBoYXNlOmcucGhhc2Usc2NyZWVuOmcuc2NyZWVuLGhpc3Rvcnk6Zy5oaXN0b3J5Lmxlbmd0aCxkaWFsb2d1ZTohIWcuZGlhbG9ndWUsY2hvaWNlOiEhZy5jaG9pY2UscGF1c2VkOmcuaXNQYXVzZWQoKSxoaWRkZW46Zy5oaWRkZW4sb3ZlcmxheTpnLm92ZXJsYXksaW5zcGVjdG9yOnVpLmluc3BlY3RvcixkcmFnOiEhdWkuZHJhZyxjYW1lcmE6Zy5jYW1lcmFNb3ZpbmcsY2FtZXJhTGVmdDpnLmNhbWVyYUxlZnQsdHJhbnNpdGlvbjpnLnRyYW5zaXRpb24sdHlwaW5nOmcuZGlhbG9ndWU/Zy5kaWFsb2d1ZS5jaGFyczxnLmRpYWxvZ3VlLnRleHQubGVuZ3RoOmZhbHNlfSkpO1xufSkoKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFDLFlBQVU7RUFDWCxZQUFZOztFQUNaLE1BQU1BLEdBQUcsR0FBQ0MsTUFBTSxDQUFDQyxNQUFNLEdBQUMsSUFBSUQsTUFBTSxDQUFDRSxVQUFVLENBQUMsQ0FBQztFQUMvQyxNQUFNQyxDQUFDLEdBQUNILE1BQU0sQ0FBQ0ksUUFBUTtJQUFDQyxDQUFDLEdBQUNGLENBQUMsQ0FBQ0csY0FBYyxDQUFDTixNQUFNLENBQUNPLFNBQVMsQ0FBQztJQUFD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
