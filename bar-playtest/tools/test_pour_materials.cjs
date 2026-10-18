const assert=require('node:assert/strict'),P=require('../pour-fluid');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ids=['soda_water','beer','cola','champagne','vodka','whiskey','orange_juice','milk'];
const samples={};
for(const ingredient of ids){
 const f=new P.Simulation({ingredient,targetMl:180}),s={held:false,angle:0};f.setTool(P.toolForIngredient(ingredient),s);s.held=true;s.dragAngle=145;
 while(f.caughtMl<100&&f.time<20)f.tick(s,1/120);
 assert(f.caughtMl>=100);assert(Math.abs(f.audit().error)<1e-7);
 samples[ingredient]={foam:f.foamHeight(),wave:Math.max(...f.surface)-Math.min(...f.surface)};
 assert(samples[ingredient].wave>1,'Impact waves '+ingredient);
 s.held=false;s.dragAngle=null;for(let i=0;i<120;i++)f.tick(s,1/120);const mass=f.caughtMl,foam=f.foamMl;
 for(let i=0;i<600;i++)f.tick(s,1/120);
 assert(Math.abs(f.caughtMl-mass)<1e-7);assert(f.foamMl<=foam);assert(Math.max(...f.surface.map(Math.abs))<.05,'Waves settle '+ingredient);
 assert(Math.abs(f.audit().error)<1e-7);
}
assert(samples.beer.foam>30&&samples.beer.foam<70);assert(samples.soda_water.foam<2);assert(samples.cola.foam>samples.soda_water.foam);
for(const id of ['vodka','whiskey','orange_juice','milk'])assert.equal(samples[id].foam,0);
// Fixed-step effect state is deterministic too, not just measured volume.
const fpsResults=[30,60,120].map(fps=>{const f=new P.Simulation({ingredient:'beer',targetMl:180}),s={held:false,angle:0};f.setTool('none',s);s.held=true;s.dragAngle=145;for(let i=0;i<fps*3;i++)f.tick(s,1/fps);return {mass:f.caughtMl,surface:[...f.surface],foam:f.foamMl};});
for(const r of fpsResults.slice(1)){assert(Math.abs(r.mass-fpsResults[0].mass)<1e-7);r.surface.forEach((v,i)=>assert(Math.abs(v-fpsResults[0].surface[i])<1e-7));}
console.log('PASS material foam separation, finite surface waves, settling, conservation, 30/60/120 FPS determinism',samples);
// Known additions: 75% settles back into liquid, 25% survives indefinitely.
{
 const f=new P.Simulation({ingredient:'beer',targetMl:180}),s={held:false,angle:0};
 const add=ml=>{f.emittedMl+=ml;f.particles.push({id:f.serial++,x:550,y:f.glass.bottom,vx:0,vy:0,ml,age:0,emissionFlow:1,entered:true});f.tick(s,1/120);};
 const settle=()=>{for(let i=0;i<120*90;i++)f.tick(s,1/120);};
 let totalFoam=0;
 for(const ml of [40,20]){
  add(ml);totalFoam+=ml*(f.material.foamBase+f.material.foamFlow);
  assert(Math.abs(f.retainedFoamMl-totalFoam*.25)<1e-9);settle();
  assert(Math.abs(f.foamMl-totalFoam*.25)<1e-9);assert(Math.abs(f.audit().error)<1e-7);
 }
 assert.equal(new P.Simulation({ingredient:'beer',targetMl:180}).retainedFoamMl,0);
 // Overflow removes its share of the retained pool; nothing reappears later.
 s.held=true;s.dragAngle=145;f.setTool('none',{held:false,angle:0});
 for(let i=0;i<120*20;i++){f.tick(s,1/120);assert(f.retainedFoamMl<=f.foamMl+1e-9);assert(Math.abs(f.audit().error)<1e-7);}
 assert(f.spilledMl>0);s.held=false;s.dragAngle=null;settle();assert(Math.abs(f.audit().error)<1e-7);
 console.log('PASS beer retains 25% of generated foam after 90 seconds, top-ups, reset and overflow');
}
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await page.locator('.updates-close').count())await page.locator('.updates-close').click();
 for(const ingredient of ids){
  await page.evaluate(id=>{const g=barGame;g.startMinigame('pour');const s=g.gimmick;s.ingredient=id;s.target=180;s.unit='ml';LunaPour.init(s,g);g.holdPour(true);s.dragAngle=145;while(s.fluid.caughtMl<100&&s.fluid.time<20)s.fluid.tick(s,1/120);g.changed();},ingredient);
  await page.locator('[data-pixel-pour]').waitFor();await page.waitForTimeout(160);
  const active=await page.evaluate(()=>{const f=barGame.gimmick.fluid;return {kind:f.material.kind,error:f.audit().error,pixels:document.querySelector('[data-pixel-pour]').toDataURL()};});assert(Math.abs(active.error)<1e-7);
  await page.screenshot({path:'/private/tmp/pour-material-'+ingredient+'.png'});
  await page.evaluate(()=>{const s=barGame.gimmick;s.held=false;s.dragAngle=null;for(let i=0;i<480;i++)s.fluid.tick(s,1/120);barGame.changed();});await page.waitForTimeout(50);
  await page.screenshot({path:'/private/tmp/pour-material-'+ingredient+'-settled.png'});
  assert(await page.evaluate(()=>barGame.gimmick.fluid.particles.length===0));
  if(ingredient==='beer'){
   const retained=await page.evaluate(()=>{const s=barGame.gimmick,f=s.fluid,mass=f.caughtMl;for(let i=0;i<120*90;i++)f.tick(s,1/120);barGame.changed();return {massError:f.caughtMl-mass,foam:f.foamMl,floor:f.retainedFoamMl,height:f.foamHeight()};});
   assert(retained.floor>0&&retained.height>1);assert(Math.abs(retained.foam-retained.floor)<1e-8);assert(Math.abs(retained.massError)<1e-7);
   await page.waitForTimeout(50);await page.screenshot({path:'/private/tmp/pour-material-beer-retained.png'});
  }
 }
 await page.keyboard.down('Space');
 await page.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='true');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='false');
 const frozen=await page.evaluate(()=>JSON.stringify(barGame.gimmick.fluid.surface));await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>JSON.stringify(barGame.gimmick.fluid.surface)),frozen);
 await page.keyboard.up('Space');await page.keyboard.press('Escape');
 await page.keyboard.down('Space');await page.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='true');
 await page.keyboard.up('Space');await page.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioPlaying==='false');
 await page.evaluate(()=>barGame.endGimmick());await page.waitForFunction(()=>barGame.screen==='minigame_result');
 assert.deepEqual(errors,[]);console.log('PASS 8 material renders, live/settled states, audio start/stop/pause, pause and finish, no browser errors');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
