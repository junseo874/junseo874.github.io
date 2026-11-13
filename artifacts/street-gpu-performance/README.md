# Additional street optimization, 2026-11-13

Baseline: `e634a0194255be0cd1fca34d5a0526b475382774`, **after** the earlier character-buffer/steam optimization. These numbers must not be compared with the older, much slower pre-buffer-reuse version.

Changes:

- Opaque main canvas and shader-coordinate Y flip avoid scene upload conversion work.
- Bloom passes its full-resolution RGBA8 result directly to the rain renderer in the same WebGL context, removing the intermediate Canvas2D copy and rain scene upload. Float bloom targets and all optical equations/quality settings remain unchanged.
- Numeric, reusable rain-merge buckets preserve the old candidate order and exact simulation state while reducing temporary allocations.

Run the local server on port 8123. Use the Node executable configured for this repository, and run benchmarks **alone**, after all browser tests finish:

```
STREET_BASELINE_REF=e634a0194255be0cd1fca34d5a0526b475382774 node artifacts/street-gpu-performance/benchmark.cjs
node artifacts/street-gpu-performance/benchmark.cjs
node artifacts/street-gpu-performance/visual-comparison.cjs
```

The benchmark uses real left/right input and model/camera updates, 1280×720 CSS at DPR 2 (2560×1440 render surface), 40 warmup plus 120 measured frames, at native and 4× throttled CPU speed. Rainy storefront, campfire and dry day-2 street are separate cases. `effectGpuMs` sums completed WebGL timer queries per frame across fog, puddles, character shadows, bloom and rain; it excludes base Canvas2D sprite drawing and is **not total frame time**. `cpu` is synchronous update/draw submission time; `frame` includes browser pacing. CPU throttling is not a physical low-end GPU simulation. No resolution, light-count, animation-rate or shader-strength overrides are used.

Visual verification compares fully warmed original/new renderers at four fixed scene positions. See `visual-comparison.json` and the PNG captures. The optical regression separately compares the shared and standalone composition pipelines at three resolutions, with maximum permitted channel rounding of 1/255 (first fractional-scale resize frame). All 7,200 simulation states/uploads in the merge regression are identical.

## Measured results

Development machine: Apple M4 Pro, 24 GiB RAM, macOS 26.2, headless Chromium. Baseline/new runs were isolated from all browser test suites. `*-run1.json` contains native and 4× CPU runs; `*-run2.json` repeats native runs in reverse comparison order. `*-cpu8.json` uses 8× CPU throttling **without GPU timer instrumentation**.

At native speed, the two wet cases used 5–10% less synchronous CPU time across both runs. At 4× CPU throttling the wet storefront/camp reductions were 6%/13%. The stronger 8× CPU test produced:

| Moving scene | CPU before → after (ms/frame) | Delivered FPS before → after |
| --- | --- | --- |
| shops | 20.10 → 18.37 | 38.5 → 40.5 |
| camp | 21.61 → 19.58 | 36.5 → 38.9 |
| dry | 13.44 → 13.74 | 51.8 → 50.0 |

The dry case has no rain pass to eliminate and showed no repeatable CPU benefit (small regressions within run variation); this is not a universal improvement claim. Native/4× runs were already paced at approximately 60 FPS. GPU timing changed substantially between repeat runs, including regressions, so the initial storefront 8.81 → 6.93 ms observation is **not** presented as a stable overall GPU improvement percentage. Texture-transfer instrumentation consistently showed 120 → 0 full-size rain scene uploads over 120 frames; six earlier atmosphere scene uploads per frame remain. This is a further incremental optimization, not proof of smooth play on every low-end GPU.

Validation: smoke 43/43; outside 72/80. The same eight previously failing checks remain: corridor bird coordinates, engine ProjectSettings hash, campfire old anchor, NPC unit fixture dependency, arrival-camera/parallax expectation, home rain sample, upper crate boundary and lift boundary clearance. Their expectations were not relaxed. See `verification.json`. The final shared-GPU optical/lifecycle test, terrace rain continuity and street effect composition were also run separately after the final changes. Four warmed visual comparisons have zero changed pixels. The synthetic optical test has a maximum difference of 1/255 on one fractional-scale resize frame. The simulation oracle matches 7,200 states/uploads exactly.
