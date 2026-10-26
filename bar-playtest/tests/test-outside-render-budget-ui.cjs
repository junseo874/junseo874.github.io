const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const result=await page.evaluate(()=>{
  const o=outsidePlaytest,m=o.model,tick=o.tick;o.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=-2;o.snapCamera();
  m.tick=dt=>{if(!m.paused)m.time+=dt;};let draws=0;
  const original=LunaRainGlass.draw;LunaRainGlass.draw=(...args)=>{draws++;return original(...args);};
  const rates=[];for(const hz of [30,60,120,144]){const before=m.time,start=draws;for(let i=0;i<hz;i++)tick(1/hz);rates.push({hz,draws:draws-start,seconds:m.time-before});}
  m.paused=true;tick(0);const start=draws;for(let i=0;i<60;i++)tick(1/60);const paused=draws-start;tick(0);const explicit=draws-start-paused;
  m.paused=false;LunaFocusSettings.setEnabled(false);Object.defineProperty(document,'hidden',{configurable:true,value:true});const hiddenStart=draws,time=m.time;for(let i=0;i<20;i++)tick(.05);const hidden={draws:draws-hiddenStart,seconds:m.time-time};delete document.hidden;LunaFocusSettings.setEnabled(true);tick(0);
  const r=LunaStreetAtmosphere.inspect(m).renderer;
  const size=[r.canvas.width,r.canvas.height],grid=[r.fogBuffer.w,r.fogBuffer.h],scissor=r.gl.isEnabled(r.gl.SCISSOR_TEST);
  let uploads=0;const upload=r.upload;r.upload=function(...args){uploads++;return upload.apply(this,args);};const c=document.createElement('canvas');c.width=2560;c.height=1440;const ctx=c.getContext('2d'),cam={x:100,y:100,w:4};
  r.puddles(ctx,cam,LUNA_STREET_ATMOSPHERE.puddles,()=>new Float32Array(64).fill(-1),()=>{throw Error('Offscreen reflection capture');});r.shafts(ctx,cam,LUNA_STREET_ATMOSPHERE.shafts,0);
  return {rates,paused,explicit,hidden,size,grid,scissor,offscreenUploads:uploads,error:r.gl.getError()};
 });
 for(const row of result.rates){assert(Math.abs(row.seconds-1)<1e-8);assert(Math.abs(row.draws-Math.min(60,row.hz))<=1,JSON.stringify(row));}
 assert.equal(result.paused,0);assert.equal(result.explicit,1);assert.equal(result.hidden.draws,0);assert(Math.abs(result.hidden.seconds-1)<1e-8);
 assert.deepEqual(result.size,[2560,1440],'Native physical resolution is preserved');assert(result.grid[0]*result.grid[1]<2560*1440/4);assert.equal(result.scissor,false);assert.equal(result.offscreenUploads,0);assert.equal(result.error,0);assert.deepEqual(errors,[]);
 const fog=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),c=document.createElement('canvas');c.width=2560;c.height=1440;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.scale(2,2);
  const f=LUNA_STREET_ATMOSPHERE.fog[0],area=[0,0,20,20],linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,results=[];
  for(const x of [-.013,0,.017]){
   const cam={x,y:.3,w:5.12};const paint=()=>{ctx.fillStyle='#134057';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#dc42af';for(let i=0;i<1280;i+=13)ctx.fillRect(i,0,1,720);};
   paint();r.fog(ctx,cam,f,area,12.3);const grid=ctx.getImageData(0,0,c.width,c.height).data;
   paint();r.upload(r.scene,c);r.use('fogDirect');r.camera(cam);r.uniform('area',area);r.uniform('density',[f.density,f.groundY,f.height,f.heightFalloff]);r.uniform('noise',[f.noiseScale,f.noiseStrength,f.driftSpeed,f.pixelsPerUnit]);r.uniform('style',[f.lightInfluence,f.alphaSteps,f.edgeFade,0]);r.uniform('fogColor',f.color.map(linear));r.uniform('time',12.3);r.draw();r.paint(ctx);
   const direct=ctx.getImageData(0,0,c.width,c.height).data;let max=0,sum=0;for(let i=0;i<grid.length;i++){const d=Math.abs(grid[i]-direct[i]);max=Math.max(max,d);sum+=d;}results.push({x,max,mean:sum/grid.length});
  }return {results,error:r.gl.getError()};
 });
 assert.equal(fog.error,0);for(const f of fog.results){assert(f.max<=2,JSON.stringify(f));assert(f.mean<.1,JSON.stringify(f));}
 console.log('OUTSIDE_RENDER_BUDGET_OK',JSON.stringify(result),'FOG_EQUIVALENCE',JSON.stringify(fog));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
