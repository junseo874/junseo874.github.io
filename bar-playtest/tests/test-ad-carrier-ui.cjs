const assert=require('node:assert/strict'),runtime=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await runtime.load('playwright').chromium.launch({executablePath:runtime.chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  p.on('request',r=>{if(r.url().includes('/vehicles/'))requests.push(r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await p.locator('.updates-confirm').click();await p.locator('[data-outside-action="start"]').click();
  await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.keyboard.press('Space'); // dismiss the developer entry hint before freezing ticks
  assert.equal(requests.length,1,'Carrier preloads once before play');
  const audit=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,A=LunaOutsideAdCarrier;
   window.paintCarrierScene=o.tick;o.tick=()=>{};
   m.start({day:3,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};
   m.x=-8.78;m.time=0;o.snapCamera();LunaCaptureMode.set(true);
   const c=document.querySelector('#outside-root canvas').getContext('2d'),draw=c.drawImage,adDraw=A.draw,events=[];
   let image;
   c.drawImage=function(im,...args){events.push(im.src||'canvas');return draw.call(this,im,...args);};
   A.draw=function(...args){events.push('ad-carrier');image=args[4].get(A.assetId);
    const state=()=>JSON.stringify([c.globalAlpha,c.globalCompositeOperation,c.imageSmoothingEnabled,c.imageSmoothingQuality,c.getTransform()]);
    const before=state();adDraw(...args);if(before!==state())throw Error('Carrier leaked context state');};
   try{paintCarrierScene(0);}finally{c.drawImage=draw;A.draw=adDraw;}
   const asset=name=>LUNA_OUTSIDE_DATA.assets[LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name===name).sprite.asset].src;
   const at=name=>events.findIndex(e=>e.endsWith(asset(name)));
   const order={carrier:events.indexOf('ad-carrier'),back:at('C_Back_Building_1'),farMiddle:at('C_Middle_Building_3'),middle:at('C_Middle_Building_1'),middle2:at('C_Middle_Building_2'),residence:at('residence-building'),fence:at('Fence'),shop:at('B_Fore_Building_1')};
   order.display1=at('C_Middle_Object_1');order.display2=at('C_Middle_Object_2');
   window.carrierTestImage=image;
   // Both edges must already show the new ad at the exact boundary, not the
   // outgoing ad sliding across the display. These pixels avoid scanlines/text.
   for(const [time,rgb] of [[5,[40,24,47]],[10,[48,37,27]]]){
    const pc=A.render(image,time,-1).getContext('2d');
    for(const x of [117,245])if(JSON.stringify(Array.from(pc.getImageData(x*A.rasterScale,56*A.rasterScale,1,1).data))!==JSON.stringify([...rgb,255]))throw Error('Ad did not hard-cut at '+time);
   }
   const region=direction=>{const out=A.render(image,1,direction),x=direction>0?71:115,s=A.rasterScale;
    if(out.width!==1280||out.height!==512)throw Error('Carrier detail was downsampled back to 320px');
    return Array.from(out.getContext('2d').getImageData(x*s,55*s,134*s,36*s).data);};
   const left=region(-1),right=region(1);
   const data=t=>A.render(image,t,1).toDataURL();
   const a=data(1),b=data(6),d=data(11),animated=data(1.5);
   const repeat=data(1.5);
   const still=A.render(image,0,1,true).toDataURL()===A.render(image,99,1,true).toDataURL();
   const opaqueCanvas=document.createElement('canvas');opaqueCanvas.width=320;opaqueCanvas.height=128;
   const oc=opaqueCanvas.getContext('2d'),ims=new Map([[A.assetId,image]]);
   const sample=background=>{oc.globalAlpha=1;oc.fillStyle=background;oc.fillRect(0,0,320,128);
    oc.globalAlpha=.3;A.draw(oc,{scene:'street',time:0},{x:-7.85,y:0,w:A.routes[0].width*4},(_x,y)=>({x:y>5?-10000:160,y:64}),ims);
    if(oc.globalAlpha!==.3)throw Error('Opacity leaked');
    return [oc.getImageData(42,62,1,1).data,oc.getImageData(100,72,1,1).data].map(p=>Array.from(p));};
   const darkSamples=sample('#000000'),lightSamples=sample('#ffffff');
   const opaque=JSON.stringify(darkSamples)===JSON.stringify(lightSamples);
   // Fractional window scales and Retina must sample the high-resolution cache
   // with filtered scaling and an integer physical-pixel destination origin.
   const rawDraw=oc.drawImage;
   for(const factor of [.625,1,2,3]){
    oc.setTransform(factor,0,0,factor,.25,.75);
    oc.drawImage=function(im,x,y,...rest){
     if(im.width!==1280||!this.imageSmoothingEnabled||this.imageSmoothingQuality!=='high')throw Error('Low quality carrier sampling');
     for(const value of [x*factor+.25,y*factor+.75])if(Math.abs(value-Math.round(value))>1e-8)throw Error('Subpixel carrier origin');
     return rawDraw.call(this,im,x,y,...rest);
    };
    A.draw(oc,{scene:'street',time:0},{x:-7.85,y:0,w:9.73},()=>({x:160.33,y:64.17}),ims);
   }
   oc.drawImage=rawDraw;
   return {order,opaque,darkSamples,lightSamples,decoded:image.complete&&image.naturalWidth===1983,distinct:new Set([a,b,d]).size,animated:a!==animated,repeat:animated===repeat,still,
    readableBothWays:left.every((v,i)=>Math.abs(v-right[i])<=1),differentSamples:left.reduce((n,v,i)=>n+(v!==right[i]),0),maxDifference:left.reduce((n,v,i)=>Math.max(n,Math.abs(v-right[i])),0)};
  });
  console.log('Carrier render audit',audit);
  // The browser's translated glyph rasterizer may round an AA channel by one.
  assert(audit.decoded&&audit.opaque&&audit.animated&&audit.repeat&&audit.still&&audit.readableBothWays,JSON.stringify(audit));
  assert.equal(audit.distinct,3);
  assert(audit.order.carrier>=0&&audit.order.carrier<audit.order.fence&&audit.order.carrier<audit.order.shop);
  assert(audit.order.back>=0&&audit.order.back<audit.order.carrier);
  assert(audit.order.farMiddle>=0&&audit.order.farMiddle<audit.order.carrier,'Far middle sheet is now behind the carrier');
  for(const name of ['middle','middle2','display1','display2'])
   assert(audit.order[name]>=0&&audit.order[name]<audit.order.carrier,name+' and its display effects stay behind the carrier');
  await p.screenshot({path:'/private/tmp/ad-carrier-street.png'});
  // The original sprite stays unmodified; close-up shows actual runtime LED frames.
  await p.evaluate(()=>{const c=document.createElement('canvas');c.id='ad-carrier-proof';c.width=960;c.height=384;c.style='position:fixed;inset:0;z-index:999999;background:#101922;width:960px;height:384px';document.body.append(c);});
  for(const [name,time]of [['data',1],['bar',6],['repair',11],['hard-cut',5]]){
   await p.evaluate(time=>{const c=document.querySelector('#ad-carrier-proof').getContext('2d');c.clearRect(0,0,960,384);c.imageSmoothingEnabled=false;c.drawImage(LunaOutsideAdCarrier.render(carrierTestImage,time,1),0,0,960,384);},time);
   await p.locator('#ad-carrier-proof').screenshot({path:'/private/tmp/ad-carrier-'+name+'.png'});
  }
  await p.evaluate(()=>document.querySelector('#ad-carrier-proof').remove());
  const before=await p.evaluate(()=>JSON.stringify(LunaOutsideAdCarrier.vehicles(outsidePlaytest.model)));
  const widthBefore=await p.evaluate(()=>outsidePlaytest.camera.w);
  await p.keyboard.press('KeyY');await p.evaluate(()=>{for(let i=0;i<150;i++)paintCarrierScene(.016);});
  assert(await p.evaluate(()=>outsidePlaytest.camera.w)>widthBefore+3,'Real panorama zoom ran');
  await p.screenshot({path:'/private/tmp/ad-carrier-panorama.png'});
  const visibility=await p.evaluate(()=>{
   const A=LunaOutsideAdCarrier,route=A.routes[0],oldY=route.y,oldPhase=route.phase,draw=A.draw;
   const c=document.querySelector('#outside-root canvas'),ctx=c.getContext('2d');
   A.draw=()=>{};paintCarrierScene(0);const base=ctx.getImageData(0,0,c.width,c.height).data;A.draw=draw;
   const result=[];
try{for(const [x,y] of [[-11,oldY],[-9,oldY],[-7,oldY],[-9,.95]]){route.y=y;route.phase=(x-A.flightBounds.left)/(A.flightBounds.right-A.flightBounds.left)*route.duration;paintCarrierScene(0);const d=ctx.getImageData(0,0,c.width,c.height).data;let changed=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-base[i])+Math.abs(d[i+1]-base[i+1])+Math.abs(d[i+2]-base[i+2])>5)changed++;result.push({x,y:route.y,changed});}}
   finally{route.y=oldY;route.phase=oldPhase;A.draw=draw;paintCarrierScene(0);}
   return result;
  });
  console.log('Carrier visibility',visibility);
  assert(visibility.slice(0,3).every(v=>v.changed>500),'Carrier now passes in front of the far middle sheet');
  assert(visibility[3].changed>500,'Low flight stays visible in front of middle buildings and displays');
  assert.equal(await p.evaluate(()=>JSON.stringify(LunaOutsideAdCarrier.vehicles(outsidePlaytest.model))),before,'Camera never restarts traffic or ad timer');
  await p.setViewportSize({width:800,height:600});await p.waitForTimeout(100);await p.evaluate(()=>paintCarrierScene(0));
  await p.screenshot({path:'/private/tmp/ad-carrier-small.png'});
  for(const [width,height]of [[1920,1080],[2560,1440]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);await p.evaluate(()=>paintCarrierScene(0));
   await p.screenshot({path:'/private/tmp/ad-carrier-'+width+'.png'});
  }
  await p.setViewportSize({width:800,height:600});await p.waitForTimeout(100);
  const residenceOrder=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,A=LunaOutsideAdCarrier;
   m.x=-13;m.y=7;m.time=(23/29*124-52)/A.travelRate;o.snapCamera();
   const c=document.querySelector('#outside-root canvas').getContext('2d'),draw=c.drawImage,ad=A.draw,events=[];
   const node=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building'),src=LUNA_OUTSIDE_DATA.assets[node.sprite.asset].src;
   c.drawImage=function(im,...args){if(im.src?.endsWith(src))events.push('residence');return draw.call(this,im,...args);};
   A.draw=function(...args){events.push('carrier');return ad(...args);};
   try{paintCarrierScene(0);}finally{c.drawImage=draw;A.draw=ad;}
   return events;
  });
  assert.deepEqual(residenceOrder,['carrier','residence'],'Apartment hides the carrier, not the reverse');
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.start({day:0,flow:'out',place:'homeDoor'});m.story.cancel();m.backgroundStory.cancel();m.x=LunaResidence.layout.elevatorX;m.ride={time:7,from:LunaResidence.layout.elevatorBottom,to:LunaResidence.layout.elevatorTop,call:false,duration:12};m.elevatorY=5.4;m.y=5.782;m.time=10;o.snapCamera();for(let i=0;i<150;i++)paintCarrierScene(.016);});
  await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(100);await p.evaluate(()=>paintCarrierScene(0));
  const painted=await p.evaluate(()=>{const c=document.querySelector('#outside-root canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let min=255,max=0;for(let i=0;i<d.length;i+=64){min=Math.min(min,d[i]);max=Math.max(max,d[i]);}return max-min;});
  assert(painted>50,'Lift capture contains a rendered world after canvas resize');
  await p.screenshot({path:'/private/tmp/ad-carrier-lift.png'});
  assert.equal(requests.length,1,'No image loads while switching ads, resizing or riding');
  assert.deepEqual(errors,[]);console.log('AD_CARRIER_UI_OK',audit);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
