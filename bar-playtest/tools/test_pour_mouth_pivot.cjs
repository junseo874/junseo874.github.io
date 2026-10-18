const assert=require('node:assert/strict'),P=require('../pour-fluid');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
// Rotation no longer makes the emitter orbit a body-center grip.
{
 const f=new P.Simulation({ingredient:'beer',targetMl:180}),s={held:false,angle:0};f.setTool('none',s);
 const start=f.nozzle();for(const a of [0,45,90,145,175]){s.angle=a;assert.deepEqual(f.nozzle(),start);}
 s.angle=0;s.held=true;s.dragAngle=145;s.pourOffset={x:-24,y:20};
 let last=start,sourceChecks=0;
 for(let i=0;i<360;i++){
  f.tick(s,P.STEP);const at=f.nozzle();assert(Math.hypot(at.x-last.x,at.y-last.y)<6,'Bounded hand speed');last=at;
  const p=f.particles.at(-1);if(p&&p.age===P.STEP){assert(Math.abs(p.x-p.vx*P.STEP-at.x)<1e-8);assert(Math.abs(p.y-p.vy*P.STEP-at.y)<1e-8);sourceChecks++;}
 }
 assert(sourceChecks>100);assert(f.caughtMl>0);assert(Math.abs(f.audit().error)<1e-7);
 assert(Math.abs(f.motion.x-(P.MOUTH.pourX-8))<.1);assert(Math.abs(f.motion.y-(P.MOUTH.pourY+6))<.1);
 assert(Math.hypot(P.MOUTH.pourX-P.MOUTH.x,P.MOUTH.pourY-P.MOUTH.y)<=10,'Small automatic travel');
 f.requestFinish(s);for(let i=0;i<600&&!f.ready;i++)f.tick(s,P.STEP);
 assert(f.ready);assert(Math.hypot(f.motion.x-start.x,f.motion.y-start.y)<.1);assert(Math.abs(f.audit().error)<1e-7);
 console.log('PASS lip pivot, moving-emitter alignment, bounded spring motion, guided catch and soft return');
}
(async()=>{let browser;try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await page.locator('.updates-close').count())await page.locator('.updates-close').click();
 for(const [ingredient,width,height] of [['gin',1280,720],['tequila',1280,720],['beer',1280,720],['soda_water',1280,720],['cola',960,540],['milk',1440,900]]){
  await page.setViewportSize({width,height});
  await page.evaluate(id=>{const g=barGame;g.startMinigame('pour');const s=g.gimmick;s.ingredient=id;s.target=180;s.unit='ml';LunaPour.init(s,g);delete s.pourTutorial;g.changed();},ingredient);
  await page.locator('[data-pixel-pour]').waitFor();await page.waitForTimeout(180);
  const r=await page.locator('[data-pixel-pour]').boundingBox(),k=Math.min(r.width/1000,r.height/540),ox=r.x+(r.width-1000*k)/2,oy=r.y+(r.height-540*k)/2;
  const at=await page.evaluate(()=>barGame.gimmick.fluid.nozzle()),radius=['soda_water','cola'].includes(ingredient)?64:100;
  const move=(angle,reach=radius)=>page.mouse.move(ox+(at.x-reach*Math.sin(angle*Math.PI/180))*k,oy+(at.y+reach*Math.cos(angle*Math.PI/180))*k);
  await move(0);await page.mouse.down();await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>barGame.gimmick.angle),0);assert.deepEqual(await page.evaluate(()=>barGame.gimmick.fluid.nozzle()),at,'No pickup jump');
  for(let a=10;a<=140;a+=10)await move(a);await move(145);await page.waitForTimeout(900);
  assert(Math.abs(await page.evaluate(()=>barGame.gimmick.angle)-145)<.1,ingredient+' tilt');
  assert(await page.evaluate(()=>barGame.gimmick.fluid.caughtMl>0),ingredient+' catch');
  // Tiny reversals should not lag behind the hand or move the bottle around.
  for(const fine of [140,141,138,139,145]){
   await move(fine);await page.waitForTimeout(180);
   assert(Math.abs(await page.evaluate(()=>barGame.gimmick.angle)-fine)<.2,'Fine tilt '+ingredient+'/'+fine);
  }
  const before=await page.evaluate(()=>barGame.gimmick.fluid.nozzle());await move(145,radius+70);await page.waitForTimeout(700);
  const after=await page.evaluate(()=>barGame.gimmick.fluid.nozzle()),travel=Math.hypot(after.x-before.x,after.y-before.y);
  assert(travel>2&&travel<7,'Subtle hand translation '+ingredient+': '+travel);
  const diag=JSON.parse(await page.locator('[data-fluid-stage]').getAttribute('data-nozzle'));
  assert(Math.hypot(diag.x-after.x,diag.y-after.y)<.2,'Rendered lip matches emitter');
  if(['beer','soda_water','gin'].includes(ingredient))await page.screenshot({path:'/private/tmp/pour-mouth-'+ingredient+'.png'});
  if(ingredient==='gin'){
   const angle=await page.evaluate(()=>barGame.gimmick.dragAngle);
   await page.mouse.move(ox+(at.x+1)*k,oy+(at.y+1)*k);await move(15);await page.waitForTimeout(180);
   assert.equal(await page.evaluate(()=>barGame.gimmick.dragAngle),angle,'Crossing pivot must not flip the bottle');
  }
  if(ingredient==='beer'){
   await page.keyboard.press('Escape');await page.waitForTimeout(100);const frozen=await page.evaluate(()=>JSON.stringify(barGame.gimmick.fluid.motion));
   await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify(barGame.gimmick.fluid.motion)),frozen);await page.mouse.up();await page.keyboard.press('Escape');
  }else await page.mouse.up();
  await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>barGame.gimmick.angle),0);
  assert(await page.evaluate(()=>Math.hypot(barGame.gimmick.fluid.motion.x-LunaPour.MOUTH.x,barGame.gimmick.fluid.motion.y-LunaPour.MOUTH.y)<.1),'Returns to rest');
  // Straight up-left gesture works too, not just a carefully traced circle.
  await move(0);await page.mouse.down();await page.mouse.move(ox+(at.x-100)*k,oy+(at.y-70)*k,{steps:12});await page.waitForTimeout(650);
  assert(await page.evaluate(()=>barGame.gimmick.angle>115));await page.mouse.up();await page.waitForTimeout(1100);
  await page.keyboard.down('Space');await page.waitForTimeout(800);assert(await page.evaluate(()=>barGame.gimmick.angle>140));await page.keyboard.up('Space');
  await page.evaluate(()=>barGame.endGimmick());await page.waitForFunction(()=>barGame.screen==='minigame_result');
 }
 assert.deepEqual(errors,[]);console.log('PASS six ingredients, three viewport sizes, arc/straight drag, hand translation, no pickup snap, pause, release, keyboard and finish');
}finally{await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
