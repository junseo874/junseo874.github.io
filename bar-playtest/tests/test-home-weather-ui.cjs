const assert=require('node:assert/strict');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();});
 const result=await p.evaluate(()=>{
  const o=outsidePlaytest,m=o.model,R=LunaOutsideRain,bg=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg');
  m.x=2.557;m.story.cancel();m.backgroundStory.cancel();m.time=2.5;o.snapCamera();
  const cv=document.querySelector('#outside-root canvas'),ctx=cv.getContext('2d'),paint=R.drawHome;
  R.drawHome=()=>{};o.tick(0);const before=ctx.getImageData(0,0,cv.width,cv.height).data;
  R.drawHome=paint;o.tick(0);const after=ctx.getImageData(0,0,cv.width,cv.height).data,cam=o.renderCamera;
  const left=bg.x-bg.sprite.w/200,top=bg.y+bg.sprite.h/200,k=1280/cam.w;
  let windowChanges=0,exteriorChanges=0,outside=0;
  for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
   const i=(y*cv.width+x)*4;if(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2])continue;
   const u=((x*1280/cv.width-640)/k+cam.x-left)*100,v=(top-((360-y*720/cv.height)/k+cam.y))*100;
   if(u>=338&&u<=464&&v>=131&&v<=184)windowChanges++;
   else if(u>=584&&u<=644&&((v>=21&&v<=76)||(v>=94&&v<=239)))exteriorChanges++;
   else outside++;
  }
  const sample=(day,flow,time,pass)=>{const c=document.createElement('canvas');c.width=643;c.height=270;const g=c.getContext('2d');R.drawHome(g,{scene:'home',config:{day,flow},time},{x:bg.x,y:bg.y,w:12.8},(x,y)=>({x:(x-left)*100,y:(top-y)*100}),bg,pass);return Array.from(g.getImageData(0,0,643,270).data);};
  for(const flow of ['in','out'])for(const pass of ['rain','glass'])if(!sample(3,flow,2,pass).some(Boolean))throw Error('Day 3 home weather missing: '+flow+'/'+pass);
  const glass=sample(0,'out',2,'glass'),later=sample(0,'out',4,'glass'),dry=sample(2,'out',2,'glass');
  return {windowChanges,exteriorChanges,outside,glass:glass.some(Boolean),animated:glass.some((v,i)=>v!==later[i]),dry:dry.every(v=>v===0)};
 });
 assert(result.windowChanges>10&&result.exteriorChanges>10,JSON.stringify(result));assert.equal(result.outside,0,'Rain never draws on the room or terrace floor');assert(result.glass&&result.animated&&result.dry,'Glass droplets animate only on rainy days');
 await p.screenshot({path:'/private/tmp/chris-home-rain.png'});assert.deepEqual(errors,[]);console.log('PASS home weather: same outdoor rainfall; visible window/exterior; no indoor or floor spill; animated wet glass; dry days clean',result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
