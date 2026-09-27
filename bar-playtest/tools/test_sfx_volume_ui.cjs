const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require('path').resolve(__dirname,'../sfx-audio.js'),'utf8');
function unit(raw){const saved={raw},ctx={window:{},localStorage:{getItem:()=>saved.raw,setItem:(k,v)=>saved.raw=v}};vm.createContext(ctx);vm.runInContext(source,ctx);return{fx:ctx.window.LunaSfx,saved};}
for(const raw of [null,'null','"bad"','{}','invalid'])assert.equal(unit(raw).fx.volume,.8);
assert.equal(unit('0').fx.volume,0);assert.equal(unit('2').fx.volume,1);
const {fx,saved}=unit(null);let disconnected=0;
const context={state:'running',currentTime:0,destination:{},createGain:()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},connect(){},disconnect(){disconnected++;}})};
const bus=fx.output(context);assert.equal(bus.gain.value,.8);assert.equal(fx.output(context),bus);
fx.setVolume(0);assert.equal(bus.gain.value,0);assert.equal(saved.raw,'0');fx.setVolume(.42);assert.equal(bus.gain.value,.42);
fx.setVolume(NaN);assert.equal(fx.volume,.42);context.state='closed';fx.setVolume(.5);assert.equal(disconnected,1);
console.log('SFX_UNIT_OK: default, persistence, invalid values, live bus, zero mute, cleanup.');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{let b;try{
 b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');
 await p.evaluate(()=>barGame.startMinigame('open','original'));
 await p.keyboard.press('Escape');
 const slider=p.locator('#sfx-volume');await slider.waitFor();assert.equal(await slider.inputValue(),'80');
 const bgmBefore=await p.locator('#bgm-volume').inputValue();
 await slider.fill('35');await slider.dispatchEvent('input');
 assert.equal(await p.locator('output[for=sfx-volume]').innerText(),'35%');
 assert.equal(await p.evaluate(()=>LunaSfx.volume),.35);assert.equal(await p.locator('#bgm-volume').inputValue(),bgmBefore);
 await slider.focus();await p.keyboard.press('ArrowRight');assert.equal(await slider.inputValue(),'36');
 await slider.fill('0');await slider.dispatchEvent('input');assert.equal(await p.evaluate(()=>LunaSfx.volume),0);
 await p.reload();await p.evaluate(()=>barGame.startMinigame('open','original'));await p.keyboard.press('Escape');
 assert.equal(await slider.inputValue(),'0');
 await slider.fill('65');await slider.dispatchEvent('input');await p.screenshot({path:'/private/tmp/sfx-volume-settings.png'});
 await p.keyboard.press('Escape');
 // Track the actual master nodes used by live gimmick playback.
 await p.evaluate(()=>{window.sfxBuses=[];const base=LunaSfx.output;LunaSfx.output=c=>{const bus=base(c);if(!sfxBuses.some(v=>v.bus===bus))sfxBuses.push({bus,c});return bus;};});
 await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('[data-opening-stage]').dataset.openAudioReady==='true');
 await p.evaluate(()=>barGame.gimmick.beatTime=1.54);await p.keyboard.press('Space');await p.waitForTimeout(120);
 assert(await p.evaluate(()=>sfxBuses.length>0));assert(await p.evaluate(()=>sfxBuses.every(v=>Math.abs(v.bus.gain.value-.65)<.001)));
 await p.evaluate(()=>LunaSfx.setVolume(0));await p.waitForTimeout(80);
 assert(await p.evaluate(()=>sfxBuses.every(v=>v.bus.gain.value===0)),'Live playing sound silenced');
 await p.evaluate(()=>LunaSfx.setVolume(.3));await p.waitForTimeout(80);
 assert(await p.evaluate(()=>sfxBuses.every(v=>Math.abs(v.bus.gain.value-.3)<.001)));
 for(const type of ['shake','stir','pour']){
  await p.evaluate(type=>barGame.startMinigame(type,'original'),type);await p.waitForTimeout(150);
  await p.keyboard.press('Space');await p.waitForTimeout(200);
  if(type==='shake'){await p.keyboard.press('Space');}
  if(type==='stir'){await p.keyboard.press('KeyW');await p.keyboard.press('KeyD');}
  if(type==='pour'){await p.keyboard.down('Space');await p.waitForTimeout(1600);await p.keyboard.up('Space');}
  await p.waitForTimeout(200);
 }
 assert(await p.evaluate(()=>sfxBuses.length>=4),'All four gimmick contexts use master bus');
 await p.evaluate(()=>LunaSfx.setVolume(0));await p.waitForTimeout(80);
 assert(await p.evaluate(()=>sfxBuses.every(v=>v.bus.gain.value===0)),'All contexts muted: '+JSON.stringify(await p.evaluate(()=>sfxBuses.map(v=>({state:v.c.state,value:v.bus.gain.value,time:v.c.currentTime})))));
 // GPT notifications have their own context, but the same volume control.
 await p.evaluate(()=>barGame.startMinigame('open','gpt'));await p.keyboard.press('Space');await p.waitForTimeout(150);
 await p.evaluate(()=>{barGame.remix.cue={id:999,kind:'arrival'};});await p.waitForTimeout(100);
 assert(await p.evaluate(()=>sfxBuses.length>=5));assert(await p.evaluate(()=>sfxBuses.every(v=>v.bus.gain.value===0)));
 assert.deepEqual(errors,[]);console.log('SFX_UI_OK: slider, keyboard, BGM isolation, persisted zero, live playback adjustment, all gimmicks, GPT notices.');
}finally{await b?.close();}})().catch(e=>{console.error(e);process.exitCode=1});
