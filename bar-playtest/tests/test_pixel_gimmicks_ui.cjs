const {chromium}=require('../../tools/lib/test-runtime.cjs').load('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:require('../../tools/lib/test-runtime.cjs').chrome,headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');await p.waitForFunction(()=>!!window.barGame);if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 async function point(x,y){const r=await p.locator('[data-pixel-pour]').boundingBox(),k=Math.min(r.width/1000,r.height/540);return{x:r.x+(r.width-k*1000)/2+x*k,y:r.y+(r.height-k*540)/2+y*k};}
 for(const kind of ['pour','fill_up']){
  await p.evaluate(kind=>barGame.startMinigame(kind),kind);await p.locator('[data-pixel-pour]').waitFor();await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-renderer'),'pixel-canvas2d');
  const a=await point(450,210),z=await point(390,80);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y,{steps:12});
  await p.waitForFunction(()=>barGame.gimmick.fluid.caughtMl>10);
  assert(await p.evaluate(()=>barGame.gimmick.angle>98&&barGame.gimmick.angle<160));
  if(kind==='fill_up'){assert(await p.evaluate(()=>barGame.gimmick.fluid.can&&barGame.gimmick.fluid.foamMl>0));}
  await p.screenshot({path:'/private/tmp/pixel-'+kind+'.png'});
  await p.mouse.up();await p.waitForTimeout(600);
  assert.equal(await p.evaluate(()=>barGame.gimmick.angle),0);
  await p.keyboard.press('Escape');const before=await p.evaluate(()=>barGame.gimmick.fluid.time);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.time),before);await p.keyboard.press('Escape');
  await p.locator('[data-act="endGimmick"]').click();await p.waitForFunction(()=>barGame.screen==='minigame_result');
  const result=await p.evaluate(()=>barGame.minigame.result);assert(Math.abs(result.liquid.error)<1e-6);assert.equal(result.liquid.air,0);assert(result.value>0);
 }
 await p.evaluate(()=>barGame.startMinigame('pour'));await p.locator('[data-pixel-pour]').waitFor();
 let a=await point(450,210),z=await point(500,40);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y);await p.waitForFunction(()=>barGame.gimmick.fluid.popped);await p.mouse.up();assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.tool),'pourer');
 await p.evaluate(()=>barGame.startMinigame('open'));await p.locator('[data-opening-stage]').waitFor();
 await p.mouse.click(640,300);await p.waitForFunction(()=>barGame.gimmick.openPhase==='power');await p.waitForTimeout(250);await p.screenshot({path:'/private/tmp/pixel-open-power.png'});
 // A miss cannot change score, charge money or finish the bottle; three misses reset it.
 const money=await p.evaluate(()=>barGame.progress.money);
 await p.evaluate(()=>{const g=barGame,s=g.gimmick;for(let i=0;i<3;i++){s.powerPos=0;g.gimmickInput('Space');}});
 assert.equal(await p.evaluate(()=>barGame.gimmick.openPhase),'broken');await p.waitForFunction(()=>barGame.gimmick.openPhase==='power');assert.equal(await p.evaluate(()=>barGame.progress.money),money);
 await p.evaluate(()=>{barGame.gimmick.powerPos=.78;barGame.gimmickInput('Space');});await p.waitForFunction(()=>barGame.gimmick.openPhase==='rhythm');await p.screenshot({path:'/private/tmp/pixel-open-ring.png'});
 await p.evaluate(()=>{barGame.gimmick.beatTime=1.1;barGame.gimmickInput('Space');});assert(await p.evaluate(()=>barGame.gimmick.completed));
 await p.waitForTimeout(450);await p.screenshot({path:'/private/tmp/pixel-open-success.png'});
 assert.equal(await p.evaluate(()=>barGame.craft.elapsed),0);
 await p.waitForFunction(()=>barGame.gimmick.openFx.age>=4.1);await p.locator('[data-act="endGimmick"]').click();await p.waitForFunction(()=>barGame.screen==='minigame_result');assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS drag bottles and cans / foam / mass / cap pop / pause / finish / opening power+ring / retry without score or currency penalty');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
