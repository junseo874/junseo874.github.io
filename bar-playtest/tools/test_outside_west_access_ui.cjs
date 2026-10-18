const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const results=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,R=LunaResidence.layout,out=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out']){
    if(day===0&&flow==='in')continue; // Existing first-commute tutorial route.
    m.start({day,flow,place:'bar'});m.x=R.elevatorX;m.story.cancel();m.backgroundStory.cancel();
    for(let i=0;i<120;i++)m.tick(.05,{move:-1,run:true});
    out.push({day,flow,x:m.x,y:m.y,level:m.level});
    for(let i=0;i<80;i++)m.tick(.05,{move:1,run:true});
    if(m.x<=R.elevatorX)throw Error('Cannot return past lift');
   }
   return out;
  });
  for(const r of results){assert(Math.abs(r.x+16.30)<1e-8,JSON.stringify(r));assert.equal(r.y,-.7);assert.equal(r.level,0);}
  // Real A/D keyboard route: old invisible limit, drums, then the wall.
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.start({day:0,flow:'out',place:'bar'});m.x=-12.81;m.story.cancel();m.backgroundStory.cancel();o.snapCamera();});
  await p.keyboard.down('KeyA');await p.waitForTimeout(750);await p.keyboard.up('KeyA');
  assert(await p.evaluate(()=>outsidePlaytest.model.x<-13.1),'Keyboard passes old lift boundary');
  for(const [name,x]of [['drums',-15.1],['wall',-16.30]]){
   await p.evaluate(x=>{const o=outsidePlaytest,m=o.model;m.x=x;m.updateNear();o.snapCamera();o.tick(0);},x);
   await p.screenshot({path:'/private/tmp/west-access-'+name+'.png'});
  }
  await p.keyboard.down('KeyA');await p.waitForTimeout(500);await p.keyboard.up('KeyA');
  assert(await p.evaluate(()=>Math.abs(outsidePlaytest.model.x+16.30)<1e-8),'Wall blocks held movement');
  await p.keyboard.down('KeyD');await p.waitForTimeout(500);await p.keyboard.up('KeyD');
  assert(await p.evaluate(()=>outsidePlaytest.model.x>-16.1),'Can leave wall without getting stuck');
  // Upper corridor and first-commute tutorial retain their own boundaries.
  assert(await p.evaluate(()=>{const m=outsidePlaytest.model,R=LunaResidence.layout;m.start({day:3,flow:'out',place:'homeDoor'});m.x=R.upperMin;for(let i=0;i<20;i++)m.tick(.05,{move:-1});return m.x===R.upperMin&&m.y===R.upperY;}));
  assert(await p.evaluate(()=>{const m=outsidePlaytest.model;m.start({day:0,flow:'in',place:'bar'});m.x=-.89;m.tick(.05,{move:-1,run:true});return m.x===-.9;}));
  assert.deepEqual(errors,[]);console.log('PASS 7 day/flow routes, west drums access, real keyboard movement, wall stop/return, flat ground and unchanged upper/tutorial bounds');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
