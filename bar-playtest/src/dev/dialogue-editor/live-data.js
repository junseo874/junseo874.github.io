/* Local authoring bridge. Bar: scene/reset boundaries. Exterior: next flow; preserve active rows and progress. */
(function (root) {
  'use strict';
  const key = 'luna.dialogue.saved.v1';
  const tables = ['steps', 'bar_choices', 'bar_choice_groups'];
  function controller({g, D, raw, campaign, story}) {
    let pending = null, revision = '';
    function apply() {
      if (!pending) return false;
      const next = pending;
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
        // Freeze active conversations before updating arrays captured by NPC modules.
        const model=root.outsidePlaytest?.model;
        for(const s of [model?.story?.speech,...[...(model?.backgroundStory?.channels?.values()||[])].map(s=>s.speech)])if(s)s.rows=s.rows.slice();
        if(campaign.dialog?.rows)campaign.dialog.rows=campaign.dialog.rows.slice();
        const merge=(target,source)=>{for(const [key,rows]of Object.entries(source||{})){if(Array.isArray(target[key]))target[key].splice(0,target[key].length,...rows);else target[key]=rows;}};
        raw.sharedStory||={};merge(raw.sharedStory,next.exterior.sharedStory);
        if(D!==raw){D.sharedStory||={};merge(D.sharedStory,next.exterior.sharedStory);}
        raw.outsideChoices=next.exterior.choices;D.outsideChoices=next.exterior.choices;
        if(next.exterior.newspaperRoutes)D.newspaperRoutes=raw.newspaperRoutes=next.exterior.newspaperRoutes;
        raw.outsideChoiceEdits=next.exterior.choiceEdits||{};D.outsideChoiceEdits=raw.outsideChoiceEdits;
        for(const target of new Set([story,campaign.data,campaign.session.story]))if(target){target.scenes||={};merge(target.scenes,next.exterior.scenes);target.prologue=next.exterior.prologue;}
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
    let running = null, again = false;
    async function refresh() {
      if (running) { again = true; return running; }
      running = (async () => {
        do {
          again = false;
          try {
            const res = await root.fetch('/api/dialogue-editor/runtime', {cache:'no-store', signal:AbortSignal.timeout(10000)});
            if (!res.ok) throw Error('저장 연결 확인 필요 (' + res.status + ')');
            const previouslyLoaded = state.revision || state.pendingRevision;
            const changed = state.receive(await res.json());
            if (previouslyLoaded && changed) options.onStatus?.(changed === 'pending'
              ? '수정 대사를 받았습니다. 다음 장면 / 테스트 재시작부터 적용됩니다.'
              : '저장한 대사를 본편 / 일차 테스트에 반영했습니다.');
            state.error = '';
          } catch (error) {
            if ((state.revision || state.pendingRevision) && state.error !== error.message) {
              options.onStatus?.('대사 자동 반영 실패 · 게임 탭 복귀 시 다시 확인합니다.');
            }
            state.error = error.message;
            console.warn('대사 자동 반영 실패 · 기존 대사는 유지합니다:', error.message);
          }
        } while (again);
      })();
      try { await running; } finally { running = null; }
    }
    const channel = typeof root.BroadcastChannel === 'function' ? new root.BroadcastChannel(key) : null;
    if (channel) channel.onmessage = () => refresh();
    root.addEventListener('storage', event => { if (event.key === key) refresh(); });
    root.addEventListener('focus', refresh);
    root.addEventListener('pageshow', refresh);
    root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) refresh(); });
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
