const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();await p.addStyleTag({content:'.qa-launch{display:none!important}'});
 for(const ingredient of ['gin','tequila','beer','soda_water','cola','milk']){
  await p.evaluate(ingredient=>{const g=barGame;g.startMinigame('pour','original');const s=g.gimmick;s.ingredient=ingredient;LunaPour.init(s,g);delete s.pourTutorial;lunaCampaign.render(true);},ingredient);
  await p.locator('[data-pixel-pour]').waitFor();await p.waitForTimeout(180);
  const geometry=await p.evaluate(()=>{const s=barGame.gimmick,P=LunaPour,grip=P.GRIP;let valid=true;for(let angle=0;angle<=s.fluid.maxAngle;angle++){const a=angle*Math.PI/180,n=P.nozzle(angle);if(Math.abs(n.x-grip.radius*Math.sin(a)-grip.x)>1e-8||Math.abs(n.y+grip.radius*Math.cos(a)-grip.y)>1e-8)valid=false;for(const grab of [0,.5,1])if(JSON.stringify(n)!==JSON.stringify(P.nozzle(angle,s.fluid.tool,grab)))valid=false;}return{valid,grip,nozzle:P.nozzle(0)};});assert(geometry.valid);
  const canvas=p.locator('[data-pixel-pour]'),r=await canvas.boundingBox(),scale=Math.min(r.width/1000,r.height/540),ox=r.x+(r.width-1000*scale)/2,oy=r.y+(r.height-540*scale)/2;
  const move=angle=>p.mouse.move(ox+(geometry.grip.x-45*Math.sin(angle*Math.PI/180))*scale,oy+(geometry.grip.y+45*Math.cos(angle*Math.PI/180))*scale);
  await move(0);await p.mouse.down();await p.waitForTimeout(350);
  assert.equal(await p.evaluate(()=>barGame.gimmick.angle),0,ingredient+' pickup must not rotate or translate');assert.deepEqual(JSON.parse(await p.locator('[data-fluid-stage]').getAttribute('data-nozzle')),geometry.nozzle);
  if(ingredient==='gin')await p.screenshot({path:'/private/tmp/pour-fixed-idle.png'});
  for(let angle=10;angle<=140;angle+=10)await move(angle);
  await move(145);await p.waitForTimeout(700);
  assert(Math.abs(await p.evaluate(()=>barGame.gimmick.angle)-145)<1);assert(await p.evaluate(()=>barGame.gimmick.fluid.caughtMl>0),ingredient+' stream must reach the glass');
  if(['gin','soda_water'].includes(ingredient))await p.screenshot({path:'/private/tmp/pour-fixed-'+ingredient+'.png'});
  await p.mouse.up();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>barGame.gimmick.angle),0);assert.deepEqual(JSON.parse(await p.locator('[data-fluid-stage]').getAttribute('data-nozzle')),geometry.nozzle);
  await p.keyboard.down('Space');await p.waitForTimeout(500);assert(await p.evaluate(()=>barGame.gimmick.angle>100));await p.keyboard.up('Space');await p.waitForTimeout(500);
  await p.locator('[data-act="endGimmick"]').click();await p.locator('.minigame-result').waitFor();
 }
 assert.deepEqual(errors,[]);console.log('POUR_FIXED_GRIP_OK: six ingredients, stationary pickup/release, fixed rotation pivot, relative pointer angle, real stream catch, keyboard and finish');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
