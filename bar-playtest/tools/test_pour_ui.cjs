const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 await p.goto(BASE+'?mode=minigames');
 for(const variant of ['original','gpt'])for(const kind of ['pour','fill_up']){
  await p.evaluate(({kind,variant})=>barGame.startMinigame(kind,variant),{kind,variant});await p.locator('[data-fluid-stage]').waitFor();
  assert.equal(await p.locator('.pour-dashboard,.pour-bottom-note,[data-pour-status],.craft-top,.gimmick-footer').count(),0);assert.equal(await p.locator('.pour-top-readout strong').count(),2);
  assert.equal(await p.locator('.pour-top-readout').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  const hud=await p.locator('.pour-top-readout').boundingBox();assert(hud.x<40&&hud.y<40);
  await p.waitForTimeout(150);assert.equal(await p.locator('[data-fluid-stage]').getAttribute('data-renderer'),'webgl');
  await p.keyboard.press('KeyD');await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.emittedMl),0);
  const button=p.locator('[data-hold="pour"]');await button.hover();await p.mouse.down();
  await p.waitForFunction(()=>barGame.gimmick.fluid.emittedMl>2);await p.mouse.up();
  await p.keyboard.press('Escape');await p.waitForTimeout(100);const state=await p.evaluate(()=>JSON.stringify(barGame.gimmick));
  await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),state);await p.keyboard.press('Escape');
  await p.keyboard.down('Space');await p.waitForFunction(()=>barGame.gimmick.fluid.predicted(barGame.gimmick)>=barGame.gimmick.target*.97);await p.keyboard.up('Space');
  await p.screenshot({path:'/private/tmp/pour-'+variant+'-'+kind+'.png'});
  const before=await p.evaluate(()=>barGame.gimmick.value);
  await p.locator('[data-act="endGimmick"]').click();assert.equal(await p.locator('[data-hold="pour"]').isDisabled(),true);
  await p.locator('.minigame-result').waitFor({timeout:15000});
  const result=await p.evaluate(()=>barGame.minigame.result);assert(result.value>=before);assert(Math.abs(result.liquid.error)<1e-7);assert(result.liquid.air<1e-7);
  assert.equal(await p.evaluate(()=>barGame.craft.results.length),1);await p.locator('[data-act="miniRetry"]').click();
  assert.equal(await p.evaluate(()=>barGame.gimmick.fluid.emittedMl),0);assert.equal(await p.evaluate(()=>barGame.gimmick.started),false);
 }
 // A lost GPU context changes only the renderer, never physics or retained mass.
 await p.keyboard.press('Escape');
 await p.evaluate(()=>{const c=document.querySelector('.pour-gpu');window.pourContextExt=c.getContext('webgl').getExtension('WEBGL_lose_context');pourContextExt.loseContext();});
 await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.renderer==='canvas2d');
 const frozen=await p.evaluate(()=>JSON.stringify(barGame.gimmick));await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>JSON.stringify(barGame.gimmick)),frozen);
 await p.evaluate(()=>pourContextExt.restoreContext());await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.renderer==='webgl');await p.keyboard.press('Escape');
 // Estimate frame cadence during a moderate steady pour; log, don't promise a universal hardware FPS.
 const perf=await p.evaluate(()=>new Promise(resolve=>{let previous=null,begin=null;const gaps=[];barGame.holdPour(true);function frame(now){begin??=now;if(previous!==null)gaps.push(now-previous);previous=now;if(now-begin<2300)requestAnimationFrame(frame);else{barGame.holdPour(false);resolve({gaps,particles:barGame.gimmick.fluid.particles.length});}}requestAnimationFrame(frame);}));
 const sorted=perf.gaps.sort((a,b)=>a-b);console.log('POUR_RENDER_CADENCE',JSON.stringify({frames:sorted.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],particles:perf.particles}));
 for(const [width,height] of [[960,540],[1440,900]]){await p.setViewportSize({width,height});await p.waitForTimeout(100);const box=await p.locator('.app-shell').boundingBox();assert(Math.abs(box.width/box.height-16/9)<.001);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'/private/tmp/pour-size-'+width+'.png'});}
 await p.locator('[data-act="miniExit"]').click();await p.locator('[data-act="miniLobby"]').click();await p.locator('.minigame-lobby').waitFor();assert.equal(await p.locator('canvas.pour-gpu').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('POUR_UI_OK: both versions, pouring/fill-up, real pointer & keyboard, in-flight completion, pause/retry, GPU recovery, responsive layout.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
