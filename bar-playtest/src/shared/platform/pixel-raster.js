/* Keep gameplay coordinates independent of the displayed bitmap size. */
(function (W) {
  'use strict';
  function fit(ctx, width, height) {
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      let density = W.devicePixelRatio || 1;
      try {
        for (let view = W; view.frameElement; view = view.parent) {
          const frame = view.frameElement;
          if (frame.offsetWidth) density *= frame.getBoundingClientRect().width / frame.offsetWidth;
        }
      } catch {} // A cross-origin host cannot expose its CSS transform.
      const scale = Math.min(rect.width / width * density, rect.height / height * density,
        3840 / width, 2160 / height);
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    }
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  // Give a rotating texel a solid interior. Only its final, subpixel edge is filtered.
  const crops = new WeakMap();
  function draw(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
    const transform = ctx.getTransform();
    const pitch = Math.max(Math.hypot(transform.a, transform.b) * Math.abs(dw / sw),
      Math.hypot(transform.c, transform.d) * Math.abs(dh / sh));
    // Large scenery already has enough pixels. Keep the existing nearest-neighbour
    // treatment for axis-aligned backgrounds, avoiding full-screen intermediates.
    if (sw * sh > 32768 && !transform.b && !transform.c) {
      ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    const zoom = Math.min(pitch > 4.1 ? 8 : pitch > 2.1 ? 4 : pitch > 1.1 ? 2 : 1,
      Math.floor(Math.sqrt(131072 / (sw * sh))));
    let source = image;
    if (zoom > 1) {
      let cache = crops.get(image);
      if (!cache) {
        cache = {frames: new Map(), pixels: 0};
        crops.set(image, cache);
      }
      const frames = cache.frames;
      const key = [sx, sy, sw, sh].join(',');
      let frame = frames.get(key);
      if (!frame || frame.width !== sw * zoom) {
        frame = document.createElement('canvas');
        frame.width = sw * zoom;
        frame.height = sh * zoom;
        const paint = frame.getContext('2d');
        paint.imageSmoothingEnabled = false;
        paint.drawImage(image, sx, sy, sw, sh, 0, 0, frame.width, frame.height);
        const replaced = frames.get(key);
        if (replaced) cache.pixels -= replaced.width * replaced.height;
        frames.delete(key);
        cache.pixels += frame.width * frame.height;
        // A moving camera can visit many frames and scales of a single atlas.
        while (cache.pixels > 1048576 || frames.size >= 64) {
          const [oldKey, oldFrame] = frames.entries().next().value;
          cache.pixels -= oldFrame.width * oldFrame.height;
          frames.delete(oldKey);
        }
        frames.set(key, frame);
      }
      source = frame;
      sx = sy = 0;
      sw = frame.width;
      sh = frame.height;
    }
    const previous = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = previous;
  }
  W.LunaPixelRaster = {fit, draw};
})(window);
