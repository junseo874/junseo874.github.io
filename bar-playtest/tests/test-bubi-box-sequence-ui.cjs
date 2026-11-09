const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{
   lunaCampaign.outside.exit(true);lunaCampaign.session.uninstall();lunaCampaign.screen('developer');
   Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'homeDoor'});await outsidePlaytest.start();
   const m=outsidePlaytest.model,N=LunaOutsideNeighborhood;
   barGame.progress.flags={};lunaCampaign.session.carry={flags:{},inventory:{},money:0};
   m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=N.places.box.x-1.5;m.updateNear();
   window.bubiClock={tick:m.tick,advance(seconds){for(let left=seconds;left>1e-8;left-=.01)this.tick.call(m,Math.min(.01,left));outsidePlaytest.tick(0);},pose(){const art=LunaBubiArt,draw=art.draw;let pose;try{art.draw=(ctx,pos,images,model,id,x,y,time,glow,once)=>{const frame=art.frame(id,time,once);pose={id,index:frame.x/frame.w,once};};N.draw(m,()=>{},null,null,null,null,true);}finally{art.draw=draw;}return pose;}};
   // Control animation time while exercising the actual keyboard handler/render path.
   m.tick=()=>{};outsidePlaytest.snapCamera();outsidePlaytest.tick(0);
  });
  const pose=()=>p.evaluate(()=>bubiClock.pose());
  assert.deepEqual(await pose(),{id:'jump',index:0,once:true},'closed box before approaching');
  const shake=await p.evaluate(()=>{
   const m=outsidePlaytest.model;m.x=LunaOutsideNeighborhood.places.box.x-.45;
   bubiClock.advance(.01);const frames=[];
   for(let i=0;i<80;i++){frames.push(bubiClock.pose());bubiClock.advance(.01);}
   return {frames,flag:barGame.progress.flags.boobi_box_shaken,dialog:!!m.story.speech};
  });
  assert(shake.flag&&!shake.dialog);const shaking=shake.frames.filter(f=>f.id==='shaking');
  assert.deepEqual([...new Set(shaking.map(f=>f.index))],[0,1,2,3,4,5,6,7],'one complete shake, without looping');
  assert(shaking.every(f=>f.once));assert.equal(shake.frames.at(-1).id,'jump');
  await p.evaluate(()=>{const m=outsidePlaytest.model;for(let i=0;i<3;i++){m.x=LunaOutsideNeighborhood.places.box.x-1.5;bubiClock.advance(1);m.x=LunaOutsideNeighborhood.places.box.x-.45;bubiClock.advance(2);}});
  assert.deepEqual(await pose(),{id:'jump',index:0,once:true},'waiting and repeated approaches never flash eyes');
  const out=path.resolve(__dirname,'../../artifacts/resource-refresh');fs.mkdirSync(out,{recursive:true});
  await p.screenshot({path:path.join(out,'bubi-box-wait.png')});
  await p.evaluate(()=>{const m=outsidePlaytest.model;m.x=LunaOutsideNeighborhood.places.box.x;m.updateNear();outsidePlaytest.snapCamera();outsidePlaytest.tick(0);});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.near?.id),'neighborhood-box');
  await p.keyboard.press('KeyE');
  assert.deepEqual(await pose(),{id:'eyes',index:0,once:true},'E starts eyes, not jump');
  await p.keyboard.press('KeyE');assert.deepEqual(await pose(),{id:'eyes',index:0,once:true},'E cannot skip or duplicate the reveal');
  const phases=await p.evaluate(()=>{
   const m=outsidePlaytest.model,eyes=[],jump=[];
   for(let i=0;i<370;i++){const f=bubiClock.pose();if(f.id==='eyes')eyes.push(f.index);if(f.id==='jump')jump.push(f.index);bubiClock.advance(.01);}
   return{eyes:[...new Set(eyes)],jump:[...new Set(jump)],revealed:barGame.progress.flags.boobi_revealed,locked:m.story.blocking,speech:!!m.story.speech,action:m.neighborhood.action};
  });
  assert.deepEqual(phases.eyes,Array.from({length:22},(_,i)=>i));assert.deepEqual(phases.jump,Array.from({length:15},(_,i)=>i));
  assert(phases.revealed&&!phases.locked&&!phases.speech&&!phases.action,'complete reveal before restoring control');assert.equal((await pose()).id,'idle');
  await p.screenshot({path:path.join(out,'bubi-box-revealed.png')});
  // Saved approach flag prevents shaking again when the corridor model restarts.
  await p.evaluate(()=>{const m=outsidePlaytest.model;barGame.progress.flags={boobi_box_shaken:true};m.start({day:2,flow:'out',place:'homeDoor'});m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.x=LunaOutsideNeighborhood.places.box.x-.45;bubiClock.advance(1);});
  assert.deepEqual(await pose(),{id:'jump',index:0,once:true});
  // Pressing E during the very first shake immediately starts the same sequence.
  await p.evaluate(()=>{barGame.progress.flags={};outsidePlaytest.model.x=LunaOutsideNeighborhood.places.box.x;bubiClock.advance(.01);});assert.equal((await pose()).id,'shaking');
  await p.keyboard.press('KeyE');assert.deepEqual(await pose(),{id:'eyes',index:0,once:true});
  assert.equal(await p.evaluate(()=>outsidePlaytest.model.neighborhood.shake),0);
  await p.evaluate(()=>bubiClock.advance(17/12));await p.screenshot({path:path.join(out,'bubi-box-eyes.png')});
  assert.equal((await pose()).id,'eyes');
  await p.evaluate(()=>bubiClock.advance(22/12-17/12+1.2));assert.equal((await pose()).id,'jump');
  await p.screenshot({path:path.join(out,'bubi-box-jump.png')});
  assert.deepEqual(errors,[]);console.log('BUBI_BOX_SEQUENCE_OK: single approach shake, static waiting/re-entry, real E, 22 eye frames then 15 jump frames once, input lock and completion, saved flag, E during shake.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
