const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.uiMix=[];const edges=new WeakMap(),connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
  AudioNode.prototype.connect=function(node,...args){edges.set(this,node);return connect.call(this,node,...args);};
  AudioBufferSourceNode.prototype.start=function(...args){const d=this.buffer?.duration,type=Math.abs(d-5455/48000)<.0001?'hover':Math.abs(d-52267/48000)<.0001?'click':null;
   if(type){const gain=edges.get(this),bus=edges.get(gain);uiMix.push({type,gain:gain.gain.value,bus:bus.gain.value});}return start.apply(this,args);};
 });
 await p.goto('http://127.0.0.1:8123/bar-playtest/');await p.locator('[data-campaign="title"]').click();await p.waitForFunction(()=>LunaHoverAudio.ready&&LunaClickAudio.ready);
 await p.evaluate(()=>{LunaSfx.setVolume(.8);uiMix.length=0;});await p.waitForTimeout(50);
 await p.mouse.move(1000,100);await p.locator('[data-campaign="options"]').hover();await p.waitForTimeout(150);await p.locator('[data-campaign="options"]').click();await p.waitForTimeout(150);
 const samples=await p.evaluate(()=>uiMix);assert(samples.some(x=>x.type==='hover'));assert(samples.some(x=>x.type==='click'));
 for(const x of samples){assert(Math.abs(x.gain-(x.type==='hover'?.32:.42))<1e-6);assert(Math.abs(x.bus-.8)<1e-6);}
 assert.equal(await p.evaluate(()=>LunaSfx.level('pour2')),.820);assert.equal(await p.evaluate(()=>LunaSfx.volume),.8);
 await p.evaluate(()=>{LunaSfx.setVolume(0);uiMix.length=0;});await p.locator('[data-campaign="music-toggle"]').hover();await p.locator('[data-campaign="music-toggle"]').click();await p.waitForTimeout(150);assert.deepEqual(await p.evaluate(()=>uiMix),[]);
 assert.deepEqual(errors,[]);console.log('PASS UI mix: hover 0.32 / click 0.42 source gains, master volume unchanged, other SFX levels unchanged, mute respected.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
