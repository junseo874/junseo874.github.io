const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.start({day:3,flow:'out',place:'bar'});m.x=-8.78;m.tick=()=>{};o.snapCamera();});
  // Inspect real draw order and context cleanup, not just helper output.
  const order=await p.evaluate(()=>{
   const o=outsidePlaytest,c=document.querySelector('#outside-root canvas').getContext('2d'),draw=c.drawImage,traffic=LunaOutsideTraffic.draw,events=[];
   c.drawImage=function(im,...args){events.push(im.src);return draw.call(this,im,...args);};
   LunaOutsideTraffic.draw=function(...args){events.push(args[4]);const before=[c.globalAlpha,c.globalCompositeOperation,JSON.stringify(c.getTransform())];traffic(...args);const after=[c.globalAlpha,c.globalCompositeOperation,JSON.stringify(c.getTransform())];if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Canvas state leaked');};
   try{o.tick(0);}finally{c.drawImage=draw;LunaOutsideTraffic.draw=traffic;}
   const data=LUNA_OUTSIDE_DATA,asset=name=>data.assets[data.scenes.street.nodes.find(n=>n.name===name).sprite.asset].src;
   const i=name=>events.findIndex(e=>e.endsWith(asset(name)));
   return {far:events.indexOf('far'),mid:events.indexOf('mid'),back:i('C_Back_Building_1'),tower:i('C_Middle_Building_3'),city:i('C_Middle_Building_1'),fence:i('Fence')};
  });
  assert(order.back<order.far&&order.far<order.tower&&order.city<order.mid&&order.mid<order.fence,JSON.stringify(order));
  // First low-route vehicle crossing the open lookout at its true world position.
  const time=await p.evaluate(()=>{const m=outsidePlaytest.model;for(let t=0;t<45;t+=.02){const v=LunaOutsideTraffic.vehicles({...m,time:t},'mid').find(v=>v.id.startsWith('0:'));if(v&&Math.abs(v.x+8.7)<.025)return t;}throw Error('No crossing');});
  await p.evaluate(t=>{outsidePlaytest.model.time=t;outsidePlaytest.tick(0);},time);
  await p.screenshot({path:'/private/tmp/traffic-street.png'});
  await p.keyboard.press('KeyY');await p.waitForTimeout(1500);
  await p.screenshot({path:'/private/tmp/traffic-panorama.png'});
  const still=await p.evaluate(()=>JSON.stringify(['far','mid'].flatMap(d=>LunaOutsideTraffic.vehicles(outsidePlaytest.model,d))));
  await p.keyboard.press('KeyY');await p.waitForTimeout(600);
  assert.equal(await p.evaluate(()=>JSON.stringify(['far','mid'].flatMap(d=>LunaOutsideTraffic.vehicles(outsidePlaytest.model,d)))),still,'Zoom does not reset vehicle positions');
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.start({day:0,flow:'out',place:'homeDoor'});m.x=LunaResidence.layout.elevatorX;m.ride={time:7,from:LunaResidence.layout.elevatorBottom,to:LunaResidence.layout.elevatorTop,call:false,duration:12};m.elevatorY=5.4;m.y=5.782;m.time=18;o.snapCamera();for(let i=0;i<150;i++)o.tick(.016);});
  await p.screenshot({path:'/private/tmp/traffic-lift.png'});
  for(const cfg of [{day:0,flow:'out',place:'home'},{day:99,flow:'out',place:'bar'}]){
   const count=await p.evaluate(cfg=>{const o=outsidePlaytest;o.model.start(cfg);o.snapCamera();o.tick(0);return ['far','mid'].flatMap(d=>LunaOutsideTraffic.vehicles(o.model,d)).length;},cfg);assert.equal(count,0);
  }
  assert.deepEqual(errors,[]);console.log('PASS actual occlusion ordering, canvas state, street/panorama/lift render, zoom continuity, indoor/QA exclusion; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
