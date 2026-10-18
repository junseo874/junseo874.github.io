const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const results=[];
  for(const [width,height,deviceScaleFactor] of [[1280,720,1],[1920,1080,1],[1440,900,2],[900,700,1.25],[640,360,1]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
   await page.evaluate(()=>outsidePlaytest.start());
   await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
   const result=await page.evaluate(()=>{
    const o=outsidePlaytest,m=o.model,P=LunaPixelCamera,step=o.tick;
    o.tick=()=>{};
    m.start({day:1,flow:'out'});m.story.cancel();m.backgroundStory.cancel();
    m.x=LunaOutside.viewpoint.x;m.updateNear();m.tick=()=>{};o.snapCamera();step(0);
    const normal=o.renderCamera.w,old=P.settledWidth(12,o.pixelSurface),goal=old*2/3*1.3;
    const toggle=()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyY',key:'y',bubbles:true}));
    const sample=target=>{
     const start=o.renderCamera.w,sign=Math.sign(target-start);let previous=start,maxStep=0,t90=null,floor=true;
     for(let i=1;i<=600;i++){
      step(1/60);const v=o.renderCamera,d=v.w-previous;
      if(d*sign < -1e-8)throw Error('Zoom reversed unexpectedly');
      maxStep=Math.max(maxStep,Math.abs(d));previous=v.w;
      if(t90===null&&Math.abs(v.w-target)<=Math.abs(start-target)*.1)t90=i/60;
      floor&&=v.y-v.w*9/32>=-1.48001;
     }
     return {start,end:o.renderCamera.w,t90,maxStep,floor};
    };
    toggle();const enter=sample(goal),camera=o.camera;
    window.panoramaReturn=()=>{toggle();return sample(normal);};
    return {normal,old,goal,enter,camera,render:o.renderCamera,smoothing:document.querySelector('#outside-root canvas').getContext('2d').imageSmoothingEnabled};
   });
   assert(Math.abs(result.enter.end/(result.old*2/3)-1.3)<1e-6,'Visible range must be 1.3x the previous tighter panorama');
   assert(Math.abs(result.camera.w-10.4)<1e-6);
   assert(result.enter.t90>=.916&&result.enter.t90<=.94,'90% zoom takes ~0.92s, twice the old 0.46s');
   assert(result.enter.maxStep/Math.abs(result.goal-result.normal)<.042,'No abrupt first frame');
   assert(result.enter.floor);assert.equal(result.smoothing,false);
   await page.screenshot({path:`/private/tmp/viewpoint-closer-${width}-${deviceScaleFactor}.png`});
   const back=await page.evaluate(()=>panoramaReturn());
   assert(Math.abs(back.end-result.normal)<1e-6);
   assert(back.t90>=.916&&back.t90<=.94,'Return uses same slower easing');
   assert(back.floor);assert.deepEqual(errors,[]);
   results.push({width,deviceScaleFactor,old:result.old,range:result.enter.end,enter90:result.enter.t90,return90:back.t90});
   await page.close();
  }
  console.log('PASS Y panorama: 1.3x wider range, same slower in/out, continuous zoom, floor/nearest sampling, 5 viewport/DPR combinations',results);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
