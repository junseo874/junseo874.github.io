const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'serve-carbonation.js'),'utf8'),scope);
const fx=scope.window.LunaServeCarbonation;
assert.deepEqual(Object.keys(fx.profiles),['gin_tonic','gin_fizz','bottle_beer']);
for(const id of Object.keys(fx.profiles)){
 const p=fx.profiles[id],a=fx.sample(id,1),b=fx.sample(id,1.1);
 assert.equal(fx.sample(id,1.01).time,a.time,'Reference cadence is 15 fps');
 assert(a.bubbles.some((v,i)=>b.bubbles[i].y<v.y),'Carbonation rises');
 for(let t=0;t<15;t+=.1){
  const s=fx.sample(id,t);
  assert(s.bubbles.every(v=>v.y>=p.top&&v.y<=p.bottom&&v.alpha>=0&&v.alpha<=1));
  assert(s.drops.every(v=>v.y>=v.startY),'Condensation falls, never rises');
 }
 assert.deepEqual(fx.sample(id,2),fx.sample(id,2));
}
assert.equal(fx.sample('dry_martini',1),null);
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
  console.log('BROWSER_READY');
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');
  console.log('GAME_LOADED');
  await page.waitForFunction(()=>window.barGame&&window.LunaServeCarbonation);
  if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  async function craft(id,variant='original'){
   await page.evaluate(({id,variant})=>{
    const g=barGame;g.reset(99,'practice',1,true,{variant});g.selectCocktail(id);g.debugFill();g.startCraft();
    g.craft.results=g.craft.queue.map(q=>({...q,value:q.target,completed:true,completion:1,failures:0}));
    g.craft.index=g.craft.queue.length;g.nextGimmick();g.changed();
   },{id,variant});
   await page.locator('.serve-presentation[data-cocktail="'+id+'"]').waitFor();
  }
  for(const id of Object.keys(fx.profiles)){
   console.log('CHECK',id);
   await craft(id);
   assert.equal(await page.locator('[data-act=offer]').count(),0,'No early offer');
   assert.equal(await page.locator('.serve-carbonation').getAttribute('data-active'),'false','No effects on a moving/unloaded glass');
   await page.locator('.serve-carbonation[data-active=true]').waitFor();
   await page.waitForTimeout(900);
   const pixels=()=>page.locator('.serve-carbonation').evaluate(c=>c.toDataURL());
   const first=await pixels();await page.waitForTimeout(400);assert.notEqual(await pixels(),first,'FX continue after final serving frame');
   assert.equal(await page.locator('.serve-canvas').getAttribute('data-frame'),'29');
   await page.evaluate(()=>{barGame.paused=true;barGame.changed();});await page.waitForTimeout(150);
   const frozen=await pixels();await page.waitForTimeout(250);assert.equal(await pixels(),frozen,'Pause freezes FX');
   await page.evaluate(()=>{barGame.paused=false;barGame.changed();});await page.waitForTimeout(150);
   await page.screenshot({path:'/private/tmp/carbonation-'+id+'.png'});
   // Export the transparent effect alone to inspect clipping and density.
   await page.locator('.serve-carbonation').screenshot({path:'/private/tmp/carbonation-'+id+'-layer.png'});
   const stats=await page.locator('.serve-carbonation').evaluate(c=>{
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,k=Number(c.dataset.pixelScale);let count=0,outside=0;
    const offset=LUNA_SERVE_COMPOSITION.drinkOffsetY;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){count++;if(x<413*k||x>563*k||y<(160+offset)*k||y>(405+offset)*k)outside++;}
    return {count,outside};
   });
   assert(stats.count>60&&stats.count<2200,JSON.stringify({id,stats}));assert.equal(stats.outside,0);
   if(id==='bottle_beer'){
    await page.setViewportSize({width:960,height:600});await page.waitForTimeout(250);
    await page.screenshot({path:'/private/tmp/carbonation-beer-small.png'});
    const bounds=await page.locator('.serve-carbonation').boundingBox(),art=await page.locator('.serve-canvas').boundingBox();assert(Math.abs(bounds.width/bounds.height-16/9)<.01);assert.deepEqual(bounds,art);
    await page.setViewportSize({width:1280,height:720});
   }
  }
  await craft('gin_fizz','gpt');await page.locator('.serve-carbonation[data-active=true]').waitFor();
  await page.locator('[data-act=serveDetails]').click();await page.locator('.serve-score-detail').waitFor();
  assert((await page.locator('.serve-score-detail').innerText()).includes('100.0'));await page.keyboard.press('Escape');
  await page.locator('[data-act=offer]').click();assert.equal(await page.locator('.serve-carbonation').count(),0);
  assert.equal(await page.evaluate(()=>barGame.screen),'bar');assert.equal(await page.evaluate(()=>barGame.drink.selected),'gin_fizz');
  for(const variant of ['original','gpt']){
   await craft('bottle_beer',variant);await page.locator('.serve-carbonation[data-active=true]').waitFor();
   const before=await page.evaluate(()=>barGame.progress.money),price=await page.evaluate(()=>Number(barGame.cocktail('bottle_beer').price));
   await page.locator('[data-act=discard]').click();assert.equal(await page.evaluate(()=>barGame.progress.money),before-price);
   await page.waitForFunction(()=>barGame.screen==='prep');await page.locator('.serve-carbonation').waitFor({state:'detached'});
  }
  await craft('dry_martini');await page.locator('[data-act=offer]').waitFor();assert.equal(await page.locator('.serve-carbonation').count(),0);
  await craft('gin_tonic');assert.equal(await page.locator('.serve-carbonation').getAttribute('data-active'),'false');
  assert.deepEqual(errors,[]);
  console.log('SERVE_CARBONATION_OK: three drinks, rise/fall, 15fps, clipped glass, continuing loop, pause/reset, variants, responsive, no table FX.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
