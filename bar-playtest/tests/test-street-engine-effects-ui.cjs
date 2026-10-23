const assert = require('node:assert/strict'), runtime = require('../../tools/lib/test-runtime.cjs');
(async () => {
 const browser = await runtime.load('playwright').chromium.launch({ executablePath: runtime.chrome, headless: true, args: ['--mute-audio'] });
 try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.locator('.updates-confirm').click(); await page.locator('[data-outside-action="start"]').click();
  await page.waitForFunction(() => outsidePlaytest.active && !outsidePlaytest.loading); await page.keyboard.press('Space');
  const audit = await page.evaluate(async () => {
   const D = LUNA_STREET_EFFECTS, fx = LunaStreetEngineEffects, data = LUNA_OUTSIDE_DATA;
   const node = data.scenes.street.nodes.find(n => n.name === 'B_Fore_Building_1'), sp = node.sprite;
   const images = new Map();
   for (const key of [sp.asset, ...Object.keys(D.assets)]) { const im = new Image(); im.src = data.assets[key].src; await im.decode(); images.set(key, im); }
   const base = images.get(sp.asset), canvas = document.createElement('canvas'); canvas.width = sp.w; canvas.height = sp.h;
   const ctx = canvas.getContext('2d', { willReadFrequently: true }), local = { ...sp, pivot: { x: 0, y: 1 } };
   const draw = (time, still = false) => { ctx.clearRect(0,0,sp.w,sp.h); ctx.drawImage(base,0,0); fx.paintSprite(ctx,node.name,base,images,local,sp.w,sp.h,time,still); return ctx.getImageData(0,0,sp.w,sp.h).data; };
   const zero = draw(0), later = draw(1), again = draw(1), reduced = draw(100, true), reduced0 = draw(0, true);
   const same = (a,b) => a.every((v,i) => v === b[i]);
   const regionChanges = (a,b,x,y,w,h) => { let n=0; for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++){const i=(py*sp.w+px)*4;if([0,1,2,3].some(c=>a[i+c]!==b[i+c]))n++;}return n;};
   const changedLed = regionChanges(zero,later,...D.led.rect), fans = D.fan.centers.map(([x,y])=>regionChanges(zero,later,Math.floor(x-7),Math.floor(y-7),15,15));
   const maskImage = images.get(D.led.mask.asset), mc = document.createElement('canvas');mc.width=161;mc.height=26;const mctx=mc.getContext('2d');mctx.drawImage(maskImage,0,0);const mask=mctx.getImageData(0,0,161,26).data;
   let ledLeaks=0;const [lx,ly,lw,lh]=D.led.rect;
   for(let y=0;y<lh;y++)for(let x=0;x<lw;x++)if(mask[(y*lw+x)*4]<=127){const i=((ly+y)*sp.w+lx+x)*4;if([0,1,2,3].some(c=>zero[i+c]!==later[i+c]))ledLeaks++;}
   const dim = [];
   for(const channel of [0,1,3]){
    const gi=D.groups.findIndex(g=>g.channel===channel);let time;
    for(let t=0;t<180;t+=.02)if(fx.levels(t)[gi]===0){time=t;break;}
    if(time===undefined)throw Error('No flicker episode '+channel);
    const off=draw(time),on=draw(time,true);let darker=0,pixels=0;
    for(const [x,y,w]of D.dim.runs[channel])for(let px=x;px<x+w;px++){const i=(y*sp.w+px)*4;pixels++;if(off[i]+off[i+1]+off[i+2]<on[i]+on[i+1]+on[i+2])darker++;}
    dim.push({channel,pixels,darker});
   }
   const before=data.scenes.street.nodes.length;fx.apply(data);
   return {changedLed,fans,ledLeaks,dim,stable:same(later,again),reduced:same(reduced,reduced0),idempotent:before===data.scenes.street.nodes.length,
    scans:Object.values(LunaSignScanlines.masks).flat().filter(r=>r.receiver).length,
    scanMoves:['B_Fore_Building_1','C_Middle_Building_1'].every(key=>{const a=LunaSignScanlines.render(key,0).canvas.toDataURL();return a!==LunaSignScanlines.render(key,2).canvas.toDataURL();})};
  });
  assert(audit.changedLed>100);assert(audit.fans.every(n=>n>20));assert.equal(audit.ledLeaks,0);assert(audit.stable&&audit.reduced&&audit.idempotent&&audit.scanMoves);assert.equal(audit.scans,10);
  for(const d of audit.dim)assert(d.darker/d.pixels>.9,JSON.stringify(d));
  await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.engineEffectsTick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();});
  for(const [name,x]of [['shop',-.5],['led',2.4],['fan',4.6]])for(const time of [0,1.5]){
   await page.evaluate(({x,time})=>{const o=outsidePlaytest;o.model.x=x;o.model.time=time;o.snapCamera();engineEffectsTick(0);},{x,time});
   await page.screenshot({path:`/tmp/street-engine-${name}-${time}.png`});
  }
  await page.setViewportSize({width:800,height:600});await page.evaluate(()=>engineEffectsTick(0));await page.screenshot({path:'/tmp/street-engine-small.png'});
  assert.deepEqual(errors,[]);console.log('STREET_ENGINE_EFFECTS_UI_OK',audit);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
