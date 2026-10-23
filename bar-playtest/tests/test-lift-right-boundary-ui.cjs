const assert=require('node:assert/strict'),path=require('node:path'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{Object.assign(outsidePlaytest.config,{day:3,flow:'out',place:'homeDoor'});await outsidePlaytest.start();});
 const art=await p.evaluate(()=>({animations:['idle','walk','run'].map(k=>LUNA_OUTSIDE_DATA.animations[k]),assets:LUNA_OUTSIDE_DATA.assets}));
 let radius=0;
 for(const animation of art.animations){const first=animation.frames[0],{data,info}=await rt.load('sharp')(path.resolve(__dirname,'../',art.assets[first.asset].src)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const f of animation.frames)for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(data[((y+f.y)*info.width+x+f.x)*4+3]>16)
   radius=Math.max(radius,Math.abs(x-f.w*f.pivot.x)/f.ppu,Math.abs(x+1-f.w*f.pivot.x)/f.ppu);
 }
 const audit=await p.evaluate(radius=>{
  const a=outsidePlaytest,m=a.model,R=LunaResidence.layout,results=[];
  const lift=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.name==='Elevator'),right=lift.x+lift.sprite.w*(1-lift.sprite.pivot.x)*lift.sx/lift.sprite.ppu;
  for(const main of [false,true])for(const day of [0,1,2,3])for(const flow of ['in','out'])for(const run of [false,true]){
   lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:!main});
   m.start({day,flow,place:'homeDoor'});m.thugFlags.day1_thug_done=true;m.notionFlags.day2_thug_done=true;
   Object.assign(barGame.progress.flags,{day1_thug_done:true,day2_thug_done:true});
   m.x=R.elevatorX-.1;m.story.cancel();m.backgroundStory.cancel();
   for(let i=0;i<120;i++){m.tick(.05,{move:1,run});if(m.x+radius>right-.02)throw Error('Body crosses cabin wall: '+JSON.stringify({main,day,flow,run,x:m.x,radius,right}));}
   if(m.x!==R.upperMax||m.anim!=='idle'||m.near?.id!=='elevator')throw Error('Boundary/interaction mismatch');
   results.push(m.x);m.tick(.05,{move:-1,run});if(m.x>=R.upperMax)throw Error('Cannot leave cabin to the left');
  }
  lunaCampaign.session.uninstall();lunaCampaign.session.install({developer:true});m.start({day:3,flow:'out',place:'homeDoor'});
  m.x=-12.28;m.tick(0);if(m.x!==R.upperMax)throw Error('Legacy out-of-bounds position not repaired');
  m.startLift();for(let i=0;m.ride&&i<300;i++)m.tick(.05,{move:1,run:true});
  if(m.level!==0)throw Error('Descent failed');
  for(let i=0;i<12;i++)m.tick(.05,{move:1,run:true});if(m.x<=right+.2)throw Error('Ground street accidentally blocked');
  m.x=R.elevatorX;m.startLift();for(let i=0;m.ride&&i<300;i++)m.tick(.05,{move:1,run:true});
  if(m.level!==1||m.x+radius>right-.02)throw Error('Ascent/landing boundary failed: '+JSON.stringify({level:m.level,x:m.x,ride:m.ride,encounter:m.encounter,transition:m.transition,story:m.story.speech}));
  a.snapCamera();a.tick(0);return {cases:results.length,radius,right,limit:R.upperMax,lower:R.lowerMin};
 },radius);
 assert.equal(audit.cases,32);assert.equal(audit.lower,-16.3);
 await p.keyboard.down('ShiftLeft');await p.keyboard.down('KeyD');await p.waitForTimeout(450);await p.keyboard.up('KeyD');await p.keyboard.up('ShiftLeft');
 assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),audit.limit);
 await p.screenshot({path:'/private/tmp/lift-right-boundary.png'});
 await p.setViewportSize({width:640,height:360});await p.keyboard.down('ArrowRight');await p.waitForTimeout(200);await p.keyboard.up('ArrowRight');
 assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),audit.limit);
 await p.keyboard.down('KeyA');await p.waitForTimeout(150);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x<LunaResidence.layout.upperMax));
 assert.deepEqual(errors,[]);console.log('LIFT_RIGHT_BOUNDARY_OK',audit);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
