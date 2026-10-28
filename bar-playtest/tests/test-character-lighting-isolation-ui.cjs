const assert=require('node:assert/strict'),fs=require('node:fs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 for(const dpr of [1,2]){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:dpr}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.LIGHTING_BASELINE)await page.route('**/street-atmosphere-renderer.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.LIGHTING_BASELINE,'utf8')}));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
 const result=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),actor=document.createElement('canvas');actor.width=32;actor.height=64;
  const a=actor.getContext('2d');a.fillStyle='#fff';a.fillRect(8,4,16,16);a.fillStyle='#d94873';a.fillRect(8,20,16,40);
  const sp={x:0,y:0,w:32,h:64,pivot:{x:.5,y:0}},params={x:0,y:0,width:.32,height:.64,flip:false,foot:{x:0,y:0},state:{position:[1,1],weight:1,color:[1,1,1]},config:LunaCharacterLighting.config};
  const c=document.createElement('canvas'),results=[];
  for(const width of [1280,2560]){
   c.width=width;c.height=width*9/16;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.scale(width/1280,width/1280);
   const pools=[-1.7,1.7].map(x=>({...LUNA_STREET_ATMOSPHERE.puddles[0],x,y:-1,width:.6,height:.4,line:-.7}));
   const paint=nested=>{ctx.fillStyle='#102030';ctx.fillRect(0,0,1280,720);r.puddles(ctx,{x:0,y:0,w:4},pools,()=>new Float32Array(64).fill(-1),()=>{if(nested)r.characterLighting(actor,sp,params);});return ctx.getImageData(0,0,c.width,c.height).data;};
   const base=paint(false),nested=paint(true);let changed=0;for(let i=0;i<base.length;i++)if(base[i]!==nested[i])changed++;
   // A character-lighting call must also preserve an already rendered effect
   // surface, including pixels outside a puddle's silhouette and GPU state.
   r.gl.bindFramebuffer(r.gl.FRAMEBUFFER,null);r.gl.disable(r.gl.SCISSOR_TEST);r.gl.clearColor(.1,.2,.3,1);r.gl.clear(r.gl.COLOR_BUFFER_BIT);
   const before=new Uint8Array(32*64*4);r.gl.readPixels(0,0,32,64,r.gl.RGBA,r.gl.UNSIGNED_BYTE,before);
   const out=r.characterLighting(actor,sp,params),after=new Uint8Array(before.length);r.gl.readPixels(0,0,32,64,r.gl.RGBA,r.gl.UNSIGNED_BYTE,after);
   const preview=document.createElement('canvas');preview.width=32;preview.height=64;const pc=preview.getContext('2d');pc.drawImage(out.image,out.x,out.y,out.w,out.h,0,0,32,64);
   const rendered=pc.getImageData(0,0,32,64).data;let alpha=0;for(let i=3;i<rendered.length;i+=4)alpha+=rendered[i];
   results.push({width,changed,surfaceChanged:before.some((v,i)=>v!==after[i]),alpha,error:r.gl.getError()});
  }return results;
 });
 console.log('LIGHTING_ISOLATION',JSON.stringify(result));
 for(const row of result){assert.equal(row.changed,0,'Nested lighting leaked into the puddle composite: '+JSON.stringify(row));assert.equal(row.surfaceChanged,false);assert(row.alpha>10000,'Keep the shaded character image');assert.equal(row.error,0);}
 await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 await page.evaluate(()=>{const o=outsidePlaytest;window.isolationTick=o.tick;o.tick=()=>{};o.model.tick=()=>{};});
 for(const [label,x,anim,day]of [['alley-idle',-9.7,'idle',3],['alley-run',-9.7,'run',3],['lift',-12.6,'walk',3],['shops',-3.5,'idle',3],['dry',-9.7,'idle',0]]){
  await page.evaluate(({x,anim,day})=>{const o=outsidePlaytest,m=o.model;m.start({day,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();Object.assign(m,{x,anim,animTime:.2});o.snapCamera();for(let i=0;i<20;i++){m.time+=1/60;isolationTick(0);}},{x,anim,day});
  await page.screenshot({path:'/private/tmp/lighting-isolation-'+label+'-dpr'+dpr+'.png'});
  assert.equal(await page.evaluate(()=>LunaStreetAtmosphere.inspect(outsidePlaytest.model).error),null);
 }
 assert.deepEqual(errors,[]);console.log('CHARACTER_LIGHTING_ISOLATION_OK',dpr);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
