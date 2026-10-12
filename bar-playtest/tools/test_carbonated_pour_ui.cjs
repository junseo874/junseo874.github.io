const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');await p.waitForFunction(()=>!!window.barGame);if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 for(const ingredient of ['beer','soda_water','cola']){
  await p.evaluate(id=>{barGame.startMinigame('pour');const s=barGame.gimmick;s.ingredient=id;s.target=150;s.unit='ml';LunaPour.init(s,barGame);barGame.changed();},ingredient);
  await p.locator('[data-pixel-pour]').waitFor();const r=await p.locator('[data-pixel-pour]').boundingBox(),k=Math.min(r.width/1000,r.height/540),point=(x,y)=>({x:r.x+(r.width-1000*k)/2+x*k,y:r.y+(r.height-540*k)/2+y*k});
  const a=point(450,230),z=point(390,80);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y,{steps:12});await p.waitForFunction(()=>barGame.gimmick.fluid.caughtMl>100);
  assert(await p.evaluate(()=>barGame.gimmick.fluid.carbonated&&barGame.gimmick.fluid.foamHeight()>10));await p.screenshot({path:'/private/tmp/carbonation-'+ingredient+'.png'});
  await p.mouse.up();await p.waitForTimeout(700);const before=await p.evaluate(()=>({foam:barGame.gimmick.fluid.foamMl,amount:barGame.gimmick.fluid.caughtMl}));await p.waitForTimeout(500);const after=await p.evaluate(()=>({foam:barGame.gimmick.fluid.foamMl,amount:barGame.gimmick.fluid.caughtMl,error:barGame.gimmick.fluid.audit().error}));assert(after.foam<before.foam);assert(Math.abs(after.amount-before.amount)<1e-6);assert(Math.abs(after.error)<1e-6);
 }
 assert.deepEqual(errors,[]);console.log('PASS beer / soda / cola actual drag, visible foam, settling and volume conservation');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
