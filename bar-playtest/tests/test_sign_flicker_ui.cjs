const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const result=await p.evaluate(async()=>{
   const fx=LunaStreetSigns,d=LUNA_OUTSIDE_DATA,out=[];
   for(let t=0;t<120;t+=1/120){
    if(fx.faults.filter(f=>fx.faultLevel(f.id,t)<1).length>1)throw Error('Simultaneous outages');
    if(fx.faults.some(f=>fx.faultLevel(f.id,t,true)!==1))throw Error('Reduced motion flickered');
   }
   for(const f of fx.faults){
    const node=d.scenes.street.nodes.find(n=>n.id===f.id),sp=node.sprite,im=new Image();im.src=d.assets[sp.asset].src;await im.decode();
    let off=0;for(let t=0;t<20;t+=.01)if(fx.faultLevel(f.id,t)<.1){off=t;break;}
    if(!off)throw Error('No fault episode');
    const c=document.createElement('canvas');c.width=sp.w+60;c.height=sp.h+60;const ctx=c.getContext('2d');
    const frame=(time,still=false)=>{ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#07111b';ctx.fillRect(0,0,c.width,c.height);ctx.save();ctx.translate(30,30);fx.paint(ctx,im,{...sp,pivot:{x:0,y:1}},sp.w,sp.h,f.id,time,still);ctx.restore();return ctx.getImageData(0,0,c.width,c.height).data;};
    const on=frame(0),dim=frame(off),again=frame(off),reduced=frame(off,true);
    const [x,y,w,h]=f.region;let delta=0,base=0,leaks=0,changed=0;
    for(let py=0;py<c.height;py++)for(let px=0;px<c.width;px++){
     const i=(py*c.width+px)*4,dx=px-30+sp.x,dy=py-30+sp.y;
     let difference=0;for(let k=0;k<3;k++){difference+=Math.abs(on[i+k]-dim[i+k]);if(dim[i+k]!==again[i+k])throw Error('Pause unstable');if(on[i+k]!==reduced[i+k])throw Error('Reduced motion changed source');}
     if(dx>=x&&dx<x+w&&dy>=y&&dy<y+h){delta+=difference;base+=on[i]+on[i+1]+on[i+2];}
     if(difference){changed++;if(dx<x-24||dx>=x+w+24||dy<y-24||dy>=y+h+24)leaks++;}
    }
    const siblingRects=f.id.endsWith('vertical-left')?[[0,60,15,29]]:f.id.endsWith('restaurant-cluster')?[[718,36,31,29],[718,106,31,29]]:f.id.endsWith('upper-left')?[[32,40,28,28],[88,57,25,13],[28,70,87,8]]:f.id.endsWith('shiba-cluster')?[[95,125,12,11],[97,137,14,28],[113,118,17,49]]:[];
    const siblings=siblingRects.map(([sx,sy,sw,sh])=>{let a=0,b=0;for(let y=sy;y<sy+sh;y++)for(let x=sx;x<sx+sw;x++){const i=((y-sp.y+30)*c.width+x-sp.x+30)*4;for(let k=0;k<3;k++){a+=on[i+k];b+=Math.abs(on[i+k]-dim[i+k]);}}return b/a;});
    const create=document.createElement.bind(document);let allocations=0;document.createElement=(tag,...rest)=>{if(tag==='canvas')allocations++;return create(tag,...rest);};try{frame(off+.02);}finally{document.createElement=create;}
    const outlinePoints=f.letterMask==='outlined-d'?[[65,43],[86,50],[62,67]]:f.letterMask==='top-letter'?[[95,110],[102,110],[98,120]]:[];
    const outlines=outlinePoints.map(([x,y])=>{const i=((y-sp.y+30)*c.width+x-sp.x+30)*4;let lit=0,unlit=0;for(let k=0;k<3;k++){lit+=on[i+k];unlit+=dim[i+k];}return {x,y,drop:1-unlit/lit};});
    out.push({id:f.id,off,tubeOnly:!!f.letterMask,dimming:delta/base,leaks,changed,siblings,allocations,outlines});
   }
   return out;
  });
  for(const r of result){assert(r.dimming>(r.tubeOnly?.08:.45),JSON.stringify(r));assert.equal(r.leaks,0,r.id);assert(r.siblings.every(v=>v<.06),JSON.stringify(r));assert.equal(r.allocations,0);assert(r.outlines.every(p=>p.drop>.5),'Gold letter outlines must switch off with the core: '+JSON.stringify(r));}
  for(const [id,x]of [['service-strip',-1.7],['vertical-left',-4.4],['restaurant-cluster',2.5],['shiba-cluster',-3.1],['upper-left',-3.8]]){
   const off=result.find(r=>r.id==='street-neon-'+id).off;
   await p.evaluate(x=>{const o=outsidePlaytest,m=o.model;m.start({day:1,flow:'out',place:'bar'});m.x=x;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};o.snapCamera();},x);
   for(const [state,time]of [['on',0],['off',off]]){await p.evaluate(time=>{outsidePlaytest.model.time=time;outsidePlaytest.tick(0);},time);await p.screenshot({path:'/private/tmp/sign-flicker-'+id+'-'+state+'.png'});}
  }
  assert.deepEqual(errors,[]);console.log('PASS independent staggered faults, selected tube only, sibling preservation, bloom coupling, pause/reduced motion, cached frames and five street views',result);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
