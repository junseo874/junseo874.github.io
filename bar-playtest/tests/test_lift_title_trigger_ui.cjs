const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  for(const developer of [false,true]){
   await p.evaluate(async developer=>{
    const c=lunaCampaign,o=outsidePlaytest;c.session.uninstall();c.session.install({developer});barGame.reset(0,'full',1,false);c.session.day=developer?99:0;c.session.route='out';c.firstLift=false;c.liftLogoPending=false;
    o.exit(true);Object.assign(o.config,{day:0,flow:'out',place:'bar'});await o.start();c.screen(c.playView);
    window.boardTitleTest=()=>{const m=o.model,r=LunaResidence.layout;m.story.cancel();m.backgroundStory.cancel();m.ride=null;m.level=0;m.elevatorY=r.elevatorBottom;m.x=r.elevatorX;m.y=-.7;m.updateNear();o.snapCamera();m.interact();if(!m.ride)throw Error('Did not board');};
   },developer);
   // A morning ascent must not consume the evening title.
   await p.evaluate(()=>{outsidePlaytest.model.config.flow='in';boardTitleTest();});
   assert(await p.evaluate(()=>!lunaCampaign.firstLift&&!outsidePlaytest.model.ride.titleReveal));
   // An empty lift call must not count as the title-bearing ride.
   assert(await p.evaluate(()=>{const m=outsidePlaytest.model;m.config.flow='out';m.ride={time:0,from:10,to:-1,call:true,duration:6};return !lunaCampaign.quietLift(m)&&!lunaCampaign.firstLift;}));
   // Boarding then cancelling before the logo is visible must allow another attempt.
   await p.evaluate(()=>{boardTitleTest();outsidePlaytest.model.ride.time=2;lunaCampaign.tick(0);outsidePlaytest.model.ride=null;lunaCampaign.tick(0);});
   assert(!await p.evaluate(()=>lunaCampaign.firstLift));assert.equal(await p.locator('#campaign-lift-reveal').count(),0);
   await p.evaluate(()=>{boardTitleTest();outsidePlaytest.model.ride.time=5;outsidePlaytest.tick(0);lunaCampaign.tick(0);});
   await p.waitForFunction(()=>document.querySelector('#campaign-lift-logo')?.naturalWidth>0,null,{timeout:3000}).catch(async e=>{throw Error(JSON.stringify(await p.evaluate(()=>({developer:lunaCampaign.session.developer,active:lunaCampaign.active,view:lunaCampaign.view,pending:lunaCampaign.liftLogoPending,first:lunaCampaign.firstLift,ride:outsidePlaytest.model.ride,config:outsidePlaytest.model.config,logo:document.querySelector('#campaign-lift-logo')?.outerHTML})))+' '+e.message);});
   assert.equal(await p.locator('.campaign-lift-team').innerText(),'Team. SimChung');
   assert.equal(await p.locator('#campaign-lift-reveal').evaluate(e=>Number(e.style.opacity)),1);
   assert(await p.evaluate(()=>lunaCampaign.firstLift&&outsidePlaytest.model.liftLogoSeen));
   await p.screenshot({path:'/private/tmp/lift-title-'+(developer?'developer':'campaign')+'.png'});
   await p.evaluate(()=>{lunaCampaign.screen('options');lunaCampaign.tick(0);});assert.equal(await p.locator('#campaign-lift-reveal').count(),0);
   await p.evaluate(()=>{lunaCampaign.screen(lunaCampaign.playView);lunaCampaign.tick(0);});assert.equal(await p.locator('#campaign-lift-reveal').count(),1);
   await p.evaluate(()=>{outsidePlaytest.model.ride.time=9.5;lunaCampaign.tick(0);});assert(await p.locator('#campaign-lift-reveal').evaluate(e=>Number(e.style.opacity)<.4));
   await p.evaluate(()=>{outsidePlaytest.model.ride.time=10.1;lunaCampaign.tick(0);});assert.equal(await p.locator('#campaign-lift-reveal').count(),0);
   await p.evaluate(()=>{boardTitleTest();outsidePlaytest.model.ride.time=5;lunaCampaign.tick(0);});assert.equal(await p.locator('#campaign-lift-reveal').count(),0,'No repeat after the first displayed title');
  }
  assert.deepEqual(errors,[]);console.log('PASS first homeward lift title: main + developer, morning/call exclusion, interrupted ride retry, original logo/team/fade, pause recovery and once-only reveal');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
