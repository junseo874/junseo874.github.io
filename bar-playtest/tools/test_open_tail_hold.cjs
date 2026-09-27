const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 for(const variant of ['original','gpt']){
  const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(Math.abs((this.buffer?.duration||0)-3.5)<.001){const event=window.fizzTest={start:args[0],duration:this.buffer.duration,ended:false};this.addEventListener('ended',()=>{event.ended=true;event.end=this.context.currentTime;event.screen=barGame.screen;});}return start.apply(this,args);};});
  await p.goto('http://127.0.0.1:8123/bar-playtest/');
  await p.evaluate(v=>barGame.startMinigame('open',v),variant);await p.keyboard.press('Space');
  await p.waitForFunction(()=>document.querySelector('[data-opening-stage]')?.dataset.fizzAudioReady==='true');
  await p.evaluate(()=>barGame.gimmick.beatTime=1.54);await p.keyboard.press('Space');
  await p.waitForFunction(()=>window.fizzTest);const elapsed=await p.evaluate(()=>barGame.craft.elapsed);
  await p.waitForTimeout(950);assert.equal(await p.evaluate(()=>barGame.screen),'gimmick');assert.equal(await p.evaluate(()=>fizzTest.ended),false);
  assert(await p.locator('[data-act="endGimmick"]').isDisabled());
  await p.waitForFunction(()=>fizzTest.ended);
  const sound=await p.evaluate(()=>fizzTest);assert(sound.end>=sound.start+sound.duration-.03,'Fizz must finish naturally');assert.equal(sound.screen,'gimmick','Stay on success screen through audio tail');
  if(variant==='original'){await p.locator('[data-act="endGimmick"]').click();}
  await p.locator('.minigame-result').waitFor();
  assert.equal(await p.evaluate(()=>barGame.minigame.result.elapsed),elapsed,'Reveal time is not active craft time');
  assert.equal(await p.evaluate(()=>barGame.minigame.result.score),100);assert.deepEqual(errors,[]);
  console.log('OPEN_TAIL_HOLD_OK',variant,sound);await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
