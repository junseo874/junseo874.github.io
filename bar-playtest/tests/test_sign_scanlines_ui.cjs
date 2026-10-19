const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  // Reference exclusions include the hanging restaurant menu added at 06:28.
  const excluded=await p.evaluate(()=>{
   const groups={B_Fore_Building_1:[['convenience',48,217,144,24],['purple-ad',331,112,57,27],['terraco',333,180,57,22],['restaurant-menu',770,65,170,45],['restaurant-vertical',975,81,13,116],['right-store-display',1207,249,78,29],['phone-number',1235,293,50,8]],C_Middle_Building_1:[['portrait-blue',1080,504,134,88],['green-strip',1432,515,89,20]]};
   const results=[];
   for(const [key,regions]of Object.entries(groups))for(const [id,x,y,w,h]of regions){
    let painted=0;
    for(const time of [0,.2,1.4,5,12]){
     const e=LunaSignScanlines.render(key,time),ctx=e.canvas.getContext('2d');
     const left=Math.max(x,e.x),top=Math.max(y,e.y),right=Math.min(x+w,e.x+e.canvas.width),bottom=Math.min(y+h,e.y+e.canvas.height);
     if(right<=left||bottom<=top)continue;
     const pixels=ctx.getImageData(left-e.x,top-e.y,right-left,bottom-top).data;
     for(let i=3;i<pixels.length;i+=4)if(pixels[i])painted++;
    }
    results.push({id,painted,registered:LunaSignScanlines.masks[key].some(r=>r.id===id)});
   }
   return results;
  });
  for(const r of excluded){assert.equal(r.registered,false,r.id);assert.equal(r.painted,0,r.id+' must receive no scanlines');}
  const terraceAudit=await p.evaluate(()=>{
   const fx=LunaSignScanlines,regions=fx.masks.terrace;
   let roofPixels=0,facadePixels=0,splitRows=0,maximumAlpha=0;
   for(const t of [0,.2,.6,1.4,3,8,20]){
    const e=fx.render('terrace',t),c=document.createElement('canvas');c.width=480;c.height=270;
    const ctx=c.getContext('2d');ctx.drawImage(e.canvas,e.x,e.y);const d=ctx.getImageData(0,0,480,270).data;
    const a=(x,y)=>d[(y*480+x)*4+3];
    for(let y=0;y<270;y++)for(let x=0;x<480;x++){maximumAlpha=Math.max(maximumAlpha,a(x,y));if(y>=145&&a(x,y))roofPixels++;if(x>=400&&a(x,y))facadePixels++;}
    // Both sides of the upper portrait share exactly the same scanline phase.
    for(let y=25;y<57;y++)if(a(254,y)!==a(288,y))splitRows++;
   }
   return {count:regions.length,roofPixels,facadePixels,splitRows,maximumAlpha,ids:regions.map(r=>r.id)};
  });
  assert.equal(terraceAudit.count,8);assert.equal(terraceAudit.roofPixels,0);assert.equal(terraceAudit.facadePixels,0);assert.equal(terraceAudit.splitRows,0);assert(terraceAudit.maximumAlpha<=32);
  for(const id of ['upper-purple','woman-tall','pink-strip','right-top','right-lower','right-pink-strip','pink-vertical'])assert(!terraceAudit.ids.includes(id),id);
  const audit=await p.evaluate(()=>{
   const fx=LunaSignScanlines,out=[];
   const inside=(x,y,points)=>{let result=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
   for(const [key,regions]of Object.entries(fx.masks)){
    const a=fx.render(key,.2),first=a.canvas.toDataURL(),same=fx.render(key,.21),cached=first===same.canvas.toDataURL();
    const b=fx.render(key,1.4),moved=first!==b.canvas.toDataURL(),ctx=b.canvas.getContext('2d'),data=ctx.getImageData(0,0,b.canvas.width,b.canvas.height).data;
    let alpha=0,painted=0,leaks=0;
    for(let y=0;y<b.canvas.height;y++)for(let x=0;x<b.canvas.width;x++){
     const value=data[(y*b.canvas.width+x)*4+3];if(!value)continue;painted++;alpha=Math.max(alpha,value);
     // Permit antialias coverage only at the polygon edge (<= one native pixel).
     if(![[.5,.5],[0,0],[1,0],[0,1],[1,1]].some(([dx,dy])=>regions.some(r=>inside(x+b.x+dx,y+b.y+dy,r.points))))leaks++;
    }
    const still=fx.render(key,0,true).canvas.toDataURL(),stable=still===fx.render(key,100,true).canvas.toDataURL();
    out.push({key,count:regions.length,cached,moved,painted,alpha,leaks,stable});
   }return out;
  });
  for(const a of audit){assert(a.cached&&a.moved&&a.stable&&a.painted>0,JSON.stringify(a));assert.equal(a.leaks,0,a.key);assert(a.alpha<=65,'No opaque bands or flashes');}
  await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();const m=outsidePlaytest.model;m.x=-.5;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};outsidePlaytest.snapCamera();m.time=.2;outsidePlaytest.tick(0);});
  await p.screenshot({path:'/private/tmp/scanlines-street.png'});
  const actual=await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.time=.2;o.tick(0);const a=document.querySelector('#outside-root canvas').toDataURL();m.time=1.4;o.tick(0);return a!==document.querySelector('#outside-root canvas').toDataURL();});assert(actual);
  await p.evaluate(()=>lunaCampaign.scene('night0','테라스','terrace',()=>{}));await p.waitForFunction(()=>!lunaCampaign.memoryTransition);
  await p.evaluate(()=>{lunaCampaign.tick=()=>{};lunaCampaign.dialog.terraceTime=.2;lunaCampaign.dialog.chars=1e5;lunaCampaign.paintLine();});
  const canvas=p.locator('.terrace-sign-scanlines'),first=await canvas.evaluate(e=>e.toDataURL());
  await p.evaluate(()=>{lunaCampaign.dialog.terraceTime=1.4;lunaCampaign.paintLine();});assert.notEqual(await canvas.evaluate(e=>e.toDataURL()),first);
  await p.screenshot({path:'/private/tmp/scanlines-terrace.png'});
  assert.deepEqual(await p.locator('.terrace-art').evaluate(e=>[...e.children].map(n=>n.className)),['terrace-city','terrace-sign-scanlines','terrace-building','terrace-characters','terrace-balustrade']);
  await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>lunaCampaign.paintLine());const still=await canvas.evaluate(e=>e.toDataURL());await p.evaluate(()=>{lunaCampaign.dialog.terraceTime=30;lunaCampaign.paintLine();});assert.equal(await canvas.evaluate(e=>e.toDataURL()),still);
  // Mask review contact sheet, not game art or exported assets.
  await p.setViewportSize({width:1400,height:800});await p.evaluate(async()=>{
   const root=document.createElement('div');root.style='position:fixed;inset:0;background:#18232f;z-index:999999;overflow:auto';document.body.append(root);
   for(const key of Object.keys(LunaSignScanlines.masks)){
    const src=key==='terrace'?LunaTerrace.assets.city:LUNA_OUTSIDE_DATA.assets[LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name===key).sprite.asset].src;
    const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.dataset.audit=key;c.width=im.width;c.height=im.height;c.style='display:block;max-width:1380px';root.append(c);const ctx=c.getContext('2d');ctx.drawImage(im,0,0);ctx.strokeStyle='#fc4d60';ctx.lineWidth=1;
    for(const r of LunaSignScanlines.masks[key]){ctx.beginPath();r.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();}
   }
  });await p.screenshot({path:'/private/tmp/scanlines-mask-audit.png'});
  for(const key of ['C_Middle_Building_1','C_Middle_Building_2','C_Middle_Building_3'])await p.locator('[data-audit="'+key+'"]').screenshot({path:'/private/tmp/scanlines-mask-'+key+'.png'});
  assert.deepEqual(errors,[]);console.log('PASS '+audit.reduce((s,a)=>s+a.count,0)+' sign masks: no outside pixels, restrained opacity, cached motion, reduced-motion static, street/terrace integration and foreground occlusion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
