/* Local authoring bridge. Bar: scene/reset boundaries. Exterior: next flow; preserve active rows and progress. */
(function (root) {
  'use strict';
  const key = 'luna.dialogue.saved.v1';
  const tables = ['steps', 'bar_choices', 'bar_choice_groups'];
  function updateRows(target, source, authored = false) {
    if (!source) return;
    // The snapshot is complete for editor-created branches. Drop a deleted
    // branch on the next conversation, without erasing native runtime hooks.
    if (authored) for (const id of Object.keys(target)) {
      if ((id.startsWith('editor/') || id.startsWith('graph/')) && !Object.hasOwn(source,id)) delete target[id];
    }
    for (const [id,rows] of Object.entries(source)) {
      if (Array.isArray(target[id])) target[id].splice(0,target[id].length,...rows);
      else target[id]=rows;
    }
  }
  function controller({g, D, raw, campaign, story}) {
    let pending = null, revision = '';
    function apply() {
      if (!pending) return false;
      const next = pending;
      if(next.tables.text_tags){D.tables.text_tags=raw.tables.text_tags=next.tables.text_tags;}
      for (const name of tables) {
        D.tables[name] = next.tables[name];
        raw.tables[name] = next.tables[name];
        // Campaign uninstall must not restore a pre-save copy of the script.
        if (campaign.session.original) campaign.session.original[name] = next.tables[name];
      }
      for (const target of new Set([story, campaign.data, campaign.session.story])) {
        if (target) Object.assign(target, next.story);
      }
      revision = next.revision;
      pending = null;
      return true;
    }
    function receive(next) {
      if (!next || typeof next.revision !== 'string' || !/^[a-f0-9]{64}$/.test(next.revision) ||
          tables.some(name => !Array.isArray(next.tables?.[name])) ||
          !next.story?.opening || !next.story?.bar || !Array.isArray(next.story?.day0Bar)) {
        throw Error('저장된 대사 데이터 형식이 올바르지 않습니다.');
      }
      if (next.revision === (pending?.revision || revision)) return;
      if(next.exterior){
        if(next.exterior.placement)root.LunaNpcScene?.receive(next.exterior.placement);
        // Freeze active conversations before updating arrays captured by NPC modules.
        const model=root.outsidePlaytest?.model;
        for(const s of [model?.story?.speech,...[...(model?.backgroundStory?.channels?.values()||[])].map(s=>s.speech)])if(s){s.rows=s.rows.slice();if(s.authoring?.sharedStory)s.authoring={...s.authoring,sharedStory:Object.fromEntries(Object.entries(s.authoring.sharedStory).map(([k,lines])=>[k,lines.slice()]))};}
        if(campaign.dialog?.rows)campaign.dialog.rows=campaign.dialog.rows.slice();
        raw.sharedStory||={};D.sharedStory||={};
        for(const target of new Set([raw.sharedStory,D.sharedStory]))updateRows(target,next.exterior.sharedStory,true);
        raw.outsideChoices=next.exterior.choices;D.outsideChoices=next.exterior.choices;
        if(next.exterior.ambient)D.outsideAmbient=raw.outsideAmbient=next.exterior.ambient;
        if(next.exterior.newspaperRoutes)D.newspaperRoutes=raw.newspaperRoutes=next.exterior.newspaperRoutes;
        raw.outsideChoiceEdits=next.exterior.choiceEdits||{};D.outsideChoiceEdits=raw.outsideChoiceEdits;
        for(const target of new Set([story,campaign.data,campaign.session.story]))if(target){target.scenes||={};updateRows(target.scenes,next.exterior.scenes);}
        for(const [key,rows]of Object.entries(raw.sharedStory))if(key.startsWith('ambient/')&&root.LUNA_OUTSIDE_DIALOGUES)root.LUNA_OUTSIDE_DIALOGUES[key.slice(8)]=rows;
      }
      pending = next;
      if (!g.story) apply();
      return pending ? 'pending' : 'applied';
    }
    g.refreshDialogueData = apply;
    return {receive, apply, get revision() { return revision; }, get pendingRevision() { return pending?.revision || ''; }};
  }

  function attach(options) {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(root.location.hostname) ||
        new URLSearchParams(root.location.search).has('dialogue-preview')) return null;
    const state = controller(options);
    let running = null, saveSerial = 0, announced = '', lastSuccess = -Infinity;
    const known = () => state.pendingRevision || state.revision;
    function refresh() {
      if (running) return running;
      running = (async () => {
        for (;;) {
          const atStart = saveSerial;
          try {
            const res = await root.fetch('/api/dialogue-editor/runtime', {cache:'no-store', signal:AbortSignal.timeout(10000)});
            if (!res.ok) throw Error('저장 연결 확인 필요 (' + res.status + ')');
            const previouslyLoaded = state.revision || state.pendingRevision;
            const changed = state.receive(await res.json());
            if (previouslyLoaded && changed) options.onStatus?.(changed === 'pending'
              ? '수정 대사를 받았습니다. 다음 장면 / 테스트 재시작부터 적용됩니다.'
              : '저장한 대사를 본편 / 일차 테스트에 반영했습니다.');
            state.error = '';
            lastSuccess = Date.now();
          } catch (error) {
            if ((state.revision || state.pendingRevision) && state.error !== error.message) {
              options.onStatus?.('대사 자동 반영 실패 · 게임 탭 복귀 시 다시 확인합니다.');
            }
            state.error = error.message;
            console.warn('대사 자동 반영 실패 · 기존 대사는 유지합니다:', error.message);
          }
          // Only a distinct save *during* this request can make its reply stale.
          // A focus event, or the other notification for the same save, cannot.
          if (saveSerial === atStart || announced === known()) break;
        }
      })().finally(() => { running = null; announced = ''; });
      return running;
    }
    const wake = () => { if (state.error || Date.now() - lastSuccess > 250) refresh(); };
    function saved(message) {
      const revision = message?.revision;
      if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision) || revision === known() || revision === announced) return;
      announced = revision; saveSerial++;return refresh();
    }
    const channel = typeof root.BroadcastChannel === 'function' ? new root.BroadcastChannel(key) : null;
    if (channel) channel.onmessage = event => saved(event.data);
    root.addEventListener('storage', event => {
      if (event.key !== key) return;
      let message;try { message = JSON.parse(event.newValue); } catch { return; }
      saved(message);
    });
    root.addEventListener('focus', wake);
    root.addEventListener('pageshow', wake);
    root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) wake(); });
    // Re-fetch trusted server data; never accept executable/data payloads from another tab.
    refresh();
    return Object.assign(state, {refresh});
  }
  function notify(revision) {
    try { root.localStorage.setItem(key, JSON.stringify({revision, at:Date.now()})); } catch {}
    if (typeof root.BroadcastChannel === 'function') {
      const channel = new root.BroadcastChannel(key);
      channel.postMessage({revision});
      channel.close();
    }
  }
  const api = {controller, attach, notify};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LunaDialogueLiveData = api;
})(typeof window === 'undefined' ? globalThis : window);
