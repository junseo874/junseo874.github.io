const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(async()=>{await outsidePlaytest.start();const m=outsidePlaytest.model;m.start({day:1,flow:'out',place:'bar'});m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};});
  let changedRoad=0,covered=0;
  for(const x of [-15.65,-2.87,1])for(const time of [.25,1.5,2.5]){
   const r=await p.evaluate(({x,time})=>{
    const o=outsidePlaytest,m=o.model;m.x=x;m.time=time;o.snapCamera();o.tick(0);
    const rain=LunaOutsideRain,paint=rain.draw,c=document.querySelector('#outside-root canvas'),ctx=c.getContext('2d'),draw=ctx.drawImage;
    const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const mc=mask.getContext('2d');mc.imageSmoothingEnabled=false;
    const foreground=new Set(LUNA_OUTSIDE_DATA.scenes.street.nodes.filter(n=>n.name.includes('ForeFore_Object')).map(n=>new URL(LUNA_OUTSIDE_DATA.assets[n.sprite.asset].src,location.href).href));
    let probe=false;const events=[];
    ctx.drawImage=function(im,...args){if(foreground.has(im.src)){events.push('foreground');mc.setTransform(this.getTransform());mc.drawImage(im,...args);}return draw.call(this,im,...args);};
    rain.draw=function(c,m,cam,pos,pass){events.push(pass);if(probe&&pass==='splashes')paint(c,m,cam,pos,pass);};
    try{
     o.tick(0);const baseline=ctx.getImageData(0,0,c.width,c.height).data;
     events.length=0;probe=true;o.tick(0);const after=ctx.getImageData(0,0,c.width,c.height).data,alpha=mc.getImageData(0,0,c.width,c.height).data;
     let covered=0,leaked=0,changedRoad=0;
     for(let i=0;i<after.length;i+=4){const different=baseline[i]!==after[i]||baseline[i+1]!==after[i+1]||baseline[i+2]!==after[i+2];if(alpha[i+3]===255){covered++;if(different)leaked++;}else if(different)changedRoad++;}
     return {events,covered,leaked,changedRoad};
    }finally{rain.draw=paint;ctx.drawImage=draw;o.tick(0);}
   },{x,time});
   assert.equal(r.leaked,0,'Ground splashes cannot paint over opaque foreground at '+x);
   const splash=r.events.indexOf('splashes'),drops=r.events.indexOf('drops'),fore=r.events.map((e,i)=>e==='foreground'?i:-1).filter(i=>i>=0);
   assert.equal(r.events.filter(e=>e==='splashes').length,1);assert.equal(r.events.filter(e=>e==='drops').length,1);
   assert(fore.length&&fore.every(i=>splash<i&&i<drops),'Ground / foreground / falling-rain order');
   covered+=r.covered;changedRoad+=r.changedRoad;
  }
  assert(covered>1000&&changedRoad>0,'Keep visible road impacts while hiding those behind foreground');
  await p.evaluate(()=>{const o=outsidePlaytest;o.model.x=-15.65;o.model.time=2.5;o.snapCamera();o.tick(0);});
  await p.screenshot({path:'/private/tmp/rain-behind-foreground.png'});
  assert.deepEqual(errors,[]);console.log('PASS ground splash pixel occlusion, foreground falling rain, exactly one pass each, 3 street positions × 3 rain phases',{covered,changedRoad});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
