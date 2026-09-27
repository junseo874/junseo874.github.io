const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  const draw=WebGLRenderingContext.prototype.drawArrays;
  window.measureLiquid=(pixels)=>{let n=0,r=0,g=0,b=0,maxAlpha=0;for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];maxAlpha=Math.max(maxAlpha,a);if(a>20){n++;r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];}}return {n,r:r/(n||1),g:g/(n||1),b:b/(n||1),maxAlpha};};
  WebGLRenderingContext.prototype.drawArrays=function(...args){
   const r=draw.apply(this,args);
   if(window.captureLiquid&&this.canvas.classList.contains('pour-gpu')&&!this.getParameter(this.FRAMEBUFFER_BINDING)){
    const a=new Uint8Array(1000*540*4);this.readPixels(0,0,1000,540,this.RGBA,this.UNSIGNED_BYTE,a);
    window.liquidSample=measureLiquid(a);window.captureLiquid=false;
   }
   return r;
  };
 });
 await p.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 await p.evaluate(()=>{const g=barGame;g.startMinigame('pour','original');g.holdPour(true);for(let i=0;i<660;i++)g.tick(1/120);g.holdPour(false);for(let i=0;i<180;i++)g.tick(1/120);g.paused=true;});
 await p.locator('[data-fluid-stage]').waitFor();
 const rows=await p.evaluate(()=>barGame.t.shelf_items.filter(i=>['pour','fill_up'].includes(i.default_action)).map(i=>({id:i.id,color:i.color,alpha:Number(i.liquid_alpha)})));
 assert.equal(rows.length,33);
 const readGPU=async()=>{await p.evaluate(()=>{window.liquidSample=null;window.captureLiquid=true;});await p.waitForFunction(()=>!!window.liquidSample);return p.evaluate(()=>liquidSample);};
 const samples={};
 for(const row of rows){
  await p.evaluate(id=>barGame.gimmick.ingredient=id,row.id);
  await p.waitForFunction(id=>document.querySelector('[data-fluid-stage]')?.dataset.ingredient===id,row.id);
  assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-liquid-color'),row.color);
  const sample=await readGPU();samples[row.id]=sample;
  assert(sample.n>50,row.id+' rendered');
  assert(Math.abs(sample.maxAlpha-row.alpha*255)<=2,row.id+' GPU opacity');
  const rgb=row.color.split(',').map(Number),channels=[sample.r,sample.g,sample.b];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(rgb[i]>rgb[j]+15)assert(channels[i]>channels[j],row.id+' retains hue');
  if(['gin','whiskey','orange_juice','grenadine','blue_curacao','cream'].includes(row.id)){
   await p.evaluate(()=>barGame.paused=false);await p.waitForTimeout(120);
   await p.screenshot({path:'/private/tmp/liquid-'+row.id+'.png'});
   await p.evaluate(()=>barGame.paused=true);
  }
 }
 // The identical source data drives recipe steps as well as standalone tests.
 assert.equal(await p.evaluate(()=>barGame.t.recipes.filter(r=>['pour','fill_up'].includes(r.action)).every(r=>barGame.t.shelf_items.some(i=>i.id===r.ingredient&&i.color&&i.liquid_alpha!=null))),true);
 const original=await p.evaluate(()=>({color:barGame.t.shelf_items[0].color,alpha:barGame.t.shelf_items[0].liquid_alpha}));
 await p.evaluate(()=>{const i=barGame.t.shelf_items[0];i.liquid_alpha='0';barGame.gimmick.ingredient=i.id;});
 assert.equal((await readGPU()).maxAlpha,0,'Explicit alpha zero is not replaced by default');
 await p.evaluate(()=>{const i=barGame.t.shelf_items[0];i.color='bad';i.liquid_alpha='bad';});
 await readGPU();assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-liquid-color'),'200,230,240');
 assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-liquid-alpha'),'0.6');
 await p.evaluate(o=>{const i=barGame.t.shelf_items[0];i.color=o.color;i.liquid_alpha=o.alpha;},original);
 await p.evaluate(()=>{document.querySelector('.pour-gpu').getContext('webgl').getExtension('WEBGL_lose_context').loseContext();});
 await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.renderer==='canvas2d');
 for(const row of rows){
  await p.evaluate(id=>barGame.gimmick.ingredient=id,row.id);
  await p.waitForFunction(id=>document.querySelector('[data-fluid-stage]').dataset.ingredient===id,row.id);
  const sample=await p.locator('.pour-fallback').evaluate(c=>measureLiquid(c.getContext('2d').getImageData(0,0,1000,540).data));
  assert(sample.n>50);assert(Math.abs(sample.maxAlpha-row.alpha*255)<=2,row.id+' fallback opacity does not stack');
  const rgb=row.color.split(',').map(Number),channels=[sample.r,sample.g,sample.b];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(rgb[i]>rgb[j]+15)assert(channels[i]>channels[j],row.id+' fallback hue');
 }
 assert.deepEqual(errors,[]);
 console.log('LIQUID_COLORS_UI_OK: 33 ingredient colors and opacities in WebGL + Canvas2D; real fluid pixels/hue; recipe references; clear vs opaque; zero and malformed values.');
 console.log(JSON.stringify(Object.fromEntries(['gin','whiskey','orange_juice','grenadine','blue_curacao','cream'].map(k=>[k,samples[k]]))));
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
