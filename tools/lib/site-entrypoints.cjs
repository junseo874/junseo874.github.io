// Shared by the static load-order check and the real browser smoke test.
const pages = [
  'index.html', 'intro.html', 'direction.html', 'simulator.html', 'LUNA_TestTool.html',
  'bar-playtest/index.html', 'bar-playtest/dialogue-editor.html', 'bar-playtest/dialogue-editors.html',
  'bar-playtest/outside-dialogue-editor.html', 'bar-playtest/resource-review.html', 'bar-playtest/story-guide.html',
  'bar-playtest/recipe-editor.html', 'bar-playtest/data-review.html', 'bar-playtest/sound-lab.html',
  'bar-playtest/src/dev/shaking/version-2.html', 'bar-playtest/src/dev/wine-opening/version-1.html',
  'bar-playtest/src/dev/wine-opening/version-2.html', 'cutscene-studio/index.html', 'cutscene-studio/trailer.html', 'cutscene-studio/trailer-sources.html',
];
const routes = [...pages.map(p => p.replace(/(^|\/)index\.html$/, '$1')),
  'bar-playtest/?dev=1', 'bar-playtest/?mode=minigames'];
module.exports = {pages, routes};
