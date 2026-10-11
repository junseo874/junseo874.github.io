const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1080 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/cutscene-studio/');
    await page.waitForFunction(() => cutsceneStudio.ready);
    // The preview link must leave the existing editor draft intact.
    const previous = await page.evaluate(() => {
      const saved = JSON.stringify(cutsceneStudio.project);
      localStorage.setItem('unknown-cutscene-studio-v1', saved);
      return saved;
    });
    await page.goto('http://127.0.0.1:8123/cutscene-studio/?template=opening');
    await page.waitForFunction(() => cutsceneStudio.ready);
    const result = await page.evaluate(() => {
      const p = cutsceneStudio.project;
      StudioModel.validate(p);
      const lines = p.clips.filter(c => c.type === 'dialogue');
      const interrupt = p.clips.find(c => c.track === 'interruption');
      const beneath = lines.find(c => c.overlay);
      const home = p.clips.find(c => c.actor === 'house');
      const zoom = p.clips.find(c => c.title.startsWith('TV →'));
      return {
        template: p.template, duration: p.duration, issues: StudioModel.issues(p),
        tv: lines.filter(c => c.track === 'tv-lines').map(c => c.text), sourceTV: StudioOpening.source.tv,
        allLines: lines.length, sourceCount: StudioOpening.source.dream.length + StudioOpening.source.tv.length + StudioOpening.source.phone.length,
        overlap: interrupt.start < beneath.start + beneath.duration && interrupt.start > beneath.start,
        sameRoom: home.start < zoom.start && home.start + home.duration > zoom.start + zoom.duration,
        assetsLoaded: [...new Set(p.clips.filter(c => c.type === 'visual').map(c => c.assetId))].every(id => {
          const a = StudioMedia.assets.get(id);
          const im = a.sheet ? Sprites.get(a.sheet).img : StudioMedia.getImage(id);
          return im.complete && im.naturalWidth > 0;
        }),
        chapters: p.chapters,
        samples: [0, ...p.clips.flatMap(c => [c.start + .001, c.start + c.duration - .001]), p.duration].every(t => {
          const s = StudioModel.sample(p, t);
          return [s.camera.x, s.camera.y, s.camera.w].every(Number.isFinite);
        })
      };
    });
    assert.equal(result.template, 'opening');
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.tv, result.sourceTV);
    assert.equal(result.allLines, result.sourceCount);
    assert.ok(result.overlap && result.sameRoom && result.assetsLoaded && result.samples);
    await page.locator('#guides').uncheck();
    for (const [i, chapter] of result.chapters.entries()) {
      await page.locator('[data-chapter="' + chapter.time + '"]').click();
      assert.ok(Math.abs(await page.evaluate(() => cutsceneStudio.time) - chapter.time) < .001);
      await page.evaluate(t => cutsceneStudio.seek(t), chapter.time + (i === 2 ? 9 : 2));
      await page.screenshot({ path: path.join(os.tmpdir(), 'opening-studio-' + i + '.png') });
    }
    // Ordinary dialogue creation must bind a valid actor in this new template too.
    await page.evaluate(() => { cutsceneStudio.select(null); cutsceneStudio.add('dialogue'); StudioModel.validate(cutsceneStudio.project); });
    await page.locator('#undo').click();
    await page.evaluate(() => cutsceneStudio.seek(2));
    await page.locator('#play').click();
    await page.waitForTimeout(1000);
    assert.ok(await page.evaluate(() => cutsceneStudio.time > 2.4));
    assert.ok(await page.evaluate(() => StudioMedia.activeVoices > 0));
    await page.locator('#play').click();
    const saved = await page.evaluate(() => JSON.stringify(cutsceneStudio.project));
    await page.locator('#file').setInputFiles({name:'opening-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(saved)});
    await page.locator('#confirm-replace').click();
    assert.equal(await page.evaluate(() => JSON.stringify(cutsceneStudio.project)), saved);
    await page.reload();
    await page.waitForFunction(() => cutsceneStudio.ready);
    assert.equal(await page.evaluate(() => cutsceneStudio.project.template), 'opening');
    assert.equal(await page.evaluate(() => localStorage.getItem('unknown-cutscene-studio-v1')), previous);
    assert.deepEqual(errors, []);
    console.log('Opening passed:', result.allLines, 'dialogue clips;', result.duration, 'seconds; assets, overlap, chapters, audio, JSON and isolated save verified.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
