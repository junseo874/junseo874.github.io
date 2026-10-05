const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
for(const renderer of ['webgl','canvas2d']){
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
 if(renderer==='canvas2d')await p.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:old.call(this,type,...args);};});
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 // Real stage rendering uses the ingredient policy for both normal pouring and fill-up.
 for(const [ingredient,expected] of [['soda_water','none'],['cola','none'],['cranberry_juice','none'],['milk','none'],['beer','none'],['orange_juice','none'],['red_wine','none'],['champagne','none'],['gin','pourer'],['wild_dog','pourer'],['bitters','pourer']]){
  for(const type of ['pour','fill_up']){
   await p.evaluate(({ingredient,type})=>{const g=barGame;g.startMinigame(type,'original');g.craft.queue=[{type,ingredient,target:300,unit:'ml'}];g.craft.index=0;g.nextGimmick();lunaCampaign.render(true);},{ingredient,type});
   await p.waitForFunction(expected=>document.querySelector('[data-fluid-stage]')?.dataset.pourTool===expected,expected);
   assert.equal(await p.locator('.pour-tool-drawer,.pour-tools-toggle,[data-act="pourTool"]').count(),0);
   assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-renderer'),renderer);
   assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.rate/barGame.gimmick.fluid.baseRate),expected==='none'?4:1);
  }
 }
 await p.locator('.pour-tests-toggle').click();
 await p.locator('[data-act="pourSound"][data-id="2"]').click();
 for(const mode of ['classic','clean','bottle']){await p.locator('[data-act="pourPresentation"][data-id="'+mode+'"]').click();await p.waitForFunction(mode=>document.querySelector('[data-fluid-stage]')?.dataset.presentation===mode,mode);}
 await p.keyboard.press('Escape');assert.equal(await p.locator('.pour-test-panel').isVisible(),false);assert.equal(await p.evaluate(()=>barGame.overlay),null);
 // Compare rendered bottles at the same pose, with a real ingredient switch (not a tool override).
 for(const [ingredient,tool] of [['gin','pourer'],['beer','none']]){
  await p.evaluate(ingredient=>{const g=barGame;g.startMinigame('pour','original');g.craft.queue=[{type:'pour',ingredient,target:300,unit:'ml'}];g.craft.index=0;g.nextGimmick();lunaCampaign.render(true);g.gimmick.started=true;g.gimmick.held=true;for(let i=0;i<240;i++)g.tick(1/120);g.gimmick.held=false;window.savedPourTick=g.tick;g.tick=()=>{};g.changed();},ingredient);
  await p.waitForTimeout(180);
  const state=await p.evaluate(()=>{const s=barGame.gimmick,stage=document.querySelector('[data-fluid-stage]'),cam=JSON.parse(stage.dataset.camera),n=LunaPour.nozzle(s.angle,s.fluid.tool);return{tool:s.fluid.tool,x:n.x*cam.scale+cam.x,y:n.y*cam.scale+cam.y,error:s.fluid.audit().error,width:Math.max(...s.fluid.particles.filter(p=>p.stream===s.fluid.streamSerial).map(p=>p.emissionWidth||1))};});
  assert.equal(state.tool,tool);assert(Math.abs(state.x-500)<1e-8&&Math.abs(state.y-270)<1e-8);assert(Math.abs(state.error)<1e-6);assert.equal(state.width,tool==='none'?2:1);
  await p.screenshot({path:'/private/tmp/ingredient-pourer-'+ingredient+'-'+renderer+'.png'});
  await p.evaluate(()=>{barGame.tick=window.savedPourTick;});
 }
 for(const [width,height] of [[960,540],[600,800],[1920,1080]]){await p.setViewportSize({width,height});await p.locator('.pour-tests-toggle').click();const box=await p.locator('.pour-test-panel').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);await p.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);console.log('POUR_FIXED_TOOLS_UI_OK',renderer,'all 8 bare ingredients, fitted spirits, pour/fill-up, no selector, correct outlet/stream/rate, settings/responsive');await p.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
