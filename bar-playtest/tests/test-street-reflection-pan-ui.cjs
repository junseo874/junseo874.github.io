/* Keep thin reflected scenery stationary in world space without disabling live rain or walking. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),rt=require('../../tools/lib/test-runtime.cjs');
const url=(process.env.EDITOR_URL||'http://127.0.0.1:8123')+'/bar-playtest/?dev=1';
(async()=>{
 const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});
 try{for(const dpr of [1,2]){
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>window.LUNA_STREET_QUALITY='high');
  if(process.env.PUDDLE_BASELINE)await p.route('**/street-atmosphere-renderer.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.PUDDLE_BASELINE)}));
  await p.goto(url);if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{const c=lunaCampaign;c.session.uninstall();c.session.install();c.session.day=0;c.session.carry=structuredClone(barGame.progress);await c.street('out');});
  await p.waitForFunction(()=>lunaCampaign.active&&lunaCampaign.view==='game'&&!lunaCampaign.doorTransition&&outsidePlaytest.active);
  await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model;m.x=-2.9;m.y=-.7;m.level=0;m.story.cancel();m.backgroundStory.cancel();o.snapCamera();o.tick(0);
   const r=LunaStreetAtmosphere.inspect(m).renderer,render=r.puddles.bind(r);window.walkSample=[];
   r.puddles=function(ctx,cam,pools,ripples,actors){render(ctx,cam,pools,ripples,actors);
    if(m.anim==='walk')walkSample.push({x:m.x,cam:cam.x,facing:m.facing,time:m.time,rain:pools[5].index});};
  });
  for(const [key,sign]of [['KeyD',1],['KeyA',-1]]){
   const origin=await p.evaluate(()=>{walkSample.length=0;return outsidePlaytest.model.x;});
   await p.keyboard.down(key);try{await p.waitForFunction(([x,s])=>(outsidePlaytest.model.x-x)*s>.50,[origin,sign]);}finally{await p.keyboard.up(key);}
   const samples=await p.evaluate(()=>walkSample.slice());assert(samples.length>=3);assert(samples.some(f=>f.facing===sign));
   assert((samples.at(-1).cam-samples[0].cam)*sign>.08,'actual follow camera moved');assert(samples.at(-1).rain>samples[0].rain,'rain kept advancing');
   if(process.env.LUNA_REVIEW_DIR)await p.screenshot({path:path.join(process.env.LUNA_REVIEW_DIR,'street-walk-'+dpr+'-'+key+'.png')});
  }
  // Keep the real scenery, same actor frame, light and ripples. Now pan the camera
  // alone in exact device-pixel steps. A world-space cell should keep its color.
  const rows=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,step=o.tick.bind(o),view=LunaPixelCamera.view;let px=0;
   o.tick=()=>{};m.tick=()=>{};m.anim='idle';m.animTime=0;
   LunaPixelCamera.view=(...args)=>{const c=view(...args);return {...c,x:c.x+px*c.w/o.pixelSurface.w};};
   const s=LunaStreetAtmosphere.inspect(m),r=s.renderer,g=r.gl,rows=[];
   const srgb=v=>Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055));
   for(const [index,x]of [[5,-2.5],[2,-9.5],[7,2.75]]){
    const pool=s.pools[index];m.x=x;px=0;o.snapCamera();step(0);step(0);
    const f=r.waterFields.get(Math.ceil(pool.width*pool.pixelsPerUnit)+':'+Math.ceil(pool.height*pool.pixelsPerUnit));
    const read=()=>{const a=new Float32Array(f.w*f.h*4),was=g.getParameter(g.FRAMEBUFFER_BINDING);g.bindFramebuffer(g.FRAMEBUFFER,f.f);g.readPixels(0,0,f.w,f.h,g.RGBA,g.FLOAT,a);g.bindFramebuffer(g.FRAMEBUFFER,was);return a;};
    const ref=read();let peak=0,changedMask=0,interior=0;
    for(px=-8;px<=8;px++){step(0);const cur=read();
     for(let i=0;i<ref.length;i+=4){if(ref[i+3]!==cur[i+3])changedMask++;if(ref[i+3]<.3)continue;interior++;
      for(let k=0;k<3;k++)peak=Math.max(peak,Math.abs(srgb(ref[i+k])-srgb(cur[i+k])));
     }}
    rows.push({index,peak,changedMask,interior,screen:[o.pixelSurface.w,o.pixelSurface.h],capture:[r.reflectionSurface.target.w,r.reflectionSurface.target.h],wet:LunaOutsideRain.enabled(m),gl:g.getError()});
   }
   LunaPixelCamera.view=view;return rows;
  });
  console.log('PUDDLE_WALK',dpr,JSON.stringify(rows));for(const row of rows){assert.equal(row.gl,0);assert(row.wet&&row.interior>500);
   assert.equal(row.changedMask,0,'native ripple/mask grid moved');assert(row.peak<=3,'reflected world cell flashed: '+JSON.stringify(row));assert.deepEqual(row.capture,row.screen);}
  // Re-entering or resizing must not reuse a stale Retina capture or smear the original art.
  await p.setViewportSize({width:960,height:540});
  await p.waitForFunction(w=>outsidePlaytest.pixelSurface.w===w,960*dpr);
  const sizes=await p.evaluate(()=>{outsidePlaytest.snapCamera();outsidePlaytest.snapshot();const r=LunaStreetAtmosphere.inspect(outsidePlaytest.model).renderer;return [r.surface.target.w,r.reflectionSurface.target.w];});
  assert.deepEqual(sizes,[960*dpr,960*dpr]);
  // The non-unified compositor must also copy physical pixels 1:1, then paint
  // reflectors in logical scene coordinates. It must not change the source art.
  const fallback=await p.evaluate(dpr=>{
   const r=LunaStreetAtmosphere.inspect(outsidePlaytest.model).renderer,g=r.gl;
   const src=document.createElement('canvas');src.width=960*dpr;src.height=540*dpr;const sc=src.getContext('2d');
   sc.fillStyle='#ff0000';sc.fillRect(2,2,1,1);let matrix;
   const tex=r.capturePuddleReflection(sc,{},c=>{const t=c.getTransform();matrix=[t.a,t.d];c.fillStyle='#00ff00';c.fillRect(640,360,8,8);});
   const c=r.captureCtx,pixel=(c,x,y)=>Array.from(c.getImageData(x,y,1,1).data),x=src.width/2+1,y=src.height/2+1;
   g.bindTexture(g.TEXTURE_2D,tex);
   return {matrix,copy:pixel(c,2,2),neighbor:pixel(c,3,2)[3],actor:pixel(c,x,y),original:pixel(sc,x,y)[3],linear:g.getTexParameter(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER)===g.LINEAR};
  },dpr);
  assert.deepEqual(fallback,{matrix:[.75*dpr,.75*dpr],copy:[255,0,0,255],neighbor:0,actor:[0,255,0,255],original:0,linear:true});
  assert.deepEqual(errors,[]);await p.close();
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
