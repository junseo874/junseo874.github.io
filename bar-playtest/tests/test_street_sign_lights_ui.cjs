const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});
 try{
  for(let i=1;i<=3;i++)assert(fs.readFileSync(path.resolve(__dirname,'../assets/outside/street-20261018/Lights/B_Light_'+i+'.png')).equals(fs.readFileSync('/Users/lee/Desktop/project/Human-Bartender/HumanBartender/Assets/01.Game/03.Content/01.ArtResources/02.Environments/02.Street/01.Sprites/Lights/B_Light_'+i+'.png')));
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const checks=await p.evaluate(()=>{
   const d=LUNA_OUTSIDE_DATA,ns=d.scenes.street.nodes,lights=ns.filter(n=>n.neon),parent=ns.find(n=>n.name==='B_Fore_Building_1'),ordered=LunaOutside.streetDrawOrder(ns),before=JSON.stringify(d);
   LunaStreetSigns.apply(d);
   return {count:lights.length,idempotent:before===JSON.stringify(d),bounds:lights.every(n=>{const s=n.sprite,a=d.assets[s.asset];return s.x>=0&&s.y>=0&&s.x+s.w<=a.w&&s.y+s.h<=a.h;}),order:lights.every(n=>ordered.indexOf(n)>ordered.indexOf(parent)&&ordered.indexOf(n)<ordered.findIndex(n=>n.name==='Luna')&&ordered.indexOf(n)<ordered.findIndex(n=>n.name==='B_ForeFore_Object_1')),aligned:lights.every(n=>{
    const legacy=LunaStreetSigns.signs.find(s=>'street-neon-'+s[0]===n.id),engine=LUNA_STREET_EFFECTS.lights.find(l=>l.id===n.engineLightId);
    const wx=legacy?legacy[3]:engine.x,wy=legacy?legacy[4]:engine.y,v=LunaOutside.streetParallax(n,{x:4,y:1},{scene:'street'});
    return Math.abs(n.x-parent.x-(wx-.085))<1e-9&&Math.abs(n.y-parent.y-(wy+.89))<1e-9&&v.x===n.x&&v.y===n.y;
   })};
  });
  assert.equal(checks.count,26);assert(checks.idempotent&&checks.bounds&&checks.order&&checks.aligned,JSON.stringify(checks));
  for(const [name,x]of [['left',-4.3],['shiba',-2.9],['bar',.1],['restaurant',2.5],['right',5]]){
   await p.evaluate(x=>{const o=outsidePlaytest,m=o.model;m.start({day:1,flow:'out',place:'bar'});m.x=x;m.story.cancel();m.backgroundStory.cancel();m.tick=()=>{};o.snapCamera();o.tick(0);},x);
   await p.waitForTimeout(60);await p.screenshot({path:'/private/tmp/neon-'+name+'.png'});
  }
  const effect=await p.evaluate(async()=>{
   const n=LUNA_OUTSIDE_DATA.scenes.street.nodes.find(n=>n.id==='street-neon-service-cluster'),s=n.sprite,im=new Image();im.src=LUNA_OUTSIDE_DATA.assets[s.asset].src;await im.decode();
   const c=document.createElement('canvas');c.width=s.w+60;c.height=s.h+60;const ctx=c.getContext('2d');
   const draw=()=>{ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.translate(30,30);LunaStreetSigns.paint(ctx,im,{...s,pivot:{x:0,y:1}},s.w,s.h);ctx.restore();return c.toDataURL();};
   const first=draw(),create=document.createElement.bind(document);let allocations=0;document.createElement=function(tag,...rest){if(tag==='canvas')allocations++;return create(tag,...rest);};
   let second;try{second=draw();}finally{document.createElement=create;}
   const data=ctx.getImageData(0,0,c.width,c.height).data;let spill=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(x<30||x>=30+s.w||y<30||y>=30+s.h)spill+=data[(y*c.width+x)*4+3];
   return {same:first===second,allocations,spill};
  });assert(effect.same&&effect.allocations===0&&effect.spill>0,JSON.stringify(effect));
  await p.goto('http://127.0.0.1:8123/bar-playtest/resource-review.html');await p.waitForFunction(()=>window.resourceReview?.ready);
  assert.equal(await p.evaluate(()=>resourceReview.rows.find(r=>r.id==='bg:street-composite').layers.filter(l=>l.neon).length),26);
  await p.evaluate(()=>resourceReview.select('bg:street-composite'));const downloading=p.waitForEvent('download');await p.evaluate(()=>resourceReview.downloadFrame());await(await downloading).saveAs('/private/tmp/neon-street-composite.png');
  assert.deepEqual(errors,[]);console.log('PASS 3 exact engine PNGs, 26 aligned lights including split engine cookies, occlusion order, cached stable bloom, five street views, resource composite and no errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
