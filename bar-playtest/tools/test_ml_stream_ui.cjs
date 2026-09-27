const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{
 const draw=WebGLRenderingContext.prototype.drawArrays;
 window.measureStream=pixels=>{let gaps=0,minWidth=Infinity,maxWidth=0;for(let y=195;y<=250;y++){let n=0;for(let x=592;x<740;x++)if(pixels[((539-y)*1000+x)*4+3]>20)n++;if(!n)gaps++;else{minWidth=Math.min(minWidth,n);maxWidth=Math.max(maxWidth,n);}}return {gaps,minWidth,maxWidth};};
 WebGLRenderingContext.prototype.drawArrays=function(...a){const r=draw.apply(this,a);if(window.captureStream&&this.canvas.classList.contains('pour-gpu')&&!this.getParameter(this.FRAMEBUFFER_BINDING)){const px=new Uint8Array(1000*540*4);this.readPixels(0,0,1000,540,this.RGBA,this.UNSIGNED_BYTE,px);window.streamSample=measureStream(px);window.captureStream=false;}return r;};
});
await p.goto('http://127.0.0.1:8123/bar-playtest/');
const data=await p.evaluate(()=>({recipes:barGame.t.recipes.map(r=>r.unit),beer:barGame.t.recipes.find(r=>r.context==='bottle_beer').qty,source:window.LUNA_DATA.tables.recipes.find(r=>r.context==='bottle_beer').unit}));
assert(data.recipes.every(x=>x==='ml'));assert.equal(data.beer,360);assert.equal(data.source,'oz');
const capture=async()=>{await p.evaluate(()=>{window.captureStream=true;window.streamSample=null});await p.waitForFunction(()=>!!window.streamSample);return p.evaluate(()=>streamSample)};
for(const variant of ['original','gpt']){
 await p.evaluate(variant=>{const g=barGame;g.startMinigame('pour',variant);g.gimmick.ingredient='beer';g.gimmick.target=360;g.gimmick.unit='ml';LunaPour.init(g.gimmick,g);g.holdPour(true);for(let i=0;i<360;i++)g.tick(1/120);window.savedTick??=g.tick;g.tick=()=>{};},variant);
 await p.locator('[data-fluid-stage]').waitFor();await p.waitForTimeout(200);
 const fixed=await capture();assert.equal(fixed.gaps,0,'Continuous beer jet must fill every row above rim');
 assert.equal(await p.locator('.pour-target-value').textContent(),'360 ml');
 assert((await p.locator('[data-pour-value]').textContent()).endsWith(' ml'));
 await p.screenshot({path:'/private/tmp/pour-beer-fixed-'+variant+'.png'});
 if(variant==='original'){
  await p.evaluate(()=>{const f=barGame.gimmick.fluid;window.savedSamples=f.renderParticles;f.renderParticles=function(){return this.particles}});
  const old=await capture();await p.screenshot({path:'/private/tmp/pour-beer-old.png'});
  console.log('Beer before/after',JSON.stringify({old,fixed}));assert(old.gaps>fixed.gaps);
  await p.evaluate(()=>barGame.gimmick.fluid.renderParticles=window.savedSamples);
 }
 await p.evaluate(()=>barGame.tick=window.savedTick);
}
await p.evaluate(()=>{const g=barGame;g.startMinigame('pour','original');g.gimmick.ingredient='beer';g.gimmick.target=360;g.gimmick.unit='ml';LunaPour.init(g.gimmick,g);g.holdPour(true);for(let i=0;i<360;i++)g.tick(1/120);g.tick=()=>{};});
await p.waitForTimeout(200);
await p.locator('.pour-gpu').evaluate(e=>e.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
await p.waitForFunction(()=>document.querySelector('.pour-fallback').style.visibility==='visible');
const fallback=await p.locator('.pour-fallback').evaluate(e=>{const c=e.getContext('2d');let gaps=0;for(let y=195;y<=250;y++){const row=c.getImageData(592,y,148,1).data;if(!row.some((v,i)=>i%4===3&&v>20))gaps++;}return gaps});
assert.equal(fallback,0);
await p.evaluate(()=>{const g=barGame;g.tick=window.savedTick;g.reset(99,'practice',1);g.selectCocktail('gin_tonic');});
await p.waitForTimeout(150);
assert(await p.evaluate(()=>barGame.t.recipes.every(r=>r.unit==='ml')));
assert.deepEqual(errors,[]);console.log('ML_STREAM_UI_OK: source intact; 71 recipe rows in ml; beer GPU/Canvas continuous; both variants');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

