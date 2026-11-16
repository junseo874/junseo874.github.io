/* Each download starts on its first picture, independent of the live preview. */
(function () {
  'use strict';
  const {scenes, total} = window.LunaTrailerSequence;
  const player = document.getElementById('source-player');
  const title = document.getElementById('source-title');
  const download = document.getElementById('source-download');
  const chapters = document.getElementById('chapters');
  const sources = [
    {id: 'full', title: '전체 트레일러', duration: total},
    ...scenes.map((scene, index) => ({
      id: String(index + 1).padStart(2, '0'), title: scene.title, duration: scene.duration
    })),
    {id: 'puddle-clean', title: '물웅덩이 · 무자막', duration: scenes.find(s => s.file === 'seoul-puddle').duration}
  ];
  function select(source) {
    const revision = {full: 7, '01': 6, '02': 7, '29': 6, '30': 6, '27': 5, '25': 4, '23': 3, '03': 6, 'puddle-clean': 2}[source.id];
    const url = 'assets/trailer-sources/' + source.id + '.mp4' + (revision ? '?v=' + revision : '');
    player.src = url;
    player.setAttribute('aria-label', source.title);
    title.textContent = source.title;
    download.href = url;
    download.download = source.id + ' ' + source.title + '.mp4';
    for (const button of chapters.children) {
      button.setAttribute('aria-current', String(button.dataset.id === source.id));
    }
  }
  for (const source of sources) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.id = source.id;
    const length = Math.round(source.duration * 10) / 10;
    button.textContent = source.title + ' · ' + length + '초';
    button.addEventListener('click', () => select(source));
    chapters.append(button);
  }
  select(sources[0]);
})();
