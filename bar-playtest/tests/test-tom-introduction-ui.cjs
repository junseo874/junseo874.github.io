const assert = require('node:assert/strict'), runtime = require('../../tools/lib/test-runtime.cjs');
(async () => {
  const browser = await runtime.load('playwright').chromium.launch({executablePath: runtime.chrome, headless: true, args: ['--mute-audio']});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    await page.locator('.updates-confirm').click();
    await page.evaluate(() => {LunaFocusSettings.setEnabled(false); barGame.tick = () => {};});
    for (const developer of [false, true]) {
      await page.evaluate(developer => {
        const c = lunaCampaign, g = barGame;
        c.session.uninstall(); c.session.install({developer});
        g.reset(1, 'practice', 1, true); g.phase = 'regular'; g.screen = 'bar';
        g.tutorial = null; g.overlay = null; g.dialogue = null; g.choice = null;
        g.cameraMoving = false; g.cameraLeft = 0; g.transition = 0; g.pendingTransition = null;
        g.seats = {L: null, M: null, R: null}; g.currentOrder = null;
        delete g.progress.flags.tom_met; delete g.progress.flags.tom_name_known;
        delete g.progress.flags.tom_introduction_notified;
        const rows = g.t.steps.filter(s => s.context === 'campaign_d1_bar');
        const enter = rows.find(s => s.type === 'enter' && s.actor === 'tom');
        const lines = [74, 75, 76, 77, 78].map(i => rows.find(s => s.dialogue_id === 'campaign_d1_bar_' + i));
        if (!enter || lines.some(s => !s)) throw Error('Missing actual CSV Tom introduction rows');
        g.story = {scene: {id: 'campaign_d1_bar'}, steps: [{...enter, entrance: 'seated'}, ...lines], index: 0, autos: [], cursor: 0};
        LunaStoryNotices.clear(); c.screen(c.playView); g.pump(); g.changed();
      }, developer);
      assert(await page.evaluate(() => barGame.progress.flags.tom_met), 'encounter/profile record remains');
      for (const id of [74, 75, 76]) {
        assert.equal(await page.evaluate(() => barGame.dialogue.id), 'campaign_d1_bar_' + id);
        assert.equal(await page.evaluate(() => LunaStoryNotices.pending.filter(e => e.actor === 'tom' && e.kind === 'meet').length), 0, 'no early name notification');
        await page.evaluate(() => {const g = barGame; g.dialogue.chars = g.dialogue.text.length; g.advance(); g.changed();});
      }
      assert.match(await page.evaluate(() => barGame.dialogue.text), /톰이라고\. 톰 거너\. 내 이름이야/);
      assert.equal(await page.evaluate(() => barGame.dialogue.chars), 0, 'announce when line begins, not after advancing');
      const notice = page.locator('.story-notice-people[data-kind="meet"][data-actor="tom"]');
      await notice.waitFor({state: 'visible'});
      assert.equal(await notice.locator('small').textContent(), '새로운 인물!');
      assert.equal(await notice.locator('strong').textContent(), await page.evaluate(() => barGame.name('tom')));
      assert.equal(await page.evaluate(() => LunaStoryNotices.pending.filter(e => e.actor === 'tom' && e.kind === 'meet').length), 1);
      assert(await page.evaluate(() => barGame.progress.flags.tom_name_known));
      await page.evaluate(() => {
        const g = barGame; LunaStoryNotices.clear();
        g.progress = JSON.parse(JSON.stringify(g.progress));
        g.dialogue = null; g.pump(); g.changed();
      });
      assert.equal(await page.evaluate(() => LunaStoryNotices.pending.length), 0, 'redraw/re-enter/copied progress cannot repeat announcement');
    }
    assert.deepEqual(errors, []);
    console.log('PASS main/developer: actual CSV entrance and earlier name stay silent; full introduction announces on line start once; encounter/name flags and copied progress preserved');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
