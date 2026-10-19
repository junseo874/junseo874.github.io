const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const results=await p.evaluate(()=>{
   const a=outsidePlaytest,m=a.model,R=LunaResidence.layout,rows=[];
   for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const run of [false,true]){
    m.start({day,flow,place:'homeDoor'});
    for(let i=0;i<300;i++)m.tick(.05,{move:-1,run});
    rows.push({day,flow,run,x:m.x,y:m.y,anim:m.anim});
    if(m.story.speech?.id!=='upper_crates_blocked'||m.story.view()?.full!=='물건들로 막혀있네.')throw Error('Missing Luna crate line');
    m.story.advance();m.story.advance();
    for(let i=0;i<30;i++)m.tick(.05,{move:-1,run});
    if(m.story.speech)throw Error('Held left must not repeat the crate line');
    m.tick(.05,{move:1,run});if(m.x<=R.upperMin)throw Error('Cannot walk back from crates');
   }
   const building=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='residence-building');
   return {rows,right:building.x+305/building.sprite.ppu,limit:R.upperMin,lower:R.lowerMin,home:R.homeX,lift:R.elevatorX};
  });
  assert(Math.abs(results.limit-results.right-.16)<1e-8,'Stop at the actual crate edge with body clearance');
  assert.equal(results.lower,-16.3);assert(results.limit<results.home&&results.home<results.lift);
  for(const r of results.rows){assert.equal(r.x,-18.98,JSON.stringify(r));assert.equal(r.y,9.74);assert.equal(r.anim,'idle');}
  await p.evaluate(()=>{const a=outsidePlaytest,m=a.model;m.start({day:3,flow:'out',place:'homeDoor'});m.x=LunaResidence.layout.upperMin+.12;a.snapCamera();a.tick(0);});
  await p.keyboard.down('ShiftLeft');await p.keyboard.down('KeyA');await p.waitForTimeout(600);await p.keyboard.up('KeyA');await p.keyboard.up('ShiftLeft');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),-18.98);
  await p.waitForFunction(()=>outsidePlaytest.model.story.view()?.text==='물건들로 막혀있네.');
  assert.equal(await p.locator('.outside-speech .outside-speech-text').innerText(),'물건들로 막혀있네.');
  await p.screenshot({path:'/private/tmp/upper-crates-blocked.png'});
  await p.keyboard.press('KeyE');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
  await p.setViewportSize({width:960,height:720});await p.keyboard.down('KeyA');await p.waitForTimeout(300);await p.keyboard.up('KeyA');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),-18.98);
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech),null);
  await p.keyboard.down('KeyD');await p.waitForTimeout(350);await p.keyboard.up('KeyD');assert(await p.evaluate(()=>outsidePlaytest.model.x>-18.9));
  await p.keyboard.down('KeyA');await p.waitForTimeout(500);await p.keyboard.up('KeyA');
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.story.speech?.id),'upper_crates_blocked');
  await p.evaluate(()=>{const s=outsidePlaytest.model.story;s.advance();s.advance();});
  const roundTrip=await p.evaluate(()=>{
   const m=outsidePlaytest.model,R=LunaResidence.layout;
   m.x=R.homeX;m.updateNear();const home=m.near.id;m.interact();for(let i=0;i<24;i++)m.tick(.05);const entered=m.scene;
   m.interact();for(let i=0;i<24;i++)m.tick(.05);const left=m.scene;
   m.x=R.elevatorX;m.updateNear();const lift=m.near.id;m.interact();m.chooseObject('confirm');for(let i=0;i<300;i++)m.tick(.05);const down=m.level;
   m.updateNear();m.interact();m.chooseObject('confirm');for(let i=0;i<300;i++)m.tick(.05);
   return {home,entered,left,lift,down,up:m.level,x:m.x};
  });
  assert.deepEqual(roundTrip,{home:'home',entered:'home',left:'street',lift:'elevator',down:0,up:1,x:results.lift});
  assert.deepEqual(errors,[]);console.log('PASS upper crate collision: 16 day/route/walk/run cases, real held A/Shift, resize, return movement, house and lift round trips, unchanged ground boundary');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
