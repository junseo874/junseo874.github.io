const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().endsWith('/audio/hover_holo_01.wav'))requests.push(r.status());});
  await p.addInitScript(()=>{window.hoverStarts=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&Math.abs(this.buffer.duration-27117/48000)<.0001)hoverStarts.push(performance.now());return start.apply(this,args);};});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="developer"]').click();
  if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
  await p.waitForFunction(()=>LunaHoverAudio.ready);
  await p.evaluate(()=>{LunaSfx.setVolume(.8);LunaDialogueAudio.setVersion('off');barGame.reset(99,'practice',1);barGame.selectCocktail('gin_tonic');lunaCampaign.ui.tab='liquor';lunaCampaign.render(true);});
  const n=()=>p.evaluate(()=>hoverStarts.length);
  const hover=async selector=>{const before=await n();await p.locator(selector).hover();await p.waitForFunction(n=>hoverStarts.length===n+1,before);await p.waitForTimeout(120);assert.equal(await n(),before+1,'One cue per logical slot');};
  await hover('.shelf-item[data-id="gin"]');
  const held=await n();await p.locator('.shelf-item[data-id="gin"] img').hover();await p.waitForTimeout(650);assert.equal(await n(),held,'Child and stationary hover do not repeat');
  await p.evaluate(()=>lunaCampaign.render(true));await p.waitForTimeout(200);assert.equal(await n(),held,'Redraw does not replay');
  await p.mouse.move(5,5);await hover('.shelf-item[data-id="gin"]');
  // Move straight from one shelf item to another.
  const other=await p.locator('.shelf-slide[data-current="true"] .shelf-item:not([data-id="gin"])').first().getAttribute('data-id');
  await hover('.shelf-item[data-id="'+other+'"]');
  const muted=await n();await p.evaluate(()=>LunaSfx.setVolume(0));await p.locator('.shelf-item[data-id="gin"]').hover();await p.waitForTimeout(150);assert.equal(await n(),muted);
  await p.mouse.move(5,5);await p.evaluate(()=>LunaSfx.setVolume(.42));
  await p.evaluate(()=>{const output=LunaSfx.output;LunaSfx.output=c=>{const bus=output(c);window.hoverBus=bus;return bus;};});
  await hover('.shelf-item[data-id="gin"]');assert(Math.abs(await p.evaluate(()=>hoverBus.gain.value)-.42)<.0001);
  await p.mouse.move(5,5);
  await p.evaluate(()=>{barGame.progress.flags={chris_met:true,port_met:true};barGame.overlay='dossier';lunaCampaign.render(true);});
  await hover('.guest-card[data-id="chris"]');
  const portrait=await n();await p.locator('.guest-card[data-id="chris"] .guest-card-caption').hover();await p.waitForTimeout(150);assert.equal(await n(),portrait);
  await hover('.guest-card[data-id="port"]');
  const locked=await n();await p.locator('.guest-card.unmet').first().hover();await p.waitForTimeout(200);assert.equal(await n(),locked,'Unmet slots silent');
  await p.locator('.guest-card[data-id="chris"]').focus();await p.waitForFunction(n=>hoverStarts.length===n+1,locked);
  assert.deepEqual(requests,[200]);assert.deepEqual(errors,[]);
  console.log('PASS hover WAV: shelf transitions, nested images, stationary/redraw stability, leave/re-entry, profile slots, locked slots silent, keyboard focus, shared volume and mute, single cached file');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
