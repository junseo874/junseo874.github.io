const assert=require('node:assert/strict');
const {load,chrome}=require('../../tools/lib/test-runtime.cjs');
(async()=>{const browser=await load('playwright').chromium.launch({executablePath:chrome,headless:true});try{
 const p=await browser.newPage({viewport:{width:Number(process.env.HOME_WEATHER_WIDTH)||1280,height:Number(process.env.HOME_WEATHER_HEIGHT)||720},deviceScaleFactor:Number(process.env.HOME_WEATHER_DPR)||1}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.evaluate(async()=>{lunaCampaign.screen('developer');Object.assign(outsidePlaytest.config,{day:0,flow:'out',place:'home'});await outsidePlaytest.start();window.homeWeatherTick=outsidePlaytest.tick;outsidePlaytest.tick=()=>{};outsidePlaytest.model.tick=()=>{};});
 const result=await p.evaluate(async()=>{
  const o=outsidePlaytest,m=o.model,R=LunaOutsideRain,bg=LUNA_OUTSIDE_DATA.scenes.home.nodes.find(n=>n.name==='main_bg'),sp=bg.sprite;
  m.x=2.557;m.story.cancel();m.backgroundStory.cancel();m.controlsTutorial=false;o.snapCamera();
  const image=new Image();image.src=LUNA_OUTSIDE_DATA.assets[sp.asset].src;await image.decode();
  const art=document.createElement('canvas');art.width=sp.w;art.height=sp.h;const a=art.getContext('2d',{willReadFrequently:true});a.drawImage(image,0,0);const pixels=a.getImageData(0,0,sp.w,sp.h).data;
  const cv=document.querySelector('#outside-root canvas'),ctx=cv.getContext('2d'),paint=R.drawHome;
  let windowChanges=0,exteriorChanges=0,outside=0,spill=[];
  for(const time of Array.from({length:24},(_,i)=>i*.25)){
   m.time=time;R.drawHome=()=>{};homeWeatherTick(0);const before=ctx.getImageData(0,0,cv.width,cv.height).data;
   R.drawHome=paint;homeWeatherTick(0);const after=ctx.getImageData(0,0,cv.width,cv.height).data;
   // Compare actual presented pixels, including device-pixel rounding, against
   // the latest room's transparent apertures, not a retired screenshot region.
   const rect=LunaPixelCamera.sprite(sp,bg.x,bg.y,bg.sx,bg.sy,bg.flip,o.renderCamera,o.pixelSurface);
   const left=rect.x-rect.w*sp.pivot.x,top=rect.y-rect.h*(1-sp.pivot.y);
   for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
    const i=(y*cv.width+x)*4;if(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2])continue;
    const u=Math.floor(((x+.5)*1280/cv.width-left)/rect.w*sp.w),v=Math.floor(((y+.5)*720/cv.height-top)/rect.h*sp.h);
    const transparent=u>=0&&u<sp.w&&v>=0&&v<sp.h&&pixels[(v*sp.w+u)*4+3]<255;
    if(transparent&&u>=310&&u<434&&v>=132&&v<183)windowChanges++;
    else if(transparent&&u>=596&&u<631&&v>=22&&v<238)exteriorChanges++;
    else {outside++;if(spill.length<12)spill.push({x,y,u,v,alpha:pixels[(v*sp.w+u)*4+3]});}
   }
  }
  const left=bg.x-sp.w*sp.pivot.x/sp.ppu,top=bg.y+sp.h*(1-sp.pivot.y)/sp.ppu;
  const sample=(day,flow,time,pass)=>{const c=document.createElement('canvas');c.width=sp.w;c.height=sp.h;const g=c.getContext('2d');R.drawHome(g,{scene:'home',config:{day,flow},time},{x:bg.x,y:bg.y,w:12.8},(x,y)=>({x:(x-left)*100,y:(top-y)*100}),bg,pass);return g.getImageData(0,0,sp.w,sp.h).data;};
  let paneLeaks=0;const panes=[0,0,0],bounds=[[314,157,20,23],[339,157,65,23],[409,157,20,23]];
  for(const time of [0,1,2,3,4,7,10]){
   const glass=sample(3,'out',time,'glass');
   for(let y=0;y<sp.h;y++)for(let x=0;x<sp.w;x++)if(glass[(y*sp.w+x)*4+3]){
    const pane=bounds.findIndex(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h);
    if(pane<0||pixels[(y*sp.w+x)*4+3]!==0)paneLeaks++;else panes[pane]++;
   }
  }
  for(const flow of ['in','out'])for(const pass of ['rain','glass'])if(!sample(3,flow,2,pass).some(Boolean))throw Error('Day 3 home weather missing: '+flow+'/'+pass);
  const glass=sample(0,'out',2,'glass'),later=sample(0,'out',4,'glass'),dry=sample(2,'out',2,'glass');
  return {cam:o.renderCamera,spill,windowChanges,exteriorChanges,outside,paneLeaks,panes,glass:glass.some(Boolean),animated:glass.some((v,i)=>v!==later[i]),dry:dry.every(v=>v===0)};
 });
 assert(result.windowChanges>10&&result.exteriorChanges>10,JSON.stringify(result));assert.equal(result.outside,0,'Rain never draws on the room, window frames or terrace floor');assert.equal(result.paneLeaks,0,'Droplets stay within actual transparent glass');assert(result.panes.every(n=>n>0),'All three current panes receive droplets');assert(result.glass&&result.animated&&result.dry,'Glass droplets animate only on rainy days');
 await p.screenshot({path:'/private/tmp/chris-home-rain.png'});assert.deepEqual(errors,[]);console.log('HOME_WEATHER_OK current source alpha, three panes, visible exterior notch, no room/frame/floor spill, animation and dry days',result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
