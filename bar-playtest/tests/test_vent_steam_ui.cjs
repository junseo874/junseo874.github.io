const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  const audit=await page.evaluate(()=>{
   const fx=LunaVentSteam,results=[];
   for(const source of Object.values(fx.sources).flat()){
    let max=0,minCount=Infinity,edge=0,maxChanged=0,previous=null;
    for(let f=0;f<120;f++){
     const e=fx.render(source,f/fx.fps),ctx=e.canvas.getContext('2d'),w=e.canvas.width,h=e.canvas.height,d=ctx.getImageData(0,0,w,h).data;
     let count=0,changed=0;
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const a=d[(y*w+x)*4+3];max=Math.max(max,a);if(a)count++;
      if((x===0||y===0||x===w-1||y===h-1)&&a)edge++;
      if(previous&&a!==previous[(y*w+x)*4+3])changed++;
     }
     maxChanged=Math.max(maxChanged,changed);minCount=Math.min(minCount,count);previous=d;
    }
    const a=fx.render(source,.2).canvas.toDataURL(),cached=a===fx.render(source,.201).canvas.toDataURL(),moving=a!==fx.render(source,1.8).canvas.toDataURL();
    const still=fx.render(source,1,true).canvas.toDataURL()===fx.render(source,100,true).canvas.toDataURL();
    results.push({id:source.id,max,minCount,edge,maxChanged,cached,moving,still});
   }return results;
  });
  assert.equal(audit.length,4);
  for(const a of audit){assert(a.max<=39&&a.minCount>30,a.id);assert.equal(a.edge,0,a.id+' must fade before its canvas boundary');assert(a.cached&&a.moving&&a.still,a.id);assert(a.maxChanged<500,a.id+' no large frame pop');}
  await page.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();const m=outsidePlaytest.model;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};m.x=.4;m.time=2;outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  const integration=await page.evaluate(()=>{
   const o=outsidePlaytest,c=document.querySelector('#outside-root canvas').getContext('2d'),original=LunaVentSteam.paintSprite,draw=c.drawImage,events=[];
   c.drawImage=function(img,...args){if(img.src)events.push(img.src);return draw.call(this,img,...args);};
   LunaVentSteam.paintSprite=function(ctx,key,...args){
    const state=()=>JSON.stringify([ctx.globalAlpha,ctx.globalCompositeOperation,ctx.imageSmoothingEnabled,[...['a','b','c','d','e','f'].map(k=>ctx.getTransform()[k])]]);
    const before=state();original(ctx,key,...args);if(before!==state())throw Error('Steam leaked canvas state');if(LunaVentSteam.sources[key])events.push(key);
   };
   try{o.tick(0);}finally{LunaVentSteam.paintSprite=original;c.drawImage=draw;}
   const src=name=>LUNA_OUTSIDE_DATA.assets[LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name===name).sprite.asset].src;
   return {events,roof:events.indexOf('B_Fore_Building_1'),roofArt:events.findIndex(e=>e.endsWith(src('B_Fore_Building_1'))),front:events.findIndex(e=>e.endsWith(src('B_ForeFore_Object_1')))};
  });
  assert(integration.roofArt>=0&&integration.roof>integration.roofArt&&integration.front>integration.roof,'Steam stays on its building, behind foreground');
  await page.screenshot({path:'/private/tmp/vent-steam-street.png'});
  await page.evaluate(()=>{const o=outsidePlaytest;o.model.x=-15.3;o.snapCamera();o.tick(0);});
  await page.screenshot({path:'/private/tmp/vent-steam-residence.png'});
  // Pixel-level source crops for visual review; original images remain untouched.
  await page.evaluate(async()=>{
   const root=document.createElement('div');root.style='position:fixed;inset:0;z-index:999999;background:#101923;display:flex;align-items:center;justify-content:center;gap:24px';document.body.append(root);
   for(const [key,crop,scale] of [['B_Fore_Building_1',[590,70,175,100],4],['residence-building',[640,1160,220,230],2]]){
    const node=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name===key),sp=node.sprite,im=new Image();im.src=LUNA_OUTSIDE_DATA.assets[sp.asset].src;await im.decode();
    const c=document.createElement('canvas');c.width=crop[2];c.height=crop[3];c.style=`width:${c.width*scale}px;height:${c.height*scale}px;image-rendering:pixelated`;root.append(c);
    const ctx=c.getContext('2d');ctx.drawImage(im,crop[0],crop[1],c.width,c.height,0,0,c.width,c.height);
    ctx.translate(-crop[0]+sp.w*sp.pivot.x,-crop[1]+sp.h*(1-sp.pivot.y));LunaVentSteam.paintSprite(ctx,key,sp,sp.w,sp.h,2);
   }
  });
  await page.screenshot({path:'/private/tmp/vent-steam-detail.png'});
  assert.deepEqual(errors,[]);console.log('VENT_STEAM_UI_OK',JSON.stringify(audit));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
