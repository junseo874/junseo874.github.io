const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const game = name => 'bar-playtest/tests/' + name + '.cjs';
const suites = {
  smoke: ['tools/check-structure.cjs', 'tools/check-site.cjs', ...[
    'test_shiba_shop', 'test_day0_tutorial', 'test_resource_missing',
    'test_bd_vendor_removed_ui', 'test_current_serve_sheets_ui', 'test-resource-preview-paths-ui'
  ].map(game)],
  ui: ['test_game_viewport_ui', 'test_letterbox_ui', 'test_interaction_prompt_ui',
    'test_general_coaster_drag_ui', 'test_focus_settings_ui', 'test-resource-workspace-ui',
    'test-game-input-guard-ui', 'test-delivery-hitbox-ui', 'test-settings-resume-ui'].map(game),
  outside: ['test_bd_vendor_removed_ui', 'test_day1_thug_ui', 'test_outside_console_ui',
    'test_ambient_interaction_pause_ui', 'test_interaction_prompt_ui', 'test-outside-resize-qa-ui',
    'test-street-parallax-engine', 'test-street-parallax-engine-ui'].map(game),
  cinema: ['bar-playtest/tests/test_cutscene_library_ui.cjs', 'cutscene-studio/tests/smoke-test.cjs'],
  site: ['tools/check-structure.cjs', 'tools/check-site.cjs', 'tools/test-entrypoints.cjs'],
  craft: ['test-mix-completion', 'test-mix-completion-ui', 'test_current_serve_sheets_ui', 'test_serve_fallback_sizes_ui',
    'test_serve_carbonation_ui', 'test_pixel_pour', 'test_pour_overflow_ui'].map(game),
};
const choice = process.argv[2] || 'smoke';
if (choice === '--list') {
  for (const [name, files] of Object.entries(suites)) console.log(name + '\n  ' + files.join('\n  '));
  process.exit();
}
const files = suites[choice] || (fs.existsSync(path.resolve(root, choice)) ? [choice] : null);
if (!files) throw Error('Unknown suite. Use node tools/run-tests.cjs --list');
const results = [];
(async () => {
  for (const file of files) {
    const start = Date.now();
    console.log('\nRUN ' + file);
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, [file], { cwd: root, env: process.env, stdio: 'inherit' });
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 300000);
      child.on('error', error => { clearTimeout(timeout); resolve({ code: 1, error: error.message }); });
      child.on('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, timedOut }); });
    });
    results.push({ file, ...result, seconds: Math.round((Date.now() - start) / 1000) });
  }
  console.log('\n' + JSON.stringify(results, null, 2));
  process.exitCode = results.some(r => r.code !== 0) ? 1 : 0;
})();
