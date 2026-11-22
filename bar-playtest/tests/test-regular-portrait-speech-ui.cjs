const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');

(async () => {
  const browser = await runtime.load('playwright').chromium.launch({executablePath: runtime.chrome});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    const cases = [
      ['shiba', 'default', 4], ['haru', 'default', 4], ['chris', 'default', 4],
      ['aili', 'default', 4], ['tom', 'default', 4], ['bubi', 'default', 8],
      ['samho', 'default', 4], ['samho', 'drunk', 4], ['port', 'default', 4],
      ['port', 'serious', 4], ['port', 'success', 4], ['port', 'fail', 4],
      ['haru', 'fail', 1], ['haru', 'success', 1]
    ];
    // Use real script rows through the story player as well as the isolated cutscene view.
    for (const actor of [...new Set(cases.map(([id]) => id))]) {
      await page.evaluate(actor => {
        const g = barGame;
        lunaCampaign.screen('developer');
        g.reset(2, 'regular', 42, false);
        const row = g.t.steps.find(r => r.type === 'say' && r.actor === actor && r.arg === 'default');
        Object.assign(g, {screen:'bar', phase:'regular', transition:0, dialogue:null, choice:null,
          overlay:null, tutorial:null, cameraMoving:false, cameraLeft:0, speed:0});
        g.seats = {L:{actor, id:actor, seated:true, state:'STORY', expression:'default'}, M:null, R:null};
        g.story = {scene:{id:row.context}, steps:[row], index:0};
        g.tick = () => {};
        g.pump();
        lunaCampaign.render(true);
      }, actor);
      const actorView = page.locator('.regular-plane .actor[data-actor="' + actor + '"]');
      await actorView.locator('[data-layer*="_talk_face_bottom"]').waitFor({state:'visible'});
      if (actor === 'bubi') {
        const frames = await actorView.evaluate(el => {
          const read = () => el.querySelector('[data-layer*="_talk_face_bottom"]').dataset.frame;
          const start = read();
          barGame.dialogue.chars = 1;
          lunaCampaign.render(true);
          const spoken = read();
          barGame.dialogue.chars = 0;
          return [start, spoken];
        });
        assert.notEqual(frames[0], frames[1], 'the first syllable of 야옹. visibly articulates');
      }
      const count = await actorView.evaluate(el => {
        const frames = new Set();
        for (let i = 0; i < 24; i++) {
          barGame.realTime += .055;
          lunaCampaign.render(true);
          frames.add(el.querySelector('[data-layer*="_talk_face_bottom"]').dataset.frame);
        }
        barGame.dialogue.chars = barGame.dialogue.text.length;
        lunaCampaign.render(true);
        return frames.size;
      });
      assert.equal(count, actor === 'bubi' ? 8 : 4, actor);
      await actorView.locator('[data-layer*="_talk_face_bottom"]').waitFor({state:'detached'});
    }
    await page.evaluate(cases => {
      const rows = cases.map(([actor, arg]) => {
        const line = barData.tables.steps.find(r => r.type === 'say' && r.actor === actor);
        return {actor, arg, text: line['text.ko']};
      });
      // Advance the real presentation clock explicitly so slow CI frames cannot skip a mouth cell.
      lunaCampaign.scene(rows, '단골 대화', 'bar', () => lunaCampaign.developer());
      lunaCampaign.tick = () => true;
    }, cases);
    for (const [actor, expression, frames] of cases) {
      const mouth = page.locator('.campaign-portrait .actor-layer').filter({visible: true});
      const expected = frames === 1 ? 'char_haru_' + expression
        : expression === 'drunk' ? 'char_samho_drink_face_bottom'
        : actor === 'port' ? 'char_port_port_' + ({success:'joy', fail:'anger', default:'idle'}[expression] || expression) + '_talk_face_bottom_talk'
        : null;
      const selector = expected ? '[data-layer="' + expected + '"]' : '[data-layer*="_talk_face_bottom"]';
      await page.waitForFunction(selector => {
        lunaCampaign.paintLine();
        return document.querySelector('.campaign-portrait ' + selector);
      }, selector);
      assert(await mouth.count() > 0);
      const seen = await page.evaluate(selector => {
        const c = lunaCampaign, seen = new Set();
        for (let i = 0; i < 24; i++) {
          c.dialog.portraitStage.model.realTime += .055;
          c.paintLine();
          const part = c.host.querySelector('.campaign-portrait ' + selector);
          seen.add(part.dataset.frame);
        }
        return [...seen];
      }, selector);
      assert.equal(seen.length, frames, actor + '/' + expression);
      await page.locator('.campaign-speech').click();
      if (frames > 1) await page.waitForFunction(selector => {
        lunaCampaign.paintLine();
        return !document.querySelector('.campaign-portrait ' + selector);
      }, selector);
      await page.locator('.campaign-speech').click();
    }
    assert.deepEqual(errors, []);
    console.log('REGULAR_PORTRAIT_SPEECH_OK: eight regulars, all speech cells, handoffs and authored static reactions.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
