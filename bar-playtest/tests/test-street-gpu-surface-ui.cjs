const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>window.LUNA_STREET_QUALITY='high');await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
 const synthetic=await p.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),c=document.createElement('canvas');c.width=256;c.height=144;const ctx=c.getContext('2d',{willReadFrequently:true}),gpu=new LunaStreetGpuSurface(r,c),art=document.createElement('canvas');art.width=32;art.height=16;const a=art.getContext('2d');a.fillStyle='#f89';a.fillRect(0,0,16,16);a.fillStyle='#27c';a.fillRect(16,0,16,16);a.clearRect(3,3,4,4);
  const paint=(c)=>{c.setTransform(1,0,0,1,0,0);c.fillStyle='#172b43';c.fillRect(0,0,256,144);c.imageSmoothingEnabled=false;c.drawImage(art,0,0,16,16,15,15,64,64);c.save();c.translate(180,10);c.scale(-1,1);c.globalAlpha=.7;c.drawImage(art,16,0,16,16,0,0,64,64);c.restore();for(const [i,mode]of ['screen','lighter','multiply'].entries()){c.save();c.globalCompositeOperation=mode;c.globalAlpha=.4;c.fillStyle='#70b8f1';c.fillRect(20+i*35,85,40,25);c.restore();}c.save();c.beginPath();c.rect(180,90,20,20);c.clip();c.fillStyle='#f85';c.fillRect(170,80,40,40);c.restore();};
  paint(ctx);const before=ctx.getImageData(0,0,256,144).data;gpu.begin();paint(gpu.context);gpu.flush();r.canvas.width=256;r.canvas.height=144;ctx.save();ctx.scale(256/1280,144/720);r.present(ctx,{texture:gpu.target.t});ctx.restore();const after=ctx.getImageData(0,0,256,144).data;let sum=0,max=0;for(let i=0;i<before.length;i++){const d=Math.abs(before[i]-after[i]);sum+=d;max=Math.max(max,d);}
  // Static/native atlas updates use one allocation, with explicit invalidation.
  LunaStreetGpuSurface.markStatic(art);gpu.begin();gpu.context.drawImage(art,0,0);gpu.flush();gpu.begin();gpu.context.drawImage(art,0,0);gpu.flush();const staticUploads=gpu.stats.uploads;
  c.width=384;c.height=216;gpu.begin();gpu.context.setTransform(1,0,0,1,0,0);gpu.context.fillStyle='#ff0000';gpu.context.fillRect(0,0,384,216);gpu.flush();
  const size=[gpu.target.w,gpu.target.h],gl=r.gl.getError();gpu.dispose();r.dispose();return{max,mean:sum/before.length,staticUploads,size,gl};
 });assert(synthetic.max<=2,JSON.stringify(synthetic));assert(synthetic.mean<.25);assert.equal(synthetic.staticUploads,0);assert.deepEqual(synthetic.size,[384,216]);assert.equal(synthetic.gl,0);
 if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'bar'});await outsidePlaytest.start();window.gpuTick=outsidePlaytest.tick;outsidePlaytest.tick=()=>{};outsidePlaytest.model.tick=()=>{};});
 const rows=[];for(const [name,x,day,y,level] of [['shops',-2,3,-.7,0],['camp',-15.7,3,-.7,0],['dry',-2,2,-.7,0],['corridor',-11,3,2.1,1]]){
  const row=await p.evaluate(({x,day,y,level})=>{const o=outsidePlaytest,m=o.model;m.story.cancel();m.backgroundStory.cancel();Object.assign(m,{x,y,level,controlsTutorial:false});m.config.day=day;o.snapCamera();const c=document.querySelector('#outside-root canvas'),ctx=c.getContext('2d');
   const capture=mode=>{window.LUNA_GPU_STREET=mode;for(let i=0;i<5;i++)gpuTick(0);return ctx.getImageData(0,0,c.width,c.height).data;};const before=capture(false),after=capture(true);let sum=0,big=0;for(let i=0;i<before.length;i++){const d=Math.abs(before[i]-after[i]);sum+=d;if(d>10)big++;}
   const r=LunaStreetAtmosphere.inspect(m).renderer,upload=r.upload;let transfers=0;r.upload=function(t,...a){if(t===this.scene)transfers++;return upload.call(this,t,...a);};gpuTick(0);r.upload=upload;
   return{mean:sum/before.length,big:big/before.length,transfers,gl:r.gl.getError(),status:o.renderingStatus,stats:r.surface.stats};
  },{x,day,y,level});assert(row.mean<.2,JSON.stringify({name,...row}));assert(row.big<.003);assert.equal(row.transfers,0);assert.equal(row.gl,0);assert(row.status.preparation.done);assert(row.status.gpu);rows.push({name,...row});
 }
 const life=await p.evaluate(async()=>{const o=outsidePlaytest,m=o.model,r=LunaStreetAtmosphere.inspect(m).renderer,sim=LunaRainGlass.inspect(document.querySelector('#outside-root canvas')).simulation,time=m.time;
  // Low effect grids keep source sprites, output size and water simulation intact.
  window.LUNA_STREET_QUALITY='economy';gpuTick(0);const scale=r.surface.canvas.width;gpuTick(0);const preserved=r.effectScale===.5&&r.surface.canvas.width===scale&&m.time===time&&LunaRainGlass.inspect(document.querySelector('#outside-root canvas')).simulation===sim;
  o.exit(true);const disposed=!LunaStreetAtmosphere.inspect(m)&&r.gl.isContextLost();await o.start();return{preserved,disposed,prepared:o.renderingStatus.preparation.done,error:o.loadError};
 });assert(life.preserved);assert(life.disposed);assert(life.prepared);assert.equal(life.error,'');
 const homePreparation=await p.evaluate(async()=>{
  const o=outsidePlaytest;o.exit(true);Object.assign(o.config,{day:3,flow:'in',place:'home'});await o.start();
  const m=o.model,canvas=document.querySelector('#outside-root canvas'),layer=LunaRainGlass.inspect(canvas),prepared=layer?.preparedSimulation,time=m.time;
  const ready=!!prepared&&!!layer.renderer&&!layer.simulation&&o.renderingStatus.preparation.done;
  Object.assign(m,{scene:'street',x:-2,y:-.7,level:0});m.tick=()=>{};m.story.cancel();m.backgroundStory.cancel();o.snapCamera();gpuTick(0);
  const retained=layer.simulation===prepared&&m.time===time;
  o.exit(true);const pending=o.start();o.exit(true);await pending;
  const cancelled=!o.active&&!document.querySelector('#outside-root');Object.assign(o.config,{day:3,flow:'out',place:'bar'});await o.start();return {ready,retained,cancelled};
 });assert(homePreparation.ready);assert(homePreparation.retained);assert(homePreparation.cancelled);
 const fallback=await p.evaluate(()=>{const o=outsidePlaytest,r=LunaStreetAtmosphere.inspect(o.model).renderer,quad=r.surface.quad;let once=true;r.surface.quad=function(...args){if(once){once=false;throw Error('Injected surface failure');}return quad.apply(this,args);};gpuTick(0);return {gpu:o.renderingStatus.gpu,error:o.loadError,gl:r.gl.getError()};});
 assert.equal(fallback.gpu,false);assert.equal(fallback.error,'');assert.equal(fallback.gl,0);
 assert.deepEqual(errors,[]);console.log('STREET_GPU_SURFACE_OK',JSON.stringify({synthetic,rows,life}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
