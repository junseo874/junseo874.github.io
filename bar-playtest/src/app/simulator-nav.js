(function (W) {
  const groups = [
    [['플레이', 'Play'], [
      ['original', '바 영업', 'Bar service'], ['minigames', '기믹 미니게임', 'Minigames'],
      ['outside', '외부 공간', 'Outside'], ['cutscenes', '컷씬', 'Cutscenes']
    ]],
    [['제작 도구', 'Tools'], [
      ['guest-appearance', '손님 외형', 'Guest appearance'], ['dialogue-editors', '대사 편집', 'Dialogue editor'],
      ['resource-review', '리소스 확인', 'Resources'], ['data-review', '공통 CSV 데이터', 'Shared CSV data']
    ]]
  ];
  function navigation(active, L, inGame) {
    let title;
    const sections = groups.map(([name, items]) => {
      const links = items.map(([id, ko, en]) => {
        const selected = id === active;
        if (selected) title = L(ko,en);
        const page = ['dialogue-editors', 'resource-review', 'data-review'].includes(id);
        if (inGame && !page) return `<button type="button" data-act="version" data-id="${id}" aria-pressed="${selected}" class="${selected ? 'selected' : ''}">${L(ko,en)}</button>`;
        const url = page ? id+'.html' : id==='original' ? 'index.html?dev=1' : 'index.html?mode='+id;
        return `<a href="${url}" ${selected ? 'aria-current="page"' : ''}>${L(ko,en)}</a>`;
      }).join('');
      return `<div class="sim-nav-group"><small>${L(...name)}</small>${links}</div>`;
    }).join('');
    return `<nav class="version-tabs sim-nav" aria-label="${L('시뮬레이터','Simulator')}"><strong class="sim-brand"><i aria-hidden="true">⌘</i>${L('시뮬레이터','Simulator')}</strong>${sections}</nav>` + (inGame ? `<header class="sim-heading"><h1>${title}</h1></header>` : '');
  }
  W.lunaSimulatorNav = navigation;
  if (document.body?.dataset.simPage) document.body.insertAdjacentHTML('afterbegin',navigation(document.body.dataset.simPage,ko=>ko,false));
})(window);
