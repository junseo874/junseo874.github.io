const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  const audit=await p.evaluate(()=>{
   const fx=LunaBarrelFire,colors=new Set();let below=0,edge=0,minPixels=Infinity,maxLight=0,maxChange=0,lastEnergy=null;
   for(let f=0;f<96;f++){
    const v=fx.render(f/fx.fps),c=v.core,w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,l=v.light.getContext('2d').getImageData(0,0,w,h).data;let pixels=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const i=(y*w+x)*4,a=d[i+3];maxLight=Math.max(maxLight,l[i+3]);
     if(a){pixels++;if(a===255)colors.add([d[i],d[i+1],d[i+2]].join(','));if(y+fx.crop.y>fx.anchor.y)below++;if(!x||!y||x===w-1||y===h-1)edge++;}
    }
    minPixels=Math.min(minPixels,pixels);if(lastEnergy!==null)maxChange=Math.max(maxChange,Math.abs(v.energy-lastEnergy));lastEnergy=v.energy;
   }
   const a=fx.render(1).core.toDataURL(),cached=a===fx.render(1.001).core.toDataURL(),moving=a!==fx.render(1.4).core.toDataURL();
   const still=fx.render(0,true),core=still.core.toDataURL(),light=still.light.toDataURL();const next=fx.render(100,true);
   return {colors:colors.size,below,edge,minPixels,maxLight,maxChange,cached,moving,still:core===next.core.toDataURL()&&light===next.light.toDataURL()};
  });
  assert.equal(audit.colors,5);assert.equal(audit.below,0);assert.equal(audit.edge,0);assert(audit.minPixels>100);assert(audit.maxLight<130);assert(audit.maxChange<.1);assert(audit.cached&&audit.moving&&audit.still);
  await p.evaluate(async()=>{
   Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();const m=outsidePlaytest.model;
   m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};m.x=-15.65;m.time=1;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
  });
  const integration=await p.evaluate(()=>{
   const fx=LunaBarrelFire,paint=fx.paintSprite,ctx=document.querySelector('#outside-root canvas').getContext('2d'),draw=ctx.drawImage,events=[];
   ctx.drawImage=function(im,...args){if(im.src)events.push(im.src);return draw.call(this,im,...args);};
   fx.paintSprite=function(c,key,...args){
    const state=()=>JSON.stringify([c.globalAlpha,c.globalCompositeOperation,c.imageSmoothingEnabled,c.getTransform()]),before=state();
    paint(c,key,...args);if(state()!==before)throw Error('Fire leaked context state');if(key==='B_Obects')events.push('fire');
   };
   try{outsidePlaytest.tick(0);}finally{fx.paintSprite=paint;ctx.drawImage=draw;}
   return {prop:events.findIndex(e=>e.endsWith('Objects/object_1.png')),fire:events.indexOf('fire'),foreground:events.findIndex(e=>e.endsWith('Layers/near_foreground_1.png'))};
  });
  assert(integration.prop>=0&&integration.prop<integration.fire&&integration.fire<integration.foreground);
  await p.screenshot({path:'/private/tmp/barrel-fire-street.png'});
  // An actual camera change must still use the prop-local position.
  for(const x of [-16.3,-15.2]){
   await p.evaluate(x=>{outsidePlaytest.model.x=x;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);},x);
  }
  await p.setViewportSize({width:960,height:600});await p.waitForTimeout(100);await p.screenshot({path:'/private/tmp/barrel-fire-small.png'});
  // Review the native art and FX together at an integer 4x pixel scale.
  await p.setViewportSize({width:1280,height:720});await p.evaluate(async()=>{
   const d=LUNA_OUTSIDE_DATA,n=d.scenes.street.nodes.find(n=>n.name==='B_Obects'),im=new Image();im.src=d.assets[n.sprite.asset].src;await im.decode();
   const c=document.createElement('canvas');c.width=145;c.height=100;c.style='position:fixed;left:350px;top:140px;width:580px;height:400px;image-rendering:pixelated;background:#172430;z-index:999999';document.body.append(c);
   const ctx=c.getContext('2d');ctx.drawImage(im,0,110,145,100,0,0,145,100);
   const sp=n.sprite;ctx.translate(sp.w*sp.pivot.x,sp.h*(1-sp.pivot.y)-110);LunaBarrelFire.paintSprite(ctx,'B_Obects',sp,sp.w,sp.h,1);
  });await p.screenshot({path:'/private/tmp/barrel-fire-detail.png'});
  assert.deepEqual(errors,[]);console.log('BARREL_FIRE_UI_OK',JSON.stringify(audit),JSON.stringify(integration));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
