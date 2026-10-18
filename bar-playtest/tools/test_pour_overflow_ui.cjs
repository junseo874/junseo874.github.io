const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await page.locator('.updates-confirm').isVisible())await page.locator('.updates-confirm').click();
  await page.evaluate(()=>{window.moneySounds=0;LunaCurrencyAudio.play=()=>moneySounds++;window.originalTick=barGame.tick;barGame.tick=()=>{};});
  for(const ingredient of ['beer','soda_water','gin']){
   await page.evaluate(ingredient=>{const g=barGame;g.startMinigame('pour',{ingredient});g.holdPour(true);g.gimmick.dragAngle=150;window.moneyBefore=g.progress.money;},ingredient);
   await page.locator('[data-fluid-stage]').waitFor();await page.waitForTimeout(50);
   // Advance toward first spill; then present normal 1-frame receipts.
   await page.evaluate(()=>{const g=barGame;for(let i=0;i<1600&&g.gimmick.fluid.overflowMl<1;i++)originalTick.call(g,1/120);});
   for(let i=0;i<10;i++){await page.evaluate(()=>originalTick.call(barGame,1/60));await page.waitForTimeout(18);}
   await page.locator('.currency-hud .currency-unit-loss').first().waitFor();
   const r=await page.evaluate(()=>{const f=barGame.gimmick.fluid;return {charged:f.overflowCharged,overflow:f.overflowMl,money:barGame.progress.money,before:moneyBefore,sounds:moneySounds,foam:f.foamMl,drops:f.overflowDrops.length};});
   assert.equal(r.before-r.money,Math.floor(r.overflow+1e-8));assert.equal(r.sounds,0);assert(r.drops>0);if(ingredient==='beer')assert(r.foam>0);
   assert((await page.locator('.currency-unit-loss').allTextContents()).every(s=>s==='−1'));
   assert(await page.locator('.currency-unit-loss').evaluateAll(nodes=>nodes.every(el=>{const s=getComputedStyle(el);return el.classList.contains('currency-delta')&&s.right==='18px'&&s.top==='52px'&&s.fontSize==='28px'&&!el.style.right;})),'Every -1 uses the original single delta anchor and typography');
   const pixels=await page.evaluate(()=>{
    const f=barGame.gimmick.fluid,b=f.glass,c=document.createElement('canvas');c.width=1000;c.height=540;const ctx=c.getContext('2d');
    LunaPourLiquid.drawOverflow(ctx,{fluid:f},{rgb:[230,170,70],alpha:.8,foam:'#fff2ce'});
    const data=ctx.getImageData(0,0,1000,540).data;let count=0;
    for(let y=0;y<540;y++)for(let x=0;x<1000;x++)if(data[(y*1000+x)*4+3]){count++;if(y<b.top-5||y>=b.bottom+12||!((x>=b.left-35&&x<b.left+3)||(x>=b.right-3&&x<b.right+35)))throw Error('Overflow bypassed rim bounds');}
    return count;
   });assert(pixels>0);
   // Let the exterior rivulets travel down the walls while continuing to pour.
   for(let i=0;i<30;i++){await page.evaluate(()=>originalTick.call(barGame,1/60));await page.waitForTimeout(17);}
   assert(await page.locator('.currency-unit-loss').count()>4,'Sustained overflow creates more than four overlapping receipts');
   await page.screenshot({path:'/private/tmp/pour-overflow-'+ingredient+'.png'});
   await page.keyboard.press('Escape');const balance=await page.evaluate(()=>barGame.progress.money);await page.evaluate(()=>{for(let i=0;i<120;i++)originalTick.call(barGame,1/60);});assert.equal(await page.evaluate(()=>barGame.progress.money),balance);await page.keyboard.press('Escape');
   await page.evaluate(()=>{barGame.holdPour(false);for(let i=0;i<300;i++)originalTick.call(barGame,1/120);});
   assert.equal(await page.evaluate(()=>barGame.gimmick.fluid.overflowDrops.length),0);
   await page.waitForTimeout(2900);assert.equal(await page.locator('.currency-hud').count(),0);
  }
  assert.deepEqual(errors,[]);console.log('PASS live beer/soda/spirit overflow, right-side silent -1 HUD in simulator, pause and drain cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
