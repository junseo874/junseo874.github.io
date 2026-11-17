const assert = require('node:assert/strict');
const runtime = require('../../tools/lib/test-runtime.cjs');
const sharp = runtime.load('sharp');
const url = new URL('src/dev/shaking/version-2.html', process.env.LUNA_TEST_URL || 'http://127.0.0.1:8123/bar-playtest/').href;

async function captureStroke(page, scene, key) {
  await scene.waitForFunction(k=>readyShakeKey(GT)===k,key);
  const cue=await scene.evaluate(k=>keyPosition(k),key);
  await page.keyboard.press('Key' + key);
  await scene.waitForFunction(k => S.kickKey===k && !S.strokeMoving, key);
  return scene.evaluate(({key,cue}) => {
    const brush = gameGrid.ctx, original = brush.drawImage, bank = gameGrid.bank;
    const calls = [], rotations = [], rotate = ctx.rotate;
    const present=ctx.drawImage,stage=ctx.getTransform();let rim;
    ctx.drawImage=function(sheet,...rect){
      if(sheet===gameGrid.canvas && key!=='A'){
        const [,,,,x,y,w,h]=rect;
        const point=new DOMPoint(x+w,y+h*(key==='E'?14:82)/96)
          .matrixTransform(this.getTransform()).matrixTransform(stage.inverse());
        rim=[point.x,point.y];
      }
      return present.call(this,sheet,...rect);
    };
    ctx.rotate = function(angle) { rotations.push(angle); return rotate.call(this,angle); };
    brush.drawImage = function (sheet, ...args) {
      const m = this.getTransform();
      const [sx,sy,sw,sh,x,y,w,h] = args;
      calls.push({
        kind: sheet === bank.shell ? 'shell' : sheet === bank.ice ? 'ice' : 'other',
        rect: args, native: !this.imageSmoothingEnabled && m.a === (sheet===bank.shell?-1:1) && m.b === 0 && m.c === 0 && m.d === m.a &&
          (sheet === bank.shell || (sw === w && sh === h && Number.isInteger(m.e+x) && Number.isInteger(m.f+y)))
      });
      return original.call(this,sheet,...args);
    };
    try { drawShaker(GT); } finally { brush.drawImage = original; ctx.rotate = rotate;ctx.drawImage=present; }
    if (rotations.length !== 1 || rotations[0] !== shakerView().a) throw Error('Shell must rotate once with the stroke');
    if(key!=='A'&&(!rim||Math.hypot(rim[0]-cue[0],rim[1]-cue[1])>4))throw Error('Key cue missed the rendered tin corner: '+[key,rim,cue]);
    const scale=bank.scale/shakerPixel;
    const directions = S.ices.map((cube,i) => {
      const [sx,sy,cell] = calls[i+1].rect;
      const row = bank.index.ice.findLast(strip => strip[2] <= sy);
      const [side,stride,y,cols] = row;
      if (cell !== stride || Math.abs(side - 2*cube.size*scale) > 1.001) throw Error('Wrong native ice diameter');
      const frame = (sy-y)/stride*cols + sx/stride;
      const angle = frame*2*Math.PI/bank.index.iceAngles;
      const delta = angle - cube.rot;
      if (Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))) > Math.PI/bank.index.iceAngles+.00001)
        throw Error('Ice frame does not follow the physical cube');
      return frame;
    });
    return {calls, directions, angle:rotations[0], count: S.ices.length, round: S.round};
  },{key,cue});
}

async function checkSplit(page, scene) {
  for (let i=0; i<4; i++) {
    await scene.waitForFunction(()=>S.phase!=='shake'||(!S.pending && GT>=S.waitT));
    if (await scene.evaluate(()=>S.phase!=='shake')) break;
    await page.keyboard.press('KeyA');
  }
  await scene.waitForFunction(()=>S.phase==='pop' && S.fx.some(p=>p.k==='ice') && Math.abs(S.tinA)>.04);
  const readLayers = ()=>scene.evaluate(()=>{
    const props = gameGrid.bank, art = gameGrid.ctx, paintIce = art.drawImage, paintScreen = ctx.drawImage;
    const layers = [];
    art.drawImage = function(sheet) {
      if (sheet===props.ice) layers.push('ice');
      return paintIce.apply(this,arguments);
    };
    ctx.drawImage = function(sheet,x,y) {
      if (sheet===gameGrid.canvas) layers.push('spill');
      if (sheet===props.parts) {
        const [,,,,,dx,dy,width,height]=arguments;
        const matrix=this.getTransform();
        const center=new DOMPoint(dx+width/2,dy+height/2).matrixTransform(matrix);
        layers.push({row:y,angle:Math.atan2(matrix.b,matrix.a),x:center.x,y:center.y});
      }
      return paintScreen.apply(this,arguments);
    };
    try { drawShaker(GT); } finally { art.drawImage=paintIce; ctx.drawImage=paintScreen; }
    return layers;
  });
  const layers=await readLayers();
  assert(layers.includes('ice'));
  const [spill, small, large] = layers.slice(-3);
  assert.equal(spill,'spill');
  assert.equal(small.row,105);
  assert.equal(large.row,0);
  assert(Math.abs(small.angle-large.angle)>.03);
  await scene.waitForFunction(()=>GT-S.pop.t>=650);
  const [flying,stationary]=(await readLayers()).slice(-2);
  assert(flying.x>small.x && flying.x>stationary.x,'Detached small tin crosses the large tin to screen right');
  assert.deepEqual(stationary,large,'Large tin stays in place during release');
}

