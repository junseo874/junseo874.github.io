const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.locator('[data-campaign="new"]').click();await p.waitForFunction(()=>lunaCampaign.view==='prologue',null,{timeout:60000});
 assert.equal(await p.locator('.outside-controls-tutorial').count(),0);
 await p.evaluate(()=>{lunaCampaign.cinema.time=lunaCampaign.cinema.scene.end-.01;});await p.waitForFunction(()=>lunaCampaign.view==='game'&&!lunaCampaign.memoryTransition);
 const panel=p.locator('.outside-controls-tutorial');assert(await panel.isVisible());assert.equal(await panel.getAttribute('aria-modal'),'true');
 await p.waitForTimeout(400);
 for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:900,height:700}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(150);const r=await panel.boundingBox();assert(Math.abs(r.x+r.width/2-viewport.width/2)<2);assert(Math.abs(r.y+r.height/2-viewport.height/2)<2);assert(r.width>viewport.width*.5,JSON.stringify({viewport,r}));assert(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height);
 }
 await p.setViewportSize({width:1440,height:900});await p.screenshot({path:'/private/tmp/controls-tutorial-centered.png'});
 assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);
 // No automatic timeout; dismissing movement key repeats must not move Luna.
 await p.evaluate(()=>{for(let i=0;i<300;i++)outsidePlaytest.tick(.05);});assert(await panel.isVisible());
 await p.keyboard.down('KeyA');assert(await panel.isHidden());await p.keyboard.down('KeyA');await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>outsidePlaytest.model.x),2.557);await p.keyboard.up('KeyA');
 await p.keyboard.down('KeyA');await p.waitForTimeout(150);await p.keyboard.up('KeyA');assert(await p.evaluate(()=>outsidePlaytest.model.x<2.557));
 for(const key of ['KeyE','Space','Enter','Escape','KeyP','Tab','ShiftLeft','KeyQ','F2']){
  await p.evaluate(()=>outsidePlaytest.showControlsTutorial());assert(await panel.isVisible());
  await p.keyboard.press(key);assert(await panel.isHidden());assert.equal(await p.evaluate(()=>lunaCampaign.view),'game');assert.equal(await p.evaluate(()=>outsidePlaytest.devConsoleOpen),false);assert.equal(await p.evaluate(()=>outsidePlaytest.model.dialog),null);
 }
 await p.evaluate(()=>outsidePlaytest.showControlsTutorial());const key=p.locator('kbd[data-controls-key="KeyD"]');assert.equal(await key.evaluate(el=>getComputedStyle(el).animationName),'controls-key');await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await key.evaluate(el=>getComputedStyle(el).animationName),'none');
 await p.locator('[data-outside-action="controls-close"]').click();assert(await panel.isHidden());await p.waitForTimeout(400);assert(await panel.isHidden());
 const states=await p.evaluate(()=>[0,1,2,3].flatMap(day=>['in','out'].map(flow=>{const m=new LunaOutside.Model({day,flow,place:'home'});m.wakeAtSofa();return {day,flow,x:m.x,sofa:m.targets().some(t=>t.id==='sofa'),near:m.near?.id};})));
 for(const s of states){assert.equal(s.x,2.557);assert.equal(s.sofa,s.flow==='out');assert.equal(s.near,s.flow==='out'?'sofa':undefined);}
 assert.deepEqual(errors,[]);console.log('PASS centered large modal / responsive layout / no timeout / any-key dismissal / no input leakage or held-key movement / reduced motion / sofa rules');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
