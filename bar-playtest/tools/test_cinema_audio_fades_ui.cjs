const assert=require('node:assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/cinema-audio-harness',r=>r.fulfill({contentType:'text/html',body:'<button onclick="StudioMedia.unlock()">Play</button><script src="../cutscene-studio/media.js"></script>'}));
  await p.goto('http://127.0.0.1:8123/bar-playtest/cinema-audio-harness');await p.locator('button').click();
  const result=await p.evaluate(async()=>{
   await StudioMedia.ready;StudioMedia.assets.set('fade-probe',{kind:'audio',synth:'room'});await StudioMedia.decode('fade-probe');
   const gain=AudioContext.prototype.createGain,stop=AudioBufferSourceNode.prototype.stop,gains=[],stops=[];
   AudioContext.prototype.createGain=function(...args){const node=gain.apply(this,args);gains.push(node);return node;};
   AudioBufferSourceNode.prototype.stop=function(when){stops.push({delay:(when??this.context.currentTime)-this.context.currentTime});return stop.call(this,when);};
   const clip={id:'loop',type:'audio',assetId:'fade-probe',start:0,duration:20,offset:0,loop:true,volume:.5},project={tracks:[],clips:[clip]},wait=ms=>new Promise(r=>setTimeout(r,ms)),fades={fadeIn:.6,fadeOut:.5};
   try{
    StudioMedia.sync(project,1,true,1,1,fades);await wait(30);const envelope=gains[1],first=envelope.gain.value;await wait(300);const middle=envelope.gain.value;
    StudioMedia.stop(.5);const stopDelay=stops.at(-1).delay,before=envelope.gain.value;await wait(250);const fading=envelope.gain.value;
    StudioMedia.sync(project,1,true,1,1,fades);await wait(30);const resumed=gains[3].gain.value;await wait(600);const resumedFull=gains[3].gain.value;StudioMedia.stop(.5);
    const count=gains.length;clip.id='one-shot';clip.loop=false;StudioMedia.sync(project,.1,true,1,1,fades);await wait(30);const oneShotGains=gains.length-count;StudioMedia.stop(.5);const oneShotStop=stops.at(-1).delay;
    const editorCount=gains.length;clip.id='editor';clip.loop=true;StudioMedia.sync(project,1,true,1);await wait(30);const editorGains=gains.length-editorCount;StudioMedia.stop();const editorStop=stops.at(-1).delay;
    return {first,middle,before,fading,stopDelay,resumed,resumedFull,oneShotGains,oneShotStop,editorGains,editorStop};
   }finally{StudioMedia.stop();AudioContext.prototype.createGain=gain;AudioBufferSourceNode.prototype.stop=stop;}
  });
  assert(result.first>=0&&result.first<.2);assert(result.middle>.3&&result.middle<.9);
  assert(result.stopDelay>.45&&result.stopDelay<.55);assert(result.fading>=0&&result.fading<result.before);
  assert(result.resumed<.2);assert.equal(result.resumedFull,1);
  assert.equal(result.oneShotGains,1);assert(result.oneShotStop<=0);
  assert.equal(result.editorGains,1);assert(result.editorStop<=0);
  assert.deepEqual(errors,[]);console.log('PASS cinema continuous audio: attack/release, pause/resume envelopes; one-shot timing and editor defaults unchanged');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
