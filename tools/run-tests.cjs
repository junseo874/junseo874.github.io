const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const game = name => 'bar-playtest/tests/' + name + '.cjs';
const suites = {
  data: ['bar-playtest/tests/test-csv-catalog.cjs', 'bar-playtest/tests/test-shared-data-projection.cjs', 'tools/build-shared-data.cjs', 'bar-playtest/tests/test-shared-data-ui.cjs'],
  smoke: ['tools/check-structure.cjs', 'tools/check-site.cjs', 'tools/build-preload-manifest.cjs', ...[
    'test_shiba_shop', 'test_day0_tutorial', 'test_resource_missing', 'test-resource-preload-ui',
    'test_bd_vendor_removed_ui', 'test-bacardi-removed-ui', 'test_current_serve_sheets_ui', 'test-resource-preview-paths-ui'
  ].map(game)],
  ui: ['test-choice-entry-guard-ui', 'test_choice_hold_ui', 'test-currency-art-ui', 'test_currency_ui', 'test_currency_audio_ui', 'test-recipe-table-art-ui', 'test-speech-focus-ui', 'test-capture-mode-ui', 'test_game_viewport_ui', 'test_letterbox_ui', 'test_interaction_prompt_ui',
    'test_general_coaster_drag_ui', 'test_focus_settings_ui', 'test-resource-workspace-ui',
    'test-resource-cursors-ui', 'test-game-input-guard-ui', 'test-delivery-hitbox-ui', 'test-settings-resume-ui', 'test-lift-lock-recipe-escape-ui'].map(game),
  outside: ['test-samho-idle-ui', 'test-weather-ambience-matrix-ui', 'test-shiba-cancel-first-ui', 'test-home-wardrobe-ui', 'test-home-bed-ui', 'test-home-cat-interaction-ui', 'test-gang-guard-interaction-ui', 'test-outside-choice-rejection-ui', 'test-outside-discovery-ui', 'test-outside-discovery-stability-ui', 'test-outside-npc-animation', 'test-gang-wild-dog', 'test-gang-wild-dog-ui', 'test-neighborhood-events-ui', 'test-neighborhood-staging-ui', 'test-ad-carrier', 'test-ad-carrier-ui', 'test_outside_traffic', 'test_outside_traffic_ui', 'test_bd_vendor_removed_ui', 'test_outside_beggar', 'test_outside_beggar_ui', 'test_day1_thug_ui', 'test_outside_console_ui',
    'test_ambient_interaction_pause_ui', 'test_interaction_prompt_ui', 'test-outside-resize-qa-ui', 'test-object-confirmation-ui', 'test_sofa_choices_ui',
    'test-street-parallax-engine', 'test-street-parallax-engine-ui', 'test-street-engine-effects', 'test-street-engine-effects-ui', 'test-rain-glass-engine', 'test-rain-glass-ui', 'test-home-city-parallax', 'test-home-art-ui', 'test-home-weather-ui', 'test_upper_crate_boundary_ui', 'test-lift-npc-presence-ui', 'test-lift-right-boundary-ui'].map(game),
  cinema: ['bar-playtest/tests/test_cutscene_library_ui.cjs', 'cutscene-studio/tests/smoke-test.cjs', game('test-bar-entry-dialogue-ui'), game('test-terrace-foreground-ui'), game('test-terrace-rain-continuity-ui'), game('test-terrace-entrance-camera-ui'), game('test-terrace-pan-stability-ui'), game('test_terrace_entry_fade_ui')],
  site: ['tools/check-structure.cjs', 'tools/check-site.cjs', 'tools/test-entrypoints.cjs'],
  craft: ['test-craft-clock', 'test-craft-clock-ui', 'test-wine-practice-ui', 'test-mix-completion', 'test-mix-completion-ui', 'test_current_serve_sheets_ui', 'test-serve-return-camera-ui', 'test_serve_fallback_sizes_ui',
    'test_serve_carbonation_ui', 'test_pixel_pour', 'test_pour_overflow_ui', 'test-pour-input-recovery-ui'].map(game),
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
