const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../open-carbonation.js'),'utf8'),scope);
const fx=scope.window.LunaOpenCarbonation;
assert.equal(fx.duration,2.05);assert.equal(fx.sample(0).length,0);assert.equal(fx.sample(2.05).length,0);assert.equal(fx.sample(20).length,0);
const a=fx.sample(.8),b=fx.sample(.9);assert(a.length>20);
assert(a.every(p=>{const q=b.find(q=>q.i===p.i);return !q||q.y<p.y;}),'Every surviving bubble rises');
for(let t=0;t<2.1;t+=.05)assert(fx.sample(t).every(p=>Math.abs(p.x)<20&&p.y>=33&&p.y<=109));
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.setDefaultTimeout(15000);
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
 await p.addStyleTag({content:'.pause-full,.qa-launch{display:none!important}'});
 async function setup(variant,mini){await p.evaluate(({variant,mini})=>{const g=barGame;if(mini)g.startMinigame('open',variant);else{g.reset(99,'practice',1,true,{variant});g.selectCocktail('bottle_beer');g.debugFill();g.startCraft();}g.changed();},{variant,mini});await p.locator('[data-opening-stage]').waitFor();}
 async function hit(){await p.evaluate(()=>{
  const g=barGame,s=g.gimmick;g.gimmickInput('Space');s.powerPos=.78;g.gimmickInput('Space');
  for(let i=0;i<3;i++)g.tick(.2);s.beatTime=1.1;g.gimmickInput('Space');g.changed();
 });}
 for(const variant of ['original','gpt']){
  await setup(variant,false);assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'),'0');
  // Genuine failed power press must not trigger carbonation.
  await p.evaluate(()=>{barGame.gimmickInput('Space');barGame.gimmick.powerPos=0;barGame.gimmickInput('Space');});
  await p.waitForTimeout(100);assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'),'0');
  await setup(variant,false);await hit();assert(await p.evaluate(()=>barGame.gimmick.completed));
  await p.waitForTimeout(600);assert(Number(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'))>0);
  assert(await p.locator('[data-act=endGimmick]').isDisabled());
  assert.equal(await p.evaluate(()=>barGame.endGimmick()),false,'Cannot skip the rising cluster');
  await p.evaluate(()=>{barGame.paused=true;barGame.changed();});await p.waitForTimeout(80);
  const frozen=await p.locator('[data-opening-stage]').evaluate(c=>c.toDataURL());
  await p.waitForTimeout(200);assert.equal(await p.locator('[data-opening-stage]').evaluate(c=>c.toDataURL()),frozen);
  if(variant==='original')for(const age of [.25,.65,1,1.4,1.9]){
   await p.evaluate(age=>{barGame.gimmick.openFx.age=age;barGame.changed();},age);await p.waitForTimeout(100);
   await p.screenshot({path:'/private/tmp/open-fizz-'+age+'.png'});
  }
  await p.evaluate(()=>{barGame.paused=false;barGame.changed();});
  if(variant==='original'){await p.waitForFunction(()=>barGame.gimmick.openFx.age>=2.05);await p.locator('[data-act=endGimmick]').click();}
  await p.waitForFunction(()=>barGame.gimmick?.type==='pour');await p.locator('[data-opening-stage]').waitFor({state:'detached'});
  assert.equal(await p.evaluate(()=>barGame.craft.results[0].failures),0);
 }
 // Standalone minigame retains the existing 4.1s sound tail; visual does not loop.
 await setup('original',true);await hit();await p.waitForTimeout(2400);
 assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'),'0');
 assert(await p.locator('[data-act=endGimmick]').isDisabled());
 await p.waitForFunction(()=>barGame.gimmick.openFx.age>=4.1);await p.locator('[data-act=endGimmick]').click();await p.locator('.minigame-result').waitFor();
 await setup('original',false);assert.equal(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'),'0');
 await p.emulateMedia({reducedMotion:'reduce'});await hit();await p.waitForTimeout(700);
 assert(Number(await p.locator('[data-opening-stage]').getAttribute('data-carbonation'))>0);
 await p.setViewportSize({width:960,height:600});await p.screenshot({path:'/private/tmp/open-fizz-small.png'});
 assert.deepEqual(errors,[]);console.log('OPEN_CARBONATION_OK: upward amber rings, success only, one-shot, both variants, 2.05s transition guard, pause/retry, 4.1s minigame hold, reduced motion, responsive, no asset errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
