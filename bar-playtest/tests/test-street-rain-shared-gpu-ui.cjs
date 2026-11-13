const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
const optical=await p.evaluate(()=>{
 const r=new LunaStreetAtmosphereRenderer(),legacy=new LunaRainRenderer.Renderer(),shared=new LunaRainRenderer.Renderer({shared:r}),sim=new LunaRainSimulation.Simulation(),c=document.createElement('canvas');sim.prewarm(8);
 const rows=[];let transfers=0,tracking=false;const upload=r.gl.texImage2D;r.gl.texImage2D=function(...args){if(tracking)transfers++;return upload.apply(this,args);};
 for(const width of [1280,2560,1920]){c.width=width;c.height=width*9/16;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.scale(width/1280,width/1280);const paint=()=>{ctx.fillStyle='#193857';ctx.fillRect(0,0,1280,720);for(let i=0;i<1280;i+=7){ctx.fillStyle=i%2?'#ff507e':'#75ecff';ctx.fillRect(i,80,2,400);}ctx.fillStyle='#fff';ctx.fillRect(500,280,40,80);};
 for(let i=0;i<4;i++){sim.step(1/30,1,{x:30,y:0},true);paint();r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom);legacy.maps(sim,1/30);ctx.drawImage(legacy.render(c),0,0,1280,720);const a=ctx.getImageData(0,0,c.width,c.height).data;
 paint();const frame=r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom,{defer:true});shared.maps(sim,1/30);tracking=true;const image=shared.render(c,{gpuSource:frame});tracking=false;ctx.drawImage(image,0,0,1280,720);const z=ctx.getImageData(0,0,c.width,c.height).data;let max=0,sum=0;for(let n=0;n<a.length;n++){const d=Math.abs(a[n]-z[n]);max=Math.max(max,d);sum+=d;}rows.push({width,max,mean:sum/a.length});
 }
 // Direct presentation is the fallback when the optical pass cannot render.
 paint();r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom);const before=ctx.getImageData(0,0,c.width,c.height).data;paint();const frame=r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom,{defer:true});r.present(ctx,frame);const after=ctx.getImageData(0,0,c.width,c.height).data;if(before.some((v,i)=>v!==after[i]))throw Error('Post fallback changed pixels');
 }
 return {rows,transfers,shared:shared.gl===r.gl,error:r.gl.getError()};
});assert(optical.shared);assert.equal(optical.transfers,0,'Rain must consume the GPU texture without uploading the full canvas');assert.equal(optical.error,0);for(const row of optical.rows){assert(row.max<=1,JSON.stringify(row));assert(row.mean<.02,JSON.stringify(row));}
if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();outsidePlaytest.model.story.cancel();outsidePlaytest.model.backgroundStory.cancel();});
await p.waitForFunction(()=>{const m=outsidePlaytest.model,c=document.querySelector('#outside-root canvas');return LunaRainGlass.inspect(c)?.renderer&&LunaStreetAtmosphere.inspect(m)?.renderer;});
for(const width of [1280,960,1440]){await p.setViewportSize({width,height:Math.round(width*9/16)});const live=await p.evaluate(()=>{const o=outsidePlaytest,m=o.model,c=document.querySelector('#outside-root canvas');o.tick(0);const a=LunaStreetAtmosphere.inspect(m),r=LunaRainGlass.inspect(c);return {shared:r.renderer.gl===a.renderer.gl,alpha:c.getContext('2d').getContextAttributes().alpha,error:a.error,gl:a.renderer.gl.getError()};});assert(live.shared);assert.equal(live.alpha,false);assert.equal(live.error,null);assert.equal(live.gl,0);}
const lifecycle=await p.evaluate(()=>{
 const o=outsidePlaytest,m=o.model,c=document.querySelector('#outside-root canvas'),layer=LunaRainGlass.inspect(c),sim=layer.simulation;
 const rain=LunaOutsideRain.enabled;LunaOutsideRain.enabled=()=>false;
 const t=sim.time;o.tick(.05);const dryRetains=layer.simulation===sim&&sim.time>t&&LunaRainGlass.canCompose(c,m);
 LunaOutsideRain.enabled=rain;
 const r=LunaStreetAtmosphere.inspect(m).renderer,render=layer.renderer.render,present=r.present;let fallback=0;
 layer.renderer.render=()=>null;r.present=function(...args){fallback++;return present.apply(this,args);};
 o.tick(0);layer.renderer.render=render;r.present=present;
 return {dryRetains,fallback,gl:r.gl.getError()};
});assert(lifecycle.dryRetains,'Stopping rain must retain and advance the existing wet layer');assert.equal(lifecycle.fallback,1,'A failed rain presentation must still display the bloom frame');assert.equal(lifecycle.gl,0);
assert.deepEqual(errors,[]);console.log('STREET_RAIN_SHARED_GPU_OK',JSON.stringify(optical));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
