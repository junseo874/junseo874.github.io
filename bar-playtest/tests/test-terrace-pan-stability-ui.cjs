const assert = require('node:assert/strict'), rt = require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>{lunaCampaign.session.day=1;lunaCampaign.scene('night0','테라스','terrace',()=>{});});
  await p.waitForFunction(()=>!lunaCampaign.memoryTransition&&document.querySelector('.terrace-city')?.complete);
  const result=await p.evaluate(()=>{
   const c=lunaCampaign,d=c.dialog;c.tick=()=>false;
   const realRain=LunaRainGlass.draw,realSigns=LunaSignScanlines.paintTerrace;
   let source,options;LunaRainGlass.draw=(ctx,state,o)=>{source=o.source;options=o;return false;};
   LunaSignScanlines.paintTerrace=host=>{const cv=host.querySelector('.terrace-sign-scanlines');cv.getContext('2d').clearRect(0,0,480,270);cv.dataset.stamp='stability';};
   d.terraceEntryDuration=LunaTerrace.entrance.duration;
   function seek(x){let lo=0,hi=6.8;for(let i=0;i<45;i++){d.terraceEntryTime=(lo+hi)/2;if(LunaTerrace.camera(d).x>x)lo=d.terraceEntryTime;else hi=d.terraceEntryTime;}c.paintLine();}
   const frames=[],legacyFrames=[],legacy=document.createElement('canvas'),expanded=document.createElement('canvas');
   legacy.width=480;legacy.height=270;expanded.width=1920;expanded.height=1080;
   for(const x of [100,98.75,97.5,96.25]){
    seek(x);frames.push(source.getContext('2d').getImageData(0,0,source.width,source.height));
    const g=legacy.getContext('2d');g.imageSmoothingEnabled=false;g.save();g.translate(240-x*.2,135);g.scale(1.15,1.15);g.translate(-240,-135);
    g.drawImage(document.querySelector('.terrace-city'),0,0,480,270);g.restore();
    const e=expanded.getContext('2d');e.imageSmoothingEnabled=false;e.drawImage(legacy,0,0,1920,1080);
    legacyFrames.push(e.getImageData(0,0,1920,1080));
   }
   // 1.25 native camera pixels = .25 city pixels = exactly one high-res pixel.
   // The same skyline must translate rigidly; its columns must never widen/shrink.
   let maximum=0,total=0,legacyMaximum=0;
   for(let f=1;f<frames.length;f++)for(let y=80;y<200;y++)for(let x=1250;x<1750;x++)for(let k=0;k<3;k++){
    const delta=Math.abs(frames[f].data[(y*source.width+x+1)*4+k]-frames[f-1].data[(y*source.width+x)*4+k]);maximum=Math.max(maximum,delta);total+=delta;
    legacyMaximum=Math.max(legacyMaximum,Math.abs(legacyFrames[f].data[(y*1920+x+1)*4+k]-legacyFrames[f-1].data[(y*1920+x)*4+k]));
   }
   const dimensions=[source.width,source.height],smooth=options.smoothPresentation;
   // No static original is rescaled again during ordinary pan frames.
   let originalDraws=0;const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im instanceof HTMLImageElement)originalDraws++;return draw.call(this,im,...args);};
   for(let i=0;i<30;i++)seek(96-i*.2);
   CanvasRenderingContext2D.prototype.drawImage=draw;
   LunaRainGlass.draw=realRain;LunaSignScanlines.paintTerrace=realSigns;
   d.terraceWeather={scene:'street',config:{day:1,flow:'in'}};c.paintLine();
   const glass=document.querySelector('.terrace-glass'),wet=LunaRainGlass.inspect(glass);
   const rendererSize=wet?.renderer?[wet.renderer.canvas.width,wet.renderer.canvas.height]:null;
   return {dimensions,smooth,maximum,total,legacyMaximum,originalDraws,rendererSize,error:wet?.error};
  });
  assert.deepEqual(result.dimensions,[1920,1080]);assert(result.smooth);
  assert(result.maximum<=1,'Pixel columns must be rigid during subpixel travel: '+JSON.stringify(result));
  assert(result.legacyMaximum>20,'Control reproduces column wobble in the previous low-resolution pass');
  assert.equal(result.originalDraws,0,'Static textures must be cached, not resampled per frame');
  assert.deepEqual(result.rendererSize,[1920,1080]);assert(!result.error);
  await p.screenshot({path:'/private/tmp/terrace-stable-pan.png'});
  assert.deepEqual(errors,[]);console.log('TERRACE_PAN_STABILITY_OK',result);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
