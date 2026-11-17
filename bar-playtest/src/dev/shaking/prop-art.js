// The closed shell and its contents share a local pixel grid and turn as one sprite.
const ShakerArt = (() => {
  const url = new URL('assets/poses/', document.currentScript.src);
  let shared;

  function loadImage(file) {
    const image = new Image();
    image.src = new URL(file, url).href;
    return image.decode().then(() => image);
  }

  function loadBank() {
    if (!shared) {
      shared = Promise.all([
        fetch(new URL('frames.json', url)).then(response => {
          if (!response.ok) throw Error('Missing ice frames');
          return response.json();
        }),
        loadImage('ice.png'), loadImage('../boston-shaker-closed.png'), loadImage('../boston-shaker.png')
      ]).then(([index, ice, shell, parts]) => ({index, ice, shell, parts}))
        .catch(error => { shared = null; throw error; });
    }
    return shared;
  }

  class Surface {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.bank = null;
      this.requested = null;
      this.zoom = 1;
      this.retryAt = 0;
    }
    fit(width, height, pitch) {
      // Keep one integer display pitch for the shell and the contents.
      const nativeZoom = Math.max(1, Math.round(pitch));
      const fit = nativeZoom / pitch;
      const native = fit >= .85 && fit <= 1.08;
      const zoom = native ? nativeZoom : Math.max(1, Math.ceil(pitch));
      const eighths = native ? 8 : Math.max(2, Math.min(8, Math.round(pitch * 8 / zoom)));
      if (!this.bank || this.bank.scale === eighths / 8) this.zoom = zoom;
      if (eighths !== this.requested && performance.now() >= this.retryAt) {
        this.requested = eighths;
        loadBank().then(images => {
          if (this.requested === eighths) this.bank = {...images, scale: eighths / 8};
        }).catch(error => {
          if (this.requested !== eighths) return;
          console.error(error);
          this.requested = null;
          this.retryAt = performance.now() + 1500;
        });
      }
      const w = Math.ceil(width / this.zoom), h = Math.ceil(height / this.zoom);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.imageSmoothingEnabled = false;
    }
    present(target) {
      target.save();
      target.resetTransform();
      target.imageSmoothingEnabled = false;
      target.drawImage(this.canvas, 0, 0, this.canvas.width * this.zoom, this.canvas.height * this.zoom);
      target.restore();
    }
  }

  function stamp(ctx, sheet, rect, x, y) {
    const [sx, sy, w, h] = rect;
    ctx.drawImage(sheet, sx, sy, w, h, Math.round(x) - w / 2, Math.round(y) - h / 2, w, h);
  }

  // Rotate at display resolution, after composing the contents in the shell's own pixels.
  function drawBody(surface, target, x, y, angle, size, offset, alpha, contents) {
    const {bank, ctx, canvas, zoom} = surface;
    const scale = bank.scale * size;
    target.save();
    target.resetTransform();
    target.translate(Math.round(x), Math.round(y));
    target.rotate(angle);
    target.imageSmoothingEnabled = false;
    if (contents) {
      const cx = Math.floor(canvas.width / 2), cy = Math.floor(canvas.height / 2);
      const pivotX = Math.round(188*scale), pivotY = Math.round(48*scale);
      const w = Math.round(bank.shell.width*scale), h = Math.round(bank.shell.height*scale);
      ctx.save();
      ctx.translate(cx, cy);
      // The sheet places the small tin on the right. Seat it on the left while
      // keeping liquid, ice and gravity in the horizontal playfield coordinates.
      ctx.save();ctx.scale(-1,-1);
      ctx.drawImage(bank.shell,-pivotX,-pivotY,w,h);
      ctx.restore();
      contents(ctx, bank, scale / shakerPixel);
      ctx.restore();
      const left=pivotX-w,top=pivotY-h;
      target.drawImage(canvas, cx+left, cy+top, w, h, left*zoom, top*zoom, w*zoom, h*zoom);
    } else {
      // Same source pixels as the closed PNG. Only the small tin moves independently.
      target.scale(-scale*zoom, -scale*zoom);
      target.save();
      target.translate(offset.x / shakerPixel, offset.y / shakerPixel);
      target.rotate(offset.angle);
      target.globalAlpha *= alpha;
      target.drawImage(bank.parts, 0,105,195,87, -9-seatedTinOffset/shakerPixel,-43,195,87);
      target.restore();
      target.drawImage(bank.parts, 0,0,218,96, -188,-48,218,96);
    }
    target.restore();
  }

  function drawIce(ctx, bank, x, y, angle, diameter) {
    const {ice, iceAngles} = bank.index;
    const row = Math.max(0, Math.min(ice.length - 1, Math.round((diameter - ice[0][0]) / 2)));
    const [, cell, top, cols] = ice[row];
    const direction = (Math.round(angle * iceAngles / (2 * Math.PI)) % iceAngles + iceAngles) % iceAngles;
    stamp(ctx, bank.ice, [direction % cols * cell, top + Math.floor(direction / cols) * cell, cell, cell], x, y);
  }

  // Rasterize the six wall vertices by scanline once per display scale. The one-dot rim
  // and the contents clip then share exactly the same boundary, including at the ends.
  const windows = new Map();
  function sightGlass(scale) {
    const key = scale;
    if (windows.has(key)) return windows.get(key);
    const {x0, x1, left, middle, right, seam} = chamber;
    const vertices = [[x0,-left],[seam,-middle],[x1,-right],[x1,right],[seam,middle],[x0,left]]
      .map(([x,y]) => [scale*x, scale*y]);
    const top = Math.floor(Math.min(...vertices.map(v => v[1])));
    const bottom = Math.ceil(Math.max(...vertices.map(v => v[1])));
    const rows = [], outer = new Path2D(), inner = new Path2D();
    for (let y = top; y < bottom; y++) {
      const at = y + .5, hits = [];
      for (let i = 0; i < vertices.length; i++) {
        const [x0,y0] = vertices[i], [x1,y1] = vertices[(i+1) % vertices.length];
        if ((y0 <= at) !== (y1 <= at)) hits.push(x0 + (at-y0)*(x1-x0)/(y1-y0));
      }
      if (hits.length !== 2) continue;
      const l = Math.ceil(Math.min(...hits)-.5), r = Math.ceil(Math.max(...hits)-.5);
      if (l < r) { rows.push([l,r,y]); outer.rect(l,y,r-l,1); }
    }
    for (let i = 1; i < rows.length-1; i++) {
      const [l,r,y] = rows[i];
      const x = Math.max(l+1, rows[i-1][0], rows[i+1][0]);
      const end = Math.min(r-1, rows[i-1][1], rows[i+1][1]);
      if (end > x) inner.rect(x,y,end-x,1);
    }
    const paths = {outer, inner};
    windows.set(key, paths);
    return paths;
  }
  return {Surface, drawBody, drawIce, sightGlass};
})();
