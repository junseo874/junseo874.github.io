const assert=require('node:assert/strict'),fs=require('node:fs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true,args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.SOFT_LIGHT_BASELINE)await page.route('**/street-atmosphere-renderer.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.SOFT_LIGHT_BASELINE,'utf8')}));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
 const fog=await page.evaluate(()=>{
  const r=new LunaStreetAtmosphereRenderer(),c=document.createElement('canvas');c.width=1280;c.height=720;
  const ctx=c.getContext('2d',{willReadFrequently:true}),results=[];
  // A steep, noise-free density ramp exposes cell boundaries without relying
  // on scene art. This is a stress fixture, not a new weather preset.
  const f={...LUNA_STREET_ATMOSPHERE.fog[0],groundY:0,height:.2,heightFalloff:1,density:.8,noiseStrength:0,lightInfluence:0,color:[1,1,1]};
  for(const x of [-.0101,-.0099,0,.0099,.0101]){
   const cam={x,y:.1,w:1.28};ctx.fillStyle='#000';ctx.fillRect(0,0,1280,720);r.fog(ctx,cam,f,[0,0,20,20],0);
   const pixels=ctx.getImageData(640,0,1,720).data;let maxStep=0,min=255,max=0;
   for(let y=290;y<430;y++){const v=pixels[y*4];min=Math.min(min,v);max=Math.max(max,v);maxStep=Math.max(maxStep,Math.abs(v-pixels[(y-1)*4]));}
   results.push({x,maxStep,range:max-min});
  }
  return {results,error:r.gl.getError()};
 });
 assert.equal(fog.error,0);for(const row of fog.results){assert(row.range>80,'Fixture must contain a visible light gradient');assert(row.maxStep<=3,'Soft fog must not jump at native-cell edges: '+JSON.stringify(row));}
 await page.locator('.updates-confirm').click();await page.locator('[data-outside-action="start"]').click();await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await page.keyboard.press('Space');
 await page.evaluate(()=>{const o=outsidePlaytest;window.softLightTick=o.tick;o.tick=()=>{};o.model.tick=()=>{};});
 const views=[];
 for(const [name,x,level,day]of [['lift',-12.6,0,3],['alley',-7,0,3],['shops',-3.5,0,3],['bar',.2,0,3],['restaurant',3.5,0,3],['apartment',-16,1,3],['shops-dry',-3.5,0,0],['bar-dry',.2,0,0]]){
  views.push(await page.evaluate(({name,x,level,day})=>{
   const o=outsidePlaytest,m=o.model;m.start({day,flow:day===0?'in':'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=x;m.level=level;if(level)m.y=LunaResidence.layout.upperY;m.time=2;
   const lightURLs=new Set(LUNA_OUTSIDE_DATA.scenes.street.nodes.filter(n=>!n.neon&&(n.light||/City.*Light/.test(n.name))).map(n=>new URL(LUNA_OUTSIDE_DATA.assets[n.sprite.asset].src,location.href).href));
   const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage;let lights=0,blocked=0;
   proto.drawImage=function(source,...args){if(source instanceof HTMLImageElement&&lightURLs.has(source.src)&&this.globalCompositeOperation==='screen'){lights++;if(!this.imageSmoothingEnabled)blocked++;}return draw.call(this,source,...args);};
   try{for(const offset of [0,.02,-.02,0]){m.x=x+offset;m.time+=1/60;o.snapCamera();softLightTick(0);}}finally{proto.drawImage=draw;}
   const r=LunaStreetAtmosphere.inspect(m);return {name,lights,blocked,error:r.error,gl:r.renderer.gl.getError()};
  },{name,x,level,day}));
  await page.screenshot({path:'/private/tmp/soft-light-'+name+'.png'});
 }
 assert(views.some(v=>v.lights>0),'Exercise actual city light sprites');for(const v of views){assert.equal(v.blocked,0,JSON.stringify(v));assert.equal(v.error,null);assert.equal(v.gl,0);}
 assert.deepEqual(errors,[]);console.log('STREET_SOFT_LIGHT_OK',JSON.stringify({fog,views}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
