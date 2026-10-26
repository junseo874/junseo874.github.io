# Street atmosphere: engine comparison and web implementation

Reference recordings supplied 2026-10-26: `2026-10-26 04-46-09.mp4` (12.5 seconds) and `2026-10-26 04-22-45.mp4` (11.416 seconds). Both show Unity's OutSide scene: elevator → street → shops. Inspected four frames per video across the movement. The pools reflect the fence, poles and lit background; they do not translate with the player. Rings are short lived and flattened vertically. Distant buildings receive more haze than the opaque shops. Bloom spreads around signs and bright gaps, without blurring all sprite edges.

## Authoritative settings

Read-only importer: `bar-playtest/tools/import-street-atmosphere.cjs [--write] [--engine=...]`. It exports only environment settings to `data/presentation/street-atmosphere.js`; no engine assets or source art are modified. Source hashes record the scene, volume and shaders. Default shader values differ substantially from the actual scene, so use scene overrides:

- Nine pools, four procedural outlines; their world coordinates and sizes come from `OutSide.unity`.
- Reflection horizon −0.86, compression 0.667, opacity 0.525, 90 PPU, irregular edge strength 1, distortion 0.7 pixels, ripple brightness 0.45, radius 0.15 units. Pool 3 emits 3 impacts/sec; the others emit 5. Sixteen slots, lifetime 1.25 seconds; no accumulated surface history.
- `SH_OutsidePuddle`: quantized native-pixel mask; elliptical expanding rings with y-distance ×2.7; secondary rings, trough and brief impact flash; four vertically averaged reflection taps; reflection coordinates clamped above the wall baseline; screen-edge fade. Foreground poles/rails/cabin front are added to the reflection capture separately, before they later occlude the player normally.
- Three `BackgroundFog` components: density 0.70/0.55/0.35, height 7/6/4.5, falloff 0.7/0.8/1. Ground −0.9. Two drifting value-noise octaves, scale 2.5, strength 0.45, speed 0.12, PPU 100. Horizontal span follows each authored target and its current parallax position.
- One `LightShaft`: mesh from the authored Light2D shape, length 1.15, width 0.9, intensity 0.3. Ported edge/body fade, gently moving rays, dust and small flicker. It is captured in puddles.
- `VP_OutSide`: Bloom threshold 0.75, intensity 1.4, scatter 0.75. Chromatic aberration, split toning, tone mapping and shadow/midtone grading are inactive. Do not enable them merely because their serialized values exist. Window rain runs **after** postprocessing in `WindowRainFeature`.

## Web rendering contract

`street-atmosphere-renderer.js` owns reusable WebGL2 programs/textures. `street-atmosphere.js` owns bounded per-model impacts and render ordering. Integration is limited to three calls in `outside.js`. The old web layer indices are preserved: fog enters at 2/3/4, ground surfaces at 9 before actors, foreground still covers actors normally. The player’s current animation is projected into the reflection capture at its visible foot plane. Interaction outlines and DOM speech UI are not captured. The final bloom precedes lens droplets, discovery markers and transition fades. The previous arbitrary top/bottom screen-darkening gradient is retained indoors only; the engine street volume has no active vignette.

Reflection/fog compositing and bloom operate in linear color, then return to sRGB. Presentation matches the physical canvas dimensions on resize/DPR changes. Shader masks stay on world/native-pixel grids. Paused/repeated draws do not advance impacts; rain stopping lets existing rings expire, and a restarted scene clock resets them. Persistent pools match the engine even when rain is off.

### Deliberate browser adaptations

This is a shader-equation port, not a claim of bit-identical URP rendering. Canvas scene color is LDR: Unity HDR Light2D buffers cannot be recovered from PNGs. Existing authored sign/light overlays remain; bloom uses a bounded separable multiscale blur with the exported threshold/gain/scatter. The original scene remains sharp. Fog's unavailable ShapeLight texture is approximated by restrained local scene-light pickup. The shaft uses the same four mesh corners; its small subdivision/perspective differences are immaterial in an orthographic view. A deterministic browser hash seeds impacts (same distribution and rates, not the identical .NET random sequence). Existing lens-water simulation is unchanged.

CharacterSpriteLighting/OutsideCharacterShadow/OutsideGroundReceiver were also inspected. Those are actor/ground-lighting systems, not postprocessing. This environment pass does not replace character materials or introduce fabricated screen shadows; the player reflection reuses the current sprite frame. Existing street light-cookie/wall-light and CRT/fan/sign animation ports are retained.

## Verification

`test-street-atmosphere.cjs`: 30 seconds of bounded impacts, camera independence, pause, stop/resume and scene reset.

`test-street-atmosphere-ui.cjs`: GPU compilation and GL status; a synthetic red/blue scene proves the reflection samples the correct live area rather than a static texture; pixels outside the pool stay unchanged; bloom preserves distant dark pixels. Captures five street locations plus a resized view. Included in the `outside` suite.

Local headless Chrome sampling (40 draws, 1280×720): median main-thread draw submission was approximately 2.0 ms with these passes versus 1.7 ms without. This is a local CPU timing comparison, not a cross-device FPS guarantee.

Completed validation: smoke 16/16 and outside 48/48 passed, including the new two atmosphere tests. Structure/site checks and read-only engine snapshot comparison passed. Five street captures and the 800×600 letterboxed view were visually inspected. No engine/source-art files were changed.


## Movement stability and player reflection follow-up

Reproduced a bloom sampling defect with a stationary 3-pixel white light translated in one-pixel steps: the old quarter-resolution single-tap extractor returned alternating energies `[0, 0, 2980, 2980, 0, 0, 2980, 2980]`. This was light undersampling, not a fog simulation reset. Thresholding/linear-color extraction now covers the 4×4 source footprint before reduction; target dimensions track physical viewport size. Intermediate bloom buffers use RGBA16F where supported (8-bit fallback), avoiding repeated low-energy quantization/banding. Blur radii retain the same logical-screen spread on resize. Tests at widths 800/1280/1920 in both directions measured under 0.05% energy variation on the float path, with no dropped light.

Player reflections reuse the same idle/walk/run frame index and facing as the visible actor. The idle sprite’s cached opaque bounds define the stable sole baseline (rather than the transparent cell bottom); run-frame foot lifts do not move the water plane. Capture reprojection foreshortens the actor by 0.22, at 0.82 capture opacity, then applies the existing water tint, mask and ripple displacement. Foreground poles/rails are painted after the reflected actor, preserving occlusion. Capture is refreshed per distinct reflection plane; upstairs and travelling elevator passengers are excluded. Elevator foreground reflection now uses the actual `elevatorY` property.

`test-street-atmosphere-motion-ui.cjs` covers moving horizontal/vertical light sources at three sizes; live player idle/walk/run/turn, deterministic paused frames, pool-boundary clipping, and upstairs/elevator exclusion. Real game screenshots also compare idle, walking and running over a pool. This test is in the `outside` suite.

Follow-up validation: smoke 16/16 and outside 49/49 passed. Three motion-test viewport sizes, real idle/walk/run captures and both sides of the joined pool were inspected; no pool-mask leaks or GPU errors. Structure/site and the engine settings snapshot still pass.
