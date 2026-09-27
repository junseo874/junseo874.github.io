const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dir+'/currency-view.js','utf8'),ctx);
const view=ctx.window.LunaCurrencyView();let p={money:300},v=view.update(p);
assert.equal(v.active,false);p.money+=100;v=view.update(p);assert.equal(v.displayed,300);assert.equal(v.delta,100);
for(let i=0;i<4;i++)v=view.update(p,.1);assert(v.displayed>300&&v.displayed<400);
const mid=v.displayed;p.money+=20;v=view.update(p);assert.equal(v.displayed,mid);assert.equal(v.delta,120);
v=view.update(p,1,true);assert.equal(v.displayed,mid);
for(let i=0;i<9;i++)v=view.update(p,.1);assert.equal(v.displayed,420);
p.money-=50;v=view.update(p);assert.equal(v.delta,-50);
for(let i=0;i<28;i++)v=view.update(p,.1);assert.equal(v.displayed,370);assert.equal(v.active,false);
p={money:300};v=view.update(p);assert.equal(v.active,false);assert.equal(v.displayed,300);
p.money+=100;view.update(p);view.update(p,.1);p.money-=40;v=view.update(p);assert.equal(v.displayed,400);assert.equal(v.delta,-40);
v=view.update(p,.1);assert(v.displayed<400&&v.displayed>360,'Expense counts down even during unfinished income');
console.log('CURRENCY_UNIT_OK: initial/reset, income, chained income, pause, spend, exact balance.');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await b.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/');
 const number=async()=>Number((await page.locator('.currency-value').innerText()).replaceAll(',',''));
 for(const variant of ['original','gpt']){
  await page.evaluate(()=>barGame.reset(99,'practice',1,false));
  await page.locator('[data-act="version"][data-id="'+variant+'"]').click();
  await page.evaluate(variant=>{barGame.reset(99,'practice',1,true,{variant});barGame.screen='bar';barGame.speed=0;},variant);
  await page.waitForTimeout(180);
  assert.equal(await page.locator('.currency-delta').count(),0);
  const settle=()=>page.evaluate(()=>{
   const g=barGame,before=g.progress.money,id='money_test_'+(++g.serial);
   g.settle({orderId:id,served:'gin_tonic',grade:'excellent',match:true});
   return {before,after:g.progress.money};
  });
  const first=await settle();await page.waitForTimeout(230);
  assert(await number()>first.before&&await number()<first.after,'Visible count-up');
  assert.equal(await page.locator('.currency-delta').innerText(),'+'+(first.after-first.before).toLocaleString());
  const second=await settle();await page.waitForTimeout(160);
  assert.equal(await page.locator('.currency-delta').innerText(),'+'+(second.after-first.before).toLocaleString());
  await page.keyboard.press('Escape');await page.waitForTimeout(100);const paused=await number();
  await page.waitForTimeout(450);assert.equal(await number(),paused);
  await page.keyboard.press('Escape');await page.waitForTimeout(950);assert.equal(await number(),second.after);
  await page.screenshot({path:'/private/tmp/currency-income-'+variant+'.png'});
  await page.evaluate(()=>{barGame.progress.money-=50;});await page.waitForTimeout(150);
  assert.equal(await page.locator('.currency-delta').innerText(),'−50');
  assert.equal(await page.locator('.currency-hud.currency-spending').count(),1);
  await page.waitForTimeout(850);assert.equal(await number(),second.after-50);
  // Reset during an active effect must not replay initial money as income.
  await page.evaluate(variant=>{barGame.reset(99,'practice',1,true,{variant});barGame.screen='bar';},variant);
  await page.waitForTimeout(120);assert.equal(await page.locator('.currency-delta').count(),0);
  // Daily settlement stops the game clock, not the presentation clock.
  await page.evaluate(()=>{barGame.finished=true;barGame.progress.money+=75;});
  await page.waitForTimeout(1100);assert.equal(await number(),await page.evaluate(()=>barGame.progress.money));
  await page.waitForTimeout(1700);assert.equal(await page.locator('.currency-delta').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  const final=await settle();await page.waitForTimeout(150);assert.equal(await number(),final.after);
  assert.equal(await page.locator('.currency-delta').evaluate(e=>getComputedStyle(e).transform),'matrix(1, 0, 0, 1, 0, 0)');
  await page.emulateMedia({reducedMotion:'no-preference'});
 }
 assert.deepEqual(errors,[]);console.log('CURRENCY_UI_OK: both versions, actual settlements + bonus, count, combined income, pause, deduction, reset, finished screen, reduced motion.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
