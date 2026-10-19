// Custom-property URLs can be resolved relative to the consuming stylesheet.
// Resolve once from this module so shared cursors work on every public page,
// including a GitHub Pages project deployed below a path prefix.
(function () {
  'use strict';
  const base = new URL('../../../assets/ui/cursors/', document.currentScript.src);
  const cursors = {
    default: [4, 3, 'default'], pointer: [14, 3, 'pointer'], pressed: [14, 5, 'pointer'],
    grab: [16, 15, 'grab'], grabbing: [16, 16, 'grabbing'],
    'not-allowed': [16, 16, 'not-allowed'], text: [16, 16, 'text'],
    'ew-resize': [16, 16, 'ew-resize'], 'ns-resize': [16, 16, 'ns-resize'],
    crosshair: [16, 16, 'crosshair'], wait: [16, 16, 'wait'], 'zoom-in': [13, 12, 'zoom-in'],
  };
  const descriptions = {
    default: ['기본 이동', '일반 화면과 빈 영역'],
    pointer: ['클릭 가능', '버튼·링크·선택 항목 위'],
    pressed: ['누르는 중', '버튼을 누르고 있는 동안'],
    grab: ['잡기 가능', '드래그할 수 있는 대상 위'],
    grabbing: ['잡고 이동 중', '대상을 잡아 드래그하는 동안'],
    'not-allowed': ['사용 불가', '비활성 버튼·조작할 수 없는 대상'],
    text: ['텍스트 입력', '검색창·텍스트 입력 영역'],
    'ew-resize': ['좌우 조절', '가로 슬라이더·좌우 크기 조절'],
    'ns-resize': ['상하 조절', '세로 크기 조절'],
    crosshair: ['정밀 선택', '좌표·영역 선택'],
    wait: ['처리 대기', '처리 중인 영역'],
    'zoom-in': ['확대', '확대할 수 있는 이미지'],
  };
  // Review/export metadata shares the exact URLs and hotspots used by the UI.
  window.LunaCursors = Object.entries(cursors).map(([id, [x, y, fallback]]) => ({
    id, src: new URL(id + '.svg', base).href, w: 32, h: 32,
    hotspot: [x, y], fallback, title: descriptions[id][0], usage: descriptions[id][1],
  }));
  for (const [name, [x, y, fallback]] of Object.entries(cursors)) {
    document.documentElement.style.setProperty('--luna-cursor-' + name,
      `url("${new URL(name + '.svg', base).href}") ${x} ${y}, ${fallback}`);
  }
})();
