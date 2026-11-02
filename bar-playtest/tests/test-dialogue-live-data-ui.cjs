/* Two real tabs + real save helper on temporary files; never overwrite live CSV. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const {snapshot, save, runtimeSnapshot} = require('../../tools/dialogue-editor-storage.cjs');
const rt = require('../../tools/lib/test-runtime.cjs'), {chromium} = rt.load('playwright');
const origin = process.env.EDITOR_URL || 'http://127.0.0.1:8123';
(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'luna-live-dialogue-'));
  const base = path.join(tmp, 'csv'), runtime = path.join(tmp, 'runtime');
  await fs.cp(path.join(__dirname, '../data/shared-csv'), base, {recursive:true});
  await fs.cp(path.join(__dirname, '../data/runtime'), runtime, {recursive:true, filter:source => !path.extname(source) || ['game-data.js','campaign-data.js'].includes(path.basename(source))});
  const browser = await chromium.launch({headless:true, executablePath:rt.chrome});
  try {
    const context = await browser.newContext(), errors = [];
    let fail = false;
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/api/dialogue-editor', async route => {
      try {
        const value = route.request().method() === 'POST'
          ? await save(route.request().postDataJSON(), {base,runtime,backupRoot:path.join(tmp,'backups')})
          : {...await snapshot(base), token:'test-only', mode:'local-csv'};
        await route.fulfill({json:value});
      } catch (e) { await route.fulfill({status:409,json:{error:e.message}}); }
    });
    await context.route('**/api/dialogue-editor/runtime', async route => {
      await route.fulfill(fail ? {status:500,json:{error:'test failure'}} : {json:await runtimeSnapshot(base)});
    });
    const game = await context.newPage(), editor = await context.newPage();
    await game.goto(origin+'/bar-playtest/index.html?dev=1');
    await game.waitForFunction(() => window.lunaDialogueLiveData?.revision);
    // Campaign owns the table backup; a current scene must remain untouched on save.
    const before = await game.evaluate(() => {
      lunaCampaign.session.install();
      barGame.reset(0,'full',1,false);
      barGame.startStoryPhase('bar');
      barGame.progress.money = 4321;
      window.liveBefore = {steps:barGame.story.steps, index:barGame.story.index, dialogue:barGame.dialogue, progress:JSON.stringify(barGame.progress), revision:lunaDialogueLiveData.revision};
      return window.liveBefore.revision;
    });
    await editor.goto(origin+'/bar-playtest/dialogue-editor.html');
    await editor.waitForFunction(() => window.dialogueEditor?.model);
    await editor.locator('#line-list .line').nth(1).click();
    const field = editor.locator('#inspector textarea[data-field="text.ko"]');
    const id = await editor.evaluate(() => dialogueEditor.model.row(dialogueEditor.selected).web_row_id);
    const text = '로컬 저장 자동 반영 검증 문장.';
    await field.fill(text);
    assert.equal(await game.evaluate(() => lunaDialogueLiveData.revision), before, 'unsaved edits do not update game');
    await editor.click('#review');
    await editor.waitForFunction(() => !document.querySelector('#commit').disabled);
    await editor.click('#commit');
    await editor.waitForFunction(() => !document.querySelector('#review-dialog').open);
    await game.waitForFunction(old => lunaDialogueLiveData.pendingRevision && lunaDialogueLiveData.pendingRevision !== old, before);
    assert(await game.evaluate(() => liveBefore.steps === barGame.story.steps && liveBefore.index === barGame.story.index && liveBefore.dialogue === barGame.dialogue && liveBefore.progress === JSON.stringify(barGame.progress)), 'save does not restart active story or rewards');
    // Next scene gets the new table while retaining progress.
    await game.evaluate(() => { barGame.seats = {L:null,M:null,R:null}; barGame.loadScene(barGame.story.scene); });
    assert.equal(await game.evaluate(id => barGame.story.steps.find(r=>r.row_id===id)['text.ko'], id), text);
    assert.equal(await game.evaluate(() => barGame.progress.money), 4321);
    // Exiting campaign must not restore stale tables. Day tests reset against saved data.
    await game.evaluate(() => { lunaCampaign.session.uninstall(); barGame.reset(0,'full',1,false); barGame.startStoryPhase('bar'); });
    assert.equal(await game.evaluate(id => barGame.story.steps.find(r=>r.row_id===id)['text.ko'], id), text);
    assert.equal(await game.evaluate(() => lunaDialogueLiveData.pendingRevision), '');
    assert.equal(await game.evaluate(() => {
      barGame.paused=false;barGame.hidden=false;
      for(let i=0;i<30;i++)barGame.tick(.1);
      return barGame.dialogue?.text;
    }), text, 'day-test playback actually speaks the saved line');
    const revision = await game.evaluate(() => lunaDialogueLiveData.revision);
    fail = true;
    await game.evaluate(() => lunaDialogueLiveData.refresh());
    assert.equal(await game.evaluate(() => lunaDialogueLiveData.revision), revision);
    assert(await game.evaluate(() => !!lunaDialogueLiveData.error));
    fail = false;
    await game.evaluate(() => lunaDialogueLiveData.refresh());
    assert.equal(await game.evaluate(() => lunaDialogueLiveData.error), '');
    assert.equal(await editor.frameLocator('#preview').locator('body').evaluate(() => window.lunaDialogueLiveData), null, 'preview stays isolated');
    assert.deepEqual(errors, []);
    console.log('DIALOGUE_LIVE_DATA_UI_OK: saved CSV -> open campaign -> next scene -> day test; active progress preserved; failed load retains data.');
  } finally { await browser.close(); await fs.rm(tmp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