async function checkDisplay(page, scene, dpr) {
  const sample = await scene.evaluate(() => {
    // Isolate the prop from the independent text, timer and gauge for an exact pixel check.
    // Freeze painting after this frame so the browser screenshot contains the measured pixels.
    draw = () => {};
    ctx.clearRect(0,0,W,H);
    drawShaker(GT);
    const {width, height} = cv, zoom = gameGrid.zoom;
    // The final edges tilt with the sprite. Check its integer pixel blocks at zero tilt.
    const px = S.px;
    S.px = 0;
    ctx.clearRect(0,0,W,H);
    drawShaker(GT);
    const m = ctx.getTransform(), f = shakerView();
    const x0 = Math.round(m.e + m.a*f.x) % zoom, y0 = Math.round(m.f + m.d*f.y) % zoom;
    const neutral = new Uint32Array(ctx.getImageData(0,0,width,height).data.buffer);
    S.px = px;
    ctx.clearRect(0,0,W,H);
    drawShaker(GT);
    const pixels = new Uint32Array(ctx.getImageData(0,0,width,height).data.buffer);
    let different = 0, visible = 0;
    const edges = [];
    for (let y = y0; y + zoom <= height; y += zoom) {
      for (let x = x0; x + zoom <= width; x += zoom) {
        const i = y*width+x, color = pixels[i];
        if (color) visible++;
        for (let dy = 0; dy < zoom; dy++) {
          for (let dx = 0; dx < zoom; dx++) if (neutral[i+dy*width+dx] !== neutral[i]) different++;
        }
        if (color >>> 24 === 255 && pixels[i-zoom] !== color && edges.length < 1800) {
          edges.push([x,y,color & 255,(color>>>8) & 255,(color>>>16) & 255]);
        }
      }
    }
    return {different, visible, zoom, edges, width, height, scale: gameGrid.bank.scale};
  });
  assert.equal(sample.different, 0, 'Each occupied art cell must have one color across its entire integer display block');
  assert(sample.visible > 450 && sample.edges.length > 50);
  const rect = await scene.locator('#cv').boundingBox();
  const shot = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let matches = 0;
  for (const [x,y,r,g,b] of sample.edges) {
    const sx = Math.floor((rect.x + (x+.5)*rect.width/sample.width)*dpr);
    const sy = Math.floor((rect.y + (y+.5)*rect.height/sample.height)*dpr);
    const i = (sy*shot.info.width+sx)*shot.info.channels;
    if (shot.data[i] === r && shot.data[i+1] === g && shot.data[i+2] === b) matches++;
  }
  assert.equal(matches, sample.edges.length, 'Every sampled opaque edge pixel should keep its color in the browser screenshot');
  return [sample.zoom,sample.scale,sample.different,matches,sample.edges.length];
}

(async () => {
  const browser = await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome});
  try {
    for (const [width,height,dpr] of [[1280,720,1],[1600,900,1],[1920,1080,2],[3840,2160,1],[390,844,1]]) {
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
      try {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        let scene = page;
        if (width === 1600) {
          await page.goto(new URL('../../../?dev=1&mode=minigames',url).href);
          await page.locator('.updates-confirm').click();
          await page.locator('[data-act="miniStart"][data-id="shake"]').click();
          await page.locator('[data-act="miniShakePlay"][data-id="2"]').click();
          await page.frameLocator('iframe').locator('#tutNext').waitFor();
          scene = page.frames().find(frame => frame.url().includes('/shaking/'));
        } else {
          await page.goto(url);
        }
        await scene.waitForFunction(() => gameGrid.bank && guideGrid.bank);
        // The tutorial uses the same single shell and the independent ice sprites.
        await scene.locator('#tutNext').click();
        const guide = await scene.evaluate(() => {
          const brush = guideGrid.ctx, paint = brush.drawImage, seen = [];
          brush.drawImage = function(sheet) {
            const m = this.getTransform();
            if (Math.abs(m.a) === 1 && m.a===m.d && m.b === 0 && m.c === 0)
              seen.push(sheet === guideGrid.bank.shell ? 'shell' : sheet === guideGrid.bank.ice ? 'ice' : '?');
            return paint.apply(this,arguments);
          };
          try { drawShakerGuide(); } finally { brush.drawImage = paint; }
          return seen;
        });
        assert.deepEqual(guide,['shell','ice','ice']);
        await scene.locator('#tutNext').click();
        await scene.waitForFunction(() => S.phase==='close' && S.angDeg >= 3 && S.angDeg <= 8);
        await page.keyboard.press('Space');
        await scene.waitForFunction(() => S.phase === 'shake');
        const right = await captureStroke(page,scene,'D'), left = await captureStroke(page,scene,'A');
        for (const stroke of [left,right]) {
          assert.deepEqual(stroke.calls.map(c => c.kind),['shell',...Array(stroke.count).fill('ice')]);
          assert(stroke.count > 0 && stroke.calls.every(c => c.native));
        }
        assert.equal(left.round,1);
        assert.notDeepEqual(left.directions,right.directions,'Ice must change pose independently during a reversal');
        assert.equal(left.angle,0);assert(right.angle>0);
        assert.deepEqual(left.calls[0].rect,right.calls[0].rect,'A and D must stamp the same entire closed shell');
        assert.equal(left.calls[0].rect.length,4,'Draw the whole image rather than an angle-specific crop');
        const high=await captureStroke(page,scene,'E');
        assert.equal(high.angle,-right.angle);
        await captureStroke(page,scene,'A');
        const metrics = await checkDisplay(page,scene,dpr);
        if (width === 1280) await checkSplit(page,scene);
        assert.deepEqual(errors,[]);
        console.log(width+'x'+height+' @'+dpr, 'zoom/native layout/unequal subpixels/screenshot edges matched', metrics);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
