const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:0,flow:'in',place:'bar'});await outsidePlaytest.start();});
  await p.waitForFunction(()=>!outsidePlaytest.loading);
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=.35;m.updateNear();outsidePlaytest.snapCamera();});
  const cases=await p.evaluate(()=>{
   const m=outsidePlaytest.model,fn=LunaOutside.firstCommuteEntranceCue,results=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out']){m.config.day=day;m.config.flow=flow;results.push(fn(m)===(day===0&&flow==='in'));}
   m.config.day=0;m.config.flow='in';
   for(const [key,value]of [['scene','home'],['level',1],['qa',{}]]){const old=m[key];m[key]=value;results.push(!fn(m));m[key]=old;}
   lunaCampaign.storyVersion='B';results.push(!fn(m));lunaCampaign.storyVersion='A';
   return results;
  });assert(cases.every(Boolean));
  // Record the rendered paths in world coordinates: they must stay on the road
  // while camera/player motion changes their screen positions.
  const sample=async(t,x)=>p.evaluate(({t,x})=>{
   const o=outsidePlaytest,m=o.model,ctx=document.querySelector('#outside-root canvas').getContext('2d');
   m.time=t;m.x=x;o.snapCamera();
   const original={stroke:ctx.stroke,moveTo:ctx.moveTo,lineTo:ctx.lineTo},paths=[];let path=[];
   ctx.moveTo=function(x,y){path=[[x,y]];return original.moveTo.call(this,x,y);};
   ctx.lineTo=function(x,y){path.push([x,y]);return original.lineTo.call(this,x,y);};
   ctx.stroke=function(){if(this.strokeStyle==='#62e7ff')paths.push({points:path.map(([x,y])=>[(x-640)*o.camera.w/1280+o.camera.x,o.camera.y-(y-360)*o.camera.w/1280]),alpha:this.globalAlpha});return original.stroke.call(this);};
   try{o.tick(0);}finally{Object.assign(ctx,original);}
   return paths;
  },{t,x});
  const a=await sample(0,.35),b=await sample(.6,.35),c=await sample(0,.8);
  assert.equal(a.length,2);assert.equal(b.length,2);
  for(let i=0;i<2;i++)for(let j=0;j<3;j++){
   assert(Math.abs(a[i].points[j][0]-c[i].points[j][0])<1e-6);
   assert(Math.abs(a[i].points[j][1]-c[i].points[j][1])<1e-6);
   assert(a[i].points[j][1]<-.9&&a[i].points[j][1]>-1.3);
   assert(Math.abs(a[i].points[j][1]-b[i].points[j][1])<.02);
  }
  assert.notDeepEqual(a,b);
  await p.emulateMedia({reducedMotion:'reduce'});assert.deepEqual(await sample(0,.35),await sample(1,.35));
  await p.emulateMedia({reducedMotion:'no-preference'});
  await sample(.6,.35);await p.screenshot({path:'/private/tmp/commute-entrance-cue.png'});
  await p.setViewportSize({width:1920,height:1080});await p.screenshot({path:'/private/tmp/commute-entrance-cue-full.png'});
  assert.deepEqual(errors,[]);console.log('PASS: day 0 inbound only, B/home/upper-floor/QA excluded, two cyan ground chevrons, camera anchoring, subtle motion, reduced-motion support.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
