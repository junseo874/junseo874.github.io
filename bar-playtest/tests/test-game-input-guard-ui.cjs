const assert = require('node:assert/strict');
const path = require('node:path');
const runtime = require('../../tools/lib/test-runtime.cjs');
const { chromium } = runtime.load('playwright');
const platform = path.resolve(__dirname, '../src/shared/platform');

async function blocked(page, selector, types) {
  const results = await page.locator(selector).first().evaluate((el, types) => types.map(type => {
    const event = type === 'mousedown' ? new MouseEvent(type, { bubbles: true, cancelable: true, button: 1 }) :
      new Event(type, { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }), types);
  assert.deepEqual(results, types.map(() => true), selector + ': ' + types.join(', '));
}

(async () => {
  const browser = await chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8123/bar-playtest/');
    await page.evaluate(() => lunaCampaign.action('title'));
    const logo = page.locator('.title-logo img');
    await logo.waitFor();
    await blocked(page, '.title-logo img', ['dragstart', 'selectstart', 'contextmenu', 'mousedown', 'dragover', 'drop']);
    const box = await logo.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(100, 600, { steps: 12 });
    await page.mouse.up();
    for (const key of ['Control+a', 'Meta+a']) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => String(getSelection())), '');
    }
    await page.locator('[data-campaign="options"]').click();
    await blocked(page, '.ls-brand', ['selectstart', 'contextmenu']);
    const slider = page.locator('[data-setting="bgm"]');
    await slider.fill('40');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await slider.inputValue(), '41', 'native slider keyboard control survives');
    await page.keyboard.press('Escape');
    await page.evaluate(() => lunaCampaign.newGame('A'));
    await page.waitForFunction(() => lunaCampaign.view === 'prologue');
    await blocked(page, '.campaign-prologue', ['contextmenu', 'dragstart', 'drop']);
    await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
    if (await page.locator('.updates-confirm').isVisible()) await page.locator('.updates-confirm').click();
    await page.locator('[data-outside-action="start"]').click();
    await page.waitForFunction(() => outsidePlaytest.active && !outsidePlaytest.loading);
    await blocked(page, '#outside-root canvas', ['contextmenu', 'dragstart', 'selectstart', 'drop']);
    const x = await page.evaluate(() => outsidePlaytest.model.x);
    await page.keyboard.press('Control+a');
    assert.equal(await page.evaluate(() => outsidePlaytest.model.x), x);
    await page.keyboard.press('KeyP');
    const money = await page.evaluate(() => barGame.progress.money);
    await page.locator('[data-outside-action="dev-plus"]').click();
    assert.equal(await page.evaluate(() => barGame.progress.money), money + 1000);
    assert.deepEqual(errors, []);
    await page.close();

    // Independent contract fixtures: fields and scrollable panels are explicit exceptions.
    const fixture = await browser.newPage();
    await fixture.setContent(`<p id="art">Non-selectable game dialogue and UI</p>
      <input id="text" value="editable text"><textarea id="area">editable notes</textarea>
      <div id="rich" contenteditable="true">editable dialogue</div>
      <input id="file" type="file"><a href="#kept">Reference link</a>
      <div id="scroll" style="height:80px;width:180px;overflow:auto"><p style="height:900px">Scrollable settings</p></div>`);
    await fixture.addStyleTag({ path: path.join(platform, 'game-input-guard.css') });
    await fixture.addScriptTag({ path: path.join(platform, 'game-input-guard.js') });
    for (const selector of ['#text', '#area', '#rich']) {
      await fixture.locator(selector).focus();
      await fixture.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
      assert(await fixture.locator(selector).evaluate(el => el.isContentEditable ? String(getSelection()).length > 0 : el.selectionEnd > el.selectionStart), selector + ' retains select-all');
      await fixture.keyboard.insertText('changed');
      assert.equal(await fixture.locator(selector).evaluate(el => el.isContentEditable ? el.textContent : el.value), 'changed');
      assert(await fixture.locator(selector).evaluate(el => ['contextmenu', 'selectstart', 'dragstart', 'drop'].every(type => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })))));
    }
    await fixture.locator('#rich').blur();
    await fixture.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('#art'));
      getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await fixture.waitForFunction(() => getSelection().isCollapsed);
    assert(await fixture.locator('#file').evaluate(el => el.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))));
    assert(await fixture.locator('a').evaluate(el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 1 }))));
    await fixture.locator('#scroll').hover();
    await fixture.mouse.wheel(0, 180);
    await fixture.waitForFunction(() => document.querySelector('#scroll').scrollTop > 0);
    assert.equal(await fixture.locator('body').evaluate(el => getComputedStyle(el).touchAction), 'manipulation');
    await fixture.close();
    console.log('GAME_INPUT_GUARD_OK: title/settings/cutscene/street, native selection/drag/menu/drop/autoscroll blocked; field editing, sliders, buttons, links and panel scrolling preserved');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
