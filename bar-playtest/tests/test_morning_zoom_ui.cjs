const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  for(const day of [1,2,3]){
   await p.evaluate(async day=>{
    const c=lunaCampaign;c.disposeCinema();c.outside.exit(true);c.session.uninstall();c.session.beginCommute(day);
    Object.assign(c.outside.config,{day,flow:'in',place:'home'});await c.outside.start({wakeAtSofa:true});
    const scene=await c.prepareStudio('morning');c.startRestCinema(scene,()=>c.finishMorning(),true);
   },day);
   const info=await p.evaluate(()=>{
    const c=lunaCampaign,s=c.cinema.scene,z=s.clips.find(x=>x.type==='camera'),fade=s.clips.find(x=>x.effect==='fadeIn');
    return {start:z.start,duration:z.duration,end:s.end,fadeEnd:fade.start+fade.duration,cameras:[0,.25,.5,.75,1].map(u=>StudioModel.sample(s,z.start+z.duration*u).camera)};
   });
   assert(info.start>info.fadeEnd,'Zoom begins after the dressed reveal');assert.equal(info.duration,1.6);
   assert.equal(info.cameras[0].w,15);assert.equal(info.cameras[4].w,19.2);
   for(let i=1;i<info.cameras.length;i++)assert(info.cameras[i].w>info.cameras[i-1].w);
   const seek=t=>p.evaluate(t=>{const c=lunaCampaign;c.cinema.time=t;c.cinema.player.render(t,null,false);},t);
   await seek(info.start);if(day===1)await p.screenshot({path:'/private/tmp/morning-zoom-close.png'});
   const x=await p.evaluate(()=>outsidePlaytest.model.x);await p.keyboard.down('KeyA');await p.waitForTimeout(100);await p.keyboard.up('KeyA');assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),x,'Movement stays locked during zoom');
   await seek(info.start+.8);if(day===1)await p.screenshot({path:'/private/tmp/morning-zoom-middle.png'});
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>lunaCampaign.view),'options');
   const paused=await p.evaluate(()=>lunaCampaign.cinema.time);await p.waitForTimeout(120);assert.equal(await p.evaluate(()=>lunaCampaign.cinema.time),paused);await p.keyboard.press('Escape');
   await seek(info.end-.1);if(day===1)await p.screenshot({path:'/private/tmp/morning-zoom-wide.png'});
   const alignment=await p.evaluate(()=>{
    const c=lunaCampaign,s=StudioModel.sample(c.cinema.scene,c.cinema.scene.end-.001),cam=s.camera,out=outsidePlaytest.camera,bg=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg');
    const screen=(x,y,v)=>[640+(x-v.x)*1280/v.w,360-(y-v.y)*1280/v.w];
    const points=[[425,184],[519,224],[302,159]].map(([u,v])=>({cinema:screen(-11.2+u*.04,5.4-v*.04,cam),game:screen(bg.x+(u-bg.sprite.w*.5)/100,bg.y+(bg.sprite.h*.5-v)/100,out)}));
    points.push({cinema:screen(s.actors.luna.x,s.actors.luna.y,cam),game:screen(outsidePlaytest.model.x,outsidePlaytest.model.y,out)});
    return {points,scale:s.actors.luna.scale/cam.w,outScale:1/out.w};
   });
   for(const point of alignment.points)for(let i=0;i<2;i++)assert(Math.abs(point.cinema[i]-point.game[i])<.001,'Handoff preserves background and Luna screen positions');
   assert(Math.abs(alignment.scale-alignment.outScale)<.00001);
   await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.cinema);
   assert.equal(await p.evaluate(()=>outsidePlaytest.model.paused),false);assert.equal(await p.evaluate(()=>outsidePlaytest.camera.w),4.8);
   if(day===1)await p.screenshot({path:'/private/tmp/morning-zoom-game.png'});
   await p.keyboard.down('KeyA');await p.waitForTimeout(120);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x)<x);
  }
  assert.deepEqual(errors,[]);console.log('PASS morning days 1–3: smooth zoom, reveal ordering, pause, input lock, matching background/Luna handoff and restored controls');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
