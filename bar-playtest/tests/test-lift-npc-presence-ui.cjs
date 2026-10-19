const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.evaluate(() => outsidePlaytest.start());
    const results = await page.evaluate(() => {
      const m = outsidePlaytest.model, R = LunaResidence.layout, results = [];
      function presence() {
        return {
          ambient: LUNA_OUTSIDE_DATA.scenes.street.nodes.filter(n => n.ambient && LunaOutsideAmbient.visible(m, n)).map(n => n.id),
          beggar: LunaOutsideBeggar.visible(m, 'street-beggar'),
          witness: LunaOutsideBeggar.visible(m, 'street-beggar-witness'),
          shop: LunaOutsideShop.visible(m), samho: LunaOutsideSamhoCommute.visible(m),
          trade: LunaOutsideEncounters.tradeVisible(m), contract: LunaOutsideNotion.visibleContract(m)
        };
      }
      for (const day of [0, 1, 2, 3]) for (const flow of ['in', 'out']) {
        m.start({ day, flow, place: 'homeDoor' });
        m.x = R.elevatorX; m.updateNear();
        const upper = presence();
        if (LunaOutsideShop.targets(m).length || LunaOutsideBeggar.targets(m).length) throw Error('Ground targets on upper floor');
        m.interact();
        if(m.ride||m.dialog?.kind!=='elevator')throw Error('Lift must wait for confirmation');
        m.chooseObject('confirm');
        if (!m.ride) throw Error('Lift did not start');
        let frames = 0;
        while (m.ride && frames++ < 400) {
          m.tick(.05);
          if (JSON.stringify(presence()) !== JSON.stringify(upper)) throw Error('NPC popped during lift: ' + day + '/' + flow);
          if (m.encounter || m.story.blocking) throw Error('Street encounter began during lift');
        }
        if (m.level !== 0 || m.ride) throw Error('Lift did not land');
        results.push({ day, flow, frames, upper });
      }
      for (const day of [2, 3]) {
        m.start({ day, flow: 'in', place: 'homeDoor' });
        m.x = day === 3 ? R.elevatorX + 1.45 : -5.99;
        if (!LunaOutsideSamhoCommute.visible(m)) throw Error('Samho absent upstairs');
        if (LunaOutsideSamhoCommute.start(m)) throw Error('Samho started upstairs');
        LunaOutsideSamhoCommute.tick(m, .05);
        if (m.encounter) throw Error('Samho auto-triggered upstairs');
        m.level = 0; m.y = -.7;
        if (!LunaOutsideSamhoCommute.start(m)) throw Error('Samho cannot start on ground');
      }
      m.start({ day: 1, flow: 'in', place: 'homeDoor' });
      m.x = R.elevatorX + 1.45;
      LunaOutsideEncounters.tickProximity(m);
      if (m.backgroundStory.speech) throw Error('Ground passer conversation started upstairs');
      m.level = 0; m.y = -.7;
      LunaOutsideEncounters.tickProximity(m);
      if (!m.backgroundStory.speech) throw Error('Ground conversation did not start');
      return results;
    });
    assert.equal(results.length, 8);
    assert(results.find(r => r.day === 1 && r.flow === 'in').upper.ambient.includes('ambient-commute-pair-left'));
    assert.deepEqual(errors, []);
    console.log('LIFT_NPC_PRESENCE_OK: eight day/route rides, stable NPC presence before/during/after descent, floor-sensitive interactions and events retained');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
