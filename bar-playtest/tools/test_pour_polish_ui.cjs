const {chromium}=require('/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--mute-audio']});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.stack));p.on('request',r=>requests.push(r.url()));
 await p.addInitScript(()=>localStorage.setItem('luna.pour.sound.v1','1'));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?mode=minigames');await p.waitForFunction(()=>!!window.barGame);if(await p.locator('.updates-close').count())await p.locator('.updates-close').click();
 await p.evaluate(()=>barGame.startMinigame('pour'));const stage=p.locator('[data-fluid-stage]'),screen=p.locator('.fluid-screen');await stage.waitFor();
 assert.equal(await screen.getAttribute('data-pour-sound'),'2');assert.equal(await p.locator('[data-act="pourSound"],[data-act="pourTestsToggle"],[data-pour-angle],.pour-drag-hint,.pour-hold').count(),0);
 await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.idleGuide==='true');await p.waitForTimeout(650);await p.screenshot({path:'/private/tmp/pour-idle-guide.png'});
 async function point(x,y){const r=await p.locator('[data-pixel-pour]').boundingBox(),k=Math.min(r.width/1000,r.height/540);return{x:r.x+(r.width-k*1000)/2+x*k,y:r.y+(r.height-k*540)/2+y*k};}
 let a=await point(450,250),z=await point(500,40);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y,{steps:8});
 await p.waitForFunction(()=>barGame.gimmick.fluid.popped);assert.equal(await stage.getAttribute('data-idle-guide'),'false');await p.waitForFunction(()=>document.querySelector('.fluid-screen').dataset.popSoundCount==='1');
 await p.screenshot({path:'/private/tmp/pour-pop-fx.png'});assert(await p.evaluate(()=>barGame.gimmick.fluid.cap.vy<0));
 await p.mouse.up();await p.waitForTimeout(1200);assert.equal(await screen.getAttribute('data-pop-sound-count'),'1');assert.equal(await stage.getAttribute('data-pop-fx'),'false');
 await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.idleGuide==='true');
 await p.keyboard.press('Escape');assert.notEqual(await stage.getAttribute('data-idle-guide'),'true');await p.keyboard.press('Escape');
 assert(requests.some(u=>u.includes('pour_02_loop.wav')));assert(!requests.some(u=>u.includes('pour_01_loop.wav')));await p.waitForFunction(()=>document.querySelector('.fluid-screen')?.dataset.pourAudioReady==='true');
 await p.evaluate(()=>barGame.startMinigame('fill_up'));await stage.waitFor();await p.waitForFunction(()=>document.querySelector('[data-fluid-stage]').dataset.idleGuide==='true');
 a=await point(450,210);z=await point(390,80);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y);await p.waitForFunction(()=>barGame.gimmick.fluid.caughtMl>10);assert.equal(await screen.getAttribute('data-pour-audio-playing'),'true');await p.mouse.up();assert(!await p.evaluate(()=>barGame.gimmick.fluid.popped));
 // Main-story pouring tutorial also uses the visual gesture, no obsolete text card.
 await p.evaluate(()=>{barGame.startMinigame('pour');barGame.gimmick.pourTutorial={step:'pour'};});await p.waitForTimeout(30);assert(await p.locator('.pour-tutorial').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS sound 2 even with old saved setting / no sound 1 request / removed UI / idle mouse guide / hidden during drag & pause / pop cue and single audio / can flow');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
