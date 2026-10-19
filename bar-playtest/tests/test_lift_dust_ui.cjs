const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await page.locator('.updates-confirm').click();
  const result=await page.evaluate(()=>{
   const fx=LunaLiftDust,R=LunaResidence.layout,checks=[];
   function make(){const m=new LunaOutside.Model({place:'bar',day:1,flow:'out'});m.story.cancel();m.backgroundStory.cancel();m.x=R.elevatorX;return m;}
   for(const call of [false,true]){
    const m=make(),duration=call?6:12;m.elevatorY=R.elevatorTop;m.ride={from:R.elevatorTop,to:R.elevatorBottom,time:duration+.4,duration,call};
    m.tick(.04);const before=fx.age(m);m.tick(.02);const contact=fx.age(m),sameRide=m.ride;
    m.tick(.05);const later=fx.age(m);const repeated=fx.land(m,sameRide);
    m.paused=true;m.tick(.05);const paused=fx.age(m);m.paused=false;
    for(let i=0;i<45;i++)m.tick(.05);
    checks.push({call,before,contact,later,repeated,paused,ended:fx.age(m),released:m.ride===null});
   }
   const up=make();up.ride={from:R.elevatorBottom,to:R.elevatorTop,time:12.44,duration:12,call:false};up.tick(.02);const ascent=fx.age(up);
   const reset=make(),r={from:R.elevatorTop,to:R.elevatorBottom,time:12.45,duration:12};fx.land(reset,r);reset.start({day:1,place:'bar'});
   let max=0,ground=0,edge=0,both=false,first=null,last=null;
   for(let f=0;f<Math.ceil(fx.duration*fx.fps);f++){
    const c=fx.render(f/fx.fps);if(!c)continue;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let left=0,right=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
     const a=d[(y*c.width+x)*4+3];max=Math.max(max,a);if(y>44&&a)ground++;if((x===0||x===c.width-1||y===0)&&a)edge++;
     if(a){if(x<96)left++;else right++;}
    }
    if(f===0)first=left+right;if(f===12)both=left>50&&right>50;last=left+right;
   }
   return {checks,ascent,reset:fx.age(reset),max,ground,edge,both,first,last,expired:fx.render(fx.duration)===null};
  });
  for(const c of result.checks){assert.equal(c.before,null);assert(Math.abs(c.contact-.01)<1e-6);assert(Math.abs(c.later-.06)<1e-6);assert.equal(c.repeated,false);assert.equal(c.paused,c.later);assert.equal(c.ended,null);assert(c.released);}
  assert.equal(result.ascent,null);assert.equal(result.reset,null);assert.equal(result.ground,0);assert.equal(result.edge,0);assert(result.both&&result.expired);assert.equal(result.first,0);assert.equal(result.last,0);assert(result.max<=57);
  await page.evaluate(async()=>{
   Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();
   const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;
   m.story.cancel();m.backgroundStory.cancel();m.x=R.elevatorX;m.time=20;m.level=0;m.elevatorY=R.elevatorBottom;m.y=-.7;
   m.ride={from:R.elevatorTop,to:R.elevatorBottom,time:12.44,duration:12,call:false};m.tick(.02);m.ride=null;m.y=-.7;m.tick=()=>{};
   window.liftImpactTime=m.time-LunaLiftDust.age(m);m.time=liftImpactTime+.3;o.snapCamera();o.tick(0);
  });
  const integration=await page.evaluate(()=>{
   const o=outsidePlaytest,ctx=document.querySelector('#outside-root canvas').getContext('2d'),paint=LunaLiftDust.paintSprite;let calls=0,anchor=null;
   LunaLiftDust.paintSprite=function(c,m,key,...args){
    if(key==='Elevator Fore'){
     calls++;anchor={key,age:LunaLiftDust.age(m)};
     const before=JSON.stringify([c.globalAlpha,c.globalCompositeOperation,c.imageSmoothingEnabled,c.getTransform()]);paint(c,m,key,...args);
     if(before!==JSON.stringify([c.globalAlpha,c.globalCompositeOperation,c.imageSmoothingEnabled,c.getTransform()]))throw Error('Canvas state leaked');
    }else paint(c,m,key,...args);
   };
   try{o.tick(0);}finally{LunaLiftDust.paintSprite=paint;}
   return {calls,anchor};
  });
  assert.equal(integration.calls,1);assert(Math.abs(integration.anchor.age-.3)<1e-6);
  await page.screenshot({path:'/private/tmp/lift-landing-dust.png'});
  // Freeze all other visual effects so on/off comparison isolates this effect.
  const reduced=await page.evaluate(()=>{
   const fx=LunaLiftDust,model=outsidePlaytest.model,c=document.createElement('canvas');c.width=220;c.height=100;const ctx=c.getContext('2d');ctx.translate(110,65);
   const sp={w:57,h:100,ppu:100,pivot:{x:.5,y:0}};fx.paintSprite(ctx,model,'Elevator Fore',sp,57,100,true);
   return c.getContext('2d').getImageData(0,0,220,100).data.every(v=>v===0);
  });assert(reduced);
  const fixedGround=await page.evaluate(()=>{
   const m=outsidePlaytest.model,ys=[],ctx={save(){},restore(){},drawImage(c,x,y){ys.push(y);}},sp={w:57,h:100,ppu:100,pivot:{x:.5,y:0}};
   LunaLiftDust.paintSprite(ctx,m,'Elevator Fore',sp,57,100);m.elevatorY+=.1;
   LunaLiftDust.paintSprite(ctx,m,'Elevator Fore',sp,57,100);m.elevatorY-=.1;
   return ys[1]-ys[0];
  });assert(Math.abs(fixedGround-10)<1e-6,'Dust stays on ground if the cabin starts moving again');
  await page.evaluate(()=>{outsidePlaytest.model.time=liftImpactTime+2;outsidePlaytest.tick(0);});
  await page.screenshot({path:'/private/tmp/lift-landing-cleared.png'});
  assert.deepEqual(errors,[]);console.log('LIFT_DUST_UI_OK',JSON.stringify(result),JSON.stringify(integration));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
