const assert=require('node:assert/strict'),r=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await r.load('playwright').chromium.launch({executablePath:r.chrome,headless:true});try{
const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');if(await p.locator('.updates-confirm').isVisible())await p.locator('.updates-confirm').click();
await p.evaluate(()=>barGame.startMinigame('pour',{ingredient:'gin'}));await p.locator('[data-pixel-pour]').waitFor();
const canvas=p.locator('[data-pixel-pour]'),box=await canvas.boundingBox();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.35);await p.mouse.down();
const state=await p.evaluate(()=>{const c=document.querySelector('[data-pixel-pour]'),rect=c.getBoundingClientRect.bind(c);c.getBoundingClientRect=()=>({left:300,top:200,width:0,height:0});c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:300,clientY:200,buttons:1}));c.getBoundingClientRect=rect;barGame.tick(1/60);const s=barGame.gimmick;return {finite:Number.isFinite(s.angle)&&Number.isFinite(s.fluid.nozzle().x),held:s.held};});
assert(state.finite,'A zero-sized canvas must not poison the pour physics');await p.mouse.up();
await p.keyboard.down('Space');await p.waitForTimeout(900);await p.keyboard.up('Space');assert(await p.evaluate(()=>barGame.gimmick.fluid.emittedMl>0),'Pouring resumes after interrupted layout');
await p.mouse.move(box.x+box.width*.7,box.y+box.height*.35);await p.mouse.down();await p.setViewportSize({width:960,height:650});await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>barGame.gimmick.held),false);await p.mouse.up();
const resized=await canvas.boundingBox();await p.mouse.move(resized.x+resized.width*.7,resized.y+resized.height*.35);await p.mouse.down();assert(await p.evaluate(()=>barGame.gimmick.held));await p.mouse.up();
for(const view of ['title','options','loading','prologue']){await p.evaluate(view=>lunaCampaign.screen(view),view);assert(await p.evaluate(()=>{const e=new KeyboardEvent('keydown',{code:'F11',key:'F11',bubbles:true,cancelable:true});document.body.dispatchEvent(e);return !e.defaultPrevented;}),'F11 remains native in '+view);}
assert.deepEqual(errors,[]);console.log('PASS invalid layout drag recovery, keyboard resume and native F11');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
