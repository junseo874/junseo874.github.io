const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage(),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().endsWith('/audio/credits.wav'))requests.push(r.status());});
  await p.addInitScript(()=>{window.creditStarts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&Math.abs(this.buffer.duration-32751/48000)<.0001)creditStarts.push(performance.now());return start.apply(this,args);};});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.waitForFunction(()=>LunaCurrencyAudio.ready);
  await p.evaluate(()=>{LunaSfx.setVolume(.8);LunaDialogueAudio.setVersion('off');barGame.reset(99,'practice',1);barGame.screen='bar';});
  await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>creditStarts.length),0,'Initial balance stays silent');
  const count=()=>p.evaluate(()=>creditStarts.length);
  const change=async fn=>{const n=await count();await p.evaluate(fn);await p.waitForFunction(n=>creditStarts.length===n+1,n).catch(async e=>{console.log(await p.evaluate(()=>({starts:creditStarts,money:barGame.progress.money,flags:barGame.progress.flags,config:outsidePlaytest.config,speech:outsidePlaytest.model?.story?.speech,ready:LunaCurrencyAudio.ready,hidden:document.hidden})));throw e;});await p.waitForTimeout(160);assert.equal(await count(),n+1,'Exactly one cue, not every HUD frame');};
  await change(()=>barGame.settle({orderId:'credits-test',served:'gin_tonic',grade:'excellent',match:true}));
  const settled=await count();await p.evaluate(()=>barGame.settle({orderId:'credits-test',served:'gin_tonic',grade:'excellent',match:true}));await p.waitForTimeout(150);assert.equal(await count(),settled,'Duplicate settlement silent');
  await change(()=>LunaCore.applyEffects('money-=50',barGame.progress));
  await change(()=>LunaCore.applyEffects('money+=100',barGame.progress));
  const beforeReset=await count();await p.evaluate(()=>{barGame.reset(2,'practice',1);barGame.screen='bar';barGame.progress.money=2000;});await p.waitForTimeout(200);assert.equal(await count(),beforeReset,'New progress starts silently');
  await p.evaluate(()=>{Object.assign(outsidePlaytest.config,{day:2,flow:'out',place:'bar'});return outsidePlaytest.start();});
  await p.waitForFunction(()=>outsidePlaytest.active&&!outsidePlaytest.loading);await p.waitForTimeout(200);assert.equal(await count(),beforeReset,'Entering street does not replay balance');
  // Actual shop purchase, not just manually lowering the wallet.
  await change(()=>{const m=outsidePlaytest.model;barGame.progress.flags.shiba_shop_met=true;const drain=()=>{for(let i=0;m.story.speech&&!m.story.speech.choice&&i<100;i++){m.story.speech.elapsed=99;m.story.advance();}};LunaOutsideShop.begin(m,{x:-2.68,y:-.596},false);drain();m.story.choose('shop-yes');drain();m.story.choose('shop-buy-wild_dog');drain();});
  assert.equal(await p.locator('.outside-money-notice .currency-delta').textContent(),'−600');
  await change(()=>LunaCore.applyEffects('money+=500',barGame.progress));
  const muted=await count();await p.evaluate(()=>{LunaSfx.setVolume(0);barGame.progress.money-=100;});await p.waitForTimeout(200);assert.equal(await count(),muted,'Muted changes stay silent');
  await p.evaluate(()=>LunaSfx.setVolume(.42));await p.waitForTimeout(200);assert.equal(await count(),muted,'Unmuting does not replay');
  await p.evaluate(()=>{const output=LunaSfx.output;LunaSfx.output=c=>{const bus=output(c);window.creditBus=bus;return bus;};});
  await change(()=>{barGame.progress.money-=100;});
  assert(Math.abs(await p.evaluate(()=>creditBus.gain.value)-.42)<.0001);
  await p.evaluate(()=>LunaSfx.setVolume(0));assert.equal(await p.evaluate(()=>creditBus.gain.value),0,'Live master mute');
  const returning=await count();await p.evaluate(()=>{outsidePlaytest.exit(true);LunaSfx.setVolume(.8);});await p.waitForTimeout(250);assert.equal(await count(),returning,'Return to bar stays silent');
  // A reset in the same turn invalidates async playback from an old balance.
  await p.evaluate(()=>{const v=LunaCurrencyView(),q={money:0};v.reset(q);q.money=5;v.update(q);v.reset(q);});await p.waitForTimeout(150);assert.equal(await count(),returning);
  assert.deepEqual(requests,[200]);assert.deepEqual(errors,[]);
  console.log('PASS credits: real bar settlement, duplicate guard, spend/income, real street purchase, street income, reset/scene silence, master volume/mute, stale callback guard, single cached WAV, no browser errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
