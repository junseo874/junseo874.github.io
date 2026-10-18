const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 assert(fs.readFileSync(root+'/assets/outside/wire-lightning-04.png').equals(fs.readFileSync('/Users/lee/Desktop/project/Human-Bartender/HumanBartender/Assets/01.Game/03.Content/03.Vfx/01.Sprites/FX_TX_Lightning_04.png')));
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const state=await p.evaluate(()=>{const o=outsidePlaytest,m=o.model,a=LunaWireSpark.anchor(LUNA_OUTSIDE_DATA);m.start({day:1,flow:'out',place:'bar'});m.x=a.x+1.2;m.story.cancel();m.backgroundStory.cancel();window.__wireTestTick=m.tick;m.tick=()=>{};o.snapCamera();o.tick(0);const order=LunaOutside.streetDrawOrder(LUNA_OUTSIDE_DATA.scenes.street.nodes);return {a,period:LunaWireSpark.period,frames:[0,.6,1.27,2.57,2.9,3.57,4.64].map(t=>LunaWireSpark.frameAt(t)),order:order.findIndex(n=>n.name==='B_Obects')<order.findIndex(n=>n.name==='Luna')};});
  assert(Math.abs(state.period-4.64)<1e-8);assert(state.order);assert.deepEqual(state.frames,[0,1,11,12,17,27,0]);
  for(const [name,time]of [['idle',0],['inner',.82],['outer',2.78],['flash',2.94],['flecks',3.2]]){
   const data=await p.evaluate(({time,a})=>{outsidePlaytest.model.time=time;return outsidePlaytest.snapshot({x:a.x-.08,y:a.y+.36,w:2.5});},{time,a:state.a});
   fs.writeFileSync('/private/tmp/wire-map-'+name+'.png',Buffer.from(data.split(',')[1],'base64'));
  }
  const check=await p.evaluate(async()=>{
   const d=LUNA_OUTSIDE_DATA,n=d.scenes.street.nodes.find(n=>n.name==='B_Obects'),sp=n.sprite;
   const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;},object=await load(d.assets[sp.asset].src),atlas=await load(d.assets['street-wire-spark'].src);
   const c=document.createElement('canvas');c.width=90;c.height=85;const ctx=c.getContext('2d');
   const draw=(t,reduced=false)=>{ctx.clearRect(0,0,90,85);ctx.save();ctx.translate(-970,-150);LunaWireSpark.paint(ctx,object,atlas,{...sp,pivot:{x:0,y:1}},sp.w,sp.h,t,reduced);ctx.restore();return c.toDataURL();};
   const idle=draw(0),flash=draw(2.94),repeat=draw(2.94),reduced=draw(2.94,true),later=draw(4.5);
   const make=document.createElement.bind(document);let allocations=0;document.createElement=(tag,...args)=>{if(tag==='canvas')allocations++;return make(tag,...args);};try{for(let i=0;i<100;i++)draw(i*.05);}finally{document.createElement=make;}
   const hidden=outsidePlaytest.model;hidden.tick=window.__wireTestTick;delete window.__wireTestTick;hidden.time=2.94;hidden.paused=true;const before=hidden.time;outsidePlaytest.tick(.1);const pause=hidden.time===before;hidden.paused=false;
   return {repeat:flash===repeat,active:flash!==idle,reduced:reduced===idle,dark:later===idle,allocations,pause};
  });assert(check.repeat&&check.active&&check.reduced&&check.dark&&check.allocations===0&&check.pause,JSON.stringify(check));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  await p.evaluate(async()=>{const r=resourceReview.rows.find(r=>r.id==='fx:wire-spark');if(!r)throw Error('No wire resource');await resourceReview.launch(r.launch,r.title,r.note);});
  assert.equal(await p.locator('#lab-note.error').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS original atlas, 4.64s/28-frame timing, scene anchor/layer order, five rendered phases, cached lighting, static reduced motion, pause and resource preview');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
