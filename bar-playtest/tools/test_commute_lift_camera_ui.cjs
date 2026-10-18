const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1&mode=outside');
  await page.evaluate(()=>outsidePlaytest.start());await page.waitForFunction(()=>!outsidePlaytest.loading);
  const results=await page.evaluate(()=>{
   const app=outsidePlaytest,m=app.model,r=LunaResidence.layout,results=[];
   if(Math.abs(r.elevatorBottom+r.passengerOffset-(-.7))>1e-9||Math.abs(r.elevatorTop+r.passengerOffset-r.upperY)>1e-9)throw Error('Both lift stops must meet their flat walking planes');
   for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const down of [true,false]){
    m.start({day,flow,place:down?'homeDoor':'bar'});m.x=r.elevatorX;m.level=down?1:0;
    m.elevatorY=down?r.elevatorTop:r.elevatorBottom;m.y=down?r.upperY:-.7;m.updateNear();app.snapCamera();
    // Exercise real boarding for the requested route. Other scenarios start at
    // boarding directly so scheduled day-two NPC events cannot intercept E.
    if(day===0&&flow==='in'&&down)m.interact();
    else m.ride={time:0,from:m.elevatorY,to:down?r.elevatorBottom:r.elevatorTop,call:false,duration:12};
    if(!m.ride||m.ride.call)throw Error('Expected boarded elevator');
    const boardingY=m.y;m.tick(0,{});if(Math.abs(m.y-boardingY)>1e-9)throw Error('Boarding must not jump vertically');
    let max=0;for(let i=0;i<110;i++){app.tick(.05);max=Math.max(max,app.camera.w);}
    if(Math.abs(m.y-m.elevatorY-r.passengerOffset)>1e-9)throw Error('Passenger drifted from the cabin');
    const startY=app.camera.y;
    if(day===0&&flow==='in'&&down){for(let i=0;i<170;i++){app.tick(.05);max=Math.max(max,app.camera.w);}if(m.level!==0||m.ride)throw Error('Descent did not finish');if(app.camera.y>=startY)throw Error('Camera stopped following descent');}
    results.push({day,flow,down,max});
   }
   return results;
  });
  for(const s of results)assert(s.max>12,JSON.stringify(s));
  assert.deepEqual(errors,[]);console.log(JSON.stringify(results));console.log('PASS: all days and commute directions use the same panorama zoom with vertical tracking.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
