const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 const optics=await p.evaluate(()=>{
  const renderer=new LunaRainRenderer.Renderer(),g=renderer.gl,source=document.createElement('canvas');source.width=480;source.height=270;const c=source.getContext('2d'),im=c.createImageData(480,270);
  for(let y=0;y<270;y++)for(let x=0;x<480;x++){const i=(y*480+x)*4;im.data.set([x%17<8?30:170,y%23<11?45:130,(x+y)%31<15?80:200,255],i);}c.putImageData(im,0,0);
  const sim=new LunaRainSimulation.Simulation({spawnPerSecond:0});const d=sim.newDrop(240,135,5);d.age=1;d.vy=-50;d.py=165;sim.drops=[d];renderer.maps(sim,0);
  const heights=new Float32Array(480*270*4),trails=new Float32Array(heights.length);
  g.bindFramebuffer(g.FRAMEBUFFER,renderer.water.f);g.readPixels(0,0,480,270,g.RGBA,g.FLOAT,heights);
  g.bindFramebuffer(g.FRAMEBUFFER,renderer.film.f);g.readPixels(0,0,480,270,g.RGBA,g.FLOAT,trails);
  const render=options=>{renderer.render(source,options);const data=new Uint8Array(480*270*4);g.readPixels(0,0,480,270,g.RGBA,g.UNSIGNED_BYTE,data);return data;};
  const bypass=render({strength:0}),gentle=render({strength:.45}),full=render({strength:1}),flat=render({strength:1,refraction:0}),noReflection=render({strength:1,highlight:0}),noDispersion=render({strength:1,dispersion:0});
  let bypassError=0,outsideError=0,total=0,amount=0,refracted=0,reflected=0,dispersed=0;
  const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
  for(let y=0;y<270;y++)for(let x=0;x<480;x++){const i=(y*480+x)*4,src=((269-y)*480+x)*4;for(let k=0;k<3;k++){
   bypassError=Math.max(bypassError,Math.abs(bypass[i+k]-im.data[src+k]));
   if(heights[i]<=.02&&trails[i]<.02)outsideError=Math.max(outsideError,Math.abs(full[i+k]-bypass[i+k]));
   total+=Math.abs(linear(full[i+k])-linear(bypass[i+k]));amount+=Math.abs(linear(gentle[i+k])-linear(bypass[i+k]));
   refracted+=Math.abs(full[i+k]-flat[i+k]);reflected+=Math.abs(full[i+k]-noReflection[i+k]);dispersed+=Math.abs(full[i+k]-noDispersion[i+k]);
  }}
  // Independent scalar evaluation of the engine composite at a known height cell.
  const sat=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{x=sat((x-a)/(b-a));return x*x*(3-2*x);};
  const normal=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const height=(x,y)=>heights[(Math.max(0,Math.min(269,y))*480+Math.max(0,Math.min(479,x)))*4];
  const scene=(u,v,k)=>{const x=Math.max(0,Math.min(479,Math.floor(u*480))),y=Math.max(0,Math.min(269,Math.floor(v*270)));return linear(im.data[((269-y)*480+x)*4+k]);};
  let oracleError=0,checked=0;
  for(let y=115;y<145;y++)for(let x=228;x<252;x++){
   const h=height(x,y);if(h<=.02)continue;const slope=[(height(x+1,y)-height(x-1,y))*.5,(height(x,y+1)-height(x,y-1))*.5];
   const n=normal([-slope[0]*1.2,-slope[1]*1.2,1]),edge=1-n[2],size=sat(h/3),base=[(x+.5)/480-n[0]*.045*270/480*(.35+.65*size),(y+.5)/270-n[1]*.045*(.35+.65*size)];
   const direction=normal([n[0]+.00001,n[1]]),spread=.65*smooth(.2,.7,edge),facing=dot(direction,normal([-.55,.85])),rim=smooth(.08,.55,edge);
   const spec=smooth(.94,.995,dot(n,normal([-.35,.55,.75])))*smooth(.8,1.8,h),reflection=(rim*(.12+.5*sat(facing))+spec*.55)*.45;
   for(let k=0;k<3;k++){const sign=1-k;let value=scene(base[0]+sign*direction[0]/480*spread,base[1]+sign*direction[1]/270*spread,k);value*=1-.3*rim*sat(-facing)*.65;value+=reflection*(1-sat(value));const srgb=value<=.0031308?value*12.92:1.055*value**(1/2.4)-.055;oracleError=Math.max(oracleError,Math.abs(Math.round(srgb*255)-full[(y*480+x)*4+k]));}checked++;
  }
  const before=Array.from(trails);sim.drops=[];renderer.maps(sim,2.5);g.bindFramebuffer(g.FRAMEBUFFER,renderer.film.f);g.readPixels(0,0,480,270,g.RGBA,g.FLOAT,trails);const sum=a=>a.reduce((s,v,i)=>s+(i%4===0?v:0),0);const drying=sum(trails)/sum(before),glError=g.getError();renderer.dispose();
  return {bypassError,outsideError,ratio:amount/total,refracted,reflected,dispersed,oracleError,checked,drying,glError,trailPixels:before.filter((v,i)=>i%4===0&&v>.1).length};
 });
 assert.equal(optics.glError,0);assert.equal(optics.bypassError,0);assert.equal(optics.outsideError,0);assert(optics.ratio>.43&&optics.ratio<.47,JSON.stringify(optics));assert(optics.refracted>1000&&optics.reflected>100&&optics.dispersed>50);assert(optics.checked>40&&optics.oracleError<=3,JSON.stringify(optics));assert(optics.trailPixels>35&&optics.drying>.35&&optics.drying<.39);
 const coverage=await p.evaluate(async()=>{
  const r=new LunaRainRenderer.Renderer(),g=r.gl,s=new LunaRainSimulation.Simulation();s.prewarm();
  const water=new Float32Array(480*270*4),film=new Float32Array(water.length),samples=[];
  for(let i=0;i<=5400;i++){
   if(i)s.step(1/30,1,{x:Math.floor(i/900)%2?-90:-14,y:0},!!(Math.floor(i/900)%2));
   r.maps(s,i?1/30:0);
   if(i%300===0){
    g.bindFramebuffer(g.FRAMEBUFFER,r.water.f);g.readPixels(0,0,480,270,g.RGBA,g.FLOAT,water);
    g.bindFramebuffer(g.FRAMEBUFFER,r.film.f);g.readPixels(0,0,480,270,g.RGBA,g.FLOAT,film);
    let wet=0;for(let j=0;j<water.length;j+=4)if(water[j]>.02||film[j]>=.02)wet++;
    samples.push({seconds:i/30,wetFraction:wet/(480*270),drops:s.drops.length});
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
  const error=g.getError();r.dispose();return {samples,error};
 });
 assert.equal(coverage.error,0);assert(coverage.samples.every(s=>s.wetFraction<.08),'Water and drying trails together must leave at least 92% of the screen clear: '+JSON.stringify(coverage));
 console.log('PASS GPU wet area over 180 seconds',JSON.stringify(coverage.samples));
 await p.evaluate(async()=>{const o=outsidePlaytest;Object.assign(o.config,{day:1,flow:'in',place:'bar'});await o.start();window.rainStep=o.tick;o.tick=()=>{};o.model.story.cancel();o.model.backgroundStory.cancel();o.model.x=-3;o.model.tick=()=>{};o.model.paused=false;o.snapCamera();rainStep(0);});
 const integration=await p.evaluate(()=>{const o=outsidePlaytest,cv=document.querySelector('#outside-root canvas'),c=cv.getContext('2d'),snap=()=>c.getImageData(0,0,cv.width,cv.height).data;
  rainStep(0);const wet=snap(),state=LunaRainGlass.inspect(cv),drops=JSON.stringify(state.simulation.drops);rainStep(0);const frozen=snap();
  const original=LunaRainGlass.draw;LunaRainGlass.draw=()=>{};rainStep(0);const dry=snap();LunaRainGlass.draw=original;rainStep(0);
  return {visible:wet.some((v,i)=>v!==dry[i]),paused:wet.every((v,i)=>v===frozen[i])&&drops===JSON.stringify(state.simulation.drops),error:state.error,gl:state.renderer.gl.getError()};});
 assert(integration.visible&&integration.paused);assert.equal(integration.error,null);assert.equal(integration.gl,0);
 await p.screenshot({path:'/private/tmp/rain-engine-game.png'});
 await p.emulateMedia({reducedMotion:'reduce'});assert(await p.evaluate(()=>{const o=outsidePlaytest,cv=document.querySelector('#outside-root canvas'),before=JSON.stringify(LunaRainGlass.inspect(cv).simulation.drops);o.model.time+=2;rainStep(0);return before===JSON.stringify(LunaRainGlass.inspect(cv).simulation.drops);}));
 assert.deepEqual(errors,[]);console.log('PASS engine rain GPU + scene integration',JSON.stringify(optics));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
