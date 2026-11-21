// Maintained regression inventory. Paths prefixed with @ are repository-wide checks.
// Bare names live in bar-playtest/tests. Keep ordering within each suite stable.
const game = id => 'bar-playtest/tests/' + id + '.cjs';
const group = ids => ids.trim().split(/\s+/).map(id => id.startsWith('@') ? id.slice(1) : game(id));
module.exports = {
  data: group(`
    test-dialogue-live-signals
    test-csv-catalog test-shared-data-projection @tools/build-shared-data.cjs test-dialogue-periods
    test-dialogue-periods-ui test-shared-data-ui
  `),
  smoke: group(`
    test-independent-nodes test-node-preview-routes test-outside-flow-days test-outside-graph-index test-outside-dialogue-editor test-outside-studio
    @tools/check-web-generated-art.cjs @tools/build-generated-ui-css.cjs
    @tools/check-engine-art-sync.cjs @tools/check-art-resource-paths.cjs
    test-shared-birds-and-bar-gates test-day3-notion-script test-latest-story-timings
    test-endless-general test-regular-arrival-speech test-guest-mouth-pairing
    test-guest-random-appearance test-bar-line-actions test-bar-flow-editor test-bar-flow-wiring
    test-bar-day-authoring test-dialogue-editor test-bar-workbench test-outside-choice-authoring
    test-outside-choice-parity test-resource-image-recovery test-bar-room-loading test-notion-daily-dialogue
    @tools/check-structure.cjs @tools/check-site.cjs @tools/check-code-boundaries.cjs
    @tools/test-source-index.cjs @tools/build-preload-manifest.cjs test-kihyun-story
    test-day1-notion-script test-kihyun-story-ui test-tom-talk-ui test-general-offscreen
    test_story_coaster test-empty-glass test-empty-glass-ui test-choice-speech-continuity
    test-approved-rules test-approved-rules-ui test_shiba_shop test-shiba-purchase-flow-ui
    test_day0_tutorial test_resource_missing test-resource-preload-ui test_bd_vendor_removed_ui
    test-bacardi-removed-ui test-long-island-main-excluded-ui test-triple-sec-unified-ui
    test_current_serve_sheets_ui test-resource-preview-paths-ui
  `),
  ui: group(`
    test-window-fullscreen-ui
    test-first-contact-editor-ui test-outside-flow-days-ui test-manual-node-preview-ui test-outside-dialogue-editor-ui test-outside-studio-ui test-outside-workbench-ui
    test-dialogue-live-data-ui test-resource-current-artwork-ui test-story-service-entry-ui
    test-loading-pigeon-ui test-bar-choice-hold-clock test-generated-art-ui
    test-guest-arrival-speech-ui test-guest-appearance-tab-ui test-endless-general-ui
    test-independent-nodes-ui test-guest-random-appearance-ui test-bar-flow-editor-ui test-bar-authoring-studio-ui
    test-line-workspace-ui test-line-edit-navigation-ui test-bar-workbench-ui test-bar-flag-picker-ui test-bar-pin-inspector-ui
    test-bar-node-details-ui test-choice-live-text-ui test-day3-samho-expression-ui
    test-sound-lab-ui test-november-resource-refresh-ui test-bar-qa-dialogue-ui
    test-bar-qa-presets-ui test_profile_resources_ui test-tom-introduction-ui
    test-regular-order-badge-ui test-dialogue-history-ui test-textbox-proportions-ui
    test-choice-corner-animation-ui test-choice-entry-guard-ui test_choice_hold_ui
    test-currency-art-ui test_currency_ui test_currency_audio_ui test-recipe-table-art-ui
    test-recipe-copy-ui test-speech-focus-ui test-capture-mode-ui test_game_viewport_ui
    test_letterbox_ui test_interaction_prompt_ui test-ambient-speech-motion-ui
    test-ambient-speech-size-ui test-exterior-tail-ui test_general_coaster_drag_ui
    test-no-help-corner-ui test_focus_settings_ui test-resource-workspace-ui
    test-resource-cursors-ui test-game-input-guard-ui test-delivery-hitbox-ui
    test-settings-resume-ui test-lift-lock-recipe-escape-ui test-dialogue-native-font-ui
  `),
  outside: group(`
    test-scene-draw-lists test-street-water-grid-ui test-street-reflection-pan-ui test-street-seated-placement-ui test-street-render-budget
    test-street-gpu-surface-ui test-street-effect-composition-ui test-street-buffer-reuse-ui
    test-street-rain-shared-gpu-ui test-rain-merge-equivalence test-engine-world-layout
    test-engine-world-layout-ui test-ambient-native-csv test-home-tv-power-ui
    test-exterior-notion-sync test-outside-believer test-outside-believer-ui test-outside-newspaper
    test-outside-newspaper-ui test-exterior-manual-skip-ui test-outside-character-sheets test-outside-typing-rhythm
    test-outside-typing-rhythm-ui test-shiba-speech-anchor-ui test-corridor-birds-ui test-corridor-pillar-fade-ui
    test-engine-barrel-fire test_barrel_fire_ui test-campfire-lighting-ui test-character-lighting
    test-character-lighting-ui test-character-lighting-isolation-ui test-day2-neighborhood-gates-ui
    test-home-book-ui test-samho-idle-ui test_samho_smuggler_ui test-weather-ambience-matrix-ui test-shiba-cancel-first-ui
    test-home-wardrobe-ui test-home-bed-ui test-home-cat-interaction-ui test_interaction_glow_ui
    test-gang-guard-interaction-ui test-outside-choice-rejection-ui test-outside-discovery-ui
    test-outside-discovery-stability-ui test-outside-npc-animation test-gang-wild-dog
    test-gang-wild-dog-ui test-bubi-box-sequence-ui test-neighborhood-events-ui
    test-neighborhood-staging-ui test-ad-carrier test-ad-carrier-ui test_outside_traffic
    test_outside_traffic_ui test_bd_vendor_removed_ui test_outside_beggar test_outside_beggar_ui
    test_day1_thug_ui test_outside_console_ui test_story_notices test-restoration-notices
    test-restoration-notices-ui test-repair-goal-notice-ui test_ambient_interaction_pause_ui
    test_interaction_prompt_ui test-outside-resize-qa-ui test-object-confirmation-ui
    test_sofa_choices_ui test-outside-render-budget-ui test-character-shadows
    test-character-shadows-ui test-street-atmosphere test-street-atmosphere-ui
    test-street-atmosphere-motion-ui test-street-bloom-continuity-ui test-street-soft-light-ui
    test-street-parallax-engine test-street-parallax-engine-ui test-street-engine-effects
    test-street-engine-effects-ui test-rain-glass-engine test-rain-glass-ui test-home-city-parallax
    test-home-art-ui test-home-weather-ui test_upper_crate_boundary_ui test-lift-npc-presence-ui
    test-lift-passenger-framing-ui test-lift-right-boundary-ui
  `),
  cinema: group(`
    test-serve-grade-preview-ui test-serve-grade-quality-ui test-serve-grade-engine-ui test-serve-grade-ambient
    test-day0-phone-branches-ui test-cinema-typing-rhythm test-cinema-typing-rhythm-ui
    test_intro_text_ui test-johnny-memory-speech-ui test-engine-terrace-layout-ui test-day-quotes-ui
    @cutscene-studio/tests/test-trailer-ui.cjs test-day-resource-transitions-ui
    test-terrace-birds-ui test-tv-skip-ui test-workshop-archive test-review-audit-ui
    test_cutscene_library_ui @cutscene-studio/tests/smoke-test.cjs test-bar-entry-dialogue-ui
    test-terrace-foreground-ui test-terrace-rain-continuity-ui test-terrace-entrance-camera-ui
    test-terrace-pan-stability-ui test_terrace_entry_fade_ui
  `),
  site: group(`
    @tools/check-structure.cjs @tools/check-site.cjs @tools/test-entrypoints.cjs
  `),
  craft: group(`
    test-stir-pixel-ice-ui
    test-stir-key-cues-ui
    test-shaking-main-ui test-shaking-versions-ui test-shaking-directional-impact-ui test-shaking-pose-pixels-ui
    test-pour-finish-lock test-pour-finish-lock-ui test-craft-clock test-craft-clock-ui
    test-wine-practice-ui test-mix-completion test-mix-completion-ui test_current_serve_sheets_ui
    test-serve-return-camera-ui test_serve_fallback_sizes_ui test_serve_carbonation_ui
    test_pixel_pour test_pour_overflow_ui test-pour-input-recovery-ui
    test_minigame_ingredients test_pour_fluid test_pour_default_tool test_ml_stream test_remix test_craft_polish_ui test_day0_tutorial_ui
  `),
};
