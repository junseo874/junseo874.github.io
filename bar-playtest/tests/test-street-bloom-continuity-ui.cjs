const assert=require('node:assert/strict'),fs=require('node:fs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Optional pre-fix shader proves that this regression fails for the old bands.
 if(process.env.BLOOM_BASELINE)await page.route('**/street-atmosphere-renderer.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.BLOOM_BASELINE,'utf8')}));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
 const result=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),c=document.createElement('canvas'),cases=[];
  for(const width of [800,1280,1920,2560,3840])for(const vertical of [true,false]){
   c.width=width;c.height=width*9/16;const ctx=c.getContext('2d'),phases=[];
   for(let offset=0;offset<4;offset++){
    ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#c9ffff';ctx.fillRect(vertical?Math.floor(width/2)+offset:0,vertical?0:Math.floor(c.height/2)+offset,vertical?3:width,vertical?c.height:3);
    ctx.save();ctx.scale(width/1280,width/1280);r.post(ctx,LUNA_STREET_ATMOSPHERE.bloom);ctx.restore();
    const g=r.gl,a=r.buffers[0],length=vertical?a.w:a.h,v=r.floatBloom?new Float32Array(length*4):new Uint8Array(length*4);
    g.bindFramebuffer(g.FRAMEBUFFER,a.f);g.readPixels(vertical?0:Math.floor(a.w/2),vertical?Math.floor(a.h/2):0,vertical?a.w:1,vertical?1:a.h,g.RGBA,r.floatBloom?g.FLOAT:g.UNSIGNED_BYTE,v);
    const line=Array.from({length},(_,i)=>v[i*4+1]/(r.floatBloom?1:255)),peak=Math.max(...line),at=line.indexOf(peak),tolerance=Math.max(peak*.002,r.floatBloom ? .000001 : 1/255);let echoes=0;
    for(let i=at+1;i<length;i++)if(line[i]>line[i-1]+tolerance)echoes++;
    for(let i=at-1;i>=0;i--)if(line[i]>line[i+1]+tolerance)echoes++;
    phases.push({echoes,energy:line.reduce((s,v)=>s+v,0),peak});
   }cases.push({width,vertical,phases});
  }return {cases,error:r.gl.getError()};
 });
 for(const c of result.cases){
  assert(c.phases.every(p=>p.peak>0&&p.echoes===0),'Light must fade continuously without repeated bands: '+JSON.stringify(c));
  const energy=c.phases.map(p=>p.energy);assert((Math.max(...energy)-Math.min(...energy))/Math.max(...energy)<.02,'Subpixel movement must preserve light energy: '+JSON.stringify(c));
 }
 assert.equal(result.error,0);
 await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 await page.evaluate(()=>{const o=outsidePlaytest,m=o.model;window.bloomTick=o.tick;o.tick=()=>{};m.tick=()=>{};m.start({day:0,flow:'in',place:'bar'});m.story.cancel();m.backgroundStory.cancel();const door=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='Bar Spawn Point');m.x=door.x-.8;m.time=2;o.snapCamera();bloomTick(0);});
 await page.screenshot({path:'/private/tmp/bloom-smooth-door.png'});
 await page.evaluate(()=>{outsidePlaytest.model.x+=.05;outsidePlaytest.model.time+=1/30;outsidePlaytest.snapCamera();bloomTick(0);});await page.screenshot({path:'/private/tmp/bloom-smooth-door-moved.png'});
 assert.deepEqual(errors,[]);console.log('BLOOM_CONTINUITY_OK',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
