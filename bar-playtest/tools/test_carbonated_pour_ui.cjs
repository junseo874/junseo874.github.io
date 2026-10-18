const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');await p.waitForFunction(()=>!!window.barGame);if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 for(const ingredient of ['beer','soda_water','cola']){
  await p.evaluate(id=>{barGame.startMinigame('pour');const s=barGame.gimmick;s.ingredient=id;s.target=150;s.unit='ml';LunaPour.init(s,barGame);barGame.changed();},ingredient);
  await p.locator('[data-pixel-pour]').waitFor();const r=await p.locator('[data-pixel-pour]').boundingBox(),k=Math.min(r.width/1000,r.height/540),point=(x,y)=>({x:r.x+(r.width-1000*k)/2+x*k,y:r.y+(r.height-540*k)/2+y*k});
  // A fixed 145-degree drag makes the foam comparison use the same flow.
  const grip=await p.evaluate(()=>barGame.gimmick.fluid.nozzle()),move=angle=>{const radians=angle*Math.PI/180,z=point(grip.x-80*Math.sin(radians),grip.y+80*Math.cos(radians));return p.mouse.move(z.x,z.y);};
  await move(0);await p.mouse.down();await p.waitForTimeout(180);
  for(let angle=10;angle<=140;angle+=10)await move(angle);await move(145);
  await p.waitForFunction(()=>barGame.gimmick.fluid.caughtMl>100);
  const state=await p.evaluate(()=>{const f=barGame.gimmick.fluid;return {ingredient:f.ingredient,foam:f.foamHeight(),carbonated:f.carbonated,flow:f.flow,amount:f.caughtMl};});
  assert(state.carbonated&&(ingredient==='soda_water'?state.foam>0&&state.foam<3:ingredient==='beer'?state.foam>30:state.foam>2),JSON.stringify(state));await p.screenshot({path:'/private/tmp/carbonation-'+ingredient+'.png'});
  await p.mouse.up();await p.waitForTimeout(700);const before=await p.evaluate(()=>({foam:barGame.gimmick.fluid.foamMl,amount:barGame.gimmick.fluid.caughtMl}));await p.waitForTimeout(500);const after=await p.evaluate(()=>({foam:barGame.gimmick.fluid.foamMl,amount:barGame.gimmick.fluid.caughtMl,error:barGame.gimmick.fluid.audit().error}));assert(after.foam<before.foam);assert(Math.abs(after.amount-before.amount)<1e-6);assert(Math.abs(after.error)<1e-6);
 }
 assert.deepEqual(errors,[]);console.log('PASS beer head / thin soda fizz / cola froth, actual drag, settling and volume conservation');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
