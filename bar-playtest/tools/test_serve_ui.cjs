const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(root+'/data.js','utf8'),ctx);
const D=ctx.window.LUNA_DATA,C=require(root+'/core.js');
function complete(g,id){g.selectCocktail(id);g.debugFill();g.startCraft();g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));g.craft.index=g.craft.queue.length;g.nextGimmick();}
for(const id of ['gin_tonic','gin_fizz','dry_martini','cosmopolitan','kahlua_milk','blue_hawaii']){
 const g=new C.Game(D);g.reset(99,'practice',1);complete(g,id);
 const price=Number(g.cocktail(id).price),before=g.progress.money,order={id:'retained',cocktail:id};g.currentOrder=order;
 g.overlay='settings';assert.equal(g.discard(),false);g.overlay=null;
 assert.equal(g.discard(),true);assert.equal(g.progress.money,before-price);assert.equal(g.discard(),false);
 assert.equal(g.progress.money,before-price);assert.equal(g.screen,'discarding');assert.equal(g.currentOrder,order);
 g.tick(.2);g.tick(.2);g.paused=true;g.tick(.2);assert.equal(g.screen,'discarding');g.paused=false;
 for(let i=0;i<6;i++)g.tick(.2);
 assert.equal(g.screen,'prep');assert.deepEqual(g.prep,{selected:id,glass:null,tool:null,ingredients:[]});
 assert.equal(g.craft,null);assert.equal(g.result,null);assert.equal(g.resultContext.craft_grade,undefined);
 assert.equal(g.logs.filter(l=>l.type==='discard').length||g.logs.filter(l=>l.event==='discard').length,1);
 g.reset(99,'practice',1);assert.equal(g.discardFeedback,null);
}
console.log('SERVE_CORE_OK: price debit once, pause, order retained, empty same-recipe preparation, negative balance allowed, reset.');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 await p.goto(BASE);
 const craft=async(id,variant='original')=>{
  await p.evaluate(({id,variant})=>{
   const g=barGame;g.reset(99,'practice',1,true,{variant});g.selectCocktail(id);g.debugFill();g.startCraft();
   g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));
   g.craft.index=g.craft.queue.length;g.nextGimmick();g.changed();
  },{id,variant});
  await p.locator('.serve-presentation[data-cocktail="'+id+'"]').waitFor();
 };
 await craft('gin_tonic');
 assert.equal(await p.locator('[data-act=offer]').count(),0);assert.equal(await p.locator('.serve-grade').count(),0);
 await p.waitForTimeout(250);await p.keyboard.press('Escape');
 await p.waitForTimeout(100);const frozen=await p.locator('.serve-canvas').getAttribute('data-frame');
 await p.waitForTimeout(350);assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),frozen);
 await p.keyboard.press('Escape');
 await p.locator('[data-act=offer]').waitFor();
 assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'29');
 assert.equal(await p.locator('.currency-hud').count(),0);
 await p.waitForTimeout(250);assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'29');
 await p.screenshot({path:'/private/tmp/serve-gin-tonic.png'});
 await p.locator('[data-act=serveDetails]').click();await p.locator('.serve-score-detail').waitFor();
 assert((await p.locator('.serve-score-detail').innerText()).includes('100.0'));
 await p.screenshot({path:'/private/tmp/serve-details.png'});
 await p.keyboard.press('Escape');
 await p.locator('[data-act=offer]').click();
 assert.equal(await p.evaluate(()=>barGame.screen),'bar');assert.equal(await p.evaluate(()=>barGame.drink.selected),'gin_tonic');
 assert.equal(await p.evaluate(()=>barGame.transactions.length),0,'Offer must not auto-serve');
 for(const id of ['cosmopolitan','dry_martini','gin_fizz','kahlua_milk','blue_hawaii']){
  await craft(id);await p.locator('[data-act=offer]').waitFor();
  assert.equal(await p.locator('.serve-canvas').getAttribute('data-frame'),'29');
  if(id==='blue_hawaii')assert.equal(await p.locator('.serve-fallback').count(),1);
  else assert.equal(await p.locator('.serve-fallback').count(),0);
  await p.screenshot({path:'/private/tmp/serve-'+id+'.png'});
 }
 for(const variant of ['original','gpt']){
  await craft('dry_martini',variant);await p.locator('[data-act=discard]').waitFor();
  const before=await p.evaluate(()=>barGame.progress.money),price=await p.evaluate(()=>Number(barGame.cocktail('dry_martini').price));
  await p.locator('[data-act=discard]').click();
  assert.equal(await p.evaluate(()=>barGame.screen),'discarding');assert.equal(await p.evaluate(()=>barGame.progress.money),before-price);
  assert.equal(await p.locator('.currency-delta').textContent(),'−300');
  assert.equal(await p.locator('[data-act=discard]').count(),0);
  await p.waitForTimeout(300);await p.screenshot({path:'/private/tmp/serve-discard-'+variant+'.png'});
  await p.waitForFunction(()=>barGame.screen==='prep');
  assert.deepEqual(await p.evaluate(()=>barGame.prep),{selected:'dry_martini',glass:null,tool:null,ingredients:[]});
  assert.equal(await p.locator('.prep-recipe').count(),0);await p.waitForTimeout(1700);
  assert.equal(await p.locator('.currency-delta').count(),0);
 }
 // A fresh result owns a fresh animation clock, including a repeated recipe.
 await craft('gin_tonic');assert.equal(await p.locator('.serve-grade').count(),0);
 await p.locator('[data-act=offer]').waitFor();await p.setViewportSize({width:960,height:600});
 const bounds=await p.locator('.serve-presentation').boundingBox();
 assert(Math.abs(bounds.width/bounds.height-16/9)<.01);
 await p.screenshot({path:'/private/tmp/serve-small.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 console.log('SERVE_UI_OK: 5 sheets + fallback, 30-frame one-shot, no early grade/actions, pause, details, offer not auto-serve, paid discard both variants, clean retry, reset, 16:9, no console/asset errors.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
