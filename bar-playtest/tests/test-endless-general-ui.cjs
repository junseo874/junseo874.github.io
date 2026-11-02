const assert=require('node:assert/strict'),rt=require('../../tools/lib/test-runtime.cjs');
(async()=>{const b=await rt.load('playwright').chromium.launch({executablePath:rt.chrome,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8123/bar-playtest/?dev=1');await p.locator('.updates-confirm').click();
 await p.locator('[data-act="day"][data-id="99"]').click();
 await p.locator('#start-mode').selectOption('endless-general');await p.locator('[data-act="start"]').click();
 await p.waitForFunction(()=>barGame.endlessGeneral&&barGame.phase==='general'&&!barGame.story);
 const result=await p.evaluate(()=>{const g=barGame;g.seats={L:null,M:null,R:null};for(let i=0;i<3;i++)g.spawn();const serial=g.serial;g.spawn();const blocked=g.spawnBlocked;const appearances=Object.values(g.seats).map(x=>x.appearance);g.clearDepartedSeat('L');g.tableFades={};g.spawnLeft=0;g.spawnBlocked=false;g.tickGeneral(.01);return{blocked,serial,after:g.serial,phase:g.phase,anonymous:Object.values(g.seats).every(x=>x&&!x.slot.character&&x.appearance),queue:g.queue.length,appearances};});
 assert(result.blocked);assert.equal(result.after,result.serial+1);assert.equal(result.queue,1);assert.equal(result.phase,'general');assert(result.anonymous);
 await p.waitForTimeout(1200);await p.screenshot({path:'/private/tmp/endless-general.png'});assert.deepEqual(errors,[]);
 console.log('ENDLESS_GENERAL_UI_OK: actual QA99 selector starts anonymous-only service, three-seat cap and refill, no QA dialogue or browser errors.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
