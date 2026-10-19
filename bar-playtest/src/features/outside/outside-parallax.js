/* Port of PixelPerfectParallax.cs / OutSide.unity (2026-10-19).
   Component 828715987, movementTarget 398070675 = Luna, Assets PPU 100,
   moveY=false, teleportDistance=1. The unassigned 0.9 layer does NOT move Sky.
   Transform targets: 1319968554 (.2), 11317596 (.5), 692369227 (.05).
   This is player-delta accumulation, not a camera/zoom/depth approximation. */
(function (W) {
  'use strict';
  const layers = Object.freeze({
    C_Middle_Building_1: .2,
    C_Middle_Building_2: .5,
    C_Middle_Building_3: .05
  });
  // These sprites are children of Building_3 in the current engine scene.
  // The older flattened web export has both their parent and local positions wrong.
  const children = Object.freeze({
    C_Middle_Object_1: Object.freeze({ parent: 'C_Middle_Building_3', x: .94, y: 3.57 }),
    C_Middle_Object_2: Object.freeze({ parent: 'C_Middle_Building_3', x: 1.545, y: 3.11 })
  });
  const states = new WeakMap();
  const isStreet = model => model?.scene === 'street' && !model.qa;
  // Scripted arrival/encounters own the camera. Auto-walking must not scroll
  // scenery behind that framing; ordinary walking at a camera clamp still can.
  const cinematic = model => !!(model.barArrival || model.transition?.barArrival || model.encounter);
  // Unity Mathf.Round uses even rounding at exact half-pixels.
  function snap(value) {
    const pixel = value * 100, lower = Math.floor(pixel);
    return (Math.abs(pixel - lower - .5) < 1e-9 ? lower + (Math.abs(lower) % 2) : Math.round(pixel)) / 100;
  }
  function create(nodes) {
    const groups = new Map();
    for (const [name, ratio] of Object.entries(layers)) {
      const node = nodes.find(n => n.name === name);
      if (node) groups.set(name, { node, ratio, accumulatedX: node.x, x: snap(node.x) });
    }
    let previousX = null, skip = false, wasCinematic = false;
    return {
      update(model) {
        if (!isStreet(model)) { previousX = null; wasCinematic = false; return; }
        const locked = cinematic(model);
        let delta = previousX === null ? 0 : model.x - previousX;
        previousX = model.x;
        // Vertical lift travel is discarded BEFORE teleport detection, as in Unity.
        // Also discard the release frame: model.tick can complete its last
        // auto-walk step AND clear the cutscene before the renderer sees it.
        // previousX keeps tracking while locked, so nothing catches up later.
        if (locked || wasCinematic || skip || Math.abs(delta) > 1) delta = 0;
        wasCinematic = locked;
        skip = false;
        for (const group of groups.values()) {
          group.accumulatedX += delta * group.ratio;
          group.x = snap(group.accumulatedX);
        }
      },
      notifyTeleport() { skip = true; },
      position(node) {
        const child = children[node.name];
        const group = groups.get(child?.parent || node.name);
        if (!group || node.ambient) return { x: node.x, y: node.y };
        return { x: group.x + (child?.x || 0), y: group.node.y + (child?.y || 0) };
      }
    };
  }
  function update(model, nodes) {
    let state = states.get(model);
    // start()/day/QA resets replace story. Never carry offsets into a new run.
    if (!state || state.run !== model.story) {
      state = { run: model.story, renderer: create(nodes) };
      states.set(model, state);
    }
    state.renderer.update(model);
  }
  W.LunaStreetParallax = Object.freeze({
    layers, children, create, update,
    notifyTeleport: model => states.get(model)?.renderer.notifyTeleport(),
    position: (node, model) => isStreet(model) && states.has(model)
      ? states.get(model).renderer.position(node) : { x: node.x, y: node.y }
  });
})(typeof window === 'undefined' ? globalThis : window);
