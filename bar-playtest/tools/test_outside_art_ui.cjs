const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.evaluate(()=>outsidePlaytest.start());await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);
  const check=await p.evaluate(()=>{
   const d=LUNA_OUTSIDE_DATA,ns=d.scenes.street.nodes,R=LunaResidence.layout,b=ns.find(n=>n.name==='residence-building'),f=ns.find(n=>n.name==='residence-railing');
   const before=JSON.stringify(d);LunaOutsideArt.apply(d);
   const car=ns.find(n=>n.name==='Elevator'),front=ns.find(n=>n.name==='Elevator Fore');
   const left=n=>n.x-n.sprite.w*n.sprite.pivot.x*n.sx/100,top=n=>n.y+n.sprite.h*(1-n.sprite.pivot.y)*n.sy/100;
   if(Math.abs(left(front)-left(car)-.12)>.0001||Math.abs(top(car)-top(front)-.45)>.0001)throw Error('Elevator front must align to body pixel (12,45)');
   if(Math.abs(car.y-R.elevatorBottom+.25)>.0001||Math.abs(front.y-R.elevatorBottom-.09+.25)>.0001)throw Error('Lower the whole cabin 25 native pixels, keeping front/body aligned');
   if(LunaOutsideArt.passengerOffset)throw Error('The lift approach is flat: no artificial passenger elevation');
   if(f.sprite.y!==0||f.sprite.h!==709)throw Error('Use the whole foreground, including upper rail and pillars');
   const ordered=LunaOutside.streetDrawOrder(ns);
   if(ordered.indexOf(f)<=ordered.findIndex(n=>n.name==='Luna'))throw Error('Foreground must cover Luna');
   return {version:d.streetArtVersion,idempotent:before===JSON.stringify(d),assets:Object.values(d.assets).filter(a=>a.src.includes('/street-20261018/')),bounds:ns.every(n=>!n.sprite||n.sprite.x+n.sprite.w<=d.assets[n.sprite.asset].w&&n.sprite.y+n.sprite.h<=d.assets[n.sprite.asset].h),homeCenter:b.x+(562+43/2)/100,homeX:R.homeX,railingY:f.y,doorFloor:b.y-477/100,oldPanel:ns.some(n=>n.name==='Elevator Door'),glow:LunaInteractionGlow.region({id:'home'},b,b.sprite,b.x,b.y,outsidePlaytest.model)};
  });
  assert.equal(check.version,'20261018');assert(check.idempotent&&check.bounds);assert.equal(check.assets.length,24);assert.equal(check.oldPanel,false);
  assert(Math.abs(check.homeCenter-check.homeX)<.01);assert(Math.abs(check.railingY-2.48-check.doorFloor)<.001);assert.deepEqual(check.glow,[562,397,43,80]);
  for(const a of check.assets){const local=path.resolve(__dirname,'..',a.src),data=fs.readFileSync(local);assert.equal(data.readUInt32BE(16),a.w);assert.equal(data.readUInt32BE(20),a.h);const source=path.join('/Users/lee/Desktop/new',a.src.split('/street-20261018/')[1]);if(fs.existsSync(source))assert(data.equals(fs.readFileSync(source)),'Source unchanged '+source);}
  // Inspect actual render calls, not just metadata: no lift proximity changes
  // Luna's anchor, and the complete occluder is drawn after actors.
  const flat=await p.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,R=LunaResidence.layout,d=LUNA_OUTSIDE_DATA;
   const ctx=document.querySelector('#outside-root canvas').getContext('2d'),draw=ctx.drawImage,translate=ctx.translate;
   const seen=[],results=[];let xy;
   ctx.translate=function(x,y){xy=[x,y];return translate.call(this,x,y);};
   ctx.drawImage=function(img,...args){seen.push({src:img.src,xy,args});return draw.call(this,img,...args);};
   try{
    for(const level of [0,1])for(const dx of [.35,.25,.1,0]){
     m.start({day:0,flow:'out',place:level?'homeDoor':'bar'});m.level=level;m.x=R.elevatorX+dx;m.y=level?R.upperY:-.7;m.elevatorY=level?R.elevatorTop:R.elevatorBottom;
     m.story.cancel();m.backgroundStory.cancel();o.snapCamera();seen.length=0;o.tick(0);
     const frame=d.animations[m.anim].frames[Math.floor(m.animTime*d.animations[m.anim].fps)%d.animations[m.anim].frames.length],asset=d.assets[frame.asset],src=typeof asset==='string'?asset:asset.src;
     const i=seen.findIndex(s=>s.src?.endsWith(src)),player=seen[i],cam=o.camera;
     results.push(!!player&&player.xy[1]===Math.round(360-(m.y-cam.y)*1280/cam.w));
     if(level){const f=seen.findIndex(s=>s.src?.endsWith('/Layers/near_foreground_2.png'));
      results.push(f>i&&JSON.stringify(seen[f].args.slice(0,4))==='[0,0,952,709]');}
    }
   }finally{ctx.translate=translate;ctx.drawImage=draw;}
   return results;
  });
  assert(flat.every(Boolean),'Flat lift approach at both floors; complete foreground draws after Luna');
  for(const [name,x,level]of [['bar',1,0],['shop',-2.87,0],['posters',-5.7,0],['fence',-8.78,0],['lift',-12.51,0],['upper-lift',-12.51,1],['home',-16.36,1],['upper-pillar',-13.5,1],['upper-brace',-17.9,1],['upper-left',-21.65,1]]){
   await p.evaluate(({x,level})=>{const o=outsidePlaytest,m=o.model,R=LunaResidence.layout;m.start({day:0,flow:'out',place:level?'homeDoor':'bar'});m.x=x;m.level=level;m.y=level?R.upperY:-.7;m.elevatorY=level?R.elevatorTop:R.elevatorBottom;m.story.cancel();m.backgroundStory.cancel();m.updateNear();o.snapCamera();o.tick(0);},{x,level});
   await p.waitForTimeout(450);await p.screenshot({path:'/private/tmp/new-street-'+name+'.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS 24 exact PNG copies, dimensions/crops, idempotent override, doorway/railing alignment, new glow, street/home/lift render and no asset errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
