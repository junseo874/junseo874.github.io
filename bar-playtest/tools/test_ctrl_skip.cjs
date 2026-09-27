const assert=require('assert/strict');
const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const URL=process.env.LUNA_TEST_URL||'http://127.0.0.1:8123/bar-playtest/';
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(URL);await p.locator('.updates-confirm').click();
 const count=()=>p.evaluate(()=>barGame.history.length);
 const ready=()=>p.waitForFunction(()=>barGame.dialogue&&!barGame.cameraMoving&&!barGame.cameraLeft&&!barGame.transition);
 async function setup(day=0,mode='regular',variant='original'){await p.evaluate(({day,mode,variant})=>{barGame.reset(day,mode,1,true,{variant});barGame.speed=1;barGame.read.clear();},{day,mode,variant});await ready();}
 async function progress(key='ControlLeft'){const before=await count();await p.keyboard.down(key);await p.waitForTimeout(850);assert(await count()>before,'Held Ctrl did not advance dialogue');await p.keyboard.up(key);const after=await count();await p.waitForTimeout(350);assert.equal(await count(),after,'Skip continued after release');}
 // Reproduce the user-facing opening path using the real lobby controls.
 await p.locator('[data-act="day"][data-id="1"]').click();await p.locator('[data-act="start"]').click();await ready();
 assert.equal(await p.evaluate(()=>barGame.phase),'opening');await progress();
 for(const variant of ['original','gpt']){await setup(0,'regular',variant);await progress('ControlRight');await setup(1,'full',variant);await progress();}
 console.log('Real Day 1 opening and unread Day 0 regular dialogue, both variants and both Ctrl keys: PASS');
 // A held modifier has no repeat event when a phase changes.
 await p.evaluate(()=>barGame.reset(0,'full',1,false,{variant:'original'}));await p.locator('[data-act="start"]').waitFor();await p.keyboard.down('ControlLeft');
 await p.evaluate(()=>document.querySelector('[data-act="start"]').click());await ready();await p.waitForTimeout(700);assert(await count()>0);await p.keyboard.up('ControlLeft');
 await setup();await p.keyboard.down('ControlLeft');await p.keyboard.down('ControlRight');await p.keyboard.up('ControlLeft');const both=await count();await p.waitForTimeout(700);assert(await count()>both);await p.keyboard.up('ControlRight');const stopped=await count();await p.waitForTimeout(300);assert.equal(await count(),stopped);
 // Embedded host variants can report a modifier name or legacy keyCode without code.
 for(const event of [{key:'Control'},{keyCode:17}]){await setup();await p.evaluate(event=>window.dispatchEvent(new KeyboardEvent('keydown',{...event,ctrlKey:true,bubbles:true})),event);await p.waitForTimeout(700);assert(await count()>0);await p.evaluate(event=>window.dispatchEvent(new KeyboardEvent('keyup',{...event,ctrlKey:false,bubbles:true})),event);const n=await count();await p.waitForTimeout(250);assert.equal(await count(),n);}
 console.log('Held before entry, dual Ctrl release, key-only and legacy modifier events: PASS');
 await setup();await p.keyboard.press('Escape');const paused=await count();await p.keyboard.down('Control');await p.waitForTimeout(350);assert.equal(await count(),paused);await p.keyboard.up('Control');await p.keyboard.press('Escape');
 await p.keyboard.down('Control');await p.waitForTimeout(300);await p.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=await count();await p.waitForTimeout(300);assert.equal(await count(),blurred);await p.keyboard.up('Control');
 await setup();await p.evaluate(()=>{barGame.cameraLeft=1;barGame.cameraSame=true;});const camera=await count();await p.keyboard.down('Control');await p.waitForTimeout(300);assert.equal(await count(),camera);await p.keyboard.up('Control');
 await setup();await p.evaluate(()=>{const i=document.createElement('input');i.id='ctrl-test-input';document.body.append(i);i.focus();});await p.keyboard.down('Control');await p.waitForTimeout(350);assert.equal(await count(),0);await p.keyboard.up('Control');await p.evaluate(()=>document.getElementById('ctrl-test-input').remove());
 await p.evaluate(()=>barGame.reset(99,'regular',1));await p.waitForFunction(()=>!!barGame.choice&&!barGame.cameraMoving&&!barGame.transition);await p.keyboard.down('Control');await p.waitForTimeout(400);assert(await p.evaluate(()=>!!barGame.choice));assert.equal(await p.evaluate(()=>barGame.logs.filter(r=>r.event==='choice').length),0);await p.keyboard.up('Control');
 await setup();await p.keyboard.down('Control');await p.waitForFunction(()=>barGame.screen==='recipe',null,{timeout:30000});await p.waitForTimeout(350);assert(await p.evaluate(()=>!!barGame.currentOrder&&!barGame.craft&&barGame.screen==='recipe'));await p.keyboard.up('Control');
 await p.evaluate(()=>barGame.reset(1,'general',1));await p.keyboard.down('Control');await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>barGame.phase),'general');assert.equal(await count(),0);await p.keyboard.up('Control');
 assert.deepEqual(errors,[]);console.log('Menus, blur, camera, text fields, choices and crafting remain guarded; general guests unchanged: PASS');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
