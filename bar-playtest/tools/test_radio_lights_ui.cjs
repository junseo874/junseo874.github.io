const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const checks=await p.evaluate(async()=>{
   const f=LunaRadioLights,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1');
   const image=new Image();image.src=LUNA_OUTSIDE_DATA.assets[n.sprite.asset].src;await image.decode();
   const parts=f.prepare(image),cached=f.prepare(image)===parts;
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
   const ctx=c.getContext('2d'),sp={...n.sprite,pivot:{x:0,y:1}};
   function draw(time,still=false,key=n.name){ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image,0,0);f.paintSprite(ctx,key,image,sp,c.width,c.height,time,still);return ctx.getImageData(0,0,c.width,c.height).data;}
   const base=draw(0,false,'unrelated-sprite'),off=draw(1.7),left=draw(.35),right=draw(1.2),still=draw(1.7,true);
   let outsideChanges=0,transparentChanges=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const i=(y*c.width+x)*4,within=parts.some(p=>x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.h);
    if(!within&&[0,1,2,3].some(k=>base[i+k]!==off[i+k]||base[i+k]!==left[i+k]||base[i+k]!==right[i+k]))outsideChanges++;
    if(base[i+3]===0&&(off[i+3]||left[i+3]||right[i+3]))transparentChanges++;
   }
   const brightness=(data,lamp)=>{let sum=0;for(let y=lamp.y-2;y<=lamp.y+2;y++)for(let x=lamp.x-2;x<=lamp.x+2;x++)sum+=data[(y*c.width+x)*4+1];return sum/25;};
   const lights=f.lamps.map((l,i)=>({off:brightness(off,l),on:brightness(i?right:left,l),still:brightness(still,l)}));
   let periodic=true,bounded=true,reduced=true;
   for(let t=0;t<18;t+=.01)for(let i=0;i<2;i++){const v=f.level(t,i);periodic&&=Math.abs(v-f.level(t+f.period*7,i))<1e-10;bounded&&=v>=0&&v<=1;reduced&&=f.level(t,i,true)===1;}
   const create=document.createElement.bind(document);let allocations=0;
   document.createElement=function(tag,...rest){if(tag==='canvas')allocations++;return create(tag,...rest);};
   try{for(let i=0;i<100;i++)f.paintSprite(ctx,n.name,image,sp,c.width,c.height,i/60);}finally{document.createElement=create;}
   ctx.globalAlpha=.4;ctx.globalCompositeOperation='multiply';ctx.imageSmoothingEnabled=false;
   f.paintSprite(ctx,n.name,image,sp,c.width,c.height,.35);
   const restored=ctx.globalAlpha===.4&&ctx.globalCompositeOperation==='multiply'&&!ctx.imageSmoothingEnabled;
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   const preview=document.createElement('canvas');preview.id='radio-preview';preview.width=1200;preview.height=360;
   const pc=preview.getContext('2d');pc.fillStyle='#101b2b';pc.fillRect(0,0,1200,360);pc.imageSmoothingEnabled=false;
   [.35,1.7,1.2].forEach((t,i)=>{draw(t);pc.drawImage(c,485,70,100,90,i*400,0,400,360);});
   preview.style.cssText='position:fixed;left:0;top:0;z-index:2147483647';document.body.append(preview);
   return {cached,outsideChanges,transparentChanges,lights,periodic,bounded,reduced,allocations,restored};
  });
  assert(checks.cached&&checks.periodic&&checks.bounded&&checks.reduced&&checks.restored,JSON.stringify(checks));
  assert.equal(checks.outsideChanges,0);assert.equal(checks.transparentChanges,0);assert.equal(checks.allocations,0);
  for(const l of checks.lights){assert(l.on>l.off*1.6,JSON.stringify(l));assert(Math.abs(l.on-l.still)<1);}
  await p.locator('#radio-preview').screenshot({path:'/private/tmp/radio-lamps-phases.png'});
  await p.evaluate(()=>{
   document.getElementById('radio-preview').remove();
   const a=outsidePlaytest,m=a.model,n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='B_Fore_Building_1');
   m.start({day:3,flow:'out',place:'bar'});m.x=n.x+(523-n.sprite.w*n.sprite.pivot.x)/n.sprite.ppu;
   m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};a.snapCamera();
   window.radioCalls=[];const paint=LunaRadioLights.paintSprite;
   LunaRadioLights.paintSprite=function(ctx,key,image,sp,w,h,time,still){if(key==='B_Fore_Building_1')radioCalls.push({time,still,w,h});return paint(...arguments);};
   m.time=.35;a.tick(0);
  });
  await p.waitForTimeout(80);await p.screenshot({path:'/private/tmp/radio-lamps-street-on.png'});
  await p.evaluate(()=>{outsidePlaytest.model.time=1.7;outsidePlaytest.tick(0);});
  await p.waitForTimeout(80);await p.screenshot({path:'/private/tmp/radio-lamps-street-off.png'});
  assert(await p.evaluate(()=>radioCalls.some(c=>c.time===.35)&&radioCalls.some(c=>c.time===1.7)));
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(80);
  assert(await p.evaluate(()=>radioCalls.at(-1).still));
  await p.setViewportSize({width:960,height:720});await p.waitForTimeout(80);
  assert(await p.evaluate(()=>radioCalls.at(-1).w>0&&radioCalls.at(-1).h>0));
  assert.deepEqual(errors,[]);
  console.log('PASS two periodic phase-offset lamps, baked spill dimming, untouched surroundings/alpha, reduced motion, zero per-frame canvas allocations, canvas state restoration, live renderer and resize. '+JSON.stringify(checks.lights));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
