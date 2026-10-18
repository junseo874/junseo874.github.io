const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio','--disable-gpu']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const audit=await p.evaluate(async()=>{
   const fx=LunaWallLighting,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1'),im=new Image();im.src=LUNA_OUTSIDE_DATA.assets[n.sprite.asset].src;await im.decode();
   const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const src=ctx.getImageData(0,0,c.width,c.height).data;
   const r=fx.render(im),pixels=r.canvas.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const walls=fx.regions.filter(r=>!r.target||r.target==='B_Fore_Building_1');
   let transparent=0,dark=0,outside=0,wrongFacade=0;const counts=Object.fromEntries(walls.map(r=>[r.id,0]));
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(!pixels[i+3])continue;if(src[i+3]<200)transparent++;if(Math.max(src[i],src[i+1],src[i+2])<25)dark++;const hits=walls.filter(r=>fx.coverage(r,x,y)>0);if(!hits.length)outside++;for(const r of hits)counts[r.id]++;
    // User's two red-circled facades: not receivers, even if the shared
    // atlas has opaque blue trim inside an engine light's broad polygon.
    if(x>=380&&x<432||x>=1012&&x<1178)wrongFacade++;
   }
   const before=c.toDataURL();fx.render(im);const unchanged=before===c.toDataURL();
   const floor=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='1F Floor'),fi=new Image();fi.src=LUNA_OUTSIDE_DATA.assets[floor.sprite.asset].src;await fi.decode();
   const fr=fx.render(fi,'1F Floor'),fc=document.createElement('canvas');fc.width=fi.width;fc.height=fi.height;const fctx=fc.getContext('2d');fctx.drawImage(fi,0,0);const fs=fctx.getImageData(0,0,fi.width,fi.height).data,fp=fr.canvas.getContext('2d').getImageData(0,0,fi.width,fi.height).data,ground=fx.regions.filter(r=>r.target==='1F Floor');
   for(const r of ground)counts[r.id]=0;
   let floorLeaks=0;for(let y=0;y<fi.height;y++)for(let x=0;x<fi.width;x++){const i=(y*fi.width+x)*4;if(!fp[i+3])continue;const hits=ground.filter(r=>fx.coverage(r,x,y)>0);if(fs[i+3]<200||!hits.length)floorLeaks++;for(const r of hits)counts[r.id]++;}
   return {counts,transparent,dark,outside,wrongFacade,floorLeaks,unchanged,cached:r===fx.render(im)&&fr===fx.render(fi,'1F Floor'),pixels:r.pixels};
  });
  assert(audit.pixels>1000);assert.equal(Object.keys(audit.counts).length,10);assert(Object.values(audit.counts).every(n=>n>0),JSON.stringify(audit));assert.equal(audit.transparent,0);assert.equal(audit.dark,0);assert.equal(audit.outside,0);assert.equal(audit.wrongFacade,0,'No glow on Shiba facade or neighbouring balcony');assert.equal(audit.floorLeaks,0);assert(audit.cached&&audit.unchanged);
  for(const [id,x]of [['convenience',-5.8],['karaoke',-4.4],['port',-1.7],['restaurant-left',1.4],['restaurant',3.5],['right-store',5.5]]){
   await p.evaluate(x=>{const o=outsidePlaytest,m=o.model;m.start({day:1,flow:'out',place:'bar'});m.x=x;m.time=0;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};o.snapCamera();o.tick(0);},x);
   const rendered=await p.evaluate(()=>{
    const fx=LunaWallLighting,paint=fx.paintSprite,o=outsidePlaytest,c=document.querySelector('#outside-root canvas'),ctx=c.getContext('2d'),mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const mc=mask.getContext('2d');
    fx.paintSprite=()=>{};o.tick(0);const before=ctx.getImageData(0,0,c.width,c.height).data;
    fx.paintSprite=function(ctx,key,image,sp,w,h){paint(...arguments);if(key!=='B_Fore_Building_1')return;mc.setTransform(ctx.getTransform());mc.imageSmoothingEnabled=false;const sx=w/sp.w;for(const [x,width]of [[380,52],[1012,68]])mc.drawImage(image,x,sp.y,width,sp.h,-w*sp.pivot.x+(x-sp.x)*sx,-h*(1-sp.pivot.y),width*sx,h);};
    try{o.tick(0);}finally{fx.paintSprite=paint;}
    const after=ctx.getImageData(0,0,c.width,c.height).data,cover=mc.getImageData(0,0,c.width,c.height).data;let changes=0,leaks=0;
    // Software rendering keeps readback/compositing deterministic, so the
    // excluded facades must remain byte-identical, not merely look darker.
    for(let i=0;i<after.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]){changes++;if(cover[i+3]===255)leaks++;}
    return {changes,leaks};
   });assert(rendered.changes>0,id+' remains lit');assert.equal(rendered.leaks,0,id+' must not light either marked neighbouring facade '+JSON.stringify(rendered));
   await p.screenshot({path:'/private/tmp/wall-light-'+id+'.png'});
  }
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.x=-8.78;o.snapCamera();});await p.keyboard.press('KeyY');await p.waitForTimeout(1200);
  await p.screenshot({path:'/private/tmp/wall-light-panorama.png'});
  const rays=await p.evaluate(()=>{const o=outsidePlaytest,c=document.querySelector('#outside-root canvas').getContext('2d'),rotate=c.rotate,angles=[];c.rotate=function(a){angles.push(a);return rotate.call(this,a);};try{for(const x of [-15,-10,-6,-2,3]){o.model.x=x;o.snapCamera();o.tick(0);}}finally{c.rotate=rotate;}return LunaWallLighting.cityRays.every(r=>angles.some(a=>Math.abs(a+r.rotation)<1e-8));});assert(rays,'All five engine ray rotations must reach the actual renderer');
  assert.deepEqual(errors,[]);console.log('PASS all ten engine atmospheric lights, correct wall/floor receivers, no light on black foreground details or excluded facades, cached native resolution and six street views',audit);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
