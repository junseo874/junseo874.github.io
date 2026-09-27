const assert=require('assert/strict'),fs=require('fs');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const P=require('../pour-fluid.js');
for(const angle of [98,100,105,110,115,120,125]){
 const f=new P.Simulation({targetMl:90,unitMl:1}),s={angle,held:true};
 for(let i=0;i<360;i++){s.angle=angle-f.tiltSpeed/120;f.tick(s,1/120);}
 assert(Math.abs(f.emittedMl-f.rate*f.flowAt(angle)*3)<1e-7);
 const predicted=f.predicted(s);s.held=false;
 for(let i=0;i<720;i++)f.tick(s,1/120);
 assert(Math.abs(f.audit().error)<1e-7);
 assert(Math.abs(predicted-f.caughtMl)<.2,'Release estimate '+angle);
 console.log('FLOW',angle,'final ml',f.caughtMl.toFixed(2));
}
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 for(const renderer of ['webgl','canvas2d']){
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(renderer=>{
   if(renderer==='canvas2d'){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl'?null:original.call(this,type,...rest);};}
   window.measureAngle=(px,flip)=>{
    const s=barGame.gimmick,cam=JSON.parse(document.querySelector('[data-fluid-stage]').dataset.camera),n=LunaPour.nozzle(s.angle),y0=n.y*cam.scale+cam.y;
    let widths=[];
    for(let y=Math.ceil(y0+18);y<y0+38;y++){let count=0;for(let x=350;x<850;x++){if(px[((flip?539-y:y)*1000+x)*4+3]>80)count++;}widths.push(count);}
    return {mean:widths.reduce((a,b)=>a+b,0)/widths.length,gaps:widths.filter(x=>!x).length};
   };
   const draw=WebGLRenderingContext.prototype.drawArrays;
   WebGLRenderingContext.prototype.drawArrays=function(...a){const result=draw.apply(this,a);if(window.captureAngle&&this.canvas.classList.contains('pour-gpu')&&!this.getParameter(this.FRAMEBUFFER_BINDING)){const px=new Uint8Array(1000*540*4);this.readPixels(0,0,1000,540,this.RGBA,this.UNSIGNED_BYTE,px);window.angleSample=measureAngle(px,true);window.captureAngle=false;}return result;};
  },renderer);
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  for(const mode of ['classic','clean','bottle']){
   let widths=[];
   for(const angle of [100,110,125]){
    await p.evaluate(angle=>{
     const g=barGame;if(window.originalTick)g.tick=window.originalTick;g.startMinigame('pour','original');
     const s=g.gimmick;s.ingredient='beer';s.started=true;s.held=true;
     for(let i=0;i<360;i++){s.angle=angle-s.fluid.tiltSpeed/120;g.tick(1/120);}
     window.originalTick=g.tick;g.tick=()=>{};g.changed();
    },angle);
    await p.locator('[data-act="pourPresentation"][data-id="'+mode+'"]').click();await p.waitForTimeout(100);
    let m;
    if(renderer==='webgl'){
     await p.evaluate(()=>{window.angleSample=null;window.captureAngle=true});await p.waitForFunction(()=>window.angleSample);m=await p.evaluate(()=>angleSample);
    }else m=await p.locator('.pour-fallback').evaluate(e=>measureAngle(e.getContext('2d').getImageData(0,0,1000,540).data,false));
    assert.equal(m.gaps,0,'Stream gap '+renderer+mode+angle);widths.push(m.mean);
    if(mode==='bottle')await p.screenshot({path:'/private/tmp/angle-'+renderer+'-'+angle+'.png'});
   }
   assert(widths[0]<widths[1]&&widths[1]<widths[2],JSON.stringify({renderer,mode,widths}));
   console.log('WIDTH',renderer,mode,widths);
  }
  assert.deepEqual(errors,[]);await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
