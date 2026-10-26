const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const optics=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const r=new LunaStreetAtmosphereRenderer(),camera={x:0,y:-.3,w:4};
  const p={...LUNA_STREET_ATMOSPHERE.puddles[0],x:0,y:-1,width:2,height:.4,line:-.7};
  const paint=()=>{ctx.fillStyle='#101010';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#ff2020';ctx.fillRect(384,280,512,144);};
  const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data);
  const ripples=new Float32Array(64).fill(-1);paint();const before=pixel(640,584);
  r.puddles(ctx,camera,[p],()=>ripples,()=>{});const reflected=pixel(640,584),outside=pixel(20,584);
  // The texture captured before puddles must be read live, never cached from a previous camera/frame.
  paint();ctx.fillStyle='#2050ff';ctx.fillRect(384,280,512,144);r.puddles(ctx,camera,[p],()=>ripples,()=>{});const changed=pixel(640,584);
  paint();const black=pixel(10,10);r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom);const blackAfter=pixel(10,10);
  return {before,reflected,outside,changed,black,blackAfter,glError:r.gl.getError()};
 });
 assert(optics.reflected[0]>optics.reflected[2]*2,'Red above the mirror line reflects below it');
 assert(optics.changed[2]>optics.changed[0]*2,'Live scene changes appear in the reflection');
 assert.deepEqual(optics.outside,optics.before,'No rectangular water overlay outside the authored outline');
 assert.deepEqual(optics.blackAfter,optics.black,'Bloom must not lift unrelated dark pixels');assert.equal(optics.glError,0);
 await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.atmosphereTick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();});
 for(const x of [-14,-10,-5,0,3]){
  await page.evaluate(x=>{const o=outsidePlaytest;o.model.x=x;o.snapCamera();for(let i=0;i<30;i++){o.model.time+=1/30;atmosphereTick(0);}},x);
  await page.screenshot({path:`/tmp/street-atmosphere-${x}.png`});
 }
 const live=await page.evaluate(()=>{const s=LunaStreetAtmosphere.inspect(outsidePlaytest.model);return {error:s.error,fog:s.fogIndex,pools:s.paintedPools,glError:s.renderer.gl.getError()};});
 assert.equal(live.error,null);assert.equal(live.fog,3);assert(live.pools);assert.equal(live.glError,0);
 await page.setViewportSize({width:800,height:600});await page.waitForFunction(()=>document.querySelector('#outside-root canvas').width<=800);await page.evaluate(()=>atmosphereTick(0));await page.screenshot({path:'/tmp/street-atmosphere-small.png'});
 const dimensions=await page.evaluate(()=>{const r=LunaStreetAtmosphere.inspect(outsidePlaytest.model).renderer;return [r.canvas.width,r.canvas.height];});assert(dimensions[0]<=800&&dimensions[1]<=600);
 assert.deepEqual(errors,[]);console.log('STREET_ATMOSPHERE_UI_OK',JSON.stringify({optics,live,dimensions,missing}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
