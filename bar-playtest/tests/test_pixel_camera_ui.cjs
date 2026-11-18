const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
require('../src/shared/platform/pixel-camera.js');
const P=globalThis.LunaPixelCamera,near=(a,b)=>Math.abs(a-b)<1e-4;
const sizes=[[1280,720,1],[1920,1080,1],[1440,900,2],[900,700,1.25],[640,360,1],[2560,1440,2]];
for(const [width,height,dpr]of sizes){
 const s=P.surface(width,height,dpr);
 assert.equal(s.w*9,s.h*16);assert(s.w<=width*dpr&&s.h<=height*dpr);
 assert(near(s.left*dpr,Math.round(s.left*dpr)));assert(near(s.cssScale*1280*dpr,s.w));
 for(const cw of [4.8,5.3,8,12.8,28.8]){
  const cam={x:-12.513,y:.721,w:cw},before=JSON.stringify(cam),v=P.view(cam,s);
  assert.equal(JSON.stringify(cam),before,'Rendering cannot modify movement/camera state');
  assert(near(v.zoom>=1?v.zoom:1/v.zoom,Math.round(v.zoom>=1?v.zoom:1/v.zoom)));
  assert(v.y-v.w*9/32>=-1.48-1e-9,'Never show below floor');
  for(const flip of [false,true])for(const sx of [-1,1])for(const sy of [-1,1]){
   const sp={w:89,h:151,ppu:100,pivot:{x:.37,y:.12}},r=P.sprite(sp,-12.511,-.7,sx,sy,flip,v,s);
   const left=r.x-r.w*((sx<0)!==flip?1-sp.pivot.x:sp.pivot.x),top=r.y-r.h*(sy<0?sp.pivot.y:1-sp.pivot.y);
   assert(near(left*s.factor,Math.round(left*s.factor)),'Left edge device snapped');
   assert(near(top*s.factor,Math.round(top*s.factor)),'Top edge device snapped');
   assert(near(r.w*s.factor/sp.w,v.zoom),'Source texel follows PPU');
  }
 }
}
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  for(const [width,height,dpr]of sizes.slice(0,5)){
   const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
   await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
   const check=await p.evaluate(()=>{
    const o=outsidePlaytest,m=o.model;m.tick=()=>{};m.start({day:3,flow:'out',place:'homeDoor'});m.story.cancel();m.backgroundStory.cancel();o.snapCamera();o.tick(0);
    const c=document.querySelector('#outside-root canvas'),r=c.getBoundingClientRect(),ctx=c.getContext('2d');
    return {w:c.width,h:c.height,rect:[r.x,r.y,r.width,r.height],dpr:devicePixelRatio,s:o.pixelSurface,v:o.renderCamera,smoothing:ctx.imageSmoothingEnabled,transform:ctx.getTransform().a};
   });
   assert(near(check.rect[2]*dpr,check.w)&&near(check.rect[3]*dpr,check.h),'Backing and physical output match');
   assert(near(check.rect[0]*dpr,Math.round(check.rect[0]*dpr)));
   assert.equal(check.smoothing,false);assert(near(check.transform,check.s.factor));
   await p.screenshot({path:`/private/tmp/pixel-camera-${width}-${dpr}.png`});
   // Sample a 1px checker using the actual sprite transform at a fractional
   // source pivot. At integer zoom each texel must be exactly zoom×zoom pixels.
   assert(await p.evaluate(()=>{
    const o=outsidePlaytest,s=o.pixelSurface,v=o.renderCamera;
    if(v.zoom<1)return true;
    const source=document.createElement('canvas');source.width=source.height=2;
    const sc=source.getContext('2d');sc.fillStyle='#f00';sc.fillRect(0,0,2,2);sc.fillStyle='#00f';sc.fillRect(1,0,1,1);sc.fillRect(0,1,1,1);
    const sp={w:2,h:2,ppu:100,pivot:{x:.37,y:.12}},z=v.zoom;
    // Engine framing can give each texel a fractional physical width. Read a
    // whole number of *screen* pixels and compare the pattern while panning.
    const size=Math.floor(2*z),canvas=document.createElement('canvas');
    canvas.width=s.w;canvas.height=s.h;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    function capture(worldX){
     const p=LunaPixelCamera.sprite(sp,worldX,v.y,1,1,false,v,s);
     ctx.setTransform(s.factor,0,0,s.factor,0,0);ctx.translate(p.x,p.y);
     ctx.drawImage(source,-p.w*.37,-p.h*.88,p.w,p.h);
     const left=Math.round((p.x-p.w*.37)*s.factor),top=Math.round((p.y-p.h*.88)*s.factor);
     return ctx.getImageData(left,top,size,size).data;
    }
    const data=capture(v.x),moved=capture(v.x+.103);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
     const i=(y*size+x)*4,r=data[i],b=data[i+2];
     if((r!==255&&b!==255)||r+b!==255||data[i+1]!==0||data[i+3]!==255)return false;
     if(moved[i]!==r||moved[i+2]!==b||moved[i+3]!==255)return false;
     // A sample center exactly on the color boundary can select either texel.
     if(Math.abs(x+.5-z)<1e-5||Math.abs(y+.5-z)<1e-5)continue;
     if((r===255)!==((x+.5<z)===(y+.5<z)))return false;
    }
    return true;
   }),'Pixel checker stays uniform and unmixed');
   await p.setViewportSize({width:width-37,height:height-19});await p.waitForTimeout(100);
   assert(await p.evaluate(()=>{const o=outsidePlaytest,s=LunaPixelCamera.surface(innerWidth,innerHeight,devicePixelRatio);return o.pixelSurface.w===s.w&&o.pixelSurface.h===s.h;}),'Resize updates backing');
   if(width===1280){
    const cdp=await p.context().newCDPSession(p);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1243,height:701,deviceScaleFactor:2,mobile:false});
    await p.waitForFunction(()=>outsidePlaytest.pixelSurface.dpr===2);
    assert(await p.evaluate(()=>{const s=outsidePlaytest.pixelSurface,c=document.querySelector('#outside-root canvas'),r=c.getBoundingClientRect();return c.width===s.w&&Math.abs(r.width*devicePixelRatio-c.width)<.001;}),'DPR-only change updates backing');
    for(const place of ['home','bar']){
     await p.evaluate(place=>{const o=outsidePlaytest,m=o.model;m.start({day:3,flow:'out',place});o.snapCamera();o.tick(0);},place);
     assert(await p.evaluate(()=>Number.isFinite(outsidePlaytest.renderCamera.w)),'Interior/exterior transition');
    }
   }
   assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS 100 PPU, physical-pixel backing, zoom grid, mirrored pivots, exact checker texels, floor clamp, 5 viewport/DPR combinations and live resize');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
