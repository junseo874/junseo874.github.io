// Exercise the composed scene: isolated shader tests cannot catch an effect
// that renders correctly on its own but is covered by a later opaque sprite.
const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{
 const browser=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(async()=>{
   LunaFocusSettings.setEnabled(false);lunaCampaign.screen('developer');
   Object.assign(outsidePlaytest.config,{day:1,flow:'out',place:'bar'});await outsidePlaytest.start();
   const o=outsidePlaytest,m=o.model;window.compositionTick=o.tick;o.tick=()=>{};m.tick=()=>{};
   m.controlsTutorial=false;m.story.cancel();m.backgroundStory.cancel();m.time=4;m.x=0;o.snapCamera();compositionTick(0);
  });
  const result=await page.evaluate(()=>{
   const o=outsidePlaytest,m=o.model,nodes=LUNA_OUTSIDE_DATA.scenes.street.nodes;
   const building=nodes.find(n=>n.name==='B_Fore_Building_1'),neons=nodes.filter(n=>n.neon),raster=nodes.find(n=>n.scanlinesOnly);
   const trace=[],r=LunaStreetAtmosphere.inspect(m).renderer;
   const light=LunaStreetSigns.paint,fx=LunaStreetEngineEffects.paintSprite,scan=LunaSignScanlines.paintSprite,pool=r.puddles;
   LunaStreetSigns.paint=(...a)=>{trace.push('neon');return light(...a);};
   LunaStreetEngineEffects.paintSprite=(...a)=>{if(a[1]===building.name)trace.push('building');return fx(...a);};
   LunaSignScanlines.paintSprite=(...a)=>{if(a[1]===building.name)trace.push('scan');return scan(...a);};
   r.puddles=function(...a){trace.push('puddle');return pool.apply(this,a);};
   compositionTick(0);
   LunaStreetSigns.paint=light;LunaStreetEngineEffects.paintSprite=fx;LunaSignScanlines.paintSprite=scan;r.puddles=pool;
   const canvas=document.querySelector('#outside-root canvas'),ctx=canvas.getContext('2d');
   const pixels=()=>{compositionTick(0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
   const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>2)n++;return n;};
   const normal=pixels();LunaStreetSigns.paint=()=>{};const withoutLights=pixels();LunaStreetSigns.paint=light;
   LunaSignScanlines.paintSprite=()=>{};const withoutScans=pixels();LunaSignScanlines.paintSprite=scan;
   // Removing the foreground building must change the water's captured source
   // as well as the visible facade. Previously the capture contained only fence.
   const capture=()=>{compositionTick(0);return r.captureCtx.getImageData(0,0,1280,720).data;};
   const captured=capture();building.active=false;const withoutBuilding=capture();building.active=true;
   const R=LunaResidence.layout,model={...m,elevatorY:R.elevatorBottom};
   const engineLift=LUNA_CHARACTER_SHADOWS.receivers.find(r=>r.ancestry.includes('Elevator'));
   const lift=LunaCharacterShadows.receivers(model).find(r=>r.id===engineLift.id);
   const actorCount=LunaStreetAtmosphere.actorViews(m,nodes).length;
   compositionTick(0);
   return{trace,lights:difference(normal,withoutLights),scans:difference(normal,withoutScans),
    capture:difference(captured,withoutBuilding),actorCount,
    neons:neons.every(n=>n.layer===building.layer&&n.order>building.order&&n.order<raster.order),
    lamp:neons.find(n=>n.id==='street-neon-door-lamp').x,
    lift:lift.rect,engineLift:engineLift.rect,error:LunaStreetAtmosphere.inspect(m).error,gl:r.gl.getError()};
  });
  assert(result.neons);assert(Math.abs(result.lamp-.82)<1e-6,'lamp follows its receiver, not old +13px placement');
  assert(result.trace.indexOf('building')<result.trace.indexOf('neon'),JSON.stringify(result));
  assert(result.trace.lastIndexOf('neon')<result.trace.indexOf('scan'),JSON.stringify(result));
  assert(result.trace.indexOf('scan')<result.trace.indexOf('puddle'),JSON.stringify(result));
  assert(result.lights>1000,'neon actually changes visible screen pixels');
  assert(result.scans>100,'CRT raster survives cookies and post processing');
  assert(result.capture>10000,'foreground facade occludes fence in reflection capture');
  assert.deepEqual(result.lift,result.engineLift,'engine-sized lift receiver must not be scaled a second time');
  assert.equal(result.error,null);assert.equal(result.gl,0);
  await page.screenshot({path:'/tmp/street-effects-composed-bar.png'});
  for(const [label,x,level]of [['camp',-6,0],['left',-14,0],['corridor',-16,1],['restaurant',3,0]]){
   await page.evaluate(({x,level})=>{const m=outsidePlaytest.model;m.x=x;m.level=level;m.y=level?LunaResidence.layout.upperY:-.7;outsidePlaytest.snapCamera();compositionTick(0);},{x,level});
   await page.screenshot({path:`/tmp/street-effects-composed-${label}.png`});
  }
  assert.deepEqual(errors,[]);console.log('STREET_EFFECT_COMPOSITION_OK',JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
