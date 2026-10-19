const assert=require('node:assert/strict');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const checks=await p.evaluate(()=>{
   const ns=LUNA_OUTSIDE_DATA.scenes.street.nodes,fn=LunaOutside.streetParallax,m={scene:'street'},a={x:-8,y:0,w:4.8},b={x:-7,y:1,w:4.8};
   const delta=name=>{const n=ns.find(n=>n.name===name),u=fn(n,a,m),v=fn(n,b,m);return [+(v.x-u.x).toFixed(5),+(v.y-u.y).toFixed(5)];};
   const dynamic=ns.filter(n=>n.ambient||n.ancestry.includes('Elevator')||n.name.startsWith('residence-')||['1F Floor','Fence','B_Obects','B_Fore_Building_1','Luna'].includes(n.name));
   const fixed=dynamic.every(n=>{const v=fn(n,b,m);return v.x===n.x&&v.y===n.y;});
   const exempt=ns.every(n=>['home','qa'].every(mode=>{const v=fn(n,b,{scene:mode==='home'?'home':'street',qa:mode==='qa'});return v.x===n.x&&v.y===n.y;}));
   const deterministic=ns.every(n=>{const s=JSON.stringify(fn(n,a,m));fn(n,b,m);return s===JSON.stringify(fn(n,a,m))&&s===JSON.stringify(fn(n,{...a,w:12.8},m));});
   return {fixed,exempt,deterministic,deltas:Object.fromEntries(['Sky','C_Back_Building_2','C_Back_Building_1','C_Middle_Building_1','C_Middle_Object_1','C_Middle_Object_2','CityLight','B_ForeFore_Object_1'].map(n=>[n,delta(n)]))};
  });
  assert(checks.fixed&&checks.exempt&&checks.deterministic,JSON.stringify(checks));
  assert.deepEqual(checks.deltas.Sky,[.45,.22]);assert.deepEqual(checks.deltas.B_ForeFore_Object_1,[-.035,0]);
  for(const n of ['C_Middle_Object_1','C_Middle_Object_2','CityLight'])assert.deepEqual(checks.deltas[n],checks.deltas.C_Middle_Building_1);
  // Freeze model actions, not rendering/camera, to inspect actual canvas motion.
  await p.evaluate(()=>{const m=outsidePlaytest.model;window.savedModelTick=m.tick;m.tick=()=>{};});
  const captures=[['bar',1,0],['shop',-2.87,0],['lookout',-8.78,0],['left-edge',-12.81,0],['right-edge',6.1,0],['home',-16.36,1],['upper-left',-21.65,1]];
  for(const [name,x,level]of captures){
   await p.evaluate(({x,level})=>{const o=outsidePlaytest,m=o.model;m.start({day:0,flow:'out',place:level?'homeDoor':'bar'});m.x=x;m.level=level;m.y=level?LunaResidence.layout.upperY:-.7;m.time=2.5;o.snapCamera();for(let i=0;i<150;i++)o.tick(.016);},{x,level});
   await p.screenshot({path:'/private/tmp/parallax-'+name+'.png'});
  }
  // Actual draw transforms preserve solid-world nodes but move background art.
  const drawing=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model;m.start({day:3,flow:'out',place:'bar'});m.x=-8.78;o.snapCamera();
   const c=document.querySelector('#outside-root canvas').getContext('2d'),draw=c.drawImage,tr=c.translate,seen=[],data=LUNA_OUTSIDE_DATA;let xy;
   c.translate=function(x,y){xy=[x,y];return tr.call(this,x,y);};c.drawImage=function(img,...args){seen.push({src:img.src,xy});return draw.call(this,img,...args);};
   try{o.tick(0);}finally{c.translate=tr;c.drawImage=draw;}
   return ['C_Middle_Building_2','Fence','B_ForeFore_Object_1'].map(name=>{const n=data.scenes.street.nodes.find(n=>n.name===name),cam=o.renderCamera,v=LunaOutside.streetParallax(n,cam,m),p=LunaPixelCamera.sprite(n.sprite,v.x,v.y,n.sx,n.sy,false,cam,o.pixelSurface);return{name,actual:seen.find(s=>s.src?.endsWith(data.assets[n.sprite.asset].src))?.xy,expected:[p.x,p.y]};});
  });for(const d of drawing)assert.deepEqual(d.actual,d.expected,d.name);
  await p.keyboard.press('KeyY');await p.waitForTimeout(1500);assert(await p.evaluate(()=>outsidePlaytest.camera.w>11));
  await p.screenshot({path:'/private/tmp/parallax-panorama.png'});await p.keyboard.press('KeyY');
  // Traverse both directions of the real lift camera, including its zoom arc.
  for(const reverse of [false,true]){
   await p.evaluate(reverse=>{const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.start({day:3,flow:'out',place:reverse?'homeDoor':'bar'});m.x=R.elevatorX;m.ride={time:0,from:reverse?R.elevatorTop:R.elevatorBottom,to:reverse?R.elevatorBottom:R.elevatorTop,call:false,duration:12};m.y=m.ride.from+R.passengerOffset;o.snapCamera();},reverse);
   for(const t of [2,5,8,11,13]){
    await p.evaluate(t=>{const o=outsidePlaytest,m=o.model,r=m.ride;r.time=t;const v=Math.max(0,Math.min(1,(t-.45)/12)),s=v*v*(3-2*v);m.elevatorY=r.from+(r.to-r.from)*s;m.y=m.elevatorY+LunaResidence.layout.passengerOffset;for(let i=0;i<100;i++)o.tick(.016);},t);
    await p.screenshot({path:`/private/tmp/parallax-lift-${reverse?'down':'up'}-${t}.png`});
   }
  }
  await p.evaluate(()=>{const o=outsidePlaytest,m=o.model;m.tick=window.savedModelTick;m.start({day:3,flow:'out',place:'bar'});m.x=-7;o.snapCamera();});
  const start=await p.evaluate(()=>outsidePlaytest.model.x);
  await p.keyboard.down('KeyD');await p.waitForTimeout(800);await p.keyboard.up('KeyD');
  assert(await p.evaluate(x=>outsidePlaytest.model.x>x+.1,start),'Normal player walking still advances');
  assert.deepEqual(errors,[]);console.log('PASS depth motion, building/sign alignment, world/indoor/QA isolation, no drift, canvas transforms, playable street edges, panorama, lift ascent/descent, walking and assets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
