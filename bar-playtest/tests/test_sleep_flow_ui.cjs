const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.evaluate(()=>lunaCampaign.newGame());await p.waitForFunction(()=>lunaCampaign.view==='prologue');
  await p.evaluate(()=>{const c=lunaCampaign,s=c.cinema.scene,clip=s.clips.find(x=>x.assetId==='opening-luna-sleep');c.cinema.time=clip.start+.2;c.cinema.player.render(c.cinema.time,null,false);});
  await p.screenshot({path:'/private/tmp/luna-new-sleep.png'});
  assert(await p.evaluate(()=>{const s=lunaCampaign.cinema.scene,a=s.clips.find(x=>x.assetId==='opening-luna-sleep'),w=s.clips.find(x=>x.assetId==='opening-luna-wake'),stand=s.clips.find(x=>x.actor==='home-luna'&&x.assetId==='opening-luna-home');return a.rotation===0&&a.start<w.start&&w.start<stand.start&&StudioMedia.assets.get(a.assetId).frames[0]===12;}));
  await p.evaluate(()=>{const c=lunaCampaign,w=c.cinema.scene.clips.find(x=>x.assetId==='opening-luna-wake');c.cinema.time=w.start+.8;c.cinema.player.render(c.cinema.time,null,false);});
  await p.screenshot({path:'/private/tmp/luna-new-eyes-open.png'});
  async function setup(day,terrace){await p.evaluate(async({day,terrace})=>{
   const c=lunaCampaign;c.cancelMemoryTransition();c.cancelDayTransition();c.disposeCinema();c.outside.exit(true);c.session.uninstall();c.session.beginCommute(day);c.session.route='out';c.nightStarted=false;c.data=structuredClone(LUNA_CAMPAIGN_DATA);
   if(!terrace)c.data.scenes[LunaTerrace.nightKey(day)]=[];
   if(day===2){c.g.progress.inventory={...c.g.progress.inventory,wild_dog:1,bitters:1};c.g.progress.flags.campaign_observation=true;c.session.carry=structuredClone(c.g.progress);}
   Object.assign(c.outside.config,{day,flow:'out',place:'home'});await c.outside.start();c.screen(c.playView);c.interactOutside(c.outside.model,{id:'sofa'});
  },{day,terrace});}
  async function until(fn){for(let i=0;i<400;i++){if(await p.evaluate(fn))return;await p.evaluate(()=>{for(let j=0;j<6;j++)lunaCampaign.tick(.05);});await p.waitForTimeout(15);}throw Error('Sleep flow stalled: '+await p.evaluate(()=>JSON.stringify({view:lunaCampaign.view,loadError:lunaCampaign.loadError,transition:lunaCampaign.memoryTransition?.phase,day:!!lunaCampaign.dayTransition})));}
  for(const terrace of [false,true]){
   await setup(0,terrace);
   assert(await p.evaluate(()=>!!lunaCampaign.memoryTransition),'Sleep begins with blackout');
   if(terrace){await until(()=>lunaCampaign.view==='scene'&&!lunaCampaign.memoryTransition);assert.equal(await p.evaluate(()=>lunaCampaign.dialog.background),'terrace');await p.evaluate(()=>{const c=lunaCampaign;c.dialog.index=c.dialog.rows.length;c.continueScene();});}
   else{await until(()=>lunaCampaign.cinema?.scene.template==='sleep'&&!lunaCampaign.memoryTransition);assert.equal(await p.evaluate(()=>lunaCampaign.session.day),0);}
   await until(()=>!!lunaCampaign.dayTransition);assert.equal(await p.evaluate(()=>lunaCampaign.dayTransition.to),1);
   await until(()=>lunaCampaign.cinema?.dailyWake&&!lunaCampaign.dayTransition);assert.equal(await p.evaluate(()=>lunaCampaign.session.day),1);
   assert(await p.evaluate(()=>outsidePlaytest.model.paused&&!lunaCampaign.canSkipCinema()));
   await p.evaluate(()=>{const c=lunaCampaign;c.cinema.time=1.9;c.cinema.player.render(1.9,null,false);});await p.screenshot({path:'/private/tmp/luna-morning-eyes.png'});
   await p.evaluate(()=>{const c=lunaCampaign;c.cinema.time=c.cinema.scene.clips.find(x=>x.assetId==='opening-luna-home').start+.8;c.cinema.player.render(c.cinema.time,null,false);});await p.screenshot({path:'/private/tmp/luna-morning-dressed.png'});
   await until(()=>lunaCampaign.view==='game'&&!lunaCampaign.cinema);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.config.day),1);assert.equal(await p.evaluate(()=>outsidePlaytest.model.config.flow),'in');assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
   assert.deepEqual(await p.evaluate(()=>lunaCampaign.session.completed),[0]);
   const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyA');await p.waitForTimeout(160);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x)<x,'Controls resume after dressing');
  }
  // Later story nights retain their terrace scenes without the archive-only workshop and advance exactly once.
  for(const day of [1,2]){
   await setup(day,true);
   for(let i=0;i<500;i++){
    if(await p.evaluate(()=>lunaCampaign.view==='game'&&!lunaCampaign.cinema&&!lunaCampaign.dayTransition))break;
    await p.evaluate(()=>{const c=lunaCampaign;if(c.view==='scene'&&c.dialog&&!c.memoryTransition&&!c.dayTransition){c.dialog.index=c.dialog.rows.length;c.continueScene();}for(let j=0;j<6;j++)c.tick(.05);});await p.waitForTimeout(15);
   }
   assert.equal(await p.evaluate(()=>lunaCampaign.session.day),day+1);assert.deepEqual(await p.evaluate(()=>lunaCampaign.session.completed),[day]);assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);
  }
  // Developer outside sleep uses the same morning without changing campaign progress.
  await p.evaluate(async()=>{const c=lunaCampaign;c.outside.exit(true);c.session.uninstall();c.session.install({developer:true});c.data=structuredClone(LUNA_CAMPAIGN_DATA);c.data.scenes.night0=[];Object.assign(c.outside.config,{day:0,flow:'out',place:'home'});await c.outside.start();c.screen('developer');window.sleepBaseline=JSON.stringify(c.g.progress);c.sleepOutsideTest(c.outside.model);});
  await until(()=>lunaCampaign.cinema?.scene.template==='sleep'&&!lunaCampaign.memoryTransition);
  await until(()=>lunaCampaign.cinema?.dailyWake&&!lunaCampaign.dayTransition);
  await until(()=>lunaCampaign.view==='developer'&&!lunaCampaign.cinema);
  assert.equal(await p.evaluate(()=>outsidePlaytest.config.day),1);assert(await p.evaluate(()=>JSON.stringify(barGame.progress)===sleepBaseline));
  assert.deepEqual(errors,[]);console.log('PASS imported sleep/wake frames; both terrace/no-terrace flows; days 0–2 advance once; blackout dressing and gameplay restored; developer isolation.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
