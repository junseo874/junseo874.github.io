const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
require('../pixel-camera.js');const P=globalThis.LunaPixelCamera;
for(const [w,h,dpr]of [[1280,720,1],[1920,1080,1],[1440,900,2],[900,700,1.25],[640,360,1]]){
 const s=P.surface(w,h,dpr),a=P.settledWidth(4.8,s),b=P.settledWidth(12.8,s);
 for(const reverse of [false,true]){
  let current=reverse?b:a,maxJump=0;const unique=new Set();
  for(let i=0;i<720;i++){
   const t=Math.min(1,i/180),ease=t*t*(3-2*t),goal=t===1?(reverse?a:b):reverse?b+(a-b)*ease:a+(b-a)*ease;
   const next=P.approachWidth(current,goal,1/60);maxJump=Math.max(maxJump,Math.abs(next/current-1));
   assert(reverse?next<=current+1e-9:next>=current-1e-9);current=next;unique.add(current.toFixed(4));
  }
  assert.equal(current,reverse?a:b,'Exact native-pixel endpoint');assert(maxJump<.025,'No integer-scale jumps');
  assert(unique.size>150,'Continuous intermediate widths');
 }
}
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.evaluate(()=>{window.stepOutsideZoom=outsidePlaytest.tick;outsidePlaytest.tick=()=>{};});
  const results=[];
  for(const reverse of [false,true]){
   await p.evaluate(reverse=>{const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.start({day:3,flow:'out',place:reverse?'homeDoor':'bar'});m.story.cancel();m.backgroundStory.cancel();m.x=R.elevatorX;m.elevatorY=reverse?R.elevatorTop:R.elevatorBottom;m.y=m.elevatorY+R.passengerOffset;m.ride={time:0,from:m.elevatorY,to:reverse?R.elevatorBottom:R.elevatorTop,call:false,duration:12};o.snapCamera();stepOutsideZoom(0);},reverse);
   let previous=null,maxJump=0;const widths=new Set();
   for(let second=0;second<19;second++){
    const frames=await p.evaluate(()=>{
     const o=outsidePlaytest,out=[];
     for(let i=0;i<60;i++){stepOutsideZoom(1/60);out.push({w:o.renderCamera.w,y:o.renderCamera.y,passenger:o.model.ride?o.model.y-o.model.elevatorY:null,zoom:o.renderCamera.zoom});}
     return out;
    });
    for(const f of frames){if(previous)maxJump=Math.max(maxJump,Math.abs(f.w/previous-1));previous=f.w;widths.add(f.w.toFixed(4));assert(f.y-f.w*9/32>=-1.48-1e-8,'No below-floor view');if(f.passenger!==null)assert(Math.abs(f.passenger-.39)<1e-8);}
    if([0,1,2,4,10,12,18].includes(second))await p.screenshot({path:'/private/tmp/smooth-lift-'+(reverse?'down':'up')+'-'+second+'.png'});
   }
   assert(maxJump<.035,JSON.stringify({reverse,maxJump}));assert(widths.size>300,'Actual renderer smoothly varies its width');
   assert(Math.abs(previous-P.settledWidth(4.8,P.surface(1280,720)))<1e-6,'Restores resting pixel scale');
   assert.equal(await p.evaluate(()=>document.querySelector('#outside-root canvas').getContext('2d').imageSmoothingEnabled),false);
   results.push({reverse,maxJump,uniqueWidths:widths.size});
  }
  // Snapshot must not reset an in-progress animated width.
  assert(await p.evaluate(()=>{const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.start({day:3,flow:'out',place:'bar'});m.x=R.elevatorX;m.ride={time:1,from:R.elevatorBottom,to:R.elevatorTop,call:false,duration:12};o.snapCamera();for(let i=0;i<20;i++)stepOutsideZoom(1/60);const before=o.renderCamera.w;o.snapshot({x:-8,y:3,w:12});return o.renderCamera.w===before;}));
  assert.deepEqual(errors,[]);console.log('PASS smooth zoom, exact resting PPU, 5 viewport/DPR curves, both lift directions, passenger/floor alignment, nearest-neighbor render and isolated snapshots',results);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
