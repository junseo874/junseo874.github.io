const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const results=[];
  for(const [width,height,deviceScaleFactor]of [[1280,720,1],[1920,1080,1],[1440,900,2],[900,700,1.25],[640,360,1]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
   if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
   await page.evaluate(()=>outsidePlaytest.start());await page.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
   for(const down of [false,true]){
   const result=await page.evaluate(down=>{
    const o=outsidePlaytest,m=o.model,r=LunaResidence.layout,step=o.tick;o.tick=()=>{};
    m.start({day:down?1:3,flow:down?'in':'out',place:down?'homeDoor':'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=r.elevatorX;m.level=down?1:0;
    m.elevatorY=down?r.elevatorTop:r.elevatorBottom;m.y=m.elevatorY+r.passengerOffset;
    m.ride={time:0,from:m.elevatorY,to:down?r.elevatorBottom:r.elevatorTop,call:false,duration:12};o.snapCamera();step(0);
    const fraction=()=>.5+(m.x-o.renderCamera.x)/o.renderCamera.w;
    let prev=fraction(),maxStep=0;const samples=[];
    for(let i=1;i<=420;i++){
     step(1/60);const f=fraction();maxStep=Math.max(maxStep,Math.abs(f-prev));prev=f;
     if(i>=300)samples.push(f);
    }
    window.finishLiftFraming=()=>{for(let i=0;i<720;i++){step(1/60);const f=fraction();maxStep=Math.max(maxStep,Math.abs(f-prev));prev=f;}o.tick=step;return{end:fraction(),maxStep,ride:!!m.ride};};
    return {min:Math.min(...samples),max:Math.max(...samples),maxStep,camera:o.renderCamera,surface:o.pixelSurface};
   },down);
   assert(result.min>.055&&result.max<.065,'Lift must stay at the left 6% across PPU scales: '+JSON.stringify(result));
   await page.screenshot({path:`/private/tmp/lift-right-framing-${down?'down':'up'}-${width}-${deviceScaleFactor}.png`});
   const end=await page.evaluate(()=>finishLiftFraming());
   assert(!end.ride);assert(Math.abs(end.end-.5)<.002,'Return to player framing at arrival');
   assert(end.maxStep<.012,'No lateral framing jump: '+JSON.stringify(end));
   assert.deepEqual(errors,[]);results.push({width,height,deviceScaleFactor,down,min:result.min,max:result.max,...end});
   }
   await context.close();
  }
  console.log('PASS lift at left edge, right-side panorama, smooth boarding/arrival, 5 viewport/DPR combinations',results);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
