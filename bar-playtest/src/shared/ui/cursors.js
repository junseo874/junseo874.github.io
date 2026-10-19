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
  for (const [name, [x, y, fallback]] of Object.entries(cursors)) {
    document.documentElement.style.setProperty('--luna-cursor-' + name,
      `url("${new URL(name + '.svg', base).href}") ${x} ${y}, ${fallback}`);
  }
})();
