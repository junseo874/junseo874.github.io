const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
 const bloom=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),results=[];
  for(const width of [800,1280,1920])for(const vertical of [true,false]){
   canvas.width=width;canvas.height=width*9/16;const energy=[];
   for(let offset=0;offset<8;offset++){
    ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';
    ctx.fillRect(vertical?width/2+offset:width/2-50,vertical?canvas.height/2-50:Math.floor(canvas.height/2)+offset,vertical?3:100,vertical?100:3);
    ctx.save();ctx.scale(width/1280,width/1280);r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom);ctx.restore();
    const g=r.gl,a=r.buffers[0],pixels=r.floatBloom?new Float32Array(a.w*a.h*4):new Uint8Array(a.w*a.h*4);
    g.bindFramebuffer(g.FRAMEBUFFER,a.f);g.readPixels(0,0,a.w,a.h,g.RGBA,r.floatBloom?g.FLOAT:g.UNSIGNED_BYTE,pixels);
    energy.push(pixels.reduce((sum,v,i)=>sum+(i%4===0?v:0),0));
   }
   results.push({width,vertical,energy,variation:(Math.max(...energy)-Math.min(...energy))/Math.max(...energy)});
  }
  return {float:r.floatBloom,results,error:r.gl.getError()};
 });
 for(const r of bloom.results){assert(Math.min(...r.energy)>0,'Moving neon must never lose its bloom');assert(r.variation<.12,JSON.stringify(r));}assert.equal(bloom.error,0);
 await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 const reflected=await page.evaluate(async()=>{
  const data=LUNA_OUTSIDE_DATA,images=new Map();for(const key of new Set(['idle','walk','run'].map(n=>data.animations[n].frames[0].asset))){const image=new Image();image.src=data.assets[key].src;await image.decode();images.set(key,image);}
  const r=new LunaStreetAtmosphereRenderer(),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pool=LUNA_STREET_ATMOSPHERE.puddles[5],cam={x:pool.x,y:0,w:1280/300},ripples=new Float32Array(64).fill(-1);
  const m={scene:'street',level:0,x:pool.x,y:-.7,anim:'idle',animTime:0,facing:-1};
  function draw(enabled){ctx.fillStyle='#102030';ctx.fillRect(0,0,1280,720);r.puddles(ctx,cam,[pool],()=>ripples,(c,p)=>{if(enabled)LunaStreetAtmosphere.playerReflection(c,m,cam,p,images,1);});return ctx.getImageData(0,0,1280,720).data;}
  const base=draw(false),idle=draw(true),repeat=draw(true);m.anim='walk';const walk0=draw(true);m.animTime=3/12;const walk3=draw(true);m.anim='run';const run=draw(true);m.facing=1;const flipped=draw(true);
  let count=0,leaks=0;const top=LunaPixelCamera.position(pool.x,pool.y+pool.height/2,cam),bottom=LunaPixelCamera.position(pool.x,pool.y-pool.height/2,cam),halfWidth=pool.width/2*300;
  for(let i=0;i<base.length;i+=4)if([0,1,2].some(k=>base[i+k]!==idle[i+k])){count++;const x=(i/4)%1280,y=Math.floor(i/4/1280);if(x<640-halfWidth-1||x>640+halfWidth+1||y<top.y-1||y>bottom.y+1)leaks++;}
  const difference=(a,b)=>a.reduce((s,v,i)=>s+(i%4!==3&&v!==b[i]?1:0),0);
  m.level=1;const upstairs=draw(true);m.level=0;m.ride={call:false};const riding=draw(true);
  return {count,leaks,repeat:difference(idle,repeat),walk:difference(walk0,walk3),run:difference(walk3,run),flip:difference(run,flipped),upstairs:difference(base,upstairs),riding:difference(base,riding),error:r.gl.getError()};
 });
 assert(reflected.count>100,JSON.stringify(reflected));assert.equal(reflected.leaks,0);assert.equal(reflected.repeat,0);for(const k of ['walk','run','flip'])assert(reflected[k]>20,JSON.stringify(reflected));assert.equal(reflected.upstairs,0);assert.equal(reflected.riding,0);assert.equal(reflected.error,0);
 await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.motionTick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=-2.2;m.time=3;o.snapCamera();});
 for(const [label,anim,frame,facing]of [['idle','idle',0,-1],['walk','walk',3,-1],['run','run',4,1]]){await page.evaluate(({anim,frame,facing})=>{Object.assign(outsidePlaytest.model,{anim,animTime:frame/12,facing});motionTick(0);},{anim,frame,facing});await page.screenshot({path:`/tmp/street-player-reflection-${label}.png`});}
 assert.deepEqual(errors,[]);console.log('STREET_ATMOSPHERE_MOTION_OK',JSON.stringify({bloom,reflected}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
