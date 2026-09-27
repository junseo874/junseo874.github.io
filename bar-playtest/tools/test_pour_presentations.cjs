const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 for(const renderer of ['webgl','canvas2d']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(renderer==='canvas2d')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl'?null:original.call(this,type,...rest);};});
  await page.goto('http://127.0.0.1:8123/bar-playtest/');
  for(const variant of ['original','gpt']){
   await page.evaluate(variant=>{const g=barGame;if(window.savedPourTick)g.tick=window.savedPourTick;g.startMinigame('pour',variant);g.gimmick.ingredient='beer';g.holdPour(true);for(let i=0;i<360;i++)g.tick(1/120);g.holdPour(false);window.savedPourTick=g.tick;g.tick=()=>{};},variant);
   await page.locator('[data-fluid-stage]').waitFor();
   const before=await page.evaluate(()=>({audit:barGame.gimmick.fluid.audit(),value:barGame.gimmick.value,elapsed:barGame.craft.elapsed}));
   for(const mode of ['classic','clean','bottle']){
    await page.locator('[data-act="pourPresentation"][data-id="'+mode+'"]').click();await page.waitForTimeout(160);
    assert.equal(await page.locator('[data-fluid-stage]').getAttribute('data-presentation'),mode);
    assert.equal(await page.locator('[data-fluid-stage]').getAttribute('data-renderer'),renderer);
    assert.equal(await page.locator('[data-act="pourPresentation"][aria-pressed="true"]').count(),1);
    assert.equal(await page.locator('[data-fluid-stage]').getAttribute('data-guides'),String(mode==='classic'));
    assert.equal(await page.locator('[data-fluid-stage]').getAttribute('data-receiver'),String(mode!=='bottle'));
    assert.deepEqual(await page.evaluate(()=>({audit:barGame.gimmick.fluid.audit(),value:barGame.gimmick.value,elapsed:barGame.craft.elapsed})),before,'Display switch cannot change simulation');
    assert((await page.locator('[data-pour-value]').innerText()).endsWith(' ml'));
    const gold=await page.locator('.pour-front').evaluate(e=>{const d=e.getContext('2d').getImageData(0,0,1000,540).data;let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-228)<=2&&Math.abs(d[i+1]-200)<=2&&Math.abs(d[i+2]-133)<=2&&d[i+3]>0)n++;return n;});
    if(mode==='classic')assert(gold>20,'Original target line retained');else assert.equal(gold,0,'No guide line');
    if(mode==='bottle'){
     assert.equal(await page.locator('.pour-back').evaluate(e=>e.getContext('2d').getImageData(0,0,1000,540).data.some((v,i)=>i%4===3&&v)),false,'No glass fill or shadow');
     const camera=JSON.parse(await page.locator('[data-fluid-stage]').getAttribute('data-camera'));
     assert(camera.scale>1.8);
     const tip=await page.evaluate(()=>LunaPour.nozzle(barGame.gimmick.angle));
     assert(Math.abs(tip.x*camera.scale+camera.x-500)<1e-8,'Outlet centered horizontally');
     assert(Math.abs(tip.y*camera.scale+camera.y-270)<1e-8,'Outlet centered vertically');
    }
    await page.screenshot({path:'/private/tmp/pour-'+mode+'-'+renderer+'-'+variant+'.png'});
   }
   const translations=[];
   for(const angle of [0,15,35,55,75,95,80,60,40,20,0]){
    await page.evaluate(angle=>{barGame.gimmick.angle=angle;barGame.changed();},angle);
    await page.waitForTimeout(35);
    const state=await page.evaluate(()=>{
     const stage=document.querySelector('[data-fluid-stage]'),c=JSON.parse(stage.dataset.camera),tip=LunaPour.nozzle(barGame.gimmick.angle);
     return {x:tip.x*c.scale+c.x,y:tip.y*c.scale+c.y,c};
    });
    assert(Math.abs(state.x-500)<1e-8&&Math.abs(state.y-270)<1e-8,'Outlet drift at '+angle);
    translations.push(state.c);
   }
   assert.notDeepEqual(translations[0],translations[5],'Camera must move with emitter');
   assert.deepEqual(translations[0],translations.at(-1),'Return motion restores centered initial camera');
  }
  await page.reload();await page.evaluate(()=>barGame.startMinigame('fill_up','original'));
  await page.waitForFunction(()=>document.querySelector('[data-fluid-stage]')?.dataset.presentation==='bottle');
  for(const [width,height]of [[960,540],[600,800],[1920,1080]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   assert(await page.locator('.pour-presentation-picker').evaluate(e=>{const a=e.getBoundingClientRect(),b=document.querySelector('.app-shell').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;}));
  }
  assert.deepEqual(errors,[]);console.log('POUR_PRESENTATIONS_OK',renderer,'all modes, both variants, same physics, fill-up, persistence, responsive');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
